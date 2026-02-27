import React, { createContext, useState, useContext, useEffect } from 'react';
import { reportFunctions } from '../lib/supabase';

const DataContext = createContext();

const INITIAL_CLASSES = [
  { id: '1', name: 'Adonay' },
  { id: '2', name: 'Geracao Eleita' },
  { id: '3', name: 'Jardim de Deus' },
  { id: '4', name: 'Vencedores do Rei' },
  { id: '5', name: 'Abraao' },
  { id: '6', name: 'Crescendo com Cristo' },
];

export const DataProvider = ({ children }) => {
  const [reports, setReports] = useState([]);
  const [classes] = useState(INITIAL_CLASSES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Carregar relatórios do Supabase
  const loadReports = async (date = null) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (date) {
        result = await reportFunctions.getReportsByDate(date);
      } else {
        result = await reportFunctions.getAllReports();
      }

      if (result.success && result.data) {
        // Converter dados do Supabase para formato local
        const formattedReports = result.data.map(report => ({
          id: report.id,
          date: report.data_aula,
          classId: classes.find(c => c.name === report.classe)?.id || '1',
          className: report.classe,
          matriculated: Number(report.matriculados),
          absent: Number(report.ausentes),
          present: Number(report.presentes),
          visitor: Number(report.visitantes),
          bibles: Number(report.biblias),
          magazines: Number(report.revistas),
          offering: Number(report.ofertas),
          percentage: Number(report.matriculados) > 0 ? Math.round((Number(report.presentes) / Number(report.matriculados)) * 100) : 0,
        }));
        setReports(formattedReports);
      } else {
        setError(result?.error || 'Erro ao carregar relatórios');
        setReports([]);
      }
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
      setError(err.message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Salvar relatório no Supabase
  const saveReport = async (classId, formData) => {
    setLoading(true);
    setError(null);
    try {
      const classData = classes.find(c => c.id === classId);
      const today = new Date().toISOString().split('T')[0];

      // Salvar no Supabase
      const result = await reportFunctions.saveReport({
        date: today,
        className: classData.name,
        matriculated: Number(formData.matriculated),
        absent: Number(formData.absent),
        present: Number(formData.present),
        visitor: Number(formData.visitor),
        bibles: Number(formData.bibles),
        magazines: Number(formData.magazines),
        offering: Number(formData.offering),
      });

      if (result.success) {
        // Recarregar relatórios da data
        await loadReports(today);
        return { success: true };
      } else {
        setError(result.error || 'Erro ao salvar relatório');
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Erro ao salvar relatório:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Obter relatórios por data
  const getReportsByDate = (date) => {
    return reports.filter(r => r.date === date);
  };

  // Obter todos os relatórios
  const getAllReports = () => {
    return reports;
  };

  // Deletar todos os relatórios de uma data
  const deleteReportsByDate = async (date) => {
    setLoading(true);
    setError(null);
    try {
      // Deletar do Supabase
      const result = await reportFunctions.deleteReportsByDate(date);
      
      if (result.success) {
        // Recarregar relatórios
        await loadReports();
        return { success: true };
      } else {
        setError(result.error || 'Erro ao deletar relatórios');
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Erro ao deletar relatórios:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Carregar relatórios ao montar
  useEffect(() => {
    loadReports();
  }, []);

  const value = {
    reports,
    classes,
    loading,
    error,
    loadReports,
    saveReport,
    getReportsByDate,
    getAllReports,
    deleteReportsByDate,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de DataProvider');
  }
  return context;
};

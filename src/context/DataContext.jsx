import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Carregar relatorios do Supabase
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

      if (result.success) {
        // Converter dados do Supabase para formato local
        const formattedReports = result.data.map(report => ({
          id: report.id,
          date: report.data_aula,
          classId: classes.find(c => c.name === report.classe)?.id || '1',
          className: report.classe,
          matriculated: report.matriculados,
          absent: report.ausentes,
          present: report.presentes,
          visitor: report.visitantes,
          bibles: report.biblias,
          magazines: report.revistas,
          offering: report.ofertas,
          percentage: report.matriculados > 0 ? Math.round((report.presentes / report.matriculados) * 100) : 0,
        }));
        setReports(formattedReports);
      } else {
        setError(result.error);
        // Fallback para localStorage
        const savedReports = localStorage.getItem('reports');
        if (savedReports) {
          setReports(JSON.parse(savedReports));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Salvar relatorio no Supabase e localStorage
  const saveReport = async (classId, formData) => {
    setLoading(true);
    setError(null);
    try {
      const classData = classes.find(c => c.id === classId);
      const today = new Date().toISOString().split('T')[0];

      // Tentar salvar no Supabase
      const result = await reportFunctions.saveReport({
        date: today,
        className: classData.name,
        matriculated: formData.matriculated,
        absent: formData.absent,
        present: formData.present,
        visitor: formData.visitor,
        bibles: formData.bibles,
        magazines: formData.magazines,
        offering: formData.offering,
      });

      if (result.success) {
        // Recarregar relatorios
        await loadReports(today);
        return { success: true };
      } else {
        // Fallback para localStorage
        const newReport = {
          id: Date.now(),
          classId,
          className: classData.name,
          date: today,
          ...formData,
          percentage: formData.matriculated > 0 ? Math.round((formData.present / formData.matriculated) * 100) : 0,
        };

        const updatedReports = [...reports, newReport];
        setReports(updatedReports);
        localStorage.setItem('reports', JSON.stringify(updatedReports));
        return { success: true };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Obter relatorios por data
  const getReportsByDate = (date) => {
    return reports.filter(r => r.date === date);
  };

  // Obter todos os relatorios
  const getAllReports = () => {
    return reports;
  };

  // Deletar relatorio
  const deleteReport = (id) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    localStorage.setItem('reports', JSON.stringify(updated));
  };

  // Carregar relatorios ao montar
  useEffect(() => {
    loadReports();
  }, []);

  return (
    <DataContext.Provider
      value={{
        classes,
        reports,
        loading,
        error,
        saveReport,
        getReportsByDate,
        getAllReports,
        deleteReport,
        loadReports,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de DataProvider');
  }
  return context;
};

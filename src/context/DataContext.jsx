import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { reportFunctions } from '../lib/supabase';

const DataContext = createContext();

// ✅ NOMES SINCRONIZADOS COM SUPABASE (exatos, com acentos e maiúsculas)
const INITIAL_CLASSES = [
  { id: '1', name: 'Adonai' },
  { id: '2', name: 'Geração Eleita' },
  { id: '3', name: 'Jardim de Deus' },
  { id: '4', name: 'Vencedores do Rei' },
  { id: '5', name: 'Abraão' },
  { id: '6', name: 'Crescendo com Cristo' },
];

// ✅ FUNÇÃO AUXILIAR PARA OBTER DATA ATUAL COM FUSO HORÁRIO CORRETO (Brasília)
const getTodayBrasilia = () => {
  const now = new Date();
  // Formatar data em Brasília (UTC-3)
  const brazilDate = new Date(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  // Retornar no formato YYYY-MM-DD
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DataProvider = ({ children }) => {
  const [reports, setReports] = useState([]);
  const [classes] = useState(INITIAL_CLASSES);
  const [loading, setLoading] = useState(true); // ✅ Inicia como true (carregando)
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false); // ✅ Flag para indicar que dados foram carregados

  // Carregar relatórios do Supabase - memoizado para evitar loops infinitos
  const loadReports = useCallback(async (date = null) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (date) {
        result = await reportFunctions.getReportsByDate(date);
      } else {
        result = await reportFunctions.getAllReports();
      }

      if (result.success && result.data && Array.isArray(result.data)) {
        // Converter dados do Supabase para formato local
        // ✅ IMPORTANTE: Manter data em formato ISO (YYYY-MM-DD) puro do Supabase
        // Deixar que o componente Dashboard decida como exibir (DD/MM/YYYY)
        const formattedReports = result.data.map(report => {
          // ✅ NORMALIZAÇÃO: trim() para ignorar espaços acidentais
          const reportClassName = report.classe?.trim() || '';
          const classData = classes.find(c => c.name.trim() === reportClassName);
          
          return {
            id: report.id,
            date: report.data_aula, // ✅ Mantém formato ISO (YYYY-MM-DD) do Supabase
            classId: classData?.id || '1',
            className: reportClassName,
            matriculated: Number(report.matriculados),
            absent: Number(report.ausentes),
            present: Number(report.presentes),
            visitor: Number(report.visitantes),
            bibles: Number(report.biblias),
            magazines: Number(report.revistas),
            offering: Number(report.ofertas),
            percentage: Number(report.matriculados) > 0 ? Math.round((Number(report.presentes) / Number(report.matriculados)) * 100) : 0,
          };
        });
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
      setIsLoaded(true); // ✅ Marcar como carregado após primeira carga
      console.log('DataContext - Relatórios carregados. Total:', result?.data?.length || 0);
    }
  }, [classes]);

  // Salvar relatório no Supabase
  const saveReport = async (classId, formData) => {
    setLoading(true);
    setError(null);
    try {
      const classData = classes.find(c => c.id === classId);
      
      // ✅ IMPORTANTE: Usar a data que vem do formData (já formatada pelo Dashboard em YYYY-MM-DD)
      // Não sobrescrever com getTodayBrasilia() - deixar que o Dashboard controle a data
      const dateToSave = formData.date || getTodayBrasilia();

      console.log('DataContext - Salvando relatório com data:', dateToSave, '(formato YYYY-MM-DD)');

      // Salvar no Supabase
      const result = await reportFunctions.saveReport({
        date: dateToSave,
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
        // Recarregar relatórios da data imediatamente após sucesso
        await loadReports(dateToSave);
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
  // ✅ IMPORTANTE: Comparar datas em formato ISO (YYYY-MM-DD)
  const getReportsByDate = (date) => {
    // Garantir que a data está em formato YYYY-MM-DD
    const normalizedDate = typeof date === 'string' ? date : '';
    console.log('DataContext - Filtrando relatórios pela data:', normalizedDate);
    return reports.filter(r => r.date === normalizedDate);
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
        // Recarregar relatórios após deletar
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

  // Carregar relatórios ao montar o componente
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const value = {
    reports,
    classes,
    loading,
    isLoaded, // ✅ Exportar flag de carregamento
    error,
    loadReports,
    saveReport,
    getReportsByDate,
    getAllReports,
    deleteReportsByDate,
    getTodayBrasilia, // ✅ Exportar função para uso em outros componentes
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

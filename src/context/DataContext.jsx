import React, { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext();

const INITIAL_CLASSES = [
  { id: '1', name: 'Adonay' },
  { id: '2', name: 'Geração Eleita' },
  { id: '3', name: 'Jardim de Deus' },
  { id: '4', name: 'Vencedores do Rei' },
  { id: '5', name: 'Abraão' },
  { id: '6', name: 'Crescendo com Cristo' },
];

export const DataProvider = ({ children }) => {
  const [reports, setReports] = useState([]);
  const [classes] = useState(INITIAL_CLASSES);

  useEffect(() => {
    // Carregar relatórios do localStorage
    const savedReports = localStorage.getItem('reports');
    if (savedReports) {
      setReports(JSON.parse(savedReports));
    }
  }, []);

  const saveReport = (classId, data) => {
    const newReport = {
      id: Date.now(),
      classId,
      className: classes.find(c => c.id === classId)?.name,
      date: new Date().toISOString().split('T')[0],
      ...data,
      percentage: data.matriculated > 0 ? Math.round((data.present / data.matriculated) * 100) : 0,
    };

    const updatedReports = [...reports, newReport];
    setReports(updatedReports);
    localStorage.setItem('reports', JSON.stringify(updatedReports));
    return newReport;
  };

  const getReportsByDate = (date) => {
    return reports.filter(r => r.date === date);
  };

  const getAllReports = () => reports;

  const deleteReport = (id) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    localStorage.setItem('reports', JSON.stringify(updated));
  };

  return (
    <DataContext.Provider value={{
      classes,
      reports,
      saveReport,
      getReportsByDate,
      getAllReports,
      deleteReport,
    }}>
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

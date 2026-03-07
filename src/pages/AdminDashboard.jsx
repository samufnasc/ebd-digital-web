import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/ocr';
import { generatePDF } from '../utils/pdf';
import { studentFunctions } from '../lib/supabase';
import UserManagement from './UserManagement';
import StudentManagement from './StudentManagement';

// ✅ FUNÇÕES UTILITÁRIAS DE DATA - PADRONIZAÇÃO GLOBAL
/**
 * Retorna a data de hoje em Brasília no formato YYYY-MM-DD (para input type="date" e Supabase)
 */
const getTodayForDatabase = () => {
  return new Date().toLocaleDateString('en-CA'); // 'en-CA' retorna YYYY-MM-DD
};

/**
 * Converte data YYYY-MM-DD para formato brasileiro DD/MM/YYYY para exibição
 */
const formatDateToBrazilian = (dateString) => {
  if (!dateString) return '';
  // dateString deve estar em formato YYYY-MM-DD
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD para banco de dados
 */
const formatDateToDatabase = (brazilianDate) => {
  if (!brazilianDate) return '';
  const [day, month, year] = brazilianDate.split('/');
  return `${year}-${month}-${day}`;
};

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { classes, getAllReports, deleteReportsByDate, loadReports } = useData();
  // ✅ CORREÇÃO: Usar getTodayForDatabase() para formato YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(getTodayForDatabase());
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showStudentManagement, setShowStudentManagement] = useState(false);
  const [showPDFOptions, setShowPDFOptions] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedClasses, setSelectedClasses] = useState(classes.map(c => c.id));
  const [selectAllClasses, setSelectAllClasses] = useState(true);

  // Carregar total de alunos do banco - apenas o data.length real
  useEffect(() => {
    const loadTotalStudents = async () => {
      try {
        const result = await studentFunctions.getAllStudents();
        console.log('AdminDashboard - Resultado de getAllStudents:', result);
        if (result.success && Array.isArray(result.data)) {
          console.log('AdminDashboard - Total de alunos carregado:', result.data.length);
          setTotalStudents(result.data.length);
        } else {
          console.warn('AdminDashboard - Erro ao carregar alunos:', result.error);
          setTotalStudents(0);
        }
      } catch (error) {
        console.error('Erro ao carregar total de alunos:', error);
        setTotalStudents(0);
      }
    };
    loadTotalStudents();
  }, []);

  // Recarregar relatórios quando a data muda
  useEffect(() => {
    loadReports(selectedDate);
  }, [selectedDate, loadReports]);

  const reports = getAllReports();

  // Consolidar dados apenas da data selecionada
  const consolidatedData = {
    matriculated: totalStudents,
    absent: 0,
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  };

  const reportsByClass = {};
  classes.forEach(cls => {
    reportsByClass[cls.id] = {
      matriculated: 0,
      absent: 0,
      present: 0,
      visitor: 0,
      bibles: 0,
      magazines: 0,
      offering: 0,
      className: cls.name,
    };
  });

  // Filtrar relatórios da data selecionada
  const reportsForDate = reports.filter(r => r.date === selectedDate);
  
  reportsForDate.forEach(report => {
    consolidatedData.absent += Number(report.absent);
    consolidatedData.present += Number(report.present);
    consolidatedData.visitor += Number(report.visitor);
    consolidatedData.bibles += Number(report.bibles);
    consolidatedData.magazines += Number(report.magazines);
    consolidatedData.offering += Number(report.offering);

    if (reportsByClass[report.classId]) {
      reportsByClass[report.classId].matriculated = Number(report.matriculated);
      reportsByClass[report.classId].absent += Number(report.absent);
      reportsByClass[report.classId].present += Number(report.present);
      reportsByClass[report.classId].visitor += Number(report.visitor);
      reportsByClass[report.classId].bibles += Number(report.bibles);
      reportsByClass[report.classId].magazines += Number(report.magazines);
      reportsByClass[report.classId].offering += Number(report.offering);
    }
  });

  // Usar total de alunos do banco em vez de matriculados do relatório
  const percentage = totalStudents > 0
    ? Math.round((consolidatedData.present / totalStudents) * 100)
    : 0;
  
  // Total de assistência = Presentes + Visitantes
  const totalAssistance = Number(consolidatedData.present) + Number(consolidatedData.visitor);

  const handleExportPDF = (type = 'general') => {
    generatePDF(consolidatedData, reportsByClass, selectedDate, type, { selectedClasses });
    setShowPDFOptions(false);
  };

  const handleExportMonthlyPDF = () => {
    generatePDF(consolidatedData, reportsByClass, selectedDate, 'monthly', {
      month: selectedMonth,
      year: selectedYear,
      selectedClasses: selectAllClasses ? null : selectedClasses
    });
    setShowMonthlyReport(false);
  };

  const toggleClassSelection = (classId) => {
    setSelectedClasses(prev => {
      const newSelected = prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId];
      setSelectAllClasses(newSelected.length === classes.length);
      return newSelected;
    });
  };

  const toggleSelectAll = () => {
    if (selectAllClasses) {
      setSelectedClasses([]);
      setSelectAllClasses(false);
    } else {
      setSelectedClasses(classes.map(c => c.id));
      setSelectAllClasses(true);
    }
  };

  const handleDeleteReports = async () => {
    if (window.confirm(`Tem certeza que deseja deletar todos os relatórios de ${formatDateToBrazilian(selectedDate)}?`)) {
      const result = await deleteReportsByDate(selectedDate);
      if (result.success) {
        alert('Relatórios deletados com sucesso!');
        await loadReports();
      } else {
        alert('Erro ao deletar relatórios: ' + result.error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel do Admin</h1>
            <p className="text-gray-600 text-sm">Bem-vindo, {user?.username}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStudentManagement(true)}
              className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition"
            >
              👨‍🎓 Alunos
            </button>
            <button
              onClick={() => setShowUserManagement(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition"
            >
              👥 Usuários
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione a Data
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
          {/* ✅ EXIBIÇÃO: Mostrar data em formato brasileiro */}
          <p className="text-sm text-gray-600 mt-1">Data selecionada: {formatDateToBrazilian(selectedDate)}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Total de Alunos</p>
            <p className="text-2xl font-bold text-primary">{totalStudents}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Presentes</p>
            <p className="text-2xl font-bold text-green-600">{consolidatedData.present}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Ausentes</p>
            <p className="text-2xl font-bold text-red-600">{consolidatedData.absent}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Total Assistência</p>
            <p className="text-2xl font-bold text-blue-600">{totalAssistance}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-xs">Frequência</p>
            <p className="text-2xl font-bold text-primary">{percentage}%</p>
          </div>
        </div>

        {/* Main Report */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Relatório Geral</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMonthlyReport(true)}
                className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition font-semibold"
              >
                📊 Relatório Mensal
              </button>
              <button
                onClick={() => setShowPDFOptions(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                📄 Exportar PDF
              </button>
              <button
                onClick={handleDeleteReports}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                🗑️ Deletar Relatórios
              </button>
            </div>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Classe</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Mat</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Aus</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Pres</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Vis</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">%</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Bíbl</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Rev</th>
                  <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Oferta</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(cls => {
                  const classData = reportsByClass[cls.id];
                  const classPercentage = classData.matriculated > 0
                    ? Math.round((classData.present / classData.matriculated) * 100)
                    : 0;
                  return (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 font-medium">{classData.className}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{classData.matriculated}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center text-red-600">{classData.absent}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center text-green-600 font-semibold">{classData.present}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{classData.visitor}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold text-primary">{classPercentage}%</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{classData.bibles}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{classData.magazines}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{formatCurrency(classData.offering)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Row */}
          <div className="bg-primary/10 rounded-lg p-4 border border-primary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Matriculados</p>
                <p className="text-2xl font-bold text-primary">{consolidatedData.matriculated}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Presentes</p>
                <p className="text-2xl font-bold text-green-600">{consolidatedData.present}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Bíblias</p>
                <p className="text-2xl font-bold text-primary">{consolidatedData.bibles}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Ofertas</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(consolidatedData.offering)}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Student Management Modal */}
      {showStudentManagement && (
        <StudentManagement onClose={() => setShowStudentManagement(false)} />
      )}

      {/* User Management Modal */}
      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}

      {/* Monthly Report Modal */}
      {showMonthlyReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Relatório Geral Mensal</h2>
            
            <div className="space-y-4">
              {/* Seleção de Mês */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                    const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][month - 1];
                    return <option key={month} value={month}>{monthName}</option>;
                  })}
                </select>
              </div>

              {/* Seleção de Ano */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Seleção de Classes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Classes</label>
                <div className="border border-gray-300 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAllClasses}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
                    />
                    <span className="ml-2 font-semibold text-gray-700">Todas as Classes</span>
                  </label>
                  <div className="border-t border-gray-200"></div>
                  {classes.map(cls => (
                    <label key={cls.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => toggleClassSelection(cls.id)}
                        className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
                      />
                      <span className="ml-2 text-gray-700">{cls.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMonthlyReport(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleExportMonthlyPDF}
                className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition font-semibold"
              >
                📊 Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Options Modal */}
      {showPDFOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Selecione o Tipo de Relatório</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleExportPDF('general')}
                className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold text-left"
              >
                📊 Relatório Geral (Consolidado)
              </button>
              <button
                onClick={() => handleExportPDF('byClass')}
                className="w-full px-4 py-3 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition font-semibold text-left"
              >
                📑 Relatórios por Classe (Páginas Individuais)
              </button>
              <button
                onClick={() => setShowPDFOptions(false)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

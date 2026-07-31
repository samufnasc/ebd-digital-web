import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/ocr';
import { generatePDF } from '../utils/pdf';
import { gerarRelatorioMensalCompleto } from '../services/pdfService';
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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [congregacaoNome, setCongregacaoNome] = useState(() => {
    return localStorage.getItem('ebd_congregacao_nome') || 'Congregação Mensageiros da Fé';
  });

  const handleCongregacaoChange = (val) => {
    setCongregacaoNome(val);
    localStorage.setItem('ebd_congregacao_nome', val);
  };

  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState([new Date().getMonth() + 1]);
  const [selectedClasses, setSelectedClasses] = useState(classes.map(c => c.id));
  const [selectAllClasses, setSelectAllClasses] = useState(true);
  // ✅ FASE 8.0.2: Toggle de visão (Dia vs Mês)
  const [viewMode, setViewMode] = useState('day'); // 'day' ou 'month'
  const [showDeleteReportModal, setShowDeleteReportModal] = useState(false);

  const toggleMonthSelection = (m) => {
    setSelectedMonths(prev => {
      if (prev.includes(m)) {
        if (prev.length === 1) return prev;
        return prev.filter(x => x !== m);
      } else {
        return [...prev, m].sort((a, b) => a - b);
      }
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  };

  const selectCurrentMonth = () => {
    setSelectedMonths([new Date().getMonth() + 1]);
  };

  // Carregar total de alunos do banco filtrando por mês e ano de referência selecionados
  useEffect(() => {
    const loadTotalStudents = async () => {
      try {
        const result = await studentFunctions.getAllStudents(selectedMonth, selectedYear);
        console.log(`AdminDashboard - Resultado de getAllStudents (${selectedMonth}/${selectedYear}):`, result);
        if (result.success && Array.isArray(result.data)) {
          console.log(`AdminDashboard - Total de alunos em ${selectedMonth}/${selectedYear}:`, result.data.length);
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
  }, [selectedMonth, selectedYear, showStudentManagement]);

  // Recarregar relatórios quando a data muda
  useEffect(() => {
    loadReports(selectedDate);
  }, [selectedDate, loadReports]);

  // ✅ FASE 8.0: useEffect dedicado para recalcular mês/ano quando selectedDate muda
  // Isso garante que a barra inferior (Mensal) seja re-executada sempre que a data mudar
  useEffect(() => {
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    
    console.log('✅ AdminDashboard - Atualizando mês/ano baseado em selectedDate:');
    console.log('  - selectedDate:', selectedDate);
    console.log('  - Novo mês:', month, '| Novo ano:', year);
    
    setSelectedMonth(month);
    setSelectedYear(year);
  }, [selectedDate]);

  const reports = getAllReports();
  
  // ✅ LOG DE AUDITORIA: Verificar se relatórios estão sendo carregados
  console.log('✅ AdminDashboard - Relatórios carregados:', reports.length, 'total');
  console.log('  - Datas disponíveis:', [...new Set(reports.map(r => r.date))].sort());

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

  // ✅ FASE 8.0: CÁLCULO INTELIGENTE - Média Aritmética de Frequência com BLINDAGEM DE TIPOS
  // Calcular a porcentagem de cada classe e depois fazer a média
  const frequencyPercentages = reportsForDate.map(report => {
    const classMatriculados = Number(report.matriculated) || totalStudents;
    const present = Number(report.present) || 0;
    
    // ✅ BLINDAGEM: Validar que classMatriculados é um número válido
    if (!Number.isFinite(classMatriculados) || classMatriculados <= 0) {
      return 0;
    }
    
    const percentage = (present / classMatriculados) * 100;
    // ✅ BLINDAGEM: Garantir que o resultado é um número válido
    return Number.isFinite(percentage) ? percentage : 0;
  });
  
  const averageFrequency = frequencyPercentages.length > 0
    ? Math.round(frequencyPercentages.reduce((a, b) => a + b, 0) / frequencyPercentages.length)
    : 0;

  // ✅ BLINDAGEM: Validar que averageFrequency é um número válido
  const safeAverageFrequency = Number.isFinite(averageFrequency) ? averageFrequency : 0;

  // Usar total de alunos do banco em vez de matriculados do relatório
  const consolidatedPresent = Number(consolidatedData.present) || 0;
  const percentage = totalStudents > 0
    ? Math.round((consolidatedPresent / totalStudents) * 100)
    : 0;
  
  // ✅ BLINDAGEM: Validar que percentage é um número válido
  const safePercentage = Number.isFinite(percentage) ? percentage : 0;
  
  // Total de assistência = Presentes + Visitantes
  const consolidatedVisitor = Number(consolidatedData.visitor) || 0;
  const totalAssistance = consolidatedPresent + consolidatedVisitor;
  const safeTotalAssistance = Number.isFinite(totalAssistance) ? totalAssistance : 0;

  // ✅ FASE 8.0: CÁLCULOS MENSAIS INTELIGENTES
  // Filtrar relatórios do mês selecionado
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const reportsForMonth = reports.filter(r => {
    if (!r.date) return false;
    const reportMonth = r.date.substring(0, 7); // YYYY-MM
    return reportMonth === monthKey;
  });
  
  console.log('✅ AdminDashboard - Filtro Mensal:');
  console.log('  - monthKey:', monthKey);
  console.log('  - Total de relatórios no mês:', reportsForMonth.length);
  console.log('  - Relatórios do mês:', reportsForMonth.map(r => r.date).sort());

  // ✅ FASE 8.0: Calcular MÉDIA DE FREQUÊNCIA MENSAL com blindagem de tipos
  let monthlyFrequencyPercentages = [];
  let monthlyAverageFrequency = 0;
  let monthlyAverageFaltas = 0;
  let monthlyTotalOffering = 0;
  let monthlyTotalVisitors = 0;

  try {
    if (Array.isArray(reportsForMonth) && reportsForMonth.length > 0) {
      monthlyFrequencyPercentages = reportsForMonth.map(report => {
        const classMatriculados = Number(report.matriculated) || totalStudents;
        return classMatriculados > 0 
          ? (Number(report.present) / classMatriculados) * 100 
          : 0;
      });
      
      monthlyAverageFrequency = monthlyFrequencyPercentages.length > 0
        ? Math.round(monthlyFrequencyPercentages.reduce((a, b) => a + b, 0) / monthlyFrequencyPercentages.length)
        : 0;

      // MÉDIA DE FALTAS MENSAIS = 100% - Média Frequência
      monthlyAverageFaltas = 100 - monthlyAverageFrequency;

      // TOTAL DE ENTRADAS (R$) = Soma de ofertas do mês
      monthlyTotalOffering = reportsForMonth.reduce((sum, report) => {
        const offering = Number(report.offering) || 0;
        return sum + (Number.isFinite(offering) ? offering : 0);
      }, 0);

      // TOTAL DE VISITANTES = Soma de visitantes do mês
      monthlyTotalVisitors = reportsForMonth.reduce((sum, report) => {
        const visitor = Number(report.visitor) || 0;
        return sum + (Number.isFinite(visitor) ? visitor : 0);
      }, 0);
    }
  } catch (error) {
    console.error('❌ ERRO ao calcular métricas mensais:', error);
    monthlyAverageFrequency = 0;
    monthlyAverageFaltas = 0;
    monthlyTotalOffering = 0;
    monthlyTotalVisitors = 0;
  }

  console.log('✅ AdminDashboard - Métricas Mensais Calculadas:');
  console.log('  - Média Frequência:', monthlyAverageFrequency, '%');
  console.log('  - Média Faltas:', monthlyAverageFaltas, '%');
  console.log('  - Total Ofertas (R$):', monthlyTotalOffering);
  console.log('  - Total Visitantes:', monthlyTotalVisitors);

  const handleExportPDF = (type = 'general') => {
    generatePDF(consolidatedData, reportsByClass, selectedDate, type, {
      selectedClasses,
      month: selectedMonth,
      year: selectedYear,
      congregacao: congregacaoNome || localStorage.getItem('ebd_congregacao_nome') || 'Congregação Mensageiros da Fé'
    });
    setShowPDFOptions(false);
  };

  const handleExportAnalyticalPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      let mesAnoExtenso = '';
      if (selectedMonths.length === 1) {
        mesAnoExtenso = `${monthNames[selectedMonths[0] - 1]} de ${selectedYear}`;
      } else if (selectedMonths.length === 12) {
        mesAnoExtenso = `Ano de ${selectedYear}`;
      } else if (selectedMonths.length <= 3) {
        const names = selectedMonths.map(m => monthNames[m - 1]);
        if (names.length === 2) {
          mesAnoExtenso = `${names[0]} e ${names[1]} de ${selectedYear}`;
        } else {
          mesAnoExtenso = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} de ${selectedYear}`;
        }
      } else {
        const firstM = monthNames[selectedMonths[0] - 1];
        const lastM = monthNames[selectedMonths[selectedMonths.length - 1] - 1];
        mesAnoExtenso = `${firstM} a ${lastM} de ${selectedYear}`;
      }

      const selectedClassNames = selectedClasses.map(sc => {
        const clsObj = classes.find(c => c.id === sc || c.name === sc);
        return clsObj ? clsObj.name : sc;
      });

      const monthsListForService = selectedMonths.map(m => ({
        month: m,
        year: selectedYear
      }));

      const firstMonthStr = String(selectedMonths[0]).padStart(2, '0');
      const mesAno = `${selectedYear}-${firstMonthStr}`;

      await gerarRelatorioMensalCompleto(
        congregacaoNome,
        mesAno,
        mesAnoExtenso,
        selectedClassNames,
        monthsListForService
      );

      setShowPDFOptions(false);
      setShowMonthlyReport(false);
    } catch (err) {
      console.error("Erro ao gerar relatório analítico:", err);
      alert(`Erro ao gerar Relatório: ${err?.message || err}`);
    } finally {
      setIsGeneratingPDF(false);
    }
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

  const handleDeleteReports = () => {
    setShowDeleteReportModal(true);
  };

  const confirmDeleteReports = async () => {
    setShowDeleteReportModal(false);
    const result = await deleteReportsByDate(selectedDate);
    if (result.success) {
      await loadReports();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo-ebd.png" alt="EBD Digital Logo" className="w-12 h-12 object-contain rounded-full shadow-xs" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Painel do Admin</h1>
              <p className="text-gray-500 text-sm">Bem-vindo, {user?.username}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStudentManagement(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>👨‍🎓</span> Alunos
            </button>
            <button
              onClick={() => setShowUserManagement(true)}
              className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>👥</span> Usuários
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Filter */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Selecione a Data
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white shadow-xs font-medium text-gray-700"
          />
          <p className="text-xs text-gray-500 mt-1.5">Data selecionada: {formatDateToBrazilian(selectedDate)}</p>
        </div>

        {/* Top 5 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Total de Alunos</p>
            <p className="text-3xl font-bold text-sky-600">{totalStudents}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Presentes</p>
            <p className="text-3xl font-bold text-emerald-500">{consolidatedData.present}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Ausentes</p>
            <p className="text-3xl font-bold text-red-500">{consolidatedData.absent}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Total Assistência</p>
            <p className="text-3xl font-bold text-blue-600">{totalAssistance}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Frequência Geral</p>
            <p className="text-3xl font-bold text-cyan-600">{averageFrequency}%</p>
          </div>
        </div>

        {/* Main Report Container */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900">Relatório Geral</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowMonthlyReport(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer text-sm"
              >
                <span>📊</span> Relatório Mensal
              </button>
              <button
                onClick={handleDeleteReports}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer text-sm"
              >
                <span>🗑️</span> Deletar Relatórios
              </button>
            </div>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
            <table className="w-full text-sm border-collapse text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-left">Classe</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Mat</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Aus</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Pres</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Vis</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">%</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Bíbl</th>
                  <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Rev</th>
                  <th className="px-4 py-3 text-center font-semibold">Oferta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classes.map(cls => {
                  const classData = reportsByClass[cls.id];
                  const classPercentage = classData.matriculated > 0
                    ? Math.round((classData.present / classData.matriculated) * 100)
                    : 0;
                  return (
                    <tr key={cls.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 border-r border-gray-200 font-semibold text-gray-900">{classData.className}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{classData.matriculated}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-red-500 font-medium">{classData.absent}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-emerald-500 font-medium">{classData.present}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{classData.visitor}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center font-medium text-sky-600">{classPercentage}%</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{classData.bibles}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{classData.magazines}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">{formatCurrency(classData.offering)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TOGGLE DE VISÃO - Dia vs Mês */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>📅</span> Ver Dados do Dia
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>📈</span> Ver Dados do Mês
            </button>
          </div>

          {/* BARRA INFERIOR - Exibir dados baseado em viewMode */}
          {viewMode === 'day' ? (
            // MODO DIA: Exibir dados do dia selecionado
            <div className="bg-sky-50/40 rounded-xl p-5 border border-sky-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">Dados do Dia - {formatDateToBrazilian(selectedDate)}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Total Matriculados</p>
                  <p className="text-2xl font-bold text-sky-600">{totalStudents}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Presentes</p>
                  <p className="text-2xl font-bold text-emerald-500">{consolidatedData.present}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Ausências</p>
                  <p className="text-2xl font-bold text-red-500">{consolidatedData.absent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Frequência Geral</p>
                  <p className="text-2xl font-bold text-sky-600">{averageFrequency}%</p>
                </div>
              </div>
            </div>
          ) : (
            // MODO MÊS: Exibir dados mensais
            <div className="bg-primary/10 rounded-lg p-4 border border-primary">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados do Mês - {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][selectedMonth - 1]}/{selectedYear}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Média Frequência Mensal</p>
                  <p className="text-2xl font-bold text-primary">{monthlyAverageFrequency}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Média Faltas Mensais</p>
                  <p className="text-2xl font-bold text-red-600">{monthlyAverageFaltas}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total das Entradas (R$)</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(monthlyTotalOffering)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Visitantes</p>
                  <p className="text-2xl font-bold text-blue-600">{monthlyTotalVisitors}</p>
                </div>
              </div>
            </div>
          )}
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

      {/* Modal Unificado de Exportação de PDF */}
      {(showPDFOptions || showMonthlyReport) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Exportar Relatórios PDF</h2>
                <p className="text-xs text-gray-500">Filtre as classes e meses desejados para a emissão</p>
              </div>
              <button
                onClick={() => { setShowPDFOptions(false); setShowMonthlyReport(false); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              {/* Nome da Congregação */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Nome da Congregação
                </label>
                <input
                  type="text"
                  value={congregacaoNome}
                  onChange={(e) => handleCongregacaoChange(e.target.value)}
                  placeholder="Ex: Congregação Mensageiros da Fé"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 outline-none text-sm"
                />
              </div>

              {/* Ano e Ações Rápidas de Mês */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Ano de Referência
                  </label>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Ações Rápidas de Mês
                  </label>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={selectCurrentMonth}
                      className="flex-1 px-2 py-1.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg hover:bg-sky-200 transition cursor-pointer"
                    >
                      Mês Atual
                    </button>
                    <button
                      type="button"
                      onClick={selectAllMonths}
                      className="flex-1 px-2 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>
              </div>

              {/* Seleção de Mês (Botoes em Grade) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                  Selecione o(s) Mês(es) para o Histórico ({selectedMonths.length} selecionado{selectedMonths.length > 1 ? 's' : ''})
                </label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-3 rounded-xl border border-gray-200 text-xs">
                  {[
                    { num: 1, name: 'Janeiro' }, { num: 2, name: 'Fevereiro' }, { num: 3, name: 'Março' },
                    { num: 4, name: 'Abril' }, { num: 5, name: 'Maio' }, { num: 6, name: 'Junho' },
                    { num: 7, name: 'Julho' }, { num: 8, name: 'Agosto' }, { num: 9, name: 'Setembro' },
                    { num: 10, name: 'Outubro' }, { num: 11, name: 'Novembro' }, { num: 12, name: 'Dezembro' }
                  ].map((m) => {
                    const isSelected = selectedMonths.includes(m.num);
                    return (
                      <button
                        key={m.num}
                        type="button"
                        onClick={() => toggleMonthSelection(m.num)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition font-medium border ${
                          isSelected
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        {isSelected && <span className="font-bold text-xs ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Classes */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Selecione as Classes a Exibir
                  </label>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-cyan-700 font-semibold hover:underline cursor-pointer"
                  >
                    {selectAllClasses ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-gray-50/80 p-3 rounded-xl border border-gray-200 max-h-40 overflow-y-auto text-xs">
                  {classes.map((cls) => {
                    const isChecked = selectedClasses.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                          isChecked ? 'bg-sky-50 text-sky-800 font-semibold' : 'hover:bg-white text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleClassSelection(cls.id)}
                          className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                        />
                        <span className="truncate">{cls.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Botões de Ação para Gerar PDF */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <button
                  onClick={handleExportAnalyticalPDF}
                  disabled={isGeneratingPDF}
                  className={`w-full px-4 py-3 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                    isGeneratingPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-cyan-700 hover:bg-cyan-800'
                  }`}
                >
                  {isGeneratingPDF ? (
                    <span>⌛ Gerando PDF Analítico...</span>
                  ) : (
                    <span>📊 Gerar Relatório Mensal Analítico (5 Páginas com Gráficos)</span>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleExportPDF('general')}
                    className="px-3 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition font-semibold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    📄 Geral do Dia ({formatDateToBrazilian(selectedDate)})
                  </button>

                  <button
                    onClick={() => handleExportPDF('byClass')}
                    className="px-3 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-semibold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    📋 Relatório por Classe
                  </button>
                </div>

                <button
                  onClick={() => { setShowPDFOptions(false); setShowMonthlyReport(false); }}
                  className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition font-medium text-xs mt-1 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        {/* Modal de confirmação para deletar relatórios */}
        {showDeleteReportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Você tem certeza dessa ação?</h3>
              <p className="text-gray-600 text-sm mb-6">
                Deseja realmente deletar todos os relatórios da data <strong>"{formatDateToBrazilian(selectedDate)}"</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteReportModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteReports}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm shadow-sm"
                >
                  Deletar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

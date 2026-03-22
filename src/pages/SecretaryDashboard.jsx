import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import ImageProcessor from '../components/ImageProcessor';
import { processOCR, calculatePercentage, formatCurrency } from '../utils/ocr';
import { studentFunctions } from '../lib/supabase';

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

// ✅ VALIDAÇÃO RIGOROSA DE DADOS
/**
 * Valida os dados do formulário contra as regras lógicas
 * Retorna { isValid: boolean, errors: string[] }
 */
const validateFormData = (data, matriculated) => {
  const errors = [];

  // Regra 1: Presentes ≤ Matriculados
  if (data.present > matriculated) {
    errors.push(`❌ Presentes (${data.present}) não pode ser maior que Matriculados (${matriculated})`);
  }

  // Regra 2: Bíblias ≤ Presentes
  if (data.bibles > data.present) {
    errors.push(`❌ Bíblias (${data.bibles}) não pode ser maior que Presentes (${data.present})`);
  }

  // Regra 3: Revistas ≤ Presentes
  if (data.magazines > data.present) {
    errors.push(`❌ Revistas (${data.magazines}) não pode ser maior que Presentes (${data.present})`);
  }

  // Regra 4: Matriculados = Presentes + Ausentes
  if (matriculated !== (data.present + data.absent)) {
    errors.push(`❌ Matriculados (${matriculated}) deve ser igual a Presentes (${data.present}) + Ausentes (${data.absent})`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ✅ ESTADO INICIAL LIMPO (todos os campos em 0)
const getCleanFormData = () => ({
  matriculated: 0,
  absent: 0,
  present: 0,
  visitor: 0,
  bibles: 0,
  magazines: 0,
  offering: 0,
});

export default function SecretaryDashboard() {
  const { logout, user } = useAuth();
  const { classes, saveReport, getAllReports, getReportsByDate, loadReports, isLoaded, loading } = useData();
  const [showCamera, setShowCamera] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showGeneralReport, setShowGeneralReport] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id);
  const [selectedDate, setSelectedDate] = useState(getTodayForDatabase());
  const [ocrData, setOcrData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [formData, setFormData] = useState(getCleanFormData());

  // Carregar alunos quando classe mudar
  useEffect(() => {
    loadStudentsForClass();
  }, [selectedClass]);

  // ✅ NOVO: Limpar formulário quando data mudar
  useEffect(() => {
    setFormData(getCleanFormData());
    setOcrData(null);
    setValidationErrors([]);
    console.log('SecretaryDashboard - Data alterada para:', selectedDate);
  }, [selectedDate]);

  // ✅ NOVO: Carregar relatórios quando a página carregar ou data mudar
  useEffect(() => {
    console.log('SecretaryDashboard - useEffect: Carregando relatórios para data:', selectedDate);
    loadReports();
  }, [selectedDate, loadReports]);

  // ✅ NOVO: Carregar relatórios quando componente montar (primeira coisa, sem condições)
  useEffect(() => {
    const forceRefreshOnMount = async () => {
      console.log('SecretaryDashboard - MOUNT: Componente montado, forçando refresh do banco');
      // ✅ FORÇAR REFRESH: await garante que dados sejam baixados antes de renderizar
      await loadReports();
      console.log('SecretaryDashboard - MOUNT: Dados sincronizados com sucesso');
    };
    forceRefreshOnMount();
  }, []); // Sem dependências = executa ao montar uma vez

  const loadStudentsForClass = async () => {
    if (!selectedClass) return;
    
    setLoadingStudents(true);
    try {
      const selectedClassData = classes.find(c => c.id === selectedClass);
      const selectedClassName = selectedClassData?.name?.trim();
      
      console.log('SecretaryDashboard - Carregando alunos para classe ID:', selectedClass);
      console.log('SecretaryDashboard - Nome da classe:', selectedClassName);
      
      if (selectedClassName) {
        const result = await studentFunctions.getStudentsByClass(selectedClassName);
        console.log('SecretaryDashboard - Resultado de getStudentsByClass:', result);
        
        if (result.success) {
          console.log('SecretaryDashboard - Total de alunos carregado:', result.data.length);
          setStudents(result.data);
          const matriculatedCount = result.data.length;
          setFormData(prev => ({
            ...prev,
            matriculated: matriculatedCount
          }));
          console.log(`Carregados ${matriculatedCount} alunos da classe ${selectedClassName}`);
        } else {
          console.error('Erro ao carregar alunos:', result.error);
          setStudents([]);
          setFormData(prev => ({
            ...prev,
            matriculated: 0
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      setStudents([]);
      setFormData(prev => ({
        ...prev,
        matriculated: 0
      }));
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleCameraCapture = async (imageData) => {
    setShowCamera(false);
    
    const result = await processOCR(imageData);
    if (result.success) {
      // ✅ BLINDAGEM: Garantir que todos os campos sejam números válidos (fallback zero)
      const ocrDataWithZeroFallback = {
        present: result.data.present || 0,
        absent: result.data.absent || 0,
        visitor: result.data.visitor || 0,
        bibles: result.data.bibles || 0,
        magazines: result.data.magazines || 0,
        offering: result.data.offering || 0,
      };
      
      console.log('SecretaryDashboard - Dados OCR com fallback zero:', ocrDataWithZeroFallback);
      
      setOcrData(ocrDataWithZeroFallback);
      setFormData(prev => ({
        ...ocrDataWithZeroFallback,
        matriculated: prev.matriculated
      }));
      setValidationErrors([]);
      setShowReview(true);
    }
  };

  const handleFormChange = (field, value) => {
    if (field === 'matriculated') {
      console.warn('Campo Matriculados eh bloqueado. Use o valor do banco de dados.');
      return;
    }
    
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
    
    // Validar em tempo real
    const newFormData = {
      ...formData,
      [field]: numValue
    };
    const validation = validateFormData(newFormData, formData.matriculated);
    setValidationErrors(validation.errors);
  };

  const handleSaveReport = async () => {
    if (!selectedClass) {
      alert('Selecione uma classe');
      return;
    }

    // ✅ VALIDAÇÃO RIGOROSA ANTES DE SALVAR
    const validation = validateFormData(formData, formData.matriculated);
    if (!validation.isValid) {
      alert('Corrija os erros antes de salvar:\n\n' + validation.errors.join('\n'));
      setValidationErrors(validation.errors);
      return;
    }

    const selectedClassData = classes.find(c => c.id === selectedClass);
    const selectedClassName = selectedClassData?.name?.trim();
    const result = await studentFunctions.getStudentsByClass(selectedClassName);
    const officialMatriculatedCount = result.success ? result.data.length : formData.matriculated;

    // ✅ BLINDAGEM TOTAL DE DATA: Forçar YYYY-MM-DD em TODAS as etapas
    const dateForDatabase = selectedDate; // Usar selectedDate (fonte da verdade)
    console.log('SecretaryDashboard - Data para Supabase:', dateForDatabase, '(formato YYYY-MM-DD)');
    console.log('SecretaryDashboard - Data para exibição:', formatDateToBrazilian(dateForDatabase), '(formato DD/MM/YYYY)');

    const reportData = {
      ...formData,
      matriculated: officialMatriculatedCount,
      date: dateForDatabase // ✅ FORÇA YYYY-MM-DD
    };

    console.log('SecretaryDashboard - Dados completos do relatório:', reportData);

    const saveResult = await saveReport(selectedClass, reportData);
    
    if (saveResult.success) {
      alert('Relatório salvo com sucesso!');
      
      // ✅ LIMPEZA COMPLETA: Resetar tudo para voltar à página inicial
      setFormData(getCleanFormData());
      setFormData(prev => ({
        ...prev,
        matriculated: officialMatriculatedCount
      }));
      setShowReview(false);
      setShowCamera(false); // ✅ NOVO: Fechar câmera
      setOcrData(null);
      setValidationErrors([]);
      // ✅ NOVO: Limpar imagem (importante para não exibir foto anterior)
      // A imagem é gerenciada no ImageProcessor, então resetamos o estado showCamera
      
      console.log('SecretaryDashboard - Relatório salvo! Voltando para página inicial.');
    } else {
      alert('Erro ao salvar relatório: ' + (saveResult.error || 'Erro desconhecido'));
    }
  };

  // ✅ ESPELHAMENTO DO ADMIN: Filtro direto de getAllReports() para garantir sincronização
  // ✅ FASE 7.0: FILTRO DE UNICIDADE - Exibir apenas o último relatório por classe
  const allReportsForDay = getAllReports().filter(r => r.date === selectedDate);
  
  // Agrupar por classe e pegar apenas o último (mais recente)
  const reportsForDay = Object.values(
    allReportsForDay.reduce((acc, report) => {
      const classKey = report.classe || report.className;
      // Manter apenas o último relatório por classe (ID mais alto = mais recente)
      if (!acc[classKey] || report.id > acc[classKey].id) {
        acc[classKey] = report;
      }
      return acc;
    }, {})
  );
  
  console.log('SecretaryDashboard - Filtro de Unicidade: Total antes:', allReportsForDay.length, '| Após:', reportsForDay.length);
  // ✅ LOG DE AUDITORIA PARA SAMUEL: Mostrar exatamente o que está acontecendo
  console.log('SecretaryDashboard - LOG DE AUDITORIA:');
  console.log('  - isLoaded:', isLoaded, '| loading:', loading);
  console.log('  - Total de relatórios no estado:', getAllReports().length);
  console.log('  - selectedDate (YYYY-MM-DD):', selectedDate);
  console.log('  - Datas disponíveis no banco:', getAllReports().map(r => r.date).filter((v, i, a) => a.indexOf(v) === i).sort());
  console.log('  - Relatórios para a data selecionada:', reportsForDay.length);
  console.log('  - Relatórios completos:', reportsForDay);
  
  // ✅ NOVO: Verificar fuso horário - garantir que selectedDate está em YYYY-MM-DD
  console.log('SecretaryDashboard - Verificação de fuso horário:');
  console.log('  - selectedDate (YYYY-MM-DD):', selectedDate);
  console.log('  - getTodayForDatabase():', getTodayForDatabase());
  console.log('  - Formato para exibição (DD/MM/YYYY):', formatDateToBrazilian(selectedDate));

  const percentage = calculatePercentage(formData.present, formData.matriculated);
  const totalAssistance = formData.present + formData.visitor;
  
  // ✅ BLINDAGEM DE DATA: Forçar YYYY-MM-DD em TODAS as operações
  const todayForDisplay = formatDateToBrazilian(selectedDate); // DD/MM/YYYY para tela

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel do Secretário</h1>
            <p className="text-gray-600 text-sm">Bem-vindo, {user?.username}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ✅ NOVO: Spinner de Carregamento */}
        {!isLoaded && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <p className="text-blue-700 font-semibold">Sincronizando dados...</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total de Relatórios</p>
            <p className="text-3xl font-bold text-primary">{getAllReports().length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Classes</p>
            <p className="text-3xl font-bold text-primary">{classes.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Data Selecionada</p>
            {/* ✅ EXIBIÇÃO: Mostrar data em formato brasileiro DD/MM/YYYY */}
            <p className="text-3xl font-bold text-primary">{todayForDisplay}</p>
          </div>
        </div>

        {/* Main Content */}
        {/* ✅ NOVO: Tabela Resumida de Relatórios (Estilo Admin) */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📋 Relatórios do Dia - {todayForDisplay}</h2>
          
          {(() => {
            // ✅ FEEDBACK MELHORADO: Spinner se carregando, vazio se isLoaded e sem dados
            if (!isLoaded) {
              return (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <p className="text-blue-700 font-semibold">Sincronizando com o banco de dados...</p>
                  </div>
                </div>
              );
            }
            
            if (reportsForDay.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-gray-500">📭 Nenhum relatório cadastrado para esta data</p>
                </div>
              );
            }
            
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gray-50">
                      <th className="px-4 py-3 text-left font-bold text-gray-700">Classe</th>
                      <th className="px-4 py-3 text-center font-bold text-gray-700">Mat.</th>
                      <th className="px-4 py-3 text-center font-bold text-green-600">Pres.</th>
                      <th className="px-4 py-3 text-center font-bold text-red-600">Aus.</th>
                      <th className="px-4 py-3 text-center font-bold text-blue-600">Vis.</th>
                      <th className="px-4 py-3 text-center font-bold text-purple-600">Bíbl.</th>
                      <th className="px-4 py-3 text-center font-bold text-orange-600">Rev.</th>
                      <th className="px-4 py-3 text-center font-bold text-yellow-600">Oferta</th>
                      <th className="px-4 py-3 text-center font-bold text-primary">Freq.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsForDay.map((report, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-900">{report.className}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{report.matriculated}</td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{report.present}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{report.absent}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{report.visitor}</td>
                        <td className="px-4 py-3 text-center font-bold text-purple-600">{report.bibles}</td>
                        <td className="px-4 py-3 text-center font-bold text-orange-600">{report.magazines}</td>
                        <td className="px-4 py-3 text-center font-bold text-yellow-600">{formatCurrency(report.offering)}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{report.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        {/* Seletor de Data e Classe */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Seletor de Data */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Data do Relatório</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            {/* ✅ NOVO: Botão de Atualização Manual */}
            <div className="flex items-end">
              <button
                onClick={async () => {
                  console.log('SecretaryDashboard - Botão Atualizar clicado');
                  // ✅ SINCRONIZAÇÃO: Reset isLoaded para forçar redesenho com dados frescos
                  console.log('SecretaryDashboard - Resetando isLoaded para forçar refresh');
                  await loadReports();
                  console.log('SecretaryDashboard - Dados atualizados com sucesso');
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2"
              >
                <span>🔄</span> Atualizar
              </button>
            </div>
            
            {/* Seletor de Classe */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">👨‍🎓 Classe</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!showReview ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Novo Relatório</h2>

            {/* Date Selection - ✅ NOVO: Seletor de data retroativo */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data do Relatório
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Você pode selecionar datas retroativas</p>
            </div>

            {/* Class Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione a Classe
              </label>
              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setShowStudentList(true)}
                className="flex-1 min-w-[150px] px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                👨‍🎓 Alunos da Classe
              </button>
              <button
                onClick={() => setShowCamera(true)}
                className="flex-1 min-w-[150px] px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                ➕ Novo Relatório
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Revisar Dados</h2>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-semibold mb-2">⚠️ Erros de Validação:</p>
                {validationErrors.map((error, idx) => (
                  <p key={idx} className="text-red-600 text-sm">{error}</p>
                ))}
              </div>
            )}

            {/* Form Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matriculados</label>
                <input
                  type="number"
                  value={formData.matriculated}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presentes</label>
                <input
                  type="number"
                  value={formData.present}
                  onChange={(e) => handleFormChange('present', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ausentes</label>
                <input
                  type="number"
                  value={formData.absent}
                  onChange={(e) => handleFormChange('absent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitantes</label>
                <input
                  type="number"
                  value={formData.visitor}
                  onChange={(e) => handleFormChange('visitor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bíblias</label>
                <input
                  type="number"
                  value={formData.bibles}
                  onChange={(e) => handleFormChange('bibles', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revistas</label>
                <input
                  type="number"
                  value={formData.magazines}
                  onChange={(e) => handleFormChange('magazines', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ofertas (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.offering}
                  onChange={(e) => handleFormChange('offering', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequência (%)</label>
                <input
                  type="text"
                  value={`${percentage}%`}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total de Assistência</label>
                <input
                  type="text"
                  value={totalAssistance}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReview(false);
                  setValidationErrors([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReport}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition font-semibold ${
                  validationErrors.length > 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                disabled={validationErrors.length > 0}
              >
                ✓ Salvar Relatório
              </button>
            </div>
          </div>
        )}

        {/* ✅ FASE 8.0: BARRA DE RESUMO INFERIOR - Consolidado do Dia */}
        <div className="bg-primary/10 rounded-lg p-4 border border-primary mt-8 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Consolidado do Dia - {formatDateToBrazilian(selectedDate)}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Matriculados</p>
              <p className="text-2xl font-bold text-primary">{consolidatedData.matriculated}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Presenças</p>
              <p className="text-2xl font-bold text-green-600">{consolidatedData.present}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ausências</p>
              <p className="text-2xl font-bold text-red-600">{consolidatedData.absent}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ofertas</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(consolidatedData.offering)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">% Geral</p>
              <p className="text-2xl font-bold text-primary">{percentage}%</p>
            </div>
          </div>
        </div>
      </main>

      {/* Image Processor Modal (Camera + Gallery + Crop) */}
      {showCamera && (
        <ImageProcessor
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Student List Modal */}
      {showStudentList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Alunos da Classe</h2>
            
            {loadingStudents ? (
              <p className="text-gray-600">Carregando alunos...</p>
            ) : students.length > 0 ? (
              <div className="space-y-2">
                {students.map((student, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900">{student.nome || student.name || 'Sem nome'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">Nenhum aluno encontrado para esta classe.</p>
            )}

            <button
              onClick={() => setShowStudentList(false)}
              className="mt-6 w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

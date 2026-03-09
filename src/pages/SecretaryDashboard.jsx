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

export default function SecretaryDashboard() {
  const { logout, user } = useAuth();
  const { classes, saveReport, getAllReports } = useData();
  const [showCamera, setShowCamera] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showGeneralReport, setShowGeneralReport] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id);
  const [ocrData, setOcrData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [formData, setFormData] = useState({
    matriculated: 0,
    absent: 0,
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  });

  // Carregar alunos quando classe mudar
  useEffect(() => {
    loadStudentsForClass();
  }, [selectedClass]);

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
      // ✅ FALLBACK ZERO: Se OCR não conseguir ler, preencher com 0
      const ocrDataWithZeroFallback = {
        present: result.data.present || 0,
        absent: result.data.absent || 0,
        visitor: result.data.visitor || 0,
        bibles: result.data.bibles || 0,
        magazines: result.data.magazines || 0,
        offering: result.data.offering || 0,
      };
      
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
    const dateForDatabase = getTodayForDatabase(); // Garantir formato YYYY-MM-DD
    console.log('SecretaryDashboard - Data para Supabase:', dateForDatabase, '(formato YYYY-MM-DD)');
    console.log('SecretaryDashboard - Data para exibição:', formatDateToBrazilian(dateForDatabase), '(formato DD/MM/YYYY)');

    const reportData = {
      ...formData,
      matriculated: officialMatriculatedCount,
      date: dateForDatabase // ✅ FORÇA YYYY-MM-DD
    };

    console.log('SecretaryDashboard - Dados completos do relatório:', reportData);

    saveReport(selectedClass, reportData);
    alert('Relatório salvo com sucesso!');
    
    setFormData({
      matriculated: officialMatriculatedCount,
      absent: 0,
      present: 0,
      visitor: 0,
      bibles: 0,
      magazines: 0,
      offering: 0,
      totalAssistance: 0,
    });
    setShowReview(false);
    setOcrData(null);
    setValidationErrors([]);
  };

  const percentage = calculatePercentage(formData.present, formData.matriculated);
  const totalAssistance = formData.present + formData.visitor;
  
  // ✅ BLINDAGEM DE DATA: Forçar YYYY-MM-DD em TODAS as operações
  const todayForDatabase = getTodayForDatabase(); // YYYY-MM-DD para Supabase
  const todayForDisplay = formatDateToBrazilian(todayForDatabase); // DD/MM/YYYY para tela

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
            <p className="text-gray-600 text-sm">Data</p>
            {/* ✅ EXIBIÇÃO: Mostrar data em formato brasileiro DD/MM/YYYY */}
            <p className="text-3xl font-bold text-primary">{todayForDisplay}</p>
          </div>
        </div>

        {/* Main Content */}
        {!showReview ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Novo Relatório</h2>

            {/* Class Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione a Classe
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  // ✅ BLINDAGEM: Resetar dados quando classe mudar
                  setFormData({
                    matriculated: 0,
                    absent: 0,
                    present: 0,
                    visitor: 0,
                    bibles: 0,
                    magazines: 0,
                    offering: 0,
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Camera Button */}
            <button
              onClick={() => setShowCamera(true)}
              className="fixed right-8 top-1/2 transform -translate-y-1/2 w-16 h-16 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center text-2xl font-bold z-40"
              title="Novo Relatório"
            >
              +
            </button>

            {/* Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setShowStudentList(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                👨‍🎓 Alunos da Classe
              </button>
              <button
                onClick={() => setShowGeneralReport(true)}
                className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-yellow-600 transition font-semibold"
              >
                📄 Relatório Geral
              </button>
            </div>

            {/* Recent Reports */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Relatórios Recentes</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Classe</th>
                      <th className="px-4 py-2 text-center">Mat</th>
                      <th className="px-4 py-2 text-center">Pres</th>
                      <th className="px-4 py-2 text-center">%</th>
                      <th className="px-4 py-2 text-center">Oferta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAllReports().slice(-5).reverse().map(report => (
                      <tr key={report.id} className="border-t hover:bg-gray-50">
                        {/* ✅ EXIBIÇÃO: Converter data YYYY-MM-DD para DD/MM/YYYY */}
                        <td className="px-4 py-2">{formatDateToBrazilian(report.date)}</td>
                        <td className="px-4 py-2">{report.className}</td>
                        <td className="px-4 py-2 text-center">{report.matriculated}</td>
                        <td className="px-4 py-2 text-center">{report.present}</td>
                        <td className="px-4 py-2 text-center font-semibold text-primary">{report.percentage}%</td>
                        <td className="px-4 py-2 text-center">{formatCurrency(report.offering)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : showGeneralReport ? (
          /* General Report View */
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Relatório Geral Consolidado</h2>
              <button
                onClick={() => setShowGeneralReport(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Voltar
              </button>
            </div>

            {/* Consolidated Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2">Classe</th>
                    <th className="border border-gray-300 px-4 py-2">Mat</th>
                    <th className="border border-gray-300 px-4 py-2">Aus</th>
                    <th className="border border-gray-300 px-4 py-2">Pres</th>
                    <th className="border border-gray-300 px-4 py-2">Vis</th>
                    <th className="border border-gray-300 px-4 py-2">%</th>
                    <th className="border border-gray-300 px-4 py-2">Bibl</th>
                    <th className="border border-gray-300 px-4 py-2">Rev</th>
                    <th className="border border-gray-300 px-4 py-2">Oferta</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(cls => {
                    const classReports = getAllReports().filter(r => r.classId === cls.id);
                    const latestReport = classReports[classReports.length - 1];
                    
                    if (!latestReport) return null;
                    
                    const classData = latestReport;
                    const classPercentage = calculatePercentage(classData.present, classData.matriculated);
                    
                    return (
                      <tr key={cls.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 font-medium">{cls.name}</td>
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
          </div>
        ) : (
          /* Review Form */
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">Revisar Dados OCR</h2>

            {/* ✅ AVISO VISUAL DE VALIDAÇÃO */}
            {validationErrors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded">
                <h3 className="font-bold text-red-800 mb-2">⚠️ Erros de Validação:</h3>
                <ul className="space-y-1">
                  {validationErrors.map((error, idx) => (
                    <li key={idx} className="text-red-700 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matriculados (Automático)</label>
                <input
                  type="number"
                  value={formData.matriculated}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Presentes</label>
                <input
                  type="number"
                  value={formData.present}
                  onChange={(e) => handleFormChange('present', e.target.value)}
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
                    <p className="text-sm text-gray-600">ID: {student.id}</p>
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

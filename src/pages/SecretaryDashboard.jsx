import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { calculatePercentage, formatCurrency } from '../utils/ocr';
import { studentFunctions } from '../lib/supabase';

// ✅ FUNÇÕES UTILITÁRIAS DE DATA - PADRONIZAÇÃO GLOBAL
const getTodayForDatabase = () => {
  return new Date().toLocaleDateString('en-CA'); // 'en-CA' retorna YYYY-MM-DD
};

const formatDateToBrazilian = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// ✅ VALIDAÇÃO RIGOROSA DE DADOS
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
  const { classes, saveReport, getAllReports, loadReports, isLoaded, loading } = useData();
  const [showStudentList, setShowStudentList] = useState(false);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(getTodayForDatabase());
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [formData, setFormData] = useState(getCleanFormData());
  const [isSaving, setIsSaving] = useState(false);

  // Inicializar classe selecionada se ainda não estiver setada
  useEffect(() => {
    if (!selectedClass && classes.length > 0) {
      setSelectedClass(classes[0].id);
    }
  }, [classes, selectedClass]);

  // Carregar relatórios ao montar e ao alterar a data
  useEffect(() => {
    loadReports();
  }, [selectedDate, loadReports]);

  // Carregar alunos da classe e carregar relatório existente se já foi preenchido
  useEffect(() => {
    loadStudentsAndCheckReport();
  }, [selectedClass, selectedDate]);

  const loadStudentsAndCheckReport = async () => {
    if (!selectedClass) return;

    setLoadingStudents(true);
    setValidationErrors([]);

    try {
      const selectedClassData = classes.find(c => c.id === selectedClass);
      const selectedClassName = selectedClassData?.name?.trim();

      let month = null;
      let year = null;
      if (selectedDate && selectedDate.includes('-')) {
        const parts = selectedDate.split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }

      // 1. Verificar se já existe um relatório salvo para esta classe e data
      const allReports = getAllReports();
      const existingReport = allReports.find(r => 
        (r.classId === selectedClass || (r.className && selectedClassName && r.className.trim() === selectedClassName)) && 
        r.date === selectedDate
      );

      // 2. Carregar lista de alunos do Supabase
      let matriculatedCount = 0;
      if (selectedClassName) {
        const result = await studentFunctions.getStudentsByClass(selectedClassName, month, year);
        if (result.success) {
          setStudents(result.data);
          matriculatedCount = result.data.length;
        } else {
          setStudents([]);
        }
      }

      // 3. Preencher formulário
      if (existingReport) {
        setFormData({
          matriculated: Number(existingReport.matriculated) || matriculatedCount,
          present: Number(existingReport.present) || 0,
          absent: Number(existingReport.absent) || 0,
          visitor: Number(existingReport.visitor) || 0,
          bibles: Number(existingReport.bibles) || 0,
          magazines: Number(existingReport.magazines) || 0,
          offering: Number(existingReport.offering) || 0,
        });
      } else {
        setFormData({
          matriculated: matriculatedCount,
          present: 0,
          absent: matriculatedCount,
          visitor: 0,
          bibles: 0,
          magazines: 0,
          offering: 0,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados da classe:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleFormChange = (field, value) => {
    const numValue = Math.max(0, parseFloat(value) || 0);

    setFormData(prev => {
      const updated = { ...prev, [field]: numValue };

      if (field === 'matriculated') {
        updated.absent = Math.max(0, numValue - updated.present);
      } else if (field === 'present') {
        updated.absent = Math.max(0, updated.matriculated - numValue);
      } else if (field === 'absent') {
        updated.present = Math.max(0, updated.matriculated - numValue);
      }

      // Validar na hora de digitar
      const val = validateFormData(updated, updated.matriculated);
      setValidationErrors(val.errors);

      return updated;
    });
  };

  const handleSaveReport = async (e) => {
    if (e) e.preventDefault();

    const validation = validateFormData(formData, formData.matriculated);
    if (!validation.isValid) {
      alert('Corrija os erros de validação antes de salvar:\n\n' + validation.errors.join('\n'));
      setValidationErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    try {
      const reportData = {
        ...formData,
        matriculated: formData.matriculated,
        date: selectedDate
      };

      const saveResult = await saveReport(selectedClass, reportData);

      if (saveResult.success) {
        alert('✅ Relatório salvo com sucesso!');
        setValidationErrors([]);
        await loadReports();
      } else {
        alert('Erro ao salvar relatório: ' + (saveResult.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error('Erro ao salvar relatório:', err);
      alert('Erro inesperado ao salvar relatório: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtro dos relatórios do dia para resumo
  const allReportsForDay = getAllReports().filter(r => r.date === selectedDate);

  const reportsForDay = Object.values(
    allReportsForDay.reduce((acc, report) => {
      const classKey = report.classe || report.className;
      if (!acc[classKey] || report.id > acc[classKey].id) {
        acc[classKey] = report;
      }
      return acc;
    }, {})
  );

  let dayFrequencyAvg = 0;
  if (Array.isArray(reportsForDay) && reportsForDay.length > 0) {
    const dayPercentages = reportsForDay.map(report => {
      const mat = Number(report.matriculated) || 0;
      const pres = Number(report.present) || 0;
      return mat > 0 ? (pres / mat) * 100 : 0;
    });
    dayFrequencyAvg = Math.round(dayPercentages.reduce((a, b) => a + b, 0) / dayPercentages.length);
  }

  const currentClassPercentage = formData.matriculated > 0
    ? Math.round((formData.present / formData.matriculated) * 100)
    : 0;

  const currentTotalAssistance = formData.present + formData.visitor;
  const todayForDisplay = formatDateToBrazilian(selectedDate);

  const consolidatedData = reportsForDay.reduce((acc, report) => {
    return {
      matriculated: acc.matriculated + (Number(report.matriculated) || 0),
      present: acc.present + (Number(report.present) || 0),
      absent: acc.absent + (Number(report.absent) || 0),
      offering: acc.offering + (Number(report.offering) || 0),
      visitor: acc.visitor + (Number(report.visitor) || 0)
    };
  }, { matriculated: 0, present: 0, absent: 0, offering: 0, visitor: 0 });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo-ebd.png" alt="EBD Digital Logo" className="w-12 h-12 object-contain rounded-full shadow-xs" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Painel do Secretário</h1>
              <p className="text-gray-500 text-sm">Bem-vindo, {user?.username}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer text-sm"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Sync Indicator */}
        {!isLoaded && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-700"></div>
              <p className="text-sky-800 text-sm font-semibold">Sincronizando dados com o banco...</p>
            </div>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Relatórios Lançados Hoje</p>
            <p className="text-3xl font-bold text-cyan-700">{reportsForDay.length} / {classes.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Total de Classes</p>
            <p className="text-3xl font-bold text-gray-800">{classes.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Data Selecionada</p>
            <p className="text-3xl font-bold text-sky-600">{todayForDisplay}</p>
          </div>
        </div>

        {/* Tabela de Lançamentos do Dia */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📋</span> Relatórios Lançados no Dia ({todayForDisplay})
          </h2>

          {reportsForDay.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-500 text-sm">📭 Nenhum relatório cadastrado para esta data ainda.</p>
              <p className="text-gray-400 text-xs mt-1">Preencha o formulário abaixo para registrar a frequência.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm border-collapse text-left">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-left">Classe</th>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Mat.</th>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Pres.</th>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Aus.</th>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Vis.</th>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Bíbl.</th>
                    <th className="px-4 py-3 border-r border-gray-200 font-semibold text-center">Rev.</th>
                    <th className="px-4 py-3 text-center font-semibold">Oferta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportsForDay.map((rep, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 border-r border-gray-200 font-semibold text-gray-900">{rep.className || rep.classe}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{rep.matriculated}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-emerald-600 font-semibold">{rep.present}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-red-500 font-medium">{rep.absent}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{rep.visitor}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{rep.bibles}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{rep.magazines}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">{formatCurrency(rep.offering)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form para Lançamento do Registro Manual */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>📝</span> Lançamento de Frequência e Oferta
              </h2>
              <p className="text-gray-500 text-xs">Selecione a data e a classe para preencher ou atualizar os dados de frequência.</p>
            </div>

            <button
              onClick={() => setShowStudentList(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl shadow-xs transition text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>👥</span> Ver Alunos da Classe
            </button>
          </div>

          <form onSubmit={handleSaveReport} className="space-y-6">
            {/* Filtros Principais: Data e Classe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  📅 Data do Relatório
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  👨‍🎓 Seleção da Classe
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-medium"
                >
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mensagem de Erro de Validação se houver */}
            {validationErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                <p className="text-red-700 font-bold">⚠️ Erro na Validação dos Números:</p>
                {validationErrors.map((err, idx) => (
                  <p key={idx} className="text-red-600">{err}</p>
                ))}
              </div>
            )}

            {/* Form Fields Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50/70 p-5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Matriculados
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.matriculated}
                  onChange={(e) => handleFormChange('matriculated', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Presentes
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.present}
                  onChange={(e) => handleFormChange('present', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-bold text-emerald-600 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ausentes
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.absent}
                  onChange={(e) => handleFormChange('absent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-bold text-red-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Visitantes
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.visitor}
                  onChange={(e) => handleFormChange('visitor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-semibold bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Bíblias
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.bibles}
                  onChange={(e) => handleFormChange('bibles', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-semibold bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Revistas
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.magazines}
                  onChange={(e) => handleFormChange('magazines', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-semibold bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Oferta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.offering}
                  onChange={(e) => handleFormChange('offering', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm font-bold text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  % Frequência da Classe
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-sky-700 font-bold text-sm">
                  {currentClassPercentage}%
                </div>
              </div>
            </div>

            {/* Salvar Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving || validationErrors.length > 0}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                  isSaving || validationErrors.length > 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSaving ? '⌛ Salvando...' : '✓ Salvar Relatório da Classe'}
              </button>
            </div>
          </form>
        </div>

        {/* Consolidado do Dia */}
        <div className="bg-sky-50/70 rounded-2xl p-6 border border-sky-200 mb-8">
          <h3 className="text-base font-bold text-sky-900 mb-4 flex items-center gap-2">
            <span>📊</span> Consolidado Geral do Dia - {todayForDisplay}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Matriculados</p>
              <p className="text-2xl font-bold text-gray-900">{consolidatedData.matriculated}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Presenças</p>
              <p className="text-2xl font-bold text-emerald-600">{consolidatedData.present}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Ausências</p>
              <p className="text-2xl font-bold text-red-500">{consolidatedData.absent}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total de Ofertas</p>
              <p className="text-2xl font-bold text-cyan-700">{formatCurrency(consolidatedData.offering)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">% Frequência Média</p>
              <p className="text-2xl font-bold text-sky-700">{dayFrequencyAvg}%</p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Alunos da Classe */}
      {showStudentList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Alunos da Classe - {classes.find(c => c.id === selectedClass)?.name}
              </h2>
              <button
                onClick={() => setShowStudentList(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingStudents ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">Carregando lista de alunos...</p>
              </div>
            ) : students.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {students.map((student, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                    <span className="font-semibold text-gray-800 text-sm">{student.nome || student.name || 'Sem nome'}</span>
                    <span className="text-xs bg-sky-100 text-sky-800 px-2.5 py-1 rounded-md font-medium">Matriculado</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <p className="text-gray-500 text-sm">Nenhum aluno matriculado nesta classe.</p>
              </div>
            )}

            <button
              onClick={() => setShowStudentList(false)}
              className="mt-6 w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold text-sm cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

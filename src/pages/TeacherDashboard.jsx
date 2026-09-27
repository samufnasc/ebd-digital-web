import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { studentFunctions, chamadaFunctions, reportFunctions } from '../lib/supabase';
import { formatCurrency } from '../utils/ocr';
import { generateDailyFrequencyChartCanvas } from '../utils/pdfCanvasCharts';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatDataBr = (iso) => {
  if (!iso) return '';
  const parts = iso.substring(0, 10).split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return iso;
};

const getUpcomingOrCurrentSunday = (d = new Date()) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().substring(0, 10);
};

export default function TeacherDashboard() {
  const { logout, user } = useAuth();
  const { reports, loadReports } = useData();

  const [activeTab, setActiveTab] = useState('chamada');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [dataAula, setDataAula] = useState(getUpcomingOrCurrentSunday());
  const [alunos, setAlunos] = useState([]);
  const [chamadaState, setChamadaState] = useState({});
  const [loadingAlunos, setLoadingAlunos] = useState(true);
  const [savingChamada, setSavingChamada] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const [visitantes, setVisitantes] = useState(0);
  const [oferta, setOferta] = useState(0);

  const classe = (user?.classe || '').trim();

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!classe) return;
    let isMounted = true;

    async function carregarListaEChamada() {
      setLoadingAlunos(true);
      try {
        const resAlunos = await studentFunctions.getStudentsByClass(classe);
        const listaAlunos = resAlunos.success ? resAlunos.data : [];

        const resChamada = await chamadaFunctions.getChamada(classe, dataAula);
        const registrosGravados = resChamada.success ? resChamada.data : [];

        const mapaGravado = {};
        registrosGravados.forEach(reg => {
          mapaGravado[reg.aluno_id] = {
            status: reg.status,
            biblia: !!reg.trouxe_biblia,
            revista: !!reg.trouxe_revista,
          };
        });

        const novoEstado = {};
        listaAlunos.forEach(a => {
          if (mapaGravado[a.id]) {
            novoEstado[a.id] = mapaGravado[a.id];
          } else {
            novoEstado[a.id] = {
              status: 'presente',
              biblia: true,
              revista: true,
            };
          }
        });

        if (isMounted) {
          setAlunos(listaAlunos);
          setChamadaState(novoEstado);
        }
      } catch (err) {
        console.error('Erro ao carregar chamada:', err);
      } finally {
        if (isMounted) setLoadingAlunos(false);
      }
    }

    carregarListaEChamada();
    return () => { isMounted = false; };
  }, [classe, dataAula]);

  const showToast = (msg, isError = false) => {
    setToastMsg({ text: msg, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleStatusChange = (alunoId, newStatus) => {
    setChamadaState(prev => ({
      ...prev,
      [alunoId]: {
        ...(prev[alunoId] || { biblia: false, revista: false }),
        status: newStatus,
      }
    }));
  };

  const handleMarcarTodos = (status) => {
    const atualizado = {};
    alunos.forEach(a => {
      atualizado[a.id] = {
        ...(chamadaState[a.id] || {}),
        status,
      };
    });
    setChamadaState(atualizado);
  };

  const handleToggleRecurso = (alunoId, tipo) => {
    setChamadaState(prev => {
      const atual = prev[alunoId] || { status: 'presente', biblia: false, revista: false };
      return {
        ...prev,
        [alunoId]: {
          ...atual,
          [tipo]: !atual[tipo],
        }
      };
    });
  };

  const resumoChamada = useMemo(() => {
    let pres = 0;
    let aus = 0;
    let bib = 0;
    let rev = 0;

    alunos.forEach(a => {
      const st = chamadaState[a.id];
      if (st?.status === 'presente') {
        pres++;
        if (st.biblia) bib++;
        if (st.revista) rev++;
      } else {
        aus++;
      }
    });

    const total = alunos.length;
    const taxa = total > 0 ? Math.round((pres / total) * 100) : 0;
    return { total, pres, aus, bib, rev, taxa };
  }, [alunos, chamadaState]);

  const handleSalvarChamada = async () => {
    if (alunos.length === 0) {
      showToast('Nenhum aluno cadastrado nesta classe.', true);
      return;
    }

    setSavingChamada(true);
    try {
      const registros = alunos.map(a => {
        const item = chamadaState[a.id] || { status: 'ausente', biblia: false, revista: false };
        return {
          data_aula: dataAula,
          classe,
          aluno_id: a.id,
          aluno_nome: a.nome,
          status: item.status,
          trouxe_biblia: item.status === 'presente' ? item.biblia : false,
          trouxe_revista: item.status === 'presente' ? item.revista : false,
          registrado_por: user?.username || 'Professor',
        };
      });

      const resChamada = await chamadaFunctions.salvarChamada(registros);
      if (!resChamada.success) throw new Error(resChamada.error);

      await reportFunctions.saveReport({
        date: dataAula,
        className: classe,
        matriculated: resumoChamada.total,
        present: resumoChamada.pres,
        absent: resumoChamada.aus,
        visitor: Number(visitantes) || 0,
        bibles: resumoChamada.bib,
        magazines: resumoChamada.rev,
        offering: Number(oferta) || 0,
      });

      await loadReports();
      showToast('Chamada salva com sucesso no banco!');
    } catch (err) {
      console.error('Erro ao salvar chamada:', err);
      showToast('Erro ao salvar: ' + err.message, true);
    } finally {
      setSavingChamada(false);
    }
  };

  const periodReports = useMemo(() => {
    if (!classe) return [];
    const padM = String(selectedMonth).padStart(2, '0');
    const monthKey = `${selectedYear}-${padM}`;
    return reports
      .filter(r =>
        (r.className || '').trim() === classe &&
        r.date &&
        String(r.date).substring(0, 7) === monthKey
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [reports, classe, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    let totalMat = 0, totalPres = 0, totalAus = 0, totalVis = 0;
    let totalBib = 0, totalRev = 0, totalOferta = 0;

    periodReports.forEach(r => {
      totalMat += Number(r.matriculated) || 0;
      totalPres += Number(r.present) || 0;
      totalAus += Number(r.absent) || 0;
      totalVis += Number(r.visitor) || 0;
      totalBib += Number(r.bibles) || 0;
      totalRev += Number(r.magazines) || 0;
      totalOferta += Number(r.offering) || 0;
    });

    const dias = periodReports.length;
    const freq = totalMat > 0 ? Math.round((totalPres / totalMat) * 100) : 0;

    return {
      dias,
      totalMat,
      totalPres,
      totalAus,
      totalVis,
      totalBib,
      totalRev,
      totalOferta,
      freq,
      mediaPres: dias > 0 ? Math.round(totalPres / dias) : 0,
      mediaAus: dias > 0 ? Math.round(totalAus / dias) : 0,
    };
  }, [periodReports]);

  const chartUrl = useMemo(() => {
    const diasData = periodReports.map(r => {
      const totalAssis = (Number(r.present) || 0) + (Number(r.absent) || 0);
      const pct = totalAssis > 0 ? Math.round((Number(r.present) / totalAssis) * 100) : 0;
      return { data: formatDataBr(r.date), pct };
    });

    const classSeries = [{
      name: classe || 'Minha Classe',
      color: '#4f46e5',
      points: diasData.map(d => ({ dataLabel: d.data, pct: d.pct })),
    }];

    return generateDailyFrequencyChartCanvas(diasData, classSeries);
  }, [periodReports, classe]);

  return (
    <div className="min-h-screen bg-[#f3f5fb] text-slate-900">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl bg-white border border-slate-200 transition-all">
          <span className="text-xl">{toastMsg.isError ? '❌' : '✅'}</span>
          <span className="text-sm font-bold text-slate-800">{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-md">
            <img src="/logo-ebd.png" alt="Logo Congregação" className="w-9 h-9 object-contain rounded-lg bg-white p-0.5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
              EBD Digital <span className="text-indigo-600">Presença+</span>
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Classe: <strong className="text-indigo-700">{classe || 'Geral'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              {(user?.username || 'P')[0].toUpperCase()}
            </div>
            <span className="text-xs font-bold text-slate-700">{user?.username}</span>
          </div>

          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 text-xs font-bold transition border border-slate-200 cursor-pointer"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* Banner Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white p-6 sm:p-8 shadow-xl shadow-indigo-600/15">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-3 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
                Portal do Professor
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Olá, {user?.username}! 👋
              </h2>
              <p className="text-indigo-100 text-xs sm:text-sm mt-1 max-w-md">
                Registre a chamada da classe <strong>{classe}</strong> e acompanhe o crescimento da sua turma.
              </p>
            </div>

            {/* Abas */}
            <div className="flex bg-black/25 p-1 rounded-2xl backdrop-blur-md self-start sm:self-center border border-white/10">
              <button
                onClick={() => setActiveTab('chamada')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  activeTab === 'chamada'
                    ? 'bg-white text-indigo-950 shadow-md'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                📝 Fazer Chamada
              </button>
              <button
                onClick={() => setActiveTab('relatorios')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  activeTab === 'relatorios'
                    ? 'bg-white text-indigo-950 shadow-md'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                📊 Relatórios & Gráficos
              </button>
            </div>
          </div>
        </div>

        {/* ABA CHAMADA */}
        {activeTab === 'chamada' && (
          <div className="space-y-6">
            {/* Barra de Data e Ações */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Data da Aula (Domingo)
                  </label>
                  <input
                    type="date"
                    value={dataAula}
                    onChange={(e) => setDataAula(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold text-slate-800"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 mr-1">Marcar todos:</span>
                  <button
                    onClick={() => handleMarcarTodos('presente')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition cursor-pointer"
                  >
                    ✓ Presentes
                  </button>
                  <button
                    onClick={() => handleMarcarTodos('ausente')}
                    className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition cursor-pointer"
                  >
                    ✗ Ausentes
                  </button>
                </div>
              </div>

              {/* Contadores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Matriculados</span>
                  <p className="text-2xl font-black text-slate-800">{resumoChamada.total}</p>
                </div>
                <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 text-center">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase">Presentes</span>
                  <p className="text-2xl font-black text-emerald-700">{resumoChamada.pres}</p>
                </div>
                <div className="bg-red-50/70 rounded-xl p-3 border border-red-100 text-center">
                  <span className="text-[11px] font-bold text-red-600 uppercase">Ausentes</span>
                  <p className="text-2xl font-black text-red-700">{resumoChamada.aus}</p>
                </div>
                <div className="bg-indigo-50/70 rounded-xl p-3 border border-indigo-100 text-center">
                  <span className="text-[11px] font-bold text-indigo-600 uppercase">Frequência</span>
                  <p className="text-2xl font-black text-indigo-700">{resumoChamada.taxa}%</p>
                </div>
              </div>
            </div>

            {/* Lista dos Alunos */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <span>📋</span> Lista de Alunos ({alunos.length})
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  {formatDataBr(dataAula)}
                </span>
              </div>

              {loadingAlunos ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-xs font-bold text-slate-500">Carregando alunos da classe...</p>
                </div>
              ) : alunos.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <span className="text-4xl block mb-2">📭</span>
                  <p className="text-sm font-bold text-slate-700">Nenhum aluno encontrado para {classe}.</p>
                  <p className="text-xs text-slate-500 mt-1">Cadastre alunos no painel de administração ou secretaria.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {alunos.map((aluno, index) => {
                    const st = chamadaState[aluno.id] || { status: 'presente', biblia: true, revista: true };
                    const isPresente = st.status === 'presente';

                    return (
                      <div
                        key={aluno.id || index}
                        className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isPresente ? 'hover:bg-slate-50/70' : 'bg-red-50/20 hover:bg-red-50/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-bold text-sm text-slate-900 leading-snug">
                              {aluno.nome}
                            </p>
                            <span className="text-[11px] text-slate-500">
                              {classe}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Segmented control */}
                          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(aluno.id, 'presente')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                                isPresente
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Presente
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(aluno.id, 'ausente')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                                !isPresente
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Falta
                            </button>
                          </div>

                          {/* Bíblia e Revista */}
                          {isPresente && (
                            <div className="flex items-center gap-1.5 ml-1">
                              <button
                                type="button"
                                onClick={() => handleToggleRecurso(aluno.id, 'biblia')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  st.biblia
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-400'
                                }`}
                              >
                                📖 Bíblia
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleRecurso(aluno.id, 'revista')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  st.revista
                                    ? 'bg-purple-50 border-purple-200 text-purple-700'
                                    : 'bg-white border-slate-200 text-slate-400'
                                }`}
                              >
                                📑 Revista
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Visitantes e Oferta */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <h4 className="font-extrabold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <span>➕</span> Dados Complementares do Domingo
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Visitantes na Classe
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={visitantes}
                    onChange={(e) => setVisitantes(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Oferta Arrecadada (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={oferta}
                    onChange={(e) => setOferta(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Botão Salvar */}
            <div className="sticky bottom-4 z-30">
              <button
                type="button"
                disabled={savingChamada || loadingAlunos || alunos.length === 0}
                onClick={handleSalvarChamada}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base shadow-xl shadow-emerald-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {savingChamada ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Gravando Chamada no Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Salvar Chamada de {formatDataBr(dataAula)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ABA RELATÓRIOS */}
        {activeTab === 'relatorios' && (
          <div className="space-y-6">
            {/* Seletor de Período */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Período Selecionado</h3>
                <p className="text-xs text-slate-500">Filtrando domingos registrados da classe {classe}</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {MESES.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Domingos de Aula</span>
                <p className="text-2xl font-black text-slate-800 mt-1">{stats.dias}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-indigo-500 uppercase">Frequência Média</span>
                <p className="text-2xl font-black text-indigo-700 mt-1">{stats.freq}%</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-emerald-500 uppercase">Média Presenças</span>
                <p className="text-2xl font-black text-emerald-700 mt-1">{stats.mediaPres}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-purple-500 uppercase">Total Ofertas</span>
                <p className="text-2xl font-black text-purple-700 mt-1">{formatCurrency(stats.totalOferta)}</p>
              </div>
            </div>

            {/* Gráfico de Frequência ao Longo do Mês */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="font-extrabold text-base text-slate-900 mb-1 flex items-center gap-2">
                <span>📈</span> Evolução da Frequência na Classe
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Percentual de presença em cada domingo de aula registrado no período.
              </p>

              {periodReports.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400">Nenhum domingo de aula registrado neste mês.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <img
                    src={chartUrl}
                    alt="Gráfico de Frequência"
                    className="w-full min-w-[550px] h-auto"
                  />
                </div>
              )}
            </div>

            {/* Tabela dos Domingos */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-extrabold text-base text-slate-900">
                  Detalhamento dos Domingos
                </h3>
              </div>

              {periodReports.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhum registro para o período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] font-extrabold uppercase border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3 text-center">Mat.</th>
                        <th className="px-4 py-3 text-center">Pres.</th>
                        <th className="px-4 py-3 text-center">Aus.</th>
                        <th className="px-4 py-3 text-center">Freq.</th>
                        <th className="px-4 py-3 text-center">Bíblias</th>
                        <th className="px-4 py-3 text-center">Revistas</th>
                        <th className="px-4 py-3 text-right">Oferta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {periodReports.map((r, i) => {
                        const total = (Number(r.present) || 0) + (Number(r.absent) || 0);
                        const freq = total > 0 ? Math.round((Number(r.present) / total) * 100) : 0;
                        return (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-bold text-slate-900">{formatDataBr(r.date)}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{r.matriculated}</td>
                            <td className="px-4 py-3 text-center font-bold text-emerald-600">{r.present}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-500">{r.absent}</td>
                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{freq}%</td>
                            <td className="px-4 py-3 text-center text-slate-600">{r.bibles}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{r.magazines}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(r.offering)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

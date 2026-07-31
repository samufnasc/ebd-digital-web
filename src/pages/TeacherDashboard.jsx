import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/ocr';
import { generateDailyFrequencyChartCanvas } from '../utils/pdfCanvasCharts';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatDataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export default function TeacherDashboard() {
  const { logout, user } = useAuth();
  const { reports, loadReports } = useData();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const classe = (user?.classe || '').trim();

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const periodReports = useMemo(() => {
    if (!classe) return [];
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return reports
      .filter(r =>
        (r.className || '').trim() === classe &&
        r.date &&
        String(r.date).substring(0, 7) === monthKey
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [reports, classe, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    let totalMat = 0;
    let totalPres = 0;
    let totalAus = 0;
    let totalVis = 0;
    let totalBib = 0;
    let totalRev = 0;
    let totalOferta = 0;

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
      mediaBib: dias > 0 ? Math.round(totalBib / dias) : 0,
      mediaRev: dias > 0 ? Math.round(totalRev / dias) : 0,
      mediaPres: dias > 0 ? Math.round(totalPres / dias) : 0,
      mediaAus: dias > 0 ? Math.round(totalAus / dias) : 0,
    };
  }, [periodReports]);

  // Gráfico de linha: Frequência Diária por Classe ao Longo do Período (%)
  const chartUrl = useMemo(() => {
    const diasData = periodReports.map(r => {
      const totalAssis = (Number(r.present) || 0) + (Number(r.absent) || 0);
      const pct = totalAssis > 0 ? Math.round((Number(r.present) / totalAssis) * 100) : 0;
      return { data: formatDataBr(r.date), pct };
    });

    const classSeries = [{
      name: classe || 'Minha Classe',
      color: '#0284C7',
      points: diasData.map(d => ({ dataLabel: d.data, pct: d.pct })),
    }];

    return generateDailyFrequencyChartCanvas(diasData, classSeries);
  }, [periodReports, classe]);

  const selectedDateLabel = `${MESES[selectedMonth - 1]} de ${selectedYear}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo-ebd.png" alt="EBD Digital Logo" className="w-12 h-12 object-contain rounded-full shadow-xs" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Painel do Professor</h1>
              <p className="text-gray-500 text-sm">Bem-vindo, {user?.nomeCompleto || user?.username}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer text-sm self-start sm:self-auto"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Classe e Período */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>📊</span> Análise de Frequência Diária por Classe
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Classe: <strong className="text-cyan-700">{classe || 'Não vinculada'}</strong> · Período: <strong>{selectedDateLabel}</strong>
              </p>
            </div>

            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mês</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm"
                >
                  {MESES.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Ano</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-600 outline-none text-sm"
                >
                  {[2023, 2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Domingos Registrados</p>
            <p className="text-3xl font-bold text-slate-700">{stats.dias}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Frequência Média (%)</p>
            <p className="text-3xl font-bold text-sky-600">{stats.freq}%</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Média Pres. / Aus.</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.mediaPres} <span className="text-sm text-slate-400">/</span> <span className="text-red-500">{stats.mediaAus}</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Total de Ofertas (R$)</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalOferta)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Total Matriculados</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalMat}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Total Presentes / Faltas</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.totalPres} <span className="text-sm text-slate-400">/</span> <span className="text-red-500">{stats.totalAus}</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Média Bíblias / Revistas</p>
            <p className="text-3xl font-bold text-teal-600">{stats.mediaBib} <span className="text-sm text-slate-400">/</span> <span className="text-purple-600">{stats.mediaRev}</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-gray-500 text-xs font-medium mb-1">Total de Visitantes</p>
            <p className="text-3xl font-bold text-blue-600">{stats.totalVis}</p>
          </div>
        </div>

        {/* Gráfico de Frequência Diária */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span>📈</span> Frequência Diária ao Longo do Período (%)
          </h2>
          <p className="text-gray-500 text-xs mb-4">
            Percentual de presença em cada domingo de aula registrado no período selecionado.
          </p>

          {periodReports.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-500 text-sm">📭 Nenhum registro de aula para {classe} em {selectedDateLabel}.</p>
            </div>
          ) : (
            <img
              src={chartUrl}
              alt="Gráfico de Frequência Diária"
              className="w-full h-auto rounded-xl border border-gray-100"
            />
          )}
        </div>

        {/* Tabela de Detalhamento por Domingo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📋</span> Detalhamento por Domingo de Aula
          </h2>

          {periodReports.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-500 text-sm">Nenhum registro no período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm border-collapse text-left">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-200 text-left">Data</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">Mat.</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">Pres.</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">Aus.</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">% Freq.</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">Vis.</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">Bíbl.</th>
                    <th className="px-4 py-3 border-r border-gray-200 text-center">Rev.</th>
                    <th className="px-4 py-3 text-center">Oferta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {periodReports.map((r, idx) => {
                    const totalAssis = (Number(r.present) || 0) + (Number(r.absent) || 0);
                    const pct = totalAssis > 0 ? Math.round((Number(r.present) / totalAssis) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 border-r border-gray-200 font-semibold text-gray-900">{formatDataBr(r.date)}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{r.matriculated}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-emerald-600 font-semibold">{r.present}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-red-500 font-medium">{r.absent}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-sky-700 font-semibold">{pct}%</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{r.visitor}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{r.bibles}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-center text-gray-700">{r.magazines}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900">{formatCurrency(r.offering)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

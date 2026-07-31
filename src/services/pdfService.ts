import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  generateDailyFrequencyChartCanvas,
  generateClassFrequencyChartCanvas,
  generateClassPresenceAbsenceChartCanvas,
  generateClassBiblesMagazinesChartCanvas,
  generatePresenceDonutChartCanvas,
  generateOfferingsBarChartCanvas
} from '../utils/pdfCanvasCharts';

interface LinhaClasse {
  classe: string;
  matriculados: number;
  countDias?: number;
  ausentes: number;
  presentes: number;
  oferta: number;
  visitantes?: number;
  biblias?: number;
  revistas?: number;
}

interface DiaPayload {
  data: string;
  classes: LinhaClasse[];
}

interface RelatorioPayload {
  congregacao: string;
  referencia_mes: string;
  dias: DiaPayload[];
}

/**
 * Geração de PDF Analítico Completo de 5 Páginas no navegador utilizando jsPDF + Canvas
 */
export function gerarPDFMensalClientSide(payload: RelatorioPayload) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dataHoje = new Date().toLocaleDateString('pt-BR');

  const formatNum = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return '0';
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  };

  // Helper para rodapé das páginas
  const addFooter = (pageNum: number, totalPages: number = 5) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Página ${pageNum} de ${totalPages} - Relatório gerado automaticamente pelo sistema EBD Digital`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  };

  // 1. Processar e consolidar dados de payload.dias
  const mapClasses = new Map<string, {
    classe: string;
    matriculados: number;
    countDias: number;
    totalPresentes: number;
    totalAusentes: number;
    totalVisitantes: number;
    totalBiblias: number;
    totalRevistas: number;
    totalOferta: number;
  }>();

  const mapDiasPct: { data: string; pct: number; presentes: number; ausentes: number }[] = [];

  let totalPresentesAcum = 0;
  let totalAusentesAcum = 0;
  let totalVisitantesAcum = 0;
  let totalBibliasAcum = 0;
  let totalRevistasAcum = 0;
  let totalOfertasAcum = 0;

  const totalDiasGravados = payload.dias.length;

  payload.dias.forEach((diaData) => {
    let diaPres = 0;
    let diaMat = 0;
    let diaAus = 0;

    diaData.classes.forEach((c) => {
      diaPres += c.presentes;
      diaMat += c.matriculados;
      diaAus += c.ausentes;

      totalPresentesAcum += c.presentes;
      totalAusentesAcum += c.ausentes;
      totalVisitantesAcum += c.visitantes || 0;
      totalBibliasAcum += c.biblias || 0;
      totalRevistasAcum += c.revistas || 0;
      totalOfertasAcum += c.oferta || 0;

      const existing = mapClasses.get(c.classe) || {
        classe: c.classe,
        matriculados: c.matriculados,
        countDias: 0,
        totalPresentes: 0,
        totalAusentes: 0,
        totalVisitantes: 0,
        totalBiblias: 0,
        totalRevistas: 0,
        totalOferta: 0
      };

      existing.matriculados = Math.max(existing.matriculados, c.matriculados);
      existing.countDias += 1;
      existing.totalPresentes += c.presentes;
      existing.totalAusentes += c.ausentes;
      existing.totalVisitantes += c.visitantes || 0;
      existing.totalBiblias += c.biblias || 0;
      existing.totalRevistas += c.revistas || 0;
      existing.totalOferta += c.oferta || 0;

      mapClasses.set(c.classe, existing);
    });

    const diaAssis = diaPres + diaAus;
    const diaPct = diaAssis > 0 ? Math.round((diaPres / diaAssis) * 100) : 0;
    mapDiasPct.push({ data: diaData.data, pct: diaPct, presentes: diaPres, ausentes: diaAus });
  });

  const rawClasses = Array.from(mapClasses.values());
  const classesConsolidadas = rawClasses.map((c) => {
    const numDias = c.countDias > 0 ? c.countDias : 1;
    const mediaPresentes = Number((c.totalPresentes / numDias).toFixed(1));
    const mediaAusentes = Number((c.totalAusentes / numDias).toFixed(1));
    const mediaVisitantes = Number((c.totalVisitantes / numDias).toFixed(1));
    const mediaBiblias = Number((c.totalBiblias / numDias).toFixed(1));
    const mediaRevistas = Number((c.totalRevistas / numDias).toFixed(1));

    const totalClassAssis = c.totalPresentes + c.totalAusentes;
    const pctFreq = totalClassAssis > 0 ? Math.round((c.totalPresentes / totalClassAssis) * 100) : 0;

    return {
      ...c,
      mediaPresentes,
      mediaAusentes,
      mediaVisitantes,
      mediaBiblias,
      mediaRevistas,
      pctFreq
    };
  });

  const totalMatriculados = classesConsolidadas.reduce((acc, curr) => acc + curr.matriculados, 0);

  const numDiasGeral = totalDiasGravados > 0 ? totalDiasGravados : 1;
  const mediaPresentesGeral = Number((totalPresentesAcum / numDiasGeral).toFixed(1));
  const mediaAusentesGeral = Number((totalAusentesAcum / numDiasGeral).toFixed(1));
  const mediaVisitantesGeral = Number((totalVisitantesAcum / numDiasGeral).toFixed(1));
  const mediaBibliasGeral = Number((totalBibliasAcum / numDiasGeral).toFixed(1));
  const mediaRevistasGeral = Number((totalRevistasAcum / numDiasGeral).toFixed(1));

  const totalAssistenciaGeral = totalPresentesAcum + totalAusentesAcum;
  const freqMediaGeral = totalAssistenciaGeral > 0
    ? Math.round((totalPresentesAcum / totalAssistenciaGeral) * 100)
    : 0;

  // ==========================================
  // PÁGINA 1: RELATÓRIO MENSAL ANALÍTICO & INDICADORES
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('EBD DIGITAL', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('Relatório Mensal Analítico', pageWidth / 2, 28, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(payload.referencia_mes, pageWidth / 2, 35, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Data de Emissão: ${dataHoje}`, pageWidth / 2, 41, { align: 'center' });

  // Informações da Congregação
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(payload.congregacao || 'Igreja Evangélica EBD Digital', 14, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Relatório Consolidado de Frequência, Assistência e Ofertas', 14, 58);

  // Título dos Indicadores
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('INDICADORES PRINCIPAIS DO MÊS', 14, 68);

  // Desenhando os 5 Cards de Indicadores (Mostrando Médias)
  const cardY = 73;
  const cardH = 28;

  // Card 1: Frequência Média
  doc.setFillColor(16, 185, 129); // Emerald
  doc.roundedRect(14, cardY, 34, cardH, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Frequência Média', 17, cardY + 8);
  doc.setFontSize(13);
  doc.text(`${freqMediaGeral}%`, 17, cardY + 20);

  // Card 2: Média Presentes
  doc.setFillColor(34, 197, 94); // Green
  doc.roundedRect(51, cardY, 34, cardH, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.text('Média Presentes', 54, cardY + 8);
  doc.setFontSize(13);
  doc.text(`${formatNum(mediaPresentesGeral)}`, 54, cardY + 20);

  // Card 3: Média Ausentes
  doc.setFillColor(239, 68, 68); // Red
  doc.roundedRect(88, cardY, 34, cardH, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.text('Média Ausentes', 91, cardY + 8);
  doc.setFontSize(13);
  doc.text(`${formatNum(mediaAusentesGeral)}`, 91, cardY + 20);

  // Card 4: Total Visitantes
  doc.setFillColor(59, 130, 246); // Blue
  doc.roundedRect(125, cardY, 34, cardH, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.text('Total Visitantes', 128, cardY + 8);
  doc.setFontSize(13);
  doc.text(`${totalVisitantesAcum}`, 128, cardY + 20);

  // Card 5: Total Ofertas
  doc.setFillColor(249, 115, 22); // Orange
  doc.roundedRect(162, cardY, 34, cardH, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.text('Total Ofertas', 165, cardY + 8);
  doc.setFontSize(11);
  doc.text(`R$ ${totalOfertasAcum.toFixed(2)}`, 165, cardY + 20);

  // Tabela por Classe
  const tableRows: (string | number)[][] = [];

  classesConsolidadas.forEach((c) => {
    tableRows.push([
      c.classe,
      c.matriculados,
      formatNum(c.mediaAusentes),
      formatNum(c.mediaPresentes),
      formatNum(c.mediaVisitantes),
      `${c.pctFreq}%`,
      formatNum(c.mediaBiblias),
      formatNum(c.mediaRevistas),
      `R$ ${c.totalOferta.toFixed(2)}`
    ]);
  });

  // Linha TOTAL
  tableRows.push([
    'TOTAL',
    totalMatriculados,
    formatNum(mediaAusentesGeral),
    formatNum(mediaPresentesGeral),
    formatNum(mediaVisitantesGeral),
    `${freqMediaGeral}%`,
    formatNum(mediaBibliasGeral),
    formatNum(mediaRevistasGeral),
    `R$ ${totalOfertasAcum.toFixed(2)}`
  ]);

  autoTable(doc, {
    head: [['Classe', 'Mat', 'Aus (Média)', 'Pres (Média)', 'Vis (Média)', '% Freq', 'Bibl (Média)', 'Rev (Média)', 'Oferta (Total)']],
    body: tableRows,
    startY: 108,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  
  const notaTexto = `* Nota: Os valores de Ausentes, Presentes, Visitantes, Bíblias e Revistas representam a Média por Domingo de aula (${totalDiasGravados} registro(s) no período). Oferta representa o valor Total.`;
  const notaLinhas = doc.splitTextToSize(notaTexto, 180);
  let noteY = finalY;
  notaLinhas.forEach((linha: string) => {
    doc.text(linha, 14, noteY);
    noteY += 4;
  });

  addFooter(1);

  // ==========================================
  // PÁGINA 2: ANÁLISE DE FREQUÊNCIA DIÁRIA POR CLASSE
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('ANÁLISE DE FREQUÊNCIA DIÁRIA POR CLASSE', 14, 20);

  // Criar séries individuais por classe para o gráfico de linha da Página 2
  const CLASS_COLORS_SERIES = [
    '#0284C7', // Sky Blue
    '#F59E0B', // Amber
    '#22C55E', // Green
    '#F43F5E', // Rose/Coral
    '#14B8A6', // Teal
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6366F1'  // Indigo
  ];

  const uniqueClassNames = Array.from(
    new Set(payload.dias.flatMap((d) => d.classes.map((c) => c.classe)))
  );

  const classSeriesList = uniqueClassNames.map((cName, idx) => {
    const color = CLASS_COLORS_SERIES[idx % CLASS_COLORS_SERIES.length];
    const points = payload.dias.map((diaData) => {
      const cItem = diaData.classes.find((c) => c.classe === cName);
      let pct = 0;
      if (cItem) {
        const totalClassAssis = cItem.presentes + cItem.ausentes;
        pct = totalClassAssis > 0 ? Math.round((cItem.presentes / totalClassAssis) * 100) : 0;
      }
      return { dataLabel: diaData.data, pct };
    });
    return { name: cName, color, points };
  });

  if (uniqueClassNames.length > 1) {
    classSeriesList.push({
      name: 'Média Geral',
      color: '#334155',
      points: mapDiasPct.map((d) => ({ dataLabel: d.data, pct: d.pct }))
    });
  }

  const imgDailyChart = generateDailyFrequencyChartCanvas(mapDiasPct, classSeriesList);
  if (imgDailyChart) {
    doc.addImage(imgDailyChart, 'PNG', 14, 25, 182, 100);
  }

  // Tabela de Detalhamento por Domingo de Aula abaixo do gráfico
  const detailRows: (string | number)[][] = [];

  payload.dias.forEach((diaData) => {
    diaData.classes.forEach((c) => {
      const totalAssis = c.presentes + c.ausentes;
      const pct = totalAssis > 0 ? Math.round((c.presentes / totalAssis) * 100) : 0;
      detailRows.push([
        diaData.data,
        c.classe,
        c.matriculados,
        c.presentes,
        c.ausentes,
        `${pct}%`,
        `R$ ${(c.oferta || 0).toFixed(2)}`
      ]);
    });
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('REGISTROS INDIVIDUAIS POR DOMINGO DE AULA', 14, 132);

  autoTable(doc, {
    head: [['Data', 'Classe', 'Mat', 'Pres', 'Aus (Faltas)', '% Freq', 'Oferta']],
    body: detailRows,
    startY: 136,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'left', fontStyle: 'bold' } },
    headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold' }
  });

  addFooter(2);

  // ==========================================
  // PÁGINA 3: FREQUÊNCIA E FALTAS POR CLASSE
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('FREQUÊNCIA E FALTAS POR CLASSE', 14, 20);

  // Chart 1: Porcentagem de Frequência por Classe
  const imgClassChart = generateClassFrequencyChartCanvas(classesConsolidadas);
  if (imgClassChart) {
    doc.addImage(imgClassChart, 'PNG', 14, 28, 182, 80);
  }

  // Chart 2: Média de Presentes vs Faltas (Ausentes) por Classe
  const imgPresenceAbsenceChart = generateClassPresenceAbsenceChartCanvas(classesConsolidadas);
  if (imgPresenceAbsenceChart) {
    doc.addImage(imgPresenceAbsenceChart, 'PNG', 14, 114, 182, 80);
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Comparativo de assiduidade e médias de faltas por classe individualmente.', 14, 200);

  addFooter(3);

  // ==========================================
  // PÁGINA 4: ANÁLISE DE BÍBLIAS, REVISTAS E OFERTAS
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('ANÁLISE DE BÍBLIAS, REVISTAS E OFERTAS', 14, 20);

  // Chart 1: Bíblias e Revistas por Classe
  const imgBiblesMag = generateClassBiblesMagazinesChartCanvas(classesConsolidadas);
  if (imgBiblesMag) {
    doc.addImage(imgBiblesMag, 'PNG', 14, 28, 88, 88);
  }

  // Chart 2: Ofertas por Classe
  const imgOfferings = generateOfferingsBarChartCanvas(classesConsolidadas);
  if (imgOfferings) {
    doc.addImage(imgOfferings, 'PNG', 108, 28, 88, 88);
  }

  // Chart 3: Donut de Presença vs Ausência Geral
  const imgDonut = generatePresenceDonutChartCanvas(totalPresentesAcum, totalAusentesAcum);
  if (imgDonut) {
    doc.addImage(imgDonut, 'PNG', 61, 122, 88, 75);
  }

  addFooter(4);

  // ==========================================
  // PÁGINA 5: RESUMO EXECUTIVO E RECOMENDAÇÕES
  // ==========================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMO EXECUTIVO', 14, 20);

  // Encontrar melhor e menor classe
  let melhorClasse = { classe: 'N/A', pct: 0 };
  let menorClasse = { classe: 'N/A', pct: 100 };

  classesConsolidadas.forEach((c) => {
    if (c.pctFreq >= melhorClasse.pct) melhorClasse = { classe: c.classe, pct: c.pctFreq };
    if (c.pctFreq <= menorClasse.pct) menorClasse = { classe: c.classe, pct: c.pctFreq };
  });

  const pctAusentesGeral = 100 - freqMediaGeral;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  let currentY = 30;
  const execBullets = [
    `• Total de Matriculados: ${totalMatriculados}`,
    `• Frequência Média Geral: ${freqMediaGeral}% (Taxa de ausência: ${pctAusentesGeral}%)`,
    `• Média de Presentes por Domingo: ${formatNum(mediaPresentesGeral)} (Total no período: ${totalPresentesAcum})`,
    `• Média de Ausentes/Faltas por Domingo: ${formatNum(mediaAusentesGeral)} (Total de faltas: ${totalAusentesAcum})`,
    `• Total de Visitantes Acumulado: ${totalVisitantesAcum}`,
    `• Média de Bíblias Distribuídas: ${formatNum(mediaBibliasGeral)} por aula (Total: ${totalBibliasAcum})`,
    `• Média de Revistas Distribuídas: ${formatNum(mediaRevistasGeral)} por aula (Total: ${totalRevistasAcum})`,
    `• Total de Ofertas Arrecadadas: R$ ${totalOfertasAcum.toFixed(2)}`,
    `• Classe com Melhor Frequência: ${melhorClasse.classe} (${melhorClasse.pct}%)`,
    `• Classe com Menor Frequência: ${menorClasse.classe} (${menorClasse.pct}%)`
  ];

  execBullets.forEach((bullet) => {
    doc.text(bullet, 18, currentY);
    currentY += 7;
  });

  currentY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('ANÁLISE E RECOMENDAÇÕES', 14, currentY);

  currentY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const recommendations = [
    freqMediaGeral < 70
      ? `• Frequência Geral (${freqMediaGeral}%): Recomenda-se intensificar a visitação e acompanhamento dos alunos com ausências recorrentes (média de ${formatNum(mediaAusentesGeral)} faltas por domingo).`
      : `• Frequência Geral (${freqMediaGeral}%): Excelente nível de assiduidade na EBD.`,
    `• Classe ${menorClasse.classe}: Apresenta menor índice de frequência (${menorClasse.pct}%). Planejar ações focadas no resgate dos alunos faltosos.`,
    `• Classe ${melhorClasse.classe}: Apresenta o maior engajamento (${melhorClasse.pct}%). Reconhecer a liderança e compartilhar boas práticas.`,
    `• Manter acompanhamento dos relatórios por aula para prevenção da evasão.`
  ];

  recommendations.forEach((rec) => {
    const lines = doc.splitTextToSize(rec, 175);
    lines.forEach((line: string) => {
      doc.text(line, 18, currentY);
      currentY += 6;
    });
    currentY += 2;
  });

  addFooter(5);

  // Salvar o arquivo
  const nomeArquivo = `Relatorio_Mensal_Analitico_${payload.referencia_mes.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(nomeArquivo);
  return { success: true };
}

/**
 * Busca os dados do Supabase para os meses e classes selecionados e gera o PDF analítico
 */
export async function gerarRelatorioMensalCompleto(
  congregacao: string,
  mesAno: string,                 // formato "2026-03" ou lista
  mesAnoExtenso: string,         // formato "Março / 2026" ou "Março a Junho / 2026"
  selectedClasses: string[] | null = null,
  selectedMonthsList: { month: number; year: number }[] | null = null
) {
  try {
    let relatoriosBanco: any[] = [];

    if (selectedMonthsList && selectedMonthsList.length > 0) {
      // Buscar dados para múltiplos meses com datas válidas de fim de mês
      const promessas = selectedMonthsList.map(async ({ month, year }) => {
        const mStr = String(month).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        const lDayStr = String(lastDay).padStart(2, '0');
        const inicio = `${year}-${mStr}-01`;
        const fim = `${year}-${mStr}-${lDayStr}`;

        const { data, error } = await supabase
          .from('relatorios_ebd')
          .select('*')
          .gte('data_aula', inicio)
          .lte('data_aula', fim)
          .order('data_aula', { ascending: true });

        if (error) {
          console.warn(`Erro ao buscar dados do mês ${month}/${year}:`, error);
          return [];
        }
        return data || [];
      });

      const resultados = await Promise.all(promessas);
      relatoriosBanco = resultados.flat();
    } else {
      // Buscar para o único mês com data válida de fim de mês
      const [yearStr, monthStr] = mesAno.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const lastDay = new Date(year, month, 0).getDate();
      const lDayStr = String(lastDay).padStart(2, '0');
      const inicioMes = `${mesAno}-01`;
      const fimMes = `${mesAno}-${lDayStr}`;

      const { data, error } = await supabase
        .from('relatorios_ebd')
        .select('*')
        .gte('data_aula', inicioMes)
        .lte('data_aula', fimMes)
        .order('data_aula', { ascending: true });

      if (error) {
        console.warn('Erro na consulta por mês:', error);
      } else {
        relatoriosBanco = data || [];
      }
    }

    // Fallback: Se por algum motivo a consulta com intervalo não retornar dados, buscar todos e filtrar localmente
    if (!relatoriosBanco || relatoriosBanco.length === 0) {
      console.log('Relatórios do intervalo vazios. Executando busca total de fallback...');
      const { data: allData } = await supabase
        .from('relatorios_ebd')
        .select('*')
        .order('data_aula', { ascending: true });

      if (allData && allData.length > 0) {
        relatoriosBanco = allData.filter((r: any) => {
          if (!r?.data_aula) return false;
          const rDateStr = String(r.data_aula).substring(0, 10);
          if (selectedMonthsList && selectedMonthsList.length > 0) {
            return selectedMonthsList.some(({ month, year }) => {
              const mStr = String(month).padStart(2, '0');
              return rDateStr.startsWith(`${year}-${mStr}`);
            });
          } else {
            return rDateStr.startsWith(mesAno);
          }
        });
      }
    }

    // Filtrar por classes selecionadas se houver (com comparação normalizada para evitar falha por espaços/caixa)
    if (selectedClasses && selectedClasses.length > 0) {
      const normalizedSelected = selectedClasses.map((s) => String(s).trim().toLowerCase());
      relatoriosBanco = relatoriosBanco.filter((r: any) => {
        if (!r?.classe) return false;
        const rClasse = String(r.classe).trim().toLowerCase();
        return normalizedSelected.includes(rClasse);
      });
    }

    const congregacaoFinal = (congregacao && congregacao.trim() !== '')
      ? congregacao
      : (localStorage.getItem('ebd_congregacao_nome') || 'Congregação Mensageiros da Fé');

    if (!relatoriosBanco || relatoriosBanco.length === 0) {
      const payloadVazio: RelatorioPayload = {
        congregacao: congregacaoFinal,
        referencia_mes: mesAnoExtenso,
        dias: [],
      };
      return gerarPDFMensalClientSide(payloadVazio);
    }

    // Agrupar por data de aula
    const agrupadoPorData: { [data: string]: any[] } = {};

    relatoriosBanco.forEach((registro: any) => {
      if (!registro?.data_aula) return;

      const dataStr = String(registro.data_aula).substring(0, 10);
      const [ano, mes, dia] = dataStr.split('-');
      const dataBr = `${dia}/${mes}/${ano}`;

      if (!agrupadoPorData[dataBr]) {
        agrupadoPorData[dataBr] = [];
      }
      agrupadoPorData[dataBr].push(registro);
    });

    const diasFormatados: DiaPayload[] = Object.keys(agrupadoPorData)
      .sort((a, b) => {
        const [da, ma, aa] = a.split('/').map(Number);
        const [db, mb, ab] = b.split('/').map(Number);
        return new Date(aa, ma - 1, da).getTime() - new Date(ab, mb - 1, db).getTime();
      })
      .map((dataBr) => ({
        data: dataBr,
        classes: agrupadoPorData[dataBr].map((item: any) => ({
          classe: item.classe ?? '',
          matriculados: Number(item.matriculados ?? 0),
          ausentes: Number(item.ausentes ?? 0),
          presentes: Number(item.presentes ?? 0),
          oferta: parseFloat(item.ofertas ?? 0),
          visitantes: Number(item.visitantes ?? 0),
          biblias: Number(item.biblias ?? 0),
          revistas: Number(item.revistas ?? 0),
        })),
      }));

    const payload: RelatorioPayload = {
      congregacao: congregacaoFinal,
      referencia_mes: mesAnoExtenso,
      dias: diasFormatados,
    };

    return gerarPDFMensalClientSide(payload);
  } catch (err: any) {
    console.error('Erro ao gerar relatório mensal:', err);
    alert(`Erro ao gerar PDF: ${err?.message || err}`);
    return { success: false, error: err };
  }
}

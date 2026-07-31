import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { studentFunctions } from '../lib/supabase';

// Categorias do formulário oficial da supervisão (na ordem exata do modelo)
// 'classes' são os nomes das classes do sistema que compõem cada categoria
interface LinhaCategoria {
  nome: string;
  classes: string[];
}

const CATEGORIAS: LinhaCategoria[] = [
  { nome: 'CLASSE OFICIAL (PROFESSORES)', classes: ['Adonai'] },
  { nome: 'ADULTOS', classes: ['Abraão', 'Geração Eleita'] },
  { nome: 'JOVENS', classes: ['Vencedores do Rei'] },
  { nome: 'PRÉ-ADOLESCENTES', classes: [] },
  { nome: 'JUVENIS', classes: [] },
  { nome: 'ADOLESCENTES', classes: [] },
  { nome: 'JUNIORES', classes: ['Crescendo com Cristo'] },
  { nome: 'PRIMÁRIOS', classes: [] },
  { nome: 'JARDIM DE INFÂNCIA', classes: ['Jardim de Deus'] },
  { nome: 'MATERNAL', classes: [] },
  { nome: 'BERÇÁRIO', classes: [] },
  { nome: 'DISCIPULADO', classes: [] },
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ============================================================
// POSIÇÕES NO MOLDE (em pontos, origem no TOPO da página)
// As coordenadas foram extraídas do arquivo modelo:
// 'public/templates/relatorio_mensal_supervisao.pdf'
// A coluna de valores fica centrada em x = 436 (entre 333 e 538)
// A linha de base do texto (11pt) = y0_da_linha + 9.5
// ============================================================
const PAGE_HEIGHT = 842.04; // A4 em pontos

const T1_BASELINE = [160.1, 173.3, 186.5, 199.6, 212.8, 225.9, 239.1, 252.2, 265.4, 278.6, 291.7, 304.9];
const T2_BASELINE = [344.2, 357.4, 370.6, 383.7, 396.9, 410.0, 423.2, 436.4, 449.5, 462.7, 475.8, 489.0];
const T3_BASELINE = [528.5, 541.5, 554.7, 567.8, 581.0, 594.1, 607.3, 620.5, 633.6, 646.8, 659.9, 673.1];

const T1_TOTAL_BASELINE = 147.0;   // linha do cabeçalho "TOTAL:"
const T2_TOTAL_BASELINE = 331.2;   // "TOTAL (%):"
const T3_TOTAL_BASELINE = 515.3;   // "TOTAL (%):"

const CONGREGACAO_BASELINE = 108.6;
const REFERENCIA_BASELINE = 127.7;

const ENTRADAS_BASELINE = 706.8;   // TOTAL DAS ENTRADAS (R$)
const VISITANTES_BASELINE = 720.8; // TOTAL DE VISITANTES

const VALOR_X_CENTER = 436;        // centro da coluna de valores

const fmtPct = (v: number) => String(Math.round(v));

// A palavra "CONGREGAÇÃO:" já está impressa no molde, então removemos
// o prefixo "Congregação ..." do nome passado (ex.: "Congregação Mensageiros da Fé" -> "Mensageiros da Fé")
const limparNomeCongregacao = (nome: string) =>
  nome.replace(/^congrega[cç][aã]o\s+/i, '');

const fmtMoeda = (v: number) => {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

interface GerarRelatorioSupervisaoParams {
  congregacao: string;
  month: number;
  year: number;
  reports: any[];
}

/**
 * Gera o PDF do Relatório Mensal para a Supervisão de Área.
 * Carrega o MOLDE oficial ('public/templates/relatorio_mensal_supervisao.pdf')
 * e desenha os dados exatamente em cima das células do formulário (1 página).
 */
export async function gerarRelatorioSupervisao({
  congregacao,
  month,
  year,
  reports,
}: GerarRelatorioSupervisaoParams) {
  // 1. Matriculados por classe: contagem de alunos do banco no mês/ano
  let students: any[] = [];
  try {
    const studentsResult = await studentFunctions.getAllStudents(month, year);
    if (studentsResult.success && Array.isArray(studentsResult.data)) {
      students = studentsResult.data;
    }
  } catch (err: any) {
    console.warn('relatorioSupervisao - erro ao carregar alunos:', err?.message);
  }

  // 2. Relatórios do mês selecionado
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const reportsMes = (reports || []).filter(
    (r: any) => r.date && String(r.date).substring(0, 7) === monthKey
  );

  // 3. Calcular dados por categoria
  const linhas = CATEGORIAS.map(cat => {
    const temClasses = cat.classes.length > 0;

    const alunosCat = students.filter(
      (s: any) => cat.classes.includes(String(s.classe || '').trim())
    );
    const matriculados = alunosCat.length;

    const repsCat = reportsMes.filter(
      (r: any) => cat.classes.includes(String(r.className || '').trim())
    );
    let totalPres = 0;
    let totalAus = 0;
    let totalMat = 0;
    repsCat.forEach((r: any) => {
      totalPres += Number(r.present) || 0;
      totalAus += Number(r.absent) || 0;
      totalMat += Number(r.matriculated) || 0;
    });

    const freq = totalMat > 0 ? (totalPres / totalMat) * 100 : null;
    const faltas = totalMat > 0 ? (totalAus / totalMat) * 100 : null;

    return { nome: cat.nome, temClasses, matriculados, freq, faltas };
  });

  // 4. Totais
  const totalMatriculados = linhas.reduce((acc, l) => acc + l.matriculados, 0);

  let totalPresG = 0;
  let totalAusG = 0;
  let totalMatG = 0;
  let totalEntradas = 0;
  let totalVisitantes = 0;
  reportsMes.forEach((r: any) => {
    totalPresG += Number(r.present) || 0;
    totalAusG += Number(r.absent) || 0;
    totalMatG += Number(r.matriculated) || 0;
    totalEntradas += Number(r.offering) || 0;
    totalVisitantes += Number(r.visitor) || 0;
  });
  const totalFreq = totalMatG > 0 ? (totalPresG / totalMatG) * 100 : 0;
  const totalFaltas = totalMatG > 0 ? (totalAusG / totalMatG) * 100 : 0;

  // 5. Carregar o molde e preencher
  const resp = await fetch('/templates/relatorio_mensal_supervisao.pdf');
  if (!resp.ok) {
    throw new Error('Não foi possível carregar o molde do relatório (templates/relatorio_mensal_supervisao.pdf).');
  }
  const templateBytes = await resp.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPage(0);

  // Converter coordenada "topo" para "base" (pdf-lib usa y da base)
  const fromTop = (baselineTop: number) => PAGE_HEIGHT - baselineTop;

  const draw = (text: string, x: number, baselineTop: number, size = 11) => {
    page.drawText(text, {
      x,
      y: fromTop(baselineTop),
      size,
      font: helv,
      color: rgb(0, 0, 0),
    });
  };

  const drawCentered = (text: string, baselineTop: number, size = 11) => {
    const w = helv.widthOfTextAtSize(text, size);
    draw(text, VALOR_X_CENTER - w / 2, baselineTop, size);
  };

  const drawAfterLabel = (label: string, value: string, labelX: number, baselineTop: number) => {
    const w = helv.widthOfTextAtSize(label, 11);
    draw(value, labelX + w + 3, baselineTop, 11);
  };

  const fmtMat = (l: any) => (l.temClasses ? String(l.matriculados) : '');
  const fmtFreq = (l: any) => (l.temClasses && l.freq !== null ? `${fmtPct(l.freq)}%` : '');
  const fmtFaltas = (l: any) => (l.temClasses && l.faltas !== null ? `${fmtPct(l.faltas)}%` : '');

  // Congregação e Referência
  const nomeCongregacao = limparNomeCongregacao(String(congregacao || '').trim()) || '_____________________';
  drawAfterLabel('CONGREGAÇÃO:', nomeCongregacao, 56.7, CONGREGACAO_BASELINE);
  drawAfterLabel('REFERÊNCIA (MÊS):', `${MESES[month - 1]} de ${year}`, 56.7, REFERENCIA_BASELINE);

  // Tabela 1 - MATRICULADOS
  linhas.forEach((l, i) => drawCentered(fmtMat(l), T1_BASELINE[i]));
  draw(String(totalMatriculados), 462, T1_TOTAL_BASELINE);

  // Tabela 2 - MÉDIA PERCENTUAL DE FREQUÊNCIA MENSAL
  linhas.forEach((l, i) => drawCentered(fmtFreq(l), T2_BASELINE[i]));
  draw(`${fmtPct(totalFreq)}%`, 474, T2_TOTAL_BASELINE);

  // Tabela 3 - MÉDIA PERCENTUAL DE FALTAS MENSAIS
  linhas.forEach((l, i) => drawCentered(fmtFaltas(l), T3_BASELINE[i]));
  draw(`${fmtPct(totalFaltas)}%`, 474, T3_TOTAL_BASELINE);

  // Tabela 4 - TOTAL DAS ENTRADAS e TOTAL DE VISITANTES
  drawCentered(fmtMoeda(totalEntradas), ENTRADAS_BASELINE);
  drawCentered(String(totalVisitantes), VISITANTES_BASELINE);

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const nomeArquivo = `Relatorio_Mensal_Supervisao_${MESES[month - 1]}_${year}.pdf`;
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true };
}

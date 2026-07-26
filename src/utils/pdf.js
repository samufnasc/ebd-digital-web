import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  createDailyFrequencyChart,
  createClassFrequencyChart,
  createAttendanceChart,
  createOfferingChart,
  getMonthName
} from './charts';

/**
 * Função principal de geração de PDF
 * @param {Object} consolidatedData - Dados consolidados
 * @param {Object} reportsByClass - Relatórios por classe
 * @param {string} date - Data no formato YYYY-MM-DD
 * @param {string} type - Tipo de relatório: 'general', 'byClass', 'monthly', 'monthlyWithCharts'
 * @param {Object} options - Opções adicionais (mês, classes selecionadas, etc)
 */
export const generatePDF = (consolidatedData, reportsByClass, date, type = 'general', options = {}) => {
  switch (type) {
    case 'byClass':
      generatePDFByClass(reportsByClass, date, options.selectedClasses);
      break;
    case 'monthly':
      generateMonthlyPDF(consolidatedData, reportsByClass, options.month, options.year, options.selectedClasses);
      break;
    case 'monthlyWithCharts':
      generateMonthlyPDFWithCharts(consolidatedData, reportsByClass, options.month, options.year, options.selectedClasses, options.allReports);
      break;
    case 'general':
    default:
      generateGeneralPDF(consolidatedData, reportsByClass, date);
      break;
  }
};

/**
 * Gera Relatório Geral Diário
 */
const generateGeneralPDF = (consolidatedData, reportsByClass, date) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Configurar fonte
  doc.setFont('helvetica');
  
  // Cabeçalho
  doc.setFontSize(18);
  doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Relatório Geral', 105, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Data: ${formatDateToBrazilian(date)}`, 105, 35, { align: 'center' });

  // Preparar dados da tabela
  const tableData = [];
  
  Object.values(reportsByClass).forEach(classData => {
    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    tableData.push([
      classData.className,
      classData.matriculated,
      classData.absent,
      classData.present,
      classData.visitor,
      `${percentage}%`,
      classData.bibles,
      classData.magazines,
      `R$ ${classData.offering.toFixed(2)}`,
    ]);
  });

  // Adicionar linha de totais
  const totalPercentage = consolidatedData.matriculated > 0
    ? Math.round((consolidatedData.present / consolidatedData.matriculated) * 100)
    : 0;

  tableData.push([
    'TOTAL',
    consolidatedData.matriculated,
    consolidatedData.absent,
    consolidatedData.present,
    consolidatedData.visitor,
    `${totalPercentage}%`,
    consolidatedData.bibles,
    consolidatedData.magazines,
    `R$ ${consolidatedData.offering.toFixed(2)}`,
  ]);

  // Criar tabela com autoTable correto
  autoTable(doc, {
    head: [['Classe', 'Mat', 'Aus', 'Pres', 'Vis', '%', 'Bibl', 'Rev', 'Oferta']],
    body: tableData,
    startY: 45,
    theme: 'grid',
    headerStyles: {
      fillColor: [10, 126, 164],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 45, right: 10, bottom: 10, left: 10 },
    didDrawPage: (data) => {
      // Rodapé
      const pageCount = doc.internal.getPages().length;
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      
      doc.setFontSize(9);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageSize.getWidth() / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });

  // Adicionar seção de totais
  const finalY = doc.lastAutoTable?.finalY || 200;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAIS GERAIS', 14, finalY + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Presença Total: ${consolidatedData.present}/${consolidatedData.matriculated} (${totalPercentage}%)`, 14, finalY + 25);
  doc.text(`Oferta Total: R$ ${consolidatedData.offering.toFixed(2)}`, 14, finalY + 32);
  
  // Download
  doc.save(`relatorio-ebd-${date}.pdf`);
};

/**
 * Gera Relatório Mensal Consolidado
 * @param {Object} consolidatedData - Dados consolidados
 * @param {Object} reportsByClass - Todos os relatórios por classe
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @param {Array} selectedClasses - IDs das classes selecionadas (null = todas)
 */
const generateMonthlyPDF = (consolidatedData, reportsByClass, month, year, selectedClasses = null) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Configurar fonte
  doc.setFont('helvetica');
  
  // Cabeçalho
  doc.setFontSize(18);
  doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('Relatório Geral Mensal', 105, 28, { align: 'center' });
  
  const monthName = getMonthName(month);
  doc.setFontSize(11);
  doc.text(`${monthName} de ${year}`, 105, 35, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 105, 41, { align: 'center' });

  // Informações da Igreja
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Igreja Evangélica EBD Digital', 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Relatório Consolidado de Frequência e Ofertas', 14, 56);

  // Preparar dados da tabela
  const tableData = [];
  let totalMatriculados = 0;
  let totalPresentes = 0;
  let totalAusentes = 0;
  let totalVisitantes = 0;
  let totalBiblias = 0;
  let totalRevistas = 0;
  let totalOfertas = 0;

  Object.entries(reportsByClass).forEach(([classId, classData]) => {
    // Filtrar classes selecionadas se aplicável
    if (selectedClasses && !selectedClasses.includes(classId)) {
      return;
    }

    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    totalMatriculados += classData.matriculated;
    totalPresentes += classData.present;
    totalAusentes += classData.absent;
    totalVisitantes += classData.visitor;
    totalBiblias += classData.bibles;
    totalRevistas += classData.magazines;
    totalOfertas += classData.offering;
    
    tableData.push([
      classData.className,
      classData.matriculated,
      classData.absent,
      classData.present,
      classData.visitor,
      `${percentage}%`,
      classData.bibles,
      classData.magazines,
      `R$ ${classData.offering.toFixed(2)}`,
    ]);
  });

  // Adicionar linha de totais
  const totalPercentage = totalMatriculados > 0
    ? Math.round((totalPresentes / totalMatriculados) * 100)
    : 0;

  tableData.push([
    'TOTAL',
    totalMatriculados,
    totalAusentes,
    totalPresentes,
    totalVisitantes,
    `${totalPercentage}%`,
    totalBiblias,
    totalRevistas,
    `R$ ${totalOfertas.toFixed(2)}`,
  ]);

  // Criar tabela
  autoTable(doc, {
    head: [['Classe', 'Mat', 'Aus', 'Pres', 'Vis', '%', 'Bibl', 'Rev', 'Oferta']],
    body: tableData,
    startY: 65,
    theme: 'grid',
    headerStyles: {
      fillColor: [10, 126, 164],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      halign: 'center',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 65, right: 10, bottom: 40, left: 10 },
  });

  // Adicionar seção de resumo
  const finalY = doc.lastAutoTable?.finalY || 200;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DO MÊS', 14, finalY + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const summaryData = [
    `Total de Matriculados: ${totalMatriculados}`,
    `Total de Presentes: ${totalPresentes}`,
    `Total de Ausentes: ${totalAusentes}`,
    `Total de Visitantes: ${totalVisitantes}`,
    `Frequência Média: ${totalPercentage}%`,
    `Total de Bíblias Distribuídas: ${totalBiblias}`,
    `Total de Revistas Distribuídas: ${totalRevistas}`,
    `Total de Ofertas: R$ ${totalOfertas.toFixed(2)}`,
  ];

  let summaryY = finalY + 25;
  summaryData.forEach(item => {
    doc.text(item, 14, summaryY);
    summaryY += 7;
  });

  // Rodapé
  const pageSize = doc.internal.pageSize;
  const pageHeight = pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Relatório gerado automaticamente pelo sistema EBD Digital', 14, pageHeight - 10);

  // Download
  const fileName = `relatorio-mensal-ebd-${month}-${year}.pdf`;
  doc.save(fileName);
};

/**
 * Gera Relatórios por Classe
 */
const generatePDFByClass = (reportsByClass, date, selectedClasses = null) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let isFirstPage = true;

  Object.entries(reportsByClass).forEach(([classId, classData], index) => {
    // Filtrar classes selecionadas se aplicável
    if (selectedClasses && !selectedClasses.includes(classId)) {
      return;
    }

    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    // Cabeçalho
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`Classe: ${classData.className}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Data: ${formatDateToBrazilian(date)}`, 105, 38, { align: 'center' });

    // Dados da classe
    const tableData = [
      ['Matriculados', classData.matriculated],
      ['Presentes', classData.present],
      ['Ausentes', classData.absent],
      ['Visitantes', classData.visitor],
      ['Bíblias', classData.bibles],
      ['Revistas', classData.magazines],
      ['Ofertas', `R$ ${classData.offering.toFixed(2)}`],
    ];

    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    tableData.push(['Frequência (%)', `${percentage}%`]);

    // Criar tabela com autoTable correto
    autoTable(doc, {
      head: [['Campo', 'Valor']],
      body: tableData,
      startY: 48,
      theme: 'grid',
      headerStyles: {
        fillColor: [10, 126, 164],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 48, right: 10, bottom: 10, left: 10 },
    });

    // Rodapé
    doc.setFontSize(9);
    doc.text(
      `Página ${index + 1}`,
      105,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  });

  // Download
  doc.save(`relatorio-ebd-por-classe-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Gera Relatório Mensal com Gráficos
 * @param {Object} consolidatedData - Dados consolidados
 * @param {Object} reportsByClass - Todos os relatórios por classe
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @param {Array} selectedClasses - IDs das classes selecionadas (null = todas)
 * @param {Array} allReports - Todos os relatórios do mês para os gráficos
 */
const generateMonthlyPDFWithCharts = async (consolidatedData, reportsByClass, month, year, selectedClasses = null, allReports = []) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  doc.setFont('helvetica');
  
  // ===== PÁGINA 1: CAPA COM KPIs E SUMÁRIO =====
  doc.setFontSize(18);
  doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('Relatório Mensal Analítico', 105, 28, { align: 'center' });
  
  const monthName = getMonthName(month);
  doc.setFontSize(11);
  doc.text(`${monthName} de ${year}`, 105, 35, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 105, 41, { align: 'center' });

  // Calcular totais para o mês
  let totalMatriculados = 0;
  let totalPresentes = 0;
  let totalAusentes = 0;
  let totalVisitantes = 0;
  let totalBiblias = 0;
  let totalRevistas = 0;
  let totalOfertas = 0;

  Object.entries(reportsByClass).forEach(([classId, classData]) => {
    if (selectedClasses && !selectedClasses.includes(classId)) {
      return;
    }
    totalMatriculados += classData.matriculated;
    totalPresentes += classData.present;
    totalAusentes += classData.absent;
    totalVisitantes += classData.visitor;
    totalBiblias += classData.bibles;
    totalRevistas += classData.magazines;
    totalOfertas += classData.offering;
  });

  const totalPercentage = totalMatriculados > 0
    ? Math.round((totalPresentes / totalMatriculados) * 100)
    : 0;

  // Informações da Igreja
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Igreja Evangélica EBD Digital', 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Relatório Consolidado de Frequência, Assistência e Ofertas', 14, 56);

  // Seção de KPIs
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INDICADORES PRINCIPAIS DO MÊS', 14, 65);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const kpiBoxWidth = 40;
  const kpiBoxHeight = 18;
  const startX = 14;
  let currentY = 72;
  
  const kpis = [
    { label: 'Frequência Média', value: `${totalPercentage}%`, color: [52, 211, 153] }, // verde
    { label: 'Total Presentes', value: totalPresentes, color: [34, 197, 94] },
    { label: 'Total Ausentes', value: totalAusentes, color: [239, 68, 68] },
    { label: 'Total Visitantes', value: totalVisitantes, color: [59, 130, 246] },
    { label: 'Total Ofertas', value: `R$ ${totalOfertas.toFixed(2)}`, color: [251, 146, 60] },
  ];

  let kpiX = startX;
  kpis.forEach((kpi, index) => {
    if (index > 0 && index % 2 === 0) {
      currentY += kpiBoxHeight + 5;
      kpiX = startX;
    }

    // Fundo colorido
    doc.setFillColor(...kpi.color);
    doc.rect(kpiX, currentY, kpiBoxWidth, kpiBoxHeight, 'F');

    // Texto
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(kpi.label, kpiX + 2, currentY + 4, { maxWidth: kpiBoxWidth - 4 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(kpi.value), kpiX + 2, currentY + 12);

    kpiX += kpiBoxWidth + 5;
  });

  currentY += kpiBoxHeight + 10;

  // Preparar dados da tabela
  const tableData = [];

  Object.entries(reportsByClass).forEach(([classId, classData]) => {
    if (selectedClasses && !selectedClasses.includes(classId)) {
      return;
    }

    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    tableData.push([
      classData.className,
      classData.matriculated,
      classData.absent,
      classData.present,
      classData.visitor,
      `${percentage}%`,
      classData.bibles,
      classData.magazines,
      `R$ ${classData.offering.toFixed(2)}`,
    ]);
  });

  tableData.push([
    'TOTAL',
    totalMatriculados,
    totalAusentes,
    totalPresentes,
    totalVisitantes,
    `${totalPercentage}%`,
    totalBiblias,
    totalRevistas,
    `R$ ${totalOfertas.toFixed(2)}`,
  ]);

  // Tabela de dados
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Classe', 'Mat', 'Aus', 'Pres', 'Vis', '%', 'Bibl', 'Rev', 'Oferta']],
    body: tableData,
    startY: currentY,
    theme: 'grid',
    headerStyles: {
      fillColor: [10, 126, 164],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      halign: 'center',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: currentY, right: 10, bottom: 40, left: 10 },
    didDrawPage: () => {
      // Rodapé
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);
      doc.text('Página 1 de 5 - Relatório gerado automaticamente pelo sistema EBD Digital', 105, pageHeight - 8, { align: 'center' });
    }
  });

  // ===== PÁGINA 2: GRÁFICO DE FREQUÊNCIA DIÁRIA =====
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ANÁLISE DE FREQUÊNCIA DIÁRIA', 14, 15);

  try {
    if (allReports && allReports.length > 0) {
      const frequencyChartImg = await createDailyFrequencyChart(allReports);
      doc.addImage(frequencyChartImg, 'PNG', 10, 25, 190, 100);
    }
  } catch (error) {
    console.error('Erro ao gerar gráfico de frequência diária:', error);
    doc.setFontSize(10);
    doc.text('Erro ao gerar gráfico de frequência diária', 14, 100);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Este gráfico mostra a evolução da frequência ao longo dos dias do mês', 14, 135);

  // Rodapé
  const pageSize = doc.internal.pageSize;
  const pageHeight = pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Página 2 de 5 - Relatório gerado automaticamente pelo sistema EBD Digital', 105, pageHeight - 8, { align: 'center' });

  // ===== PÁGINA 3: GRÁFICO DE FREQUÊNCIA POR CLASSE =====
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('FREQUÊNCIA POR CLASSE', 14, 15);

  try {
    const classFrequencyChartImg = await createClassFrequencyChart(reportsByClass);
    doc.addImage(classFrequencyChartImg, 'PNG', 10, 25, 190, 110);
  } catch (error) {
    console.error('Erro ao gerar gráfico de frequência por classe:', error);
    doc.setFontSize(10);
    doc.text('Erro ao gerar gráfico de frequência por classe', 14, 100);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Comparação de frequência entre as classes da EBD', 14, 145);

  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Página 3 de 5 - Relatório gerado automaticamente pelo sistema EBD Digital', 105, pageHeight - 8, { align: 'center' });

  // ===== PÁGINA 4: GRÁFICO DE PRESENÇA vs AUSÊNCIA + OFERTAS =====
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ANÁLISE DE PRESENÇA E OFERTAS', 14, 15);

  try {
    const attendanceChartImg = await createAttendanceChart(consolidatedData);
    const offeringChartImg = await createOfferingChart(reportsByClass);
    
    doc.addImage(attendanceChartImg, 'PNG', 10, 25, 90, 90);
    doc.addImage(offeringChartImg, 'PNG', 105, 25, 90, 90);
  } catch (error) {
    console.error('Erro ao gerar gráficos de presença e ofertas:', error);
    doc.setFontSize(10);
    doc.text('Erro ao gerar gráficos de presença e ofertas', 14, 100);
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Legenda:', 14, 125);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Esquerda: Proporção de presentes vs ausentes no mês', 14, 131);
  doc.text('Direita: Total de ofertas coletadas por classe', 14, 137);

  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Página 4 de 5 - Relatório gerado automaticamente pelo sistema EBD Digital', 105, pageHeight - 8, { align: 'center' });

  // ===== PÁGINA 5: RESUMO E CONCLUSÕES =====
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RESUMO EXECUTIVO', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const summaryItems = [
    `Total de Matriculados: ${totalMatriculados}`,
    `Total de Presentes: ${totalPresentes} (${totalPercentage}%)`,
    `Total de Ausentes: ${totalAusentes} (${100 - totalPercentage}%)`,
    `Total de Visitantes: ${totalVisitantes}`,
    `Total de Bíblias Distribuídas: ${totalBiblias}`,
    `Total de Revistas Distribuídas: ${totalRevistas}`,
    `Total de Ofertas: R$ ${totalOfertas.toFixed(2)}`,
    `Classe com Melhor Frequência: ${getMostFrequentClass(reportsByClass, selectedClasses)}`,
    `Classe com Menor Frequência: ${getLeastFrequentClass(reportsByClass, selectedClasses)}`,
  ];

  let summaryY = 25;
  summaryItems.forEach(item => {
    doc.text(`• ${item}`, 20, summaryY);
    summaryY += 8;
  });

  // Análise e Conclusões
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ANÁLISE E RECOMENDAÇÕES', 14, summaryY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const recommendations = getRecommendations(totalPercentage, totalPresentes, totalMatriculados);
  let recY = summaryY + 20;
  
  recommendations.forEach(rec => {
    const wrappedText = doc.splitTextToSize(rec, 175);
    doc.text(wrappedText, 20, recY);
    recY += wrappedText.length * 5 + 5;
  });

  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Página 5 de 5 - Relatório gerado automaticamente pelo sistema EBD Digital', 105, pageHeight - 8, { align: 'center' });

  // Download
  const fileName = `relatorio-analitco-ebd-${month}-${year}.pdf`;
  doc.save(fileName);
};

/**
 * Função auxiliar para formatar data YYYY-MM-DD para DD/MM/YYYY
 */
const formatDateToBrazilian = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Obtém a classe com melhor frequência
 */
const getMostFrequentClass = (reportsByClass, selectedClasses = null) => {
  let bestClass = '';
  let bestFrequency = -1;

  Object.entries(reportsByClass).forEach(([classId, classData]) => {
    if (selectedClasses && !selectedClasses.includes(classId)) {
      return;
    }

    const frequency = classData.matriculated > 0
      ? (classData.present / classData.matriculated) * 100
      : 0;

    if (frequency > bestFrequency) {
      bestFrequency = frequency;
      bestClass = classData.className;
    }
  });

  return bestClass || 'N/A';
};

/**
 * Obtém a classe com menor frequência
 */
const getLeastFrequentClass = (reportsByClass, selectedClasses = null) => {
  let worstClass = '';
  let worstFrequency = 101;

  Object.entries(reportsByClass).forEach(([classId, classData]) => {
    if (selectedClasses && !selectedClasses.includes(classId)) {
      return;
    }

    const frequency = classData.matriculated > 0
      ? (classData.present / classData.matriculated) * 100
      : 0;

    if (frequency < worstFrequency) {
      worstFrequency = frequency;
      worstClass = classData.className;
    }
  });

  return worstClass || 'N/A';
};

/**
 * Gera recomendações baseadas nos dados
 */
const getRecommendations = (frequency, presentes, matriculados) => {
  const recommendations = [];

  if (frequency >= 90) {
    recommendations.push('✓ Excelente frequência! A EBD está com ótimo desempenho de frequência. Continue mantendo a qualidade do trabalho.');
  } else if (frequency >= 80) {
    recommendations.push('✓ Boa frequência! A EBD está funcionando bem, mas há espaço para melhorias.');
  } else if (frequency >= 70) {
    recommendations.push('⚠ Frequência aceitável, mas abaixo do ideal. Recomenda-se aumentar os esforços para melhoria.');
  } else {
    recommendations.push('⚠ Frequência baixa. Recomenda-se revisão das estratégias de engajamento dos alunos e professores.');
  }

  if (presentes < matriculados * 0.5) {
    recommendations.push('⚠ Menos de 50% dos matriculados compareceram. Investigar as razões das ausências.');
  }

  recommendations.push('→ Revisar o engajamento de classes com menor frequência e implementar estratégias motivacionais.');
  recommendations.push('→ Mantém comunicação regular com os coordenadores de classe para acompanhamento contínuo.');

  return recommendations;
};

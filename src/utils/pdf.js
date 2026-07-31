import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Função principal de geração de PDF
 * @param {Object} consolidatedData - Dados consolidados
 * @param {Object} reportsByClass - Relatórios por classe
 * @param {string} date - Data no formato YYYY-MM-DD
 * @param {string} type - Tipo de relatório: 'general', 'byClass', 'monthly'
 * @param {Object} options - Opções adicionais (mês, classes selecionadas, etc)
 */
export const generatePDF = (consolidatedData, reportsByClass, date, type = 'general', options = {}) => {
  switch (type) {
    case 'byClass':
      generatePDFByClass(reportsByClass, date, options.selectedClasses, options);
      break;
    case 'monthly':
      generateMonthlyPDF(consolidatedData, reportsByClass, options.month, options.year, options.selectedClasses, options);
      break;
    case 'general':
    default:
      generateGeneralPDF(consolidatedData, reportsByClass, date, options);
      break;
  }
};

/**
 * Gera Relatório Geral Diário
 */
const generateGeneralPDF = (consolidatedData, reportsByClass, date, options = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Configurar fonte
  doc.setFont('helvetica');
  const congregacao = options.congregacao || localStorage.getItem('ebd_congregacao_nome') || 'Congregação Mensageiros da Fé';
  
  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(congregacao.toUpperCase(), 105, 18, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Relatório Geral - EBD Digital', 105, 26, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${formatDateToBrazilian(date)}`, 105, 33, { align: 'center' });

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
      const pageCount = doc.getNumberOfPages();
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
const generateMonthlyPDF = (consolidatedData, reportsByClass, month, year, selectedClasses = null, options = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Configurar fonte
  doc.setFont('helvetica');
  const congregacao = options.congregacao || localStorage.getItem('ebd_congregacao_nome') || 'Congregação Mensageiros da Fé';
  
  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(congregacao.toUpperCase(), 105, 18, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Relatório Geral Mensal - EBD Digital', 105, 26, { align: 'center' });
  
  const monthName = getMonthName(month || new Date().getMonth() + 1);
  const yearVal = year || new Date().getFullYear();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${monthName} de ${yearVal}`, 105, 33, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 105, 39, { align: 'center' });

  // Informações da Igreja
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(congregacao, 14, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Relatório Consolidado de Frequência e Ofertas', 14, 54);

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
const generatePDFByClass = (reportsByClass, date, selectedClasses = null, options = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let isFirstPage = true;
  const congregacao = options.congregacao || localStorage.getItem('ebd_congregacao_nome') || 'Congregação Mensageiros da Fé';

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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(congregacao.toUpperCase(), 105, 18, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Classe: ${classData.className}`, 105, 26, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${formatDateToBrazilian(date)}`, 105, 33, { align: 'center' });

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
 * Função auxiliar para formatar data YYYY-MM-DD para DD/MM/YYYY
 */
const formatDateToBrazilian = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Função auxiliar para obter nome do mês
 */
const getMonthName = (month) => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || 'Mês Inválido';
};

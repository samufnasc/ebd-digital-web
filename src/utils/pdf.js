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
      generatePDFByClass(reportsByClass, date, options.selectedClasses);
      break;
    case 'monthly':
      generateMonthlyPDF(consolidatedData, reportsByClass, options.month, options.year, options.selectedClasses);
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
  
  doc.setFontSize(14);
  doc.text('Relatório Geral da EBD', 105, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Data: ${formatDateToBrazilian(date)}`, 105, 34, { align: 'center' });

  // Tabela 1: Resumo Consolidado
  const summaryData = [
    ['Matriculados', consolidatedData.matriculated || 0],
    ['Presentes', consolidatedData.present || 0],
    ['Ausentes', consolidatedData.absent || 0],
    ['Visitantes', consolidatedData.visitors || 0],
    ['Bíblias', consolidatedData.bibles || 0],
    ['Revistas', consolidatedData.magazines || 0],
    ['Ofertas (R$)', (consolidatedData.offers || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
    ['Frequência (%)', `${consolidatedData.frequencyPercentage || 0}%`],
  ];

  autoTable(doc, {
    head: [['Indicador', 'Total']],
    body: summaryData,
    startY: 42,
    theme: 'grid',
    headStyles: {
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
    margin: { top: 42, right: 10, bottom: 10, left: 10 },
  });

  // Tabela 2: Detalhamento por Classe
  const classRows = Object.entries(reportsByClass || {}).map(([className, report]) => {
    const percentage = report.matriculated > 0 
      ? Math.round((report.present / report.matriculated) * 100) 
      : 0;
    
    return [
      className,
      report.matriculated || 0,
      report.present || 0,
      report.absent || 0,
      report.visitors || 0,
      report.bibles || 0,
      report.magazines || 0,
      `R$ ${(report.offers || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${percentage}%`
    ];
  });

  if (classRows.length > 0) {
    const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 100;
    
    doc.setFontSize(12);
    doc.text('Detalhamento por Classe', 10, lastY + 12);

    autoTable(doc, {
      head: [['Classe', 'Matr.', 'Pres.', 'Aus.', 'Vis.', 'Bíb.', 'Rev.', 'Oferta', 'Freq.']],
      body: classRows,
      startY: lastY + 16,
      theme: 'striped',
      headStyles: {
        fillColor: [10, 126, 164],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
      },
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      didDrawPage: (data) => {
        // ✅ CORREÇÃO PONTUAL AQUI (Linha 106 original):
        // doc.internal.getPages foi substituído por doc.getNumberOfPages()
        const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          105,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }
    });
  }

  // Download
  doc.save(`relatorio-ebd-geral-${date}.pdf`);
};

/**
 * Gera Relatório Mensal
 */
const generateMonthlyPDF = (consolidatedData, reportsByClass, month, year, selectedClasses = []) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  doc.setFont('helvetica');
  doc.setFontSize(18);
  doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text(`Relatório Mensal - ${month}/${year}`, 105, 28, { align: 'center' });

  const summaryData = [
    ['Média de Matriculados', consolidatedData.matriculated || 0],
    ['Média de Presentes', consolidatedData.present || 0],
    ['Média de Ausentes', consolidatedData.absent || 0],
    ['Total de Visitantes', consolidatedData.visitors || 0],
    ['Total de Bíblias', consolidatedData.bibles || 0],
    ['Total de Revistas', consolidatedData.magazines || 0],
    ['Total de Ofertas (R$)', (consolidatedData.offers || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
    ['Frequência Média (%)', `${consolidatedData.frequencyPercentage || 0}%`],
  ];

  autoTable(doc, {
    head: [['Indicador Mensal', 'Valor']],
    body: summaryData,
    startY: 38,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 126, 164],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    margin: { top: 38, right: 10, bottom: 10, left: 10 },
    didDrawPage: (data) => {
      // ✅ CORREÇÃO PONTUAL AQUI
      const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${data.pageNumber} de ${totalPages}`,
        105,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }
  });

  // Detalhamento por classe no mês
  const classRows = Object.entries(reportsByClass || {})
    .filter(([className]) => selectedClasses.length === 0 || selectedClasses.includes(className))
    .map(([className, report]) => {
      const percentage = report.matriculated > 0 
        ? Math.round((report.present / report.matriculated) * 100) 
        : 0;
      
      return [
        className,
        report.matriculated || 0,
        report.present || 0,
        report.absent || 0,
        report.visitors || 0,
        report.bibles || 0,
        report.magazines || 0,
        `R$ ${(report.offers || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `${percentage}%`
      ];
    });

  if (classRows.length > 0) {
    const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 100;
    
    doc.setFontSize(12);
    doc.text('Médias por Classe no Mês', 10, lastY + 12);

    autoTable(doc, {
      head: [['Classe', 'Matr.', 'Pres.', 'Aus.', 'Vis.', 'Bíb.', 'Rev.', 'Oferta', 'Freq.']],
      body: classRows,
      startY: lastY + 16,
      theme: 'striped',
      headStyles: {
        fillColor: [10, 126, 164],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
      },
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
    });
  }

  doc.save(`relatorio-ebd-mensal-${month}-${year}.pdf`);
};

/**
 * Gera Relatórios Individuais Por Classe
 */
const generatePDFByClass = (reportsByClass, date, selectedClasses = []) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const classesToProcess = selectedClasses.length > 0 
    ? Object.entries(reportsByClass || {}).filter(([name]) => selectedClasses.includes(name))
    : Object.entries(reportsByClass || {});

  classesToProcess.forEach(([className, classData], index) => {
    if (index > 0) {
      doc.addPage();
    }

    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`Relatório da Classe: ${className}`, 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Data: ${formatDateToBrazilian(date)}`, 105, 34, { align: 'center' });

    const tableData = [
      ['Matriculados', classData.matriculated || 0],
      ['Presentes', classData.present || 0],
      ['Ausentes', classData.absent || 0],
      ['Visitantes', classData.visitors || 0],
      ['Bíblias', classData.bibles || 0],
      ['Revistas', classData.magazines || 0],
      ['Ofertas (R$)', (classData.offers || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
    ];

    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    tableData.push(['Frequência (%)', `${percentage}%`]);

    autoTable(doc, {
      head: [['Campo', 'Valor']],
      body: tableData,
      startY: 42,
      theme: 'grid',
      headStyles: {
        fillColor: [10, 126, 164],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      margin: { top: 42, right: 10, bottom: 10, left: 10 },
      didDrawPage: (data) => {
        // ✅ CORREÇÃO PONTUAL AQUI
        const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          105,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }
    });
  });

  doc.save(`relatorio-ebd-por-classe-${date}.pdf`);
};

/**
 * Função auxiliar para formatar data YYYY-MM-DD para DD/MM/YYYY
 */
const formatDateToBrazilian = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};
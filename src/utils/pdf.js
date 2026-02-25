import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generatePDF = (consolidatedData, reportsByClass, date, type = 'general') => {
  if (type === 'byClass') {
    generatePDFByClass(reportsByClass, date);
  } else {
    generateGeneralPDF(consolidatedData, reportsByClass, date);
  }
};

const generateGeneralPDF = (consolidatedData, reportsByClass, date) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Configurar fonte
  doc.setFont('helvetica');
  
  // Cabecalho
  doc.setFontSize(18);
  doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Relatorio Geral', 105, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Data: ${date}`, 105, 35, { align: 'center' });

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

  // Criar tabela
  doc.autoTable({
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
      // Rodape
      const pageCount = doc.internal.getPages().length;
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      
      doc.setFontSize(9);
      doc.text(
        `Pagina ${data.pageNumber} de ${pageCount}`,
        pageSize.getWidth() / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });

  // Adicionar secao de totais
  const finalY = doc.lastAutoTable?.finalY || 200;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAIS GERAIS', 14, finalY + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Presenca Total: ${consolidatedData.present}/${consolidatedData.matriculated} (${totalPercentage}%)`, 14, finalY + 25);
  doc.text(`Oferta Total: R$ ${consolidatedData.offering.toFixed(2)}`, 14, finalY + 32);
  
  // Download
  doc.save(`relatorio-ebd-${date}.pdf`);
};

const generatePDFByClass = (reportsByClass, date) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let isFirstPage = true;

  Object.values(reportsByClass).forEach((classData, index) => {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    // Cabecalho
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`Classe: ${classData.className}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Data: ${date}`, 105, 38, { align: 'center' });

    // Dados da classe
    const tableData = [
      ['Matriculados', classData.matriculated],
      ['Presentes', classData.present],
      ['Ausentes', classData.absent],
      ['Visitantes', classData.visitor],
      ['Biblias', classData.bibles],
      ['Revistas', classData.magazines],
      ['Ofertas', `R$ ${classData.offering.toFixed(2)}`],
    ];

    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    tableData.push(['Frequencia (%)', `${percentage}%`]);

    // Criar tabela
    doc.autoTable({
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

    // Rodape
    doc.setFontSize(9);
    doc.text(
      `Pagina ${index + 1}`,
      105,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  });

  // Download
  doc.save(`relatorio-ebd-por-classe-${date}.pdf`);
};

import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generatePDF = (consolidatedData, reportsByClass, date) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Configurar fonte
  doc.setFont('helvetica');
  
  // Cabeçalho
  doc.setFontSize(18);
  doc.text('EBD DIGITAL', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Relatório Geral', 105, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Data: ${new Date(date).toLocaleDateString('pt-BR')}`, 105, 35, { align: 'center' });
  
  // Tabela de dados
  const tableData = Object.values(reportsByClass).map(classData => {
    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    return [
      classData.className,
      classData.matriculated,
      classData.absent,
      classData.present,
      classData.visitor,
      `${percentage}%`,
      classData.bibles,
      classData.magazines,
      `R$ ${classData.offering.toFixed(2)}`,
    ];
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
    head: [['Classe', 'Mat', 'Aus', 'Pres', 'Vis', '%', 'Bíbl', 'Rev', 'Oferta']],
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

  // Download
  doc.save(`relatorio-ebd-${date}.pdf`);
};

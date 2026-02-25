import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // Importação direta do plugin

export const generatePDF = (consolidatedData, reportsByClass, date, type = 'general') => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('EBD DIGITAL - RELATÓRIO', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Data: ${date}`, 105, 30, { align: 'center' });

  const tableData = [];
  
  Object.values(reportsByClass).forEach(classData => {
    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    
    tableData.push([
      classData.className,
      classData.matriculated || 0,
      classData.present || 0,
      `${percentage}%`,
      `R$ ${Number(classData.offering || 0).toFixed(2)}`
    ]);
  });

  // A MUDANÇA ESTÁ AQUI: Usamos a função 'autoTable' diretamente no 'doc'
  autoTable(doc, {
    startY: 40,
    head: [['Classe', 'Matric.', 'Pres.', 'Freq.', 'Oferta']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [10, 126, 164] },
    styles: { halign: 'center' }
  });

  doc.save(`relatorio_${date}.pdf`);
};
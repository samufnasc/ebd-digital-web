import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = (data, totals, reportDate) => {
  const doc = new jsPDF();

  // Cabeçalho do Relatório
  doc.setFontSize(18);
  doc.text('Relatório Geral - Escola Bíblica Dominical', 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Data: ${reportDate}`, 14, 30);

  // Mapeamento dos dados para a tabela
  // Seguindo a ordem: Classe, Mat, Aus, Pres, Vis, %, Bíbl, Rev, Oferta
  const tableRows = data.map(item => [
    item.classe,
    item.matriculados || 0,
    item.ausentes || 0,
    item.presentes || 0,
    item.visitantes || 0,
    `${item.porcentagem || 0}%`,
    item.biblias || 0,
    item.revistas || 0,
    `R$ ${item.ofertas?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`
  ]);

  // Linha de Totais no rodapé da tabela
  const footerRow = [
    'TOTAL',
    totals.matriculados,
    totals.ausentes,
    totals.presentes,
    totals.visitantes,
    `${totals.porcentagem}%`,
    totals.biblias,
    totals.revistas,
    `R$ ${totals.ofertas?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`
  ];

  // Geração da Tabela usando o plugin autoTable de forma explícita
  autoTable(doc, {
    startY: 40,
    head: [['Classe', 'Mat', 'Aus', 'Pres', 'Vis', '%', 'Bíbl', 'Rev', 'Oferta']],
    body: tableRows,
    foot: [footerRow],
    theme: 'grid',
    headStyles: { fillColor: [0, 123, 167] }, // Cor azul similar ao seu app
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
  });

  // Resumo Final abaixo da tabela (Como no relatório físico)
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(`Presença Total: ${totals.presentes}`, 14, finalY);
  doc.text(`Oferta Total: R$ ${totals.ofertas?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, finalY);

  // Salva o arquivo
  doc.save(`Relatorio_EBD_${reportDate.replace(/\//g, '-')}.pdf`);
};
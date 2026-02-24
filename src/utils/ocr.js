/**
 * Simula processamento OCR da imagem
 * Em produção, usar Tesseract.js ou API de visão computacional
 */

export const processOCR = async (imageData) => {
  // Simular processamento OCR
  return new Promise((resolve) => {
    setTimeout(() => {
      // Dados simulados com 5 colunas (domingos)
      const mockColumns = [
        { col: 1, matriculated: 12, absent: 2, present: 10, visitor: 0, bibles: 9, magazines: 8, offering: 15.50 },
        { col: 2, matriculated: 12, absent: 1, present: 11, visitor: 1, bibles: 11, magazines: 10, offering: 18.00 },
        { col: 3, matriculated: 12, absent: 3, present: 9, visitor: 0, bibles: 8, magazines: 7, offering: 12.00 },
        { col: 4, matriculated: 0, absent: 0, present: 0, visitor: 0, bibles: 0, magazines: 0, offering: 0 },
        { col: 5, matriculated: 0, absent: 0, present: 0, visitor: 0, bibles: 0, magazines: 0, offering: 0 },
      ];

      // Encontrar última coluna preenchida
      let lastFilledColumn = null;
      for (let i = mockColumns.length - 1; i >= 0; i--) {
        if (mockColumns[i].matriculated > 0) {
          lastFilledColumn = mockColumns[i];
          break;
        }
      }

      resolve({
        success: true,
        columns: mockColumns,
        lastFilledColumn: lastFilledColumn || mockColumns[0],
        data: lastFilledColumn || mockColumns[0],
      });
    }, 2000);
  });
};

/**
 * Calcula percentual de presença
 */
export const calculatePercentage = (present, matriculated) => {
  if (matriculated === 0) return 0;
  return Math.round((present / matriculated) * 100);
};

/**
 * Formata valor monetário
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

import Tesseract from 'tesseract.js';

/**
 * Realiza OCR em uma imagem recortada (do Cropper.js)
 * Extrai números de Presentes, Visitantes, Bíblias, Revistas e Ofertas
 * @param {string} croppedImageData - Data URL da imagem recortada
 * @returns {Promise} Resultado com campos extraídos
 */
export const performOCR = async (croppedImageData) => {
  try {
    // Pré-processar imagem (aumentar contraste)
    const processedImage = await preprocessImage(croppedImageData);

    // Executar OCR com Tesseract.js
    const { data: { text } } = await Tesseract.recognize(
      processedImage,
      'por', // Português
      {
        logger: (m) => console.log('OCR Progress:', m),
      }
    );

    console.log('Texto OCR extraído:', text);

    // Extrair números usando regex
    const result = extractNumbers(text);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('Erro no OCR:', error);
    return {
      success: false,
      error: error.message,
      // Retornar dados simulados como fallback
      present: 0,
      visitor: 0,
      bibles: 0,
      magazines: 0,
      offering: 0,
    };
  }
};

/**
 * Pré-processa a imagem para melhorar a leitura OCR
 * Aumenta contraste e converte para escala de cinza
 * @param {string} imageData - Data URL da imagem
 * @returns {Promise} Canvas com imagem processada
 */
const preprocessImage = async (imageData) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Desenhar imagem original
      ctx.drawImage(img, 0, 0);

      // Obter dados de pixel
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Aumentar contraste e converter para escala de cinza
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Converter para escala de cinza (luminância)
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        // Aumentar contraste (limiarização)
        const threshold = 128;
        const value = gray > threshold ? 255 : 0;

        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        // data[i + 3] = 255; // A (deixar opaco)
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageData;
  });
};

/**
 * Extrai números do texto OCR usando regex
 * Procura por padrões como "Pres: 10", "Oferta: 15.50", etc.
 * @param {string} text - Texto extraído pelo OCR
 * @returns {object} Objeto com campos extraídos
 */
const extractNumbers = (text) => {
  const result = {
    present: 0,
    visitor: 0,
    bibles: 0,
    magazines: 0,
    offering: 0,
  };

  // Converter texto para minúsculas para facilitar busca
  const lowerText = text.toLowerCase();

  // Regex patterns para diferentes campos
  const patterns = {
    present: [
      /pres[entes]*[:\s]+(\d+)/i,
      /presentes[:\s]+(\d+)/i,
      /p[:\s]+(\d+)/i,
    ],
    visitor: [
      /vis[itantes]*[:\s]+(\d+)/i,
      /visitantes[:\s]+(\d+)/i,
      /v[:\s]+(\d+)/i,
    ],
    bibles: [
      /bíbl[ias]*[:\s]+(\d+)/i,
      /biblias[:\s]+(\d+)/i,
      /b[:\s]+(\d+)/i,
    ],
    magazines: [
      /rev[istas]*[:\s]+(\d+)/i,
      /revistas[:\s]+(\d+)/i,
      /r[:\s]+(\d+)/i,
    ],
    offering: [
      /oferta[s]*[:\s]+([0-9]+[.,][0-9]+|[0-9]+)/i,
      /ofertas[:\s]+([0-9]+[.,][0-9]+|[0-9]+)/i,
      /o[:\s]+([0-9]+[.,][0-9]+|[0-9]+)/i,
    ],
  };

  // Tentar extrair cada campo
  Object.keys(patterns).forEach(field => {
    for (const pattern of patterns[field]) {
      const match = text.match(pattern);
      if (match && match[1]) {
        if (field === 'offering') {
          // Converter para número decimal
          const value = match[1].replace(',', '.');
          result[field] = parseFloat(value) || 0;
        } else {
          result[field] = parseInt(match[1]) || 0;
        }
        break; // Usar primeira correspondência encontrada
      }
    }
  });

  console.log('Números extraídos:', result);
  return result;
};

/**
 * Função auxiliar para formatar moeda
 * @param {number} value - Valor em reais
 * @returns {string} Valor formatado
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
};

/**
 * Simula leitura de OCR com dados aleatórios (fallback)
 * Útil para testes quando OCR falha
 * @returns {object} Dados simulados
 */
export const simulateOCRData = () => {
  return {
    present: Math.floor(Math.random() * 30) + 5,
    visitor: Math.floor(Math.random() * 5),
    bibles: Math.floor(Math.random() * 20) + 5,
    magazines: Math.floor(Math.random() * 20) + 5,
    offering: parseFloat((Math.random() * 100 + 10).toFixed(2)),
  };
};

import Chart from 'chart.js/auto';
import html2canvas from 'html2canvas';

/**
 * Cria um gráfico em Canvas temporário e retorna como imagem base64
 * @param {string} type - Tipo de gráfico: 'line', 'bar', 'pie', 'doughnut'
 * @param {Object} config - Configuração do Chart.js
 * @returns {Promise<string>} Data URL da imagem PNG
 */
async function createChart(type, config) {
  return new Promise((resolve, reject) => {
    try {
      // Criar container temporário
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.style.height = '400px';
      container.style.backgroundColor = '#fff';
      document.body.appendChild(container);

      // Criar canvas
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      // Criar chart
      const ctx = canvas.getContext('2d');
      const chart = new Chart(ctx, {
        type,
        data: config.data,
        options: {
          ...config.options,
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            ...config.options?.plugins,
            legend: {
              display: true,
              position: 'bottom',
              ...config.options?.plugins?.legend
            }
          }
        }
      });

      // Aguardar renderização e converter para imagem
      chart.resize(800, 400);
      
      setTimeout(() => {
        try {
          const imgData = canvas.toDataURL('image/png');
          chart.destroy();
          document.body.removeChild(container);
          resolve(imgData);
        } catch (error) {
          chart.destroy();
          document.body.removeChild(container);
          reject(error);
        }
      }, 1000);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Gera gráfico de linha - Frequência diária ao longo do mês
 */
export async function createDailyFrequencyChart(reports) {
  const dailyData = {};

  // Agrupar por data
  reports.forEach(report => {
    if (!dailyData[report.date]) {
      dailyData[report.date] = { total: 0, matriculated: 0 };
    }
    dailyData[report.date].total += Number(report.present) || 0;
    dailyData[report.date].matriculated += Number(report.matriculated) || 0;
  });

  // Converter para arrays ordenados
  const dates = Object.keys(dailyData).sort();
  const frequencies = dates.map(date => {
    const data = dailyData[date];
    return data.matriculated > 0 
      ? Math.round((data.total / data.matriculated) * 100) 
      : 0;
  });

  const config = {
    data: {
      labels: dates.map(d => formatDateToBrazilian(d)),
      datasets: [{
        label: 'Frequência Diária (%)',
        data: frequencies,
        borderColor: '#0A7EA4',
        backgroundColor: 'rgba(10, 126, 164, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#0A7EA4',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Frequência Diária ao Longo do Mês'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  };

  return createChart('line', config);
}

/**
 * Gera gráfico de barras - Frequência por classe
 */
export async function createClassFrequencyChart(reportsByClass) {
  const classNames = [];
  const frequencies = [];

  Object.values(reportsByClass).forEach(classData => {
    classNames.push(classData.className);
    const percentage = classData.matriculated > 0
      ? Math.round((classData.present / classData.matriculated) * 100)
      : 0;
    frequencies.push(percentage);
  });

  const config = {
    data: {
      labels: classNames,
      datasets: [{
        label: 'Frequência (%)',
        data: frequencies,
        backgroundColor: [
          '#0A7EA4',
          '#F5A623',
          '#52C41A',
          '#FF6B6B',
          '#722ED1',
          '#13C2C2'
        ],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Frequência por Classe'
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  };

  return createChart('bar', config);
}

/**
 * Gera gráfico de pizza - Presença vs Ausência
 */
export async function createAttendanceChart(consolidatedData) {
  const present = consolidatedData.present || 0;
  const absent = consolidatedData.absent || 0;

  const config = {
    data: {
      labels: ['Presentes', 'Ausentes'],
      datasets: [{
        data: [present, absent],
        backgroundColor: ['#52C41A', '#FF6B6B'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Presença vs Ausência no Mês'
        }
      }
    }
  };

  return createChart('doughnut', config);
}

/**
 * Gera gráfico de barras - Ofertas por classe
 */
export async function createOfferingChart(reportsByClass) {
  const classNames = [];
  const offerings = [];

  Object.values(reportsByClass).forEach(classData => {
    classNames.push(classData.className);
    offerings.push(Number(classData.offering) || 0);
  });

  const config = {
    data: {
      labels: classNames,
      datasets: [{
        label: 'Ofertas (R$)',
        data: offerings,
        backgroundColor: '#F5A623',
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Ofertas por Classe'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'R$ ' + value.toFixed(2);
            }
          }
        }
      }
    }
  };

  return createChart('bar', config);
}

/**
 * Função auxiliar para formatar data
 */
export const formatDateToBrazilian = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Função auxiliar para obter nome do mês
 */
export const getMonthName = (month) => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || 'Mês Inválido';
};

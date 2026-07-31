/**
 * Gerador de Gráficos em Canvas para Relatório em PDF (EBD Digital)
 * Retorna PNG Data URLs em alta resolução para inclusão direta no jsPDF.
 */

// Cores para as classes
const CLASS_COLORS = [
  '#0284C7', // Sky Blue
  '#F59E0B', // Amber
  '#22C55E', // Green
  '#F43F5E', // Rose/Coral
  '#14B8A6', // Teal
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6366F1'  // Indigo
];

const formatVal = (v) => {
  if (v === undefined || v === null) return '0';
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
};

/**
 * 1. Gráfico de Linha: Frequência Diária ao Longo do Período (%)
 * Suporta múltiplas séries (uma linha por classe + média geral)
 */
export function generateDailyFrequencyChartCanvas(diasData, classSeries = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // Fundo Branco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título do Gráfico
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.fillText('Frequência Diária por Classe ao Longo do Período (%)', canvas.width / 2, 45);

  const paddingLeft = 90;
  const paddingRight = 80;
  const paddingTop = 85;
  const paddingBottom = 170;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  // Grade do Eixo Y (0% a 100%)
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 10; i++) {
    const pct = i * 10;
    const y = paddingTop + chartHeight - (i / 10) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartWidth, y);
    ctx.stroke();

    ctx.fillText(`${pct}%`, paddingLeft - 15, y + 6);
  }

  // Eixo X e Y principal
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, paddingTop + chartHeight);
  ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
  ctx.stroke();

  // Se não houver séries customizadas passadas, adaptar de diasData simples
  let seriesList = [];
  if (classSeries && classSeries.length > 0) {
    seriesList = classSeries;
  } else if (diasData && diasData.length > 0) {
    seriesList = [{
      name: 'Frequência Geral',
      color: '#0284C7',
      points: diasData.map((d) => ({
        dataLabel: d.data,
        pct: Math.min(100, Math.max(0, Math.round(d.pct || 0)))
      }))
    }];
  }

  if (seriesList.length === 0 || !seriesList[0].points || seriesList[0].points.length === 0) {
    ctx.font = 'italic 22px sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum registro de aula no período selecionado', canvas.width / 2, paddingTop + chartHeight / 2);
    return canvas.toDataURL('image/png');
  }

  const datesLabels = seriesList[0].points.map((p) => p.dataLabel);
  const totalDates = datesLabels.length;

  // Renderizar rotulos das datas no Eixo X
  datesLabels.forEach((dataLabel, index) => {
    const x = totalDates === 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (index / (totalDates - 1)) * chartWidth;

    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText(dataLabel, x, paddingTop + chartHeight + 35);
  });

  // Função auxiliar para desenhar marcadores geométricos por classe
  const drawMarker = (type, x, y, color) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (type === 'circle') {
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'square') {
      ctx.rect(x - 6, y - 6, 12, 12);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'triangle') {
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 7, y + 6);
      ctx.lineTo(x - 7, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (type === 'diamond') {
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  const MARKER_TYPES = ['circle', 'square', 'triangle', 'diamond'];

  // Preparar pontos de todas as séries
  const allSeriesProcessed = seriesList.map((series, sIdx) => {
    const isMediaGeral = series.name === 'Média Geral';
    const markerType = isMediaGeral ? 'circle' : MARKER_TYPES[sIdx % MARKER_TYPES.length];

    const processedPoints = series.points.map((p, index) => {
      const x = totalDates === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (index / (totalDates - 1)) * chartWidth;

      const pctVal = Math.min(100, Math.max(0, Math.round(p.pct || 0)));
      const y = paddingTop + chartHeight - (pctVal / 100) * chartHeight;
      return { x, y, pct: pctVal, dateIndex: index };
    });

    return {
      ...series,
      isMediaGeral,
      markerType,
      processedPoints
    };
  });

  // 1. PASSO: Desenhar todas as linhas conectoras
  allSeriesProcessed.forEach((s) => {
    if (s.processedPoints.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = s.isMediaGeral ? 3.5 : 3;
      if (s.isMediaGeral) {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = s.color;
      s.processedPoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // 2. PASSO: Desenhar todos os marcadores de pontos
  allSeriesProcessed.forEach((s) => {
    s.processedPoints.forEach((p) => {
      drawMarker(s.markerType, p.x, p.y, s.color);
    });
  });

  // 3. PASSO: Desenhar rótulos de porcentagem sem colisão
  // Agrupar rótulos por data (coluna) para resolver sobreposição
  for (let dIdx = 0; dIdx < totalDates; dIdx++) {
    const columnPoints = [];
    allSeriesProcessed.forEach((s) => {
      const p = s.processedPoints[dIdx];
      if (p) {
        columnPoints.push({
          pct: p.pct,
          x: p.x,
          y: p.y,
          color: s.color,
          isMediaGeral: s.isMediaGeral
        });
      }
    });

    // Ordenar pontos do mais alto no gráfico (menor Y) ao mais baixo (maior Y)
    columnPoints.sort((a, b) => a.y - b.y);

    const labelHeight = 18;
    const isMultiSeries = columnPoints.length > 2;

    // Ajustar posições Y dos rótulos para garantir espaço mínimo
    const labelPositions = columnPoints.map((pt) => pt.y - 14);

    if (isMultiSeries) {
      // Passagem de cima para baixo
      for (let i = 1; i < labelPositions.length; i++) {
        if (labelPositions[i] < labelPositions[i - 1] + labelHeight) {
          labelPositions[i] = labelPositions[i - 1] + labelHeight;
        }
      }
      // Se estourar a parte inferior do gráfico, ajustar de baixo para cima
      const maxY = paddingTop + chartHeight + 10;
      if (labelPositions[labelPositions.length - 1] > maxY) {
        labelPositions[labelPositions.length - 1] = maxY;
        for (let i = labelPositions.length - 2; i >= 0; i--) {
          if (labelPositions[i] > labelPositions[i + 1] - labelHeight) {
            labelPositions[i] = labelPositions[i + 1] - labelHeight;
          }
        }
      }
    }

    // Renderizar os badges/pills de texto com fundo branco para legibilidade perfeita
    columnPoints.forEach((pt, i) => {
      const ly = labelPositions[i];
      const txt = `${pt.pct}%`;

      ctx.font = pt.isMediaGeral ? 'bold 15px sans-serif' : 'bold 14px sans-serif';
      const textWidth = ctx.measureText(txt).width;
      const badgeW = textWidth + 8;
      const badgeH = 16;
      const bx = pt.x - badgeW / 2;
      const by = ly - 12;

      // Se houver muitas séries, desenhar badge com fundo semi-transparente/branco
      if (isMultiSeries) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(bx, by, badgeW, badgeH);

        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, badgeW, badgeH);
      }

      ctx.fillStyle = pt.color;
      ctx.textAlign = 'center';
      ctx.fillText(txt, pt.x, ly);
    });
  }

  // 4. PASSO: Legenda na parte inferior
  const legendY = canvas.height - 85;
  const itemWidth = 220;
  const itemsPerRow = Math.min(4, Math.floor((canvas.width - 100) / itemWidth));
  const totalRows = Math.ceil(seriesList.length / itemsPerRow);
  const startX = (canvas.width - Math.min(seriesList.length, itemsPerRow) * itemWidth) / 2;

  allSeriesProcessed.forEach((s, idx) => {
    const col = idx % itemsPerRow;
    const row = Math.floor(idx / itemsPerRow);
    const x = startX + col * itemWidth;
    const y = legendY + row * 28;

    // Símbolo na legenda
    if (s.isMediaGeral) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 24, y - 5);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      drawMarker(s.markerType, x + 12, y - 5, s.color);
    }

    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(s.name, x + 32, y);
  });

  return canvas.toDataURL('image/png');
}

/**
 * 2. Gráfico de Barras Horizontais: Frequência por Classe (%)
 */
export function generateClassFrequencyChartCanvas(classesData) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 550;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.fillText('Frequência Média por Classe (%)', canvas.width / 2, 40);

  const paddingLeft = 250;
  const paddingRight = 120;
  const paddingTop = 80;
  const paddingBottom = 70;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  // Linhas verticais do Eixo X (0% a 100%)
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'center';

  for (let i = 0; i <= 10; i++) {
    const pct = i * 10;
    const x = paddingLeft + (i / 10) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(x, paddingTop);
    ctx.lineTo(x, paddingTop + chartHeight);
    ctx.stroke();

    ctx.fillText(`${pct}%`, x, paddingTop + chartHeight + 25);
  }

  if (!classesData || classesData.length === 0) {
    ctx.font = 'italic 22px sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhuma classe disponível', canvas.width / 2, paddingTop + chartHeight / 2);
    return canvas.toDataURL('image/png');
  }

  const barCount = classesData.length;
  const slotHeight = chartHeight / barCount;
  const barHeight = Math.min(42, slotHeight * 0.65);

  classesData.forEach((item, idx) => {
    const color = CLASS_COLORS[idx % CLASS_COLORS.length];
    const pct = Math.min(100, Math.max(0, Math.round(item.pct || item.pctFreq || 0)));
    const barWidth = (pct / 100) * chartWidth;

    const y = paddingTop + idx * slotHeight + (slotHeight - barHeight) / 2;

    // Nome da classe no Eixo Y
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'right';
    ctx.fillText(item.classe, paddingLeft - 20, y + barHeight / 2 + 6);

    // Barra
    ctx.fillStyle = color;
    ctx.fillRect(paddingLeft, y, barWidth, barHeight);

    // Porcentagem ao lado da barra
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'left';
    ctx.fillText(`${pct}%`, paddingLeft + barWidth + 12, y + barHeight / 2 + 6);
  });

  return canvas.toDataURL('image/png');
}

/**
 * 3. Gráfico de Barras Agrupadas: Presentes vs Faltas (Ausentes) Média por Classe
 */
export function generateClassPresenceAbsenceChartCanvas(classesData) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 550;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.fillText('Média de Presentes vs Faltas (Ausentes) por Classe', canvas.width / 2, 40);

  const paddingLeft = 90;
  const paddingRight = 50;
  const paddingTop = 80;
  const paddingBottom = 110;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    10,
    ...classesData.map((c) => Math.max(c.mediaPresentes || 0, c.mediaAusentes || 0, c.matriculados || 0))
  );

  // Grade Y
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 5; i++) {
    const val = Math.round((maxVal / 5) * i);
    const y = paddingTop + chartHeight - (i / 5) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartWidth, y);
    ctx.stroke();

    ctx.fillText(val.toString(), paddingLeft - 12, y + 5);
  }

  if (!classesData || classesData.length === 0) {
    return canvas.toDataURL('image/png');
  }

  const groupCount = classesData.length;
  const slotWidth = chartWidth / groupCount;
  const barWidth = Math.min(45, slotWidth * 0.35);

  classesData.forEach((item, idx) => {
    const pres = item.mediaPresentes || 0;
    const aus = item.mediaAusentes || 0;

    const presH = (pres / maxVal) * chartHeight;
    const ausH = (aus / maxVal) * chartHeight;

    const groupCenterX = paddingLeft + idx * slotWidth + slotWidth / 2;
    const xPres = groupCenterX - barWidth - 4;
    const xAus = groupCenterX + 4;

    const yPres = paddingTop + chartHeight - presH;
    const yAus = paddingTop + chartHeight - ausH;

    // Barra Presentes (Verde)
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(xPres, yPres, barWidth, presH);

    // Barra Ausentes (Vermelho)
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(xAus, yAus, barWidth, ausH);

    // Valores no topo das barras
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = '#15803D';
    ctx.fillText(formatVal(pres), xPres + barWidth / 2, yPres - 6);

    ctx.fillStyle = '#B91C1C';
    ctx.fillText(formatVal(aus), xAus + barWidth / 2, yAus - 6);

    // Nome da Classe no Eixo X
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(item.classe, groupCenterX, paddingTop + chartHeight + 30);
  });

  // Legenda
  const legendY = canvas.height - 35;
  const legendX = canvas.width / 2 - 130;

  ctx.fillStyle = '#22C55E';
  ctx.fillRect(legendX, legendY - 14, 22, 16);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'left';
  ctx.fillText('Média Presentes', legendX + 30, legendY);

  ctx.fillStyle = '#EF4444';
  ctx.fillRect(legendX + 170, legendY - 14, 22, 16);
  ctx.fillText('Média Faltas (Ausentes)', legendX + 200, legendY);

  return canvas.toDataURL('image/png');
}

/**
 * 4. Gráfico de Barras Agrupadas: Bíblias e Revistas (Média por Classe)
 */
export function generateClassBiblesMagazinesChartCanvas(classesData) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.fillText('Média de Bíblias e Revistas por Classe', canvas.width / 2, 40);

  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 80;
  const paddingBottom = 110;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    10,
    ...classesData.map((c) => Math.max(c.mediaBiblias || 0, c.mediaRevistas || 0))
  );

  // Grade Y
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 5; i++) {
    const val = Math.round((maxVal / 5) * i);
    const y = paddingTop + chartHeight - (i / 5) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartWidth, y);
    ctx.stroke();

    ctx.fillText(val.toString(), paddingLeft - 10, y + 5);
  }

  if (!classesData || classesData.length === 0) {
    return canvas.toDataURL('image/png');
  }

  const groupCount = classesData.length;
  const slotWidth = chartWidth / groupCount;
  const barWidth = Math.min(35, slotWidth * 0.35);

  classesData.forEach((item, idx) => {
    const bibl = item.mediaBiblias || 0;
    const rev = item.mediaRevistas || 0;

    const biblH = (bibl / maxVal) * chartHeight;
    const revH = (rev / maxVal) * chartHeight;

    const groupCenterX = paddingLeft + idx * slotWidth + slotWidth / 2;
    const xBibl = groupCenterX - barWidth - 3;
    const xRev = groupCenterX + 3;

    const yBibl = paddingTop + chartHeight - biblH;
    const yRev = paddingTop + chartHeight - revH;

    // Barra Bíblias (Teal)
    ctx.fillStyle = '#14B8A6';
    ctx.fillRect(xBibl, yBibl, barWidth, biblH);

    // Barra Revistas (Roxo)
    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(xRev, yRev, barWidth, revH);

    // Valores
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = '#0D9488';
    ctx.fillText(formatVal(bibl), xBibl + barWidth / 2, yBibl - 5);

    ctx.fillStyle = '#7C3AED';
    ctx.fillText(formatVal(rev), xRev + barWidth / 2, yRev - 5);

    // Nome da classe no eixo X (Angulado)
    ctx.save();
    ctx.translate(groupCenterX, paddingTop + chartHeight + 15);
    ctx.rotate(Math.PI / 6);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(item.classe, 0, 0);
    ctx.restore();
  });

  // Legenda
  const legendY = canvas.height - 30;
  const legendX = canvas.width / 2 - 120;

  ctx.fillStyle = '#14B8A6';
  ctx.fillRect(legendX, legendY - 12, 18, 14);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'left';
  ctx.fillText('Bíblias (Média)', legendX + 24, legendY);

  ctx.fillStyle = '#8B5CF6';
  ctx.fillRect(legendX + 130, legendY - 12, 18, 14);
  ctx.fillText('Revistas (Média)', legendX + 154, legendY);

  return canvas.toDataURL('image/png');
}

/**
 * 5. Gráfico Donut: Presença vs Ausência no Mês
 */
export function generatePresenceDonutChartCanvas(totalPresentes, totalAusentes) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.fillText('Presença vs Ausência Geral no Mês', canvas.width / 2, 40);

  const total = totalPresentes + totalAusentes;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 20;
  const outerRadius = 180;
  const innerRadius = 105;

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Sem Dados', centerX, centerY);
    return canvas.toDataURL('image/png');
  }

  const presAngle = (totalPresentes / total) * Math.PI * 2;

  // Slice Presentes (Verde)
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, -Math.PI / 2, -Math.PI / 2 + presAngle);
  ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + presAngle, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = '#22C55E';
  ctx.fill();

  // Slice Ausentes (Vermelho)
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, -Math.PI / 2 + presAngle, -Math.PI / 2 + Math.PI * 2);
  ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + Math.PI * 2, -Math.PI / 2 + presAngle, true);
  ctx.closePath();
  ctx.fillStyle = '#EF4444';
  ctx.fill();

  // Texto Central
  const pctPres = Math.round((totalPresentes / total) * 100);
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#15803D';
  ctx.textAlign = 'center';
  ctx.fillText(`${pctPres}%`, centerX, centerY + 8);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('Frequência', centerX, centerY + 32);

  // Legendas na parte inferior
  const legendY = canvas.height - 50;
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(centerX - 140, legendY, 20, 20);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'left';
  ctx.fillText(`Presentes: ${totalPresentes}`, centerX - 110, legendY + 16);

  ctx.fillStyle = '#EF4444';
  ctx.fillRect(centerX + 30, legendY, 20, 20);
  ctx.fillText(`Ausentes: ${totalAusentes}`, centerX + 60, legendY + 16);

  return canvas.toDataURL('image/png');
}

/**
 * 6. Gráfico de Barras Verticais: Ofertas por Classe (R$)
 */
export function generateOfferingsBarChartCanvas(classesData) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.fillText('Total de Ofertas por Classe (R$)', canvas.width / 2, 40);

  const paddingLeft = 80;
  const paddingRight = 40;
  const paddingTop = 80;
  const paddingBottom = 120;
  const chartWidth = canvas.width - paddingLeft - paddingRight;
  const chartHeight = canvas.height - paddingTop - paddingBottom;

  const maxOferta = Math.max(10, ...classesData.map((c) => c.oferta || c.totalOferta || 0));

  // Grade Y
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 5; i++) {
    const val = (maxOferta / 5) * i;
    const y = paddingTop + chartHeight - (i / 5) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartWidth, y);
    ctx.stroke();

    ctx.fillText(`R$ ${val.toFixed(2)}`, paddingLeft - 10, y + 5);
  }

  if (!classesData || classesData.length === 0) {
    return canvas.toDataURL('image/png');
  }

  const barCount = classesData.length;
  const slotWidth = chartWidth / barCount;
  const barWidth = Math.min(50, slotWidth * 0.6);

  classesData.forEach((item, idx) => {
    const ofVal = item.oferta ?? item.totalOferta ?? 0;
    const barH = (ofVal / maxOferta) * chartHeight;
    const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
    const y = paddingTop + chartHeight - barH;

    // Barra Laranja
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(x, y, barWidth, barH);

    // Valor da Oferta acima da barra
    if (ofVal > 0) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#D97706';
      ctx.textAlign = 'center';
      ctx.fillText(`R$ ${ofVal.toFixed(2)}`, x + barWidth / 2, y - 8);
    }

    // Nome da Classe no Eixo X (Angulado)
    ctx.save();
    ctx.translate(x + barWidth / 2, paddingTop + chartHeight + 15);
    ctx.rotate(Math.PI / 6);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(item.classe, 0, 0);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

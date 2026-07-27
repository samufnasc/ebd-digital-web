import { supabase } from '../lib/supabase';

interface LinhaClasse {
  classe: string;
  matriculados: number;
  ausentes: number;
  presentes: number;
  oferta: number;
  visitantes?: number;
  biblias?: number;
  revistas?: number;
}

interface DiaPayload {
  data: string;
  classes: LinhaClasse[];
}

interface RelatorioPayload {
  congregacao: string;
  referencia_mes: string;
  dias: DiaPayload[];
}

/**
 * Busca os dados do Supabase para o mês de referência e gera o PDF oficial via API Python
 */
export async function gerarRelatorioMensalCompleto(
  congregacao: string,
  mesAno: string,        // formato "2026-02"
  mesAnoExtenso: string  // formato "Fevereiro / 2026"
) {
  try {
    // 1. Filtro correto para coluna do tipo DATE (não usar .like)
    //    Pega do dia 01 até o último dia possível do mês
    const inicioMes = `${mesAno}-01`;
    const fimMes = `${mesAno}-31`; // Postgres aceita e descarta dias inválidos (ex: 31/02)

    const { data: relatoriosBanco, error: errorBanco } = await supabase
      .from('relatorios_ebd')
      .select('*')
      .gte('data_aula', inicioMes)
      .lte('data_aula', fimMes)
      .order('data_aula', { ascending: true });

    if (errorBanco) throw errorBanco;
    if (!relatoriosBanco || relatoriosBanco.length === 0) {
      throw new Error(`Nenhum dado encontrado no Supabase para o período: ${mesAnoExtenso}`);
    }

    // 2. Agrupa por data (BLINDADO contra nulos)
    const agrupadoPorData: { [data: string]: any[] } = {};

    relatoriosBanco.forEach((registro: any) => {
      if (!registro?.data_aula) {
        console.warn('Registro ignorado (sem data_aula):', registro);
        return;
      }

      // Supabase pode devolver date como string "YYYY-MM-DD"
      const dataStr = String(registro.data_aula).substring(0, 10);
      const [ano, mes, dia] = dataStr.split('-');
      const dataBr = `${dia}/${mes}/${ano}`;

      if (!agrupadoPorData[dataBr]) {
        agrupadoPorData[dataBr] = [];
      }
      agrupadoPorData[dataBr].push(registro);
    });

    // 3. Monta o payload no formato exigido pelo api.py
    const diasFormatados: DiaPayload[] = Object.keys(agrupadoPorData)
      .sort((a, b) => {
        // Ordena cronologicamente (DD/MM/YYYY)
        const [da, ma, aa] = a.split('/').map(Number);
        const [db, mb, ab] = b.split('/').map(Number);
        return new Date(aa, ma - 1, da).getTime() - new Date(ab, mb - 1, db).getTime();
      })
      .map((dataBr) => ({
        data: dataBr,
        classes: agrupadoPorData[dataBr].map((item: any) => ({
          classe: item.classe ?? '',
          matriculados: Number(item.matriculados ?? 0),
          ausentes: Number(item.ausentes ?? 0),
          presentes: Number(item.presentes ?? 0),
          oferta: parseFloat(item.ofertas ?? 0),      // ← coluna real: ofertas
          visitantes: Number(item.visitantes ?? 0),
          biblias: Number(item.biblias ?? 0),         // ← coluna real: biblias
          revistas: Number(item.revistas ?? 0),       // ← coluna real: revistas
        })),
      }));

    const payload: RelatorioPayload = {
      congregacao,
      referencia_mes: mesAnoExtenso,
      dias: diasFormatados,
    };

    console.log('Payload enviado para API de PDF:', payload);

    // 4. Chama a API Python
    const API_BASE_URL =
      (import.meta as any).env?.VITE_API_PDF_URL || 'http://localhost:5000';

    const resposta = await fetch(`${API_BASE_URL}/api/relatorio-mensal/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resposta.ok) {
      const errData = await resposta.json().catch(() => ({}));
      throw new Error(errData.erro || `Falha na comunicação com o servidor de PDF (${resposta.status})`);
    }

    // 5. Download automático
    const blob = await resposta.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const nomeArquivo = `Relatorio_Mensal_${mesAnoExtenso.replace(/\s/g, '').replace('/', '-')}.pdf`;
    link.download = nomeArquivo;

    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error: any) {
    console.error('Erro no fluxo do PDF:', error);
    throw error;
  }
}
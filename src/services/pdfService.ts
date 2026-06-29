import { supabase } from '../lib/supabase'; // Mantém o caminho correto ajustado

// Definição das interfaces para tipagem segura (TypeScript) - IDÊNTICAS
interface LinhaClasse {
  classe: string;
  matriculados: number;
  ausentes: number;
  presentes: number;
  oferta: number;
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
  mesAno: string, // formato usado no filtro do banco (ex: "2026-02")
  mesAnoExtenso: string // formato para o PDF (ex: "Fevereiro / 2026")
) {
  try {
    // 1. Busca os dados diretamente da tabela unificada 'relatorios_ebd' do seu banco
    const { data: relatoriosBanco, error: errorBanco } = await supabase
      .from('relatorios_ebd') 
      .select('*')
      .like('data_aula', `${mesAno}%`) // Ex: "2026-02%" busca todos os domingos
      .order('data_aula', { ascending: true });

    if (errorBanco) throw errorBanco;
    if (!relatoriosBanco || relatoriosBanco.length === 0) {
      throw new Error(`Nenhum dado encontrado no Supabase para o período: ${mesAnoExtenso}`);
    }

    // 2. Transforma e mapeia os dados para o formato exigido pelo seu Backend Python (Mantendo a lógica exata de agrupamento)
    // Agrupa os registros por data para montar o array de dias com suas respectivas classes
    const agrupadoPorData: { [data: string]: any[] } = {};
    
    relatoriosBanco.forEach((registro: any) => {
      const dataBr = registro.data_aula.split('-').reverse().join('/');
      if (!agrupadoPorData[dataBr]) {
        agrupadoPorData[dataBr] = [];
      }
      agrupadoPorData[dataBr].push(registro);
    });

    // Agora converte para a estrutura DiaPayload original desejada
    const diasFormatados: DiaPayload[] = Object.keys(agrupadoPorData).map((dataBr) => {
      return {
        data: dataBr,
        classes: agrupadoPorData[dataBr].map((item: any) => ({
          classe: item.classe, // "Adonai", "Geração Eleita", etc.
          matriculados: Number(item.matriculados || 0),
          ausentes: Number(item.ausentes || 0),
          presentes: Number(item.presentes || 0),
          oferta: parseFloat(item.oferta || 0),
          biblias: Number(item.biblia || 0),  // Mapeamento correto da coluna 'biblia'
          revistas: Number(item.revista || 0) // Mapeamento correto da coluna 'revista'
        }))
      };
    });

    // Monta o payload final idêntico ao exigido pelo api.py
    const payload: RelatorioPayload = {
      congregacao: congregacao,
      referencia_mes: mesAnoExtenso,
      dias: diasFormatados
    };

    // Força o TypeScript a aceitar a propriedade .env injetada pelo Vite
const API_BASE_URL = (import.meta as any).env?.VITE_API_PDF_URL || "http://localhost:5000";
    
    const resposta = await fetch(`${API_BASE_URL}/api/relatorio-mensal/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resposta.ok) {
      const errData = await resposta.json().catch(() => ({}));
      throw new Error(errData.erro || "Falha na comunicação com o servidor de PDF.");
    }

    // 4. Recebe o arquivo binário (Blob) e inicia o download automático - IDÊNTICO
    const blob = await resposta.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    const nomeArquivo = `Relatorio_Mensal_${mesAnoExtenso.replace(/\s/g, "").replace("/", "-")}.pdf`;
    link.download = nomeArquivo;
    
    document.body.appendChild(link);
    link.click();
    
    // Limpeza de memória - IDÊNTICA
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error: any) {
    console.error("Erro no fluxo do PDF:", error);
    throw error;
  }
}
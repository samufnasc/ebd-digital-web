/**
 * exemploIntegracaoReact.jsx
 * ===========================
 * Exemplo de como o site (ebd-digital-web) deve chamar a API Python
 * para gerar e baixar/imprimir o Relatório Mensal em PDF.
 *
 * Ajuste API_BASE_URL para o endereço onde o backend Flask estiver
 * publicado (ex: Railway, Render, Fly.io, EC2, etc.).
 */

const API_BASE_URL = "http://localhost:5000"; // troque pela URL de produção

/**
 * Monta o payload no formato esperado pela API a partir dos dados que o
 * site já tem em memória (ex: vindos do Firestore/banco local).
 *
 * @param {string} congregacao - Nome da congregação
 * @param {string} referenciaMes - Ex: "Junho / 2026"
 * @param {Array} diasDoMes - Array de objetos: { data: "DD/MM/AAAA", linhas: [...] }
 *        onde cada linha é uma linha da tabela "Relatório Geral" do site
 *        (Classe, Mat, Aus, Pres, Vis, Bíbl, Rev, Oferta)
 */
function montarPayload(congregacao, referenciaMes, diasDoMes) {
  return {
    congregacao,
    referencia_mes: referenciaMes,
    dias: diasDoMes.map((dia) => ({
      data: dia.data,
      classes: dia.linhas.map((linha) => ({
        classe: linha.classe,           // ex: "Adonai"
        matriculados: linha.mat,         // ex: 15
        ausentes: linha.aus,             // ex: 7
        presentes: linha.pres,           // ex: 8
        visitantes: linha.vis ?? 0,      // ex: 0
        biblias: linha.bibl ?? 0,        // ex: 7
        revistas: linha.rev ?? 0,        // ex: 6
        oferta: linha.oferta,            // ex: 9.00
      })),
    })),
  };
}

/**
 * Chama a API e dispara o download automático do PDF no navegador.
 */
async function gerarEDownloadRelatorioPdf(congregacao, referenciaMes, diasDoMes) {
  const payload = montarPayload(congregacao, referenciaMes, diasDoMes);

  const resposta = await fetch(`${API_BASE_URL}/api/relatorio-mensal/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({}));
    throw new Error(erro.erro || "Falha ao gerar o relatório PDF.");
  }

  const blob = await resposta.blob();
  const url = window.URL.createObjectURL(blob);

  // Dispara o download
  const link = document.createElement("a");
  link.href = url;
  link.download = `Relatorio_Mensal_${referenciaMes.replace(/\s/g, "")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // (Opcional) Abre automaticamente o diálogo de impressão em uma nova aba
  // const printWindow = window.open(url);
  // printWindow.onload = () => printWindow.print();

  window.URL.revokeObjectURL(url);
}

/**
 * Exemplo de botão React que usa a função acima.
 * Reaproveita os dados que já estão na tela "Relatório Geral" do site.
 */
function BotaoRelatorioMensalPdf({ congregacao, referenciaMes, diasDoMes }) {
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState(null);

  async function handleClick() {
    setCarregando(true);
    setErro(null);
    try {
      await gerarEDownloadRelatorioPdf(congregacao, referenciaMes, diasDoMes);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={carregando}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        {carregando ? "Gerando PDF..." : "📄 Exportar Relatório Mensal (PDF)"}
      </button>
      {erro && <p className="text-red-600 text-sm mt-1">{erro}</p>}
    </div>
  );
}

export { gerarEDownloadRelatorioPdf, montarPayload, BotaoRelatorioMensalPdf };

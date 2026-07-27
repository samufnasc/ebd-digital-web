# -*- coding: utf-8 -*-
"""
gerador_relatorio.py
=====================
Módulo responsável por preencher o RELATÓRIO MENSAL da EBD (PDF) a partir
dos dados de cada classe, via técnica de overlay (sobreposição de texto)
sobre o PDF template original — preservando 100% do layout, cabeçalho,
brasão e bordas oficiais da igreja.

Como funciona:
--------------
1. Recebe os dados brutos de cada classe (Mat, Aus, Pres, Oferta) para
   cada domingo do mês.
2. Calcula a MÉDIA MENSAL de frequência/faltas (média dos domingos) e o
   TOTAL de ofertas do mês, por classe.
3. Agrega as classes da igreja nas categorias oficiais exigidas pelo
   formulário da COMADESMA/CGADB (Professores, Adultos, Jovens,
   Primários, Jardim de Infância etc.).
4. Desenha um overlay (camada transparente) com os valores nas posições
   exatas do PDF template e faz o merge com o PDF original.

Este módulo é importado pela API (api.py) e não deve ser executado
diretamente em produção — mas pode ser testado isoladamente (ver bloco
`if __name__ == "__main__"` no final do arquivo).
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass, field
from typing import Optional

from reportlab.pdfgen import canvas
from reportlab.lib.colors import black
from pypdf import PdfReader, PdfWriter


# ---------------------------------------------------------------------------
# CONFIGURAÇÃO DE CAMINHOS
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PDF_PATH = os.path.join(BASE_DIR, "templates_pdf", "RELATORIO_MENSAL.pdf")

PAGE_W, PAGE_H = 595.32, 842.04  # dimensões do template (A4), em pontos


# ---------------------------------------------------------------------------
# TABELA DE VARIÁVEIS DE ENTRADA (usadas pelo site / API)
# ---------------------------------------------------------------------------
"""
Estas são as variáveis que o site React precisa enviar para o backend
gerar o relatório. Cada classe da igreja (linha da tabela do "Relatório
Geral" do site) deve enviar os seguintes campos, PARA CADA DOMINGO do mês:

+--------------------+--------+-------------------------------------------+
| Variável           | Tipo   | Descrição                                  |
+--------------------+--------+-------------------------------------------+
| classe             | str    | Nome da classe (ex: "Adonai", "Abraão")   |
| matriculados (mat) | int    | Total de matriculados na classe            |
| ausentes (aus)     | int    | Total de ausentes no dia                   |
| presentes (pres)   | int    | Total de presentes no dia                  |
| visitantes (vis)   | int    | Total de visitantes no dia                  |
| biblias (bibl)     | int    | Quantidade de bíblias levadas               |
| revistas (rev)     | int    | Quantidade de revistas levadas              |
| oferta             | float  | Valor da oferta arrecadada no dia (R$)     |
+--------------------+--------+-------------------------------------------+

E, em nível de relatório (mês inteiro), o site precisa enviar:

+--------------------+--------+-------------------------------------------+
| Variável           | Tipo   | Descrição                                  |
+--------------------+--------+-------------------------------------------+
| congregacao        | str    | Nome da congregação (ex: "Mensageiros..") |
| referencia_mes     | str    | Mês/ano de referência (ex: "Junho/2026")  |
| dias               | list   | Lista de "RegistroDia" (um por domingo)    |
| total_visitantes   | int    | Soma de visitantes do mês (opcional,       |
|                    |        | senão é calculado automaticamente)         |
+--------------------+--------+-------------------------------------------+

O mapeamento de "classe da igreja" -> "campo oficial do formulário" é
definido em MAPEAMENTO_CLASSES abaixo e pode ser ajustado livremente.
"""

# Mapeamento: campo oficial do formulário -> lista de classes da igreja
# que devem ser somadas/agregadas nesse campo.
MAPEAMENTO_CLASSES: dict[str, list[str]] = {
    "CLASSE OFICIAL (PROFESSORES)": ["Adonai"],
    "ADULTOS": ["Geração Eleita", "Abraão"],
    "JOVENS": ["Vencedores do Rei"],
    "PRÉ-ADOLESCENTES": [],
    "JUVENIS": [],
    "ADOLESCENTES": [],
    "JUNIORES": [],
    "PRIMÁRIOS": ["Crescendo com Cristo"],
    "JARDIM DE INFÂNCIA": ["Jardim de Deus"],
    "MATERNAL": [],
    "BERÇÁRIO": [],
    "DISCIPULADO": [],
}

# Ordem oficial das linhas no formulário (fixa, não alterar)
ORDEM_CAMPOS = list(MAPEAMENTO_CLASSES.keys())


# ---------------------------------------------------------------------------
# ESTRUTURAS DE DADOS DE ENTRADA
# ---------------------------------------------------------------------------
@dataclass
class RegistroClasseDia:
    """Dados de UMA classe em UM domingo específico."""
    classe: str
    matriculados: int
    ausentes: int
    presentes: int
    oferta: float
    visitantes: int = 0
    biblias: int = 0
    revistas: int = 0


@dataclass
class RegistroDia:
    """Dados de TODAS as classes em UM domingo (uma linha do 'Relatório Geral' do site)."""
    data: str  # formato "DD/MM/AAAA"
    classes: list[RegistroClasseDia] = field(default_factory=list)


@dataclass
class DadosRelatorioMensal:
    """Payload completo recebido da API para gerar o relatório do mês."""
    congregacao: str
    referencia_mes: str  # ex.: "Junho / 2026"
    dias: list[RegistroDia] = field(default_factory=list)


# ---------------------------------------------------------------------------
# COORDENADAS DO TEMPLATE (extraídas do PDF original, em pontos, origem no topo)
# ---------------------------------------------------------------------------
# 'top' de cada linha de rótulo na seção correspondente do formulário.
TOPO_LINHAS_MATRICULADOS = [151.8, 165.0, 178.2, 191.3, 204.5, 217.6, 230.8, 243.9, 257.1, 270.3, 283.4, 296.6]
TOPO_LINHAS_FREQUENCIA   = [335.9, 349.1, 362.3, 375.4, 388.6, 401.7, 414.9, 428.1, 441.2, 454.4, 467.5, 480.7]
TOPO_LINHAS_FALTAS       = [520.1, 533.2, 546.4, 559.5, 572.7, 585.8, 599.0, 612.2, 625.3, 638.5, 651.6, 664.8]

TOPO_HEADER_MATRICULADOS = 138.7
TOPO_HEADER_FREQUENCIA = 322.8
TOPO_HEADER_FALTAS = 506.9

TOPO_TOTAL_ENTRADAS = 698.5
TOPO_TOTAL_VISITANTES = 712.5

TOPO_CONGREGACAO = 108.3
TOPO_REFERENCIA = 127.4

VAL_X_CENTER = (333.4 + 538.9) / 2  # centro da coluna de valores
X_TOTAL_HEADER = 478  # posição x do total ao lado do cabeçalho "TOTAL (%):" / "TOTAL:"
X_CONGREGACAO_VALOR = 180
X_REFERENCIA_VALOR = 190


def _y(top: float) -> float:
    """Converte coordenada 'top' (origem no topo da página) para o sistema
    de coordenadas do reportlab (origem na base)."""
    return PAGE_H - top


# ---------------------------------------------------------------------------
# CÁLCULO DOS AGREGADOS MENSAIS
# ---------------------------------------------------------------------------
def calcular_agregados(dados: DadosRelatorioMensal, zerar_dias_sem_registro: bool = True) -> dict:
    """
    Calcula, para cada campo oficial do formulário, a matrícula de
    referência, a média mensal de frequência (%) e de faltas (%), e o
    total de ofertas arrecadadas no mês.

    Regra de negócio (definida e validada com o usuário):
    - Em domingos onde uma classe não teve registro (matriculados == 0 e
      presentes == 0), conta-se 0% de frequência naquele dia, em vez de
      ignorar o dia no cálculo da média (zerar_dias_sem_registro=True).
    - A matrícula de referência (para fins de exibição) é a maior
      matrícula registrada da classe no mês (matrícula "oficial").
    - Quando o campo agrega múltiplas classes (ex.: ADULTOS = Geração
      Eleita + Abraão), a frequência é uma média ponderada pela matrícula
      de cada classe, não uma média simples dos percentuais.

    Retorna um dicionário:
        {
          "campo_formulario": {
              "matriculados": int,
              "freq_pct": int,
              "falta_pct": int,
              "oferta_total": float,
          },
          ...
          "_totais_gerais": {
              "matriculados": int,
              "freq_pct_media": int,
              "falta_pct_media": int,
              "oferta_total": float,
              "visitantes_total": int,
          }
        }
    """
    # 1. Organiza os dados por classe: lista de (mat, aus, pres, oferta) por dia
    por_classe: dict[str, list[RegistroClasseDia]] = {}
    visitantes_total = 0
    for dia in dados.dias:
        for c in dia.classes:
            por_classe.setdefault(c.classe, []).append(c)
            visitantes_total += c.visitantes

    # 2. Calcula estatísticas mensais por classe individual
    stats_classe: dict[str, dict] = {}
    for classe, registros in por_classe.items():
        mat_oficial = max((r.matriculados for r in registros), default=0)
        pcts = []
        oferta_total = 0.0
        for r in registros:
            oferta_total += r.oferta
            if r.matriculados > 0:
                pcts.append(r.presentes / r.matriculados * 100)
            elif zerar_dias_sem_registro:
                pcts.append(0.0)
            # se matriculados == 0 e zerar_dias_sem_registro=False, dia é ignorado
        media_pct = sum(pcts) / len(pcts) if pcts else 0.0
        stats_classe[classe] = {
            "matriculados": mat_oficial,
            "freq_pct_raw": media_pct,  # mantém float para ponderação correta na agregação
            "oferta_total": oferta_total,
        }

    # 3. Agrega por campo oficial do formulário
    resultado: dict[str, dict] = {}
    for campo, classes_da_igreja in MAPEAMENTO_CLASSES.items():
        if not classes_da_igreja:
            resultado[campo] = None  # sem dado disponível -> célula fica em branco
            continue

        mat_total = 0
        soma_presentes_equivalente = 0.0  # soma de (freq% * mat) de cada classe
        oferta_total = 0.0
        algum_dado = False

        for nome_classe in classes_da_igreja:
            st = stats_classe.get(nome_classe)
            if st is None:
                continue
            algum_dado = True
            mat_total += st["matriculados"]
            soma_presentes_equivalente += st["freq_pct_raw"] / 100 * st["matriculados"]
            oferta_total += st["oferta_total"]

        if not algum_dado or mat_total == 0:
            resultado[campo] = None
            continue

        freq_pct = round(soma_presentes_equivalente / mat_total * 100)
        falta_pct = 100 - freq_pct
        resultado[campo] = {
            "matriculados": mat_total,
            "freq_pct": freq_pct,
            "falta_pct": falta_pct,
            "oferta_total": round(oferta_total, 2),
        }

    # 4. Totais gerais (linha "TOTAL" de cada seção do formulário)
    campos_com_dado = [v for v in resultado.values() if v is not None]
    mat_geral = sum(v["matriculados"] for v in campos_com_dado)
    freq_media_geral = (
        round(sum(v["freq_pct"] for v in campos_com_dado) / len(campos_com_dado))
        if campos_com_dado else 0
    )
    falta_media_geral = 100 - freq_media_geral if campos_com_dado else 0
    oferta_geral = round(sum(v["oferta_total"] for v in campos_com_dado), 2)

    resultado["_totais_gerais"] = {
        "matriculados": mat_geral,
        "freq_pct_media": freq_media_geral,
        "falta_pct_media": falta_media_geral,
        "oferta_total": oferta_geral,
        "visitantes_total": visitantes_total,
    }
    return resultado


# ---------------------------------------------------------------------------
# GERAÇÃO DO PDF (OVERLAY)
# ---------------------------------------------------------------------------
def gerar_pdf_relatorio(dados: DadosRelatorioMensal, zerar_dias_sem_registro: bool = True) -> bytes:
    """
    Gera o PDF do Relatório Mensal preenchido e retorna os bytes do
    arquivo final (pronto para download/impressão).
    """
    agregados = calcular_agregados(dados, zerar_dias_sem_registro=zerar_dias_sem_registro)

    overlay_buffer = io.BytesIO()
    c = canvas.Canvas(overlay_buffer, pagesize=(PAGE_W, PAGE_H))
    c.setFillColor(black)

    def escreve_valor_centralizado(top_baseline: float, texto: str, negrito: bool = False, size: float = 9.5):
        c.setFont("Helvetica-Bold" if negrito else "Helvetica", size)
        c.drawCentredString(VAL_X_CENTER, _y(top_baseline), texto)

    def escreve_texto(x: float, top_baseline: float, texto: str, negrito: bool = False, size: float = 10):
        c.setFont("Helvetica-Bold" if negrito else "Helvetica", size)
        c.drawString(x, _y(top_baseline), texto)

    # --- Congregação / Referência ---
    escreve_texto(X_CONGREGACAO_VALOR, TOPO_CONGREGACAO, dados.congregacao)
    escreve_texto(X_REFERENCIA_VALOR, TOPO_REFERENCIA, dados.referencia_mes)

    # --- Seção 1: MATRICULADOS ---
    for campo, top_linha in zip(ORDEM_CAMPOS, TOPO_LINHAS_MATRICULADOS):
        dado = agregados.get(campo)
        if dado:
            escreve_valor_centralizado(top_linha + 10.3, str(dado["matriculados"]))
    tg = agregados["_totais_gerais"]
    escreve_texto(X_TOTAL_HEADER - 13, TOPO_HEADER_MATRICULADOS + 9.7, str(tg["matriculados"]), negrito=True, size=9.5)

    # --- Seção 2: MÉDIA % FREQUÊNCIA MENSAL ---
    for campo, top_linha in zip(ORDEM_CAMPOS, TOPO_LINHAS_FREQUENCIA):
        dado = agregados.get(campo)
        if dado:
            escreve_valor_centralizado(top_linha + 10.3, f"{dado['freq_pct']}%")
    escreve_texto(X_TOTAL_HEADER, TOPO_HEADER_FREQUENCIA + 9.7, f"{tg['freq_pct_media']}%", negrito=True, size=9.5)

    # --- Seção 3: MÉDIA % FALTAS MENSAIS ---
    for campo, top_linha in zip(ORDEM_CAMPOS, TOPO_LINHAS_FALTAS):
        dado = agregados.get(campo)
        if dado:
            escreve_valor_centralizado(top_linha + 10.3, f"{dado['falta_pct']}%")
    escreve_texto(X_TOTAL_HEADER, TOPO_HEADER_FALTAS + 9.7, f"{tg['falta_pct_media']}%", negrito=True, size=9.5)

    # --- Total das entradas (R$) e visitantes ---
    oferta_fmt = f"R$ {tg['oferta_total']:.2f}".replace(".", ",")
    escreve_valor_centralizado(TOPO_TOTAL_ENTRADAS + 9.5, oferta_fmt, negrito=True)
    escreve_valor_centralizado(TOPO_TOTAL_VISITANTES + 9.5, str(tg["visitantes_total"]), negrito=True)

    c.save()
    overlay_buffer.seek(0)

    # --- Merge do overlay com o PDF template original ---
    reader = PdfReader(TEMPLATE_PDF_PATH)
    overlay_reader = PdfReader(overlay_buffer)

    writer = PdfWriter()
    base_page = reader.pages[0]
    base_page.merge_page(overlay_reader.pages[0])
    writer.add_page(base_page)

    output_buffer = io.BytesIO()
    writer.write(output_buffer)
    return output_buffer.getvalue()


# ---------------------------------------------------------------------------
# TESTE LOCAL (executar: python gerador_relatorio.py)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Recria o cenário de Junho/2026 já validado com o usuário, como teste de regressão.
    dias_exemplo = [
        RegistroDia("07/06/2026", [
            RegistroClasseDia("Adonai", 15, 7, 8, 9.00),
            RegistroClasseDia("Geração Eleita", 17, 7, 10, 5.50),
            RegistroClasseDia("Jardim de Deus", 8, 4, 4, 0.00),
            RegistroClasseDia("Vencedores do Rei", 5, 2, 3, 9.00),
            RegistroClasseDia("Abraão", 6, 3, 3, 3.00),
            RegistroClasseDia("Crescendo com Cristo", 4, 2, 2, 0.00),
        ]),
        RegistroDia("18/06/2026", [
            RegistroClasseDia("Adonai", 0, 0, 0, 0.00),
            RegistroClasseDia("Geração Eleita", 0, 0, 0, 0.00),
            RegistroClasseDia("Jardim de Deus", 0, 0, 0, 0.00),
            RegistroClasseDia("Vencedores do Rei", 0, 0, 0, 0.00),
            RegistroClasseDia("Abraão", 6, 3, 3, 5.00),
            RegistroClasseDia("Crescendo com Cristo", 0, 0, 0, 0.00),
        ]),
        RegistroDia("21/06/2026", [
            RegistroClasseDia("Adonai", 15, 7, 8, 11.50),
            RegistroClasseDia("Geração Eleita", 17, 8, 9, 3.75),
            RegistroClasseDia("Jardim de Deus", 8, 2, 6, 5.00),
            RegistroClasseDia("Vencedores do Rei", 5, 2, 3, 4.00),
            RegistroClasseDia("Abraão", 6, 3, 3, 6.00),
            RegistroClasseDia("Crescendo com Cristo", 4, 2, 2, 2.00),
        ]),
        RegistroDia("28/06/2026", [
            RegistroClasseDia("Adonai", 15, 6, 9, 0.75),
            RegistroClasseDia("Geração Eleita", 17, 9, 8, 6.00),
            RegistroClasseDia("Jardim de Deus", 8, 2, 6, 1.25),
            RegistroClasseDia("Vencedores do Rei", 5, 5, 0, 0.00),
            RegistroClasseDia("Abraão", 6, 4, 2, 2.00),
            RegistroClasseDia("Crescendo com Cristo", 4, 4, 0, 0.00),
        ]),
    ]

    payload = DadosRelatorioMensal(
        congregacao="Mensageiros da Fé",
        referencia_mes="Junho / 2026",
        dias=dias_exemplo,
    )

    pdf_bytes = gerar_pdf_relatorio(payload)
    out_path = os.path.join(BASE_DIR, "teste_saida.pdf")
    with open(out_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"PDF de teste gerado em: {out_path} ({len(pdf_bytes)} bytes)")

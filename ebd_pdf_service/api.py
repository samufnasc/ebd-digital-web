# -*- coding: utf-8 -*-
"""
api.py
======
API Flask que expõe o endpoint REST para o site (React/Vite) gerar o
Relatório Mensal em PDF, pronto para impressão.

Como rodar localmente:
-----------------------
    pip install -r requirements.txt
    python api.py

A API sobe em http://localhost:5000 por padrão.

Endpoint principal:
--------------------
    POST /api/relatorio-mensal/pdf

    Body (JSON):
    {
        "congregacao": "Mensageiros da Fé",
        "referencia_mes": "Junho / 2026",
        "dias": [
            {
                "data": "07/06/2026",
                "classes": [
                    {
                        "classe": "Adonai",
                        "matriculados": 15,
                        "ausentes": 7,
                        "presentes": 8,
                        "oferta": 9.00,
                        "visitantes": 0,
                        "biblias": 7,
                        "revistas": 6
                    },
                    ...
                ]
            },
            ...
        ]
    }

    Resposta: arquivo PDF (application/pdf), pronto para download/impressão.

Ver gerador_relatorio.py para a tabela completa de variáveis de entrada
e a lógica de cálculo das médias mensais.
"""

from __future__ import annotations

import io
import traceback

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

from gerador_relatorio import (
    DadosRelatorioMensal,
    RegistroDia,
    RegistroClasseDia,
    gerar_pdf_relatorio,
    calcular_agregados,
)

app = Flask(__name__)

# Libera CORS para o site React poder chamar esta API de outro domínio/porta.
# Em produção, troque "*" pela URL exata do site (ex: https://ebd-digital-web.vercel.app)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def _parse_payload(body: dict) -> DadosRelatorioMensal:
    """Converte o JSON recebido do site em DadosRelatorioMensal."""
    dias = []
    for dia_json in body.get("dias", []):
        classes = [
            RegistroClasseDia(
                classe=c["classe"],
                matriculados=int(c.get("matriculados", 0)),
                ausentes=int(c.get("ausentes", 0)),
                presentes=int(c.get("presentes", 0)),
                oferta=float(c.get("oferta", 0)),
                visitantes=int(c.get("visitantes", 0)),
                biblias=int(c.get("biblias", 0)),
                revistas=int(c.get("revistas", 0)),
            )
            for c in dia_json.get("classes", [])
        ]
        dias.append(RegistroDia(data=dia_json.get("data", ""), classes=classes))

    return DadosRelatorioMensal(
        congregacao=body.get("congregacao", ""),
        referencia_mes=body.get("referencia_mes", ""),
        dias=dias,
    )


@app.route("/api/relatorio-mensal/pdf", methods=["POST"])
def gerar_relatorio_pdf():
    """Recebe os dados do mês e devolve o PDF preenchido para download."""
    try:
        body = request.get_json(force=True)
        if not body:
            return jsonify({"erro": "Corpo da requisição vazio ou inválido."}), 400

        dados = _parse_payload(body)

        if not dados.congregacao or not dados.referencia_mes:
            return jsonify({"erro": "Campos 'congregacao' e 'referencia_mes' são obrigatórios."}), 400
        if not dados.dias:
            return jsonify({"erro": "É necessário enviar ao menos um dia em 'dias'."}), 400

        pdf_bytes = gerar_pdf_relatorio(dados)

        nome_arquivo = f"Relatorio_Mensal_{dados.referencia_mes}".replace(" ", "").replace("/", "-") + ".pdf"

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=nome_arquivo,
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": f"Falha ao gerar o PDF: {str(e)}"}), 500


@app.route("/api/relatorio-mensal/preview", methods=["POST"])
def previsualizar_calculos():
    """
    Endpoint auxiliar (não gera PDF): retorna em JSON os valores calculados
    (matrículas, frequência, faltas, ofertas) para o site poder exibir uma
    pré-visualização dos números antes de gerar o PDF final.
    """
    try:
        body = request.get_json(force=True)
        dados = _parse_payload(body)
        agregados = calcular_agregados(dados)
        return jsonify(agregados), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"erro": f"Falha ao calcular: {str(e)}"}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    """Endpoint simples para verificar se a API está no ar."""
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

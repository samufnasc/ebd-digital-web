# -*- coding: utf-8 -*-
"""Teste end-to-end da API usando o Flask test client, simulando exatamente
a chamada que o site React faria via fetch()."""
import json
from api import app

payload = {
    "congregacao": "Mensageiros da Fé",
    "referencia_mes": "Junho / 2026",
    "dias": [
        {
            "data": "07/06/2026",
            "classes": [
                {"classe": "Adonai", "matriculados": 15, "ausentes": 7, "presentes": 8, "oferta": 9.00, "biblias": 7, "revistas": 6},
                {"classe": "Geração Eleita", "matriculados": 17, "ausentes": 7, "presentes": 10, "oferta": 5.50, "biblias": 7, "revistas": 6},
                {"classe": "Jardim de Deus", "matriculados": 8, "ausentes": 4, "presentes": 4, "oferta": 0.00, "biblias": 4, "revistas": 0},
                {"classe": "Vencedores do Rei", "matriculados": 5, "ausentes": 2, "presentes": 3, "oferta": 9.00, "biblias": 3, "revistas": 0},
                {"classe": "Abraão", "matriculados": 6, "ausentes": 3, "presentes": 3, "oferta": 3.00, "biblias": 3, "revistas": 3},
                {"classe": "Crescendo com Cristo", "matriculados": 4, "ausentes": 2, "presentes": 2, "oferta": 0.00, "biblias": 2, "revistas": 2},
            ],
        },
        {
            "data": "18/06/2026",
            "classes": [
                {"classe": "Adonai", "matriculados": 0, "ausentes": 0, "presentes": 0, "oferta": 0.00},
                {"classe": "Geração Eleita", "matriculados": 0, "ausentes": 0, "presentes": 0, "oferta": 0.00},
                {"classe": "Jardim de Deus", "matriculados": 0, "ausentes": 0, "presentes": 0, "oferta": 0.00},
                {"classe": "Vencedores do Rei", "matriculados": 0, "ausentes": 0, "presentes": 0, "oferta": 0.00},
                {"classe": "Abraão", "matriculados": 6, "ausentes": 3, "presentes": 3, "oferta": 5.00, "biblias": 3, "revistas": 2},
                {"classe": "Crescendo com Cristo", "matriculados": 0, "ausentes": 0, "presentes": 0, "oferta": 0.00},
            ],
        },
        {
            "data": "21/06/2026",
            "classes": [
                {"classe": "Adonai", "matriculados": 15, "ausentes": 7, "presentes": 8, "oferta": 11.50, "biblias": 7, "revistas": 7},
                {"classe": "Geração Eleita", "matriculados": 17, "ausentes": 8, "presentes": 9, "oferta": 3.75, "biblias": 4, "revistas": 4},
                {"classe": "Jardim de Deus", "matriculados": 8, "ausentes": 2, "presentes": 6, "oferta": 5.00, "biblias": 2, "revistas": 3},
                {"classe": "Vencedores do Rei", "matriculados": 5, "ausentes": 2, "presentes": 3, "oferta": 4.00, "biblias": 2, "revistas": 2},
                {"classe": "Abraão", "matriculados": 6, "ausentes": 3, "presentes": 3, "oferta": 6.00, "biblias": 3, "revistas": 2},
                {"classe": "Crescendo com Cristo", "matriculados": 4, "ausentes": 2, "presentes": 2, "oferta": 2.00, "biblias": 1, "revistas": 2},
            ],
        },
        {
            "data": "28/06/2026",
            "classes": [
                {"classe": "Adonai", "matriculados": 15, "ausentes": 6, "presentes": 9, "oferta": 0.75, "biblias": 9, "revistas": 8},
                {"classe": "Geração Eleita", "matriculados": 17, "ausentes": 9, "presentes": 8, "oferta": 6.00, "biblias": 7, "revistas": 6},
                {"classe": "Jardim de Deus", "matriculados": 8, "ausentes": 2, "presentes": 6, "oferta": 1.25, "biblias": 3, "revistas": 3},
                {"classe": "Vencedores do Rei", "matriculados": 5, "ausentes": 5, "presentes": 0, "oferta": 0.00},
                {"classe": "Abraão", "matriculados": 6, "ausentes": 4, "presentes": 2, "oferta": 2.00, "biblias": 2, "revistas": 1},
                {"classe": "Crescendo com Cristo", "matriculados": 4, "ausentes": 4, "presentes": 0, "oferta": 0.00},
            ],
        },
    ],
}

client = app.test_client()

# 1) Testa o endpoint de health check
resp_health = client.get("/api/health")
print("HEALTH:", resp_health.status_code, resp_health.get_json())

# 2) Testa o endpoint de preview (cálculos em JSON)
resp_preview = client.post("/api/relatorio-mensal/preview", data=json.dumps(payload), content_type="application/json")
print("\nPREVIEW status:", resp_preview.status_code)
print(json.dumps(resp_preview.get_json(), indent=2, ensure_ascii=False))

# 3) Testa o endpoint de geração de PDF
resp_pdf = client.post("/api/relatorio-mensal/pdf", data=json.dumps(payload), content_type="application/json")
print("\nPDF status:", resp_pdf.status_code, "| content-type:", resp_pdf.content_type, "| bytes:", len(resp_pdf.data))

with open("teste_api_output.pdf", "wb") as f:
    f.write(resp_pdf.data)
print("PDF salvo em teste_api_output.pdf")

# Backend de Geração do Relatório Mensal (PDF) — EBD Digital Web

Backend Python (Flask) que gera o **Relatório Mensal da EBD** em PDF,
preenchido automaticamente a partir dos dados das classes, mantendo o
layout oficial exato (cabeçalho, brasão, bordas) do formulário da
COMADESMA/CGADB.

Esse backend foi feito para ser consumido pelo site
[ebd-digital-web](https://github.com/samufnasc/ebd-digital-web) via API,
sem precisar reescrever a lógica em JavaScript.

---

## 📁 Estrutura dos arquivos

```
ebd_pdf_service/
├── gerador_relatorio.py        # Lógica de cálculo + geração do PDF (núcleo)
├── api.py                      # API Flask (endpoints REST)
├── requirements.txt            # Dependências Python
├── templates_pdf/
│   └── RELATORIO_MENSAL.pdf    # PDF template oficial (não editar)
├── test_e2e.py                 # Teste de ponta a ponta da API
└── exemploIntegracaoReact.jsx  # Exemplo de chamada da API pelo site React
```

---

## ▶️ Como rodar localmente

```bash
cd ebd_pdf_service
pip install -r requirements.txt
python api.py
```

A API sobe em `http://localhost:5000`.

---

## 🔌 Endpoints disponíveis

### 1. `POST /api/relatorio-mensal/pdf`
Recebe os dados do mês e retorna o **arquivo PDF** já preenchido, pronto
para download/impressão.

### 2. `POST /api/relatorio-mensal/preview`
Mesmo payload de entrada, mas retorna os **valores calculados em JSON**
(sem gerar o PDF) — útil para o site mostrar uma pré-visualização dos
números antes de exportar.

### 3. `GET /api/health`
Verifica se a API está no ar. Retorna `{"status": "ok"}`.

---

## 📊 Tabela de variáveis de entrada (payload da API)

O site deve enviar, **para cada domingo do mês**, os dados de cada
classe. Estrutura do JSON:

```json
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
          "visitantes": 0,
          "biblias": 7,
          "revistas": 6,
          "oferta": 9.00
        }
      ]
    }
  ]
}
```

### Variáveis em nível de RELATÓRIO (mês inteiro)

| Variável         | Tipo   | Obrigatório | Descrição                                      |
|------------------|--------|:-----------:|--------------------------------------------------|
| `congregacao`    | string | ✅           | Nome da congregação (ex.: "Mensageiros da Fé")  |
| `referencia_mes` | string | ✅           | Mês/ano de referência (ex.: "Junho / 2026")     |
| `dias`           | lista  | ✅           | Lista de domingos do mês (ver abaixo)           |

### Variáveis em nível de DIA (cada domingo)

| Variável  | Tipo   | Obrigatório | Descrição                          |
|-----------|--------|:-----------:|-------------------------------------|
| `data`    | string | ✅           | Data do domingo, formato "DD/MM/AAAA" |
| `classes` | lista  | ✅           | Lista de classes naquele domingo    |

### Variáveis em nível de CLASSE (por domingo) — vêm direto da tabela "Relatório Geral" do site

| Variável       | Campo no site | Tipo  | Obrigatório | Descrição                              |
|----------------|---------------|-------|:-----------:|------------------------------------------|
| `classe`       | Classe        | string| ✅           | Nome da classe (ex.: "Adonai", "Abraão")|
| `matriculados` | Mat           | int   | ✅           | Total de matriculados                    |
| `ausentes`     | Aus           | int   | ✅           | Total de ausentes no dia                 |
| `presentes`    | Pres          | int   | ✅           | Total de presentes no dia                |
| `visitantes`   | Vis           | int   | opcional (0) | Total de visitantes no dia               |
| `biblias`      | Bíbl          | int   | opcional (0) | Quantidade de bíblias levadas            |
| `revistas`     | Rev           | int   | opcional (0) | Quantidade de revistas levadas           |
| `oferta`       | Oferta        | float | ✅           | Valor da oferta arrecadada (R$)         |

> 💡 **Dica de integração:** como essas colunas já existem na tabela
> "Relatório Geral" do seu site, basta mapear cada linha da tabela para
> esse formato JSON (ver `exemploIntegracaoReact.jsx`, função `montarPayload`).

---

## 🧮 Como a média mensal é calculada

O formulário oficial pede a **média percentual mensal de frequência e
faltas**, não apenas o valor de um domingo isolado. A lógica implementada:

1. Para cada classe, calcula-se o percentual de frequência em cada
   domingo (`presentes / matriculados`).
2. Se em algum domingo a classe não teve registro (matriculados = 0),
   esse domingo conta como **0% de frequência** naquele mês (regra
   confirmada com o usuário).
3. A média mensal de cada classe é a média desses percentuais.
4. Quando o campo oficial do formulário agrega mais de uma classe da
   igreja (ex.: **ADULTOS** = Geração Eleita + Abraão), o percentual
   final é uma **média ponderada pela matrícula** de cada classe — não
   uma média simples dos dois percentuais. Isso evita distorções quando
   as classes têm tamanhos diferentes.
5. As ofertas são somadas (não têm média) — total arrecadado no mês.
6. O total geral de cada seção (linha "TOTAL" do formulário) é a média
   simples dos percentuais dos campos preenchidos.

### Mapeamento de classes da igreja → campos oficiais do formulário

Definido em `MAPEAMENTO_CLASSES` dentro de `gerador_relatorio.py`:

| Campo oficial do formulário      | Classes da igreja (somadas)         |
|-----------------------------------|---------------------------------------|
| CLASSE OFICIAL (PROFESSORES)      | Adonai                               |
| ADULTOS                           | Geração Eleita + Abraão              |
| JOVENS                            | Vencedores do Rei                    |
| PRIMÁRIOS                         | Crescendo com Cristo                 |
| JARDIM DE INFÂNCIA                | Jardim de Deus                       |
| PRÉ-ADOLESCENTES, JUVENIS, ADOLESCENTES, JUNIORES, MATERNAL, BERÇÁRIO, DISCIPULADO | *(sem classe correspondente ainda — ficam em branco no PDF)* |

> Se a igreja criar novas classes no futuro (ex. uma turma de
> "Adolescentes"), basta editar esse dicionário em
> `gerador_relatorio.py` para mapear a nova classe ao campo certo.

---

## 🚀 Deploy em produção (sugestão)

Esse backend é leve e pode ser hospedado gratuitamente em serviços como:
- **Render** (free tier, fácil deploy via `requirements.txt`)
- **Railway**
- **Fly.io**

Depois de publicado, basta atualizar `API_BASE_URL` no arquivo
`exemploIntegracaoReact.jsx` (ou no `.env` do site) para a URL pública
do backend.

Lembre-se de restringir o CORS em `api.py` (`origins`) para a URL real
do site em produção, em vez de `"*"`, por segurança.

# Changelog - Melhorias Realizadas em 30/07/2026

## 1. Segurança: Credenciais do Supabase

**Problema**: As chaves `SUPABASE_URL` e `SUPABASE_KEY` estavam hardcoded em `src/lib/supabase.js`, expostas no código-fonte.

**Solução**:
- `.env` com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` (já existia mas não era usado)
- `src/lib/supabase.js` passou a ler de `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_KEY`
- `.env` adicionado ao `.gitignore`
- `.env.example` atualizado com placeholders corretos do Supabase (removido conteúdo obsoleto do Gemini)

**Arquivos alterados**:
- `src/lib/supabase.js` — linhas 3-4: remoção das chaves fixas
- `.gitignore` — adicionada regra `.env`
- `.env.example` — substituído placeholders

---

## 2. Persistência: Migração localStorage → Supabase

**Problema**: Os vínculos mensais e exclusões de alunos eram armazenados apenas no `localStorage` do navegador. Isso causava perda de dados ao limpar o cache, trocar de navegador ou acessar de outro dispositivo.

**Solução**:
- Criadas duas novas tabelas no Supabase:
  - `vinculos_mensais (aluno_id, mes, ano)` — registra em quais meses o aluno foi cadastrado
  - `exclusoes_mensais (aluno_id, mes, ano)` — registra em quais meses o aluno foi removido
- Novas funções assíncronas em `src/lib/supabase.js`:

| Função | Descrição |
|--------|-----------|
| `getVinculosMensaisSupabase()` | Busca vínculos do Supabase; fallback localStorage |
| `registrarVinculoMensalSupabase()` | Dual-write: Supabase + localStorage |
| `getExclusoesMensaisSupabase()` | Busca exclusões do Supabase; fallback localStorage |
| `registrarExclusaoMensalSupabase()` | Dual-write: Supabase + localStorage |
| `isAlunoExcluidoNoMesSupabase()` | Verifica exclusão no Supabase; fallback localStorage |
| `migrarVinculosParaSupabase()` | Migra dados existentes do localStorage para o Supabase |
| `getDebugInfo()` | Retorna debug de todos os vínculos/exclusões atuais |

- Quando o Supabase está disponível, é usado como **fonte única de verdade** (localStorage ignorado)
- Quando o Supabase falha (tabelas não existem), fallback para localStorage

**Arquivos alterados**:
- `src/lib/supabase.js` — +150 linhas de novas funções
- `docs/migracao_vinculos.sql` — script SQL para criar as tabelas (NOVO)

---

## 3. Lógica de Exclusão Cumulativa

**Problema**: Quando um aluno era deletado em um mês específico (ex: Julho), ele deixava de aparecer apenas naquele mês, mas reaparecia nos meses seguintes (Agosto, Setembro...). O comportamento esperado é: deletado em Julho → some de Julho em diante.

**Solução**:
- Nova função `temExclusaoAte(alunoId, month, year, exclusoesMap)` que verifica se existe **qualquer** exclusão do aluno com (ano, mês) <= (ano atual, mês atual)
- `isAlunoExcluidoNoMes()` refatorada para usar a nova lógica
- `filterAlunosByMonthYear()` modificada para usar `temExclusaoAte` em vez de verificar mês exato

**Comportamento**: deletar em Julho/2026 →
- Janeiro a Junho: **aparece** (histórico preservado)
- Julho em diante + anos futuros: **some**

**Arquivos alterados**:
- `src/lib/supabase.js` — funções `temExclusaoAte`, `isAlunoExcluidoNoMes`, `isAlunoExcluidoNoMesSupabase`, `filterAlunosByMonthYear`

---

## 4. Limpeza Final do Banco

Estado atual após reset:
- `alunos_ebd`: 55 alunos intactos (incluindo Karoline Poubel, Vanessa Lima, Tadeu)
- `vinculos_mensais`: 0 registros
- `exclusoes_mensais`: 0 registros
- `data_matricula` da Vanessa Lima restaurada para `2026-04-09`

---

## Arquivos Modificados (Resumo)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/supabase.js` | Modificado | Segurança + persistência Supabase + exclusão cumulativa |
| `.env.example` | Modificado | Placeholders do Supabase |
| `.gitignore` | Modificado | Regra `.env` adicionada |
| `docs/migracao_vinculos.sql` | **Novo** | SQL para criar tabelas de vínculos e exclusões |

---

## Fluxo para Novo Desenvolvedor

1. Clone o repositório
2. Copie `.env.example` para `.env` e preencha as chaves do Supabase
3. Execute `npm install` e `npm run dev`
4. Execute o SQL de `docs/migracao_vinculos.sql` no Supabase Dashboard
5. No console do navegador, rode `await migrarVinculosParaSupabase()` para migrar dados do localStorage (se houver)

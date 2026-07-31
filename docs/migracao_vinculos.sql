-- ============================================================
-- MIGRACAO: Vínculos Mensais e Exclusões Mensais
-- 
-- Execute este SQL no SQL Editor do Supabase Dashboard.
-- Cria as tabelas necessárias para persistir os vínculos
-- e exclusões de alunos por mês/ano no banco de dados,
-- substituindo o armazenamento local (localStorage).
-- ============================================================

-- 1. Tabela de vínculos mensais
-- Registra em quais meses/anos cada aluno foi cadastrado
CREATE TABLE IF NOT EXISTS vinculos_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES alunos_ebd(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, mes, ano)
);

-- 2. Tabela de exclusões mensais
-- Registra em quais meses/anos cada aluno foi removido da lista
CREATE TABLE IF NOT EXISTS exclusoes_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES alunos_ebd(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, mes, ano)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_vinculos_aluno ON vinculos_mensais(aluno_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_periodo ON vinculos_mensais(mes, ano);
CREATE INDEX IF NOT EXISTS idx_exclusoes_aluno ON exclusoes_mensais(aluno_id);
CREATE INDEX IF NOT EXISTS idx_exclusoes_periodo ON exclusoes_mensais(mes, ano);

-- 4. RLS (Row Level Security) - mesmo nível das tabelas existentes
ALTER TABLE vinculos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE exclusoes_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo para anon" ON vinculos_mensais
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir tudo para anon" ON exclusoes_mensais
  FOR ALL USING (true) WITH CHECK (true);

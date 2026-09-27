-- ============================================================
-- TABELAS PARA ACESSO DE PROFESSORES E REGISTRO DE FREQUÊNCIA
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================

-- 1. TABELA DE PROFESSORES VINCULADOS (Acesso do professor)
CREATE TABLE IF NOT EXISTS professores_acesso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,       -- Ex: 'Maria' (case-insensitive na autenticação)
  nome_completo TEXT NOT NULL,
  primeiro_nome TEXT NOT NULL,
  classe TEXT NOT NULL,                -- Ex: 'Cordeirinhos', 'Adonai'
  password TEXT NOT NULL DEFAULT '1234567',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE REGISTRO INDIVIDUAL DE CHAMADA / FREQUÊNCIA
CREATE TABLE IF NOT EXISTS chamadas_alunos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_aula DATE NOT NULL,
  classe TEXT NOT NULL,
  aluno_id UUID NOT NULL REFERENCES alunos_ebd(id) ON DELETE CASCADE,
  aluno_nome TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('presente', 'ausente')),
  trouxe_biblia BOOLEAN DEFAULT false,
  trouxe_revista BOOLEAN DEFAULT false,
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_aula, aluno_id)
);

-- 3. ÍNDICES DE BUSCA
CREATE INDEX IF NOT EXISTS idx_prof_username ON professores_acesso(username);
CREATE INDEX IF NOT EXISTS idx_chamada_data_classe ON chamadas_alunos(data_aula, classe);
CREATE INDEX IF NOT EXISTS idx_chamada_aluno ON chamadas_alunos(aluno_id);

-- 4. POLÍTICAS DE ACESSO (RLS)
ALTER TABLE professores_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamadas_alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública professores_acesso"
  ON professores_acesso FOR SELECT USING (true);

CREATE POLICY "Permitir inserção e atualização professores_acesso"
  ON professores_acesso FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Permitir tudo chamadas_alunos"
  ON chamadas_alunos FOR ALL USING (true) WITH CHECK (true);

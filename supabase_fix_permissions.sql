-- =====================================================
-- ONG GESTOR v5 — SQL DE CORREÇÃO DE PERMISSÕES
-- Execute este script no SQL Editor do Supabase
-- Inclui tabelas novas: ong_fases, ong_plano_aplicacao
-- =====================================================

-- ── 1. Garante que o schema public está acessível ──
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ── 2. Cria tabelas novas se não existirem ──
CREATE TABLE IF NOT EXISTS public.ong_fases (
  id                   TEXT PRIMARY KEY,
  projeto_id           TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  meta_id              TEXT REFERENCES public.ong_metas(id) ON DELETE CASCADE,
  numero_fase          INTEGER DEFAULT 1,
  descricao_fase       TEXT NOT NULL,
  produto              TEXT,
  unidade_medida       TEXT,
  quantidade_prevista  NUMERIC DEFAULT 0,
  quantidade_realizada NUMERIC DEFAULT 0,
  valor_previsto       NUMERIC DEFAULT 0,
  data_inicio          DATE,
  data_fim             DATE,
  status               TEXT DEFAULT 'Não Iniciada',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ong_plano_aplicacao (
  id               TEXT PRIMARY KEY,
  projeto_id       TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  meta_id          TEXT REFERENCES public.ong_metas(id) ON DELETE CASCADE,
  fase_id          TEXT REFERENCES public.ong_fases(id) ON DELETE SET NULL,
  descricao        TEXT NOT NULL,
  categoria        TEXT,
  natureza_despesa TEXT,
  unidade          TEXT,
  fonte            TEXT DEFAULT 'Repasse Federal',
  quantidade       NUMERIC DEFAULT 0,
  valor_unitario   NUMERIC DEFAULT 0,
  valor_previsto   NUMERIC DEFAULT 0,
  observacao       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Colunas adicionais em ong_projetos ──
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS termo_fomento         TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS numero_item           TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS deputado              TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS situacao              TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS responsavel_legal     TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS cpf_responsavel       TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS email_contato         TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS endereco_ong          TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS cnpj_concedente       TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS unidade_gestora       TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS programa_orcamentario TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS caracterizacao        TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS metas_pnc             TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS ppa_programa          TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS custeio               NUMERIC DEFAULT 0;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS investimento          NUMERIC DEFAULT 0;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS logo_url              TEXT;

-- ── 3b. Coluna nf_url na tabela de despesas (anexo NF/comprovante base64) ──
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS nf_url                TEXT;

-- ── 4. Garante GRANT completo em todas as tabelas ──
GRANT ALL PRIVILEGES ON public.ong_projetos        TO anon;
GRANT ALL PRIVILEGES ON public.ong_rubricas        TO anon;
GRANT ALL PRIVILEGES ON public.ong_despesas        TO anon;
GRANT ALL PRIVILEGES ON public.ong_metas           TO anon;
GRANT ALL PRIVILEGES ON public.ong_cronograma      TO anon;
GRANT ALL PRIVILEGES ON public.ong_documentos      TO anon;
GRANT ALL PRIVILEGES ON public.ong_fases           TO anon;
GRANT ALL PRIVILEGES ON public.ong_plano_aplicacao TO anon;

GRANT ALL PRIVILEGES ON public.ong_projetos        TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_rubricas        TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_despesas        TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_metas           TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_cronograma      TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_documentos      TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_fases           TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_plano_aplicacao TO authenticated;

-- ── 5. Remove políticas antigas (se existirem) ──
DROP POLICY IF EXISTS anon_all ON public.ong_projetos;
DROP POLICY IF EXISTS anon_all ON public.ong_rubricas;
DROP POLICY IF EXISTS anon_all ON public.ong_despesas;
DROP POLICY IF EXISTS anon_all ON public.ong_metas;
DROP POLICY IF EXISTS anon_all ON public.ong_cronograma;
DROP POLICY IF EXISTS anon_all ON public.ong_documentos;
DROP POLICY IF EXISTS anon_all ON public.ong_fases;
DROP POLICY IF EXISTS anon_all ON public.ong_plano_aplicacao;

DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_projetos;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_rubricas;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_despesas;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_metas;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_cronograma;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_documentos;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_fases;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_plano_aplicacao;

-- ── 6. Habilita RLS ──
ALTER TABLE public.ong_projetos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_rubricas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_despesas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_metas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_cronograma      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_documentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_fases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_plano_aplicacao ENABLE ROW LEVEL SECURITY;

-- ── 7. Cria políticas permissivas completas ──
CREATE POLICY anon_all ON public.ong_projetos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_rubricas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_despesas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_metas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_cronograma
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_documentos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_fases
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_plano_aplicacao
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── 8. Índices para as novas tabelas ──
CREATE INDEX IF NOT EXISTS idx_fases_projeto      ON public.ong_fases(projeto_id);
CREATE INDEX IF NOT EXISTS idx_fases_meta         ON public.ong_fases(meta_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_projeto  ON public.ong_plano_aplicacao(projeto_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_meta     ON public.ong_plano_aplicacao(meta_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_fase     ON public.ong_plano_aplicacao(fase_id);

-- ── 9. Verifica resultado ──
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN (
  'ong_projetos','ong_rubricas','ong_despesas','ong_metas',
  'ong_cronograma','ong_documentos','ong_fases','ong_plano_aplicacao'
)
ORDER BY tablename;

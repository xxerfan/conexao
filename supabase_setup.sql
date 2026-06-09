-- =====================================================
-- ONG GESTOR v5 — Setup Supabase SQL COMPLETO
-- ▸ Execute inteiro no SQL Editor do Supabase Dashboard
-- ▸ Script idempotente: pode rodar várias vezes sem erro
-- ▸ Última atualização: v5.5 — Plano de Trabalho TransfereGov
--   + Progresso Rápido + Cronograma Inteligente + NF upload
-- =====================================================

-- ══════════════════════════════════════════════════════
-- SEÇÃO 1 — TABELAS PRINCIPAIS
-- ══════════════════════════════════════════════════════

-- ── 1.1 PROJETOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_projetos (
  id                    TEXT PRIMARY KEY,
  nome_projeto          TEXT NOT NULL,
  numero_proposta       TEXT,
  termo_fomento         TEXT,           -- Nº Termo de Fomento
  numero_item           TEXT,           -- Item da emenda / ação orçamentária (ex: 20ZF)
  deputado              TEXT,           -- Parlamentar vinculado
  situacao              TEXT,           -- Situação no TransfereGov (Em Elaboração, Aprovada...)
  modalidade            TEXT DEFAULT 'Termo de Fomento',
  status                TEXT DEFAULT 'Em Execução',
  ong_nome              TEXT,
  ong_cnpj              TEXT,
  responsavel_legal     TEXT,
  cpf_responsavel       TEXT,
  email_contato         TEXT,
  endereco_ong          TEXT,
  logo_url              TEXT,           -- Logo da ONG (base64 ou URL)
  concedente            TEXT,
  cnpj_concedente       TEXT,
  unidade_gestora       TEXT,
  programa_orcamentario TEXT,
  municipio             TEXT,
  uf                    TEXT,
  publico_beneficiario  TEXT,
  objeto                TEXT,
  caracterizacao        TEXT,           -- Caracterização dos Interesses Recíprocos
  metas_pnc             TEXT,           -- Metas do Plano Nacional de Cultura
  ppa_programa          TEXT,           -- PPA / Programa Orçamentário
  valor_repasse         NUMERIC DEFAULT 0,
  valor_contrapartida   NUMERIC DEFAULT 0,
  custeio               NUMERIC DEFAULT 0,
  investimento          NUMERIC DEFAULT 0,
  valor_total           NUMERIC DEFAULT 0,
  data_inicio           DATE,
  data_fim              DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas adicionais (idempotente — safe em bancos existentes)
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS termo_fomento         TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS numero_item           TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS deputado              TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS situacao              TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS responsavel_legal     TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS cpf_responsavel       TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS email_contato         TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS endereco_ong          TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS logo_url              TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS cnpj_concedente       TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS unidade_gestora       TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS programa_orcamentario TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS caracterizacao        TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS metas_pnc             TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS ppa_programa          TEXT;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS custeio               NUMERIC DEFAULT 0;
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS investimento          NUMERIC DEFAULT 0;


-- ── 1.2 RUBRICAS ORÇAMENTÁRIAS ────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_rubricas (
  id              TEXT PRIMARY KEY,
  projeto_id      TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL,
  descricao       TEXT,
  unidade         TEXT DEFAULT 'Un',
  quantidade      NUMERIC DEFAULT 0,
  valor_unitario  NUMERIC DEFAULT 0,
  valor_previsto  NUMERIC DEFAULT 0,
  fonte           TEXT DEFAULT 'Repasse Federal',
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_rubricas ADD COLUMN IF NOT EXISTS observacao TEXT;


-- ── 1.3 METAS E INDICADORES ───────────────────────────
-- ⚠ valor_executado é HISTÓRICO/MANUAL — o sistema calcula dinamicamente
--   a execução financeira proporcional das despesas reais (não usar para exibição)
CREATE TABLE IF NOT EXISTS public.ong_metas (
  id                     TEXT PRIMARY KEY,
  projeto_id             TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  numero_meta            INTEGER DEFAULT 1,
  descricao_meta         TEXT NOT NULL,
  indicador              TEXT,
  beneficiarios_previstos  INTEGER DEFAULT 0,
  beneficiarios_atendidos  INTEGER DEFAULT 0,
  percentual_fisico      NUMERIC DEFAULT 0,    -- % execução física (0–100)
  valor_previsto         NUMERIC DEFAULT 0,
  valor_executado        NUMERIC DEFAULT 0,    -- legado; cálculo dinâmico feito no frontend
  data_inicio            DATE,
  data_fim               DATE,
  status                 TEXT DEFAULT 'Em Andamento',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS percentual_fisico        NUMERIC DEFAULT 0;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS beneficiarios_previstos  INTEGER DEFAULT 0;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS beneficiarios_atendidos  INTEGER DEFAULT 0;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS data_inicio              DATE;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS data_fim                 DATE;


-- ── 1.4 ETAPAS / FASES (Seção 6 TransfereGov) ─────────
CREATE TABLE IF NOT EXISTS public.ong_fases (
  id                   TEXT PRIMARY KEY,
  projeto_id           TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  meta_id              TEXT REFERENCES public.ong_metas(id) ON DELETE CASCADE,
  numero_fase          INTEGER DEFAULT 1,
  descricao_fase       TEXT NOT NULL,
  produto              TEXT,           -- Produto / Entrega esperada
  unidade_medida       TEXT,           -- Ex: Oficinas, Módulos, Pessoas, Horas
  quantidade_prevista  NUMERIC DEFAULT 0,
  quantidade_realizada NUMERIC DEFAULT 0,
  valor_previsto       NUMERIC DEFAULT 0,
  data_inicio          DATE,
  data_fim             DATE,
  status               TEXT DEFAULT 'Não Iniciada',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS produto           TEXT;
ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS unidade_medida    TEXT;
ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS quantidade_realizada NUMERIC DEFAULT 0;


-- ── 1.5 PLANO DE APLICAÇÃO (Seção 9 TransfereGov) ──────
CREATE TABLE IF NOT EXISTS public.ong_plano_aplicacao (
  id               TEXT PRIMARY KEY,
  projeto_id       TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  meta_id          TEXT REFERENCES public.ong_metas(id) ON DELETE CASCADE,
  fase_id          TEXT REFERENCES public.ong_fases(id) ON DELETE SET NULL,
  descricao        TEXT NOT NULL,
  categoria        TEXT,              -- Categoria de despesa
  natureza_despesa TEXT,              -- Custeio / Investimento
  unidade          TEXT,              -- Unidade de medida do item
  fonte            TEXT DEFAULT 'Repasse Federal',
  quantidade       NUMERIC DEFAULT 0,
  valor_unitario   NUMERIC DEFAULT 0,
  valor_previsto   NUMERIC DEFAULT 0,
  observacao       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_plano_aplicacao ADD COLUMN IF NOT EXISTS observacao TEXT;


-- ── 1.6 DESPESAS / LANÇAMENTOS ────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_despesas (
  id                TEXT PRIMARY KEY,
  projeto_id        TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id        TEXT REFERENCES public.ong_rubricas(id) ON DELETE SET NULL,
  data_despesa      DATE,
  mes_referencia    TEXT,             -- YYYY-MM (ex: 2025-03)
  descricao         TEXT,
  fornecedor        TEXT,
  cnpj_cpf          TEXT,
  tipo_documento    TEXT,             -- NF, RPA, Recibo, Folha, etc.
  numero_documento  TEXT,
  valor             NUMERIC DEFAULT 0,
  fonte             TEXT DEFAULT 'Repasse Federal',
  status_pagamento  TEXT DEFAULT 'A Pagar',
  nf_url            TEXT,             -- NF/comprovante em base64 ou URL
  observacao        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS nf_url         TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS tipo_documento  TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS mes_referencia  TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS projeto_id      TEXT;


-- ── 1.7 CRONOGRAMA FINANCEIRO ─────────────────────────
-- Previsto por rubrica × mês (preenchido via Distribuição Inteligente)
CREATE TABLE IF NOT EXISTS public.ong_cronograma (
  id             TEXT PRIMARY KEY,
  projeto_id     TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id     TEXT REFERENCES public.ong_rubricas(id) ON DELETE CASCADE,
  mes            TEXT NOT NULL,        -- YYYY-MM
  valor_previsto NUMERIC DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ── 1.8 DOCUMENTOS E ANEXOS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_documentos (
  id          TEXT PRIMARY KEY,
  projeto_id  TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id  TEXT,                    -- Rubrica relacionada (opcional)
  despesa_id  TEXT,                    -- Despesa relacionada (opcional)
  nome        TEXT NOT NULL,
  tipo        TEXT,                    -- Contrato, Edital, NF, Relatório, etc.
  descricao   TEXT,
  url         TEXT,                    -- base64 ou URL externa
  tamanho     TEXT,
  criado_em   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_documentos ADD COLUMN IF NOT EXISTS rubrica_id TEXT;
ALTER TABLE public.ong_documentos ADD COLUMN IF NOT EXISTS despesa_id TEXT;


-- ══════════════════════════════════════════════════════
-- SEÇÃO 2 — ÍNDICES PARA PERFORMANCE
-- ══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_rubricas_projeto      ON public.ong_rubricas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_metas_projeto         ON public.ong_metas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_fases_projeto         ON public.ong_fases(projeto_id);
CREATE INDEX IF NOT EXISTS idx_fases_meta            ON public.ong_fases(meta_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_projeto     ON public.ong_plano_aplicacao(projeto_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_meta        ON public.ong_plano_aplicacao(meta_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_fase        ON public.ong_plano_aplicacao(fase_id);
CREATE INDEX IF NOT EXISTS idx_despesas_projeto      ON public.ong_despesas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_despesas_rubrica      ON public.ong_despesas(rubrica_id);
CREATE INDEX IF NOT EXISTS idx_despesas_mes          ON public.ong_despesas(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_cronograma_projeto    ON public.ong_cronograma(projeto_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_rubrica    ON public.ong_cronograma(rubrica_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_mes        ON public.ong_cronograma(mes);
CREATE INDEX IF NOT EXISTS idx_documentos_projeto    ON public.ong_documentos(projeto_id);


-- ══════════════════════════════════════════════════════
-- SEÇÃO 3 — PERMISSÕES (RLS + GRANTS)
-- ══════════════════════════════════════════════════════

-- ── 3.1 Schema público acessível ──
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ── 3.2 Grants completos em todas as tabelas ──
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

-- ── 3.3 Remove políticas antigas (evita duplicata) ──
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'ong_projetos','ong_rubricas','ong_despesas','ong_metas',
    'ong_cronograma','ong_documentos','ong_fases','ong_plano_aplicacao'
  ]) LOOP
    FOR pol IN SELECT unnest(ARRAY['anon_all','Allow all for anon','allow_all','public_access']) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ── 3.4 Habilita RLS em todas as tabelas ──
ALTER TABLE public.ong_projetos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_rubricas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_despesas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_metas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_cronograma      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_documentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_fases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_plano_aplicacao ENABLE ROW LEVEL SECURITY;

-- ── 3.5 Cria políticas permissivas (acesso total via anon key) ──
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


-- ══════════════════════════════════════════════════════
-- SEÇÃO 4 — VERIFICAÇÃO FINAL
-- ══════════════════════════════════════════════════════

-- Lista tabelas criadas com contagem de colunas
SELECT 
  c.table_name,
  COUNT(c.column_name)       AS colunas,
  obj_description(pc.oid)    AS comentario
FROM information_schema.columns c
JOIN pg_class pc ON pc.relname = c.table_name
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'ong_projetos','ong_rubricas','ong_despesas','ong_metas',
    'ong_cronograma','ong_documentos','ong_fases','ong_plano_aplicacao'
  )
GROUP BY c.table_name, pc.oid
ORDER BY c.table_name;

-- Lista políticas RLS ativas
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

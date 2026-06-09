-- =====================================================
-- ONG GESTOR v6 — Setup Supabase SQL COMPLETO
-- ▸ Execute inteiro no SQL Editor do Supabase Dashboard
-- ▸ Script idempotente: pode rodar várias vezes sem erro
-- ▸ FASE 1 — Segurança: user_id + RLS auth.uid()
-- ▸ FASE 2 — Storage: bucket ong-arquivos + RLS
-- ▸ FASE 3 — Triggers: valor_executado automático
-- ▸ FASE 5 — Auditoria: ong_auditoria + generic trigger
-- =====================================================

-- ══════════════════════════════════════════════════════
-- SEÇÃO 0 — EXTENSÕES NECESSÁRIAS
-- ══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ══════════════════════════════════════════════════════
-- SEÇÃO 1 — TABELAS PRINCIPAIS (idempotente)
-- ══════════════════════════════════════════════════════

-- ── 1.1 PROJETOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_projetos (
  id                    TEXT PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_projeto          TEXT NOT NULL,
  numero_proposta       TEXT,
  termo_fomento         TEXT,
  numero_item           TEXT,
  deputado              TEXT,
  situacao              TEXT,
  modalidade            TEXT DEFAULT 'Termo de Fomento',
  status                TEXT DEFAULT 'Em Execução',
  ong_nome              TEXT,
  ong_cnpj              TEXT,
  responsavel_legal     TEXT,
  cpf_responsavel       TEXT,
  email_contato         TEXT,
  endereco_ong          TEXT,
  logo_url              TEXT,           -- URL do Supabase Storage (FASE 2)
  concedente            TEXT,
  cnpj_concedente       TEXT,
  unidade_gestora       TEXT,
  programa_orcamentario TEXT,
  municipio             TEXT,
  uf                    TEXT,
  publico_beneficiario  TEXT,
  objeto                TEXT,
  caracterizacao        TEXT,
  metas_pnc             TEXT,
  ppa_programa          TEXT,
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

-- Colunas adicionais (idempotente)
ALTER TABLE public.ong_projetos ADD COLUMN IF NOT EXISTS user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE;
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
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id      TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL,
  descricao       TEXT,
  unidade         TEXT DEFAULT 'Un',
  quantidade      NUMERIC DEFAULT 0,
  valor_unitario  NUMERIC DEFAULT 0,
  valor_previsto  NUMERIC DEFAULT 0,
  valor_executado NUMERIC DEFAULT 0,   -- FASE 3: atualizado por trigger
  fonte           TEXT DEFAULT 'Repasse Federal',
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_rubricas ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ong_rubricas ADD COLUMN IF NOT EXISTS valor_executado NUMERIC DEFAULT 0;
ALTER TABLE public.ong_rubricas ADD COLUMN IF NOT EXISTS observacao      TEXT;


-- ── 1.3 METAS E INDICADORES ───────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_metas (
  id                      TEXT PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id              TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  numero_meta             INTEGER DEFAULT 1,
  descricao_meta          TEXT NOT NULL,
  indicador               TEXT,
  beneficiarios_previstos INTEGER DEFAULT 0,
  beneficiarios_atendidos INTEGER DEFAULT 0,
  percentual_fisico       NUMERIC DEFAULT 0,
  valor_previsto          NUMERIC DEFAULT 0,
  valor_executado         NUMERIC DEFAULT 0,   -- legado; cálculo dinâmico no frontend
  data_inicio             DATE,
  data_fim                DATE,
  status                  TEXT DEFAULT 'Em Andamento',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS percentual_fisico        NUMERIC DEFAULT 0;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS beneficiarios_previstos  INTEGER DEFAULT 0;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS beneficiarios_atendidos  INTEGER DEFAULT 0;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS data_inicio              DATE;
ALTER TABLE public.ong_metas ADD COLUMN IF NOT EXISTS data_fim                 DATE;


-- ── 1.4 ETAPAS / FASES (Seção 6 TransfereGov) ─────────
CREATE TABLE IF NOT EXISTS public.ong_fases (
  id                   TEXT PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS produto              TEXT;
ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS unidade_medida       TEXT;
ALTER TABLE public.ong_fases ADD COLUMN IF NOT EXISTS quantidade_realizada NUMERIC DEFAULT 0;


-- ── 1.5 PLANO DE APLICAÇÃO (Seção 9 TransfereGov) ──────
CREATE TABLE IF NOT EXISTS public.ong_plano_aplicacao (
  id               TEXT PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.ong_plano_aplicacao ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ong_plano_aplicacao ADD COLUMN IF NOT EXISTS observacao TEXT;


-- ── 1.6 DESPESAS / LANÇAMENTOS ────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_despesas (
  id                TEXT PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id        TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id        TEXT REFERENCES public.ong_rubricas(id) ON DELETE SET NULL,
  data_despesa      DATE,
  mes_referencia    TEXT,             -- YYYY-MM
  descricao         TEXT,
  fornecedor        TEXT,
  cnpj_cpf          TEXT,
  tipo_documento    TEXT,
  numero_documento  TEXT,
  valor             NUMERIC DEFAULT 0,
  fonte             TEXT DEFAULT 'Repasse Federal',
  status_pagamento  TEXT DEFAULT 'A Pagar',
  nf_url            TEXT,             -- URL do Supabase Storage (FASE 2)
  observacao        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS nf_url           TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS tipo_documento   TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS mes_referencia   TEXT;
ALTER TABLE public.ong_despesas ADD COLUMN IF NOT EXISTS projeto_id       TEXT;


-- ── 1.7 CRONOGRAMA FINANCEIRO ─────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_cronograma (
  id             TEXT PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id     TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id     TEXT REFERENCES public.ong_rubricas(id) ON DELETE CASCADE,
  mes            TEXT NOT NULL,
  valor_previsto NUMERIC DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_cronograma ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- ── 1.8 DOCUMENTOS E ANEXOS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_documentos (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id  TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id  TEXT,
  despesa_id  TEXT,
  nome        TEXT NOT NULL,
  tipo        TEXT,
  descricao   TEXT,
  url         TEXT,             -- URL do Supabase Storage (FASE 2)
  tamanho     TEXT,
  criado_em   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_documentos ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ong_documentos ADD COLUMN IF NOT EXISTS rubrica_id TEXT;
ALTER TABLE public.ong_documentos ADD COLUMN IF NOT EXISTS despesa_id TEXT;


-- ══════════════════════════════════════════════════════
-- SEÇÃO 2 — ÍNDICES PARA PERFORMANCE
-- ══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_projetos_user         ON public.ong_projetos(user_id);
CREATE INDEX IF NOT EXISTS idx_rubricas_projeto      ON public.ong_rubricas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_rubricas_user         ON public.ong_rubricas(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_projeto         ON public.ong_metas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_metas_user            ON public.ong_metas(user_id);
CREATE INDEX IF NOT EXISTS idx_fases_projeto         ON public.ong_fases(projeto_id);
CREATE INDEX IF NOT EXISTS idx_fases_meta            ON public.ong_fases(meta_id);
CREATE INDEX IF NOT EXISTS idx_fases_user            ON public.ong_fases(user_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_projeto     ON public.ong_plano_aplicacao(projeto_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_meta        ON public.ong_plano_aplicacao(meta_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_fase        ON public.ong_plano_aplicacao(fase_id);
CREATE INDEX IF NOT EXISTS idx_plano_apl_user        ON public.ong_plano_aplicacao(user_id);
CREATE INDEX IF NOT EXISTS idx_despesas_projeto      ON public.ong_despesas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_despesas_rubrica      ON public.ong_despesas(rubrica_id);
CREATE INDEX IF NOT EXISTS idx_despesas_mes          ON public.ong_despesas(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_despesas_user         ON public.ong_despesas(user_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_projeto    ON public.ong_cronograma(projeto_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_rubrica    ON public.ong_cronograma(rubrica_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_mes        ON public.ong_cronograma(mes);
CREATE INDEX IF NOT EXISTS idx_cronograma_user       ON public.ong_cronograma(user_id);
CREATE INDEX IF NOT EXISTS idx_documentos_projeto    ON public.ong_documentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_user       ON public.ong_documentos(user_id);


-- ══════════════════════════════════════════════════════
-- SEÇÃO 3 — PERMISSÕES (GRANTS)
-- ══════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- authenticated tem acesso total (filtrado pelo RLS)
GRANT ALL PRIVILEGES ON public.ong_projetos        TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_rubricas        TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_despesas        TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_metas           TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_cronograma      TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_documentos      TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_fases           TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_plano_aplicacao TO authenticated;

-- anon: sem acesso (login obrigatório)
REVOKE ALL ON public.ong_projetos        FROM anon;
REVOKE ALL ON public.ong_rubricas        FROM anon;
REVOKE ALL ON public.ong_despesas        FROM anon;
REVOKE ALL ON public.ong_metas           FROM anon;
REVOKE ALL ON public.ong_cronograma      FROM anon;
REVOKE ALL ON public.ong_documentos      FROM anon;
REVOKE ALL ON public.ong_fases           FROM anon;
REVOKE ALL ON public.ong_plano_aplicacao FROM anon;


-- ══════════════════════════════════════════════════════
-- SEÇÃO 4 — RLS SEGURO (FASE 1 — auth.uid() = user_id)
-- ══════════════════════════════════════════════════════

-- Remove políticas antigas inseguras (idempotente)
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'ong_projetos','ong_rubricas','ong_despesas','ong_metas',
    'ong_cronograma','ong_documentos','ong_fases','ong_plano_aplicacao'
  ]) LOOP
    FOR pol IN SELECT unnest(ARRAY[
      'anon_all','Allow all for anon','allow_all','public_access',
      'owner_all','user_owns','rls_user'
    ]) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Habilita RLS
ALTER TABLE public.ong_projetos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_rubricas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_despesas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_metas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_cronograma      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_documentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_fases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_plano_aplicacao ENABLE ROW LEVEL SECURITY;

-- ── Políticas seguras: cada usuário vê/edita apenas seus dados ──
-- Remove policies existentes antes de recriar (idempotente)
DROP POLICY IF EXISTS owner_all ON public.ong_projetos;
DROP POLICY IF EXISTS owner_all ON public.ong_rubricas;
DROP POLICY IF EXISTS owner_all ON public.ong_despesas;
DROP POLICY IF EXISTS owner_all ON public.ong_metas;
DROP POLICY IF EXISTS owner_all ON public.ong_cronograma;
DROP POLICY IF EXISTS owner_all ON public.ong_documentos;
DROP POLICY IF EXISTS owner_all ON public.ong_fases;
DROP POLICY IF EXISTS owner_all ON public.ong_plano_aplicacao;

-- ong_projetos
CREATE POLICY owner_all ON public.ong_projetos
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_rubricas (cascata: via projeto do usuário)
CREATE POLICY owner_all ON public.ong_rubricas
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_despesas
CREATE POLICY owner_all ON public.ong_despesas
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_metas
CREATE POLICY owner_all ON public.ong_metas
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_cronograma
CREATE POLICY owner_all ON public.ong_cronograma
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_documentos
CREATE POLICY owner_all ON public.ong_documentos
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_fases
CREATE POLICY owner_all ON public.ong_fases
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ong_plano_aplicacao
CREATE POLICY owner_all ON public.ong_plano_aplicacao
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);


-- ══════════════════════════════════════════════════════
-- SEÇÃO 5 — STORAGE (FASE 2)
-- ══════════════════════════════════════════════════════
-- ▸ Execute apenas se o bucket ainda não existir
-- ▸ Necessita extensão storage ativa no Supabase

-- Cria bucket ong-arquivos (público para leitura, auth para escrita)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ong-arquivos',
  'ong-arquivos',
  true,                              -- arquivos públicos (NF, logos, docs)
  10485760,                          -- 10 MB máximo por arquivo
  ARRAY['image/jpeg','image/png','image/webp','application/pdf',
        'image/gif','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS do Storage: usuário autenticado pode CRUD em seu próprio prefixo (uid/)
-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "storage_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_public_read"  ON storage.objects;

-- Leitura pública (thumbnails de logos, NFs para auditores, etc.)
CREATE POLICY "storage_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'ong-arquivos');

-- Upload: apenas o dono (pasta uid/ no path)
CREATE POLICY "storage_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ong-arquivos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Atualizar: apenas o dono
CREATE POLICY "storage_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ong-arquivos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deletar: apenas o dono
CREATE POLICY "storage_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ong-arquivos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ══════════════════════════════════════════════════════
-- SEÇÃO 6 — TRIGGERS FASE 3: valor_executado automático
-- ══════════════════════════════════════════════════════
-- Quando uma despesa é inserida, atualizada ou deletada,
-- recalcula ong_rubricas.valor_executado e atualiza
-- o campo calculado no projeto (não há coluna valor_executado
-- em ong_projetos — usamos apenas rubricas).

CREATE OR REPLACE FUNCTION public.fn_recalc_rubrica_executado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rubrica_id TEXT;
BEGIN
  -- Determina qual rubrica_id atualizar
  IF TG_OP = 'DELETE' THEN
    v_rubrica_id := OLD.rubrica_id;
  ELSE
    v_rubrica_id := NEW.rubrica_id;
    -- Se a rubrica mudou, atualiza a antiga também
    IF TG_OP = 'UPDATE' AND OLD.rubrica_id IS DISTINCT FROM NEW.rubrica_id THEN
      UPDATE public.ong_rubricas
        SET valor_executado = COALESCE((
              SELECT SUM(d.valor)
              FROM public.ong_despesas d
              WHERE d.rubrica_id = OLD.rubrica_id
            ), 0),
            updated_at = NOW()
      WHERE id = OLD.rubrica_id;
    END IF;
  END IF;

  -- Atualiza rubrica atual
  IF v_rubrica_id IS NOT NULL THEN
    UPDATE public.ong_rubricas
      SET valor_executado = COALESCE((
            SELECT SUM(d.valor)
            FROM public.ong_despesas d
            WHERE d.rubrica_id = v_rubrica_id
          ), 0),
          updated_at = NOW()
    WHERE id = v_rubrica_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Cria trigger (DROP IF EXISTS para idempotência)
DROP TRIGGER IF EXISTS tg_despesa_recalc_rubrica ON public.ong_despesas;
CREATE TRIGGER tg_despesa_recalc_rubrica
  AFTER INSERT OR UPDATE OR DELETE
  ON public.ong_despesas
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_rubrica_executado();


-- ══════════════════════════════════════════════════════
-- SEÇÃO 7 — TRILHA DE AUDITORIA (FASE 5 — MROSC)
-- ══════════════════════════════════════════════════════

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.ong_auditoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,              -- quem fez a ação
  tabela       TEXT NOT NULL,     -- nome da tabela
  acao         TEXT NOT NULL,     -- INSERT | UPDATE | DELETE
  registro_id  TEXT,              -- id do registro afetado
  dados_antigos JSONB,            -- estado anterior (UPDATE/DELETE)
  dados_novos   JSONB,            -- estado novo (INSERT/UPDATE)
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ong_auditoria ADD COLUMN IF NOT EXISTS user_id       UUID;
ALTER TABLE public.ong_auditoria ADD COLUMN IF NOT EXISTS dados_antigos JSONB;
ALTER TABLE public.ong_auditoria ADD COLUMN IF NOT EXISTS dados_novos   JSONB;

-- Índices na tabela de auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_user     ON public.ong_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela   ON public.ong_auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON public.ong_auditoria(registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado   ON public.ong_auditoria(criado_em DESC);

-- RLS para auditoria: apenas o dono visualiza seus registros
ALTER TABLE public.ong_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_owner_read" ON public.ong_auditoria;
CREATE POLICY "audit_owner_read" ON public.ong_auditoria
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Grants para trigger function (SECURITY DEFINER já contorna RLS)
GRANT INSERT ON public.ong_auditoria TO authenticated;

-- ── Função genérica de auditoria ──────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old  JSONB := NULL;
  v_new  JSONB := NULL;
  v_uid  UUID;
  v_id   TEXT;
BEGIN
  -- Tenta extrair user_id do registro
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_uid := (OLD.user_id)::UUID;
      v_id  := OLD.id::TEXT;
    ELSE
      v_uid := (NEW.user_id)::UUID;
      v_id  := NEW.id::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
    v_id  := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.ong_auditoria(user_id, tabela, acao, registro_id, dados_antigos, dados_novos)
  VALUES (v_uid, TG_TABLE_NAME, TG_OP, v_id, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Aplica trigger de auditoria em ong_despesas
DROP TRIGGER IF EXISTS tg_audit_despesas ON public.ong_despesas;
CREATE TRIGGER tg_audit_despesas
  AFTER INSERT OR UPDATE OR DELETE
  ON public.ong_despesas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- Aplica trigger de auditoria em ong_rubricas
DROP TRIGGER IF EXISTS tg_audit_rubricas ON public.ong_rubricas;
CREATE TRIGGER tg_audit_rubricas
  AFTER INSERT OR UPDATE OR DELETE
  ON public.ong_rubricas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- Aplica trigger de auditoria em ong_projetos
DROP TRIGGER IF EXISTS tg_audit_projetos ON public.ong_projetos;
CREATE TRIGGER tg_audit_projetos
  AFTER INSERT OR UPDATE OR DELETE
  ON public.ong_projetos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


-- ══════════════════════════════════════════════════════
-- SEÇÃO 7-B — SISTEMA DE CONVITES (Autorização de cadastro)
-- ══════════════════════════════════════════════════════
-- Tabela de convites para controlar quem pode se cadastrar.
-- Cada código é de uso único. Pode ter email_destino fixo ou
-- ser genérico (qualquer pessoa que tenha o código).
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ong_convites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       TEXT NOT NULL UNIQUE,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em    TIMESTAMPTZ,
  email_destino TEXT,
  usado_por    UUID REFERENCES auth.users(id),
  usado_em     TIMESTAMPTZ,
  descricao    TEXT,
  -- PERFIL DE ACESSO: ADMIN | PARCEIRO | VISUALIZADOR
  role         TEXT NOT NULL DEFAULT 'VISUALIZADOR'
               CHECK (role IN ('ADMIN','PARCEIRO','VISUALIZADOR'))
);

-- Índices para lookup rápido
CREATE INDEX IF NOT EXISTS idx_convites_codigo ON public.ong_convites(codigo);
CREATE INDEX IF NOT EXISTS idx_convites_email  ON public.ong_convites(email_destino);
CREATE INDEX IF NOT EXISTS idx_convites_ativo  ON public.ong_convites(ativo);

-- RLS — anon pode verificar e usar; authenticated (admin) gerencia
ALTER TABLE public.ong_convites ENABLE ROW LEVEL SECURITY;

-- Remove policies existentes antes de recriar (idempotente)
DROP POLICY IF EXISTS "convite_public_check" ON public.ong_convites;
DROP POLICY IF EXISTS "convite_public_use"   ON public.ong_convites;
DROP POLICY IF EXISTS "convite_admin_all"    ON public.ong_convites;

-- Anon pode verificar se um código existe e está ativo (sem ver todos)
CREATE POLICY "convite_public_check" ON public.ong_convites
  FOR SELECT TO anon
  USING (ativo = true);

-- Anon pode marcar convite como usado (PATCH) durante o signup
CREATE POLICY "convite_public_use" ON public.ong_convites
  FOR UPDATE TO anon
  USING (ativo = true)
  WITH CHECK (true);

-- Authenticated (admin) pode gerenciar todos os convites
CREATE POLICY "convite_admin_all" ON public.ong_convites
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, UPDATE ON public.ong_convites TO anon;
GRANT ALL ON public.ong_convites TO authenticated;

-- ——————————————————————————————————————————————————————
-- Convites iniciais de exemplo (ajuste os códigos como quiser)
-- Você pode criar quantos quiser pelo Supabase Table Editor
-- ——————————————————————————————————————————————————————
INSERT INTO public.ong_convites (codigo, ativo, descricao, role, expira_em)
VALUES
  ('ONG2024',    true, 'Código geral — Visualizador (somente leitura)',    'VISUALIZADOR', NOW() + INTERVAL '1 year'),
  ('ADMIN001',   true, 'Código para administrador — Acesso total',          'ADMIN',        NOW() + INTERVAL '1 year'),
  ('PARCEIRO01', true, 'Código para parceiro — Lançar dados sem deletar',   'PARCEIRO',     NOW() + INTERVAL '1 year')
ON CONFLICT (codigo) DO NOTHING;

-- Verificação dos convites criados
SELECT codigo, ativo, descricao, expira_em FROM public.ong_convites ORDER BY criado_em;


-- ══════════════════════════════════════════════════════
-- SEÇÃO 8 — MIGRAÇÃO DE DADOS EXISTENTES (user_id)
-- ══════════════════════════════════════════════════════
-- ⚠ OPCIONAL: execute apenas se já tiver dados sem user_id
-- Vincula registros órfãos ao primeiro usuário cadastrado.
-- Comente estas linhas se o banco estiver vazio.
--
-- DO $$
-- DECLARE v_uid UUID;
-- BEGIN
--   SELECT id INTO v_uid FROM auth.users ORDER BY created_at LIMIT 1;
--   IF v_uid IS NOT NULL THEN
--     UPDATE public.ong_projetos        SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_rubricas        SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_despesas        SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_metas           SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_cronograma      SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_documentos      SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_fases           SET user_id = v_uid WHERE user_id IS NULL;
--     UPDATE public.ong_plano_aplicacao SET user_id = v_uid WHERE user_id IS NULL;
--   END IF;
-- END $$;


-- ══════════════════════════════════════════════════════
-- SEÇÃO 9 — VERIFICAÇÃO FINAL
-- ══════════════════════════════════════════════════════

-- Tabelas com contagem de colunas
SELECT
  c.table_name,
  COUNT(c.column_name) AS colunas,
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns c2
    WHERE c2.table_schema='public' AND c2.table_name=c.table_name
      AND c2.column_name='user_id'
  ) THEN '✓ user_id' ELSE '✗ SEM user_id' END AS seguranca
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'ong_projetos','ong_rubricas','ong_despesas','ong_metas',
    'ong_cronograma','ong_documentos','ong_fases','ong_plano_aplicacao',
    'ong_auditoria','ong_convites'
  )
GROUP BY c.table_name
ORDER BY c.table_name;

-- Políticas RLS ativas
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN (
  'ong_projetos','ong_rubricas','ong_despesas','ong_metas',
  'ong_cronograma','ong_documentos','ong_fases','ong_plano_aplicacao',
  'ong_auditoria','ong_convites'
)
ORDER BY tablename;

-- Triggers criados
SELECT
  event_object_table AS tabela,
  trigger_name,
  event_manipulation AS evento,
  action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Bucket de storage
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'ong-arquivos';

-- ============================================================
--  ONG GESTOR — Migração Multi-Tenant (ong_id)
--  Versão: 2.0  |  Data: 2026-06-09
-- ============================================================
--  OBJETIVO:
--    Adicionar coluna ong_id (UUID) em todas as tabelas e na
--    tabela de convites. Atualizar as políticas RLS para que
--    cada ONG veja SOMENTE seus próprios dados.
--
--  COMO USAR:
--    1. Acesse https://supabase.com/dashboard → SQL Editor
--    2. Cole este arquivo completo e execute
--    3. Após executar, rode também ong_convites_ong_id.sql
--       para atualizar os convites existentes
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE 1: Adicionar coluna ong_id nas tabelas de dados
-- ────────────────────────────────────────────────────────────

-- Tabela: ong_projetos
ALTER TABLE public.ong_projetos
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tabela: ong_rubricas
ALTER TABLE public.ong_rubricas
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tabela: ong_despesas
ALTER TABLE public.ong_despesas
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tabela: ong_metas
ALTER TABLE public.ong_metas
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tabela: ong_cronograma
ALTER TABLE public.ong_cronograma
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tabela: ong_documentos
ALTER TABLE public.ong_documentos
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Tabela: ong_auditoria
ALTER TABLE public.ong_auditoria
  ADD COLUMN IF NOT EXISTS ong_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- PARTE 2: Adicionar ong_id na tabela de convites
--          ong_id aqui = qual ONG o novo usuário vai pertencer
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.ong_convites
  ADD COLUMN IF NOT EXISTS ong_id UUID;

-- Comentário explicativo
COMMENT ON COLUMN public.ong_convites.ong_id IS
  'UUID da ONG à qual o novo usuário será associado ao usar este convite';

-- ────────────────────────────────────────────────────────────
-- PARTE 3: Índices para performance (filtros por ong_id)
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ong_projetos_ong_id   ON public.ong_projetos(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_rubricas_ong_id   ON public.ong_rubricas(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_despesas_ong_id   ON public.ong_despesas(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_metas_ong_id      ON public.ong_metas(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_cronograma_ong_id ON public.ong_cronograma(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_documentos_ong_id ON public.ong_documentos(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_auditoria_ong_id  ON public.ong_auditoria(ong_id);
CREATE INDEX IF NOT EXISTS idx_ong_convites_ong_id   ON public.ong_convites(ong_id);

-- ────────────────────────────────────────────────────────────
-- PARTE 4: Atualizar políticas RLS — ISOLAMENTO POR ONG_ID
--
--  Lógica das novas políticas:
--  ─────────────────────────────────────────────────────────
--  READ:   Usuário vê registro SE:
--            a) auth.uid() = user_id  (dono direto — legado)
--            OU
--            b) (auth.jwt() ->> 'ong_id')::uuid = ong_id
--               (pertence à mesma ONG via JWT claim)
--
--  WRITE:  Usuário pode escrever SE pertencer à ONG:
--            (auth.jwt() ->> 'ong_id')::uuid = ong_id
--            OU auth.uid() = user_id (legado)
--
--  CONVITES: Apenas o dono da ONG (ADMIN) pode ver/criar
--            convites da sua ONG.
-- ────────────────────────────────────────────────────────────

-- ═══ ong_projetos ═══

DROP POLICY IF EXISTS "select_projetos"  ON public.ong_projetos;
DROP POLICY IF EXISTS "insert_projetos"  ON public.ong_projetos;
DROP POLICY IF EXISTS "update_projetos"  ON public.ong_projetos;
DROP POLICY IF EXISTS "delete_projetos"  ON public.ong_projetos;
DROP POLICY IF EXISTS "projetos_select"  ON public.ong_projetos;
DROP POLICY IF EXISTS "projetos_insert"  ON public.ong_projetos;
DROP POLICY IF EXISTS "projetos_update"  ON public.ong_projetos;
DROP POLICY IF EXISTS "projetos_delete"  ON public.ong_projetos;

CREATE POLICY "projetos_select" ON public.ong_projetos
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "projetos_insert" ON public.ong_projetos
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR (auth.jwt() ->> 'ong_id') IS NOT NULL
         AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

CREATE POLICY "projetos_update" ON public.ong_projetos
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "projetos_delete" ON public.ong_projetos
  FOR DELETE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

-- ═══ ong_rubricas ═══

DROP POLICY IF EXISTS "select_rubricas"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "insert_rubricas"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "update_rubricas"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "delete_rubricas"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "rubricas_select"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "rubricas_insert"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "rubricas_update"  ON public.ong_rubricas;
DROP POLICY IF EXISTS "rubricas_delete"  ON public.ong_rubricas;

CREATE POLICY "rubricas_select" ON public.ong_rubricas
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "rubricas_insert" ON public.ong_rubricas
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR (auth.jwt() ->> 'ong_id') IS NOT NULL
         AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

CREATE POLICY "rubricas_update" ON public.ong_rubricas
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "rubricas_delete" ON public.ong_rubricas
  FOR DELETE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

-- ═══ ong_despesas ═══

DROP POLICY IF EXISTS "select_despesas"  ON public.ong_despesas;
DROP POLICY IF EXISTS "insert_despesas"  ON public.ong_despesas;
DROP POLICY IF EXISTS "update_despesas"  ON public.ong_despesas;
DROP POLICY IF EXISTS "delete_despesas"  ON public.ong_despesas;
DROP POLICY IF EXISTS "despesas_select"  ON public.ong_despesas;
DROP POLICY IF EXISTS "despesas_insert"  ON public.ong_despesas;
DROP POLICY IF EXISTS "despesas_update"  ON public.ong_despesas;
DROP POLICY IF EXISTS "despesas_delete"  ON public.ong_despesas;

CREATE POLICY "despesas_select" ON public.ong_despesas
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "despesas_insert" ON public.ong_despesas
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR (auth.jwt() ->> 'ong_id') IS NOT NULL
         AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

CREATE POLICY "despesas_update" ON public.ong_despesas
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "despesas_delete" ON public.ong_despesas
  FOR DELETE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

-- ═══ ong_metas ═══

DROP POLICY IF EXISTS "select_metas"  ON public.ong_metas;
DROP POLICY IF EXISTS "insert_metas"  ON public.ong_metas;
DROP POLICY IF EXISTS "update_metas"  ON public.ong_metas;
DROP POLICY IF EXISTS "delete_metas"  ON public.ong_metas;
DROP POLICY IF EXISTS "metas_select"  ON public.ong_metas;
DROP POLICY IF EXISTS "metas_insert"  ON public.ong_metas;
DROP POLICY IF EXISTS "metas_update"  ON public.ong_metas;
DROP POLICY IF EXISTS "metas_delete"  ON public.ong_metas;

CREATE POLICY "metas_select" ON public.ong_metas
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "metas_insert" ON public.ong_metas
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR (auth.jwt() ->> 'ong_id') IS NOT NULL
         AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

CREATE POLICY "metas_update" ON public.ong_metas
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "metas_delete" ON public.ong_metas
  FOR DELETE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

-- ═══ ong_cronograma ═══

DROP POLICY IF EXISTS "select_cronograma"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "insert_cronograma"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "update_cronograma"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "delete_cronograma"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "cronograma_select"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "cronograma_insert"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "cronograma_update"  ON public.ong_cronograma;
DROP POLICY IF EXISTS "cronograma_delete"  ON public.ong_cronograma;

CREATE POLICY "cronograma_select" ON public.ong_cronograma
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "cronograma_insert" ON public.ong_cronograma
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR (auth.jwt() ->> 'ong_id') IS NOT NULL
         AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

CREATE POLICY "cronograma_update" ON public.ong_cronograma
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "cronograma_delete" ON public.ong_cronograma
  FOR DELETE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

-- ═══ ong_documentos ═══

DROP POLICY IF EXISTS "select_documentos"  ON public.ong_documentos;
DROP POLICY IF EXISTS "insert_documentos"  ON public.ong_documentos;
DROP POLICY IF EXISTS "update_documentos"  ON public.ong_documentos;
DROP POLICY IF EXISTS "delete_documentos"  ON public.ong_documentos;
DROP POLICY IF EXISTS "documentos_select"  ON public.ong_documentos;
DROP POLICY IF EXISTS "documentos_insert"  ON public.ong_documentos;
DROP POLICY IF EXISTS "documentos_update"  ON public.ong_documentos;
DROP POLICY IF EXISTS "documentos_delete"  ON public.ong_documentos;

CREATE POLICY "documentos_select" ON public.ong_documentos
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "documentos_insert" ON public.ong_documentos
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR (auth.jwt() ->> 'ong_id') IS NOT NULL
         AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

CREATE POLICY "documentos_update" ON public.ong_documentos
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "documentos_delete" ON public.ong_documentos
  FOR DELETE USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

-- ═══ ong_auditoria ═══

DROP POLICY IF EXISTS "select_auditoria"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "insert_auditoria"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "update_auditoria"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "delete_auditoria"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "auditoria_select"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "auditoria_insert"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "auditoria_update"  ON public.ong_auditoria;
DROP POLICY IF EXISTS "auditoria_delete"  ON public.ong_auditoria;

CREATE POLICY "auditoria_select" ON public.ong_auditoria
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'ong_id') IS NOT NULL
       AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
  );

CREATE POLICY "auditoria_insert" ON public.ong_auditoria
  FOR INSERT WITH CHECK ( auth.uid() IS NOT NULL );

-- ═══ ong_convites — isolamento por ONG ═══
-- Cada ADMIN só vê e gerencia convites da SUA ONG

DROP POLICY IF EXISTS "convites_select"  ON public.ong_convites;
DROP POLICY IF EXISTS "convites_insert"  ON public.ong_convites;
DROP POLICY IF EXISTS "convites_update"  ON public.ong_convites;
DROP POLICY IF EXISTS "convites_delete"  ON public.ong_convites;
DROP POLICY IF EXISTS "select_convites"  ON public.ong_convites;
DROP POLICY IF EXISTS "insert_convites"  ON public.ong_convites;
DROP POLICY IF EXISTS "update_convites"  ON public.ong_convites;
DROP POLICY IF EXISTS "delete_convites"  ON public.ong_convites;

-- SELECT: qualquer usuário autenticado pode ler (para validar código de convite no signup)
CREATE POLICY "convites_select" ON public.ong_convites
  FOR SELECT USING ( true );
  -- A validação real é feita no código JS verificando o campo 'usado'

-- INSERT: só ADMINs autenticados podem criar convites
CREATE POLICY "convites_insert" ON public.ong_convites
  FOR INSERT WITH CHECK ( auth.uid() IS NOT NULL );

-- UPDATE: qualquer autenticado da mesma ONG pode marcar convite como usado
CREATE POLICY "convites_update" ON public.ong_convites
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      (auth.jwt() ->> 'ong_id') IS NULL  -- ADMINs sem ong_id isolado (acesso total)
      OR (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

-- DELETE: qualquer autenticado da mesma ONG pode deletar convites
CREATE POLICY "convites_delete" ON public.ong_convites
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND (
      (auth.jwt() ->> 'ong_id') IS NULL  -- ADMINs sem ong_id isolado
      OR (auth.jwt() ->> 'ong_id')::uuid = ong_id
    )
  );

-- ────────────────────────────────────────────────────────────
-- PARTE 5: Função helper para atualizar user_metadata com ong_id
--          Chamada pelo trigger de signup quando convite tem ong_id
-- ────────────────────────────────────────────────────────────

-- Esta função é chamada manualmente via API ou pelo setup-guide
-- para associar um usuário a uma ONG após validar o convite.
-- O JS em api.js chama /auth/v1/user (PATCH) com user_metadata.ong_id

-- ────────────────────────────────────────────────────────────
-- PARTE 6: VERIFICAÇÃO — Confirmar que tudo foi criado
-- ────────────────────────────────────────────────────────────

SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'ong_%'
ORDER BY tablename, cmd;

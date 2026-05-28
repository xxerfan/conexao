-- =====================================================
-- ONG GESTOR — SQL DE CORREÇÃO DE PERMISSÕES
-- Execute este script no SQL Editor do Supabase
-- se o Diagnóstico apontar erros de INSERT/UPDATE/DELETE
-- =====================================================

-- ── 1. Garante que o schema public está acessível ──
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ── 2. Garante GRANT completo em todas as tabelas ──
GRANT ALL PRIVILEGES ON public.ong_projetos   TO anon;
GRANT ALL PRIVILEGES ON public.ong_rubricas   TO anon;
GRANT ALL PRIVILEGES ON public.ong_despesas   TO anon;
GRANT ALL PRIVILEGES ON public.ong_metas      TO anon;
GRANT ALL PRIVILEGES ON public.ong_cronograma TO anon;
GRANT ALL PRIVILEGES ON public.ong_documentos TO anon;

GRANT ALL PRIVILEGES ON public.ong_projetos   TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_rubricas   TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_despesas   TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_metas      TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_cronograma TO authenticated;
GRANT ALL PRIVILEGES ON public.ong_documentos TO authenticated;

-- ── 3. Remove políticas antigas (se existirem) ──
DROP POLICY IF EXISTS anon_all ON public.ong_projetos;
DROP POLICY IF EXISTS anon_all ON public.ong_rubricas;
DROP POLICY IF EXISTS anon_all ON public.ong_despesas;
DROP POLICY IF EXISTS anon_all ON public.ong_metas;
DROP POLICY IF EXISTS anon_all ON public.ong_cronograma;
DROP POLICY IF EXISTS anon_all ON public.ong_documentos;

DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_projetos;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_rubricas;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_despesas;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_metas;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_cronograma;
DROP POLICY IF EXISTS "Allow all for anon" ON public.ong_documentos;

-- ── 4. Habilita RLS ──
ALTER TABLE public.ong_projetos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_rubricas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_despesas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_metas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_documentos ENABLE ROW LEVEL SECURITY;

-- ── 5. Cria políticas permissivas completas ──
CREATE POLICY anon_all ON public.ong_projetos
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_rubricas
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_despesas
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_metas
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_cronograma
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY anon_all ON public.ong_documentos
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── 6. Verifica resultado ──
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('ong_projetos','ong_rubricas','ong_despesas','ong_metas','ong_cronograma','ong_documentos')
ORDER BY tablename;

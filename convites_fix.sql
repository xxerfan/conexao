-- =====================================================
-- ONG GESTOR — FIX: Sistema de Convites com Perfis
-- Execute se já rodou supabase_setup.sql e recebeu
-- erro "policy already exists" ou precisa do campo role
-- =====================================================

-- Adiciona coluna role se não existir (migração segura)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ong_convites' AND column_name='role'
  ) THEN
    ALTER TABLE public.ong_convites
      ADD COLUMN role TEXT NOT NULL DEFAULT 'VISUALIZADOR'
      CHECK (role IN ('ADMIN','PARCEIRO','VISUALIZADOR'));
    RAISE NOTICE '✅ Coluna role adicionada em ong_convites';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna role já existe em ong_convites';
  END IF;
END $$;

-- Remove policies antigas se existirem
DROP POLICY IF EXISTS "convite_public_check" ON public.ong_convites;
DROP POLICY IF EXISTS "convite_public_use"   ON public.ong_convites;
DROP POLICY IF EXISTS "convite_admin_all"    ON public.ong_convites;

-- Garante que a tabela existe (idempotente)
CREATE TABLE IF NOT EXISTS public.ong_convites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT NOT NULL UNIQUE,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em     TIMESTAMPTZ,
  email_destino TEXT,
  usado_por     UUID REFERENCES auth.users(id),
  usado_em      TIMESTAMPTZ,
  descricao     TEXT,
  -- PERFIL: ADMIN | PARCEIRO | VISUALIZADOR
  role          TEXT NOT NULL DEFAULT 'VISUALIZADOR'
                CHECK (role IN ('ADMIN','PARCEIRO','VISUALIZADOR'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_convites_codigo ON public.ong_convites(codigo);
CREATE INDEX IF NOT EXISTS idx_convites_email  ON public.ong_convites(email_destino);
CREATE INDEX IF NOT EXISTS idx_convites_ativo  ON public.ong_convites(ativo);

-- Habilita RLS
ALTER TABLE public.ong_convites ENABLE ROW LEVEL SECURITY;

-- Recria policies
CREATE POLICY "convite_public_check" ON public.ong_convites
  FOR SELECT TO anon
  USING (ativo = true);

CREATE POLICY "convite_public_use" ON public.ong_convites
  FOR UPDATE TO anon
  USING (ativo = true)
  WITH CHECK (true);

CREATE POLICY "convite_admin_all" ON public.ong_convites
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, UPDATE ON public.ong_convites TO anon;
GRANT ALL ON public.ong_convites TO authenticated;

-- Insere convites iniciais com roles (ignora se já existirem)
INSERT INTO public.ong_convites (codigo, ativo, descricao, role, expira_em)
VALUES
  ('ONG2024',    true, 'Código geral — Somente leitura (Visualizador)', 'VISUALIZADOR', NOW() + INTERVAL '1 year'),
  ('ADMIN001',   true, 'Código para Administrador — Acesso total',       'ADMIN',        NOW() + INTERVAL '1 year'),
  ('PARCEIRO01', true, 'Código para Parceiro — Lançar dados',            'PARCEIRO',     NOW() + INTERVAL '1 year')
ON CONFLICT (codigo) DO UPDATE SET
  role = EXCLUDED.role,
  descricao = EXCLUDED.descricao;

-- ✅ Verificação final
SELECT
  codigo,
  ativo,
  descricao,
  TO_CHAR(expira_em, 'DD/MM/YYYY') AS expira_em
FROM public.ong_convites
ORDER BY criado_em;

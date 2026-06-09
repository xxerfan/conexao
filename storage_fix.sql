-- =====================================================================
-- ONG GESTOR — Storage Bucket Policies Fix v3
-- =====================================================================
-- ERRO 42501: "deve ser o proprietário dos objetos da tabela"
-- Causa: tentativa de ALTER TABLE storage.objects sem permissão.
--
-- SOLUÇÃO: Use o Dashboard do Supabase para criar as policies,
-- NÃO execute ALTER TABLE em tabelas do schema storage.
--
-- Este script APENAS cria/recria as políticas RLS usando
-- CREATE POLICY (que não requer ser dono da tabela).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- Passo 1: Remove políticas antigas (idempotente — sem ALTER TABLE)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "storage_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_insert"  ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_delete"  ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_delete"   ON storage.objects;

-- ─────────────────────────────────────────────────────────────────────
-- Passo 2: Cria as políticas (NÃO usa ALTER TABLE)
-- ─────────────────────────────────────────────────────────────────────

-- Leitura pública
CREATE POLICY "storage_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ong-arquivos');

-- Upload (autenticado)
CREATE POLICY "storage_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ong-arquivos');

-- Atualizar (autenticado)
CREATE POLICY "storage_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ong-arquivos');

-- Deletar (autenticado)
CREATE POLICY "storage_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ong-arquivos');

-- ─────────────────────────────────────────────────────────────────────
-- Passo 3: Garante que o bucket existe e está configurado
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ong-arquivos',
  'ong-arquivos',
  true,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv','text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────
-- Verificação — deve retornar 4 linhas
-- ─────────────────────────────────────────────────────────────────────
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE 'storage_%'
ORDER BY policyname;

-- ─────────────────────────────────────────────────────────────────────
-- SE AINDA DER ERRO 42501:
-- ─────────────────────────────────────────────────────────────────────
-- Use o Dashboard do Supabase (NÃO o SQL Editor):
-- 1. Vá em Storage → Policies
-- 2. Clique em "New policy" no bucket ong-arquivos
-- 3. Use o template "Enable read access for everyone"
-- 4. Adicione políticas para INSERT/UPDATE/DELETE com authenticated role
--
-- OU use o Supabase CLI:
--   supabase storage create-policy ong-arquivos ...
-- ─────────────────────────────────────────────────────────────────────

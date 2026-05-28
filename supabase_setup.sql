-- =====================================================
-- ONG GESTOR v3 — Setup Supabase SQL
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- ── 1. PROJETOS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_projetos (
  id                  TEXT PRIMARY KEY,
  nome_projeto        TEXT NOT NULL,
  numero_proposta     TEXT,
  modalidade          TEXT DEFAULT 'Termo de Fomento',
  status              TEXT DEFAULT 'Em Execução',
  ong_nome            TEXT,
  ong_cnpj            TEXT,
  concedente          TEXT,
  municipio           TEXT,
  uf                  TEXT,
  publico_beneficiario TEXT,
  objeto              TEXT,
  valor_repasse       NUMERIC DEFAULT 0,
  valor_contrapartida NUMERIC DEFAULT 0,
  valor_total         NUMERIC DEFAULT 0,
  data_inicio         DATE,
  data_fim            DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. RUBRICAS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_rubricas (
  id              TEXT PRIMARY KEY,
  projeto_id      TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  categoria       TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  quantidade      NUMERIC DEFAULT 1,
  unidade         TEXT DEFAULT 'Un',
  valor_unitario  NUMERIC DEFAULT 0,
  valor_previsto  NUMERIC DEFAULT 0,
  valor_executado NUMERIC DEFAULT 0,
  fonte           TEXT DEFAULT 'Repasse Federal',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. DESPESAS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_despesas (
  id                TEXT PRIMARY KEY,
  projeto_id        TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id        TEXT REFERENCES public.ong_rubricas(id) ON DELETE SET NULL,
  descricao         TEXT NOT NULL,
  fornecedor        TEXT,
  cnpj_cpf          TEXT,
  tipo_documento    TEXT DEFAULT 'NF-e',
  numero_documento  TEXT,
  data_despesa      DATE,
  mes_referencia    TEXT,
  valor             NUMERIC DEFAULT 0,
  fonte             TEXT DEFAULT 'Repasse Federal',
  status_pagamento  TEXT DEFAULT 'A Pagar',
  observacao        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. METAS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_metas (
  id                      TEXT PRIMARY KEY,
  projeto_id              TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  numero_meta             INTEGER DEFAULT 1,
  descricao_meta          TEXT NOT NULL,
  indicador               TEXT,
  beneficiarios_previstos INTEGER DEFAULT 0,
  beneficiarios_atendidos INTEGER DEFAULT 0,
  percentual_fisico       NUMERIC DEFAULT 0,
  valor_previsto          NUMERIC DEFAULT 0,
  valor_executado         NUMERIC DEFAULT 0,
  data_inicio             DATE,
  data_fim                DATE,
  status                  TEXT DEFAULT 'Em Andamento',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. CRONOGRAMA ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ong_cronograma (
  id             TEXT PRIMARY KEY,
  projeto_id     TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  rubrica_id     TEXT REFERENCES public.ong_rubricas(id) ON DELETE CASCADE,
  mes            TEXT NOT NULL,
  valor_previsto NUMERIC DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rubrica_id, mes)
);

-- ── 6. DOCUMENTOS (ANEXOS) ──────────────────────
-- Armazena metadados de documentos; o arquivo em si
-- fica em base64 na coluna arquivo_base64 (para arquivos ≤ 5MB)
-- ou em URL externa (Google Drive, Dropbox, etc.)
CREATE TABLE IF NOT EXISTS public.ong_documentos (
  id              TEXT PRIMARY KEY,
  projeto_id      TEXT REFERENCES public.ong_projetos(id) ON DELETE CASCADE,
  despesa_id      TEXT REFERENCES public.ong_despesas(id) ON DELETE SET NULL,
  rubrica_id      TEXT REFERENCES public.ong_rubricas(id) ON DELETE SET NULL,
  tipo_documento  TEXT NOT NULL,
  -- Tipos: 'Nota Fiscal', 'Recibo', 'Extrato Bancário', 'Termo de Fomento',
  --        'Contrato', 'RG/CPF', 'Currículo', 'Comprovante de Pagamento',
  --        'Relatório de Atividade', 'Foto/Registro', 'Outros'
  nome_arquivo    TEXT NOT NULL,
  descricao       TEXT,
  numero_documento TEXT,
  data_documento  DATE,
  fornecedor      TEXT,
  valor           NUMERIC,
  mes_referencia  TEXT,
  url_externo     TEXT,        -- link Google Drive / Dropbox / etc.
  arquivo_base64  TEXT,        -- arquivo codificado em base64 (PDFs pequenos)
  mime_type       TEXT DEFAULT 'application/pdf',
  tamanho_bytes   INTEGER,
  status          TEXT DEFAULT 'Ativo',
  -- Tipos de status: 'Ativo', 'Substituído', 'Rejeitado'
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES para performance ──────────────────────
CREATE INDEX IF NOT EXISTS idx_rubricas_projeto   ON public.ong_rubricas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_despesas_projeto   ON public.ong_despesas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_despesas_rubrica   ON public.ong_despesas(rubrica_id);
CREATE INDEX IF NOT EXISTS idx_despesas_mes       ON public.ong_despesas(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_metas_projeto      ON public.ong_metas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_projeto ON public.ong_cronograma(projeto_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_rubrica ON public.ong_cronograma(rubrica_id);
CREATE INDEX IF NOT EXISTS idx_documentos_projeto ON public.ong_documentos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_despesa ON public.ong_documentos(despesa_id);

-- ── RLS (Row Level Security) ─────────────────────
ALTER TABLE public.ong_projetos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_rubricas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_despesas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_metas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ong_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso total para anon (chave publicável)
DO $$ BEGIN
  -- projetos
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ong_projetos' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.ong_projetos FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- rubricas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ong_rubricas' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.ong_rubricas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- despesas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ong_despesas' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.ong_despesas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- metas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ong_metas' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.ong_metas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- cronograma
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ong_cronograma' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.ong_cronograma FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- documentos
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ong_documentos' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.ong_documentos FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── DADOS DE EXEMPLO ─────────────────────────────
INSERT INTO public.ong_projetos (
  id, nome_projeto, numero_proposta, modalidade, status,
  ong_nome, ong_cnpj, concedente, municipio, uf,
  publico_beneficiario, objeto,
  valor_repasse, valor_contrapartida, valor_total,
  data_inicio, data_fim
) VALUES (
  'proj-001',
  'Capacitação em Fitoterapia',
  '022933/2024',
  'Termo de Fomento',
  'Em Execução',
  'Associação Cultural e Social do Pará',
  '12.345.678/0001-90',
  'Ministério da Saúde',
  'Belém',
  'PA',
  'Mulheres agricultoras e comunidades tradicionais',
  'Capacitação de 160 beneficiários em plantas medicinais e fitoterapia tradicional para fortalecimento da saúde comunitária e geração de renda.',
  300000.00,
  30000.00,
  330000.00,
  '2024-01-01',
  '2024-12-31'
) ON CONFLICT (id) DO NOTHING;

-- Rubricas de exemplo
INSERT INTO public.ong_rubricas (id, projeto_id, categoria, descricao, quantidade, unidade, valor_unitario, valor_previsto, fonte) VALUES
('rub-001', 'proj-001', 'Recursos Humanos',    'Coordenador do Projeto',            12, 'Mês',  5000.00,  60000.00, 'Repasse Federal'),
('rub-002', 'proj-001', 'Recursos Humanos',    'Técnico em Fitoterapia',            12, 'Mês',  3500.00,  42000.00, 'Repasse Federal'),
('rub-003', 'proj-001', 'Recursos Humanos',    'Auxiliar Administrativo',           12, 'Mês',  1800.00,  21600.00, 'Repasse Federal'),
('rub-004', 'proj-001', 'Material de Consumo', 'Kit Didático Fitoterapia',         160, 'Kit',   250.00,  40000.00, 'Repasse Federal'),
('rub-005', 'proj-001', 'Material de Consumo', 'Sementes e Mudas Medicinais',        1, 'Lote', 15000.00,  15000.00, 'Repasse Federal'),
('rub-006', 'proj-001', 'Serviços de Terceiros','Palestrante Especialista',          8, 'Evento',2500.00,  20000.00, 'Repasse Federal'),
('rub-007', 'proj-001', 'Serviços de Terceiros','Impressão de Material Didático',    1, 'Lote',  8000.00,   8000.00, 'Repasse Federal'),
('rub-008', 'proj-001', 'Diárias',             'Diárias Equipe Técnica',           60, 'Diária', 350.00,  21000.00, 'Repasse Federal'),
('rub-009', 'proj-001', 'Passagens',           'Passagens Rodoviárias',            40, 'Un',    150.00,   6000.00, 'Repasse Federal'),
('rub-010', 'proj-001', 'Outros Custos',       'Divulgação e Comunicação',          1, 'Verba', 6400.00,   6400.00, 'Repasse Federal'),
('rub-011', 'proj-001', 'Material de Consumo', 'Contrapartida — Infraestrutura',    1, 'Verba',30000.00,  30000.00, 'Contrapartida')
ON CONFLICT (id) DO NOTHING;

-- Metas de exemplo
INSERT INTO public.ong_metas (id, projeto_id, numero_meta, descricao_meta, indicador, beneficiarios_previstos, beneficiarios_atendidos, percentual_fisico, valor_previsto, valor_executado, data_inicio, data_fim, status) VALUES
('meta-001', 'proj-001', 1, 'Capacitar beneficiários em plantas medicinais e fitoterapia', 'Nº de participantes certificados', 160, 48, 30.0, 180000.00, 54000.00, '2024-01-01', '2024-12-31', 'Em Andamento'),
('meta-002', 'proj-001', 2, 'Implantar hortas medicinais comunitárias', 'Nº de hortas implantadas', 10, 3, 30.0, 80000.00, 24000.00, '2024-03-01', '2024-11-30', 'Em Andamento'),
('meta-003', 'proj-001', 3, 'Produzir e distribuir kits didáticos de fitoterapia', 'Nº de kits distribuídos', 160, 48, 30.0, 40000.00, 12000.00, '2024-02-01', '2024-10-31', 'Em Andamento')
ON CONFLICT (id) DO NOTHING;

-- Despesas de exemplo (variadas por mês)
INSERT INTO public.ong_despesas (id, projeto_id, rubrica_id, descricao, fornecedor, cnpj_cpf, tipo_documento, numero_documento, data_despesa, mes_referencia, valor, fonte, status_pagamento) VALUES
('desp-001', 'proj-001', 'rub-001', 'Remuneração Coordenador — Jan/2024',     'Maria Silva Santos',       '123.456.789-00', 'Recibo',  '0001', '2024-01-31', '2024-01', 5000.00, 'Repasse Federal', 'Pago'),
('desp-002', 'proj-001', 'rub-001', 'Remuneração Coordenador — Fev/2024',     'Maria Silva Santos',       '123.456.789-00', 'Recibo',  '0002', '2024-02-29', '2024-02', 5000.00, 'Repasse Federal', 'Pago'),
('desp-003', 'proj-001', 'rub-001', 'Remuneração Coordenador — Mar/2024',     'Maria Silva Santos',       '123.456.789-00', 'Recibo',  '0003', '2024-03-31', '2024-03', 5000.00, 'Repasse Federal', 'Pago'),
('desp-004', 'proj-001', 'rub-002', 'Remuneração Técnico — Jan/2024',         'João Pedro Oliveira',      '987.654.321-00', 'Recibo',  '0004', '2024-01-31', '2024-01', 3500.00, 'Repasse Federal', 'Pago'),
('desp-005', 'proj-001', 'rub-002', 'Remuneração Técnico — Fev/2024',         'João Pedro Oliveira',      '987.654.321-00', 'Recibo',  '0005', '2024-02-29', '2024-02', 3500.00, 'Repasse Federal', 'Pago'),
('desp-006', 'proj-001', 'rub-004', 'Aquisição 48 Kits Didáticos — Lote 1',  'Gráfica Amazônia Ltda',    '11.222.333/0001-44', 'NF-e','0101', '2024-02-15', '2024-02', 12000.00,'Repasse Federal', 'Pago'),
('desp-007', 'proj-001', 'rub-004', 'Aquisição 64 Kits Didáticos — Lote 2',  'Gráfica Amazônia Ltda',    '11.222.333/0001-44', 'NF-e','0102', '2024-04-10', '2024-04', 16000.00,'Repasse Federal', 'A Pagar'),
('desp-008', 'proj-001', 'rub-005', 'Sementes e Mudas — Fornecedor Rural',    'Viveiro Plantas do Pará',  '55.666.777/0001-88', 'NF-e','0201', '2024-03-05', '2024-03', 15000.00,'Repasse Federal', 'Pago'),
('desp-009', 'proj-001', 'rub-006', 'Palestrante — 1º Workshop Fitoterapia',  'Dr. Carlos Mendes',        '111.222.333-44', 'Recibo',  '0301', '2024-02-20', '2024-02', 2500.00, 'Repasse Federal', 'Pago'),
('desp-010', 'proj-001', 'rub-008', 'Diárias Equipe — Visita Municípios Mar', 'Maria Silva Santos',       '123.456.789-00', 'Recibo',  '0401', '2024-03-20', '2024-03', 3500.00, 'Repasse Federal', 'Pago')
ON CONFLICT (id) DO NOTHING;

-- Cronograma de exemplo
INSERT INTO public.ong_cronograma (id, projeto_id, rubrica_id, mes, valor_previsto) VALUES
('crn-001', 'proj-001', 'rub-001', '2024-01', 5000.00),
('crn-002', 'proj-001', 'rub-001', '2024-02', 5000.00),
('crn-003', 'proj-001', 'rub-001', '2024-03', 5000.00),
('crn-004', 'proj-001', 'rub-001', '2024-04', 5000.00),
('crn-005', 'proj-001', 'rub-001', '2024-05', 5000.00),
('crn-006', 'proj-001', 'rub-001', '2024-06', 5000.00),
('crn-007', 'proj-001', 'rub-001', '2024-07', 5000.00),
('crn-008', 'proj-001', 'rub-001', '2024-08', 5000.00),
('crn-009', 'proj-001', 'rub-001', '2024-09', 5000.00),
('crn-010', 'proj-001', 'rub-001', '2024-10', 5000.00),
('crn-011', 'proj-001', 'rub-001', '2024-11', 5000.00),
('crn-012', 'proj-001', 'rub-001', '2024-12', 5000.00),
('crn-013', 'proj-001', 'rub-002', '2024-01', 3500.00),
('crn-014', 'proj-001', 'rub-002', '2024-02', 3500.00),
('crn-015', 'proj-001', 'rub-002', '2024-03', 3500.00),
('crn-016', 'proj-001', 'rub-002', '2024-04', 3500.00),
('crn-017', 'proj-001', 'rub-004', '2024-02', 12000.00),
('crn-018', 'proj-001', 'rub-004', '2024-04', 16000.00),
('crn-019', 'proj-001', 'rub-004', '2024-08', 12000.00),
('crn-020', 'proj-001', 'rub-005', '2024-03', 15000.00),
('crn-021', 'proj-001', 'rub-006', '2024-02', 5000.00),
('crn-022', 'proj-001', 'rub-006', '2024-05', 5000.00),
('crn-023', 'proj-001', 'rub-006', '2024-08', 5000.00),
('crn-024', 'proj-001', 'rub-006', '2024-11', 5000.00)
ON CONFLICT (id) DO NOTHING;

-- Verificação final
SELECT 
  (SELECT COUNT(*) FROM public.ong_projetos)   AS projetos,
  (SELECT COUNT(*) FROM public.ong_rubricas)   AS rubricas,
  (SELECT COUNT(*) FROM public.ong_despesas)   AS despesas,
  (SELECT COUNT(*) FROM public.ong_metas)      AS metas,
  (SELECT COUNT(*) FROM public.ong_cronograma) AS cronograma,
  (SELECT COUNT(*) FROM public.ong_documentos) AS documentos;

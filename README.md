# ONG Gestor v5 — SUPREMO
### Sistema de Gestão de Projetos Sociais MROSC / TransfereGov

> **Versão:** 5.0 SUPREMO · **Stack:** HTML5 + CSS3 + JavaScript puro · **Backend:** Supabase (PostgreSQL + Auth + Storage)  
> **Última atualização:** 2026-06-09

---

## 🚀 Funcionalidades Implementadas

### ✅ Módulos Principais
| Módulo | Status | Descrição |
|--------|--------|-----------|
| **Dashboard SUPREMO** | ✅ COMPLETO | KPIs, 4 gráficos, mini-stats, alertas inteligentes, score de conformidade (8 critérios), heatmap de despesas (projeto×mês), linha do tempo Gantt, top fornecedores |
| **Dashboard Individual do Projeto** | ✅ COMPLETO | Score do projeto, KPIs 8-cards, barras duplas Repasse+Contrapartida, 4 gráficos, tabelas de rubricas/metas/despesas |
| **Projetos** | ✅ COMPLETO | CRUD completo, cards visuais, semáforo de saúde, busca e filtro por status |
| **Gestão Financeira** | ✅ SUPREMO | 5 gráficos (categoria, mensal, fonte, top fornecedores, status pagamento), rubricas orçamentárias, lançamentos agrupados por projeto→mês, upload NF com Storage |
| **Rubricas Orçamentárias** | ✅ COMPLETO | CRUD, execução vs previsto, cronograma |
| **Metas / Plano de Trabalho** | ✅ COMPLETO | Execução física e financeira, semáforo temporal |
| **Documentos / Anexos** | ✅ SUPREMO | Upload Storage, galeria/lista toggle, lightbox com teclado, filtros avançados, KPIs |
| **Prestação de Contas SUPREMA** | ✅ SUPREMO | 4 tabs (completo/financeiro/físico/evidências), rings SVG, score conformidade 8 critérios, galeria NFs, lightbox PDF+imagem, PDF jsPDF, Excel SheetJS |
| **Upload NF/Comprovante** | ✅ COMPLETO | Drag & drop, Storage Supabase, fallback base64, preview imagem/PDF, botão "Ver NF" na tabela |
| **Multi-tenancy ONG** | ✅ COMPLETO | `ong_id` em todas as 8 tabelas, RLS dupla (user_id OR ong_id via JWT), convite com ong_id |
| **RBAC (Roles)** | ✅ COMPLETO | ADMIN/PARCEIRO/VISUALIZADOR, 5-layer fallback, painel override emergência |
| **Dark Mode** | ✅ COMPLETO | Toggle instantâneo, persistido em localStorage |
| **PWA** | ✅ COMPLETO | Manifest + Service Worker offline |
| **Exportação Excel** | ✅ COMPLETO | SheetJS multi-abas: Projetos, Rubricas, Despesas, Metas |
| **Exportação PDF** | ✅ COMPLETO | jsPDF + AutoTable, relatório oficial de prestação de contas |

---

## 📁 Estrutura de Arquivos

```
index.html              ← SPA principal (todas as páginas)
css/style.css           ← Design System v5 (~4000 linhas)
js/
  api.js                ← Auth (Supabase), DB CRUD, Storage, multi-tenancy
  roles.js              ← RBAC: ADMIN/PARCEIRO/VISUALIZADOR, override panel
  app.js                ← SPA routing, sidebar, dark mode, global search
  dashboard.js          ← Dashboard SUPREMO + individual do projeto
  financeiro.js         ← Gestão Financeira + Rubricas + Upload NF
  prestacao.js          ← Prestação de Contas SUPREMA (68KB)
  documentos.js         ← Gestão de Documentos + galeria + lightbox
  projetos.js           ← CRUD Projetos
  metas.js              ← Metas / Plano de Trabalho
  plano.js              ← Plano de Trabalho completo
  rubricas.js           ← Rubricas orçamentárias
  ui.js                 ← Componentes UI (toasts, modais, badges)
setup.html              ← Setup do banco de dados (conectividade)
setup-guide.html        ← Guia de configuração + gestão de convites
diagnostico.html        ← Diagnóstico e importação de dados
ong_id_migration.sql    ← Migração multi-tenancy (executar no Supabase)
supabase_setup.sql      ← Setup inicial do banco de dados
storage_fix.sql         ← Configuração do Storage bucket
manifest.json           ← PWA manifest
sw.js                   ← Service Worker
```

---

## 🔗 URLs / Navegação SPA

| Rota (page key) | Descrição | Requer Role |
|-----------------|-----------|-------------|
| `dashboard` | Dashboard Geral SUPREMO | Todos |
| `projetos` | Lista de projetos | Todos |
| `dash-projeto` | Dashboard individual do projeto | Todos |
| `financeiro` | Gestão Financeira + Rubricas | PARCEIRO+ |
| `plano` | Plano de Trabalho (Metas) | PARCEIRO+ |
| `prestacao` | Prestação de Contas SUPREMA | Todos |
| `documentos` | Documentos e Anexos | Todos |
| `setup` | Setup DB (abre nova aba) | ADMIN |
| `diag` | Diagnóstico (abre nova aba) | ADMIN |
| `guide` | Guia de Config (abre nova aba) | ADMIN |

---

## 🗃️ Modelo de Dados (Supabase)

### Tabelas principais (todas com `ong_id` UUID)

| Tabela | Campos principais |
|--------|-------------------|
| `ong_projetos` | numero_proposta, nome_projeto, concedente, modalidade, status, valor_repasse, valor_contrapartida, data_inicio, data_fim, ong_id, user_id |
| `ong_rubricas` | projeto_id, categoria, descricao, quantidade, unidade, valor_unitario, valor_previsto, valor_executado, fonte, ong_id |
| `ong_despesas` | projeto_id, rubrica_id, descricao, fornecedor, cnpj_cpf, data_despesa, mes_referencia, valor, fonte, status_pagamento, tipo_documento, numero_documento, nf_url, ong_id |
| `ong_metas` | projeto_id, numero_meta, descricao_meta, indicador, beneficiarios_previstos, beneficiarios_atendidos, percentual_fisico, valor_previsto, data_inicio, data_fim, status, ong_id |
| `ong_documentos` | projeto_id, nome_arquivo, tipo_documento, arquivo_base64, url_externo, mime_type, data_documento, valor, numero_documento, status, ong_id |
| `ong_cronograma` | projeto_id, rubrica_id, mes, valor_previsto, ong_id |
| `ong_convites` | codigo, role, ong_id, usado, criado_por |

### RLS Pattern (Row Level Security)
```sql
-- Acesso por user_id OU por ong_id do JWT
USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'ong_id') IS NOT NULL
     AND (auth.jwt() ->> 'ong_id')::uuid = ong_id
)
```

---

## 🔐 Sistema de Roles

```
ADMIN       → Acesso total, configurações, convites, setup
PARCEIRO    → Pode editar dados do projeto (financeiro, plano, docs)
VISUALIZADOR → Somente leitura (dashboard, projetos, prestação)
```

### Fluxo de Convite (Multi-tenancy)
1. ADMIN cria convite em `setup-guide.html` com `ong_id` (UUID da ONG)
2. Novo usuário usa código de convite no cadastro
3. `signup()` armazena `ong_id` em `user_metadata`
4. JWT inclui `ong_id` → RLS usa para isolar dados da ONG

### Override de Emergência (Console)
```javascript
// Se role estiver errado, execute no console do browser:
setRoleOverride('ADMIN')      // força papel ADMIN
clearRoleOverride()            // remove override
showRoleOverridePanel()        // painel visual de seleção
```

---

## 🏗️ Supabase — Configuração

**URL:** `https://twzzchsxuaiashmwozdz.supabase.co`  
**Bucket Storage:** `ong-arquivos` (criação manual obrigatória no Dashboard → Storage)

### SQLs para executar (em ordem):
1. `supabase_setup.sql` — Cria tabelas básicas
2. `convites_fix.sql` — Adiciona coluna `role` aos convites
3. `ong_id_migration.sql` — **Multi-tenancy completo** (reescreve RLS)
4. `storage_fix.sql` — Configura Storage policies

---

## 🆕 Novidades — Session D (2026-06-09)

### Dashboard SUPREMO
- ✅ **Mini-stats** — 8 indicadores rápidos abaixo da barra global
- ✅ **Score de Conformidade** — ring SVG + 8 critérios com barra de progresso
- ✅ **Heatmap de Despesas** — grid projeto×mês com intensidade de cor
- ✅ **Linha do Tempo Gantt** — visualização temporal de todos os projetos com indicador "hoje"
- ✅ **Top Fornecedores** — ranking por valor executado
- ✅ **Alertas Inteligentes** — 6 tipos + ação ao clicar
- ✅ **Gráfico mensal** agora é bar+line (mensal + acumulado)
- ✅ **Gráfico de barras** colorido por status de execução (verde/amarelo/vermelho)

### Gestão Financeira SUPREMA
- ✅ **Gráfico Top Fornecedores** — horizontal bar, top 8
- ✅ **Gráfico Status Pagamento** — donut com % de cada status
- ✅ Upload de NF já existia com Storage + base64 fallback

### Documentos
- ✅ **Botão Galeria/Lista** adicionado ao toolbar de filtros (`#btn-doc-view-toggle`)

### Bugs Corrigidos (Sessions anteriores)
- ✅ ADMIN role bug — 5-layer fallback no `getRoleFromSession()`
- ✅ setup.html HTTP 401 — usa `/auth/v1/settings` (always 200)
- ✅ Header icons layout — `display:flex !important; flex-wrap:nowrap`

---

## ⚠️ Pendências (requer ação manual do usuário)

1. **Criar bucket `ong-arquivos`** no Supabase Dashboard → Storage → New bucket → Nome: `ong-arquivos` → Public: ✅
2. **Executar `ong_id_migration.sql`** no Supabase SQL Editor (migração multi-tenancy)
3. **Atualizar convites existentes** com `ong_id` via `setup-guide.html`

---

## 🔧 Próximos Passos Recomendados

| Prioridade | Feature |
|------------|---------|
| 🔴 Alta | Notificações push / alertas por e-mail (vigência próxima) |
| 🔴 Alta | Módulo de Prestação de Contas: upload multi-imagens por despesa |
| 🟡 Média | Filtro de período no Dashboard (últimos 3/6/12 meses) |
| 🟡 Média | Relatório consolidado multi-projeto em PDF único |
| 🟡 Média | Chat/comentários por projeto (colaboração) |
| 🟢 Baixa | Impressão direta do Cronograma Físico-Financeiro |
| 🟢 Baixa | Modo offline completo (IndexedDB cache) |
| 🟢 Baixa | Integração com TransfereGov API (quando disponível) |

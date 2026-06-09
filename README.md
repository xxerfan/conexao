# ONG Gestor v5 — Sistema de Gestão de Projetos Sociais (TransfereGov)

Sistema SPA (Single Page Application) completo para gestão de convênios e projetos sociais no padrão TransfereGov. 100% client-side em HTML/CSS/JS puro, com persistência no Supabase.

---

## 🚀 Status: PRODUÇÃO — ✅ Zero erros de console

**Último Playwright:** ✅ `[ONG Gestor] Cache carregado: {projetos, rubricas, despesas, metas, cronograma}`

---

## 📋 Funcionalidades Implementadas

### 1. Dashboard Geral
- KPIs: Projetos ativos, valor total, executado, beneficiários
- Gráfico de execução financeira global
- Alertas de prazo (projetos vencendo em 30 dias)
- Lista de projetos com mini-barra de progresso

### 2. Projetos
- CRUD completo com modal multi-abas (Identificação / Concedente-Proponente / Financeiro / Objeto)
- Campos v5: termo_fomento, deputado, situação, responsável legal, CPF, email, endereço, CNPJ concedente, unidade gestora, programa orçamentário, caracterização, metas PNC, PPA programa, custeio, investimento
- Upload de logo da ONG (FileReader → base64 → logo_url)
- Cálculo automático vigência (dias decorridos/restantes/vencimento)
- Cálculo automático valor total (repasse + contrapartida)
- **Fallback PGRST204**: tenta gravar com todos os campos; se HTTP 400, re-tenta só com campos base

### 3. Gestão Financeira (página unificada com abas internas)
- **Aba Rubricas Orçamentárias**: CRUD de rubricas, expandir detalhe por mês, tooltips, exportar CSV
  - **Modal Nova Rubrica**: projeto sempre pré-selecionado quando aberto do Plano de Trabalho (✅ bug de race condition corrigido — `_populateRubProjetoSel()` popula o select ANTES de setar o valor, usando `projetosRubData || CACHE.projetos` como fallback)
  - Painel "Importar do Plano de Aplicação" com seletor de projeto + item
- **Aba Lançamentos / Execução**: CRUD de despesas, gráficos (Rubricas, Mensal, Fonte), KPIs financeiros
  - **Anexo NF/Comprovante**: área de upload drag-and-drop (PDF, JPG, PNG — máx. 5 MB) vinculada ao lançamento
  - FileReader → base64 → campo `nf_url` no Supabase (mesmo padrão do logo_url)
  - Preview inline da imagem ou ícone para PDF antes de salvar
  - Botão "Ver NF" na tabela de despesas abre o documento em nova aba
  - Restaura preview ao editar lançamento já salvo com NF
- Botão de ação do header muda dinamicamente conforme aba ativa
- Badges nas abas mostram contagem de registros

### 4. Plano de Trabalho (página unificada com 3 abas internas)
- **Aba Seção 5 — Metas e Indicadores**: KPIs, tabela agrupada por projeto, filtros, CRUD completo
- **Aba Seção 6 — Etapas/Fases**: Hierarquia Metas→Fases com cards visuais, CRUD fases
  - Auto-preenchimento em cascata: selecionar Meta preenche número sequencial + datas de início/fim
  - Banner informativo mostra de onde vieram os dados herdados
- **Aba Seção 9 — Plano de Aplicação**: Itens vinculados a Meta+Fase, resumo financeiro Custeio/Investimento
  - Auto-preenchimento em cascata: selecionar Fase preenche descrição, unidade, quantidade, valor_unitário
  - Banner informativo mostra de onde vieram os dados herdados
  - Botão "**→ Rubrica**" em cada item: abre modal Nova Rubrica pré-preenchido com dados do item
    - ✅ Projeto propagado corretamente sem setTimeout (eliminada race condition)
    - Passa `projId` explicitamente via `openModalRubrica(null, item.projeto_id)`
- Seletor de projeto filtra os 3 panes simultaneamente
- Exportar CSV (Fases + Itens de Aplicação)

### 5. Documentos / Anexos
- Upload de arquivos via FileReader (base64 → Supabase TEXT)
- Suporte a PDF, PNG, JPG, DOC, DOCX, XLS, XLSX (máx. 8 MB)
- Ou vinculação por URL externa (Google Drive, Dropbox, etc.)
- Visualizador inline + download

### 6. Prestação de Contas
- Relatório consolidado por projeto para impressão
- Cronograma de execução financeira mês-a-mês

---

## 🔧 Bugs Corrigidos (sessão atual)

| # | Bug | Causa | Correção |
|---|-----|-------|----------|
| 1 | Campo "Projeto" vazio no modal Nova Rubrica ao abrir do Plano | Race condition: `rub-projeto-sel` estava sem `<option>` quando `projetosRubData=[]` (usuário não tinha visitado a aba Rubricas antes) | Criada `_populateRubProjetoSel()` que usa `projetosRubData || CACHE.projetos` como fallback e sempre popula ANTES de setar `.value` |
| 2 | `_criarRubricaDeItem()` dependia de `setTimeout(200ms)` para setar projeto | Modal abria assíncrono, setTimeout era frágil | Removido setTimeout; `projId` passado explicitamente como 2º argumento de `openModalRubrica(null, projId)` |
| 3 | Sem campo de anexo NF no lançamento de despesa | Feature inexistente | Implementado: drop area + FileReader + preview + campo `nf_url` + botão "Ver NF" na tabela |

---

## 🗂️ Arquitetura de Arquivos

```
index.html              ← SPA principal (todas as páginas e modais)
css/style.css           ← Design system completo (seção 37: NF upload)
js/
  api.js                ← DB (Supabase REST), CACHE, fmt, genId, loadAll
  app.js                ← Controlador SPA: PAGES, PAGE_REDIRECTS, navigateTo, switchFinTab
  dashboard.js          ← loadDashboard, loadProjDashboard
  projetos.js           ← loadProjetos, saveProjeto (fallback PGRST204), logo upload
  financeiro.js         ← loadFinanceiro, saveDespesa (com nf_url), nfFileSelected, nfAbrirPorId
  rubricas.js           ← CRUD rubricas, _populateRubProjetoSel (fix bug projeto), onRubImportProjetoChange
  metas.js              ← CRUD metas (integrado ao page-plano via _planoMetas)
  plano.js              ← loadPlano, switchPlanoTab, CRUD fases, CRUD plano_aplicacao, _criarRubricaDeItem
  prestacao.js          ← initPrestacao, printPrestacao
  documentos.js         ← loadDocumentos, upload FileReader
  ui.js                 ← Utilitários: showToast, confirmDialog, setText, progressBar, etc.
supabase_fix_permissions.sql  ← SQL para rodar no Supabase (ver seção abaixo)
supabase_setup.sql           ← Schema completo inicial
diagnostico.html             ← Diagnóstico de conexão Supabase
setup.html                   ← Setup inicial
```

---

## 🔌 Configuração Supabase

**URL:** `https://twzzchsxuaiashmwozdz.supabase.co`  
**Chave:** `sb_publishable_vYeOaJ1-TR9y5Ua4b6Csmw_MHz0783B`

### ⚠️ OBRIGATÓRIO: Executar o SQL de permissões

Abra o **SQL Editor** no Supabase e execute todo o conteúdo de `supabase_fix_permissions.sql`. Isso:
1. Cria `ong_fases` e `ong_plano_aplicacao` se não existirem
2. Adiciona colunas novas a `ong_projetos` (incluindo `logo_url`, `caracterizacao`, etc.)
3. **Adiciona `nf_url TEXT` à tabela `ong_despesas`** (necessário para o anexo de NF)
4. Configura permissões RLS para acesso anônimo
5. Cria índices de performance

Sem este SQL, o sistema apresentará toast de erro PGRST204 ao salvar despesas com NF anexada.

---

## 🗄️ Modelo de Dados

| Tabela | Descrição |
|--------|-----------|
| `ong_projetos` | Projetos/convênios (campos base + colunas v5 + logo_url) |
| `ong_rubricas` | Rubricas orçamentárias por projeto |
| `ong_despesas` | Lançamentos de despesas (+ `nf_url` TEXT para anexo base64) |
| `ong_metas` | Metas do plano de trabalho (Seção 5) |
| `ong_fases` | Etapas/Fases por meta (Seção 6) |
| `ong_plano_aplicacao` | Itens do plano de aplicação por meta+fase (Seção 9) |
| `ong_cronograma` | Cronograma de execução mensal |
| `ong_documentos` | Documentos/anexos vinculados a projetos/despesas |

## 🔗 Rotas de Navegação (SPA)

| Rota | Página | Ação Padrão |
|------|--------|-------------|
| `navigateTo('dashboard')` | Dashboard Geral | Novo Projeto |
| `navigateTo('projetos')` | Lista de Projetos | Novo Projeto |
| `navigateTo('financeiro')` | Gestão Financeira (Rubricas) | Nova Rubrica |
| `navigateTo('plano')` | Plano de Trabalho (Metas) | Nova Meta |
| `navigateTo('documentos')` | Documentos | Novo Documento |
| `navigateTo('prestacao')` | Prestação de Contas | Imprimir |
| `navigateTo('metas')` | → Redireciona para `plano` aba Metas | — |
| `navigateTo('rubricas')` | → Redireciona para `financeiro` aba Rubricas | — |

---

## 🧩 Funções-Chave do Sistema

```javascript
// Navegação
navigateTo(pageKey)          // SPA router
switchFinTab('rubricas'|'lancamentos')    // Aba da Gestão Financeira
switchPlanoTab('metas'|'hierarquia'|'aplicacao')  // Aba do Plano

// Modais principais
openModalProjeto(id?)        // Novo/editar projeto
openModalMeta(id?)           // Nova/editar meta
openModalFase(metaId?, id?)  // Nova/editar fase
openModalPlanoAplicacao(metaId?, id?)  // Novo/editar item aplicação
openModalRubrica(id?)        // Nova/editar rubrica
openModalDespesa(id?)        // Novo/editar lançamento

// API
DB.getAll(tabela)            // GET todos os registros
DB.insert(tabela, data)      // POST novo registro
DB.update(tabela, id, data)  // PATCH registro
DB.delete(tabela, id)        // DELETE registro
CACHE.clear()                // Limpa cache em memória
```

---

## 🐛 Correções Aplicadas (v5 → Supremo)

| # | Problema | Correção |
|---|----------|----------|
| 1 | HTTP 400 PGRST204 ao salvar projetos | Separação base/v5 fields + retry fallback |
| 2 | Seção Metas desapareceu da navegação | Integrada como aba no Plano de Trabalho |
| 3 | `metas.js` com funções duplicadas (300+ linhas redundantes) | Reescrito limpo com 240 linhas |
| 4 | `page-plano` com bloco HTML órfão solto (IDs duplicados: `plano-conteudo`, `plano-select-projeto`, `plano-kpi-itens`, `plano-kpi-exec`, `plano-kpi-valor`) | Bloco removido cirurgicamente |
| 5 | Toast "Execute o supabase_fix_permissions.sql" | SQL corrigido + fallback robusto |
| 6 | `logo_url` ausente do SQL de migração | Adicionado `ALTER TABLE ADD COLUMN IF NOT EXISTS logo_url TEXT` |

---

## 📌 Próximos Passos Sugeridos

1. **Executar `supabase_fix_permissions.sql`** no Supabase (elimina o toast de erro definitivamente)
2. **Dashboard do Projeto** (`page-dash-projeto`) — integrar com metas/fases
3. **Relatório PDF** — gerar PDF da Prestação de Contas direto do browser
4. **Multi-ONG** — suporte a múltiplos usuários/organizações com autenticação
5. **Notificações** — alertas de prazo por e-mail via Supabase Edge Functions

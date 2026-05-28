# 🌱 ONG Gestor — Sistema de Gestão de Projetos Sociais MROSC

> **Sistema web completo** para gestão de projetos financiados por transferências governamentais (MROSC / TransfereGov), desenvolvido como SPA (Single Page Application) estático em HTML/CSS/JS puro com integração ao Supabase.

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)](https://supabase.com/)
[![Chart.js](https://img.shields.io/badge/Charts-Chart.js%204.4-FF6384?logo=chartdotjs)](https://www.chartjs.org/)
[![Design System](https://img.shields.io/badge/Design%20System-v5%20Supremo-2563EB)](css/style.css)

---

## 📋 Visão Geral

O **ONG Gestor v5** é um sistema de gestão financeira e operacional para ONGs que atuam com projetos governamentais. Permite controle completo de:

- 💰 **Execução Financeira** — lançamentos, despesas, fontes de recursos
- 📊 **Rubricas Orçamentárias** — plano de trabalho, cronograma mensal
- 🎯 **Metas e Indicadores** — beneficiários, execução física, prazos
- 📁 **Documentos / Anexos** — NFs, contratos, extratos com upload/URL
- 📄 **Prestação de Contas** — relatório consolidado para impressão/PDF
- 📈 **Dashboard Geral e por Projeto** — gráficos, alertas e KPIs

---

## 🚀 Como Publicar no GitHub Pages

### Passo 1 — Criar o repositório no GitHub

```bash
# No terminal (na pasta do projeto):
git init
git add .
git commit -m "feat: ONG Gestor v5 Supremo"

# Crie um repositório vazio no GitHub e conecte:
git remote add origin https://github.com/SEU_USUARIO/ong-gestor.git
git branch -M main
git push -u origin main
```

### Passo 2 — Ativar GitHub Pages

1. Vá em **Settings** → **Pages**
2. Em **Source**, selecione: `Branch: main` / `Folder: / (root)`
3. Clique em **Save**
4. Aguarde ~60 segundos → site disponível em `https://SEU_USUARIO.github.io/ong-gestor/`

> ⚠️ O arquivo `.nojekyll` já está incluído para evitar processamento Jekyll.

### Passo 3 — Configurar Supabase (se necessário)

1. Acesse o painel Supabase → **SQL Editor**
2. Execute `supabase_setup.sql` para criar as tabelas
3. Execute `supabase_fix_permissions.sql` para configurar as políticas RLS
4. Acesse `setup.html` para verificar a conexão

---

## 📁 Estrutura de Arquivos

```
ong-gestor/
├── index.html              # SPA principal (todas as páginas)
├── setup.html              # Verificação/setup do banco de dados
├── diagnostico.html        # Diagnóstico e importação de dados (Excel)
├── .nojekyll               # GitHub Pages — desativa Jekyll
├── css/
│   └── style.css           # Design System v5 Supremo (49KB)
├── js/
│   ├── api.js              # Camada Supabase REST (DB, CACHE, fmt, genId)
│   ├── ui.js               # Engine de UI premium (Toast, Dialog, Skeleton)
│   ├── app.js              # Controlador SPA (navigateTo, PAGES)
│   ├── dashboard.js        # Dashboard Geral + Individual por Projeto
│   ├── projetos.js         # CRUD de Projetos + grid de cards
│   ├── financeiro.js       # Lançamentos financeiros + tabela hierárquica
│   ├── metas.js            # Metas e Indicadores
│   ├── rubricas.js         # Rubricas Orçamentárias + Cronograma
│   ├── prestacao.js        # Prestação de Contas (relatório imprimível)
│   └── documentos.js       # Documentos/Anexos (upload base64 + URL)
├── supabase_setup.sql      # DDL: criação das 6 tabelas
└── supabase_fix_permissions.sql  # RLS policies para acesso público
```

---

## 🗄️ Modelo de Dados (Supabase)

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ong_projetos` | Projetos com repasse, concedente, vigência |
| `ong_rubricas` | Rubricas orçamentárias do plano de trabalho |
| `ong_cronograma` | Cronograma mensal por rubrica |
| `ong_despesas` | Lançamentos financeiros / despesas |
| `ong_metas` | Metas físicas e beneficiários |
| `ong_documentos` | Documentos/anexos (base64 ou URL) |

### Relacionamentos

```
ong_projetos
  ├── ong_rubricas (projeto_id)
  │     └── ong_cronograma (rubrica_id)
  ├── ong_despesas (projeto_id, rubrica_id)
  ├── ong_metas (projeto_id)
  └── ong_documentos (projeto_id, rubrica_id?, despesa_id?)
```

---

## ⚙️ Configuração da API (js/api.js)

```javascript
const SUPABASE_URL = "https://twzzchsxuaiashmwozdz.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_vYeOaJ1-TR9y5Ua4b6Csmw_MHz0783B";
```

---

## 🧩 Arquitetura SPA

### Navegação
```javascript
navigateTo('dashboard')    // → #page-dashboard
navigateTo('projetos')     // → #page-projetos
navigateTo('financeiro')   // → #page-financeiro
navigateTo('metas')        // → #page-metas
navigateTo('rubricas')     // → #page-rubricas
navigateTo('documentos')   // → #page-documentos
navigateTo('prestacao')    // → #page-prestacao
navigateTo('dash-projeto') // → #page-dash-projeto (via viewProjeto(id))
```

### CACHE em Memória
```javascript
CACHE.projetos   // Array
CACHE.rubricas   // Array
CACHE.despesas   // Array
CACHE.metas      // Array
CACHE.cronograma // Array
CACHE.clear()    // Limpa tudo (após CRUD)
```

### Objeto DB
```javascript
await DB.getAll('ong_projetos')
await DB.getOne('ong_projetos', id)
await DB.insert('ong_projetos', data)
await DB.update('ong_projetos', id, data)
await DB.delete('ong_projetos', id)
await DB.deleteWhere('ong_cronograma', { rubrica_id: id })
await DB.upsert('ong_cronograma', rows)
```

### Formatadores (fmt)
```javascript
fmt.currency(1234.56)  // → "R$ 1.234,56"
fmt.percent(85.3)      // → "85,3%"
fmt.number(1234)       // → "1.234"
fmt.date('2025-01-15') // → "15/01/2025"
fmt.dateInput('2025-01-15') // → "15/01/2025"
fmt.monthYear('2025-01')    // → "01/2025"
```

---

## 🎨 Design System v5

### Variáveis CSS principais
```css
--primary: #2563eb          /* Azul principal */
--success: #059669          /* Verde sucesso */
--warning: #d97706          /* Laranja aviso */
--danger:  #dc2626          /* Vermelho erro */
--sb-bg:   #0c1426          /* Sidebar dark */
--radius-xl: 18px           /* Bordas cards */
--shadow-xl: ...            /* Sombra premium */
```

### Componentes disponíveis
- `.kpi-card.blue|green|teal|orange|purple|red`
- `.card .card-header .card-body`
- `.card-accent-blue|green|orange|purple|teal|red`
- `.btn .btn-primary|outline|danger|warning|success`
- `.badge .badge-blue|green|orange|red|gray|teal|purple`
- `.progress-bar-wrap + .progress-bar-fill`
- `.modal-overlay.open + .modal + .modal-header|body|footer`
- `.alert .alert-success|warning|danger|info`
- `.skeleton .skeleton-title|text|kpi`
- `.proj-dash-header` (cabeçalho azul escuro do projeto)
- `.empty-state` (estado vazio com ícone)

---

## 🖥️ Funcionalidades por Módulo

### Dashboard Geral
- KPIs: total projetos, em execução, repasse federal, total executado, beneficiários, a pagar
- Barra de execução financeira global
- Gráficos: barras (repasse vs executado), donut (status), linha (mensal), barras horizontais (categorias)
- Tabela resumo de projetos com progress bars
- Painel de alertas automáticos (vigência, metas atrasadas, pendências)

### Dashboard Individual do Projeto
- Header colorido com gradiente escuro + info do projeto
- KPIs específicos: saldo, beneficiários, pago, a pagar
- 4 gráficos: despesas mensais, categorias, metas, cronograma
- Tabela de rubricas com saldo
- Tabela de metas com execução física
- Últimos 15 lançamentos

### Projetos
- Grid de cards com hover premium e barra de execução
- Badge de dias restantes (🔴 <30d, 🟠 <90d)
- Filtros por nome e status
- CRUD completo com confirmação customizada

### Execução Financeira
- Tabela hierárquica: Projeto → Mês (expansível) → Itens
- 3 gráficos: categorias, evolução mensal, fonte de recursos
- Filtros: busca, projeto, status, mês, fonte
- Exportação CSV com nome do projeto
- Data de hoje e mês atual como padrão no modal

### Metas e Indicadores
- Tabela agrupada por projeto
- Progress bars para execução física, beneficiários e financeira
- Alertas de prazo com cor automática
- Contador animado nos KPIs

### Rubricas Orçamentárias
- Tabela de saldos com execução
- Modal de cronograma mensal por rubrica
- Filtros por projeto e categoria

### Prestação de Contas
- Relatório consolidado por projeto
- Seções: identificação, rubricas, metas, despesas, documentos
- Impressão/PDF otimizada

### Documentos/Anexos
- Upload de arquivo com drag & drop (base64)
- URL externa (Google Drive, Dropbox, etc.)
- Vínculo a rubrica ou despesa específica
- KPIs: total, ativos, com arquivo, com URL, espaço usado

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Focar busca global |
| `N` | Novo item (da página atual) |
| `Esc` | Fechar modal |

---

## 🔧 Ordem de Carregamento dos Scripts (CRÍTICO)

```html
<script src="js/api.js"></script>       <!-- 1º: funções globais, DB, CACHE, fmt -->
<script src="js/dashboard.js"></script> <!-- 2º: módulos (qualquer ordem) -->
<script src="js/projetos.js"></script>
<script src="js/financeiro.js"></script>
<script src="js/metas.js"></script>
<script src="js/rubricas.js"></script>
<script src="js/prestacao.js"></script>
<script src="js/documentos.js"></script>
<script src="js/ui.js"></script>        <!-- Penúltimo: UI engine (sobrescreve showToast) -->
<script src="js/app.js"></script>       <!-- Último: controlador SPA (navigateTo) -->
```

> ⚠️ **NÃO** use `defer` ou `async` — scripts no fim do `<body>` já são deferred por posição.

---

## 🐛 Histórico de Correções

| Versão | Problema | Solução |
|--------|----------|---------|
| v3 → v4 | `api.js` corrompido (0 bytes) | Reescrito do zero |
| v3 → v4 | `defer` nos scripts quebrando `onclick` | Removido `defer` de todos |
| v3 → v4 | `loadDashboard is not defined` | Correção na ordem + remoção do `setTimeout` |
| v4 → v5 | `compactBRL` undefined | Substituído por inline arrow function |
| v4 → v5 | `fmt.monthYear` undefined | Adicionado ao `api.js` |
| v4 → v5 | `destroyChart` redeclarado | Renomeado para `_destroyDashChart` |
| v4 → v5 | `DB.deleteWhere()` assinatura errada | Corrigido para objeto de filtros |

---

## 📦 Dependências CDN

| Biblioteca | Versão | Uso |
|-----------|--------|-----|
| [Chart.js](https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js) | 4.4.0 | Gráficos interativos |
| [Font Awesome](https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css) | 6.4.0 | Ícones |
| [Inter (Google Fonts)](https://fonts.google.com/specimen/Inter) | — | Tipografia |

---

## 🔮 Melhorias Futuras

- [ ] Autenticação por login (Supabase Auth)
- [ ] Notificações por e-mail (vigência próxima)
- [ ] Importação de planilhas Excel para despesas
- [ ] Módulo de relatórios PDF customizados
- [ ] Dark mode completo
- [ ] PWA (Progressive Web App) com service worker
- [ ] Filtro avançado com múltiplos critérios simultâneos
- [ ] Comparativo entre projetos (multi-seleção)

---

## 👤 Desenvolvido por

**Sistema automatizado** — ONG Gestor v5 Supremo  
Licença: MIT — uso livre para organizações da sociedade civil

---

*Última atualização: Maio 2026 — Design System v5 Supremo*

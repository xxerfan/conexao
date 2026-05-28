# ONG Gestor v3.2 — Gestão de Projetos Sociais (MROSC / TransfereGov)

## ✅ Status: SISTEMA FUNCIONAL — v3.2 (bug fix crítico)

> **Correção v3.2**: Sistema estava completamente quebrado (nenhum botão funcionava, nenhum cadastro rodava).
> Causa raiz identificada: `js/api.js` corrompido (0 bytes) + atributo `defer` nos `<script>` conflitando com
> handlers `onclick` inline. Ambos corrigidos. Sistema testado e operacional com cache carregando:
> `projetos:1, rubricas:11, despesas:10, metas:3, cronograma:24`.

---

## Projeto

**ONG Gestor** é uma SPA (Single Page Application) completa para gestão de projetos sociais financiados
por transferências governamentais (TransfereGov/MROSC). Permite controle de execução financeira,
metas, rubricas, cronograma mês a mês, documentos anexados e geração de prestação de contas.

---

## Funcionalidades Implementadas

### ✅ Módulos Ativos
| Módulo | Funcionalidades |
|--------|----------------|
| **Dashboard Geral** | KPIs globais, gráficos (barras, donut, linha, categorias), alertas automáticos, resumo por projeto |
| **Dashboard do Projeto** | KPIs individuais, 4 gráficos, tabelas de rubricas/metas/despesas recentes |
| **Projetos** | CRUD completo, cards com barra de execução, filtros por status/busca |
| **Execução Financeira** | Lançamentos agrupados Projeto→Mês→Item, 3 gráficos, filtros avançados, exportar CSV |
| **Metas e Indicadores** | CRUD, agrupamento por projeto, barras de progresso físico e financeiro |
| **Rubricas / Cronograma** | CRUD rubricas, cronograma mês a mês com input direto, preenchimento uniforme, modal detalhe |
| **Documentos / Anexos** | Upload base64 (≤8MB), URL externa, 6 KPIs, filtros, mini-painéis em rubricas/despesas |
| **Prestação de Contas** | Relatório completo (I–V): resumo financeiro, categorias, metas, despesas, documentos |

### ✅ Infraestrutura
- **SPA** com `navigateTo(pageKey)` — sem recarregamento de página
- **Cache em memória** (`CACHE`) para 5 tabelas
- **Supabase REST API** com `apikey` + `Authorization: Bearer`
- **UUID** via `crypto.getRandomValues`
- **Toast** de notificação (3.5s sucesso, 7s erro)
- **Formatadores** globais: `fmt.currency`, `fmt.percent`, `fmt.date`, `fmt.monthYear`

---

## Arquitetura de Scripts

```
index.html
└── <body>
    └── (fim do body — SEM defer)
        ├── js/api.js        # Supabase REST + CACHE + genId + fmt + helpers
        ├── js/dashboard.js  # Dashboard geral + dashboard do projeto
        ├── js/projetos.js   # CRUD projetos
        ├── js/financeiro.js # CRUD despesas + gráficos
        ├── js/metas.js      # CRUD metas
        ├── js/rubricas.js   # CRUD rubricas + cronograma
        ├── js/prestacao.js  # Prestação de contas
        ├── js/documentos.js # Gestão de documentos/anexos
        └── js/app.js        # SPA controller — SEMPRE ÚLTIMO
```

> ⚠️ **REGRA CRÍTICA**: Scripts devem estar no final do `<body>`, **SEM** atributo `defer`.
> O `app.js` deve ser o último, pois o objeto `PAGES` referencia funções dos outros módulos.

---

## Banco de Dados (Supabase)

**URL**: `https://twzzchsxuaiashmwozdz.supabase.co`
**Chave**: `sb_publishable_vYeOaJ1-TR9y5Ua4b6Csmw_MHz0783B` (mapeia para role `anon`)

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `ong_projetos` | Projetos sociais (CNPJ, concedente, vigência, valores) |
| `ong_rubricas` | Categorias orçamentárias por projeto |
| `ong_cronograma` | Valores previstos mês a mês por rubrica |
| `ong_despesas` | Lançamentos/pagamentos por projeto e rubrica |
| `ong_metas` | Metas físicas e de beneficiários |
| `ong_documentos` | Documentos anexados (base64 ou URL) |

### RLS — Permissões necessárias
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
-- Políticas: ver supabase_fix_permissions.sql
```

---

## Arquivos do Projeto

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | SPA principal (todas as páginas) |
| `css/style.css` | Estilos completos |
| `js/api.js` | **CORE** — Supabase + utilitários |
| `js/app.js` | Controller SPA |
| `js/dashboard.js` | Dashboards |
| `js/projetos.js` | Módulo projetos |
| `js/financeiro.js` | Módulo financeiro |
| `js/metas.js` | Módulo metas |
| `js/rubricas.js` | Módulo rubricas/cronograma |
| `js/prestacao.js` | Prestação de contas |
| `js/documentos.js` | Módulo documentos/anexos |
| `setup.html` | Setup inicial do banco de dados |
| `diagnostico.html` | Diagnóstico de conexão + importação de dados |
| `supabase_setup.sql` | DDL completo das 6 tabelas |
| `supabase_fix_permissions.sql` | Correção de permissões RLS |

---

## URLs de Acesso

| Rota | Descrição |
|------|-----------|
| `/index.html` | Sistema principal |
| `/setup.html` | Setup inicial do banco |
| `/diagnostico.html` | Diagnóstico + importação de dados Excel |

---

## Changelog

### v3.2 (atual) — Correção crítica
- 🔴 **CORRIGIDO**: `js/api.js` estava com 0 bytes (corrompido) → reescrito do zero
- 🔴 **CORRIGIDO**: `defer` nos scripts causava `loadDashboard is not defined` → removido
- 🔴 **CORRIGIDO**: `fmt.monthYear()` não existia → adicionado ao `api.js`
- 🔴 **CORRIGIDO**: `destroyChart()` redefinida em `dashboard.js` → renomeada `_destroyDashChart()`
- 🔴 **CORRIGIDO**: `compactBRL()` não existia em `financeiro.js` → substituído por arrow function inline
- 🔴 **CORRIGIDO**: `DB.deleteWhere()` chamada com args errados em `rubricas.js` → corrigida assinatura
- ✅ Ordem de scripts corrigida: `api.js` primeiro, `app.js` último, sem `defer`
- ✅ Teste Playwright: zero erros, cache carregado com sucesso

### v3.1
- Sistema completo de Documentos/Anexos (js/documentos.js, ~900 linhas)
- Mini-painéis de documentos em rubricas e financeiro
- Seção V na prestação de contas
- diagnostico.html com dados da planilha Excel

### v3.0
- SPA completa com todos os módulos
- Dashboard com gráficos Chart.js
- Integração Supabase REST API

---

## Próximos Passos Recomendados

1. **Importar dados Excel**: Acesse `/diagnostico.html` → aba "Importação" para importar os 38 pagamentos do Termo de Fomento 972600.2024
2. **Verificar RLS**: Se cadastros falharem no Supabase, execute `supabase_fix_permissions.sql`
3. **Testar todos os modais**: Projeto, Despesa, Rubrica, Meta, Documento
4. **Configurar domínio**: Publicar via aba "Publish" do Genspark

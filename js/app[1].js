/* =============================================
   ONG GESTOR v3 — Controlador SPA
   ============================================= */

const PAGES = {
  'dashboard':    { title:'Dashboard Geral',         subtitle:'Visão geral de todos os projetos',                     actionText:'Novo Projeto',    actionIcon:'fa-plus',        load:loadDashboard,  action:()=>openModalProjeto() },
  'projetos':     { title:'Projetos',                subtitle:'Gerenciamento de projetos sociais',                     actionText:'Novo Projeto',    actionIcon:'fa-plus',        load:loadProjetos,   action:()=>openModalProjeto() },
  'dash-projeto': { title:'Dashboard do Projeto',    subtitle:'Execução detalhada do projeto',                         actionText:'Nova Despesa',    actionIcon:'fa-plus',        action:()=>openModalDespesa() },
  'financeiro':   { title:'Gestão Financeira',       subtitle:'Rubricas orçamentárias e lançamentos de despesas',      actionText:'Nova Rubrica',    actionIcon:'fa-tags',        load:loadFinanceiro, action:()=>openModalRubrica() },
  'plano':        { title:'Plano de Trabalho',       subtitle:'Metas · Etapas/Fases · Plano de Aplicação — TransfereGov', actionText:'Nova Meta', actionIcon:'fa-bullseye',    load:loadPlano,      action:()=>openModalMeta() },
  'documentos':   { title:'Documentos / Anexos',     subtitle:'NFs, contratos, extratos e comprovantes',               actionText:'Novo Documento',  actionIcon:'fa-paperclip',   load:loadDocumentos, action:()=>openModalDocumento() },
  'prestacao':    { title:'Prestação de Contas',     subtitle:'Relatório consolidado por projeto',                     actionText:'Imprimir',        actionIcon:'fa-print',       load:initPrestacao,  action:()=>printPrestacao() }
};

// Rotas legadas → redirect silencioso
const PAGE_REDIRECTS = {
  'metas':    { page:'plano',      tab:() => switchPlanoTab('metas')      },
  'rubricas': { page:'financeiro', tab:() => switchFinTab('rubricas')     }
};

let currentPage = 'dashboard';

function navigateTo(pageKey) {
  // Redirect rotas legadas
  if (PAGE_REDIRECTS[pageKey]) {
    const r = PAGE_REDIRECTS[pageKey];
    navigateTo(r.page);
    if (r.tab) setTimeout(r.tab, 200);
    return;
  }

  // Oculta todas as páginas e ativa a selecionada
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${pageKey}`);
  if (el) el.classList.add('active');

  // Atualiza nav items
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.getAttribute('data-page') === pageKey);
  });

  const cfg = PAGES[pageKey];
  if (cfg) {
    setText('page-title',    cfg.title);
    setText('page-subtitle', cfg.subtitle);

    const btnTxt  = document.getElementById('btn-action-text');
    const btnIcon = document.getElementById('btn-action-icon');
    const btnWrap = document.getElementById('btn-action-header');
    if (btnTxt)  btnTxt.textContent  = cfg.actionText || '';
    if (btnIcon) btnIcon.className   = `fas ${cfg.actionIcon || 'fa-plus'}`;
    if (btnWrap) btnWrap.style.display = cfg.actionText ? '' : 'none';

    if (cfg.load) cfg.load();
  }

  currentPage = pageKey;
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function headerActionClick() {
  const cfg = PAGES[currentPage];
  if (cfg?.action) cfg.action();
}

/* ── Sidebar mobile ── */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('visible');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

/* ── Tabs internas da Gestão Financeira ── */
function switchFinTab(tabKey) {
  // Tabs header
  document.querySelectorAll('#fin-inner-tabs .page-inner-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`fin-tab-${tabKey}`);
  if (tabEl) tabEl.classList.add('active');
  // Panes
  document.querySelectorAll('#page-financeiro .page-inner-pane').forEach(p => p.classList.remove('active'));
  const paneEl = document.getElementById(`fin-pane-${tabKey}`);
  if (paneEl) paneEl.classList.add('active');
  // Atualiza botão de ação do header e action PAGES
  const btnTxt  = document.getElementById('btn-action-text');
  const btnIcon = document.getElementById('btn-action-icon');
  if (tabKey === 'rubricas') {
    if (btnTxt)  btnTxt.textContent = 'Nova Rubrica';
    if (btnIcon) btnIcon.className  = 'fas fa-tags';
    if (PAGES && PAGES['financeiro']) PAGES['financeiro'].action = () => openModalRubrica();
  } else {
    if (btnTxt)  btnTxt.textContent = 'Novo Lançamento';
    if (btnIcon) btnIcon.className  = 'fas fa-plus';
    if (PAGES && PAGES['financeiro']) PAGES['financeiro'].action = () => openModalDespesa();
  }
}

/* ── Fechar modal ao clicar no overlay ── */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ── Inicialização ── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAll();
    console.log('[ONG Gestor] Cache carregado:', {
      projetos   : (CACHE.projetos   || []).length,
      rubricas   : (CACHE.rubricas   || []).length,
      despesas   : (CACHE.despesas   || []).length,
      metas      : (CACHE.metas      || []).length,
      cronograma : (CACHE.cronograma || []).length
    });
  } catch(e) {
    console.warn('[ONG Gestor] Pré-carga falhou — carregamento sob demanda:', e.message);
  }
  navigateTo('dashboard');
  // Restaura dark mode salvo
  if (localStorage.getItem('ong-dark-mode') === '1') _applyDarkMode(true);
});

/* ── Dark Mode ── */
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('ong-dark-mode', isDark ? '1' : '0');
  _applyDarkMode(isDark);
}

function _applyDarkMode(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  const icon = document.getElementById('dark-mode-icon');
  if (icon) {
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  }
  const btn = document.getElementById('btn-dark-mode');
  if (btn) {
    btn.title = isDark ? 'Modo claro (D)' : 'Modo escuro (D)';
    btn.style.color = isDark ? '#fbbf24' : '';
  }
}

// Atalho de teclado 'D' para dark mode (quando não está digitando)
document.addEventListener('keydown', e => {
  if (e.key === 'd' && !e.ctrlKey && !e.metaKey &&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
    toggleDarkMode();
  }
});

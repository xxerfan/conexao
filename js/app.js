/* =============================================
   ONG GESTOR v3 — Controlador SPA
   ============================================= */

const PAGES = {
  'dashboard':    { title:'Dashboard Geral',         subtitle:'Visão geral de todos os projetos',        actionText:'Novo Projeto',     actionIcon:'fa-plus',       load:loadDashboard,    action:()=>openModalProjeto() },
  'projetos':     { title:'Projetos',                subtitle:'Gerenciamento de projetos sociais',        actionText:'Novo Projeto',     actionIcon:'fa-plus',       load:loadProjetos,     action:()=>openModalProjeto() },
  'dash-projeto': { title:'Dashboard do Projeto',    subtitle:'Execução detalhada do projeto',            actionText:'Nova Despesa',     actionIcon:'fa-plus',       action:()=>openModalDespesa() },
  'financeiro':   { title:'Execução Financeira',     subtitle:'Lançamentos, despesas e pagamentos',       actionText:'Novo Lançamento',  actionIcon:'fa-plus',       load:loadFinanceiro,   action:()=>openModalDespesa() },
  'metas':        { title:'Metas e Indicadores',     subtitle:'Acompanhamento de execução física',         actionText:'Nova Meta',        actionIcon:'fa-plus',       load:loadMetas,        action:()=>openModalMeta() },
  'rubricas':     { title:'Rubricas Orçamentárias',  subtitle:'Plano de trabalho e cronograma mensal',     actionText:'Nova Rubrica',     actionIcon:'fa-plus',       load:loadRubricas,     action:()=>openModalRubrica() },
  'documentos':   { title:'Documentos / Anexos',     subtitle:'NFs, contratos, extratos e comprovantes',   actionText:'Novo Documento',   actionIcon:'fa-paperclip',  load:loadDocumentos,   action:()=>openModalDocumento() },
  'prestacao':    { title:'Prestação de Contas',     subtitle:'Relatório consolidado por projeto',         actionText:'Imprimir',         actionIcon:'fa-print',      load:initPrestacao,    action:()=>printPrestacao() }
};

let currentPage = 'dashboard';

function navigateTo(pageKey) {
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
});

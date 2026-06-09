/* =============================================
   ONG GESTOR v5 — Controlador SPA + Auth
   ============================================= */

const PAGES = {
  'dashboard':    { title:'Dashboard Geral',         subtitle:'Visão geral de todos os projetos',                        actionText:'Novo Projeto',  actionIcon:'fa-plus',      load:loadDashboard,  action:()=>openModalProjeto() },
  'projetos':     { title:'Projetos',                subtitle:'Gerenciamento de projetos sociais',                        actionText:'Novo Projeto',  actionIcon:'fa-plus',      load:loadProjetos,   action:()=>openModalProjeto() },
  'dash-projeto': { title:'Dashboard do Projeto',    subtitle:'Execução detalhada do projeto',                            actionText:'Nova Despesa',  actionIcon:'fa-plus',      action:()=>openModalDespesa() },
  'financeiro':   { title:'Gestão Financeira',       subtitle:'Rubricas orçamentárias e lançamentos de despesas',         actionText:'Nova Rubrica',  actionIcon:'fa-tags',      load:loadFinanceiro, action:()=>openModalRubrica() },
  'plano':        { title:'Plano de Trabalho',       subtitle:'Metas · Etapas/Fases · Plano de Aplicação — TransfereGov',actionText:'Nova Meta',     actionIcon:'fa-bullseye',  load:loadPlano,      action:()=>openModalMeta() },
  'documentos':   { title:'Documentos / Anexos',     subtitle:'NFs, contratos, extratos e comprovantes',                  actionText:'Novo Documento',actionIcon:'fa-paperclip', load:loadDocumentos, action:()=>openModalDocumento() },
  'prestacao':    { title:'Prestação de Contas',     subtitle:'Relatório consolidado por projeto',                        actionText:'Gerar PDF',     actionIcon:'fa-file-pdf',  load:initPrestacao,  action:()=>printPrestacao() }
};

const PAGE_REDIRECTS = {
  'metas':    { page:'plano',      tab:() => switchPlanoTab('metas')  },
  'rubricas': { page:'financeiro', tab:() => switchFinTab('rubricas') }
};

let currentPage = 'dashboard';

/* ── Navegação SPA ── */
function navigateTo(pageKey) {
  if (!Auth.isLoggedIn()) { showLoginScreen(); return; }
  // Guarda de acesso por perfil
  if (typeof guardPage === 'function' && !guardPage(pageKey)) return;
  if (PAGE_REDIRECTS[pageKey]) {
    const r = PAGE_REDIRECTS[pageKey];
    navigateTo(r.page);
    if (r.tab) setTimeout(r.tab, 200);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${pageKey}`);
  if (el) el.classList.add('active');
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
    if (btnTxt)  btnTxt.textContent  = cfg.actionText  || '';
    if (btnIcon) btnIcon.className   = `fas ${cfg.actionIcon || 'fa-plus'}`;
    if (btnWrap) btnWrap.style.display = cfg.actionText ? '' : 'none';
    if (cfg.load) cfg.load();
  }
  currentPage = pageKey;
  // Re-aplica restrições de perfil em cada navegação
  if (typeof applyRoleUI === 'function') setTimeout(applyRoleUI, 50);
  closeSidebar();
  window.scrollTo({ top:0, behavior:'smooth' });
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

/* ── Sidebar retrátil (desktop collapse) ── */
function toggleSidebarCollapse() {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('ong-sidebar-collapsed', collapsed ? '1' : '0');
  // Atualiza título do botão
  const btn = document.getElementById('btn-collapse-sidebar');
  if (btn) btn.title = collapsed ? 'Expandir menu' : 'Recolher menu';
}

function _restoreSidebarState() {
  if (localStorage.getItem('ong-sidebar-collapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
    const btn = document.getElementById('btn-collapse-sidebar');
    if (btn) btn.title = 'Expandir menu';
  }
}

/* ── Tabs internas: Gestão Financeira ── */
function switchFinTab(tabKey) {
  document.querySelectorAll('#fin-inner-tabs .page-inner-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`fin-tab-${tabKey}`);
  if (tabEl) tabEl.classList.add('active');
  document.querySelectorAll('#page-financeiro .page-inner-pane').forEach(p => p.classList.remove('active'));
  const paneEl = document.getElementById(`fin-pane-${tabKey}`);
  if (paneEl) paneEl.classList.add('active');
  const btnTxt  = document.getElementById('btn-action-text');
  const btnIcon = document.getElementById('btn-action-icon');
  if (tabKey === 'rubricas') {
    if (btnTxt)  btnTxt.textContent = 'Nova Rubrica';
    if (btnIcon) btnIcon.className  = 'fas fa-tags';
    if (PAGES?.['financeiro']) PAGES['financeiro'].action = () => openModalRubrica();
  } else {
    if (btnTxt)  btnTxt.textContent = 'Novo Lançamento';
    if (btnIcon) btnIcon.className  = 'fas fa-plus';
    if (PAGES?.['financeiro']) PAGES['financeiro'].action = () => openModalDespesa();
  }
}

/* ── Fechar modais ── */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay') && !e.target.id.startsWith('modal-login')) {
    e.target.classList.remove('open');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      if (m.id !== 'modal-login-overlay') m.classList.remove('open');
    });
  }
});

/* ══════════════════════════════════════════════
   LOGIN / LOGOUT
   ══════════════════════════════════════════════ */

function showLoginScreen() {
  const overlay = document.getElementById('modal-login-overlay');
  if (overlay) {
    overlay.classList.add('open');
    // Mostra painel login por padrão
    setLoginPanel('login');
  }
  // Oculta o app shell
  document.getElementById('app-shell')?.classList.add('hidden');
}

function hideLoginScreen() {
  document.getElementById('modal-login-overlay')?.classList.remove('open');
  document.getElementById('app-shell')?.classList.remove('hidden');
}

function setLoginPanel(panel) {
  document.getElementById('login-panel')?.classList.toggle('hidden',  panel !== 'login');
  document.getElementById('signup-panel')?.classList.toggle('hidden', panel !== 'signup');
  document.getElementById('reset-panel')?.classList.toggle('hidden',  panel !== 'reset');
}

async function doLogin() {
  const email = document.getElementById('login-email')?.value?.trim();
  const pass  = document.getElementById('login-password')?.value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-error');
  if (!email || !pass) { if (err) err.textContent = 'Preencha e-mail e senha.'; return; }
  if (err) err.textContent = '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...'; }
  try {
    await Auth.signIn(email, pass);
    hideLoginScreen();
    await _initApp();
    showToast('Bem-vindo ao ONG Gestor! 👋', 'success');
  } catch(e) {
    if (err) err.textContent = e.message || 'E-mail ou senha incorretos.';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar'; }
  }
}

async function doSignUp() {
  const nome   = document.getElementById('signup-nome')?.value?.trim();
  const email  = document.getElementById('signup-email')?.value?.trim();
  const pass   = document.getElementById('signup-password')?.value;
  const pass2  = document.getElementById('signup-password2')?.value;
  const codigo = document.getElementById('signup-codigo')?.value?.trim().toUpperCase();
  const btn    = document.getElementById('btn-signup');
  const err    = document.getElementById('signup-error');

  if (!nome || !email || !pass) { if (err) { err.style.color='var(--danger)'; err.textContent='Preencha todos os campos.'; } return; }
  if (pass !== pass2) { if (err) { err.style.color='var(--danger)'; err.textContent='As senhas não coincidem.'; } return; }
  if (pass.length < 6) { if (err) { err.style.color='var(--danger)'; err.textContent='A senha deve ter ao menos 6 caracteres.'; } return; }
  if (err) err.textContent = '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...'; }
  try {
    await Auth.signUp(email, pass, nome, codigo || null);
    if (err) { err.style.color='var(--success)'; err.textContent = '✓ Conta criada! Verifique seu e-mail para confirmar antes de entrar.'; }
    setTimeout(() => setLoginPanel('login'), 3500);
  } catch(e) {
    if (err) { err.style.color='var(--danger)'; err.textContent = e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Conta'; }
  }
}

async function doLogout() {
  const ok = await confirmDialog('Deseja encerrar a sessão?', 'Sair', 'danger');
  if (!ok) return;
  await Auth.signOut();
  CACHE.clear();
  if (typeof clearRole === 'function') clearRole();
  showLoginScreen();
  showToast('Sessão encerrada.', 'info');
}

/* ── Atualiza o nome do usuário no header ── */
function _updateUserDisplay() {
  const s    = Auth.getSession();
  const nome = s?.user?.user_metadata?.nome_ong || s?.user?.email || 'Usuário';
  const email= s?.user?.email || '';
  const el   = document.getElementById('user-display-name');
  const elE  = document.getElementById('user-display-email');
  if (el) el.textContent  = nome;
  if (elE) elE.textContent = email;
}

/* ═══════════════════════════════════════════════
   INICIALIZAÇÃO
   ═══════════════════════════════════════════════ */
async function _initApp() {
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
    console.warn('[ONG Gestor] Pré-carga falhou:', e.message);
  }
  _updateUserDisplay();
  _restoreSidebarState();
  // Aplica restrições de acesso por perfil
  if (typeof applyRoleUI === 'function') applyRoleUI();
  navigateTo('dashboard');
  if (localStorage.getItem('ong-dark-mode') === '1') _applyDarkMode(true);
  if (typeof initDraftAutoSave === 'function') initDraftAutoSave();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Registra Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Tenta refresh do token se existir sessão expirada
  if (Auth.getSession() && !Auth.isLoggedIn()) {
    await Auth.refreshSession();
  }

  if (Auth.isLoggedIn()) {
    hideLoginScreen();
    await _initApp();
  } else {
    showLoginScreen();
  }
});

/* ─── Atalhos de teclado ─── */
document.addEventListener('keydown', e => {
  if (e.key === 'd' && !e.ctrlKey && !e.metaKey &&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
    toggleDarkMode();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (typeof handleGlobalSearch === 'function') handleGlobalSearch(e);
  }
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
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  const btn = document.getElementById('btn-dark-mode');
  if (btn) { btn.title = isDark ? 'Modo claro (D)' : 'Modo escuro (D)'; btn.style.color = isDark ? '#fbbf24' : ''; }
}

/* ── Toggle visibilidade de senha ── */
function togglePasswordVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  if (btn) btn.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

/* ── Toggle user dropdown ── */
function toggleUserMenu() {
  document.getElementById('user-dropdown')?.classList.toggle('open');
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', e => {
  const wrap = document.getElementById('user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('user-dropdown')?.classList.remove('open');
  }
});

/* ── Reset de senha ── */
async function doReset() {
  const email = document.getElementById('reset-email')?.value?.trim();
  const btn   = document.getElementById('btn-reset');
  const msg   = document.getElementById('reset-msg');
  if (!email) { if (msg) { msg.style.color='var(--danger)'; msg.textContent='Informe seu e-mail.'; } return; }
  if (msg) { msg.style.color=''; msg.textContent=''; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }
  try {
    const res = await fetch(`${SUPABASE_AUTH_URL}/recover`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Falha ao enviar. Verifique o e-mail informado.');
    if (msg) { msg.style.color='var(--success)'; msg.textContent='✓ Link enviado! Verifique sua caixa de entrada.'; }
    setTimeout(() => setLoginPanel('login'), 4000);
  } catch(e) {
    if (msg) { msg.style.color='var(--danger)'; msg.textContent = e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-envelope"></i> Enviar link'; }
  }
}

/* ── PWA install prompt ── */
let _pwaInstallEvt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaInstallEvt = e;
  document.getElementById('pwa-install-bar')?.classList.add('show');
});
function installPWA() {
  if (!_pwaInstallEvt) return;
  _pwaInstallEvt.prompt();
  _pwaInstallEvt.userChoice.then(() => {
    _pwaInstallEvt = null;
    document.getElementById('pwa-install-bar')?.classList.remove('show');
  });
}

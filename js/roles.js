/* ==========================================================
   ONG GESTOR v5 — Sistema de Perfis e Controle de Acesso
   ==========================================================
   Perfis disponíveis:
   ─────────────────────────────────────────────────────────
   ADMIN        → Acesso total. Gerencia projetos, despesas,
                  documentos, metas, setup, diagnóstico e convites.

   PARCEIRO     → Acesso operacional. Pode lançar e editar dados
                  (despesas, documentos, metas, rubricas) mas NÃO
                  vê Setup, Diagnóstico ou gerencia convites.

   VISUALIZADOR → Somente leitura. Vê dashboard, projetos e
                  prestação de contas da ONG. Não pode criar,
                  editar ou excluir nada. Não vê configurações.
   ========================================================== */

/* ── Definição dos perfis ── */
const ROLES = {
  ADMIN: {
    label : 'Administrador',
    icon  : 'fa-user-shield',
    color : '#3b82f6',
    badge : 'badge-blue',

    // Páginas da sidebar liberadas
    pages : ['dashboard','projetos','dash-projeto','financeiro','plano','rubricas','metas','documentos','prestacao','setup','diag','guide'],

    // Ações permitidas (false = botão some/bloqueia)
    canCreate  : true,   // botão "Novo..." no header
    canEdit    : true,   // botões editar em tabelas
    canDelete  : true,   // botões excluir
    canExport  : true,   // exportar Excel/PDF
    canSetup   : true,   // ver Setup e Diagnóstico
    canManageUsers: true // gerenciar convites no setup-guide
  },

  PARCEIRO: {
    label : 'Parceiro',
    icon  : 'fa-user-tie',
    color : '#10b981',
    badge : 'badge-green',

    pages : ['dashboard','projetos','dash-projeto','financeiro','plano','rubricas','metas','documentos','prestacao'],

    canCreate  : true,
    canEdit    : true,
    canDelete  : false,  // parceiro não pode excluir
    canExport  : true,
    canSetup   : false,
    canManageUsers: false
  },

  VISUALIZADOR: {
    label : 'Visualizador',
    icon  : 'fa-user-eye',
    color : '#f59e0b',
    badge : 'badge-yellow',

    pages : ['dashboard','projetos','dash-projeto','prestacao'],

    canCreate  : false,
    canEdit    : false,
    canDelete  : false,
    canExport  : true,   // pode exportar/imprimir
    canSetup   : false,
    canManageUsers: false
  }
};

/* ── Estado atual do perfil ── */
let _currentRole = null;

/* ─────────────────────────────────────────────
   getRoleFromSession()
   Prioridade de leitura do role:
   1. Override manual de emergência (ong_role_override)
   2. user_metadata.role  (Supabase JWT — definido no signup)
   3. ong_user_role       (localStorage — definido ao validar convite)
   4. ong_id presente na metadata → assume ADMIN (primeiro admin da ONG)
   5. Fallback seguro: ADMIN quando usuário está autenticado
      (evita bloquear admins que cadastraram antes do sistema de roles)
──────────────────────────────────────────────── */
function getRoleFromSession() {
  try {
    // 1. Override manual de emergência (definido via painel de debug)
    const override = localStorage.getItem('ong_role_override');
    if (override && ROLES[override.toUpperCase()]) {
      return override.toUpperCase();
    }

    const s = Auth.getSession();
    if (!s?.user) return 'VISUALIZADOR'; // sem sessão → mais restritivo

    // 2. user_metadata.role (fonte principal — vem do Supabase JWT)
    const roleMeta = s.user.user_metadata?.role;
    if (roleMeta && ROLES[roleMeta.toUpperCase()]) {
      return roleMeta.toUpperCase();
    }

    // 3. localStorage (salvo ao validar convite — sessão imediata)
    const roleLocal = localStorage.getItem('ong_user_role');
    if (roleLocal && ROLES[roleLocal.toUpperCase()]) {
      return roleLocal.toUpperCase();
    }

    // 4. Usuário autenticado sem role definido:
    //    Provavelmente é o primeiro admin (cadastrou antes do sistema de roles).
    //    Concede ADMIN para não bloquear acesso.
    //    O usuário pode corrigir via setup-guide → Gerenciar Convites.
    if (s.user.email) {
      console.warn('[Roles] Nenhum role encontrado para', s.user.email,
        '— concedendo ADMIN como fallback. Use o painel de override para ajustar.');
      return 'ADMIN';
    }
  } catch(e) {
    console.error('[Roles] Erro ao ler role:', e);
  }
  return 'VISUALIZADOR';
}

/* ─────────────────────────────────────────────
   getCurrentRole() — retorna objeto do perfil ativo
──────────────────────────────────────────────── */
function getCurrentRole() {
  if (!_currentRole) {
    _currentRole = getRoleFromSession();
  }
  return ROLES[_currentRole] || ROLES['VISUALIZADOR'];
}

function getCurrentRoleName() {
  return _currentRole || getRoleFromSession();
}

/* ─────────────────────────────────────────────
   can(permission) — verifica permissão
   Uso: if (!can('canCreate')) return;
──────────────────────────────────────────────── */
function can(permission) {
  return getCurrentRole()[permission] === true;
}

/* ─────────────────────────────────────────────
   canAccessPage(pageKey) — verifica se pode navegar
──────────────────────────────────────────────── */
function canAccessPage(pageKey) {
  return getCurrentRole().pages.includes(pageKey);
}

/* ─────────────────────────────────────────────
   setRole(roleName) — define role e persiste
──────────────────────────────────────────────── */
function setRole(roleName) {
  const name = roleName?.toUpperCase();
  if (ROLES[name]) {
    _currentRole = name;
    localStorage.setItem('ong_user_role', name);
  }
}

/* ─────────────────────────────────────────────
   clearRole() — limpa ao fazer logout
──────────────────────────────────────────────── */
function clearRole() {
  _currentRole = null;
  localStorage.removeItem('ong_user_role');
  localStorage.removeItem('ong_role_override');
  localStorage.removeItem('ong_user_ong_id');
}

/* ==========================================================
   applyRoleUI()
   Aplica todas as restrições visuais da interface baseadas
   no perfil ativo. Deve ser chamado após login e navegação.
   ========================================================== */
function applyRoleUI() {
  const role    = getCurrentRole();
  const roleName= getCurrentRoleName();

  /* ── 1. Badge de perfil no header ── */
  _renderRoleBadge(role, roleName);

  /* ── 2. Sidebar: ocultar itens sem acesso ── */
  _applyNavVisibility(role);

  /* ── 3. Botão de ação do header ── */
  const btnWrap = document.getElementById('btn-action-header');
  if (btnWrap) {
    btnWrap.style.display = role.canCreate ? '' : 'none';
  }

  /* ── 4. Todos os botões de criar/editar/deletar ── */
  _applyActionButtons(role);

  /* ── 5. Aviso de modo somente leitura ── */
  _applyReadonlyBanner(roleName);
}

/* ─────────────────────────────────────────────
   _renderRoleBadge — badge colorido no header
──────────────────────────────────────────────── */
function _renderRoleBadge(role, roleName) {
  let badge = document.getElementById('role-badge-header');
  if (!badge) {
    // Cria e injeta no header ao lado do nome do usuário
    const userWrap = document.getElementById('user-menu-wrap');
    if (!userWrap) return;
    badge = document.createElement('div');
    badge.id = 'role-badge-header';
    badge.style.cssText = `
      display:inline-flex;align-items:center;gap:5px;
      padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;
      margin-right:8px;
    `;
    userWrap.insertAdjacentElement('beforebegin', badge);
  }
  const colors = {
    ADMIN:       { bg:'rgba(59,130,246,.2)',  color:'#60a5fa',  border:'rgba(59,130,246,.4)'  },
    PARCEIRO:    { bg:'rgba(16,185,129,.2)',  color:'#34d399',  border:'rgba(16,185,129,.4)'  },
    VISUALIZADOR:{ bg:'rgba(245,158,11,.2)',  color:'#fbbf24',  border:'rgba(245,158,11,.4)'  }
  };
  const c = colors[roleName] || colors['VISUALIZADOR'];
  badge.style.background   = c.bg;
  badge.style.color        = c.color;
  badge.style.border       = `1px solid ${c.border}`;
  badge.innerHTML = `<i class="fas ${role.icon}"></i> ${role.label}`;
}

/* ─────────────────────────────────────────────
   _applyNavVisibility — sidebar items
──────────────────────────────────────────────── */
function _applyNavVisibility(role) {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    const page = btn.getAttribute('data-page');
    const allowed = role.pages.includes(page) ||
                    page === 'setup' && role.canSetup ||
                    page === 'diag'  && role.canSetup;
    btn.style.display = allowed ? '' : 'none';
  });

  // Seção "Sistema" no sidebar — oculta se não tem acesso
  const navSections = document.querySelectorAll('.nav-section-title');
  navSections.forEach(sec => {
    if (sec.textContent.trim() === 'Sistema') {
      sec.style.display = role.canSetup ? '' : 'none';
    }
  });
}

/* ─────────────────────────────────────────────
   _applyActionButtons — botões create/edit/delete
──────────────────────────────────────────────── */
function _applyActionButtons(role) {
  // Botões de criar (data-role-create)
  document.querySelectorAll('[data-role="create"]').forEach(el => {
    el.style.display = role.canCreate ? '' : 'none';
  });

  // Botões de editar (data-role-edit)
  document.querySelectorAll('[data-role="edit"]').forEach(el => {
    el.style.display = role.canEdit ? '' : 'none';
  });

  // Botões de deletar (data-role-delete)
  document.querySelectorAll('[data-role="delete"]').forEach(el => {
    el.style.display = role.canDelete ? '' : 'none';
  });

  // Inputs e formulários em modo somente leitura
  if (!role.canCreate && !role.canEdit) {
    document.querySelectorAll('[data-role="form-field"]').forEach(el => {
      el.setAttribute('readonly', true);
      el.setAttribute('disabled', true);
    });
  }
}

/* ─────────────────────────────────────────────
   _applyReadonlyBanner — aviso visual no topo
──────────────────────────────────────────────── */
function _applyReadonlyBanner(roleName) {
  let banner = document.getElementById('readonly-banner');
  if (roleName === 'VISUALIZADOR') {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'readonly-banner';
      banner.innerHTML = `
        <i class="fas fa-eye"></i>
        <strong>Modo Somente Leitura</strong> — Seu perfil (Visualizador) permite apenas consultar as informações.
        Para lançar dados, solicite um convite de Parceiro ou Administrador.
      `;
      banner.style.cssText = `
        background:rgba(245,158,11,.12);border-bottom:2px solid #f59e0b;
        color:#fbbf24;padding:8px 24px;font-size:.8rem;
        display:flex;align-items:center;gap:10px;
        position:sticky;top:0;z-index:100;
      `;
      const main = document.querySelector('.main-content') || document.getElementById('app-shell');
      if (main) main.insertAdjacentElement('afterbegin', banner);
    }
    banner.style.display = 'flex';
  } else {
    if (banner) banner.style.display = 'none';
  }
}

/* ==========================================================
   guardAction(permission, callback)
   Wrapper para ações: verifica permissão antes de executar.
   Uso: guardAction('canCreate', () => openModalProjeto())
   ========================================================== */
function guardAction(permission, callback) {
  if (!can(permission)) {
    const role = getCurrentRole();
    showToast(`⛔ Seu perfil (${role.label}) não permite esta ação.`, 'warning');
    return false;
  }
  if (typeof callback === 'function') callback();
  return true;
}

/* ==========================================================
   guardPage(pageKey)
   Bloqueia navegação para páginas sem acesso.
   Chamado em navigateTo() antes de qualquer ação.
   ========================================================== */
function guardPage(pageKey) {
  // Páginas abertas em nova aba (setup, diag, guide) não passam pelo guardPage
  const externalPages = ['setup','diag','guide'];
  if (externalPages.includes(pageKey)) return true;

  if (!canAccessPage(pageKey)) {
    const role = getCurrentRole();
    showToast(`⛔ Seu perfil (${role.label}) não tem acesso a esta seção.`, 'warning');
    navigateTo('dashboard'); // redireciona para dashboard
    return false;
  }
  return true;
}

/* ==========================================================
   setRoleOverride(roleName)
   Override manual de emergência.
   Permite forçar um role sem depender do Supabase.
   Uso no console: setRoleOverride('ADMIN')
   Uso no painel: botão "Override de Perfil" no header
   ========================================================== */
function setRoleOverride(roleName) {
  const name = roleName?.toUpperCase();
  if (!ROLES[name]) {
    console.error('[Roles] Role inválido:', roleName, '— use: ADMIN, PARCEIRO ou VISUALIZADOR');
    return false;
  }
  localStorage.setItem('ong_role_override', name);
  localStorage.setItem('ong_user_role', name);
  _currentRole = name;
  if (typeof applyRoleUI === 'function') applyRoleUI();
  if (typeof showToast === 'function') {
    showToast(`✅ Perfil alterado para ${ROLES[name].label}`, 'success');
  }
  console.info('[Roles] Override ativo:', name);
  return true;
}

function clearRoleOverride() {
  localStorage.removeItem('ong_role_override');
  _currentRole = null;
  if (typeof applyRoleUI === 'function') applyRoleUI();
  if (typeof showToast === 'function') {
    showToast('🔄 Override removido — role do Supabase será usado', 'info');
  }
}

/* ==========================================================
   showRoleOverridePanel()
   Painel de emergência para corrigir role bloqueado.
   Acessível via console: showRoleOverridePanel()
   ========================================================== */
function showRoleOverridePanel() {
  // Remove painel anterior
  const old = document.getElementById('role-override-panel');
  if (old) old.remove();

  const session = (() => {
    try { return Auth.getSession(); } catch(e) { return null; }
  })();
  const currentRoleName = getCurrentRoleName();
  const override = localStorage.getItem('ong_role_override') || '—';
  const metaRole = session?.user?.user_metadata?.role || '(vazio)';
  const localRole = localStorage.getItem('ong_user_role') || '(vazio)';
  const email = session?.user?.email || '(sem sessão)';

  const panel = document.createElement('div');
  panel.id = 'role-override-panel';
  panel.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    z-index:99999;background:#1e293b;border:2px solid #3b82f6;
    border-radius:14px;padding:24px;min-width:340px;max-width:400px;
    color:#f1f5f9;font-family:Inter,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6);
  `;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="font-size:1rem;font-weight:700;color:#60a5fa;">
        <i class="fas fa-user-shield"></i> Override de Perfil
      </h3>
      <button onclick="document.getElementById('role-override-panel').remove()"
        style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.1rem;">✕</button>
    </div>
    <div style="background:#0f172a;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.78rem;font-family:monospace;line-height:1.8;">
      <div>👤 E-mail: <span style="color:#34d399">${email}</span></div>
      <div>🔑 metadata.role: <span style="color:#fbbf24">${metaRole}</span></div>
      <div>💾 localStorage: <span style="color:#fbbf24">${localRole}</span></div>
      <div>⚡ Override ativo: <span style="color:#f87171">${override}</span></div>
      <div>✅ Role atual: <span style="color:#60a5fa;font-weight:700">${currentRoleName}</span></div>
    </div>
    <p style="font-size:.78rem;color:#94a3b8;margin-bottom:12px;">
      Selecione o perfil correto para sua conta:
    </p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${Object.entries(ROLES).map(([name, r]) => `
        <button onclick="setRoleOverride('${name}');document.getElementById('role-override-panel').remove()"
          style="background:${currentRoleName===name?'rgba(59,130,246,.3)':'rgba(255,255,255,.05)'};
                 border:1.5px solid ${currentRoleName===name?'#3b82f6':'#334155'};
                 border-radius:8px;padding:10px 14px;color:#f1f5f9;cursor:pointer;
                 display:flex;align-items:center;gap:10px;font-family:Inter,sans-serif;font-size:.85rem;">
          <i class="fas ${r.icon}" style="color:${r.color};width:16px;"></i>
          <span style="font-weight:600;">${r.label}</span>
          ${currentRoleName===name?'<span style="margin-left:auto;color:#60a5fa;font-size:.72rem;">✓ ativo</span>':''}
        </button>
      `).join('')}
    </div>
    ${localStorage.getItem('ong_role_override') ? `
    <button onclick="clearRoleOverride();document.getElementById('role-override-panel').remove()"
      style="margin-top:12px;width:100%;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);
             border-radius:8px;padding:8px;color:#f87171;cursor:pointer;font-family:Inter,sans-serif;font-size:.8rem;">
      <i class="fas fa-times-circle"></i> Remover override e usar role do Supabase
    </button>
    `:''}
    <p style="margin-top:12px;font-size:.7rem;color:#64748b;text-align:center;">
      💡 Para corrigir definitivamente: Setup-Guide → Etapa 3 Configurar Auth → atualizar user_metadata
    </p>
  `;

  // Overlay de fundo
  const backdrop = document.createElement('div');
  backdrop.id = 'role-override-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);';
  backdrop.onclick = () => { panel.remove(); backdrop.remove(); };
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
}

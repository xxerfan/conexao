/* ==========================================================
   ONG GESTOR v5 — API Layer + Auth + Storage
   ========================================================== */

/* ── Configuração Supabase ── */
const SUPABASE_URL      = "https://twzzchsxuaiashmwozdz.supabase.co/rest/v1";
const SUPABASE_AUTH_URL = "https://twzzchsxuaiashmwozdz.supabase.co/auth/v1";
const SUPABASE_STORE_URL= "https://twzzchsxuaiashmwozdz.supabase.co/storage/v1";
const SUPABASE_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3enpjaHN4dWFpYXNobXdvemR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODkxMzgsImV4cCI6MjA5NTQ2NTEzOH0.0LclUOMKXYcRB787gPq6K_MavBxIsGAIkdNyK568eOc";

/* ==========================================================
   AUTH — Session Management
   ========================================================== */
const Auth = {
  _session: null,

  /* Retorna a sessão salva (memória ou localStorage) */
  getSession() {
    if (this._session) return this._session;
    try {
      const raw = localStorage.getItem('ong_session');
      if (raw) {
        this._session = JSON.parse(raw);
        return this._session;
      }
    } catch(e) {}
    return null;
  },

  /* Guarda sessão */
  setSession(session) {
    this._session  = session;
    if (session) {
      localStorage.setItem('ong_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('ong_session');
    }
  },

  /* Token JWT ou a anon key como fallback */
  getToken() {
    const s = this.getSession();
    return s?.access_token || SUPABASE_KEY;
  },

  /* user_id do usuário logado */
  getUserId() {
    const s = this.getSession();
    return s?.user?.id || null;
  },

  /* ong_id da ONG do usuário logado (multi-tenancy) */
  getOngId() {
    const s = this.getSession();
    return s?.user?.user_metadata?.ong_id
        || localStorage.getItem('ong_user_ong_id')
        || null;
  },

  /* true se há sessão válida */
  isLoggedIn() {
    const s = this.getSession();
    if (!s?.access_token) return false;
    // Checa expiração
    try {
      const exp = JSON.parse(atob(s.access_token.split('.')[1])).exp;
      return Date.now() / 1000 < exp;
    } catch(e) {
      return !!s.access_token;
    }
  },

  /* Login com email + senha */
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=password`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body   : JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'Falha no login');
    this.setSession(data);
    return data;
  },

  /* Cadastro com validação de código de convite */
  async signUp(email, password, nome, codigoConvite) {
    // FASE 1 — Sistema de convites: verifica código antes de criar conta
    // Retorna { role, ong_id } do convite
    let roleFromConvite = 'VISUALIZADOR'; // padrão mais restritivo
    let ongIdFromConvite = null;           // ong_id da ONG que gerou o convite
    if (codigoConvite) {
      const conviteData = await this._validarConvite(codigoConvite, email);
      roleFromConvite  = conviteData.role;
      ongIdFromConvite = conviteData.ong_id || null;
    }

    // Monta user_metadata com role E ong_id (multi-tenancy)
    const userMeta = { nome_ong: nome, role: roleFromConvite };
    if (ongIdFromConvite) userMeta.ong_id = ongIdFromConvite;

    const r = await fetch(`${SUPABASE_AUTH_URL}/signup`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body   : JSON.stringify({ email, password, data: userMeta })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'Falha no cadastro');

    // Persiste role e ong_id localmente para uso imediato (antes do refresh do JWT)
    localStorage.setItem('ong_user_role', roleFromConvite);
    if (ongIdFromConvite) localStorage.setItem('ong_user_ong_id', ongIdFromConvite);

    // Marca convite como usado após cadastro bem-sucedido
    if (codigoConvite) {
      await this._marcarConviteUsado(codigoConvite, data.user?.id).catch(() => {});
    }
    return data;
  },

  /* Verifica se código de convite é válido — retorna { role, ong_id } do convite */
  async _validarConvite(codigo, email) {
    const url = `${SUPABASE_URL}/ong_convites?codigo=eq.${encodeURIComponent(codigo.toUpperCase())}&select=id,codigo,ativo,expira_em,email_destino,usado_por,role,ong_id&limit=1`;
    const r = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    // Tabela não existe — convites desabilitados; assume ADMIN para não bloquear
    if (r.status === 404) return { role: 'ADMIN', ong_id: null };

    if (!r.ok) throw new Error('Erro ao verificar código de convite.');

    const data = await r.json();
    if (!data.length) throw new Error('Código de convite inválido. Solicite um novo código ao administrador.');

    const c = data[0];
    if (!c.ativo)    throw new Error('Este código de convite foi desativado. Solicite um novo ao administrador.');
    if (c.usado_por) throw new Error('Este código de convite já foi utilizado. Cada código é de uso único.');
    if (c.expira_em && new Date(c.expira_em) < new Date()) throw new Error('Este código de convite expirou. Solicite um novo ao administrador.');
    if (c.email_destino && c.email_destino.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Este código de convite não é válido para este e-mail.');
    }
    // Retorna role E ong_id do convite — ambos necessários para multi-tenancy
    return {
      role  : (c.role || 'VISUALIZADOR').toUpperCase(),
      ong_id: c.ong_id || null
    };
  },

  /* Marca convite como usado e salva role + ong_id localmente */
  async _marcarConviteUsado(codigo, userId) {
    const urlFind = `${SUPABASE_URL}/ong_convites?codigo=eq.${encodeURIComponent(codigo.toUpperCase())}&select=id,role,ong_id&limit=1`;
    const rFind = await fetch(urlFind, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!rFind.ok) return;
    const found = await rFind.json();
    if (!found.length) return;

    // Salva role e ong_id para uso no login subsequente
    const role   = (found[0].role || 'VISUALIZADOR').toUpperCase();
    const ong_id = found[0].ong_id || null;
    localStorage.setItem('ong_user_role', role);
    if (ong_id) localStorage.setItem('ong_user_ong_id', ong_id);

    await fetch(`${SUPABASE_URL}/ong_convites?id=eq.${found[0].id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ usado_por: userId, usado_em: new Date().toISOString(), ativo: false })
    });
  },

  /* Logout */
  async signOut() {
    try {
      await fetch(`${SUPABASE_AUTH_URL}/logout`, {
        method : 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + this.getToken() }
      });
    } catch(e) {}
    this.setSession(null);
    CACHE.clear();
  },

  /* Refresh token */
  async refreshSession() {
    const s = this.getSession();
    if (!s?.refresh_token) return null;
    try {
      const r = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=refresh_token`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body   : JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!r.ok) return null;
      const data = await r.json();
      this.setSession(data);
      return data;
    } catch(e) { return null; }
  }
};

/* ==========================================================
   STORAGE — Upload para Supabase Storage
   ========================================================== */
const Storage = {
  BUCKET: 'ong-arquivos',

  /* Faz upload de um File e retorna a URL pública */
  async upload(file, path) {
    const token = Auth.getToken();
    const url   = `${SUPABASE_STORE_URL}/object/${this.BUCKET}/${path}`;
    const r = await fetch(url, {
      method : 'POST',
      headers: {
        'Authorization' : `Bearer ${token}`,
        'apikey'        : SUPABASE_KEY,
        'Content-Type'  : file.type || 'application/octet-stream',
        'x-upsert'      : 'true'
      },
      body: file
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Storage upload error (${r.status}): ${txt}`);
    }
    return this.getPublicUrl(path);
  },

  /* URL pública do arquivo */
  getPublicUrl(path) {
    return `${SUPABASE_STORE_URL}/object/public/${this.BUCKET}/${path}`;
  },

  /* Deleta arquivo */
  async delete(path) {
    const r = await fetch(`${SUPABASE_STORE_URL}/object/${this.BUCKET}/${path}`, {
      method : 'DELETE',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}`, 'apikey': SUPABASE_KEY }
    });
    return r.ok;
  },

  /* Gera path único para um arquivo */
  makePath(folder, filename) {
    const uid  = Auth.getUserId() || 'anon';
    const ext  = filename.split('.').pop();
    const name = `${genId()}.${ext}`;
    return `${uid}/${folder}/${name}`;
  }
};

/* ==========================================================
   HEADERS dinâmicos — sempre usa o JWT atual
   ========================================================== */
function _headers(extra) {
  return Object.assign({
    'Content-Type'  : 'application/json',
    'apikey'        : SUPABASE_KEY,
    'Authorization' : 'Bearer ' + Auth.getToken(),
    'Prefer'        : 'return=representation'
  }, extra || {});
}

/* ==========================================================
   CACHE em memória
   ========================================================== */
const CACHE = {
  projetos   : null,
  rubricas   : null,
  despesas   : null,
  metas      : null,
  cronograma : null,
  documentos : null,
  clear() {
    this.projetos = this.rubricas = this.despesas =
    this.metas = this.cronograma = this.documentos = null;
  }
};

/* ── UUID gerador ── */
function genId() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

/* ── Limpa campos undefined/null de um objeto ── */
function _cleanObj(obj) {
  const out = {};
  Object.keys(obj).forEach(k => {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      out[k] = obj[k];
    } else if (obj[k] === 0 || obj[k] === false) {
      out[k] = obj[k];
    }
  });
  return out;
}

const _SYS_FIELDS = ['created_at','updated_at','gs_project_id','gs_table_name'];

/* ==========================================================
   DB — CRUD com JWT dinâmico
   ========================================================== */
const DB = {

  async getAll(table, filters) {
    try {
      let url = SUPABASE_URL + '/' + table + '?select=*&order=created_at.asc&limit=1000';
      if (filters) {
        Object.keys(filters).forEach(k => {
          url += '&' + k + '=eq.' + encodeURIComponent(filters[k]);
        });
      }
      const r = await fetch(url, { headers: _headers() });
      if (r.status === 401) { _handleUnauthorized(); return []; }
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('HTTP ' + r.status + ': ' + txt);
      }
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    } catch(e) {
      console.error('DB.getAll(' + table + '):', e);
      throw e;
    }
  },

  async getOne(table, id) {
    try {
      const url = SUPABASE_URL + '/' + table + '?id=eq.' + id + '&select=*&limit=1';
      const r   = await fetch(url, { headers: _headers() });
      if (r.status === 401) { _handleUnauthorized(); return null; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch(e) {
      console.error('DB.getOne(' + table + ', ' + id + '):', e);
      throw e;
    }
  },

  async insert(table, obj) {
    try {
      if (!obj.id) obj.id = genId();
      // Injeta user_id automaticamente
      const uid = Auth.getUserId();
      if (uid && !obj.user_id) obj.user_id = uid;
      // Injeta ong_id automaticamente (multi-tenancy)
      // Prioridade: metadata do JWT > localStorage
      const s = Auth.getSession();
      const ongIdMeta  = s?.user?.user_metadata?.ong_id;
      const ongIdLocal = localStorage.getItem('ong_user_ong_id');
      const ongId = ongIdMeta || ongIdLocal || null;
      if (ongId && !obj.ong_id) obj.ong_id = ongId;
      _SYS_FIELDS.forEach(f => delete obj[f]);
      const r = await fetch(SUPABASE_URL + '/' + table, {
        method : 'POST',
        headers: _headers(),
        body   : JSON.stringify(obj)
      });
      if (r.status === 401) { _handleUnauthorized(); throw new Error('Não autorizado'); }
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('HTTP ' + r.status + ': ' + txt);
      }
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch(e) {
      console.error('DB.insert(' + table + '):', e);
      throw e;
    }
  },

  async update(table, id, obj) {
    try {
      const clean = Object.assign({}, obj);
      _SYS_FIELDS.forEach(f => delete clean[f]);
      delete clean.id;
      delete clean.user_id; // nunca sobrescreve o dono
      const r = await fetch(SUPABASE_URL + '/' + table + '?id=eq.' + id, {
        method : 'PATCH',
        headers: _headers(),
        body   : JSON.stringify(clean)
      });
      if (r.status === 401) { _handleUnauthorized(); throw new Error('Não autorizado'); }
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('HTTP ' + r.status + ': ' + txt);
      }
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch(e) {
      console.error('DB.update(' + table + ', ' + id + '):', e);
      throw e;
    }
  },

  async delete(table, id) {
    try {
      const r = await fetch(SUPABASE_URL + '/' + table + '?id=eq.' + id, {
        method : 'DELETE',
        headers: _headers({ 'Prefer': 'return=minimal' })
      });
      if (r.status === 401) { _handleUnauthorized(); throw new Error('Não autorizado'); }
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('HTTP ' + r.status + ': ' + txt);
      }
      return true;
    } catch(e) {
      console.error('DB.delete(' + table + ', ' + id + '):', e);
      throw e;
    }
  },

  async deleteWhere(table, filters) {
    try {
      let url = SUPABASE_URL + '/' + table + '?';
      const parts = Object.keys(filters).map(k => k + '=eq.' + encodeURIComponent(filters[k]));
      url += parts.join('&');
      const r = await fetch(url, {
        method : 'DELETE',
        headers: _headers({ 'Prefer': 'return=minimal' })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    } catch(e) {
      console.error('DB.deleteWhere(' + table + '):', e);
      throw e;
    }
  },

  async upsert(table, obj) {
    try {
      if (!obj.id) obj.id = genId();
      const uid = Auth.getUserId();
      if (uid && !obj.user_id) obj.user_id = uid;
      _SYS_FIELDS.forEach(f => delete obj[f]);
      const r = await fetch(SUPABASE_URL + '/' + table, {
        method : 'POST',
        headers: _headers({ 'Prefer': 'return=representation,resolution=merge-duplicates' }),
        body   : JSON.stringify(obj)
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('HTTP ' + r.status + ': ' + txt);
      }
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch(e) {
      console.error('DB.upsert(' + table + '):', e);
      throw e;
    }
  }
};

/* ── Intercepta 401 globalmente ── */
function _handleUnauthorized() {
  Auth.setSession(null);
  CACHE.clear();
  if (typeof showLoginScreen === 'function') showLoginScreen();
}

/* ==========================================================
   loadAll — pré-carrega cache das tabelas principais
   ========================================================== */
async function loadAll() {
  const [p, r, d, m, c] = await Promise.all([
    DB.getAll('ong_projetos'),
    DB.getAll('ong_rubricas'),
    DB.getAll('ong_despesas'),
    DB.getAll('ong_metas'),
    DB.getAll('ong_cronograma')
  ]);
  CACHE.projetos   = p || [];
  CACHE.rubricas   = r || [];
  CACHE.despesas   = d || [];
  CACHE.metas      = m || [];
  CACHE.cronograma = c || [];
  return CACHE;
}

/* ==========================================================
   UTILITÁRIOS DE UI
   ========================================================== */

function showToast(msg, type) {
  type = type || 'success';
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
  const icons  = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle' };
  toast.style.cssText = `background:white;border-left:4px solid ${colors[type]||colors.info};border-radius:10px;padding:12px 16px;box-shadow:0 4px 20px rgba(0,0,0,.12);display:flex;align-items:center;gap:10px;font-size:.83rem;animation:slideInRight .25s ease;min-width:220px;`;
  toast.innerHTML = `<i class="fas ${icons[type]||icons.info}" style="color:${colors[type]};font-size:1rem;flex-shrink:0;"></i><span style="flex:1;">${msg}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:.9rem;padding:0;margin-left:4px;">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.style.opacity='0'; toast.style.transition='opacity .3s'; setTimeout(()=>toast.remove(),300); }, 4000);
}

async function confirmDialog(msg, title, type) {
  return new Promise(resolve => {
    const id  = 'dlg-' + Date.now();
    const col  = type==='danger' ? '#ef4444' : '#2563eb';
    const icon = type==='danger' ? 'fa-exclamation-triangle' : 'fa-question-circle';
    const div  = document.createElement('div');
    div.className = 'modal-overlay';
    div.style.cssText = 'z-index:99998;';
    div.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <div class="modal-header" style="border-bottom:none;padding-bottom:0;">
          <h3 style="color:${col};display:flex;align-items:center;gap:8px;">
            <i class="fas ${icon}"></i> ${title || 'Confirmar'}
          </h3>
          <button class="modal-close" onclick="document.getElementById('${id}').remove();"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" style="padding-top:12px;">
          <p style="white-space:pre-line;font-size:.88rem;color:#374151;">${msg}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('${id}').remove();window._dlgResolve_${id}(false)">Cancelar</button>
          <button class="btn btn-${type==='danger'?'danger':'primary'}" onclick="document.getElementById('${id}').remove();window._dlgResolve_${id}(true)">Confirmar</button>
        </div>
      </div>`;
    div.id = id;
    window[`_dlgResolve_${id}`] = resolve;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.classList.add('open'));
  });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

const fmt = {
  currency(v) {
    return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v)||0);
  },
  percent(v) {
    return (Math.round((Number(v)||0)*10)/10).toFixed(1).replace('.',',') + '%';
  },
  number(v) {
    return new Intl.NumberFormat('pt-BR').format(Number(v)||0);
  },
  date(s) {
    if (!s) return '—';
    const d = new Date(s + (s.length===10?'T12:00:00':''));
    return d.toLocaleDateString('pt-BR');
  },
  monthYear(s) {
    if (!s) return '—';
    const [y, m] = s.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[(parseInt(m)||1)-1]}/${y}`;
  }
};

function calcPercent(a, b) {
  const n = Number(b);
  return n > 0 ? Math.min(Math.round((Number(a)||0) / n * 100), 999) : 0;
}

function progressColor(p) {
  if (p >= 80) return 'green';
  if (p >= 50) return 'blue';
  if (p >= 20) return 'orange';
  return 'red';
}

function progressBar(p, showPercent) {
  const color = progressColor(p);
  return `<div class="progress-bar-wrap">
    <div class="progress-bar-fill ${color}" style="width:${Math.min(p,100)}%"></div>
    ${showPercent !== false ? `<span class="progress-text">${Math.round(p)}%</span>` : ''}
  </div>`;
}

function statusBadge(status) {
  const map = {
    'Em Execução'   : 'badge badge-blue',
    'Em Andamento'  : 'badge badge-blue',
    'Concluído'     : 'badge badge-green',
    'Concluída'     : 'badge badge-green',
    'Atrasado'      : 'badge badge-red',
    'Atrasada'      : 'badge badge-red',
    'Não Iniciada'  : 'badge badge-gray',
    'Suspenso'      : 'badge badge-orange',
    'A Pagar'       : 'badge badge-orange',
    'Pago'          : 'badge badge-green',
    'Cancelado'     : 'badge badge-red'
  };
  return `<span class="${map[status]||'badge badge-gray'}" style="font-size:.7rem;">${status||'—'}</span>`;
}

function skeletonKpis(prefix, n) {}

function _kpiSetWithAnimation(id, val, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = (fn||Math.round)(Number(val)||0);
  el.textContent = target;
}

function getMonthsArray(start, end) {
  if (!start || !end) return [];
  const result = [];
  let [sy, sm] = start.split('-').map(Number);
  let [ey, em] = end.split('-').map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2,'0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
    if (result.length > 120) break;
  }
  return result;
}

/* ── KPI animação ── */
(function() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform:translateX(100%); opacity:0; }
      to   { transform:translateX(0);   opacity:1; }
    }`;
  document.head.appendChild(style);
})();

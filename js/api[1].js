/* ==========================================================
   ONG GESTOR v3 — Camada de API / Supabase + Utilitários
   ========================================================== */

/* ── Configuração Supabase ── */
const SUPABASE_URL = "https://twzzchsxuaiashmwozdz.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_vYeOaJ1-TR9y5Ua4b6Csmw_MHz0783B";

function _headers(extra) {
  return Object.assign({
    'Content-Type'  : 'application/json',
    'apikey'        : SUPABASE_KEY,
    'Authorization' : 'Bearer ' + SUPABASE_KEY,
    'Prefer'        : 'return=representation'
  }, extra || {});
}

/* ── Cache em memória ── */
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

/* ── Campos de sistema que não devem ser enviados no update ── */
const _SYS_FIELDS = ['created_at','updated_at','gs_project_id','gs_table_name'];

/* ==========================================================
   DB — operações CRUD
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
      // Remove campos de sistema e undefined
      _SYS_FIELDS.forEach(f => delete obj[f]);
      const body = JSON.stringify(obj);
      const r = await fetch(SUPABASE_URL + '/' + table, {
        method : 'POST',
        headers: _headers(),
        body   : body
      });
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
      // Remove campos de sistema
      const clean = Object.assign({}, obj);
      _SYS_FIELDS.forEach(f => delete clean[f]);
      delete clean.id;
      const r = await fetch(SUPABASE_URL + '/' + table + '?id=eq.' + id, {
        method : 'PATCH',
        headers: _headers(),
        body   : JSON.stringify(clean)
      });
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

/* ── Toast de notificação ── */
function showToast(msg, type) {
  type = type || 'success';
  console.log('[TOAST ' + type.toUpperCase() + '] ' + msg);
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = {
    success : '#10b981',
    error   : '#ef4444',
    warning : '#f59e0b',
    info    : '#3b82f6'
  };
  const icons = {
    success : 'fa-check-circle',
    error   : 'fa-times-circle',
    warning : 'fa-exclamation-triangle',
    info    : 'fa-info-circle'
  };
  toast.style.cssText = [
    'background:' + (colors[type] || '#10b981'),
    'color:#fff',
    'padding:12px 18px',
    'border-radius:8px',
    'font-size:.875rem',
    'font-weight:500',
    'box-shadow:0 4px 12px rgba(0,0,0,.25)',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'min-width:220px',
    'max-width:380px',
    'animation:slideInRight .25s ease',
    'cursor:pointer'
  ].join(';');
  toast.innerHTML = '<i class="fas ' + (icons[type]||'fa-check-circle') + '"></i><span>' + msg + '</span>';
  toast.onclick = () => toast.remove();
  container.appendChild(toast);
  const dur = (type === 'error') ? 7000 : 3500;
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, dur);
}

/* ── setText helper ── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = (val !== undefined && val !== null) ? val : '—';
}

/* ── Confirm dialog ── */
function confirmDialog(msg) {
  return window.confirm(msg || 'Confirmar?');
}

/* ==========================================================
   FORMATADORES
   ========================================================== */
const fmt = {
  currency(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  },
  percent(v) {
    const n = Number(v) || 0;
    return n.toFixed(1).replace('.',',') + '%';
  },
  number(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR');
  },
  date(s) {
    if (!s) return '—';
    // Aceita YYYY-MM-DD ou YYYY-MM
    const m = (s + '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (!m) return s;
    if (m[3]) return m[3] + '/' + m[2] + '/' + m[1];
    return m[2] + '/' + m[1];
  },
  dateInput(s) {
    // Converte DD/MM/YYYY para YYYY-MM-DD (para inputs type=date)
    if (!s) return '';
    const m = (s + '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return m[3] + '-' + m[2] + '-' + m[1];
    return s;
  },
  monthYear(s) {
    // Converte YYYY-MM para MM/YYYY
    if (!s) return '—';
    const parts = (s + '').split('-');
    if (parts.length >= 2) return parts[1] + '/' + parts[0];
    return s;
  }
};

/* ==========================================================
   HELPERS DE RENDERIZAÇÃO
   ========================================================== */

function calcPercent(part, total) {
  const p = Number(part)  || 0;
  const t = Number(total) || 0;
  if (t === 0) return 0;
  return Math.min(Math.round((p / t) * 1000) / 10, 100);
}

function progressColor(pct) {
  const p = Number(pct) || 0;
  if (p >= 90) return 'green';
  if (p >= 50) return 'blue';
  if (p >= 20) return 'orange';
  return 'red';
}

function progressBar(pct, showLabel) {
  const p   = Math.min(Number(pct) || 0, 100);
  const cls = progressColor(p);
  const lbl = showLabel !== false ? `<span class="text-xs text-muted">${fmt.percent(p)}</span>` : '';
  return `<div class="progress-bar-wrap" style="height:6px;flex:1;">
    <div class="progress-bar-fill ${cls}" style="width:${p}%"></div>
  </div>${lbl}`;
}

function statusBadge(status) {
  const map = {
    'Em Execução'   : 'success',
    'Concluído'     : 'info',
    'Concluída'     : 'info',
    'Suspenso'      : 'warning',
    'Cancelado'     : 'danger',
    'Em Andamento'  : 'primary',
    'A Pagar'       : 'warning',
    'Pago'          : 'success',
    'Previsto'      : 'secondary',
    'Atrasada'      : 'danger',
    'Não Iniciada'  : 'secondary'
  };
  const cls = map[status] || 'secondary';
  return `<span class="badge badge-${cls}">${status || '—'}</span>`;
}

/* ── Destrói gráfico Chart.js pelo ID do canvas ── */
const _chartInstances = {};
function destroyChart(id) {
  if (_chartInstances[id]) {
    try { _chartInstances[id].destroy(); } catch(e) {}
    delete _chartInstances[id];
  }
}
function registerChart(id, instance) {
  destroyChart(id);
  _chartInstances[id] = instance;
}

/* ── Injeção de keyframe CSS para toast ── */
(function() {
  const style = document.createElement('style');
  style.textContent = '@keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(style);
})();

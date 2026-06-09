/* ============================================================
   ONG GESTOR v4 — UI Engine Supremo
   Toast premium, Confirm Dialog, Skeleton Loaders, Helpers
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   TOAST — Sistema de notificações premium
   ────────────────────────────────────────────────────────── */
(function buildToastSystem() {
  // Sobrescreve a função showToast do api.js com versão premium
  window.showToast = function(msg, type, duration) {
    type = type || 'success';
    duration = duration || (type === 'error' ? 7000 : type === 'warning' ? 5000 : 3500);

    console.log('[' + type.toUpperCase() + '] ' + msg);

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success : 'fa-check-circle',
      error   : 'fa-times-circle',
      warning : 'fa-exclamation-triangle',
      info    : 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = [
      '<i class="fas ' + (icons[type] || 'fa-info-circle') + ' toast-icon"></i>',
      '<div class="toast-body">' + msg + '</div>',
      '<i class="fas fa-times toast-close"></i>',
      '<div class="toast-progress" style="animation-duration:' + duration + 'ms"></div>'
    ].join('');

    function dismiss() {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 280);
    }
    toast.addEventListener('click', dismiss);
    container.appendChild(toast);
    setTimeout(dismiss, duration);
  };
})();

/* ──────────────────────────────────────────────────────────
   CONFIRM DIALOG — substitui window.confirm nativo
   ────────────────────────────────────────────────────────── */
window.confirmDialog = function(msg, title, type) {
  return new Promise(function(resolve) {
    title = title || 'Confirmar ação';
    type  = type  || 'danger';

    // Remove dialog anterior se existir
    const old = document.getElementById('confirm-overlay');
    if (old) old.remove();

    const icons = { danger: 'fa-trash-alt', warning: 'fa-exclamation-triangle', info: 'fa-question-circle' };
    const btnLabels = { danger: 'Excluir', warning: 'Confirmar', info: 'OK' };

    const overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'confirm-overlay open';
    overlay.innerHTML = [
      '<div class="confirm-box">',
        '<div class="confirm-icon ' + type + '">',
          '<i class="fas ' + (icons[type] || 'fa-question-circle') + '"></i>',
        '</div>',
        '<div class="confirm-title">' + title + '</div>',
        '<div class="confirm-msg">' + msg + '</div>',
        '<div class="confirm-actions">',
          '<button class="btn btn-outline btn-sm" id="confirm-cancel">Cancelar</button>',
          '<button class="btn btn-' + type + ' btn-sm" id="confirm-ok">',
            '<i class="fas ' + (icons[type] || 'fa-check') + '"></i> ',
            (btnLabels[type] || 'Confirmar'),
          '</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    function close(result) {
      overlay.classList.add('toast-out');
      setTimeout(() => overlay.remove(), 250);
      resolve(result);
    }

    document.getElementById('confirm-ok').addEventListener('click', () => close(true));
    document.getElementById('confirm-cancel').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    // Foco no botão cancelar para segurança
    setTimeout(() => document.getElementById('confirm-cancel')?.focus(), 50);
  });
};

/* ──────────────────────────────────────────────────────────
   SKELETON LOADERS
   ────────────────────────────────────────────────────────── */
window.skeletonKpis = function(containerId, count) {
  count = count || 6;
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array(count).fill(
    '<div class="kpi-card" style="pointer-events:none;">' +
      '<div class="skeleton skeleton-kpi" style="width:46px;height:46px;border-radius:10px;flex-shrink:0;"></div>' +
      '<div style="flex:1;">' +
        '<div class="skeleton skeleton-title" style="height:22px;width:65%;"></div>' +
        '<div class="skeleton skeleton-text" style="width:50%;"></div>' +
      '</div>' +
    '</div>'
  ).join('');
};

window.skeletonTable = function(tbodyId, rows, cols) {
  rows = rows || 5; cols = cols || 6;
  const el = document.getElementById(tbodyId);
  if (!el) return;
  let html = '';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const w = [70, 45, 55, 38, 60, 40][c] || 50;
      html += '<td><div class="skeleton skeleton-text" style="width:' + w + '%;height:11px;"></div></td>';
    }
    html += '</tr>';
  }
  el.innerHTML = html;
};

window.skeletonCards = function(containerId, count) {
  count = count || 4;
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array(count).fill(
    '<div class="project-card" style="pointer-events:none;">' +
      '<div class="skeleton skeleton-title" style="width:80%;height:16px;margin-bottom:8px;"></div>' +
      '<div class="skeleton skeleton-text" style="width:55%;"></div>' +
      '<div class="skeleton" style="height:1px;margin:12px 0;"></div>' +
      '<div class="skeleton skeleton-text" style="width:70%;"></div>' +
      '<div class="skeleton skeleton-text" style="width:50%;"></div>' +
      '<div class="skeleton" style="height:5px;border-radius:99px;margin-top:10px;"></div>' +
    '</div>'
  ).join('');
};

/* ──────────────────────────────────────────────────────────
   NÚMERO ANIMADO (count-up)
   ────────────────────────────────────────────────────────── */
window.animateNumber = function(el, from, to, duration, formatter) {
  if (!el) return;
  duration = duration || 800;
  formatter = formatter || (v => v);
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    const current  = from + (to - from) * ease;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};

/* ──────────────────────────────────────────────────────────
   RIPPLE EFFECT em botões
   ────────────────────────────────────────────────────────── */
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn');
  if (!btn || btn.disabled) return;
  const r = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.5;
  r.style.cssText = [
    'position:absolute',
    'width:' + size + 'px',
    'height:' + size + 'px',
    'border-radius:50%',
    'background:rgba(255,255,255,.25)',
    'left:' + (e.clientX - rect.left - size/2) + 'px',
    'top:' + (e.clientY - rect.top  - size/2) + 'px',
    'pointer-events:none',
    'animation:ripple .5s ease forwards'
  ].join(';');

  const prevPos = getComputedStyle(btn).position;
  if (prevPos === 'static') btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(r);
  setTimeout(() => r.remove(), 600);
});

// Keyframe de ripple
(function() {
  const s = document.createElement('style');
  s.textContent = '@keyframes ripple{from{opacity:1;transform:scale(0)}to{opacity:0;transform:scale(1)}}';
  document.head.appendChild(s);
})();

/* ──────────────────────────────────────────────────────────
   CHART DEFAULTS GLOBAIS (Chart.js)
   ────────────────────────────────────────────────────────── */
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size   = 11;
  Chart.defaults.color       = '#64748b';
  Chart.defaults.plugins.tooltip.padding    = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont  = { size: 11, weight: '600' };
  Chart.defaults.plugins.tooltip.bodyFont   = { size: 11 };
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.animation.duration         = 600;
  Chart.defaults.animation.easing           = 'easeOutQuart';
  Chart.defaults.elements.bar.borderRadius  = 6;
  Chart.defaults.elements.line.tension      = 0.35;
  Chart.defaults.elements.point.radius      = 4;
  Chart.defaults.elements.point.hoverRadius = 6;
}

/* ──────────────────────────────────────────────────────────
   BUSCA GLOBAL (header)
   ────────────────────────────────────────────────────────── */
window.handleGlobalSearch = function(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q || q.length < 2) return;

  // Navega para financeiro com filtro ativo
  if (e.key === 'Enter') {
    const finSearch = document.getElementById('fin-search');
    if (finSearch) {
      finSearch.value = q;
      navigateTo('financeiro');
      setTimeout(() => filterDespesas(), 200);
    }
    e.target.value = '';
  }
};

/* ──────────────────────────────────────────────────────────
   KEYBOARD SHORTCUTS
   ────────────────────────────────────────────────────────── */
document.addEventListener('keydown', function(e) {
  // Ctrl+K ou Cmd+K → foca busca global
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
    return;
  }
  // N → Novo (action do header) se não estiver em um input
  if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
    headerActionClick();
  }
});

/* ──────────────────────────────────────────────────────────
   AUTO-RESIZE TEXTAREA
   ────────────────────────────────────────────────────────── */
document.addEventListener('input', function(e) {
  if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('auto-resize')) {
    e.target.style.height = 'auto';
    e.target.style.height = (e.target.scrollHeight) + 'px';
  }
});

/* ──────────────────────────────────────────────────────────
   FORMATADOR DE CAMPOS MOEDA (auto-máscara leve)
   ────────────────────────────────────────────────────────── */
document.addEventListener('input', function(e) {
  if (!e.target.classList.contains('currency-input')) return;
  let v = e.target.value.replace(/[^\d]/g, '');
  if (!v) { e.target.value = ''; return; }
  const num = parseInt(v) / 100;
  e.target.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
});

/* ──────────────────────────────────────────────────────────
   PROGRESS BAR animada ao setar texto em KPIs
   ────────────────────────────────────────────────────────── */
window._kpiSetWithAnimation = function(id, value, formatter) {
  const el = document.getElementById(id);
  if (!el) return;
  formatter = formatter || (v => v);
  const from = parseFloat(el.textContent.replace(/[^\d.,]/g,'').replace(',','.')) || 0;
  const to   = typeof value === 'number' ? value : parseFloat(value) || 0;
  if (from !== to && typeof value === 'number') {
    animateNumber(el, from, to, 700, formatter);
  } else {
    el.textContent = (value !== undefined && value !== null) ? value : '—';
  }
};

/* ──────────────────────────────────────────────────────────
   EXPORTAR PDF (print window)
   ────────────────────────────────────────────────────────── */
window.printPrestacao = function() {
  const projId = document.getElementById('prest-select-projeto')?.value;
  if (!projId) { showToast('Selecione um projeto primeiro', 'warning'); return; }
  window.print();
};

/* ──────────────────────────────────────────────────────────
   TOOLTIPS SIMPLES (data-tooltip)
   ────────────────────────────────────────────────────────── */
(function initTooltips() {
  let tip = null;
  document.addEventListener('mouseover', function(e) {
    const el = e.target.closest('[title]');
    if (!el || el.tagName === 'INPUT') return;
    const text = el.getAttribute('title');
    if (!text) return;
    el.setAttribute('data-title', text);
    el.removeAttribute('title');

    tip = document.createElement('div');
    tip.className = '_tooltip';
    tip.textContent = text;
    tip.style.cssText = [
      'position:fixed',
      'background:#1e293b',
      'color:#fff',
      'font-size:.7rem',
      'padding:4px 9px',
      'border-radius:5px',
      'pointer-events:none',
      'z-index:99999',
      'white-space:nowrap',
      'box-shadow:0 2px 8px rgba(0,0,0,.2)',
      'opacity:0',
      'transition:opacity .15s'
    ].join(';');
    document.body.appendChild(tip);

    const r = el.getBoundingClientRect();
    tip.style.left = (r.left + r.width/2 - tip.offsetWidth/2) + 'px';
    tip.style.top  = (r.top - tip.offsetHeight - 6) + 'px';
    requestAnimationFrame(() => { if (tip) tip.style.opacity = '1'; });
  });

  document.addEventListener('mouseout', function(e) {
    const el = e.target.closest('[data-title]');
    if (el) {
      el.setAttribute('title', el.getAttribute('data-title'));
      el.removeAttribute('data-title');
    }
    if (tip) { tip.remove(); tip = null; }
  });
})();

/* ──────────────────────────────────────────────────────────
   SCROLL-TO-TOP BUTTON
   ────────────────────────────────────────────────────────── */
(function initScrollTop() {
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  btn.style.cssText = [
    'position:fixed',
    'bottom:76px',
    'right:24px',
    'width:38px',
    'height:38px',
    'border-radius:50%',
    'background:var(--primary)',
    'color:#fff',
    'border:none',
    'cursor:pointer',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'font-size:.85rem',
    'box-shadow:var(--shadow-md)',
    'z-index:500',
    'transition:var(--tr)',
    'opacity:.85'
  ].join(';');
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  btn.onmouseenter = () => btn.style.opacity = '1';
  btn.onmouseleave = () => btn.style.opacity = '.85';
  document.body.appendChild(btn);

  window.addEventListener('scroll', function() {
    btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
  }, { passive: true });
})();

/* ──────────────────────────────────────────────────────────
   ONLINE / OFFLINE STATUS
   ────────────────────────────────────────────────────────── */
window.addEventListener('offline', function() {
  showToast('<i class="fas fa-wifi-slash"></i> Sem conexão com a internet', 'warning', 0);
});
window.addEventListener('online', function() {
  showToast('Conexão restaurada!', 'success');
});

/* ──────────────────────────────────────────────────────────
   BUSCA GLOBAL (Ctrl+K)
   Busca em: Projetos, Despesas, Rubricas, Metas, Documentos
   ────────────────────────────────────────────────────────── */

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const inp = document.getElementById('global-search');
    if (inp) { inp.focus(); inp.select(); }
  }
  if (e.key === 'Escape') _hideSearchOverlay();
});

function handleGlobalSearch(e) {
  if (e.key === 'Escape') { _hideSearchOverlay(); return; }
  const q = e.target?.value?.trim() || '';
  if (q.length < 2) { _hideSearchOverlay(); return; }
  _runGlobalSearch(q);
}

function _showSearchOverlay() {
  let ov = document.getElementById('global-search-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'global-search-overlay';
    ov.innerHTML = `
      <div id="global-search-box">
        <div id="global-search-results"></div>
        <div style="padding:8px 14px;border-top:1px solid #e2e8f0;font-size:.72rem;color:#9ca3af;text-align:right;">
          <kbd style="background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-family:monospace;">Esc</kbd> para fechar
        </div>
      </div>`;
    ov.onclick = function(ev) { if (ev.target === ov) _hideSearchOverlay(); };
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
}

function _hideSearchOverlay() {
  const ov = document.getElementById('global-search-overlay');
  if (ov) ov.style.display = 'none';
}

async function _runGlobalSearch(q) {
  _showSearchOverlay();
  const box = document.getElementById('global-search-results');
  if (!box) return;
  box.innerHTML = `<div style="padding:20px;text-align:center;color:#6b7280;"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>`;

  const ql = q.toLowerCase();

  const projetos   = CACHE.projetos   || await DB.getAll('ong_projetos').catch(()=>[]);
  const despesas   = CACHE.despesas   || await DB.getAll('ong_despesas').catch(()=>[]);
  const rubricas   = CACHE.rubricas   || await DB.getAll('ong_rubricas').catch(()=>[]);
  const metas      = CACHE.metas      || await DB.getAll('ong_metas').catch(()=>[]);
  const documentos = CACHE.documentos || await DB.getAll('ong_documentos').catch(()=>[]);

  const results = [];

  projetos.filter(p =>
    [p.nome_projeto, p.numero_proposta, p.concedente, p.ong_nome, p.objeto_projeto]
    .some(f => (f||'').toLowerCase().includes(ql))
  ).slice(0,5).forEach(p => results.push({
    type: 'projeto', icon: 'fa-folder', color: 'blue',
    title: p.nome_projeto || p.numero_proposta || '—',
    sub:   `${p.numero_proposta||''} · ${p.concedente||''} · ${p.status||''}`,
    action: `navigateTo('projetos')`
  }));

  despesas.filter(d =>
    [d.descricao, d.fornecedor, d.numero_documento, d.cnpj_cpf, d.observacao]
    .some(f => (f||'').toLowerCase().includes(ql))
  ).slice(0,5).forEach(d => {
    const proj = projetos.find(p => p.id===d.projeto_id);
    results.push({
      type: 'despesa', icon: 'fa-receipt', color: 'green',
      title: d.descricao || d.fornecedor || 'Lançamento',
      sub:   `${fmt.currency(d.valor)} · ${d.mes_referencia||''} · ${proj?.nome_projeto||''}`,
      action: `navigateTo('financeiro');setTimeout(()=>editDespesa('${d.id}'),600)`
    });
  });

  rubricas.filter(r =>
    [r.descricao, r.categoria].some(f => (f||'').toLowerCase().includes(ql))
  ).slice(0,5).forEach(r => {
    const proj = projetos.find(p => p.id===r.projeto_id);
    results.push({
      type: 'rubrica', icon: 'fa-tags', color: 'orange',
      title: `${r.categoria} — ${r.descricao}`,
      sub:   `${fmt.currency(r.valor_previsto)} previsto · ${proj?.nome_projeto||''}`,
      action: `navigateTo('financeiro');setTimeout(()=>switchFinTab&&switchFinTab('rubricas'),300)`
    });
  });

  metas.filter(m =>
    [m.descricao_meta, m.indicador].some(f => (f||'').toLowerCase().includes(ql))
  ).slice(0,4).forEach(m => {
    const proj = projetos.find(p => p.id===m.projeto_id);
    results.push({
      type: 'meta', icon: 'fa-bullseye', color: 'purple',
      title: `Meta ${m.numero_meta||''} — ${m.descricao_meta||''}`,
      sub:   `${proj?.nome_projeto||''} · ${m.status||''}`,
      action: `navigateTo('plano')`
    });
  });

  documentos.filter(doc =>
    [doc.descricao, doc.numero_documento, doc.tipo_documento]
    .some(f => (f||'').toLowerCase().includes(ql))
  ).slice(0,4).forEach(doc => {
    results.push({
      type: 'documento', icon: 'fa-paperclip', color: 'teal',
      title: doc.descricao || doc.tipo_documento || 'Documento',
      sub:   `${doc.tipo_documento||''} ${doc.numero_documento||''} · ${fmt.date(doc.data_upload)}`,
      action: `navigateTo('documentos')`
    });
  });

  if (!results.length) {
    box.innerHTML = `<div style="padding:28px;text-align:center;color:#9ca3af;">
      <i class="fas fa-search" style="font-size:1.6rem;opacity:.3;display:block;margin-bottom:8px;"></i>
      Nenhum resultado para <strong>"${q}"</strong>
    </div>`;
    return;
  }

  const colorBg  = { blue:'#dbeafe', green:'#d1fae5', orange:'#fef3c7', purple:'#f3e8ff', teal:'#ccfbf1' };
  const colorTxt = { blue:'#1e40af', green:'#065f46', orange:'#92400e', purple:'#5b21b6', teal:'#0f766e' };
  const typeLabel= { projeto:'Projeto', despesa:'Lançamento', rubrica:'Rubrica', meta:'Meta', documento:'Documento' };

  box.innerHTML = `
    <div style="padding:10px 14px 6px;font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">
      ${results.length} resultado${results.length!==1?'s':''} para "${q}"
    </div>
    ${results.map(r => `
    <div class="gs-result-item" onclick="_hideSearchOverlay();${r.action}">
      <div style="width:32px;height:32px;border-radius:8px;background:${colorBg[r.color]||'#f1f5f9'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fas ${r.icon}" style="color:${colorTxt[r.color]||'#374151'};font-size:.8rem;"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.83rem;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.title}</div>
        <div style="font-size:.72rem;color:#6b7280;margin-top:1px;">${r.sub}</div>
      </div>
      <span style="font-size:.65rem;padding:2px 8px;background:${colorBg[r.color]||'#f1f5f9'};color:${colorTxt[r.color]||'#374151'};border-radius:10px;white-space:nowrap;flex-shrink:0;">${typeLabel[r.type]||r.type}</span>
    </div>`).join('')}`;
}

// CSS da busca global (injeta via JS para não exigir edição do style.css)
(function() {
  const s = document.createElement('style');
  s.textContent = `
    #global-search-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:none;align-items:flex-start;justify-content:center;padding-top:80px;}
    #global-search-box{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);width:100%;max-width:560px;overflow:hidden;animation:pageFadeIn .15s ease;}
    #global-search-results{max-height:420px;overflow-y:auto;}
    .gs-result-item{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .1s;}
    .gs-result-item:hover{background:#f8fafc;}
    .gs-result-item:last-child{border-bottom:none;}
  `;
  document.head.appendChild(s);
})();

/* ──────────────────────────────────────────────────────────
   AUTO-SAVE DE RASCUNHO NOS MODAIS (localStorage)
   Salva automaticamente enquanto o usuário digita,
   restaura ao reabrir o mesmo modal
   ────────────────────────────────────────────────────────── */

const _DRAFT_MODALS = ['form-despesa', 'form-rubrica', 'form-meta', 'form-fase', 'form-plano-aplicacao'];
const _DRAFT_PREFIX = 'ong_draft_';

/* Inicializa watchers de auto-save em todos os formulários de modal */
function initDraftAutoSave() {
  _DRAFT_MODALS.forEach(formId => {
    const form = document.getElementById(formId);
    if (!form) return;
    // Escuta qualquer mudança nos campos
    form.addEventListener('input', () => _saveDraft(formId));
    form.addEventListener('change', () => _saveDraft(formId));
  });
}

function _saveDraft(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  // Não salva se há um ID de edição ativo (editando existente)
  const editId = formId === 'form-despesa'  ? (typeof despesaEditId  !== 'undefined' && despesaEditId)
               : formId === 'form-rubrica'  ? (typeof rubricaEditId  !== 'undefined' && rubricaEditId)
               : formId === 'form-meta'     ? (typeof _metaEditId    !== 'undefined' && _metaEditId)
               : null;
  if (editId) return; // não rascunha ao editar

  const data = {};
  new FormData(form).forEach((v, k) => { if (v && v !== '') data[k] = v; });
  if (Object.keys(data).length === 0) return;
  localStorage.setItem(_DRAFT_PREFIX + formId, JSON.stringify(data));
}

function _restoreDraft(formId) {
  const raw = localStorage.getItem(_DRAFT_PREFIX + formId);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    const form = document.getElementById(formId);
    if (!form) return false;
    Object.entries(data).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el && !el.value) el.value = v;
    });
    return true;
  } catch(e) { return false; }
}

function _clearDraft(formId) {
  localStorage.removeItem(_DRAFT_PREFIX + formId);
}

/* Expõe globalmente */
window.restoreFormDraft = _restoreDraft;
window.clearFormDraft   = _clearDraft;

/* Inicializa após carregamento do DOM */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initDraftAutoSave, 800);
});

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

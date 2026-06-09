/* =============================================
   ONG GESTOR v5 — Dashboard Geral + Individual
   Supreme Edition
   ============================================= */

let _dashCharts     = {};
let _projDashId     = null;
let _projDashCharts = {};

/* ════════════════════════════════════════════
   DASHBOARD GERAL
════════════════════════════════════════════ */
async function loadDashboard() {
  // Destrói todos os charts anteriores para evitar "Canvas already in use"
  ['chartFinanceiro','chartStatus','chartMensalGlobal','chartCategorias'].forEach(id => _destroyDashChart(id));

  // Skeleton nos KPIs enquanto carrega
  const kpiGrid = document.querySelector('#page-dashboard .kpi-grid');
  if (kpiGrid) skeletonKpis('', 6);

  try {
    const projetos   = CACHE.projetos   || await DB.getAll('ong_projetos');
    const despesas   = CACHE.despesas   || await DB.getAll('ong_despesas');
    const metas      = CACHE.metas      || await DB.getAll('ong_metas');
    const rubricas   = CACHE.rubricas   || await DB.getAll('ong_rubricas');
    CACHE.projetos = projetos;
    CACHE.despesas = despesas;
    CACHE.metas    = metas;
    CACHE.rubricas = rubricas;

    /* ── KPIs ── */
    const totalProjetos  = projetos.length;
    const ativos         = projetos.filter(p => p.status === 'Em Execução').length;
    const totalRepasse   = projetos.reduce((s,p) => s+(Number(p.valor_repasse)||0), 0);
    const totalExec      = despesas.reduce((s,d) => s+(Number(d.valor)||0), 0);
    const totalBenefPrev = metas.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
    const totalBenefAten = metas.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const totalAPagar    = despesas.filter(d => d.status_pagamento==='A Pagar').reduce((s,d) => s+(Number(d.valor)||0), 0);
    const percGlobal     = calcPercent(totalExec, totalRepasse);

    /* Animação count-up nos KPIs numéricos */
    _kpiSetWithAnimation('kpi-projetos', totalProjetos, Math.round);
    _kpiSetWithAnimation('kpi-ativos',   ativos,        Math.round);
    setText('kpi-repasse',     fmt.currency(totalRepasse));
    setText('kpi-executado',   fmt.currency(totalExec));
    setText('kpi-perc',        fmt.percent(percGlobal));
    setText('kpi-beneficiarios', `${fmt.number(totalBenefAten)} / ${fmt.number(totalBenefPrev)}`);
    setText('kpi-apagar',      fmt.currency(totalAPagar));
    setText('dash-global-pct', fmt.percent(percGlobal));
    setText('dash-global-exec',  `Executado: ${fmt.currency(totalExec)}`);
    setText('dash-global-total', `Total Repasse: ${fmt.currency(totalRepasse)}`);

    /* Barra global */
    const barEl = document.getElementById('dash-bar-global');
    if (barEl) {
      barEl.style.width  = percGlobal + '%';
      barEl.className    = `progress-bar-fill ${progressColor(percGlobal)}`;
    }

    /* Cor dinâmica do título do percentual */
    const pctEl = document.getElementById('dash-global-pct');
    if (pctEl) {
      pctEl.style.color = percGlobal >= 80 ? 'var(--success)'
                        : percGlobal >= 50 ? 'var(--primary)'
                        : percGlobal >= 30 ? 'var(--warning)'
                        : 'var(--danger)';
    }

    /* Gráficos */
    renderChartBarProjetos(projetos, despesas);
    renderChartStatus(projetos);
    renderChartMensalGlobal(despesas);
    renderChartCategorias(despesas, rubricas);

    /* Tabela resumo */
    renderDashProjetos(projetos, despesas, metas);

    /* Alertas */
    renderAlertas(projetos, metas, despesas);

  } catch(err) {
    showToast('Erro ao carregar dashboard: ' + err.message, 'error');
    console.error('[Dashboard]', err);
  }
}

/* ── Gráfico Barras: Repasse vs Executado por Projeto ── */
function renderChartBarProjetos(projetos, despesas) {
  const ctx = document.getElementById('chartFinanceiro');
  if (!ctx) return;
  _destroyDashChart('chartFinanceiro');

  const labels     = projetos.map(p => p.numero_proposta || (p.nome_projeto||'').slice(0,14));
  const previstos  = projetos.map(p => Number(p.valor_repasse)||0);
  const executados = projetos.map(p =>
    despesas.filter(d => d.projeto_id===p.id && d.fonte==='Repasse Federal')
            .reduce((s,d) => s+(Number(d.valor)||0), 0)
  );

  _dashCharts['chartFinanceiro'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Repasse (R$)',
          data: previstos,
          backgroundColor: 'rgba(37,99,235,.15)',
          borderColor: 'rgba(37,99,235,.7)',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Executado (R$)',
          data: executados,
          backgroundColor: 'rgba(5,150,105,.8)',
          borderColor: 'rgba(5,150,105,1)',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { padding: 14 } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt.currency(c.raw)}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : ''+v },
          grid: { color: 'rgba(0,0,0,.04)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ── Gráfico Donut: Status dos Projetos ── */
function renderChartStatus(projetos) {
  const ctx = document.getElementById('chartStatus');
  if (!ctx) return;
  _destroyDashChart('chartStatus');

  if (!projetos.length) {
    _drawEmptyChart(ctx, 'Nenhum projeto');
    return;
  }

  const counts = {};
  projetos.forEach(p => { const s = p.status || 'N/D'; counts[s] = (counts[s]||0)+1; });
  const labels = Object.keys(counts);
  const colorMap = {
    'Em Execução':         '#2563eb',
    'Concluído':           '#059669',
    'Prestação de Contas': '#d97706',
    'Suspenso':            '#dc2626',
    'Aguardando Início':   '#6b7280'
  };

  _dashCharts['chartStatus'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: Object.values(counts),
        backgroundColor: labels.map(l => colorMap[l] || '#94a3b8'),
        borderWidth: 3,
        borderColor: '#fff',
        hoverBorderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} projeto(s)` } }
      }
    }
  });
}

/* ── Gráfico Line: Despesas Mensais Global ── */
function renderChartMensalGlobal(despesas) {
  const ctx = document.getElementById('chartMensalGlobal');
  if (!ctx) return;
  _destroyDashChart('chartMensalGlobal');

  const mesMap = {};
  despesas.forEach(d => {
    const m = d.mes_referencia || '?';
    mesMap[m] = (mesMap[m]||0) + (Number(d.valor)||0);
  });
  const sorted = Object.entries(mesMap)
    .filter(([k]) => k !== '?')
    .sort((a,b) => a[0].localeCompare(b[0]));

  if (!sorted.length) {
    _drawEmptyChart(ctx, 'Sem despesas');
    return;
  }

  _dashCharts['chartMensalGlobal'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(x => { const p = x[0].split('-'); return (p[1]||'')+'/'+(p[0]||''); }),
      datasets: [{
        label: 'Despesas Mensais (R$)',
        data: sorted.map(x => x[1]),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,.06)',
        tension: .35,
        fill: true,
        pointBackgroundColor: '#2563eb',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : ''+v },
          grid: { color: 'rgba(0,0,0,.04)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ── Gráfico Barra Horizontal: Por Categoria ── */
function renderChartCategorias(despesas, rubricas) {
  const ctx = document.getElementById('chartCategorias');
  if (!ctx) return;
  _destroyDashChart('chartCategorias');

  const catMap = {};
  despesas.forEach(d => {
    const rub = rubricas.find(r => r.id===d.rubrica_id);
    const cat = rub?.categoria || 'Outros';
    catMap[cat] = (catMap[cat]||0) + (Number(d.valor)||0);
  });

  if (!Object.keys(catMap).length) {
    _drawEmptyChart(ctx, 'Sem categorias');
    return;
  }

  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const paleta = ['#2563eb','#059669','#d97706','#dc2626','#0891b2','#7c3aed','#db2777','#0f766e'];

  _dashCharts['chartCategorias'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{
        label: 'Executado (R$)',
        data: sorted.map(x => x[1]),
        backgroundColor: paleta.slice(0, sorted.length).map(c => c + 'cc'),
        borderColor: paleta.slice(0, sorted.length),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : ''+v },
          grid: { color: 'rgba(0,0,0,.04)' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

/* ── Helper: gráfico vazio ── */
function _drawEmptyChart(ctx, msg) {
  // Garante que qualquer chart anterior seja destruído primeiro
  try {
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();
  } catch(e) {}
  new Chart(ctx, {
    type: 'doughnut',
    data: { labels: [msg], datasets: [{ data: [1], backgroundColor: ['#f1f5f9'], borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '0%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });
}

/* ── Tabela resumo de projetos no dashboard ── */
function renderDashProjetos(projetos, despesas, metas) {
  const tbody = document.getElementById('dash-projetos-recentes');
  if (!tbody) return;

  if (!projetos.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-folder-open"></i><p>Nenhum projeto cadastrado.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = projetos.map((p, idx) => {
    const execProjeto = despesas.filter(d => d.projeto_id===p.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const percP       = calcPercent(execProjeto, p.valor_repasse);
    const benef       = metas.filter(m => m.projeto_id===p.id).reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const nDocs       = despesas.filter(d => d.projeto_id===p.id).length;
    const saude       = _calcSaude(p, percP);

    return `<tr style="animation: pageFadeIn .2s ease ${idx * 0.04}s both;">
      <td>
        <div class="flex items-center gap-2">
          <span title="${saude.label}" style="font-size:1.1rem;">${saude.emoji}</span>
          <div>
            <div class="font-semibold" style="font-size:.82rem;">${p.nome_projeto || '-'}</div>
            <div class="text-xs text-muted">
              ${p.numero_proposta ? `<span class="badge badge-gray" style="font-size:.6rem;">${p.numero_proposta}</span>` : ''}
              ${nDocs} lançamento${nDocs !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </td>
      <td>${statusBadge(p.status)}</td>
      <td class="text-right font-semibold text-sm">${fmt.currency(p.valor_repasse)}</td>
      <td class="text-right font-semibold text-sm text-success">${fmt.currency(execProjeto)}</td>
      <td style="min-width:100px;">${progressBar(percP, true)}</td>
      <td class="text-center font-semibold">${fmt.number(benef)}</td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="viewProjeto('${p.id}')">
          <i class="fas fa-chart-line"></i> Dash
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Calcula saúde do projeto (semáforo) ── */
function _calcSaude(proj, percExec) {
  const hoje = new Date();
  let diasRestantes = Infinity;
  let percTempo = 0;

  if (proj.data_inicio && proj.data_fim) {
    const inicio = new Date(proj.data_inicio);
    const fim    = new Date(proj.data_fim);
    const total  = Math.max((fim - inicio) / 86400000, 1);
    const decor  = Math.max((hoje - inicio) / 86400000, 0);
    percTempo    = Math.min((decor / total) * 100, 100);
    diasRestantes = Math.ceil((fim - hoje) / 86400000);
  }

  if (diasRestantes < 0)                  return { emoji: '🔴', label: 'Vigência encerrada' };
  if (diasRestantes <= 30)                return { emoji: '🔴', label: `Vigência em ${diasRestantes} dias` };
  if (percExec < percTempo - 20)          return { emoji: '🔴', label: 'Execução muito atrasada' };
  if (percExec < percTempo - 10)          return { emoji: '🟡', label: 'Execução abaixo do previsto' };
  if (percExec >= percTempo || percExec >= 80) return { emoji: '🟢', label: 'Execução em dia' };
  return { emoji: '🟡', label: 'Atenção — acompanhe o cronograma' };
}

/* ── Alertas automáticos inteligentes ── */
function renderAlertas(projetos, metas, despesas) {
  const c = document.getElementById('dash-alertas');
  if (!c) return;

  const alertas = [];
  const hoje = new Date();

  /* Projetos com vigência próxima */
  projetos.forEach(p => {
    if (p.data_fim && p.status === 'Em Execução') {
      const fim  = new Date(p.data_fim);
      const dias = Math.ceil((fim - hoje) / 86400000);
      if (dias < 0) {
        alertas.push({ type:'danger', icon:'fa-exclamation-circle', priority: 0,
          msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: vigência <strong>encerrada há ${Math.abs(dias)} dias</strong>!` });
      } else if (dias <= 30) {
        alertas.push({ type:'danger', icon:'fa-fire', priority: 1,
          msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: termina em <strong>${dias} dia${dias!==1?'s':''}</strong>` });
      } else if (dias <= 60) {
        alertas.push({ type:'warning', icon:'fa-calendar-alt', priority: 2,
          msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: vigência termina em <strong>${dias} dias</strong>` });
      }
    }
  });

  /* Metas atrasadas */
  const metasAtrasadas = metas.filter(m => m.status === 'Atrasada');
  if (metasAtrasadas.length) {
    alertas.push({ type:'danger', icon:'fa-flag', priority: 1,
      msg: `<strong>${metasAtrasadas.length} meta(s) atrasada(s)</strong> — ${metasAtrasadas.map(m=>'Meta '+m.numero_meta).join(', ')}` });
  }

  /* Despesas a pagar */
  const aPagar = despesas.filter(d => d.status_pagamento === 'A Pagar');
  if (aPagar.length > 0) {
    const tot = aPagar.reduce((s,d) => s+(Number(d.valor)||0), 0);
    alertas.push({ type:'info', icon:'fa-file-invoice-dollar', priority: 3,
      msg: `<strong>${aPagar.length}</strong> lançamento(s) pendente(s) — total: <strong>${fmt.currency(tot)}</strong>` });
  }

  /* Projetos sem rubricas */
  const semRubrica = projetos.filter(p =>
    p.status === 'Em Execução' && !(CACHE.rubricas||[]).some(r => r.projeto_id===p.id)
  );
  if (semRubrica.length) {
    alertas.push({ type:'warning', icon:'fa-list-check', priority: 2,
      msg: `<strong>${semRubrica.length} projeto(s)</strong> em execução sem rubricas cadastradas` });
  }

  if (alertas.length === 0) {
    c.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i><div><strong>Tudo em ordem!</strong> Nenhum alerta pendente.</div></div>`;
    return;
  }

  /* Ordena por prioridade */
  alertas.sort((a,b) => a.priority - b.priority);

  c.innerHTML = alertas.map(a =>
    `<div class="alert alert-${a.type}">
      <i class="fas ${a.icon}"></i>
      <div>${a.msg}</div>
    </div>`
  ).join('');
}

/* ── Helper: destruir chart local do dashboard ── */
function _destroyDashChart(id) {
  // 1) Tenta pelo mapa interno
  if (_dashCharts[id]) {
    try { _dashCharts[id].destroy(); } catch(e) {}
    delete _dashCharts[id];
  }
  // 2) Fallback: Chart.js pode ter registrado o chart pelo ID do canvas
  try {
    const ctx = document.getElementById(id);
    if (ctx) {
      const existing = Chart.getChart(ctx);
      if (existing) existing.destroy();
    }
  } catch(e) {}
}

/* ════════════════════════════════════════════
   DASHBOARD INDIVIDUAL DO PROJETO
════════════════════════════════════════════ */
async function viewProjeto(id) {
  _projDashId = id;
  navigateTo('dash-projeto');
  await loadProjDashboard(id);
}

async function loadProjDashboard(id) {
  const el = document.getElementById('proj-dash-content');
  if (el) el.innerHTML = `
    <div class="loading-spinner" style="padding:60px;">
      <i class="fas fa-spinner"></i> Carregando projeto...
    </div>`;

  try {
    const projetos   = CACHE.projetos   || await DB.getAll('ong_projetos');
    const despesas   = CACHE.despesas   || await DB.getAll('ong_despesas');
    const metas      = CACHE.metas      || await DB.getAll('ong_metas');
    const rubricas   = CACHE.rubricas   || await DB.getAll('ong_rubricas');
    const cronograma = CACHE.cronograma || await DB.getAll('ong_cronograma');

    Object.assign(CACHE, { projetos, despesas, metas, rubricas, cronograma });

    const p   = projetos.find(x => x.id === id);
    const dep = despesas.filter(d => d.projeto_id === id);
    const met = metas.filter(m => m.projeto_id === id);
    const rub = rubricas.filter(r => r.projeto_id === id);
    const crn = cronograma.filter(c => c.projeto_id === id);

    if (!p) {
      el.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Projeto não encontrado.</div>`;
      return;
    }

    const execRepasse = dep.filter(d => d.fonte==='Repasse Federal').reduce((s,d) => s+(Number(d.valor)||0), 0);
    const execContra  = dep.filter(d => d.fonte==='Contrapartida').reduce((s,d) => s+(Number(d.valor)||0), 0);
    const totalExec   = execRepasse + execContra;
    const totalRep    = Number(p.valor_repasse)||0;
    const totalCont   = Number(p.valor_contrapartida)||0;
    const saldo       = totalRep - execRepasse;
    const percExec    = calcPercent(totalExec, totalRep + totalCont);
    const benPrev     = met.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
    const benAten     = met.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const percBenef   = calcPercent(benAten, benPrev);
    const aPagar      = dep.filter(d => d.status_pagamento==='A Pagar').reduce((s,d) => s+(Number(d.valor)||0), 0);
    const nDocs       = dep.length;

    el.innerHTML = buildProjDashHTML(p, dep, met, rub, crn, {
      totalExec, totalRep, totalCont, saldo, percExec,
      benPrev, benAten, percBenef, aPagar, nDocs, execRepasse, execContra
    });

    setTimeout(() => {
      renderProjChartMensal(dep, id);
      renderProjChartRubricas(dep, rub, id);
      renderProjChartMetas(met, id);
      renderProjChartCronograma(crn, rub, id);
    }, 80);

  } catch(err) {
    document.getElementById('proj-dash-content').innerHTML =
      `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${err.message}</div>`;
    console.error(err);
  }
}

function buildProjDashHTML(p, dep, met, rub, crn, nums) {
  const { totalExec, totalRep, totalCont, saldo, percExec, benPrev, benAten, percBenef, aPagar, nDocs, execRepasse, execContra } = nums;

  /* Dias restantes */
  let diasInfo = '';
  if (p.data_fim) {
    const dias = Math.ceil((new Date(p.data_fim) - new Date()) / 86400000);
    if (dias < 0) diasInfo = `<span class="badge badge-danger"><i class="fas fa-exclamation-circle"></i> Vigência encerrada</span>`;
    else if (dias <= 30) diasInfo = `<span class="badge badge-danger"><i class="fas fa-fire"></i> ${dias}d restantes</span>`;
    else if (dias <= 90) diasInfo = `<span class="badge badge-warning"><i class="fas fa-clock"></i> ${dias}d restantes</span>`;
    else diasInfo = `<span class="badge badge-green"><i class="fas fa-calendar-check"></i> ${dias}d restantes</span>`;
  }

  /* ── Cabeçalho colorido ── */
  const header = `
  <div class="proj-dash-header mb-3">
    <div class="flex justify-between items-center flex-wrap" style="gap:10px">
      <div>
        <div class="flex items-center gap-1 mb-1" style="flex-wrap:wrap;gap:8px;">
          <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="navigateTo('projetos')">
            <i class="fas fa-arrow-left"></i> Projetos
          </button>
          ${statusBadge(p.status)}
          ${diasInfo}
        </div>
        <h2>${p.nome_projeto || 'Projeto'}</h2>
        <p>${p.numero_proposta || '-'} &nbsp;·&nbsp; ${p.modalidade || '-'} &nbsp;·&nbsp; ${p.concedente || '-'}</p>
      </div>
      <div class="flex gap-1" style="flex-wrap:wrap;">
        <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="editProjeto('${p.id}')">
          <i class="fas fa-pencil"></i> Editar
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="navigateTo('rubricas')">
          <i class="fas fa-calendar-alt"></i> Rubricas
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="navigateTo('prestacao');setTimeout(()=>{const s=document.getElementById('prest-select-projeto');if(s){s.value='${p.id}';loadPrestacao();}},400)">
          <i class="fas fa-file-invoice"></i> Prestação
        </button>
        <button class="btn btn-sm" style="background:rgba(37,99,235,.6);color:#fff;border:1px solid rgba(37,99,235,.5);" onclick="openModalDespesa()">
          <i class="fas fa-plus"></i> Nova Despesa
        </button>
      </div>
    </div>
    <div class="proj-dash-meta">
      <div class="proj-dash-meta-item"><i class="fas fa-building"></i> ${p.ong_nome || '-'}</div>
      <div class="proj-dash-meta-item"><i class="fas fa-map-marker-alt"></i> ${p.municipio || '-'}${p.uf ? '/'+p.uf : ''}</div>
      <div class="proj-dash-meta-item"><i class="fas fa-calendar"></i> ${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</div>
      <div class="proj-dash-meta-item"><i class="fas fa-users"></i> ${p.publico_beneficiario || '-'}</div>
    </div>
  </div>`;

  /* ── KPIs do projeto ── */
  const kpis = `
  <div class="kpi-grid mb-3" style="grid-template-columns:repeat(auto-fit,minmax(155px,1fr));">
    <div class="kpi-card blue">
      <div class="kpi-icon blue"><i class="fas fa-university"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalRep)}</div><div class="kpi-label">Repasse Federal</div></div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-icon green"><i class="fas fa-hand-holding-heart"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalCont)}</div><div class="kpi-label">Contrapartida</div></div>
    </div>
    <div class="kpi-card orange">
      <div class="kpi-icon orange"><i class="fas fa-receipt"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalExec)}</div><div class="kpi-label">Total Executado</div><div class="kpi-sub">${fmt.percent(percExec)}</div></div>
    </div>
    <div class="kpi-card ${saldo < 0 ? 'red' : 'teal'}">
      <div class="kpi-icon ${saldo < 0 ? 'red' : 'teal'}"><i class="fas fa-balance-scale"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem;${saldo < 0 ? 'color:var(--danger)' : ''}">${fmt.currency(saldo)}</div><div class="kpi-label">Saldo Disponível</div></div>
    </div>
    <div class="kpi-card purple">
      <div class="kpi-icon purple"><i class="fas fa-users"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.85rem">${fmt.number(benAten)} / ${fmt.number(benPrev)}</div><div class="kpi-label">Beneficiários</div><div class="kpi-sub">${fmt.percent(percBenef)}</div></div>
    </div>
    <div class="kpi-card red">
      <div class="kpi-icon red"><i class="fas fa-clock"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(aPagar)}</div><div class="kpi-label">A Pagar</div></div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-icon blue"><i class="fas fa-file-invoice"></i></div>
      <div class="kpi-info"><div class="kpi-value">${nDocs}</div><div class="kpi-label">Lançamentos</div></div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(dep.filter(d=>d.status_pagamento==='Pago').reduce((s,d)=>s+(Number(d.valor)||0),0))}</div><div class="kpi-label">Total Pago</div></div>
    </div>
  </div>`;

  /* ── Barra de execução ── */
  const barra = `
  <div class="card card-accent-blue mb-3">
    <div class="card-body">
      <div class="flex justify-between mb-1">
        <span class="text-sm font-semibold">Execução Financeira Global do Projeto</span>
        <span class="text-sm font-semibold" style="color:${progressColor(percExec)==='green'?'var(--success)':progressColor(percExec)==='orange'?'var(--warning)':progressColor(percExec)==='red'?'var(--danger)':'var(--primary)'}">
          ${fmt.percent(percExec)}
        </span>
      </div>
      <div class="progress-bar-wrap" style="height:12px;border-radius:8px;">
        <div class="progress-bar-fill ${progressColor(percExec)}" style="width:${percExec}%"></div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-xs text-muted">Repasse Fed. executado: ${fmt.currency(execRepasse)}</span>
        <span class="text-xs text-muted">Total previsto: ${fmt.currency(totalRep + totalCont)}</span>
      </div>
    </div>
  </div>`;

  /* ── 4 gráficos ── */
  const graficos = `
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-chart-line"></i> Despesas por Mês</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartMensal-${p.id}"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-chart-pie"></i> Execução por Categoria</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartRubricas-${p.id}"></canvas></div>
    </div>
  </div>
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-bullseye"></i> Metas — Beneficiários</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartMetas-${p.id}"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-calendar-check"></i> Cronograma Previsto vs Executado</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartCronograma-${p.id}"></canvas></div>
    </div>
  </div>`;

  const rubTable  = buildRubricasSummary(rub, dep, p.id);
  const metaTable = buildMetasSummary(met, dep, rub);
  const despTable = buildDespesasRecentes(dep, rub);

  return header + kpis + barra + graficos + rubTable + metaTable + despTable;
}

/* ── Gráfico 1: Barras mensais ── */
function renderProjChartMensal(dep, projId) {
  const ctx = document.getElementById(`projChartMensal-${projId}`);
  if (!ctx) return;

  const mesMap = {};
  dep.forEach(d => { const m = d.mes_referencia||'?'; mesMap[m] = (mesMap[m]||0)+(Number(d.valor)||0); });
  const sorted = Object.entries(mesMap).filter(([k])=>k!=='?').sort((a,b)=>a[0].localeCompare(b[0]));

  const key = `pm${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => { const p=x[0].split('-'); return (p[1]||'')+'/'+(p[0]||''); }),
      datasets: [{
        label: 'R$', data: sorted.map(x => x[1]),
        backgroundColor: sorted.map((_, i) => `rgba(37,99,235,${0.5 + i * 0.05})`),
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v>=1000?(v/1000).toFixed(0)+'k':''+v }, grid: { color: 'rgba(0,0,0,.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ── Gráfico 2: Donut por rubrica ── */
function renderProjChartRubricas(dep, rub, projId) {
  const ctx = document.getElementById(`projChartRubricas-${projId}`);
  if (!ctx) return;

  const catMap = {};
  dep.forEach(d => {
    const r = rub.find(x => x.id===d.rubrica_id);
    const cat = r?.categoria || 'Outros';
    catMap[cat] = (catMap[cat]||0) + (Number(d.valor)||0);
  });
  const entries = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const colors  = ['#2563eb','#059669','#d97706','#dc2626','#0891b2','#7c3aed','#db2777','#047857'];

  const key = `pr${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(x => x[0]),
      datasets: [{
        data: entries.map(x => x[1]),
        backgroundColor: colors.slice(0, entries.length),
        borderWidth: 3, borderColor: '#fff', hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, usePointStyle: true } },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      }
    }
  });
}

/* ── Gráfico 3: Barras — Metas Beneficiários ── */
function renderProjChartMetas(met, projId) {
  const ctx = document.getElementById(`projChartMetas-${projId}`);
  if (!ctx) return;
  if (!met.length) { _drawEmptyChart(ctx, 'Sem metas'); return; }

  const key = `pmt${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: met.map(m => `Meta ${m.numero_meta}`),
      datasets: [
        { label: 'Previsto',  data: met.map(m => Number(m.beneficiarios_previstos)||0), backgroundColor: 'rgba(37,99,235,.2)', borderRadius: 4 },
        { label: 'Atendido',  data: met.map(m => Number(m.beneficiarios_atendidos)||0),  backgroundColor: 'rgba(5,150,105,.75)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true } } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ── Gráfico 4: Cronograma ── */
function renderProjChartCronograma(crn, rub, projId) {
  const ctx = document.getElementById(`projChartCronograma-${projId}`);
  if (!ctx) return;

  const prevMap = {};
  crn.forEach(c => { prevMap[c.mes] = (prevMap[c.mes]||0)+(Number(c.valor_previsto)||0); });

  const deps = (CACHE.despesas||[]).filter(d => d.projeto_id===projId);
  const execMap = {};
  deps.forEach(d => {
    const m = d.mes_referencia;
    if (m) execMap[m] = (execMap[m]||0)+(Number(d.valor)||0);
  });

  const allMonths = [...new Set([...Object.keys(prevMap),...Object.keys(execMap)])].sort();
  if (!allMonths.length) { _drawEmptyChart(ctx, 'Sem cronograma'); return; }

  const key = `pc${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allMonths.map(m => { const p=m.split('-'); return (p[1]||'')+'/'+(p[0]||''); }),
      datasets: [
        { label: 'Previsto',  data: allMonths.map(m => prevMap[m]||0),  backgroundColor: 'rgba(37,99,235,.2)',  borderColor: 'rgba(37,99,235,.6)',  borderWidth: 1.5, borderRadius: 4 },
        { label: 'Executado', data: allMonths.map(m => execMap[m]||0),  backgroundColor: 'rgba(5,150,105,.7)',  borderColor: 'rgba(5,150,105,1)',   borderWidth: 1.5, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, usePointStyle: true } },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v>=1000?(v/1000).toFixed(0)+'k':''+v }, grid: { color: 'rgba(0,0,0,.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ── Tabela de rubricas no dash do projeto ── */
function buildRubricasSummary(rubricas, despesas, projId) {
  if (!rubricas.length) return '';
  const totalPrev = rubricas.reduce((s,r) => s+(Number(r.valor_previsto)||0), 0);
  const totalExec = despesas.reduce((s,d) => s+(Number(d.valor)||0), 0);

  return `
  <div class="card mb-3">
    <div class="card-header">
      <h3><i class="fas fa-list-check"></i> Rubricas — Execução vs. Previsto</h3>
      <div class="flex gap-1">
        <button class="btn btn-outline btn-sm" onclick="openCronograma('${projId}')"><i class="fas fa-calendar-alt"></i> Cronograma</button>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('rubricas')">Ver tudo <i class="fas fa-arrow-right"></i></button>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Categoria</th><th>Descrição</th>
            <th class="text-right">Previsto</th><th class="text-right">Executado</th>
            <th class="text-right">Saldo</th><th style="min-width:100px;">Execução</th>
          </tr>
        </thead>
        <tbody>
          ${rubricas.map(r => {
            const exec  = despesas.filter(d => d.rubrica_id===r.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
            const perc  = calcPercent(exec, r.valor_previsto);
            const saldo = (Number(r.valor_previsto)||0) - exec;
            return `<tr>
              <td><span class="badge badge-blue">${r.categoria}</span></td>
              <td class="font-semibold" style="font-size:.82rem;">${r.descricao}</td>
              <td class="text-right">${fmt.currency(r.valor_previsto)}</td>
              <td class="text-right">${fmt.currency(exec)}</td>
              <td class="text-right ${saldo < 0 ? 'text-danger font-semibold' : 'text-success'}">${fmt.currency(saldo)}</td>
              <td>${progressBar(perc)}</td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:700;background:var(--gray-50);">
            <td colspan="2" class="font-semibold">TOTAL</td>
            <td class="text-right">${fmt.currency(totalPrev)}</td>
            <td class="text-right">${fmt.currency(totalExec)}</td>
            <td class="text-right ${totalPrev-totalExec < 0 ? 'text-danger' : 'text-success'}">${fmt.currency(totalPrev-totalExec)}</td>
            <td>${progressBar(calcPercent(totalExec, totalPrev))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ── Tabela de metas no dash do projeto — com semáforo e timeline ── */
function buildMetasSummary(metas, despesas, rubricas) {
  if (!metas.length) return '';
  const hoje    = new Date();
  const deps    = despesas || CACHE.despesas || [];
  const rubs    = rubricas || CACHE.rubricas || [];

  return `
  <div class="card mb-3">
    <div class="card-header">
      <h3><i class="fas fa-bullseye"></i> Metas — Execução Física e Financeira</h3>
      <button class="btn btn-outline btn-sm" onclick="navigateTo('plano')">Ver no Plano <i class="fas fa-arrow-right"></i></button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width:36px;">Saúde</th>
            <th style="width:42px;">#</th>
            <th>Meta / Indicador</th>
            <th class="text-center">Beneficiários</th>
            <th style="min-width:100px;">Exec. Física</th>
            <th style="min-width:100px;">Exec. Financ.</th>
            <th>Timeline</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${metas.map(m => {
            const percF   = Number(m.percentual_fisico)||0;

            // ── Cálculo dinâmico da execução financeira por meta ──
            const projId = m.projeto_id;
            const despProjeto = deps.filter(d => {
              if (d.projeto_id === projId) return true;
              const rub = rubs.find(r => r.id === d.rubrica_id);
              return rub && rub.projeto_id === projId;
            });
            const totalDespProjeto = despProjeto.reduce((s, d) => s + (Number(d.valor) || 0), 0);
            const rubsProjeto      = rubs.filter(r => r.projeto_id === projId);
            const totalPrevProjeto = rubsProjeto.reduce((s, r) => s + (Number(r.valor_previsto) || 0), 0);
            let execDin = 0;
            if (totalPrevProjeto > 0) {
              const share = (Number(m.valor_previsto) || 0) / totalPrevProjeto;
              execDin = totalDespProjeto * share;
            } else if (totalDespProjeto > 0) {
              const nMetas = Math.max(metas.filter(x => x.projeto_id === projId).length, 1);
              execDin = totalDespProjeto / nMetas;
            }
            const percFin = calcPercent(execDin, m.valor_previsto);

            // Semáforo temporal da meta
            let saudeMeta = '🟢';
            if (m.data_fim) {
              const fim   = new Date(m.data_fim);
              const dias  = Math.ceil((fim - hoje) / 86400000);
              if (dias < 0) saudeMeta = '🔴';
              else if (dias <= 15) saudeMeta = '🔴';
              else if (dias <= 45 && percF < 60) saudeMeta = '🟡';
            }
            if (m.status === 'Atrasada') saudeMeta = '🔴';

            // Barra de timeline visual
            let timelineBar = '';
            if (m.data_inicio && m.data_fim) {
              const ini   = new Date(m.data_inicio).getTime();
              const fim   = new Date(m.data_fim).getTime();
              const total = Math.max(fim - ini, 1);
              const decor = Math.max(hoje.getTime() - ini, 0);
              const percT = Math.min((decor / total) * 100, 100);
              timelineBar = `
                <div title="Tempo decorrido: ${Math.round(percT)}%" style="position:relative;background:#e2e8f0;border-radius:4px;height:8px;min-width:80px;">
                  <div style="width:${percT}%;background:${percT>80?'#dc2626':percT>60?'#d97706':'#2563eb'};height:100%;border-radius:4px;"></div>
                </div>
                <div class="text-xs text-muted mt-1">${fmt.date(m.data_inicio)} → ${fmt.date(m.data_fim)}</div>`;
            }

            return `<tr>
              <td class="text-center" style="font-size:1.1rem;" title="${m.status||''}">${saudeMeta}</td>
              <td class="font-semibold text-center">${m.numero_meta}</td>
              <td>
                <div class="font-semibold" style="font-size:.82rem;">${m.descricao_meta}</div>
                ${m.indicador ? `<div class="text-xs text-muted">${m.indicador}</div>` : ''}
              </td>
              <td class="text-center">
                <strong>${fmt.number(m.beneficiarios_atendidos)}</strong>
                <span class="text-muted text-xs">/${fmt.number(m.beneficiarios_previstos)}</span>
              </td>
              <td>${progressBar(percF)}</td>
              <td>
                <div class="text-xs" style="margin-bottom:3px;">${fmt.currency(execDin)} / ${fmt.currency(m.valor_previsto)}</div>
                ${progressBar(percFin)}
              </td>
              <td style="min-width:100px;">${timelineBar || fmt.date(m.data_fim)}</td>
              <td>${statusBadge(m.status)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ── Últimas despesas no dash ── */
function buildDespesasRecentes(despesas, rubricas) {
  const sorted = [...despesas].sort((a,b) => (b.data_despesa||'').localeCompare(a.data_despesa||'')).slice(0, 15);
  return `
  <div class="card mb-3">
    <div class="card-header">
      <h3><i class="fas fa-receipt"></i> Últimos Lançamentos</h3>
      <button class="btn btn-outline btn-sm" onclick="navigateTo('financeiro')">Ver todos <i class="fas fa-arrow-right"></i></button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Data</th><th>Descrição</th><th>Fornecedor</th>
            <th>Rubrica</th><th class="text-right">Valor</th><th>Fonte</th><th>Pag.</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.length === 0
            ? `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma despesa registrada</p></div></td></tr>`
            : sorted.map(d => {
                const rub = rubricas.find(r => r.id===d.rubrica_id);
                return `<tr>
                  <td class="text-xs">${fmt.date(d.data_despesa)}</td>
                  <td style="font-size:.8rem;">
                    <div class="font-semibold">${d.descricao || '-'}</div>
                    ${d.numero_documento ? `<div class="text-xs text-muted">${d.tipo_documento || ''} ${d.numero_documento}</div>` : ''}
                  </td>
                  <td class="text-xs text-muted">${d.fornecedor || '-'}</td>
                  <td><span class="badge badge-gray" style="font-size:.65rem;">${rub?.categoria || '-'}</span></td>
                  <td class="text-right font-semibold">${fmt.currency(d.valor)}</td>
                  <td>
                    <span class="badge ${d.fonte==='Repasse Federal' ? 'badge-blue' : 'badge-green'}" style="font-size:.64rem;">
                      ${(d.fonte||'-').replace('Repasse Federal','Fed.').replace('Contrapartida','CP')}
                    </span>
                  </td>
                  <td>${statusBadge(d.status_pagamento)}</td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>
  </div>`;
}

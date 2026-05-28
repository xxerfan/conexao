/* =============================================
   ONG GESTOR v3 — Dashboard Geral + Individual
   ============================================= */

let _dashCharts    = {};
let _projDashId    = null;
let _projDashCharts= {};

/* ════════════════════════════════════════════
   DASHBOARD GERAL
════════════════════════════════════════════ */
async function loadDashboard() {
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

    setText('kpi-projetos',    totalProjetos);
    setText('kpi-ativos',      ativos);
    setText('kpi-repasse',     fmt.currency(totalRepasse));
    setText('kpi-executado',   fmt.currency(totalExec));
    setText('kpi-perc',        fmt.percent(percGlobal));
    setText('kpi-beneficiarios', `${fmt.number(totalBenefAten)} / ${fmt.number(totalBenefPrev)}`);
    setText('kpi-apagar',      fmt.currency(totalAPagar));
    setText('dash-global-pct', fmt.percent(percGlobal));
    setText('dash-global-exec',  `Executado: ${fmt.currency(totalExec)}`);
    setText('dash-global-total', `Total Repasse: ${fmt.currency(totalRepasse)}`);

    /* ── Barra global ── */
    const barEl = document.getElementById('dash-bar-global');
    if (barEl) {
      barEl.style.width  = percGlobal + '%';
      barEl.className    = `progress-bar-fill ${progressColor(percGlobal)}`;
    }

    /* ── Gráficos ── */
    renderChartBarProjetos(projetos, despesas);
    renderChartStatus(projetos);
    renderChartMensalGlobal(despesas);
    renderChartCategorias(despesas, rubricas);

    /* ── Tabela resumo ── */
    renderDashProjetos(projetos, despesas, metas);

    /* ── Alertas ── */
    renderAlertas(projetos, metas, despesas);

  } catch(err) {
    showToast('Erro no dashboard: ' + err.message, 'error');
    console.error(err);
  }
}

/* ── Gráfico Barras: Repasse vs Executado por Projeto ── */
function renderChartBarProjetos(projetos, despesas) {
  const ctx = document.getElementById('chartFinanceiro');
  if (!ctx) return;
  _destroyDashChart('chartFinanceiro');

  const labels     = projetos.map(p => p.numero_proposta || (p.nome_projeto||'').slice(0,12));
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
        { label:'Repasse (R$)',    data:previstos,  backgroundColor:'rgba(26,86,219,.18)',  borderColor:'rgba(26,86,219,.8)',  borderWidth:2, borderRadius:5 },
        { label:'Executado (R$)',  data:executados, backgroundColor:'rgba(14,159,110,.75)', borderColor:'rgba(14,159,110,1)', borderWidth:2, borderRadius:5 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'top'}, tooltip:{callbacks:{label:c=>fmt.currency(c.raw)}} },
      scales:{
        y:{ beginAtZero:true, ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':''+v}, grid:{color:'#f1f5f9'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

/* ── Gráfico Donut: Status dos Projetos ── */
function renderChartStatus(projetos) {
  const ctx = document.getElementById('chartStatus');
  if (!ctx) return;
  _destroyDashChart('chartStatus');

  const counts = {};
  projetos.forEach(p => { const s = p.status||'N/D'; counts[s]=(counts[s]||0)+1; });
  const labels = Object.keys(counts);
  const colorMap = {
    'Em Execução':        '#1a56db',
    'Concluído':          '#0e9f6e',
    'Prestação de Contas':'#d97706',
    'Suspenso':           '#e02424',
    'Aguardando Início':  '#6b7280'
  };

  _dashCharts['chartStatus'] = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels,
      datasets:[{
        data:Object.values(counts),
        backgroundColor:labels.map(l=>colorMap[l]||'#9ca3af'),
        borderWidth:3, borderColor:'#fff'
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{
        legend:{ position:'bottom', labels:{padding:14,font:{size:11}} },
        tooltip:{ callbacks:{ label:c=>`${c.label}: ${c.raw} projeto(s)` } }
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

  _dashCharts['chartMensalGlobal'] = new Chart(ctx, {
    type:'line',
    data:{
      labels: sorted.map(x => { const p=x[0].split('-'); return (p[1]||'')+'/'+(p[0]||''); }),
      datasets:[{
        label:'Despesas Mensais (R$)',
        data: sorted.map(x => x[1]),
        borderColor:'#1a56db', backgroundColor:'rgba(26,86,219,.07)',
        tension:.35, fill:true, pointBackgroundColor:'#1a56db', pointRadius:4
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>fmt.currency(c.raw)}} },
      scales:{
        y:{ beginAtZero:true, ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':''+v}, grid:{color:'#f1f5f9'} },
        x:{ grid:{display:false} }
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
  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const colors = ['#1a56db','#0e9f6e','#d97706','#e02424','#0694a2','#7c3aed','#db2777','#059669','#f59e0b'];

  _dashCharts['chartCategorias'] = new Chart(ctx, {
    type:'bar',
    data:{
      labels: sorted.map(x => x[0]),
      datasets:[{
        label:'Executado (R$)',
        data: sorted.map(x => x[1]),
        backgroundColor: colors.slice(0, sorted.length),
        borderRadius:5
      }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>fmt.currency(c.raw)}} },
      scales:{
        x:{ beginAtZero:true, ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':''+v}, grid:{color:'#f1f5f9'} },
        y:{ grid:{display:false} }
      }
    }
  });
}

/* ── Tabela resumo de projetos ── */
function renderDashProjetos(projetos, despesas, metas) {
  const tbody = document.getElementById('dash-projetos-recentes');
  if (!tbody) return;
  if (!projetos.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-folder-open"></i><p>Nenhum projeto cadastrado.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = projetos.map(p => {
    const execProjeto = despesas.filter(d => d.projeto_id===p.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const percP   = calcPercent(execProjeto, p.valor_repasse);
    const benef   = metas.filter(m => m.projeto_id===p.id).reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const nDocs   = despesas.filter(d => d.projeto_id===p.id).length;
    return `<tr>
      <td>
        <div class="font-semibold" style="font-size:.82rem;">${p.nome_projeto||'-'}</div>
        <div class="text-xs text-muted">${p.numero_proposta||''} · ${nDocs} lançamentos</div>
      </td>
      <td>${statusBadge(p.status)}</td>
      <td class="text-right">${fmt.currency(p.valor_repasse)}</td>
      <td class="text-right">${fmt.currency(execProjeto)}</td>
      <td style="min-width:90px;">${progressBar(percP)}</td>
      <td class="text-center">${fmt.number(benef)}</td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="viewProjeto('${p.id}')">
          <i class="fas fa-chart-line"></i> Dash
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Alertas automáticos ── */
function renderAlertas(projetos, metas, despesas) {
  const c = document.getElementById('dash-alertas');
  if (!c) return;
  const alertas = [];
  const hoje = new Date();

  projetos.forEach(p => {
    if (p.data_fim && p.status === 'Em Execução') {
      const fim  = new Date(p.data_fim);
      const dias = Math.ceil((fim - hoje) / 86400000);
      if (dias <= 60 && dias > 0)
        alertas.push({ type:'warning', icon:'fa-calendar-alt',
          msg:`<strong>${p.numero_proposta}</strong>: vigência termina em <strong>${dias} dias</strong>` });
      if (dias <= 0)
        alertas.push({ type:'danger', icon:'fa-exclamation-circle',
          msg:`<strong>${p.numero_proposta}</strong>: vigência <strong>encerrada</strong>!` });
    }
  });

  metas.filter(m => m.status==='Atrasada').forEach(m =>
    alertas.push({ type:'danger', icon:'fa-flag',
      msg:`Meta ${m.numero_meta}: <strong>Atrasada</strong> — ${(m.descricao_meta||'').slice(0,50)}` })
  );

  const aPagar = despesas.filter(d => d.status_pagamento==='A Pagar');
  if (aPagar.length > 0) {
    const tot = aPagar.reduce((s,d) => s+(Number(d.valor)||0), 0);
    alertas.push({ type:'info', icon:'fa-file-invoice-dollar',
      msg:`<strong>${aPagar.length}</strong> despesa(s) pendente(s) — ${fmt.currency(tot)}` });
  }

  if (alertas.length === 0) {
    c.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> Tudo em dia! Sem alertas.</div>`;
    return;
  }
  c.innerHTML = alertas.map(a =>
    `<div class="alert alert-${a.type}"><i class="fas ${a.icon}"></i><div>${a.msg}</div></div>`
  ).join('');
}

/* ── Helper: destruir chart local do dashboard ── */
function _destroyDashChart(id) {
  if (_dashCharts[id]) { try{_dashCharts[id].destroy();}catch(e){} delete _dashCharts[id]; }
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
  if (el) el.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando projeto...</div>`;

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

    // Renderiza gráficos após DOM ser atualizado
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

  /* ── Cabeçalho colorido ── */
  const header = `
  <div class="proj-dash-header mb-3">
    <div class="flex justify-between items-center flex-wrap" style="gap:10px">
      <div>
        <div class="flex items-center gap-1 mb-1">
          <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);" onclick="navigateTo('projetos')">
            <i class="fas fa-arrow-left"></i> Projetos
          </button>
          ${statusBadge(p.status)}
        </div>
        <h2>${p.nome_projeto||'Projeto'}</h2>
        <p>${p.numero_proposta||'-'} &nbsp;·&nbsp; ${p.modalidade||'-'} &nbsp;·&nbsp; ${p.concedente||'-'}</p>
      </div>
      <div class="flex gap-1" style="flex-wrap:wrap;">
        <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);" onclick="editProjeto('${p.id}')">
          <i class="fas fa-pencil"></i> Editar
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);" onclick="navigateTo('rubricas')">
          <i class="fas fa-calendar-alt"></i> Rubricas
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);" onclick="navigateTo('prestacao');setTimeout(()=>{document.getElementById('prest-select-projeto').value='${p.id}';loadPrestacao();},400)">
          <i class="fas fa-file-invoice"></i> Prestação
        </button>
      </div>
    </div>
    <div class="proj-dash-meta">
      <div class="proj-dash-meta-item"><i class="fas fa-building"></i> ${p.ong_nome||'-'}</div>
      <div class="proj-dash-meta-item"><i class="fas fa-map-marker-alt"></i> ${p.municipio||'-'}${p.uf?'/'+p.uf:''}</div>
      <div class="proj-dash-meta-item"><i class="fas fa-calendar"></i> ${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</div>
      <div class="proj-dash-meta-item"><i class="fas fa-users"></i> ${p.publico_beneficiario||'-'}</div>
    </div>
  </div>`;

  /* ── KPIs do projeto ── */
  const kpis = `
  <div class="kpi-grid mb-3" style="grid-template-columns:repeat(auto-fit,minmax(155px,1fr));">
    <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-university"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalRep)}</div><div class="kpi-label">Repasse Federal</div></div></div>
    <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-hand-holding-heart"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalCont)}</div><div class="kpi-label">Contrapartida</div></div></div>
    <div class="kpi-card"><div class="kpi-icon orange"><i class="fas fa-receipt"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalExec)}</div><div class="kpi-label">Total Executado</div><div class="kpi-sub">${fmt.percent(percExec)}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon teal"><i class="fas fa-balance-scale"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem;color:${saldo<0?'var(--danger)':'inherit'}">${fmt.currency(saldo)}</div><div class="kpi-label">Saldo Disponível</div></div></div>
    <div class="kpi-card"><div class="kpi-icon purple"><i class="fas fa-users"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.number(benAten)}/${fmt.number(benPrev)}</div><div class="kpi-label">Beneficiários</div><div class="kpi-sub">${fmt.percent(percBenef)}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon red"><i class="fas fa-clock"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(aPagar)}</div><div class="kpi-label">A Pagar</div></div></div>
    <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-file-invoice"></i></div>
      <div class="kpi-info"><div class="kpi-value">${nDocs}</div><div class="kpi-label">Lançamentos</div></div></div>
    <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
      <div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(dep.filter(d=>d.status_pagamento==='Pago').reduce((s,d)=>s+(Number(d.valor)||0),0))}</div><div class="kpi-label">Pago</div></div></div>
  </div>`;

  /* ── Barra de execução ── */
  const barra = `
  <div class="card mb-3">
    <div class="card-body">
      <div class="flex justify-between mb-1">
        <span class="text-sm font-semibold">Execução Financeira Global</span>
        <span class="text-sm font-semibold text-primary">${fmt.percent(percExec)}</span>
      </div>
      <div class="progress-bar-wrap" style="height:14px;border-radius:8px;">
        <div class="progress-bar-fill ${progressColor(percExec)}" style="width:${percExec}%"></div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-xs text-muted">Repasse Federal executado: ${fmt.currency(execRepasse)}</span>
        <span class="text-xs text-muted">Total previsto: ${fmt.currency(totalRep+totalCont)}</span>
      </div>
    </div>
  </div>`;

  /* ── 4 gráficos do projeto ── */
  const graficos = `
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-chart-line text-primary"></i> Despesas por Mês</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartMensal-${p.id}"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-chart-pie text-primary"></i> Execução por Categoria</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartRubricas-${p.id}"></canvas></div>
    </div>
  </div>
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-bullseye text-primary"></i> Metas — Beneficiários</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartMetas-${p.id}"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-calendar-check text-primary"></i> Cronograma Previsto vs Executado</h3></div>
      <div class="card-body chart-container" style="height:220px;"><canvas id="projChartCronograma-${p.id}"></canvas></div>
    </div>
  </div>`;

  /* ── Tabela Rubricas ── */
  const rubTable = buildRubricasSummary(rub, dep, p.id);

  /* ── Tabela Metas ── */
  const metaTable = buildMetasSummary(met);

  /* ── Despesas recentes ── */
  const despTable = buildDespesasRecentes(dep, rub);

  return header + kpis + barra + graficos + rubTable + metaTable + despTable;
}

/* ── Gráfico 1: Barras mensais do projeto ── */
function renderProjChartMensal(dep, projId) {
  const ctx = document.getElementById(`projChartMensal-${projId}`);
  if (!ctx) return;

  const mesMap = {};
  dep.forEach(d => { const m = d.mes_referencia||'?'; mesMap[m]=(mesMap[m]||0)+(Number(d.valor)||0); });
  const sorted = Object.entries(mesMap).filter(([k])=>k!=='?').sort((a,b)=>a[0].localeCompare(b[0]));

  const key = `pm${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type:'bar',
    data:{
      labels: sorted.map(x=>{ const p=x[0].split('-'); return (p[1]||'')+'/'+(p[0]||''); }),
      datasets:[{
        label:'R$', data:sorted.map(x=>x[1]),
        backgroundColor:'rgba(26,86,219,.7)', borderRadius:4
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>fmt.currency(c.raw)}} },
      scales:{
        y:{ beginAtZero:true, ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':''+v}, grid:{color:'#f1f5f9'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

/* ── Gráfico 2: Donut por rubrica/categoria ── */
function renderProjChartRubricas(dep, rub, projId) {
  const ctx = document.getElementById(`projChartRubricas-${projId}`);
  if (!ctx) return;

  const catMap = {};
  dep.forEach(d => {
    const r   = rub.find(x => x.id===d.rubrica_id);
    const cat = r?.categoria || 'Outros';
    catMap[cat] = (catMap[cat]||0) + (Number(d.valor)||0);
  });
  const entries = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const colors  = ['#1a56db','#0e9f6e','#d97706','#e02424','#0694a2','#7c3aed','#db2777','#059669'];

  const key = `pr${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: entries.map(x=>x[0]),
      datasets:[{
        data: entries.map(x=>x[1]),
        backgroundColor: colors.slice(0, entries.length),
        borderWidth:2, borderColor:'#fff'
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'55%',
      plugins:{
        legend:{ position:'bottom', labels:{font:{size:10},padding:8} },
        tooltip:{ callbacks:{label:c=>fmt.currency(c.raw)} }
      }
    }
  });
}

/* ── Gráfico 3: Barras — Metas Beneficiários ── */
function renderProjChartMetas(met, projId) {
  const ctx = document.getElementById(`projChartMetas-${projId}`);
  if (!ctx) return;
  if (!met.length) return;

  const key = `pmt${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type:'bar',
    data:{
      labels: met.map(m=>`Meta ${m.numero_meta}`),
      datasets:[
        { label:'Previsto',  data:met.map(m=>Number(m.beneficiarios_previstos)||0), backgroundColor:'rgba(26,86,219,.2)', borderRadius:4 },
        { label:'Atendido',  data:met.map(m=>Number(m.beneficiarios_atendidos)||0), backgroundColor:'rgba(14,159,110,.75)', borderRadius:4 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom',labels:{font:{size:10}}} },
      scales:{
        y:{ beginAtZero:true, grid:{color:'#f1f5f9'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

/* ── Gráfico 4: Cronograma Previsto vs Executado por mês ── */
function renderProjChartCronograma(crn, rub, projId) {
  const ctx = document.getElementById(`projChartCronograma-${projId}`);
  if (!ctx) return;

  // Agrupa cronograma previsto por mês
  const prevMap = {};
  crn.forEach(c => { prevMap[c.mes]=(prevMap[c.mes]||0)+(Number(c.valor_previsto)||0); });

  // Agrupa executado por mês (de CACHE.despesas filtrado por projeto)
  const deps = (CACHE.despesas||[]).filter(d => d.projeto_id===projId);
  const execMap = {};
  deps.forEach(d => {
    const m = d.mes_referencia;
    if (m) execMap[m]=(execMap[m]||0)+(Number(d.valor)||0);
  });

  // União dos meses
  const allMonths = [...new Set([...Object.keys(prevMap),...Object.keys(execMap)])].sort();
  if (!allMonths.length) return;

  const key = `pc${projId}`;
  if (_projDashCharts[key]) _projDashCharts[key].destroy();
  _projDashCharts[key] = new Chart(ctx, {
    type:'bar',
    data:{
      labels: allMonths.map(m=>{ const p=m.split('-'); return (p[1]||'')+'/'+(p[0]||''); }),
      datasets:[
        { label:'Previsto',  data:allMonths.map(m=>prevMap[m]||0),  backgroundColor:'rgba(26,86,219,.2)', borderColor:'rgba(26,86,219,.6)',  borderWidth:1.5, borderRadius:3 },
        { label:'Executado', data:allMonths.map(m=>execMap[m]||0),  backgroundColor:'rgba(14,159,110,.7)', borderColor:'rgba(14,159,110,1)', borderWidth:1.5, borderRadius:3 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom',labels:{font:{size:10}}}, tooltip:{callbacks:{label:c=>fmt.currency(c.raw)}} },
      scales:{
        y:{ beginAtZero:true, ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':''+v}, grid:{color:'#f1f5f9'} },
        x:{ grid:{display:false} }
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
      <h3><i class="fas fa-list-check text-primary"></i> Rubricas — Execução vs. Previsto</h3>
      <div class="flex gap-1">
        <button class="btn btn-outline btn-sm" onclick="openCronograma('${projId}')"><i class="fas fa-calendar-alt"></i> Cronograma</button>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('rubricas')">Ver tudo <i class="fas fa-arrow-right"></i></button>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Categoria</th><th>Descrição</th><th class="text-right">Previsto</th><th class="text-right">Executado</th><th class="text-right">Saldo</th><th>Execução</th></tr></thead>
        <tbody>
          ${rubricas.map(r=>{
            const exec  = despesas.filter(d=>d.rubrica_id===r.id).reduce((s,d)=>s+(Number(d.valor)||0),0);
            const perc  = calcPercent(exec, r.valor_previsto);
            const saldo = (Number(r.valor_previsto)||0) - exec;
            return `<tr>
              <td><span class="badge badge-blue">${r.categoria}</span></td>
              <td class="font-semibold" style="font-size:.82rem;">${r.descricao}</td>
              <td class="text-right">${fmt.currency(r.valor_previsto)}</td>
              <td class="text-right">${fmt.currency(exec)}</td>
              <td class="text-right ${saldo<0?'text-danger':'text-success'}">${fmt.currency(saldo)}</td>
              <td style="min-width:90px;">${progressBar(perc)}</td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:700;background:#f8fafc;">
            <td colspan="2">TOTAL</td>
            <td class="text-right">${fmt.currency(totalPrev)}</td>
            <td class="text-right">${fmt.currency(totalExec)}</td>
            <td class="text-right ${totalPrev-totalExec<0?'text-danger':'text-success'}">${fmt.currency(totalPrev-totalExec)}</td>
            <td>${progressBar(calcPercent(totalExec,totalPrev))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ── Tabela de metas no dash do projeto ── */
function buildMetasSummary(metas) {
  if (!metas.length) return '';
  return `
  <div class="card mb-3">
    <div class="card-header">
      <h3><i class="fas fa-bullseye text-primary"></i> Metas — Execução Física</h3>
      <button class="btn btn-outline btn-sm" onclick="navigateTo('metas')">Ver todas <i class="fas fa-arrow-right"></i></button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>#</th><th>Meta</th><th>Beneficiários</th><th>Exec. Física</th><th>Exec. Financeira</th><th>Prazo</th><th>Status</th></tr></thead>
        <tbody>
          ${metas.map(m=>{
            const percF   = Number(m.percentual_fisico)||0;
            const percFin = calcPercent(m.valor_executado, m.valor_previsto);
            return `<tr>
              <td class="font-semibold text-center">${m.numero_meta}</td>
              <td><div class="font-semibold" style="font-size:.82rem;">${m.descricao_meta}</div><div class="text-xs text-muted">${m.indicador||''}</div></td>
              <td class="text-center"><strong>${fmt.number(m.beneficiarios_atendidos)}</strong><span class="text-muted">/${fmt.number(m.beneficiarios_previstos)}</span></td>
              <td style="min-width:80px;">${progressBar(percF)}</td>
              <td style="min-width:80px;">${progressBar(percFin)}</td>
              <td class="text-xs">${fmt.date(m.data_fim)}</td>
              <td>${statusBadge(m.status)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ── Últimas despesas no dash do projeto ── */
function buildDespesasRecentes(despesas, rubricas) {
  const sorted = [...despesas].sort((a,b) => (b.data_despesa||'').localeCompare(a.data_despesa||'')).slice(0,12);
  return `
  <div class="card mb-3">
    <div class="card-header">
      <h3><i class="fas fa-receipt text-primary"></i> Últimos Lançamentos</h3>
      <button class="btn btn-outline btn-sm" onclick="navigateTo('financeiro')">Ver todos <i class="fas fa-arrow-right"></i></button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Fornecedor</th><th>Rubrica</th><th class="text-right">Valor</th><th>Fonte</th><th>Pag.</th></tr></thead>
        <tbody>
          ${sorted.length===0
            ? `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma despesa</p></div></td></tr>`
            : sorted.map(d=>{
                const rub = rubricas.find(r=>r.id===d.rubrica_id);
                return `<tr>
                  <td class="text-xs">${fmt.date(d.data_despesa)}</td>
                  <td style="font-size:.8rem;">${d.descricao||'-'}</td>
                  <td class="text-xs text-muted">${d.fornecedor||'-'}</td>
                  <td><span class="badge badge-gray" style="font-size:.66rem;">${rub?.categoria||'-'}</span></td>
                  <td class="text-right font-semibold">${fmt.currency(d.valor)}</td>
                  <td><span class="badge ${d.fonte==='Repasse Federal'?'badge-blue':'badge-green'}" style="font-size:.66rem;">${(d.fonte||'-').replace('Repasse Federal','Fed.').replace('Contrapartida','CP')}</span></td>
                  <td>${statusBadge(d.status_pagamento)}</td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>
    </div>
  </div>`;
}

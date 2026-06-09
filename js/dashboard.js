/* =============================================
   ONG GESTOR v5 — Dashboard SUPREMO
   Analytics Avançados · Alertas Inteligentes
   Score de Conformidade · Timeline · KPIs Pro
   ============================================= */

let _dashCharts     = {};
let _projDashId     = null;
let _projDashCharts = {};
let _dashRefreshTimer = null;

/* ════════════════════════════════════════════
   DASHBOARD GERAL SUPREMO
════════════════════════════════════════════ */
async function loadDashboard() {
  ['chartFinanceiro','chartStatus','chartMensalGlobal','chartCategorias','chartHeatmap','chartConformidade'].forEach(id => _destroyDashChart(id));
  skeletonKpis('', 6);

  try {
    const [projetos, despesas, metas, rubricas, documentos] = await Promise.all([
      DB.getAll('ong_projetos'),
      DB.getAll('ong_despesas'),
      DB.getAll('ong_metas'),
      DB.getAll('ong_rubricas'),
      DB.getAll('ong_documentos').catch(() => [])
    ]);
    CACHE.projetos   = projetos;
    CACHE.despesas   = despesas;
    CACHE.metas      = metas;
    CACHE.rubricas   = rubricas;
    CACHE.documentos = documentos;

    /* ── KPIs ── */
    const totalProjetos  = projetos.length;
    const ativos         = projetos.filter(p => p.status === 'Em Execução').length;
    const emPrestacao    = projetos.filter(p => p.status === 'Prestação de Contas').length;
    const concluidos     = projetos.filter(p => p.status === 'Concluído').length;
    const totalRepasse   = projetos.reduce((s,p) => s+(Number(p.valor_repasse)||0), 0);
    const totalContra    = projetos.reduce((s,p) => s+(Number(p.valor_contrapartida)||0), 0);
    const totalExec      = despesas.reduce((s,d) => s+(Number(d.valor)||0), 0);
    const totalBenefPrev = metas.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
    const totalBenefAten = metas.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const totalAPagar    = despesas.filter(d => d.status_pagamento==='A Pagar').reduce((s,d) => s+(Number(d.valor)||0), 0);
    const totalPago      = despesas.filter(d => d.status_pagamento==='Pago').reduce((s,d) => s+(Number(d.valor)||0), 0);
    const percGlobal     = calcPercent(totalExec, totalRepasse);
    const percBenef      = calcPercent(totalBenefAten, totalBenefPrev);
    const totalFornecedores = new Set(despesas.map(d => d.fornecedor).filter(Boolean)).size;

    /* Animação count-up */
    _kpiSetWithAnimation('kpi-projetos', totalProjetos, Math.round);
    _kpiSetWithAnimation('kpi-ativos',   ativos,        Math.round);
    setText('kpi-repasse',      fmt.currency(totalRepasse));
    setText('kpi-executado',    fmt.currency(totalExec));
    setText('kpi-perc',         fmt.percent(percGlobal));
    setText('kpi-beneficiarios', `${fmt.number(totalBenefAten)} / ${fmt.number(totalBenefPrev)}`);
    setText('kpi-apagar',       fmt.currency(totalAPagar));
    setText('dash-global-pct',  fmt.percent(percGlobal));
    setText('dash-global-exec', `Executado: ${fmt.currency(totalExec)}`);
    setText('dash-global-total',`Total Repasse: ${fmt.currency(totalRepasse)}`);

    /* Barra global */
    const barEl = document.getElementById('dash-bar-global');
    if (barEl) {
      barEl.style.width  = Math.min(percGlobal,100) + '%';
      barEl.className    = `progress-bar-fill ${progressColor(percGlobal)}`;
    }
    const pctEl = document.getElementById('dash-global-pct');
    if (pctEl) {
      pctEl.style.color = percGlobal >= 80 ? 'var(--success)' : percGlobal >= 50 ? 'var(--primary)' : percGlobal >= 30 ? 'var(--warning)' : 'var(--danger)';
    }

    /* Mini-stats SUPREMO abaixo da barra global */
    _renderMiniStats(document.getElementById('dash-mini-stats'), {
      ativos, emPrestacao, concluidos, totalAPagar, totalPago,
      totalFornecedores, percBenef, totalContra, despesas
    });

    /* Gráficos */
    renderChartBarProjetos(projetos, despesas);
    renderChartStatus(projetos);
    renderChartMensalGlobal(despesas);
    renderChartCategorias(despesas, rubricas);

    /* Tabela resumo + alertas */
    renderDashProjetos(projetos, despesas, metas);
    renderAlertas(projetos, metas, despesas);

    /* Score de conformidade geral */
    _renderScoreConformidade(projetos, despesas, metas, rubricas, documentos);

    /* Heatmap de despesas (mensal x projeto) */
    _renderHeatmapDespesas(projetos, despesas);

    /* Top fornecedores */
    _renderTopFornecedores(despesas);

    /* Linha do tempo de projetos */
    _renderTimeline(projetos);

  } catch(err) {
    showToast('Erro ao carregar dashboard: ' + err.message, 'error');
    console.error('[Dashboard]', err);
  }
}

/* ── Mini stats (linha abaixo da barra global) ── */
function _renderMiniStats(el, data) {
  if (!el) return;
  const { ativos, emPrestacao, concluidos, totalAPagar, totalPago, totalFornecedores, percBenef, totalContra, despesas } = data;
  const mediaDesp = despesas.length ? despesas.reduce((s,d) => s+(Number(d.valor)||0), 0) / despesas.length : 0;

  el.innerHTML = `
    <div class="dash-mini-stats-grid">
      <div class="dash-mini-stat">
        <i class="fas fa-play-circle" style="color:var(--primary)"></i>
        <strong>${ativos}</strong> <span>em execução</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-file-invoice" style="color:var(--warning)"></i>
        <strong>${emPrestacao}</strong> <span>em prestação</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-check-double" style="color:var(--success)"></i>
        <strong>${concluidos}</strong> <span>concluídos</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-check-circle" style="color:var(--success)"></i>
        <strong>${fmt.currency(totalPago)}</strong> <span>pago</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-clock" style="color:var(--danger)"></i>
        <strong>${fmt.currency(totalAPagar)}</strong> <span>a pagar</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-building" style="color:var(--secondary)"></i>
        <strong>${totalFornecedores}</strong> <span>fornecedores</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-users" style="color:#7c3aed"></i>
        <strong>${fmt.percent(percBenef)}</strong> <span>benef. atend.</span>
      </div>
      <div class="dash-mini-stat">
        <i class="fas fa-receipt" style="color:var(--teal)"></i>
        <strong>${fmt.currency(mediaDesp)}</strong> <span>ticket médio</span>
      </div>
    </div>`;
}

/* ── Score de Conformidade SUPREMO ── */
function _renderScoreConformidade(projetos, despesas, metas, rubricas, documentos) {
  const el = document.getElementById('dash-conformidade');
  if (!el) return;

  const criterios = [];
  const total = projetos.length;
  if (!total) {
    el.innerHTML = `<div class="dash-conf-empty"><i class="fas fa-check-circle"></i><span>Sem projetos para avaliar</span></div>`;
    return;
  }

  // 1. Projetos com rubricas
  const comRub = projetos.filter(p => rubricas.some(r => r.projeto_id===p.id)).length;
  criterios.push({ label:'Com Rubricas', ok: comRub, total, icon:'fa-tags' });

  // 2. Projetos com despesas
  const comDesp = projetos.filter(p => despesas.some(d => d.projeto_id===p.id)).length;
  criterios.push({ label:'Com Lançamentos', ok: comDesp, total, icon:'fa-receipt' });

  // 3. Projetos com metas
  const comMeta = projetos.filter(p => metas.some(m => m.projeto_id===p.id)).length;
  criterios.push({ label:'Com Metas', ok: comMeta, total, icon:'fa-bullseye' });

  // 4. Projetos com documentos
  const comDoc = projetos.filter(p => documentos.some(d => d.projeto_id===p.id)).length;
  criterios.push({ label:'Com Documentos', ok: comDoc, total, icon:'fa-paperclip' });

  // 5. Despesas sem rubrica associada
  const semRubDesp = despesas.filter(d => !d.rubrica_id).length;
  const comRubDesp = despesas.length - semRubDesp;
  criterios.push({ label:'Desp. com Rubrica', ok: comRubDesp, total: Math.max(despesas.length,1), icon:'fa-link' });

  // 6. Projetos com data_inicio e data_fim preenchidos
  const comDatas = projetos.filter(p => p.data_inicio && p.data_fim).length;
  criterios.push({ label:'Datas Preenchidas', ok: comDatas, total, icon:'fa-calendar' });

  // 7. Projetos com valor_repasse > 0
  const comValor = projetos.filter(p => Number(p.valor_repasse)>0).length;
  criterios.push({ label:'Valor de Repasse', ok: comValor, total, icon:'fa-dollar-sign' });

  // 8. Despesas pagas vs total
  const pagas = despesas.filter(d => d.status_pagamento==='Pago').length;
  criterios.push({ label:'Despesas Pagas', ok: pagas, total: Math.max(despesas.length,1), icon:'fa-check-circle' });

  const scoreGeral = Math.round(criterios.reduce((s,c) => s + calcPercent(c.ok, c.total), 0) / criterios.length);
  const corScore   = scoreGeral >= 80 ? '#059669' : scoreGeral >= 60 ? '#d97706' : '#dc2626';

  el.innerHTML = `
    <div class="dash-conf-header">
      <div class="dash-conf-ring" style="--score-pct:${scoreGeral};--score-color:${corScore};">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="10"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="${corScore}" stroke-width="10"
            stroke-dasharray="${(scoreGeral/100)*263.9} 263.9"
            stroke-linecap="round" transform="rotate(-90 50 50)" style="transition:stroke-dasharray .8s ease"/>
        </svg>
        <div class="dash-conf-ring-text" style="color:${corScore}">
          <strong>${scoreGeral}%</strong>
          <small>Score</small>
        </div>
      </div>
      <div class="dash-conf-criterios">
        ${criterios.map(c => {
          const p = calcPercent(c.ok, c.total);
          const cor = p >= 80 ? '#059669' : p >= 50 ? '#d97706' : '#dc2626';
          return `
            <div class="dash-conf-item">
              <i class="fas ${c.icon}" style="color:${cor};width:14px;"></i>
              <span>${c.label}</span>
              <div class="dash-conf-bar-wrap">
                <div class="dash-conf-bar" style="width:${p}%;background:${cor};"></div>
              </div>
              <strong style="color:${cor};min-width:36px;text-align:right;">${Math.round(p)}%</strong>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ── Heatmap de despesas por mês x projeto ── */
function _renderHeatmapDespesas(projetos, despesas) {
  const el = document.getElementById('dash-heatmap');
  if (!el) return;
  if (!despesas.length || !projetos.length) {
    el.innerHTML = `<div class="dash-heatmap-empty"><i class="fas fa-th"></i><p>Sem dados para o heatmap</p></div>`;
    return;
  }

  // Coleta todos os meses únicos
  const mesesSet = new Set(despesas.map(d => d.mes_referencia).filter(Boolean));
  const meses    = [...mesesSet].sort().slice(-12); // Últimos 12 meses
  const projs    = projetos.slice(0, 8); // Top 8 projetos

  // Matriz de valores
  const matrix = {};
  despesas.forEach(d => {
    if (!d.projeto_id || !d.mes_referencia) return;
    const key = `${d.projeto_id}__${d.mes_referencia}`;
    matrix[key] = (matrix[key]||0) + (Number(d.valor)||0);
  });

  const maxVal = Math.max(...Object.values(matrix), 1);

  const mesesLabel = meses.map(m => {
    const [ano, mes] = m.split('-');
    return `${mes}/${(ano||'').slice(2)}`;
  });

  el.innerHTML = `
    <div class="dash-heatmap-wrap" style="overflow-x:auto;">
      <table class="dash-heatmap-table">
        <thead>
          <tr>
            <th class="dash-heatmap-proj-th">Projeto</th>
            ${mesesLabel.map(m => `<th class="dash-heatmap-mes-th">${m}</th>`).join('')}
            <th class="dash-heatmap-total-th">Total</th>
          </tr>
        </thead>
        <tbody>
          ${projs.map(p => {
            const totalProj = meses.reduce((s,m) => s+(matrix[`${p.id}__${m}`]||0), 0);
            return `
              <tr>
                <td class="dash-heatmap-proj-name" title="${p.nome_projeto}">
                  ${(p.numero_proposta || (p.nome_projeto||'').slice(0,14))}
                </td>
                ${meses.map(m => {
                  const v = matrix[`${p.id}__${m}`] || 0;
                  const pct = v / maxVal;
                  const alpha = v > 0 ? Math.max(0.12, pct * 0.9) : 0;
                  const bg = v > 0 ? `rgba(37,99,235,${alpha.toFixed(2)})` : 'transparent';
                  const color = pct > 0.6 ? '#fff' : (v > 0 ? '#1e40af' : 'var(--text-muted)');
                  return `<td class="dash-heatmap-cell" style="background:${bg};color:${color};" title="${p.nome_projeto} | ${m}: ${fmt.currency(v)}">
                    ${v > 0 ? (v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)) : '·'}
                  </td>`;
                }).join('')}
                <td class="dash-heatmap-total" style="font-weight:700;color:var(--primary);">
                  ${fmt.currency(totalProj)}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Top Fornecedores ── */
function _renderTopFornecedores(despesas) {
  const el = document.getElementById('dash-top-fornecedores');
  if (!el) return;

  const mapa = {};
  despesas.forEach(d => {
    if (!d.fornecedor) return;
    if (!mapa[d.fornecedor]) mapa[d.fornecedor] = { total: 0, count: 0 };
    mapa[d.fornecedor].total += Number(d.valor)||0;
    mapa[d.fornecedor].count++;
  });

  const sorted = Object.entries(mapa).sort((a,b) => b[1].total - a[1].total).slice(0,8);
  if (!sorted.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-building"></i><p>Nenhum fornecedor cadastrado</p></div>`;
    return;
  }
  const maxVal = sorted[0][1].total;

  el.innerHTML = sorted.map(([nome, data], i) => {
    const pct = calcPercent(data.total, maxVal);
    const paleta = ['#2563eb','#059669','#d97706','#0891b2','#7c3aed','#dc2626','#db2777','#047857'];
    const cor = paleta[i % paleta.length];
    return `
      <div class="dash-fornecedor-item">
        <div class="dash-fornecedor-rank" style="background:${cor}20;color:${cor};">${i+1}</div>
        <div class="dash-fornecedor-info">
          <div class="dash-fornecedor-nome">${nome}</div>
          <div class="dash-fornecedor-bar-wrap">
            <div class="dash-fornecedor-bar" style="width:${pct}%;background:${cor};"></div>
          </div>
        </div>
        <div class="dash-fornecedor-vals">
          <strong style="color:${cor};">${fmt.currency(data.total)}</strong>
          <span class="text-xs text-muted">${data.count} lçm.</span>
        </div>
      </div>`;
  }).join('');
}

/* ── Timeline de Projetos (Gantt visual) ── */
function _renderTimeline(projetos) {
  const el = document.getElementById('dash-timeline');
  if (!el) return;

  const comDatas = projetos.filter(p => p.data_inicio && p.data_fim);
  if (!comDatas.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Nenhum projeto com datas definidas</p></div>`;
    return;
  }

  const hoje = new Date();
  const datas = comDatas.map(p => ({
    ini: new Date(p.data_inicio),
    fim: new Date(p.data_fim)
  }));

  const minD = new Date(Math.min(...datas.map(d => d.ini)));
  const maxD = new Date(Math.max(...datas.map(d => d.fim)));
  const totalDias = Math.max((maxD - minD) / 86400000, 1);

  const statusColors = {
    'Em Execução':         '#2563eb',
    'Concluído':           '#059689',
    'Prestação de Contas': '#d97706',
    'Suspenso':            '#dc2626',
    'Aguardando Início':   '#6b7280'
  };

  el.innerHTML = `
    <div class="dash-timeline-wrap">
      ${comDatas.slice(0,8).map(p => {
        const ini  = new Date(p.data_inicio);
        const fim  = new Date(p.data_fim);
        const left = ((ini - minD) / (totalDias * 86400000)) * 100;
        const width= ((fim - ini) / (totalDias * 86400000)) * 100;
        const cor  = statusColors[p.status] || '#6b7280';
        const dias = Math.ceil((fim - hoje) / 86400000);
        const hojeLeft = ((hoje - minD) / (totalDias * 86400000)) * 100;

        return `
          <div class="dash-timeline-row">
            <div class="dash-timeline-label" title="${p.nome_projeto}">
              ${(p.numero_proposta || (p.nome_projeto||'').slice(0,16))}
            </div>
            <div class="dash-timeline-track">
              <div class="dash-timeline-bar" style="left:${Math.max(0,left)}%;width:${Math.min(width,100-Math.max(0,left))}%;background:${cor};" title="${p.nome_projeto}: ${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)} (${dias > 0 ? dias+' dias restantes' : 'Encerrado'})">
                <span class="dash-timeline-bar-label">${dias > 0 ? dias+'d' : '✓'}</span>
              </div>
              ${hojeLeft >= 0 && hojeLeft <= 100 ? `<div class="dash-timeline-today" style="left:${hojeLeft}%;"></div>` : ''}
            </div>
          </div>`;
      }).join('')}
      <div class="dash-timeline-legend">
        <span class="text-xs text-muted"><i class="fas fa-circle" style="color:#e53e3e;font-size:.5rem;"></i> Hoje</span>
        <span class="text-xs text-muted">${fmt.date(minD.toISOString().slice(0,10))}</span>
        <span style="flex:1"></span>
        <span class="text-xs text-muted">${fmt.date(maxD.toISOString().slice(0,10))}</span>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════
   GRÁFICOS DO DASHBOARD GERAL
════════════════════════════════════════════ */

/* ── Gráfico Barras: Repasse vs Executado por Projeto ── */
function renderChartBarProjetos(projetos, despesas) {
  const ctx = document.getElementById('chartFinanceiro');
  if (!ctx) return;
  _destroyDashChart('chartFinanceiro');

  const labels     = projetos.map(p => p.numero_proposta || (p.nome_projeto||'').slice(0,14));
  const previstos  = projetos.map(p => Number(p.valor_repasse)||0);
  const executados = projetos.map(p =>
    despesas.filter(d => d.projeto_id===p.id).reduce((s,d) => s+(Number(d.valor)||0), 0)
  );
  const percExec = projetos.map((p,i) => calcPercent(executados[i], previstos[i]));

  _dashCharts['chartFinanceiro'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Repasse (R$)',
          data: previstos,
          backgroundColor: 'rgba(37,99,235,.12)',
          borderColor: 'rgba(37,99,235,.6)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: 'Executado (R$)',
          data: executados,
          backgroundColor: executados.map((v,i) => {
            const p = percExec[i];
            return p >= 80 ? 'rgba(5,150,105,.8)' : p >= 50 ? 'rgba(217,119,6,.8)' : 'rgba(220,38,38,.7)';
          }),
          borderColor: executados.map((v,i) => {
            const p = percExec[i];
            return p >= 80 ? 'rgba(5,150,105,1)' : p >= 50 ? 'rgba(217,119,6,1)' : 'rgba(220,38,38,1)';
          }),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { padding: 14, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${fmt.currency(c.raw)}`,
            afterLabel: c => c.datasetIndex===1 ? ` Execução: ${fmt.percent(percExec[c.dataIndex])}` : ''
          }
        }
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

  if (!projetos.length) { _drawEmptyChart(ctx, 'Nenhum projeto'); return; }

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
        borderColor: 'var(--card-bg,#fff)',
        hoverBorderWidth: 4,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyleWidth: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} projeto(s) (${Math.round(c.raw/projetos.length*100)}%)` } }
      }
    }
  });
}

/* ── Gráfico Line: Despesas Mensais Global (com acumulado) ── */
function renderChartMensalGlobal(despesas) {
  const ctx = document.getElementById('chartMensalGlobal');
  if (!ctx) return;
  _destroyDashChart('chartMensalGlobal');

  const mesMap = {};
  despesas.forEach(d => {
    const m = d.mes_referencia || '?';
    mesMap[m] = (mesMap[m]||0) + (Number(d.valor)||0);
  });
  const sorted = Object.entries(mesMap).filter(([k]) => k !== '?').sort((a,b) => a[0].localeCompare(b[0]));

  if (!sorted.length) { _drawEmptyChart(ctx, 'Sem despesas'); return; }

  // Acumulado
  let acum = 0;
  const acumData = sorted.map(([,v]) => { acum += v; return acum; });

  _dashCharts['chartMensalGlobal'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => { const p = x[0].split('-'); return (p[1]||'')+'/'+(p[0]||'').slice(2); }),
      datasets: [
        {
          type: 'bar',
          label: 'Mensal (R$)',
          data: sorted.map(x => x[1]),
          backgroundColor: 'rgba(37,99,235,.55)',
          borderColor: 'rgba(37,99,235,.8)',
          borderWidth: 1.5,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Acumulado (R$)',
          data: acumData,
          borderColor: '#059669',
          backgroundColor: 'rgba(5,150,105,.05)',
          tension: .4,
          fill: true,
          pointBackgroundColor: '#059669',
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt.currency(c.raw)}` } }
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

  if (!Object.keys(catMap).length) { _drawEmptyChart(ctx, 'Sem categorias'); return; }

  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const paleta = ['#2563eb','#059669','#d97706','#dc2626','#0891b2','#7c3aed','#db2777','#0f766e'];
  const total  = sorted.reduce((s,x) => s+x[1], 0);

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
        tooltip: {
          callbacks: {
            label: c => ` ${fmt.currency(c.raw)} (${fmt.percent(calcPercent(c.raw,total))})`
          }
        }
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
  try { const e = Chart.getChart(ctx); if (e) e.destroy(); } catch(e) {}
  new Chart(ctx, {
    type: 'doughnut',
    data: { labels: [msg], datasets: [{ data: [1], backgroundColor: ['#f1f5f9'], borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '0%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

/* ── Tabela resumo de projetos no dashboard ── */
function renderDashProjetos(projetos, despesas, metas) {
  const tbody = document.getElementById('dash-projetos-recentes');
  if (!tbody) return;

  if (!projetos.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-folder-open"></i><p>Nenhum projeto cadastrado.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = projetos.map((p, idx) => {
    const execProjeto = despesas.filter(d => d.projeto_id===p.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const percP       = calcPercent(execProjeto, p.valor_repasse);
    const benef       = metas.filter(m => m.projeto_id===p.id).reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const nDespesas   = despesas.filter(d => d.projeto_id===p.id).length;
    const saude       = _calcSaude(p, percP);
    const aPagar      = despesas.filter(d => d.projeto_id===p.id && d.status_pagamento==='A Pagar').reduce((s,d) => s+(Number(d.valor)||0), 0);

    return `<tr style="animation: pageFadeIn .2s ease ${idx * 0.04}s both;">
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <span title="${saude.label}" style="font-size:1.1rem;">${saude.emoji}</span>
          <div>
            <div class="font-semibold" style="font-size:.82rem;">${p.nome_projeto || '-'}</div>
            <div class="text-xs text-muted">
              ${p.numero_proposta ? `<span class="badge badge-gray" style="font-size:.6rem;">${p.numero_proposta}</span> ` : ''}
              ${p.concedente ? `<span style="font-size:.68rem;">${p.concedente}</span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td>${statusBadge(p.status)}</td>
      <td class="text-right font-semibold" style="font-size:.82rem;">${fmt.currency(p.valor_repasse)}</td>
      <td class="text-right font-semibold" style="font-size:.82rem;color:var(--success);">${fmt.currency(execProjeto)}</td>
      <td style="min-width:90px;">${progressBar(percP, true)}</td>
      <td class="text-center font-semibold">${fmt.number(benef)}</td>
      <td class="text-right" style="font-size:.78rem;color:${aPagar > 0 ? 'var(--danger)' : 'var(--text-muted)'};">
        ${aPagar > 0 ? fmt.currency(aPagar) : '—'}
      </td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="viewProjeto('${p.id}')" title="Dashboard do Projeto">
            <i class="fas fa-chart-line"></i>
          </button>
          <button class="btn btn-outline btn-xs" onclick="navigateTo('prestacao');setTimeout(()=>{const s=document.getElementById('prest-select-projeto');if(s){s.value='${p.id}';loadPrestacao();}},400)" title="Prestação de Contas">
            <i class="fas fa-file-invoice"></i>
          </button>
        </div>
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
  if (percExec < percTempo - 25)          return { emoji: '🔴', label: 'Execução muito atrasada' };
  if (percExec < percTempo - 10)          return { emoji: '🟡', label: 'Execução abaixo do previsto' };
  if (percExec >= percTempo || percExec >= 80) return { emoji: '🟢', label: 'Execução em dia' };
  return { emoji: '🟡', label: 'Atenção — acompanhe o cronograma' };
}

/* ── Alertas automáticos inteligentes SUPREMOS ── */
function renderAlertas(projetos, metas, despesas) {
  const c = document.getElementById('dash-alertas');
  if (!c) return;

  const alertas = [];
  const hoje = new Date();

  /* Projetos com vigência próxima / encerrada */
  projetos.forEach(p => {
    if (p.data_fim && ['Em Execução','Prestação de Contas'].includes(p.status)) {
      const fim  = new Date(p.data_fim);
      const dias = Math.ceil((fim - hoje) / 86400000);
      if (dias < 0) {
        alertas.push({ type:'danger', icon:'fa-exclamation-circle', priority: 0,
          msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: vigência <strong>encerrada há ${Math.abs(dias)} dias</strong>!`,
          action: `onclick="viewProjeto('${p.id}')"` });
      } else if (dias <= 15) {
        alertas.push({ type:'danger', icon:'fa-fire', priority: 1,
          msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: termina em <strong>${dias} dia${dias!==1?'s':''}</strong> ⚡`,
          action: `onclick="viewProjeto('${p.id}')"` });
      } else if (dias <= 45) {
        alertas.push({ type:'warning', icon:'fa-calendar-alt', priority: 2,
          msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: vigência termina em <strong>${dias} dias</strong>`,
          action: `onclick="viewProjeto('${p.id}')"` });
      }
    }
  });

  /* Metas atrasadas */
  const metasAtrasadas = metas.filter(m => m.status === 'Atrasada');
  if (metasAtrasadas.length) {
    alertas.push({ type:'danger', icon:'fa-flag', priority: 1,
      msg: `<strong>${metasAtrasadas.length} meta(s) atrasada(s)</strong> — ${metasAtrasadas.map(m=>'Meta '+m.numero_meta).slice(0,3).join(', ')}` });
  }

  /* Despesas a pagar */
  const aPagar = despesas.filter(d => d.status_pagamento === 'A Pagar');
  if (aPagar.length > 0) {
    const tot = aPagar.reduce((s,d) => s+(Number(d.valor)||0), 0);
    alertas.push({ type:'info', icon:'fa-file-invoice-dollar', priority: 3,
      msg: `<strong>${aPagar.length}</strong> lançamento(s) pendente(s) — total: <strong>${fmt.currency(tot)}</strong>`,
      action: `onclick="navigateTo('financeiro')"` });
  }

  /* Projetos sem rubricas */
  const semRubrica = projetos.filter(p =>
    p.status === 'Em Execução' && !(CACHE.rubricas||[]).some(r => r.projeto_id===p.id)
  );
  if (semRubrica.length) {
    alertas.push({ type:'warning', icon:'fa-list-check', priority: 2,
      msg: `<strong>${semRubrica.length} projeto(s)</strong> em execução <strong>sem rubricas</strong> cadastradas`,
      action: `onclick="navigateTo('financeiro')"` });
  }

  /* Despesas sem rubrica vinculada */
  const semRubDesp = despesas.filter(d => !d.rubrica_id);
  if (semRubDesp.length > 0) {
    alertas.push({ type:'warning', icon:'fa-unlink', priority: 2,
      msg: `<strong>${semRubDesp.length}</strong> despesa(s) sem rubrica vinculada — vincule para conformidade`,
      action: `onclick="navigateTo('financeiro')"` });
  }

  /* Execução financeira baixa em projetos ativos */
  projetos.filter(p => p.status === 'Em Execução' && p.data_inicio && p.data_fim).forEach(p => {
    const inicio = new Date(p.data_inicio);
    const fim    = new Date(p.data_fim);
    const total  = Math.max((fim - inicio) / 86400000, 1);
    const decor  = Math.max((hoje - inicio) / 86400000, 0);
    const percTempo = Math.min((decor / total) * 100, 100);
    const execP = despesas.filter(d => d.projeto_id===p.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const percExecP = calcPercent(execP, p.valor_repasse);
    if (percTempo > 50 && percExecP < percTempo - 20) {
      alertas.push({ type:'warning', icon:'fa-exclamation-triangle', priority: 2,
        msg: `<strong>${p.numero_proposta || p.nome_projeto}</strong>: execução financeira baixa — ${fmt.percent(percExecP)} exec. / ${fmt.percent(percTempo)} do período decorrido`,
        action: `onclick="viewProjeto('${p.id}')"` });
    }
  });

  if (alertas.length === 0) {
    c.innerHTML = `<div class="alert alert-success" style="font-size:.84rem;"><i class="fas fa-check-circle"></i><div><strong>Tudo em ordem!</strong> Nenhum alerta pendente.</div></div>`;
    return;
  }

  alertas.sort((a,b) => a.priority - b.priority);

  c.innerHTML = alertas.slice(0,6).map(a =>
    `<div class="alert alert-${a.type}" style="font-size:.82rem;cursor:${a.action?'pointer':'default'};" ${a.action||''}>
      <i class="fas ${a.icon}"></i>
      <div>${a.msg}</div>
    </div>`
  ).join('') + (alertas.length > 6 ? `<div class="text-xs text-muted text-center" style="margin-top:6px;">+${alertas.length-6} alertas adicionais</div>` : '');
}

/* ── Helper: destruir chart local do dashboard ── */
function _destroyDashChart(id) {
  if (_dashCharts[id]) { try { _dashCharts[id].destroy(); } catch(e) {} delete _dashCharts[id]; }
  try { const ctx = document.getElementById(id); if (ctx) { const e = Chart.getChart(ctx); if (e) e.destroy(); } } catch(e) {}
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
  if (el) el.innerHTML = `<div class="loading-spinner" style="padding:60px;"><i class="fas fa-spinner"></i> Carregando projeto...</div>`;

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
  let diasRestantes = null;
  if (p.data_fim) {
    const dias = Math.ceil((new Date(p.data_fim) - new Date()) / 86400000);
    diasRestantes = dias;
    if (dias < 0) diasInfo = `<span class="badge badge-danger"><i class="fas fa-exclamation-circle"></i> Vigência encerrada</span>`;
    else if (dias <= 30) diasInfo = `<span class="badge badge-danger"><i class="fas fa-fire"></i> ${dias}d restantes</span>`;
    else if (dias <= 90) diasInfo = `<span class="badge badge-warning"><i class="fas fa-clock"></i> ${dias}d restantes</span>`;
    else diasInfo = `<span class="badge badge-green"><i class="fas fa-calendar-check"></i> ${dias}d restantes</span>`;
  }

  /* Score do projeto */
  const scoreItems = [
    { ok: rub.length > 0,      label: 'Rubricas' },
    { ok: dep.length > 0,      label: 'Despesas' },
    { ok: met.length > 0,      label: 'Metas' },
    { ok: crn.length > 0,      label: 'Cronograma' },
    { ok: !!p.data_inicio,     label: 'Data Início' },
    { ok: !!p.data_fim,        label: 'Data Fim' },
    { ok: Number(p.valor_repasse)>0, label: 'Valor' },
    { ok: percExec > 0,        label: 'Exec. Financ.' }
  ];
  const score = Math.round(scoreItems.filter(s => s.ok).length / scoreItems.length * 100);
  const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626';

  /* Cabeçalho colorido */
  const header = `
  <div class="proj-dash-header mb-3">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="navigateTo('projetos')">
            <i class="fas fa-arrow-left"></i> Projetos
          </button>
          ${statusBadge(p.status)}
          ${diasInfo}
          <span style="background:${scoreColor}22;border:1px solid ${scoreColor}44;color:${scoreColor};border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:700;">
            <i class="fas fa-star"></i> Score ${score}%
          </span>
        </div>
        <h2 style="font-size:1.1rem;margin:0 0 4px;">${p.nome_projeto || 'Projeto'}</h2>
        <p style="margin:0;font-size:.82rem;opacity:.8;">${p.numero_proposta || '-'} &nbsp;·&nbsp; ${p.modalidade || '-'} &nbsp;·&nbsp; ${p.concedente || '-'}</p>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;">
        <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="editProjeto('${p.id}')">
          <i class="fas fa-pencil"></i> Editar
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.25);" onclick="navigateTo('rubricas')">
          <i class="fas fa-tags"></i> Rubricas
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

  /* KPIs */
  const kpis = `
  <div class="kpi-grid mb-3" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
    <div class="kpi-card blue"><div class="kpi-icon blue"><i class="fas fa-university"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalRep)}</div><div class="kpi-label">Repasse Federal</div></div></div>
    <div class="kpi-card green"><div class="kpi-icon green"><i class="fas fa-hand-holding-heart"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalCont)}</div><div class="kpi-label">Contrapartida</div></div></div>
    <div class="kpi-card orange"><div class="kpi-icon orange"><i class="fas fa-receipt"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalExec)}</div><div class="kpi-label">Total Executado</div><div class="kpi-sub">${fmt.percent(percExec)}</div></div></div>
    <div class="kpi-card ${saldo < 0 ? 'red' : 'teal'}"><div class="kpi-icon ${saldo < 0 ? 'red' : 'teal'}"><i class="fas fa-balance-scale"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem;${saldo < 0 ? 'color:var(--danger)' : ''}">${fmt.currency(saldo)}</div><div class="kpi-label">Saldo Disponível</div></div></div>
    <div class="kpi-card purple"><div class="kpi-icon purple"><i class="fas fa-users"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.85rem">${fmt.number(benAten)} / ${fmt.number(benPrev)}</div><div class="kpi-label">Beneficiários</div><div class="kpi-sub">${fmt.percent(percBenef)}</div></div></div>
    <div class="kpi-card red"><div class="kpi-icon red"><i class="fas fa-clock"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(aPagar)}</div><div class="kpi-label">A Pagar</div></div></div>
    <div class="kpi-card blue"><div class="kpi-icon blue"><i class="fas fa-file-invoice"></i></div><div class="kpi-info"><div class="kpi-value">${nDocs}</div><div class="kpi-label">Lançamentos</div></div></div>
    <div class="kpi-card green"><div class="kpi-icon green"><i class="fas fa-check-circle"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(dep.filter(d=>d.status_pagamento==='Pago').reduce((s,d)=>s+(Number(d.valor)||0),0))}</div><div class="kpi-label">Total Pago</div></div></div>
  </div>`;

  /* Barra de execução dupla (Repasse Fed. + Contrapartida) */
  const percRep  = calcPercent(execRepasse, totalRep);
  const percCont = calcPercent(execContra,  totalCont);
  const barra = `
  <div class="card card-accent-blue mb-3">
    <div class="card-body" style="padding:16px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <span class="text-sm font-semibold">Execução Financeira do Projeto</span>
        <div style="display:flex;gap:12px;">
          <span class="text-xs" style="color:var(--primary);"><i class="fas fa-circle" style="font-size:.5rem;"></i> Repasse: ${fmt.percent(percRep)}</span>
          <span class="text-xs" style="color:var(--success);"><i class="fas fa-circle" style="font-size:.5rem;"></i> Contrapart.: ${fmt.percent(percCont)}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 mb-1" style="font-size:.75rem;color:var(--text-muted);">Repasse Federal</div>
      <div class="progress-bar-wrap" style="height:10px;border-radius:8px;margin-bottom:8px;">
        <div class="progress-bar-fill ${progressColor(percRep)}" style="width:${Math.min(percRep,100)}%;transition:width .8s ease;"></div>
      </div>
      ${totalCont > 0 ? `
      <div class="flex items-center gap-2 mb-1" style="font-size:.75rem;color:var(--text-muted);">Contrapartida</div>
      <div class="progress-bar-wrap" style="height:10px;border-radius:8px;margin-bottom:8px;">
        <div class="progress-bar-fill green" style="width:${Math.min(percCont,100)}%;transition:width .8s .1s ease;"></div>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span class="text-xs text-muted">Rep. Fed. executado: ${fmt.currency(execRepasse)}</span>
        <span class="text-xs text-muted">Total previsto: ${fmt.currency(totalRep + totalCont)}</span>
      </div>
    </div>
  </div>`;

  /* 4 gráficos */
  const graficos = `
  <div class="grid-2 mb-3">
    <div class="card">
      <div class="card-header"><h3><i class="fas fa-chart-bar"></i> Despesas por Mês</h3></div>
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
  if (_projDashCharts[key]) { try { _projDashCharts[key].destroy(); } catch(e) {} }
  _projDashCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => { const p=x[0].split('-'); return (p[1]||'')+'/'+(p[0]||'').slice(2); }),
      datasets: [{
        label: 'R$', data: sorted.map(x => x[1]),
        backgroundColor: 'rgba(37,99,235,.65)',
        borderColor: 'rgba(37,99,235,1)',
        borderWidth: 1.5,
        borderRadius: 6,
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
  if (_projDashCharts[key]) { try { _projDashCharts[key].destroy(); } catch(e) {} }
  _projDashCharts[key] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(x => x[0]),
      datasets: [{
        data: entries.map(x => x[1]),
        backgroundColor: colors.slice(0, entries.length),
        borderWidth: 3, borderColor: 'var(--card-bg,#fff)', hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
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
  if (_projDashCharts[key]) { try { _projDashCharts[key].destroy(); } catch(e) {} }
  _projDashCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: met.map(m => `Meta ${m.numero_meta}`),
      datasets: [
        { label: 'Previsto',  data: met.map(m => Number(m.beneficiarios_previstos)||0), backgroundColor: 'rgba(37,99,235,.2)', borderRadius: 5, borderSkipped: false },
        { label: 'Atendido',  data: met.map(m => Number(m.beneficiarios_atendidos)||0),  backgroundColor: 'rgba(5,150,105,.75)', borderRadius: 5, borderSkipped: false }
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
  deps.forEach(d => { const m = d.mes_referencia; if (m) execMap[m] = (execMap[m]||0)+(Number(d.valor)||0); });

  const allMonths = [...new Set([...Object.keys(prevMap),...Object.keys(execMap)])].sort();
  if (!allMonths.length) { _drawEmptyChart(ctx, 'Sem cronograma'); return; }

  const key = `pc${projId}`;
  if (_projDashCharts[key]) { try { _projDashCharts[key].destroy(); } catch(e) {} }
  _projDashCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allMonths.map(m => { const p=m.split('-'); return (p[1]||'')+'/'+(p[0]||'').slice(2); }),
      datasets: [
        { label: 'Previsto',  data: allMonths.map(m => prevMap[m]||0),  backgroundColor: 'rgba(37,99,235,.2)',  borderColor: 'rgba(37,99,235,.6)',  borderWidth: 1.5, borderRadius: 5, borderSkipped: false },
        { label: 'Executado', data: allMonths.map(m => execMap[m]||0),  backgroundColor: 'rgba(5,150,105,.7)',  borderColor: 'rgba(5,150,105,1)',   borderWidth: 1.5, borderRadius: 5, borderSkipped: false }
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
  if (!rubricas.length) return `
    <div class="card mb-3">
      <div class="card-body" style="text-align:center;padding:24px;">
        <i class="fas fa-tags" style="font-size:1.8rem;color:var(--text-muted);margin-bottom:8px;display:block;"></i>
        <p class="text-muted">Nenhuma rubrica cadastrada. <button class="btn-link-inline" onclick="navigateTo('financeiro')">Adicionar rubricas</button></p>
      </div>
    </div>`;

  const totalPrev = rubricas.reduce((s,r) => s+(Number(r.valor_previsto)||0), 0);
  const totalExec = despesas.reduce((s,d) => s+(Number(d.valor)||0), 0);

  return `
  <div class="card mb-3">
    <div class="card-header">
      <h3><i class="fas fa-list-check"></i> Rubricas — Execução vs. Previsto</h3>
      <div style="display:flex;gap:6px;">
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
            <th class="text-right">Saldo</th><th style="min-width:90px;">% Exec.</th>
          </tr>
        </thead>
        <tbody>
          ${rubricas.map(r => {
            const exec  = despesas.filter(d => d.rubrica_id===r.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
            const perc  = calcPercent(exec, r.valor_previsto);
            const saldo = (Number(r.valor_previsto)||0) - exec;
            return `<tr>
              <td><span class="badge badge-blue" style="font-size:.68rem;">${r.categoria}</span></td>
              <td class="font-semibold" style="font-size:.8rem;">${r.descricao}</td>
              <td class="text-right text-sm">${fmt.currency(r.valor_previsto)}</td>
              <td class="text-right text-sm">${fmt.currency(exec)}</td>
              <td class="text-right text-sm ${saldo < 0 ? 'text-danger font-semibold' : 'text-success'}">${fmt.currency(saldo)}</td>
              <td>${progressBar(perc)}</td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:700;background:var(--gray-50,#f8fafc);">
            <td colspan="2" class="font-semibold" style="font-size:.8rem;">TOTAL</td>
            <td class="text-right text-sm">${fmt.currency(totalPrev)}</td>
            <td class="text-right text-sm">${fmt.currency(totalExec)}</td>
            <td class="text-right text-sm ${totalPrev-totalExec < 0 ? 'text-danger' : 'text-success'}">${fmt.currency(totalPrev-totalExec)}</td>
            <td>${progressBar(calcPercent(totalExec, totalPrev))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ── Tabela de metas no dash do projeto ── */
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
            <th style="width:36px;">🚦</th><th style="width:42px;">#</th>
            <th>Meta / Indicador</th><th class="text-center">Beneficiários</th>
            <th style="min-width:90px;">Exec. Física</th><th style="min-width:90px;">Exec. Fin.</th>
            <th>Timeline</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${metas.map(m => {
            const percF   = Number(m.percentual_fisico)||0;
            const projId  = m.projeto_id;
            const rubsProjeto  = rubs.filter(r => r.projeto_id === projId);
            const totalPrevRubs= rubsProjeto.reduce((s,r) => s+(Number(r.valor_previsto)||0), 0);
            const totalExecRubs= rubsProjeto.reduce((s,r) => s+(Number(r.valor_executado)||0), 0);
            const triggerAtivo = totalExecRubs > 0;

            let execDin = 0;
            if (triggerAtivo && totalPrevRubs > 0) {
              execDin = totalExecRubs * ((Number(m.valor_previsto)||0) / totalPrevRubs);
            } else {
              const despProjeto = deps.filter(d => d.projeto_id === projId);
              const totalDespProjeto = despProjeto.reduce((s,d) => s+(Number(d.valor)||0), 0);
              if (totalPrevRubs > 0) {
                execDin = totalDespProjeto * ((Number(m.valor_previsto)||0) / totalPrevRubs);
              } else if (totalDespProjeto > 0) {
                const nMetas = Math.max(metas.filter(x => x.projeto_id === projId).length, 1);
                execDin = totalDespProjeto / nMetas;
              }
            }
            const percFin = calcPercent(execDin, m.valor_previsto);

            let saudeMeta = '🟢';
            if (m.data_fim) {
              const dias = Math.ceil((new Date(m.data_fim) - hoje) / 86400000);
              if (dias < 0) saudeMeta = '🔴';
              else if (dias <= 15) saudeMeta = '🔴';
              else if (dias <= 45 && percF < 60) saudeMeta = '🟡';
            }
            if (m.status === 'Atrasada') saudeMeta = '🔴';

            let timelineBar = '';
            if (m.data_inicio && m.data_fim) {
              const ini  = new Date(m.data_inicio).getTime();
              const fim  = new Date(m.data_fim).getTime();
              const percT = Math.min(((hoje.getTime() - ini) / Math.max(fim - ini, 1)) * 100, 100);
              timelineBar = `
                <div title="Tempo: ${Math.round(percT)}%" style="background:#e2e8f0;border-radius:4px;height:7px;min-width:70px;">
                  <div style="width:${percT}%;background:${percT>80?'#dc2626':percT>60?'#d97706':'#2563eb'};height:100%;border-radius:4px;"></div>
                </div>
                <div class="text-xs text-muted" style="margin-top:2px;">${fmt.date(m.data_inicio)} → ${fmt.date(m.data_fim)}</div>`;
            }

            return `<tr>
              <td class="text-center" style="font-size:1rem;" title="${m.status||''}">${saudeMeta}</td>
              <td class="font-semibold text-center">${m.numero_meta}</td>
              <td>
                <div class="font-semibold" style="font-size:.8rem;">${m.descricao_meta}</div>
                ${m.indicador ? `<div class="text-xs text-muted">${m.indicador}</div>` : ''}
              </td>
              <td class="text-center">
                <strong>${fmt.number(m.beneficiarios_atendidos)}</strong>
                <span class="text-muted text-xs">/${fmt.number(m.beneficiarios_previstos)}</span>
              </td>
              <td>${progressBar(percF)}</td>
              <td>
                <div class="text-xs text-muted" style="margin-bottom:2px;">${fmt.currency(execDin)} / ${fmt.currency(m.valor_previsto)}</div>
                ${progressBar(percFin)}
              </td>
              <td style="min-width:90px;">${timelineBar || fmt.date(m.data_fim)}</td>
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
                  <td class="text-right font-semibold text-sm">${fmt.currency(d.valor)}</td>
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

/* _kpiSetWithAnimation está definida globalmente em ui.js — não duplicar aqui */

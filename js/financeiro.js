/* =============================================
   ONG GESTOR v5 — Execução Financeira (Supreme)
   ============================================= */

let despesasData    = [];
let rubricasData    = [];
let projetosFinData = [];
let despesaEditId   = null;
let _finCharts      = {};
const _finOpenMeses = new Set();

/* ════════════════════════════════════════════
   CARGA PRINCIPAL
════════════════════════════════════════════ */
async function loadFinanceiro() {
  skeletonTable('despesas-tbody', 8, 9);
  skeletonTable('rubricas-tbody', 4, 10);

  try {
    const [pR, dR, rR] = await Promise.all([
      DB.getAll('ong_projetos'),
      DB.getAll('ong_despesas'),
      DB.getAll('ong_rubricas')
    ]);
    projetosFinData = pR || [];
    despesasData    = dR || [];
    rubricasData    = rR || [];
    CACHE.projetos  = projetosFinData;
    CACHE.despesas  = despesasData;
    CACHE.rubricas  = rubricasData;

    populateProjetoSelect('fin-filter-projeto');
    populateProjetoSelect('desp-projeto');
    renderFinanceiroKpis();
    renderFinChartRubricas();
    renderFinChartMensal();
    renderFinChartFonte();
    renderDespesasTable(despesasData);

    // ── Carrega Rubricas na aba unificada ──
    projetosRubData  = projetosFinData;
    rubricasPageData = rubricasData;
    CACHE.cronograma = CACHE.cronograma || [];
    populateProjetoSelectRub('rub-filter-projeto');
    if (typeof populateCategoriaFilter === 'function') populateCategoriaFilter();
    renderRubricasTable(rubricasPageData);

    // ── Atualiza badges nas tabs ──
    const bR = document.getElementById('fin-badge-rubricas');
    const bL = document.getElementById('fin-badge-lancamentos');
    if (bR) bR.textContent = rubricasPageData.length;
    if (bL) bL.textContent = despesasData.length;

  } catch(err) {
    showToast('Erro ao carregar financeiro: ' + err.message, 'error');
    console.error(err);
  }
}

/* ── Popula select de projetos ── */
function populateProjetoSelect(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const isFilter = id.includes('filter');
  sel.innerHTML = isFilter
    ? '<option value="">Todos os Projetos</option>'
    : '<option value="">Selecione o Projeto</option>';
  projetosFinData.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta || p.id} — ${(p.nome_projeto||'').slice(0,40)}`;
    sel.appendChild(o);
  });
}

/* ── Atualiza select de rubricas ao trocar projeto ── */
function updateRubricaSelect() {
  const projId = document.getElementById('desp-projeto')?.value;
  const sel    = document.getElementById('desp-rubrica');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione a Rubrica</option>';
  if (projId) {
    const list = rubricasData.filter(r => r.projeto_id === projId);
    if (!list.length) {
      const o = document.createElement('option');
      o.value = ''; o.disabled = true;
      o.textContent = '— Nenhuma rubrica cadastrada —';
      sel.appendChild(o);
      return;
    }
    list.forEach(r => {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = `${r.categoria} — ${r.descricao}`;
      sel.appendChild(o);
    });
  }
}

/* ════════════════════════════════════════════
   KPIs
════════════════════════════════════════════ */
function renderFinanceiroKpis() {
  const total   = despesasData.reduce((s,d) => s+(Number(d.valor)||0), 0);
  const repasse = despesasData.filter(d => d.fonte==='Repasse Federal').reduce((s,d) => s+(Number(d.valor)||0), 0);
  const contra  = despesasData.filter(d => d.fonte==='Contrapartida').reduce((s,d) => s+(Number(d.valor)||0), 0);
  const aPagar  = despesasData.filter(d => d.status_pagamento==='A Pagar').reduce((s,d) => s+(Number(d.valor)||0), 0);
  const pago    = despesasData.filter(d => d.status_pagamento==='Pago').reduce((s,d) => s+(Number(d.valor)||0), 0);
  const nDocs   = despesasData.length;

  setText('fin-kpi-total',         fmt.currency(total));
  setText('fin-kpi-repasse',       fmt.currency(repasse));
  setText('fin-kpi-contrapartida', fmt.currency(contra));
  setText('fin-kpi-apagar',        fmt.currency(aPagar));
  setText('fin-kpi-pago',          fmt.currency(pago));
  setText('fin-kpi-ndocs',         `${nDocs} lançamentos`);
}

/* ════════════════════════════════════════════
   GRÁFICOS
════════════════════════════════════════════ */
function _destroyFinChart(id) {
  if (_finCharts[id]) { try { _finCharts[id].destroy(); } catch(e) {} delete _finCharts[id]; }
}
/* alias legado */
function destroyFinChart(id) { _destroyFinChart(id); }

function renderFinChartRubricas() {
  const ctx = document.getElementById('chartRubricas');
  if (!ctx) return;
  _destroyFinChart('rub');

  const catMap = {};
  despesasData.forEach(d => {
    const rub = rubricasData.find(r => r.id===d.rubrica_id);
    const cat = rub?.categoria || 'Outros';
    catMap[cat] = (catMap[cat]||0) + (Number(d.valor)||0);
  });
  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const paleta = ['#2563eb','#059669','#d97706','#dc2626','#0891b2','#7c3aed','#db2777','#047857'];

  _finCharts.rub = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{
        label: 'Executado (R$)',
        data: sorted.map(x => x[1]),
        backgroundColor: paleta.slice(0, sorted.length).map(c => c+'cc'),
        borderColor: paleta.slice(0, sorted.length),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      },
      scales: {
        x: { beginAtZero: true, ticks: { callback: v => v>=1000?(v/1000).toFixed(0)+'k':''+v }, grid: { color: 'rgba(0,0,0,.04)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderFinChartMensal() {
  const ctx = document.getElementById('chartMensal');
  if (!ctx) return;
  _destroyFinChart('mensal');

  const mesMap = {};
  despesasData.forEach(d => {
    const m = d.mes_referencia || '?';
    mesMap[m] = (mesMap[m]||0) + (Number(d.valor)||0);
  });
  const sorted = Object.entries(mesMap).filter(([k]) => k !== '?').sort((a,b) => a[0].localeCompare(b[0]));

  _finCharts.mensal = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(x => fmt.monthYear(x[0])),
      datasets: [{
        label: 'Despesas (R$)',
        data: sorted.map(x => x[1]),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,.07)',
        tension: .35, fill: true,
        pointBackgroundColor: '#2563eb',
        pointRadius: 5, pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v>=1000?(v/1000).toFixed(0)+'k':''+v }, grid: { color: 'rgba(0,0,0,.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderFinChartFonte() {
  const ctx = document.getElementById('chartFonte');
  if (!ctx) return;
  _destroyFinChart('fonte');

  const repasse = despesasData.filter(d => d.fonte==='Repasse Federal').reduce((s,d) => s+(Number(d.valor)||0), 0);
  const contra  = despesasData.filter(d => d.fonte==='Contrapartida').reduce((s,d) => s+(Number(d.valor)||0), 0);
  const outros  = despesasData.filter(d => !['Repasse Federal','Contrapartida'].includes(d.fonte)).reduce((s,d) => s+(Number(d.valor)||0), 0);

  _finCharts.fonte = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Repasse Federal','Contrapartida','Outros'],
      datasets: [{
        data: [repasse, contra, outros],
        backgroundColor: ['#2563eb','#059669','#d97706'],
        borderWidth: 3, borderColor: '#fff', hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => ` ${fmt.currency(c.raw)}` } }
      }
    }
  });
}

/* ════════════════════════════════════════════
   TABELA DESPESAS — Projeto → Mês → Itens
════════════════════════════════════════════ */
function renderDespesasTable(despesas) {
  const tbody = document.getElementById('despesas-tbody');
  if (!tbody) return;

  if (!despesas.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma despesa registrada</p></div></td></tr>`;
    return;
  }

  /* Agrupa: byProj[projId][mes] = [items] */
  const byProj = {};
  despesas.forEach(d => {
    if (!byProj[d.projeto_id]) byProj[d.projeto_id] = {};
    const m = d.mes_referencia || 'S/D';
    if (!byProj[d.projeto_id][m]) byProj[d.projeto_id][m] = [];
    byProj[d.projeto_id][m].push(d);
  });

  let html = '';

  Object.entries(byProj).forEach(([projId, byMes]) => {
    const proj      = projetosFinData.find(p => p.id===projId);
    const totalProj = despesas.filter(d => d.projeto_id===projId).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const nDocs     = despesas.filter(d => d.projeto_id===projId).length;
    const percProj  = calcPercent(totalProj, proj?.valor_repasse);

    /* Cabeçalho do projeto */
    html += `
    <tr style="background:linear-gradient(90deg,rgba(37,99,235,.05),rgba(37,99,235,.02));border-top:2px solid var(--primary-light);">
      <td colspan="9" style="padding:10px 14px;">
        <div class="flex justify-between items-center flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <div class="kpi-icon blue" style="width:28px;height:28px;font-size:.7rem;border-radius:7px;flex-shrink:0;">
              <i class="fas fa-folder"></i>
            </div>
            <div>
              <span class="font-semibold" style="font-size:.85rem;color:var(--primary-darker);">
                ${proj?.nome_projeto || projId}
              </span>
              ${proj?.numero_proposta ? `<span class="badge badge-gray ml-1" style="font-size:.6rem;">${proj.numero_proposta}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-gray">${nDocs} lançamento${nDocs!==1?'s':''}</span>
            <span class="font-semibold text-sm">${fmt.currency(totalProj)}</span>
            <div style="width:80px;">${progressBar(percProj)}</div>
          </div>
        </div>
      </td>
    </tr>`;

    /* Meses ordenados */
    Object.entries(byMes)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .forEach(([mes, itens]) => {
        const totalMes  = itens.reduce((s,d) => s+(Number(d.valor)||0), 0);
        const mesKey    = `mes-${projId}-${mes}`.replace(/[^a-z0-9-]/gi,'');
        const isOpen    = _finOpenMeses.has(mesKey);
        const nPago     = itens.filter(d => d.status_pagamento==='Pago').length;
        const nAPagar   = itens.filter(d => d.status_pagamento==='A Pagar').length;

        /* Linha do mês (expansível) */
        html += `
        <tr class="tr-expandable" style="background:var(--gray-50);" onclick="toggleMesDetalhe('${mesKey}')">
          <td colspan="6" style="padding-left:32px;">
            <div class="flex items-center gap-2">
              <i class="fas fa-chevron-right text-xs" id="icon-${mesKey}"
                 style="transition:.2s;color:var(--primary);${isOpen?'transform:rotate(90deg);':''}"></i>
              <span class="month-tag"><i class="fas fa-calendar-alt"></i>${fmt.monthYear(mes)}</span>
              <span class="badge badge-blue">${itens.length} lançamento${itens.length!==1?'s':''}</span>
              ${nPago    > 0 ? `<span class="badge badge-green">${nPago} pago${nPago!==1?'s':''}</span>` : ''}
              ${nAPagar  > 0 ? `<span class="badge badge-orange">${nAPagar} a pagar</span>` : ''}
            </div>
          </td>
          <td colspan="3" class="text-right">
            <span class="font-semibold text-sm">${fmt.currency(totalMes)}</span>
          </td>
        </tr>
        <tr class="tr-detail" id="detail-${mesKey}" style="display:${isOpen?'':'none'};">
          <td colspan="9" style="padding:0;">
            <div class="tr-detail-inner" style="padding:0;">
              <table style="width:100%;font-size:.79rem;border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--gray-100);">
                    <th style="padding:7px 12px;font-size:.67rem;">Data</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Descrição</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Fornecedor</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Documento</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Rubrica</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Fonte</th>
                    <th style="padding:7px 12px;font-size:.67rem;text-align:right;">Valor</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Pag.</th>
                    <th style="padding:7px 12px;font-size:.67rem;">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${itens.map((d, idx) => {
                    const rub = rubricasData.find(r => r.id===d.rubrica_id);
                    return `
                    <tr style="border-top:${idx>0?'1px solid var(--border-light)':'none'};background:${d.status_pagamento==='Pago'?'rgba(5,150,105,.02)':d.status_pagamento==='Contestado'?'rgba(220,38,38,.02)':'transparent'}">
                      <td style="padding:8px 12px;">${fmt.date(d.data_despesa)}</td>
                      <td style="padding:8px 12px;">
                        <div style="font-weight:600;">${d.descricao || '-'}</div>
                        ${d.observacao ? `<div style="font-size:.7rem;color:var(--text-muted);font-style:italic;margin-top:2px;">${d.observacao}</div>` : ''}
                      </td>
                      <td style="padding:8px 12px;">
                        <div>${d.fornecedor || '-'}</div>
                        ${d.cnpj_cpf ? `<div style="font-size:.68rem;color:var(--text-muted);">${d.cnpj_cpf}</div>` : ''}
                      </td>
                      <td style="padding:8px 12px;">
                        <div class="doc-chip"><i class="fas fa-file-alt"></i>${d.tipo_documento || 'Doc'}</div>
                        <div style="font-size:.68rem;color:var(--text-muted);margin-top:2px;">${d.numero_documento || '-'}</div>
                        ${d.nf_url ? `<div style="margin-top:4px;">
                          <button type="button" class="btn btn-outline btn-xs nf-icon-btn"
                            onclick="nfAbrirPorId('${d.id}')"
                            title="Visualizar NF / comprovante anexado">
                            <i class="fas fa-file-invoice"></i> Ver NF
                          </button>
                        </div>` : ''}
                      </td>
                      <td style="padding:8px 12px;">
                        <span class="badge badge-blue" style="font-size:.63rem;">${rub?.categoria || '-'}</span>
                        <div style="font-size:.68rem;color:var(--text-muted);margin-top:2px;">${(rub?.descricao || '').slice(0,25)}</div>
                      </td>
                      <td style="padding:8px 12px;">
                        <span class="badge ${d.fonte==='Repasse Federal'?'badge-blue':'badge-green'}" style="font-size:.63rem;">
                          ${d.fonte || '-'}
                        </span>
                      </td>
                      <td style="padding:8px 12px;text-align:right;font-weight:700;">${fmt.currency(d.valor)}</td>
                      <td style="padding:8px 12px;">${statusBadge(d.status_pagamento)}</td>
                      <td style="padding:8px 12px;">
                        <div class="flex gap-1">
                          <button class="btn btn-outline btn-xs btn-icon" onclick="editDespesa('${d.id}')" title="Editar">
                            <i class="fas fa-pencil"></i>
                          </button>
                          <button class="btn btn-danger btn-xs btn-icon" onclick="deleteDespesa('${d.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                          </button>
                          <button class="btn btn-outline btn-xs btn-icon" onclick="openModalDocPreFilled('${d.projeto_id}','','${d.id}')" title="Anexar Documento">
                            <i class="fas fa-paperclip"></i>
                          </button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                  <tr style="background:var(--gray-50);font-weight:700;border-top:2px solid var(--border);">
                    <td colspan="6" style="padding:7px 12px;text-align:right;font-size:.76rem;color:var(--gray-600);">
                      SUBTOTAL ${fmt.monthYear(mes)}
                    </td>
                    <td style="padding:7px 12px;text-align:right;">${fmt.currency(totalMes)}</td>
                    <td colspan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>`;
      });
  });

  tbody.innerHTML = html;
}

/* ── Toggle mês ── */
function toggleMesDetalhe(key) {
  const row  = document.getElementById(`detail-${key}`);
  const icon = document.getElementById(`icon-${key}`);
  if (!row) return;
  const open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  if (icon) icon.style.transform = open ? '' : 'rotate(90deg)';
  if (open) _finOpenMeses.delete(key);
  else      _finOpenMeses.add(key);
}

/* ════════════════════════════════════════════
   FILTROS
════════════════════════════════════════════ */
function filterDespesas() {
  const q      = (document.getElementById('fin-search')?.value     || '').toLowerCase();
  const projId = document.getElementById('fin-filter-projeto')?.value || '';
  const status = document.getElementById('fin-filter-status')?.value  || '';
  const mes    = document.getElementById('fin-filter-mes')?.value     || '';
  const fonte  = document.getElementById('fin-filter-fonte')?.value   || '';

  const filtered = despesasData.filter(d => {
    const mQ = !q      || [d.descricao,d.fornecedor,d.numero_documento,d.cnpj_cpf,d.observacao].some(f=>(f||'').toLowerCase().includes(q));
    const mP = !projId || d.projeto_id === projId;
    const mS = !status || d.status_pagamento === status;
    const mM = !mes    || d.mes_referencia === mes;
    const mF = !fonte  || d.fonte === fonte;
    return mQ && mP && mS && mM && mF;
  });

  renderDespesasTable(filtered);
}

/* ════════════════════════════════════════════
   MODAL DESPESA
════════════════════════════════════════════ */
function openModalDespesa(id = null) {
  despesaEditId = id;
  const modal = document.getElementById('modal-despesa');
  document.getElementById('modal-despesa-title').textContent = id ? 'Editar Lançamento' : 'Novo Lançamento';
  const f = document.getElementById('form-despesa');
  f.reset();
  nfResetUpload();

  if (id) {
    const d = despesasData.find(x => x.id===id);
    if (d) fillFormDespesa(d);
  } else {
    const rSel = document.getElementById('desp-rubrica');
    if (rSel) rSel.innerHTML = '<option value="">Selecione o Projeto primeiro</option>';
    const hoje = new Date().toISOString().slice(0,10);
    const dataEl = f.elements['data_despesa'];
    if (dataEl) dataEl.value = hoje;
    const mesEl = f.elements['mes_referencia'];
    if (mesEl) mesEl.value = hoje.slice(0,7);
    // Restaura rascunho salvo (se existir)
    if (typeof restoreFormDraft === 'function') restoreFormDraft('form-despesa');
  }

  modal.classList.add('open');
}

function closeModalDespesa() {
  document.getElementById('modal-despesa')?.classList.remove('open');
  despesaEditId = null;
}

function fillFormDespesa(d) {
  const f = document.getElementById('form-despesa');
  Object.keys(d).forEach(k => {
    const el = f.elements[k];
    if (el) el.value = d[k] ?? '';
  });
  updateRubricaSelect();
  setTimeout(() => {
    const rSel = f.elements['rubrica_id'];
    if (rSel) rSel.value = d.rubrica_id || '';
  }, 130);
  // Restaura NF se existir
  if (d.nf_url) nfRestaurarExistente(d.nf_url);
}

function editDespesa(id) { openModalDespesa(id); }

/* ════════════════════════════════════════════
   SALVAR DESPESA
════════════════════════════════════════════ */
async function saveDespesa() {
  const form = document.getElementById('form-despesa');
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.projeto_id)       { showToast('Selecione o projeto', 'error'); return; }
  if (!data.descricao?.trim()){ showToast('Descrição é obrigatória', 'error'); return; }
  if (!data.valor || isNaN(Number(data.valor))) { showToast('Valor inválido', 'error'); return; }
  if (Number(data.valor) <= 0){ showToast('Valor deve ser maior que zero', 'warning'); return; }
  data.valor = Number(data.valor);

  // Inclui o anexo NF (base64 ou vazio)
  const nfHidden = document.getElementById('nf-url-hidden');
  data.nf_url = nfHidden?.value || null;
  if (!data.nf_url) delete data.nf_url; // não envia campo vazio

  const btnSave = document.querySelector('#modal-despesa .btn-primary');
  if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  try {
    if (despesaEditId) {
      await DB.update('ong_despesas', despesaEditId, data);
      showToast('Lançamento atualizado!', 'success');
    } else {
      data.id = genId();
      await DB.insert('ong_despesas', data);
      showToast('Lançamento registrado!', 'success');
    }
    CACHE.clear();
    closeModalDespesa();
    if (typeof clearFormDraft === 'function') clearFormDraft('form-despesa');
    await loadFinanceiro();
  } catch(err) {
    showToast('Erro: ' + err.message, 'error');
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
  }
}

/* ════════════════════════════════════════════
   EXCLUIR DESPESA
════════════════════════════════════════════ */
async function deleteDespesa(id) {
  const confirmado = await confirmDialog('Excluir este lançamento permanentemente?', 'Excluir Lançamento', 'danger');
  if (!confirmado) return;
  try {
    await DB.delete('ong_despesas', id);
    showToast('Lançamento excluído.', 'success');
    CACHE.clear();
    await loadFinanceiro();
  } catch(err) {
    showToast('Erro: ' + err.message, 'error');
  }
}

/* ════════════════════════════════════════════
   EXPORTAR CSV
════════════════════════════════════════════ */
function exportarDespesasCSV() {
  if (!despesasData.length) { showToast('Nenhum lançamento para exportar', 'warning'); return; }

  const headers = ['Projeto','Data','Mês Ref.','Descrição','Fornecedor','CNPJ/CPF','Nº Doc','Tipo Doc','Valor','Fonte','Status'];
  let csv = '\uFEFF' + headers.join(';') + '\n';

  despesasData.forEach(d => {
    const proj = projetosFinData.find(p => p.id===d.projeto_id);
    csv += [
      proj?.nome_projeto || '', d.data_despesa, d.mes_referencia, d.descricao, d.fornecedor,
      d.cnpj_cpf, d.numero_documento, d.tipo_documento, d.valor, d.fonte, d.status_pagamento
    ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(';') + '\n';
  });

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), {
    href: url,
    download: `despesas_${new Date().toISOString().slice(0,10)}.csv`
  }).click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso!', 'success');
}

/* ════════════════════════════════════════════
   EXPORTAR EXCEL COMPLETO (.xlsx multi-abas)
   Requer SheetJS (CDN no index.html)
════════════════════════════════════════════ */
async function exportarTudoExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca Excel não carregada. Recarregue a página.', 'error'); return;
  }
  showToast('Gerando Excel...', 'info');
  try {
    const projetos  = CACHE.projetos   || await DB.getAll('ong_projetos');
    const despesas  = CACHE.despesas   || await DB.getAll('ong_despesas');
    const rubricas  = CACHE.rubricas   || await DB.getAll('ong_rubricas');
    const metas     = CACHE.metas      || await DB.getAll('ong_metas');

    const wb = XLSX.utils.book_new();

    // Aba 1 — Projetos
    const projRows = projetos.map(p => ({
      'Nº Proposta':    p.numero_proposta || '',
      'Nome':           p.nome_projeto || '',
      'Concedente':     p.concedente || '',
      'Modalidade':     p.modalidade || '',
      'Status':         p.status || '',
      'Repasse (R$)':   Number(p.valor_repasse) || 0,
      'Contrapartida':  Number(p.valor_contrapartida) || 0,
      'Início':         p.data_inicio || '',
      'Fim':            p.data_fim || '',
      'Beneficiários':  p.publico_beneficiario || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projRows), 'Projetos');

    // Aba 2 — Rubricas
    const rubRows = rubricas.map(r => {
      const proj = projetos.find(p => p.id === r.projeto_id);
      const exec = despesas.filter(d => d.rubrica_id === r.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
      return {
        'Projeto':        proj?.numero_proposta || '',
        'Categoria':      r.categoria || '',
        'Descrição':      r.descricao || '',
        'Qtd':            Number(r.quantidade) || 0,
        'Unidade':        r.unidade || '',
        'Vlr Unitário':   Number(r.valor_unitario) || 0,
        'Previsto (R$)':  Number(r.valor_previsto) || 0,
        'Executado (R$)': exec,
        'Saldo (R$)':     (Number(r.valor_previsto)||0) - exec,
        'Fonte':          r.fonte || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rubRows), 'Rubricas');

    // Aba 3 — Despesas
    const despRows = despesas.map(d => {
      const proj = projetos.find(p => p.id === d.projeto_id);
      const rub  = rubricas.find(r => r.id === d.rubrica_id);
      return {
        'Projeto':      proj?.numero_proposta || '',
        'Data':         d.data_despesa || '',
        'Mês Ref.':     d.mes_referencia || '',
        'Descrição':    d.descricao || '',
        'Fornecedor':   d.fornecedor || '',
        'CNPJ/CPF':     d.cnpj_cpf || '',
        'Tipo Doc':     d.tipo_documento || '',
        'Nº Doc':       d.numero_documento || '',
        'Rubrica':      rub ? `${rub.categoria} — ${rub.descricao}` : '',
        'Valor (R$)':   Number(d.valor) || 0,
        'Fonte':        d.fonte || '',
        'Status Pag.':  d.status_pagamento || '',
        'Observação':   d.observacao || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despRows), 'Despesas');

    // Aba 4 — Metas (com execução financeira calculada dinamicamente das despesas)
    const metaRows = metas.map(m => {
      const proj = projetos.find(p => p.id === m.projeto_id);
      // Cálculo proporcional: share do valor_previsto da meta vs total rubricas do projeto
      const rubsProjeto    = rubricas.filter(r => r.projeto_id === m.projeto_id);
      const totalPrevRubs  = rubsProjeto.reduce((s, r) => s + (Number(r.valor_previsto) || 0), 0);
      const totalDespProj  = despesas
        .filter(d => d.projeto_id === m.projeto_id || rubsProjeto.some(r => r.id === d.rubrica_id))
        .reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const metasProjeto   = metas.filter(x => x.projeto_id === m.projeto_id);
      const execMeta = totalPrevRubs > 0
        ? totalDespProj * ((Number(m.valor_previsto) || 0) / totalPrevRubs)
        : (metasProjeto.length > 0 ? totalDespProj / metasProjeto.length : 0);
      return {
        'Projeto':          proj?.numero_proposta || '',
        'Nº Meta':          m.numero_meta || '',
        'Descrição':        m.descricao_meta || '',
        'Indicador':        m.indicador || '',
        'Benef. Prev.':     Number(m.beneficiarios_previstos) || 0,
        'Benef. Atend.':    Number(m.beneficiarios_atendidos) || 0,
        'Exec. Física (%)': Number(m.percentual_fisico) || 0,
        'Vlr Previsto':     Number(m.valor_previsto) || 0,
        'Vlr Executado':    Math.round(execMeta * 100) / 100,
        'Início':           m.data_inicio || '',
        'Fim':              m.data_fim || '',
        'Status':           m.status || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), 'Metas');

    XLSX.writeFile(wb, `ONG_Gestor_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Excel exportado com sucesso! 4 abas geradas.', 'success');
  } catch(err) {
    showToast('Erro ao exportar Excel: ' + err.message, 'error');
    console.error(err);
  }
}

/* ════════════════════════════════════════════
   UPLOAD DE NF / COMPROVANTE
   FileReader → base64 → campo nf_url (TEXT no Supabase)
════════════════════════════════════════════ */

const NF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function nfResetUpload() {
  const hidden = document.getElementById('nf-url-hidden');
  if (hidden) hidden.value = '';
  const dropArea = document.getElementById('nf-drop-area');
  if (dropArea) dropArea.classList.remove('has-file', 'drag-over');
  const placeholder = document.getElementById('nf-drop-placeholder');
  if (placeholder) placeholder.style.display = '';
  const preview = document.getElementById('nf-preview-area');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  const removeBtn = document.getElementById('nf-remove-btn');
  if (removeBtn) removeBtn.style.display = 'none';
  const fileInput = document.getElementById('nf-file-input');
  if (fileInput) fileInput.value = '';
}

function nfRemoveAnexo() {
  nfResetUpload();
  showToast('Anexo removido', 'info');
}

function nfFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > NF_MAX_BYTES) {
    showToast('Arquivo muito grande (máx. 5 MB)', 'error');
    input.value = '';
    return;
  }
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.type)) {
    showToast('Formato inválido. Use PDF, JPG ou PNG.', 'error');
    input.value = '';
    return;
  }
  _nfLerArquivo(file);
}

function nfDragOver(e) {
  e.preventDefault();
  const da = document.getElementById('nf-drop-area');
  if (da) da.classList.add('drag-over');
}

function nfDragLeave(e) {
  const da = document.getElementById('nf-drop-area');
  if (da) da.classList.remove('drag-over');
}

function nfDrop(e) {
  e.preventDefault();
  const da = document.getElementById('nf-drop-area');
  if (da) da.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  // Valida tamanho e tipo
  if (file.size > NF_MAX_BYTES) { showToast('Arquivo muito grande (máx. 5 MB)', 'error'); return; }
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.type)) { showToast('Formato inválido. Use PDF, JPG ou PNG.', 'error'); return; }
  _nfLerArquivo(file);
}

function _nfLerArquivo(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result; // "data:application/pdf;base64,..."
    // Salva no campo oculto
    const hidden = document.getElementById('nf-url-hidden');
    if (hidden) hidden.value = base64;
    // Atualiza visual
    _nfMostrarPreview(base64, file.type, file.name);
    showToast('Arquivo anexado com sucesso!', 'success');
  };
  reader.onerror = () => showToast('Erro ao ler o arquivo', 'error');
  reader.readAsDataURL(file);
}

function _nfMostrarPreview(dataUrl, mimeType, nome) {
  const placeholder = document.getElementById('nf-drop-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  const preview = document.getElementById('nf-preview-area');
  if (!preview) return;
  preview.style.display = '';

  if (mimeType.startsWith('image/')) {
    preview.innerHTML = `
      <img src="${dataUrl}" class="nf-preview-img" alt="Preview NF">
      <p style="font-size:.73rem;color:var(--text-muted);margin-top:6px;">${nome}</p>`;
  } else {
    preview.innerHTML = `
      <div class="nf-preview-pdf">
        <i class="fas fa-file-pdf"></i>
        <div>
          <div style="font-size:.82rem;font-weight:700;">${nome}</div>
          <div style="font-size:.71rem;color:var(--text-muted);">PDF pronto para salvar</div>
        </div>
      </div>`;
  }

  const da = document.getElementById('nf-drop-area');
  if (da) da.classList.add('has-file');
  const removeBtn = document.getElementById('nf-remove-btn');
  if (removeBtn) removeBtn.style.display = '';
}

/* Ao editar despesa com NF existente */
function nfRestaurarExistente(dataUrl) {
  if (!dataUrl) return;
  const hidden = document.getElementById('nf-url-hidden');
  if (hidden) hidden.value = dataUrl;
  // Descobre tipo pelo prefixo da data URL
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  const mimeType  = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const nome      = mimeType.startsWith('image/') ? 'imagem-anexada' : 'documento.pdf';
  _nfMostrarPreview(dataUrl, mimeType, nome);
}

/* Abre o anexo de uma despesa pelo ID (evita colocar base64 gigante no DOM) */
function nfAbrirPorId(despesaId) {
  const d = despesasData.find(x => x.id === despesaId);
  if (!d?.nf_url) { showToast('Nenhum anexo encontrado', 'warning'); return; }
  nfAbrirAnexo(d.nf_url);
}

/* Abre o anexo em nova aba */
function nfAbrirAnexo(dataUrl) {
  if (!dataUrl) return;
  const w = window.open();
  if (w) {
    if (dataUrl.startsWith('data:image/')) {
      w.document.write(`<html><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;">
        <img src="${dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>`);
    } else {
      w.document.write(`<html><body style="margin:0;height:100vh;">
        <embed src="${dataUrl}" type="application/pdf" width="100%" height="100%"></body></html>`);
    }
  }
}

/* ════════════════════════════════════════════
   ATALHO: abrir modal de despesa pré-preenchido
   com rubrica e projeto (chamado de rubricas.js)
════════════════════════════════════════════ */
function openModalDespesaRubrica(rubricaId, projId, mesRef = null) {
  openModalDespesa(null);

  setTimeout(() => {
    const f = document.getElementById('form-despesa');
    if (!f) return;

    const projSel = document.getElementById('desp-projeto');
    if (projSel && projId) {
      projSel.value = projId;
      updateRubricaSelect();
    }

    setTimeout(() => {
      const rubSel = document.getElementById('desp-rubrica');
      if (rubSel && rubricaId) rubSel.value = rubricaId;
    }, 80);

    if (mesRef && f.elements['mes_referencia']) f.elements['mes_referencia'].value = mesRef;

    const rub = (rubricasData || []).find(r => r.id === rubricaId)
             || (typeof rubricasPageData !== 'undefined' ? rubricasPageData : []).find(r => r.id === rubricaId);
    if (rub && f.elements['descricao'] && !f.elements['descricao'].value) {
      f.elements['descricao'].value = rub.descricao || '';
    }
  }, 80);
}

/* ════════════════════════════════════════════
   PRÉ-LANÇAMENTOS AUTOMÁTICOS
   Gera rascunhos baseados no cronograma da rubrica.
   O usuário completa fornecedor, NF e confirma pagamento.
════════════════════════════════════════════ */
async function gerarPreLancamentosRubrica(rubricaId, projId) {
  const rub = (rubricasData || []).find(r => r.id === rubricaId)
           || (typeof rubricasPageData !== 'undefined' ? rubricasPageData : []).find(r => r.id === rubricaId);
  if (!rub) { showToast('Rubrica não encontrada', 'error'); return; }

  await loadFinanceiro(); // garante dados atualizados
  const cronos = (CACHE.cronograma || []).filter(c => c.rubrica_id === rubricaId);
  const deps   = (CACHE.despesas   || []).filter(d => d.rubrica_id === rubricaId);

  if (!cronos.length) {
    showToast('Defina o cronograma mensal desta rubrica antes de gerar pré-lançamentos.', 'warning');
    return;
  }

  const mesesPendentes = cronos.filter(c => {
    const jaTem = deps.some(d => d.mes_referencia === c.mes);
    return Number(c.valor_previsto) > 0 && !jaTem;
  });

  if (!mesesPendentes.length) {
    showToast('Todos os meses do cronograma já possuem lançamentos! ✅', 'success');
    return;
  }

  const lista = mesesPendentes.map(c => `• ${fmt.monthYear(c.mes)}: ${fmt.currency(c.valor_previsto)}`).join('\n');
  const confirmado = await confirmDialog(
    `Criar ${mesesPendentes.length} pré-lançamento(s) rascunho com status "A Pagar"?\n\n${lista}\n\nEdite cada um com os dados reais da NF/Recibo após criação.`,
    'Gerar Pré-lançamentos', 'primary'
  );
  if (!confirmado) return;

  try {
    const hoje = new Date().toISOString().slice(0, 10);
    for (const c of mesesPendentes) {
      await DB.insert('ong_despesas', {
        id:               genId(),
        projeto_id:       projId,
        rubrica_id:       rubricaId,
        descricao:        `[PRÉ] ${rub.descricao || rub.categoria}`,
        tipo_documento:   rub.categoria === 'Recursos Humanos' ? 'Recibo' : 'NF-e',
        numero_documento: '',
        data_despesa:     hoje,
        mes_referencia:   c.mes,
        valor:            Number(c.valor_previsto),
        fonte:            rub.fonte || 'Repasse Federal',
        status_pagamento: 'A Pagar',
        observacao:       'Pré-lançamento automático — complete os dados da NF/Recibo.'
      });
    }
    CACHE.clear();
    showToast(`${mesesPendentes.length} pré-lançamento(s) criado(s)! Edite cada um com os dados reais.`, 'success');
    await loadFinanceiro();
    if (typeof switchFinTab === 'function') switchFinTab('lancamentos');
  } catch(err) {
    showToast('Erro: ' + err.message, 'error');
  }
}

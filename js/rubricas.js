/* =============================================
   ONG GESTOR v3 — Rubricas + Cronograma Mês a Mês
   ============================================= */

let rubricasPageData = [];
let projetosRubData  = [];
let rubricaEditId    = null;
let _rubCurrentProj  = null;
const _rubOpenRows   = new Set(); // IDs abertos

/* ── Gera array de meses "YYYY-MM" entre duas datas ── */
function getMonthsArray(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return [];
  const start = new Date(dataInicio + '-01');
  const end   = new Date(dataFim   + '-01');
  const months = [];
  const cur = new Date(start);
  while (cur <= end && months.length < 48) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);
    cur.setMonth(cur.getMonth()+1);
  }
  return months;
}

/* ── Extrai meses únicos de um array de despesas (fallback) ── */
function getMonthsFromDespesas(deps) {
  const set = new Set();
  deps.forEach(d => { if (d.mes_referencia) set.add(d.mes_referencia); });
  return [...set].sort();
}

/* ════════════════════════════════════════════
   CARGA PRINCIPAL
════════════════════════════════════════════ */
async function loadRubricas() {
  try {
    const [pR, rR, dR, cR] = await Promise.all([
      DB.getAll('ong_projetos'),
      DB.getAll('ong_rubricas'),
      DB.getAll('ong_despesas'),
      DB.getAll('ong_cronograma')
    ]);
    projetosRubData  = pR || [];
    rubricasPageData = rR || [];
    CACHE.projetos   = projetosRubData;
    CACHE.rubricas   = rubricasPageData;
    CACHE.despesas   = dR || [];
    CACHE.cronograma = cR || [];

    populateProjetoSelectRub('rub-filter-projeto');
    populateProjetoSelectRub('rub-projeto-sel');
    populateCategoriaFilter();
    renderRubricasTable(rubricasPageData);
  } catch(err) {
    showToast('Erro ao carregar rubricas: ' + err.message, 'error');
    console.error(err);
  }
}

function populateProjetoSelectRub(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const isFilter = id.includes('filter');
  sel.innerHTML = isFilter
    ? '<option value="">Todos os Projetos</option>'
    : '<option value="">Selecione o Projeto</option>';
  projetosRubData.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta||p.id} — ${(p.nome_projeto||'').slice(0,40)}`;
    sel.appendChild(o);
  });
}

function populateCategoriaFilter() {
  const sel = document.getElementById('rub-filter-categoria');
  if (!sel) return;
  // already has static options, skip
}

/* ════════════════════════════════════════════
   TABELA PRINCIPAL DE RUBRICAS
════════════════════════════════════════════ */
function renderRubricasTable(rubricas) {
  const deps  = CACHE.despesas   || [];
  const tbody = document.getElementById('rubricas-tbody');
  if (!tbody) return;

  if (!rubricas.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-list-check"></i><p>Nenhuma rubrica cadastrada</p></div></td></tr>`;
    return;
  }

  /* Agrupa por projeto */
  const byProj = {};
  rubricas.forEach(r => {
    if (!byProj[r.projeto_id]) byProj[r.projeto_id] = [];
    byProj[r.projeto_id].push(r);
  });

  let html = '';
  Object.entries(byProj).forEach(([projId, rubList]) => {
    const proj      = projetosRubData.find(p => p.id===projId);
    const totalPrev = rubList.reduce((s,r) => s+(Number(r.valor_previsto)||0), 0);
    const totalExec = deps.filter(d => d.projeto_id===projId).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const perc      = calcPercent(totalExec, totalPrev);

    /* Cabeçalho do grupo */
    html += `<tr style="background:#edf2ff;">
      <td colspan="10">
        <div class="flex justify-between items-center" style="padding:3px 0;">
          <div>
            <span class="font-semibold" style="font-size:.84rem;color:#1e40af;">
              <i class="fas fa-folder text-primary"></i>&nbsp;${proj?.nome_projeto||projId}
            </span>
            <span class="text-xs text-muted ml-1">${proj?.numero_proposta||''}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">
              Total: <strong>${fmt.currency(totalPrev)}</strong> | 
              Exec: <strong>${fmt.currency(totalExec)}</strong> (${fmt.percent(perc)})
            </span>
            <button class="btn btn-primary btn-xs" onclick="openCronograma('${projId}')">
              <i class="fas fa-calendar-alt"></i> Cronograma Completo
            </button>
          </div>
        </div>
      </td>
    </tr>`;

    rubList.forEach(r => {
      const exec  = deps.filter(d => d.rubrica_id===r.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
      const perc  = calcPercent(exec, r.valor_previsto);
      const saldo = (Number(r.valor_previsto)||0) - exec;
      const ndeps = deps.filter(d => d.rubrica_id===r.id).length;
      const isOpen= _rubOpenRows.has(r.id);

      html += `
      <tr class="tr-expandable" onclick="toggleRubricaDetalhe('${r.id}')">
        <td style="padding-left:28px;">
          <div class="flex items-center gap-1">
            <i class="fas fa-chevron-right text-xs text-muted" id="icon-rub-${r.id}" style="transition:.2s;${isOpen?'transform:rotate(90deg);':''}"></i>
            <div>
              <span class="font-semibold" style="font-size:.83rem;">${r.descricao}</span>
              <div class="text-xs text-muted">${fmt.number(r.quantidade)} ${r.unidade||''} × ${fmt.currency(r.valor_unitario)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-blue">${r.categoria}</span></td>
        <td class="text-center text-xs">${fmt.number(r.quantidade)} ${r.unidade||''}</td>
        <td class="text-right">${fmt.currency(r.valor_unitario)}</td>
        <td class="text-right font-semibold">${fmt.currency(r.valor_previsto)}</td>
        <td class="text-right">${fmt.currency(exec)}</td>
        <td class="text-right ${saldo<0?'text-danger':'text-success'}">${fmt.currency(saldo)}</td>
        <td style="min-width:90px;">${progressBar(perc)}</td>
        <td class="text-center">
          <span class="badge ${ndeps>0?'badge-blue':'badge-gray'}">${ndeps} lanç.</span>
        </td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-outline btn-xs btn-icon" onclick="event.stopPropagation();editRubrica('${r.id}')" title="Editar">
              <i class="fas fa-pencil"></i>
            </button>
            <button class="btn btn-danger btn-xs btn-icon" onclick="event.stopPropagation();deleteRubrica('${r.id}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
      <tr class="tr-detail" id="detail-rub-${r.id}" style="display:${isOpen?'':'none'};">
        <td colspan="10" style="padding:0;">
          <div class="tr-detail-inner" id="detail-content-${r.id}">
            ${isOpen ? '<div class="loading-spinner"><i class="fas fa-spinner"></i></div>' : ''}
          </div>
        </td>
      </tr>`;
    });
  });

  tbody.innerHTML = html;

  // Re-renderiza linhas que estavam abertas
  _rubOpenRows.forEach(rubId => {
    const content = document.getElementById(`detail-content-${rubId}`);
    if (content) renderRubricaDetalhe(rubId, content);
  });
}

/* ════════════════════════════════════════════
   TOGGLE EXPANSÃO
════════════════════════════════════════════ */
async function toggleRubricaDetalhe(rubId) {
  const row  = document.getElementById(`detail-rub-${rubId}`);
  const icon = document.getElementById(`icon-rub-${rubId}`);
  if (!row) return;

  const isOpen = row.style.display !== 'none';

  if (isOpen) {
    row.style.display = 'none';
    if (icon) icon.style.transform = '';
    _rubOpenRows.delete(rubId);
    return;
  }

  row.style.display = '';
  if (icon) icon.style.transform = 'rotate(90deg)';
  _rubOpenRows.add(rubId);

  const content = document.getElementById(`detail-content-${rubId}`);
  if (content) {
    content.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando...</div>';
    await renderRubricaDetalhe(rubId, content);
  }
}

/* ════════════════════════════════════════════
   DETALHE DE RUBRICA — Cronograma Mês a Mês
════════════════════════════════════════════ */
async function renderRubricaDetalhe(rubId, container) {
  const deps = (CACHE.despesas||[]).filter(d => d.rubrica_id===rubId);
  const rub  = rubricasPageData.find(r => r.id===rubId);
  const crno = (CACHE.cronograma||[]).filter(c => c.rubrica_id===rubId);

  if (!rub) {
    container.innerHTML = '<p class="text-muted text-xs" style="padding:12px;">Rubrica não encontrada.</p>';
    return;
  }

  const proj    = projetosRubData.find(p => p.id===rub.projeto_id);
  const months  = proj ? getMonthsArray(
    proj.data_inicio?.slice(0,7),
    proj.data_fim?.slice(0,7)
  ) : getMonthsFromDespesas(deps); // fallback: usa meses das despesas existentes

  /* Adiciona meses das despesas que podem estar fora do range original */
  const extraMonths = deps
    .map(d => d.mes_referencia)
    .filter(m => m && !months.includes(m));
  const allMonths = [...new Set([...months, ...extraMonths])].sort();

  /* Mapa mês → previsto do cronograma */
  const crnoMap = {};
  crno.forEach(c => { crnoMap[c.mes] = Number(c.valor_previsto)||0; });

  /* Mapa mês → executado das despesas */
  const execMap = {};
  deps.forEach(d => {
    const m = d.mes_referencia||'';
    if (m) execMap[m] = (execMap[m]||0) + (Number(d.valor)||0);
  });

  const totalPrev = Number(rub.valor_previsto)||0;
  const totalExec = deps.reduce((s,d) => s+(Number(d.valor)||0), 0);

  let html = `
  <div style="padding:14px 18px;">
    <!-- Resumo da rubrica -->
    <div class="grid-2 mb-2" style="gap:14px;">
      <div>
        <div class="text-xs text-muted mb-1">Categoria / Especificação</div>
        <div class="font-semibold" style="font-size:.84rem;">${rub.categoria} — ${rub.quantidade} ${rub.unidade||''} × ${fmt.currency(rub.valor_unitario)}</div>
        <div class="text-xs text-muted mt-1">Fonte: ${rub.fonte||'Repasse Federal'}</div>
      </div>
      <div>
        <div class="text-xs text-muted mb-1">Execução</div>
        <div class="flex items-center gap-2">
          <span class="font-semibold text-success">${fmt.currency(totalExec)}</span>
          <span class="text-muted text-xs">de</span>
          <span class="font-semibold">${fmt.currency(totalPrev)}</span>
          <span class="badge ${totalExec<=totalPrev?'badge-green':'badge-red'}">${fmt.percent(calcPercent(totalExec,totalPrev))}</span>
        </div>
        <div class="progress-bar-wrap mt-1" style="height:6px;">
          <div class="progress-bar-fill ${progressColor(calcPercent(totalExec,totalPrev))}" style="width:${Math.min(calcPercent(totalExec,totalPrev),100)}%"></div>
        </div>
      </div>
    </div>`;

  /* ── CRONOGRAMA MÊS A MÊS ── */
  if (allMonths.length > 0) {
    const totalCrno = allMonths.reduce((s,m) => s+(crnoMap[m]||0), 0);
    const mesAtual  = new Date().toISOString().slice(0,7);

    html += `
    <div style="margin-bottom:16px;">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-semibold" style="color:#1e40af;text-transform:uppercase;letter-spacing:.04em;">
          <i class="fas fa-calendar-alt"></i> Cronograma Mês a Mês — ${allMonths.length} meses
          ${proj ? `<span class="text-xs text-muted" style="font-weight:400;text-transform:none;margin-left:6px;">(${fmt.date(proj.data_inicio)} → ${fmt.date(proj.data_fim)})</span>` : ''}
        </span>
        <div class="flex gap-1">
          <button class="btn btn-xs btn-outline" title="Distribuir valor uniformemente entre todos os meses" onclick="preencherCronoUniforme('${rubId}','${allMonths.join(',')}')">
            <i class="fas fa-equals"></i> Uniforme
          </button>
          <button class="btn btn-xs" style="background:#f0f9ff;border:1px solid #bae6fd;color:#0284c7;" title="Distribuir considerando valor_unitario × quantidade por mês" onclick="abrirModalDistribuicao('${rubId}','${allMonths.join(',')}')">
            <i class="fas fa-sliders-h"></i> Inteligente
          </button>
          <button class="btn btn-primary btn-xs" onclick="saveCronogramaRubrica('${rubId}')">
            <i class="fas fa-save"></i> Salvar
          </button>
        </div>
      </div>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;">
        <table style="min-width:${120+allMonths.length*92}px;font-size:.78rem;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="min-width:110px;padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;"></th>
              ${allMonths.map(m=>{
                const isCurrent = m === mesAtual;
                return `<th style="min-width:92px;padding:8px 4px;text-align:center;border-bottom:1px solid #e2e8f0;font-size:.72rem;${isCurrent?'background:#dbeafe;color:#1e40af;font-weight:700;':''}">
                  ${fmt.monthYear(m)}${isCurrent?' <i class="fas fa-circle" style="font-size:.45rem;color:#2563eb;vertical-align:middle;"></i>':''}
                </th>`;
              }).join('')}
              <th style="min-width:95px;padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <!-- Linha Previsto (editável) -->
            <tr style="background:#fff;">
              <td style="padding:7px 10px;font-weight:600;font-size:.72rem;color:#1e40af;white-space:nowrap;">
                <i class="fas fa-calendar text-primary"></i> Previsto (R$)
              </td>
              ${allMonths.map(m=>{
                const isCurrent = m === mesAtual;
                return `
              <td style="padding:4px 3px;text-align:center;${isCurrent?'background:#eff6ff;':''}">
                <input type="number" class="crono-month-input" 
                  id="crono-${rubId}-${m}" 
                  value="${crnoMap[m]||''}" 
                  placeholder="0"
                  min="0" step="0.01"
                  onchange="updateCronoTotal('${rubId}','${allMonths.join(',')}')"
                  title="${fmt.monthYear(m)} — Previsto">
              </td>`;}).join('')}
              <td style="padding:7px 10px;text-align:right;font-weight:700;" id="crono-total-${rubId}">
                ${fmt.currency(totalCrno)}
              </td>
            </tr>
            <!-- Linha Executado (read-only, dinâmico das despesas) -->
            <tr style="background:#ecfdf5;">
              <td style="padding:7px 10px;font-weight:600;font-size:.72rem;color:#065f46;white-space:nowrap;">
                <i class="fas fa-check-circle" style="color:#0e9f6e;"></i> Executado (R$)
              </td>
              ${allMonths.map(m=>{
                const v=execMap[m]||0;
                const isCurrent = m === mesAtual;
                return `<td style="padding:7px 3px;text-align:center;font-size:.74rem;color:${v>0?'#065f46':'#9ca3af'};${isCurrent?'background:#d1fae5;':''}">
                  ${v>0?`<strong>${fmt.currency(v)}</strong>`:'-'}
                </td>`;
              }).join('')}
              <td style="padding:7px 10px;text-align:right;font-weight:700;color:#065f46;">
                ${fmt.currency(totalExec)}
              </td>
            </tr>
            <!-- Linha Saldo -->
            <tr style="background:#fafafa;">
              <td style="padding:7px 10px;font-weight:600;font-size:.72rem;color:#6b7280;white-space:nowrap;">
                <i class="fas fa-balance-scale" style="color:#6b7280;"></i> Saldo
              </td>
              ${allMonths.map(m=>{
                const prev=crnoMap[m]||0;
                const exec=execMap[m]||0;
                const saldo=prev-exec;
                const hasData=prev>0||exec>0;
                const isCurrent = m === mesAtual;
                return `<td style="padding:7px 3px;text-align:center;font-size:.72rem;color:${saldo<0?'#e02424':'#374151'};${isCurrent?'background:#f9fafb;':''}" title="${hasData?`Prev: ${fmt.currency(prev)} | Exec: ${fmt.currency(exec)}`:''}">
                  ${hasData?fmt.currency(saldo):'-'}
                </td>`;
              }).join('')}
              <td style="padding:7px 10px;text-align:right;font-size:.78rem;font-weight:600;color:${(totalPrev-totalExec)<0?'var(--danger)':'var(--text-medium)'};">
                ${fmt.currency(totalPrev-totalExec)}
              </td>
            </tr>
            <!-- Linha % Execução -->
            <tr style="background:#f0f9ff;">
              <td style="padding:7px 10px;font-weight:600;font-size:.72rem;color:#0284c7;white-space:nowrap;">
                <i class="fas fa-percentage" style="color:#0284c7;"></i> % Execução
              </td>
              ${allMonths.map(m=>{
                const prev=crnoMap[m]||0;
                const exec=execMap[m]||0;
                const p=prev>0?Math.round(exec/prev*100):0;
                const isCurrent = m === mesAtual;
                // Se há execução mas SEM previsto: mostra ⚠ (não mostra valor monetário)
                let cellContent;
                if (prev>0) {
                  cellContent = `<span style="font-weight:600;">${p}%</span>`;
                } else if (exec>0) {
                  cellContent = `<span title="Sem previsto cadastrado neste mês — execute 'Distribuir' para definir" style="color:#d97706;cursor:help;">⚠ s/prev</span>`;
                } else {
                  cellContent = `<span style="color:#d1d5db;">—</span>`;
                }
                return `<td style="padding:7px 3px;text-align:center;font-size:.7rem;color:${p>=100?'#0e9f6e':p>0?'#d97706':'#9ca3af'};${isCurrent?'background:#e0f2fe;':''}">
                  ${cellContent}
                </td>`;
              }).join('')}
              <td style="padding:7px 10px;text-align:right;font-size:.75rem;font-weight:600;color:${calcPercent(totalExec,totalPrev)>=80?'#0e9f6e':'#6b7280'};">
                ${fmt.percent(calcPercent(totalExec,totalPrev))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }

  /* ── LANÇAMENTOS AGRUPADOS POR MÊS ── */
  html += `
  <div>
    <div class="flex justify-between items-center mb-2">
      <span class="text-xs font-semibold" style="color:#374151;text-transform:uppercase;letter-spacing:.04em;">
        <i class="fas fa-receipt"></i> Lançamentos / Documentos Fiscais 
        <span class="badge badge-gray" style="margin-left:4px;">${deps.length} total</span>
      </span>
      <div class="flex gap-1">
        <button class="btn btn-outline btn-xs" title="Gerar pré-lançamentos rascunho a partir do cronograma para meses sem registro" onclick="gerarPreLancamentosRubrica('${rubId}','${rub.projeto_id}')">
          <i class="fas fa-magic"></i> Pré-lançamentos
        </button>
        <button class="btn btn-primary btn-xs" onclick="openModalDespesaRubrica('${rubId}','${rub.projeto_id}')">
          <i class="fas fa-plus"></i> Novo Lançamento
        </button>
      </div>
    </div>`;

  if (!deps.length) {
    html += `<div class="text-xs text-muted" style="padding:10px 0;text-align:center;">
      <i class="fas fa-receipt" style="opacity:.3;font-size:1.5rem;display:block;margin-bottom:6px;"></i>
      Nenhum lançamento registrado para esta rubrica.<br>
      <em>Atenção: 1 rubrica pode ter N documentos fiscais em diferentes meses.</em>
    </div>`;
  } else {
    /* Agrupa por mês */
    const byMes = {};
    deps.forEach(d => {
      const m = d.mes_referencia||'S/D';
      if (!byMes[m]) byMes[m] = [];
      byMes[m].push(d);
    });

    html += Object.entries(byMes)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([mes, itens]) => {
        const subtotal = itens.reduce((s,d) => s+(Number(d.valor)||0), 0);
        const previsto = crnoMap[mes]||0;
        const mesKey   = `rubmes-${rubId}-${mes}`.replace(/[^a-z0-9-]/gi,'');

        return `
        <div style="margin-bottom:8px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div class="flex justify-between items-center" 
               style="background:#f8fafc;padding:7px 12px;cursor:pointer;user-select:none;"
               onclick="toggleRubMesDetalhe('${mesKey}')">
            <div class="flex items-center gap-2">
              <i class="fas fa-chevron-right text-xs text-muted" id="icon-rubmes-${mesKey}" style="transition:.2s;"></i>
              <span class="font-semibold text-sm">${fmt.monthYear(mes)}</span>
              <span class="badge badge-gray">${itens.length} doc.</span>
              ${previsto>0?`<span class="text-xs text-muted">Previsto: ${fmt.currency(previsto)}</span>`:''}
            </div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm text-success">${fmt.currency(subtotal)}</span>
              ${previsto>0?`<span class="badge ${subtotal>previsto?'badge-red':'badge-green'}" style="font-size:.65rem;">${fmt.percent(calcPercent(subtotal,previsto))}</span>`:''}
            </div>
          </div>
          <div id="detail-rubmes-${mesKey}" style="display:none;">
            ${itens.map((d,idx) => `
            <div class="desp-item-row" style="${idx===0?'':'border-top:1px solid #f1f5f9;'}">
              <div style="flex:1;min-width:0;">
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge badge-purple" style="font-size:.68rem;">
                    <i class="fas fa-file-alt"></i> ${d.tipo_documento||'Doc'} ${d.numero_documento||''}
                  </span>
                  <span class="text-xs text-muted">${fmt.date(d.data_despesa)}</span>
                  <span class="badge ${d.fonte==='Repasse Federal'?'badge-blue':'badge-green'}" style="font-size:.65rem;">${d.fonte||'-'}</span>
                  ${statusBadge(d.status_pagamento)}
                </div>
                <div class="font-semibold" style="font-size:.82rem;">${d.descricao||'-'}</div>
                <div class="text-xs text-muted">${d.fornecedor||''}${d.cnpj_cpf?' · CNPJ/CPF: '+d.cnpj_cpf:''}</div>
                ${d.observacao?`<div class="text-xs" style="color:#6b7280;margin-top:3px;font-style:italic;">${d.observacao}</div>`:''}
              </div>
              <div class="text-right flex-shrink-0" style="min-width:100px;">
                <div class="font-semibold text-success" style="font-size:.9rem;">${fmt.currency(d.valor)}</div>
                <div class="flex gap-1 mt-1 justify-end">
                  <button class="btn btn-outline btn-xs btn-icon" onclick="editDespesa('${d.id}')" title="Editar">
                    <i class="fas fa-pencil"></i>
                  </button>
                  <button class="btn btn-danger btn-xs btn-icon" onclick="deleteDespesa('${d.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                  </button>
                  <button class="btn btn-outline btn-xs btn-icon" onclick="openModalDocPreFilled('${rub.projeto_id}','','${d.id}')" title="Anexar Documento">
                    <i class="fas fa-paperclip"></i>
                  </button>
                </div>
              </div>
            </div>`).join('')}
          </div>
        </div>`;
      }).join('');
  }

  html += `</div></div>`; // fecha lançamentos + container externo

  // ── Mini-panel de documentos desta rubrica ──
  html += `
  <div style="margin-top:10px;padding:0 0 4px;">
    <div class="flex justify-between items-center mb-1">
      <span class="text-xs font-semibold" style="color:#374151;text-transform:uppercase;letter-spacing:.04em;">
        <i class="fas fa-paperclip"></i> Documentos Vinculados
      </span>
      <button class="btn btn-xs btn-outline" onclick="openModalDocPreFilled('${rub.projeto_id}','${rubId}','')">
        <i class="fas fa-plus"></i> Anexar
      </button>
    </div>
    <div id="doc-mini-rub-${rubId}">
      <div class="loading-spinner" style="padding:6px;"><i class="fas fa-spinner"></i></div>
    </div>
  </div>`;

  container.innerHTML = html;

  // Carrega docs após o HTML ser inserido
  renderDocsMiniPanel(rub.projeto_id, rubId, null, `doc-mini-rub-${rubId}`);
}

/* ── Toggle seção mês/docs dentro da rubrica ── */
function toggleRubMesDetalhe(mesKey) {
  const row  = document.getElementById(`detail-rubmes-${mesKey}`);
  const icon = document.getElementById(`icon-rubmes-${mesKey}`);
  if (!row) return;
  const open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  if (icon) icon.style.transform = open ? '' : 'rotate(90deg)';
}

/* ── Atualiza total previsto no cabeçalho ── */
function updateCronoTotal(rubId, monthsStr) {
  const months = monthsStr.split(',');
  let total = 0;
  months.forEach(m => {
    const inp = document.getElementById(`crono-${rubId}-${m}`);
    if (inp) total += Number(inp.value)||0;
  });
  const el = document.getElementById(`crono-total-${rubId}`);
  if (el) el.textContent = fmt.currency(total);
}

/* ── Distribuir uniformemente (divide valor_previsto pelos meses) ── */
function preencherCronoUniforme(rubId, monthsStr) {
  const months = monthsStr.split(',').filter(Boolean);
  const rub = rubricasPageData.find(r => r.id===rubId);
  if (!rub || !months.length) return;
  const valPorMes = (Number(rub.valor_previsto)||0) / months.length;
  months.forEach(m => {
    const inp = document.getElementById(`crono-${rubId}-${m}`);
    if (inp) inp.value = valPorMes.toFixed(2);
  });
  updateCronoTotal(rubId, monthsStr);
  showToast(`Distribuição uniforme: ${fmt.currency(valPorMes)}/mês × ${months.length} meses`, 'info');
}

/* ── Modal de Distribuição Inteligente ── */
function abrirModalDistribuicao(rubId, monthsStr) {
  const rub    = rubricasPageData.find(r => r.id===rubId);
  const months = monthsStr.split(',').filter(Boolean);
  if (!rub || !months.length) return;

  const totalPrev    = Number(rub.valor_previsto) || 0;
  const qtdTotal     = Number(rub.quantidade)     || 1;
  const vlrUnit      = Number(rub.valor_unitario) || 0;
  const qtdPorMes    = (qtdTotal / months.length).toFixed(2);
  const vlrPorMes    = (totalPrev / months.length).toFixed(2);

  // Remove modal anterior se existir
  const old = document.getElementById('modal-crono-dist');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-crono-dist';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'z-index:9999;';
  modal.innerHTML = `
  <div class="modal" style="max-width:520px;">
    <div class="modal-header" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;">
      <h3 style="color:#fff;font-size:.95rem;">
        <i class="fas fa-sliders-h"></i> Distribuição Inteligente do Cronograma
      </h3>
      <button class="modal-close" style="color:#fff;" onclick="document.getElementById('modal-crono-dist').remove()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="padding:16px;">

      <!-- Info da rubrica -->
      <div class="alert" style="background:#f0f9ff;border-left:3px solid #0284c7;padding:10px 14px;margin-bottom:16px;font-size:.8rem;">
        <strong>${rub.categoria}</strong> — ${rub.descricao}<br>
        <span class="text-muted">
          ${qtdTotal} ${rub.unidade||'un'} × ${fmt.currency(vlrUnit)} = <strong>${fmt.currency(totalPrev)}</strong>
          &nbsp;·&nbsp; ${months.length} meses na vigência
        </span>
      </div>

      <!-- Modo de distribuição -->
      <div class="form-group mb-3">
        <label class="form-label font-semibold">Modo de Distribuição</label>
        <select class="form-control" id="dist-modo" onchange="onDistModoChange('${rubId}','${monthsStr}')">
          <option value="uniforme">Uniforme — mesmo valor em todos os meses</option>
          <option value="manual">Manual — defina quantidade por mês</option>
          <option value="concentrado">Concentrado — 100% em meses selecionados</option>
        </select>
      </div>

      <div id="dist-config">
        <!-- Preenchido dinamicamente por onDistModoChange -->
      </div>

      <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-top:12px;">
        <div class="flex justify-between text-sm font-semibold">
          <span>Total previsto:</span>
          <span id="dist-total-preview" style="color:#0284c7;">${fmt.currency(totalPrev)}</span>
        </div>
        <div class="text-xs text-muted mt-1" id="dist-aviso"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('modal-crono-dist').remove()">Cancelar</button>
      <button class="btn btn-primary" onclick="aplicarDistribuicao('${rubId}','${monthsStr}')">
        <i class="fas fa-magic"></i> Aplicar nos Inputs
      </button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.classList.add('open');
  onDistModoChange(rubId, monthsStr);
}

function onDistModoChange(rubId, monthsStr) {
  const modo   = document.getElementById('dist-modo')?.value || 'uniforme';
  const months = monthsStr.split(',').filter(Boolean);
  const rub    = rubricasPageData.find(r => r.id===rubId);
  if (!rub) return;
  const totalPrev = Number(rub.valor_previsto) || 0;
  const qtdTotal  = Number(rub.quantidade)     || 1;
  const vlrUnit   = Number(rub.valor_unitario) || 0;
  const config    = document.getElementById('dist-config');
  const aviso     = document.getElementById('dist-aviso');
  if (!config) return;

  if (modo === 'uniforme') {
    const valPorMes = (totalPrev / months.length).toFixed(2);
    config.innerHTML = `
      <div class="alert" style="background:#ecfdf5;border-left:3px solid #0e9f6e;padding:8px 14px;font-size:.82rem;">
        <i class="fas fa-equals" style="color:#0e9f6e;"></i>
        <strong>${fmt.currency(Number(valPorMes))}</strong> em cada um dos <strong>${months.length} meses</strong>
        <div class="text-xs text-muted mt-1">(${fmt.currency(totalPrev)} ÷ ${months.length} meses)</div>
      </div>`;
    if (aviso) aviso.textContent = '';
  } else if (modo === 'manual') {
    const qtdPorMes = (qtdTotal / months.length);
    config.innerHTML = `
      <div class="text-xs text-muted mb-2 font-semibold">
        <i class="fas fa-info-circle text-primary"></i>
        Defina a <strong>quantidade</strong> de unidades em cada mês.
        Valor = qtd × ${fmt.currency(vlrUnit)} (valor unitário).
        Total qtd: ${qtdTotal} ${rub.unidade||'un'}.
      </div>
      <div style="max-height:200px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;">
        <table style="font-size:.78rem;width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:5px 8px;text-align:left;">Mês</th>
              <th style="padding:5px 8px;text-align:center;">Qtd (${rub.unidade||'un'})</th>
              <th style="padding:5px 8px;text-align:right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${months.map(m => `
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:4px 8px;font-weight:500;">${fmt.monthYear(m)}</td>
              <td style="padding:4px 6px;text-align:center;">
                <input type="number" class="dist-qtd-input" data-mes="${m}" data-vlrunit="${vlrUnit}"
                  style="width:70px;padding:3px 5px;text-align:center;border:1px solid #e2e8f0;border-radius:4px;font-size:.78rem;"
                  min="0" step="any" value="${qtdPorMes.toFixed(2)}"
                  oninput="recalcDistManual('${rubId}')">
              </td>
              <td style="padding:4px 8px;text-align:right;" id="dist-val-${m}">
                ${fmt.currency(qtdPorMes * vlrUnit)}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    recalcDistManual(rubId);
  } else if (modo === 'concentrado') {
    config.innerHTML = `
      <div class="text-xs text-muted mb-2 font-semibold">
        <i class="fas fa-info-circle text-primary"></i>
        Selecione os meses onde ocorrerá o gasto. O valor total será dividido igualmente entre os meses marcados.
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${months.map(m => `
        <label style="display:flex;align-items:center;gap:4px;font-size:.78rem;cursor:pointer;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;">
          <input type="checkbox" class="dist-check-mes" value="${m}" checked
            onchange="recalcDistConcentrado('${rubId}','${monthsStr}')">
          ${fmt.monthYear(m)}
        </label>`).join('')}
      </div>
      <div class="text-xs text-muted mt-2" id="dist-conc-info"></div>`;
    recalcDistConcentrado(rubId, monthsStr);
  }
}

function recalcDistManual(rubId) {
  const rub = rubricasPageData.find(r => r.id===rubId);
  if (!rub) return;
  let total = 0;
  document.querySelectorAll('.dist-qtd-input').forEach(inp => {
    const qtd    = Number(inp.value)||0;
    const vlrUnit= Number(inp.dataset.vlrunit)||0;
    const val    = qtd * vlrUnit;
    total += val;
    const mes = inp.dataset.mes;
    const el  = document.getElementById(`dist-val-${mes}`);
    if (el) el.textContent = fmt.currency(val);
  });
  const prevEl = document.getElementById('dist-total-preview');
  const avEl   = document.getElementById('dist-aviso');
  if (prevEl) prevEl.textContent = fmt.currency(total);
  const diff = Math.abs(total - (Number(rub.valor_previsto)||0));
  if (avEl) {
    if (diff > 0.01) {
      avEl.textContent = `⚠ Diferença de ${fmt.currency(diff)} em relação ao previsto (${fmt.currency(rub.valor_previsto)})`;
      avEl.style.color = '#d97706';
    } else {
      avEl.textContent = '✓ Total bate com o valor previsto da rubrica';
      avEl.style.color = '#0e9f6e';
    }
  }
}

function recalcDistConcentrado(rubId, monthsStr) {
  const rub     = rubricasPageData.find(r => r.id===rubId);
  if (!rub) return;
  const checks  = [...document.querySelectorAll('.dist-check-mes:checked')];
  const nMeses  = checks.length;
  const totalPrev = Number(rub.valor_previsto)||0;
  const valPorMes = nMeses > 0 ? (totalPrev / nMeses).toFixed(2) : 0;
  const infoEl  = document.getElementById('dist-conc-info');
  if (infoEl) {
    infoEl.textContent = nMeses > 0
      ? `${nMeses} mes(es) selecionado(s) → ${fmt.currency(Number(valPorMes))} / mês`
      : 'Selecione pelo menos 1 mês';
  }
}

function aplicarDistribuicao(rubId, monthsStr) {
  const modo   = document.getElementById('dist-modo')?.value || 'uniforme';
  const months = monthsStr.split(',').filter(Boolean);
  const rub    = rubricasPageData.find(r => r.id===rubId);
  if (!rub) return;
  const totalPrev = Number(rub.valor_previsto)||0;

  if (modo === 'uniforme') {
    const valPorMes = totalPrev / months.length;
    months.forEach(m => {
      const inp = document.getElementById(`crono-${rubId}-${m}`);
      if (inp) inp.value = valPorMes.toFixed(2);
    });
  } else if (modo === 'manual') {
    document.querySelectorAll('.dist-qtd-input').forEach(inp => {
      const qtd     = Number(inp.value)||0;
      const vlrUnit = Number(inp.dataset.vlrunit)||0;
      const mes     = inp.dataset.mes;
      const cronInp = document.getElementById(`crono-${rubId}-${mes}`);
      if (cronInp) cronInp.value = (qtd * vlrUnit).toFixed(2);
    });
  } else if (modo === 'concentrado') {
    const checks   = [...document.querySelectorAll('.dist-check-mes:checked')].map(c => c.value);
    const nMeses   = checks.length;
    const valPorMes = nMeses > 0 ? totalPrev / nMeses : 0;
    months.forEach(m => {
      const inp = document.getElementById(`crono-${rubId}-${m}`);
      if (inp) inp.value = checks.includes(m) ? valPorMes.toFixed(2) : '';
    });
  }

  updateCronoTotal(rubId, monthsStr);
  document.getElementById('modal-crono-dist')?.remove();
  showToast('Distribuição aplicada! Clique em "Salvar" para confirmar.', 'success');
}

/* ── Salvar cronograma mensal ── */
async function saveCronogramaRubrica(rubId) {
  const rub   = rubricasPageData.find(r => r.id===rubId);
  if (!rub) return;
  const proj  = projetosRubData.find(p => p.id===rub.projeto_id);

  // Usa allMonths (range do projeto + meses extras das despesas existentes)
  const baseMonths  = proj ? getMonthsArray(proj.data_inicio?.slice(0,7), proj.data_fim?.slice(0,7)) : [];
  const deps        = (CACHE.despesas||[]).filter(d => {
    if (d.projeto_id === rub.projeto_id) return true;
    return d.rubrica_id === rubId;
  });
  const extraMonths = deps.map(d => d.mes_referencia).filter(m => m && !baseMonths.includes(m));
  const allMonths   = [...new Set([...baseMonths, ...extraMonths])].sort();

  const records = [];
  allMonths.forEach(mes => {
    const input = document.getElementById(`crono-${rubId}-${mes}`);
    const val   = Number(input?.value) || 0;
    if (val > 0) {
      records.push({
        id:             genId(),
        projeto_id:     rub.projeto_id,
        rubrica_id:     rubId,
        mes,
        valor_previsto: val
      });
    }
  });

  const btn = document.querySelector(`[onclick="saveCronogramaRubrica('${rubId}')"]`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  try {
    // Apaga registros antigos desta rubrica no Supabase
    await DB.deleteWhere('ong_cronograma', { rubrica_id: rubId });

    // Insere os novos
    if (records.length > 0) {
      await Promise.all(records.map(rec => DB.insert('ong_cronograma', rec)));
    }

    // Atualiza cache
    const cR = await DB.getAll('ong_cronograma');
    CACHE.cronograma = cR;

    showToast(`✓ Cronograma salvo! ${records.length} mês(es) com valor previsto.`, 'success');
  } catch(err) {
    showToast('Erro ao salvar cronograma: ' + err.message, 'error');
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
  }
}

/* ════════════════════════════════════════════
   MODAL CRONOGRAMA COMPLETO DO PROJETO
════════════════════════════════════════════ */
async function openCronograma(projId) {
  _rubCurrentProj = projId;
  const modal = document.getElementById('modal-cronograma');
  modal.classList.add('open');

  const content = document.getElementById('cronograma-content');
  content.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando...</div>';

  const proj    = projetosRubData.find(p => p.id===projId);
  const rubricas= rubricasPageData.filter(r => r.projeto_id===projId);
  const deps    = (CACHE.despesas||[]).filter(d => d.projeto_id===projId);
  const crno    = (CACHE.cronograma||[]).filter(c => c.projeto_id===projId);

  if (!proj) {
    content.innerHTML = '<p class="text-muted">Projeto não encontrado.</p>';
    return;
  }

  const months = getMonthsArray(proj.data_inicio?.slice(0,7), proj.data_fim?.slice(0,7));
  document.getElementById('cronograma-title').innerHTML =
    `<i class="fas fa-calendar-alt text-primary"></i> Cronograma — ${proj.numero_proposta}: ${(proj.nome_projeto||'').slice(0,50)}`;

  /* Mapas */
  const execByRubMes = {};
  deps.forEach(d => {
    const k = `${d.rubrica_id}__${d.mes_referencia}`;
    execByRubMes[k] = (execByRubMes[k]||0) + (Number(d.valor)||0);
  });
  const crnoByRubMes = {};
  crno.forEach(c => { crnoByRubMes[`${c.rubrica_id}__${c.mes}`] = Number(c.valor_previsto)||0; });

  /* Totais por mês */
  const totalPrevMes = months.map(m =>
    rubricas.reduce((s,r) => s+(crnoByRubMes[`${r.id}__${m}`]||0), 0)
  );
  const totalExecMes = months.map(m =>
    deps.filter(d => d.mes_referencia===m).reduce((s,d) => s+(Number(d.valor)||0), 0)
  );
  const totalGeralPrev = totalPrevMes.reduce((s,v) => s+v, 0) ||
    rubricas.reduce((s,r) => s+(Number(r.valor_previsto)||0), 0);
  const totalGeralExec = totalExecMes.reduce((s,v) => s+v, 0);

  let html = `
  <div style="overflow-x:auto;">
    <table style="min-width:${200+months.length*88}px;font-size:.76rem;border-collapse:collapse;">
      <thead>
        <tr style="background:#f0f7ff;">
          <th style="min-width:200px;padding:9px 10px;border-bottom:2px solid #1a56db;text-align:left;">Rubrica / Categoria</th>
          ${months.map(m=>`<th style="min-width:88px;padding:9px 4px;text-align:center;border-bottom:2px solid #1a56db;">${fmt.monthYear(m)}</th>`).join('')}
          <th style="min-width:100px;padding:9px 10px;text-align:right;border-bottom:2px solid #1a56db;">Total</th>
        </tr>
      </thead>
      <tbody>`;

  rubricas.forEach(r => {
    const totalPrevRub = months.reduce((s,m) => s+(crnoByRubMes[`${r.id}__${m}`]||0), 0);
    const totalExecRub = deps.filter(d => d.rubrica_id===r.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const ndeps        = deps.filter(d => d.rubrica_id===r.id).length;

    /* Linha Previsto */
    html += `<tr style="background:#f8fafc;">
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">
        <div class="font-semibold">${r.descricao}</div>
        <div style="font-size:.68rem;color:#6b7280;">${r.categoria} · ${fmt.number(r.quantidade)} ${r.unidade||''}</div>
      </td>
      ${months.map(m=>{
        const v=crnoByRubMes[`${r.id}__${m}`]||0;
        return `<td style="padding:7px 4px;text-align:center;border-bottom:1px solid #f1f5f9;color:${v>0?'#1a56db':'#d1d5db'};">${v>0?fmt.currency(v):'-'}</td>`;
      }).join('')}
      <td style="padding:7px 10px;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${fmt.currency(totalPrevRub||r.valor_previsto)}</td>
    </tr>`;

    /* Linha Executado */
    html += `<tr style="background:#ecfdf5;">
      <td style="padding:5px 10px 8px 20px;font-size:.7rem;color:#065f46;border-bottom:1px solid #e2e8f0;">
        ↳ Executado <span class="badge badge-gray" style="margin-left:4px;">${ndeps} doc.</span>
      </td>
      ${months.map(m=>{
        const v=execByRubMes[`${r.id}__${m}`]||0;
        return `<td style="padding:5px 4px 8px;text-align:center;font-size:.71rem;color:${v>0?'#065f46':'#d1d5db'};border-bottom:1px solid #e2e8f0;">${v>0?fmt.currency(v):'-'}</td>`;
      }).join('')}
      <td style="padding:5px 10px 8px;text-align:right;font-weight:600;color:#065f46;border-bottom:1px solid #e2e8f0;">${fmt.currency(totalExecRub)}</td>
    </tr>`;
  });

  /* Linha totais */
  html += `
  <tr style="font-weight:700;background:#dbeafe;border-top:2px solid var(--primary);">
    <td style="padding:9px 10px;">TOTAL PREVISTO</td>
    ${totalPrevMes.map(v=>`<td style="padding:9px 4px;text-align:center;">${v>0?fmt.currency(v):'-'}</td>`).join('')}
    <td style="padding:9px 10px;text-align:right;">${fmt.currency(totalGeralPrev)}</td>
  </tr>
  <tr style="font-weight:700;background:#dcfce7;">
    <td style="padding:9px 10px;">TOTAL EXECUTADO</td>
    ${totalExecMes.map(v=>`<td style="padding:9px 4px;text-align:center;color:#065f46;">${v>0?fmt.currency(v):'-'}</td>`).join('')}
    <td style="padding:9px 10px;text-align:right;color:#065f46;">${fmt.currency(totalGeralExec)}</td>
  </tr>
  <tr style="background:#fef9c3;">
    <td style="padding:8px 10px;font-weight:600;font-size:.74rem;">% EXECUÇÃO</td>
    ${totalPrevMes.map((prev,i)=>{
      const exec=totalExecMes[i];
      const p=prev>0?Math.round(exec/prev*100):0;
      return `<td style="padding:8px 4px;text-align:center;font-size:.72rem;font-weight:600;color:${p>=80?'#0e9f6e':p>0?'#d97706':'#9ca3af'};">${prev>0?p+'%':'-'}</td>`;
    }).join('')}
    <td style="padding:8px 10px;text-align:right;font-weight:700;color:${calcPercent(totalGeralExec,totalGeralPrev)>=80?'#0e9f6e':'#6b7280'};">
      ${fmt.percent(calcPercent(totalGeralExec,totalGeralPrev))}
    </td>
  </tr>
      </tbody>
    </table>
  </div>`;

  content.innerHTML = html;
}

function closeModalCronograma() {
  document.getElementById('modal-cronograma')?.classList.remove('open');
}

/* ════════════════════════════════════════════
   FILTROS
════════════════════════════════════════════ */
function filterRubricas() {
  const q    = (document.getElementById('rub-search')?.value||'').toLowerCase();
  const proj = document.getElementById('rub-filter-projeto')?.value||'';
  const cat  = document.getElementById('rub-filter-categoria')?.value||'';
  const filtered = rubricasPageData.filter(r => {
    const mQ = !q || (r.descricao||'').toLowerCase().includes(q) || (r.categoria||'').toLowerCase().includes(q);
    const mP = !proj || r.projeto_id===proj;
    const mC = !cat  || r.categoria===cat;
    return mQ && mP && mC;
  });
  renderRubricasTable(filtered);
}

/* ════════════════════════════════════════════
   CRUD RUBRICA
════════════════════════════════════════════ */

/* ── Popular select principal de Projeto da rubrica ──
   Garante que rub-projeto-sel sempre tenha opções,
   usando projetosRubData ou CACHE.projetos como fallback.
   Chamado ANTES de setar sel.value. */
function _populateRubProjetoSel() {
  const sel = document.getElementById('rub-projeto-sel');
  if (!sel) return;
  // Só repopula se ainda não tiver opções reais
  const jaTemOpcoes = sel.options.length > 1;
  const projs = (projetosRubData.length > 0 ? projetosRubData : null)
              || (typeof CACHE !== 'undefined' && CACHE.projetos && CACHE.projetos.length > 0 ? CACHE.projetos : null)
              || [];
  if (jaTemOpcoes && projs.length === 0) return; // nada para fazer
  sel.innerHTML = '<option value="">Selecione o Projeto</option>';
  projs.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta ? p.numero_proposta + ' — ' : ''}${(p.nome_projeto || '').slice(0, 50)}`;
    sel.appendChild(o);
  });
}

function openModalRubrica(id = null, forcarProjId = null) {
  rubricaEditId = id;
  document.getElementById('modal-rubrica-title').textContent = id ? 'Editar Rubrica' : 'Nova Rubrica';
  const f = document.getElementById('form-rubrica');
  f.reset();

  // Oculta banner e reseta painel de importação
  const banner = document.getElementById('rub-import-banner');
  if (banner) banner.style.display = 'none';
  const panel = document.getElementById('rub-import-panel');
  if (panel) panel.style.display = id ? 'none' : '';

  // ══ CRÍTICO: popula rub-projeto-sel ANTES de setar .value ══
  // Garante que as <option> existem mesmo vindo do Plano de Trabalho
  _populateRubProjetoSel();

  // Popula select de projeto do painel de importação
  _populateRubImportProjeto();

  // Se editando, preenche o formulário
  if (id) {
    const r = rubricasPageData.find(x => x.id === id);
    if (r) fillFormRubrica(r);
    document.getElementById('modal-rubrica').classList.add('open');
    return;
  }

  // Determina projeto de contexto:
  // 1) argumento explícito (vindo de _criarRubricaDeItem)
  // 2) _planoProjetoId (seletor do Plano de Trabalho)
  // 3) null (usuário escolhe)
  const projCtx = forcarProjId
    || (typeof _planoProjetoId !== 'undefined' && _planoProjetoId ? _planoProjetoId : null);

  if (projCtx) {
    const sel = document.getElementById('rub-projeto-sel');
    if (sel) sel.value = projCtx; // agora funciona pois as <option> já existem

    // Sincroniza painel de importação
    const impSel = document.getElementById('rub-import-projeto-sel');
    if (impSel) {
      impSel.value = projCtx;
      onRubImportProjetoChange(); // carrega itens do plano de aplicação
    }
  }

  document.getElementById('modal-rubrica').classList.add('open');
}

/* ── Popula select de projeto no painel de importação ── */
function _populateRubImportProjeto() {
  const sel = document.getElementById('rub-import-projeto-sel');
  if (!sel) return;
  const projs = projetosRubData.length > 0 ? projetosRubData : (CACHE.projetos || []);
  sel.innerHTML = '<option value="">Projeto...</option>';
  projs.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta ? p.numero_proposta + ' — ' : ''}${(p.nome_projeto||'').slice(0, 45)}`;
    sel.appendChild(o);
  });
  // Reseta select de itens
  const itemSel = document.getElementById('rub-import-item-sel');
  if (itemSel) itemSel.innerHTML = '<option value="">— Selecione o item —</option>';
}

/* ── Ao trocar projeto no painel de importação: carrega itens do Plano de Aplicação ── */
async function onRubImportProjetoChange() {
  const projId  = document.getElementById('rub-import-projeto-sel')?.value;
  const itemSel = document.getElementById('rub-import-item-sel');
  if (!itemSel) return;
  itemSel.innerHTML = '<option value="">Carregando...</option>';
  if (!projId) { itemSel.innerHTML = '<option value="">— Selecione o item —</option>'; return; }

  // Sincroniza projeto no formulário de rubrica
  // (re-popula se estiver vazio — pode ter vindo do Plano de Trabalho)
  _populateRubProjetoSel();
  const rubProjSel = document.getElementById('rub-projeto-sel');
  if (rubProjSel) rubProjSel.value = projId;

  try {
    // Carrega itens do plano de aplicação deste projeto
    let itens = typeof _planoItens !== 'undefined' && _planoItens.length > 0
      ? _planoItens.filter(i => i.projeto_id === projId)
      : (await DB.getAll('ong_plano_aplicacao').catch(() => [])).filter(i => i.projeto_id === projId);

    // Carrega metas para labels
    const metas = CACHE.metas || await DB.getAll('ong_metas').catch(() => []);

    itemSel.innerHTML = '<option value="">— Selecione item para importar —</option>';
    if (!itens.length) {
      itemSel.innerHTML = '<option value="" disabled>Nenhum item cadastrado no Plano de Aplicação</option>';
      return;
    }

    itens.forEach(item => {
      const meta  = metas.find(m => m.id === item.meta_id);
      const label = `[${item.categoria || 'Geral'}] ${item.descricao || ''} — M${meta?.numero_meta || '?'}`;
      const o = document.createElement('option');
      o.value = item.id;
      o.textContent = label.substring(0, 70);
      // Serializa dados para não precisar buscar depois
      o.dataset.item = JSON.stringify(item);
      itemSel.appendChild(o);
    });
  } catch(err) {
    itemSel.innerHTML = '<option value="">Erro ao carregar</option>';
    console.error('onRubImportProjetoChange:', err);
  }
}

/* ── Ao selecionar item: preenche o formulário de rubrica automaticamente ── */
function onRubImportItemChange() {
  const itemSel = document.getElementById('rub-import-item-sel');
  const opt = itemSel?.options[itemSel.selectedIndex];
  if (!opt?.dataset?.item) return;

  let item;
  try { item = JSON.parse(opt.dataset.item); } catch(e) { return; }

  const f = document.getElementById('form-rubrica');
  if (!f) return;

  // Mapeia campos do Plano de Aplicação → Rubrica (elimina retrabalho)
  const mapeamento = {
    projeto_id:     item.projeto_id,
    descricao:      item.descricao,
    categoria:      item.categoria,
    quantidade:     item.quantidade,
    unidade:        item.unidade,
    valor_unitario: item.valor_unitario,
    valor_previsto: item.valor_previsto,
    fonte:          item.fonte
  };

  Object.entries(mapeamento).forEach(([k, v]) => {
    const el = f.elements[k];
    if (el && v !== undefined && v !== null) el.value = v;
  });

  // Mostra banner de confirmação
  const banner = document.getElementById('rub-import-banner');
  if (banner) {
    banner.style.display = '';
    banner.innerHTML = `<i class="fas fa-check-circle"></i>
      Dados importados do Plano de Aplicação: <strong>${item.descricao || ''}</strong>.
      Revise e ajuste se necessário antes de salvar.`;
  }

  showToast('Rubrica preenchida automaticamente com dados do Plano de Aplicação!', 'success');
}

function closeModalRubrica() {
  document.getElementById('modal-rubrica')?.classList.remove('open');
  rubricaEditId = null;
}

function fillFormRubrica(r) {
  const f = document.getElementById('form-rubrica');
  Object.keys(r).forEach(k => {
    const el = f.elements[k];
    if (el) el.value = r[k] ?? '';
  });
}

function editRubrica(id) {
  if (!projetosRubData.length) loadRubricas().then(() => openModalRubrica(id));
  else openModalRubrica(id);
}

async function saveRubrica() {
  const form = document.getElementById('form-rubrica');
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.projeto_id) { showToast('Selecione o projeto', 'error'); return; }
  if (!data.descricao?.trim()) { showToast('Descrição obrigatória', 'error'); return; }
  ['quantidade','valor_unitario','valor_previsto','valor_executado'].forEach(k => {
    data[k] = Number(data[k])||0;
  });
  if (!data.valor_previsto) {
    data.valor_previsto = data.quantidade * data.valor_unitario;
  }
  try {
    if (rubricaEditId) {
      await DB.update('ong_rubricas', rubricaEditId, data);
      showToast('Rubrica atualizada!');
    } else {
      data.id = genId();
      await DB.insert('ong_rubricas', data);
      showToast('Rubrica criada!');
    }
    CACHE.clear();
    closeModalRubrica();
    await loadRubricas();
  } catch(err) { showToast('Erro: ' + err.message, 'error'); }
}

async function deleteRubrica(id) {
  if (!confirmDialog('Excluir esta rubrica? O cronograma vinculado também será removido.')) return;
  try {
    await DB.delete('ong_rubricas', id);
    await DB.deleteWhere('ong_cronograma', { rubrica_id: id });
    showToast('Rubrica excluída!');
    CACHE.clear();
    await loadRubricas();
  } catch(err) { showToast('Erro: ' + err.message, 'error'); }
}

/* ── Atalho: abrir modal despesa pré-vinculado à rubrica ── */
function openModalDespesaRubrica(rubId, projId) {
  if (typeof loadFinanceiro === 'function' && (!projetosFinData || !projetosFinData.length)) {
    loadFinanceiro().then(() => _openDespWithRub(rubId, projId));
  } else {
    _openDespWithRub(rubId, projId);
  }
}

function _openDespWithRub(rubId, projId) {
  openModalDespesa();
  setTimeout(() => {
    const pSel = document.getElementById('desp-projeto');
    if (pSel) { pSel.value = projId; updateRubricaSelect(); }
    setTimeout(() => {
      const rSel = document.getElementById('desp-rubrica');
      if (rSel) rSel.value = rubId;
    }, 150);
  }, 120);
}

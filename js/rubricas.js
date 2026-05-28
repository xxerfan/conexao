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
  ) : [];

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
  if (months.length > 0) {
    const totalCrno = months.reduce((s,m) => s+(crnoMap[m]||0), 0);

    html += `
    <div style="margin-bottom:16px;">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-semibold" style="color:#1e40af;text-transform:uppercase;letter-spacing:.04em;">
          <i class="fas fa-calendar-alt"></i> Cronograma Mês a Mês — ${months.length} meses
        </span>
        <div class="flex gap-1">
          <button class="btn btn-xs btn-outline" onclick="preencherCronoUniforme('${rubId}','${months.join(',')}')">
            <i class="fas fa-magic"></i> Distribuir
          </button>
          <button class="btn btn-primary btn-xs" onclick="saveCronogramaRubrica('${rubId}')">
            <i class="fas fa-save"></i> Salvar Cronograma
          </button>
        </div>
      </div>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;">
        <table style="min-width:${120+months.length*92}px;font-size:.78rem;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="min-width:110px;padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0;"></th>
              ${months.map(m=>`<th style="min-width:92px;padding:8px 4px;text-align:center;border-bottom:1px solid #e2e8f0;font-size:.72rem;">${fmt.monthYear(m)}</th>`).join('')}
              <th style="min-width:95px;padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <!-- Linha Previsto (editável) -->
            <tr style="background:#fff;">
              <td style="padding:7px 10px;font-weight:600;font-size:.72rem;color:#1e40af;white-space:nowrap;">
                <i class="fas fa-calendar text-primary"></i> Previsto (R$)
              </td>
              ${months.map(m=>`
              <td style="padding:4px 3px;text-align:center;">
                <input type="number" class="crono-month-input" 
                  id="crono-${rubId}-${m}" 
                  value="${crnoMap[m]||''}" 
                  placeholder="0"
                  min="0" step="0.01"
                  onchange="updateCronoTotal('${rubId}','${months.join(',')}')"
                  title="${fmt.monthYear(m)} — Previsto">
              </td>`).join('')}
              <td style="padding:7px 10px;text-align:right;font-weight:700;" id="crono-total-${rubId}">
                ${fmt.currency(totalCrno)}
              </td>
            </tr>
            <!-- Linha Executado (read-only) -->
            <tr style="background:#ecfdf5;">
              <td style="padding:7px 10px;font-weight:600;font-size:.72rem;color:#065f46;white-space:nowrap;">
                <i class="fas fa-check-circle" style="color:#0e9f6e;"></i> Executado (R$)
              </td>
              ${months.map(m=>{
                const v=execMap[m]||0;
                return `<td style="padding:7px 3px;text-align:center;font-size:.74rem;color:${v>0?'#065f46':'#9ca3af'};">
                  ${v>0?fmt.currency(v):'-'}
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
              ${months.map(m=>{
                const prev=crnoMap[m]||0;
                const exec=execMap[m]||0;
                const saldo=prev-exec;
                const hasData=prev>0||exec>0;
                return `<td style="padding:7px 3px;text-align:center;font-size:.72rem;color:${saldo<0?'#e02424':'#374151'};">
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
              ${months.map(m=>{
                const prev=crnoMap[m]||0;
                const exec=execMap[m]||0;
                const p=prev>0?Math.round(exec/prev*100):0;
                return `<td style="padding:7px 3px;text-align:center;font-size:.7rem;color:${p>=100?'#0e9f6e':p>0?'#d97706':'#9ca3af'};">
                  ${prev>0?p+'%':'-'}
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
      <button class="btn btn-primary btn-xs" onclick="openModalDespesaRubrica('${rubId}','${rub.projeto_id}')">
        <i class="fas fa-plus"></i> Novo Lançamento
      </button>
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

/* ── Distribuir uniformemente ── */
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
  showToast(`Valor distribuído: ${fmt.currency(valPorMes)}/mês`, 'info');
}

/* ── Salvar cronograma mensal ── */
async function saveCronogramaRubrica(rubId) {
  const rub   = rubricasPageData.find(r => r.id===rubId);
  if (!rub) return;
  const proj  = projetosRubData.find(p => p.id===rub.projeto_id);
  const months= proj ? getMonthsArray(proj.data_inicio?.slice(0,7), proj.data_fim?.slice(0,7)) : [];

  const records = [];
  months.forEach(mes => {
    const input = document.getElementById(`crono-${rubId}-${mes}`);
    const val   = Number(input?.value)||0;
    if (val > 0) {
      records.push({
        id:           genId(),
        projeto_id:   rub.projeto_id,
        rubrica_id:   rubId,
        mes:          mes,
        valor_previsto: val
      });
    }
  });

  try {
    // Apaga registros antigos desta rubrica no Supabase
    await DB.deleteWhere('ong_cronograma', 'rubrica_id', rubId);

    // Insere os novos
    if (records.length > 0) {
      await Promise.all(records.map(rec => DB.insert('ong_cronograma', rec)));
    }

    // Atualiza cache
    const cR = await DB.getAll('ong_cronograma');
    CACHE.cronograma = cR;

    showToast(`Cronograma salvo! ${records.length} mês(es) com valor.`);
  } catch(err) {
    showToast('Erro ao salvar cronograma: ' + err.message, 'error');
    console.error(err);
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
function openModalRubrica(id=null) {
  rubricaEditId = id;
  const modal = document.getElementById('modal-rubrica');
  document.getElementById('modal-rubrica-title').textContent = id ? 'Editar Rubrica' : 'Nova Rubrica';
  const f = document.getElementById('form-rubrica');
  f.reset();
  if (id) {
    const r = rubricasPageData.find(x => x.id===id);
    if (r) fillFormRubrica(r);
  }
  modal.classList.add('open');
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

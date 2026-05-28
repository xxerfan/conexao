/* =============================================
   ONG GESTOR v5 — Metas e Indicadores (Supreme)
   ============================================= */

let metasData        = [];
let projetosMetaData = [];
let metaEditId       = null;

/* ════════════════════════════════════════════
   CARREGAR METAS
════════════════════════════════════════════ */
async function loadMetas() {
  skeletonTable('metas-tbody', 6, 8);
  try {
    const [pR, mR] = await Promise.all([
      DB.getAll('ong_projetos'),
      DB.getAll('ong_metas')
    ]);
    projetosMetaData = pR || [];
    metasData        = mR || [];
    CACHE.projetos   = projetosMetaData;
    CACHE.metas      = metasData;

    populateProjetoSelectMeta('meta-filter-projeto');
    populateProjetoSelectMeta('meta-projeto-sel');
    renderMetasKpis();
    renderMetasTable(metasData);
  } catch(err) {
    showToast('Erro ao carregar metas: ' + err.message, 'error');
    console.error(err);
  }
}

/* ── Popula select de projetos ── */
function populateProjetoSelectMeta(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const isFilter = id.includes('filter');
  sel.innerHTML = isFilter
    ? '<option value="">Todos os Projetos</option>'
    : '<option value="">Selecione o Projeto</option>';
  projetosMetaData.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta || p.id} — ${(p.nome_projeto||'').slice(0,40)}`;
    sel.appendChild(o);
  });
}

/* ════════════════════════════════════════════
   KPIs
════════════════════════════════════════════ */
function renderMetasKpis() {
  const total   = metasData.length;
  const conc    = metasData.filter(m => m.status === 'Concluída').length;
  const em      = metasData.filter(m => m.status === 'Em Andamento').length;
  const atr     = metasData.filter(m => m.status === 'Atrasada').length;
  const benPrev = metasData.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
  const benAten = metasData.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
  const percB   = calcPercent(benAten, benPrev);
  const avgF    = total > 0
    ? metasData.reduce((s,m) => s+(Number(m.percentual_fisico)||0), 0) / total
    : 0;

  _kpiSetWithAnimation('meta-kpi-total',     total,  Math.round);
  _kpiSetWithAnimation('meta-kpi-concluidas', conc,  Math.round);
  _kpiSetWithAnimation('meta-kpi-andamento',  em,    Math.round);
  _kpiSetWithAnimation('meta-kpi-atrasadas',  atr,   Math.round);
  setText('meta-kpi-benef',  `${fmt.number(benAten)} / ${fmt.number(benPrev)}`);
  setText('meta-kpi-fisico', fmt.percent(avgF));

  const bar = document.getElementById('meta-prog-benef');
  if (bar) {
    bar.style.width = percB + '%';
    bar.className   = `progress-bar-fill ${progressColor(percB)}`;
  }
}

/* ════════════════════════════════════════════
   TABELA
════════════════════════════════════════════ */
function renderMetasTable(metas) {
  const tbody = document.getElementById('metas-tbody');
  if (!tbody) return;

  if (!metas.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-bullseye"></i><p>Nenhuma meta cadastrada</p></div></td></tr>`;
    return;
  }

  /* Agrupa por projeto */
  const byProj = {};
  metas.forEach(m => {
    if (!byProj[m.projeto_id]) byProj[m.projeto_id] = [];
    byProj[m.projeto_id].push(m);
  });

  let html = '';
  Object.entries(byProj).forEach(([projId, list]) => {
    const proj        = projetosMetaData.find(p => p.id===projId);
    const benPrevProj = list.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
    const benAtenProj = list.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
    const percBProj   = calcPercent(benAtenProj, benPrevProj);
    const concl       = list.filter(m => m.status==='Concluída').length;
    const atras       = list.filter(m => m.status==='Atrasada').length;

    html += `
    <tr style="background:linear-gradient(90deg,rgba(37,99,235,.04),transparent);border-top:2px solid var(--primary-light);">
      <td colspan="8">
        <div class="flex justify-between items-center flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <div class="kpi-icon blue" style="width:30px;height:30px;font-size:.75rem;border-radius:8px;flex-shrink:0;">
              <i class="fas fa-folder"></i>
            </div>
            <div>
              <span class="font-semibold" style="font-size:.85rem;color:var(--primary-darker);">
                ${proj?.nome_projeto || projId}
              </span>
              <span class="text-xs text-muted ml-1">${proj?.numero_proposta || ''}</span>
            </div>
          </div>
          <div class="flex gap-2 items-center flex-wrap">
            <span class="badge badge-gray">${list.length} meta${list.length!==1?'s':''}</span>
            ${concl ? `<span class="badge badge-green">${concl} concluída${concl!==1?'s':''}</span>` : ''}
            ${atras ? `<span class="badge badge-red">${atras} atrasada${atras!==1?'s':''}</span>` : ''}
            <span class="text-xs text-muted">${fmt.number(benAtenProj)} / ${fmt.number(benPrevProj)} benef. (${fmt.percent(percBProj)})</span>
          </div>
        </div>
      </td>
    </tr>`;

    list.sort((a,b) => (a.numero_meta||0)-(b.numero_meta||0)).forEach((m, idx) => {
      const percF   = Number(m.percentual_fisico) || 0;
      const percFin = calcPercent(m.valor_executado, m.valor_previsto);
      const percBen = calcPercent(m.beneficiarios_atendidos, m.beneficiarios_previstos);

      /* Status de prazo */
      let prazoClass = '';
      if (m.data_fim && m.status !== 'Concluída') {
        const dias = Math.ceil((new Date(m.data_fim) - new Date()) / 86400000);
        if (dias < 0)       prazoClass = 'text-danger font-semibold';
        else if (dias <= 30) prazoClass = 'text-warning font-semibold';
      }

      html += `
      <tr style="animation: pageFadeIn .2s ease ${idx * 0.03}s both;">
        <td class="font-semibold text-center" style="font-size:.95rem;color:var(--primary);">${m.numero_meta}</td>
        <td>
          <div class="font-semibold" style="font-size:.82rem;">${m.descricao_meta || '-'}</div>
          ${m.indicador ? `<div class="text-xs text-muted mt-0" style="margin-top:2px;">${m.indicador}</div>` : ''}
        </td>
        <td class="text-center">
          <div class="font-semibold" style="font-size:.9rem;">${fmt.number(m.beneficiarios_atendidos)}</div>
          <div class="text-xs text-muted">/ ${fmt.number(m.beneficiarios_previstos)}</div>
          <div style="min-width:60px;margin-top:4px;">${progressBar(percBen, false)}</div>
        </td>
        <td style="min-width:110px;">
          <div class="flex justify-between mb-1">
            <span class="text-xs text-muted">Física</span>
            <span class="text-xs font-semibold">${fmt.percent(percF)}</span>
          </div>
          ${progressBar(percF, false)}
        </td>
        <td class="text-right">
          <div class="text-sm font-semibold">${fmt.currency(m.valor_executado)}</div>
          <div class="text-xs text-muted">de ${fmt.currency(m.valor_previsto)}</div>
          <div style="min-width:60px;margin-top:4px;">${progressBar(percFin, false)}</div>
        </td>
        <td class="text-xs ${prazoClass}">
          <div>${fmt.date(m.data_inicio)}</div>
          <div>→ ${fmt.date(m.data_fim)}</div>
        </td>
        <td>${statusBadge(m.status)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-outline btn-xs btn-icon" onclick="editMeta('${m.id}')" title="Editar">
              <i class="fas fa-pencil"></i>
            </button>
            <button class="btn btn-danger btn-xs btn-icon" onclick="deleteMeta('${m.id}')" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
    });
  });

  tbody.innerHTML = html;
}

/* ════════════════════════════════════════════
   FILTROS
════════════════════════════════════════════ */
function filterMetas() {
  const q  = (document.getElementById('meta-search')?.value || '').toLowerCase();
  const pr = document.getElementById('meta-filter-projeto')?.value || '';
  const st = document.getElementById('meta-filter-status')?.value  || '';
  const filtered = metasData.filter(m => {
    const mQ = !q  || (m.descricao_meta||'').toLowerCase().includes(q) || (m.indicador||'').toLowerCase().includes(q);
    const mP = !pr || m.projeto_id === pr;
    const mS = !st || m.status === st;
    return mQ && mP && mS;
  });
  renderMetasTable(filtered);
}

/* ════════════════════════════════════════════
   MODAL
════════════════════════════════════════════ */
function openModalMeta(id = null) {
  metaEditId = id;
  document.getElementById('modal-meta-title').textContent = id ? 'Editar Meta' : 'Nova Meta';
  const f = document.getElementById('form-meta');
  f.reset();
  if (id) {
    const m = metasData.find(x => x.id === id);
    if (m) Object.keys(m).forEach(k => {
      const el = f.elements[k];
      if (el) el.value = m[k] ?? '';
    });
  }
  document.getElementById('modal-meta').classList.add('open');
  setTimeout(() => f.querySelector('[name="descricao_meta"]')?.focus(), 100);
}

function closeModalMeta() {
  document.getElementById('modal-meta')?.classList.remove('open');
  metaEditId = null;
}

function editMeta(id) { openModalMeta(id); }

/* ════════════════════════════════════════════
   SALVAR META
════════════════════════════════════════════ */
async function saveMeta() {
  const form = document.getElementById('form-meta');
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.projeto_id)            { showToast('Selecione o projeto', 'error'); return; }
  if (!data.descricao_meta?.trim()){ showToast('Descrição é obrigatória', 'error'); return; }

  ['numero_meta','valor_previsto','valor_executado',
   'beneficiarios_previstos','beneficiarios_atendidos','percentual_fisico'].forEach(k => {
    data[k] = Number(data[k]) || 0;
  });

  /* Validação percentual */
  if (data.percentual_fisico > 100) { showToast('Exec. Física não pode ultrapassar 100%', 'warning'); data.percentual_fisico = 100; }

  const btnSave = document.querySelector('#modal-meta .btn-primary');
  if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  try {
    if (metaEditId) {
      await DB.update('ong_metas', metaEditId, data);
      showToast('Meta atualizada com sucesso!', 'success');
    } else {
      data.id = genId();
      await DB.insert('ong_metas', data);
      showToast('Meta criada com sucesso!', 'success');
    }
    CACHE.clear();
    closeModalMeta();
    await loadMetas();
  } catch(err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
  }
}

/* ════════════════════════════════════════════
   EXCLUIR META
════════════════════════════════════════════ */
async function deleteMeta(id) {
  const confirmado = await confirmDialog('Excluir esta meta permanentemente?', 'Excluir Meta', 'danger');
  if (!confirmado) return;
  try {
    await DB.delete('ong_metas', id);
    showToast('Meta excluída.', 'success');
    CACHE.clear();
    await loadMetas();
  } catch(err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

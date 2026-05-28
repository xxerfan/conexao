/* =============================================
   ONG GESTOR v3 — Metas e Indicadores
   ============================================= */

let metasData        = [];
let projetosMetaData = [];
let metaEditId       = null;

async function loadMetas() {
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
    o.textContent = `${p.numero_proposta||p.id} — ${(p.nome_projeto||'').slice(0,40)}`;
    sel.appendChild(o);
  });
}

/* ── KPIs ── */
function renderMetasKpis() {
  const total   = metasData.length;
  const conc    = metasData.filter(m => m.status==='Concluída').length;
  const em      = metasData.filter(m => m.status==='Em Andamento').length;
  const atr     = metasData.filter(m => m.status==='Atrasada').length;
  const benPrev = metasData.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
  const benAten = metasData.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);
  const percB   = calcPercent(benAten, benPrev);
  const avgF    = total > 0
    ? metasData.reduce((s,m) => s+(Number(m.percentual_fisico)||0), 0) / total
    : 0;

  setText('meta-kpi-total',     total);
  setText('meta-kpi-concluidas', conc);
  setText('meta-kpi-andamento', em);
  setText('meta-kpi-atrasadas', atr);
  setText('meta-kpi-benef',     `${fmt.number(benAten)} / ${fmt.number(benPrev)}`);
  setText('meta-kpi-fisico',    fmt.percent(avgF));

  const bar = document.getElementById('meta-prog-benef');
  if (bar) {
    bar.style.width  = percB + '%';
    bar.className    = `progress-bar-fill ${progressColor(percB)}`;
  }
}

/* ── Tabela ── */
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
    const proj = projetosMetaData.find(p => p.id===projId);
    const benPrevProj = list.reduce((s,m) => s+(Number(m.beneficiarios_previstos)||0), 0);
    const benAtenProj = list.reduce((s,m) => s+(Number(m.beneficiarios_atendidos)||0), 0);

    html += `<tr style="background:#edf2ff;">
      <td colspan="8">
        <div class="flex justify-between items-center">
          <span class="font-semibold" style="font-size:.84rem;color:#1e40af;">
            <i class="fas fa-folder text-primary"></i>&nbsp;${proj?.nome_projeto||projId}
            <span class="text-xs text-muted ml-1" style="color:#6b7280;">${proj?.numero_proposta||''}</span>
          </span>
          <span class="text-xs text-muted">${list.length} meta(s) · ${fmt.number(benAtenProj)}/${fmt.number(benPrevProj)} benef.</span>
        </div>
      </td>
    </tr>`;

    list.sort((a,b) => (a.numero_meta||0)-(b.numero_meta||0)).forEach(m => {
      const percF   = Number(m.percentual_fisico)||0;
      const percFin = calcPercent(m.valor_executado, m.valor_previsto);
      const percBen = calcPercent(m.beneficiarios_atendidos, m.beneficiarios_previstos);

      html += `<tr>
        <td class="font-semibold text-center" style="font-size:.95rem;">${m.numero_meta}</td>
        <td>
          <div class="font-semibold" style="font-size:.82rem;">${m.descricao_meta||'-'}</div>
          <div class="text-xs text-muted">${m.indicador||''}</div>
        </td>
        <td class="text-center">
          <div class="font-semibold">${fmt.number(m.beneficiarios_atendidos)}</div>
          <div class="text-xs text-muted">/ ${fmt.number(m.beneficiarios_previstos)}</div>
          <div style="min-width:60px;margin-top:3px;">${progressBar(percBen, false)}</div>
        </td>
        <td style="min-width:100px;">
          <div class="text-xs text-muted mb-1">Física: ${fmt.percent(percF)}</div>
          ${progressBar(percF, false)}
        </td>
        <td class="text-right text-xs">
          <div>${fmt.currency(m.valor_executado)}</div>
          <div class="text-muted">de ${fmt.currency(m.valor_previsto)}</div>
          <div style="min-width:60px;margin-top:3px;">${progressBar(percFin, false)}</div>
        </td>
        <td class="text-xs">
          <div>${fmt.date(m.data_inicio)}</div>
          <div class="text-muted">→ ${fmt.date(m.data_fim)}</div>
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

/* ── Filtros ── */
function filterMetas() {
  const q  = (document.getElementById('meta-search')?.value||'').toLowerCase();
  const pr = document.getElementById('meta-filter-projeto')?.value||'';
  const st = document.getElementById('meta-filter-status')?.value||'';
  const filtered = metasData.filter(m => {
    const mQ = !q  || (m.descricao_meta||'').toLowerCase().includes(q);
    const mP = !pr || m.projeto_id===pr;
    const mS = !st || m.status===st;
    return mQ && mP && mS;
  });
  renderMetasTable(filtered);
}

/* ── Modal ── */
function openModalMeta(id=null) {
  metaEditId = id;
  document.getElementById('modal-meta-title').textContent = id ? 'Editar Meta' : 'Nova Meta';
  const f = document.getElementById('form-meta');
  f.reset();
  if (id) {
    const m = metasData.find(x => x.id===id);
    if (m) Object.keys(m).forEach(k => { const el=f.elements[k]; if(el) el.value=m[k]??''; });
  }
  document.getElementById('modal-meta').classList.add('open');
}

function closeModalMeta() {
  document.getElementById('modal-meta')?.classList.remove('open');
  metaEditId = null;
}

function editMeta(id) { openModalMeta(id); }

async function saveMeta() {
  const form = document.getElementById('form-meta');
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.projeto_id)           { showToast('Selecione o projeto', 'error'); return; }
  if (!data.descricao_meta?.trim()){ showToast('Descrição obrigatória', 'error'); return; }
  ['numero_meta','valor_previsto','valor_executado',
   'beneficiarios_previstos','beneficiarios_atendidos','percentual_fisico'].forEach(k => {
    data[k] = Number(data[k])||0;
  });
  try {
    if (metaEditId) {
      await DB.update('ong_metas', metaEditId, data);
      showToast('Meta atualizada!');
    } else {
      data.id = genId();
      await DB.insert('ong_metas', data);
      showToast('Meta criada!');
    }
    CACHE.clear();
    closeModalMeta();
    await loadMetas();
  } catch(err) { showToast('Erro: ' + err.message, 'error'); }
}

async function deleteMeta(id) {
  if (!confirmDialog('Excluir esta meta?')) return;
  try {
    await DB.delete('ong_metas', id);
    showToast('Meta excluída!');
    CACHE.clear();
    await loadMetas();
  } catch(err) { showToast('Erro: ' + err.message, 'error'); }
}

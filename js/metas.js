/* =============================================
   ONG GESTOR v5 — Metas e Indicadores
   Módulo integrado ao Plano de Trabalho (page-plano, aba Metas)
   ============================================= */

let metasData        = [];
let projetosMetaData = [];
let metaEditId       = null;

/* ════════════════════════════════════════════
   HELPER: Calcula valor executado de uma meta
   dinamicamente a partir das despesas reais.

   Estratégia proporcional:
   - Pega todas as despesas do projeto (via rubricas)
   - Calcula o share desta meta = valor_previsto_meta / total_previsto_rubricas_do_projeto
   - execMeta = totalDespesasProjeto * shareMeta

   Fallback para m.valor_executado se não houver dados de despesas/rubricas.
════════════════════════════════════════════ */
function calcExecMeta(meta, despesas, rubricas) {
  if (!despesas || !rubricas) {
    return Number(meta.valor_executado) || 0;
  }

  const projId = meta.projeto_id;

  // Total de despesas do projeto (soma de todas as despesas cujo projeto_id == projId
  // OU cujas rubricas pertencem ao projeto)
  const despProjeto = despesas.filter(d => {
    if (d.projeto_id === projId) return true;
    const rub = rubricas.find(r => r.id === d.rubrica_id);
    return rub && rub.projeto_id === projId;
  });

  const totalDespProjeto = despProjeto.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  if (totalDespProjeto === 0) return 0;

  // Total de valor_previsto de todas as rubricas do projeto
  const rubricasProjeto = rubricas.filter(r => r.projeto_id === projId);
  const totalPrevistoProjeto = rubricasProjeto.reduce((s, r) => s + (Number(r.valor_previsto) || 0), 0);

  if (totalPrevistoProjeto === 0) {
    // Fallback: distribui igualmente entre as metas do projeto
    const metasProjeto = (typeof _planoMetas !== 'undefined' && Array.isArray(_planoMetas))
      ? _planoMetas.filter(m => m.projeto_id === projId)
      : metasData.filter(m => m.projeto_id === projId);
    const nMetas = Math.max(metasProjeto.length, 1);
    return totalDespProjeto / nMetas;
  }

  // Share proporcional desta meta
  const valorPrevMeta = Number(meta.valor_previsto) || 0;
  const share = valorPrevMeta / totalPrevistoProjeto;
  return totalDespProjeto * share;
}

/* ════════════════════════════════════════════
   CARREGAR METAS
   Redireciona para Plano de Trabalho (aba Metas)
   — chamado por links legados ou navegação direta
════════════════════════════════════════════ */
async function loadMetas() {
  navigateTo('plano');
  if (typeof switchPlanoTab === 'function') {
    setTimeout(() => switchPlanoTab('metas'), 150);
  }
}

/* ════════════════════════════════════════════
   POPULA SELECT DE PROJETOS
════════════════════════════════════════════ */
function populateProjetoSelectMeta(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const projs   = CACHE.projetos || projetosMetaData;
  const isFilter = id.includes('filter');
  sel.innerHTML  = isFilter
    ? '<option value="">Todos os Projetos</option>'
    : '<option value="">Selecione o Projeto</option>';
  projs.forEach(p => {
    const o = document.createElement('option');
    o.value       = p.id;
    o.textContent = `${p.numero_proposta || ''} — ${(p.nome_projeto || '').slice(0, 40)}`.replace(/^— /, '');
    sel.appendChild(o);
  });
}

/* ════════════════════════════════════════════
   KPIs DE METAS
   Renderiza no pane-metas do plano (ids: meta-kpi-*)
════════════════════════════════════════════ */
function renderMetasKpis() {
  // Usa _planoMetas do plano.js se disponível, senão metasData local
  const metas    = (typeof _planoMetas !== 'undefined' && Array.isArray(_planoMetas))
    ? _planoMetas : metasData;
  const despesas = CACHE.despesas || [];
  const rubricas = CACHE.rubricas || [];

  const total   = metas.length;
  const conc    = metas.filter(m => m.status === 'Concluída').length;
  const em      = metas.filter(m => m.status === 'Em Andamento').length;
  const atr     = metas.filter(m => m.status === 'Atrasada').length;
  const benPrev = metas.reduce((s, m) => s + (Number(m.beneficiarios_previstos) || 0), 0);
  const benAten = metas.reduce((s, m) => s + (Number(m.beneficiarios_atendidos) || 0), 0);
  const percB   = calcPercent(benAten, benPrev);
  const avgF    = total > 0
    ? metas.reduce((s, m) => s + (Number(m.percentual_fisico) || 0), 0) / total : 0;

  // Execução financeira dinâmica (soma de todas as metas)
  const totalExecFin = metas.reduce((s, m) => s + calcExecMeta(m, despesas, rubricas), 0);
  const totalPrevFin = metas.reduce((s, m) => s + (Number(m.valor_previsto) || 0), 0);
  const percFin = calcPercent(totalExecFin, totalPrevFin);

  if (typeof _kpiSetWithAnimation === 'function') {
    _kpiSetWithAnimation('meta-kpi-total',      total, Math.round);
    _kpiSetWithAnimation('meta-kpi-concluidas', conc,  Math.round);
    _kpiSetWithAnimation('meta-kpi-andamento',  em,    Math.round);
    _kpiSetWithAnimation('meta-kpi-atrasadas',  atr,   Math.round);
  } else {
    setText('meta-kpi-total',      total);
    setText('meta-kpi-concluidas', conc);
    setText('meta-kpi-andamento',  em);
    setText('meta-kpi-atrasadas',  atr);
  }

  setText('meta-kpi-benef',  `${fmt.number(benAten)} / ${fmt.number(benPrev)}`);
  setText('meta-kpi-fisico', fmt.percent(avgF));

  const bar = document.getElementById('meta-prog-benef');
  if (bar) {
    bar.style.width = percB + '%';
    bar.className   = `progress-bar-fill ${progressColor(percB)}`;
  }
}

/* ════════════════════════════════════════════
   TABELA DE METAS
   Renderiza em #metas-tbody (dentro do plano-pane-metas)
════════════════════════════════════════════ */
function renderMetasTable(metas) {
  const tbody = document.getElementById('metas-tbody');
  if (!tbody) return;

  const projs     = CACHE.projetos  || projetosMetaData;
  const despesas  = CACHE.despesas  || [];
  const rubricas  = CACHE.rubricas  || [];

  if (!metas || !metas.length) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state">
          <i class="fas fa-bullseye"></i>
          <p>Nenhuma meta cadastrada para este projeto.</p>
          <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openModalMeta()">
            <i class="fas fa-plus"></i> Nova Meta
          </button>
        </div>
      </td></tr>`;
    return;
  }

  /* Agrupa por projeto */
  const byProj = {};
  metas.forEach(m => {
    if (!byProj[m.projeto_id]) byProj[m.projeto_id] = [];
    byProj[m.projeto_id].push(m);
  });

  const multiProj = Object.keys(byProj).length > 1;
  let html = '';

  Object.entries(byProj).forEach(([projId, list]) => {
    const proj        = projs.find(p => p.id === projId);
    const benPrevProj = list.reduce((s, m) => s + (Number(m.beneficiarios_previstos) || 0), 0);
    const benAtenProj = list.reduce((s, m) => s + (Number(m.beneficiarios_atendidos) || 0), 0);
    const percBProj   = calcPercent(benAtenProj, benPrevProj);
    const concl       = list.filter(m => m.status === 'Concluída').length;
    const atras       = list.filter(m => m.status === 'Atrasada').length;

    if (multiProj) {
      html += `
      <tr style="background:linear-gradient(90deg,rgba(37,99,235,.04),transparent);border-top:2px solid var(--primary-light);">
        <td colspan="8">
          <div class="flex justify-between items-center flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <div class="kpi-icon blue" style="width:30px;height:30px;font-size:.75rem;border-radius:8px;flex-shrink:0;">
                <i class="fas fa-folder"></i>
              </div>
              <span class="font-semibold" style="font-size:.85rem;color:var(--primary-darker);">${proj?.nome_projeto || projId}</span>
              <span class="text-xs text-muted">${proj?.numero_proposta || ''}</span>
            </div>
            <div class="flex gap-2 items-center flex-wrap">
              <span class="badge badge-gray">${list.length} meta${list.length !== 1 ? 's' : ''}</span>
              ${concl ? `<span class="badge badge-green">${concl} concluída${concl !== 1 ? 's' : ''}</span>` : ''}
              ${atras ? `<span class="badge badge-red">${atras} atrasada${atras !== 1 ? 's' : ''}</span>` : ''}
              <span class="text-xs text-muted">${fmt.number(benAtenProj)} / ${fmt.number(benPrevProj)} benef. (${fmt.percent(percBProj)})</span>
            </div>
          </div>
        </td>
      </tr>`;
    }

    list.sort((a, b) => (a.numero_meta || 0) - (b.numero_meta || 0)).forEach((m, idx) => {
      const percF      = Number(m.percentual_fisico) || 0;
      const execDin    = calcExecMeta(m, despesas, rubricas);
      const percFin    = calcPercent(execDin, m.valor_previsto);
      const percBen    = calcPercent(m.beneficiarios_atendidos, m.beneficiarios_previstos);

      let prazoClass = '';
      if (m.data_fim && m.status !== 'Concluída') {
        const dias = Math.ceil((new Date(m.data_fim) - new Date()) / 86400000);
        if (dias < 0)        prazoClass = 'text-danger font-semibold';
        else if (dias <= 30) prazoClass = 'text-warning font-semibold';
      }

      html += `
      <tr style="animation:pageFadeIn .2s ease ${idx * 0.03}s both;">
        <td class="font-semibold text-center" style="font-size:.95rem;color:var(--primary);">${m.numero_meta ?? (idx + 1)}</td>
        <td>
          <div class="font-semibold" style="font-size:.82rem;">${m.descricao_meta || '-'}</div>
          ${m.indicador ? `<div class="text-xs text-muted" style="margin-top:2px;"><i class="fas fa-chart-line" style="color:var(--primary);"></i> ${m.indicador}</div>` : ''}
        </td>
        <td class="text-center">
          <div class="font-semibold" style="font-size:.9rem;">
            <span id="meta-ben-aten-${m.id}">${fmt.number(m.beneficiarios_atendidos ?? 0)}</span>
          </div>
          <div class="text-xs text-muted">/ <span id="meta-ben-prev-${m.id}">${fmt.number(m.beneficiarios_previstos ?? 0)}</span></div>
          <div style="min-width:60px;margin-top:4px;" id="meta-ben-bar-${m.id}">${progressBar(percBen, false)}</div>
        </td>
        <td style="min-width:110px;">
          <div class="flex justify-between mb-1">
            <span class="text-xs text-muted">Física</span>
            <span class="text-xs font-semibold" id="meta-perc-${m.id}">${fmt.percent(percF)}</span>
          </div>
          <div id="meta-perc-bar-${m.id}">${progressBar(percF, false)}</div>
        </td>
        <td class="text-right">
          <div class="text-sm font-semibold">${fmt.currency(execDin)}</div>
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
            <button class="btn btn-outline btn-xs btn-icon" onclick="editMeta('${m.id}')" title="Editar meta completa">
              <i class="fas fa-pencil"></i>
            </button>
            <button class="btn btn-primary btn-xs btn-icon" onclick="openModalProgresso('${m.id}')" title="Atualizar Progresso Rápido">
              <i class="fas fa-chart-line"></i>
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
   FILTROS DE METAS
════════════════════════════════════════════ */
function filterMetas() {
  const q  = (document.getElementById('meta-search')?.value        || '').toLowerCase();
  const pr = document.getElementById('meta-filter-projeto')?.value || '';
  const st = document.getElementById('meta-filter-status')?.value  || '';

  const source = (typeof _planoMetas !== 'undefined' && Array.isArray(_planoMetas))
    ? _planoMetas : metasData;

  const filtered = source.filter(m => {
    const mQ = !q  || (m.descricao_meta || '').toLowerCase().includes(q) || (m.indicador || '').toLowerCase().includes(q);
    const mP = !pr || m.projeto_id === pr;
    const mS = !st || m.status === st;
    return mQ && mP && mS;
  });
  renderMetasTable(filtered);
}

/* ════════════════════════════════════════════
   MODAL META — ABRIR
════════════════════════════════════════════ */
function openModalMeta(id = null) {
  metaEditId = id;
  const titleEl = document.getElementById('modal-meta-title');
  if (titleEl) titleEl.textContent = id ? 'Editar Meta' : 'Nova Meta';

  const f = document.getElementById('form-meta');
  if (!f) return;
  f.reset();

  // Popula select de projeto
  populateProjetoSelectMeta('meta-projeto-sel');

  // Pré-seleciona projeto do plano se disponível
  const projId = typeof _planoProjetoId !== 'undefined' ? _planoProjetoId : null;
  if (projId) {
    const sel = document.getElementById('meta-projeto-sel');
    if (sel) sel.value = projId;
  }

  // Carrega dados para edição
  if (id) {
    const source = (typeof _planoMetas !== 'undefined' && Array.isArray(_planoMetas))
      ? _planoMetas : metasData;
    const m = source.find(x => x.id === id);
    if (m) {
      Object.keys(m).forEach(k => {
        const el = f.elements[k];
        if (el) el.value = m[k] ?? '';
      });
    }
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

  if (!data.projeto_id)              { showToast('Selecione o projeto', 'error'); return; }
  if (!data.descricao_meta?.trim())  { showToast('Descrição é obrigatória', 'error'); return; }

  ['numero_meta', 'valor_previsto', 'valor_executado',
   'beneficiarios_previstos', 'beneficiarios_atendidos', 'percentual_fisico'].forEach(k => {
    data[k] = Number(data[k]) || 0;
  });

  if (data.percentual_fisico > 100) {
    showToast('Execução física não pode ultrapassar 100%', 'warning');
    data.percentual_fisico = 100;
  }

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
    // Recarrega o Plano de Trabalho se estivermos nessa página
    if (typeof loadPlano === 'function' && currentPage === 'plano') {
      await loadPlano();
    }
  } catch (err) {
    showToast('Erro ao salvar meta: ' + err.message, 'error');
    console.error('saveMeta:', err);
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
  }
}

/* ════════════════════════════════════════════
   EXCLUIR META
════════════════════════════════════════════ */
async function deleteMeta(id) {
  const confirmado = await confirmDialog(
    'Excluir esta meta permanentemente?\n\nAs fases e itens de aplicação vinculados também serão excluídos.',
    'Excluir Meta', 'danger'
  );
  if (!confirmado) return;

  try {
    await DB.delete('ong_metas', id);
    showToast('Meta excluída.', 'success');
    CACHE.clear();
    if (typeof loadPlano === 'function' && currentPage === 'plano') {
      await loadPlano();
    }
  } catch (err) {
    showToast('Erro ao excluir meta: ' + err.message, 'error');
    console.error('deleteMeta:', err);
  }
}

/* ════════════════════════════════════════════
   MODAL PROGRESSO RÁPIDO
   Atualiza % física, beneficiários e status sem abrir o form completo
════════════════════════════════════════════ */
let _progressoMetaId = null;

function openModalProgresso(metaId) {
  _progressoMetaId = metaId;
  const source = (typeof _planoMetas !== 'undefined' && Array.isArray(_planoMetas))
    ? _planoMetas : metasData;
  const m = source.find(x => x.id === metaId);
  if (!m) return;

  // Preenche o mini-modal
  const el = id => document.getElementById(id);
  if (el('prog-meta-titulo'))      el('prog-meta-titulo').textContent      = `Meta ${m.numero_meta} — ${(m.descricao_meta||'').slice(0,50)}`;
  if (el('prog-perc-fisico'))      el('prog-perc-fisico').value            = Number(m.percentual_fisico)||0;
  if (el('prog-ben-atendidos'))    el('prog-ben-atendidos').value          = Number(m.beneficiarios_atendidos)||0;
  if (el('prog-ben-previstos'))    el('prog-ben-previstos').value          = Number(m.beneficiarios_previstos)||0;
  if (el('prog-status'))           el('prog-status').value                 = m.status || 'Em Andamento';
  if (el('prog-perc-display'))     el('prog-perc-display').textContent     = `${Number(m.percentual_fisico)||0}%`;

  // Atualiza display do slider ao mover
  const slider = el('prog-perc-fisico');
  if (slider) {
    slider.oninput = function() {
      if (el('prog-perc-display')) el('prog-perc-display').textContent = this.value + '%';
    };
  }

  document.getElementById('modal-progresso')?.classList.add('open');
}

function closeModalProgresso() {
  document.getElementById('modal-progresso')?.classList.remove('open');
  _progressoMetaId = null;
}

async function saveProgresso() {
  if (!_progressoMetaId) return;
  const el = id => document.getElementById(id);

  const percFisico   = Math.min(100, Math.max(0, Number(el('prog-perc-fisico')?.value)   || 0));
  const benAtendidos = Math.max(0,                Number(el('prog-ben-atendidos')?.value) || 0);
  const benPrevistos = Math.max(0,                Number(el('prog-ben-previstos')?.value) || 0);
  const status       = el('prog-status')?.value || 'Em Andamento';

  const btn = document.getElementById('btn-salvar-progresso');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  try {
    await DB.update('ong_metas', _progressoMetaId, {
      percentual_fisico:      percFisico,
      beneficiarios_atendidos: benAtendidos,
      beneficiarios_previstos: benPrevistos,
      status
    });

    // Atualiza cache local sem recarregar tudo
    const source = (typeof _planoMetas !== 'undefined' && Array.isArray(_planoMetas))
      ? _planoMetas : metasData;
    const m = source.find(x => x.id === _progressoMetaId);
    if (m) {
      m.percentual_fisico      = percFisico;
      m.beneficiarios_atendidos = benAtendidos;
      m.beneficiarios_previstos = benPrevistos;
      m.status                 = status;
    }
    // Invalida cache global
    if (CACHE.metas) {
      const gm = CACHE.metas.find(x => x.id === _progressoMetaId);
      if (gm) {
        gm.percentual_fisico       = percFisico;
        gm.beneficiarios_atendidos = benAtendidos;
        gm.beneficiarios_previstos = benPrevistos;
        gm.status                  = status;
      }
    }

    showToast('Progresso atualizado!', 'success');
    closeModalProgresso();

    // Re-renderiza a tabela de metas sem buscar do servidor
    renderMetasTable(source.filter(x =>
      typeof _planoProjetoId !== 'undefined' ? x.projeto_id === _planoProjetoId : true
    ));
    renderMetasKpis();

  } catch(err) {
    showToast('Erro ao salvar progresso: ' + err.message, 'error');
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
  }
}

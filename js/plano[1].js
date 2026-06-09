/* =============================================
   ONG GESTOR v5 — Plano de Trabalho SUPREMO
   Seção 5: Metas | Seção 6: Fases | Seção 9: Plano de Aplicação
   ============================================= */

/* ─────────────────────────────────────────────
   ESTADO LOCAL
───────────────────────────────────────────── */
let _planoFases      = [];
let _planoItens      = [];
let _planoMetas      = [];
let _planoProjetoId  = null;
let _faseEditId      = null;
let _aplEditId       = null;
let _planoCurrentTab = 'metas';

/* ─────────────────────────────────────────────
   TABS DO PLANO
───────────────────────────────────────────── */
function switchPlanoTab(tabKey) {
  _planoCurrentTab = tabKey;
  // tabs header
  document.querySelectorAll('#plano-inner-tabs .page-inner-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`plano-tab-${tabKey}`);
  if (tabEl) tabEl.classList.add('active');
  // panes
  document.querySelectorAll('#page-plano .page-inner-pane').forEach(p => p.classList.remove('active'));
  const paneEl = document.getElementById(`plano-pane-${tabKey}`);
  if (paneEl) paneEl.classList.add('active');
  // Atualiza botão de ação do header
  const btnTxt  = document.getElementById('btn-action-text');
  const btnIcon = document.getElementById('btn-action-icon');
  if (tabKey === 'metas') {
    if (btnTxt)  btnTxt.textContent = 'Nova Meta';
    if (btnIcon) btnIcon.className  = 'fas fa-bullseye';
    if (PAGES && PAGES['plano']) PAGES['plano'].action = () => openModalMeta();
  } else if (tabKey === 'hierarquia') {
    if (btnTxt)  btnTxt.textContent = 'Nova Fase';
    if (btnIcon) btnIcon.className  = 'fas fa-layer-group';
    if (PAGES && PAGES['plano']) PAGES['plano'].action = () => openModalFase();
  } else {
    if (btnTxt)  btnTxt.textContent = 'Novo Item';
    if (btnIcon) btnIcon.className  = 'fas fa-list-alt';
    if (PAGES && PAGES['plano']) PAGES['plano'].action = () => openModalPlanoAplicacao();
  }
}

/* ─────────────────────────────────────────────
   CARREGAR PÁGINA PLANO
───────────────────────────────────────────── */
async function loadPlano() {
  // Preenche select de projetos se necessário
  const sel = document.getElementById('plano-select-projeto');
  if (sel && sel.options.length <= 1) {
    const projs = CACHE.projetos || await DB.getAll('ong_projetos');
    CACHE.projetos = projs;
    projs.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.nome_projeto;
      sel.appendChild(o);
    });
  }
  // Preenche select de metas nos modais
  populateProjetoSelectMeta('meta-filter-projeto');
  populateProjetoSelectMeta('meta-projeto-sel');

  _planoProjetoId = sel?.value || null;

  if (!_planoProjetoId) {
    _resetPlanoKpis();
    document.getElementById('plano-conteudo').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-sitemap"></i>
        <p>Selecione um projeto acima para visualizar as Etapas/Fases.</p>
      </div>`;
    document.getElementById('plano-aplicacao-conteudo').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-list-alt"></i>
        <p>Selecione um projeto acima para visualizar o Plano de Aplicação.</p>
      </div>`;
    const tbody = document.getElementById('metas-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-bullseye"></i><p>Selecione um projeto para ver as metas.</p></div></td></tr>`;
    return;
  }

  // Loading indicators
  document.getElementById('plano-conteudo').innerHTML = `<div class="loading-spinner" style="padding:40px 0;"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--primary);"></i><p style="margin-top:10px;color:var(--gray-500);">Carregando plano de trabalho...</p></div>`;
  document.getElementById('plano-aplicacao-conteudo').innerHTML = `<div class="loading-spinner" style="padding:40px 0;"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--primary);"></i></div>`;

  try {
    const [metas, fases, itens, despesas, rubricas] = await Promise.all([
      DB.getAll('ong_metas'),
      DB.getAll('ong_fases').catch(() => []),
      DB.getAll('ong_plano_aplicacao').catch(() => []),
      CACHE.despesas ? Promise.resolve(CACHE.despesas) : DB.getAll('ong_despesas').catch(() => []),
      CACHE.rubricas ? Promise.resolve(CACHE.rubricas) : DB.getAll('ong_rubricas').catch(() => [])
    ]);

    // Filtra pelo projeto
    _planoMetas = (metas || []).filter(m => m.projeto_id === _planoProjetoId);
    _planoFases = (fases  || []).filter(f => f.projeto_id === _planoProjetoId);
    _planoItens = (itens  || []).filter(i => i.projeto_id === _planoProjetoId);

    // Atualiza caches globais (inclui despesas e rubricas para cálculo dinâmico das metas)
    CACHE.metas     = metas     || [];
    CACHE.despesas  = (despesas && despesas.length) ? despesas : (CACHE.despesas || []);
    CACHE.rubricas  = (rubricas && rubricas.length) ? rubricas : (CACHE.rubricas || []);

    // KPIs do topo
    _renderPlanoKpis(_planoMetas, _planoFases, _planoItens);

    // Badges nas tabs
    const bM = document.getElementById('plano-badge-metas');
    const bF = document.getElementById('plano-badge-fases');
    const bA = document.getElementById('plano-badge-itens');
    if (bM) bM.textContent = _planoMetas.length;
    if (bF) bF.textContent = _planoFases.length;
    if (bA) bA.textContent = _planoItens.length;

    // Renderiza KPIs de metas
    renderMetasKpis();

    // Renderiza tabela de metas
    renderMetasTable(_planoMetas);

    // Renderiza hierarquia (fases)
    renderPlanoHierarquia(_planoMetas, _planoFases, _planoItens);

    // Renderiza plano de aplicação separado
    renderPlanoAplicacaoTable(_planoItens, _planoMetas, _planoFases);

  } catch(err) {
    showToast('Erro ao carregar Plano de Trabalho: ' + err.message, 'error');
    document.getElementById('plano-conteudo').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle" style="color:var(--danger);opacity:.5;"></i>
        <p>Falha ao carregar. ${err.message}</p>
      </div>`;
    console.error(err);
  }
}

/* ─────────────────────────────────────────────
   KPIs DO PLANO (topo)
───────────────────────────────────────────── */
function _renderPlanoKpis(metas, fases, itens) {
  const fasesConc  = fases.filter(f => f.status === 'Concluída').length;
  const valorTotal = itens.reduce((s, i) => s + (Number(i.valor_previsto) || 0), 0);
  const execFisica = metas.length
    ? metas.reduce((s, m) => s + (Number(m.percentual_fisico) || 0), 0) / metas.length
    : 0;

  if (typeof _kpiSetWithAnimation === 'function') {
    _kpiSetWithAnimation('plano-kpi-metas',      metas.length,  Math.round);
    _kpiSetWithAnimation('plano-kpi-fases',      fases.length,  Math.round);
    _kpiSetWithAnimation('plano-kpi-fases-conc', fasesConc,     Math.round);
    _kpiSetWithAnimation('plano-kpi-itens',      itens.length,  Math.round);
  } else {
    setText('plano-kpi-metas',      metas.length);
    setText('plano-kpi-fases',      fases.length);
    setText('plano-kpi-fases-conc', fasesConc);
    setText('plano-kpi-itens',      itens.length);
  }
  setText('plano-kpi-valor', fmt.currency(valorTotal));
  setText('plano-kpi-exec',  fmt.percent(execFisica));
}

function _resetPlanoKpis() {
  ['plano-kpi-metas','plano-kpi-fases','plano-kpi-fases-conc',
   'plano-kpi-itens','plano-kpi-valor','plano-kpi-exec'].forEach(id => setText(id, '—'));
}

/* ─────────────────────────────────────────────
   RENDERIZAR HIERARQUIA (pane-hierarquia)
   Mostra Fases agrupadas por Meta
───────────────────────────────────────────── */
function renderPlanoHierarquia(metas, fases, itens) {
  const container = document.getElementById('plano-conteudo');
  if (!container) return;

  if (!metas.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bullseye"></i>
        <p>Nenhuma meta cadastrada para este projeto.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="switchPlanoTab('metas');openModalMeta();">
          <i class="fas fa-plus"></i> Cadastrar Meta
        </button>
      </div>`;
    return;
  }

  const metasSort = [...metas].sort((a,b) => (a.numero_meta||0) - (b.numero_meta||0));
  let html = '';

  metasSort.forEach((meta, mIdx) => {
    const metaFases = fases.filter(f => f.meta_id === meta.id)
                           .sort((a,b) => (a.numero_fase||0) - (b.numero_fase||0));
    const metaItens = itens.filter(i => i.meta_id === meta.id);
    const valorMeta = metaItens.reduce((s,i) => s + (Number(i.valor_previsto)||0), 0)
                  || metaFases.reduce((s,f) => s + (Number(f.valor_previsto)||0), 0);
    const execPerc  = Number(meta.percentual_fisico) || 0;
    const statusCls = _metaStatusClass(meta.status);
    const fasesConc = metaFases.filter(f => f.status === 'Concluída').length;

    html += `
    <div class="plano-meta-card card card-accent-blue mb-3" style="animation:pageFadeIn .3s ease ${mIdx*0.07}s both;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border-light);">
        <div style="flex:1;min-width:0;">
          <div class="flex items-center gap-2 mb-1">
            <span class="badge badge-blue" style="font-size:.7rem;padding:3px 8px;">Meta ${meta.numero_meta || (mIdx+1)}</span>
            <span class="${statusCls}" style="font-size:.75rem;">${meta.status || 'Em Andamento'}</span>
          </div>
          <div class="font-semibold" style="font-size:.97rem;color:var(--gray-800);">${meta.descricao_meta || 'Sem descrição'}</div>
          ${meta.indicador ? `<div class="text-xs text-muted mt-1"><i class="fas fa-chart-line" style="color:var(--primary);"></i> ${meta.indicador}</div>` : ''}
        </div>
        <div class="flex gap-2 items-center" style="flex-shrink:0;">
          <div style="text-align:right;">
            <div class="text-xs text-muted">Exec. Física</div>
            <div class="font-semibold text-sm ${execPerc>=100?'text-success':execPerc>=50?'text-warning':'text-primary'}">${fmt.percent(execPerc)}</div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-primary btn-xs" title="Nova Fase nesta Meta" onclick="openModalFase('${meta.id}')">
              <i class="fas fa-plus"></i> Fase
            </button>
            <button class="btn btn-outline btn-xs" title="Novo Item de Aplicação para esta Meta" onclick="openModalPlanoAplicacao('${meta.id}')">
              <i class="fas fa-list-alt"></i> Item
            </button>
          </div>
        </div>
      </div>
      <div style="padding:8px 20px;background:var(--gray-50);border-bottom:1px solid var(--border-light);">
        <div class="flex justify-between mb-1">
          <span class="text-xs text-muted">${fasesConc}/${metaFases.length} fases concluídas</span>
          <span class="text-xs font-semibold">${fmt.percent(execPerc)}</span>
        </div>
        <div class="progress-bar-wrap" style="height:6px;">
          <div class="progress-bar-fill ${progressColor(execPerc)}" style="width:${Math.min(execPerc,100)}%;"></div>
        </div>
      </div>
      <div style="padding:16px 20px;">
        ${metaFases.length === 0
          ? `<div class="text-center text-sm" style="color:var(--gray-400);padding:20px 0;">
               <i class="fas fa-layer-group" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:.3;"></i>
               Nenhuma etapa/fase cadastrada para esta meta.
               <button class="btn btn-outline btn-sm" style="margin-top:10px;display:block;margin-left:auto;margin-right:auto;" onclick="openModalFase('${meta.id}')">
                 <i class="fas fa-plus"></i> Adicionar Fase
               </button>
             </div>`
          : `<div class="plano-section-label mb-2">
               <i class="fas fa-layer-group"></i> Etapas / Fases — Seção 6
             </div>
             <div class="table-wrapper">
               <table style="font-size:.82rem;">
                 <thead>
                   <tr>
                     <th style="width:50px;">Fase</th>
                     <th>Descrição</th>
                     <th>Produto/Entrega</th>
                     <th class="text-center">Qtd Prev.</th>
                     <th class="text-center">Qtd Real.</th>
                     <th>Período</th>
                     <th class="text-right">Valor</th>
                     <th>Status</th>
                     <th>Ações</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${metaFases.map((fase, fIdx) => {
                     const valorFase = itens.filter(i => i.fase_id === fase.id)
                       .reduce((s,i) => s+(Number(i.valor_previsto)||0), 0)
                       || (Number(fase.valor_previsto)||0);
                     const faseStat    = fase.status || 'Não Iniciada';
                     const faseStatCls = faseStat === 'Concluída' ? 'text-success' :
                                         faseStat === 'Atrasada'  ? 'text-danger'  :
                                         faseStat === 'Em Andamento' ? 'text-primary' : 'text-muted';
                     const percReal = fase.quantidade_prevista > 0
                       ? Math.round((Number(fase.quantidade_realizada)||0) / Number(fase.quantidade_prevista) * 100) : 0;
                     const statColor = faseStat==='Concluída'?'#0e9f6e':faseStat==='Atrasada'?'#e02424':faseStat==='Em Andamento'?'#2563eb':'#6b7280';
                     return `<tr id="fase-row-${fase.id}">
                       <td class="text-center font-semibold text-primary">${fase.numero_fase || (fIdx+1)}</td>
                       <td style="max-width:200px;">${fase.descricao_fase || '—'}</td>
                       <td class="text-muted text-xs">${fase.produto || '—'} ${fase.unidade_medida ? `<span style="color:var(--gray-400);">/ ${fase.unidade_medida}</span>` : ''}</td>
                       <td class="text-center">${fase.quantidade_prevista ?? '—'}</td>
                       <td class="text-center" style="min-width:120px;">
                         <div class="flex items-center gap-1 justify-center">
                           <input type="number" 
                             id="fase-qtd-real-${fase.id}"
                             class="form-control" 
                             style="width:60px;padding:3px 5px;font-size:.78rem;text-align:center;border-radius:5px;"
                             value="${fase.quantidade_realizada ?? 0}" 
                             min="0"
                             title="Quantidade Realizada">
                           <button class="btn btn-xs btn-primary btn-icon" 
                             onclick="salvarFaseRapido('${fase.id}')"
                             title="Salvar quantidade realizada">
                             <i class="fas fa-check"></i>
                           </button>
                         </div>
                         ${fase.quantidade_prevista>0 ? `<div class="text-xs text-muted mt-1" id="fase-perc-${fase.id}">${percReal}% concluído</div>` : ''}
                       </td>
                       <td class="text-xs text-muted">${fmt.date(fase.data_inicio)} → ${fmt.date(fase.data_fim)}</td>
                       <td class="text-right font-semibold">${fmt.currency(valorFase)}</td>
                       <td style="min-width:130px;">
                         <select class="form-control" 
                           id="fase-status-${fase.id}"
                           style="font-size:.72rem;padding:3px 6px;border-radius:5px;color:${statColor};font-weight:600;"
                           onchange="salvarFaseStatus('${fase.id}', this.value)">
                           <option value="Não Iniciada"  ${faseStat==='Não Iniciada' ?'selected':''}>Não Iniciada</option>
                           <option value="Em Andamento"  ${faseStat==='Em Andamento' ?'selected':''}>Em Andamento</option>
                           <option value="Concluída"     ${faseStat==='Concluída'    ?'selected':''}>Concluída</option>
                           <option value="Atrasada"      ${faseStat==='Atrasada'     ?'selected':''}>Atrasada</option>
                         </select>
                       </td>
                       <td>
                         <div class="flex gap-1">
                           <button class="btn btn-outline btn-xs btn-icon" onclick="editFase('${fase.id}')" title="Editar Fase"><i class="fas fa-pencil"></i></button>
                           <button class="btn btn-primary btn-xs btn-icon" onclick="openModalPlanoAplicacao('${meta.id}', null, '${fase.id}')" title="Novo Item de Aplicação para esta Fase"><i class="fas fa-list-alt"></i></button>
                           <button class="btn btn-danger btn-xs btn-icon" onclick="deleteFase('${fase.id}')" title="Excluir Fase"><i class="fas fa-trash"></i></button>
                         </div>
                       </td>
                     </tr>`;
                   }).join('')}
                 </tbody>
               </table>
             </div>`
        }
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

/* ─────────────────────────────────────────────
   RENDERIZAR PLANO DE APLICAÇÃO (pane-aplicacao)
───────────────────────────────────────────── */
function renderPlanoAplicacaoTable(itens, metas, fases) {
  const container = document.getElementById('plano-aplicacao-conteudo');
  if (!container) return;

  if (!itens.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-list-alt"></i>
        <p>Nenhum item de aplicação cadastrado.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openModalPlanoAplicacao()">
          <i class="fas fa-plus"></i> Novo Item
        </button>
      </div>`;
    return;
  }

  // Totais
  const totalCusteio = itens.filter(i => i.natureza_despesa === 'Custeio')
    .reduce((s,i) => s+(Number(i.valor_previsto)||0), 0);
  const totalInvest  = itens.filter(i => i.natureza_despesa === 'Investimento')
    .reduce((s,i) => s+(Number(i.valor_previsto)||0), 0);
  const totalGeral   = itens.reduce((s,i) => s+(Number(i.valor_previsto)||0), 0);

  // Agrupa por meta
  const byMeta = {};
  itens.forEach(i => {
    if (!byMeta[i.meta_id]) byMeta[i.meta_id] = [];
    byMeta[i.meta_id].push(i);
  });

  let html = '';
  Object.entries(byMeta).forEach(([metaId, metaItens]) => {
    const meta      = metas.find(m => m.id === metaId);
    const metaTotal = metaItens.reduce((s,i) => s+(Number(i.valor_previsto)||0), 0);
    html += `
    <div class="card mb-3" style="animation:pageFadeIn .3s ease;">
      <div class="card-header" style="background:var(--primary-ultra);">
        <h3 style="font-size:.9rem;color:var(--primary-darker);">
          <i class="fas fa-bullseye text-primary"></i>
          Meta ${meta?.numero_meta || '?'} — ${meta?.descricao_meta || metaId}
        </h3>
        <span class="font-semibold text-primary">${fmt.currency(metaTotal)}</span>
      </div>
      <div class="table-wrapper">
        <table style="font-size:.82rem;">
          <thead>
            <tr>
              <th>Descrição do Item</th>
              <th>Categoria</th>
              <th>Natureza</th>
              <th>Fase/Etapa</th>
              <th class="text-center">Qtd.</th>
              <th class="text-right">Vlr. Unit.</th>
              <th class="text-right">Previsto</th>
              <th>Fonte</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${metaItens.map((item, iIdx) => {
              const faseName = item.fase_id
                ? (fases.find(f => f.id === item.fase_id)?.descricao_fase || '—')
                : '—';
              const natCls = item.natureza_despesa === 'Custeio' ? 'badge-blue'
                : item.natureza_despesa === 'Investimento' ? 'badge-purple' : '';
              return `<tr style="animation:pageFadeIn .2s ease ${iIdx*0.03}s both;">
                <td style="max-width:200px;">${item.descricao || '—'}</td>
                <td class="text-muted text-xs">${item.categoria || '—'}</td>
                <td>${item.natureza_despesa ? `<span class="badge ${natCls}" style="font-size:.65rem;">${item.natureza_despesa}</span>` : '—'}</td>
                <td class="text-xs text-muted" style="max-width:120px;">${faseName}</td>
                <td class="text-center">${item.quantidade ?? '—'} <span class="text-xs text-muted">${item.unidade || ''}</span></td>
                <td class="text-right">${fmt.currency(item.valor_unitario)}</td>
                <td class="text-right font-semibold text-primary">${fmt.currency(item.valor_previsto)}</td>
                <td class="text-xs text-muted">${item.fonte || '—'}</td>
                <td>
                  <div class="flex gap-1">
                    <button class="btn btn-outline btn-xs btn-icon" onclick="editPlanoAplicacao('${item.id}')" title="Editar item"><i class="fas fa-pencil"></i></button>
                    <button class="btn btn-primary btn-xs" onclick="_criarRubricaDeItem('${item.id}')" title="Criar Rubrica Orçamentária baseada neste item" style="font-size:.65rem;padding:3px 7px;">
                      <i class="fas fa-tags"></i> Rubrica
                    </button>
                    <button class="btn btn-danger btn-xs btn-icon" onclick="deletePlanoAplicacao('${item.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  });

  // Resumo financeiro
  html += `
  <div class="card card-accent-teal" style="animation:pageFadeIn .4s ease .2s both;">
    <div class="card-header"><h3><i class="fas fa-calculator text-primary"></i> Resumo Financeiro — Seção 9</h3></div>
    <div class="card-body">
      <div class="grid-4" style="gap:16px;">
        <div style="text-align:center;padding:12px;background:var(--primary-ultra);border-radius:10px;">
          <div class="text-xs text-muted mb-1">Custeio</div>
          <div class="font-bold text-primary" style="font-size:1.1rem;">${fmt.currency(totalCusteio)}</div>
        </div>
        <div style="text-align:center;padding:12px;background:#f3e8ff;border-radius:10px;">
          <div class="text-xs text-muted mb-1">Investimento</div>
          <div class="font-bold text-purple" style="font-size:1.1rem;">${fmt.currency(totalInvest)}</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--success-light);border-radius:10px;">
          <div class="text-xs text-muted mb-1">${itens.length} Itens</div>
          <div class="font-bold text-success" style="font-size:1.1rem;">${fmt.currency(totalGeral)}</div>
        </div>
        <div style="text-align:center;padding:14px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:10px;">
          <div class="text-xs" style="color:rgba(255,255,255,.8);margin-bottom:4px;">TOTAL GERAL</div>
          <div class="font-bold" style="font-size:1.3rem;color:white;">${fmt.currency(totalGeral)}</div>
        </div>
      </div>
    </div>
  </div>`;

  container.innerHTML = html;
}

/* ─────────────────────────────────────────────
   STATUS CSS
───────────────────────────────────────────── */
function _metaStatusClass(status) {
  if (status === 'Concluída')    return 'badge badge-green';
  if (status === 'Atrasada')     return 'badge badge-red';
  if (status === 'Em Andamento') return 'badge badge-blue';
  return 'badge badge-orange';
}

/* ─────────────────────────────────────────────
   MODAL FASE / ETAPA
───────────────────────────────────────────── */
async function openModalFase(metaIdPresel = null, faseId = null) {
  _faseEditId = faseId;
  document.getElementById('modal-fase-title').innerHTML =
    `<i class="fas fa-layer-group text-primary"></i> ${faseId ? 'Editar' : 'Nova'} Etapa / Fase`;

  const form = document.getElementById('form-fase');
  form.reset();
  _hideFaseBanner();

  const projSel = document.getElementById('fase-projeto-sel');
  projSel.innerHTML = '<option value="">Selecione o Projeto</option>';
  const projs = CACHE.projetos || await DB.getAll('ong_projetos');
  projs.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta ? p.numero_proposta + ' — ' : ''}${p.nome_projeto}`;
    projSel.appendChild(o);
  });

  const projId = _planoProjetoId || '';
  if (projId) {
    projSel.value = projId;
    await onFaseProjetoChange(metaIdPresel);
  }

  if (faseId) {
    // Modo edição: carrega dados existentes
    const fase = _planoFases.find(f => f.id === faseId)
              || (await DB.getAll('ong_fases')).find(f => f.id === faseId);
    if (fase) {
      projSel.value = fase.projeto_id;
      await onFaseProjetoChange(fase.meta_id);
      Object.keys(fase).forEach(k => {
        const el = form.elements[k];
        if (el) el.value = fase[k] ?? '';
      });
    }
  } else if (metaIdPresel) {
    // Modo novo com meta pré-selecionada: auto-preenche dados da meta
    await _autoPreencherFaseDaMeta(metaIdPresel);
  }

  document.getElementById('modal-fase').classList.add('open');
  setTimeout(() => form.querySelector('[name="descricao_fase"]')?.focus(), 100);
}

/* ── Auto-preenche Fase com dados da Meta selecionada ── */
async function _autoPreencherFaseDaMeta(metaId) {
  if (!metaId) return;
  const metas = CACHE.metas || await DB.getAll('ong_metas');
  const meta  = metas.find(m => m.id === metaId);
  if (!meta) return;

  const form = document.getElementById('form-fase');

  // Número sequencial: conta fases já existentes para esta meta
  const fasesExistentes = _planoFases.filter(f => f.meta_id === metaId);
  const proximoNum = fasesExistentes.length + 1;
  const nFase = form.elements['numero_fase'];
  if (nFase && !nFase.value) nFase.value = proximoNum;

  // Herda datas da Meta
  if (meta.data_inicio) {
    const dI = form.elements['data_inicio'];
    if (dI && !dI.value) dI.value = meta.data_inicio;
  }
  if (meta.data_fim) {
    const dF = form.elements['data_fim'];
    if (dF && !dF.value) dF.value = meta.data_fim;
  }

  // Mostra banner informativo
  _showFaseBanner(meta);
}

/* ── Banner de pré-preenchimento da Fase ── */
function _showFaseBanner(meta) {
  const b = document.getElementById('fase-prefill-banner');
  if (!b) return;
  b.style.display = '';
  b.innerHTML = `
    <i class="fas fa-magic"></i>
    Pré-preenchido com dados da <strong>Meta ${meta.numero_meta || ''} — ${(meta.descricao_meta||'').substring(0,50)}</strong>.
    Ajuste conforme necessário.`;
}
function _hideFaseBanner() {
  const b = document.getElementById('fase-prefill-banner');
  if (b) b.style.display = 'none';
}

function closeModalFase() {
  document.getElementById('modal-fase')?.classList.remove('open');
  _faseEditId = null;
}

async function onFaseProjetoChange(preselMetaId = null) {
  const projId   = document.getElementById('fase-projeto-sel')?.value;
  const metaSel  = document.getElementById('fase-meta-sel');
  metaSel.innerHTML = '<option value="">Selecione a Meta</option>';
  _hideFaseBanner();
  if (!projId) return;

  const metas = (CACHE.metas || await DB.getAll('ong_metas'))
    .filter(m => m.projeto_id === projId)
    .sort((a,b) => (a.numero_meta||0) - (b.numero_meta||0));

  metas.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = `Meta ${m.numero_meta || ''} — ${(m.descricao_meta || '').substring(0, 50)}`;
    metaSel.appendChild(o);
  });

  if (preselMetaId) {
    metaSel.value = preselMetaId;
    // Ao pré-selecionar a meta, aciona auto-preenchimento
    if (!_faseEditId) await _autoPreencherFaseDaMeta(preselMetaId);
  }
}

/* ── Quando o usuário troca a meta manualmente ── */
async function onFaseMetaChange() {
  if (_faseEditId) return; // não sobrescreve ao editar
  const metaId = document.getElementById('fase-meta-sel')?.value;
  if (metaId) await _autoPreencherFaseDaMeta(metaId);
  else _hideFaseBanner();
}

async function saveFase() {
  const form = document.getElementById('form-fase');
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.projeto_id)         { showToast('Selecione o projeto', 'error'); return; }
  if (!data.meta_id)            { showToast('Selecione a meta', 'error'); return; }
  if (!data.descricao_fase?.trim()) { showToast('Descrição é obrigatória', 'error'); return; }

  ['numero_fase','quantidade_prevista','quantidade_realizada','valor_previsto'].forEach(k => {
    data[k] = Number(data[k]) || null;
  });

  const btn = document.getElementById('btn-salvar-fase');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  try {
    if (_faseEditId) {
      await DB.update('ong_fases', _faseEditId, data);
      showToast('Fase atualizada!', 'success');
    } else {
      data.id = genId();
      await DB.insert('ong_fases', data);
      showToast('Fase criada!', 'success');
    }
    CACHE.clear();
    closeModalFase();
    await loadPlano();
  } catch(err) {
    showToast('Erro ao salvar fase: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Fase'; }
  }
}

async function editFase(id) { await openModalFase(null, id); }

async function deleteFase(id) {
  const ok = await confirmDialog('Excluir esta fase/etapa permanentemente?', 'Excluir Fase', 'danger');
  if (!ok) return;
  try {
    await DB.delete('ong_fases', id);
    showToast('Fase excluída.', 'success');
    CACHE.clear();
    await loadPlano();
  } catch(err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

/* ─────────────────────────────────────────────
   MODAL PLANO DE APLICAÇÃO
───────────────────────────────────────────── */
async function openModalPlanoAplicacao(metaIdPresel = null, itemId = null, faseIdPresel = null) {
  _aplEditId = itemId;
  document.getElementById('modal-plano-apl-title').innerHTML =
    `<i class="fas fa-list-alt text-primary"></i> ${itemId ? 'Editar' : 'Novo'} Item do Plano de Aplicação`;

  const form = document.getElementById('form-plano-aplicacao');
  form.reset();
  _hideAplBanner();

  const projSel = document.getElementById('apl-projeto-sel');
  projSel.innerHTML = '<option value="">Selecione o Projeto</option>';
  const projs = CACHE.projetos || await DB.getAll('ong_projetos');
  projs.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.numero_proposta ? p.numero_proposta + ' — ' : ''}${p.nome_projeto}`;
    projSel.appendChild(o);
  });

  const projId = _planoProjetoId || '';
  if (projId) {
    projSel.value = projId;
    await onAplProjetoChange(metaIdPresel);
  }

  if (itemId) {
    // Modo edição: carrega dados existentes
    const item = _planoItens.find(i => i.id === itemId)
              || (await DB.getAll('ong_plano_aplicacao')).find(i => i.id === itemId);
    if (item) {
      projSel.value = item.projeto_id;
      await onAplProjetoChange(item.meta_id);
      await onAplMetaChange(item.fase_id);
      Object.keys(item).forEach(k => {
        const el = form.elements[k];
        if (el) el.value = item[k] ?? '';
      });
    }
  } else {
    // Modo novo: se vier com fase pré-selecionada, auto-preenche
    if (faseIdPresel) {
      const faseSel = document.getElementById('apl-fase-sel');
      if (faseSel) faseSel.value = faseIdPresel;
      await _autoPreencherAplDaFase(faseIdPresel);
    } else if (metaIdPresel) {
      await _autoPreencherAplDaMeta(metaIdPresel);
    }
  }

  document.getElementById('modal-plano-aplicacao').classList.add('open');
  setTimeout(() => form.querySelector('[name="descricao"]')?.focus(), 100);
}

/* ── Auto-preenche item de Aplicação com dados da Fase ── */
async function _autoPreencherAplDaFase(faseId) {
  if (!faseId) return;
  const fases = _planoFases.length > 0 ? _planoFases
    : (await DB.getAll('ong_fases').catch(() => []));
  const fase = fases.find(f => f.id === faseId);
  if (!fase) return;

  const form = document.getElementById('form-plano-aplicacao');

  // Herda descrição da fase como sugestão
  const descEl = form.elements['descricao'];
  if (descEl && !descEl.value) descEl.value = fase.descricao_fase || '';

  // Herda produto/unidade da fase
  const unEl = form.elements['unidade'];
  if (unEl && !unEl.value && fase.unidade_medida) unEl.value = fase.unidade_medida;

  // Herda quantidade prevista
  const qtdEl = form.elements['quantidade'];
  if (qtdEl && !qtdEl.value && fase.quantidade_prevista) qtdEl.value = fase.quantidade_prevista;

  // Herda valor previsto da fase como valor unitário sugerido
  if (fase.valor_previsto && fase.quantidade_prevista > 0) {
    const vuEl = form.elements['valor_unitario'];
    if (vuEl && !vuEl.value) {
      vuEl.value = (Number(fase.valor_previsto) / Number(fase.quantidade_prevista)).toFixed(2);
    }
  }

  calcAplTotal();
  _showAplBanner(`Fase ${fase.numero_fase || ''} — ${(fase.descricao_fase||'').substring(0,50)}`, 'fase');
}

/* ── Auto-preenche item de Aplicação com dados da Meta ── */
async function _autoPreencherAplDaMeta(metaId) {
  if (!metaId) return;
  const metas = CACHE.metas || await DB.getAll('ong_metas');
  const meta  = metas.find(m => m.id === metaId);
  if (!meta) return;
  _showAplBanner(`Meta ${meta.numero_meta || ''} — ${(meta.descricao_meta||'').substring(0,50)}`, 'meta');
}

/* ── Banners informativos do modal Aplicação ── */
function _showAplBanner(label, tipo) {
  const b = document.getElementById('apl-prefill-banner');
  if (!b) return;
  const icon = tipo === 'fase' ? 'fa-layer-group' : 'fa-bullseye';
  b.style.display = '';
  b.innerHTML = `<i class="fas ${icon}"></i>
    Dados herdados de <strong>${label}</strong>. Revise e ajuste antes de salvar.`;
}
function _hideAplBanner() {
  const b = document.getElementById('apl-prefill-banner');
  if (b) b.style.display = 'none';
}

function closeModalPlanoAplicacao() {
  document.getElementById('modal-plano-aplicacao')?.classList.remove('open');
  _aplEditId = null;
}

async function onAplProjetoChange(preselMetaId = null) {
  const projId  = document.getElementById('apl-projeto-sel')?.value;
  const metaSel = document.getElementById('apl-meta-sel');
  metaSel.innerHTML = '<option value="">Selecione a Meta</option>';
  document.getElementById('apl-fase-sel').innerHTML = '<option value="">Selecione a Meta primeiro</option>';
  _hideAplBanner();
  if (!projId) return;

  const metas = (CACHE.metas || await DB.getAll('ong_metas'))
    .filter(m => m.projeto_id === projId)
    .sort((a,b) => (a.numero_meta||0) - (b.numero_meta||0));

  metas.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = `Meta ${m.numero_meta || ''} — ${(m.descricao_meta || '').substring(0, 50)}`;
    metaSel.appendChild(o);
  });

  if (preselMetaId) {
    metaSel.value = preselMetaId;
    await onAplMetaChange();
    if (!_aplEditId) await _autoPreencherAplDaMeta(preselMetaId);
  }
}

async function onAplMetaChange(preselFaseId = null) {
  const projId  = document.getElementById('apl-projeto-sel')?.value;
  const metaId  = document.getElementById('apl-meta-sel')?.value;
  const faseSel = document.getElementById('apl-fase-sel');
  faseSel.innerHTML = '<option value="">— Toda a meta (sem fase específica) —</option>';
  if (!projId || !metaId) return;

  const fases = (_planoFases.length > 0 ? _planoFases : (await DB.getAll('ong_fases').catch(() => [])))
    .filter(f => f.projeto_id === projId && f.meta_id === metaId)
    .sort((a,b) => (a.numero_fase||0) - (b.numero_fase||0));

  fases.forEach(f => {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = `Fase ${f.numero_fase || ''} — ${(f.descricao_fase || '').substring(0, 50)}`;
    faseSel.appendChild(o);
  });

  if (preselFaseId) {
    faseSel.value = preselFaseId;
    if (!_aplEditId) await _autoPreencherAplDaFase(preselFaseId);
  }
}

/* ── Quando o usuário troca a fase manualmente ── */
async function onAplFaseChange() {
  if (_aplEditId) return; // não sobrescreve ao editar
  const faseId = document.getElementById('apl-fase-sel')?.value;
  if (faseId) await _autoPreencherAplDaFase(faseId);
  else _hideAplBanner();
}

function calcAplTotal() {
  const form = document.getElementById('form-plano-aplicacao');
  const qtd  = Number(form?.elements?.quantidade?.value) || 0;
  const vun  = Number(form?.elements?.valor_unitario?.value) || 0;
  const total = qtd * vun;
  const el = document.getElementById('apl-valor-total');
  if (el && total > 0) el.value = total.toFixed(2);
}

async function savePlanoAplicacao() {
  const form = document.getElementById('form-plano-aplicacao');
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.projeto_id)       { showToast('Selecione o projeto', 'error'); return; }
  if (!data.meta_id)          { showToast('Selecione a meta', 'error'); return; }
  if (!data.descricao?.trim()){ showToast('Descrição é obrigatória', 'error'); return; }

  ['quantidade','valor_unitario','valor_previsto'].forEach(k => {
    data[k] = Number(data[k]) || 0;
  });
  if (!data.valor_previsto && data.quantidade && data.valor_unitario) {
    data.valor_previsto = data.quantidade * data.valor_unitario;
  }
  if (!data.fase_id) data.fase_id = null;

  const btn = document.getElementById('btn-salvar-apl');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  try {
    if (_aplEditId) {
      await DB.update('ong_plano_aplicacao', _aplEditId, data);
      showToast('Item atualizado!', 'success');
    } else {
      data.id = genId();
      await DB.insert('ong_plano_aplicacao', data);
      showToast('Item adicionado!', 'success');
    }
    CACHE.clear();
    closeModalPlanoAplicacao();
    await loadPlano();
  } catch(err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Item'; }
  }
}

async function editPlanoAplicacao(id) { await openModalPlanoAplicacao(null, id); }

async function deletePlanoAplicacao(id) {
  const ok = await confirmDialog('Excluir este item do plano de aplicação?', 'Excluir Item', 'danger');
  if (!ok) return;
  try {
    await DB.delete('ong_plano_aplicacao', id);
    showToast('Item excluído.', 'success');
    CACHE.clear();
    await loadPlano();
  } catch(err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

/* ─────────────────────────────────────────────
   CRIAR RUBRICA A PARTIR DE ITEM DO PLANO DE APLICAÇÃO
   (elimina retrabalho: os dados já estão no plano)
───────────────────────────────────────────── */
function _criarRubricaDeItem(itemId) {
  const item = _planoItens.find(i => i.id === itemId);
  if (!item) { showToast('Item não encontrado', 'error'); return; }

  // Abre modal de rubrica passando o projeto explicitamente (elimina race condition)
  if (typeof openModalRubrica !== 'function') {
    showToast('Módulo de Rubricas não carregado', 'error'); return;
  }
  openModalRubrica(null, item.projeto_id); // projId passa direto para openModalRubrica

  // Preenche campos — o modal já está aberto e populado, sem necessidade de setTimeout
  const f = document.getElementById('form-rubrica');
  if (!f) return;

  // Mapa Plano de Aplicação → Rubrica
  const mapa = {
    projeto_id:     item.projeto_id,
    descricao:      item.descricao,
    categoria:      item.categoria,
    quantidade:     item.quantidade,
    unidade:        item.unidade,
    valor_unitario: item.valor_unitario,
    valor_previsto: item.valor_previsto,
    fonte:          item.fonte
  };
  Object.entries(mapa).forEach(([k, v]) => {
    const el = f.elements[k];
    if (el && v !== undefined && v !== null) el.value = v;
  });

  // O select de projeto agora tem as opções (openModalRubrica chamou _populateRubProjetoSel)
  // Força o valor novamente para garantir seleção visual
  const projSel = document.getElementById('rub-projeto-sel');
  if (projSel) projSel.value = item.projeto_id;

  // Oculta painel de importação (dados já foram injetados)
  const panel = document.getElementById('rub-import-panel');
  if (panel) panel.style.display = 'none';

  // Banner informativo
  const banner = document.getElementById('rub-import-banner');
  if (banner) {
    banner.style.display = '';
    banner.innerHTML = `<i class="fas fa-magic"></i>
      Rubrica pré-preenchida a partir do Plano de Aplicação:
      <strong>${item.descricao || ''}</strong>.
      Revise os valores e salve.`;
  }

  showToast('Rubrica pré-preenchida com dados do Plano de Aplicação!', 'success');
}

/* ─────────────────────────────────────────────
   EXPORTAR CSV
───────────────────────────────────────────── */
function exportPlanoCSV() {
  if (!_planoProjetoId) { showToast('Selecione um projeto', 'warning'); return; }
  const rows = [
    ['Tipo','Meta','Fase','Descrição','Qtd','Vlr Unit','Previsto','Natureza','Fonte','Status']
  ];
  _planoFases.forEach(f => {
    const meta = _planoMetas.find(m => m.id === f.meta_id);
    rows.push([
      'Fase', `Meta ${meta?.numero_meta||'?'} - ${meta?.descricao_meta||''}`,
      `Fase ${f.numero_fase}`, f.descricao_fase||'', f.quantidade_prevista||0,
      '', f.valor_previsto||0, '', '', f.status||''
    ]);
  });
  _planoItens.forEach(i => {
    const meta = _planoMetas.find(m => m.id === i.meta_id);
    const fase = _planoFases.find(f => f.id === i.fase_id);
    rows.push([
      'Item Aplicação', `Meta ${meta?.numero_meta||'?'} - ${meta?.descricao_meta||''}`,
      fase ? `Fase ${fase.numero_fase}` : '', i.descricao||'',
      i.quantidade||0, i.valor_unitario||0, i.valor_previsto||0,
      i.natureza_despesa||'', i.fonte||'', ''
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:`plano-trabalho-${Date.now()}.csv` });
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV exportado!', 'success');
}

/* ─────────────────────────────────────────────
   FUNÇÕES DE TABS DO MODAL PROJETO (usadas em projetos.js)
───────────────────────────────────────────── */
const _PROJ_TABS = ['ident', 'entidades', 'financeiro', 'objeto'];

function switchProjetoTab(tabKey) {
  _PROJ_TABS.forEach(k => {
    const tab  = document.querySelector(`#modal-projeto-tabs [data-tab="${k}"]`);
    const pane = document.getElementById(`proj-tab-${k}`);
    const isActive = k === tabKey;
    if (tab)  tab.classList.toggle('active', isActive);
    if (pane) pane.style.display = isActive ? '' : 'none';
  });
  // Botões prev/next
  const idx  = _PROJ_TABS.indexOf(tabKey);
  const prev = document.getElementById('btn-proj-prev');
  const next = document.getElementById('btn-proj-next');
  if (prev) prev.style.display = idx > 0 ? '' : 'none';
  if (next) next.style.display = idx < _PROJ_TABS.length - 1 ? '' : 'none';
}

function nextProjetoTab() {
  const current = document.querySelector('#modal-projeto-tabs .modal-tab.active')?.getAttribute('data-tab') || _PROJ_TABS[0];
  const idx = _PROJ_TABS.indexOf(current);
  if (idx < _PROJ_TABS.length - 1) switchProjetoTab(_PROJ_TABS[idx + 1]);
}

function prevProjetoTab() {
  const current = document.querySelector('#modal-projeto-tabs .modal-tab.active')?.getAttribute('data-tab') || _PROJ_TABS[0];
  const idx = _PROJ_TABS.indexOf(current);
  if (idx > 0) switchProjetoTab(_PROJ_TABS[idx - 1]);
}

function calcProjetoTotais() {
  const form = document.getElementById('form-projeto');
  if (!form) return;
  const repasse      = Number(form.elements.valor_repasse?.value) || 0;
  const contrapartida = Number(form.elements.valor_contrapartida?.value) || 0;
  const total        = repasse + contrapartida;
  const totalEl      = document.getElementById('proj-total-geral');
  const hintEl       = document.getElementById('proj-total-hint');
  if (totalEl) totalEl.value = total.toFixed(2);
  if (hintEl)  hintEl.textContent = total > 0 ? `= ${fmt.currency(repasse)} + ${fmt.currency(contrapartida)}` : '';
}

function calcProjetoVigencia() {
  const form = document.getElementById('form-projeto');
  if (!form) return;
  const inicio = form.elements.data_inicio?.value;
  const fim    = form.elements.data_fim?.value;
  const info   = document.getElementById('proj-vigencia-info');
  if (!info) return;
  if (!inicio || !fim) { info.style.display = 'none'; return; }
  const dI  = new Date(inicio);
  const dF  = new Date(fim);
  const dias = Math.ceil((dF - dI) / 86400000);
  if (dias <= 0) { info.style.display = 'none'; return; }
  const hoje      = new Date();
  const restantes = Math.ceil((dF - hoje) / 86400000);
  const percDec   = Math.max(0, Math.min(100, ((dias - restantes) / dias) * 100));
  const cor = restantes < 0 ? 'var(--danger)' : restantes <= 30 ? 'var(--warning)' : 'var(--success)';
  info.style.display = '';
  info.style.borderLeftColor = cor;
  info.innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div><span class="text-muted">Duração:</span> <strong>${dias} dias</strong></div>
      <div><span class="text-muted">Decorridos:</span> <strong>${Math.max(0,dias-restantes)} dias (${Math.round(percDec)}%)</strong></div>
      <div><span class="text-muted">Restantes:</span> <strong style="color:${cor};">${restantes > 0 ? restantes + ' dias' : 'VENCIDO'}</strong></div>
    </div>`;
}

/* ─────────────────────────────────────────────
   SALVAR QTD REAL E STATUS DA FASE — INLINE
   Permite atualização rápida sem abrir o modal completo
───────────────────────────────────────────── */
async function salvarFaseRapido(faseId) {
  const qtdInput = document.getElementById(`fase-qtd-real-${faseId}`);
  if (!qtdInput) return;

  const qtdReal = Math.max(0, Number(qtdInput.value) || 0);
  const fase    = _planoFases.find(f => f.id === faseId);
  if (!fase) return;

  const btn = qtdInput.nextElementSibling;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  try {
    // Calcula % automaticamente se tiver qtd prevista
    const updates = { quantidade_realizada: qtdReal };
    if (fase.quantidade_prevista > 0) {
      const perc = Math.min(100, Math.round(qtdReal / fase.quantidade_prevista * 100));
      // Atualiza display
      const percEl = document.getElementById(`fase-perc-${faseId}`);
      if (percEl) {
        percEl.textContent = `${perc}% concluído`;
        percEl.style.color = perc >= 100 ? 'var(--success)' : perc > 0 ? 'var(--primary)' : 'var(--gray-400)';
      }
    }

    await DB.update('ong_fases', faseId, updates);

    // Atualiza cache local
    if (fase) fase.quantidade_realizada = qtdReal;

    showToast(`Fase ${fase.numero_fase || ''} — qtd. real salva: ${qtdReal}`, 'success');
  } catch(err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i>'; }
  }
}

async function salvarFaseStatus(faseId, novoStatus) {
  const fase = _planoFases.find(f => f.id === faseId);
  if (!fase) return;

  const sel = document.getElementById(`fase-status-${faseId}`);
  const statusColors = {
    'Concluída':    '#0e9f6e',
    'Em Andamento': '#2563eb',
    'Atrasada':     '#e02424',
    'Não Iniciada': '#6b7280'
  };

  try {
    await DB.update('ong_fases', faseId, { status: novoStatus });
    if (fase) fase.status = novoStatus;
    if (sel) sel.style.color = statusColors[novoStatus] || '#6b7280';
    showToast(`Status atualizado: ${novoStatus}`, 'success');
  } catch(err) {
    showToast('Erro ao salvar status: ' + err.message, 'error');
    // Reverte o select visualmente
    if (sel) sel.value = fase.status || 'Não Iniciada';
  }
}

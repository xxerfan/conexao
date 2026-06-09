/* ================================================================
   ONG GESTOR v6 — PRESTAÇÃO DE CONTAS SUPREMA
   Relatório profissional com galeria de evidências fotográficas,
   NFs digitalizadas, timeline de execução e PDF premium.
   ================================================================ */

/* ── Estado do módulo ── */
let _prestState = {
  projId    : null,
  projeto   : null,
  rubricas  : [],
  metas     : [],
  despesas  : [],
  documentos: [],
  filtroMes : '',
  filtroFonte: '',
  filtroStatus: '',
  viewMode  : 'completo',  // completo | financeiro | fisico | evidencias
  lightboxIdx: 0,
  lightboxImgs: []
};

/* ================================================================
   INIT
   ================================================================ */
async function initPrestacao() {
  try {
    const projetos = CACHE.projetos || await DB.getAll('ong_projetos');
    CACHE.projetos = projetos;
    const sel = document.getElementById('prest-select-projeto');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecione o Projeto —</option>';
    projetos.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.numero_proposta||p.id} — ${p.nome_projeto||''}`;
      sel.appendChild(o);
    });
  } catch(err) { console.error('initPrestacao:', err); }
}

/* ================================================================
   CARREGAR DADOS E RENDERIZAR
   ================================================================ */
async function loadPrestacao() {
  const projId = document.getElementById('prest-select-projeto')?.value;
  const c      = document.getElementById('prestacao-conteudo');
  if (!c) return;
  if (!projId) { c.innerHTML = ''; return; }

  c.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;">
      <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#0891b2);
                  display:flex;align-items:center;justify-content:center;animation:spin 1s linear infinite;">
        <i class="fas fa-cog" style="color:#fff;font-size:1.4rem;"></i>
      </div>
      <div style="font-size:.95rem;font-weight:600;color:var(--text);">Compilando Relatório de Prestação de Contas...</div>
      <div style="font-size:.8rem;color:var(--text-muted);">Carregando dados financeiros, metas e evidências</div>
    </div>`;

  try {
    const [pR, rR, mR, dR, docR] = await Promise.all([
      DB.getAll('ong_projetos'),
      DB.getAll('ong_rubricas'),
      DB.getAll('ong_metas'),
      DB.getAll('ong_despesas'),
      DB.getAll('ong_documentos')
    ]);

    const p   = pR.find(x => x.id === projId);
    if (!p) { c.innerHTML=`<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Projeto não encontrado.</div>`; return; }

    const rub = rR.filter(r => r.projeto_id === projId);
    const met = mR.filter(m => m.projeto_id === projId);
    const dep = dR.filter(d => d.projeto_id === projId);
    const docs= docR.filter(d => d.projeto_id === projId);

    // Salva estado
    _prestState = { ..._prestState, projId, projeto: p, rubricas: rub, metas: met, despesas: dep, documentos: docs };

    c.innerHTML = _buildRelatorioHTML(p, rub, met, dep, docs);
    _initRelatorioInteractions();

  } catch(err) {
    c.innerHTML=`<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Erro: ${err.message}</div>`;
    console.error(err);
  }
}

/* ================================================================
   BUILDER PRINCIPAL DO RELATÓRIO
   ================================================================ */
function _buildRelatorioHTML(p, rub, met, dep, docs) {
  const totalExec    = dep.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const totalRep     = Number(p.valor_repasse)||0;
  const totalCont    = Number(p.valor_contrapartida)||0;
  const totalPrev    = totalRep + totalCont;
  const execRepasse  = dep.filter(d=>d.fonte==='Repasse Federal').reduce((s,d)=>s+(Number(d.valor)||0),0);
  const execContra   = dep.filter(d=>d.fonte==='Contrapartida').reduce((s,d)=>s+(Number(d.valor)||0),0);
  const saldo        = totalRep - execRepasse;
  const percExec     = calcPercent(totalExec, totalPrev);
  const benPrev      = met.reduce((s,m)=>s+(Number(m.beneficiarios_previstos)||0),0);
  const benAten      = met.reduce((s,m)=>s+(Number(m.beneficiarios_atendidos)||0),0);
  const percFis      = calcPercent(benAten, benPrev);

  // Métricas de documentos
  const fotos  = docs.filter(d => _isImagem(d));
  const nfs    = docs.filter(d => ['Nota Fiscal','Comprovante Fiscal','Recibo','Comprovante de Pagamento'].includes(d.tipo_documento));
  const outros = docs.filter(d => !_isImagem(d) && !['Nota Fiscal','Comprovante Fiscal','Recibo','Comprovante de Pagamento'].includes(d.tipo_documento));

  // Análise por mês
  const desByMes = {};
  dep.forEach(d=>{ const m=d.mes_referencia||'S/D'; if(!desByMes[m])desByMes[m]=[]; desByMes[m].push(d); });

  // Análise por categoria
  const catMap = {};
  rub.forEach(r=>{ const cat=r.categoria||'Outros'; if(!catMap[cat])catMap[cat]={previsto:0,executado:0,rubs:[]}; catMap[cat].previsto+=Number(r.valor_previsto)||0; catMap[cat].rubs.push(r); });
  dep.forEach(d=>{ const r=rub.find(x=>x.id===d.rubrica_id); const cat=r?.categoria||'Outros'; if(!catMap[cat])catMap[cat]={previsto:0,executado:0,rubs:[]}; catMap[cat].executado+=Number(d.valor)||0; });

  // Fornecedores top
  const fornMap = {};
  dep.forEach(d=>{ if(d.fornecedor){ if(!fornMap[d.fornecedor])fornMap[d.fornecedor]=0; fornMap[d.fornecedor]+= Number(d.valor)||0; }});
  const topForn = Object.entries(fornMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Score de conformidade
  const scoreItems = [
    { ok: dep.every(d => d.numero_documento), label: 'Todos os documentos numerados' },
    { ok: dep.every(d => d.fornecedor), label: 'Todos com fornecedor identificado' },
    { ok: dep.every(d => d.tipo_documento), label: 'Todos com tipo de documento' },
    { ok: nfs.length > 0, label: `${nfs.length} comprovantes fiscais anexados` },
    { ok: fotos.length > 0, label: `${fotos.length} registros fotográficos` },
    { ok: execRepasse <= totalRep, label: 'Execução de repasse dentro do limite' },
    { ok: met.every(m => m.indicador), label: 'Todas as metas têm indicadores' },
    { ok: benAten > 0, label: 'Beneficiários atendidos registrados' }
  ];
  const scoreOk  = scoreItems.filter(i=>i.ok).length;
  const scorePct = Math.round((scoreOk / scoreItems.length) * 100);
  const scoreColor = scorePct >= 80 ? '#059669' : scorePct >= 60 ? '#d97706' : '#dc2626';

  // Dias de vigência
  const dIni = p.data_inicio ? new Date(p.data_inicio) : null;
  const dFim = p.data_fim    ? new Date(p.data_fim)    : null;
  const hoje = new Date();
  const diasTotal  = dIni && dFim ? Math.ceil((dFim-dIni)/(1000*86400)) : 0;
  const diasDecorr = dIni ? Math.max(0, Math.ceil((Math.min(hoje,dFim||hoje)-dIni)/(1000*86400))) : 0;
  const percVig    = diasTotal > 0 ? calcPercent(diasDecorr, diasTotal) : 0;

  return `
<!-- ══════════════════════════════════════════════════════════
     CABEÇALHO COVER do RELATÓRIO
══════════════════════════════════════════════════════════ -->
<div id="relatorio-prestacao">

  <!-- Barra de ferramentas do relatório -->
  <div class="prest-toolbar" id="prest-toolbar">
    <div class="prest-toolbar-left">
      <div class="prest-view-tabs">
        <button class="prest-view-tab active" onclick="setPrestView('completo')" data-view="completo">
          <i class="fas fa-file-alt"></i> Completo
        </button>
        <button class="prest-view-tab" onclick="setPrestView('financeiro')" data-view="financeiro">
          <i class="fas fa-chart-pie"></i> Financeiro
        </button>
        <button class="prest-view-tab" onclick="setPrestView('fisico')" data-view="fisico">
          <i class="fas fa-bullseye"></i> Físico
        </button>
        <button class="prest-view-tab" onclick="setPrestView('evidencias')" data-view="evidencias">
          <i class="fas fa-images"></i> Evidências
          <span class="prest-badge">${docs.length}</span>
        </button>
      </div>
    </div>
    <div class="prest-toolbar-right">
      <button class="btn btn-outline btn-sm" onclick="exportPrestacaoExcel()" title="Exportar Excel">
        <i class="fas fa-file-excel" style="color:#059669;"></i> Excel
      </button>
      <button class="btn btn-primary btn-sm" onclick="printPrestacao()" id="btn-pdf-prest">
        <i class="fas fa-file-pdf"></i> Gerar PDF
      </button>
    </div>
  </div>

  <!-- CAPA DO RELATÓRIO -->
  <div class="prest-cover" id="prest-cover">
    <div class="prest-cover-badge">
      <i class="fas fa-certificate"></i> RELATÓRIO OFICIAL DE PRESTAÇÃO DE CONTAS
    </div>
    <h1 class="prest-cover-title">${p.nome_projeto||'Projeto sem nome'}</h1>
    <div class="prest-cover-meta">
      <span><i class="fas fa-hashtag"></i> ${p.numero_proposta||'—'}</span>
      <span class="prest-cover-sep">•</span>
      <span><i class="fas fa-building"></i> ${p.ong_nome||'—'}</span>
      <span class="prest-cover-sep">•</span>
      <span><i class="fas fa-calendar-alt"></i> ${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</span>
    </div>
    <div class="prest-cover-scores">
      <div class="prest-score-ring" style="--score:${percExec};--color:#2563eb;">
        <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="8"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="#60a5fa" stroke-width="8"
          stroke-dasharray="${percExec*2.136} 213.6" stroke-linecap="round"
          transform="rotate(-90 40 40)"/></svg>
        <div class="prest-score-text"><div class="prest-score-val">${fmt.percent(percExec)}</div><div class="prest-score-lbl">Exec. Fin.</div></div>
      </div>
      <div class="prest-score-ring" style="--score:${percFis};--color:#059669;">
        <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="8"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="#34d399" stroke-width="8"
          stroke-dasharray="${percFis*2.136} 213.6" stroke-linecap="round"
          transform="rotate(-90 40 40)"/></svg>
        <div class="prest-score-text"><div class="prest-score-val">${fmt.percent(percFis)}</div><div class="prest-score-lbl">Exec. Fís.</div></div>
      </div>
      <div class="prest-score-ring" style="--score:${scorePct};--color:${scoreColor};">
        <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="8"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="${scoreColor === '#059669' ? '#34d399' : scoreColor === '#d97706' ? '#fbbf24' : '#f87171'}" stroke-width="8"
          stroke-dasharray="${scorePct*2.136} 213.6" stroke-linecap="round"
          transform="rotate(-90 40 40)"/></svg>
        <div class="prest-score-text"><div class="prest-score-val">${scorePct}%</div><div class="prest-score-lbl">Conformidade</div></div>
      </div>
      <div class="prest-score-ring">
        <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="8"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="#a78bfa" stroke-width="8"
          stroke-dasharray="${percVig*2.136} 213.6" stroke-linecap="round"
          transform="rotate(-90 40 40)"/></svg>
        <div class="prest-score-text"><div class="prest-score-val">${fmt.percent(percVig)}</div><div class="prest-score-lbl">Vigência</div></div>
      </div>
    </div>
    <div class="prest-cover-generated">
      Gerado em ${new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
      às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
    </div>
  </div>

  <!-- ALERTA DE CONFORMIDADE -->
  ${scoreOk < scoreItems.length ? `
  <div class="prest-conformidade-alert ${scorePct >= 80 ? 'prest-conf-ok' : scorePct >= 60 ? 'prest-conf-warn' : 'prest-conf-err'}">
    <div class="prest-conf-icon">
      <i class="fas fa-${scorePct >= 80 ? 'shield-check' : scorePct >= 60 ? 'exclamation-triangle' : 'times-circle'}"></i>
    </div>
    <div class="prest-conf-body">
      <div class="prest-conf-title">Score de Conformidade: ${scorePct}% (${scoreOk}/${scoreItems.length} itens)</div>
      <div class="prest-conf-items">
        ${scoreItems.map(i=>`<span class="prest-conf-item ${i.ok?'ok':'fail'}">
          <i class="fas fa-${i.ok?'check':'times'}"></i> ${i.label}
        </span>`).join('')}
      </div>
    </div>
  </div>
  ` : `
  <div class="prest-conformidade-alert prest-conf-ok">
    <div class="prest-conf-icon"><i class="fas fa-shield-check"></i></div>
    <div class="prest-conf-body">
      <div class="prest-conf-title">✅ 100% de Conformidade — Todos os ${scoreItems.length} critérios atendidos!</div>
    </div>
  </div>`}

  <!-- ═══════════════════════════════════════════
       SEÇÃO 0: IDENTIFICAÇÃO DO PROJETO
  ═══════════════════════════════════════════ -->
  <div class="prest-section prest-section-id" data-sections="completo fisico financeiro evidencias">
    <div class="prest-section-header">
      <div class="prest-section-num">0</div>
      <div class="prest-section-title">Identificação do Convênio / Termo</div>
    </div>
    <div class="prest-section-body">
      <div class="prest-id-grid">
        <div class="prest-id-item prest-id-span2">
          <div class="prest-id-label"><i class="fas fa-project-diagram"></i> Objeto do Projeto</div>
          <div class="prest-id-value prest-id-objeto">${p.objeto||'—'}</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-building"></i> Organização</div>
          <div class="prest-id-value">${p.ong_nome||'—'}</div>
          <div class="prest-id-sub">${p.ong_cnpj||''}</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-university"></i> Concedente</div>
          <div class="prest-id-value">${p.concedente||'—'}</div>
          <div class="prest-id-sub">${p.programa||''}</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-file-contract"></i> Nº Proposta</div>
          <div class="prest-id-value">${p.numero_proposta||'—'}</div>
          <div class="prest-id-sub">${p.modalidade||''}</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-calendar-alt"></i> Vigência</div>
          <div class="prest-id-value">${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</div>
          <div class="prest-id-sub">${diasTotal} dias de vigência (${diasDecorr} decorridos)</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-map-marker-alt"></i> Localidade</div>
          <div class="prest-id-value">${p.municipio||'—'}${p.uf?'/'+p.uf:''}</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-users"></i> Público-alvo</div>
          <div class="prest-id-value prest-id-texto">${p.publico_beneficiario||'—'}</div>
        </div>
        <div class="prest-id-item">
          <div class="prest-id-label"><i class="fas fa-info-circle"></i> Status</div>
          <div class="prest-id-value">${statusBadge(p.status)}</div>
        </div>
      </div>

      <!-- Barra de vigência -->
      <div style="margin-top:16px;">
        <div class="prest-bar-label">
          <span><i class="fas fa-clock"></i> Progresso da Vigência</span>
          <span>${diasDecorr} de ${diasTotal} dias (${fmt.percent(percVig)})</span>
        </div>
        <div class="prest-progress-track">
          <div class="prest-progress-fill prest-progress-purple" style="width:${percVig}%">
            ${percVig > 10 ? `<span class="prest-progress-label">${fmt.percent(percVig)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SEÇÃO I: RESUMO FINANCEIRO
  ═══════════════════════════════════════════ -->
  <div class="prest-section" data-sections="completo financeiro">
    <div class="prest-section-header">
      <div class="prest-section-num">I</div>
      <div class="prest-section-title">Resumo Financeiro</div>
      <div class="prest-section-badge prest-badge-blue">${fmt.currency(totalExec)} executado</div>
    </div>
    <div class="prest-section-body">

      <!-- KPIs financeiros -->
      <div class="prest-kpi-row">
        <div class="prest-kpi-card prest-kpi-blue">
          <div class="prest-kpi-icon"><i class="fas fa-university"></i></div>
          <div class="prest-kpi-data">
            <div class="prest-kpi-label">Repasse Federal</div>
            <div class="prest-kpi-value">${fmt.currency(totalRep)}</div>
          </div>
        </div>
        <div class="prest-kpi-card prest-kpi-green">
          <div class="prest-kpi-icon"><i class="fas fa-hand-holding-heart"></i></div>
          <div class="prest-kpi-data">
            <div class="prest-kpi-label">Contrapartida</div>
            <div class="prest-kpi-value">${fmt.currency(totalCont)}</div>
          </div>
        </div>
        <div class="prest-kpi-card prest-kpi-orange">
          <div class="prest-kpi-icon"><i class="fas fa-receipt"></i></div>
          <div class="prest-kpi-data">
            <div class="prest-kpi-label">Total Executado</div>
            <div class="prest-kpi-value">${fmt.currency(totalExec)}</div>
            <div class="prest-kpi-sub">${fmt.percent(percExec)} do total</div>
          </div>
        </div>
        <div class="prest-kpi-card ${saldo < 0 ? 'prest-kpi-red' : 'prest-kpi-teal'}">
          <div class="prest-kpi-icon"><i class="fas fa-balance-scale"></i></div>
          <div class="prest-kpi-data">
            <div class="prest-kpi-label">Saldo Repasse</div>
            <div class="prest-kpi-value ${saldo < 0 ? 'text-danger' : ''}">${fmt.currency(saldo)}</div>
          </div>
        </div>
        <div class="prest-kpi-card prest-kpi-blue-light">
          <div class="prest-kpi-icon"><i class="fas fa-arrow-circle-down"></i></div>
          <div class="prest-kpi-data">
            <div class="prest-kpi-label">Exec. Repasse</div>
            <div class="prest-kpi-value">${fmt.currency(execRepasse)}</div>
            <div class="prest-kpi-sub">${fmt.percent(calcPercent(execRepasse,totalRep))} do repasse</div>
          </div>
        </div>
        <div class="prest-kpi-card prest-kpi-green-light">
          <div class="prest-kpi-icon"><i class="fas fa-arrow-circle-up"></i></div>
          <div class="prest-kpi-data">
            <div class="prest-kpi-label">Exec. Contrapartida</div>
            <div class="prest-kpi-value">${fmt.currency(execContra)}</div>
            <div class="prest-kpi-sub">${fmt.percent(calcPercent(execContra,totalCont))} da contrapartida</div>
          </div>
        </div>
      </div>

      <!-- Barras duplas de execução -->
      <div class="prest-bars-container">
        <div class="prest-bar-item">
          <div class="prest-bar-label">
            <span><i class="fas fa-chart-bar" style="color:var(--primary)"></i> Execução Total</span>
            <span class="prest-bar-pct ${percExec >= 80 ? 'text-success' : percExec >= 50 ? 'text-warning' : 'text-danger'}">${fmt.percent(percExec)}</span>
          </div>
          <div class="prest-progress-track prest-track-lg">
            <div class="prest-progress-fill prest-progress-blue" style="width:${percExec}%">
              ${percExec > 8 ? `<span class="prest-progress-label">${fmt.currency(totalExec)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-top:3px;">
            <span>R$ 0</span><span>Previsto: ${fmt.currency(totalPrev)}</span>
          </div>
        </div>
        <div class="prest-bar-item">
          <div class="prest-bar-label">
            <span><i class="fas fa-university" style="color:#3b82f6"></i> Repasse Federal</span>
            <span>${fmt.percent(calcPercent(execRepasse,totalRep))}</span>
          </div>
          <div class="prest-progress-track">
            <div class="prest-progress-fill prest-progress-blue" style="width:${calcPercent(execRepasse,totalRep)}%"></div>
          </div>
        </div>
        <div class="prest-bar-item">
          <div class="prest-bar-label">
            <span><i class="fas fa-hand-holding-heart" style="color:#10b981"></i> Contrapartida</span>
            <span>${fmt.percent(calcPercent(execContra,totalCont))}</span>
          </div>
          <div class="prest-progress-track">
            <div class="prest-progress-fill prest-progress-green" style="width:${calcPercent(execContra,totalCont)}%"></div>
          </div>
        </div>
      </div>

      <!-- Top fornecedores -->
      ${topForn.length > 0 ? `
      <div class="prest-subsection-title"><i class="fas fa-store"></i> Maiores Fornecedores</div>
      <div class="prest-fornecedor-list">
        ${topForn.map(([nome,val],i)=>{const pct=calcPercent(val,totalExec); return `
          <div class="prest-forn-item">
            <div class="prest-forn-rank">${i+1}</div>
            <div class="prest-forn-info">
              <div class="prest-forn-nome">${nome}</div>
              <div class="prest-forn-bar">
                <div class="prest-forn-fill" style="width:${pct}%"></div>
              </div>
            </div>
            <div class="prest-forn-valor">
              <div>${fmt.currency(val)}</div>
              <div class="prest-forn-pct">${fmt.percent(pct)}</div>
            </div>
          </div>
        `;}).join('')}
      </div>` : ''}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SEÇÃO II: EXECUÇÃO POR CATEGORIA
  ═══════════════════════════════════════════ -->
  <div class="prest-section" data-sections="completo financeiro">
    <div class="prest-section-header">
      <div class="prest-section-num">II</div>
      <div class="prest-section-title">Execução por Categoria de Rubrica</div>
      <div class="prest-section-badge prest-badge-teal">${Object.keys(catMap).length} categorias</div>
    </div>
    <div class="prest-section-body">
      <div class="prest-cat-grid">
        ${Object.entries(catMap).map(([cat,v])=>{
          const saldoCat = v.previsto - v.executado;
          const pct = calcPercent(v.executado, v.previsto);
          const statusCor = pct >= 80 ? '#059669' : pct >= 40 ? '#d97706' : '#2563eb';
          return `
          <div class="prest-cat-card">
            <div class="prest-cat-header">
              <span class="prest-cat-nome">${cat}</span>
              <span class="prest-cat-pct" style="color:${statusCor}">${fmt.percent(pct)}</span>
            </div>
            <div class="prest-progress-track" style="margin:6px 0;">
              <div class="prest-progress-fill" style="width:${pct}%;background:${statusCor};"></div>
            </div>
            <div class="prest-cat-values">
              <div><div class="prest-cat-vlabel">Previsto</div><div class="prest-cat-vval">${fmt.currency(v.previsto)}</div></div>
              <div><div class="prest-cat-vlabel">Executado</div><div class="prest-cat-vval" style="color:${statusCor}">${fmt.currency(v.executado)}</div></div>
              <div><div class="prest-cat-vlabel">Saldo</div><div class="prest-cat-vval ${saldoCat<0?'text-danger':'text-success'}">${fmt.currency(saldoCat)}</div></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Tabela detalhada -->
      <div class="table-wrapper" style="margin-top:16px;">
        <table class="data-table prest-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th class="text-right">Previsto</th>
              <th class="text-right">Executado</th>
              <th class="text-right">Saldo</th>
              <th style="min-width:130px">Progresso</th>
              <th class="text-center">Nº Docs</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(catMap).map(([cat,v])=>{
              const saldoCat = v.previsto - v.executado;
              const pct = calcPercent(v.executado, v.previsto);
              const docsCount = docs.filter(d => {
                const r = rub.find(r => r.id === d.rubrica_id);
                return r?.categoria === cat;
              }).length;
              return `<tr>
                <td><span class="badge badge-blue">${cat}</span></td>
                <td class="text-right">${fmt.currency(v.previsto)}</td>
                <td class="text-right font-semibold">${fmt.currency(v.executado)}</td>
                <td class="text-right ${saldoCat<0?'text-danger':'text-success'}">${fmt.currency(saldoCat)}</td>
                <td>${progressBar(pct)}</td>
                <td class="text-center">${docsCount > 0 ? `<span class="badge badge-green">${docsCount}</span>` : '—'}</td>
              </tr>`;
            }).join('')}
            <tr class="prest-total-row">
              <td><strong>TOTAL</strong></td>
              <td class="text-right font-semibold">${fmt.currency(Object.values(catMap).reduce((s,v)=>s+v.previsto,0))}</td>
              <td class="text-right font-semibold">${fmt.currency(totalExec)}</td>
              <td class="text-right font-semibold ${saldo<0?'text-danger':'text-success'}">${fmt.currency(Object.values(catMap).reduce((s,v)=>s+v.previsto,0)-totalExec)}</td>
              <td>${progressBar(percExec)}</td>
              <td class="text-center"><span class="badge badge-blue">${docs.length}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SEÇÃO III: METAS E EXECUÇÃO FÍSICA
  ═══════════════════════════════════════════ -->
  <div class="prest-section" data-sections="completo fisico">
    <div class="prest-section-header">
      <div class="prest-section-num">III</div>
      <div class="prest-section-title">Execução Física das Metas</div>
      <div class="prest-section-badge prest-badge-green">${benAten} de ${benPrev} beneficiários</div>
    </div>
    <div class="prest-section-body">
      <!-- Resumo geral de beneficiários -->
      <div class="prest-ben-summary">
        <div class="prest-ben-ring">
          <svg viewBox="0 0 120 120" style="width:110px;height:110px;">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="10"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" stroke-width="10"
              stroke-dasharray="${percFis*3.14159} 314.159" stroke-linecap="round"
              transform="rotate(-90 60 60)" style="transition:stroke-dasharray .8s ease;"/>
          </svg>
          <div class="prest-ben-ring-text">
            <div style="font-size:1.4rem;font-weight:800;color:#059669;">${fmt.percent(percFis)}</div>
            <div style="font-size:.7rem;color:var(--text-muted);">FÍSICO</div>
          </div>
        </div>
        <div class="prest-ben-stats">
          <div class="prest-ben-stat">
            <div class="prest-ben-stat-val prest-ben-stat-big">${fmt.number(benAten)}</div>
            <div class="prest-ben-stat-lbl">Beneficiários Atendidos</div>
          </div>
          <div class="prest-ben-sep"></div>
          <div class="prest-ben-stat">
            <div class="prest-ben-stat-val">${fmt.number(benPrev)}</div>
            <div class="prest-ben-stat-lbl">Meta Total</div>
          </div>
          <div class="prest-ben-sep"></div>
          <div class="prest-ben-stat">
            <div class="prest-ben-stat-val">${met.filter(m=>m.status==='Concluída').length}</div>
            <div class="prest-ben-stat-lbl">Metas Concluídas</div>
          </div>
          <div class="prest-ben-sep"></div>
          <div class="prest-ben-stat">
            <div class="prest-ben-stat-val">${met.filter(m=>m.status==='Em Andamento').length}</div>
            <div class="prest-ben-stat-lbl">Em Andamento</div>
          </div>
        </div>
      </div>

      <!-- Cards de metas -->
      <div class="prest-metas-grid">
        ${!met.length ? `<div class="prest-empty"><i class="fas fa-bullseye"></i><p>Nenhuma meta cadastrada</p></div>` :
          met.map(m=>{
            const pctFis  = Number(m.percentual_fisico)||0;
            const pctBen  = calcPercent(Number(m.beneficiarios_atendidos)||0, Number(m.beneficiarios_previstos)||0);
            const fotasMeta = docs.filter(d => _isImagem(d) && (d.meta_id === m.id || d.descricao?.toLowerCase().includes('meta')));
            return `
            <div class="prest-meta-card">
              <div class="prest-meta-header">
                <div class="prest-meta-num">Meta ${m.numero_meta||'—'}</div>
                ${statusBadge(m.status)}
                ${fotasMeta.length > 0 ? `<span class="prest-meta-fotos-badge"><i class="fas fa-camera"></i> ${fotasMeta.length}</span>` : ''}
              </div>
              <div class="prest-meta-desc">${m.descricao_meta||'—'}</div>
              ${m.indicador ? `<div class="prest-meta-indicador"><i class="fas fa-chart-line"></i> ${m.indicador}</div>` : ''}
              <div class="prest-meta-period">
                <i class="fas fa-calendar-alt"></i>
                ${fmt.date(m.data_inicio)} → ${fmt.date(m.data_fim)}
              </div>
              <div class="prest-meta-progress-area">
                <div class="prest-meta-prog-label">
                  <span>Execução Física</span><span>${fmt.percent(pctFis)}</span>
                </div>
                <div class="prest-progress-track">
                  <div class="prest-progress-fill prest-progress-green" style="width:${pctFis}%"></div>
                </div>
                <div class="prest-meta-prog-label" style="margin-top:6px;">
                  <span>Beneficiários: ${fmt.number(m.beneficiarios_atendidos)} / ${fmt.number(m.beneficiarios_previstos)}</span>
                  <span>${fmt.percent(pctBen)}</span>
                </div>
                <div class="prest-progress-track">
                  <div class="prest-progress-fill prest-progress-teal" style="width:${pctBen}%"></div>
                </div>
              </div>
              <div class="prest-meta-financeiro">
                <div><span class="prest-meta-vlabel">Previsto</span><span class="prest-meta-vval">${fmt.currency(m.valor_previsto)}</span></div>
                <div><span class="prest-meta-vlabel">Executado</span><span class="prest-meta-vval text-success">${fmt.currency(m.valor_executado||0)}</span></div>
              </div>
            </div>`;
          }).join('')
        }
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SEÇÃO IV: RELAÇÃO DE DESPESAS
  ═══════════════════════════════════════════ -->
  <div class="prest-section" data-sections="completo financeiro">
    <div class="prest-section-header">
      <div class="prest-section-num">IV</div>
      <div class="prest-section-title">Relação de Despesas Realizadas</div>
      <div class="prest-section-badge prest-badge-orange">${dep.length} lançamentos</div>
    </div>
    <div class="prest-section-body">

      <!-- Filtros de despesa -->
      <div class="prest-desp-filters">
        <select class="form-control form-control-sm" id="prest-filter-mes" onchange="_filtrarDespesas()" style="max-width:160px;">
          <option value="">Todos os meses</option>
          ${[...new Set(dep.map(d=>d.mes_referencia).filter(Boolean))].sort().map(m=>`<option value="${m}">${fmt.monthYear(m)}</option>`).join('')}
        </select>
        <select class="form-control form-control-sm" id="prest-filter-fonte" onchange="_filtrarDespesas()" style="max-width:160px;">
          <option value="">Todas as fontes</option>
          <option value="Repasse Federal">Repasse Federal</option>
          <option value="Contrapartida">Contrapartida</option>
        </select>
        <select class="form-control form-control-sm" id="prest-filter-pag" onchange="_filtrarDespesas()" style="max-width:160px;">
          <option value="">Todos os status</option>
          <option value="Pago">Pago</option>
          <option value="A Pagar">A Pagar</option>
          <option value="Cancelado">Cancelado</option>
        </select>
        <div style="margin-left:auto;font-size:.8rem;color:var(--text-muted);align-self:center;">
          Total filtrado: <strong id="prest-desp-total">${fmt.currency(totalExec)}</strong>
        </div>
      </div>

      <!-- Tabela de despesas agrupada por mês -->
      <div id="prest-despesas-body">
        ${_buildDespesasTabela(dep, rub, docs)}
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SEÇÃO V: EVIDÊNCIAS E COMPROVANTES
  ═══════════════════════════════════════════ -->
  <div class="prest-section" data-sections="completo evidencias">
    <div class="prest-section-header">
      <div class="prest-section-num">V</div>
      <div class="prest-section-title">Evidências, Comprovantes e Registros Fotográficos</div>
      <div class="prest-section-badge prest-badge-purple">${docs.length} documentos</div>
    </div>
    <div class="prest-section-body">

      <!-- Resumo de documentos -->
      <div class="prest-docs-summary-row">
        <div class="prest-doc-summary-card prest-doc-sum-blue">
          <i class="fas fa-file-invoice"></i>
          <div class="prest-doc-sum-val">${nfs.length}</div>
          <div class="prest-doc-sum-lbl">Notas Fiscais / Recibos</div>
        </div>
        <div class="prest-doc-summary-card prest-doc-sum-green">
          <i class="fas fa-camera"></i>
          <div class="prest-doc-sum-val">${fotos.length}</div>
          <div class="prest-doc-sum-lbl">Registros Fotográficos</div>
        </div>
        <div class="prest-doc-summary-card prest-doc-sum-teal">
          <i class="fas fa-file-alt"></i>
          <div class="prest-doc-sum-val">${outros.length}</div>
          <div class="prest-doc-sum-lbl">Outros Documentos</div>
        </div>
        <div class="prest-doc-summary-card prest-doc-sum-orange">
          <i class="fas fa-paperclip"></i>
          <div class="prest-doc-sum-val">${docs.length}</div>
          <div class="prest-doc-sum-lbl">Total de Documentos</div>
        </div>
      </div>

      ${docs.length === 0 ? `
        <div class="prest-empty">
          <i class="fas fa-folder-open"></i>
          <p>Nenhum documento anexado ainda.</p>
          <p style="font-size:.8rem;">Acesse <strong>Documentos / Anexos</strong> no menu lateral para fazer upload de NFs, fotos e comprovantes.</p>
        </div>
      ` : `

      <!-- Seção de Notas Fiscais e Comprovantes -->
      ${nfs.length > 0 ? `
        <div class="prest-evidencias-section">
          <div class="prest-ev-section-title">
            <i class="fas fa-file-invoice-dollar"></i> Notas Fiscais e Comprovantes de Pagamento
          </div>
          <div class="prest-nf-grid">
            ${nfs.map((d,i)=>`
              <div class="prest-nf-card" onclick="openDocLightbox(${docs.indexOf(d)})">
                <div class="prest-nf-thumb ${_isImagem(d) ? 'prest-nf-thumb-img' : ''}">
                  ${_isImagem(d) && d.arquivo_base64
                    ? `<img src="${d.arquivo_base64}" alt="${d.nome_arquivo||''}" loading="lazy">`
                    : _isImagem(d) && d.url_externo
                    ? `<img src="${d.url_externo}" alt="${d.nome_arquivo||''}" loading="lazy">`
                    : `<div class="prest-nf-icon-wrap"><i class="fas ${_getDocIcon(d.tipo_documento)}"></i></div>`
                  }
                  <div class="prest-nf-overlay"><i class="fas fa-search-plus"></i></div>
                </div>
                <div class="prest-nf-info">
                  <div class="prest-nf-tipo">${renderTipoBadge(d.tipo_documento)}</div>
                  <div class="prest-nf-nome">${d.numero_documento||d.nome_arquivo||'—'}</div>
                  <div class="prest-nf-forn">${d.fornecedor||'—'}</div>
                  <div class="prest-nf-valor">${d.valor ? fmt.currency(d.valor) : d.nome_arquivo ? formatBytes(d.tamanho_bytes) : '—'}</div>
                  <div class="prest-nf-data">${fmt.date(d.data_documento||d.created_at)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Seção de Galeria Fotográfica -->
      ${fotos.length > 0 ? `
        <div class="prest-evidencias-section">
          <div class="prest-ev-section-title">
            <i class="fas fa-images"></i> Galeria de Registros Fotográficos — Comprovação de Execução
          </div>
          <div class="prest-galeria-grid">
            ${fotos.map((d,i)=>`
              <div class="prest-galeria-item" onclick="openDocLightbox(${docs.indexOf(d)})">
                <div class="prest-galeria-img-wrap">
                  ${d.arquivo_base64
                    ? `<img src="${d.arquivo_base64}" alt="${d.descricao||d.nome_arquivo||''}" loading="lazy">`
                    : d.url_externo
                    ? `<img src="${d.url_externo}" alt="${d.descricao||d.nome_arquivo||''}" loading="lazy">`
                    : `<div class="prest-galeria-placeholder"><i class="fas fa-image"></i></div>`
                  }
                  <div class="prest-galeria-overlay">
                    <i class="fas fa-search-plus"></i>
                    <span>${d.descricao||'Ver imagem'}</span>
                  </div>
                </div>
                <div class="prest-galeria-caption">
                  <div class="prest-galeria-desc">${d.descricao||d.nome_arquivo||'Registro fotográfico'}</div>
                  <div class="prest-galeria-meta">
                    ${d.mes_referencia ? `<span><i class="fas fa-calendar-alt"></i> ${fmt.monthYear(d.mes_referencia)}</span>` : ''}
                    ${d.created_at ? `<span>${fmt.date(d.created_at)}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Outros documentos -->
      ${outros.length > 0 ? `
        <div class="prest-evidencias-section">
          <div class="prest-ev-section-title">
            <i class="fas fa-file-alt"></i> Demais Documentos e Comprovantes
          </div>
          <div class="table-wrapper">
            <table class="data-table prest-table">
              <thead><tr><th>Tipo</th><th>Nome / Número</th><th>Descrição</th><th>Mês Ref.</th><th>Tamanho</th><th>Visualizar</th></tr></thead>
              <tbody>
                ${outros.map(d=>`
                  <tr>
                    <td>${renderTipoBadge(d.tipo_documento)}</td>
                    <td><div style="font-size:.82rem;font-weight:500;">${d.nome_arquivo||d.numero_documento||'—'}</div></td>
                    <td style="font-size:.8rem;color:var(--text-muted);">${(d.descricao||'—').slice(0,60)}</td>
                    <td class="text-xs">${d.mes_referencia ? fmt.monthYear(d.mes_referencia) : '—'}</td>
                    <td class="text-xs">${formatBytes(d.tamanho_bytes)}</td>
                    <td>
                      ${d.arquivo_base64 || d.url_externo
                        ? `<button class="btn btn-outline btn-xs" onclick="openDocLightbox(${docs.indexOf(d)})">
                            <i class="fas fa-eye"></i>
                           </button>`
                        : '—'
                      }
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
      `}
    </div>
  </div>

  <!-- ═══════════════════════════════════════════
       SEÇÃO VI: DECLARAÇÃO / RODAPÉ OFICIAL
  ═══════════════════════════════════════════ -->
  <div class="prest-section prest-section-footer" data-sections="completo">
    <div class="prest-section-header">
      <div class="prest-section-num">VI</div>
      <div class="prest-section-title">Declaração de Veracidade</div>
    </div>
    <div class="prest-section-body">
      <div class="prest-declaracao">
        <i class="fas fa-stamp prest-declaracao-icon"></i>
        <p>Declaro, para os fins que se fizerem necessários, que as informações prestadas neste relatório são verdadeiras e que os documentos comprobatórios estão disponíveis para verificação pelo órgão concedente, pela auditoria interna e pelos órgãos de controle externos.</p>
        <p style="margin-top:10px;">Este relatório foi gerado automaticamente pelo sistema <strong>ONG Gestor</strong> com base nos lançamentos realizados pela equipe responsável pela execução do projeto <strong>${p.nome_projeto||''}</strong> — Proposta nº <strong>${p.numero_proposta||''}</strong>.</p>
        <div class="prest-assinaturas">
          <div class="prest-assinatura">
            <div class="prest-assinatura-linha"></div>
            <div class="prest-assinatura-nome">Responsável pela ONG</div>
            <div class="prest-assinatura-cargo">${p.ong_nome||'Organização'}</div>
          </div>
          <div class="prest-assinatura">
            <div class="prest-assinatura-linha"></div>
            <div class="prest-assinatura-nome">Coordenador do Projeto</div>
            <div class="prest-assinatura-cargo">${p.nome_projeto||'Projeto'}</div>
          </div>
          <div class="prest-assinatura">
            <div class="prest-assinatura-linha"></div>
            <div class="prest-assinatura-nome">Contador / Responsável Financeiro</div>
            <div class="prest-assinatura-cargo">CRC nº _______________</div>
          </div>
        </div>
        <div class="prest-rodape-info">
          <span><i class="fas fa-calendar-check"></i> Data: ${new Date().toLocaleDateString('pt-BR')}</span>
          <span><i class="fas fa-robot"></i> Gerado por ONG Gestor v6 SUPREMO</span>
          <span><i class="fas fa-shield-alt"></i> ${p.municipio||''}${p.uf?'/'+p.uf:''}</span>
        </div>
      </div>
    </div>
  </div>

</div><!-- /relatorio-prestacao -->

<!-- LIGHTBOX para visualização de documentos -->
<div id="doc-lightbox" class="prest-lightbox" style="display:none;" onclick="_lightboxClose(event)">
  <div class="prest-lightbox-content">
    <button class="prest-lightbox-close" onclick="closeLightbox()"><i class="fas fa-times"></i></button>
    <button class="prest-lightbox-prev" onclick="lightboxNav(-1)"><i class="fas fa-chevron-left"></i></button>
    <button class="prest-lightbox-next" onclick="lightboxNav(1)"><i class="fas fa-chevron-right"></i></button>
    <div class="prest-lightbox-media" id="lightbox-media"></div>
    <div class="prest-lightbox-info" id="lightbox-info"></div>
    <div class="prest-lightbox-counter" id="lightbox-counter"></div>
  </div>
</div>
`;
}

/* ================================================================
   TABELA DE DESPESAS (agrupada por mês)
   ================================================================ */
function _buildDespesasTabela(dep, rub, docs) {
  if (!dep.length) return `<div class="prest-empty"><i class="fas fa-receipt"></i><p>Nenhuma despesa registrada.</p></div>`;

  const desByMes = {};
  dep.forEach(d=>{ const m=d.mes_referencia||'S/D'; if(!desByMes[m])desByMes[m]=[]; desByMes[m].push(d); });

  let html = '';
  const meses = Object.entries(desByMes).sort((a,b)=>a[0].localeCompare(b[0]));

  meses.forEach(([mes, itens]) => {
    const totalMes = itens.reduce((s,d)=>s+(Number(d.valor)||0),0);
    html += `
    <div class="prest-mes-group">
      <div class="prest-mes-header">
        <div class="prest-mes-title">
          <i class="fas fa-calendar-alt"></i>
          <span>${fmt.monthYear(mes)}</span>
        </div>
        <div class="prest-mes-total">${fmt.currency(totalMes)}</div>
      </div>
      <div class="table-wrapper prest-mes-table">
        <table class="data-table prest-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Fornecedor / CNPJ</th>
              <th>Documento</th>
              <th>Tipo</th>
              <th>Fonte</th>
              <th class="text-right">Valor</th>
              <th>Pagamento</th>
              <th>Comprovante</th>
            </tr>
          </thead>
          <tbody>
            ${itens.sort((a,b)=>(a.data_despesa||'').localeCompare(b.data_despesa||'')).map(d => {
              const r   = rub.find(x=>x.id===d.rubrica_id);
              const docVinc = docs.find(doc => doc.despesa_id === d.id || doc.numero_documento === d.numero_documento);
              const hasImg = docVinc && (_isImagem(docVinc) || docVinc.arquivo_base64);
              const docIdx = docVinc ? (_prestState.documentos.indexOf(docVinc)) : -1;
              return `<tr>
                <td class="text-xs">${fmt.date(d.data_despesa)}</td>
                <td>
                  <div style="font-size:.82rem;font-weight:500;">${d.descricao||'—'}</div>
                  ${r ? `<div class="text-xs text-muted">${r.categoria||''}: ${r.descricao||''}</div>` : ''}
                </td>
                <td>
                  <div style="font-size:.82rem;">${d.fornecedor||'—'}</div>
                  ${d.cnpj_cpf ? `<div class="text-xs text-muted">${d.cnpj_cpf}</div>` : ''}
                </td>
                <td class="text-xs">${d.numero_documento||'—'}</td>
                <td class="text-xs">
                  <span class="badge badge-blue" style="font-size:.68rem;">${d.tipo_documento||'—'}</span>
                </td>
                <td>
                  <span class="badge ${d.fonte==='Repasse Federal'?'badge-blue':'badge-green'}" style="font-size:.68rem;">
                    ${d.fonte==='Repasse Federal'?'<i class="fas fa-university"></i>':'<i class="fas fa-hand-holding-heart"></i>'}
                    ${d.fonte||'—'}
                  </span>
                </td>
                <td class="text-right font-semibold">${fmt.currency(d.valor)}</td>
                <td>${statusBadge(d.status_pagamento)}</td>
                <td class="text-center">
                  ${docIdx >= 0
                    ? `<button class="btn btn-xs prest-btn-doc ${hasImg?'prest-btn-doc-img':''}" onclick="openDocLightbox(${docIdx})" title="Ver comprovante">
                        <i class="fas fa-${hasImg?'image':'file-alt'}"></i>
                       </button>`
                    : `<span class="text-xs text-muted">—</span>`
                  }
                </td>
              </tr>`;
            }).join('')}
            <tr class="prest-subtotal-row">
              <td colspan="6" class="text-right font-semibold">Subtotal ${fmt.monthYear(mes)}</td>
              <td class="text-right font-semibold">${fmt.currency(totalMes)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  });

  html += `
  <div class="prest-total-banner">
    <span><i class="fas fa-calculator"></i> TOTAL GERAL DE DESPESAS</span>
    <span>${fmt.currency(dep.reduce((s,d)=>s+(Number(d.valor)||0),0))}</span>
  </div>`;

  return html;
}

/* ================================================================
   FILTROS DE DESPESA (tempo real)
   ================================================================ */
function _filtrarDespesas() {
  const mes    = document.getElementById('prest-filter-mes')?.value    || '';
  const fonte  = document.getElementById('prest-filter-fonte')?.value  || '';
  const status = document.getElementById('prest-filter-pag')?.value    || '';

  let dep = [..._prestState.despesas];
  if (mes)    dep = dep.filter(d => d.mes_referencia === mes);
  if (fonte)  dep = dep.filter(d => d.fonte === fonte);
  if (status) dep = dep.filter(d => d.status_pagamento === status);

  const total = dep.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const el = document.getElementById('prest-desp-total');
  if (el) el.textContent = fmt.currency(total);

  const body = document.getElementById('prest-despesas-body');
  if (body) body.innerHTML = _buildDespesasTabela(dep, _prestState.rubricas, _prestState.documentos);
}

/* ================================================================
   VIEW MODES (abas)
   ================================================================ */
function setPrestView(mode) {
  _prestState.viewMode = mode;

  // Atualizar abas
  document.querySelectorAll('.prest-view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });

  // Mostrar/ocultar seções
  document.querySelectorAll('[data-sections]').forEach(sec => {
    const secs = sec.dataset.sections?.split(' ') || [];
    sec.style.display = secs.includes(mode) ? '' : 'none';
  });

  // Animar scroll para topo da seção
  const conteudo = document.getElementById('prestacao-conteudo');
  if (conteudo) conteudo.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================================================================
   LIGHTBOX — Visualizador de documentos e fotos
   ================================================================ */
function openDocLightbox(idx) {
  const docs = _prestState.documentos;
  if (!docs.length) return;
  _prestState.lightboxIdx  = Math.max(0, Math.min(idx, docs.length - 1));
  _prestState.lightboxImgs = docs;
  _renderLightbox();
  const lb = document.getElementById('doc-lightbox');
  if (lb) { lb.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function _renderLightbox() {
  const docs = _prestState.lightboxImgs;
  const idx  = _prestState.lightboxIdx;
  const d    = docs[idx];
  if (!d) return;

  const mediaEl = document.getElementById('lightbox-media');
  const infoEl  = document.getElementById('lightbox-info');
  const cntEl   = document.getElementById('lightbox-counter');

  // Media
  if (d.arquivo_base64) {
    if (d.mime_type?.startsWith('image/') || d.arquivo_base64.startsWith('data:image')) {
      mediaEl.innerHTML = `<img src="${d.arquivo_base64}" alt="${d.nome_arquivo||''}" class="prest-lightbox-img">`;
    } else if (d.mime_type === 'application/pdf' || d.arquivo_base64.startsWith('data:application/pdf')) {
      mediaEl.innerHTML = `<iframe src="${d.arquivo_base64}" class="prest-lightbox-pdf" title="${d.nome_arquivo||'PDF'}"></iframe>`;
    } else {
      mediaEl.innerHTML = `<div class="prest-lightbox-nopreview"><i class="fas fa-file" style="font-size:3rem;opacity:.5;"></i><p>${d.nome_arquivo||'Arquivo'}</p><a href="${d.arquivo_base64}" download="${d.nome_arquivo||'arquivo'}" class="btn btn-primary btn-sm mt-2"><i class="fas fa-download"></i> Baixar arquivo</a></div>`;
    }
  } else if (d.url_externo) {
    const ext = (d.url_externo.split('.').pop()||'').toLowerCase();
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) {
      mediaEl.innerHTML = `<img src="${d.url_externo}" alt="${d.nome_arquivo||''}" class="prest-lightbox-img">`;
    } else if (ext === 'pdf') {
      mediaEl.innerHTML = `<iframe src="${d.url_externo}" class="prest-lightbox-pdf" title="${d.nome_arquivo||'PDF'}"></iframe>`;
    } else {
      mediaEl.innerHTML = `<div class="prest-lightbox-nopreview"><i class="fas fa-external-link-alt" style="font-size:2rem;opacity:.5;"></i><p>Arquivo externo</p><a href="${d.url_externo}" target="_blank" class="btn btn-primary btn-sm mt-2"><i class="fas fa-external-link-alt"></i> Abrir em nova aba</a></div>`;
    }
  } else {
    mediaEl.innerHTML = `<div class="prest-lightbox-nopreview"><i class="fas fa-file-slash" style="font-size:3rem;opacity:.3;"></i><p style="color:rgba(255,255,255,.5);">Sem arquivo anexado</p></div>`;
  }

  // Info
  infoEl.innerHTML = `
    <div class="prest-lb-info-row">
      ${renderTipoBadge(d.tipo_documento)}
      <span class="prest-lb-nome">${d.nome_arquivo||d.numero_documento||'—'}</span>
    </div>
    ${d.descricao ? `<div class="prest-lb-desc">${d.descricao}</div>` : ''}
    <div class="prest-lb-meta">
      ${d.fornecedor ? `<span><i class="fas fa-store"></i> ${d.fornecedor}</span>` : ''}
      ${d.numero_documento ? `<span><i class="fas fa-hashtag"></i> ${d.numero_documento}</span>` : ''}
      ${d.data_documento ? `<span><i class="fas fa-calendar"></i> ${fmt.date(d.data_documento)}</span>` : ''}
      ${d.valor ? `<span><i class="fas fa-coins"></i> ${fmt.currency(d.valor)}</span>` : ''}
      ${d.tamanho_bytes ? `<span><i class="fas fa-hdd"></i> ${formatBytes(d.tamanho_bytes)}</span>` : ''}
    </div>
    ${d.observacao ? `<div class="prest-lb-obs"><i class="fas fa-sticky-note"></i> ${d.observacao}</div>` : ''}
    <div class="prest-lb-actions">
      ${d.arquivo_base64 ? `<a href="${d.arquivo_base64}" download="${d.nome_arquivo||'arquivo'}" class="btn btn-outline btn-sm"><i class="fas fa-download"></i> Download</a>` : ''}
      ${d.url_externo    ? `<a href="${d.url_externo}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-external-link-alt"></i> Abrir link</a>` : ''}
    </div>
  `;

  // Counter
  cntEl.textContent = `${idx + 1} / ${docs.length}`;

  // Prev/Next buttons
  document.querySelector('.prest-lightbox-prev').style.display = idx > 0 ? '' : 'none';
  document.querySelector('.prest-lightbox-next').style.display = idx < docs.length - 1 ? '' : 'none';
}

function lightboxNav(dir) {
  _prestState.lightboxIdx = Math.max(0, Math.min(_prestState.lightboxIdx + dir, _prestState.lightboxImgs.length - 1));
  _renderLightbox();
}

function closeLightbox() {
  const lb = document.getElementById('doc-lightbox');
  if (lb) { lb.style.display = 'none'; document.body.style.overflow = ''; }
}

function _lightboxClose(e) {
  if (e.target === document.getElementById('doc-lightbox')) closeLightbox();
}

/* ================================================================
   INTERAÇÕES DO RELATÓRIO
   ================================================================ */
function _initRelatorioInteractions() {
  // Teclado: ESC fecha lightbox, setas navegam
  document.addEventListener('keydown', _prestKeyHandler);

  // Inicial: mostrar modo completo
  setPrestView('completo');
}

function _prestKeyHandler(e) {
  const lb = document.getElementById('doc-lightbox');
  if (lb?.style.display === 'flex') {
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowRight') lightboxNav(1);
    if (e.key === 'ArrowLeft')  lightboxNav(-1);
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function _isImagem(doc) {
  if (!doc) return false;
  const mime = doc.mime_type || '';
  const nome = (doc.nome_arquivo || '').toLowerCase();
  const ext  = nome.split('.').pop();
  const b64  = doc.arquivo_base64 || '';
  return (
    mime.startsWith('image/') ||
    b64.startsWith('data:image') ||
    ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext) ||
    doc.tipo_documento === 'Foto / Registro'
  );
}

function _getDocIcon(tipo) {
  const cfg = typeof getTipoConfig === 'function' ? getTipoConfig(tipo) : { icon: 'fa-file' };
  return cfg.icon;
}

/* ================================================================
   EXPORTAR EXCEL
   ================================================================ */
function exportPrestacaoExcel() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS não carregado', 'error'); return; }
  const { despesas: dep, rubricas: rub, metas: met, projeto: p } = _prestState;
  if (!dep.length) { showToast('Nenhuma despesa para exportar', 'warning'); return; }

  const wb = XLSX.utils.book_new();

  // Aba 1: Despesas
  const depRows = dep.map(d => {
    const r = rub.find(x=>x.id===d.rubrica_id);
    return {
      'Data':d.data_despesa||'','Mês Referência':d.mes_referencia||'',
      'Categoria':r?.categoria||'','Rubrica':r?.descricao||'',
      'Descrição':d.descricao||'','Fornecedor':d.fornecedor||'',
      'CNPJ/CPF':d.cnpj_cpf||'','Nº Documento':d.numero_documento||'',
      'Tipo Documento':d.tipo_documento||'','Fonte':d.fonte||'',
      'Valor':Number(d.valor)||0,'Status':d.status_pagamento||''
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depRows), 'Despesas');

  // Aba 2: Metas
  const metRows = met.map(m => ({
    'Nº Meta':m.numero_meta||'','Descrição':m.descricao_meta||'',
    'Indicador':m.indicador||'','Status':m.status||'',
    'Ben. Previsto':Number(m.beneficiarios_previstos)||0,
    'Ben. Atendido':Number(m.beneficiarios_atendidos)||0,
    'Exec. Física (%)':Number(m.percentual_fisico)||0,
    'Valor Previsto':Number(m.valor_previsto)||0,
    'Valor Executado':Number(m.valor_executado)||0,
    'Data Início':m.data_inicio||'','Data Fim':m.data_fim||''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metRows), 'Metas');

  XLSX.writeFile(wb, `Prestacao_${p?.numero_proposta||'ONG'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
  showToast('Excel gerado com sucesso!', 'success');
}

/* ================================================================
   PDF PREMIUM com jsPDF
   ================================================================ */
async function printPrestacao() {
  const projId = document.getElementById('prest-select-projeto')?.value;
  if (!projId) { showToast('Selecione um projeto primeiro', 'error'); return; }

  if (typeof window.jspdf === 'undefined') {
    showToast('Abrindo prévia de impressão...', 'info');
    window.print(); return;
  }

  const btn = document.getElementById('btn-pdf-prest');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...'; }

  try {
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W    = doc.internal.pageSize.getWidth();
    const H    = doc.internal.pageSize.getHeight();
    const MGN  = 14;
    let yPos   = 0;
    let pgNum  = 1;

    // Paleta
    const AZUL   = [26, 86, 219];
    const VERDE  = [5, 150, 105];
    const CINZA  = [71, 85, 105];
    const TEXTO  = [15, 23, 42];
    const BEGE   = [248, 250, 252];

    const addPage = () => {
      // Rodapé na página atual
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(...CINZA);
      doc.text(`ONG Gestor v6 — Prestação de Contas — ${_prestState.projeto?.numero_proposta||''}`, MGN, H - 8);
      doc.text(`Página ${pgNum}`, W - MGN, H - 8, { align:'right' });
      doc.addPage();
      pgNum++;
      yPos = MGN;
    };

    const checkY = (needed) => { if (yPos + needed > H - 20) addPage(); };

    // ── CAPA ──
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, W, 65, 'F');
    doc.setFont('helvetica','bold');
    doc.setTextColor(255,255,255);
    doc.setFontSize(9);
    doc.text('RELATÓRIO DE PRESTAÇÃO DE CONTAS', W/2, 18, { align:'center' });
    doc.setFontSize(16);
    doc.text(_prestState.projeto?.nome_projeto||'Projeto', W/2, 30, { align:'center', maxWidth: W - 28 });
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    doc.text(`${_prestState.projeto?.numero_proposta||''} • ${_prestState.projeto?.ong_nome||''}`, W/2, 42, { align:'center' });
    doc.text(`${fmt.date(_prestState.projeto?.data_inicio)} → ${fmt.date(_prestState.projeto?.data_fim)}`, W/2, 50, { align:'center' });
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, W/2, 58, { align:'center' });
    yPos = 75;

    // ── Seção I: Resumo Financeiro ──
    const dep = _prestState.despesas;
    const rub = _prestState.rubricas;
    const met = _prestState.metas;
    const p   = _prestState.projeto;
    const totalExec  = dep.reduce((s,d)=>s+(Number(d.valor)||0),0);
    const totalRep   = Number(p?.valor_repasse)||0;
    const totalCont  = Number(p?.valor_contrapartida)||0;
    const execRepasse= dep.filter(d=>d.fonte==='Repasse Federal').reduce((s,d)=>s+(Number(d.valor)||0),0);
    const execContra = dep.filter(d=>d.fonte==='Contrapartida').reduce((s,d)=>s+(Number(d.valor)||0),0);
    const percExec   = calcPercent(totalExec, totalRep+totalCont);

    // Bloco título de seção
    const addSectionTitle = (num, title) => {
      checkY(14);
      doc.setFillColor(...AZUL);
      doc.roundedRect(MGN, yPos, W - 2*MGN, 9, 2, 2, 'F');
      doc.setFont('helvetica','bold');
      doc.setFontSize(10);
      doc.setTextColor(255,255,255);
      doc.text(`${num}. ${title}`, MGN + 5, yPos + 6.2);
      yPos += 13;
      doc.setTextColor(...TEXTO);
    };

    addSectionTitle('I', 'Resumo Financeiro');

    // KPIs em grid 3x2
    const kpiData = [
      ['Repasse Federal', fmt.currency(totalRep)],
      ['Contrapartida',   fmt.currency(totalCont)],
      ['Total Executado', fmt.currency(totalExec)],
      ['Exec. Repasse',   fmt.currency(execRepasse)],
      ['Exec. Contrapartida', fmt.currency(execContra)],
      ['Saldo Repasse', fmt.currency(totalRep - execRepasse)]
    ];
    const kpiW = (W - 2*MGN - 8) / 3;
    kpiData.forEach((kpi, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const kx  = MGN + col * (kpiW + 4);
      const ky  = yPos + row * 20;
      doc.setFillColor(...BEGE);
      doc.roundedRect(kx, ky, kpiW, 16, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica','normal');
      doc.setTextColor(...CINZA);
      doc.text(kpi[0], kx + 4, ky + 5);
      doc.setFontSize(10);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...TEXTO);
      doc.text(kpi[1], kx + 4, ky + 12);
    });
    yPos += 46;

    // Barra de progresso
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(MGN, yPos, W - 2*MGN, 6, 3, 3, 'F');
    const barW = (W - 2*MGN) * (percExec / 100);
    doc.setFillColor(...AZUL);
    doc.roundedRect(MGN, yPos, barW, 6, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica','bold');
    doc.setTextColor(...AZUL);
    doc.text(`Execução Financeira: ${fmt.percent(percExec)}`, MGN, yPos - 2);
    yPos += 12;

    // Tabela de categorias
    addSectionTitle('II', 'Execução por Categoria');
    const catMap = {};
    rub.forEach(r=>{ const c=r.categoria||'Outros'; if(!catMap[c])catMap[c]={p:0,e:0}; catMap[c].p+=Number(r.valor_previsto)||0; });
    dep.forEach(d=>{ const r=rub.find(x=>x.id===d.rubrica_id); const c=r?.categoria||'Outros'; if(!catMap[c])catMap[c]={p:0,e:0}; catMap[c].e+=Number(d.valor)||0; });

    doc.autoTable({
      startY: yPos,
      head: [['Categoria','Previsto','Executado','Saldo','%']],
      body: Object.entries(catMap).map(([c,v])=>[
        c, fmt.currency(v.p), fmt.currency(v.e),
        fmt.currency(v.p-v.e), fmt.percent(calcPercent(v.e,v.p))
      ]),
      foot: [['TOTAL',
        fmt.currency(Object.values(catMap).reduce((s,v)=>s+v.p,0)),
        fmt.currency(totalExec),
        fmt.currency(Object.values(catMap).reduce((s,v)=>s+v.p,0)-totalExec),
        fmt.percent(percExec)
      ]],
      styles:{fontSize:8, cellPadding:2.5, font:'helvetica'},
      headStyles:{fillColor:AZUL, textColor:[255,255,255], fontStyle:'bold'},
      footStyles:{fillColor:BEGE, fontStyle:'bold'},
      columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}},
      margin:{left:MGN,right:MGN},
      theme:'grid'
    });
    yPos = doc.lastAutoTable.finalY + 8;

    // Tabela de despesas (Seção III)
    addPage();
    addSectionTitle('III', 'Relação de Despesas Realizadas');

    const depRows = dep.sort((a,b)=>(a.mes_referencia||'').localeCompare(b.mes_referencia||'')).map(d => {
      const r = rub.find(x=>x.id===d.rubrica_id);
      return [
        fmt.date(d.data_despesa), d.mes_referencia||'—',
        (d.descricao||'—').slice(0,35), (d.fornecedor||'—').slice(0,25),
        d.numero_documento||'—', d.tipo_documento||'—',
        d.fonte==='Repasse Federal'?'Repasse':'Contrapart.',
        fmt.currency(d.valor), d.status_pagamento||'—'
      ];
    });

    doc.autoTable({
      startY: yPos,
      head: [['Data','Mês','Descrição','Fornecedor','Doc.','Tipo','Fonte','Valor','Pag.']],
      body: depRows,
      foot: [['','','','','','','TOTAL', fmt.currency(totalExec),'']],
      styles:{fontSize:7, cellPadding:1.8, font:'helvetica'},
      headStyles:{fillColor:AZUL, textColor:[255,255,255], fontStyle:'bold'},
      footStyles:{fillColor:BEGE, fontStyle:'bold'},
      columnStyles:{7:{halign:'right'}},
      margin:{left:MGN,right:MGN},
      theme:'striped'
    });
    yPos = doc.lastAutoTable.finalY + 8;

    // Metas (Seção IV)
    if (met.length) {
      checkY(20);
      addSectionTitle('IV', 'Execução Física das Metas');
      doc.autoTable({
        startY: yPos,
        head: [['#','Meta','Indicador','Ben. Prev.','Ben. Aten.','%','Status']],
        body: met.map(m=>[
          m.numero_meta, (m.descricao_meta||'—').slice(0,40),
          (m.indicador||'—').slice(0,30),
          m.beneficiarios_previstos||0, m.beneficiarios_atendidos||0,
          fmt.percent(Number(m.percentual_fisico)||0), m.status||'—'
        ]),
        styles:{fontSize:7.5, cellPadding:2, font:'helvetica'},
        headStyles:{fillColor:VERDE, textColor:[255,255,255], fontStyle:'bold'},
        columnStyles:{3:{halign:'center'},4:{halign:'center'},5:{halign:'center'}},
        margin:{left:MGN,right:MGN},
        theme:'grid'
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Rodapé última página
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`ONG Gestor v6 — Prestação de Contas — ${p?.numero_proposta||''}`, MGN, H - 8);
    doc.text(`Página ${pgNum}`, W - MGN, H - 8, { align:'right' });

    doc.save(`Prestacao_${p?.numero_proposta||'ONG'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`);
    showToast('✅ PDF gerado com sucesso!', 'success');

  } catch(e) {
    console.error('Erro ao gerar PDF:', e);
    showToast('Erro ao gerar PDF. Usando impressão do navegador...', 'warning');
    window.print();
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> Gerar PDF'; }
  }
}

function _printPrestacaoFallback() {
  window.print();
}

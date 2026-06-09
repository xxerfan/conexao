/* =============================================
   ONG GESTOR v3 — Prestação de Contas
   ============================================= */

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

async function loadPrestacao() {
  const projId = document.getElementById('prest-select-projeto')?.value;
  const c = document.getElementById('prestacao-conteudo');
  if (!c) return;
  if (!projId) { c.innerHTML = ''; return; }
  c.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner"></i> Gerando relatório...</div>`;

  try {
    const [pR, rR, mR, dR] = await Promise.all([
      DB.getAll('ong_projetos'), DB.getAll('ong_rubricas'),
      DB.getAll('ong_metas'),   DB.getAll('ong_despesas')
    ]);
    const p   = pR.find(x => x.id===projId);
    const rub = rR.filter(r => r.projeto_id===projId);
    const met = mR.filter(m => m.projeto_id===projId);
    const dep = dR.filter(d => d.projeto_id===projId);
    if (!p) { c.innerHTML=`<div class="alert alert-danger">Projeto não encontrado.</div>`; return; }

    const totalExec   = dep.reduce((s,d)=>s+(Number(d.valor)||0),0);
    const totalRep    = Number(p.valor_repasse)||0;
    const totalCont   = Number(p.valor_contrapartida)||0;
    const execRepasse = dep.filter(d=>d.fonte==='Repasse Federal').reduce((s,d)=>s+(Number(d.valor)||0),0);
    const execContra  = dep.filter(d=>d.fonte==='Contrapartida').reduce((s,d)=>s+(Number(d.valor)||0),0);
    const saldo       = totalRep - execRepasse;
    const percExec    = calcPercent(totalExec, totalRep+totalCont);
    const benPrev     = met.reduce((s,m)=>s+(Number(m.beneficiarios_previstos)||0),0);
    const benAten     = met.reduce((s,m)=>s+(Number(m.beneficiarios_atendidos)||0),0);

    const catMap={};
    rub.forEach(r=>{const cat=r.categoria||'Outros';if(!catMap[cat])catMap[cat]={previsto:0,executado:0};catMap[cat].previsto+=Number(r.valor_previsto)||0;});
    dep.forEach(d=>{const r=rub.find(x=>x.id===d.rubrica_id);const cat=r?.categoria||'Outros';if(!catMap[cat])catMap[cat]={previsto:0,executado:0};catMap[cat].executado+=Number(d.valor)||0;});

    const desByMes={};
    dep.forEach(d=>{const m=d.mes_referencia||'S/D';if(!desByMes[m])desByMes[m]=[];desByMes[m].push(d);});

    c.innerHTML = `
    <div id="relatorio-prestacao">
      <div class="card mb-3" style="border-top:4px solid var(--primary);">
        <div class="card-body">
          <div class="flex justify-between items-start mb-3" style="flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-size:1rem;font-weight:700;color:var(--primary);"><i class="fas fa-file-invoice"></i> Relatório de Prestação de Contas</div>
              <div class="text-xs text-muted">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            </div>
            <div class="text-right"><div class="font-semibold">${p.numero_proposta||'-'}</div><div class="text-xs text-muted">${p.modalidade||'-'}</div></div>
          </div>
          <div style="background:var(--bg-page);border-radius:8px;padding:14px;margin-bottom:14px;">
            <div class="grid-3" style="gap:12px;">
              <div><div class="text-xs text-muted">Projeto</div><div class="font-semibold text-sm">${p.nome_projeto||'-'}</div></div>
              <div><div class="text-xs text-muted">ONG</div><div class="font-semibold text-sm">${p.ong_nome||'-'}</div><div class="text-xs text-muted">${p.ong_cnpj||''}</div></div>
              <div><div class="text-xs text-muted">Concedente</div><div class="font-semibold text-sm">${p.concedente||'-'}</div></div>
              <div><div class="text-xs text-muted">Vigência</div><div class="font-semibold text-sm">${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</div></div>
              <div><div class="text-xs text-muted">Status</div>${statusBadge(p.status)}</div>
              <div><div class="text-xs text-muted">Local</div><div class="font-semibold text-sm">${p.municipio||'-'}${p.uf?'/'+p.uf:''}</div></div>
            </div>
          </div>
          ${p.objeto?`<div class="text-xs text-muted mb-1 font-semibold">Objeto</div><div class="text-sm">${p.objeto}</div>`:''}
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3><i class="fas fa-chart-pie text-primary"></i> I — Resumo Financeiro</h3></div>
        <div class="card-body">
          <div class="kpi-grid mb-3" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));">
            <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-university"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalRep)}</div><div class="kpi-label">Repasse Federal</div></div></div>
            <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-hand-holding-heart"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalCont)}</div><div class="kpi-label">Contrapartida</div></div></div>
            <div class="kpi-card"><div class="kpi-icon orange"><i class="fas fa-receipt"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(totalExec)}</div><div class="kpi-label">Total Executado</div></div></div>
            <div class="kpi-card"><div class="kpi-icon teal"><i class="fas fa-balance-scale"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem;color:${saldo<0?'var(--danger)':'inherit'}">${fmt.currency(saldo)}</div><div class="kpi-label">Saldo</div></div></div>
            <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-arrow-down"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(execRepasse)}</div><div class="kpi-label">Repasse Exec.</div></div></div>
            <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-arrow-up"></i></div><div class="kpi-info"><div class="kpi-value" style="font-size:.9rem">${fmt.currency(execContra)}</div><div class="kpi-label">Contrapartida Exec.</div></div></div>
          </div>
          <div class="flex justify-between mb-1"><span class="text-sm">Execução Financeira Total</span><span class="font-semibold">${fmt.percent(percExec)}</span></div>
          <div class="progress-bar-wrap" style="height:12px;"><div class="progress-bar-fill ${progressColor(percExec)}" style="width:${percExec}%"></div></div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3><i class="fas fa-list text-primary"></i> II — Execução por Categoria</h3></div>
        <div class="table-wrapper"><table>
          <thead><tr><th>Categoria</th><th class="text-right">Previsto</th><th class="text-right">Executado</th><th class="text-right">Saldo</th><th>Execução</th></tr></thead>
          <tbody>
            ${Object.entries(catMap).map(([cat,v])=>{const s=v.previsto-v.executado;const pc=calcPercent(v.executado,v.previsto);return`<tr><td><span class="badge badge-blue">${cat}</span></td><td class="text-right">${fmt.currency(v.previsto)}</td><td class="text-right font-semibold">${fmt.currency(v.executado)}</td><td class="text-right ${s<0?'text-danger':'text-success'}">${fmt.currency(s)}</td><td style="min-width:90px;">${progressBar(pc)}</td></tr>`;}).join('')}
            <tr style="font-weight:700;background:#f8fafc;"><td>TOTAL</td><td class="text-right">${fmt.currency(Object.values(catMap).reduce((s,v)=>s+v.previsto,0))}</td><td class="text-right">${fmt.currency(totalExec)}</td><td class="text-right">${fmt.currency(Object.values(catMap).reduce((s,v)=>s+v.previsto,0)-totalExec)}</td><td>${progressBar(percExec)}</td></tr>
          </tbody>
        </table></div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3><i class="fas fa-bullseye text-primary"></i> III — Execução Física das Metas</h3></div>
        <div class="card-body">
          <div class="flex justify-between mb-1"><span class="text-sm">Beneficiários: <strong>${fmt.number(benAten)} de ${fmt.number(benPrev)}</strong></span><span class="font-semibold">${fmt.percent(calcPercent(benAten,benPrev))}</span></div>
          <div class="progress-bar-wrap mb-3"><div class="progress-bar-fill green" style="width:${calcPercent(benAten,benPrev)}%"></div></div>
        </div>
        <div class="table-wrapper"><table>
          <thead><tr><th>#</th><th>Meta</th><th>Ben. Prev.</th><th>Ben. Aten.</th><th>Exec. Física</th><th>Vlr. Prev.</th><th>Vlr. Exec.</th><th>Status</th></tr></thead>
          <tbody>
            ${!met.length?`<tr><td colspan="8" class="text-center text-muted" style="padding:14px;">Nenhuma meta</td></tr>`:met.map(m=>{
              // Cálculo dinâmico da execução financeira por meta
              const totalPrevRubs = rub.reduce((s,r)=>s+(Number(r.valor_previsto)||0),0);
              const execMeta = totalPrevRubs > 0
                ? totalExec * ((Number(m.valor_previsto)||0) / totalPrevRubs)
                : (met.length > 0 ? totalExec / met.length : 0);
              return `<tr><td class="font-semibold">${m.numero_meta}</td><td><div style="font-size:.82rem;font-weight:500;">${m.descricao_meta}</div><div class="text-xs text-muted">${m.indicador||''}</div></td><td class="text-center">${fmt.number(m.beneficiarios_previstos)}</td><td class="text-center font-semibold">${fmt.number(m.beneficiarios_atendidos)}</td><td style="min-width:90px;">${progressBar(Number(m.percentual_fisico)||0)}</td><td class="text-right">${fmt.currency(m.valor_previsto)}</td><td class="text-right">${fmt.currency(execMeta)}</td><td>${statusBadge(m.status)}</td></tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3><i class="fas fa-receipt text-primary"></i> IV — Relação de Despesas</h3></div>
        ${Object.entries(desByMes).sort((a,b)=>a[0].localeCompare(b[0])).map(([mes,itens])=>{
          const totalMes=itens.reduce((s,d)=>s+(Number(d.valor)||0),0);
          return `<div style="padding:10px 18px 0;"><div style="background:#f0f7ff;padding:6px 12px;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;"><span class="font-semibold text-sm"><i class="fas fa-calendar-alt"></i> ${fmt.monthYear(mes)}</span><span class="font-semibold text-sm">${fmt.currency(totalMes)}</span></div></div>
          <div class="table-wrapper" style="margin-bottom:6px;"><table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Fornecedor</th><th>Doc.</th><th>Tipo</th><th>Fonte</th><th class="text-right">Valor</th><th>Pag.</th></tr></thead>
            <tbody>${itens.sort((a,b)=>(a.data_despesa||'').localeCompare(b.data_despesa||'')).map(d=>`<tr><td class="text-xs">${fmt.date(d.data_despesa)}</td><td style="font-size:.8rem;">${d.descricao||'-'}</td><td><div style="font-size:.8rem;">${d.fornecedor||'-'}</div><div class="text-xs text-muted">${d.cnpj_cpf||''}</div></td><td class="text-xs">${d.numero_documento||'-'}</td><td class="text-xs">${d.tipo_documento||'-'}</td><td><span class="badge ${d.fonte==='Repasse Federal'?'badge-blue':'badge-green'}">${d.fonte||'-'}</span></td><td class="text-right font-semibold">${fmt.currency(d.valor)}</td><td>${statusBadge(d.status_pagamento)}</td></tr>`).join('')}
            <tr style="font-weight:700;background:#f8fafc;"><td colspan="6" class="text-right">Subtotal ${fmt.monthYear(mes)}</td><td class="text-right">${fmt.currency(totalMes)}</td><td></td></tr></tbody>
          </table></div>`;
        }).join('')}
        <div style="padding:10px 18px;background:#f8fafc;border-top:2px solid var(--border);"><div class="flex justify-between font-semibold"><span>TOTAL GERAL</span><span>${fmt.currency(totalExec)}</span></div></div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><h3><i class="fas fa-paperclip text-primary"></i> V — Documentos e Anexos</h3></div>
        <div class="card-body" id="prestacao-docs-section">
          <div class="loading-spinner"><i class="fas fa-spinner"></i> Carregando documentos...</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="alert alert-info mb-0">
            <i class="fas fa-info-circle"></i>
            <div><strong>Atenção:</strong> Relatório gerado automaticamente pelo ONG Gestor. Para prestação de contas oficial ao TransfereGov, utilize o sistema oficial e anexe os documentos originais.</div>
          </div>
        </div>
      </div>
    </div>`;

    // Carrega Seção V — Documentos (async após renderizar HTML)
    setTimeout(async () => {
      const docsSection = document.getElementById('prestacao-docs-section');
      if (docsSection && typeof renderDocumentosSecaoPrestacao === 'function') {
        docsSection.innerHTML = await renderDocumentosSecaoPrestacao(projId);
      } else if (docsSection) {
        docsSection.innerHTML = `<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> Módulo de documentos não disponível.</div>`;
      }
    }, 50);

  } catch(err) {
    c.innerHTML=`<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Erro: ${err.message}</div>`;
    console.error(err);
  }
}

function printPrestacao() {
  const projId   = document.getElementById('prest-select-projeto')?.value;
  if (!projId)   { showToast('Selecione um projeto primeiro','error'); return; }
  const conteudo = document.getElementById('relatorio-prestacao');
  if (!conteudo) { showToast('Gere o relatório primeiro','error'); return; }
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Prestação de Contas</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,sans-serif;font-size:11px;color:#111;padding:20px}
  h3{font-size:12px;margin:12px 0 6px;font-weight:600}table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{border:1px solid #e5e7eb;padding:5px 8px;font-size:10px}th{background:#f3f4f6;font-weight:600;text-align:left}
  .card{border:1px solid #e5e7eb;border-radius:6px;margin-bottom:12px;overflow:hidden}
  .card-header{padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb}.card-body{padding:12px}
  .badge{display:inline-block;padding:2px 6px;border-radius:99px;font-size:9px;font-weight:600}
  .badge-blue{background:#dbeafe;color:#1e40af}.badge-green{background:#d1fae5;color:#065f46}
  .badge-orange{background:#fef3c7;color:#92400e}.badge-gray{background:#f3f4f6;color:#374151}
  .text-right{text-align:right}.text-muted{color:#6b7280}.font-semibold{font-weight:600}
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .kpi-card{border:1px solid #e5e7eb;border-radius:6px;padding:8px;display:flex;align-items:center;gap:8px}
  .kpi-value{font-size:12px;font-weight:700}.kpi-label{font-size:9px;color:#6b7280}
  .progress-bar-wrap{background:#e5e7eb;border-radius:4px;height:5px;margin:4px 0}
  .progress-bar-fill{height:100%;border-radius:4px;background:#1a56db}
  .alert{padding:8px 12px;border-radius:6px;background:#eff6ff;border:1px solid #bfdbfe;font-size:10px;display:flex;gap:8px}
  @media print{body{padding:5mm}@page{margin:10mm}}</style>
  </head><body>${conteudo.innerHTML}</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

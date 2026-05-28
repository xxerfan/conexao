/* =============================================
   ONG GESTOR v3 — Projetos
   ============================================= */

let projetosData  = [];
let projetoEditId = null;

async function loadProjetos() {
  try {
    const data   = await DB.getAll('ong_projetos');
    projetosData = data || [];
    CACHE.projetos = projetosData;
    renderProjetosGrid(projetosData);
  } catch(err) {
    showToast('Erro ao carregar projetos: ' + err.message, 'error');
    console.error(err);
  }
}

function renderProjetosGrid(projetos) {
  const container = document.getElementById('projetos-grid');
  if (!container) return;
  if (!projetos.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-folder-open"></i>
        <p>Nenhum projeto cadastrado. Clique em "Novo Projeto" para começar.</p>
      </div>`;
    return;
  }
  const deps = CACHE.despesas || [];
  container.innerHTML = projetos.map(p => {
    const exec = deps.filter(d => d.projeto_id===p.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const perc = calcPercent(exec, p.valor_repasse);

    return `
    <article class="project-card" onclick="viewProjeto('${p.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
        <div style="min-width:0;">
          <div class="project-card-title">${p.nome_projeto||'Sem nome'}</div>
          <div class="project-card-code"><i class="fas fa-hashtag"></i> ${p.numero_proposta||'-'}</div>
        </div>
        ${statusBadge(p.status)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        <span class="text-xs text-muted"><i class="fas fa-building"></i> ${p.ong_nome||'-'}</span>
        <span class="text-xs text-muted"><i class="fas fa-university"></i> ${p.concedente||'-'}</span>
        <span class="text-xs text-muted"><i class="fas fa-map-marker-alt"></i> ${p.municipio||'-'}${p.uf?'/'+p.uf:''}</span>
      </div>
      <hr class="separator" style="margin:10px 0;">
      <div class="flex justify-between mb-1">
        <span class="text-xs text-muted">Repasse Federal</span>
        <span class="font-semibold text-sm">${fmt.currency(p.valor_repasse)}</span>
      </div>
      <div class="flex justify-between mb-1">
        <span class="text-xs text-muted">Contrapartida</span>
        <span class="text-sm">${fmt.currency(p.valor_contrapartida)}</span>
      </div>
      <div class="flex justify-between mb-1">
        <span class="text-xs text-muted">Executado</span>
        <span class="text-sm text-success font-semibold">${fmt.currency(exec)}</span>
      </div>
      <div class="progress-bar-wrap mb-2" style="height:5px;">
        <div class="progress-bar-fill ${progressColor(perc)}" style="width:${Math.min(perc,100)}%"></div>
      </div>
      <div class="flex justify-between items-center mt-2">
        <div>
          <span class="text-xs text-muted">${p.modalidade||'-'}</span>
          <span class="text-xs text-muted ml-1">·</span>
          <span class="text-xs text-muted ml-1">${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</span>
        </div>
        <div class="flex gap-1" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-xs" onclick="viewProjeto('${p.id}')" title="Dashboard">
            <i class="fas fa-chart-line"></i>
          </button>
          <button class="btn btn-outline btn-xs btn-icon" onclick="editProjeto('${p.id}')" title="Editar">
            <i class="fas fa-pencil"></i>
          </button>
          <button class="btn btn-danger btn-xs btn-icon" onclick="deleteProjeto('${p.id}')" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </article>`;
  }).join('');
}

function filterProjetos() {
  const q  = (document.getElementById('proj-search')?.value||'').toLowerCase();
  const st = document.getElementById('proj-filter-status')?.value||'';
  const filtered = projetosData.filter(p => {
    const mQ = !q || [p.nome_projeto,p.numero_proposta,p.ong_nome,p.concedente].some(f=>(f||'').toLowerCase().includes(q));
    const mS = !st || p.status===st;
    return mQ && mS;
  });
  renderProjetosGrid(filtered);
}

/* ── Modal ── */
function openModalProjeto(id=null) {
  projetoEditId = id;
  document.getElementById('modal-projeto-title').textContent = id ? 'Editar Projeto' : 'Novo Projeto';
  const f = document.getElementById('form-projeto');
  f.reset();
  if (id) {
    const p = projetosData.find(x => x.id===id);
    if (p) Object.keys(p).forEach(k => { const el=f.elements[k]; if(el) el.value=p[k]??''; });
  }
  document.getElementById('modal-projeto').classList.add('open');
}

function closeModalProjeto() {
  document.getElementById('modal-projeto')?.classList.remove('open');
  projetoEditId = null;
}

async function editProjeto(id) {
  if (!projetosData.length) await loadProjetos();
  openModalProjeto(id);
}

async function saveProjeto() {
  const form = document.getElementById('form-projeto');
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.nome_projeto?.trim()) { showToast('Nome obrigatório', 'error'); return; }
  ['valor_repasse','valor_contrapartida','valor_total'].forEach(k => { data[k] = Number(data[k])||0; });
  if (!data.valor_total) data.valor_total = (data.valor_repasse||0) + (data.valor_contrapartida||0);
  try {
    if (projetoEditId) {
      await DB.update('ong_projetos', projetoEditId, data);
      showToast('Projeto atualizado!');
    } else {
      data.id = genId();
      await DB.insert('ong_projetos', data);
      showToast('Projeto criado!');
    }
    CACHE.clear();
    closeModalProjeto();
    await loadProjetos();
  } catch(err) { showToast('Erro: ' + err.message, 'error'); }
}

async function deleteProjeto(id) {
  if (!confirmDialog('Excluir este projeto?\nATENÇÃO: Os dados financeiros vinculados serão mantidos no banco.')) return;
  try {
    await DB.delete('ong_projetos', id);
    showToast('Projeto excluído!');
    CACHE.clear();
    await loadProjetos();
  } catch(err) { showToast('Erro: ' + err.message, 'error'); }
}

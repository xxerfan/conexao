/* =============================================
   ONG GESTOR v5 — Projetos (Supreme Edition)
   ============================================= */

let projetosData  = [];
let projetoEditId = null;

/* ═══════════════════════════════════════════
   CARREGAR PROJETOS
════════════════════════════════════════════ */
async function loadProjetos() {
  // Skeleton enquanto carrega
  skeletonCards('projetos-grid', 6);

  try {
    const data   = await DB.getAll('ong_projetos');
    projetosData = data || [];
    CACHE.projetos = projetosData;
    renderProjetosGrid(projetosData);
  } catch(err) {
    showToast('Erro ao carregar projetos: ' + err.message, 'error');
    const container = document.getElementById('projetos-grid');
    if (container) container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-exclamation-circle" style="color:var(--danger);opacity:.5;"></i>
        <p>Falha ao carregar projetos.</p>
      </div>`;
    console.error(err);
  }
}

/* ═══════════════════════════════════════════
   RENDERIZAR GRID DE PROJETOS
════════════════════════════════════════════ */
function renderProjetosGrid(projetos) {
  const container = document.getElementById('projetos-grid');
  if (!container) return;

  if (!projetos.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-folder-open"></i>
        <p>Nenhum projeto encontrado. Clique em <strong>Novo Projeto</strong> para começar.</p>
      </div>`;
    return;
  }

  const deps = CACHE.despesas || [];

  container.innerHTML = projetos.map(p => {
    const exec      = deps.filter(d => d.projeto_id === p.id).reduce((s,d) => s+(Number(d.valor)||0), 0);
    const perc      = calcPercent(exec, p.valor_repasse);
    const nLancam   = deps.filter(d => d.projeto_id === p.id).length;
    const saldo     = (Number(p.valor_repasse)||0) - exec;

    /* Data de término e dias restantes */
    let diasBadge = '';
    if (p.data_fim) {
      const hoje = new Date();
      const fim  = new Date(p.data_fim);
      const dias = Math.ceil((fim - hoje) / 86400000);
      if (dias > 0 && dias <= 30 && p.status === 'Em Execução') {
        diasBadge = `<span class="badge badge-red" style="font-size:.6rem;"><i class="fas fa-fire"></i> ${dias}d</span>`;
      } else if (dias > 0 && dias <= 90 && p.status === 'Em Execução') {
        diasBadge = `<span class="badge badge-orange" style="font-size:.6rem;"><i class="fas fa-clock"></i> ${dias}d</span>`;
      }
    }

    return `
    <article class="project-card" onclick="viewProjeto('${p.id}')">
      <!-- Header do card -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;">
        <div style="min-width:0;">
          <div class="project-card-title">${p.nome_projeto || 'Sem nome'}</div>
          <div class="project-card-code">
            <i class="fas fa-hashtag" style="font-size:.65rem;"></i> ${p.numero_proposta || '-'}
          </div>
        </div>
        <div class="flex gap-1 items-center" style="flex-shrink:0;">
          ${diasBadge}
          ${statusBadge(p.status)}
        </div>
      </div>

      <!-- Metadados -->
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
        ${p.ong_nome ? `<div class="text-xs text-muted"><i class="fas fa-building" style="width:14px;color:var(--gray-400);"></i> ${p.ong_nome}</div>` : ''}
        ${p.concedente ? `<div class="text-xs text-muted"><i class="fas fa-university" style="width:14px;color:var(--gray-400);"></i> ${p.concedente}</div>` : ''}
        ${(p.municipio||p.uf) ? `<div class="text-xs text-muted"><i class="fas fa-map-marker-alt" style="width:14px;color:var(--gray-400);"></i> ${p.municipio||''}${p.uf ? '/'+p.uf : ''}</div>` : ''}
        ${(p.data_inicio||p.data_fim) ? `<div class="text-xs text-muted"><i class="fas fa-calendar" style="width:14px;color:var(--gray-400);"></i> ${fmt.date(p.data_inicio)} → ${fmt.date(p.data_fim)}</div>` : ''}
      </div>

      <div class="divider"></div>

      <!-- Financeiro -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div>
          <div class="text-xs text-muted mb-0" style="margin-bottom:2px;">Repasse Federal</div>
          <div class="font-semibold text-sm">${fmt.currency(p.valor_repasse)}</div>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Executado</div>
          <div class="font-semibold text-sm text-success">${fmt.currency(exec)}</div>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Saldo</div>
          <div class="font-semibold text-sm ${saldo < 0 ? 'text-danger' : ''}">${fmt.currency(saldo)}</div>
        </div>
        <div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Lançamentos</div>
          <div class="font-semibold text-sm">${nLancam}</div>
        </div>
      </div>

      <!-- Barra de execução -->
      <div>
        <div class="flex justify-between mb-1">
          <span class="text-xs text-muted">Execução financeira</span>
          <span class="text-xs font-semibold ${perc >= 90 ? 'text-success' : 'text-primary'}">${fmt.percent(perc)}</span>
        </div>
        <div class="progress-bar-wrap" style="height:6px;">
          <div class="progress-bar-fill ${progressColor(perc)}" style="width:${Math.min(perc,100)}%"></div>
        </div>
      </div>

      <!-- Ações -->
      <div class="flex justify-between items-center mt-2" style="padding-top:10px;border-top:1px solid var(--border-light);" onclick="event.stopPropagation()">
        <span class="text-xs text-muted">${p.modalidade || '-'}</span>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-xs" onclick="viewProjeto('${p.id}')" title="Ver Dashboard">
            <i class="fas fa-chart-line"></i> Dash
          </button>
          <button class="btn btn-outline btn-xs btn-icon" onclick="editProjeto('${p.id}')" title="Editar Projeto">
            <i class="fas fa-pencil"></i>
          </button>
          <button class="btn btn-danger btn-xs btn-icon" onclick="deleteProjeto('${p.id}')" title="Excluir Projeto">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   FILTRAR PROJETOS
════════════════════════════════════════════ */
function filterProjetos() {
  const q  = (document.getElementById('proj-search')?.value || '').toLowerCase();
  const st = document.getElementById('proj-filter-status')?.value || '';
  const filtered = projetosData.filter(p => {
    const mQ = !q  || [p.nome_projeto, p.numero_proposta, p.ong_nome, p.concedente, p.municipio]
                        .some(f => (f || '').toLowerCase().includes(q));
    const mS = !st || p.status === st;
    return mQ && mS;
  });
  renderProjetosGrid(filtered);
}

/* ═══════════════════════════════════════════
   MODAL PROJETO
════════════════════════════════════════════ */
function openModalProjeto(id = null) {
  projetoEditId = id;
  document.getElementById('modal-projeto-title').textContent = id ? 'Editar Projeto' : 'Novo Projeto';
  const f = document.getElementById('form-projeto');
  f.reset();
  if (id) {
    const p = projetosData.find(x => x.id === id);
    if (p) Object.keys(p).forEach(k => {
      const el = f.elements[k];
      if (el) el.value = p[k] ?? '';
    });
  }
  document.getElementById('modal-projeto').classList.add('open');
  // Foca no primeiro campo
  setTimeout(() => f.querySelector('[name="nome_projeto"]')?.focus(), 100);
}

function closeModalProjeto() {
  document.getElementById('modal-projeto')?.classList.remove('open');
  projetoEditId = null;
}

async function editProjeto(id) {
  if (!projetosData.length) await loadProjetos();
  openModalProjeto(id);
}

/* ═══════════════════════════════════════════
   SALVAR PROJETO
════════════════════════════════════════════ */
async function saveProjeto() {
  const form = document.getElementById('form-projeto');
  const data = Object.fromEntries(new FormData(form).entries());

  // Validações
  if (!data.nome_projeto?.trim()) { showToast('Nome do projeto é obrigatório', 'error'); return; }
  if (!data.numero_proposta?.trim()) { showToast('Número da proposta é obrigatório', 'warning'); }

  // Converte numéricos
  ['valor_repasse', 'valor_contrapartida', 'valor_total'].forEach(k => {
    data[k] = Number(data[k]) || 0;
  });
  if (!data.valor_total) {
    data.valor_total = (data.valor_repasse || 0) + (data.valor_contrapartida || 0);
  }

  // Botão de loading
  const btnSave = document.querySelector('#modal-projeto .btn-primary');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  }

  try {
    if (projetoEditId) {
      await DB.update('ong_projetos', projetoEditId, data);
      showToast('Projeto atualizado com sucesso!', 'success');
    } else {
      data.id = genId();
      await DB.insert('ong_projetos', data);
      showToast('Projeto criado com sucesso!', 'success');
    }
    CACHE.clear();
    closeModalProjeto();
    await loadProjetos();
  } catch(err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar Projeto';
    }
  }
}

/* ═══════════════════════════════════════════
   EXCLUIR PROJETO
════════════════════════════════════════════ */
async function deleteProjeto(id) {
  const confirmado = await confirmDialog(
    'Tem certeza que deseja excluir este projeto?\n\nOs lançamentos financeiros vinculados serão mantidos no banco de dados.',
    'Excluir Projeto',
    'danger'
  );
  if (!confirmado) return;

  try {
    await DB.delete('ong_projetos', id);
    showToast('Projeto excluído.', 'success');
    CACHE.clear();
    await loadProjetos();
  } catch(err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

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
        <div style="min-width:0;flex:1;">
          ${p.logo_url ? `<img src="${p.logo_url}" alt="Logo" style="height:32px;max-width:100px;object-fit:contain;border-radius:4px;margin-bottom:6px;display:block;">` : ''}
          <div class="project-card-title">${p.nome_projeto || 'Sem nome'}</div>
          <div class="project-card-code">
            <i class="fas fa-hashtag" style="font-size:.65rem;"></i> ${p.numero_proposta || '-'}
            ${p.termo_fomento ? ` &nbsp;·&nbsp; TF: ${p.termo_fomento}` : ''}
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
        ${p.deputado ? `<div class="text-xs text-muted"><i class="fas fa-landmark" style="width:14px;color:var(--gray-400);"></i> ${p.deputado}</div>` : ''}
        ${p.termo_fomento ? `<div class="text-xs text-muted"><i class="fas fa-file-signature" style="width:14px;color:var(--gray-400);"></i> TF: ${p.termo_fomento}</div>` : ''}
        ${p.situacao ? `<div class="text-xs" style="margin-top:2px;"><span style="background:var(--primary-100);color:var(--primary);padding:1px 6px;border-radius:4px;font-weight:500;">${p.situacao}</span></div>` : ''}
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
        ${p.custeio > 0 ? `<div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Custeio</div>
          <div class="font-semibold text-sm text-primary">${fmt.currency(p.custeio)}</div>
        </div>` : `<div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Saldo</div>
          <div class="font-semibold text-sm ${saldo < 0 ? 'text-danger' : ''}">${fmt.currency(saldo)}</div>
        </div>`}
        ${p.investimento > 0 ? `<div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Investimento</div>
          <div class="font-semibold text-sm text-purple">${fmt.currency(p.investimento)}</div>
        </div>` : `<div>
          <div class="text-xs text-muted" style="margin-bottom:2px;">Lançamentos</div>
          <div class="font-semibold text-sm">${nLancam}</div>
        </div>`}
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
  document.getElementById('modal-projeto-title').innerHTML =
    `<i class="fas fa-folder-${id?'open':'plus'} text-primary"></i> ${id ? 'Editar Projeto' : 'Novo Projeto'}`;
  const f = document.getElementById('form-projeto');
  f.reset();
  _clearLogoPreview();

  if (id) {
    const p = projetosData.find(x => x.id === id);
    if (p) {
      Object.keys(p).forEach(k => {
        const el = f.elements[k];
        if (el) el.value = p[k] ?? '';
      });
      // Carrega logo se existir
      if (p.logo_url) _setLogoPreview(p.logo_url);
    }
  }
  document.getElementById('modal-projeto').classList.add('open');
  // Reseta para aba 1
  if (typeof switchProjetoTab === 'function') {
    setTimeout(() => switchProjetoTab('ident'), 30);
  }
  // Foca no primeiro campo
  setTimeout(() => f.querySelector('[name="nome_projeto"]')?.focus(), 150);
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
   LOGOMARCA DA ONG
════════════════════════════════════════════ */
function triggerLogoUpload() {
  document.getElementById('logo-file-input')?.click();
}

async function handleLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Imagem muito grande. Máximo: 2 MB', 'warning');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('Apenas imagens são aceitas (JPG, PNG, WebP)', 'warning');
    return;
  }

  // FASE 2: tenta upload para Supabase Storage
  const btn    = document.getElementById('btn-logo-upload') || document.querySelector('[onclick="triggerLogoUpload()"]');
  const hidden = document.getElementById('logo-url-hidden');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  try {
    const path = Storage.makePath('logos', file.name);
    const url  = await Storage.upload(file, path);
    _setLogoPreview(url);
    if (hidden) hidden.value = url;
    showToast('Logo enviada com sucesso!', 'success');
  } catch(e) {
    // Fallback: base64 local
    console.warn('[Logo] Storage indisponível, usando base64:', e.message);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      _setLogoPreview(base64);
      if (hidden) hidden.value = base64;
      showToast('Logo carregada localmente (Storage offline)', 'warning');
    };
    reader.readAsDataURL(file);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Upload Logo'; }
  }
}

function _setLogoPreview(src) {
  const img    = document.getElementById('logo-preview-img');
  const ph     = document.getElementById('logo-preview-placeholder');
  const btnClr = document.getElementById('btn-clear-logo');
  if (img)    { img.src = src; img.style.display = ''; }
  if (ph)     ph.style.display = 'none';
  if (btnClr) btnClr.style.display = '';
}

function _clearLogoPreview() {
  const img    = document.getElementById('logo-preview-img');
  const ph     = document.getElementById('logo-preview-placeholder');
  const btnClr = document.getElementById('btn-clear-logo');
  const hidden = document.getElementById('logo-url-hidden');
  const inp    = document.getElementById('logo-file-input');
  if (img)    { img.src = ''; img.style.display = 'none'; }
  if (ph)     ph.style.display = '';
  if (btnClr) btnClr.style.display = 'none';
  if (hidden) hidden.value = '';
  if (inp)    inp.value = '';
}

function clearLogo() {
  _clearLogoPreview();
}

/* ═══════════════════════════════════════════
   SALVAR PROJETO
════════════════════════════════════════════ */
async function saveProjeto() {
  const form = document.getElementById('form-projeto');
  const raw  = Object.fromEntries(new FormData(form).entries());

  // Validações
  if (!raw.nome_projeto?.trim()) { showToast('Nome do projeto é obrigatório', 'error'); return; }

  // ── Campos base (sempre existem no banco) ──
  const data = {
    nome_projeto:        raw.nome_projeto        || '',
    numero_proposta:     raw.numero_proposta      || '',
    modalidade:          raw.modalidade           || 'Termo de Fomento',
    status:              raw.status               || 'Em Execução',
    ong_nome:            raw.ong_nome             || '',
    ong_cnpj:            raw.ong_cnpj             || '',
    concedente:          raw.concedente           || '',
    municipio:           raw.municipio            || '',
    uf:                  raw.uf                   || '',
    publico_beneficiario: raw.publico_beneficiario || '',
    objeto:              raw.objeto               || '',
    valor_repasse:       Number(raw.valor_repasse)       || 0,
    valor_contrapartida: Number(raw.valor_contrapartida) || 0,
    valor_total:         Number(raw.valor_total)         || 0,
    data_inicio:         raw.data_inicio || null,
    data_fim:            raw.data_fim    || null,
  };

  // Auto-calc total se não preenchido
  if (!data.valor_total) {
    data.valor_total = data.valor_repasse + data.valor_contrapartida;
  }

  // ── Campos novos v5 (só envia se o campo HTML existir no formulário) ──
  // Serão ignorados pelo Supabase se a coluna não existir ainda
  const camposV5 = [
    'termo_fomento','numero_item','deputado','situacao',
    'responsavel_legal','cpf_responsavel','email_contato','endereco_ong',
    'cnpj_concedente','unidade_gestora','programa_orcamentario',
    'caracterizacao','metas_pnc','ppa_programa','logo_url'
  ];
  camposV5.forEach(k => {
    if (raw[k] !== undefined && raw[k] !== '') data[k] = raw[k];
  });

  // Numéricos novos
  ['custeio','investimento'].forEach(k => {
    if (raw[k] !== undefined) data[k] = Number(raw[k]) || 0;
  });

  // Botão de loading
  const btnSave = document.getElementById('btn-salvar-projeto') ||
                  document.querySelector('#modal-projeto .btn-primary');
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
    // Tenta identificar se é erro de coluna não existente
    const msg = err.message || '';
    if (msg.includes('PGRST204') || msg.includes('column')) {
      showToast('⚠️ Execute o supabase_fix_permissions.sql para criar as novas colunas. Por enquanto salvando campos básicos...', 'warning');
      // Retry com apenas campos base
      const dataBase = {
        nome_projeto: data.nome_projeto, numero_proposta: data.numero_proposta,
        modalidade: data.modalidade, status: data.status, ong_nome: data.ong_nome,
        ong_cnpj: data.ong_cnpj, concedente: data.concedente, municipio: data.municipio,
        uf: data.uf, publico_beneficiario: data.publico_beneficiario, objeto: data.objeto,
        valor_repasse: data.valor_repasse, valor_contrapartida: data.valor_contrapartida,
        valor_total: data.valor_total, data_inicio: data.data_inicio, data_fim: data.data_fim,
      };
      try {
        if (projetoEditId) {
          await DB.update('ong_projetos', projetoEditId, dataBase);
        } else {
          dataBase.id = data.id || genId();
          await DB.insert('ong_projetos', dataBase);
        }
        showToast('Projeto salvo (campos básicos). Execute o SQL de atualização para habilitar todos os campos.', 'info');
        CACHE.clear();
        closeModalProjeto();
        await loadProjetos();
      } catch(err2) {
        showToast('Erro ao salvar: ' + err2.message, 'error');
      }
    } else {
      showToast('Erro ao salvar: ' + msg, 'error');
    }
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

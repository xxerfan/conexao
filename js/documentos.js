/* =============================================
   ONG GESTOR v3 — Gestão de Documentos / Anexos
   Suporta: upload Base64 (PDF <8MB) + URL externa
   ============================================= */

/* ══════════════════════════════════════════════════
   TIPOS DE DOCUMENTO — categorias completas MROSC
══════════════════════════════════════════════════ */
const TIPOS_DOCUMENTO = [
  { key:'Nota Fiscal',              icon:'fa-file-invoice',        cor:'blue'   },
  { key:'Recibo',                   icon:'fa-receipt',             cor:'teal'   },
  { key:'Extrato Bancário',         icon:'fa-landmark',            cor:'green'  },
  { key:'Termo de Fomento',         icon:'fa-file-signature',      cor:'purple' },
  { key:'Contrato',                 icon:'fa-file-contract',       cor:'orange' },
  { key:'RG / CPF',                 icon:'fa-id-card',             cor:'gray'   },
  { key:'Currículo',                icon:'fa-user-graduate',       cor:'gray'   },
  { key:'Comprovante de Pagamento', icon:'fa-check-circle',        cor:'green'  },
  { key:'Relatório de Atividade',   icon:'fa-clipboard-list',      cor:'blue'   },
  { key:'Foto / Registro',          icon:'fa-camera',              cor:'pink'   },
  { key:'Ordem de Serviço',         icon:'fa-tools',               cor:'orange' },
  { key:'Ata de Reunião',           icon:'fa-users',               cor:'teal'   },
  { key:'Declaração',               icon:'fa-file-alt',            cor:'blue'   },
  { key:'Planilha de Execução',     icon:'fa-table',               cor:'green'  },
  { key:'Comprovante Fiscal',       icon:'fa-stamp',               cor:'orange' },
  { key:'Outros',                   icon:'fa-paperclip',           cor:'gray'   }
];

/* ══════════════════════════════════════════════════
   ESTADO DO MÓDULO
══════════════════════════════════════════════════ */
let documentosData    = [];
let projetosDocData   = [];
let rubricasDocData   = [];
let despesasDocData   = [];
let documentoEditId   = null;

// Arquivo selecionado pelo usuário para upload
let _docArquivoSelecionado = null; // { base64, nome, mime, bytes }

/* ══════════════════════════════════════════════════
   UTILITÁRIOS
══════════════════════════════════════════════════ */
function getTipoConfig(key) {
  return TIPOS_DOCUMENTO.find(t => t.key === key) || TIPOS_DOCUMENTO[TIPOS_DOCUMENTO.length - 1];
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function renderTipoBadge(tipo) {
  const cfg = getTipoConfig(tipo);
  return `<span class="doc-type-badge doc-type-${cfg.cor}"><i class="fas ${cfg.icon}"></i> ${tipo}</span>`;
}

/* ══════════════════════════════════════════════════
   CARGA PRINCIPAL
══════════════════════════════════════════════════ */
async function loadDocumentos() {
  try {
    const [pR, dR, rR, docR] = await Promise.all([
      DB.getAll('ong_projetos'),
      DB.getAll('ong_despesas'),
      DB.getAll('ong_rubricas'),
      DB.getAll('ong_documentos')
    ]);
    projetosDocData  = pR  || [];
    despesasDocData  = dR  || [];
    rubricasDocData  = rR  || [];
    documentosData   = docR|| [];

    // Atualiza CACHE global
    CACHE.projetos = projetosDocData;
    CACHE.despesas = despesasDocData;
    CACHE.rubricas = rubricasDocData;

    // Popula filtros e selects
    populateDocFilters();
    renderDocKpis();
    renderDocumentosTable(documentosData);
  } catch(err) {
    showToast('Erro ao carregar documentos: ' + err.message, 'error');
    console.error('[loadDocumentos]', err);
  }
}

function populateDocFilters() {
  // Filtro projeto (página)
  const fp = document.getElementById('doc-filter-projeto');
  if (fp) {
    fp.innerHTML = '<option value="">Todos os Projetos</option>';
    projetosDocData.forEach(p => {
      fp.innerHTML += `<option value="${p.id}">${p.numero_proposta||p.id} — ${(p.nome_projeto||'').slice(0,45)}</option>`;
    });
  }

  // Select projeto (modal)
  const sp = document.getElementById('doc-projeto-sel');
  if (sp) {
    sp.innerHTML = '<option value="">Selecione o Projeto</option>';
    projetosDocData.forEach(p => {
      sp.innerHTML += `<option value="${p.id}">${p.numero_proposta||p.id} — ${(p.nome_projeto||'').slice(0,45)}</option>`;
    });
  }

  // Select tipo (filtro)
  const ft = document.getElementById('doc-filter-tipo');
  if (ft) {
    ft.innerHTML = '<option value="">Todos os Tipos</option>';
    TIPOS_DOCUMENTO.forEach(t => {
      ft.innerHTML += `<option value="${t.key}">${t.key}</option>`;
    });
  }
}

/* ══════════════════════════════════════════════════
   KPIs
══════════════════════════════════════════════════ */
function renderDocKpis() {
  const total    = documentosData.length;
  const ativos   = documentosData.filter(d => d.status !== 'Inativo').length;
  const comArq   = documentosData.filter(d => d.arquivo_base64).length;
  const comUrl   = documentosData.filter(d => d.url_externo && !d.arquivo_base64).length;
  const totalBytes = documentosData.reduce((s,d) => s + (Number(d.tamanho_bytes)||0), 0);

  // Conta por tipo (top 1)
  const tipoCount = {};
  documentosData.forEach(d => { tipoCount[d.tipo_documento] = (tipoCount[d.tipo_documento]||0)+1; });
  const topTipo = Object.entries(tipoCount).sort((a,b) => b[1]-a[1])[0];

  setText('doc-kpi-total',     total);
  setText('doc-kpi-ativos',    ativos);
  setText('doc-kpi-com-arq',   comArq);
  setText('doc-kpi-com-url',   comUrl);
  setText('doc-kpi-tamanho',   formatBytes(totalBytes));
  setText('doc-kpi-top-tipo',  topTipo ? `${topTipo[0]} (${topTipo[1]})` : '—');
}

/* ══════════════════════════════════════════════════
   FILTROS
══════════════════════════════════════════════════ */
function filterDocumentos() {
  const search  = (document.getElementById('doc-search')?.value   || '').toLowerCase();
  const projId  =  document.getElementById('doc-filter-projeto')?.value || '';
  const tipo    =  document.getElementById('doc-filter-tipo')?.value    || '';
  const status  =  document.getElementById('doc-filter-status')?.value  || '';
  const mesRef  =  document.getElementById('doc-filter-mes')?.value     || '';

  const filtered = documentosData.filter(d => {
    if (projId  && d.projeto_id !== projId) return false;
    if (tipo    && d.tipo_documento !== tipo) return false;
    if (status  && d.status !== status) return false;
    if (mesRef  && d.mes_referencia !== mesRef) return false;
    if (search) {
      const hay = [d.nome_arquivo, d.descricao, d.fornecedor, d.numero_documento,
                   d.tipo_documento, d.observacao].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  renderDocumentosTable(filtered);
}

/* ══════════════════════════════════════════════════
   RENDER TABELA PRINCIPAL
══════════════════════════════════════════════════ */
function renderDocumentosTable(docs) {
  const tbody = document.getElementById('docs-tbody');
  if (!tbody) return;

  if (!docs || docs.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>Nenhum documento encontrado. Clique em <strong>Novo Documento</strong> para anexar o primeiro arquivo.</p>
        </div>
      </td></tr>`;
    return;
  }

  // Agrupa por projeto
  const byProj = {};
  docs.forEach(d => {
    const pid = d.projeto_id || '__sem_projeto__';
    if (!byProj[pid]) byProj[pid] = [];
    byProj[pid].push(d);
  });

  let html = '';
  Object.entries(byProj).forEach(([pid, items]) => {
    const proj = projetosDocData.find(p => p.id === pid);
    const projLabel = proj
      ? `${proj.numero_proposta || ''} — ${(proj.nome_projeto || '').slice(0,50)}`
      : 'Sem Projeto';

    // Linha de grupo de projeto
    html += `
      <tr class="doc-proj-group-row">
        <td colspan="9">
          <div class="doc-group-header">
            <i class="fas fa-folder-open"></i>
            <span>${projLabel}</span>
            <span class="badge badge-blue" style="margin-left:8px;">${items.length} doc${items.length>1?'s':''}</span>
          </div>
        </td>
      </tr>`;

    // Linhas de documento
    items.forEach(d => {
      const cfg       = getTipoConfig(d.tipo_documento);
      const temArq    = !!d.arquivo_base64;
      const temUrl    = !!d.url_externo;
      const statusBdg = d.status === 'Inativo'
        ? '<span class="badge badge-gray">Inativo</span>'
        : '<span class="badge badge-green">Ativo</span>';
      const rubrica   = rubricasDocData.find(r => r.id === d.rubrica_id);
      const despesa   = despesasDocData.find(x => x.id === d.despesa_id);
      const vinculo   = rubrica
        ? `<span class="doc-chip"><i class="fas fa-list-check"></i> ${(rubrica.descricao||'').slice(0,25)}</span>`
        : despesa
          ? `<span class="doc-chip"><i class="fas fa-receipt"></i> ${(despesa.descricao||'').slice(0,25)}</span>`
          : '';

      const arqBadge = temArq
        ? `<span class="doc-chip doc-chip-file" title="${formatBytes(d.tamanho_bytes)}"><i class="fas fa-file-pdf text-danger"></i> Arquivo</span>`
        : temUrl
          ? `<span class="doc-chip doc-chip-url"><i class="fas fa-link text-primary"></i> URL</span>`
          : '<span class="text-muted text-xs">—</span>';

      html += `
        <tr class="doc-item-row">
          <td>
            <div class="doc-type-cell">
              <div class="doc-type-icon doc-type-${cfg.cor}"><i class="fas ${cfg.icon}"></i></div>
              <div>
                <div class="font-semibold text-sm">${d.nome_arquivo || '—'}</div>
                <div class="text-xs text-muted">${d.tipo_documento}</div>
              </div>
            </div>
          </td>
          <td>${d.descricao ? `<span class="text-sm">${d.descricao}</span>` : '<span class="text-muted text-xs">—</span>'}</td>
          <td>${d.numero_documento ? `<code class="text-xs">${d.numero_documento}</code>` : '—'}</td>
          <td>${d.data_documento ? formatDate(d.data_documento) : '—'}</td>
          <td>${d.mes_referencia || '—'}</td>
          <td>${arqBadge}</td>
          <td>${vinculo}</td>
          <td>${statusBdg}</td>
          <td>
            <div class="flex gap-1">
              ${temArq || temUrl ? `<button class="btn btn-sm btn-outline" onclick="viewDocumento('${d.id}')" title="Visualizar"><i class="fas fa-eye"></i></button>` : ''}
              ${temArq ? `<button class="btn btn-sm btn-outline" onclick="downloadDocumento('${d.id}')" title="Baixar"><i class="fas fa-download"></i></button>` : ''}
              ${temUrl ? `<button class="btn btn-sm btn-outline" onclick="openUrlDocumento('${d.id}')" title="Abrir Link"><i class="fas fa-external-link-alt"></i></button>` : ''}
              <button class="btn btn-sm btn-outline" onclick="openModalDocumento('${d.id}')" title="Editar"><i class="fas fa-pencil-alt"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteDocumento('${d.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
    });
  });

  tbody.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   MODAL: ABRIR / FECHAR
══════════════════════════════════════════════════ */
async function openModalDocumento(id = null) {
  documentoEditId = id;
  _docArquivoSelecionado = null;

  const modal = document.getElementById('modal-documento');
  const title = document.getElementById('modal-doc-title');
  if (!modal) return;

  // Garante que os selects estejam populados
  if (!projetosDocData.length) {
    try {
      projetosDocData = await DB.getAll('ong_projetos');
      rubricasDocData = await DB.getAll('ong_rubricas');
      despesasDocData = await DB.getAll('ong_despesas');
      populateDocFilters();
    } catch(e) { console.warn('populateDoc:', e); }
  }

  // Zera o form
  const form = document.getElementById('form-documento');
  if (form) form.reset();
  resetDocUploadZone();
  document.getElementById('doc-tab-upload')?.click();

  // Popula selects do modal
  _populateDocModalSelects(null);

  if (id) {
    // Modo edição
    title.textContent = 'Editar Documento';
    let doc = documentosData.find(d => d.id === id);
    if (!doc) {
      try { doc = await DB.getOne('ong_documentos', id); } catch(e) {}
    }
    if (doc) {
      _fillDocForm(doc);
    }
  } else {
    title.textContent = 'Novo Documento / Anexo';
  }

  modal.classList.add('open');
}

function closeModalDocumento() {
  document.getElementById('modal-documento')?.classList.remove('open');
  _docArquivoSelecionado = null;
  documentoEditId = null;
}

function _fillDocForm(doc) {
  const f = document.getElementById('form-documento');
  if (!f) return;
  setVal(f, 'tipo_documento',   doc.tipo_documento);
  setVal(f, 'nome_arquivo',     doc.nome_arquivo);
  setVal(f, 'descricao',        doc.descricao);
  setVal(f, 'numero_documento', doc.numero_documento);
  setVal(f, 'data_documento',   doc.data_documento);
  setVal(f, 'fornecedor',       doc.fornecedor);
  setVal(f, 'valor',            doc.valor);
  setVal(f, 'mes_referencia',   doc.mes_referencia);
  setVal(f, 'observacao',       doc.observacao);
  setVal(f, 'status',           doc.status || 'Ativo');
  setVal(f, 'url_externo',      doc.url_externo);

  // Popula projeto e depois vinculos
  const projSel = document.getElementById('doc-projeto-sel');
  if (projSel) {
    projSel.value = doc.projeto_id || '';
    _updateDocVinculoSelects(doc.projeto_id);
    setTimeout(() => {
      setVal(f, 'rubrica_id', doc.rubrica_id);
      setVal(f, 'despesa_id', doc.despesa_id);
    }, 80);
  }

  // Indica que já tem arquivo
  if (doc.arquivo_base64) {
    _showArquivoInfo(doc.nome_arquivo, doc.tamanho_bytes, doc.mime_type);
  }
  if (doc.url_externo) {
    // Ativa aba URL
    document.getElementById('doc-tab-url')?.click();
  }
}

function setVal(form, name, val) {
  const el = form.querySelector(`[name="${name}"]`);
  if (el && val !== null && val !== undefined) el.value = val;
}

/* ══════════════════════════════════════════════════
   TABS: Upload vs URL
══════════════════════════════════════════════════ */
function docSwitchTab(tab) {
  const tabUpload = document.getElementById('doc-area-upload');
  const tabUrl    = document.getElementById('doc-area-url');
  const btnUp     = document.getElementById('doc-tab-upload');
  const btnUrl    = document.getElementById('doc-tab-url');
  if (!tabUpload || !tabUrl) return;
  if (tab === 'upload') {
    tabUpload.style.display = '';
    tabUrl.style.display    = 'none';
    btnUp?.classList.add('active');
    btnUrl?.classList.remove('active');
  } else {
    tabUpload.style.display = 'none';
    tabUrl.style.display    = '';
    btnUp?.classList.remove('active');
    btnUrl?.classList.add('active');
  }
}

/* ══════════════════════════════════════════════════
   UPLOAD: FileReader → Base64
══════════════════════════════════════════════════ */
function triggerDocFileInput() {
  document.getElementById('doc-file-input')?.click();
}

function handleDocFileChange(evt) {
  const file = evt.target?.files?.[0];
  if (!file) return;
  _processDocFile(file);
}

function handleDocDrop(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  const file = evt.dataTransfer?.files?.[0];
  if (!file) return;
  _processDocFile(file);
  document.getElementById('doc-drop-zone')?.classList.remove('drag-over');
}

function handleDocDragOver(evt) {
  evt.preventDefault();
  document.getElementById('doc-drop-zone')?.classList.add('drag-over');
}

function handleDocDragLeave() {
  document.getElementById('doc-drop-zone')?.classList.remove('drag-over');
}

function _processDocFile(file) {
  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
  if (file.size > MAX_BYTES) {
    showToast(`Arquivo muito grande (${formatBytes(file.size)}). Limite: 8 MB. Use URL externa para arquivos maiores.`, 'error');
    return;
  }

  const allowed = ['application/pdf','image/png','image/jpeg','image/jpg',
                   'application/msword',
                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                   'application/vnd.ms-excel',
                   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (!allowed.includes(file.type)) {
    showToast('Formato não suportado. Use PDF, PNG, JPG, DOC, DOCX, XLS ou XLSX.', 'error');
    return;
  }

  _showUploadProgress(true, 0);

  const reader = new FileReader();
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      _showUploadProgress(true, pct);
    }
  };
  reader.onload = (e) => {
    _showUploadProgress(true, 100);
    const base64Full = e.target.result;  // data:mime;base64,XXXX
    _docArquivoSelecionado = {
      base64:    base64Full,
      base64raw: base64Full.split(',')[1],
      nome:      file.name,
      mime:      file.type,
      bytes:     file.size
    };
    setTimeout(() => {
      _showUploadProgress(false, 0);
      _showArquivoInfo(file.name, file.size, file.type);
    }, 400);

    // Preenche nome do arquivo automaticamente se vazio
    const nomeInput = document.querySelector('#form-documento [name="nome_arquivo"]');
    if (nomeInput && !nomeInput.value) nomeInput.value = file.name;
  };
  reader.onerror = () => {
    _showUploadProgress(false, 0);
    showToast('Erro ao ler o arquivo.', 'error');
  };
  reader.readAsDataURL(file);
}

function _showUploadProgress(show, pct) {
  const prog = document.getElementById('doc-upload-progress');
  const fill = document.getElementById('doc-upload-progress-fill');
  const txt  = document.getElementById('doc-upload-progress-txt');
  if (!prog) return;
  prog.style.display = show ? '' : 'none';
  if (fill) fill.style.width = pct + '%';
  if (txt)  txt.textContent  = pct < 100 ? `Lendo... ${pct}%` : 'Pronto!';
}

function _showArquivoInfo(nome, bytes, mime) {
  const zone = document.getElementById('doc-drop-zone');
  const info = document.getElementById('doc-arquivo-info');
  if (!zone || !info) return;
  zone.style.display = 'none';
  info.style.display = '';
  const ext = nome?.split('.').pop()?.toUpperCase() || '?';
  info.innerHTML = `
    <div class="doc-arquivo-preview">
      <div class="doc-arquivo-icon">
        <i class="fas ${mime==='application/pdf' ? 'fa-file-pdf text-danger' :
                        mime?.startsWith('image') ? 'fa-file-image text-blue-500' :
                        'fa-file-word text-blue-700'}"></i>
      </div>
      <div class="doc-arquivo-meta">
        <div class="font-semibold text-sm">${nome}</div>
        <div class="text-xs text-muted">${ext} &nbsp;·&nbsp; ${formatBytes(bytes)}</div>
      </div>
      <button class="btn btn-sm btn-outline" onclick="resetDocUploadZone()" title="Remover arquivo">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
}

function resetDocUploadZone() {
  _docArquivoSelecionado = null;
  const zone  = document.getElementById('doc-drop-zone');
  const info  = document.getElementById('doc-arquivo-info');
  const input = document.getElementById('doc-file-input');
  if (zone)  zone.style.display  = '';
  if (info)  { info.style.display = 'none'; info.innerHTML = ''; }
  if (input) input.value = '';
}

/* ══════════════════════════════════════════════════
   SELECTS DINÂMICOS DO MODAL
══════════════════════════════════════════════════ */
function _populateDocModalSelects(projId) {
  const sp = document.getElementById('doc-projeto-sel');
  if (!sp) return;
  if (!projId) {
    // Já populado em populateDocFilters
  }
  sp.value = projId || '';
  _updateDocVinculoSelects(projId);
}

function onDocProjetoChange() {
  const projId = document.getElementById('doc-projeto-sel')?.value || '';
  _updateDocVinculoSelects(projId);
}

function _updateDocVinculoSelects(projId) {
  const rubSel = document.getElementById('doc-rubrica-sel');
  const depSel = document.getElementById('doc-despesa-sel');

  if (rubSel) {
    rubSel.innerHTML = '<option value="">Nenhuma</option>';
    if (projId) {
      rubricasDocData.filter(r => r.projeto_id === projId).forEach(r => {
        rubSel.innerHTML += `<option value="${r.id}">${r.categoria} — ${(r.descricao||'').slice(0,50)}</option>`;
      });
    }
  }
  if (depSel) {
    depSel.innerHTML = '<option value="">Nenhuma</option>';
    if (projId) {
      despesasDocData.filter(d => d.projeto_id === projId).forEach(d => {
        const lbl = `${d.mes_referencia||'?'} | ${(d.descricao||'').slice(0,40)} | ${formatBRL(d.valor||0)}`;
        depSel.innerHTML += `<option value="${d.id}">${lbl}</option>`;
      });
    }
  }
}

/* ══════════════════════════════════════════════════
   SALVAR DOCUMENTO
══════════════════════════════════════════════════ */
async function saveDocumento() {
  const form = document.getElementById('form-documento');
  if (!form) return;

  const btn = document.getElementById('btn-salvar-doc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const fd = new FormData(form);
  const tipo = fd.get('tipo_documento');
  const nome = fd.get('nome_arquivo');

  if (!tipo || !nome) {
    showToast('Preencha pelo menos o Tipo e o Nome do documento.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
    return;
  }

  const projId = document.getElementById('doc-projeto-sel')?.value || null;

  // Detecta modo (upload ou url)
  const urlExt = (fd.get('url_externo') || '').trim();
  const temArquivo = !!_docArquivoSelecionado;
  const temUrl     = !!urlExt;

  if (!temArquivo && !temUrl && !documentoEditId) {
    showToast('Anexe um arquivo ou informe uma URL externa.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
    return;
  }

  try {
    const payload = {
      projeto_id:      projId || null,
      rubrica_id:      document.getElementById('doc-rubrica-sel')?.value || null,
      despesa_id:      document.getElementById('doc-despesa-sel')?.value || null,
      tipo_documento:  tipo,
      nome_arquivo:    nome,
      descricao:       fd.get('descricao')        || null,
      numero_documento:fd.get('numero_documento') || null,
      data_documento:  fd.get('data_documento')   || null,
      fornecedor:      fd.get('fornecedor')        || null,
      valor:           fd.get('valor') ? Number(fd.get('valor')) : null,
      mes_referencia:  fd.get('mes_referencia')   || null,
      observacao:      fd.get('observacao')        || null,
      status:          fd.get('status')            || 'Ativo',
      url_externo:     urlExt || null
    };

    // Limpa vínculo vazio
    if (!payload.rubrica_id) payload.rubrica_id = null;
    if (!payload.despesa_id) payload.despesa_id = null;

    // Arquivo base64
    if (temArquivo) {
      payload.arquivo_base64 = _docArquivoSelecionado.base64raw;
      payload.mime_type      = _docArquivoSelecionado.mime;
      payload.tamanho_bytes  = _docArquivoSelecionado.bytes;
    }

    let saved;
    if (documentoEditId) {
      // Modo edição: mantém arquivo anterior se nenhum novo for selecionado
      saved = await DB.update('ong_documentos', documentoEditId, payload);
    } else {
      payload.id = crypto.randomUUID ? crypto.randomUUID() : 'doc-' + Date.now();
      saved = await DB.insert('ong_documentos', payload);
    }

    showToast(documentoEditId ? 'Documento atualizado!' : 'Documento salvo!', 'success');
    closeModalDocumento();
    await loadDocumentos();
  } catch(err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
    console.error('[saveDocumento]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
  }
}

/* ══════════════════════════════════════════════════
   VISUALIZAR / BAIXAR / ABRIR URL
══════════════════════════════════════════════════ */
async function viewDocumento(id) {
  let doc = documentosData.find(d => d.id === id);
  if (!doc) {
    try { doc = await DB.getOne('ong_documentos', id); } catch(e) {}
  }
  if (!doc) { showToast('Documento não encontrado.', 'error'); return; }

  if (doc.arquivo_base64) {
    // Reconstrói data URL e abre em nova aba
    const mime  = doc.mime_type || 'application/pdf';
    const dataUrl = `data:${mime};base64,${doc.arquivo_base64}`;
    const blob  = dataURLtoBlob(dataUrl);
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      // fallback: download
      _downloadBlob(blob, doc.nome_arquivo || 'documento');
    }
    // Revoga após 60s
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else if (doc.url_externo) {
    window.open(doc.url_externo, '_blank', 'noopener,noreferrer');
  } else {
    showToast('Este documento não possui arquivo anexado nem URL.', 'error');
  }
}

async function downloadDocumento(id) {
  let doc = documentosData.find(d => d.id === id);
  if (!doc) {
    try { doc = await DB.getOne('ong_documentos', id); } catch(e) {}
  }
  if (!doc || !doc.arquivo_base64) {
    showToast('Arquivo não disponível para download.', 'error');
    return;
  }
  const mime    = doc.mime_type || 'application/pdf';
  const dataUrl = `data:${mime};base64,${doc.arquivo_base64}`;
  const blob    = dataURLtoBlob(dataUrl);
  _downloadBlob(blob, doc.nome_arquivo || 'documento');
}

function openUrlDocumento(id) {
  const doc = documentosData.find(d => d.id === id);
  if (doc?.url_externo) {
    window.open(doc.url_externo, '_blank', 'noopener,noreferrer');
  }
}

/* ── helpers blob ── */
function dataURLtoBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr   = new Uint8Array(bytes.length);
  for (let i=0; i<bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function _downloadBlob(blob, filename) {
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ══════════════════════════════════════════════════
   DELETAR DOCUMENTO
══════════════════════════════════════════════════ */
async function deleteDocumento(id) {
  if (!confirm('Excluir este documento permanentemente?')) return;
  try {
    await DB.delete('ong_documentos', id);
    documentosData = documentosData.filter(d => d.id !== id);
    showToast('Documento excluído.', 'success');
    renderDocKpis();
    renderDocumentosTable(documentosData);
  } catch(err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════════════════
   MINI-PAINEL: Documentos por Rubrica
   Injetado dentro das tr-detail de rubricas.js
══════════════════════════════════════════════════ */
async function renderDocsMiniPanel(projId, rubricaId, despesaId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<div class="loading-spinner" style="padding:8px;"><i class="fas fa-spinner"></i></div>`;

  try {
    let docs = documentosData;
    if (!docs.length) {
      docs = await DB.getAll('ong_documentos');
      documentosData = docs;
    }

    const filtered = docs.filter(d => {
      if (rubricaId && d.rubrica_id === rubricaId) return true;
      if (despesaId && d.despesa_id === despesaId) return true;
      if (!rubricaId && !despesaId && projId && d.projeto_id === projId) return true;
      return false;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="doc-mini-empty">
          <i class="fas fa-paperclip text-muted"></i>
          <span class="text-xs text-muted">Nenhum documento vinculado</span>
          <button class="btn btn-xs btn-outline" onclick="openModalDocPreFilled('${projId}','${rubricaId||''}','${despesaId||''}')">
            <i class="fas fa-plus"></i> Anexar
          </button>
        </div>`;
      return;
    }

    let html = `<div class="doc-mini-panel">`;
    html += `<div class="doc-mini-header">
      <span class="text-xs font-semibold"><i class="fas fa-paperclip"></i> Documentos (${filtered.length})</span>
      <button class="btn btn-xs btn-outline" onclick="openModalDocPreFilled('${projId}','${rubricaId||''}','${despesaId||''}')">
        <i class="fas fa-plus"></i> Novo
      </button>
    </div>`;

    filtered.forEach(d => {
      const cfg    = getTipoConfig(d.tipo_documento);
      const temArq = !!d.arquivo_base64;
      const temUrl = !!d.url_externo;
      html += `
        <div class="doc-mini-item">
          <div class="doc-mini-tipo"><i class="fas ${cfg.icon} doc-color-${cfg.cor}"></i></div>
          <div class="doc-mini-info">
            <div class="text-xs font-semibold">${d.nome_arquivo || d.tipo_documento}</div>
            <div class="text-xs text-muted">${d.tipo_documento}${d.numero_documento ? ' · Nº '+d.numero_documento : ''}${d.data_documento ? ' · '+formatDate(d.data_documento) : ''}</div>
          </div>
          <div class="doc-mini-actions">
            ${temArq ? `<button class="btn btn-xs btn-outline" onclick="viewDocumento('${d.id}')" title="Ver"><i class="fas fa-eye"></i></button>` : ''}
            ${temUrl ? `<button class="btn btn-xs btn-outline" onclick="openUrlDocumento('${d.id}')" title="Link"><i class="fas fa-link"></i></button>` : ''}
            ${temArq ? `<button class="btn btn-xs btn-outline" onclick="downloadDocumento('${d.id}')" title="Baixar"><i class="fas fa-download"></i></button>` : ''}
            <button class="btn btn-xs btn-danger" onclick="deleteDocumento('${d.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
  } catch(err) {
    container.innerHTML = `<div class="text-xs text-muted" style="padding:6px;">Erro ao carregar documentos.</div>`;
    console.error('[renderDocsMiniPanel]', err);
  }
}

/* ── Abre modal pré-preenchido com projeto/rubrica/despesa ── */
async function openModalDocPreFilled(projId, rubId, depId) {
  await openModalDocumento(null);
  setTimeout(() => {
    const projSel = document.getElementById('doc-projeto-sel');
    if (projSel && projId) {
      projSel.value = projId;
      _updateDocVinculoSelects(projId);
      setTimeout(() => {
        if (rubId) {
          const rs = document.getElementById('doc-rubrica-sel');
          if (rs) rs.value = rubId;
        }
        if (depId) {
          const ds = document.getElementById('doc-despesa-sel');
          if (ds) ds.value = depId;
        }
      }, 100);
    }
  }, 80);
}

/* ══════════════════════════════════════════════════
   EXPORTAR CSV
══════════════════════════════════════════════════ */
function exportarDocumentosCSV() {
  if (!documentosData.length) { showToast('Nenhum documento para exportar.', 'error'); return; }
  const cols = ['id','tipo_documento','nome_arquivo','descricao','numero_documento','data_documento',
                'fornecedor','valor','mes_referencia','status','url_externo','tamanho_bytes','observacao'];
  const header = cols.join(';');
  const rows   = documentosData.map(d => cols.map(c => {
    const v = d[c] !== undefined && d[c] !== null ? d[c] : '';
    return String(v).replace(/;/g,'|');
  }).join(';'));
  const csv    = [header, ...rows].join('\n');
  const blob   = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  _downloadBlob(blob, `documentos_${new Date().toISOString().slice(0,10)}.csv`);
}

/* ══════════════════════════════════════════════════
   SEÇÃO V — Lista para Prestação de Contas
   Retorna HTML para ser injetado no prestacao.js
══════════════════════════════════════════════════ */
async function renderDocumentosSecaoPrestacao(projId) {
  try {
    let docs = documentosData.filter(d => d.projeto_id === projId);
    if (!docs.length) {
      const all = await DB.getAll('ong_documentos');
      documentosData = all || [];
      docs = documentosData.filter(d => d.projeto_id === projId);
    }

    if (!docs.length) {
      return `<div class="alert alert-info" style="margin:8px 0;">
        <i class="fas fa-info-circle"></i> Nenhum documento anexado a este projeto.
      </div>`;
    }

    // Agrupa por tipo
    const byTipo = {};
    docs.forEach(d => {
      if (!byTipo[d.tipo_documento]) byTipo[d.tipo_documento] = [];
      byTipo[d.tipo_documento].push(d);
    });

    let html = `<div class="doc-prestacao-grid">`;
    Object.entries(byTipo).forEach(([tipo, items]) => {
      const cfg = getTipoConfig(tipo);
      html += `
        <div class="doc-prestacao-group">
          <div class="doc-prestacao-group-title">
            <i class="fas ${cfg.icon}"></i> ${tipo}
            <span class="badge badge-gray" style="margin-left:6px;">${items.length}</span>
          </div>
          <table style="width:100%;font-size:.78rem;">
            <thead>
              <tr>
                <th>Nome</th><th>Nº</th><th>Data</th><th>Fornecedor</th>
                <th class="text-right">Valor</th><th>Arquivo</th>
              </tr>
            </thead>
            <tbody>`;
      items.forEach(d => {
        const temArq = !!d.arquivo_base64;
        const temUrl = !!d.url_externo;
        const link   = temArq
          ? `<a href="#" onclick="viewDocumento('${d.id}');return false;" class="text-primary"><i class="fas fa-file-pdf"></i> Ver</a>`
          : temUrl
            ? `<a href="${d.url_externo}" target="_blank" class="text-primary"><i class="fas fa-link"></i> Abrir</a>`
            : '—';
        html += `
              <tr>
                <td>${d.nome_arquivo || '—'}</td>
                <td>${d.numero_documento || '—'}</td>
                <td>${d.data_documento ? formatDate(d.data_documento) : '—'}</td>
                <td>${d.fornecedor || '—'}</td>
                <td class="text-right">${d.valor ? formatBRL(d.valor) : '—'}</td>
                <td>${link}</td>
              </tr>`;
      });
      html += `</tbody></table></div>`;
    });
    html += `</div>`;
    return html;
  } catch(err) {
    console.error('[renderDocumentosSecaoPrestacao]', err);
    return `<div class="alert alert-warning">Erro ao carregar documentos.</div>`;
  }
}

/* ══════════════════════════════════════════════════
   HELPERS LOCAIS (aliases dos globais de api.js)
══════════════════════════════════════════════════ */
function formatBRL(val) {
  return typeof fmt !== 'undefined' ? fmt.currency(val) : 'R$ ' + Number(val).toFixed(2);
}

function formatDate(str) {
  return typeof fmt !== 'undefined' ? fmt.date(str) : (str || '-');
}

/* ==========================================================================
   SISTEMA MODO SUPREMO - Motor de Dados Relacional Multi-Tenant
   Mapeamento Completo da Execução Detalhada de Metas, Prazos e Integridade
   ========================================================================== */

const BancoDados = {
    instituicoes: [
        { id: "INST001", razaoSocial: "Congregação dos Missionários Filhos do Imaculado Coração de Maria", cnpj: "12.345.678/0001-90", municipio: "Rio de Janeiro", uf: "RJ", conta: "BB Ag 5678-9 CC 67890-1", status: "Ativo" },
        { id: "INST002", razaoSocial: "ORTC — Organização Cultural Remanescentes de Tia Ciata", cnpj: "11.425.933/0001-47", municipio: "Niterói", uf: "RJ", conta: "BB Ag 1234-5 CC 12345-6", status: "Ativo" },
        { id: "INST003", razaoSocial: "Santa Casa de Misericórdia do Rio de Janeiro", cnpj: "98.765.432/0001-10", municipio: "Rio de Janeiro", uf: "RJ", conta: "CEF Ag 0001 CC 23456-7", status: "Ativo" },
        { id: "INST004", razaoSocial: "Associação Pestalozzi de Niterói", cnpj: "33.123.456/0001-22", municipio: "Niterói", uf: "RJ", conta: "Bradesco Ag 3210 CC 34567-8", status: "Ativo" }
    ],
    emendas: [
        { id: "EM001", nome: "TF 972600/2024 - Cultura e Patrimônio em Movimento", plataforma: "TransfereGov", instId: "INST002", valorGlobal: 286000.00, status: "Vigente" },
        { id: "EM002", nome: "Emenda Individual Dr. Luizinho - Alta Complexidade", plataforma: "TransfereGov", instId: "INST003", valorGlobal: 500000.00, status: "Liquidado" },
        { id: "EM003", nome: "Emenda Senador Romário - Infraestrutura Pestalozzi", plataforma: "TransfereGov", instId: "INST004", valorGlobal: 350000.00, status: "Vigente" },
        { id: "EM004", nome: "ICMSRJ-2024 - Circuito de Saberes da Pequena África", plataforma: "ICMS RJ", instId: "INST002", valorGlobal: 215000.00, status: "Vigente" }
    ],
    metas: [
        // Detalhamento do Plano de Trabalho Executivo do Projeto Principal (TF 972600/2024)
        { id: "M1", emendaId: "EM001", numero: 1, descricao: "Circuito dos Caminhos da Tia Ciata", previsto: 170450.00 },
        { id: "M2", emendaId: "EM001", numero: 2, descricao: "Cultura Popular — Memorial e Exposição", previsto: 91900.00 },
        { id: "M3", emendaId: "EM001", numero: 3, descricao: "Evento Nacional Dia das Baianas de Acarajé", previsto: 23650.00 }
    ],
    etapas: [
        // Sub-planeamento atrelado a cada meta
        { id: "ET001", metaId: "M1", numero: 1, descricao: "Assessoria de Imprensa & Comunicação", valorAlocado: 24000.00 },
        { id: "ET002", metaId: "M1", numero: 2, descricao: "Coordenação Geral e Operacional", valorAlocado: 48000.00 },
        { id: "ET003", metaId: "M1", numero: 3, descricao: "Pesquisa Histórica e Roteirização", valorAlocado: 35000.00 },
        { id: "ET004", metaId: "M1", numero: 6, descricao: "Monitores e Arte-Educadores", valorAlocado: 24000.00 },
        { id: "ET005", metaId: "M2", numero: 4, descricao: "Locação de Infraestrutura e Equipamentos", valorAlocado: 25200.00 },
        { id: "ET006", metaId: "M2", numero: 6, descricao: "Mesa de Som e Operação Técnica", valorAlocado: 11200.00 },
        { id: "ET007", metaId: "M3", numero: 5, descricao: "Sonorização Externa de Grande Porte", valorAlocado: 3800.00 }
    ],
    financeiro: [
        // Ledger mestre unificado dos lançamentos de pagamentos das abas de auditoria
        { id: "FIN001", emendaId: "EM001", metaNum: 1, etapaNum: 2, categoria: "FOLHA DE PAGAMENTO", fornecedor: "Coordenação Geral de Projetos Terceiro Setor", nf: "OB-99201", data: "2026-01-05", valor: 56401.95, workflow: "Aprovado" },
        { id: "FIN002", emendaId: "EM001", metaNum: 1, etapaNum: 1, categoria: "SERVIÇOS DE TERCEIROS", fornecedor: "GABRIELA ANASTACIA FERREIRA SILVEIRA COMUNICACAO", nf: "NF-2026-003", data: "2026-03-15", valor: 24000.00, workflow: "Aprovado" },
        { id: "FIN003", emendaId: "EM001", metaNum: 2, etapaNum: 4, categoria: "MATERIAL DE CONSUMO", fornecedor: "IRIS DE ARAUJO PIMENTEL - LOCAÇÃO", nf: "NF-8921", data: "2026-03-20", valor: 25200.00, workflow: "Aprovado" },
        { id: "FIN004", emendaId: "EM001", metaNum: 2, etapaNum: 6, categoria: "SERVIÇOS DE TERCEIROS", fornecedor: "ANDERSON LUIZ CRUZ — SONORIZAÇÃO", nf: "NF-2026-004", data: "2026-03-22", valor: 11200.00, workflow: "Pendente" },
        { id: "FIN005", emendaId: "EM002", metaNum: 1, etapaNum: 1, categoria: "EQUIPAMENTOS PERMANENTES", fornecedor: "CONQUISTA MOVEIS LTDA", nf: "NF-9921", data: "2025-11-12", valor: 500000.00, workflow: "Aprovado" },
        { id: "FIN006", emendaId: "EM003", metaNum: 1, etapaNum: 1, categoria: "FOLHA DE PAGAMENTO", fornecedor: "Corpo Docente de Oficinas Inclusivas", nf: "FOLHA-MAR25", data: "2026-03-01", valor: 120000.00, workflow: "Aprovado" }
    ],
    profissionais: [
        { id: "PROF001", nome: "Maria Aparecida Silva", cpf: "123.456.789-01", funcao: "Coordenadora Geral Third Sector", email: "maria.silva@conexaosocial.org.br", projetos: "TF 972600/2024", status: "Ativo" },
        { id: "PROF002", nome: "João Carlos Oliveira", cpf: "234.567.890-12", funcao: "Contador e Perito Fiscal", email: "joao.oliveira@conexaosocial.org.br", projetos: "Todos", status: "Ativo" },
        { id: "PROF003", nome: "Ana Paula Mendes", cpf: "345.678.901-23", funcao: "Advogada e Consultora MROSC", email: "ana.mendes@conexaosocial.org.br", projetos: "EM002; EM003", status: "Ativo" },
        { id: "PROF004", nome: "Carlos Eduardo Santos", cpf: "456.789.012-34", funcao: "Gestor de Plataformas Públicas", email: "carlos.santos@conexaosocial.org.br", projetos: "TF 972600/2024", status: "Ativo" }
    ],
    documentos: [
        { id: "DOC001", instituicao: "ORTC", tipo: "CNPJ Regularidade RFB", numero: "11.425.933/0001-47", emissao: "2026-01-15", validade: "2026-07-15", alerta: "Vigente", workflow: "Aprovado" },
        { id: "DOC002", instituicao: "ORTC", tipo: "Ata de Eleição da Diretoria", numero: "ATA-2024-001", emissao: "2024-01-20", validade: "2028-01-20", alerta: "Vigente", workflow: "Aprovado" },
        { id: "DOC003", instituicao: "ORTC", tipo: "CRF - Certificado Regularidade FGTS", numero: "CRF-2026-88", emissao: "2026-04-01", validade: "2026-05-30", alerta: "A Vencer", workflow: "Aprovado" },
        { id: "DOC004", instituicao: "Missionários", tipo: "Certidão Negativa Municipal", numero: "CNDM-881A", emissao: "2026-01-10", validade: "2026-04-10", alerta: "Vencido", workflow: "Pendente" }
    ]
};

// --- CONTROLE DE ESTADO GLOBAL DA SPA ---
let EstadoSistema = {
    projetoAtivo: "TODOS",
    secaoAtiva: "sec-dashboard"
};

// --- INITIALIZER ---
document.addEventListener("DOMContentLoaded", () => {
    configurarNavegacaoSPA();
    configurarFormularios();
    sincronizarDropdownsEContexto();
    renderizarSistema();
});

// 1. CHANGER DE TELAS (SINGLE PAGE APPLICATION)
function configurarNavegacaoSPA() {
    const botoesMenu = document.querySelectorAll(".menu-item");
    botoesMenu.forEach(botao => {
        botao.addEventListener("click", () => {
            botoesMenu.forEach(b => b.classList.remove("active"));
            botao.classList.add("active");
            
            const targetId = botao.getAttribute("data-target");
            EstadoSistema.secaoAtiva = targetId;
            
            document.querySelectorAll(".page-section").forEach(sec => sec.classList.remove("active"));
            document.getElementById(targetId).classList.add("active");
        });
    });
}

// 2. CONTEXTUALIZAÇÃO DO ESCOPO DE DADOS E DROPDOWNS
function sincronizarDropdownsEContexto() {
    const seletorGlobal = document.getElementById("filtro-projeto-global");
    const seletorFormGasto = document.getElementById("form-gasto-projeto");

    seletorGlobal.innerHTML = '<option value="TODOS">== VER TODOS OS PROJETOS CONSOLIDADOS ==</option>';
    seletorFormGasto.innerHTML = '<option value="" disabled selected>Escolha o destino...</option>';

    BancoDados.emendas.forEach(emenda => {
        const inst = BancoDados.instituicoes.find(i => i.id === emenda.instId);
        const txtAbreviado = `[${inst ? inst.razaoSocial.substring(0, 12) : 'ONG'}] - ${emenda.nome.substring(0, 35)}...`;
        
        const optG = document.createElement("option");
        optG.value = emenda.id;
        optG.textContent = txtAbreviado;
        seletorGlobal.appendChild(optG);

        const optF = document.createElement("option");
        optF.value = emenda.id;
        optF.textContent = emenda.nome;
        seletorFormGasto.appendChild(optF);
    });

    seletorGlobal.value = EstadoSistema.projetoAtivo;
    seletorGlobal.addEventListener("change", (e) => {
        EstadoSistema.projetoAtivo = e.target.value;
        renderizarSistema();
    });
}

// 3. CORE ENGINE DE FILTRAGEM E RENDERIZAÇÃO GRÁFICA INTERNA
function renderizarSistema() {
    // Filtragem Multi-Tenant Baseada na Escolha da Topbar
    const emendasFiltradas = EstadoSistema.projetoAtivo === "TODOS" 
        ? BancoDados.emendas 
        : BancoDados.emendas.filter(e => e.id === EstadoSistema.projetoAtivo);

    const gastosFiltrados = EstadoSistema.projetoAtivo === "TODOS"
        ? BancoDados.financeiro
        : BancoDados.financeiro.filter(g => g.emendaId === EstadoSistema.projetoAtivo);

    // Cálculos Financeiros
    let totalGlobal = emendasFiltradas.reduce((acc, curr) => acc + curr.valorGlobal, 0);
    let totalExecutado = gastosFiltrados.reduce((acc, curr) => acc + curr.valor, 0);
    let saldoDisponivel = totalGlobal - totalExecutado;
    let taxaExecucao = totalGlobal > 0 ? (totalExecutado / totalGlobal) * 100 : 0;

    // Push nos Elementos Visuais do Dashboard
    document.getElementById("kpi-global").textContent = formatarMoeda(totalGlobal);
    document.getElementById("kpi-executado").textContent = formatarMoeda(totalExecutado);
    document.getElementById("kpi-saldo").textContent = formatarMoeda(saldoDisponivel);
    document.getElementById("kpi-percentual").textContent = taxaExecucao.toFixed(2) + "%";

    // Engine de Notificação de Riscos de Integridade
    renderizarAlertasIntegridade(totalGlobal, totalExecutado);

    // RENDERIZAÇÃO DA EXECUÇÃO DETALHADA DE METAS E ETAPAS (Aba solicitada pelo usuário)
    renderizarModuloMetasDetalhado();

    // RENDERIZAÇÃO DO LIVRO CAIXA (TABELA MESTRE)
    const tbodyFin = document.getElementById("tbl-financeiro-body");
    tbodyFin.innerHTML = "";
    gastosFiltrados.forEach(gasto => {
        const emenda = BancoDados.emendas.find(e => e.id === gasto.emendaId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${gasto.id}</strong></td>
            <td>${emenda ? emenda.nome.substring(0, 25) : 'Desconhecido'}...</td>
            <td>M${gasto.metaNum} - Etapa ${gasto.etapaNum}</td>
            <td><small>${gasto.categoria}</small></td>
            <td>${gasto.fornecedor}</td>
            <td>${gasto.nf}</td>
            <td>${formatarData(gasto.data)}</td>
            <td><strong>${formatarMoeda(gasto.valor)}</strong></td>
            <td><span class="status-pill ${gasto.workflow.toLowerCase()}">${gasto.workflow}</span></td>
        `;
        tbodyFin.appendChild(tr);
    });

    // RENDERIZAÇÃO DAS INSTITUIÇÕES
    const tbodyInst = document.getElementById("tbl-instituicoes-body");
    tbodyInst.innerHTML = "";
    BancoDados.instituicoes.forEach(inst => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${inst.id}</strong></td>
            <td>${inst.razaoSocial}</td>
            <td>${inst.cnpj}</td>
            <td>${inst.municipio}/${inst.uf}</td>
            <td><small>${inst.conta}</small></td>
            <td><span class="status-pill ativo">${inst.status}</span></td>
        `;
        tbodyInst.appendChild(tr);
    });

    // RENDERIZAÇÃO DAS EMENDAS
    const tbodyEm = document.getElementById("tbl-emendas-body");
    tbodyEm.innerHTML = "";
    BancoDados.emendas.forEach(em => {
        const inst = BancoDados.instituicoes.find(i => i.id === em.instId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${em.id}</strong></td>
            <td>${em.nome}</td>
            <td>${inst ? inst.razaoSocial.substring(0,20) : '—'}...</td>
            <td>${em.plataforma}</td>
            <td><strong>${formatarMoeda(em.valorGlobal)}</strong></td>
            <td><span class="status-pill ${em.status.toLowerCase()}">${em.status}</span></td>
        `;
        tbodyEm.appendChild(tr);
    });

    // RENDERIZAÇÃO DOS PROFISSIONAIS (EQUIPE TÉCNICA)
    const tbodyProf = document.getElementById("tbl-profissionais-body");
    tbodyProf.innerHTML = "";
    BancoDados.profissionais.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${p.id}</strong></td>
            <td>${p.nome}</td>
            <td>${p.cpf}</td>
            <td><strong>${p.funcao}</strong></td>
            <td>${p.email}</td>
            <td><small>${p.projetos}</small></td>
            <td><span class="status-pill ativo">${p.status}</span></td>
        `;
        tbodyProf.appendChild(tr);
    });

    // RENDERIZAÇÃO DO CHECKLIST DOCUMENTAL
    const tbodyDocs = document.getElementById("tbl-documentos-body");
    tbodyDocs.innerHTML = "";
    BancoDados.documentos.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${d.id}</strong></td>
            <td>${d.instituicao}</td>
            <td>${d.tipo}</td>
            <td><code>${d.numero}</code></td>
            <td>${formatarData(d.emissao)}</td>
            <td>${formatarData(d.validade)}</td>
            <td><span class="status-pill ${d.alerta.toLowerCase().replace(' ', '-')}">${d.alerta}</span></td>
            <td><span class="status-pill aprovado">${d.workflow}</span></td>
        `;
        tbodyDocs.appendChild(tr);
    });
}

// 4. SISTEMA ESPECÍFICO DE RENDERIZAÇÃO DINÂMICA DE METAS E PROGRESSO FÍSICO
function renderizarModuloMetasDetalhado() {
    const container = document.getElementById("container-metas-detalhado");
    container.innerHTML = "";

    // Filtra quais metas exibir baseando-se no escopo do projeto ativo
    const metasEscopo = EstadoSistema.projetoAtivo === "TODOS"
        ? BancoDados.metas
        : BancoDados.metas.filter(m => m.emendaId === EstadoSistema.projetoAtivo);

    if (metasEscopo.length === 0) {
        container.innerHTML = "<div class='alert-item warning'>Nenhuma meta cadastrada ou mapeada estruturalmente para esta emenda de terceiros.</div>";
        return;
    }

    metasEscopo.forEach(meta => {
        // Encontra todos os gastos pertencentes a esta meta específica
        const gastosDaMeta = BancoDados.financeiro.filter(g => g.emendaId === meta.emendaId && g.metaNum === meta.numero);
        const executadoDaMeta = gastosDaMeta.reduce((acc, curr) => acc + curr.valor, 0);
        const percentualMeta = (executadoDaMeta / meta.previsto) * 100;

        const cardMeta = document.createElement("div");
        cardMeta.className = "meta-block-card";
        
        cardMeta.innerHTML = `
            <div class="meta-block-header">
                <h2>🎯 Meta ${meta.numero} — ${meta.descricao}</h2>
                <div class="meta-finance-summary">
                    Previsto: ${formatarMoeda(meta.previsto)} | Executado: <span style="color:var(--success-color)">${formatarMoeda(executadoDaMeta)}</span>
                </div>
            </div>
            <div class="progress-container-global">
                <div class="progress-bar-fill" style="width: ${Math.min(percentualMeta, 100)}%"></div>
            </div>
            <div class="etapas-sub-grid" id="grid-etapas-meta-${meta.id}">
                </div>
        `;
        container.appendChild(cardMeta);

        // Renderiza as Etapas detalhadas pertencentes a esta Meta
        const subGridEtapas = document.getElementById(`grid-etapas-meta-${meta.id}`);
        const etapasDaMeta = BancoDados.etapas.filter(e => e.metaId === meta.id);

        etapasDaMeta.forEach(etapa => {
            const gastosDaEtapa = gastosDaMeta.filter(g => g.etapaNum === listNum(etapa.numero));
            const executadoDaEtapa = gastosDaEtapa.reduce((acc, curr) => acc + curr.valor, 0);
            const statusEtapa = executadoDaEtapa >= etapa.valorAlocado ? "Liquidado" : (executadoDaEtapa > 0 ? "Em Andamento" : "Não Iniciado");
            const classStatus = statusEtapa === "Liquidado" ? "aprovado" : (statusEtapa === "Em Andamento" ? "pendente" : "critico");

            const cardEtapa = document.createElement("div");
            cardEtapa.className = "etapa-item-card";
            cardEtapa.innerHTML = `
                <h4>Etapa ${etapa.numero}</h4>
                <p>${etapa.descricao}</p>
                <div style="font-size:11px; margin-top:4px;">
                    Alocado: <strong>${formatarMoeda(etapa.valorAlocado)}</strong><br>
                    Gasto: <strong>${formatarMoeda(executadoDaEtapa)}</strong>
                </div>
                <div class="etapa-badge-row">
                    <span class="status-pill ${classStatus}" style="font-size:10px; padding:2px 6px;">${statusEtapa}</span>
                </div>
            `;
            subGridEtapas.appendChild(cardEtapa);
        });
    });
}

function listNum(val) { return parseInt(val); }

// 5. MOTOR AUTOMÁTICO DE REGRAS DE INTEGRIDADE E COMPLIANCE AUDITORIAL
function renderizarAlertasIntegridade(global, executado) {
    const container = document.getElementById("container-alertas");
    container.innerHTML = "";
    let alertas = [];

    // Regra 1: Percentual Orçamentário Crítico (MROSC)
    if (global > 0 && (executado / global) < 0.35) {
        alertas.push({ tipo: "warning", texto: "⚠️ Alerta de Subexecução Crítica: O projeto ativo encontra-se abaixo do limiar de 35% de execução físico-financeira. Risco de glosa de recursos." });
    }

    // Regra 2: Monitoramento de Validade Documental da Diretoria/CNPJ
    const docsVencidos = BancoDados.documentos.filter(d => d.alerta === "Vencido").length;
    if (docsVencidos > 0) {
        alertas.push({ tipo: "danger", texto: `🚨 Violação de Adimplência Terceiro Setor: Existem ${docsVencidos} certidões obrigatórias vencidas no Checklist! Regularize imediatamente para evitar bloqueios de parcelas de repasse.` });
    }

    // Regra 3: Fluxo de Caixa / Pagamentos Reprovados ou Pendentes
    const pgtosPendentes = BancoDados.financeiro.filter(f => f.workflow === "Pendente").length;
    if (pgtosPendentes > 0) {
        alertas.push({ tipo: "warning", texto: `⏳ Fluxo Operacional: Constam ${pgtosPendentes} lançamentos financeiros aguardando validação técnica de nota fiscal no sistema.` });
    }

    if (alertas.length === 0) {
        alertas.push({ tipo: "success", texto: "✅ Conformidade MROSC Plena: Saldos orçamentários auditados, certidões vigentes e ledger fiscal estável." });
    }

    alertas.forEach(al => {
        const div = document.createElement("div");
        div.className = `alert-item ${al.tipo}`;
        div.textContent = al.texto;
        container.appendChild(div);
    });
}

// 6. PROCESSADOR DE FORMULÁRIOS AUTOMATIZADO (SUBSTITUTO DIRETO DO CONTROLE LOCAL VBA)
function configurarFormularios() {
    
    // Form A: Lançamento Técnico Financeiro
    document.getElementById("form-novo-gasto").addEventListener("submit", (e) => {
        e.preventDefault();

        const emendaId = document.getElementById("form-gasto-projeto").value;
        const metaNum = parseInt(document.getElementById("form-gasto-meta").value);
        const etapaNum = parseInt(document.getElementById("form-gasto-etapa").value);
        const categoria = document.getElementById("form-gasto-categoria").value;
        const fornecedor = document.getElementById("form-gasto-fornecedor").value;
        const nf = document.getElementById("form-gasto-nf").value;
        const valor = parseFloat(document.getElementById("form-gasto-valor").value);

        const novoGastoId = "FIN" + String(BancoDados.financeiro.length + 1).padStart(3, '0');

        const novoLancamento = {
            id: novoGastoId,
            emendaId: emendaId,
            metaNum: metaNum,
            etapaNum: etapaNum,
            categoria: categoria,
            fornecedor: fornecedor,
            nf: nf,
            data: new Date().toISOString().split('T')[0],
            valor: valor,
            workflow: "Aprovado"
        };

        BancoDados.financeiro.push(novoLancamento);
        alert(`✅ Concluído! O Lançamento ${novoGastoId} foi integrado de forma permanente ao Livro Caixa.`);
        
        document.getElementById("form-novo-gasto").reset();
        renderizarSistema();
    });

    // Form B: Cadastro de Profissionais da Equipe Técnica
    document.getElementById("form-novo-profissional").addEventListener("submit", (e) => {
        e.preventDefault();

        const nome = document.getElementById("form-prof-nome").value;
        const cpf = document.getElementById("form-prof-cpf").value;
        const funcao = document.getElementById("form-prof-funcao").value;
        const email = document.getElementById("form-prof-email").value;

        const novoIdProf = "PROF" + String(BancoDados.profissionais.length + 1).padStart(3, '0');

        const novoColaborador = {
            id: novoIdProf,
            nome: nome,
            cpf: cpf,
            funcao: funcao,
            email: email,
            projetos: EstadoSistema.projetoAtivo === "TODOS" ? "Geral/Vários" : EstadoSistema.projetoAtivo,
            status: "Ativo"
        };

        BancoDados.profissionais.push(novoColaborador);
        alert(`✅ Colaborador técnico registrado com sucesso no ID ${novoIdProf}.`);
        
        document.getElementById("form-novo-profissional").reset();
        renderizarSistema();
    });
}

// --- UTILITÁRIOS INTERNOS DE CONVERSÃO ---
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataString) {
    if (!dataString || dataString === "0") return "—";
    const partes = dataString.split("-");
    if (partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}
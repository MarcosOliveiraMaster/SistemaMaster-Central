console.log('✅ functions-detalhes-banco-de-aulas.js carregado');

// Área Dev → Detalhes Banco de Aulas
// Lista de contratos (cards, sem pagamento/progresso) + modal de planilha
// editável (todos os campos de BancoDeAulas-Lista, sem restrição de campo).
window.DetalhesBancoDeAulas = (function () {
  'use strict';

  const COLECAO = 'BancoDeAulas-Lista';

  const PRIORIDADE_COLUNAS = [
    'id-Aula', 'data', 'horario', 'materia', 'professor', 'idProfessor', 'professorUid',
    'estudante', 'nomeCliente', 'cpf', 'clientUid', 'clienteUid', 'idContratacao',
    'StatusAula', 'ConfirmacaoProfessorAula', 'RelatorioAula', 'ValorAula',
    'ObservacoesAula', 'timestamp'
  ];

  let contratos = [];      // [{codigoContratacao, nomeCliente, cpf, professores, anos, qtdAulas, dataContratacao, dataUltimaAula}]
  let filtroProfessor = '';
  let filtroCliente   = '';
  let filtroAno       = String(new Date().getFullYear());
  let filtroStatus    = 'andamento'; // '' = todos | 'andamento' | 'finalizado'
  let carregando = false;

  // Estado do modal aberto
  let modalEl = null;
  let contratoAberto = null;
  let linhasAtuais = [];   // [{id, ...campos}]
  let colunasAtuais = [];  // [nomeCampo, ...]
  let pendencias = {};     // { docId: { campo: novoValor } }
  let selecao = new Set(); // 'row_col'
  let ancora = null;       // {r, c}
  let clipboardValor = null;
  let editandoCelula = null; // {r, c} enquanto um input estiver aberto

  // ===== Datas =====
  function parseDataBR(str) {
    if (!str) return null;
    const m = String(str).match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  function timestampParaDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v === 'object' && typeof v._seconds === 'number') return new Date(v._seconds * 1000);
    return null;
  }

  function formatarDataCurta(date) {
    if (!date) return '—';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  // "Em andamento" x "Finalizado" — comparação pela data da última aula do
  // pacote contra hoje (sem considerar horário). Sem aulas com data válida,
  // assume "andamento" por segurança (não dá pra confirmar que já terminou).
  function calcularStatusAtendimento(dataUltimaAula) {
    if (!dataUltimaAula) return 'andamento';
    const hoje = new Date();
    const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const ultimaSemHora = new Date(dataUltimaAula.getFullYear(), dataUltimaAula.getMonth(), dataUltimaAula.getDate());
    return ultimaSemHora.getTime() < hojeSemHora.getTime() ? 'finalizado' : 'andamento';
  }

  // ===== Carregamento e agrupamento por contrato =====
  async function carregarContratos(forceRefresh = false) {
    const [todasAulas, todosContratos] = await Promise.all([
      BANCO.fetchBancoDeAulasListaBatch(forceRefresh),
      BANCO.fetchBancoDeAulas(forceRefresh)
    ]);

    const dataContratoPorCodigo = {};
    (todosContratos || []).forEach(c => {
      const cod = c.codigoContratacao || c.id;
      if (cod) dataContratoPorCodigo[cod] = timestampParaDate(c.timestamp);
    });

    const grupos = {};
    (todasAulas || []).forEach(aula => {
      const cod = aula.idContratacao || (aula['id-Aula'] || '').substring(0, 4);
      if (!cod) return;
      if (!grupos[cod]) grupos[cod] = { codigoContratacao: cod, nomeCliente: '', cpf: '', professores: new Set(), aulas: [] };
      grupos[cod].aulas.push(aula);
      if (!grupos[cod].nomeCliente && aula.nomeCliente) grupos[cod].nomeCliente = aula.nomeCliente;
      if (!grupos[cod].cpf && aula.cpf) grupos[cod].cpf = aula.cpf;
      if (aula.professor && aula.professor !== 'A definir') grupos[cod].professores.add(aula.professor);
    });

    contratos = Object.values(grupos).map(g => {
      const datas = g.aulas.map(a => parseDataBR(a.data)).filter(Boolean);
      const dataUltimaAula = datas.length ? new Date(Math.max(...datas.map(d => d.getTime()))) : null;
      const anos = [...new Set(datas.map(d => d.getFullYear()))];
      const statusAtendimento = calcularStatusAtendimento(dataUltimaAula);
      return {
        codigoContratacao: g.codigoContratacao,
        nomeCliente: g.nomeCliente || '(sem nome)',
        cpf: g.cpf || '',
        professores: [...g.professores],
        anos,
        qtdAulas: g.aulas.length,
        statusAtendimento,
        dataContratacao: dataContratoPorCodigo[g.codigoContratacao] || null,
        dataUltimaAula
      };
    }).sort((a, b) => (b.dataContratacao ? b.dataContratacao.getTime() : 0) - (a.dataContratacao ? a.dataContratacao.getTime() : 0));
  }

  // ===== Render da seção =====
  function render() {
    const section = document.getElementById('detalhes-banco-de-aulas');
    if (!section) return;
    section.innerHTML = `
      <div class="mb-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div class="w-full sm:w-48">
          <label for="dba-filtro-status" class="block text-xs font-semibold text-gray-500 mb-1">Atendimento</label>
          <div class="relative">
            <i class="fas fa-list-check absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <select id="dba-filtro-status"
              class="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
              <option value="" ${filtroStatus === '' ? 'selected' : ''}>Todos</option>
              <option value="andamento" ${filtroStatus === 'andamento' ? 'selected' : ''}>Em andamento</option>
              <option value="finalizado" ${filtroStatus === 'finalizado' ? 'selected' : ''}>Finalizado</option>
            </select>
          </div>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label for="dba-busca-professor" class="block text-xs font-semibold text-gray-500 mb-1">Busca Professor</label>
          <div class="relative">
            <i class="fas fa-chalkboard-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input type="text" id="dba-busca-professor" placeholder="Nome do professor..."
              class="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
          </div>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label for="dba-busca-cliente" class="block text-xs font-semibold text-gray-500 mb-1">Buscar Cliente</label>
          <div class="relative">
            <i class="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input type="text" id="dba-busca-cliente" placeholder="Nome ou CPF do cliente..."
              class="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
          </div>
        </div>
        <div class="w-full sm:w-36">
          <label for="dba-busca-ano" class="block text-xs font-semibold text-gray-500 mb-1">Ano</label>
          <div class="relative">
            <i class="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input type="number" id="dba-busca-ano" placeholder="Ano..." value="${filtroAno}"
              class="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
          </div>
        </div>
      </div>
      <div id="dba-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    `;

    const buscaProfessor = document.getElementById('dba-busca-professor');
    const buscaCliente   = document.getElementById('dba-busca-cliente');
    const buscaAno       = document.getElementById('dba-busca-ano');
    const filtroStatusEl = document.getElementById('dba-filtro-status');

    buscaProfessor.addEventListener('input', () => {
      filtroProfessor = buscaProfessor.value.trim().toLowerCase();
      renderCards();
    });
    buscaCliente.addEventListener('input', () => {
      filtroCliente = buscaCliente.value.trim().toLowerCase();
      renderCards();
    });
    buscaAno.addEventListener('input', () => {
      filtroAno = buscaAno.value.trim();
      renderCards();
    });
    filtroStatusEl.addEventListener('change', () => {
      filtroStatus = filtroStatusEl.value;
      renderCards();
    });
  }

  // Filtros combinam com E — mesmo professor, mesmo cliente, ano específico e
  // status de atendimento só aparecem juntos quando um contrato atende a todos
  // os campos preenchidos.
  function contratosFiltrados() {
    return contratos.filter(c => {
      if (filtroProfessor && !c.professores.some(p => p.toLowerCase().includes(filtroProfessor))) return false;
      if (filtroCliente && !(c.nomeCliente.toLowerCase().includes(filtroCliente) || (c.cpf || '').includes(filtroCliente))) return false;
      if (filtroAno && !c.anos.includes(parseInt(filtroAno, 10))) return false;
      if (filtroStatus && c.statusAtendimento !== filtroStatus) return false;
      return true;
    });
  }

  function renderCards() {
    const grid = document.getElementById('dba-grid');
    if (!grid) return;

    const lista = contratosFiltrados();
    if (!lista.length) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <i class="fas fa-table-cells text-4xl text-gray-300 mb-4"></i>
          <h3 class="font-lexend text-lg mb-2 text-gray-500">Nenhum contrato encontrado</h3>
        </div>`;
      return;
    }

    grid.innerHTML = lista.map(c => {
      const statusHtml = c.statusAtendimento === 'finalizado'
        ? `<span class="text-[10px] font-semibold uppercase tracking-wide bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Finalizado</span>`
        : `<span class="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Em andamento</span>`;
      return `
      <div class="dba-card bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all cursor-pointer p-4"
           data-codigo="${c.codigoContratacao}">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-lexend font-bold text-gray-800 text-sm">${c.nomeCliente}</h3>
          <span class="text-xs font-mono bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">${c.codigoContratacao}</span>
        </div>
        <div class="mb-2">${statusHtml}</div>
        <div class="text-xs text-gray-500 space-y-1 mt-3">
          <div class="flex items-center gap-2"><i class="fas fa-calendar-plus w-4 text-gray-400"></i>Contratação: <strong class="text-gray-700">${formatarDataCurta(c.dataContratacao)}</strong></div>
          <div class="flex items-center gap-2"><i class="fas fa-calendar-check w-4 text-gray-400"></i>Última aula: <strong class="text-gray-700">${formatarDataCurta(c.dataUltimaAula)}</strong></div>
          <div class="flex items-center gap-2"><i class="fas fa-chalkboard w-4 text-gray-400"></i>${c.qtdAulas} aula(s)</div>
        </div>
      </div>
    `;
    }).join('');

    grid.querySelectorAll('.dba-card').forEach(card => {
      card.addEventListener('click', () => abrirModal(card.dataset.codigo));
    });
  }

  // ===== Modal — planilha editável =====
  function calcularColunas(docs) {
    const todasChaves = new Set();
    docs.forEach(d => Object.keys(d).forEach(k => { if (k !== 'id') todasChaves.add(k); }));
    const resto = [...todasChaves].filter(k => !PRIORIDADE_COLUNAS.includes(k)).sort();
    return [...PRIORIDADE_COLUNAS.filter(k => todasChaves.has(k)), ...resto];
  }

  function formatarValorExibicao(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'object' && typeof v.toDate === 'function') {
      try { return v.toDate().toISOString().slice(0, 16); } catch (_) { return ''; }
    }
    if (typeof v === 'object' && typeof v._seconds === 'number') {
      return new Date(v._seconds * 1000).toISOString().slice(0, 16);
    }
    return String(v);
  }

  function valorAtualCelula(r, c) {
    const doc = linhasAtuais[r];
    const campo = colunasAtuais[c];
    if (pendencias[doc.id] && Object.prototype.hasOwnProperty.call(pendencias[doc.id], campo)) {
      return pendencias[doc.id][campo];
    }
    return formatarValorExibicao(doc[campo]);
  }

  function coagirValorParaSalvar(valorOriginal, textoNovo) {
    if (typeof valorOriginal === 'boolean') {
      const s = textoNovo.trim().toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
      return textoNovo;
    }
    if (valorOriginal && typeof valorOriginal === 'object' && typeof valorOriginal.toDate === 'function') {
      const d = new Date(textoNovo);
      if (!isNaN(d.getTime())) return firebase.firestore.Timestamp.fromDate(d);
      return textoNovo; // não parseável como data — vira string simples (efeito colateral aceito)
    }
    if (typeof valorOriginal === 'number' && textoNovo.trim() !== '' && !isNaN(Number(textoNovo))) {
      return Number(textoNovo);
    }
    return textoNovo;
  }

  async function abrirModal(codigoContratacao) {
    contratoAberto = codigoContratacao;
    pendencias = {}; selecao = new Set(); ancora = null; clipboardValor = null; editandoCelula = null;

    montarEsqueletoModal(codigoContratacao);

    try {
      const snap = await BANCO.db.collection(COLECAO).where('idContratacao', '==', codigoContratacao).get();
      let docs = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() }));

      if (!docs.length) {
        // Fallback para aulas antigas sem o campo idContratacao
        const todos = await BANCO.fetchBancoDeAulasListaBatch();
        docs = todos.filter(a => (a['id-Aula'] || '').substring(0, 4) === codigoContratacao)
          .map(a => { const cp = { ...a }; return cp; });
      }

      linhasAtuais = docs;
      colunasAtuais = calcularColunas(docs);
      renderTabelaModal();
    } catch (e) {
      console.error('[DetalhesBancoDeAulas] Erro ao carregar aulas do contrato:', e);
      const body = document.getElementById('dba-modal-body');
      if (body) body.innerHTML = `<p class="text-red-600 text-sm p-4">Erro ao carregar aulas: ${e.message}</p>`;
    }
  }

  function montarEsqueletoModal(codigoContratacao) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="dba-modal-overlay" style="z-index:10000;">
        <div class="modal-container" style="max-width:96vw; width:96vw; max-height:92vh;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">
              <i class="fas fa-table-cells text-orange-500 mr-2"></i>Contrato ${codigoContratacao} — edição livre
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600" id="dba-modal-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" id="dba-modal-body" style="overflow:auto; max-height:70vh;">
            <div class="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
              <span class="loading-spinner-large"></span> Carregando aulas do contrato...
            </div>
          </div>
          <div class="modal-footer" style="justify-content:space-between; align-items:center;">
            <span class="text-xs text-gray-400" id="dba-modal-status">Nenhuma alteração pendente.</span>
            <div class="flex gap-2">
              <button class="btn-secondary btn-compact" id="dba-btn-cancelar">Cancelar</button>
              <button class="btn-primary btn-compact" id="dba-btn-salvar">
                <i class="fas fa-check mr-2"></i>Salvar alterações
              </button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    modalEl = document.getElementById('dba-modal-overlay');

    document.getElementById('dba-modal-close').addEventListener('click', fecharModal);
    document.getElementById('dba-btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('dba-btn-salvar').addEventListener('click', salvarAlteracoes);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) fecharModal(); });
    document.addEventListener('keydown', onKeydownGlobal);
  }

  function fecharModal() {
    document.removeEventListener('keydown', onKeydownGlobal);
    if (modalEl) modalEl.remove();
    modalEl = null; contratoAberto = null; linhasAtuais = []; colunasAtuais = [];
    pendencias = {}; selecao = new Set(); ancora = null; editandoCelula = null;
  }

  function renderTabelaModal() {
    const body = document.getElementById('dba-modal-body');
    if (!body) return;

    if (!linhasAtuais.length) {
      body.innerHTML = `<p class="text-gray-500 text-sm p-4">Nenhuma aula encontrada para este contrato.</p>`;
      return;
    }

    const theadHtml = `<tr>
      <th class="dba-th sticky top-0 left-0 z-20 bg-gray-100">#</th>
      ${colunasAtuais.map(col => `<th class="dba-th sticky top-0 z-10 bg-gray-100">${col}</th>`).join('')}
    </tr>`;

    const tbodyHtml = linhasAtuais.map((doc, r) => `
      <tr>
        <td class="dba-td dba-td-fixed sticky left-0 bg-white text-gray-400 text-xs">${r + 1}</td>
        ${colunasAtuais.map((col, c) => `
          <td class="dba-td" data-row="${r}" data-col="${c}">${escapeHtml(valorAtualCelula(r, c))}</td>
        `).join('')}
      </tr>
    `).join('');

    body.innerHTML = `
      <div style="overflow:auto; max-height:64vh;">
        <table class="dba-table" style="border-collapse:collapse; font-size:12.5px; font-family: ui-monospace, 'SF Mono', Consolas, monospace;">
          <thead>${theadHtml}</thead>
          <tbody id="dba-tbody">${tbodyHtml}</tbody>
        </table>
      </div>
      <p class="text-xs text-gray-400 mt-2 px-1">
        Clique: seleciona · Ctrl+clique: seleção múltipla · Shift+clique: seleciona intervalo ·
        Duplo clique: edita · Ctrl+C / Ctrl+V: copiar e colar em massa.
      </p>`;

    injetarEstiloTabela();
    wireCelulas();
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injetarEstiloTabela() {
    if (document.getElementById('dba-table-style')) return;
    const style = document.createElement('style');
    style.id = 'dba-table-style';
    style.textContent = `
      .dba-th { border:1px solid #e5e7eb; padding:6px 10px; text-align:left; font-weight:700; color:#374151; white-space:nowrap; }
      .dba-td { border:1px solid #e5e7eb; padding:5px 10px; white-space:nowrap; max-width:260px; overflow:hidden; text-overflow:ellipsis; cursor:cell; }
      .dba-td-fixed { cursor:default; }
      .dba-td.dba-sel { outline:2px solid #f28705; outline-offset:-2px; background:#fff7ed; }
      .dba-td.dba-dirty { background:#fef3c7; }
      .dba-td.dba-dirty.dba-sel { background:#fde68a; }
      .dba-cell-input { width:100%; border:none; outline:none; font:inherit; padding:0; background:transparent; }
    `;
    document.head.appendChild(style);
  }

  // ===== Seleção de células =====
  function celulaEl(r, c) {
    const tbody = document.getElementById('dba-tbody');
    if (!tbody) return null;
    return tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
  }

  function atualizarClassesSelecao() {
    document.querySelectorAll('#dba-tbody td.dba-td').forEach(td => td.classList.remove('dba-sel'));
    selecao.forEach(key => {
      const [r, c] = key.split('_');
      const el = celulaEl(r, c);
      if (el) el.classList.add('dba-sel');
    });
  }

  function marcarDirty(r, c) {
    const el = celulaEl(r, c);
    if (el) el.classList.add('dba-dirty');
  }

  function wireCelulas() {
    const tbody = document.getElementById('dba-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('td.dba-td').forEach(td => {
      td.addEventListener('click', (e) => {
        if (editandoCelula) return; // clique enquanto edita não mexe na seleção
        const r = parseInt(td.dataset.row, 10);
        const c = parseInt(td.dataset.col, 10);

        if (e.ctrlKey || e.metaKey) {
          const key = `${r}_${c}`;
          if (selecao.has(key)) selecao.delete(key); else selecao.add(key);
          ancora = { r, c };
        } else if (e.shiftKey && ancora) {
          selecao = new Set();
          const rMin = Math.min(ancora.r, r), rMax = Math.max(ancora.r, r);
          const cMin = Math.min(ancora.c, c), cMax = Math.max(ancora.c, c);
          for (let rr = rMin; rr <= rMax; rr++) {
            for (let cc = cMin; cc <= cMax; cc++) selecao.add(`${rr}_${cc}`);
          }
        } else {
          selecao = new Set([`${r}_${c}`]);
          ancora = { r, c };
        }
        atualizarClassesSelecao();
      });

      td.addEventListener('dblclick', () => {
        const r = parseInt(td.dataset.row, 10);
        const c = parseInt(td.dataset.col, 10);
        entrarModoEdicao(r, c);
      });
    });
  }

  function entrarModoEdicao(r, c) {
    if (editandoCelula) sairModoEdicao(false);
    const el = celulaEl(r, c);
    if (!el) return;
    editandoCelula = { r, c };
    const valorAtual = valorAtualCelula(r, c);
    el.innerHTML = `<input type="text" class="dba-cell-input" value="${escapeHtml(valorAtual)}">`;
    const input = el.querySelector('input');
    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); sairModoEdicao(true); }
      else if (e.key === 'Escape') { e.preventDefault(); sairModoEdicao(false); }
    });
    input.addEventListener('blur', () => sairModoEdicao(true));
  }

  function sairModoEdicao(confirmar) {
    if (!editandoCelula) return;
    const { r, c } = editandoCelula;
    const el = celulaEl(r, c);
    const input = el ? el.querySelector('input') : null;

    if (confirmar && input) {
      aplicarValorNaCelula(r, c, input.value);
    }
    editandoCelula = null;
    if (el) el.textContent = valorAtualCelula(r, c);
    atualizarStatusPendencias();
  }

  function aplicarValorNaCelula(r, c, textoNovo) {
    const doc = linhasAtuais[r];
    const campo = colunasAtuais[c];
    if (!pendencias[doc.id]) pendencias[doc.id] = {};
    pendencias[doc.id][campo] = coagirValorParaSalvar(doc[campo], textoNovo);
    marcarDirty(r, c);
  }

  function atualizarStatusPendencias() {
    const status = document.getElementById('dba-modal-status');
    if (!status) return;
    const qtdDocs = Object.keys(pendencias).length;
    const qtdCampos = Object.values(pendencias).reduce((acc, obj) => acc + Object.keys(obj).length, 0);
    status.textContent = qtdDocs
      ? `${qtdCampos} campo(s) alterado(s) em ${qtdDocs} aula(s) — não salvo ainda.`
      : 'Nenhuma alteração pendente.';
  }

  // ===== Copiar / colar =====
  function onKeydownGlobal(e) {
    if (!modalEl) return;
    if (editandoCelula) return; // deixa o input da célula lidar com o próprio copy/paste

    const ctrlOuCmd = e.ctrlKey || e.metaKey;
    if (!ctrlOuCmd) return;

    if (e.key === 'c' || e.key === 'C') {
      if (!ancora) return;
      e.preventDefault();
      clipboardValor = valorAtualCelula(ancora.r, ancora.c);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(clipboardValor).catch(() => {});
      }
    } else if (e.key === 'v' || e.key === 'V') {
      if (clipboardValor === null || !selecao.size) return;
      e.preventDefault();
      selecao.forEach(key => {
        const [r, c] = key.split('_').map(Number);
        aplicarValorNaCelula(r, c, clipboardValor);
        const el = celulaEl(r, c);
        if (el) el.textContent = valorAtualCelula(r, c);
      });
      atualizarStatusPendencias();
    }
  }

  // ===== Salvar =====
  async function salvarAlteracoes() {
    const ids = Object.keys(pendencias);
    if (!ids.length) { fecharModal(); return; }

    const btn = document.getElementById('dba-btn-salvar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner-large" style="width:14px;height:14px;"></span> Salvando...'; }

    try {
      const batch = BANCO.db.batch();
      ids.forEach(id => {
        const ref = BANCO.db.collection(COLECAO).doc(id);
        batch.update(ref, pendencias[id]);
      });
      await batch.commit();

      if (typeof BANCO.forceCacheRefresh === 'function') BANCO.forceCacheRefresh();
      if (typeof showToast === 'function') showToast(`${ids.length} aula(s) atualizada(s) com sucesso.`, 'success');

      fecharModal();
      await carregarContratos(true);
      renderCards();
    } catch (e) {
      console.error('[DetalhesBancoDeAulas] Erro ao salvar:', e);
      if (typeof showToast === 'function') showToast('Erro ao salvar alterações: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check mr-2"></i>Salvar alterações'; }
    }
  }

  // ===== Init =====
  async function init() {
    render();
    if (carregando) return;
    carregando = true;
    const grid = document.getElementById('dba-grid');
    if (grid) grid.innerHTML = `<div class="col-span-full flex items-center justify-center gap-2 text-gray-500 text-sm py-12"><span class="loading-spinner-large"></span> Carregando contratos...</div>`;
    try {
      await carregarContratos();
      renderCards();
    } catch (e) {
      console.error('[DetalhesBancoDeAulas] Erro ao carregar:', e);
      if (grid) grid.innerHTML = `<p class="col-span-full text-red-600 text-sm text-center py-8">Erro ao carregar dados: ${e.message}</p>`;
    } finally {
      carregando = false;
    }
  }

  return { init };
})();

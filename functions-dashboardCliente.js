console.log('functions-dashboardCliente.js carregado');

class DashboardCliente {

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // CONSTRUTOR
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  constructor() {
    this.clients = [];
    this.filteredClients = null;
    this.unsubscribe = null;
    // init() is called explicitly from script.js (loadSectionContent)
    // so that it only runs when the user navigates to the 'clientes' section.
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // INICIALIZAÇÃO
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  init() {
    this.setupUI();
    this.loadClients();
    this.setupRealTimeUpdates();
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // MONTAGEM DA INTERFACE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  setupUI() {
    const section = document.getElementById('clientes');
    if (!section) {
      console.error('Section #clientes não encontrada');
      return;
    }

    section.innerHTML = `
      <!-- Barra de Filtros -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
        <div class="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div class="flex flex-col sm:flex-row gap-3 flex-1">
            <input
              type="text"
              id="dc-search"
              placeholder="Buscar por nome, CPF ou e-mail..."
              class="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
            />
            <select
              id="dc-filter-contrato"
              class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
            >
              <option value="">Todos os contratos</option>
              <option value="Pendente de assinatura">Pendente de assinatura</option>
              <option value="Contrato assinado">Contrato assinado</option>
            </select>
            <select
              id="dc-filter-pagamento"
              class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
            >
              <option value="">Todos os pagamentos</option>
              <option value="Aguardando 1º Pagamento">Aguardando 1º Pagamento</option>
              <option value="Aguardando 2º Pagamento">Aguardando 2º Pagamento</option>
              <option value="Pagamento completo">Pagamento completo</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button
              id="dc-btn-clear"
              class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <i class="fas fa-times mr-1"></i> Limpar
            </button>
            <button
              id="dc-btn-csv"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
            >
              <i class="fas fa-file-csv mr-1"></i> Exportar CSV
            </button>
          </div>
        </div>
        <p id="dc-count" class="mt-2 text-xs text-gray-500"></p>
      </div>

      <!-- Loading -->
      <div id="dc-loading" class="hidden text-center py-12">
        <i class="fas fa-spinner fa-spin text-orange-500 text-3xl mb-3"></i>
        <p class="text-gray-500 text-sm">Carregando clientes...</p>
      </div>

      <!-- Grid de Cards -->
      <div id="dc-cards-container" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      </div>

      <!-- Modal Detalhes -->
      <div id="dc-modal-detalhes" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-lexend font-bold text-gray-800">Detalhes do Cliente</h3>
            <button class="dc-close-modal text-gray-400 hover:text-gray-600 transition-colors" data-modal="dc-modal-detalhes">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div id="dc-detalhes-body" class="p-5 space-y-3 text-sm text-gray-700"></div>
        </div>
      </div>

      <!-- Modal NF -->
      <div id="dc-modal-nf" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-lexend font-bold text-gray-800">Nota Fiscal</h3>
            <button class="dc-close-modal text-gray-400 hover:text-gray-600 transition-colors" data-modal="dc-modal-nf">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div id="dc-nf-body" class="p-5 space-y-3 text-sm text-gray-700"></div>
        </div>
      </div>

      <!-- Modal Aulas -->
      <div id="dc-modal-aula" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-lexend font-bold text-gray-800">Aulas do Cliente</h3>
            <button class="dc-close-modal text-gray-400 hover:text-gray-600 transition-colors" data-modal="dc-modal-aula">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div id="dc-aula-body" class="p-5 text-sm text-gray-700"></div>
        </div>
      </div>

      <!-- Modal Estudante -->
      <div id="dc-modal-estudante" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-lexend font-bold text-gray-800">Estudantes</h3>
            <button class="dc-close-modal text-gray-400 hover:text-gray-600 transition-colors" data-modal="dc-modal-estudante">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div id="dc-estudante-body" class="p-5 space-y-3 text-sm text-gray-700"></div>
        </div>
      </div>

      <!-- Modal Editar -->
      <div id="dc-modal-editar" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-lexend font-bold text-gray-800">Editar Cliente</h3>
            <button class="dc-close-modal text-gray-400 hover:text-gray-600 transition-colors" data-modal="dc-modal-editar">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div id="dc-form-editar" class="p-5"></div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // EVENT LISTENERS GERAIS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  setupEventListeners() {
    // Busca por texto
    const searchInput = document.getElementById('dc-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.applyLocalFilters());
    }

    // Filtro por contrato
    const filterContrato = document.getElementById('dc-filter-contrato');
    if (filterContrato) {
      filterContrato.addEventListener('change', () => this.applyLocalFilters());
    }

    // Filtro por pagamento
    const filterPagamento = document.getElementById('dc-filter-pagamento');
    if (filterPagamento) {
      filterPagamento.addEventListener('change', () => this.applyLocalFilters());
    }

    // Limpar filtros
    const btnClear = document.getElementById('dc-btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearAllFilters());
    }

    // Exportar CSV
    const btnCsv = document.getElementById('dc-btn-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', () => this.downloadCSV());
    }

    // Fechar modais ao clicar no backdrop
    document.querySelectorAll('#clientes .fixed.inset-0').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });

    // Botões de fechar modal
    document.querySelectorAll('.dc-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) this.closeModal(modalId);
      });
    });
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // CARREGAMENTO DE DADOS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  async loadClients() {
    this._showLoading(true);
    try {
      const snapshot = await db.collection('cadastroClientes').get();
      this.clients = [];
      snapshot.forEach(doc => {
        this.clients.push({ id: doc.id, ...doc.data() });
      });
      this.renderCards();
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      this.showToast('Erro ao carregar clientes', 'error');
    } finally {
      this._showLoading(false);
    }
  }

  setupRealTimeUpdates() {
    // Cancelar listener anterior antes de criar um novo
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = db.collection('cadastroClientes').onSnapshot(snapshot => {
      this.clients = [];
      snapshot.forEach(doc => {
        this.clients.push({ id: doc.id, ...doc.data() });
      });
      // Preservar estado dos filtros ativos ao recarregar via real-time
      if (this.filteredClients !== null) {
        this.applyLocalFilters();
      } else {
        this.renderCards();
      }
    }, error => {
      console.error('❌ Erro no listener real-time:', error);
    });
  }

  _showLoading(show) {
    const el = document.getElementById('dc-loading');
    const container = document.getElementById('dc-cards-container');
    if (el) el.classList.toggle('hidden', !show);
    if (container) container.classList.toggle('hidden', !!show);
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // FILTROS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  applyLocalFilters() {
    const search = (document.getElementById('dc-search')?.value || '').trim().toLowerCase();
    const statusContrato = document.getElementById('dc-filter-contrato')?.value || '';
    const statusPagamento = document.getElementById('dc-filter-pagamento')?.value || '';

    this.filteredClients = this.clients.filter(c => {
      const matchesSearch = !search
        || (c.nome || '').toLowerCase().includes(search)
        || (c.cpf || '').replace(/\D/g, '').includes(search.replace(/\D/g, ''))
        || (c.email || '').toLowerCase().includes(search);
      const matchesContrato = !statusContrato || c.statusContrato === statusContrato;
      const matchesPagamento = !statusPagamento || c.statusPagamento === statusPagamento;
      return matchesSearch && matchesContrato && matchesPagamento;
    });

    this.renderCards(this.filteredClients);
  }

  clearAllFilters() {
    const search = document.getElementById('dc-search');
    const filterContrato = document.getElementById('dc-filter-contrato');
    const filterPagamento = document.getElementById('dc-filter-pagamento');
    if (search) search.value = '';
    if (filterContrato) filterContrato.value = '';
    if (filterPagamento) filterPagamento.value = '';
    this.filteredClients = null;
    this.renderCards();
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // RENDERIZAÇÃO DE CARDS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  renderCards(list) {
    const container = document.getElementById('dc-cards-container');
    const countEl = document.getElementById('dc-count');
    if (!container) return;

    const clients = list !== undefined ? list : this.clients;

    if (countEl) {
      countEl.textContent = list !== undefined
        ? `${clients.length} de ${this.clients.length} cliente(s)`
        : `${clients.length} cliente(s)`;
    }

    if (clients.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-500">
          <i class="fas fa-users text-4xl text-gray-300 mb-3"></i>
          <p class="font-lexend text-base font-semibold mb-1">Nenhum cliente encontrado</p>
          <p class="text-sm">Tente ajustar os filtros de busca.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = clients.map(c => this.buildCard(c)).join('');

    // Vincular eventos dos botões dos cards
    container.querySelectorAll('.dc-btn-detalhes').forEach(btn => {
      btn.addEventListener('click', () => this.openModalDetalhes(btn.dataset.id));
    });
    container.querySelectorAll('.dc-btn-nf').forEach(btn => {
      btn.addEventListener('click', () => this.openModalNF(btn.dataset.id));
    });
    container.querySelectorAll('.dc-btn-aula').forEach(btn => {
      btn.addEventListener('click', () => this.openModalAula(btn.dataset.id));
    });
    container.querySelectorAll('.dc-btn-estudante').forEach(btn => {
      btn.addEventListener('click', () => this.openModalEstudante(btn.dataset.id));
    });
    container.querySelectorAll('.dc-btn-editar').forEach(btn => {
      btn.addEventListener('click', () => this.openModalEditar(btn.dataset.id));
    });
  }

  buildCard(client) {
    const nome = client.nome || 'Sem nome';
    const cpf = client.cpf || '—';
    const email = client.email || '—';
    const telefone = client.telefone || client.whatsapp || '—';
    const estudantes = client.estudantes || [];
    const numEstudantes = estudantes.length;

    const statusContratoClass = client.statusContrato === 'Contrato assinado'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700';

    const statusPagamentoClass = client.statusPagamento === 'Pagamento completo'
      ? 'bg-green-100 text-green-700'
      : 'bg-orange-100 text-orange-600';

    const statusContrato = client.statusContrato || 'Não informado';
    const statusPagamento = client.statusPagamento || 'Não informado';

    return `
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
        <!-- Cabeçalho do card -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-user text-orange-500"></i>
            </div>
            <div>
              <h4 class="font-lexend font-semibold text-gray-800 text-sm leading-tight">${this._escapeHtml(nome)}</h4>
              <p class="text-xs text-gray-500 mt-0.5">${this._escapeHtml(cpf)}</p>
            </div>
          </div>
        </div>

        <!-- Informações -->
        <div class="space-y-1.5 text-xs text-gray-600">
          <div class="flex items-center gap-2">
            <i class="fas fa-envelope text-gray-400 w-4 text-center"></i>
            <span class="truncate">${this._escapeHtml(email)}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fas fa-phone text-gray-400 w-4 text-center"></i>
            <span>${this._escapeHtml(telefone)}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fas fa-graduation-cap text-gray-400 w-4 text-center"></i>
            <span>${numEstudantes} estudante(s)</span>
          </div>
        </div>

        <!-- Badges de status -->
        <div class="flex flex-wrap gap-2">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusContratoClass}">
            ${this._escapeHtml(statusContrato)}
          </span>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusPagamentoClass}">
            ${this._escapeHtml(statusPagamento)}
          </span>
        </div>

        <!-- Botões de ação -->
        <div class="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
          <button
            class="dc-btn-detalhes flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            data-id="${client.id}"
            title="Detalhes"
          >
            <i class="fas fa-info-circle mr-1"></i>Detalhes
          </button>
          <button
            class="dc-btn-estudante flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            data-id="${client.id}"
            title="Estudantes"
          >
            <i class="fas fa-graduation-cap mr-1"></i>Alunos
          </button>
          <button
            class="dc-btn-aula flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
            data-id="${client.id}"
            title="Aulas"
          >
            <i class="fas fa-chalkboard-teacher mr-1"></i>Aulas
          </button>
          <button
            class="dc-btn-nf px-2 py-1.5 text-xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
            data-id="${client.id}"
            title="Nota Fiscal"
          >
            <i class="fas fa-file-invoice mr-1"></i>NF
          </button>
          <button
            class="dc-btn-editar px-2 py-1.5 text-xs font-medium rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
            data-id="${client.id}"
            title="Editar"
          >
            <i class="fas fa-pen"></i>
          </button>
        </div>
      </div>
    `;
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // CONTROLE DE MODAIS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  openModalDetalhes(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;

    const body = document.getElementById('dc-detalhes-body');
    if (!body) return;

    const fields = [
      { label: 'Nome', value: client.nome },
      { label: 'CPF', value: client.cpf },
      { label: 'E-mail', value: client.email },
      { label: 'Telefone', value: client.telefone },
      { label: 'WhatsApp', value: client.whatsapp },
      { label: 'Endereço', value: client.endereco },
      { label: 'Endereço para Aulas', value: client.enderecoAulas },
      { label: 'CEP', value: client.cep },
      { label: 'Cidade / UF', value: client.cidadeUF },
      { label: 'Código de Contratação', value: client.codigoContratacao },
      { label: 'Status do Contrato', value: client.statusContrato },
      { label: 'Status de Pagamento', value: client.statusPagamento },
      { label: 'Modo de Pagamento', value: client.modoPagamento },
      { label: 'Valor do Pacote', value: client.ValorPacote != null ? `R$ ${Number(client.ValorPacote).toFixed(2)}` : null },
      { label: 'Valor Equipe', value: client.ValorEquipe != null ? `R$ ${Number(client.ValorEquipe).toFixed(2)}` : null },
      { label: 'Lucro Master', value: client.lucroMaster != null ? `R$ ${Number(client.lucroMaster).toFixed(2)}` : null },
    ];

    body.innerHTML = fields
      .filter(f => f.value != null && f.value !== '')
      .map(f => `
        <div class="flex gap-2">
          <span class="font-semibold text-gray-600 w-44 flex-shrink-0">${this._escapeHtml(f.label)}:</span>
          <span class="text-gray-800">${this._escapeHtml(String(f.value))}</span>
        </div>
      `)
      .join('') || '<p class="text-gray-500 italic">Nenhuma informação disponível.</p>';

    this.openModal('dc-modal-detalhes');
  }

  openModalNF(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;

    const body = document.getElementById('dc-nf-body');
    if (!body) return;

    const nfFields = [
      { label: 'Nome', value: client.nome },
      { label: 'CPF', value: client.cpf },
      { label: 'Endereço', value: client.endereco },
      { label: 'Cidade / UF', value: client.cidadeUF },
      { label: 'CEP', value: client.cep },
      { label: 'Código de Contratação', value: client.codigoContratacao },
      { label: 'Valor do Pacote', value: client.ValorPacote != null ? `R$ ${Number(client.ValorPacote).toFixed(2)}` : null },
      { label: 'Modo de Pagamento', value: client.modoPagamento },
    ];

    body.innerHTML = `
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
        <p class="text-xs text-orange-700 font-medium">
          <i class="fas fa-info-circle mr-1"></i>
          Dados para emissão de Nota Fiscal
        </p>
      </div>
      ${nfFields
        .filter(f => f.value != null && f.value !== '')
        .map(f => `
          <div class="flex gap-2">
            <span class="font-semibold text-gray-600 w-44 flex-shrink-0">${this._escapeHtml(f.label)}:</span>
            <span class="text-gray-800">${this._escapeHtml(String(f.value))}</span>
          </div>
        `)
        .join('') || '<p class="text-gray-500 italic">Nenhuma informação disponível.</p>'}
    `;

    this.openModal('dc-modal-nf');
  }

  openModalAula(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;

    const body = document.getElementById('dc-aula-body');
    if (!body) return;

    const codigo = client.codigoContratacao || '';

    body.innerHTML = `
      <div class="mb-4">
        <p class="text-sm text-gray-600 mb-1">
          <span class="font-semibold">Cliente:</span> ${this._escapeHtml(client.nome || '—')}
        </p>
        <p class="text-sm text-gray-600">
          <span class="font-semibold">Código de Contratação:</span> ${this._escapeHtml(codigo || '—')}
        </p>
      </div>
      ${codigo
        ? `<div id="dc-aulas-list" class="text-center py-8 text-gray-500">
             <i class="fas fa-spinner fa-spin text-orange-500 text-2xl mb-2"></i>
             <p class="text-sm">Carregando aulas...</p>
           </div>`
        : `<p class="text-gray-500 italic text-sm">Código de contratação não informado.</p>`
      }
    `;

    if (codigo) {
      this._loadAulasForModal(codigo);
    }

    this.openModal('dc-modal-aula');
  }

  async _loadAulasForModal(codigo) {
    const container = document.getElementById('dc-aulas-list');
    if (!container) return;
    try {
      const snapshot = await db.collection('BancoDeAulas-Lista')
        .orderBy('data', 'asc')
        .get();

      const aulas = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        const idAula = d['id-Aula'] || '';
        if (idAula.substring(0, 4) === codigo) {
          aulas.push({ id: doc.id, ...d });
        }
      });

      if (aulas.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic text-sm text-center py-4">Nenhuma aula encontrada.</p>';
        return;
      }

      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="px-3 py-2 text-left font-semibold text-gray-700">Data</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-700">Horário</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-700">Duração</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-700">Matéria</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-700">Professor</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              ${aulas.map(a => `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="px-3 py-2">${this._escapeHtml(a.data || '—')}</td>
                  <td class="px-3 py-2">${this._escapeHtml(a.horario || '—')}</td>
                  <td class="px-3 py-2">${this._escapeHtml(a.duracao || '—')}</td>
                  <td class="px-3 py-2">${this._escapeHtml(a.materia || a.Materia || '—')}</td>
                  <td class="px-3 py-2">${this._escapeHtml(a.professor || a.Professor || '—')}</td>
                  <td class="px-3 py-2">${this._escapeHtml(a.StatusAula || a.statusAula || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error('Erro ao carregar aulas:', err);
      container.innerHTML = '<p class="text-red-500 text-sm text-center py-4">Erro ao carregar aulas.</p>';
    }
  }

  openModalEstudante(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;

    const body = document.getElementById('dc-estudante-body');
    if (!body) return;

    const estudantes = client.estudantes || [];

    if (estudantes.length === 0) {
      body.innerHTML = '<p class="text-gray-500 italic text-sm">Nenhum estudante cadastrado.</p>';
    } else {
      body.innerHTML = estudantes.map((e, i) => `
        <div class="border border-gray-200 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <i class="fas fa-user-graduate text-blue-500 text-xs"></i>
            </div>
            <span class="font-semibold text-gray-800">${this._escapeHtml(e.nome || `Estudante ${i + 1}`)}</span>
          </div>
          <div class="space-y-1 text-xs text-gray-600 ml-10">
            <div><span class="font-medium">Série:</span> ${this._escapeHtml(e.serie || '—')}</div>
            ${e.atip ? `<div class="flex items-center gap-1"><span class="font-medium">ATIP:</span> <span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Sim</span></div>` : ''}
            ${e.laudoAtip ? `<div><span class="font-medium">Laudo ATIP:</span> ${this._escapeHtml(e.laudoAtip)}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    this.openModal('dc-modal-estudante');
  }

  openModalEditar(clientId) {
    const client = this.clients.find(c => c.id === clientId);
    if (!client) return;

    const formContainer = document.getElementById('dc-form-editar');
    if (!formContainer) return;

    formContainer.innerHTML = this.buildEditForm(client);
    formContainer.dataset.clientId = clientId;

    this._bindStudentBlockEvents(formContainer);
    this.setupEditFormMasks();

    // Botão Salvar
    const btnSalvar = formContainer.querySelector('#dc-btn-salvar-edicao');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveClientEdit());
    }

    // Botão Adicionar Estudante
    const btnAddStudent = formContainer.querySelector('#dc-btn-add-student');
    if (btnAddStudent) {
      btnAddStudent.addEventListener('click', () => this.addStudentField());
    }

    this.openModal('dc-modal-editar');
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // FORMULÁRIO DE EDIÇÃO
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  buildEditForm(client) {
    const estudantes = client.estudantes || [];

    return `
      <div class="space-y-4">
        <!-- Dados Pessoais -->
        <fieldset class="border border-gray-200 rounded-lg p-4">
          <legend class="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados Pessoais</legend>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
              <input
                type="text"
                name="nome"
                value="${this._escapeAttr(client.nome || '')}"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">CPF</label>
              <input
                type="text"
                name="cpf"
                id="dc-edit-cpf"
                value="${this._escapeAttr(client.cpf || '')}"
                maxlength="14"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                value="${this._escapeAttr(client.email || '')}"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
              <input
                type="text"
                name="telefone"
                id="dc-edit-telefone"
                value="${this._escapeAttr(client.telefone || '')}"
                maxlength="15"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
              <input
                type="text"
                name="whatsapp"
                id="dc-edit-whatsapp"
                value="${this._escapeAttr(client.whatsapp || '')}"
                maxlength="15"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
        </fieldset>

        <!-- Endereço -->
        <fieldset class="border border-gray-200 rounded-lg p-4">
          <legend class="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Endereço</legend>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
              <input
                type="text"
                name="endereco"
                value="${this._escapeAttr(client.endereco || '')}"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1">Endereço para Aulas</label>
              <input
                type="text"
                name="enderecoAulas"
                value="${this._escapeAttr(client.enderecoAulas || '')}"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">CEP</label>
              <input
                type="text"
                name="cep"
                id="dc-edit-cep"
                value="${this._escapeAttr(client.cep || '')}"
                maxlength="9"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Cidade / UF</label>
              <input
                type="text"
                name="cidadeUF"
                value="${this._escapeAttr(client.cidadeUF || '')}"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
        </fieldset>

        <!-- Contrato e Pagamento -->
        <fieldset class="border border-gray-200 rounded-lg p-4">
          <legend class="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contrato e Pagamento</legend>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Status do Contrato</label>
              <select
                name="statusContrato"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="" ${!client.statusContrato ? 'selected' : ''}>Selecione...</option>
                <option value="Pendente de assinatura" ${client.statusContrato === 'Pendente de assinatura' ? 'selected' : ''}>Pendente de assinatura</option>
                <option value="Contrato assinado" ${client.statusContrato === 'Contrato assinado' ? 'selected' : ''}>Contrato assinado</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Status de Pagamento</label>
              <select
                name="statusPagamento"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="" ${!client.statusPagamento ? 'selected' : ''}>Selecione...</option>
                <option value="Aguardando 1º Pagamento" ${client.statusPagamento === 'Aguardando 1º Pagamento' ? 'selected' : ''}>Aguardando 1º Pagamento</option>
                <option value="Aguardando 2º Pagamento" ${client.statusPagamento === 'Aguardando 2º Pagamento' ? 'selected' : ''}>Aguardando 2º Pagamento</option>
                <option value="Pagamento completo" ${client.statusPagamento === 'Pagamento completo' ? 'selected' : ''}>Pagamento completo</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Modo de Pagamento</label>
              <select
                name="modoPagamento"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="" ${!client.modoPagamento ? 'selected' : ''}>Selecione...</option>
                <option value="Cartão de crédito" ${client.modoPagamento === 'Cartão de crédito' ? 'selected' : ''}>Cartão de crédito</option>
                <option value="Pix completo" ${client.modoPagamento === 'Pix completo' ? 'selected' : ''}>Pix completo</option>
                <option value="Pix dividido" ${client.modoPagamento === 'Pix dividido' ? 'selected' : ''}>Pix dividido</option>
              </select>
            </div>
          </div>
        </fieldset>

        <!-- Estudantes -->
        <fieldset class="border border-gray-200 rounded-lg p-4">
          <legend class="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estudantes</legend>
          <div id="dc-students-list" class="space-y-3">
            ${estudantes.map((e, i) => this._buildStudentBlock(e, i)).join('')}
          </div>
          <button
            type="button"
            id="dc-btn-add-student"
            class="mt-3 px-4 py-2 text-xs font-medium rounded-lg border border-dashed border-orange-400 text-orange-500 hover:bg-orange-50 transition-colors w-full"
          >
            <i class="fas fa-plus mr-1"></i> Adicionar Estudante
          </button>
        </fieldset>

        <!-- Ações -->
        <div class="flex gap-3 justify-end pt-2">
          <button
            type="button"
            class="dc-close-modal px-5 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            data-modal="dc-modal-editar"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="dc-btn-salvar-edicao"
            class="px-5 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <i class="fas fa-save mr-1"></i> Salvar
          </button>
        </div>
      </div>
    `;
  }

  _buildStudentBlock(student, index) {
    const series = [
      '1º ano EF', '2º ano EF', '3º ano EF', '4º ano EF', '5º ano EF',
      '6º ano EF', '7º ano EF', '8º ano EF', '9º ano EF',
      '1º ano EM', '2º ano EM', '3º ano EM',
      'Pré-vestibular', 'Faculdade', 'Outro'
    ];

    const options = series
      .map(s => `<option value="${s}" ${student.serie === s ? 'selected' : ''}>${s}</option>`)
      .join('');

    const atipChecked = student.atip ? 'checked' : '';

    return `
      <div class="dc-student-block border border-gray-200 rounded-lg p-3 relative">
        <button
          type="button"
          class="dc-remove-student absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors text-xs"
          title="Remover estudante"
        >
          <i class="fas fa-trash"></i>
        </button>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Nome do Estudante</label>
            <input
              type="text"
              name="estudante_nome_${index}"
              value="${this._escapeAttr(student.nome || '')}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Série / Ano</label>
            <select
              name="estudante_serie_${index}"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="">Selecione...</option>
              ${options}
            </select>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <button
            type="button"
            class="dc-toggle-atip text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
          >
            <i class="fas fa-brain mr-1"></i> ATIP
          </button>
        </div>
        <div class="dc-atip-section ${student.atip ? '' : 'hidden'} mt-2 border-t border-gray-100 pt-2 space-y-2">
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              name="estudante_atip_${index}"
              id="dc-atip-${index}"
              ${atipChecked}
              class="rounded border-gray-300 text-purple-500 focus:ring-purple-300"
            />
            <label for="dc-atip-${index}" class="text-xs text-gray-600 font-medium">Estudante com ATIP</label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Laudo / Observações ATIP</label>
            <textarea
              name="estudante_laudoAtip_${index}"
              rows="2"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              placeholder="Descreva o laudo ou observações..."
            >${this._escapeHtml(student.laudoAtip || '')}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  addStudentField() {
    const list = document.getElementById('dc-students-list');
    if (!list) return;

    const index = list.querySelectorAll('.dc-student-block').length;
    const div = document.createElement('div');
    div.innerHTML = this._buildStudentBlock({}, index);
    const block = div.firstElementChild;
    list.appendChild(block);
    this._bindStudentBlockEvents(block);
  }

  removeStudentField(btn) {
    const block = btn.closest('.dc-student-block');
    if (block) block.remove();
  }

  // Vincula eventos exclusivamente dos blocos de estudante.
  // Esta é a única função que deve tratar .dc-remove-student e .dc-toggle-atip.
  _bindStudentBlockEvents(blockOrContainer) {
    blockOrContainer.querySelectorAll('.dc-remove-student').forEach(btn => {
      // Clone the button to remove any previously attached listeners (safe for newly created blocks)
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', () => this.removeStudentField(fresh));
    });

    blockOrContainer.querySelectorAll('.dc-toggle-atip').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', () => {
        const section = fresh.closest('.dc-student-block')?.querySelector('.dc-atip-section');
        if (section) section.classList.toggle('hidden');
      });
    });
  }

  // Aplica máscaras de input nos campos do formulário de edição.
  // NÃO vincula eventos de .dc-remove-student ou .dc-toggle-atip aqui.
  setupEditFormMasks() {
    const cpfInput = document.getElementById('dc-edit-cpf');
    if (cpfInput) {
      cpfInput.addEventListener('input', () => {
        let v = cpfInput.value.replace(/\D/g, '').substring(0, 11);
        if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        cpfInput.value = v;
      });
    }

    const telefoneInput = document.getElementById('dc-edit-telefone');
    if (telefoneInput) {
      telefoneInput.addEventListener('input', () => {
        let v = telefoneInput.value.replace(/\D/g, '').substring(0, 11);
        if (v.length > 6) v = v.replace(/(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
        else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        telefoneInput.value = v;
      });
    }

    const whatsappInput = document.getElementById('dc-edit-whatsapp');
    if (whatsappInput) {
      whatsappInput.addEventListener('input', () => {
        let v = whatsappInput.value.replace(/\D/g, '').substring(0, 11);
        if (v.length > 6) v = v.replace(/(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
        else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        whatsappInput.value = v;
      });
    }

    const cepInput = document.getElementById('dc-edit-cep');
    if (cepInput) {
      cepInput.addEventListener('input', () => {
        let v = cepInput.value.replace(/\D/g, '').substring(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d{1,3})/, '$1-$2');
        cepInput.value = v;
      });
    }
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // SALVAR / ATUALIZAR CLIENTE
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  saveClientEdit() {
    const formContainer = document.getElementById('dc-form-editar');
    if (!formContainer) return;

    const clientId = formContainer.dataset.clientId;
    if (!clientId) return;

    const getValue = name => formContainer.querySelector(`[name="${name}"]`)?.value?.trim() || '';

    const studentBlocks = formContainer.querySelectorAll('.dc-student-block');
    const estudantes = Array.from(studentBlocks).map((block, i) => {
      const nome = block.querySelector(`[name^="estudante_nome_"]`)?.value?.trim() || '';
      const serie = block.querySelector(`[name^="estudante_serie_"]`)?.value || '';
      const atip = block.querySelector(`[name^="estudante_atip_"]`)?.checked || false;
      const laudoAtip = block.querySelector(`[name^="estudante_laudoAtip_"]`)?.value?.trim() || '';
      return { nome, serie, atip, ...(laudoAtip ? { laudoAtip } : {}) };
    }).filter(e => e.nome);

    const data = {
      nome: getValue('nome'),
      cpf: getValue('cpf'),
      email: getValue('email'),
      telefone: getValue('telefone'),
      whatsapp: getValue('whatsapp'),
      endereco: getValue('endereco'),
      enderecoAulas: getValue('enderecoAulas'),
      cep: getValue('cep'),
      cidadeUF: getValue('cidadeUF'),
      statusContrato: getValue('statusContrato'),
      statusPagamento: getValue('statusPagamento'),
      modoPagamento: getValue('modoPagamento'),
      estudantes,
    };

    // Remover campos vazios para não sobrescrever com string vazia
    Object.keys(data).forEach(k => {
      if (data[k] === '' && k !== 'estudantes') delete data[k];
    });

    this.updateClient(clientId, data);
  }

  async updateClient(id, data) {
    const btnSalvar = document.getElementById('dc-btn-salvar-edicao');
    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Salvando...';
    }

    try {
      await db.collection('cadastroClientes').doc(id).update(data);

      // Atualizar a cópia local
      const idx = this.clients.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.clients[idx] = { ...this.clients[idx], ...data };
      }

      this.closeModal('dc-modal-editar');
      this.showToast('Cliente atualizado com sucesso!', 'success');

      // Preservar estado dos filtros: re-aplicar se filtros ativos, ou re-renderizar tudo
      if (this.filteredClients !== null) {
        this.applyLocalFilters();
      } else {
        this.renderCards();
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      this.showToast('Erro ao atualizar cliente. Tente novamente.', 'error');
    } finally {
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fas fa-save mr-1"></i> Salvar';
      }
    }
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // EXPORTAR CSV
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  downloadCSV() {
    const clients = this.filteredClients !== null ? this.filteredClients : this.clients;

    if (clients.length === 0) {
      this.showToast('Nenhum cliente para exportar.', 'info');
      return;
    }

    const headers = [
      'Nome', 'CPF', 'E-mail', 'Telefone', 'WhatsApp',
      'Endereço', 'Endereço para Aulas', 'CEP', 'Cidade/UF',
      'Código Contratação', 'Status Contrato', 'Status Pagamento',
      'Modo Pagamento', 'Valor Pacote', 'Valor Equipe', 'Lucro Master',
      'Estudantes (nomes)', 'Estudantes (séries)'
    ];

    const escape = v => {
      const s = String(v == null ? '' : v).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = clients.map(c => {
      const estudantes = c.estudantes || [];
      const nomes = estudantes.map(e => e.nome || '').join(' | ');
      const series = estudantes.map(e => e.serie || '').join(' | ');
      return [
        c.nome, c.cpf, c.email, c.telefone, c.whatsapp,
        c.endereco, c.enderecoAulas, c.cep, c.cidadeUF,
        c.codigoContratacao, c.statusContrato, c.statusPagamento,
        c.modoPagamento, c.ValorPacote, c.ValorEquipe, c.lucroMaster,
        nomes, series
      ].map(escape);
    });

    const bom = '\uFEFF'; // BOM para suporte a caracteres especiais no Excel
    const csv = bom + [headers.map(escape), ...rows].map(r => r.join(',')).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`${clients.length} cliente(s) exportado(s) com sucesso.`, 'success');
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // TOAST
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      warning: 'bg-yellow-500',
    };

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      info: 'fa-info-circle',
      warning: 'fa-exclamation-circle',
    };

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${colors[type] || colors.info} transform translate-y-2 opacity-0 transition-all duration-300`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this._escapeHtml(msg)}</span>`;

    container.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Remover após 3 segundos
    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  // UTILITÁRIOS
  // ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  _escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _escapeAttr(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

}

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// INICIALIZAÇÃO GLOBAL
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

document.addEventListener('DOMContentLoaded', () => {
  window.dashboardCliente = new DashboardCliente();
});

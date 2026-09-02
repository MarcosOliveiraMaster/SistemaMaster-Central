// ============================================================
// functions-dashboardCliente.js
// Dashboard de Clientes — Firebase/Firestore
// ============================================================

class DashboardCliente {
  constructor() {
    // Firebase
    this.firebaseApp = null;
    this.firestore = null;
    this.unsubscribe = null;

    // Dados
    this.clients = [];
    this.filteredClients = null;
    this.activeFilters = {};

    // Estado
    this.selectedClientId = null;
    this.isLoading = false;

    // Permissões (sem login — acesso total)
    this.userPermissions = { edit: true, backup: true };

    // Filtros de status ativos (multi-select modal) — padrão: somente Ativos
    this._activeStatusFilters = ['Ativo'];

    // Debounce timers
    this._searchTimer = null;
    this._cidadeTimer = null;

    // Campos obrigatórios para validação
    this.requiredFields = [
      { name: 'nome', label: 'Nome' },
      { name: 'cpf', label: 'CPF' },
      { name: 'email', label: 'Email' },
      { name: 'contato', label: 'Contato' }
    ];

    this.init();
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  async init() {
    // Configura UI e eventos IMEDIATAMENTE (antes do Firebase)
    this.setupUI();
    this.setupEventListeners();

    try {
      await this.initializeFirebase();
      await this.loadClients();
      this.setupRealTimeUpdates();
    } catch (err) {
      console.warn('[DashboardCliente] Firebase indisponível, usando dados de exemplo.', err);
      this.loadSampleData();
    }
  }

  async initializeFirebase() {
    // Reutiliza instância global
    this.firebaseApp = firebase.apps[0];
    this.firestore   = this.firebaseApp.firestore();
  }

  async loadClients() {
    this._showLoading(true);

    try {
      const snap = await this.firestore
        .collection('cadastroClientes')
        .orderBy('dataCadastro', 'desc')
        .get();

      this.clients = snap.docs.map(doc => {
        const d = doc.data();
        const estudantes = Array.isArray(d.estudantes) ? d.estudantes : [];
        return {
          id: doc.id,
          ...d,
          estudantes,
          quantidadeEstudantes: estudantes.length,
          status: this._normalizeStatus(d.status) || 'Potencial',
          dataCadastroLegivel: d.dataCadastroLegivel || '—'
        };
      });

      this.filteredClients = null;
      this.applyLocalFilters();
    } catch (err) {
      console.error('[DashboardCliente] Erro ao carregar clientes:', err);
      this.showToast('Erro ao carregar clientes', 'error');
    } finally {
      this._showLoading(false);
    }
  }

  setupRealTimeUpdates() {
    if (!this.firestore) return;
    if (this.unsubscribe) this.unsubscribe();

    this.unsubscribe = this.firestore
      .collection('cadastroClientes')
      .onSnapshot(
        () => this.loadClients().catch(console.error),
        err => console.error('[DashboardCliente] Erro no listener:', err)
      );
  }

  loadSampleData() {
    this.clients = [
      {
        id: 'sample-001',
        nome: 'Ana Paula Silva',
        cpf: '12345678901',
        email: 'ana@email.com',
        contato: '11987654321',
        cep: '01310100',
        endereco: 'Av. Paulista, 1000',
        cidadeUF: 'São Paulo / SP',
        complemento: 'Apto 42',
        linkEndereco1: '',
        linkEndereco2: '',
        status: 'Ativo',
        dataCadastroLegivel: '01/03/2026',
        mesmoEndereco: true,
        estudantes: [
          {
            nome: 'Lucas Silva',
            escola: 'Colégio Master',
            serie: '5º Ano',
            aniversario: '10/05/2015',
            atendimentoEspecializado: false,
            atipicidade: '',
            LinkLaudo: ''
          }
        ],
        quantidadeEstudantes: 1
      },
      {
        id: 'sample-002',
        nome: 'Carlos Eduardo Mendes',
        cpf: '98765432100',
        email: 'carlos@email.com',
        contato: '21912345678',
        cep: '20040020',
        endereco: 'Rua da Assembléia, 200',
        cidadeUF: 'Rio de Janeiro / RJ',
        complemento: '',
        linkEndereco1: '',
        linkEndereco2: '',
        status: 'Potencial',
        dataCadastroLegivel: '15/02/2026',
        mesmoEndereco: false,
        enderecoAulas: 'Rua das Flores, 50',
        cepAulas: '20040030',
        cidadeUFAulas: 'Rio de Janeiro / RJ',
        estudantes: [],
        quantidadeEstudantes: 0
      }
    ];

    this.filteredClients = null;
    this._updateCount();
    this.renderCards();
    this._showLoading(false);
  }

  // ============================================================
  // UTILITÁRIOS
  // ============================================================

  getClientData(id) {
    const list = this.filteredClients ?? this.clients;
    return list.find(c => c.id === id) || this.clients.find(c => c.id === id) || null;
  }

  escapeHTML(str) {
    if (str === null || str === undefined || str === '') return '—';
    if (str === 0) return '0';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  // Versão para inputs (retorna string vazia em vez de "—")
  escapeHTMLForInput(str) {
    if (str === null || str === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  formatCPF(cpf) {
    if (!cpf) return '—';
    const c = String(cpf).replace(/\D/g, '');
    if (c.length !== 11) return cpf;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }

  formatCPFForInput(cpf) {
    if (!cpf) return '';
    const c = String(cpf).replace(/\D/g, '');
    if (c.length !== 11) return cpf;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }

  formatPhone(phone) {
    if (!phone) return '—';
    const p = String(phone).replace(/\D/g, '');
    if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
    if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
    return phone;
  }

  formatPhoneForInput(phone) {
    if (!phone) return '';
    const p = String(phone).replace(/\D/g, '');
    if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
    if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
    return phone;
  }

  formatCEP(cep) {
    if (!cep) return '—';
    const c = String(cep).replace(/\D/g, '');
    if (c.length !== 8) return cep;
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  }

  formatCEPForInput(cep) {
    if (!cep) return '';
    const c = String(cep).replace(/\D/g, '');
    if (c.length !== 8) return cep;
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  }

  _renderAddressLink(url) {
    if (!url) return '—';
    return `<a href="${this.escapeHTML(url)}" target="_blank" rel="noopener" class="dc-link">
      <i class="fas fa-map-location-dot"></i> Abrir link
    </a>`;
  }

  // Validação de CPF
  isValidCPF(cpf) {
    const c = String(cpf).replace(/\D/g, '');
    if (c.length !== 11) return false;
    if (/^(\d)\1+$/.test(c)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(c[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(c[10]);
  }

  // Validação de Email
  isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Validação de Telefone
  isValidPhone(phone) {
    const p = String(phone).replace(/\D/g, '');
    return p.length >= 10 && p.length <= 11;
  }

  _normalizeStatus(raw) {
    const map = {
      'cliente ativo': 'Ativo',   'ativo': 'Ativo',
      'cliente potencial': 'Potencial', 'potencial': 'Potencial',
      'cliente inativo': 'Inativo',  'inativo': 'Inativo'
    };
    return map[(raw || '').toLowerCase().trim()] || raw || '';
  }

  // ============================================================
  // HELPERS PRIVADOS
  // ============================================================

  _showLoading(show) {
    const loading = document.getElementById('dc-loading');
    const grid = document.getElementById('dc-cards-grid');
    const empty = document.getElementById('dc-empty');
    if (!loading) return;
    loading.style.display = show ? 'flex' : 'none';
    if (show) {
      if (grid) grid.style.display = 'none';
      if (empty) empty.style.display = 'none';
    }
  }

  _updateCount() {
    const el = document.getElementById('dc-client-count');
    if (!el) return;
    const list = this.filteredClients ?? this.clients;
    const total = this.clients.length;
    const shown = list.length;
    el.textContent = shown === total
      ? `${total} cliente${total !== 1 ? 's' : ''}`
      : `${shown} de ${total} cliente${total !== 1 ? 's' : ''}`;
  }

  // Gerencia estado de loading em botões
  _setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btn.disabled = true;
      btn.classList.add('dc-btn-loading');
    } else {
      btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
      btn.disabled = false;
      btn.classList.remove('dc-btn-loading');
    }
  }

  // ============================================================
  // UI E EVENT LISTENERS
  // ============================================================

  setupUI() {
    this._injectACStyles();
    const btnCSV = document.getElementById('dc-btn-csv');
    const btnEditar = document.getElementById('dc-detalhe-btn-editar');
    if (btnCSV) btnCSV.style.display = this.userPermissions.backup ? 'inline-flex' : 'none';
    if (btnEditar) btnEditar.style.display = this.userPermissions.edit ? 'inline-flex' : 'none';
  }

  setupEventListeners() {
    // Filtros
    const search = document.getElementById('dc-search');
    const status = document.getElementById('dc-filter-status');
    const cidade = document.getElementById('dc-filter-cidade');
    const clear = document.getElementById('dc-btn-clear-filters');
    const refresh = document.getElementById('dc-btn-refresh');
    const csv = document.getElementById('dc-btn-csv');

    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.applyLocalFilters(), 300);
      });
    }
    if (status) status.addEventListener('change', () => this.applyLocalFilters());
    if (cidade) {
      cidade.addEventListener('input', () => {
        clearTimeout(this._cidadeTimer);
        this._cidadeTimer = setTimeout(() => this.applyLocalFilters(), 300);
      });
    }
    if (clear) clear.addEventListener('click', () => this.clearAllFilters());
    if (refresh) refresh.addEventListener('click', () => this.loadClients().catch(console.error));
    if (csv) csv.addEventListener('click', () => this.downloadCSV());

    // Botão de filtro por status (modal multi-select)
    const btnPotencial = document.getElementById('dc-btn-potencial');
    if (btnPotencial) {
      btnPotencial.addEventListener('click', () => this.openFilterModal());
    }

    // Botão de configurações
    const btnConfig = document.getElementById('dc-configuracao');
    if (btnConfig) {
      btnConfig.addEventListener('click', () => this.openConfigModal());
    }

    // Botões do modal detalhes
    const btnNF = document.getElementById('dc-detalhe-btn-nf');
    const btnAula = document.getElementById('dc-detalhe-btn-aula');
    const btnEstudante = document.getElementById('dc-detalhe-btn-estudante');
    const btnEditar = document.getElementById('dc-detalhe-btn-editar');

    if (btnNF) btnNF.addEventListener('click', () => this.openModalNF(this.selectedClientId));
    if (btnAula) btnAula.addEventListener('click', () => this.openModalAula(this.selectedClientId));
    if (btnEstudante) btnEstudante.addEventListener('click', () => this.openModalEstudante(this.selectedClientId));
    if (btnEditar) btnEditar.addEventListener('click', () => this.openModalEditar(this.selectedClientId));

    // Fechar modais — botões com data-modal
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
    });

    // Fechar modal ao clicar no overlay
    ['dc-modal-detalhes', 'dc-modal-nf', 'dc-modal-aula', 'dc-modal-estudante', 'dc-modal-editar', 'dc-modal-confirm']
      .forEach(id => {
        const overlay = document.getElementById(id);
        if (overlay) {
          overlay.addEventListener('click', e => {
            if (e.target === overlay) this.closeModal(id);
          });
        }
      });

    // Fechar com ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['dc-modal-confirm', 'dc-modal-editar', 'dc-modal-estudante', 'dc-modal-aula', 'dc-modal-nf', 'dc-modal-detalhes']
          .forEach(id => this.closeModal(id));
        ['dc-overlayFilter', 'dc-overlayStatus', 'dc-overlayConfig', 'dc-overlayPerm', 'dc-overlayPermConfirm']
          .forEach(id => document.getElementById(id)?.remove());
        this.closeContextMenu();
      }
    });
  }

  // ============================================================
  // FILTROS
  // ============================================================

  applyLocalFilters() {
    const rawSearch = (document.getElementById('dc-search')?.value || '').toLowerCase();
    const statusVal = document.getElementById('dc-filter-status')?.value || '';
    const cidadeVal = (document.getElementById('dc-filter-cidade')?.value || '').toLowerCase();

    this.filteredClients = this.clients.filter(c => {
      const nomeOk = !rawSearch || (c.nome || '').toLowerCase().includes(rawSearch);
      let statusOk;
      if (this._activeStatusFilters.length > 0) {
        statusOk = this._activeStatusFilters.includes(c.status);
      } else {
        statusOk = !statusVal || c.status === statusVal;
      }
      const cidadeOk = !cidadeVal || (c.cidadeUF || '').toLowerCase().includes(cidadeVal);
      return nomeOk && statusOk && cidadeOk;
    });

    this._updateCount();
    this.renderCards();
  }

  clearAllFilters() {
    const s = document.getElementById('dc-search');
    const f = document.getElementById('dc-filter-status');
    const c = document.getElementById('dc-filter-cidade');
    const btnPotencial = document.getElementById('dc-btn-potencial');
    if (s) s.value = '';
    if (f) f.value = '';
    if (c) c.value = '';
    if (btnPotencial) btnPotencial.classList.remove('dc-btn-active');
    this.filteredClients = null;
    this.activeFilters = {};
    this._activeStatusFilters = [];
    this._updateCount();
    this.renderCards();
  }

  openFilterModal() {
    document.getElementById('dc-overlayFilter')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dc-overlayFilter';
    overlay.className = 'ap-overlay';

    const pillHtml = (status, label) => {
      const active = this._activeStatusFilters.includes(status);
      return `<button class="dc-filter-pill${active ? ' dc-filter-pill--active' : ''}" data-status="${status}">${label}</button>`;
    };

    overlay.innerHTML = `
      <div class="ap-modal ap-modal-sm" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2><i class="fas fa-filter" style="color:#f28705"></i> Filtrar Clientes</h2>
          <button class="ap-modal-close" id="dc-filterClose" aria-label="Fechar">&times;</button>
        </div>
        <div class="ap-modal-body">
          <p style="font-size:.82rem;color:#6b7280;margin-bottom:1rem">
            Selecione um ou mais status para filtrar:
          </p>
          <div class="dc-filter-pills">
            ${pillHtml('Ativo', 'Ativo')}
            ${pillHtml('Potencial', 'Potencial')}
            ${pillHtml('Inativo', 'Inativo')}
          </div>
        </div>
        <div class="ap-modal-footer">
          <button class="ap-btn ap-btn--ghost" id="dc-filterLimpar">Limpar Filtro</button>
          <button class="ap-btn ap-btn--primary" id="dc-filterAplicar">
            <i class="fas fa-check"></i> Aplicar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('.dc-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('dc-filter-pill--active'));
    });

    const fechar = () => overlay.remove();
    document.getElementById('dc-filterClose').addEventListener('click', fechar);
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

    document.getElementById('dc-filterLimpar').addEventListener('click', () => {
      this._activeStatusFilters = [];
      document.getElementById('dc-btn-potencial')?.classList.remove('dc-btn-active');
      this.applyLocalFilters();
      fechar();
    });

    document.getElementById('dc-filterAplicar').addEventListener('click', () => {
      const selected = [...overlay.querySelectorAll('.dc-filter-pill--active')].map(b => b.dataset.status);
      this._activeStatusFilters = selected;
      const btn = document.getElementById('dc-btn-potencial');
      btn?.classList.toggle('dc-btn-active', selected.length > 0);
      const statusSelect = document.getElementById('dc-filter-status');
      if (statusSelect) statusSelect.value = '';
      this.applyLocalFilters();
      fechar();
    });
  }

  // ============================================================
  // RENDERIZAÇÃO DE TABELA
  // ============================================================

  renderCards() {
    const tbody = document.getElementById('dc-table-body');
    const table = document.getElementById('dc-clients-table');
    const empty = document.getElementById('dc-empty');
    if (!tbody) return;

    const list = this.filteredClients ?? this.clients;

    if (list.length === 0) {
      if (table) table.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';
    if (table) table.style.display = 'table';
    tbody.innerHTML = list.map(c => this.buildTableRow(c)).join('');

    // Eventos dos botões na tabela
    this.bindTableRowEvents(tbody);
  }

  buildTableRow(client) {
    const badgeMap = {
      'Potencial': 'dc-badge-potencial',
      'Ativo': 'dc-badge-ativo',
      'Inativo': 'dc-badge-inativo'
    };
    const badgeClass = badgeMap[client.status] || 'dc-badge-potencial';
    const qtdEstudantes = client.quantidadeEstudantes || 0;

    return `
      <tr class="dc-table-row" data-client-id="${client.id}">
        <td class="dc-td-client">
          <div class="dc-client-info">
            <div class="dc-client-avatar"><i class="fas fa-user"></i></div>
            <div class="dc-client-data">
              <span class="dc-client-name">${this.escapeHTML(client.nome)}</span>
              <span class="dc-client-meta">
                <span class="dc-badge dc-badge-sm ${badgeClass}">${this.escapeHTML(client.status)}</span>
                <span class="dc-client-city"><i class="fas fa-location-dot"></i> ${this.escapeHTML(client.cidadeUF)}</span>
              </span>
            </div>
          </div>
        </td>
        <td class="dc-td-action">
          <button class="dc-action-btn dc-action-detalhes" data-action="detalhes" data-client-id="${client.id}" title="Ver detalhes">
            <i class="fas fa-circle-info"></i>
          </button>
        </td>
        <td class="dc-td-action">
          <button class="dc-action-btn dc-action-nf" data-action="nf" data-client-id="${client.id}" title="Dados de NF">
            <i class="fas fa-file-invoice"></i>
          </button>
        </td>
        <td class="dc-td-action">
          <button class="dc-action-btn dc-action-aula" data-action="aula" data-client-id="${client.id}" title="Local da aula">
            <i class="fas fa-map-location-dot"></i>
          </button>
        </td>
        <td class="dc-td-action">
          <button class="dc-action-btn dc-action-estudantes" data-action="estudantes" data-client-id="${client.id}" title="${qtdEstudantes} estudante(s)">
            <i class="fas fa-user-graduate"></i>
            <span class="dc-action-badge">${qtdEstudantes}</span>
          </button>
        </td>
        <td class="dc-td-action">
          <button class="dc-action-btn dc-action-editar" data-action="editar" data-client-id="${client.id}" title="Editar cliente">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>`;
  }

  bindTableRowEvents(tbody) {
    tbody.querySelectorAll('.dc-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const clientId = btn.dataset.clientId;
        
        switch(action) {
          case 'detalhes':
            this.openModalDetalhes(clientId);
            break;
          case 'nf':
            this.selectedClientId = clientId;
            this.openModalNF(clientId);
            break;
          case 'aula':
            this.selectedClientId = clientId;
            this.openModalAula(clientId);
            break;
          case 'estudantes':
            this.selectedClientId = clientId;
            this.openModalEstudante(clientId);
            break;
          case 'editar':
            this.selectedClientId = clientId;
            this.openModalEditar(clientId);
            break;
        }
      });
    });

    // Click na linha abre modal de detalhes
    tbody.querySelectorAll('.dc-table-row').forEach(row => {
      row.addEventListener('click', () => {
        const clientId = row.dataset.clientId;
        this.openModalDetalhes(clientId);
      });
    });

    // Botão direito abre menu de contexto
    tbody.querySelectorAll('.dc-table-row').forEach(row => {
      row.addEventListener('contextmenu', e => {
        this.openContextMenu(e, row.dataset.clientId);
      });
    });
  }

  // ============================================================
  // MODAIS — ABERTURA/FECHAMENTO
  // ============================================================

  openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.style.display = 'none';
      // Restaura scroll apenas se não houver outros modais abertos
      const modalsOpen = document.querySelectorAll('[id^="dc-modal-"][style*="display: flex"]');
      if (modalsOpen.length === 0) {
        document.body.style.overflow = '';
      }
    }
  }

  // ============================================================
  // MODAL DE CONFIRMAÇÃO
  // ============================================================

  showConfirmModal(options) {
    return new Promise((resolve) => {
      const {
        title = 'Confirmação',
        message = 'Deseja continuar?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        type = 'warning' // warning, danger, info
      } = options;

      // Criar modal se não existir
      let modal = document.getElementById('dc-modal-confirm');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dc-modal-confirm';
        modal.className = 'dc-modal-overlay';
        document.body.appendChild(modal);
      }

      const iconMap = {
        warning: 'fa-triangle-exclamation',
        danger: 'fa-trash-can',
        info: 'fa-circle-info'
      };

      const colorMap = {
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6'
      };

      modal.innerHTML = `
        <div class="dc-modal dc-modal-sm">
          <div class="dc-modal-header">
            <h2><i class="fas ${iconMap[type]}" style="color: ${colorMap[type]}"></i> ${this.escapeHTML(title)}</h2>
            <button class="dc-modal-close" data-action="cancel">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="dc-modal-body" style="padding: 24px; text-align: center;">
            <p style="margin: 0; font-size: 15px; color: #4b5563;">${this.escapeHTML(message)}</p>
          </div>
          <div class="dc-modal-footer" style="justify-content: center; gap: 12px;">
            <button class="dc-btn dc-btn-ghost" data-action="cancel">${cancelText}</button>
            <button class="dc-btn ${type === 'danger' ? 'dc-btn-danger' : 'dc-btn-primary'}" data-action="confirm">
              ${confirmText}
            </button>
          </div>
        </div>`;

      const handleAction = (confirmed) => {
        this.closeModal('dc-modal-confirm');
        resolve(confirmed);
      };

      modal.querySelectorAll('[data-action="cancel"]').forEach(btn => {
        btn.onclick = () => handleAction(false);
      });
      modal.querySelector('[data-action="confirm"]').onclick = () => handleAction(true);

      this.openModal('dc-modal-confirm');
    });
  }

  // ============================================================
  // MODAL DE DETALHES
  // ============================================================

  openModalDetalhes(clientId) {
    const client = this.getClientData(clientId);
    if (!client) return;
    this.selectedClientId = clientId;

    document.getElementById('dc-modal-detalhes-body').innerHTML = `
      <div class="dc-info-grid">
        <div class="dc-info-section"><h4><i class="fas fa-user"></i> Dados Pessoais</h4></div>
        <div class="dc-info-item"><label>Nome</label><span>${this.escapeHTML(client.nome)}</span></div>
        <div class="dc-info-item"><label>Apelido</label><span>${this.escapeHTML(client.apelido || '')}</span></div>
        <div class="dc-info-item"><label>CPF</label><span>${this.formatCPF(client.cpf)}</span></div>
        <div class="dc-info-item"><label>Email</label><span>${this.escapeHTML(client.email)}</span></div>
        <div class="dc-info-item"><label>Contato</label><span>${this.formatPhone(client.contato)}</span></div>
        <div class="dc-info-item"><label>Data de Nascimento</label><span>${this.escapeHTML(client.dataNascimento || '')}</span></div>

        <div class="dc-info-section"><h4><i class="fas fa-house"></i> Endereço</h4></div>
        <div class="dc-info-item"><label>CEP</label><span>${this.formatCEP(client.cep)}</span></div>
        <div class="dc-info-item"><label>Endereço</label><span>${this.escapeHTML(client.endereco)}</span></div>
        <div class="dc-info-item"><label>Cidade / UF</label><span>${this.escapeHTML(client.cidadeUF)}</span></div>
        <div class="dc-info-item"><label>Complemento</label><span>${this.escapeHTML(client.complemento)}</span></div>
        <div class="dc-info-item"><label>Link de Endereço 01</label><span>${this._renderAddressLink(client.linkEndereco1)}</span></div>
        <div class="dc-info-item"><label>Link de Endereço 02</label><span>${this._renderAddressLink(client.linkEndereco2)}</span></div>

        <div class="dc-info-section"><h4><i class="fas fa-chart-bar"></i> Situação</h4></div>
        <div class="dc-info-item"><label>Status</label><span>${this.escapeHTML(client.status)}</span></div>
        <div class="dc-info-item"><label>Cadastro</label><span>${this.escapeHTML(client.dataCadastroLegivel)}</span></div>
        <div class="dc-info-item"><label>Estudantes</label><span>${client.quantidadeEstudantes}</span></div>
      </div>`;

    this.openModal('dc-modal-detalhes');
  }

  // ============================================================
  // MODAL DE NF
  // ============================================================

  openModalNF(clientId) {
    const c = this.getClientData(clientId);
    if (!c) return;

    const nfNome = c.confirmaNF ? (c.nfNome || c.nome) : c.nome;
    const nfCpf = c.confirmaNF ? (c.nfCpf || c.cpf) : c.cpf;
    const nfEndereco = c.confirmaNF ? (c.nfEndereco || c.endereco) : c.endereco;
    const nfEmail = c.confirmaNF ? (c.nfEmail || c.email) : c.email;
    const nfCep = c.cep || '';

    document.getElementById('dc-modal-nf-body').innerHTML = `
      <div class="dc-info-grid">
        <div class="dc-info-item"><label>Nome para NF</label><span>${this.escapeHTML(nfNome)}</span></div>
        <div class="dc-info-item"><label>CPF para NF</label><span>${this.formatCPF(nfCpf)}</span></div>
        <div class="dc-info-item"><label>Endereço</label><span>${this.escapeHTML(nfEndereco)}</span></div>
        <div class="dc-info-item"><label>CEP</label><span>${this.formatCEP(nfCep)}</span></div>
        <div class="dc-info-item"><label>Email</label><span>${this.escapeHTML(nfEmail)}</span></div>
      </div>
      <div class="dc-nf-actions">
        <button id="dc-btn-copy-nf" class="dc-btn dc-btn-secondary">
          <i class="fas fa-copy"></i> Mensagem Nota Fiscal
        </button>
      </div>`;

    // Evento do botão copiar
    document.getElementById('dc-btn-copy-nf')?.addEventListener('click', () => {
      this.copyNFMessage(nfNome, nfEndereco, nfCep, nfCpf, nfEmail);
    });

    this.closeModal('dc-modal-detalhes');
    this.openModal('dc-modal-nf');
  }

  copyNFMessage(nome, endereco, cep, cpf, email) {
    const mensagem = `Nota Fiscal
Nome: ${nome || '—'}
Endereço: ${endereco || '—'} - CEP: ${this.formatCEP(cep)}
CPF: ${this.formatCPF(cpf)}
Email: ${email || '—'}
Valor: 

Descritivo
A presente nota fiscal refere-se aos serviços contratados de aulas particulares ministradas por profissionais qualificados integrantes da rede de professores da Master Educação. As aulas têm como objetivo oferecer um ensino personalizado, adequado às necessidades e objetivos individuais do aluno, proporcionando um ambiente propício ao aprendizado.`;

    navigator.clipboard.writeText(mensagem)
      .then(() => this.showToast('Mensagem copiada!', 'success'))
      .catch(() => this.showToast('Erro ao copiar', 'error'));
  }

  // ============================================================
  // MODAL DE AULA
  // ============================================================

  openModalAula(clientId) {
    const c = this.getClientData(clientId);
    if (!c) return;

    const end = c.mesmoEndereco ? (c.endereco || '—') : (c.enderecoAulas || '—');
    const cep = c.mesmoEndereco ? (c.cep || '') : (c.cepAulas || '');
    const cid = c.mesmoEndereco ? (c.cidadeUF || '—') : (c.cidadeUFAulas || '—');
    const comp = c.mesmoEndereco ? (c.complemento || '') : (c.complementoAulas || '');

    const mapsQuery = encodeURIComponent(`${end}, ${cid}`);
    const mapsURL = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    document.getElementById('dc-modal-aula-body').innerHTML = `
      <div class="dc-info-grid">
        <div class="dc-info-item"><label>Endereço</label><span>${this.escapeHTML(end)}</span></div>
        <div class="dc-info-item"><label>CEP</label><span>${this.formatCEP(cep)}</span></div>
        <div class="dc-info-item"><label>Cidade / UF</label><span>${this.escapeHTML(cid)}</span></div>
        <div class="dc-info-item"><label>Complemento</label><span>${this.escapeHTML(comp)}</span></div>
        <div class="dc-info-item" style="grid-column:1/-1">
          <label>Google Maps</label>
          <span><a href="${mapsURL}" target="_blank" rel="noopener" class="dc-link">
            <i class="fas fa-map-location-dot"></i> Abrir no Maps
          </a></span>
        </div>
      </div>`;

    this.closeModal('dc-modal-detalhes');
    this.openModal('dc-modal-aula');
  }

  // ============================================================
  // MODAL DE ESTUDANTES
  // ============================================================

  openModalEstudante(clientId) {
    const c = this.getClientData(clientId);
    if (!c) return;

    const estudantes = c.estudantes || [];
    let bodyHTML = '';

    if (estudantes.length === 0) {
      bodyHTML = `<div class="dc-empty-state" style="padding:30px 0">
        <i class="fas fa-user-graduate"></i>
        <p>Nenhum estudante cadastrado.</p>
      </div>`;
    } else {
      const rows = estudantes.map((e, i) => {
        const laudoBtn = e.LinkLaudo
          ? `<a href="${this.escapeHTML(e.LinkLaudo)}" target="_blank" rel="noopener" class="dc-btn dc-btn-sm dc-btn-secondary">
               <i class="fas fa-file-medical"></i> Ver
             </a>`
          : '—';
        const atip = e.atendimentoEspecializado
          ? `<span class="dc-badge dc-badge-potencial">${this.escapeHTML(e.atipicidade) || 'Sim'}</span>`
          : 'Não';
        return `<tr>
          <td>${i + 1}</td>
          <td>${this.escapeHTML(e.nome)}</td>
          <td>${this.escapeHTML(e.escola)}</td>
          <td>${this.escapeHTML(e.serie)}</td>
          <td>${this.escapeHTML(e.aniversario)}</td>
          <td>${atip}</td>
          <td>${laudoBtn}</td>
        </tr>`;
      }).join('');

      bodyHTML = `<div class="dc-table-wrapper">
        <table class="dc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Escola</th>
              <th>Série</th>
              <th>Aniversário</th>
              <th>Atipicidade</th>
              <th>Laudo</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    document.getElementById('dc-modal-estudante-body').innerHTML = bodyHTML;
    this.closeModal('dc-modal-detalhes');
    this.openModal('dc-modal-estudante');
  }

  // ============================================================
  // MODAL DE EDIÇÃO
  // ============================================================

  openModalEditar(clientId) {
    const client = this.getClientData(clientId);
    if (!client) return;

    document.getElementById('dc-modal-editar-body').innerHTML = this.buildEditForm(client);
    document.getElementById('dc-modal-editar-footer').innerHTML = `
      <button class="dc-btn dc-btn-ghost" data-modal="dc-modal-editar">Cancelar</button>
      <button class="dc-btn dc-btn-primary" id="dc-btn-save-edit">
        <i class="fas fa-floppy-disk"></i> Salvar Alterações
      </button>`;

    this.setupEditFormMasks();

    document.getElementById('dc-btn-save-edit')
      .addEventListener('click', () => this.handleSaveEdit(clientId));

    // Toggle mesmo endereço
    const chkMesmo = document.getElementById('dc-edit-mesmoEndereco');
    const secAulas = document.getElementById('dc-edit-sec-aulas');
    if (chkMesmo && secAulas) {
      const toggle = () => { secAulas.style.display = chkMesmo.checked ? 'none' : 'block'; };
      toggle();
      chkMesmo.addEventListener('change', toggle);
    }

    // Toggle NF
    const chkNF = document.getElementById('dc-edit-confirmaNF');
    const secNF = document.getElementById('dc-edit-sec-nf');
    if (chkNF && secNF) {
      const toggleNF = () => { secNF.style.display = chkNF.checked ? 'block' : 'none'; };
      toggleNF();
      chkNF.addEventListener('change', toggleNF);
    }

    // Botão adicionar estudante
    document.getElementById('dc-edit-btn-add-student')
      ?.addEventListener('click', () => {
        const cont = document.getElementById('dc-edit-students-container');
        this.addStudentField(cont, null);
      });

    this.closeModal('dc-modal-detalhes');
    this.openModal('dc-modal-editar');
  }

  buildEditForm(client) {
    const c = client;

    const studentsHTML = (c.estudantes || []).map((e, i) =>
      this._buildStudentBlock(e, i)
    ).join('');

    return `
    <form id="dc-edit-form" class="dc-edit-form" novalidate>
      <!-- Dados Pessoais -->
      <div class="dc-form-section">
        <h3><i class="fas fa-user"></i> Dados Pessoais</h3>
        <div class="dc-form-row">
          <div class="dc-form-group">
            <label class="dc-form-label">Nome <span class="dc-required">*</span></label>
            <input class="dc-form-input" name="nome" value="${this.escapeHTMLForInput(c.nome || '')}" required>
            <span class="dc-field-error" data-field="nome"></span>
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Apelido</label>
            <input class="dc-form-input" name="apelido" value="${this.escapeHTMLForInput(c.apelido || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">CPF <span class="dc-required">*</span></label>
            <input class="dc-form-input dc-mask-cpf" name="cpf" value="${this.formatCPFForInput(c.cpf || '')}">
            <span class="dc-field-error" data-field="cpf"></span>
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Email <span class="dc-required">*</span></label>
            <input class="dc-form-input" name="email" type="email" value="${this.escapeHTMLForInput(c.email || '')}">
            <span class="dc-field-error" data-field="email"></span>
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Contato <span class="dc-required">*</span></label>
            <input class="dc-form-input dc-mask-phone" name="contato" value="${this.formatPhoneForInput(c.contato || '')}">
            <span class="dc-field-error" data-field="contato"></span>
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Data de Nascimento</label>
            <input class="dc-form-input dc-mask-date" name="dataNascimento" value="${this.escapeHTMLForInput(c.dataNascimento || '')}" placeholder="DD/MM/AAAA">
          </div>
        </div>
      </div>

      <!-- Endereço do Contratante -->
      <div class="dc-form-section">
        <h3><i class="fas fa-house"></i> Endereço do Contratante</h3>
        <div class="dc-form-row">
          <div class="dc-form-group">
            <label class="dc-form-label">CEP</label>
            <input class="dc-form-input dc-mask-cep" name="cep" value="${this.formatCEPForInput(c.cep || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Endereço</label>
            <input class="dc-form-input" name="endereco" value="${this.escapeHTMLForInput(c.endereco || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Cidade / UF</label>
            <input class="dc-form-input" name="cidadeUF" value="${this.escapeHTMLForInput(c.cidadeUF || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Complemento</label>
            <input class="dc-form-input" name="complemento" value="${this.escapeHTMLForInput(c.complemento || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Link de Endereço 01</label>
            <input class="dc-form-input" name="linkEndereco1" value="${this.escapeHTMLForInput(c.linkEndereco1 || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Link de Endereço 02</label>
            <input class="dc-form-input" name="linkEndereco2" value="${this.escapeHTMLForInput(c.linkEndereco2 || '')}">
          </div>
        </div>
        <label class="dc-checkbox-label" style="margin-top:10px">
          <input type="checkbox" id="dc-edit-mesmoEndereco" name="mesmoEndereco" ${c.mesmoEndereco ? 'checked' : ''}>
          Endereço das aulas é o mesmo
        </label>
      </div>

      <!-- Endereço das Aulas -->
      <div class="dc-form-section" id="dc-edit-sec-aulas">
        <h3><i class="fas fa-map-location-dot"></i> Endereço das Aulas</h3>
        <div class="dc-form-row">
          <div class="dc-form-group">
            <label class="dc-form-label">CEP</label>
            <input class="dc-form-input dc-mask-cep" name="cepAulas" value="${this.formatCEPForInput(c.cepAulas || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Endereço</label>
            <input class="dc-form-input" name="enderecoAulas" value="${this.escapeHTMLForInput(c.enderecoAulas || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Cidade / UF</label>
            <input class="dc-form-input" name="cidadeUFAulas" value="${this.escapeHTMLForInput(c.cidadeUFAulas || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Complemento</label>
            <input class="dc-form-input" name="complementoAulas" value="${this.escapeHTMLForInput(c.complementoAulas || '')}">
          </div>
        </div>
      </div>

      <!-- Dados de NF -->
      <div class="dc-form-section">
        <h3><i class="fas fa-file-invoice"></i> Nota Fiscal</h3>
        <label class="dc-checkbox-label" style="margin-bottom:10px">
          <input type="checkbox" id="dc-edit-confirmaNF" name="confirmaNF" ${c.confirmaNF ? 'checked' : ''}>
          Dados da NF são diferentes dos dados pessoais
        </label>
        <div id="dc-edit-sec-nf" class="dc-form-row">
          <div class="dc-form-group">
            <label class="dc-form-label">Nome NF</label>
            <input class="dc-form-input" name="nfNome" value="${this.escapeHTMLForInput(c.nfNome || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">CPF NF</label>
            <input class="dc-form-input dc-mask-cpf" name="nfCpf" value="${this.formatCPFForInput(c.nfCpf || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Endereço NF</label>
            <input class="dc-form-input" name="nfEndereco" value="${this.escapeHTMLForInput(c.nfEndereco || '')}">
          </div>
          <div class="dc-form-group">
            <label class="dc-form-label">Email NF</label>
            <input class="dc-form-input" name="nfEmail" value="${this.escapeHTMLForInput(c.nfEmail || '')}">
          </div>
        </div>
      </div>

      <!-- Status -->
      <div class="dc-form-section">
        <h3><i class="fas fa-tag"></i> Status do Cliente</h3>
        <div class="dc-form-row">
          <div class="dc-form-group">
            <label class="dc-form-label">Status</label>
            <select class="dc-form-select" name="status">
              <option value="Potencial" ${c.status === 'Potencial' ? 'selected' : ''}>Potencial</option>
              <option value="Ativo" ${c.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
              <option value="Inativo" ${c.status === 'Inativo' ? 'selected' : ''}>Inativo</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Estudantes -->
      <div class="dc-form-section">
        <h3><i class="fas fa-user-graduate"></i> Estudantes</h3>
        <div id="dc-edit-students-container">${studentsHTML}</div>
        <button type="button" id="dc-edit-btn-add-student" class="dc-btn dc-btn-secondary" style="margin-top:10px">
          <i class="fas fa-plus"></i> Adicionar Estudante
        </button>
      </div>
    </form>`;
  }

  _buildStudentBlock(e = {}, index) {
    const series = ['Maternal', 'Jardim I', 'Jardim II', '1º Ano', '2º Ano', '3º Ano',
      '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', '1ª Série EM', '2ª Série EM', '3ª Série EM'];
    const opts = series.map(s =>
      `<option value="${s}" ${(e.serie || '') === s ? 'selected' : ''}>${s}</option>`
    ).join('');

    return `
    <div class="dc-student-card" data-student-index="${index}">
      <div class="dc-student-header">
        <h4><i class="fas fa-user-graduate"></i> Estudante ${index + 1}</h4>
        <button type="button" class="dc-btn dc-btn-sm dc-btn-danger dc-remove-student">
          <i class="fas fa-trash"></i> Remover
        </button>
      </div>
      <div class="dc-form-row">
        <div class="dc-form-group">
          <label class="dc-form-label">Nome</label>
          <input class="dc-form-input" name="estudante_nome[]" value="${this.escapeHTMLForInput(e.nome || '')}">
        </div>
        <div class="dc-form-group">
          <label class="dc-form-label">Escola</label>
          <input class="dc-form-input" name="estudante_escola[]" value="${this.escapeHTMLForInput(e.escola || '')}">
        </div>
        <div class="dc-form-group">
          <label class="dc-form-label">Série</label>
          <select class="dc-form-select" name="estudante_serie[]">${opts}</select>
        </div>
        <div class="dc-form-group">
          <label class="dc-form-label">Aniversário</label>
          <input class="dc-form-input dc-mask-date" name="estudante_aniversario[]" value="${this.escapeHTMLForInput(e.aniversario || '')}">
        </div>
        <div class="dc-form-group" style="grid-column:1/-1">
          <label class="dc-checkbox-label">
            <input type="checkbox" name="estudante_atendimentoEspecializado[]" ${e.atendimentoEspecializado ? 'checked' : ''}
              class="dc-toggle-atip">
            Atendimento especializado
          </label>
        </div>
        <div class="dc-form-group dc-atip-fields" style="display:${e.atendimentoEspecializado ? 'block' : 'none'}">
          <label class="dc-form-label">Atipicidade</label>
          <input class="dc-form-input" name="estudante_atipicidade[]" value="${this.escapeHTMLForInput(e.atipicidade || '')}">
        </div>
        <div class="dc-form-group dc-atip-fields" style="display:${e.atendimentoEspecializado ? 'block' : 'none'}">
          <label class="dc-form-label">Link do Laudo</label>
          <input class="dc-form-input" name="estudante_LinkLaudo[]" value="${this.escapeHTMLForInput(e.LinkLaudo || '')}">
        </div>
      </div>
    </div>`;
  }

  addStudentField(container, data) {
    const index = container.querySelectorAll('.dc-student-card').length;
    const temp = document.createElement('div');
    temp.innerHTML = this._buildStudentBlock(data || {}, index);
    const block = temp.firstElementChild;
    container.appendChild(block);
    this._bindStudentBlockEvents(block);
    this.setupEditFormMasks();
  }

  async removeStudentField(btn) {
    const card = btn.closest('.dc-student-card');
    const studentName = card.querySelector('[name="estudante_nome[]"]')?.value || 'este estudante';

    const confirmed = await this.showConfirmModal({
      title: 'Remover Estudante',
      message: `Deseja remover "${studentName}" da lista?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmed) return;

    card.remove();
    // Re-numerar
    document.querySelectorAll('#dc-edit-students-container .dc-student-card').forEach((c, i) => {
      const h4 = c.querySelector('h4');
      if (h4) h4.innerHTML = `<i class="fas fa-user-graduate"></i> Estudante ${i + 1}`;
      c.dataset.studentIndex = i;
    });
  }

  _bindStudentBlockEvents(block) {
    block.querySelector('.dc-remove-student')
      ?.addEventListener('click', e => this.removeStudentField(e.currentTarget));
    block.querySelector('.dc-toggle-atip')
      ?.addEventListener('change', e => {
        block.querySelectorAll('.dc-atip-fields').forEach(f => {
          f.style.display = e.target.checked ? 'block' : 'none';
        });
      });
  }

  // ============================================================
  // MÁSCARAS DE INPUT
  // ============================================================

  setupEditFormMasks() {
    // CPF: XXX.XXX.XXX-XX
    document.querySelectorAll('.dc-mask-cpf').forEach(el => {
      if (el._masked) return;
      el._masked = true;
      el.addEventListener('input', () => {
        let v = el.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
        else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
        el.value = v;
      });
    });

    // Telefone: (XX) XXXXX-XXXX
    document.querySelectorAll('.dc-mask-phone').forEach(el => {
      if (el._masked) return;
      el._masked = true;
      el.addEventListener('input', () => {
        let v = el.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        el.value = v;
      });
    });

    // CEP: XXXXX-XXX
    document.querySelectorAll('.dc-mask-cep').forEach(el => {
      if (el._masked) return;
      el._masked = true;
      el.addEventListener('input', () => {
        let v = el.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d{0,3})/, '$1-$2');
        el.value = v;
      });
    });

    // Data: DD/MM/AAAA
    document.querySelectorAll('.dc-mask-date').forEach(el => {
      if (el._masked) return;
      el._masked = true;
      el.addEventListener('input', () => {
        let v = el.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 4) v = v.replace(/(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
        else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,2})/, '$1/$2');
        el.value = v;
      });
    });

    // Toggle atipicidade em blocos já existentes
    document.querySelectorAll('.dc-toggle-atip').forEach(el => {
      if (el._togBound) return;
      el._togBound = true;
      el.addEventListener('change', e => {
        const block = e.target.closest('.dc-student-card');
        block?.querySelectorAll('.dc-atip-fields').forEach(f => {
          f.style.display = e.target.checked ? 'block' : 'none';
        });
      });
    });

    // Remover estudante em blocos já existentes
    document.querySelectorAll('.dc-remove-student').forEach(btn => {
      if (btn._rmBound) return;
      btn._rmBound = true;
      btn.addEventListener('click', e => this.removeStudentField(e.currentTarget));
    });
  }

  // ============================================================
  // VALIDAÇÃO DE FORMULÁRIO
  // ============================================================

  validateForm(form) {
    const errors = [];
    this.clearFieldErrors();

    const getData = name => {
      const el = form.querySelector(`[name="${name}"]`);
      return el ? el.value.trim() : '';
    };

    // Nome
    const nome = getData('nome');
    if (!nome) {
      errors.push({ field: 'nome', message: 'Nome é obrigatório' });
    }

    // CPF
    const cpf = getData('cpf').replace(/\D/g, '');
    if (!cpf) {
      errors.push({ field: 'cpf', message: 'CPF é obrigatório' });
    } else if (!this.isValidCPF(cpf)) {
      errors.push({ field: 'cpf', message: 'CPF inválido' });
    }

    // Email
    const email = getData('email');
    if (!email) {
      errors.push({ field: 'email', message: 'Email é obrigatório' });
    } else if (!this.isValidEmail(email)) {
      errors.push({ field: 'email', message: 'Email inválido' });
    }

    // Contato
    const contato = getData('contato').replace(/\D/g, '');
    if (!contato) {
      errors.push({ field: 'contato', message: 'Contato é obrigatório' });
    } else if (!this.isValidPhone(contato)) {
      errors.push({ field: 'contato', message: 'Telefone inválido' });
    }

    // Mostrar erros nos campos
    errors.forEach(err => {
      const errorEl = form.querySelector(`[data-field="${err.field}"]`);
      const inputEl = form.querySelector(`[name="${err.field}"]`);
      if (errorEl) errorEl.textContent = err.message;
      if (inputEl) inputEl.classList.add('dc-input-error');
    });

    return errors;
  }

  clearFieldErrors() {
    document.querySelectorAll('.dc-field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.dc-input-error').forEach(el => el.classList.remove('dc-input-error'));
  }

  // ============================================================
  // SALVAR EDIÇÃO
  // ============================================================

  async handleSaveEdit(clientId) {
    const form = document.getElementById('dc-edit-form');
    if (!form) return;

    // Validar
    const errors = this.validateForm(form);
    if (errors.length > 0) {
      this.showToast(`Corrija os campos obrigatórios: ${errors.map(e => e.field).join(', ')}`, 'error');
      return;
    }

    // Confirmar
    const confirmed = await this.showConfirmModal({
      title: 'Salvar Alterações',
      message: 'Deseja salvar as alterações realizadas?',
      confirmText: 'Salvar',
      cancelText: 'Cancelar',
      type: 'info'
    });

    if (!confirmed) return;

    this.saveClientEdit(clientId);
  }

  async saveClientEdit(clientId) {
    const form = document.getElementById('dc-edit-form');
    const saveBtn = document.getElementById('dc-btn-save-edit');
    if (!form) return;

    this._setButtonLoading(saveBtn, true);

    const getData = name => {
      const el = form.querySelector(`[name="${name}"]`);
      return el ? el.value.trim() : '';
    };
    const getCheck = name => {
      const el = form.querySelector(`[name="${name}"]`);
      return el ? el.checked : false;
    };

    // Coletar estudantes
    const nomes = [...form.querySelectorAll('[name="estudante_nome[]"]')].map(e => e.value.trim());
    const escolas = [...form.querySelectorAll('[name="estudante_escola[]"]')].map(e => e.value.trim());
    const series = [...form.querySelectorAll('[name="estudante_serie[]"]')].map(e => e.value);
    const anivs = [...form.querySelectorAll('[name="estudante_aniversario[]"]')].map(e => e.value.trim());
    const atendeEsp = [...form.querySelectorAll('[name="estudante_atendimentoEspecializado[]"]')].map(e => e.checked);
    const atipics = [...form.querySelectorAll('[name="estudante_atipicidade[]"]')].map(e => e.value.trim());
    const laudos = [...form.querySelectorAll('[name="estudante_LinkLaudo[]"]')].map(e => e.value.trim());

    const estudantes = nomes.map((_, i) => ({
      nome: nomes[i],
      escola: escolas[i] || '',
      serie: series[i] || '',
      aniversario: anivs[i] || '',
      atendimentoEspecializado: atendeEsp[i] || false,
      atipicidade: atipics[i] || '',
      LinkLaudo: laudos[i] || ''
    }));

    const updatedData = {
      nome: getData('nome'),
      apelido: getData('apelido'),
      cpf: getData('cpf').replace(/\D/g, ''),
      email: getData('email'),
      contato: getData('contato').replace(/\D/g, ''),
      dataNascimento: getData('dataNascimento'),
      cep: getData('cep').replace(/\D/g, ''),
      endereco: getData('endereco'),
      cidadeUF: getData('cidadeUF'),
      complemento: getData('complemento'),
      linkEndereco1: getData('linkEndereco1'),
      linkEndereco2: getData('linkEndereco2'),
      mesmoEndereco: getCheck('mesmoEndereco'),
      cepAulas: getData('cepAulas').replace(/\D/g, ''),
      enderecoAulas: getData('enderecoAulas'),
      cidadeUFAulas: getData('cidadeUFAulas'),
      complementoAulas: getData('complementoAulas'),
      confirmaNF: getCheck('confirmaNF'),
      nfNome: getData('nfNome'),
      nfCpf: getData('nfCpf').replace(/\D/g, ''),
      nfEndereco: getData('nfEndereco'),
      nfEmail: getData('nfEmail'),
      status: getData('status'),
      estudantes,
      quantidadeEstudantes: estudantes.length
    };

    try {
      await this.updateClient(clientId, updatedData);
    } finally {
      this._setButtonLoading(saveBtn, false);
    }
  }

  async updateClient(clientId, updatedData) {
    const now = new Date();
    updatedData.dataAtualizacao = now;
    updatedData.dataAtualizacaoLegivel = now.toLocaleDateString('pt-BR');

    try {
      if (this.firestore) {
        await this.firestore.collection('cadastroClientes').doc(clientId).update(updatedData);
      }
      // Atualiza localmente
      const idx = this.clients.findIndex(c => c.id === clientId);
      if (idx !== -1) this.clients[idx] = { ...this.clients[idx], ...updatedData };

      this.applyLocalFilters();
      this.closeModal('dc-modal-editar');
      this.showToast('Cliente atualizado com sucesso!', 'success');
    } catch (err) {
      console.error('[DashboardCliente] Erro ao atualizar:', err);
      this.showToast('Erro ao salvar. Tente novamente.', 'error');
      throw err;
    }
  }

  // ============================================================
  // EXPORTAR CSV
  // ============================================================

  downloadCSV() {
    const list = this.filteredClients ?? this.clients;
    if (list.length === 0) {
      this.showToast('Nenhum dado para exportar.', 'warning');
      return;
    }

    const headers = [
      // Dados Básicos
      'Data Cadastro', 'Nome', 'CPF', 'Email', 'Contato', 'Status',
      // Endereço do Contratante
      'CEP', 'Endereço', 'Cidade/UF', 'Complemento',
      // Nota Fiscal
      'NF Nome', 'NF CPF', 'NF Endereço', 'NF Email',
      // Local da Aula
      'Mesmo Endereço', 'Aula CEP', 'Aula Endereço', 'Aula Cidade/UF', 'Aula Complemento',
      // Estudantes
      'Qtd Estudantes', 'Nomes Estudantes'
    ];

    const escape = v => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = list.map(c => {
      // Dados de NF
      const nfNome = c.confirmaNF ? (c.nfNome || c.nome) : c.nome;
      const nfCpf = c.confirmaNF ? (c.nfCpf || c.cpf) : c.cpf;
      const nfEndereco = c.confirmaNF ? (c.nfEndereco || c.endereco) : c.endereco;
      const nfEmail = c.confirmaNF ? (c.nfEmail || c.email) : c.email;

      // Local da Aula
      const mesmoEnd = c.mesmoEndereco ? 'Sim' : 'Não';
      const aulaCep = c.mesmoEndereco ? c.cep : (c.cepAulas || '');
      const aulaEnd = c.mesmoEndereco ? c.endereco : (c.enderecoAulas || '');
      const aulaCid = c.mesmoEndereco ? c.cidadeUF : (c.cidadeUFAulas || '');
      const aulaComp = c.mesmoEndereco ? c.complemento : (c.complementoAulas || '');

      // Estudantes
      const estudantes = Array.isArray(c.estudantes) ? c.estudantes : [];
      const nomesEstudantes = estudantes.map(e => e.nome || '').filter(n => n).join(', ');

      return [
        // Dados Básicos
        c.dataCadastroLegivel || '',
        c.nome || '',
        this.formatCPF(c.cpf),
        c.email || '',
        this.formatPhone(c.contato),
        c.status || '',
        // Endereço do Contratante
        this.formatCEP(c.cep),
        c.endereco || '',
        c.cidadeUF || '',
        c.complemento || '',
        // Nota Fiscal
        nfNome || '',
        this.formatCPF(nfCpf),
        nfEndereco || '',
        nfEmail || '',
        // Local da Aula
        mesmoEnd,
        this.formatCEP(aulaCep),
        aulaEnd,
        aulaCid,
        aulaComp,
        // Estudantes
        c.quantidadeEstudantes ?? 0,
        nomesEstudantes
      ].map(escape).join(';');
    });

    const bom = '\uFEFF';
    const content = bom + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

    link.href = url;
    link.download = `clientes_${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.showToast(`${list.length} clientes exportados!`, 'success');
  }

  // ============================================================
  // TOASTS
  // ============================================================

  showToast(message, type = 'info') {
    const container = document.getElementById('dc-toast-container');
    if (!container) return;

    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      info: 'fa-circle-info',
      warning: 'fa-triangle-exclamation'
    };

    const toast = document.createElement('div');
    toast.className = `dc-toast dc-toast-${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info}"></i>
      <span>${this.escapeHTML(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'dc-fadeOut 0.4s ease forwards';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // ============================================================
  // MENU DE CONTEXTO (BOTÃO DIREITO)
  // ============================================================

  openContextMenu(event, clientId) {
    event.preventDefault();
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.id = 'dc-context-menu';
    menu.className = 'dc-context-menu';
    menu.innerHTML = `
      <button class="dc-context-item" data-action="status">
        <i class="fas fa-exchange-alt"></i> Mudar Status
      </button>
      <button class="dc-context-item dc-context-item--danger" data-action="delete">
        <i class="fas fa-trash"></i> Excluir
      </button>`;

    document.body.appendChild(menu);

    const x = Math.min(event.clientX, window.innerWidth - 180);
    const y = Math.min(event.clientY, window.innerHeight - 90);
    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;

    menu.querySelector('[data-action="status"]').addEventListener('click', () => {
      this.closeContextMenu();
      this.openChangeStatusModal(clientId);
    });
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      this.closeContextMenu();
      this.confirmDeleteClient(clientId);
    });

    setTimeout(() => {
      document.addEventListener('click', () => this.closeContextMenu(), { once: true });
    }, 0);
  }

  closeContextMenu() {
    document.getElementById('dc-context-menu')?.remove();
  }

  // ============================================================
  // MODAL — MUDAR STATUS
  // ============================================================

  openChangeStatusModal(clientId) {
    const client = this.getClientData(clientId);
    if (!client) return;

    document.getElementById('dc-overlayStatus')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dc-overlayStatus';
    overlay.className = 'ap-overlay';

    const optHtml = (val, label, icon, color) => `
      <button class="dc-status-option${client.status === val ? ' dc-status-option--selected' : ''}" data-status="${val}">
        <i class="fas ${icon}" style="color:${color}"></i> ${label}
      </button>`;

    overlay.innerHTML = `
      <div class="ap-modal ap-modal-sm" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2><i class="fas fa-exchange-alt" style="color:#f28705"></i> Mudar Status</h2>
          <button class="ap-modal-close" id="dc-statusClose">&times;</button>
        </div>
        <div class="ap-modal-body">
          <p style="font-size:.82rem;color:#6b7280;margin-bottom:1rem">
            Cliente: <strong>${this.escapeHTML(client.nome)}</strong><br>
            Status atual: <strong>${this.escapeHTML(client.status)}</strong>
          </p>
          <div class="dc-status-options">
            ${optHtml('Ativo',    'Ativo',    'fa-circle-check', '#16a34a')}
            ${optHtml('Potencial','Potencial','fa-circle',       '#f28705')}
            ${optHtml('Inativo',  'Inativo',  'fa-circle-xmark', '#9ca3af')}
          </div>
        </div>
        <div class="ap-modal-footer">
          <button class="ap-btn ap-btn--ghost" id="dc-statusCancelar">Cancelar</button>
          <button class="ap-btn ap-btn--primary" id="dc-statusConfirmar" disabled>
            <i class="fas fa-check"></i> Confirmar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    let selectedStatus = null;

    overlay.querySelectorAll('.dc-status-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.dc-status-option').forEach(b => b.classList.remove('dc-status-option--selected'));
        btn.classList.add('dc-status-option--selected');
        selectedStatus = btn.dataset.status;
        document.getElementById('dc-statusConfirmar').disabled = (selectedStatus === client.status);
      });
    });

    const fechar = () => overlay.remove();
    document.getElementById('dc-statusClose').addEventListener('click', fechar);
    document.getElementById('dc-statusCancelar').addEventListener('click', fechar);
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

    document.getElementById('dc-statusConfirmar').addEventListener('click', async () => {
      if (!selectedStatus || selectedStatus === client.status) return;
      fechar();
      try {
        await this.updateClient(clientId, { status: selectedStatus });
        this.showToast(`Status alterado para "${selectedStatus}"!`, 'success');
      } catch {
        this.showToast('Erro ao alterar status.', 'error');
      }
    });
  }

  // ============================================================
  // EXCLUIR CLIENTE
  // ============================================================

  async confirmDeleteClient(clientId) {
    const client = this.getClientData(clientId);
    if (!client) return;

    const confirmed = await this.showConfirmModal({
      title: 'Excluir Cliente',
      message: `Deseja excluir permanentemente "${client.nome}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      if (this.firestore) {
        await this.firestore.collection('cadastroClientes').doc(clientId).delete();
      }
      this.clients = this.clients.filter(c => c.id !== clientId);
      this.applyLocalFilters();
      this.showToast(`Cliente "${client.nome}" excluído.`, 'success');
    } catch (err) {
      console.error('[DashboardCliente] Erro ao excluir:', err);
      this.showToast('Erro ao excluir cliente.', 'error');
    }
  }

  // ============================================================
  // MODAL — CONFIGURAÇÕES (ENGRENAGEM)
  // ============================================================

  openConfigModal() {
    document.getElementById('dc-overlayConfig')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dc-overlayConfig';
    overlay.className = 'ap-overlay';
    overlay.innerHTML = `
      <div class="ap-modal ap-modal-sm" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2><i class="fas fa-cog" style="color:#f28705"></i> Configurações</h2>
          <button class="ap-modal-close" id="dc-cfgClose" aria-label="Fechar">&times;</button>
        </div>
        <div class="ap-modal-body">
          <div class="ap-config-list">

            <button class="ap-config-item ap-config-item--disabled" disabled>
              <div class="ap-config-icon ap-config-icon--orange">
                <i class="fas fa-users" style="color:#f28705"></i>
              </div>
              <div class="ap-config-text">
                <strong>Exibir Todos os Clientes</strong>
                <span>Listagem completa com filtros avançados</span>
              </div>
              <span class="ap-em-breve">Em breve</span>
            </button>

            <button class="ap-config-item ap-config-item--disabled" disabled>
              <div class="ap-config-icon ap-config-icon--blue">
                <i class="fas fa-code" style="color:#2563eb"></i>
              </div>
              <div class="ap-config-text">
                <strong>Visualização de Desenvolvedor</strong>
                <span>Dados brutos, IDs e logs do sistema</span>
              </div>
              <span class="ap-em-breve">Em breve</span>
            </button>

            <button class="ap-config-item" id="dc-cfgPermissoes">
              <div class="ap-config-icon ap-config-icon--green">
                <i class="fas fa-shield-alt" style="color:#16a34a"></i>
              </div>
              <div class="ap-config-text">
                <strong>Atualizar Informações</strong>
                <span>Sincronizar acessos com os status atuais</span>
              </div>
              <i class="fas fa-chevron-right" style="color:#9ca3af;margin-left:auto;font-size:.72rem"></i>
            </button>

          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    document.getElementById('dc-cfgClose').addEventListener('click', fechar);
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.getElementById('dc-cfgPermissoes').addEventListener('click', () => {
      fechar();
      this.openClientPermModal();
    });
  }

  // ============================================================
  // MODAL — ATUALIZAR INFORMAÇÕES (PERMISSÕES DE ACESSO)
  // ============================================================

  openClientPermModal() {
    document.getElementById('dc-overlayPerm')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dc-overlayPerm';
    overlay.className = 'ap-overlay';
    overlay.innerHTML = `
      <div class="ap-modal ap-modal-lg" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2><i class="fas fa-shield-alt" style="color:#16a34a"></i> Atualizar Informações</h2>
          <button class="ap-modal-close" id="dc-permClose">&times;</button>
        </div>
        <div class="ap-modal-body" id="dc-permBody">
          <div class="ap-loading"><div class="ap-spinner"></div> Carregando clientes…</div>
        </div>
        <div class="ap-modal-footer" id="dc-permFooter" style="display:none">
          <button class="ap-btn ap-btn--ghost" id="dc-permCancelar">Cancelar</button>
          <button class="ap-btn ap-btn--primary" id="dc-permAplicar" disabled>
            <i class="fas fa-check"></i> Aplicar Selecionados
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    document.getElementById('dc-permClose').addEventListener('click', fechar);
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.getElementById('dc-permCancelar').addEventListener('click', fechar);

    this.carregarPermissoesClientes();
  }

  async carregarPermissoesClientes() {
    const body   = document.getElementById('dc-permBody');
    const footer = document.getElementById('dc-permFooter');
    if (!body || !this.firestore) return;

    const esc = str => (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    try {
      const snap = await this.firestore.collection('cadastroClientes').get();
      const clientes = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));

      const receberao = [];
      const perderao  = [];

      clientes.forEach(c => {
        const ativo     = this._normalizeStatus(c.status || '') === 'Ativo';
        const jaRevogado = c.acessoPlataforma === false;
        if (ativo && c.acessoPlataforma !== true) receberao.push(c);
        if (!ativo && !jaRevogado)                perderao.push(c);
      });

      const sortByName = arr => arr.sort((a, b) =>
        (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase(), 'pt-BR')
      );
      sortByName(receberao);
      sortByName(perderao);

      if (!receberao.length && !perderao.length) {
        body.innerHTML = `
          <div class="ap-empty">
            <span class="ap-empty-icon">✅</span>
            <strong>Tudo sincronizado!</strong>
            <p>Todos os acessos já estão de acordo com os status atuais.<br>Nenhuma ação necessária.</p>
          </div>`;
        return;
      }

      const itemHtml = (c, tipo) => {
        const status = this._normalizeStatus(c.status || '') || '—';
        const sKey   = status.toLowerCase().replace(/[^a-z]/g, '');
        const badgeAcesso = tipo === 'grant'
          ? `<span class="ap-badge ap-badge--semacesso">Sem acesso</span>`
          : `<span class="ap-badge ap-badge--acesso">Com acesso</span>`;
        return `
          <label class="ap-perm-item">
            <input type="checkbox" class="ap-cb" data-tipo="${tipo}" data-id="${esc(c._docId)}" checked>
            <div class="ap-perm-info">
              <div class="ap-perm-nome">${esc(c.nome || '(sem nome)')}</div>
              <div class="ap-perm-sub">${esc(c.email || '—')}</div>
            </div>
            <div class="ap-perm-badges">
              <span class="ap-badge ap-badge--${sKey}">${esc(status)}</span>
              ${badgeAcesso}
            </div>
          </label>`;
      };

      let html = `
        <div class="ap-search-wrap">
          <i class="fas fa-search"></i>
          <input type="text" class="ap-search-input" id="dc-searchPerm"
            placeholder="Filtrar cliente pelo nome…" autocomplete="off">
        </div>`;

      if (receberao.length) {
        html += `
          <div class="ap-perm-group">
            <div class="ap-perm-group-title ap-perm-group-title--grant">
              <i class="fas fa-user-check"></i> Receberão acesso (${receberao.length})
            </div>
            <label class="ap-select-all">
              <input type="checkbox" id="dc-saGrant" checked> Selecionar todos
            </label>
            <div class="ap-perm-list">${receberao.map(c => itemHtml(c, 'grant')).join('')}</div>
          </div>`;
      }

      if (perderao.length) {
        html += `
          <div class="ap-perm-group">
            <div class="ap-perm-group-title ap-perm-group-title--revoke">
              <i class="fas fa-user-times"></i> Terão acesso removido (${perderao.length})
            </div>
            <label class="ap-select-all">
              <input type="checkbox" id="dc-saRevoke" checked> Selecionar todos
            </label>
            <div class="ap-perm-list">${perderao.map(c => itemHtml(c, 'revoke')).join('')}</div>
          </div>`;
      }

      body.innerHTML = html;

      const atualizarBtn = () => {
        const btn = document.getElementById('dc-permAplicar');
        if (btn) btn.disabled = document.querySelectorAll('#dc-overlayPerm .ap-cb:checked').length === 0;
      };

      document.getElementById('dc-searchPerm')?.addEventListener('input', e => {
        const termo = e.target.value.toLowerCase();
        document.querySelectorAll('#dc-overlayPerm .ap-perm-item').forEach(item => {
          const nome = (item.querySelector('.ap-perm-nome')?.textContent || '').toLowerCase();
          item.style.display = nome.includes(termo) ? '' : 'none';
        });
      });

      document.getElementById('dc-saGrant')?.addEventListener('change', function() {
        document.querySelectorAll('#dc-overlayPerm .ap-cb[data-tipo="grant"]')
          .forEach(cb => { cb.checked = this.checked; });
        atualizarBtn();
      });

      document.getElementById('dc-saRevoke')?.addEventListener('change', function() {
        document.querySelectorAll('#dc-overlayPerm .ap-cb[data-tipo="revoke"]')
          .forEach(cb => { cb.checked = this.checked; });
        atualizarBtn();
      });

      body.querySelectorAll('.ap-cb').forEach(cb => cb.addEventListener('change', atualizarBtn));

      if (footer) footer.style.display = 'flex';
      atualizarBtn();

      document.getElementById('dc-permAplicar')?.addEventListener('click', () => {
        const idsGrant  = [...document.querySelectorAll('#dc-overlayPerm .ap-cb[data-tipo="grant"]:checked')].map(cb => cb.dataset.id);
        const idsRevoke = [...document.querySelectorAll('#dc-overlayPerm .ap-cb[data-tipo="revoke"]:checked')].map(cb => cb.dataset.id);

        const paraGrant  = receberao.filter(c => idsGrant.includes(c._docId));
        const paraRevoke = perderao.filter(c => idsRevoke.includes(c._docId));

        if (!paraGrant.length && !paraRevoke.length) {
          this.showToast('Nenhum cliente selecionado.', 'info');
          return;
        }
        this._abrirConfirmacaoAC(paraGrant, paraRevoke);
      });

    } catch (e) {
      console.error('[DashboardCliente] Erro ao carregar permissões:', e);
      body.innerHTML = `
        <div class="ap-empty">
          <span class="ap-empty-icon">❌</span>
          <strong>Erro ao carregar dados</strong>
          <p>Verifique sua conexão e tente novamente.</p>
        </div>`;
    }
  }

  _abrirConfirmacaoAC(paraGrant, paraRevoke) {
    const overlay = document.createElement('div');
    overlay.id = 'dc-overlayPermConfirm';
    overlay.className = 'ap-overlay';
    overlay.style.zIndex = '9600';
    overlay.innerHTML = `
      <div class="ap-modal ap-modal-sm" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2><i class="fas fa-exclamation-triangle" style="color:#f28705"></i> Confirmar Operação</h2>
          <button class="ap-modal-close" id="dc-confAcClose">&times;</button>
        </div>
        <div class="ap-modal-body">
          <p style="font-size:.84rem;color:#374151;margin-bottom:.75rem;line-height:1.5">
            As seguintes alterações serão realizadas:
          </p>
          ${paraGrant.length ? `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
                        background:#f0fdf4;border-radius:.5rem;margin-bottom:.4rem;font-size:.82rem;color:#166534">
              <i class="fas fa-user-check"></i>
              <strong>${paraGrant.length}</strong>&nbsp;cliente(s) receberão acesso
            </div>` : ''}
          ${paraRevoke.length ? `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
                        background:#fef2f2;border-radius:.5rem;margin-bottom:.4rem;font-size:.82rem;color:#991b1b">
              <i class="fas fa-user-times"></i>
              <strong>${paraRevoke.length}</strong>&nbsp;cliente(s) terão acesso removido
            </div>` : ''}
          <p style="font-size:.73rem;color:#6b7280;margin-top:.75rem">
            <i class="fas fa-info-circle"></i>
            Nenhuma conta será deletada. Todos os acessos são reversíveis.
          </p>
        </div>
        <div class="ap-modal-footer">
          <button class="ap-btn ap-btn--ghost" id="dc-confAcCancelar">Cancelar</button>
          <button class="ap-btn ap-btn--primary" id="dc-confAcOk">
            <i class="fas fa-check"></i> Confirmar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    document.getElementById('dc-confAcClose').addEventListener('click', fechar);
    document.getElementById('dc-confAcCancelar').addEventListener('click', fechar);
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

    document.getElementById('dc-confAcOk').addEventListener('click', async () => {
      fechar();
      await this._executarAtualizacoesClientes(paraGrant, paraRevoke);
    });
  }

  // ============================================================
  // FIREBASE AUTH — CLIENTES (APP SECUNDÁRIA)
  // ============================================================

  // NOTA (revertido temporariamente — manageClientAuth existe e funciona, mas
  // exige que o projeto esteja no plano Blaze pra QUALQUER Cloud Function poder
  // rodar, e o projeto está no Spark). Volta ao SDK client-side direto: quando
  // o e-mail já tem conta ("auth/email-already-in-use"), "uid" não é gravado
  // aqui. Contorno: rodar SistemMaster-Login/corrigir-uid-aulas.js com
  // --incluir-cliente depois (não depende de Cloud Functions/Blaze).
  _getSecondaryAuth() {
    const APP_NAME = 'dc-cliente-auth';
    try {
      return firebase.app(APP_NAME).auth();
    } catch {
      const cfg = (typeof FIREBASE_CONFIG !== 'undefined')
        ? FIREBASE_CONFIG
        : firebase.app().options;
      return firebase.initializeApp(cfg, APP_NAME).auth();
    }
  }

  async _criarContaCliente(email, cpf) {
    const senha = (cpf || '').replace(/\D/g, '');
    if (!email || !email.includes('@')) return { sucesso: false, erro: 'E-mail inválido.' };
    if (senha.length < 6) return { sucesso: false, erro: 'CPF inválido (mínimo 6 dígitos).' };

    const auth = this._getSecondaryAuth();
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, senha);
      const uid  = cred.user.uid;
      await auth.signOut();
      return { sucesso: true, uid, jaExistia: false };
    } catch (e) {
      try { await auth.signOut(); } catch { /* ignora */ }
      if (e.code === 'auth/email-already-in-use') {
        return { sucesso: true, uid: null, jaExistia: true };
      }
      return { sucesso: false, erro: e.message };
    }
  }

  async _executarAtualizacoesClientes(paraGrant, paraRevoke) {
    const body   = document.getElementById('dc-permBody');
    const footer = document.getElementById('dc-permFooter');
    if (!body) return;

    body.innerHTML = `<div class="ap-loading"><div class="ap-spinner"></div> Processando permissões, aguarde…</div>`;
    if (footer) footer.style.display = 'none';

    const resultados = [];
    const esc = str => (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const db  = firebase.firestore();

    for (const c of paraGrant) {
      const nome  = c.nome || c._docId;
      const email = c.email || '';
      const cpf   = c.cpf   || '';

      if (!email) {
        resultados.push({ nome, tipo: 'warn', msg: 'E-mail não encontrado — pulado.' });
        continue;
      }
      if (!cpf) {
        resultados.push({ nome, tipo: 'warn', msg: 'CPF não encontrado — pulado.' });
        continue;
      }

      try {
        const res = await this._criarContaCliente(email, cpf);
        if (res.sucesso) {
          const update = { acessoPlataforma: true };
          if (res.uid) update.uid = res.uid;
          // Marca o cadastro como pendente de sincronização de uid quando a
          // conta já existia — corrigir-uid-aulas.js limpa essa flag ao resolver.
          if (res.jaExistia) update.precisaVerificarUid = true;
          await db.collection('cadastroClientes').doc(c._docId).update(update);
          resultados.push({
            nome, tipo: res.jaExistia ? 'warn' : 'ok',
            msg: res.jaExistia
              ? '⚠️ Acesso concedido (conta já existia no sistema). Rode corrigir-uid-aulas.js --incluir-cliente para sincronizar o uid.'
              : 'Conta criada e acesso concedido com sucesso.'
          });
        } else {
          resultados.push({ nome, tipo: 'error', msg: `Erro ao criar conta: ${res.erro}` });
        }
      } catch (e) {
        resultados.push({ nome, tipo: 'error', msg: `Erro ao conceder acesso: ${e.message}` });
      }
    }

    for (const c of paraRevoke) {
      const nome = c.nome || c._docId;
      try {
        await db.collection('cadastroClientes').doc(c._docId).update({ acessoPlataforma: false });
        resultados.push({ nome, tipo: 'ok', msg: 'Acesso removido. Conta mantida no sistema.' });
      } catch (e) {
        resultados.push({ nome, tipo: 'error', msg: `Erro ao remover acesso: ${e.message}` });
      }
    }

    const qtdOk    = resultados.filter(r => r.tipo === 'ok').length;
    const qtdWarn  = resultados.filter(r => r.tipo === 'warn').length;
    const qtdError = resultados.filter(r => r.tipo === 'error').length;
    const icone    = { ok: '✅', warn: '⚠️', error: '❌' };

    body.innerHTML = `
      <div class="ap-summary">
        ${qtdOk    ? `<span class="ap-summary-chip ap-summary-chip--ok">✅ ${qtdOk} concluído${qtdOk > 1 ? 's' : ''}</span>` : ''}
        ${qtdWarn  ? `<span class="ap-summary-chip ap-summary-chip--warn">⚠️ ${qtdWarn} aviso${qtdWarn > 1 ? 's' : ''}</span>` : ''}
        ${qtdError ? `<span class="ap-summary-chip ap-summary-chip--error">❌ ${qtdError} erro${qtdError > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="ap-result-list">
        ${resultados.map(r => `
          <div class="ap-result-item ap-result-item--${r.tipo}">
            <span style="flex-shrink:0">${icone[r.tipo]}</span>
            <div>
              <div class="ap-result-nome">${esc(r.nome)}</div>
              <div class="ap-result-msg">${esc(r.msg)}</div>
            </div>
          </div>`).join('')}
      </div>`;

    if (footer) {
      footer.style.display = 'flex';
      footer.innerHTML = `<button class="ap-btn ap-btn--ghost" id="dc-permFechar">Fechar</button>`;
      document.getElementById('dc-permFechar')?.addEventListener('click', () => {
        document.getElementById('dc-overlayPerm')?.remove();
      });
    }

    if (qtdError === 0) {
      this.showToast('Permissões atualizadas com sucesso!', 'success');
    } else if (qtdOk > 0) {
      this.showToast(`${qtdOk} atualizado(s) com ${qtdError} erro(s).`, 'info');
    } else {
      this.showToast('Não foi possível atualizar as permissões.', 'error');
    }
  }

  // ============================================================
  // INJEÇÃO DE ESTILOS — NOVOS COMPONENTES
  // ============================================================

  _injectACStyles() {
    if (document.getElementById('dc-ac-styles')) return;
    const style = document.createElement('style');
    style.id = 'dc-ac-styles';
    style.textContent = `

/* ── Botão configuração do cliente ──────────────────────── */
#dc-configuracao {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: #f28705;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: .5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: background .2s ease, box-shadow .2s ease;
  flex-shrink: 0;
}
#dc-configuracao:hover {
  background: #fff8f0;
  box-shadow: 0 0 0 2px rgba(242,135,5,.35);
}

/* ── Menu de contexto ────────────────────────────────────── */
.dc-context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: .5rem;
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
  z-index: 9000;
  min-width: 160px;
  padding: .3rem 0;
  animation: apFadeIn .1s ease;
}
.dc-context-item {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .5rem .85rem;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  font-size: .8rem;
  font-family: 'Lexend', sans-serif;
  color: #374151;
  transition: background .15s;
}
.dc-context-item:hover { background: #f9fafb; }
.dc-context-item--danger { color: #dc2626; }
.dc-context-item--danger:hover { background: #fef2f2; }

/* ── Pills de filtro (modal multi-select) ────────────────── */
.dc-filter-pills {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}
.dc-filter-pill {
  padding: .45rem 1.1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 999px;
  background: #f9fafb;
  font-family: 'Comfortaa', cursive;
  font-size: .8rem;
  color: #374151;
  cursor: pointer;
  transition: all .18s;
}
.dc-filter-pill:hover { border-color: #f28705; background: #fff8f0; }
.dc-filter-pill--active { background: #f28705; border-color: #f28705; color: #fff; }

/* ── Opções de status (modal Mudar Status) ───────────────── */
.dc-status-options { display: flex; flex-direction: column; gap: .4rem; }
.dc-status-option {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .65rem .9rem;
  border: 1.5px solid #e5e7eb;
  border-radius: .5rem;
  background: #f9fafb;
  font-family: 'Lexend', sans-serif;
  font-size: .82rem;
  color: #374151;
  cursor: pointer;
  transition: all .18s;
  width: 100%;
}
.dc-status-option:hover { border-color: #f28705; background: #fff8f0; }
.dc-status-option--selected { border-color: #f28705; background: #fff8f0; font-weight: 600; }

/* ── Badges de status para o modal de permissões ─────────── */
.ap-badge--potencial { background: #fef3e2; color: #c06a0a; }
.ap-badge--inativo   { background: #f3f4f6; color: #6b7280; }

    `;
    document.head.appendChild(style);
  }
}

// ============================================================
// FUNÇÃO DE CARREGAMENTO PARA SEÇÃO
// ============================================================
function loadDashboardCliente() {
  const section = document.getElementById('clientes');
  if (!section) {
    console.error('[DashboardCliente] Section #clientes não encontrada');
    return;
  }

  // Renderizar HTML da estrutura
  section.innerHTML = `
    <!-- Container Principal -->
    <div class="dc-container">
      <!-- Header Compacto -->
      <div class="dc-header dc-header-compact">
        <div class="dc-filters-inline">
          <div class="dc-filter-group dc-filter-search">
            <label class="dc-filter-label">Buscar</label>
            <div class="dc-search-wrapper">
              <i class="fas fa-search"></i>
              <input type="text" id="dc-search" class="dc-form-input dc-input-sm" placeholder="Nome do cliente...">
            </div>
          </div>
          <div class="dc-filter-group dc-filter-status">
            <label class="dc-filter-label">Status</label>
            <select id="dc-filter-status" class="dc-form-select dc-input-sm">
              <option value="">Todos</option>
              <option value="Ativo">Ativo</option>
              <option value="Potencial">Potencial</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
          <div class="dc-filter-group dc-filter-cidade">
            <label class="dc-filter-label">Cidade</label>
            <input type="text" id="dc-filter-cidade" class="dc-form-input dc-input-sm" placeholder="Cidade...">
          </div>
          <div class="dc-filter-group dc-filter-btns">
            <label class="dc-filter-label">&nbsp;</label>
            <div class="dc-filter-btn-group">
              <button id="dc-btn-potencial" class="dc-btn dc-btn-icon dc-btn-toggle" title="Filtrar Clientes em Potencial">
                <i class="fas fa-eye"></i>
              </button>
              <button id="dc-btn-clear-filters" class="dc-btn dc-btn-icon dc-btn-ghost" title="Limpar filtros">
                <i class="fas fa-times"></i>
              </button>
              <button id="dc-btn-refresh" class="dc-btn dc-btn-icon dc-btn-ghost" title="Atualizar">
                <i class="fas fa-sync-alt"></i>
              </button>
              <button id="dc-btn-csv" class="dc-btn dc-btn-icon dc-btn-secondary" title="Exportar CSV">
                <i class="fas fa-file-csv"></i>
              </button>
              <button id="dc-configuracao" class="dc-btn dc-btn-icon dc-btn-ghost" title="Configurações">
                <i class="fas fa-cog"></i>
              </button>
              <span id="dc-client-count" class="dc-count-badge">0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div id="dc-loading" class="dc-loading" style="display: none;">
        <div class="dc-spinner"></div>
        <p>Carregando clientes...</p>
      </div>

      <!-- Estado vazio -->
      <div id="dc-empty" class="dc-empty-state" style="display: none;">
        <i class="fas fa-users-slash"></i>
        <h3>Nenhum cliente encontrado</h3>
        <p>Tente ajustar os filtros ou cadastrar novos clientes.</p>
      </div>

      <!-- Tabela de Clientes -->
      <div class="dc-table-wrapper">
        <table id="dc-clients-table" class="dc-table dc-table-main">
          <thead>
            <tr>
              <th><i class="fas fa-user"></i> Nome do Cliente</th>
              <th class="dc-th-center"><i class="fas fa-circle-info"></i> Detalhes</th>
              <th class="dc-th-center"><i class="fas fa-file-invoice"></i> Dados NF</th>
              <th class="dc-th-center"><i class="fas fa-map-location-dot"></i> Local Aula</th>
              <th class="dc-th-center"><i class="fas fa-user-graduate"></i> Estudantes</th>
              <th class="dc-th-center"><i class="fas fa-edit"></i> Editar</th>
            </tr>
          </thead>
          <tbody id="dc-table-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Toast Container -->
    <div id="dc-toast-container" class="dc-toast-container"></div>

    <!-- Modal Detalhes -->
    <div id="dc-modal-detalhes" class="dc-modal-overlay" style="display: none;">
      <div class="dc-modal">
        <div class="dc-modal-header">
          <h2><i class="fas fa-user"></i> Detalhes do Cliente</h2>
          <button class="dc-modal-close" data-modal="dc-modal-detalhes">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="dc-modal-detalhes-body" class="dc-modal-body"></div>
        <div class="dc-modal-footer">
          <button id="dc-detalhe-btn-nf" class="dc-btn dc-btn-secondary">
            <i class="fas fa-file-invoice"></i> Dados NF
          </button>
          <button id="dc-detalhe-btn-aula" class="dc-btn dc-btn-secondary">
            <i class="fas fa-map-location-dot"></i> Local Aula
          </button>
          <button id="dc-detalhe-btn-estudante" class="dc-btn dc-btn-secondary">
            <i class="fas fa-user-graduate"></i> Estudantes
          </button>
          <button id="dc-detalhe-btn-editar" class="dc-btn dc-btn-primary">
            <i class="fas fa-edit"></i> Editar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal NF -->
    <div id="dc-modal-nf" class="dc-modal-overlay" style="display: none;">
      <div class="dc-modal dc-modal-sm">
        <div class="dc-modal-header">
          <h2><i class="fas fa-file-invoice"></i> Dados para Nota Fiscal</h2>
          <button class="dc-modal-close" data-modal="dc-modal-nf">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="dc-modal-nf-body" class="dc-modal-body"></div>
        <div class="dc-modal-footer">
          <button class="dc-btn dc-btn-ghost" data-modal="dc-modal-nf">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Modal Aula -->
    <div id="dc-modal-aula" class="dc-modal-overlay" style="display: none;">
      <div class="dc-modal dc-modal-sm">
        <div class="dc-modal-header">
          <h2><i class="fas fa-map-location-dot"></i> Local das Aulas</h2>
          <button class="dc-modal-close" data-modal="dc-modal-aula">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="dc-modal-aula-body" class="dc-modal-body"></div>
        <div class="dc-modal-footer">
          <button class="dc-btn dc-btn-ghost" data-modal="dc-modal-aula">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Modal Estudante -->
    <div id="dc-modal-estudante" class="dc-modal-overlay" style="display: none;">
      <div class="dc-modal dc-modal-lg">
        <div class="dc-modal-header">
          <h2><i class="fas fa-user-graduate"></i> Estudantes</h2>
          <button class="dc-modal-close" data-modal="dc-modal-estudante">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="dc-modal-estudante-body" class="dc-modal-body"></div>
        <div class="dc-modal-footer">
          <button class="dc-btn dc-btn-ghost" data-modal="dc-modal-estudante">Fechar</button>
        </div>
      </div>
    </div>

    <!-- Modal Editar -->
    <div id="dc-modal-editar" class="dc-modal-overlay" style="display: none;">
      <div class="dc-modal dc-modal-xl">
        <div class="dc-modal-header">
          <h2><i class="fas fa-edit"></i> Editar Cliente</h2>
          <button class="dc-modal-close" data-modal="dc-modal-editar">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="dc-modal-editar-body" class="dc-modal-body"></div>
        <div id="dc-modal-editar-footer" class="dc-modal-footer"></div>
      </div>
    </div>
  `;

  // Inicializar o Dashboard
  if (window.dashboardCliente) {
    // Já existe uma instância, apenas reconfigurar
    window.dashboardCliente.setupUI();
    window.dashboardCliente.setupEventListeners();
    window.dashboardCliente.loadClients().catch(console.error);
  } else {
    // Criar nova instância
    window.dashboardCliente = new DashboardCliente();
  }
}

// ============================================================
// INICIALIZAÇÃO GLOBAL
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // A classe será inicializada quando a seção for carregada via loadDashboardCliente()
  console.log('[DashboardCliente] Módulo carregado. Aguardando navegação para seção.');
});
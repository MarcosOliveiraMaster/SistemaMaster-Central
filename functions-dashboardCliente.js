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
          status: d.status || 'Cliente Potencial',
          dataCadastroLegivel: d.dataCadastroLegivel || '—'
        };
      });

      this.filteredClients = null;
      this._updateCount();
      this.renderCards();
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
        status: 'Cliente Ativo',
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
        status: 'Cliente Potencial',
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

    // Botão toggle "Cliente em Potencial"
    const btnPotencial = document.getElementById('dc-btn-potencial');
    if (btnPotencial) {
      btnPotencial.addEventListener('click', () => this.togglePotencialFilter());
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
      const statusOk = !statusVal || c.status === statusVal;
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
    this._potencialFilterActive = false;
    this._updateCount();
    this.renderCards();
  }

  togglePotencialFilter() {
    const btn = document.getElementById('dc-btn-potencial');
    const statusSelect = document.getElementById('dc-filter-status');
    
    this._potencialFilterActive = !this._potencialFilterActive;
    
    if (this._potencialFilterActive) {
      btn?.classList.add('dc-btn-active');
      if (statusSelect) statusSelect.value = 'Cliente Potencial';
    } else {
      btn?.classList.remove('dc-btn-active');
      if (statusSelect) statusSelect.value = '';
    }
    
    this.applyLocalFilters();
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
      'Cliente Potencial': 'dc-badge-potencial',
      'Cliente Ativo': 'dc-badge-ativo',
      'Cliente Inativo': 'dc-badge-inativo'
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
        <div class="dc-info-item"><label>CPF</label><span>${this.formatCPF(client.cpf)}</span></div>
        <div class="dc-info-item"><label>Email</label><span>${this.escapeHTML(client.email)}</span></div>
        <div class="dc-info-item"><label>Contato</label><span>${this.formatPhone(client.contato)}</span></div>

        <div class="dc-info-section"><h4><i class="fas fa-house"></i> Endereço</h4></div>
        <div class="dc-info-item"><label>CEP</label><span>${this.formatCEP(client.cep)}</span></div>
        <div class="dc-info-item"><label>Endereço</label><span>${this.escapeHTML(client.endereco)}</span></div>
        <div class="dc-info-item"><label>Cidade / UF</label><span>${this.escapeHTML(client.cidadeUF)}</span></div>
        <div class="dc-info-item"><label>Complemento</label><span>${this.escapeHTML(client.complemento)}</span></div>

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
              <option value="Cliente Potencial" ${c.status === 'Cliente Potencial' ? 'selected' : ''}>Cliente Potencial</option>
              <option value="Cliente Ativo" ${c.status === 'Cliente Ativo' ? 'selected' : ''}>Cliente Ativo</option>
              <option value="Cliente Inativo" ${c.status === 'Cliente Inativo' ? 'selected' : ''}>Cliente Inativo</option>
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
      cpf: getData('cpf').replace(/\D/g, ''),
      email: getData('email'),
      contato: getData('contato').replace(/\D/g, ''),
      cep: getData('cep').replace(/\D/g, ''),
      endereco: getData('endereco'),
      cidadeUF: getData('cidadeUF'),
      complemento: getData('complemento'),
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
              <option value="Cliente Potencial">Cliente Potencial</option>
              <option value="Cliente Ativo">Cliente Ativo</option>
              <option value="Cliente Inativo">Cliente Inativo</option>
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
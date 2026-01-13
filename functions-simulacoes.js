console.log('✅ functions-simulacoes.js carregado');

// Objeto global para expor as funções
const Simulacoes = (function() {
  // Variáveis privadas
  let simulacoesData = [];
  let clientesData = [];
  let professoresData = [];
  let currentFilters = {};
  let editingSimulacao = null;
  
  // ==================== GERAÇÃO DE ID ====================
  
  // Função para gerar próximo ID de simulação (AAA → AAB → ...  → ZZZ)
  async function gerarProximoIdSimulacao() {
    try {
      const snapshot = await db.collection('simulacoes')
        .orderBy('idSimulacao', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return 'AAA'; // Primeiro ID
      }
      
      const ultimoId = snapshot.docs[0].data().idSimulacao;
      return incrementarIdSimulacao(ultimoId);
    } catch (error) {
      console.error('❌ Erro ao gerar ID de simulação:', error);
      return 'AAA';
    }
  }
  
  // Função para incrementar ID (AAA → AAB → AAC → ... → ABA → ...  → ZZZ)
  function incrementarIdSimulacao(id) {
    const letras = id.split('');
    let carry = true;
    
    for (let i = letras.length - 1; i >= 0 && carry; i--) {
      if (letras[i] === 'Z') {
        letras[i] = 'A';
      } else {
        letras[i] = String.fromCharCode(letras[i].charCodeAt(0) + 1);
        carry = false;
      }
    }
    
    return letras.join('');
  }
  
  // ==================== CÁLCULOS FINANCEIROS ====================
  
  // Função para calcular duração total e valores
  function calcularValoresSimulacao(aulas) {
    let SomatorioDuracaoAulas = 0;
    
    aulas.forEach(aula => {
      const duracao = parseDuracao(aula.duracao || '0h');
      SomatorioDuracaoAulas += duracao;
    });
    
    // Calcular valor por hora baseado na tabela progressiva
    let ValorHoraAulaPacote = 0;
    const horas = SomatorioDuracaoAulas;
    
    if (horas <= 4)                      ValorHoraAulaPacote = 65.00;
    else if (horas >= 5 && horas <= 9)   ValorHoraAulaPacote = 63.50;
    else if (horas >= 10 && horas <= 14) ValorHoraAulaPacote = 62.00;
    else if (horas >= 15 && horas <= 19) ValorHoraAulaPacote = 61.50;
    else if (horas >= 20)                ValorHoraAulaPacote = 60.50;
    
    const ValorPacote = ValorHoraAulaPacote * horas;
    const ValorEquipe = SomatorioDuracaoAulas * 35;
    const lucroMaster = ValorPacote - ValorEquipe;
    
    return {
      SomatorioDuracaoAulas,
      ValorPacote,
      ValorEquipe,
      lucroMaster
    };
  }
  
  // Função para parsear duração (ex: "2h30" → 2.5)
  function parseDuracao(duracaoStr) {
    if (!duracaoStr) return 0;
    
    const match = duracaoStr.match(/(\d+)h(\d+)?/);
    if (!match) return 0;
    
    const horas = parseInt(match[1]) || 0;
    const minutos = parseInt(match[2]) || 0;
    
    return horas + (minutos / 60);
  }
  
  // ==================== RENDERIZAÇÃO ====================
  
  // Função principal para carregar a seção de Simulações
  async function loadSimulacoes() {
    console.log('🚀 loadSimulacoes iniciado');
    
    const section = document.getElementById('simulacoes');
    
    if (!section) {
      console.error('❌ Seção simulacoes não encontrada');
      return;
    }
    
    // Estrutura da seção
    section.innerHTML = `
      <div class="space-y-4">
        <!-- Filtros -->
        <div class="filter-container p-3">
          <h3 class="font-lexend font-bold text-sm mb-3 text-orange-500">Filtrar Simulações</h3>
          
          <div class="filter-row-compact">
            <!-- Nome do Cliente -->
            <div class="filter-group">
              <label class="filter-label filter-label-compact">Nome do Cliente</label>
              <input type="text" id="filter-nome-cliente" class="filter-input filter-compact" placeholder="Digite o nome... ">
            </div>
            
            <!-- CPF -->
            <div class="filter-group">
              <label class="filter-label filter-label-compact">CPF</label>
              <input type="text" id="filter-cpf" class="filter-input filter-compact" placeholder="Digite o CPF..." maxlength="14">
            </div>
            
            <!-- Professor -->
            <div class="filter-group">
              <label class="filter-label filter-label-compact">Professor</label>
              <select id="filter-professor" class="filter-select filter-compact">
                <option value="">Todos os professores</option>
              </select>
            </div>
            
            <!-- Nome da Simulação -->
            <div class="filter-group">
              <label class="filter-label filter-label-compact">Nome da Simulação</label>
              <input type="text" id="filter-nome-simulacao" class="filter-input filter-compact" placeholder="Digite o título...">
            </div>
          </div>
          
          <div class="mt-3 flex gap-2">
            <button id="btn-aplicar-filtros-simulacoes" class="btn-primary btn-compact">
              <i class="fas fa-filter mr-2"></i>
              Aplicar Filtros
            </button>
            <button id="btn-limpar-filtros-simulacoes" class="btn-secondary btn-compact">
              <i class="fas fa-times mr-2"></i>
              Limpar Filtros
            </button>
          </div>
        </div>
        
        <!-- Header com título e botão -->
        <div class="flex justify-between items-center">
          <h3 class="font-lexend font-bold text-xl text-gray-700">Simulações</h3>
          <button id="btn-nova-simulacao" class="btn-primary">
            <i class="fas fa-plus mr-2"></i>
            Nova Simulação
          </button>
        </div>
        
        <!-- Container de Cards -->
        <div id="simulacoes-container">
          <div class="text-center py-12">
            <div class="loading-spinner-large mb-3"></div>
            <p class="text-orange-500 font-comfortaa font-bold">Carregando simulações...</p>
          </div>
        </div>
      </div>
    `;
    
    // Carregar dados
    await Promise.all([
      carregarSimulacoes(),
      carregarClientes(),
      carregarProfessores()
    ]);
    
    // Configurar eventos
    setupSimulacoesEvents();
    
    // Renderizar cards
    renderSimulacoesCards(simulacoesData);
    
    // Popular filtro de professores
    popularFiltroProfessores();
  }
  
  // Função para carregar simulações do Firebase
  async function carregarSimulacoes() {
    try {
      const snapshot = await db.collection('simulacoes')
        .orderBy('timestamp', 'desc')
        .get();
      
      simulacoesData = [];
      snapshot.forEach(doc => {
        simulacoesData.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('✅ Simulações carregadas:', simulacoesData.length);
    } catch (error) {
      console.error('❌ Erro ao carregar simulações:', error);
      showToast('❌ Erro ao carregar simulações', 'error');
    }
  }
  
  // Função para carregar clientes do Firebase
  async function carregarClientes() {
    try {
      const snapshot = await db.collection('cadastroClientes').get();
      
      clientesData = [];
      snapshot.forEach(doc => {
        clientesData.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('✅ Clientes carregados:', clientesData.length);
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
    }
  }
  
  // Função para carregar professores do Firebase
  async function carregarProfessores() {
    try {
      const snapshot = await db.collection('dataBaseProfessores').get();
      
      professoresData = [];
      snapshot.forEach(doc => {
        professoresData.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('✅ Professores carregados:', professoresData.length);
    } catch (error) {
      console.error('❌ Erro ao carregar professores:', error);
    }
  }
  
  // Função para popular o filtro de professores
  function popularFiltroProfessores() {
    const select = document.getElementById('filter-professor');
    if (!select) return;
    
    // Limpar opções anteriores (exceto "Todos")
    select.innerHTML = '<option value="">Todos os professores</option>';
    
    // Adicionar professores ordenados por nome
    const professoresOrdenados = [...professoresData].sort((a, b) => {
      const nomeA = a.nome || '';
      const nomeB = b.nome || '';
      return nomeA.localeCompare(nomeB);
    });
    
    professoresOrdenados.forEach(prof => {
      const option = document.createElement('option');
      option.value = prof.cpf || prof.id;
      option.textContent = prof.nome || 'Sem nome';
      select.appendChild(option);
    });
  }
  
  // Função para renderizar cards de simulações
  function renderSimulacoesCards(simulacoes, filters = {}) {
    console.log('🎴 Renderizando cards de simulações:', simulacoes.length);
    
    const container = document.getElementById('simulacoes-container');
    if (!container) {
      console.error('❌ Container simulacoes-container não encontrado');
      return;
    }
    
    if (!simulacoes || simulacoes.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <i class="fas fa-lightbulb text-4xl text-gray-300 mb-4"></i>
          <h3 class="font-lexend text-lg mb-2 text-gray-500">Nenhuma simulação encontrada</h3>
          <p class="text-gray-400 text-sm">Clique em "Nova Simulação" para começar.</p>
        </div>
      `;
      return;
    }
    
    // Aplicar filtros
    let filteredSimulacoes = applySimulacoesFilters([...simulacoes], filters);
    
    if (filteredSimulacoes. length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
          <h3 class="font-lexend text-lg mb-2 text-gray-500">Nenhuma simulação encontrada</h3>
          <p class="text-gray-400 text-sm mb-4">Nenhuma simulação corresponde aos filtros aplicados.</p>
          <button id="btn-limpar-filtros-inline" class="btn-secondary btn-compact">
            <i class="fas fa-times mr-2"></i>
            Limpar Filtros
          </button>
        </div>
      `;
      
      document.getElementById('btn-limpar-filtros-inline')?.addEventListener('click', () => {
        limparFiltros();
      });
      
      return;
    }
    
    // Criar grid de 4 colunas
    container.innerHTML = `
      <div class="mb-4">
        <h3 class="font-lexend font-bold text-base text-gray-700 mb-1">
          <span class="text-orange-500 text-lg">${filteredSimulacoes.length}</span> 
          simulação${filteredSimulacoes.length !== 1 ? 'ões' : ''} encontrada${filteredSimulacoes.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${filteredSimulacoes.map(sim => createSimulacaoCard(sim)).join('')}
      </div>
    `;
    
    // Adicionar eventos de clique nos cards
    filteredSimulacoes.forEach(sim => {
      const card = container.querySelector(`[data-simulacao-id="${sim.idSimulacao}"]`);
      if (card) {
        card.addEventListener('click', () => abrirModalSimulacao(sim));
      }
    });
  }
  
  // Função para criar um card de simulação
  function createSimulacaoCard(simulacao) {
    const valores = calcularValoresSimulacao(simulacao.aulas || []);
    const totalHoras = valores.SomatorioDuracaoAulas;
    const valorPacote = valores.ValorPacote;
    
    return `
      <div class="card cursor-pointer hover:shadow-lg transition-shadow" data-simulacao-id="${simulacao.idSimulacao}">
        <div class="p-4">
          <h3 class="font-lexend font-bold text-base text-gray-800 mb-2 line-clamp-2">
            ${escapeHtml(simulacao.tituloSimulacao || 'Sem título')}
          </h3>
          <p class="text-sm text-gray-600 mb-3">
            <i class="fas fa-user text-orange-500 mr-2"></i>
            ${escapeHtml(simulacao.nomeCliente || 'Cliente não definido')}
          </p>
          <div class="flex items-center justify-between">
            <span class="text-lg font-bold text-orange-500">
              ${totalHoras}h - R$ ${valorPacote.toFixed(2)}
            </span>
            <span class="text-xs text-gray-400">
              ${simulacao.idSimulacao}
            </span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Função de escape HTML
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  // ==================== FILTROS ====================
  
  // Função para aplicar filtros
  function applySimulacoesFilters(simulacoes, filters) {
    let filtered = simulacoes;
    
    // Filtro por nome do cliente
    if (filters.nomeCliente) {
      const searchTerm = filters.nomeCliente.toLowerCase();
      filtered = filtered.filter(sim => 
        (sim.nomeCliente || '').toLowerCase().includes(searchTerm)
      );
    }
    
    // Filtro por CPF
    if (filters.cpf) {
      const searchCpf = filters.cpf.replace(/\D/g, '');
      filtered = filtered.filter(sim => 
        (sim.cpf || '').replace(/\D/g, '').includes(searchCpf)
      );
    }
    
    // Filtro por professor
    if (filters.professor) {
      filtered = filtered.filter(sim => {
        if (!sim.aulas || sim.aulas.length === 0) return false;
        return sim.aulas.some(aula => 
          (aula.idProfessor || '') === filters.professor
        );
      });
    }
    
    // Filtro por nome da simulação
    if (filters.nomeSimulacao) {
      const searchTerm = filters.nomeSimulacao.toLowerCase();
      filtered = filtered.filter(sim => 
        (sim.tituloSimulacao || '').toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }
  
  // Função para configurar eventos dos botões
  function setupSimulacoesEvents() {
    // Botão Nova Simulação
    const btnNovaSimulacao = document.getElementById('btn-nova-simulacao');
    if (btnNovaSimulacao) {
      btnNovaSimulacao.addEventListener('click', () => {
        abrirModalNovaSimulacao();
      });
    }
    
    // Botão Aplicar Filtros
    const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros-simulacoes');
    if (btnAplicarFiltros) {
      btnAplicarFiltros.addEventListener('click', () => {
        const filters = {
          nomeCliente: document.getElementById('filter-nome-cliente').value,
          cpf: document.getElementById('filter-cpf').value,
          professor: document.getElementById('filter-professor').value,
          nomeSimulacao: document.getElementById('filter-nome-simulacao').value
        };
        
        currentFilters = filters;
        renderSimulacoesCards(simulacoesData, filters);
      });
    }
    
    // Botão Limpar Filtros
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros-simulacoes');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', () => {
        limparFiltros();
      });
    }
  }
  
  // Função para limpar filtros
  function limparFiltros() {
    document.getElementById('filter-nome-cliente').value = '';
    document.getElementById('filter-cpf').value = '';
    document.getElementById('filter-professor').value = '';
    document.getElementById('filter-nome-simulacao').value = '';
    
    currentFilters = {};
    renderSimulacoesCards(simulacoesData);
  }
  
  // ==================== MODAL ====================
  
  // Função para abrir modal de nova simulação
  async function abrirModalNovaSimulacao() {
    editingSimulacao = null;
    
    const idSimulacao = await gerarProximoIdSimulacao();
    
    const novaSimulacao = {
      idSimulacao:  idSimulacao,
      tituloSimulacao: '',
      nomeCliente: '',
      cpf: '',
      metodoPagamento: 'Pix completo',
      dataPrimeiraParcela: '',
      dataSegundaParcela: '',
      tipoEquipe: 'Manter Equipe',
      aulas: []
    };
    
    abrirModalSimulacao(novaSimulacao, true);
  }
  
  // Função para abrir modal de simulação (nova ou editar)
  function abrirModalSimulacao(simulacao, isNova = false) {
    editingSimulacao = simulacao;
    
    const valores = calcularValoresSimulacao(simulacao.aulas || []);
    
    const modalHtml = `
      <div class="modal-overlay" id="modal-simulacao">
        <div class="modal-container" style="max-width: 95vw; max-height: 90vh;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">
              ${isNova ? 'Nova Simulação' : escapeHtml(simulacao.tituloSimulacao || 'Editar Simulação')}
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Informações do Cliente -->
            <div class="mb-6">
              <h4 class="font-lexend font-bold text-base text-gray-700 mb-4">
                <i class="fas fa-user-circle text-orange-500 mr-2"></i>
                Informações do Cliente
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- Título da Simulação -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-heading text-orange-500 mr-1"></i>
                    Título da Simulação *
                  </label>
                  <input 
                    type="text" 
                    id="titulo-simulacao" 
                    value="${escapeHtml(simulacao.tituloSimulacao || '')}"
                    placeholder="Digite o título da simulação"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <!-- Nome do Cliente -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-user text-orange-500 mr-1"></i>
                    Nome do Cliente
                  </label>
                  <div class="relative">
                    <select 
                      id="select-cliente" 
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus: outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Selecione um cliente</option>
                      <option value="__novo__">➕ Novo Cliente</option>
                      ${clientesData.map(c => `
                        <option value="${c. id}" ${c.nome === simulacao.nomeCliente ? 'selected' : ''}>
                          ${escapeHtml(c.nome || 'Sem nome')}
                        </option>
                      `).join('')}
                    </select>
                    <input 
                      type="text" 
                      id="input-novo-cliente" 
                      placeholder="Digite o nome do novo cliente"
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 hidden"
                    />
                  </div>
                  <button id="btn-adicionar-cliente" class="btn-secondary btn-compact mt-2 hidden">
                    <i class="fas fa-check mr-2"></i>
                    Adicionar
                  </button>
                </div>
                
                <!-- CPF -->
                <div style="display:none;">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-id-card text-orange-500 mr-1"></i>
                    CPF
                  </label>
                  <input 
                    type="text" 
                    id="cpf-cliente" 
                    value="${simulacao.cpf || ''}"
                    placeholder="CPF do cliente"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus: outline-none focus:ring-2 focus:ring-orange-500 bg-gray-100"
                    readonly
                  />
                </div>
                
                <!-- Método de Pagamento -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-credit-card text-orange-500 mr-1"></i>
                    Método de Pagamento
                  </label>
                  <select 
                    id="metodo-pagamento" 
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus: ring-orange-500"
                  >
                    <option value="Pix completo" ${simulacao.metodoPagamento === 'Pix completo' ? 'selected' : ''}>Pix completo</option>
                    <option value="Pix parcelado" ${simulacao.metodoPagamento === 'Pix parcelado' ? 'selected' : ''}>Pix parcelado</option>
                    <option value="Cartão de crédito" ${simulacao.metodoPagamento === 'Cartão de crédito' ? 'selected' : ''}>Cartão de crédito</option>
                  </select>
                </div>
                
                <!-- Data da Primeira Parcela -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-calendar-alt text-orange-500 mr-1"></i>
                    Data da primeira parcela
                  </label>
                  <input 
                    type="text" 
                    id="data-primeira-parcela" 
                    value="${simulacao.dataPrimeiraParcela || ''}"
                    placeholder="dd/mm/aaaa"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    maxlength="10"
                  />
                </div>
                
                <!-- Data da Segunda Parcela -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-calendar-day text-orange-500 mr-1"></i>
                    Data da segunda parcela
                  </label>
                  <input 
                    type="text" 
                    id="data-segunda-parcela" 
                    value="${simulacao.dataSegundaParcela || ''}"
                    placeholder="dd/mm/aaaa"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    maxlength="10"
                  />
                </div>
                
                <!-- Tipo de Equipe -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    <i class="fas fa-users text-orange-500 mr-1"></i>
                    Tipo de Equipe
                  </label>
                  <select 
                    id="tipo-equipe" 
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Manter Equipe" ${simulacao.tipoEquipe === 'Manter Equipe' ? 'selected' : ''}>Manter Equipe</option>
                    <option value="Sem preferência de Equipe" ${simulacao.tipoEquipe === 'Sem preferência de Equipe' ?  'selected' : ''}>Sem preferência de Equipe</option>
                  </select>
                </div>
              </div>
              
              <!-- Valores Calculados -->
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-orange-50 rounded-lg">
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Total de Horas</div>
                  <div class="text-lg font-bold text-orange-600" id="display-total-horas">
                    ${valores.SomatorioDuracaoAulas}h
                  </div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Valor do Pacote</div>
                  <div class="text-lg font-bold text-orange-600" id="display-valor-pacote">
                    R$ ${valores.ValorPacote.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Valor da Equipe</div>
                  <div class="text-lg font-bold text-gray-600" id="display-valor-equipe">
                    R$ ${valores.ValorEquipe.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Lucro Master</div>
                  <div class="text-lg font-bold text-green-600" id="display-lucro-master">
                    R$ ${valores.lucroMaster.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Aulas Agendadas -->
            <div>
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-lexend font-bold text-base text-gray-700">
                  <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>
                  Aulas Agendadas
                </h4>
                <div class="flex gap-2">
                  <button id="btn-remover-aula-simulacao" class="btn-secondary btn-compact">
                    <i class="fas fa-trash mr-2"></i>
                    Remover aula
                  </button>
                  <button id="btn-adicionar-aula-simulacao" class="btn-primary btn-compact">
                    <i class="fas fa-plus mr-2"></i>
                    Adicionar aula
                  </button>
                </div>
              </div>
              
              <div class="table-container-double-scroll">
                <div class="table-wrapper vertical-scroll-hidden">
                  <table class="table-details" id="tabela-aulas-simulacao">
                    <thead>
                      <tr>
                        <th>Data da aula</th>
                        <th>Horário de Início</th>
                        <th>Duração</th>
                        <th>Matéria</th>
                        <th>Estudante</th>
                        <th>Professor</th>
                        <th class="text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody id="tbody-aulas-simulacao">
                      ${renderAulasSimulacao(simulacao.aulas || [])}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            ${! isNova ? `
              <button id="btn-excluir-simulacao" class="btn-secondary btn-compact text-red-600 hover:bg-red-50">
                <i class="fas fa-trash mr-2"></i>
                Excluir Simulação
              </button>
            ` : ''}
            <button id="btn-salvar-simulacao" class="btn-compact rounded-lg border-2 border-orange-500 text-orange-500 hover:bg-orange-50">
              <i class="fas fa-save mr-2"></i>
              ${isNova ? 'Salvar Simulação' : 'Atualizar Simulação'}
            </button>
            <button id="btn-enviar-simulacao" class="btn-primary btn-compact">
              <i class="fas fa-paper-plane mr-2"></i>
              Enviar simulação
            </button>
            <button id="btn-aprovar-simulacao" class="btn-primary btn-compact">
              <i class="fas fa-check-circle mr-2"></i>
              Aprovar Simulação
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = document.getElementById('modal-simulacao');
    
    // Configurar eventos do modal
    setupModalEvents(modal, isNova);
    
    // Aplicar máscaras
    aplicarMascarasModal();
  }
  
  // Função para renderizar tabela de aulas na simulação
  function renderAulasSimulacao(aulas) {
    if (!aulas || aulas.length === 0) {
      return `
        <tr>
          <td colspan="7" class="text-center py-8 text-gray-500 text-sm">
            <i class="fas fa-calendar-plus text-3xl text-gray-300 mb-3"></i>
            <p>Nenhuma aula adicionada</p>
            <p class="text-xs mt-1">Clique em "Adicionar aula" para começar</p>
          </td>
        </tr>
      `;
    }
    
    return aulas.map((aula, index) => `
      <tr data-aula-index="${index}">
        <td>
          <button type="button" class="btn-data-aula-sim text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-index="${index}" data-data="${aula.data || ''}" title="Clique para alterar a data">
            ${aula.data || '--'}
          </button>
        </td>
        <td class="text-center">
          <button type="button" class="btn-horario-aula-sim text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-index="${index}" data-horario="${aula.horario || ''}" title="Clique para alterar o horário">
            ${aula.horario || '--'}
          </button>
        </td>
        <td class="text-center">
          <button type="button" class="btn-duracao-aula-sim text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-index="${index}" data-duracao="${aula.duracao || ''}" title="Clique para alterar a duração">
            ${aula.duracao || '--'}
          </button>
        </td>
        <td>
          <button type="button" class="btn-materia-aula-sim text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-index="${index}" data-materia="${escapeHtml(aula.materia || '')}" title="Clique para alterar a matéria">
            ${escapeHtml(aula.materia) || '--'}
          </button>
        </td>
        <td>
          <button type="button" class="btn-estudante-aula-sim text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-index="${index}" data-estudante="${escapeHtml(aula.estudante || '')}" title="Clique para alterar o estudante">
            ${escapeHtml(aula.estudante) || '--'}
          </button>
        </td>
        <td>
          <button type="button" class="btn-professor-aula-sim text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors ${!aula.professor || aula.professor === 'A definir' ? 'text-orange-500 font-semibold' : ''}" data-index="${index}" data-professor="${aula.professor || 'A definir'}" data-id-professor="${aula.idProfessor || ''}" title="Clique para alterar o professor">
            ${aula.professor || 'A definir'}
          </button>
        </td>
        <td class="text-center">
          <button class="btn-copiar-aula text-blue-500 hover:text-blue-700 mr-2" data-index="${index}" title="Copiar aula">
            <i class="fas fa-copy"></i>
          </button>
          <button class="btn-excluir-aula text-red-500 hover:text-red-700" data-index="${index}" title="Excluir aula">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  // ==================== EVENTOS DO MODAL ====================
  
  // Função para configurar eventos do modal
  function setupModalEvents(modal, isNova) {
      const btnEnviar = modal.querySelector('#btn-enviar-simulacao');
        // Enviar simulação
        btnEnviar.addEventListener('click', () => {
          abrirModalEnviarSimulacao();
        });
    // Modal de Enviar Simulação
    function abrirModalEnviarSimulacao() {
      // Obter dados da simulação atual
      const nomeCliente = document.getElementById('select-cliente')?.selectedOptions[0]?.textContent || '--';
      const valorPacote = document.getElementById('display-valor-pacote')?.textContent?.trim() || '--';
      const dataPrimeiraParcela = document.getElementById('data-primeira-parcela')?.value || '--';
      const dataSegundaParcela = document.getElementById('data-segunda-parcela')?.value || '--';
      // Calcular total de horas
      let totalHoras = 0;
      const aulas = [];
      document.querySelectorAll('#tbody-aulas-simulacao tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length > 0) {
          // Espera-se: Data, Horário, Duração, Matéria, Professor, Estudante
          const duracaoStr = tds[2]?.textContent?.trim() || '';
          let horas = 0, minutos = 0;
          if (duracaoStr.includes('h')) {
            const partes = duracaoStr.split('h');
            horas = parseInt(partes[0]) || 0;
            if (partes[1]) minutos = parseInt(partes[1]) || 0;
          }
          totalHoras += horas + (minutos / 60);
          aulas.push({
            data: tds[0]?.textContent?.trim() || '',
            horario: tds[1]?.textContent?.trim() || '',
            duracao: tds[2]?.textContent?.trim() || '',
            materia: tds[3]?.textContent?.trim() || '',
            professor: tds[4]?.textContent?.trim() || '',
            estudante: tds[5]?.textContent?.trim() || ''
          });
        }
      });

      // Converter totalHoras para formato 4h ou 4h30
      const horasInt = Math.floor(totalHoras);
      const minutos = Math.round((totalHoras - horasInt) * 60);
      let totalHorasFormatado = '';
      if (minutos === 0) {
        totalHorasFormatado = `${horasInt}h`;
      } else {
        totalHorasFormatado = `${horasInt}h${minutos}`;
      }

      // Montar tabela HTML (sem coluna ações)
      let linhasAulas = '';
      aulas.forEach(aula => {
        linhasAulas += `<tr>
          <td class="py-2 px-3 text-sm border-r border-gray-200">${aula.data}</td>
          <td class="py-2 px-3 text-sm text-center border-r border-gray-200">${aula.horario}</td>
          <td class="py-2 px-3 text-sm text-center border-r border-gray-200">${aula.duracao}</td>
          <td class="py-2 px-3 text-sm border-r border-gray-200">${aula.materia}</td>
          <td class="py-2 px-3 text-sm border-r border-gray-200">${aula.professor}</td>
          <td class="py-2 px-3 text-sm">${aula.estudante}</td>
        </tr>`;
      });

      const modalHtml = `
        <div class="modal-overlay" id="modal-enviar-simulacao" style="z-index: 10001;">
          <div class="modal-container max-w-3xl">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-xl text-gray-800">
                <i class="fas fa-paper-plane text-orange-500 mr-2"></i>
                Enviar simulação
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-body">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">Nome do Cliente</p>
                  <p class="text-sm font-semibold text-gray-800">${nomeCliente}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">Valor do Pacote</p>
                  <p class="text-sm font-semibold text-gray-800">${valorPacote}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">Total de Horas</p>
                  <p class="text-sm font-semibold text-gray-800">${totalHorasFormatado}</p>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">Data da Primeira Parcela</p>
                  <p class="text-sm font-semibold text-gray-800">${dataPrimeiraParcela}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">Data da Segunda Parcela</p>
                  <p class="text-sm font-semibold text-gray-800">${dataSegundaParcela}</p>
                </div>
                <div></div>
              </div>
              <div class="overflow-x-auto border border-gray-200 rounded-lg">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                      <th class="py-3 px-3 text-xs font-semibold border-r border-orange-400">Data da Aula</th>
                      <th class="py-3 px-3 text-xs font-semibold text-center border-r border-orange-400">Horário</th>
                      <th class="py-3 px-3 text-xs font-semibold text-center border-r border-orange-400">Duração</th>
                      <th class="py-3 px-3 text-xs font-semibold border-r border-orange-400">Matéria</th>
                      <th class="py-3 px-3 text-xs font-semibold border-r border-orange-400">Professor</th>
                      <th class="py-3 px-3 text-xs font-semibold">Estudante</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhasAulas}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btn-fechar-enviar-simulacao" class="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = document.getElementById('modal-enviar-simulacao');
      modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
      modal.querySelector('#btn-fechar-enviar-simulacao').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }
    const btnSalvar = modal.querySelector('#btn-salvar-simulacao');
    const btnAprovar = modal.querySelector('#btn-aprovar-simulacao');
    const btnExcluir = modal.querySelector('#btn-excluir-simulacao');
    const btnAdicionarAula = modal.querySelector('#btn-adicionar-aula-simulacao');
    const btnRemoverAula = modal.querySelector('#btn-remover-aula-simulacao');
    const selectCliente = modal.querySelector('#select-cliente');
    const inputNovoCliente = modal.querySelector('#input-novo-cliente');
    const btnAdicionarCliente = modal.querySelector('#btn-adicionar-cliente');
    
    // Fechar modal
    const closeModal = () => {
      modal.remove();
    };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Salvar simulação
    btnSalvar.addEventListener('click', () => salvarSimulacao(isNova, closeModal));
    
    // Aprovar simulação
    btnAprovar.addEventListener('click', () => aprovarSimulacao(closeModal));
    
    // Excluir simulação
    if (btnExcluir) {
      btnExcluir.addEventListener('click', () => excluirSimulacao(closeModal));
    }
    
    // Adicionar aula
    btnAdicionarAula.addEventListener('click', adicionarNovaAula);
    
    // Remover aula
    if (btnRemoverAula) {
      btnRemoverAula.addEventListener('click', () => {
        abrirModalRemoverAulaSimulacao();
      });
    }
    
    // Seleção de cliente
    selectCliente.addEventListener('change', (e) => {
      if (e.target.value === '__novo__') {
        inputNovoCliente.classList.remove('hidden');
        btnAdicionarCliente.classList.remove('hidden');
        selectCliente.classList.add('hidden');
        document.getElementById('cpf-cliente').value = '';
      } else if (e.target.value) {
        const cliente = clientesData.find(c => c.id === e. target.value);
        if (cliente) {
          document.getElementById('cpf-cliente').value = cliente.cpf || '';
        }
      } else {
        document.getElementById('cpf-cliente').value = '';
      }
    });
    
    // Adicionar novo cliente
    btnAdicionarCliente.addEventListener('click', () => {
      const nomeNovoCliente = inputNovoCliente.value.trim();
      if (nomeNovoCliente) {
        // Voltar para select e resetar
        selectCliente.classList.remove('hidden');
        inputNovoCliente.classList.add('hidden');
        btnAdicionarCliente.classList. add('hidden');
        
        // Adicionar opção temporária
        const option = document.createElement('option');
        option.value = '__temp__';
        option.textContent = nomeNovoCliente;
        option.selected = true;
        selectCliente.appendChild(option);
        
        // Limpar CPF
        document.getElementById('cpf-cliente').value = '';
        
        inputNovoCliente.value = '';
      }
    });
    
    // Eventos de alteração nos inputs das aulas
    setupAulasInputEvents();
  }
  
  // Função para configurar eventos dos inputs das aulas
  function setupAulasInputEvents() {
    const tbody = document.getElementById('tbody-aulas-simulacao');
    if (!tbody) return;
    
    // Botões de data
    tbody.querySelectorAll('.btn-data-aula-sim').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        const dataAtual = this.dataset.data;
        showDataModalSimulacao(index, dataAtual);
      });
    });
    
    // Botões de horário
    tbody.querySelectorAll('.btn-horario-aula-sim').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        const horarioAtual = this.dataset.horario;
        showHorarioModalSimulacao(index, horarioAtual);
      });
    });
    
    // Botões de duração
    tbody.querySelectorAll('.btn-duracao-aula-sim').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        const duracaoAtual = this.dataset.duracao;
        showDuracaoModalSimulacao(index, duracaoAtual);
      });
    });
    
    // Botões de matéria
    tbody.querySelectorAll('.btn-materia-aula-sim').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        const materiaAtual = this.dataset.materia;
        showMateriaModalSimulacao(index, materiaAtual);
      });
    });
    
    // Botões de estudante
    tbody.querySelectorAll('.btn-estudante-aula-sim').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        const estudanteAtual = this.dataset.estudante;
        showEstudanteModalSimulacao(index, estudanteAtual);
      });
    });
    
    // Botões de professor
    tbody.querySelectorAll('.btn-professor-aula-sim').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        const professorAtual = this.dataset.professor;
        const idProfessorAtual = this.dataset.idProfessor;
        showProfessorModalSimulacao(index, professorAtual, idProfessorAtual);
      });
    });
    
    // Botões de copiar
    tbody.querySelectorAll('.btn-copiar-aula').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        copiarAula(index);
      });
    });
    
    // Botões de excluir
    tbody.querySelectorAll('.btn-excluir-aula').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        excluirAula(index);
      });
    });
  }
  
  // Função para adicionar nova aula
  function adicionarNovaAula() {
    if (!editingSimulacao.aulas) {
      editingSimulacao.aulas = [];
    }
    
    editingSimulacao.aulas.push({
      'id-Aula': '',
      idProfessor: '',
      professor: 'A definir',
      materia: '',
      estudante: '',
      duracao: '',
      data: '',
      horario: ''
    });
    
    // Re-renderizar tabela
    const tbody = document.getElementById('tbody-aulas-simulacao');
    tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
    
    // Reaplicar eventos
    setupAulasInputEvents();
    
    // Aplicar máscara nas datas
    aplicarMascarasModal();
    
    recalcularValores();
  }
  
  // ==================== MODAIS DE EDIÇÃO DE AULAS ====================
  
  // Função para abrir modal de data (simulação)
  function showDataModalSimulacao(index, dataAtual) {
    // Parsear data atual (formato: "dd/mm/aaaa" ou "seg - 10/01/2026")
    let dataObj = new Date();
    if (dataAtual) {
      const match = dataAtual.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        dataObj = new Date(match[3], match[2] - 1, match[1]);
      }
    }
    
    const currentMonth = dataObj.getMonth();
    const currentYear = dataObj.getFullYear();
    const selectedDay = dataObj.getDate();
    
    const modalHtml = `
      <div class="modal-overlay" id="modalDataSim" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>
              Data da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="calendar-container">
              <div class="calendar-header flex items-center justify-between mb-4 px-2">
                <button type="button" id="prevMonth" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <i class="fas fa-chevron-left text-gray-600"></i>
                </button>
                <div class="font-lexend font-bold text-base text-gray-700" id="monthYear"></div>
                <button type="button" id="nextMonth" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <i class="fas fa-chevron-right text-gray-600"></i>
                </button>
              </div>
              
              <div class="calendar-weekdays grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-500">
                <div>Dom</div>
                <div>Seg</div>
                <div>Ter</div>
                <div>Qua</div>
                <div>Qui</div>
                <div>Sex</div>
                <div>Sáb</div>
              </div>
              
              <div id="calendarDays" class="calendar-days grid grid-cols-7 gap-1"></div>
              
              <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="text-sm text-gray-600">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  <span>Data atual: <strong>${dataAtual || 'Não definida'}</strong></span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                  <i class="fas fa-mouse-pointer text-orange-500 mr-2"></i>
                  <span>Data selecionada: <strong id="selectedDate">${dataAtual || 'Selecione uma data'}</strong></span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarData" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#modalDataSim');
    const btnCancelar = modal.querySelector('#btnCancelarData');
    const btnClose = modal.querySelector('.modal-close');
    const monthYearEl = modal.querySelector('#monthYear');
    const calendarDaysEl = modal.querySelector('#calendarDays');
    const selectedDateEl = modal.querySelector('#selectedDate');
    const prevMonthBtn = modal.querySelector('#prevMonth');
    const nextMonthBtn = modal.querySelector('#nextMonth');
    
    let displayMonth = currentMonth;
    let displayYear = currentYear;
    let selectedDate = dataObj;
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    const formatDate = (date) => {
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const diaSemana = diasSemana[date.getDay()];
      return `${diaSemana} - ${dia}/${mes}/${ano}`;
    };
    
    const renderCalendar = () => {
      monthYearEl.textContent = `${meses[displayMonth]} ${displayYear}`;
      calendarDaysEl.innerHTML = '';
      
      const firstDay = new Date(displayYear, displayMonth, 1).getDay();
      const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Dias vazios antes do primeiro dia do mês
      for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day-empty h-10';
        calendarDaysEl.appendChild(emptyDay);
      }
      
      // Dias do mês
      for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('button');
        dayEl.type = 'button';
        dayEl.className = 'calendar-day h-10 rounded-lg text-sm font-medium transition-all hover:bg-orange-100 hover:text-orange-600';
        dayEl.textContent = day;
        
        const dayDate = new Date(displayYear, displayMonth, day);
        dayDate.setHours(0, 0, 0, 0);
        
        // Verificar se é o dia selecionado
        if (selectedDate && 
            dayDate.getDate() === selectedDate.getDate() && 
            dayDate.getMonth() === selectedDate.getMonth() && 
            dayDate.getFullYear() === selectedDate.getFullYear()) {
          dayEl.classList.add('bg-orange-500', 'text-white', 'font-bold', 'shadow-md');
          dayEl.classList.remove('hover:bg-orange-100', 'hover:text-orange-600');
        }
        // Verificar se é hoje
        else if (dayDate.getTime() === today.getTime()) {
          dayEl.classList.add('border-2', 'border-orange-500', 'text-orange-500');
        } else {
          dayEl.classList.add('text-gray-700');
        }
        
        dayEl.addEventListener('click', () => {
          selectedDate = new Date(displayYear, displayMonth, day);
          const newDateFormatted = formatDate(selectedDate);
          selectedDateEl.textContent = newDateFormatted;
          
          // Atualizar a aula e recarregar tabela
          editingSimulacao.aulas[index].data = newDateFormatted;
          const tbody = document.getElementById('tbody-aulas-simulacao');
          tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
          setupAulasInputEvents();
          
          showToast(`✅ Data alterada para ${newDateFormatted}`, 'success');
          closeModal();
        });
        
        calendarDaysEl.appendChild(dayEl);
      }
    };
    
    prevMonthBtn.addEventListener('click', () => {
      displayMonth--;
      if (displayMonth < 0) {
        displayMonth = 11;
        displayYear--;
      }
      renderCalendar();
    });
    
    nextMonthBtn.addEventListener('click', () => {
      displayMonth++;
      if (displayMonth > 11) {
        displayMonth = 0;
        displayYear++;
      }
      renderCalendar();
    });
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
    
    // Renderizar calendário inicial
    renderCalendar();
  }
  
  // Função para abrir modal de horário (simulação)
  function showHorarioModalSimulacao(index, horarioAtual) {
    const modalHtml = `
      <div class="modal-overlay" id="modalHorarioSim" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-clock text-orange-500 mr-2"></i>
              Horário da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  Horário atual: <strong>${horarioAtual || 'Não definido'}</strong>
                </label>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-edit text-orange-500 mr-2"></i>
                  Selecione o novo horário:
                </label>
                <input 
                  type="time" 
                  id="inputHorario" 
                  value="${horarioAtual || ''}"
                  class="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p class="text-sm text-gray-600">
                  <i class="fas fa-lightbulb text-orange-500 mr-2"></i>
                  <span>Selecione o horário desejado e clique em "Confirmar Alteração"</span>
                </p>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarHorario" class="btn-secondary btn-compact">
              Cancelar
            </button>
            <button id="btnConfirmarHorario" class="btn-primary btn-compact">
              <i class="fas fa-check mr-2"></i>
              Confirmar Alteração
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#modalHorarioSim');
    const btnCancelar = modal.querySelector('#btnCancelarHorario');
    const btnConfirmar = modal.querySelector('#btnConfirmarHorario');
    const btnClose = modal.querySelector('.modal-close');
    const inputHorario = modal.querySelector('#inputHorario');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    btnConfirmar.addEventListener('click', () => {
      const novoHorario = inputHorario.value;
      
      if (!novoHorario) {
        showToast('⚠️ Por favor, selecione um horário', 'error');
        return;
      }
      
      if (novoHorario === horarioAtual) {
        showToast('ℹ️ Este já é o horário atual da aula', 'info');
        return;
      }
      
      editingSimulacao.aulas[index].horario = novoHorario;
      const tbody = document.getElementById('tbody-aulas-simulacao');
      tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
      setupAulasInputEvents();
      
      showToast(`✅ Horário alterado para ${novoHorario}`, 'success');
      closeModal();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
    
    // Focar no input
    setTimeout(() => inputHorario.focus(), 100);
  }
  
  // Função para abrir modal de duração (simulação)
  function showDuracaoModalSimulacao(index, duracaoAtual) {
    const opcoesDuracao = ['1h00', '1h30', '2h00', '2h30', '3h00'];
    
    const opcoesHtml = opcoesDuracao.map(duracao => {
      const isAtual = duracao === duracaoAtual;
      const buttonClass = isAtual 
        ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
      
      return `
        <button 
          class="duracao-option-btn ${buttonClass} border-2 rounded-lg px-6 py-3 font-medium transition-all duration-200 transform hover:scale-105"
          data-duracao="${duracao}"
        >
          ${duracao}
          ${isAtual ? '<i class="fas fa-check ml-2"></i>' : ''}
        </button>
      `;
    }).join('');
    
    const modalHtml = `
      <div class="modal-overlay" id="modalDuracaoSim" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-hourglass-half text-orange-500 mr-2"></i>
              Duração da aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="space-y-4">
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p class="text-sm text-gray-700">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  Duração atual: <strong class="text-orange-600">${duracaoAtual || 'Não definida'}</strong>
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">
                  Selecione a nova duração:
                </label>
                <div class="flex flex-col gap-3">
                  ${opcoesHtml}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarDuracao" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#modalDuracaoSim');
    const btnCancelar = modal.querySelector('#btnCancelarDuracao');
    const btnClose = modal.querySelector('.modal-close');
    const btnOpcoes = modal.querySelectorAll('.duracao-option-btn');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    btnOpcoes.forEach(btn => {
      btn.addEventListener('click', () => {
        const novaDuracao = btn.dataset.duracao;
        
        if (novaDuracao === duracaoAtual) {
          showToast('ℹ️ Esta já é a duração atual da aula', 'info');
          return;
        }
        
        editingSimulacao.aulas[index].duracao = novaDuracao;
        const tbody = document.getElementById('tbody-aulas-simulacao');
        tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
        setupAulasInputEvents();
        recalcularValores();
        
        showToast(`✅ Duração alterada para ${novaDuracao}`, 'success');
        closeModal();
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para abrir modal de matéria (simulação)
  function showMateriaModalSimulacao(index, materiaAtual) {
    const materias = [
      "Biologia", "Ciências", "Filosofia", "Física", "Geografia",
      "História", "Língua Portuguesa", "Língua Inglesa", "Matemática", 
      "Química", "Sociologia", "Pedagogia"
    ].sort();
    
    const opcoesHtml = materias.map(materia => {
      const isAtual = materia === materiaAtual;
      const buttonClass = isAtual 
        ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
      
      return `
        <button 
          class="materia-option-btn ${buttonClass} border-2 rounded-lg px-4 py-3 font-medium transition-all duration-200 transform hover:scale-105 text-sm whitespace-nowrap"
          data-materia="${materia}"
        >
          ${materia}
          ${isAtual ? '<i class="fas fa-check ml-2"></i>' : ''}
        </button>
      `;
    }).join('');
    
    const modalHtml = `
      <div class="modal-overlay" id="modalMateriaSim" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 900px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-book text-orange-500 mr-2"></i>
              Matéria da aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
            <div class="space-y-4">
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p class="text-sm text-gray-700">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  Matéria atual: <strong class="text-orange-600">${materiaAtual || 'Não definida'}</strong>
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">
                  Selecione a nova matéria:
                </label>
                <div class="grid grid-cols-4 gap-3">
                  ${opcoesHtml}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarMateria" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#modalMateriaSim');
    const btnCancelar = modal.querySelector('#btnCancelarMateria');
    const btnClose = modal.querySelector('.modal-close');
    const btnOpcoes = modal.querySelectorAll('.materia-option-btn');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    btnOpcoes.forEach(btn => {
      btn.addEventListener('click', () => {
        const novaMateria = btn.dataset.materia;
        
        if (novaMateria === materiaAtual) {
          showToast('ℹ️ Esta já é a matéria atual da aula', 'info');
          return;
        }
        
        editingSimulacao.aulas[index].materia = novaMateria;
        const tbody = document.getElementById('tbody-aulas-simulacao');
        tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
        setupAulasInputEvents();
        
        showToast(`✅ Matéria alterada para ${novaMateria}`, 'success');
        closeModal();
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para abrir modal de estudante (simulação)
  function showEstudanteModalSimulacao(index, estudanteAtual) {
    // Buscar CPF do cliente selecionado
    const selectCliente = document.getElementById('select-cliente');
    let clienteEstudantes = [];
    let cpfCliente = '';
    
    if (selectCliente && selectCliente.value && selectCliente.value !== '__novo__' && selectCliente.value !== '__temp__') {
      const cliente = clientesData.find(c => c.id === selectCliente.value);
      if (cliente && cliente.cpf) {
        cpfCliente = cliente.cpf;
        // Verificar se existe array de estudantes
        if (cliente.estudantes && Array.isArray(cliente.estudantes)) {
          clienteEstudantes = cliente.estudantes
            .filter(est => est.nome && est.nome.trim() !== '')
            .map(est => est.nome)
            .sort();
        }
      }
    }
    
    // Se houver estudantes do cliente, mostrar select com busca
    if (clienteEstudantes.length > 0) {
      const modalHtml = `
        <div class="modal-overlay" id="modalEstudanteSim" style="z-index: 10000;">
          <div class="modal-container" style="max-width: 650px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">
                <i class="fas fa-user-graduate text-orange-500 mr-2"></i>
                Selecione Estudante
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="space-y-5">
                <div class="bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                  <p class="text-sm text-gray-700 flex items-center">
                    <i class="fas fa-user-graduate text-orange-500 mr-3 text-lg"></i>
                    <span>Estudante atual: <strong class="text-orange-600 ml-1">${estudanteAtual || 'Não definido'}</strong></span>
                  </p>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-search text-orange-500 mr-2"></i>
                    Buscar estudante
                  </label>
                  <div class="relative">
                    <input 
                      type="text" 
                      id="inputBuscaEstudante" 
                      placeholder="Digite o nome do estudante..."
                      class="w-full border-2 border-gray-300 rounded-lg pl-11 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <i class="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-list-ul text-orange-500 mr-2"></i>
                    Lista de estudantes do cliente
                  </label>
                  <select 
                    id="selectEstudante" 
                    class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-inner"
                    size="10"
                    style="min-height: 280px;"
                  >
                    ${clienteEstudantes.map(nome => `
                      <option value="${escapeHtml(nome)}" ${nome === estudanteAtual ? 'selected' : ''} style="padding: 8px;">
                        ${escapeHtml(nome)}
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btnCancelarEstudante" class="btn-secondary btn-compact">
                Cancelar
              </button>
              <button id="btnConfirmarEstudante" class="btn-primary btn-compact">
                <i class="fas fa-check mr-2"></i>
                Confirmar Seleção
              </button>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer);
      
      const modal = modalContainer.querySelector('#modalEstudanteSim');
      const btnCancelar = modal.querySelector('#btnCancelarEstudante');
      const btnConfirmar = modal.querySelector('#btnConfirmarEstudante');
      const btnClose = modal.querySelector('.modal-close');
      const inputBusca = modal.querySelector('#inputBuscaEstudante');
      const selectEstudante = modal.querySelector('#selectEstudante');
      const inputNovoEstudante = modal.querySelector('#inputNovoEstudante');
      
      // Array com todas as opções originais
      const todasOpcoes = Array.from(selectEstudante.options);
      
      // Função para filtrar estudantes
      inputBusca.addEventListener('input', function() {
        const termoBusca = this.value.toLowerCase().trim();
        
        // Limpar select
        selectEstudante.innerHTML = '';
        
        // Filtrar e adicionar opções
        const opcoesFiltradas = todasOpcoes.filter(opcao => {
          const texto = opcao.textContent.toLowerCase();
          return texto.includes(termoBusca);
        });
        
        opcoesFiltradas.forEach(opcao => {
          selectEstudante.appendChild(opcao.cloneNode(true));
        });
      });
      
      const closeModal = () => {
        modalContainer.remove();
      };
      
      btnCancelar.addEventListener('click', closeModal);
      btnClose.addEventListener('click', closeModal);
      
      btnConfirmar.addEventListener('click', () => {
        // Usar o selecionado
        const selectedOption = selectEstudante.value;
        if (!selectedOption) {
          showToast('⚠️ Por favor, selecione um estudante', 'error');
          return;
        }
        if (selectedOption === estudanteAtual) {
          showToast('ℹ️ Este já é o estudante atual da aula', 'info');
          return;
        }
        editingSimulacao.aulas[index].estudante = selectedOption;
        const tbody = document.getElementById('tbody-aulas-simulacao');
        tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
        setupAulasInputEvents();
        showToast(`✅ Estudante alterado para ${selectedOption}`, 'success');
        closeModal();
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      
      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);
      modalContainer.addEventListener('remove', () => {
        document.removeEventListener('keydown', escHandler);
      });
      
      // Focar no campo de busca
      setTimeout(() => inputBusca.focus(), 100);
      
    } else {
      // Fallback: Sem cliente ou sem estudantes - mostrar input livre
      const modalHtml = `
        <div class="modal-overlay" id="modalEstudanteSim" style="z-index: 10000;">
          <div class="modal-container" style="max-width: 420px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">
                <i class="fas fa-user-graduate text-orange-500 mr-2"></i>
                Estudante da Aula
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                    Estudante atual: <strong>${estudanteAtual || 'Não definido'}</strong>
                  </label>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-edit text-orange-500 mr-2"></i>
                    Digite o nome do estudante:
                  </label>
                  <input 
                    type="text" 
                    id="inputEstudante" 
                    value="${estudanteAtual || ''}"
                    placeholder="Nome do estudante"
                    class="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p class="text-sm text-gray-600">
                    <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                    <span>Nenhum cliente selecionado ou cliente sem estudantes cadastrados</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btnCancelarEstudante" class="btn-secondary btn-compact">
                Cancelar
              </button>
              <button id="btnConfirmarEstudante" class="btn-primary btn-compact">
                <i class="fas fa-check mr-2"></i>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer);
      
      const modal = modalContainer.querySelector('#modalEstudanteSim');
      const btnCancelar = modal.querySelector('#btnCancelarEstudante');
      const btnConfirmar = modal.querySelector('#btnConfirmarEstudante');
      const btnClose = modal.querySelector('.modal-close');
      const inputEstudante = modal.querySelector('#inputEstudante');
      
      const closeModal = () => {
        modalContainer.remove();
      };
      
      btnCancelar.addEventListener('click', closeModal);
      btnClose.addEventListener('click', closeModal);
      
      btnConfirmar.addEventListener('click', () => {
        const nomeEstudante = inputEstudante.value.trim();
        
        if (nomeEstudante === estudanteAtual) {
          showToast('ℹ️ Este já é o estudante atual da aula', 'info');
          return;
        }
        
        editingSimulacao.aulas[index].estudante = nomeEstudante;
        const tbody = document.getElementById('tbody-aulas-simulacao');
        tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
        setupAulasInputEvents();
        
        showToast(`✅ Estudante ${nomeEstudante ? 'alterado para ' + nomeEstudante : 'removido'}`, 'success');
        closeModal();
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      
      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);
      modalContainer.addEventListener('remove', () => {
        document.removeEventListener('keydown', escHandler);
      });
      
      // Focar no input
      setTimeout(() => inputEstudante.focus(), 100);
    }
  }
  
  // Função para abrir modal de professor (simulação)
  async function showProfessorModalSimulacao(index, professorAtual, idProfessorAtual) {
    try {
      // Ordenar professores alfabeticamente
      const professoresOrdenados = professoresData.sort((a, b) => {
        const nomeA = a.nome || '';
        const nomeB = b.nome || '';
        return nomeA.localeCompare(nomeB);
      });
      
      const modalHtml = `
        <div class="modal-overlay" id="modalProfessorSim" style="z-index: 10000;">
          <div class="modal-container" style="max-width: 650px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">
                <i class="fas fa-chalkboard-teacher text-orange-500 mr-2"></i>
                Selecione Professor
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="space-y-5">
                <div class="bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                  <p class="text-sm text-gray-700 flex items-center">
                    <i class="fas fa-user-tie text-orange-500 mr-3 text-lg"></i>
                    <span>Professor atual: <strong class="text-orange-600 ml-1">${professorAtual || 'Não definido'}</strong></span>
                  </p>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-search text-orange-500 mr-2"></i>
                    Buscar professor
                  </label>
                  <div class="relative">
                    <input 
                      type="text" 
                      id="inputBuscaProfessor" 
                      placeholder="Digite o nome do professor..."
                      class="w-full border-2 border-gray-300 rounded-lg pl-11 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <i class="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-list-ul text-orange-500 mr-2"></i>
                    Lista de professores disponíveis
                  </label>
                  <select 
                    id="selectProfessor" 
                    class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-inner"
                    size="10"
                    style="min-height: 280px;"
                  >
                    <option value="|A definir" style="padding: 8px; font-weight: 500; color: #f97316;">A definir</option>
                    ${professoresOrdenados.map(prof => `
                      <option value="${prof.cpf || prof.id}|${prof.nome}" ${prof.nome === professorAtual ? 'selected' : ''} style="padding: 8px;">
                        ${escapeHtml(prof.nome || 'Sem nome')}
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btnCancelarProfessor" class="btn-secondary btn-compact">
                Cancelar
              </button>
              <button id="btnConfirmarProfessor" class="btn-primary btn-compact">
                <i class="fas fa-check mr-2"></i>
                Confirmar Seleção
              </button>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer);
      
      const modal = modalContainer.querySelector('#modalProfessorSim');
      const btnCancelar = modal.querySelector('#btnCancelarProfessor');
      const btnConfirmar = modal.querySelector('#btnConfirmarProfessor');
      const btnClose = modal.querySelector('.modal-close');
      const inputBusca = modal.querySelector('#inputBuscaProfessor');
      const selectProfessor = modal.querySelector('#selectProfessor');
      
      // Array com todas as opções originais
      const todasOpcoes = Array.from(selectProfessor.options);
      
      // Função para filtrar professores
      inputBusca.addEventListener('input', function() {
        const termoBusca = this.value.toLowerCase().trim();
        
        // Limpar select
        selectProfessor.innerHTML = '';
        
        // Filtrar e adicionar opções
        const opcoesFiltradas = todasOpcoes.filter(opcao => {
          const texto = opcao.textContent.toLowerCase();
          return texto.includes(termoBusca);
        });
        
        opcoesFiltradas.forEach(opcao => {
          selectProfessor.appendChild(opcao.cloneNode(true));
        });
      });
      
      const closeModal = () => {
        modalContainer.remove();
      };
      
      btnCancelar.addEventListener('click', closeModal);
      btnClose.addEventListener('click', closeModal);
      
      btnConfirmar.addEventListener('click', () => {
        const selectedOption = selectProfessor.value;
        
        if (!selectedOption) {
          showToast('⚠️ Por favor, selecione um professor', 'error');
          return;
        }
        
        // Separar CPF e nome
        const [cpf, nome] = selectedOption.split('|');
        
        if (nome === professorAtual) {
          showToast('ℹ️ Este já é o professor atual da aula', 'info');
          return;
        }
        
        editingSimulacao.aulas[index].idProfessor = cpf;
        editingSimulacao.aulas[index].professor = nome;
        const tbody = document.getElementById('tbody-aulas-simulacao');
        tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
        setupAulasInputEvents();
        
        showToast(`✅ Professor alterado para ${nome}`, 'success');
        closeModal();
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      
      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);
      modalContainer.addEventListener('remove', () => {
        document.removeEventListener('keydown', escHandler);
      });
      
      // Focar no campo de busca
      setTimeout(() => inputBusca.focus(), 100);
      
    } catch (error) {
      console.error('❌ Erro ao carregar professores:', error);
      showToast('❌ Erro ao carregar lista de professores', 'error');
    }
  }
  
  // Função para copiar aula
  function copiarAula(index) {
    if (!editingSimulacao.aulas || !editingSimulacao.aulas[index]) return;
    
    // Criar cópia profunda da aula
    const aulaCopia = JSON.parse(JSON.stringify(editingSimulacao.aulas[index]));
    
    // Inserir a cópia logo abaixo da aula original
    editingSimulacao.aulas.splice(index + 1, 0, aulaCopia);
    
    // Re-renderizar tabela
    const tbody = document.getElementById('tbody-aulas-simulacao');
    tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
    
    // Reaplicar eventos
    setupAulasInputEvents();
    
    recalcularValores();
  }
  
  // Função para excluir aula
  function excluirAula(index) {
    if (!editingSimulacao.aulas) return;
    
    editingSimulacao.aulas.splice(index, 1);
    
    // Re-renderizar tabela
    const tbody = document.getElementById('tbody-aulas-simulacao');
    tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
    
    // Reaplicar eventos
    setupAulasInputEvents();
    
    recalcularValores();
  }
  
  // Função para abrir modal de remoção de aulas (simulação)
  function abrirModalRemoverAulaSimulacao() {
    if (!editingSimulacao || !editingSimulacao.aulas || editingSimulacao.aulas.length === 0) {
      showToast('❌ Nenhuma aula para remover', 'error');
      return;
    }
    
    // Criar linhas da tabela
    let linhasHtml = '';
    editingSimulacao.aulas.forEach((aula, index) => {
      linhasHtml += `
        <tr class="aula-row-remove-sim" data-index="${index}">
          <td class="py-2 px-3 text-center">
            <input type="checkbox" class="checkbox-remove-aula-sim w-4 h-4 cursor-pointer" data-index="${index}">
          </td>
          <td class="py-2 px-3 text-sm">${aula.data || '--'}</td>
          <td class="py-2 px-3 text-sm">${aula.materia || '--'}</td>
          <td class="py-2 px-3 text-sm">${aula.estudante || '--'}</td>
          <td class="py-2 px-3 text-sm">${aula.professor || 'A definir'}</td>
          <td class="py-2 px-3 text-sm text-center">${aula.duracao || '--'}</td>
        </tr>
      `;
    });
    
    const modalHtml = `
      <div class="modal-overlay" id="removerAulaSimulacaoModal">
        <div class="modal-container max-w-5xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">
              <i class="fas fa-trash-alt text-red-500 mr-2"></i>
              Selecione as aulas que gostaria de excluir
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
              <i class="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-1"></i>
              <div>
                <p class="text-sm text-yellow-800 font-medium">Atenção!</p>
                <p class="text-xs text-yellow-700 mt-1">As aulas selecionadas serão removidas da simulação.</p>
              </div>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-gray-100 border-b border-gray-200">
                    <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">
                      <input type="checkbox" id="select-all-aulas-sim" class="w-4 h-4 cursor-pointer" title="Selecionar todas">
                    </th>
                    <th class="py-3 px-3 text-xs font-semibold text-gray-600">Data</th>
                    <th class="py-3 px-3 text-xs font-semibold text-gray-600">Matéria</th>
                    <th class="py-3 px-3 text-xs font-semibold text-gray-600">Estudante</th>
                    <th class="py-3 px-3 text-xs font-semibold text-gray-600">Professor</th>
                    <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">Duração</th>
                  </tr>
                </thead>
                <tbody id="tbody-remover-aulas-sim">
                  ${linhasHtml}
                </tbody>
              </table>
            </div>
            
            <div class="mt-4 text-sm text-gray-600">
              <span id="count-selected-aulas-sim">0</span> aula(s) selecionada(s)
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btn-cancelar-remover-sim" class="btn-secondary">
              <i class="fas fa-times mr-2"></i>
              Cancelar
            </button>
            <button id="btn-confirmar-remover-sim" class="btn-danger" disabled>
              <i class="fas fa-trash-alt mr-2"></i>
              Excluir Aulas
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar modal ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalRem = document.getElementById('removerAulaSimulacaoModal');
    const btnCancelar = document.getElementById('btn-cancelar-remover-sim');
    const btnConfirmar = document.getElementById('btn-confirmar-remover-sim');
    const selectAll = document.getElementById('select-all-aulas-sim');
    const checkboxes = modalRem.querySelectorAll('.checkbox-remove-aula-sim');
    const countSelected = document.getElementById('count-selected-aulas-sim');
    
    // Função para atualizar contador e estado do botão
    function updateSelection() {
      const selected = modalRem.querySelectorAll('.checkbox-remove-aula-sim:checked');
      countSelected.textContent = selected.length;
      btnConfirmar.disabled = selected.length === 0;
      
      selectAll.checked = selected.length === checkboxes.length && checkboxes.length > 0;
      selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
    }
    
    // Evento para selecionar/desselecionar todos
    selectAll.addEventListener('change', function() {
      checkboxes.forEach(cb => {
        cb.checked = this.checked;
        const row = cb.closest('tr');
        if (this.checked) {
          row.classList.add('bg-red-50');
        } else {
          row.classList.remove('bg-red-50');
        }
      });
      updateSelection();
    });
    
    // Evento para checkboxes individuais
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        const row = this.closest('tr');
        if (this.checked) {
          row.classList.add('bg-red-50');
        } else {
          row.classList.remove('bg-red-50');
        }
        updateSelection();
      });
    });
    
    // Botão cancelar
    btnCancelar.addEventListener('click', () => {
      modalRem.remove();
    });
    
    // Botão fechar (X)
    modalRem.querySelector('.modal-close').addEventListener('click', () => {
      modalRem.remove();
    });
    
    // Botão confirmar exclusão
    btnConfirmar.addEventListener('click', () => {
      const selected = modalRem.querySelectorAll('.checkbox-remove-aula-sim:checked');
      
      if (selected.length === 0) {
        showToast('⚠️ Selecione pelo menos uma aula para excluir', 'warning');
        return;
      }
      
      // Coletar índices das aulas selecionadas (em ordem decrescente)
      const indices = Array.from(selected)
        .map(cb => parseInt(cb.dataset.index))
        .sort((a, b) => b - a); // Ordem decrescente para não desalinhar índices
      
      // Remover aulas
      indices.forEach(index => {
        editingSimulacao.aulas.splice(index, 1);
      });
      
      // Re-renderizar tabela principal
      const tbody = document.getElementById('tbody-aulas-simulacao');
      tbody.innerHTML = renderAulasSimulacao(editingSimulacao.aulas);
      
      // Reaplicar eventos
      setupAulasInputEvents();
      
      // Recalcular valores
      recalcularValores();
      
      showToast(`✅ ${selected.length} aula(s) removida(s) com sucesso`, 'success');
      
      // Fechar modal
      modalRem.remove();
    });
  }
  
  // Função para recalcular valores em tempo real
  function recalcularValores() {
    const valores = calcularValoresSimulacao(editingSimulacao.aulas || []);
    
    document.getElementById('display-total-horas').textContent = `${valores.SomatorioDuracaoAulas}h`;
    document.getElementById('display-valor-pacote').textContent = `R$ ${valores.ValorPacote.toFixed(2)}`;
    document.getElementById('display-valor-equipe').textContent = `R$ ${valores.ValorEquipe.toFixed(2)}`;
    document.getElementById('display-lucro-master').textContent = `R$ ${valores.lucroMaster.toFixed(2)}`;
  }
  
  // ==================== SALVAR SIMULAÇÃO ====================
  
  // Função para salvar simulação
  async function salvarSimulacao(isNova, closeModal) {
    const titulo = document.getElementById('titulo-simulacao').value.trim();
    
    // Coletar dados do formulário
    const selectCliente = document.getElementById('select-cliente');
    let nomeCliente = '';
    let cpf = '';
    
    if (selectCliente.value === '__temp__') {
      nomeCliente = selectCliente.options[selectCliente.selectedIndex].text;
      cpf = '';
    } else if (selectCliente.value) {
      const cliente = clientesData.find(c => c.id === selectCliente.value);
      if (cliente) {
        nomeCliente = cliente.nome || '';
        cpf = cliente.cpf || '';
      }
    }
    
    const metodoPagamento = document.getElementById('metodo-pagamento').value;
    const dataPrimeiraParcela = document.getElementById('data-primeira-parcela').value;
    const dataSegundaParcela = document.getElementById('data-segunda-parcela').value;
    const tipoEquipe = document.getElementById('tipo-equipe').value;
    
    // Calcular valores baseados nas aulas já editadas em editingSimulacao.aulas
    const valores = calcularValoresSimulacao(editingSimulacao.aulas || []);
    
    const simulacaoData = {
      idSimulacao: editingSimulacao.idSimulacao,
      tituloSimulacao: titulo,
      nomeCliente:  nomeCliente,
      cpf: cpf,
      metodoPagamento:  metodoPagamento,
      dataPrimeiraParcela: dataPrimeiraParcela,
      dataSegundaParcela:  dataSegundaParcela,
      tipoEquipe: tipoEquipe,
      aulas: editingSimulacao.aulas || [],
      SomatorioDuracaoAulas: valores.SomatorioDuracaoAulas,
      ValorPacote: valores.ValorPacote,
      ValorEquipe: valores.ValorEquipe,
      lucroMaster: valores.lucroMaster,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      if (isNova) {
        // Criar novo documento
        await db.collection('simulacoes').doc(simulacaoData.idSimulacao).set(simulacaoData);
        showToast('✅ Simulação criada com sucesso!', 'success');
      } else {
        // Atualizar documento existente
        await db.collection('simulacoes').doc(simulacaoData.idSimulacao).update(simulacaoData);
        showToast('✅ Simulação atualizada com sucesso! ', 'success');
      }
      
      // Recarregar simulações
      await carregarSimulacoes();
      renderSimulacoesCards(simulacoesData, currentFilters);
      
      closeModal();
    } catch (error) {
      console.error('❌ Erro ao salvar simulação:', error);
      showToast('❌ Erro ao salvar simulação', 'error');
    }
  }
  
  // ==================== APROVAR SIMULAÇÃO ====================
  
  // Função para aprovar simulação
  async function aprovarSimulacao(closeModal) {
    const titulo = document.getElementById('titulo-simulacao').value.trim();
    
    // Validar que existem aulas
    if (!editingSimulacao.aulas || editingSimulacao.aulas.length === 0) {
      showToast('⚠️ Adicione pelo menos uma aula antes de aprovar', 'warning');
      return;
    }
    
    // Mostrar loading
    const btnAprovar = document.getElementById('btn-aprovar-simulacao');
    const originalHtml = btnAprovar.innerHTML;
    btnAprovar. disabled = true;
    btnAprovar.innerHTML = '<div class="loading-spinner mr-2"></div> Aprovando...';
    
    try {
      // 1. Buscar último código de contratação
      const lastCodeSnapshot = await db. collection('BancoDeAulas')
        .orderBy('codigoContratacao', 'desc')
        .limit(1)
        .get();
      
      let novoCodigoContratacao = '0001';
      
      if (! lastCodeSnapshot.empty) {
        const ultimoCodigo = lastCodeSnapshot.docs[0].data().codigoContratacao;
        const numeroAtual = parseInt(ultimoCodigo);
        const proximoNumero = numeroAtual + 1;
        novoCodigoContratacao = proximoNumero.toString().padStart(4, '0');
      }
      
      console.log('✅ Novo código de contratação:', novoCodigoContratacao);
      
      // 2. Coletar dados do formulário
      const selectCliente = document.getElementById('select-cliente');
      let nomeCliente = '';
      let cpf = '';
      
      if (selectCliente.value === '__temp__') {
        nomeCliente = selectCliente.options[selectCliente.selectedIndex].text;
        cpf = '';
      } else if (selectCliente.value) {
        const cliente = clientesData. find(c => c.id === selectCliente.value);
        if (cliente) {
          nomeCliente = cliente.nome || '';
          cpf = cliente. cpf || '';
        }
      }
      
      const metodoPagamento = document.getElementById('metodo-pagamento').value;
      const dataPrimeiraParcela = document.getElementById('data-primeira-parcela').value;
      const dataSegundaParcela = document.getElementById('data-segunda-parcela').value;
      const tipoEquipe = document.getElementById('tipo-equipe').value;
      
      // 3. Calcular valores
      const valores = calcularValoresSimulacao(editingSimulacao.aulas);
      
      // 4. Verificar se alguma aula é emergencial
      const aulaEmergencial = verificarAulaEmergencial(editingSimulacao.aulas);
      
      // 5. Gerar IDs de aula (formato: 0001AA, 0001AB, 0001AC, etc.)
      const aulasComIds = editingSimulacao.aulas. map((aula, index) => {
        const idAula = novoCodigoContratacao + gerarSufixoAula(index);
        
        return {
          'id-Aula': idAula,
          idProfessor: aula.idProfessor || '',
          professor: aula. professor || 'A definir',
          materia:  aula.materia || '',
          estudante: aula.estudante || '',
          duracao: aula.duracao || '',
          data: aula.data || '',
          horario: '',
          StatusAula: '',
          ObservacoesAula: '',
          RelatorioAula: '',
          ConfirmacaoProfessorAula: 'false',
          disponibilizarRrelatório: '',
          ValorAula: calcularValorAula(aula.duracao)
        };
      });
      
      // 6. Criar documento para BancoDeAulas
      const contratoData = {
        codigoContratacao: novoCodigoContratacao,
        nomeCliente: nomeCliente,
        cpf: cpf,
        alunos: aulasComIds. map(a => a.estudante).filter((v, i, a) => a.indexOf(v) === i).join(', '),
        aulaEmergencial: aulaEmergencial,
        statusContrato: '',
        assinaturaContrato: '',
        metodoPagamento: metodoPagamento,
        statusPagamento: '',
        dataPrimeiraParcela: dataPrimeiraParcela,
        dataSegundaParcela:  dataSegundaParcela,
        equipe: tipoEquipe,
        ValorEquipe: valores.ValorEquipe,
        ValorPacote: valores.ValorPacote,
        lucroMaster: valores.lucroMaster,
        SomatorioDuracaoAulas: valores.SomatorioDuracaoAulas,
        aulas: aulasComIds,
        ConfirmacaoProfessorAula: '',
        ObservacaoContratacao: '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // 7. Salvar em BancoDeAulas
      await db.collection('BancoDeAulas').doc(novoCodigoContratacao).set(contratoData);
      console.log('✅ Salvo em BancoDeAulas:', novoCodigoContratacao);
      
      // 8. Salvar cada aula em BancoDeAulas-Lista
      for (const aula of aulasComIds) {
        const aulaListaData = {
          ... aula,
          codigoContratacao: novoCodigoContratacao,
          nomeCliente: nomeCliente,
          cpf: cpf,
          metodoPagamento: metodoPagamento,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('BancoDeAulas-Lista').add(aulaListaData);
      }
      console.log('✅ Aulas salvas em BancoDeAulas-Lista:', aulasComIds.length);
      
      // 9. Atualizar título da simulação
      const novoTitulo = 'SIMULAÇÃO APROVADA - ' + titulo;
      await db.collection('simulacoes').doc(editingSimulacao.idSimulacao).update({
        tituloSimulacao: novoTitulo,
        timestamp: firebase.firestore.FieldValue. serverTimestamp()
      });
      
      showToast(`✅ Simulação aprovada!  Código:  ${novoCodigoContratacao}`, 'success', 4000);
      
      // Recarregar simulações
      await carregarSimulacoes();
      renderSimulacoesCards(simulacoesData, currentFilters);
      
      closeModal();
      
    } catch (error) {
      console.error('❌ Erro ao aprovar simulação:', error);
      showToast('❌ Erro ao aprovar simulação', 'error');
      
      btnAprovar.disabled = false;
      btnAprovar.innerHTML = originalHtml;
    }
  }
  
  // Função para gerar sufixo de aula (0 → AA, 1 → AB, 2 → AC, 26 → BA, etc.)
  function gerarSufixoAula(index) {
    const primeiraLetra = String.fromCharCode(65 + Math.floor(index / 26));
    const segundaLetra = String.fromCharCode(65 + (index % 26));
    return primeiraLetra + segundaLetra;
  }
  
  // Função para calcular valor individual da aula
  function calcularValorAula(duracao) {
    const horas = parseDuracao(duracao || '0h');
    return horas * 35;
  }
  
  // Função para verificar aula emergencial
  function verificarAulaEmergencial(aulas) {
    const hoje = new Date();
    const amanha = new Date();
    amanha.setDate(amanha. getDate() + 1);
    
    const formatarData = (date) => {
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = (date.getMonth() + 1).toString().padStart(2, '0');
      const ano = date.getFullYear();
      return `${dia}/${mes}/${ano}`;
    };
    
    const hojeStr = formatarData(hoje);
    const amanhaStr = formatarData(amanha);
    
    const temEmergencia = aulas.some(aula => {
      const dataAula = aula.data || '';
      return dataAula === hojeStr || dataAula === amanhaStr;
    });
    
    return temEmergencia ?  'Sim' : 'Não';
  }
  
  // ==================== EXCLUIR SIMULAÇÃO ====================
  
  // Função para excluir simulação
  async function excluirSimulacao(closeModal) {
    // Modal de confirmação
    const confirmHtml = `
      <div class="modal-overlay" id="modal-confirmar-exclusao" style="z-index: 10001;">
        <div class="modal-container" style="max-width: 400px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">Confirmar Exclusão</h3>
          </div>
          <div class="modal-body">
            <div class="text-center py-4">
              <i class="fas fa-exclamation-triangle text-5xl text-red-500 mb-4"></i>
              <p class="text-lg text-gray-700 mb-2">Deseja realmente excluir esta simulação?</p>
              <p class="text-sm text-gray-500">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button id="btn-cancelar-exclusao" class="btn-secondary btn-compact">Cancelar</button>
            <button id="btn-confirmar-exclusao" class="btn-primary btn-compact bg-red-500 hover:bg-red-600">
              <i class="fas fa-trash mr-2"></i>
              Sim, excluir
            </button>
          </div>
        </div>
      </div>
    `;
    
    const confirmContainer = document.createElement('div');
    confirmContainer. innerHTML = confirmHtml;
    document.body.appendChild(confirmContainer);
    
    const confirmModal = document.getElementById('modal-confirmar-exclusao');
    const btnCancelar = confirmModal.querySelector('#btn-cancelar-exclusao');
    const btnConfirmar = confirmModal.querySelector('#btn-confirmar-exclusao');
    
    const closeConfirm = () => {
      confirmContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeConfirm);
    
    btnConfirmar.addEventListener('click', async () => {
      try {
        await db.collection('simulacoes').doc(editingSimulacao.idSimulacao).delete();
        
        showToast('✅ Simulação excluída com sucesso! ', 'success');
        
        // Recarregar simulações
        await carregarSimulacoes();
        renderSimulacoesCards(simulacoesData, currentFilters);
        
        closeConfirm();
        closeModal();
      } catch (error) {
        console.error('❌ Erro ao excluir simulação:', error);
        showToast('❌ Erro ao excluir simulação', 'error');
      }
    });
  }
  
  // ==================== MÁSCARAS ====================
  
  // Função para aplicar máscaras de data
  function aplicarMascarasModal() {
    // Máscara para datas de parcelas
    const inputDataPrimeira = document.getElementById('data-primeira-parcela');
    const inputDataSegunda = document.getElementById('data-segunda-parcela');
    
    if (inputDataPrimeira) aplicarMascaraData(inputDataPrimeira);
    if (inputDataSegunda) aplicarMascaraData(inputDataSegunda);
    
    // Máscara para datas das aulas
    const inputsDataAula = document.querySelectorAll('.input-aula-data');
    inputsDataAula.forEach(input => aplicarMascaraData(input));
    
    // Máscara para CPF no filtro
    const inputCpfFiltro = document.getElementById('filter-cpf');
    if (inputCpfFiltro) aplicarMascaraCPF(inputCpfFiltro);
  }
  
  // Função para aplicar máscara de data (dd/mm/aaaa)
  function aplicarMascaraData(input) {
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      if (value.length >= 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
      }
      
      e.target.value = value;
    });
  }
  
  // Função para aplicar máscara de CPF
  function aplicarMascaraCPF(input) {
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      
      if (value.length >= 3) {
        value = value.substring(0, 3) + '.' + value.substring(3);
      }
      if (value.length >= 7) {
        value = value.substring(0, 7) + '.' + value.substring(7);
      }
      if (value.length >= 11) {
        value = value.substring(0, 11) + '-' + value.substring(11, 13);
      }
      
      e.target.value = value;
    });
  }
  
  // ==================== API PÚBLICA ====================
  
  // Retornar API pública
  return {
    loadSimulacoes,
    abrirModalNovaSimulacao,
    limparFiltros
  };
})();

// Exportar objeto para uso global
if (typeof window !== 'undefined') {
  window.Simulacoes = Simulacoes;
  console.log('✅ Simulacoes exportado para escopo global');
}
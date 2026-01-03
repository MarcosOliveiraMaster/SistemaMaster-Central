console.log('✅ functions-banco-de-aulas.js carregado');

// Variáveis globais para esta seção
let AULAS_DATA = [];
let CLIENTES_DATA = [];
let PROFESSORES_DATA = [];

// Função para carregar a seção Banco de Aulas
async function loadBancoDeAulas() {
  console.log('🚀 loadBancoDeAulas iniciado');
  
  const section = document.getElementById('banco-aulas');
  
  if (!section) {
    console.error('❌ Seção banco-aulas não encontrada');
    return;
  }
  
  // Estrutura da seção ATUALIZADA com elementos menores
  section.innerHTML = `
    <div class="space-y-4">
      <!-- Botões Especiais - Primeira Div (Compacta) -->
      <div class="botões-especiais">
        <div class="flex flex-wrap gap-2 mb-2">
          <button id="btn-aulas-semana" class="btn-primary btn-compact">
            <i class="fas fa-calendar-week mr-1 text-xs"></i>
            Aulas para esta semana
          </button>
          <button id="btn-sem-professor" class="btn-primary btn-compact">
            <i class="fas fa-user-slash mr-1 text-xs"></i>
            Cronogramas sem professor
          </button>
          <button id="btn-refresh" class="btn-secondary btn-compact">
            <i class="fas fa-sync-alt mr-1 text-xs"></i>
            Atualizar Dados
          </button>
        </div>
      </div>
      
      <!-- Filtros - Segunda Div (Compacta e Alinhada) -->
      <div class="filter-container p-3">
        <h3 class="font-lexend font-bold text-sm mb-3 text-orange-500">Filtrar Aulas</h3>
        
        <div class="filter-row-compact">
          <!-- Cliente -->
          <div class="filter-group">
            <label class="filter-label filter-label-compact">Cliente</label>
            <select id="filter-cliente" class="filter-select filter-compact">
              <option value="">Todos os clientes</option>
            </select>
          </div>
          
          <!-- Data -->
          <div class="filter-group">
            <label class="filter-label filter-label-compact">Data</label>
            <select id="filter-data" class="filter-select filter-compact">
              <option value="">Selecione uma opção</option>
              <option value="hoje">Aulas para hoje</option>
              <option value="amanha">Aulas para amanhã</option>
              <option value="ontem">Aulas de ontem</option>
              <option value="personalizada">Data específica</option>
            </select>
            <input type="text" id="filter-data-custom" 
                   class="filter-input filter-compact mt-1 hidden" 
                   placeholder="dd/mm/aaaa" 
                   maxlength="10">
          </div>
          
          <!-- Código -->
          <div class="filter-group">
            <label class="filter-label filter-label-compact">Código</label>
            <input type="text" id="filter-codigo" 
                   class="filter-input filter-compact" 
                   placeholder="Digite o código" 
                   maxlength="10">
          </div>
          
          <!-- Professor -->
          <div class="filter-group">
            <label class="filter-label filter-label-compact">Professor</label>
            <select id="filter-professor" class="filter-select filter-compact">
              <option value="">Todos os professores</option>
            </select>
          </div>
          
          <!-- Botão Aplicar Filtros (Alinhado) -->
          <div class="filter-group flex items-end">
            <button id="btn-aplicar-filtros" class="btn-primary btn-compact w-full">
              <i class="fas fa-filter mr-1"></i>
              Aplicar
            </button>
          </div>
        </div>
      </div>
      
      <!-- Cards de Aulas - Terceira Div -->
      <div id="aulas-container">
        <div class="flex items-center justify-center py-8">
          <div class="loading-spinner-large"></div>
          <span class="ml-3 text-orange-500 font-comfortaa">Carregando aulas...</span>
        </div>
      </div>
    </div>
  `;
  
  // Inicializar componentes da seção
  await initializeBancoDeAulas();
}

// Inicializar componentes da seção Banco de Aulas
async function initializeBancoDeAulas() {
  console.log('🔄 initializeBancoDeAulas iniciado');
  
  try {
    // Carregar dados iniciais
    console.log('📥 Carregando dados do Firebase...');
    
    const [aulas, clientes, professores] = await Promise.all([
      BANCO.fetchBancoDeAulas(),
      BANCO.fetchCadastroClientes(),
      BANCO.fetchDataBaseProfessores()
    ]);
    
    // Salvar dados nas variáveis globais
    AULAS_DATA = aulas || [];
    CLIENTES_DATA = clientes || [];
    PROFESSORES_DATA = professores || [];
    
    console.log(`📊 Dados carregados: ${AULAS_DATA.length} aulas, ${CLIENTES_DATA.length} clientes, ${PROFESSORES_DATA.length} professores`);
    
    // Popular filtro de clientes
    populateClienteFilter(CLIENTES_DATA);
    
    // Popular filtro de professores
    populateProfessorFilter(PROFESSORES_DATA);
    
    // Configurar filtro de data
    setupDateFilter();
    
    // Renderizar cards
    renderAulasCards(AULAS_DATA);
    
    // Configurar eventos
    setupBancoDeAulasEvents();
    
    showToast(`✅ Carregadas ${AULAS_DATA.length} aulas`, 'success', 3000);
    
  } catch (error) {
    console.error('❌ Erro ao inicializar Banco de Aulas:', error);
    showToast('❌ Erro ao carregar dados do banco', 'error');
    
    // Mostrar mensagem de erro
    document.getElementById('aulas-container').innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-exclamation-triangle text-3xl text-orange-500 mb-3"></i>
        <h3 class="font-lexend text-lg mb-2">Erro ao carregar dados</h3>
        <p class="text-gray-600 text-sm mb-4">${error.message || 'Não foi possível conectar ao banco de dados'}</p>
        <button id="btn-retry" class="btn-primary btn-compact">
          <i class="fas fa-redo mr-1"></i>
          Tentar novamente
        </button>
      </div>
    `;
    
    document.getElementById('btn-retry').addEventListener('click', loadBancoDeAulas);
  }
}

// Popular filtro de clientes
function populateClienteFilter(clientes) {
  console.log('👥 Populando filtro de clientes:', clientes.length);
  
  const select = document.getElementById('filter-cliente');
  if (!select) {
    console.error('❌ Elemento filter-cliente não encontrado');
    return;
  }
  
  // Limpar opções existentes (exceto a primeira)
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // Ordenar clientes por nome
  const clientesOrdenados = [...clientes].sort((a, b) => {
    const nomeA = a.nome || '';
    const nomeB = b.nome || '';
    return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
  });
  
  // Adicionar opções com nome dos clientes
  clientesOrdenados.forEach(cliente => {
    const nome = cliente.nome || 'Cliente sem nome';
    const cpf = cliente.cpf || '';
    
    const option = document.createElement('option');
    option.value = cpf || cliente.id;
    option.textContent = nome;
    option.title = cpf ? `${nome} (${cpf})` : nome;
    select.appendChild(option);
  });
}

// Popular filtro de professores
function populateProfessorFilter(professores) {
  console.log('👨‍🏫 Populando filtro de professores:', professores.length);
  
  const select = document.getElementById('filter-professor');
  if (!select) {
    console.error('❌ Elemento filter-professor não encontrado');
    return;
  }
  
  // Limpar opções existentes (exceto a primeira)
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // Professores já estão ordenados pela query
  professores.forEach(professor => {
    const nome = professor.nome || 'Professor sem nome';
    const option = document.createElement('option');
    option.value = professor.id;
    option.textContent = nome;
    select.appendChild(option);
  });
}

// Configurar filtro de data
function setupDateFilter() {
  const select = document.getElementById('filter-data');
  const customInput = document.getElementById('filter-data-custom');
  
  if (!select || !customInput) return;
  
  select.addEventListener('change', function() {
    if (this.value === 'personalizada') {
      customInput.classList.remove('hidden');
      customInput.focus();
    } else {
      customInput.classList.add('hidden');
      customInput.value = '';
    }
  });
  
  // Adicionar máscara de data
  customInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 2 && value.length <= 4) {
      value = value.replace(/(\d{2})(\d{1,2})/, '$1/$2');
    } else if (value.length > 4) {
      value = value.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
    }
    
    e.target.value = value.substring(0, 10);
  });
}

// Renderizar cards de aulas
function renderAulasCards(aulas, filters = {}) {
  console.log('🎴 Renderizando cards:', aulas.length);
  
  const container = document.getElementById('aulas-container');
  if (!container) {
    console.error('❌ Container aulas-container não encontrado');
    return;
  }
  
  if (!aulas || aulas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-book-open text-3xl text-gray-300 mb-3"></i>
        <h3 class="font-lexend text-lg mb-2">Nenhuma aula encontrada</h3>
        <p class="text-gray-600 text-sm">Nenhuma aula foi cadastrada ainda.</p>
      </div>
    `;
    return;
  }
  
  // Aplicar filtros se fornecidos
  let filteredAulas = applyAulasFilters([...aulas], filters);
  
  // Verificar se há resultados após filtragem
  if (filteredAulas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-search text-3xl text-gray-300 mb-3"></i>
        <h3 class="font-lexend text-lg mb-2">Nenhuma aula encontrada</h3>
        <p class="text-gray-600 text-sm">Nenhuma aula corresponde aos filtros aplicados.</p>
        <button id="btn-limpar-filtros" class="btn-secondary btn-compact mt-3">
          <i class="fas fa-times mr-1"></i>
          Limpar Filtros
        </button>
      </div>
    `;
    
    document.getElementById('btn-limpar-filtros')?.addEventListener('click', () => {
      clearFilters();
      renderAulasCards(aulas);
    });
    
    return;
  }
  
  // Criar grid de cards compactos
  container.innerHTML = `
    <div class="mb-3 flex justify-between items-center">
      <h3 class="font-lexend font-bold text-sm">
        <span id="aulas-count">${filteredAulas.length}</span> 
        aula${filteredAulas.length !== 1 ? 's' : ''} encontrada${filteredAulas.length !== 1 ? 's' : ''}
      </h3>
      <div class="text-xs text-gray-500">
        <i class="fas fa-clock mr-1"></i>
        ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
    <div class="cards-grid-compact" id="aulas-cards-grid"></div>
  `;
  
  const grid = document.getElementById('aulas-cards-grid');
  
  // Adicionar cards
  filteredAulas.forEach(aula => {
    const card = createAulaCardCompact(aula);
    grid.appendChild(card);
  });
  
  // Atualizar contador com animação
  animateCounter('aulas-count', filteredAulas.length);
}

// Função para aplicar filtros às aulas
function applyAulasFilters(aulas, filters) {
  if (Object.keys(filters).length === 0) return aulas;
  
  console.log('🔍 Aplicando filtros:', filters);
  
  return aulas.filter(aula => {
    // Filtro por cliente (CPF)
    if (filters.cliente && aula.cpf !== filters.cliente) {
      return false;
    }
    
    // Filtro por código
    if (filters.codigo) {
      const codigo = aula.codigoContratacao || '';
      if (!codigo.toLowerCase().includes(filters.codigo.toLowerCase())) {
        return false;
      }
    }
    
    // Filtro por professor
    if (filters.professor) {
      const temProfessor = aula.aulas?.some(a => {
        const professorAula = a.professor || '';
        return professorAula.toLowerCase().includes(filters.professor.toLowerCase());
      });
      if (!temProfessor) return false;
    }
    
    // Filtro por data
    if (filters.data) {
      const temData = aula.aulas?.some(a => {
        const dataAula = a.data || '';
        return dataAula.includes(filters.data);
      });
      if (!temData) return false;
    }
    
    return true;
  });
}

// Função para criar card de aula compacto
function createAulaCardCompact(aula) {
  const card = document.createElement('div');
  card.className = 'aula-card aula-card-compact';
  card.dataset.id = aula.id;
  
  // Nome do cliente - BUSCAR DO CAMPO "nome" DO DOCUMENTO
  const nomeCliente = aula.nome || aula.nomeCliente || 'Cliente não identificado';
  const nomeDisplay = nomeCliente.length > 25 ? 
    nomeCliente.substring(0, 25) + '...' : nomeCliente;
  
  // Data da contratação
  const dataContratacao = aula.dataContratacao || '--/--/----';
  
  // Código da contratação
  const codigo = aula.codigoContratacao || 'Sem código';
  
  // Contar número de aulas
  const numAulas = aula.aulas && Array.isArray(aula.aulas) ? aula.aulas.length : 0;
  
  // Verificar se há aulas sem professor
  const aulasSemProfessor = aula.aulas ? 
    aula.aulas.filter(a => !a.professor || a.professor === 'A definir').length : 0;
  
  // Verificar se há aulas com professor atribuído
  const aulasComProfessor = numAulas - aulasSemProfessor;
  
  card.innerHTML = `
    <div class="aula-card-header">
      <div class="aula-card-title flex items-center">
        <i class="fas fa-user-graduate text-orange-500 mr-2 text-xs"></i>
        <span title="${nomeCliente}">${nomeDisplay}</span>
      </div>
      <div class="aula-card-codigo text-xs font-mono">${codigo}</div>
    </div>
    
    <div class="aula-card-content">
      <div class="mb-2">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs text-gray-500 flex items-center">
            <i class="fas fa-calendar-day mr-1 text-xs"></i>
            Contratação:
          </span>
          <span class="font-medium text-xs">${dataContratacao}</span>
        </div>
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs text-gray-500 flex items-center">
            <i class="fas fa-book mr-1 text-xs"></i>
            Total aulas:
          </span>
          <span class="font-medium text-xs">${numAulas}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-500 flex items-center">
            <i class="fas fa-chalkboard-teacher mr-1 text-xs"></i>
            Com professor:
          </span>
          <span class="font-medium text-xs ${aulasComProfessor === numAulas ? 'text-green-500' : 'text-orange-500'}">
            ${aulasComProfessor}/${numAulas}
          </span>
        </div>
      </div>
      
      <div class="mt-3 pt-2 border-t border-gray-100">
        <div class="flex justify-between">
          <button class="btn-view-aula text-xs text-orange-500 hover:text-orange-700 flex items-center px-2 py-1 rounded hover:bg-orange-50">
            <i class="fas fa-eye mr-1 text-xs"></i> Ver
          </button>
          <button class="btn-edit-aula text-xs text-blue-500 hover:text-blue-700 flex items-center px-2 py-1 rounded hover:bg-blue-50">
            <i class="fas fa-edit mr-1 text-xs"></i> Editar
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Adicionar eventos aos botões
  const btnView = card.querySelector('.btn-view-aula');
  const btnEdit = card.querySelector('.btn-edit-aula');
  
  btnView.addEventListener('click', () => viewAulaDetails(aula));
  btnEdit.addEventListener('click', () => editAula(aula));
  
  // Adicionar hover effect
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-2px)';
    card.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '';
  });
  
  return card;
}

// Configurar eventos da seção
function setupBancoDeAulasEvents() {
  console.log('⚙️ Configurando eventos da seção Banco de Aulas');
  
  // Botão "Aulas para esta semana"
  document.getElementById('btn-aulas-semana')?.addEventListener('click', () => {
    filterAulasEstaSemana(AULAS_DATA);
  });
  
  // Botão "Cronogramas sem professor"
  document.getElementById('btn-sem-professor')?.addEventListener('click', () => {
    filterAulasSemProfessor(AULAS_DATA);
  });
  
  // Botão "Atualizar Dados"
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshAulasData();
  });
  
  // Botão "Aplicar Filtros"
  document.getElementById('btn-aplicar-filtros')?.addEventListener('click', () => {
    applyFilters(AULAS_DATA);
  });
  
  // Permitir Enter no campo de código
  document.getElementById('filter-codigo')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      applyFilters(AULAS_DATA);
    }
  });
}

// Filtrar aulas desta semana
function filterAulasEstaSemana(aulas) {
  const hoje = new Date();
  const fimDaSemana = new Date();
  fimDaSemana.setDate(hoje.getDate() + 7);
  
  const filteredAulas = aulas.filter(aula => {
    if (!aula.aulas || !Array.isArray(aula.aulas)) return false;
    
    return aula.aulas.some(a => {
      if (!a.data) return false;
      
      // Tentar extrair data no formato dd/mm/yyyy
      const match = a.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return false;
      
      const [_, dia, mes, ano] = match;
      const dataAula = new Date(ano, mes - 1, dia);
      
      return dataAula >= hoje && dataAula <= fimDaSemana;
    });
  });
  
  renderAulasCards(filteredAulas);
  showToast(`📅 Mostrando ${filteredAulas.length} aulas para esta semana`, 'info');
}

// Filtrar aulas sem professor
function filterAulasSemProfessor(aulas) {
  const filteredAulas = aulas.filter(aula => {
    if (!aula.aulas || !Array.isArray(aula.aulas)) return false;
    
    return aula.aulas.some(a => 
      !a.professor || a.professor === 'A definir' || a.professor === ''
    );
  });
  
  renderAulasCards(filteredAulas);
  showToast(`👨‍🏫 Mostrando ${filteredAulas.length} cronogramas com aulas sem professor`, 'info');
}

// Atualizar dados
async function refreshAulasData() {
  const refreshBtn = document.getElementById('btn-refresh');
  if (!refreshBtn) return;
  
  const originalHTML = refreshBtn.innerHTML;
  
  // Mostrar loading no botão
  refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-xs"></i> Atualizando...';
  refreshBtn.disabled = true;
  
  try {
    // Forçar atualização do cache
    BANCO.forceCacheRefresh();
    
    // Recarregar dados
    const aulas = await BANCO.fetchBancoDeAulas(true);
    const clientes = await BANCO.fetchCadastroClientes(true);
    const professores = await BANCO.fetchDataBaseProfessores(true);
    
    // Atualizar variáveis globais
    AULAS_DATA = aulas || [];
    CLIENTES_DATA = clientes || [];
    PROFESSORES_DATA = professores || [];
    
    // Recriar filtros
    populateClienteFilter(CLIENTES_DATA);
    populateProfessorFilter(PROFESSORES_DATA);
    
    // Re-renderizar cards
    renderAulasCards(AULAS_DATA);
    
    showToast('✅ Dados atualizados com sucesso', 'success');
  } catch (error) {
    console.error('❌ Erro ao atualizar dados:', error);
    showToast('❌ Erro ao atualizar dados', 'error');
  } finally {
    // Restaurar botão
    refreshBtn.innerHTML = originalHTML;
    refreshBtn.disabled = false;
  }
}

// Aplicar filtros
function applyFilters(aulas) {
  const filters = {};
  
  // Cliente
  const clienteSelect = document.getElementById('filter-cliente');
  if (clienteSelect && clienteSelect.value) {
    filters.cliente = clienteSelect.value;
  }
  
  // Data
  const dataSelect = document.getElementById('filter-data');
  if (dataSelect && dataSelect.value) {
    if (dataSelect.value === 'personalizada') {
      const customInput = document.getElementById('filter-data-custom');
      if (customInput && customInput.value) {
        filters.data = customInput.value;
      }
    } else {
      const hoje = new Date();
      let dataFiltro = '';
      
      switch (dataSelect.value) {
        case 'hoje':
          dataFiltro = hoje.toLocaleDateString('pt-BR');
          break;
        case 'amanha':
          const amanha = new Date(hoje);
          amanha.setDate(hoje.getDate() + 1);
          dataFiltro = amanha.toLocaleDateString('pt-BR');
          break;
        case 'ontem':
          const ontem = new Date(hoje);
          ontem.setDate(hoje.getDate() - 1);
          dataFiltro = ontem.toLocaleDateString('pt-BR');
          break;
      }
      
      if (dataFiltro) {
        filters.data = dataFiltro;
      }
    }
  }
  
  // Código
  const codigoInput = document.getElementById('filter-codigo');
  if (codigoInput && codigoInput.value.trim()) {
    filters.codigo = codigoInput.value.trim();
  }
  
  // Professor
  const professorSelect = document.getElementById('filter-professor');
  if (professorSelect && professorSelect.value) {
    // Buscar nome do professor pelo ID
    const professorId = professorSelect.value;
    const professorOption = professorSelect.querySelector(`option[value="${professorId}"]`);
    if (professorOption) {
      filters.professor = professorOption.textContent;
    }
  }
  
  // Aplicar filtros e renderizar
  renderAulasCards(aulas, filters);
  
  // Mostrar mensagem de filtros aplicados
  const numFiltros = Object.keys(filters).length;
  if (numFiltros > 0) {
    showToast(`🔍 ${numFiltros} filtro${numFiltros !== 1 ? 's' : ''} aplicado${numFiltros !== 1 ? 's' : ''}`, 'info', 2000);
  }
}

// Ver detalhes da aula
function viewAulaDetails(aula) {
  console.log('🔍 Visualizando detalhes da aula:', aula.id);
  
  // Criar modal com detalhes
  const modalHtml = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div class="p-4 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <h3 class="font-lexend text-lg font-bold text-orange-500">Detalhes da Contratação</h3>
            <button id="modal-close" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
        
        <div class="p-4 overflow-y-auto max-h-[70vh]">
          <!-- Informações do Cliente -->
          <div class="mb-6">
            <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">Informações do Cliente</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-gray-500">Nome</p>
                <p class="font-medium text-sm">${aula.nome || aula.nomeCliente || '--'}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">CPF</p>
                <p class="font-medium text-sm">${aula.cpf || '--'}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Aluno(s)</p>
                <p class="font-medium text-sm">${aula.nomeAluno || '--'}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Data da Contratação</p>
                <p class="font-medium text-sm">${aula.dataContratacao || '--'}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Código</p>
                <p class="font-medium text-sm">${aula.codigoContratacao || '--'}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Tipo de Equipe</p>
                <p class="font-medium text-sm">${aula.equipe || '--'}</p>
              </div>
            </div>
          </div>
          
          <!-- Aulas Agendadas -->
          <div>
            <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">Aulas Agendadas</h4>
            ${renderAulasDetalhadas(aula.aulas || [])}
          </div>
        </div>
        
        <div class="p-4 border-t border-gray-200 bg-gray-50">
          <div class="flex justify-end space-x-3">
            <button id="modal-close-btn" class="btn-secondary btn-compact">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Adicionar modal ao body
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
  
  // Configurar eventos do modal
  const closeModal = () => modalContainer.remove();
  
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  
  // Fechar modal ao pressionar ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);
  
  // Fechar modal ao clicar fora
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) closeModal();
  });
  
  // Remover listener quando modal fechar
  modalContainer.addEventListener('remove', () => {
    document.removeEventListener('keydown', escHandler);
  });
}

// Renderizar aulas detalhadas para o modal
function renderAulasDetalhadas(aulas) {
  if (!aulas || aulas.length === 0) {
    return '<p class="text-gray-500 text-center py-4 text-sm">Nenhuma aula agendada</p>';
  }
  
  let html = `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr class="bg-orange-50">
            <th class="p-2 text-left font-semibold text-orange-700">Data</th>
            <th class="p-2 text-left font-semibold text-orange-700">Horário</th>
            <th class="p-2 text-left font-semibold text-orange-700">Duração</th>
            <th class="p-2 text-left font-semibold text-orange-700">Matéria</th>
            <th class="p-2 text-left font-semibold text-orange-700">Professor</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  aulas.forEach((aula, index) => {
    html += `
      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200">
        <td class="p-2">${aula.data || '--'}</td>
        <td class="p-2">${formatTime(aula.horario)}</td>
        <td class="p-2">${aula.duracao || '--'}</td>
        <td class="p-2">${aula.materia || '--'}</td>
        <td class="p-2">
          <span class="${!aula.professor || aula.professor === 'A definir' ? 'text-orange-500 font-semibold' : ''}">
            ${aula.professor || 'A definir'}
          </span>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  return html;
}

// Editar aula (implementação básica)
function editAula(aula) {
  console.log('✏️ Editando aula:', aula.id);
  showToast(`✏️ Editando aula ${aula.codigoContratacao || aula.id}`, 'info');
  
  // Implementação completa será feita posteriormente
  // Abrir modal de edição com formulário preenchido
}

// Função para animar contador
function animateCounter(elementId, finalValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  let current = 0;
  const increment = finalValue / 30;
  const interval = setInterval(() => {
    current += increment;
    if (current >= finalValue) {
      current = finalValue;
      clearInterval(interval);
    }
    element.textContent = Math.round(current);
  }, 30);
}

// Função para limpar filtros
function clearFilters() {
  document.getElementById('filter-cliente').value = '';
  document.getElementById('filter-data').value = '';
  document.getElementById('filter-codigo').value = '';
  document.getElementById('filter-professor').value = '';
  document.getElementById('filter-data-custom').classList.add('hidden');
  document.getElementById('filter-data-custom').value = '';
}

// Exportar função para uso global
if (typeof window !== 'undefined') {
  window.loadBancoDeAulas = loadBancoDeAulas;
  console.log('✅ loadBancoDeAulas exportado para escopo global');
}
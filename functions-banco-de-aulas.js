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
  
  // Estrutura da seção ATUALIZADA com novos botões
  section.innerHTML = `
    <div class="space-y-4">
      <!-- Botões Especiais - Primeira Div (Compacta) -->
      <div class="botões-especiais">
        <div class="flex flex-wrap gap-2 mb-2">
          <button id="btn-aulas-hoje" class="btn-primary btn-compact">
            <i class="fas fa-calendar-day mr-1 text-xs"></i>
            Aulas de Hoje
          </button>
          <button id="btn-aulas-semana" class="btn-primary btn-compact">
            <i class="fas fa-calendar-week mr-1 text-xs"></i>
            Aulas para esta semana
          </button>
          <button id="btn-sem-professor" class="btn-primary btn-compact">
            <i class="fas fa-user-slash mr-1 text-xs"></i>
            Cronogramas sem professor
          </button>
          <button id="btn-pagamentos-pendentes" class="btn-primary btn-compact">
            <i class="fas fa-money-bill-wave mr-1 text-xs"></i>
            Pagamentos pendentes
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
        <div class="flex flex-col items-center justify-center py-12">
          <div class="loading-spinner-large mb-4"></div>
          <p class="text-orange-500 font-comfortaa font-bold text-center">
            Carregando banco de aulas<br>
            <span class="text-sm font-normal text-gray-500 mt-1 block">
              Buscando dados do Firebase...
            </span>
          </p>
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
    
    // Renderizar cards usando a função do arquivo de cards
    if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
      BancoDeAulasCards.renderAulasCards(AULAS_DATA);
    } else {
      console.error('❌ Função renderAulasCards não disponível');
      // Fallback: renderizar cards diretamente
      renderAulasCardsFallback(AULAS_DATA);
    }
    
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

// Fallback para renderização de cards
function renderAulasCardsFallback(aulas) {
  console.log('⚠️ Usando fallback para renderização de cards');
  
  const container = document.getElementById('aulas-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="text-center py-8">
      <i class="fas fa-exclamation-triangle text-3xl text-orange-500 mb-3"></i>
      <h3 class="font-lexend text-lg mb-2">Módulo de Cards não carregado</h3>
      <p class="text-gray-600 text-sm mb-4">Recarregue a página ou verifique o console.</p>
    </div>
  `;
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

// Configurar eventos da seção
function setupBancoDeAulasEvents() {
  console.log('⚙️ Configurando eventos da seção Banco de Aulas');
  
  // Botão "Aulas de Hoje"
  document.getElementById('btn-aulas-hoje')?.addEventListener('click', () => {
    filterAulasHoje();
  });
  
  // Botão "Aulas para esta semana"
  document.getElementById('btn-aulas-semana')?.addEventListener('click', () => {
    filterAulasEstaSemana();
  });
  
  // Botão "Cronogramas sem professor"
  document.getElementById('btn-sem-professor')?.addEventListener('click', () => {
    filterAulasSemProfessor();
  });
  
  // Botão "Pagamentos pendentes"
  document.getElementById('btn-pagamentos-pendentes')?.addEventListener('click', () => {
    filterPagamentosPendentes();
  });
  
  // Botão "Atualizar Dados"
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshAulasData();
  });
  
  // Botão "Aplicar Filtros"
  document.getElementById('btn-aplicar-filtros')?.addEventListener('click', () => {
    applyFilters();
  });
  
  // Permitir Enter no campo de código
  document.getElementById('filter-codigo')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });
}

// Filtrar aulas de hoje
async function filterAulasHoje() {
  const btn = document.getElementById('btn-aulas-hoje');
  if (!btn) return;
  
  const originalHTML = btn.innerHTML;
  
  // Mostrar loading no botão
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-xs"></i> Buscando...';
  btn.disabled = true;
  
  try {
    const hoje = getTodayFormatted();
    const filteredAulas = AULAS_DATA.filter(aula => {
      if (!aula.aulas || !Array.isArray(aula.aulas)) return false;
      
      return aula.aulas.some(a => {
        if (!a.data) return false;
        return a.data.includes(hoje);
      });
    });
    
    if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
      BancoDeAulasCards.renderAulasCards(filteredAulas);
    }
    
    showToast(`📅 Encontradas ${filteredAulas.length} aulas para hoje`, 'info', 2000);
  } catch (error) {
    console.error('❌ Erro ao filtrar aulas de hoje:', error);
    showToast('❌ Erro ao filtrar aulas de hoje', 'error');
  } finally {
    // Restaurar botão
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

// Filtrar aulas desta semana
async function filterAulasEstaSemana() {
  const btn = document.getElementById('btn-aulas-semana');
  if (!btn) return;
  
  const originalHTML = btn.innerHTML;
  
  // Mostrar loading no botão
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-xs"></i> Buscando...';
  btn.disabled = true;
  
  try {
    const hoje = new Date();
    const fimDaSemana = new Date();
    fimDaSemana.setDate(hoje.getDate() + 7);
    
    const filteredAulas = AULAS_DATA.filter(aula => {
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
    
    if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
      BancoDeAulasCards.renderAulasCards(filteredAulas);
    }
    
    showToast(`📅 Encontradas ${filteredAulas.length} aulas para esta semana`, 'info', 2000);
  } catch (error) {
    console.error('❌ Erro ao filtrar aulas da semana:', error);
    showToast('❌ Erro ao filtrar aulas da semana', 'error');
  } finally {
    // Restaurar botão
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

// Filtrar aulas sem professor
async function filterAulasSemProfessor() {
  const btn = document.getElementById('btn-sem-professor');
  if (!btn) return;
  
  const originalHTML = btn.innerHTML;
  
  // Mostrar loading no botão
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-xs"></i> Buscando...';
  btn.disabled = true;
  
  try {
    const filteredAulas = AULAS_DATA.filter(aula => {
      if (!aula.aulas || !Array.isArray(aula.aulas)) return false;
      
      return aula.aulas.some(a => 
        !a.professor || a.professor === 'A definir' || a.professor === ''
      );
    });
    
    if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
      BancoDeAulasCards.renderAulasCards(filteredAulas);
    }
    
    showToast(`👨‍🏫 Encontrados ${filteredAulas.length} cronogramas com aulas sem professor`, 'info', 2000);
  } catch (error) {
    console.error('❌ Erro ao filtrar aulas sem professor:', error);
    showToast('❌ Erro ao filtrar aulas sem professor', 'error');
  } finally {
    // Restaurar botão
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

// Filtrar pagamentos pendentes
async function filterPagamentosPendentes() {
  const btn = document.getElementById('btn-pagamentos-pendentes');
  if (!btn) return;
  
  const originalHTML = btn.innerHTML;
  
  // Mostrar loading no botão
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1 text-xs"></i> Buscando...';
  btn.disabled = true;
  
  try {
    const filteredAulas = AULAS_DATA.filter(aula => {
      // Verificar se statusPagamento existe e não é "Pagamento Efetuado"
      return aula.statusPagamento && aula.statusPagamento !== 'Pagamento Efetuado';
    });
    
    if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
      BancoDeAulasCards.renderAulasCards(filteredAulas);
    }
    
    showToast(`💰 Encontrados ${filteredAulas.length} contratos com pagamentos pendentes`, 'info', 2000);
  } catch (error) {
    console.error('❌ Erro ao filtrar pagamentos pendentes:', error);
    showToast('❌ Erro ao filtrar pagamentos pendentes', 'error');
  } finally {
    // Restaurar botão
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
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
    const [aulas, clientes, professores] = await Promise.all([
      BANCO.fetchBancoDeAulas(true),
      BANCO.fetchCadastroClientes(true),
      BANCO.fetchDataBaseProfessores(true)
    ]);
    
    // Atualizar variáveis globais
    AULAS_DATA = aulas || [];
    CLIENTES_DATA = clientes || [];
    PROFESSORES_DATA = professores || [];
    
    // Recriar filtros
    populateClienteFilter(CLIENTES_DATA);
    populateProfessorFilter(PROFESSORES_DATA);
    
    // Re-renderizar cards
    if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
      BancoDeAulasCards.renderAulasCards(AULAS_DATA);
    }
    
    showToast('✅ Dados atualizados com sucesso', 'success', 2000);
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
function applyFilters() {
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
          dataFiltro = getTodayFormatted();
          break;
        case 'amanha':
          const amanha = new Date(hoje);
          amanha.setDate(hoje.getDate() + 1);
          dataFiltro = formatDate(amanha);
          break;
        case 'ontem':
          const ontem = new Date(hoje);
          ontem.setDate(hoje.getDate() - 1);
          dataFiltro = formatDate(ontem);
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
  const filteredAulas = applyAulasFilters(AULAS_DATA, filters);
  
  if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
    BancoDeAulasCards.renderAulasCards(filteredAulas, filters);
  }
  
  // Mostrar mensagem de filtros aplicados
  const numFiltros = Object.keys(filters).length;
  if (numFiltros > 0) {
    showToast(`🔍 ${numFiltros} filtro${numFiltros !== 1 ? 's' : ''} aplicado${numFiltros !== 1 ? 's' : ''}`, 'info', 2000);
  }
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

// Exportar função para uso global
if (typeof window !== 'undefined') {
  window.loadBancoDeAulas = loadBancoDeAulas;
  console.log('✅ loadBancoDeAulas exportado para escopo global');
}
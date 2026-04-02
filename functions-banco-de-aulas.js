console.log('✅ functions-banco-de-aulas.js carregado');

// Variáveis globais para esta seção
let AULAS_DATA = [];
let CLIENTES_DATA = [];
let PROFESSORES_DATA = [];
let AULAS_LISTA_AGRUPADAS = {}; // Cache com aulas agrupadas por prefixo

// Função para carregar aulas de BancoDeAulas-Lista em batch
async function carregarAulasBatch() {
  console.log('📥 Carregando aulas de BancoDeAulas-Lista em batch...');
  
  try {
    // Fetch todas as aulas da coleção
    const aulasLista = await BANCO.fetchBancoDeAulasListaBatch();
    
    console.log(`📊 Total de aulas recebidas: ${aulasLista ? aulasLista.length : 0}`);
    
    if (!aulasLista || aulasLista.length === 0) {
      console.log('⚠️ Nenhuma aula encontrada em BancoDeAulas-Lista');
      return {};
    }
    
    // Agrupar por prefixo (primeiros 4 dígitos)
    const agrupadas = {};
    let invalidosCount = 0;
    let validosCount = 0;
    
    aulasLista.forEach((aula, index) => {
      // Extrair prefixo dos primeiros 4 dígitos do ID do documento
      const docId = aula.id || '';
      const prefixo = docId.substring(0, 4);
      const statusAula = aula.StatusAula || 'Não informado';
      const professor = aula.professor || 'A definir';
      // Verificar se StatusAula = "Concluída" (case-insensitive)
      const concluida = statusAula.toLowerCase() === 'concluída';
      
      // Validações aprimoradas
      if (!prefixo || prefixo.length < 4 || !/^\d{4}/.test(prefixo)) {
        console.warn(`⚠️ [${index}] Documento com prefixo inválido:`, {docId, prefixo: prefixo || 'vazio', StatusAula: statusAula});
        invalidosCount++;
        return;
      }
      
      // Inicializar array se não existe
      if (!agrupadas[prefixo]) {
        agrupadas[prefixo] = [];
      }
      
      // Adicionar aula ao grupo
      agrupadas[prefixo].push({
        id: docId,
        statusAula: statusAula,
        concluida: concluida,
        professor: professor
      });
      
      validosCount++;
      
      // Log a cada 5 aulas para diagnóstico
      if ((index + 1) % 5 === 0) {
        console.log(`🔄 Processadas ${index + 1} aulas... (${validosCount} válidas, ${invalidosCount} inválidas)`);
      }
    });
    
    console.log(`✅ ${Object.keys(agrupadas).length} grupos de aulas carregados`);
    console.log(`📈 Total: ${validosCount} aulas válidas, ${invalidosCount} inválidas`);
    console.log('📋 Prefixos encontrados:', Object.keys(agrupadas).sort());
    console.log('📊 Distribuição por prefixo:', 
      Object.keys(agrupadas).reduce((acc, prefixo) => {
        acc[prefixo] = agrupadas[prefixo].length;
        return acc;
      }, {})
    );
    
    AULAS_LISTA_AGRUPADAS = agrupadas;
    return agrupadas;
    
  } catch (error) {
    console.error('❌ Erro ao carregar aulas em batch:', error);
    return {};
  }
}

// Função para obter aulas de uma contratação específica
function obterAulasContratacao(idContratacao) {
  // Limpar espaços e caracteres extras
  const idLimpo = (idContratacao || '').trim();
  const prefixo = idLimpo.substring(0, 4);
  
  // Verificar se prefixo é válido
  if (!prefixo || prefixo.length < 4 || !/^\d{4}/.test(prefixo)) {
    console.error(`❌ obterAulasContratacao => ID INVÁLIDO: "${idContratacao}"`, {
      idLimpo,
      prefixo,
      motivo: 'Prefixo não contém 4 dígitos ou ID vazio'
    });
    return {
      total: 0,
      concluidas: 0,
      aulas: []
    };
  }
  
  const aulas = AULAS_LISTA_AGRUPADAS[prefixo] || [];
  
  // Calcular estatísticas
  const total = aulas.length;
  // Aulas concluídas: contar quantos têm StatusAula = "Concluída" (case-insensitive)
  const concluidas = aulas.filter(a => 
    a.statusAula && 
    a.statusAula.toLowerCase() === 'concluída'
  ).length;
  // Equipe confirmada: contar quantos têm professor definido (não "A definir")
  const comProfessor = aulas.filter(a => 
    a.professor && 
    a.professor.toLowerCase() !== 'a definir' && 
    a.professor.trim() !== ''
  ).length;
  
  if (total === 0) {
    console.warn(`⚠️ obterAulasContratacao => SEM AULAS!`, {
      id: idContratacao,
      idLimpo,
      prefixo,
      prefixosDisponiveis: Object.keys(AULAS_LISTA_AGRUPADAS).sort(),
      sugestao: `Procurando prefixo "${prefixo}" mas não encontrado no cache`
    });
  } else {
    console.log(`✅ obterAulasContratacao => ID: ${idContratacao}`, {
      prefixo,
      total,
      comProfessor,
      concluidas,
      detalhes: `${comProfessor} com professor | ${concluidas} concluídas`
    });
  }
  
  return {
    total,
    concluidas,
    comProfessor,
    aulas: aulas
  };
}

// Função para carregar a seção Banco de Aulas
async function loadBancoDeAulas() {
  console.log('🚀 loadBancoDeAulas iniciado');
  
  const section = document.getElementById('banco-aulas');
  
  if (!section) {
    console.error('❌ Seção banco-aulas não encontrada');
    return;
  }
  
  // Estrutura da seção com barra de filtros em dropdowns
  section.innerHTML = `
    <div class="space-y-4">
      <!-- Barra de Filtros Unificada -->
      <div class="filter-container p-3">
        <!-- Linha principal: Datas, Professores, Atualizar, Limpar, Mais Filtros -->
        <div class="flex flex-wrap gap-3 items-end w-full">

          <!-- Filtros de Datas -->
          <div class="filter-group flex-1 min-w-[150px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-calendar-alt mr-1 text-orange-400"></i>Filtros de Datas
            </label>
            <select id="filter-datas" class="filter-select filter-compact w-full">
              <option value="">Selecione...</option>
              <option value="hoje">Aulas de Hoje</option>
              <option value="semana">Aulas para Semana</option>
            </select>
          </div>

          <!-- Filtro Professores -->
          <div class="filter-group flex-1 min-w-[150px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-chalkboard-user mr-1 text-orange-400"></i>Filtro Professores
            </label>
            <select id="filter-professor" class="filter-select filter-compact w-full">
              <option value="">Selecione...</option>
            </select>
          </div>

          <!-- Filtro Aulas -->
          <div class="filter-group flex-1 min-w-[150px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-book-open mr-1 text-orange-400"></i>Filtro Aulas
            </label>
            <select id="filter-aulas" class="filter-select filter-compact w-full">
              <option value="">Selecione...</option>
              <option value="todos">Todos os Cronogramas</option>
              <option value="execucao" selected>Cronogramas em execução</option>
              <option value="completos">Cronogramas completos</option>
            </select>
          </div>

          <!-- Atualizar Dados -->
          <div class="filter-group flex-1 min-w-[120px] flex items-end">
            <button id="btn-refresh" class="btn-secondary btn-compact w-full">
              <i class="fas fa-sync-alt mr-1 text-xs"></i>
              Atualizar Dados
            </button>
          </div>

          <!-- Limpar Filtros -->
          <div class="filter-group flex-1 min-w-[120px] flex items-end">
            <button id="btn-limpar-filtros" class="btn-secondary btn-compact w-full">
              <i class="fas fa-eraser mr-1 text-xs"></i>
              Limpar Filtros
            </button>
          </div>

          <!-- Mais Filtros (toggle) -->
          <div class="filter-group flex-1 min-w-[120px] flex items-end">
            <button id="btn-mais-filtros" class="btn-secondary btn-compact w-full">
              <i class="fas fa-chevron-down mr-1 text-xs" id="icon-mais-filtros"></i>
              Mais Filtros
            </button>
          </div>

        </div>

        <!-- Segunda linha: filtros extras (oculta por padrão) -->
        <div id="filtros-extras" class="flex flex-wrap gap-3 items-end mt-3 hidden w-full">

          <!-- Filtro Pagamento -->
          <div class="filter-group flex-1 min-w-[150px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-money-bill-wave mr-1 text-orange-400"></i>Filtro Pagamento
            </label>
            <select id="filter-pagamento" class="filter-select filter-compact w-full">
              <option value="">Selecione...</option>
              <option value="Aguardando 1º Pagamento">Pagamento Pendente</option>
              <option value="Aguardando 2º Pagamento">Aguardando 2º Pagamento</option>
              <option value="Pagamento completo">Pagamento Completo</option>
            </select>
          </div>

          <!-- Cliente -->
          <div class="filter-group flex-1 min-w-[150px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-user mr-1 text-orange-400"></i>Cliente
            </label>
            <select id="filter-cliente" class="filter-select filter-compact w-full">
              <option value="">Todos os clientes</option>
            </select>
          </div>

          <!-- Código -->
          <div class="filter-group flex-1 min-w-[150px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-hashtag mr-1 text-orange-400"></i>Código
            </label>
            <input type="text" id="filter-codigo"
                   class="filter-input filter-compact w-full"
                   placeholder="Digite o código"
                   maxlength="10">
          </div>

        </div>
      </div>

      <!-- Cards de Aulas -->
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
    
    // Carregar aulas de BancoDeAulas-Lista em batch
    console.log('⏳ Iniciando carregamento de aulas em batch...');
    const aulasAgrupadas = await carregarAulasBatch();
    console.log('✅ Batch de aulas carregado. AULAS_LISTA_AGRUPADAS:', Object.keys(aulasAgrupadas).length, 'grupos');
    
    // Popular filtro de clientes
    populateClienteFilter(CLIENTES_DATA);
    
    // Popular filtro de professores
    populateProfessorFilter(PROFESSORES_DATA);
    
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
    
    // Aplicar filtro padrão: Cronogramas em execução
    const filterAulas = document.getElementById('filter-aulas');
    if (filterAulas) {
      filterAulas.value = 'execucao';
      filterAulas.dispatchEvent(new Event('change'));
    }
    
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

  // Adicionar separador e opção "Cronograma sem professor"
  const separador = document.createElement('option');
  separador.disabled = true;
  separador.textContent = '──────────────';
  select.appendChild(separador);

  const semProfessor = document.createElement('option');
  semProfessor.value = '__sem-professor__';
  semProfessor.textContent = 'Cronograma sem professor';
  select.appendChild(semProfessor);
}

// Helper: resetar todos os filtros exceto o que está sendo usado
function resetOtherFilters(exceptId) {
  const filterIds = ['filter-datas', 'filter-professor', 'filter-pagamento', 'filter-aulas', 'filter-cliente'];
  filterIds.forEach(id => {
    if (id === exceptId) return;
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Limpar código também se não for o filtro ativo
  if (exceptId !== 'filter-codigo') {
    const codigoInput = document.getElementById('filter-codigo');
    if (codigoInput) codigoInput.value = '';
  }
}

// Helper: renderizar resultado filtrado
function renderFilteredResults(filteredAulas, msg) {
  if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
    BancoDeAulasCards.renderAulasCards(filteredAulas);
  }
  if (msg) showToast(msg, 'info', 2000);
}

// Configurar eventos da seção
function setupBancoDeAulasEvents() {
  console.log('⚙️ Configurando eventos da seção Banco de Aulas');

  // ── Filtro de Datas ──
  document.getElementById('filter-datas')?.addEventListener('change', function () {
    if (!this.value) {
      renderFilteredResults(AULAS_DATA);
      return;
    }
    resetOtherFilters('filter-datas');

    if (this.value === 'hoje') {
      const hoje = getTodayFormatted();
      const result = AULAS_DATA.filter(aula =>
        aula.aulas?.some(a => a.data && a.data.includes(hoje))
      );
      renderFilteredResults(result, `📅 ${result.length} aula(s) para hoje`);
    } else if (this.value === 'semana') {
      const hoje = new Date();
      const fimDaSemana = new Date();
      fimDaSemana.setDate(hoje.getDate() + 7);
      const result = AULAS_DATA.filter(aula =>
        aula.aulas?.some(a => {
          if (!a.data) return false;
          const match = a.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (!match) return false;
          const dataAula = new Date(match[3], match[2] - 1, match[1]);
          return dataAula >= hoje && dataAula <= fimDaSemana;
        })
      );
      renderFilteredResults(result, `📅 ${result.length} aula(s) para esta semana`);
    }
  });

  // ── Filtro de Professores ──
  document.getElementById('filter-professor')?.addEventListener('change', function () {
    if (!this.value) {
      renderFilteredResults(AULAS_DATA);
      return;
    }
    resetOtherFilters('filter-professor');

    if (this.value === '__sem-professor__') {
      const result = AULAS_DATA.filter(aula =>
        aula.aulas?.some(a =>
          !a.professor || a.professor === 'A definir' || a.professor.trim() === ''
        )
      );
      renderFilteredResults(result, `👨‍🏫 ${result.length} cronograma(s) sem professor`);
    } else {
      // Buscar nome do professor pelo ID selecionado
      const selectedOption = this.options[this.selectedIndex];
      const nomeProfessor = selectedOption ? selectedOption.textContent : '';
      const result = AULAS_DATA.filter(aula =>
        aula.aulas?.some(a =>
          a.professor && a.professor.toLowerCase().includes(nomeProfessor.toLowerCase())
        )
      );
      renderFilteredResults(result, `👨‍🏫 ${result.length} cronograma(s) com ${nomeProfessor}`);
    }
  });

  // ── Filtro de Pagamento ──
  document.getElementById('filter-pagamento')?.addEventListener('change', function () {
    if (!this.value) {
      renderFilteredResults(AULAS_DATA);
      return;
    }
    resetOtherFilters('filter-pagamento');

    const result = AULAS_DATA.filter(aula => aula.statusPagamento === this.value);
    const label = this.options[this.selectedIndex]?.textContent || this.value;
    renderFilteredResults(result, `💰 ${result.length} cronograma(s) — ${label}`);
  });

  // ── Filtro de Aulas (status dos cronogramas) ──
  document.getElementById('filter-aulas')?.addEventListener('change', function () {
    if (!this.value) {
      renderFilteredResults(AULAS_DATA);
      return;
    }
    resetOtherFilters('filter-aulas');

    if (this.value === 'todos') {
      renderFilteredResults(AULAS_DATA, `📋 ${AULAS_DATA.length} cronograma(s) no total`);
    } else if (this.value === 'execucao') {
      // Cronogramas em execução: pelo menos uma aula com status "Pendente" ou sem status
      const result = AULAS_DATA.filter(aula => {
        const aulasInfo = obterAulasContratacao(aula.codigoContratacao || '');
        if (aulasInfo.total === 0) return false;
        return aulasInfo.aulas.some(a => {
          const st = (a.statusAula || '').toLowerCase();
          return st === 'pendente' || st === 'não informado' || st === '';
        });
      });
      renderFilteredResults(result, `▶️ ${result.length} cronograma(s) em execução`);
    } else if (this.value === 'completos') {
      // Cronogramas completos: TODAS as aulas são "Concluída" ou "Reposição"
      const result = AULAS_DATA.filter(aula => {
        const aulasInfo = obterAulasContratacao(aula.codigoContratacao || '');
        if (aulasInfo.total === 0) return false;
        return aulasInfo.aulas.every(a => {
          const st = (a.statusAula || '').toLowerCase();
          return st === 'concluída' || st === 'reposição';
        });
      });
      renderFilteredResults(result, `✅ ${result.length} cronograma(s) completo(s)`);
    }
  });

  // ── Filtro de Cliente ──
  document.getElementById('filter-cliente')?.addEventListener('change', function () {
    if (!this.value) {
      renderFilteredResults(AULAS_DATA);
      return;
    }
    resetOtherFilters('filter-cliente');

    const result = AULAS_DATA.filter(aula => aula.cpf === this.value);
    renderFilteredResults(result, `👤 ${result.length} cronograma(s) do cliente`);
  });

  // ── Filtro de Código (Enter) ──
  document.getElementById('filter-codigo')?.addEventListener('keyup', function (e) {
    if (e.key === 'Enter' && this.value.trim()) {
      resetOtherFilters('filter-codigo');
      const termo = this.value.trim().toLowerCase();
      const result = AULAS_DATA.filter(aula => {
        const codigo = (aula.codigoContratacao || '').toLowerCase();
        return codigo.includes(termo);
      });
      renderFilteredResults(result, `🔍 ${result.length} cronograma(s) encontrado(s)`);
    }
  });

  // ── Botão Atualizar Dados ──
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshAulasData();
  });

  // ── Botão Limpar Filtros ──
  document.getElementById('btn-limpar-filtros')?.addEventListener('click', () => {
    resetOtherFilters(null);
    renderFilteredResults(AULAS_DATA, '🧹 Filtros limpos');
  });

  // ── Botão Mais Filtros (toggle segunda linha) ──
  document.getElementById('btn-mais-filtros')?.addEventListener('click', function () {
    const extras = document.getElementById('filtros-extras');
    const icon = document.getElementById('icon-mais-filtros');
    if (!extras) return;
    const hidden = extras.classList.toggle('hidden');
    if (icon) {
      icon.classList.toggle('fa-chevron-down', hidden);
      icon.classList.toggle('fa-chevron-up', !hidden);
    }
    this.querySelector('span')?.remove();
  });
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

// Exportar função para uso global
if (typeof window !== 'undefined') {
  window.loadBancoDeAulas = loadBancoDeAulas;
  window.obterAulasContratacao = obterAulasContratacao;
  window.carregarAulasBatch = carregarAulasBatch;
  console.log('✅ Funções de Banco de Aulas exportadas para escopo global');
}
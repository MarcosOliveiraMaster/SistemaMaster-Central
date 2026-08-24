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
      // FIX: usar campo id-Aula (ex: "0001A") em vez de aula.id (Firestore auto-ID)
      // Firestore auto-IDs são alfanuméricos e falham na validação !/^\d{4}/
      const idAulaField = aula['id-Aula'] || aula.codigoContratacao || '';
      const prefixo = idAulaField.substring(0, 4);
      const statusAula = aula.StatusAula || 'Não informado';
      const professor = aula.professor || 'A definir';
      // Verificar se StatusAula = "Concluída" (case-insensitive)
      const concluida = statusAula.toLowerCase() === 'concluída';
      
      // Validações aprimoradas
      if (!prefixo || prefixo.length < 4 || !/^\d{4}/.test(prefixo)) {
        console.warn(`⚠️ [${index}] Documento com prefixo inválido:`, {idAula: idAulaField, prefixo: prefixo || 'vazio', StatusAula: statusAula});
        invalidosCount++;
        return;
      }
      
      // Inicializar array se não existe
      if (!agrupadas[prefixo]) {
        agrupadas[prefixo] = [];
      }
      
      // Adicionar aula ao grupo
      agrupadas[prefixo].push({
        id: aula.id,
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
  // Total "válido": não contamos aulas Reagendadas (foram substituídas por uma
  // aula de Reposição, contar as duas duplicaria a aula no total exibido)
  const totalValidas = aulas.filter(a =>
    (a.statusAula || '').toLowerCase() !== 'reagendada'
  ).length;
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
      totalValidas,
      comProfessor,
      concluidas,
      detalhes: `${comProfessor} com professor | ${concluidas} concluídas`
    });
  }

  return {
    total,
    totalValidas,
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
        <!-- Linha principal: Professores, Clientes, Atualizar, Mais Filtros -->
        <div class="flex flex-wrap gap-3 items-end w-full">

          <!-- Filtro Professores (busca + múltipla escolha) -->
          <div class="filter-group flex-1 min-w-[200px] ms-wrap">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-chalkboard-user mr-1 text-orange-400"></i>Professores
            </label>
            <button type="button" id="ms-professor-btn" class="filter-select filter-compact w-full ms-btn">
              <span id="ms-professor-btn-label">Todos os professores</span>
              <i class="fas fa-chevron-down text-xs"></i>
            </button>
            <div id="ms-professor-panel" class="ms-panel hidden">
              <div class="ms-search-wrap">
                <input type="text" id="ms-professor-search" class="ms-search-input" placeholder="Buscar professor...">
              </div>
              <div id="ms-professor-options" class="ms-options"></div>
            </div>
          </div>

          <!-- Filtro Clientes (busca + múltipla escolha) -->
          <div class="filter-group flex-1 min-w-[200px] ms-wrap">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-user mr-1 text-orange-400"></i>Clientes
            </label>
            <button type="button" id="ms-cliente-btn" class="filter-select filter-compact w-full ms-btn">
              <span id="ms-cliente-btn-label">Todos os clientes</span>
              <i class="fas fa-chevron-down text-xs"></i>
            </button>
            <div id="ms-cliente-panel" class="ms-panel hidden">
              <div class="ms-search-wrap">
                <input type="text" id="ms-cliente-search" class="ms-search-input" placeholder="Buscar cliente...">
              </div>
              <div id="ms-cliente-options" class="ms-options"></div>
            </div>
          </div>

          <!-- Toggle Ativos/Todos (mesma função do dropdown "Filtro Aulas", oculto abaixo) + Atualizar + Mais Filtros -->
          <div class="filter-group flex-none min-w-[160px]">
            <div class="ativos-todos-toggle" id="toggle-status-aulas">
              <button type="button" class="ativos-todos-seg active" data-value="ativos">Ativos</button>
              <button type="button" class="ativos-todos-seg" data-value="todos">Todos</button>
            </div>
            <div class="flex gap-3">
              <button id="btn-refresh" class="btn-secondary btn-compact flex-1">
                <i class="fas fa-sync-alt mr-1 text-xs"></i>
                Atualizar
              </button>
              <button id="btn-mais-filtros" class="btn-secondary btn-compact btn-icon-toggle" title="Mais filtros">
                <i class="fas fa-chevron-down text-xs" id="icon-mais-filtros"></i>
              </button>
            </div>
          </div>

        </div>

        <!-- Segunda linha: filtros extras (oculta por padrão) -->
        <div id="filtros-extras" class="flex flex-wrap gap-3 items-end mt-3 hidden w-full">

          <!-- Filtro Aulas: oculto (substituído pelo toggle Ativos/Todos), mas continua no DOM e funcional -->
          <div class="filter-group flex-1 min-w-[150px] hidden">
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

          <!-- Ano da Contratação -->
          <div class="filter-group flex-1 min-w-[120px]">
            <label class="filter-label filter-label-compact">
              <i class="fas fa-calendar-day mr-1 text-orange-400"></i>Ano
            </label>
            <input type="text" id="filter-ano"
                   class="filter-input filter-compact w-full"
                   placeholder="Ano"
                   value="2026"
                   inputmode="numeric"
                   maxlength="4">
          </div>

          <!-- Limpar Filtros (ícone apenas) -->
          <div class="filter-group flex-none flex items-end">
            <button id="btn-limpar-filtros" class="btn-secondary btn-compact btn-icon-toggle" title="Limpar filtros">
              <i class="fas fa-eraser text-xs"></i>
            </button>
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
    
    // Aplicar filtro padrão: Ativos (Cronogramas em execução)
    setStatusAulasToggle('ativos');
    
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

// Popular filtro de clientes (dropdown com busca + múltipla escolha)
function populateClienteFilter(clientes) {
  console.log('👥 Populando filtro de clientes:', clientes.length);

  const container = document.getElementById('ms-cliente-options');
  if (!container) {
    console.error('❌ Elemento ms-cliente-options não encontrado');
    return;
  }

  // Ordenar clientes por nome
  const clientesOrdenados = [...clientes].sort((a, b) => {
    const nomeA = a.nome || '';
    const nomeB = b.nome || '';
    return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
  });

  container.innerHTML = clientesOrdenados.map(cliente => {
    const nome = cliente.nome || 'Cliente sem nome';
    const cpf = cliente.cpf || cliente.id || '';
    return `
      <label class="ms-option" data-label="${nome.replace(/"/g, '&quot;')}">
        <input type="checkbox" value="${cpf}">
        <span>${nome}</span>
      </label>
    `;
  }).join('') || '<div class="ms-option-empty">Nenhum cliente encontrado</div>';
}

// Popular filtro de professores (dropdown com busca + múltipla escolha)
function populateProfessorFilter(professores) {
  console.log('👨‍🏫 Populando filtro de professores:', professores.length);

  const container = document.getElementById('ms-professor-options');
  if (!container) {
    console.error('❌ Elemento ms-professor-options não encontrado');
    return;
  }

  let html = professores.map(professor => {
    const nome = professor.nome || 'Professor sem nome';
    return `
      <label class="ms-option" data-label="${nome.replace(/"/g, '&quot;')}">
        <input type="checkbox" value="${professor.id}">
        <span>${nome}</span>
      </label>
    `;
  }).join('');

  html += `
    <label class="ms-option" data-label="Cronograma sem professor">
      <input type="checkbox" value="__sem-professor__">
      <span>Cronograma sem professor</span>
    </label>
  `;

  container.innerHTML = html;
}

// ── Multi-select com busca (dropdowns de Professores e Clientes) ──

function toggleMsPanel(prefix) {
  const panel = document.getElementById(`ms-${prefix}-panel`);
  if (!panel) return;
  const willOpen = panel.classList.contains('hidden');

  // Fecha qualquer outro painel aberto
  document.querySelectorAll('.ms-panel').forEach(p => p.classList.add('hidden'));

  if (willOpen) {
    panel.classList.remove('hidden');
    const search = document.getElementById(`ms-${prefix}-search`);
    if (search) {
      search.value = '';
      filterMsOptions(prefix);
      search.focus();
    }
  }
}

function filterMsOptions(prefix) {
  const term = (document.getElementById(`ms-${prefix}-search`)?.value || '')
    .trim().toLowerCase();
  const options = document.querySelectorAll(`#ms-${prefix}-options .ms-option`);
  options.forEach(opt => {
    const label = (opt.dataset.label || opt.textContent || '').toLowerCase();
    opt.style.display = label.includes(term) ? '' : 'none';
  });
}

function updateMsButtonLabel(prefix, allLabel) {
  const checks = Array.from(document.querySelectorAll(`#ms-${prefix}-options input[type=checkbox]:checked`));
  const labelEl = document.getElementById(`ms-${prefix}-btn-label`);
  if (!labelEl) return;

  if (checks.length === 0) {
    labelEl.textContent = allLabel;
  } else if (checks.length === 1) {
    labelEl.textContent = checks[0].closest('.ms-option')?.dataset.label || checks[0].value;
  } else {
    labelEl.textContent = `${checks.length} selecionados`;
  }
}

function getMsSelectedValues(prefix) {
  return Array.from(document.querySelectorAll(`#ms-${prefix}-options input[type=checkbox]:checked`))
    .map(cb => cb.value);
}

// Fecha os painéis de multi-select ao clicar fora deles
document.addEventListener('click', function (e) {
  document.querySelectorAll('.ms-wrap').forEach(wrap => {
    if (!wrap.contains(e.target)) {
      wrap.querySelector('.ms-panel')?.classList.add('hidden');
    }
  });
});

// Converte Firestore Timestamp (ou objeto {_seconds}) em Date
function timestampParaDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'object' && typeof v._seconds === 'number') return new Date(v._seconds * 1000);
  return null;
}

// Helper: renderizar resultado filtrado
function renderFilteredResults(filteredAulas, msg) {
  if (typeof BancoDeAulasCards !== 'undefined' && BancoDeAulasCards.renderAulasCards) {
    BancoDeAulasCards.renderAulasCards(filteredAulas);
  }
  if (msg) showToast(msg, 'info', 2000);
}

// ── Filtro combinado (todos os filtros ativos são somados/AND) ──
function computeAndRenderFilters() {
  let result = AULAS_DATA;
  const partes = [];

  // Professores (múltipla escolha, OR entre eles)
  const profIds = getMsSelectedValues('professor');
  if (profIds.length > 0) {
    result = result.filter(aula => profIds.some(pid => {
      if (pid === '__sem-professor__') {
        return aula.aulas?.some(a =>
          !a.professor || a.professor === 'A definir' || a.professor.trim() === ''
        );
      }
      const nomeProfessor = PROFESSORES_DATA.find(p => p.id === pid)?.nome || '';
      return aula.aulas?.some(a =>
        a.professor && a.professor.toLowerCase().includes(nomeProfessor.toLowerCase())
      );
    }));
    partes.push(`👨‍🏫 ${profIds.length} professor(es)`);
  }

  // Clientes (múltipla escolha, OR entre eles)
  const clienteCpfs = getMsSelectedValues('cliente');
  if (clienteCpfs.length > 0) {
    result = result.filter(aula => clienteCpfs.includes(aula.cpf));
    partes.push(`👤 ${clienteCpfs.length} cliente(s)`);
  }

  // Filtro de Aulas (status dos cronogramas)
  const aulasStatus = document.getElementById('filter-aulas')?.value;
  if (aulasStatus === 'execucao') {
    result = result.filter(aula => {
      const aulasInfo = obterAulasContratacao(aula.codigoContratacao || '');
      if (aulasInfo.total === 0) return false;
      return aulasInfo.aulas.some(a => {
        const st = (a.statusAula || '').toLowerCase();
        return st === 'pendente' || st === 'não informado' || st === '';
      });
    });
    partes.push('▶️ em execução');
  } else if (aulasStatus === 'completos') {
    result = result.filter(aula => {
      const aulasInfo = obterAulasContratacao(aula.codigoContratacao || '');
      if (aulasInfo.total === 0) return false;
      return aulasInfo.aulas.every(a => {
        const st = (a.statusAula || '').toLowerCase();
        return st === 'concluída' || st === 'reposição';
      });
    });
    partes.push('✅ completos');
  }

  // Pagamento
  const pagamento = document.getElementById('filter-pagamento')?.value;
  if (pagamento) {
    result = result.filter(aula => aula.statusPagamento === pagamento);
    partes.push('💰 pagamento');
  }

  // Código
  const codigo = document.getElementById('filter-codigo')?.value.trim().toLowerCase();
  if (codigo) {
    result = result.filter(aula => (aula.codigoContratacao || '').toLowerCase().includes(codigo));
    partes.push('🔍 código');
  }

  // Datas
  const datas = document.getElementById('filter-datas')?.value;
  if (datas === 'hoje') {
    const hoje = getTodayFormatted();
    result = result.filter(aula => aula.aulas?.some(a => a.data && a.data.includes(hoje)));
    partes.push('📅 hoje');
  } else if (datas === 'semana') {
    const hoje = new Date();
    const fimDaSemana = new Date();
    fimDaSemana.setDate(hoje.getDate() + 7);
    result = result.filter(aula => aula.aulas?.some(a => {
      if (!a.data) return false;
      const match = a.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return false;
      const dataAula = new Date(match[3], match[2] - 1, match[1]);
      return dataAula >= hoje && dataAula <= fimDaSemana;
    }));
    partes.push('📅 semana');
  }

  // Ano da contratação (só aplica depois de "commitado" via Enter/blur)
  const anoInput = document.getElementById('filter-ano');
  const ano = anoInput?.dataset.active === '1' ? anoInput.value.trim() : '';
  if (ano) {
    result = result.filter(aula => {
      const data = timestampParaDate(aula.timestamp);
      return data && String(data.getFullYear()) === ano;
    });
    partes.push(`📆 ano ${ano}`);
  }

  const msg = partes.length > 0
    ? `${result.length} cronograma(s) — ${partes.join(', ')}`
    : `${result.length} cronograma(s) no total`;
  renderFilteredResults(result, msg);
}

// Sincroniza a aparência do toggle Ativos/Todos com o estado atual
function syncStatusAulasToggleUI(value) {
  document.querySelectorAll('.ativos-todos-seg').forEach(seg => {
    seg.classList.toggle('active', seg.dataset.value === value);
  });
}

// Alterna o filtro de status das aulas (Ativos/Todos), reaproveitando o dropdown
// "Filtro Aulas" (oculto, mas ainda no DOM e funcional)
function setStatusAulasToggle(value) {
  syncStatusAulasToggleUI(value);
  const filterAulas = document.getElementById('filter-aulas');
  if (!filterAulas) return;
  filterAulas.value = value === 'ativos' ? 'execucao' : 'todos';
  filterAulas.dispatchEvent(new Event('change'));
}

// Commit do filtro de Ano (Enter ou blur)
function commitAnoFilter() {
  const input = document.getElementById('filter-ano');
  if (!input) return;
  const valor = input.value.trim();
  if (/^\d{4}$/.test(valor)) {
    input.dataset.active = '1';
  } else {
    delete input.dataset.active;
  }
  computeAndRenderFilters();
}

// Limpar todos os filtros da seção Banco de Aulas
function limparFiltrosBancoDeAulas() {
  document.querySelectorAll('#ms-professor-options input[type=checkbox]').forEach(cb => cb.checked = false);
  document.querySelectorAll('#ms-cliente-options input[type=checkbox]').forEach(cb => cb.checked = false);
  updateMsButtonLabel('professor', 'Todos os professores');
  updateMsButtonLabel('cliente', 'Todos os clientes');

  syncStatusAulasToggleUI('todos');
  const filterAulas = document.getElementById('filter-aulas');
  if (filterAulas) filterAulas.value = 'todos';

  const filterPagamento = document.getElementById('filter-pagamento');
  if (filterPagamento) filterPagamento.value = '';

  const filterDatas = document.getElementById('filter-datas');
  if (filterDatas) filterDatas.value = '';

  const filterCodigo = document.getElementById('filter-codigo');
  if (filterCodigo) filterCodigo.value = '';

  const filterAno = document.getElementById('filter-ano');
  if (filterAno) {
    filterAno.value = '2026';
    delete filterAno.dataset.active;
  }

  renderFilteredResults(AULAS_DATA, '🧹 Filtros limpos');
}

// Configurar eventos da seção
function setupBancoDeAulasEvents() {
  console.log('⚙️ Configurando eventos da seção Banco de Aulas');

  // ── Dropdown Professores (busca + múltipla escolha) ──
  document.getElementById('ms-professor-btn')?.addEventListener('click', () => toggleMsPanel('professor'));
  document.getElementById('ms-professor-search')?.addEventListener('input', () => filterMsOptions('professor'));
  document.getElementById('ms-professor-options')?.addEventListener('change', (e) => {
    if (e.target.matches('input[type=checkbox]')) {
      updateMsButtonLabel('professor', 'Todos os professores');
      computeAndRenderFilters();
    }
  });

  // ── Dropdown Clientes (busca + múltipla escolha) ──
  document.getElementById('ms-cliente-btn')?.addEventListener('click', () => toggleMsPanel('cliente'));
  document.getElementById('ms-cliente-search')?.addEventListener('input', () => filterMsOptions('cliente'));
  document.getElementById('ms-cliente-options')?.addEventListener('change', (e) => {
    if (e.target.matches('input[type=checkbox]')) {
      updateMsButtonLabel('cliente', 'Todos os clientes');
      computeAndRenderFilters();
    }
  });

  // ── Toggle Ativos/Todos (mesma função do "Filtro de Aulas", agora oculto) ──
  document.querySelectorAll('.ativos-todos-seg').forEach(seg => {
    seg.addEventListener('click', () => setStatusAulasToggle(seg.dataset.value));
  });

  // ── Filtro de Aulas (status dos cronogramas) ──
  document.getElementById('filter-aulas')?.addEventListener('change', computeAndRenderFilters);

  // ── Filtro de Pagamento ──
  document.getElementById('filter-pagamento')?.addEventListener('change', computeAndRenderFilters);

  // ── Filtro de Datas ──
  document.getElementById('filter-datas')?.addEventListener('change', computeAndRenderFilters);

  // ── Filtro de Código (Enter) ──
  document.getElementById('filter-codigo')?.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') computeAndRenderFilters();
  });

  // ── Filtro de Ano (Enter ou ao sair do campo) ──
  const filterAno = document.getElementById('filter-ano');
  if (filterAno) {
    filterAno.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') commitAnoFilter();
    });
    filterAno.addEventListener('blur', commitAnoFilter);
  }

  // ── Botão Atualizar ──
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    refreshAulasData();
  });

  // ── Botão Limpar Filtros ──
  document.getElementById('btn-limpar-filtros')?.addEventListener('click', limparFiltrosBancoDeAulas);

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
    
    // Recriar filtros (preservando seleção de professores/clientes já marcados)
    const profSelecionados = getMsSelectedValues('professor');
    const clientesSelecionados = getMsSelectedValues('cliente');
    populateClienteFilter(CLIENTES_DATA);
    populateProfessorFilter(PROFESSORES_DATA);
    document.querySelectorAll('#ms-professor-options input[type=checkbox]').forEach(cb => {
      cb.checked = profSelecionados.includes(cb.value);
    });
    document.querySelectorAll('#ms-cliente-options input[type=checkbox]').forEach(cb => {
      cb.checked = clientesSelecionados.includes(cb.value);
    });
    updateMsButtonLabel('professor', 'Todos os professores');
    updateMsButtonLabel('cliente', 'Todos os clientes');

    // Re-renderizar cards respeitando os filtros ativos
    computeAndRenderFilters();

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
  window.limparFiltrosBancoDeAulas = limparFiltrosBancoDeAulas;
  console.log('✅ Funções de Banco de Aulas exportadas para escopo global');
}
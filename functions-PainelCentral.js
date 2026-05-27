console.log('functions-PainelCentral.js carregado');

// ===== VARIÁVEL GLOBAL PARA ARMAZENAR DADOS DA AULA =====
let currentAulaInfo = {
  id: null,
  nomeCliente: '',
  professor: '',
  data: ''
};

// ===== VARIÁVEL GLOBAL PARA CONTROLE DE MÊS (PAGAMENTO) =====
let mesPagamentoAtual = new Date().getMonth(); // 0-11

// ===== VARIÁVEL GLOBAL PARA CONTROLE DE MÊS (GRÁFICO) =====
let mesGraficoAtual = new Date().getMonth(); // 0-11

// ===== FUNÇÃO PARA CALCULAR A SEMANA ATUAL DO MÊS =====
function calcularSemanaAtual(data = new Date()) {
  const ano = data.getFullYear();
  const mes = data.getMonth();
  const primeiroDiaDoMes = new Date(ano, mes, 1);
  const primeiroDias = primeiroDiaDoMes.getDay(); // Dia da semana do dia 1 (0=domingo)
  
  // Calcular o domingo da Semana 0 do mês
  const primeiroDomingoDoMes = new Date(primeiroDiaDoMes);
  primeiroDomingoDoMes.setDate(1 - primeiroDias);
  
  // Calcular dias desde o início da Semana 0
  const diffMs = data - primeiroDomingoDoMes;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const semaná = Math.floor(diffDias / 7);
  
  // Limitar entre 0 e 4
  return Math.min(Math.max(semaná, 0), 4);
}

// ===== VARIÁVEL GLOBAL PARA CONTROLE DE SEMANA (GRÁFICO) =====
let semanaGraficoAtual = calcularSemanaAtual(); // Calcula a semana atual do mês

// ===== VARIÁVEL GLOBAL PARA CONTROLE DE DIA (TABELA CONSULTA AULAS) =====
let diaConsultaAulasAtual = new Date(); // Data atual para a tabela

// ===== VARIÁVEL GLOBAL PARA CONTROLE DE FILTRO (PAGAMENTO) =====
let filtroSelecionado = 'todos'; // 'todos', 'pagamento', 'contrato'

// Função para carregar o Painel Central
function loadPainelCentral() {
  console.log('loadPainelCentral chamado');

  const section = document.getElementById('painel-central');
  if (!section) {
    console.error('Section painel-central não encontrada');
    return;
  }

  // Construir HTML do Painel Central
  section.innerHTML = `
    <!-- Filtros -->
    <div id="filtros" class="bg-white rounded-lg border border-gray-300 p-4 mb-4 flex flex-col md:flex-row justify-start items-start md:items-center gap-4 md:gap-8">
      <div id="selecao-data-aula">
        <label class="block text-sm font-semibold text-gray-700 mb-2">Analisar aulas de:</label>
        
        <div class="flex items-center gap-2">
          <button id="btn-ontem" class="btn-data px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            Ontem
          </button>
          <button id="btn-hoje" class="btn-data active px-4 py-2 text-sm rounded-lg border border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:text-white transition-colors">
            Hoje
          </button>
          <button id="btn-amanha" class="btn-data px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            Amanhã
          </button>
        
          <input 
            type="text" 
            id="input-data-aula" 
            readonly
            class="px-4 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
            placeholder="Selecione uma data"
          />
        </div>
      </div>


      <!-- Análise Gráfica -->
      <div id="analise-grafica">
        <label class="block text-sm font-semibold text-gray-700 mb-2">Análise Gráfica</label>
        <div class="flex bg-gray-100 rounded-lg p-1">
            <button onclick="mudarPeriodoGrafico('Mensal')" id="btn-mensal" class="px-4 py-1.5 text-sm font-medium rounded-md transition-all bg-white shadow text-orange-600">Mensal</button>
            <button onclick="mudarPeriodoGrafico('Semanal')" id="btn-semanal" class="px-4 py-1.5 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700">Semanal</button>
        </div>
      </div>
    </div>

    <!-- Gráfico de Aulas -->
    <div id="graficoAulas" class="bg-white rounded-lg border border-gray-300 p-4 mb-4 relative" style="height: 246px;">
      <!-- Seletor de Mês para Gráfico (Modo Mensal) -->
      <div id="seletor-mes-grafico" class="absolute top-4 left-4 flex items-center justify-center gap-1 bg-white rounded-lg z-10" style="display: none;">
        <button id="btn-grafico-mes-anterior" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
          <i class="fas fa-chevron-left text-lg"></i>
        </button>
        <span id="mes-grafico-atual" class="text-sm font-semibold text-gray-800 min-w-[80px] text-center">
          Fevereiro
        </span>
        <button id="btn-grafico-mes-proximo" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
          <i class="fas fa-chevron-right text-lg"></i>
        </button>
      </div>
      <!-- Seletor de Semana para Gráfico (Modo Semanal) -->
      <div id="seletor-semana-grafico" class="absolute top-4 left-4 flex items-center justify-center gap-1 bg-white rounded-lg z-10" style="display: none;">
        <button id="btn-grafico-semana-anterior" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
          <i class="fas fa-chevron-left text-lg"></i>
        </button>
        <button id="btn-grafico-semana-proximo" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
          <i class="fas fa-chevron-right text-lg"></i>
        </button>
      </div>
      <canvas id="graficoAulasCanvas"></canvas>
    </div>

    <!-- Consulta de Aulas -->
    <div class="bg-white rounded-lg border border-gray-300 p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800">Consulta de Aulas do dia</h2>
        <div id="navegacao-consulta-aulas" class="flex items-center gap-2">
          <button id="btn-consulta-aulas-anterior" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
            <i class="fas fa-chevron-left text-lg"></i>
          </button>
          <span id="label-data-consulta-aulas" class="text-sm font-semibold text-gray-800 min-w-[100px] text-center" style="display: none;">
          </span>
          <button id="btn-consulta-aulas-proximo" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
            <i class="fas fa-chevron-right text-lg"></i>
          </button>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table id="tabelaConsultaAulas" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estudante</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Professor</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Disciplina</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Horário</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Duração</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Aula concluída</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status da Aula</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Relatório</th>
              <th colspan="2" class="px-4 py-3 text-center text-sm font-semibold text-gray-700">Mensagem Lembrete</th>
            </tr>
          </thead>
          <tbody id="tabelaConsultaAulasBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="11" class="px-4 py-8 text-center text-gray-500 text-sm">
                Nenhuma aula encontrada
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seções Inferiores -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <!-- Informações de pagamento -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 h-full">
        <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Informações de pagamento</h2>
        
        <!-- Navegação de Mês e Filtros -->
        <div class="flex items-center gap-4 mb-4">
          <!-- Navegação de Mês -->
          <div class="flex items-center justify-center gap-1">
            <button id="btn-mes-anterior" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
              <i class="fas fa-chevron-left text-lg"></i>
            </button>
            <span id="mes-pagamento-atual" class="text-sm font-semibold text-gray-800 min-w-[80px] text-center">
              Fevereiro
            </span>
            <button id="btn-mes-proximo" class="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-800">
              <i class="fas fa-chevron-right text-lg"></i>
            </button>
          </div>
          
          <!-- Filtros de opções -->
          <div class="flex flex-1 gap-0">
            <button id="btn-filtro-todos" class="flex-1 py-1.5 text-xs font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" data-filtro="todos">
              Todos
            </button>
            <button id="btn-filtro-pagamento" class="flex-1 py-1.5 text-xs font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-filtro="pagamento">
              Pagamento Pendente
            </button>
            <button id="btn-filtro-contrato" class="flex-1 py-1.5 text-xs font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-filtro="contrato">
              Contrato Pendente
            </button>
          </div>
        </div>
        
        <!-- Área de Cards de Pagamento -->
        <div id="areaCardsPagamento" class="border-t border-gray-200 pt-4" style="height: 500px; overflow-y: auto;">
          <div class="space-y-3">
            <!-- Cards serão carregados aqui -->
            <div class="text-center py-8 text-gray-500">
              <i class="fas fa-spinner fa-spin text-orange-500 text-2xl mb-2"></i>
              <p class="text-sm">Carregando dados...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Eventos do calendário Master -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 h-full">
        <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Eventos do calendário Master</h2>
        <!-- Conteúdo será implementado posteriormente -->
      </div>
    </div>
  `;

  // Inicializar filtros de data
  initFiltrosData();

  // Inicializar Gráfico
  initGrafico();

  // Inicializar navegação de mês (Pagamento)
  initNavegacaoMesPagamento();

  // Inicializar navegação de mês (Gráfico)
  initNavegacaoMesGrafico();

  // Inicializar navegação de semana (Gráfico)
  initNavegacaoSemanaGrafico();

  // Inicializar navegação de consulta de aulas
  initNavegacaoConsultaAulas();

  // Carregar tabela de consulta de aulas com o dia de hoje
  atualizarConsultaAulas();

  // Inicializar filtros de pagamento
  initFiltrosPagamento();

  // Carregar cards de pagamento do mês atual
  carregarCardsPagamento();
}

// ===== FUNÇÕES DE GERENCIAMENTO DE DATA =====

// Data selecionada atual
let dataSelecionada = new Date();

// Formatar data no formato "ddd - dd/mm/yyyy"
function formatarDataInput(date) {
  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dia = diasSemana[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  return `${dia} - ${dd}/${mm}/${yyyy}`;
}

// Inicializar filtros de data
function initFiltrosData() {
  const btnOntem = document.getElementById('btn-ontem');
  const btnHoje = document.getElementById('btn-hoje');
  const btnAmanha = document.getElementById('btn-amanha');
  const inputData = document.getElementById('input-data-aula');

  if (!btnOntem || !btnHoje || !btnAmanha || !inputData) {
    console.error('Elementos de filtro de data não encontrados');
    return;
  }

  // Definir data inicial como hoje
  atualizarDataSelecionada(new Date());

  // Eventos dos botões
  btnOntem.addEventListener('click', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    atualizarDataSelecionada(ontem);
    ativarBotao('btn-ontem');
  });

  btnHoje.addEventListener('click', () => {
    atualizarDataSelecionada(new Date());
    ativarBotao('btn-hoje');
  });

  btnAmanha.addEventListener('click', () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    atualizarDataSelecionada(amanha);
    ativarBotao('btn-amanha');
  });

  // Evento do input - abrir calendário
  inputData.addEventListener('click', () => {
    abrirCalendario();
  });
}

// Atualizar data selecionada
function atualizarDataSelecionada(date) {
  dataSelecionada = date;
  diaConsultaAulasAtual = new Date(date); // Sincronizar com a navegação da tabela
  const inputData = document.getElementById('input-data-aula');
  if (inputData) {
    inputData.value = formatarDataInput(date);
  }

  // Buscar e carregar aulas da data selecionada
  console.log('📅 Data selecionada:', formatarDataInput(date));
  atualizarConsultaAulas();
}

// ===== FUNÇÃO PARA OBTER CLASSE DE STATUS =====
function getStatusBadgeClass(status) {
  if (!status) return 'status-pendente';
  
  const statusLower = status.toLowerCase();
  
  // Status específicos de aulas com cores definidas
  if (statusLower === 'pendente') return 'status-pendente';
  if (statusLower === 'reagendada') return 'status-reagendada';
  if (statusLower === 'concluída') return 'status-concluida';
  if (statusLower === 'reposição') return 'status-reposicao';
  if (statusLower === 'cancelada') return 'status-cancelada';
  
  return 'status-pendente';
}

// ===== FUNÇÕES DE CARREGAMENTO DE AULAS =====

async function loadAulasPainel(dataFiltro) {
  const tbody = document.getElementById('tabelaConsultaAulasBody');
  if (!tbody) return;

  // Mostrar loading
  tbody.innerHTML = `
    <tr>
      <td colspan="11" class="px-4 py-8 text-center text-gray-500 text-sm">
        <i class="fas fa-spinner fa-spin text-orange-500 text-2xl mb-2"></i>
        <p>Carregando aulas...</p>
      </td>
    </tr>
  `;

  try {
    console.log(`🔍 Buscando aulas para data: ${dataFiltro}`);

    // Buscar todas as aulas da coleção BancoDeAulas-Lista
    // Idealmente, filtraríamos no backend, mas como o formato de data é string "ddd - dd/mm/yy",
    // e o Firebase pode ter limitações com queries de string parcial/exata dependendo do index,
    // vamos buscar onde 'data' == dataFiltro se possível, ou buscar tudo e filtrar (menos performático).
    // Tentaremos where('data', '==', dataFiltro) primeiro.

    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("data", "==", dataFiltro)
      .get();

    const aulas = [];
    querySnapshot.forEach(doc => {
      aulas.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✅ ${aulas.length} aulas encontradas para ${dataFiltro}`);

    if (aulas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="px-4 py-8 text-center text-gray-500 text-sm">
            Nenhuma aula encontrada para esta data.
          </td>
        </tr>
      `;
      return;
    }

    // Ordenar por horário (se existir)
    aulas.sort((a, b) => {
      const horaA = a.horario || '';
      const horaB = b.horario || '';
      return horaA.localeCompare(horaB);
    });

    // Renderizar tabela
    tbody.innerHTML = aulas.map(aula => {
      const statusIcon = aula.ConfirmacaoProfessorAula
        ? '<i class="fas fa-check-circle text-green-500" title="Concluída"></i>'
        : '<i class="fas fa-clock text-yellow-500" title="Pendente"></i>';

      const statusClass = getStatusBadgeClass(aula.StatusAula || 'Pendente');
      
      // Verificar se o relatório está vazio ou preenchido
      const temRelatorio = aula.RelatorioAula && aula.RelatorioAula.trim() !== '';
      const corRelatorio = temRelatorio 
        ? 'text-green-500 hover:text-green-600 hover:bg-green-50' 
        : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50';

      return `
        <tr
          class="hover:bg-orange-50 transition-colors border-b border-gray-100 cursor-pointer"
          onclick="abrirDetalhesContratacaoPainelCentral('${escapeHtml(aula.codigoContratacao || '')}')"
          title="Clique para ver detalhes da contratação"
        >
          <td class="px-4 py-3 text-sm text-gray-800 font-medium">
            <span class="flex items-center gap-1">
              <i class="fas fa-external-link-alt text-orange-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
              ${aula.nomeCliente || '--'}
            </span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">${aula.estudante || '--'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${aula.professor || '--'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${aula.materia || '--'}</td>
          <td class="px-4 py-3 text-sm text-gray-600 font-medium">${aula.horario || '--'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${aula.duracao || '--'}</td>
          <td class="px-4 py-3 text-sm text-center">${statusIcon}</td>
          <td class="px-4 py-3 text-sm" onclick="event.stopPropagation()">
            <span
              class="px-2 py-1 rounded text-xs font-medium status-badge-clickable cursor-pointer ${statusClass}"
              onclick="openStatusModal('${aula.id}', '${aula.StatusAula || 'Pendente'}')"
              title="Clique para alterar status"
            >
              ${aula.StatusAula || 'Pendente'}
            </span>
          </td>
          <td class="px-4 py-3 text-sm text-center" onclick="event.stopPropagation()">
            <button
              onclick="handleRelatorioClick('${aula.id}', '${escapeHtml(aula.data || '')}', '${escapeHtml(aula.nomeCliente || '')}', ${temRelatorio})"
              class="${corRelatorio} transition-colors p-1 rounded-full"
              title="${temRelatorio ? 'Ver/Editar Relatório' : (isDataAnteriorHoje(aula.data) ? 'Copiar lembrete de relatório' : 'Adicionar Relatório')}"
            >
              <i class="fas fa-comment-alt text-lg"></i>
            </button>
          </td>
          <td class="px-2 py-3 text-sm text-center" onclick="event.stopPropagation()">
            <button
              onclick="enviarLembreteCliente('${aula.id}', '${escapeHtml(aula.professor || '')}', '${escapeHtml(aula.data || '')}', '${escapeHtml(aula.horario || '')}', '${escapeHtml(aula.estudante || '')}', '${escapeHtml(aula.nomeCliente || '')}', '${escapeHtml(aula.materia || '')}')"
              class="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
              title="Copiar Lembrete Professor"
            >
              <i class="fas fa-chalkboard-teacher text-lg"></i>
            </button>
          </td>
          <td class="px-2 py-3 text-sm text-center" onclick="event.stopPropagation()">
            <button
              onclick="enviarLembreteProfessor('${aula.id}', '${escapeHtml(aula.nomeCliente || '')}', '${escapeHtml(aula.professor || '')}', '${escapeHtml(aula.data || '')}', '${escapeHtml(aula.horario || '')}', '${escapeHtml(aula.materia || '')}')"
              class="text-green-500 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50"
              title="Copiar Lembrete Cliente"
            >
              <i class="fas fa-user text-lg"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('❌ Erro ao buscar aulas:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-4 py-8 text-center text-red-500 text-sm">
          <i class="fas fa-exclamation-circle mb-2 text-xl"></i>
          <p>Erro ao carregar aulas. Tente novamente.</p>
        </td>
      </tr>
    `;
  }
}

// ===== DETALHES DA CONTRATAÇÃO A PARTIR DO PAINEL CENTRAL =====

/**
 * Abre o modal "Detalhes da Contratação" ao clicar em uma linha da tabelaConsultaAulas.
 * Busca o documento em BancoDeAulas pelo codigoContratacao e abre o modal via BancoDeAulasCards.
 */
async function abrirDetalhesContratacaoPainelCentral(codigoContratacao) {
  if (!codigoContratacao) {
    showToast('Esta aula não possui código de contratação vinculado.', 'warning');
    return;
  }

  try {
    showToast('Carregando detalhes da contratação...', 'info');

    const docSnap = await db.collection('BancoDeAulas').doc(codigoContratacao).get();

    if (!docSnap.exists) {
      showToast('Contratação não encontrada no banco de dados.', 'error');
      return;
    }

    const contrato = { id: docSnap.id, ...docSnap.data() };

    if (window.BancoDeAulasCards && typeof window.BancoDeAulasCards.viewAulaDetails === 'function') {
      window.BancoDeAulasCards.viewAulaDetails(contrato);
    } else {
      showToast('Módulo de detalhes não carregado. Tente novamente.', 'error');
      console.warn('⚠️ BancoDeAulasCards.viewAulaDetails não disponível');
    }
  } catch (error) {
    console.error('❌ Erro ao abrir detalhes da contratação:', error);
    showToast('Erro ao carregar detalhes da contratação.', 'error');
  }
}

// ===== BOTÃO DE RELATÓRIO COM LEMBRETE =====

/**
 * Verifica se a data da aula (formato "seg - 27/05/25") é anterior a hoje.
 */
function isDataAnteriorHoje(dataStr) {
  if (!dataStr) return false;
  try {
    const match = dataStr.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (!match) return false;
    const [, dia, mes, ano] = match;
    const dataAula = new Date(2000 + parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return dataAula < hoje;
  } catch (e) {
    return false;
  }
}

/**
 * Formata a data da aula para o formato curto "ddd - dd/mm".
 * Ex: "seg - 27/05/25" → "seg - 27/05"
 */
function formatarDataCurta(dataStr) {
  if (!dataStr) return dataStr || '';
  return dataStr.replace(/\/\d{2}$/, '');
}

/**
 * Gerencia o clique no botão de relatório da tabelaConsultaAulas.
 * - Se a aula for de data anterior a hoje E o relatório estiver vazio:
 *   copia mensagem de lembrete para a área de transferência e exibe toast.
 * - Caso contrário, abre o modal padrão de relatório.
 */
function handleRelatorioClick(aulaId, aulaData, nomeCliente, temRelatorio) {
  const aulaAnterior = isDataAnteriorHoje(aulaData);

  if (!temRelatorio && aulaAnterior) {
    const primeiroNome = (nomeCliente || 'cliente').split(' ')[0];
    const dataFormatada = formatarDataCurta(aulaData);
    const mensagem = `🚗💨 Carro do lembrete passandoooo:\nestá faltando o relatório da aula de ${dataFormatada} com ${primeiroNome}`;

    navigator.clipboard.writeText(mensagem)
      .then(() => showToast('Mensagem de lembrete copiada!', 'success'))
      .catch(() => showToast('Erro ao copiar mensagem. Tente novamente.', 'error'));
  } else {
    verRelatorioAula(aulaId);
  }
}

// Função auxiliar para escapar HTML em strings (segurança)
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Função auxiliar para classe de status
function getStatusClassMain(status) {
  switch (status) {
    case 'Concluída': return 'bg-green-100 text-green-700';
    case 'Cancelada': return 'bg-red-100 text-red-700';
    case 'Agendada': return 'bg-blue-100 text-blue-700';
    default: return 'bg-yellow-100 text-yellow-700';
  }
}

// Função para ver/editar relatório (Modal)
window.verRelatorioAula_OLD = async function (id) {
  // Mostrar loading inicial
  createModal('Detalhes do Relatório', `
    <div class="p-6 text-center">
      <i class="fas fa-spinner fa-spin text-orange-500 text-3xl mb-3"></i>
      <p class="text-gray-600">Carregando relatório...</p>
    </div>
  `, []);

  try {
    const doc = await firebase.firestore().collection('BancoDeAulas-Lista').doc(id).get();

    if (!doc.exists) {
      // Atualizar modal com erro
      const modalContent = document.querySelector('.modal-content div');
      if (modalContent) {
        modalContent.innerHTML = `
                <div class="p-6 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                    <p>Aula não encontrada!</p>
                </div>
             `;
      }
      return;
    }

    const aula = doc.data();
    const relatorioAtual = aula.RelatorioAula || '';

    const modalHTML = `
      <div class="p-6">
        <div class="mb-4">
          <h3 class="text-lg font-bold text-gray-800 mb-1">Relatório da Aula</h3>
          <p class="text-sm text-gray-500 mb-4">ID: ${id}</p>
          
          <label class="block text-sm font-medium text-gray-700 mb-2">Conteúdo do Relatório:</label>
          <textarea 
            id="textarea-relatorio-${id}" 
            class="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-none"
            placeholder="Digite o relatório da aula aqui..."
          >${escapeHtml(relatorioAtual)}</textarea>
        </div>
      </div>
    `;

    // Recriar o modal com o conteúdo carregado e botões
    // createModal remove o anterior se já existir? A função createModal geralmente adiciona ao body. 
    // Se eu chamar createModal de novo, vai criar outro por cima. 
    // O ideal seria atualizar o conteúdo. Mas como createModal é uma função helper (assumo externa ou definida em outro lugar), vou fechar o loading e abrir o novo.

    // Fechar modal de loading (assumindo que createModal cria um overlay com classe modal-overlay)
    const loadingModal = document.querySelector('.modal-overlay');
    if (loadingModal) loadingModal.remove();

    createModal('Editando Relatório', modalHTML, [
      {
        text: 'Cancelar',
        classes: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors',
        attributes: 'onclick="this.closest(\'.modal-overlay\').remove()"'
      },
      {
        text: 'Salvar Alterações',
        classes: 'px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors',
        attributes: `onclick="salvarRelatorio('${id}')"`
      }
    ]);

  } catch (error) {
    console.error('Erro ao buscar relatório:', error);
    const loadingModal = document.querySelector('.modal-overlay');
    if (loadingModal) loadingModal.remove();
    alert('Erro ao carregar relatório: ' + error.message);
  }
};

window.salvarRelatorio_OLD = async function (id) {
  const textarea = document.getElementById(`textarea-relatorio-${id}`);
  if (!textarea) return;

  const novoTexto = textarea.value;
  const btnSalvar = event.target; // Captura o botão clicado

  // Feedback visual no botão
  const textoOriginalBtn = btnSalvar.innerText;
  btnSalvar.innerText = 'Salvando...';
  btnSalvar.disabled = true;

  try {
    await firebase.firestore().collection('BancoDeAulas-Lista').doc(id).update({
      RelatorioAula: novoTexto
    });

    // Sucesso
    showToast('Relatório salvo com sucesso!', 'success');

    // Fechar modal
    const modal = btnSalvar.closest('.modal-overlay');
    if (modal) modal.remove();

    // Opcional: Recarregar tabela para atualizar ícone? (se tivesse indicador de "tem relatório")
    // Mas o conteúdo visual da tabela não mostra o texto, então não precisa recarregar tudo.

  } catch (error) {
    console.error('Erro ao salvar:', error);
    alert('Erro ao salvar relatório: ' + error.message);
    btnSalvar.innerText = textoOriginalBtn;
    btnSalvar.disabled = false;
  }
};

// Funções de envio de lembrete
window.enviarLembreteProfessor = async function (id, nomeCliente, nomeProfessor, dataAula, horarioAula, nomeMateria) {
  // Helper para pegar apenas dois primeiros nomes
  const getDoisNomes = (nome) => {
    if (!nome) return '';
    const partes = nome.trim().split(/\s+/);
    if (partes.length <= 2) return nome;
    return `${partes[0]} ${partes[1]}`;
  };

  const nomeProfessorFormatado = getDoisNomes(nomeProfessor);

  // Dias da semana em português (abreviado)
  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  // Processar data
  let dataTexto = 'Aula do dia: ';
  let dataFormatada = dataAula;

  try {
    if (dataAula && dataAula.includes('-')) {
      const partesData = dataAula.split('-')[1].trim().split('/');
      const dia = parseInt(partesData[0]);
      const mes = parseInt(partesData[1]);
      const ano = parseInt(partesData[2]);

      const dataObj = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);

      // Formatar data com dia da semana
      const diaSemana = diasSemana[dataObj.getDay()];
      dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')} - ${diaSemana}`;

      // Verificar se é hoje ou amanhã
      if (dataObj.getTime() === hoje.getTime()) {
        dataTexto = 'Hoje, ';
      } else if (dataObj.getTime() === amanha.getTime()) {
        dataTexto = 'Amanhã, ';
      } else {
        dataTexto = 'Aula do dia: ';
      }
    }
  } catch (e) {
    console.error('Erro ao converter data:', e);
  }

  // Montar mensagem com novo formato para cliente
  const mensagem = `🔔 Mensagem lembrete!\nAtendimento de ${dataTexto}${dataFormatada}.\n\nProf. ${nomeProfessorFormatado} às ${horarioAula}`;

  // Copiar para área de transferência
  try {
    await navigator.clipboard.writeText(mensagem);

    // Feedback visual
    if (typeof showToast === 'function') {
      showToast(`Mensagem lembrete de Cliente (${nomeProfessorFormatado}) copiada com sucesso!`, 'success');
    } else {
      alert(`Mensagem lembrete de Cliente (${nomeProfessorFormatado}) copiada com sucesso!\n\n` + mensagem);
    }
  } catch (err) {
    console.error('Erro ao copiar:', err);
    // Fallback
    const textArea = document.createElement("textarea");
    textArea.value = mensagem;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    if (typeof showToast === 'function') {
      showToast(`Mensagem lembrete de Cliente (${nomeProfessorFormatado}) copiada com sucesso!`, 'success');
    } else {
      alert(`Mensagem lembrete de Cliente (${nomeProfessorFormatado}) copiada com sucesso!\n\n` + mensagem);
    }
  }
};

window.enviarLembreteCliente = async function (id, nomeProfessor, dataAula, horarioAula, nomeEstudante, nomeCliente, nomeMateria) {
  // Helper para pegar apenas dois primeiros nomes
  const getDoisNomes = (nome) => {
    if (!nome) return '';
    const partes = nome.trim().split(/\s+/);
    if (partes.length <= 2) return nome;
    return `${partes[0]} ${partes[1]}`;
  };

  const nomeClienteFormatado = getDoisNomes(nomeCliente);

  // Dias da semana em português (abreviado)
  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  // Processar data
  let dataTexto = 'Aula do dia: ';
  let dataFormatada = dataAula;

  try {
    if (dataAula && dataAula.includes('-')) {
      const partesData = dataAula.split('-')[1].trim().split('/');
      const dia = parseInt(partesData[0]);
      const mes = parseInt(partesData[1]);
      const ano = parseInt(partesData[2]);

      const dataObj = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);

      // Formatar data com dia da semana
      const diaSemana = diasSemana[dataObj.getDay()];
      dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')} - ${diaSemana}`;

      // Verificar se é hoje ou amanhã
      if (dataObj.getTime() === hoje.getTime()) {
        dataTexto = 'Hoje, ';
      } else if (dataObj.getTime() === amanha.getTime()) {
        dataTexto = 'Amanhã, ';
      } else {
        dataTexto = 'Aula do dia: ';
      }
    }
  } catch (e) {
    console.error('Erro ao converter data:', e);
  }

  // Montar mensagem com novo formato
  const mensagem = `🔔 Mensagem lembrete!\nAtendimento de ${dataTexto}${dataFormatada}.\n\n${nomeClienteFormatado} às ${horarioAula}`;

  // Copiar para área de transferência
  try {
    await navigator.clipboard.writeText(mensagem);

    if (typeof showToast === 'function') {
      showToast(`Mensagem lembrete de Professor (${nomeClienteFormatado}) copiada com sucesso!`, 'success');
    } else {
      alert(`Mensagem lembrete de Professor (${nomeClienteFormatado}) copiada com sucesso!\n\n` + mensagem);
    }
  } catch (err) {
    console.error('Erro ao copiar:', err);
    // Fallback
    const textArea = document.createElement("textarea");
    textArea.value = mensagem;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    if (typeof showToast === 'function') {
      showToast(`Mensagem lembrete de Professor (${nomeClienteFormatado}) copiada com sucesso!`, 'success');
    } else {
      alert(`Mensagem lembrete de Professor (${nomeClienteFormatado}) copiada com sucesso!\n\n` + mensagem);
    }
  }
};

// Ativar botão selecionado
function ativarBotao(btnId) {
  // Remover classe active de todos os botões
  document.querySelectorAll('.btn-data').forEach(btn => {
    btn.classList.remove('active', 'bg-orange-500', 'text-white', 'border-orange-500', 'hover:bg-orange-600', 'hover:text-white');
    btn.classList.add('border-gray-300', 'hover:bg-gray-50');
  });

  // Adicionar classe active ao botão clicado
  const btnAtivo = document.getElementById(btnId);
  if (btnAtivo) {
    btnAtivo.classList.add('active', 'bg-orange-500', 'text-white', 'border-orange-500', 'hover:bg-orange-600', 'hover:text-white');
    btnAtivo.classList.remove('border-gray-300', 'hover:bg-gray-50');
  }
}

// Abrir calendário modal
function abrirCalendario() {
  const hoje = new Date();
  let mesAtual = dataSelecionada.getMonth();
  let anoAtual = dataSelecionada.getFullYear();

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Criar HTML do calendário
  const calendarioHTML = `
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <button id="cal-prev-mes" class="px-3 py-1 hover:bg-gray-100 rounded">
          <i class="fas fa-chevron-left"></i>
        </button>
        <div class="font-semibold text-gray-800">
          <span id="cal-mes-ano">${meses[mesAtual]} ${anoAtual}</span>
        </div>
        <button id="cal-next-mes" class="px-3 py-1 hover:bg-gray-100 rounded">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
      
      <div id="calendario-grid" class="grid grid-cols-7 gap-1 text-center">
        <!-- Cabeçalho dos dias da semana -->
        <div class="text-xs font-semibold text-gray-600 py-2">Dom</div>
        <div class="text-xs font-semibold text-gray-600 py-2">Seg</div>
        <div class="text-xs font-semibold text-gray-600 py-2">Ter</div>
        <div class="text-xs font-semibold text-gray-600 py-2">Qua</div>
        <div class="text-xs font-semibold text-gray-600 py-2">Qui</div>
        <div class="text-xs font-semibold text-gray-600 py-2">Sex</div>
        <div class="text-xs font-semibold text-gray-600 py-2">Sáb</div>
      </div>
    </div>
  `;

  const { modal, closeModal } = createModal('Selecionar Data', calendarioHTML, [
    {
      text: 'Fechar',
      classes: 'px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors',
      attributes: 'onclick="this.closest(\'.modal-overlay\').remove()"'
    }
  ]);

  // Função para renderizar dias do mês
  function renderizarDias() {
    const grid = document.getElementById('calendario-grid');
    if (!grid) return;

    // Remover dias existentes (manter cabeçalho)
    const diasExistentes = grid.querySelectorAll('.dia-calendario');
    diasExistentes.forEach(dia => dia.remove());

    const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();

    // Adicionar espaços vazios antes do primeiro dia
    for (let i = 0; i < primeiroDia; i++) {
      const espaco = document.createElement('div');
      espaco.className = 'dia-calendario';
      grid.appendChild(espaco);
    }

    // Adicionar dias do mês
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const diaElement = document.createElement('button');
      diaElement.className = 'dia-calendario py-2 hover:bg-orange-100 rounded transition-colors text-sm';
      diaElement.textContent = dia;

      // Marcar dia selecionado
      if (dia === dataSelecionada.getDate() &&
        mesAtual === dataSelecionada.getMonth() &&
        anoAtual === dataSelecionada.getFullYear()) {
        diaElement.classList.add('bg-orange-500', 'text-white', 'font-semibold');
      }

      // Marcar dia de hoje
      if (dia === hoje.getDate() &&
        mesAtual === hoje.getMonth() &&
        anoAtual === hoje.getFullYear()) {
        diaElement.classList.add('ring-2', 'ring-orange-300');
      }

      diaElement.addEventListener('click', () => {
        const novaData = new Date(anoAtual, mesAtual, dia);
        atualizarDataSelecionada(novaData);

        // Desmarcar todos os botões de data rápida
        document.querySelectorAll('.btn-data').forEach(btn => {
          btn.classList.remove('active', 'bg-orange-500', 'text-white', 'border-orange-500');
          btn.classList.add('border-gray-300');
        });

        modal.remove();
      });

      grid.appendChild(diaElement);
    }
  }

  // Função para atualizar mês/ano exibido
  function atualizarMesAno() {
    const mesAnoElement = document.getElementById('cal-mes-ano');
    if (mesAnoElement) {
      mesAnoElement.textContent = `${meses[mesAtual]} ${anoAtual}`;
    }
    renderizarDias();
  }

  // Event listeners para navegação
  setTimeout(() => {
    const btnPrev = document.getElementById('cal-prev-mes');
    const btnNext = document.getElementById('cal-next-mes');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        mesAtual--;
        if (mesAtual < 0) {
          mesAtual = 11;
          anoAtual--;
        }
        atualizarMesAno();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        mesAtual++;
        if (mesAtual > 11) {
          mesAtual = 0;
          anoAtual++;
        }
        atualizarMesAno();
      });
    }

    renderizarDias();
  }, 100);
}

// ===== FUNÇÕES DE NAVEGAÇÃO DE MÊS (PAGAMENTO) =====

function initNavegacaoMesPagamento() {
  const btnAnterior = document.getElementById('btn-mes-anterior');
  const btnProximo = document.getElementById('btn-mes-proximo');

  if (!btnAnterior || !btnProximo) {
    console.error('Botões de navegação de mês não encontrados');
    return;
  }

  btnAnterior.addEventListener('click', () => {
    mudarMesPagamento(-1);
  });

  btnProximo.addEventListener('click', () => {
    mudarMesPagamento(1);
  });

  // Atualizar exibição do mês atual
  atualizarExibicaoMesPagamento();
}

function mudarMesPagamento(direcao) {
  mesPagamentoAtual += direcao;

  // Limitar entre 0 (Janeiro) e 11 (Dezembro)
  if (mesPagamentoAtual < 0) {
    mesPagamentoAtual = 11;
  } else if (mesPagamentoAtual > 11) {
    mesPagamentoAtual = 0;
  }

  atualizarExibicaoMesPagamento();
  carregarCardsPagamento();
  
  console.log(`📅 Mês selecionado para pagamento: ${mesPagamentoAtual}`);
}

function atualizarExibicaoMesPagamento() {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const elementoMes = document.getElementById('mes-pagamento-atual');
  if (elementoMes) {
    elementoMes.textContent = meses[mesPagamentoAtual];
  }
}

function initNavegacaoMesGrafico() {
  const btnAnterior = document.getElementById('btn-grafico-mes-anterior');
  const btnProximo = document.getElementById('btn-grafico-mes-proximo');

  if (!btnAnterior || !btnProximo) {
    console.error('Botões de navegação de mês do gráfico não encontrados');
    return;
  }

  btnAnterior.addEventListener('click', () => {
    mudarMesGrafico(-1);
  });

  btnProximo.addEventListener('click', () => {
    mudarMesGrafico(1);
  });

  // Atualizar exibição do mês atual
  atualizarExibicaoMesGrafico();
}

function mudarMesGrafico(direcao) {
  mesGraficoAtual += direcao;

  // Limitar entre 0 (Janeiro) e 11 (Dezembro)
  if (mesGraficoAtual < 0) {
    mesGraficoAtual = 11;
  } else if (mesGraficoAtual > 11) {
    mesGraficoAtual = 0;
  }

  atualizarExibicaoMesGrafico();
  
  console.log(`📅 Mês selecionado para gráfico: ${mesGraficoAtual}`);
}

function atualizarExibicaoMesGrafico() {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const elementoMes = document.getElementById('mes-grafico-atual');
  if (elementoMes) {
    elementoMes.textContent = meses[mesGraficoAtual];
  }

  // Recarregar o gráfico com o novo mês
  carregarDadosGrafico();
}

function initNavegacaoSemanaGrafico() {
  const btnAnterior = document.getElementById('btn-grafico-semana-anterior');
  const btnProximo = document.getElementById('btn-grafico-semana-proximo');

  if (!btnAnterior || !btnProximo) {
    console.error('Botões de navegação de semana do gráfico não encontrados');
    return;
  }

  btnAnterior.addEventListener('click', () => {
    if (semanaGraficoAtual > 0) {
      semanaGraficoAtual--;
      carregarDadosGrafico();
    }
  });

  btnProximo.addEventListener('click', () => {
    // Máximo de 4 semanas (0-3)
    if (semanaGraficoAtual < 4) {
      semanaGraficoAtual++;
      carregarDadosGrafico();
    }
  });
}

function initNavegacaoConsultaAulas() {
  const btnAnterior = document.getElementById('btn-consulta-aulas-anterior');
  const btnProximo = document.getElementById('btn-consulta-aulas-proximo');

  if (!btnAnterior || !btnProximo) {
    console.error('Botões de navegação de consulta de aulas não encontrados');
    return;
  }

  btnAnterior.addEventListener('click', () => {
    diaConsultaAulasAtual.setDate(diaConsultaAulasAtual.getDate() - 1);
    atualizarConsultaAulas();
  });

  btnProximo.addEventListener('click', () => {
    diaConsultaAulasAtual.setDate(diaConsultaAulasAtual.getDate() + 1);
    atualizarConsultaAulas();
  });
}

function atualizarConsultaAulas() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const diaAtual = new Date(diaConsultaAulasAtual);
  diaAtual.setHours(0, 0, 0, 0);

  const labelElement = document.getElementById('label-data-consulta-aulas');
  
  // Se for hoje, não exibir label
  if (diaAtual.getTime() === hoje.getTime()) {
    if (labelElement) labelElement.style.display = 'none';
  } else {
    // Formatar como "Dia completo dd/mm"
    const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const diaNome = diasNomes[diaAtual.getDay()];
    const dia = diaAtual.getDate().toString().padStart(2, '0');
    const mes = (diaAtual.getMonth() + 1).toString().padStart(2, '0');
    
    if (labelElement) {
      labelElement.textContent = `${diaNome} ${dia}/${mes}`;
      labelElement.style.display = 'block';
    }
  }

  // Recarregar tabela com a data selecionada
  loadAulasPainel(formatarDataInput(diaConsultaAulasAtual));
}

// ===== FUNÇÕES PARA CARREGAR CARDS DE PAGAMENTO =====

async function carregarCardsPagamento() {
  const areaCards = document.getElementById('areaCardsPagamento');
  if (!areaCards) return;

  // Mostrar loading
  areaCards.innerHTML = `
    <div class="flex justify-center items-center py-8">
      <i class="fas fa-spinner fa-spin text-orange-500 text-2xl mr-2"></i>
      <p class="text-gray-600 text-sm">Carregando dados...</p>
    </div>
  `;

  try {
    // Buscar todos os dados de BancoDeAulas
    const snapshot = await firebase.firestore().collection('BancoDeAulas').get();
    const contratos = [];
    
    snapshot.forEach(doc => {
      contratos.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`📊 Total de contratos encontrados: ${contratos.length}`);

    // Filtrar contratos por mês do timestamp
    const contratosFiltrados = contratos.filter(contrato => {
      if (!contrato.timestamp) return false;
      
      let dataContrato = null;
      
      // Handle diferentes tipos de timestamp (Timestamp do Firebase ou string)
      if (contrato.timestamp.toDate) {
        // Firebase Timestamp
        dataContrato = contrato.timestamp.toDate();
      } else if (typeof contrato.timestamp === 'string') {
        // String de data (dd/mm/yyyy)
        try {
          const partes = contrato.timestamp.split('/'); 
          if (partes.length === 3) {
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1; // 0-11
            const ano = parseInt(partes[2]);
            dataContrato = new Date(ano, mes, dia);
          }
        } catch (e) {
          return false;
        }
      } else if (contrato.timestamp instanceof Date) {
        dataContrato = contrato.timestamp;
      }
      
      if (!dataContrato) return false;
      
      // Comparar mês e ano
      return dataContrato.getMonth() === mesPagamentoAtual && 
             dataContrato.getFullYear() === new Date().getFullYear();
    });

    console.log(`✅ Contratos filtrados para o mês: ${contratosFiltrados.length}`);

    // Aplicar filtro adicional baseado na seleção do usuário
    let contratosComFiltro = contratosFiltrados;

    if (filtroSelecionado === 'pagamento') {
      // Filtrar por "Aguardando 1º Pagamento" OU "Aguardando 2º Pagamento"
      contratosComFiltro = contratosFiltrados.filter(contrato => {
        const statusPg = (contrato.statusPagamento || '').toLowerCase();
        return statusPg.includes('aguardando 1º pagamento') || statusPg.includes('aguardando 2º pagamento');
      });
      console.log(`✅ Contratos com "Pagamento Pendente": ${contratosComFiltro.length}`);
    } else if (filtroSelecionado === 'contrato') {
      // Filtrar por "Pendente de Assinatura"
      contratosComFiltro = contratosFiltrados.filter(contrato => {
        const statusCt = (contrato.statusContrato || '').toLowerCase();
        return statusCt.includes('pendente de assinatura');
      });
      console.log(`✅ Contratos com "Contrato Pendente": ${contratosComFiltro.length}`);
    }

    if (contratosComFiltro.length === 0) {
      areaCards.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-gray-500">
          <i class="fas fa-inbox text-3xl text-gray-400 mb-2"></i>
          <p class="text-sm">Nenhum contrato encontrado para este filtro</p>
        </div>
      `;
      return;
    }

    // Renderizar cards
    renderCardsContratacao(contratosComFiltro);

  } catch (error) {
    console.error('❌ Erro ao carregar cards de pagamento:', error);
    areaCards.innerHTML = `
      <div class="flex flex-col items-center justify-center py-8 text-red-500">
        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
        <p class="text-sm">Erro ao carregar dados</p>
      </div>
    `;
  }
}

function renderCardsContratacao(contratos) {
  const areaCards = document.getElementById('areaCardsPagamento');
  if (!areaCards) return;

  const cardsHtml = contratos.map(contrato => {
    const nomeCliente = contrato.nome || contrato.nomeCliente || 'Cliente não identificado';
    const statusPagamento = contrato.statusPagamento || 'Não informado';
    const statusContrato = contrato.statusContrato || 'Não informado';
    const metodoPagamento = contrato.modoPagamento || 'Não informado';
    const dataPrimeiraParcela = limparDadosInvalidos(formatarDataContrato(contrato.dataPrimeiraParcela));
    const dataSegundaParcela = limparDadosInvalidos(formatarDataContrato(contrato.dataSegundaParcela));
    const dataAssinaturaContrato = limparDadosInvalidos(formatarDataContrato(contrato.dataAssinaturaContrato));
    const dataContratacao = formatarDataContrato(contrato.timestamp);

    // Determinar cores dos badges
    const colorPagamento = getCorStatusPagamento(statusPagamento);
    const colorContrato = getCorStatusPagamento(statusContrato);

    return `
      <div class="bg-white border-l-4 border-orange-500 rounded-lg shadow-sm hover:shadow-md transition-all p-4 mb-[10px]">
        <!-- Header com nome e data -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <p class="font-bold text-gray-900 text-sm leading-tight">
              ${escapeHtml(nomeCliente)}
            </p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500 font-medium">
              <i class="fas fa-calendar-alt text-gray-400 mr-1"></i>
              ${dataContratacao}
            </p>
          </div>
        </div>

        <!-- Divider -->
        <div class="h-px bg-gray-100 mb-3"></div>

        <!-- Informações de Pagamento -->
        <div class="mb-3">
          <div class="flex justify-between items-center mb-2">
            <p class="text-xs text-gray-600 font-semibold">
              Informações de Pagamento
            </p>
            <span class="${colorPagamento} font-medium px-2.5 py-1.5 bg-opacity-10 rounded text-xs">
              ${statusPagamento}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <!-- Método Pagamento -->
            <div>
              <p class="text-gray-500 mb-1">Método Pagamento</p>
              <p class="text-gray-700 px-2 py-1 bg-gray-50 rounded text-center">
                ${metodoPagamento}
              </p>
            </div>
            <!-- Data 1º Parcela -->
            <div>
              <p class="text-gray-500 mb-1">Data 1º Parcela</p>
              <p class="text-gray-700 px-2 py-1 bg-gray-50 rounded text-center">
                ${dataPrimeiraParcela}
              </p>
            </div>
            <!-- Data 2º Parcela -->
            <div>
              <p class="text-gray-500 mb-1">Data 2º Parcela</p>
              <p class="text-gray-700 px-2 py-1 bg-gray-50 rounded text-center">
                ${dataSegundaParcela}
              </p>
            </div>
          </div>
        </div>

        <!-- Status Contrato com detalhes -->
        <div class="mb-0">
          <div class="flex flex-wrap gap-2 items-center">
            <p class="text-xs text-gray-600 font-semibold">
              Contrato
            </p>
            <span class="text-xs ${colorContrato} font-medium px-2.5 py-1.5 bg-opacity-10 rounded">
              ${statusContrato}
            </span>
            <span class="text-xs text-gray-500 px-2 py-1">
              <i class="fas fa-calendar text-xs mr-1"></i>${dataAssinaturaContrato}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  areaCards.innerHTML = `${cardsHtml}`;
}

function limparDadosInvalidos(valor) {
  if (!valor || valor === 'undefined' || valor.includes('NaN') || valor === '--') {
    return '--';
  }
  return valor;
}

function formatarDataContrato(timestamp) {
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  
  let data = null;
  
  // Handle diferentes tipos de timestamp
  if (timestamp instanceof Object && timestamp.toDate) {
    // Firebase Timestamp
    data = timestamp.toDate();
  } else if (typeof timestamp === 'string') {
    // String de data (dd/mm/yyyy)
    try {
      const partes = timestamp.split('/');
      if (partes.length === 3) {
        const dia = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1;
        const ano = parseInt(partes[2]);
        data = new Date(ano, mes, dia);
      }
    } catch (e) {
      return 'Data inválida';
    }
  } else if (timestamp instanceof Date) {
    data = timestamp;
  }
  
  if (!data) return 'Data inválida';
  
  const dia = dias[data.getDay()];
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  
  return `${dia} - ${dd}/${mm}/${yyyy}`;
}

function getCorStatusPagamento(status) {
  if (!status) return 'bg-gray-100 text-gray-700';
  
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('completo') || statusLower.includes('pago') || statusLower.includes('efetuado')) {
    return 'bg-green-100 text-green-700';
  }
  if (statusLower.includes('pendente') || statusLower.includes('aguardando')) {
    return 'bg-yellow-100 text-yellow-700';
  }
  if (statusLower.includes('cancelado') || statusLower.includes('vencido')) {
    return 'bg-red-100 text-red-700';
  }
  if (statusLower.includes('parcial') || statusLower.includes('processando')) {
    return 'bg-blue-100 text-blue-700';
  }
  
  return 'bg-gray-100 text-gray-700';
}

// ===== FUNÇÕES DE FILTRO DE PAGAMENTO =====

function initFiltrosPagamento() {
  const btnTodos = document.getElementById('btn-filtro-todos');
  const btnPagamento = document.getElementById('btn-filtro-pagamento');
  const btnContrato = document.getElementById('btn-filtro-contrato');

  if (!btnTodos || !btnPagamento || !btnContrato) {
    console.error('Botões de filtro de pagamento não encontrados');
    return;
  }

  btnTodos.addEventListener('click', () => mudarFiltro('todos'));
  btnPagamento.addEventListener('click', () => mudarFiltro('pagamento'));
  btnContrato.addEventListener('click', () => mudarFiltro('contrato'));
}

function mudarFiltro(novoFiltro) {
  filtroSelecionado = novoFiltro;

  // Atualizar estilos de todos os botões
  const botoes = {
    'todos': document.getElementById('btn-filtro-todos'),
    'pagamento': document.getElementById('btn-filtro-pagamento'),
    'contrato': document.getElementById('btn-filtro-contrato')
  };

  // Remover seleção de todos os botões
  Object.values(botoes).forEach(btn => {
    if (btn) {
      btn.classList.remove('bg-orange-500', 'text-white', 'hover:bg-orange-600');
      btn.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    }
  });

  // Adicionar seleção ao botão clicado
  const botaoSelecionado = botoes[novoFiltro];
  if (botaoSelecionado) {
    botaoSelecionado.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    botaoSelecionado.classList.add('bg-orange-500', 'text-white', 'hover:bg-orange-600');
  }

  console.log(`🔍 Filtro selecionado: ${novoFiltro}`);
  
  // Recarregar cards com o novo filtro aplicado
  carregarCardsPagamento();
}

// ===== LÓGICA DO GRÁFICO DE AULAS =====

let chartInstance = null;
let periodoAtual = 'Semanal';

function initGrafico() {
  mudarPeriodoGrafico('Semanal');
}

window.mudarPeriodoGrafico = function (periodo) {
  periodoAtual = periodo;

  // Atualizar botões
  const btnMensal = document.getElementById('btn-mensal');
  const btnSemanal = document.getElementById('btn-semanal');
  const seletorMes = document.getElementById('seletor-mes-grafico');
  const seletorSemana = document.getElementById('seletor-semana-grafico');

  if (btnMensal && btnSemanal) {
    if (periodo === 'Mensal') {
      btnMensal.className = "px-4 py-1.5 text-sm font-medium rounded-md transition-all bg-white shadow text-orange-600";
      btnSemanal.className = "px-4 py-1.5 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700";
      // Mostrar seletor de mês apenas em modo Mensal
      if (seletorMes) seletorMes.style.display = 'flex';
      if (seletorSemana) seletorSemana.style.display = 'none';
    } else {
      btnMensal.className = "px-4 py-1.5 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700";
      btnSemanal.className = "px-4 py-1.5 text-sm font-medium rounded-md transition-all bg-white shadow text-orange-600";
      // Ocultar seletor de mês e mostrar seletor de semana em modo Semanal
      if (seletorMes) seletorMes.style.display = 'none';
      if (seletorSemana) seletorSemana.style.display = 'flex';
      // Setar semana atual ao mudar para modo semanal
      semanaGraficoAtual = calcularSemanaAtual();
    }
  }

  carregarDadosGrafico();
};

async function carregarDadosGrafico() {
  const canvas = document.getElementById('graficoAulasCanvas');
  if (!canvas) return;

  // Feedback visual de loading (opcional, mas bom)
  // Como o canvas é transparente, talvez só logar.

  try {
    // Busca todas as aulas da coleção BancoDeAulas-Lista
    // Em produção, isso deveria ser filtrado no back-end se possível.
    const snapshot = await firebase.firestore().collection('BancoDeAulas-Lista').get();
    const aulas = [];
    snapshot.forEach(doc => aulas.push(doc.data()));

    processarDadosGrafico(aulas);

  } catch (error) {
    console.error('Erro ao carregar dados do gráfico:', error);
  }
}

function processarDadosGrafico(aulas) {
  const hoje = new Date();
  const labels = [];
  const dados = [];
  const contagem = {}; // Data -> Quantidade

  if (periodoAtual === 'Mensal') {
    // Eixo X: Dias do mês atual
    const ano = hoje.getFullYear();
    const mes = mesGraficoAtual; // 0-11 (utiliza o mês selecionado)
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();

    // Inicializar contagem
    for (let i = 1; i <= diasNoMes; i++) {
      contagem[i] = 0;
      labels.push(i.toString());
    }

    // Processar aulas
    aulas.forEach(aula => {
      // Formato esperado: ddd - dd/mm/yyyy
      if (aula.data && aula.data.includes('-')) {
        const partes = aula.data.split('-')[1].trim().split('/');
        if (partes.length === 3) {
          const d = parseInt(partes[0]);
          const m = parseInt(partes[1]) - 1; // 0-11
          const y = parseInt(partes[2]);

          if (m === mes && y === ano) {
            if (contagem[d] !== undefined) contagem[d]++;
          }
        }
      }
    });

    for (let i = 1; i <= diasNoMes; i++) {
      dados.push(contagem[i]);
    }

  } else { // Semanal
    // Calcular o domingo da semana selecionada
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const primeiroDiaDoMes = new Date(ano, mes, 1);
    const primeiroDias = primeiroDiaDoMes.getDay(); // Dia da semana do dia 1 (0=domingo)

    // Calcular o domingo da Semana 0 do mês
    const primeiroDomingoDoMes = new Date(primeiroDiaDoMes);
    primeiroDomingoDoMes.setDate(1 - primeiroDias);
    primeiroDomingoDoMes.setHours(0, 0, 0, 0);

    // Calcular a data de início da semana selecionada
    const primeiroDiaSemana = new Date(primeiroDomingoDoMes);
    primeiroDiaSemana.setDate(primeiroDomingoDoMes.getDate() + semanaGraficoAtual * 7);
    primeiroDiaSemana.setHours(0, 0, 0, 0);

    const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Gerar rótulos com datas no formato "Dia (DD)"
    for (let i = 0; i < 7; i++) {
      const data = new Date(primeiroDiaSemana);
      data.setDate(primeiroDiaSemana.getDate() + i);
      const dia = data.getDate().toString().padStart(2, '0');
      const diaNome = diasSemanaNomes[data.getDay()];
      labels.push(`${diaNome} (${dia})`);
      contagem[i] = 0; // Usar índice 0-6 para contar
    }

    const ultimoDiaSemana = new Date(primeiroDiaSemana);
    ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6);
    ultimoDiaSemana.setHours(23, 59, 59, 999);

    aulas.forEach(aula => {
      if (aula.data && aula.data.includes('-')) {
        const partes = aula.data.split('-')[1].trim().split('/');
        const dia = parseInt(partes[0]);
        const mesAula = parseInt(partes[1]) - 1;
        const anoAula = parseInt(partes[2]);
        const dataAula = new Date(anoAula, mesAula, dia);

        // Verificar se está na semana
        if (dataAula >= primeiroDiaSemana && dataAula <= ultimoDiaSemana) {
          const diaIdx = Math.floor((dataAula - primeiroDiaSemana) / (1000 * 60 * 60 * 24)); // Índice 0-6
          if (diaIdx >= 0 && diaIdx < 7) {
            contagem[diaIdx]++;
          }
        }
      }
    });

    for (let i = 0; i < 7; i++) {
      dados.push(contagem[i]);
    }
  }

  renderGrafico(labels, dados);
}

function renderGrafico(labels, data) {
  const ctx = document.getElementById('graficoAulasCanvas');
  if (!ctx) return;

  const context = ctx.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
  }

  // Registrar plugin datalabels se disponível
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

  // Plugin customizado para desenhar linhas verticais nos domingos (modo mensal)
  const pluginLinhasDomingos = {
    id: 'linhasDomingos',
    afterDatasetsDraw(chart) {
      if (periodoAtual !== 'Mensal') return; // Só no modo mensal

      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = mesGraficoAtual; // Usa o mês selecionado

      // Percorrer todos os dias do mês
      for (let dia = 1; dia <= 31; dia++) {
        const data = new Date(ano, mes, dia);
        
        // Verificar se o dia existe neste mês
        if (data.getMonth() !== mes) break;
        
        // Verificar se é domingo (0 = domingo)
        if (data.getDay() === 0) {
          // Encontrar a posição do dia no eixo X
          const diaIdx = dia - 1; // índice do array labels
          const x = xScale.getPixelForValue(diaIdx);
          
          if (!isNaN(x)) {
            // Desenhar linha vertical tracejada
            ctx.save();
            ctx.strokeStyle = '#D1D5DB'; // Gray-300
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]); // Tracejado: 4px linha, 4px espaço
            ctx.beginPath();
            ctx.moveTo(x, yScale.top);
            ctx.lineTo(x, yScale.bottom);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
  };

  // Registrar o plugin
  Chart.register(pluginLinhasDomingos);

  chartInstance = new Chart(context, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Aulas',
        data: data,
        borderColor: '#F97316', // Orange-500
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.4, // Suave
        pointBackgroundColor: '#F97316',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 30,
          left: 10,
          right: 10,
          bottom: 0
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          display: true,
          align: 'top',
          color: '#374151', // Gray-700
          font: {
            weight: 'bold'
          },
          offset: 4,
          formatter: function (value) {
            return value > 0 ? value : ''; // Só mostra se > 0 para limpar visual? Ou mostra tudo? Vou mostrar tudo ou deixar o padrão. O usuário pediu "rótulos de dados".
          }
        },
        tooltip: {
          enabled: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            callback: function(value) {
              // Mostrar apenas inteiros
              if (Number.isInteger(value)) {
                return value;
              }
            }
          },
          grid: {
            borderDash: [2, 4],
            color: '#E5E7EB'
          },
          display: true, // Manter o eixo Y visível
          grace: '5%' // Adiciona espaço extra no topo para evitar corte de valores
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ===== FUNÇÃO PARA ABRIR MODAL DE ALTERAÇÃO DE STATUS =====

window.openStatusModal = function (id, currentStatus) {
  const statusOptions = ['Pendente', 'Reagendada', 'Concluída', 'Reposição', 'Cancelada'];
  
  const modalHTML = `
    <div class="p-4">
      <p class="text-sm text-gray-600 mb-4">
        <i class="fas fa-info-circle text-orange-500 mr-2"></i>
        Selecione o novo status da aula:
      </p>
      
      <div class="space-y-2">
        ${statusOptions.map(status => {
          const isSelected = status === currentStatus;
          const badgeClass = getStatusBadgeClass(status);
          return `
            <button 
              class="w-full px-4 py-3 rounded-lg text-left font-medium transition-all status-option-btn ${badgeClass} ${isSelected ? 'ring-2 ring-offset-2 ring-orange-500' : 'hover:shadow-md'}"
              onclick="updateAulaStatus('${id}', '${status}')"
              title="${status}"
            >
              <i class="fas fa-check-circle mr-2"></i>
              ${status}
              ${isSelected ? '<i class="fas fa-check float-right text-lg"></i>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  const { modal, closeModal } = createModal(
    'Alterar Status da Aula',
    modalHTML,
    [
      {
        text: 'Cancelar',
        classes: 'btn-secondary btn-compact',
        attributes: 'onclick="this.closest(\'.modal-overlay\').remove()"'
      }
    ]
  );
};

// ===== FUNÇÃO PARA ATUALIZAR STATUS NO FIREBASE =====

window.updateAulaStatus = async function (id, newStatus) {
  try {
    console.log(`📝 Atualizando status da aula ${id} para: ${newStatus}`);
    
    // Atualizar no Firebase
    await firebase.firestore()
      .collection('BancoDeAulas-Lista')
      .doc(id)
      .update({
        StatusAula: newStatus,
        ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    console.log(`✅ Status atualizado com sucesso!`);
    
    // Mostrar toast de sucesso
    if (typeof showToast === 'function') {
      showToast(`Status alterado para ${newStatus}! 🎯`, 'success');
    }
    
    // Fechar modal
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    // Recarregar tabela com a mesma data selecionada
    setTimeout(() => {
      loadAulasPainel(formatarDataInput(dataSelecionada));
    }, 300);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error);
    
    if (typeof showToast === 'function') {
      showToast('Erro ao atualizar status. Tente novamente.', 'error');
    } else {
      alert('Erro ao atualizar status. Tente novamente.');
    }
  }
};

// ===== NOVAS FUNÇÕES DE RELATÓRIO (3 SEÇÕES) =====

function limparTitulo(texto, titulo) {
  if (!texto) return '';
  const linhas = texto.trim().split('\n');
  if (linhas.length > 0 && linhas[0].trim().toLowerCase().includes(titulo.toLowerCase())) {
    linhas.shift();
  }
  return linhas.join('\n').trim();
}

window.verRelatorioAula = async function (id) {
  createModal('Detalhes do Relatório', `
    <div class="p-6 text-center">
      <i class="fas fa-spinner fa-spin text-orange-500 text-3xl mb-3"></i>
      <p class="text-gray-600">Carregando relatório...</p>
    </div>
  `, []);

  try {
    const doc = await firebase.firestore().collection('BancoDeAulas-Lista').doc(id).get();

    if (!doc.exists) {
      const modalContent = document.querySelector('.modal-content div');
      if (modalContent) {
        modalContent.innerHTML = `
                <div class="p-6 text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                    <p>Aula não encontrada!</p>
                </div>
             `;
      }
      return;
    }

    const aula = doc.data();
    const relatorioTotal = aula.RelatorioAula || '';

    let descricao = '';
    let comportamento = '';
    let recomendacoes = '';

    const partes = relatorioTotal.split('---');

    if (partes.length >= 1) descricao = limparTitulo(partes[0], 'Descrição da aula');
    if (partes.length >= 2) comportamento = limparTitulo(partes[1], 'Comportamento do Estudante');
    if (partes.length >= 3) recomendacoes = limparTitulo(partes[2], 'Recomendações');

    if (partes.length === 1 && relatorioTotal.trim() !== '') {
      const descTentativa = limparTitulo(relatorioTotal, 'Descrição da aula');
      descricao = descTentativa !== '' ? descTentativa : relatorioTotal;
      if (descTentativa === '' && relatorioTotal.includes('Descrição da aula')) descricao = '';
    }

    const modalHTML = `
      <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <h3 class="text-lg font-bold text-gray-800 mb-1">Relatório da Aula</h3>
          <p class="text-sm text-gray-500 mb-4">ID: ${id}</p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Descrição da aula</label>
          <textarea id="relatorio-descricao-${id}" class="w-full h-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-y" placeholder="Descreva o conteúdo da aula...">${escapeHtml(descricao)}</textarea>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Comportamento do Estudante</label>
          <textarea id="relatorio-comportamento-${id}" class="w-full h-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-y" placeholder="Comente sobre o comportamento...">${escapeHtml(comportamento)}</textarea>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Recomendações</label>
          <textarea id="relatorio-recomendacoes-${id}" class="w-full h-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-y" placeholder="Sugestões ou tarefas...">${escapeHtml(recomendacoes)}</textarea>
        </div>
      </div>
    `;

    const loadingModal = document.querySelector('.modal-overlay');
    if (loadingModal) loadingModal.remove();

    // Armazenar informações da aula para uso posterior
    currentAulaInfo = {
      id: id,
      nomeCliente: aula.nomeCliente || '',
      professor: aula.professor || '',
      data: aula.data || ''
    };

    createModal('Editar relatório de Aula', modalHTML, [
      {
        text: 'Cancelar',
        classes: 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors',
        attributes: 'onclick="this.closest(\'.modal-overlay\').remove()"'
      },
      {
        text: '<i class="fas fa-copy mr-1"></i> Copiar',
        classes: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors',
        attributes: `onclick="copiarRelatorio('${id}')"`
      },
      {
        text: 'Salvar Alterações',
        classes: 'px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors',
        attributes: `onclick="salvarRelatorio('${id}')"`
      }
    ]);

  } catch (error) {
    console.error('Erro ao buscar relatório:', error);
    const loadingModal = document.querySelector('.modal-overlay');
    if (loadingModal) loadingModal.remove();
    alert('Erro ao carregar relatório: ' + error.message);
  }
};

function montarTextoRelatorio(id) {
  const desc = document.getElementById(`relatorio-descricao-${id}`)?.value || '';
  const comp = document.getElementById(`relatorio-comportamento-${id}`)?.value || '';
  const rec = document.getElementById(`relatorio-recomendacoes-${id}`)?.value || '';
  return `Descrição da aula\n${desc}\n---\nComportamento do Estudante\n${comp}\n---\nRecomendações\n${rec}`;
}

window.salvarRelatorio = async function (id) {
  const textoFinal = montarTextoRelatorio(id);
  const btnSalvar = event.target;
  const textoOriginalBtn = btnSalvar.innerHTML;
  btnSalvar.innerText = 'Salvando...';
  btnSalvar.disabled = true;

  try {
    await firebase.firestore().collection('BancoDeAulas-Lista').doc(id).update({
      RelatorioAula: textoFinal
    });

    if (typeof showToast === 'function') {
      showToast('Relatório salvo com sucesso!', 'success');
    } else {
      alert('Relatório salvo com sucesso!');
    }

    const modal = btnSalvar.closest('.modal-overlay');
    if (modal) modal.remove();

  } catch (error) {
    console.error('Erro ao salvar:', error);
    alert('Erro ao salvar: ' + error.message);
    btnSalvar.innerHTML = textoOriginalBtn;
    btnSalvar.disabled = false;
  }
};

window.copiarRelatorio = async function (id) {
  const textoFinal = montarTextoRelatorio(id);
  
  // Obter saudação
  const horaAtual = new Date().getHours();
  let saudacao = 'Bom dia';
  if (horaAtual >= 12 && horaAtual < 18) saudacao = 'Boa tarde';
  if (horaAtual >= 18) saudacao = 'Boa noite';

  // Helper para obter apenas primeiro e segundo nomes
  const getDoisNomes = (nome) => {
    if (!nome) return '';
    const partes = nome.trim().split(/\s+/);
    if (partes.length <= 2) return nome;
    return `${partes[0]} ${partes[1]}`;
  };

  // Determinar data formatada (hoje, amanhã ou data customizada)
  let dataTexto = currentAulaInfo.data; // padrão
  try {
    if (currentAulaInfo.data && currentAulaInfo.data.includes('-')) {
      const partesData = currentAulaInfo.data.split('-')[1].trim().split('/');
      const dia = parseInt(partesData[0]);
      const mes = parseInt(partesData[1]) - 1;
      const ano = parseInt(partesData[2]);

      const dataObj = new Date(ano, mes, dia);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);

      if (dataObj.getTime() === hoje.getTime()) {
        dataTexto = 'hoje';
      } else if (dataObj.getTime() === amanha.getTime()) {
        dataTexto = 'amanhã';
      }
    }
  } catch (e) {
    console.error('Erro ao converter data:', e);
  }

  const nomeClienteFormatado = getDoisNomes(currentAulaInfo.nomeCliente);
  // Função para pegar só o primeiro nome
  const getPrimeiroNome = (nome) => {
    if (!nome) return '';
    return nome.trim().split(' ')[0];
  };
  const nomeProfessorFormatado = getPrimeiroNome(currentAulaInfo.professor);

  // Montar mensagem no novo formato
  const desc = document.getElementById(`relatorio-descricao-${id}`)?.value || '';
  const comp = document.getElementById(`relatorio-comportamento-${id}`)?.value || '';
  const rec = document.getElementById(`relatorio-recomendacoes-${id}`)?.value || '';

  const mensagem = `${saudacao} ${nomeClienteFormatado}!
segue o relatório da aula de ${dataTexto} com: ${nomeProfessorFormatado}

Descrição da aula:
${desc}

Comportamento do aluno:
${comp}

Recomendações:
${rec}`;

  try {
    await navigator.clipboard.writeText(mensagem);
    if (typeof showToast === 'function') {
      showToast('Relatório de aula copiado!', 'success');
    } else {
      alert('Relatório de aula copiado!');
    }
    const btn = event.target;
    const modal = btn.closest('.modal-overlay');
    if (modal) modal.remove();
  } catch (err) {
    console.error('Erro ao copiar:', err);
    const textArea = document.createElement("textarea");
    textArea.value = mensagem;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    if (typeof showToast === 'function') {
      showToast('Relatório de aula copiado!', 'success');
    } else {
      alert('Relatório de aula copiado!');
    }
    const btn = event.target;
    const modal = btn.closest('.modal-overlay');
    if (modal) modal.remove();
  }
};
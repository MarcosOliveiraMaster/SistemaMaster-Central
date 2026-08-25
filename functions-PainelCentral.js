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

// ===== VARIÁVEIS GLOBAIS DE FILTRO (TABELA DE PAGAMENTO) =====
let pgtoContratosCache = [];  // cache dos contratos, evita refetch a cada filtro/busca/ordenação
let pgtoTextoBusca = '';
let pgtoSituacaoAtiva = { contrato: false, pagamento: true };
let pgtoMetodoSelecionado = 'todos';
let pgtoOrdenarPor = 'parcela1'; // 'parcela1' | 'parcela2' | 'numero'

// ===== VARIÁVEIS GLOBAIS DO CALENDÁRIO MASTER =====
let calMasterMes = new Date().getMonth(); // 0-11
let calMasterAno = new Date().getFullYear();
let calMasterExibirAulas = false;
let calMasterExibirPagamentos = true;
let calMasterExibirRenovacoes = true;
let calMasterExibirFeriados = true;   // feriados nacionais, de Alagoas e de Maceió
let calMasterEventosCache = []; // cache dos eventos customizados carregados no mês atual

// Cache local do cálculo de renovações (evita recomputar a cada troca de mês
// dentro da mesma janela de cache do BANCO.fetchBancoDeAulasListaBatch)
let calMasterRenovacoesCache = null;
let calMasterRenovacoesCacheTimestamp = 0;
const CAL_MASTER_RENOVACOES_TTL = 5 * 60 * 1000;

// Status de aula ignorados ao determinar a "última aula" de um pacote (não contam como aula real)
const CAL_MASTER_STATUS_IGNORADOS_RENOVACAO = ['Cancelada', 'Reagendada'];

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
              <th class="col-estudante hidden px-4 py-3 text-left text-sm font-semibold text-gray-700">Estudante</th>
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
    <div class="flex flex-col gap-4 mt-4">
      <!-- Informações de pagamento -->
      <div class="bg-white rounded-lg border border-gray-300 p-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Informações de pagamento</h2>
        
        <!-- Barra de filtros (mês + busca + situação + método + ordenar, todos com a mesma altura) -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <!-- Navegação de Mês -->
          <div class="flex items-center gap-1 border border-gray-300 rounded-lg px-1" style="height: 34px;">
            <button id="btn-mes-anterior" class="px-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-800" style="height: 26px;">
              <i class="fas fa-chevron-left text-sm"></i>
            </button>
            <span id="mes-pagamento-atual" class="text-xs font-semibold text-gray-800 min-w-[70px] text-center">
              Fevereiro
            </span>
            <button id="btn-mes-proximo" class="px-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-800" style="height: 26px;">
              <i class="fas fa-chevron-right text-sm"></i>
            </button>
          </div>

          <!-- Busca por cliente -->
          <div class="relative flex-1" style="min-width: 180px;">
            <i class="fas fa-search absolute text-gray-400 text-xs" style="left: 10px; top: 50%; transform: translateY(-50%);"></i>
            <input type="text" id="pgto-busca-cliente" placeholder="Buscar cliente..."
                   class="w-full border border-gray-300 rounded-lg pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" style="height: 34px;">
          </div>

          <!-- Dropdown de Situação -->
          <div class="relative" id="pgto-situacao-wrapper">
            <button type="button" id="pgto-btn-situacao" class="flex items-center gap-2 border border-gray-300 rounded-lg px-3 text-xs bg-white hover:bg-gray-50 cursor-pointer whitespace-nowrap" style="height: 34px;">
              <span>Situação: Todos</span>
              <i class="fas fa-chevron-down text-gray-400"></i>
            </button>
            <div id="pgto-situacao-dropdown" class="hidden absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-max">
              <div class="p-2 space-y-1">
                <label class="flex items-center justify-between gap-3 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs select-none">
                  <span class="flex items-center gap-2">
                    <input type="checkbox" class="pgto-situacao-chk w-4 h-4" data-situacao="contrato">
                    <span class="font-semibold text-gray-600">Contrato pendente</span>
                  </span>
                  <span id="pgto-contador-contrato" class="text-xs font-bold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 min-w-[18px] text-center">0</span>
                </label>
                <label class="flex items-center justify-between gap-3 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs select-none">
                  <span class="flex items-center gap-2">
                    <input type="checkbox" class="pgto-situacao-chk w-4 h-4" data-situacao="pagamento" checked>
                    <span class="font-semibold text-orange-600">Pagamento pendente</span>
                  </span>
                  <span id="pgto-contador-pagamento" class="text-xs font-bold text-orange-600 bg-orange-50 rounded-full px-2 py-0.5 min-w-[18px] text-center">0</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Método de pagamento -->
          <select id="pgto-filtro-metodo" class="border border-gray-300 rounded-lg px-2 text-xs bg-white cursor-pointer" style="height: 34px;">
            <option value="todos">Todos os métodos</option>
            <option value="cartão de crédito">Cartão de crédito</option>
            <option value="pix completo">Pix completo</option>
            <option value="pix dividido">Pix dividido</option>
          </select>

          <!-- Ordenar por -->
          <select id="pgto-ordenar-por" class="border border-gray-300 rounded-lg px-2 text-xs bg-white cursor-pointer" style="height: 34px;">
            <option value="parcela1">Ordenar por: 1ª Parcela</option>
            <option value="parcela2">Ordenar por: 2ª Parcela</option>
            <option value="numero">Ordenar por: Número da contratação</option>
          </select>
        </div>

        <!-- Área da tabela de pagamento -->
        <div id="areaCardsPagamento" class="border-t border-gray-200" style="max-height: 500px; overflow-y: auto;">
          <div class="text-center py-8 text-gray-500">
            <i class="fas fa-spinner fa-spin text-orange-500 text-2xl mb-2"></i>
            <p class="text-sm">Carregando dados...</p>
          </div>
        </div>
      </div>

      <!-- Eventos do calendário Master -->
      <div class="bg-white rounded-lg border border-gray-300 p-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Eventos do calendário Master</h2>
        <div id="areaCalendarioMaster"></div>
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

  // Inicializar Calendário Master
  carregarCalendarioMaster();
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
          <td class="col-estudante hidden px-4 py-3 text-sm text-gray-600">${aula.estudante || '--'}</td>
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
              onclick="verRelatorioAula('${aula.id}')"
              class="${corRelatorio} transition-colors p-1 rounded-full"
              title="${temRelatorio ? 'Ver/Editar Relatório' : 'Adicionar Relatório'}"
            >
              <i class="fas fa-comment-alt text-lg"></i>
            </button>
          </td>
          <td class="px-2 py-3 text-sm text-center" onclick="event.stopPropagation()">
            <button
              onclick="enviarLembreteCliente('${aula.id}', '${escapeHtml(aula.professor || '')}', '${escapeHtml(aula.data || '')}', '${escapeHtml(aula.horario || '')}', '${escapeHtml(aula.estudante || '')}', '${escapeHtml(aula.nomeCliente || '')}', '${escapeHtml(aula.materia || '')}', '${escapeHtml(aula.StatusAula || '')}')"
              class="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
              title="Copiar Lembrete Professor"
            >
              <i class="fas fa-graduation-cap text-lg"></i>
            </button>
          </td>
          <td class="px-2 py-3 text-sm text-center" onclick="event.stopPropagation()">
            <button
              onclick="enviarLembreteProfessor('${aula.id}', '${escapeHtml(aula.nomeCliente || '')}', '${escapeHtml(aula.professor || '')}', '${escapeHtml(aula.data || '')}', '${escapeHtml(aula.horario || '')}', '${escapeHtml(aula.materia || '')}', '${escapeHtml(aula.StatusAula || '')}')"
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

// Códigos de contratação com uma busca em andamento — evita disparar leituras
// duplicadas no Firestore quando o usuário clica várias vezes seguidas no mesmo
// card/linha antes da primeira resposta chegar (uma das causas do "trava"/"não abre"
// relatado ao reabrir "Detalhes da Contratação" repetidamente pelo Calendário Master).
const _codigosCarregandoDetalhes = new Set();

/**
 * Busca com prazo máximo: uma leitura do Firestore que nunca resolve (rede instável,
 * aba em segundo plano por muito tempo etc.) travava esta tela em "carregando" para
 * sempre. Depois do prazo, rejeita para que o usuário veja um erro e possa tentar de novo.
 */
function _comTimeout(promise, ms, mensagemErro) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensagemErro)), ms))
  ]);
}

/**
 * Abre o modal "Detalhes da Contratação" ao clicar em uma linha da tabelaConsultaAulas.
 * Busca o documento em BancoDeAulas pelo codigoContratacao e abre o modal via BancoDeAulasCards.
 */
async function abrirDetalhesContratacaoPainelCentral(codigoContratacao) {
  if (!codigoContratacao) {
    showToast('Esta aula não possui código de contratação vinculado.', 'warning');
    return;
  }

  if (_codigosCarregandoDetalhes.has(codigoContratacao)) {
    // Já existe uma busca em andamento para este mesmo código — ignora o clique repetido
    // em vez de empilhar outra leitura/modal.
    return;
  }
  _codigosCarregandoDetalhes.add(codigoContratacao);

  try {
    showToast('Carregando detalhes da contratação...', 'info');

    const docSnap = await _comTimeout(
      db.collection('BancoDeAulas').doc(codigoContratacao).get(),
      20000,
      'Tempo de carregamento excedido ao buscar a contratação.'
    );

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
    showToast(error && error.message === 'Tempo de carregamento excedido ao buscar a contratação.'
      ? error.message
      : 'Erro ao carregar detalhes da contratação.', 'error');
  } finally {
    _codigosCarregandoDetalhes.delete(codigoContratacao);
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
window.enviarLembreteProfessor = async function (id, nomeCliente, nomeProfessor, dataAula, horarioAula, nomeMateria, statusAula) {
  if (statusAula === 'Reagendada' && typeof showConfirmDialog === 'function') {
    const confirmou = await showConfirmDialog(
      'Aula reagendada',
      'Esta aula foi reagendada, deseja copiar o lembrete mesmo assim?'
    );
    if (!confirmou) return;
  }

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

window.enviarLembreteCliente = async function (id, nomeProfessor, dataAula, horarioAula, nomeEstudante, nomeCliente, nomeMateria, statusAula) {
  if (statusAula === 'Reagendada' && typeof showConfirmDialog === 'function') {
    const confirmou = await showConfirmDialog(
      'Aula reagendada',
      'Esta aula foi reagendada, deseja copiar o lembrete mesmo assim?'
    );
    if (!confirmou) return;
  }

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
  aplicarFiltrosPagamento();

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
    snapshot.forEach(doc => contratos.push({ id: doc.id, ...doc.data() }));

    console.log(`📊 Total de contratos encontrados: ${contratos.length}`);

    // Cacheia todos os contratos uma única vez — a navegação por mês (mesPagamentoAtual) e os
    // demais filtros são aplicados depois, em aplicarFiltrosPagamento, sem refazer a busca no Firestore.
    pgtoContratosCache = contratos;

    aplicarFiltrosPagamento();
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

// Converte Timestamp do Firebase, string "dd/mm/yyyy" ou Date em um objeto Date
function _pgtoTimestampToDate(valor) {
  if (!valor) return null;
  if (valor.toDate) return valor.toDate();
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string') {
    const partes = valor.split('/');
    if (partes.length === 3) {
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1;
      const ano = parseInt(partes[2]);
      const d = new Date(ano, mes, dia);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// Classifica um contrato em 'contrato' | 'pagamento' | null.
// Pagamento pendente tem prioridade: um contrato com "Aguardando 1º/2º Pagamento" é sempre
// mostrado como pagamento pendente, mesmo que a assinatura do contrato também esteja pendente.
function classificarSituacaoPagamento(contrato) {
  const statusPg = (contrato.statusPagamento || '').toLowerCase();
  if (statusPg.includes('aguardando 1º pagamento') || statusPg.includes('aguardando 2º pagamento')) return 'pagamento';
  const statusCt = (contrato.statusContrato || '').toLowerCase();
  if (statusCt.includes('pendente de assinatura')) return 'contrato';
  return null;
}

// Um contrato "pertence" ao mês navegável do painel quando alguma das suas datas relevantes
// cai nesse mês — igual ao Calendário Master, que soma dataPrimeiraParcela e dataSegundaParcela
// como dois eventos independentes, sem se basear no texto de `statusPagamento` (que é preenchido
// manualmente e pode estar desatualizado em relação às datas de vencimento).
function _pgtoDataNoMesSelecionado(d) {
  return !!d && d.getMonth() === mesPagamentoAtual && d.getFullYear() === new Date().getFullYear();
}

function _pgtoContratoNoMesSelecionado(contrato, situacao) {
  if (situacao === 'pagamento') {
    return _pgtoDataNoMesSelecionado(_pgtoTimestampToDate(contrato.dataPrimeiraParcela)) ||
           _pgtoDataNoMesSelecionado(_pgtoTimestampToDate(contrato.dataSegundaParcela));
  }
  // 'contrato' (pendente de assinatura): usa a data de assinatura prevista, com fallback pro timestamp
  const dAssinatura = _pgtoTimestampToDate(contrato.dataAssinaturaContrato);
  if (dAssinatura) return _pgtoDataNoMesSelecionado(dAssinatura);
  return _pgtoDataNoMesSelecionado(_pgtoTimestampToDate(contrato.timestamp));
}

function ordenarLinhasPagamento(linhas, campo) {
  const arr = [...linhas];
  arr.sort((a, b) => {
    if (campo === 'numero') return String(a.contrato.id).localeCompare(String(b.contrato.id));
    const chave = campo === 'parcela2' ? 'dataSegundaParcela' : 'dataPrimeiraParcela';
    const da = _pgtoTimestampToDate(a.contrato[chave]);
    const db = _pgtoTimestampToDate(b.contrato[chave]);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  });
  return arr;
}

// Aplica busca/situação/método/ordenação sobre o cache de contratos (pgtoContratosCache) e renderiza a tabela.
// Chamada a cada mudança de filtro — não refaz a busca no Firestore.
function aplicarFiltrosPagamento() {
  const areaCards = document.getElementById('areaCardsPagamento');
  if (!areaCards) return;

  const contadores = { contrato: 0, pagamento: 0 };
  const buscaLower = pgtoTextoBusca.toLowerCase();

  const linhas = pgtoContratosCache.reduce((acc, contrato) => {
    const situacao = classificarSituacaoPagamento(contrato);
    if (!situacao) return acc;

    if (!_pgtoContratoNoMesSelecionado(contrato, situacao)) return acc;

    if (pgtoMetodoSelecionado !== 'todos' && (contrato.modoPagamento || '').toLowerCase().trim() !== pgtoMetodoSelecionado) return acc;
    const nomeCliente = contrato.nome || contrato.nomeCliente || '';
    if (buscaLower && !nomeCliente.toLowerCase().includes(buscaLower)) return acc;

    contadores[situacao]++;
    if (!pgtoSituacaoAtiva[situacao]) return acc;

    acc.push({ contrato, situacao });
    return acc;
  }, []);

  const elContadorContrato = document.getElementById('pgto-contador-contrato');
  const elContadorPagamento = document.getElementById('pgto-contador-pagamento');
  if (elContadorContrato) elContadorContrato.textContent = contadores.contrato;
  if (elContadorPagamento) elContadorPagamento.textContent = contadores.pagamento;

  if (linhas.length === 0) {
    areaCards.innerHTML = `
      <div class="flex flex-col items-center justify-center py-8 text-gray-500">
        <i class="fas fa-inbox text-3xl text-gray-400 mb-2"></i>
        <p class="text-sm">Nenhum contrato encontrado para estes filtros</p>
      </div>
    `;
    return;
  }

  renderTabelaPagamento(ordenarLinhasPagamento(linhas, pgtoOrdenarPor));
}

const PGTO_SITUACAO_CONFIG = {
  contrato:  { accent: 'border-gray-400',   label: 'Contrato pendente',  labelColor: 'text-gray-600' },
  pagamento: { accent: 'border-orange-500', label: 'Pagamento pendente', labelColor: 'text-orange-600' }
};

function renderTabelaPagamento(linhas) {
  const areaCards = document.getElementById('areaCardsPagamento');
  if (!areaCards) return;

  const linhasHtml = linhas.map(({ contrato, situacao }) => {
    const nomeCliente = contrato.nome || contrato.nomeCliente || 'Cliente não identificado';
    const statusPagamento = contrato.statusPagamento || 'Não informado';
    const statusContrato = contrato.statusContrato || 'Não informado';
    const metodoPagamento = contrato.modoPagamento || 'Não informado';
    const dataPrimeiraParcela = limparDadosInvalidos(formatarDataContrato(contrato.dataPrimeiraParcela));
    const dataSegundaParcela = limparDadosInvalidos(formatarDataContrato(contrato.dataSegundaParcela));
    const dataContratacao = formatarDataContrato(contrato.timestamp);
    const colorPagamento = getCorStatusPagamento(statusPagamento);
    const colorContrato = getCorStatusPagamento(statusContrato);
    const cfg = PGTO_SITUACAO_CONFIG[situacao] || PGTO_SITUACAO_CONFIG.pagamento;

    return `
      <tr class="border-l-4 ${cfg.accent} border-b border-gray-100 hover:bg-orange-50 transition-colors cursor-pointer"
          onclick="abrirDetalhesContratacaoPainelCentral('${escapeHtml(String(contrato.id))}')"
          title="Ver detalhes da contratação">
        <td class="px-3 py-2 text-sm font-semibold text-gray-800 whitespace-nowrap">${escapeHtml(nomeCliente)}</td>
        <td class="px-3 py-2 text-xs font-bold uppercase ${cfg.labelColor} whitespace-nowrap">${cfg.label}</td>
        <td class="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">${escapeHtml(String(contrato.id))}</td>
        <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${dataContratacao}</td>
        <td class="px-3 py-2 whitespace-nowrap">
          <span class="${colorPagamento} font-medium px-2 py-1 rounded-full text-xs">${statusPagamento}</span>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">
          <span class="${colorContrato} font-medium px-2 py-1 rounded-full text-xs">${statusContrato}</span>
        </td>
        <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${escapeHtml(metodoPagamento)}</td>
        <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${dataPrimeiraParcela}</td>
        <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${dataSegundaParcela}</td>
      </tr>
    `;
  }).join('');

  areaCards.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 bg-gray-50 z-10">
          <tr class="border-b border-gray-200">
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Cliente</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Situação</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Nº Contratação</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Data</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Pagamento</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Contrato</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">Método</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">1ª Parcela</th>
            <th class="px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap">2ª Parcela</th>
          </tr>
        </thead>
        <tbody>
          ${linhasHtml}
        </tbody>
      </table>
    </div>
  `;
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
  const inputBusca = document.getElementById('pgto-busca-cliente');
  const btnSituacao = document.getElementById('pgto-btn-situacao');
  const dropdownSituacao = document.getElementById('pgto-situacao-dropdown');
  const checksSituacao = document.querySelectorAll('.pgto-situacao-chk');
  const selectMetodo = document.getElementById('pgto-filtro-metodo');
  const selectOrdenar = document.getElementById('pgto-ordenar-por');

  if (!inputBusca || !btnSituacao || !dropdownSituacao || !selectMetodo || !selectOrdenar) {
    console.error('Elementos de filtro de pagamento não encontrados');
    return;
  }

  let debounceBusca = null;
  inputBusca.addEventListener('input', () => {
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(() => {
      pgtoTextoBusca = inputBusca.value.trim();
      aplicarFiltrosPagamento();
    }, 250);
  });

  btnSituacao.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownSituacao.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!dropdownSituacao.classList.contains('hidden') && !dropdownSituacao.contains(e.target) && e.target !== btnSituacao) {
      dropdownSituacao.classList.add('hidden');
    }
  });

  checksSituacao.forEach(chk => {
    chk.addEventListener('change', () => {
      pgtoSituacaoAtiva[chk.dataset.situacao] = chk.checked;
      atualizarLabelSituacaoPagamento();
      aplicarFiltrosPagamento();
    });
  });

  selectMetodo.addEventListener('change', () => {
    pgtoMetodoSelecionado = selectMetodo.value;
    aplicarFiltrosPagamento();
  });

  selectOrdenar.addEventListener('change', () => {
    pgtoOrdenarPor = selectOrdenar.value;
    aplicarFiltrosPagamento();
  });

  atualizarLabelSituacaoPagamento();
}

function atualizarLabelSituacaoPagamento() {
  const btnSituacao = document.getElementById('pgto-btn-situacao');
  const span = btnSituacao && btnSituacao.querySelector('span');
  if (!span) return;

  if (pgtoSituacaoAtiva.contrato && pgtoSituacaoAtiva.pagamento) span.textContent = 'Situação: Todos';
  else if (pgtoSituacaoAtiva.contrato) span.textContent = 'Situação: Contrato pendente';
  else if (pgtoSituacaoAtiva.pagamento) span.textContent = 'Situação: Pagamento pendente';
  else span.textContent = 'Situação: Nenhuma';
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

// ============================================================
// CALENDÁRIO MASTER (Painel Central)
// Reaproveita: _primeiroNome() e _parseDataAula() de functions-verificar-datas.js,
// showConfirmDialog() de functions-disciplinas.js, abrirDetalhesContratacaoPainelCentral()
// já existente neste arquivo. Aulas e pagamentos NÃO são gravados na coleção "calendario" —
// só os eventos criados pelo botão "Criar evento".
// ============================================================

function carregarCalendarioMaster() {
  const area = document.getElementById('areaCalendarioMaster');
  if (!area) {
    console.error('areaCalendarioMaster não encontrada');
    return;
  }

  area.innerHTML = `
    <div class="flex items-center flex-wrap justify-between gap-4 mb-3 pb-3 border-b border-gray-200">
      <!-- Navegação de Mês -->
      <div class="flex items-center gap-1 border border-gray-300 rounded-lg px-1" style="height: 34px;">
        <button type="button" id="calMaster-btn-mes-anterior" class="px-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-800" style="height: 26px;">
          <i class="fas fa-chevron-left text-sm"></i>
        </button>
        <span id="calMaster-mes-atual" class="text-xs font-semibold text-gray-800 min-w-[110px] text-center"></span>
        <button type="button" id="calMaster-btn-mes-proximo" class="px-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-800" style="height: 26px;">
          <i class="fas fa-chevron-right text-sm"></i>
        </button>
      </div>

      <!-- Checkboxes + Criar evento -->
      <div class="flex items-center flex-wrap gap-4">
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none" style="height: 34px;">
          <input type="checkbox" id="calMaster-chk-aulas" class="w-4 h-4">
          Exibir aulas
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none" style="height: 34px;">
          <input type="checkbox" id="calMaster-chk-pagamentos" class="w-4 h-4" checked>
          Datas de pagamento
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none" style="height: 34px;">
          <input type="checkbox" id="calMaster-chk-renovacoes" class="w-4 h-4" checked>
          Mostrar renovações
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none" style="height: 34px;">
          <input type="checkbox" id="calMaster-chk-feriados" class="w-4 h-4" checked>
          Exibir feriados
        </label>
        <button type="button" id="calMaster-btn-criar-evento" class="btn-primary btn-compact" style="height: 34px;">
          <i class="fas fa-plus mr-2"></i>
          Criar evento
        </button>
      </div>
    </div>

    <div id="calMaster-grid" class="cal-master-grid"></div>
  `;

  const chkAulas = document.getElementById('calMaster-chk-aulas');
  const chkPagamentos = document.getElementById('calMaster-chk-pagamentos');
  const chkRenovacoes = document.getElementById('calMaster-chk-renovacoes');
  const chkFeriados = document.getElementById('calMaster-chk-feriados');
  const btnCriarEvento = document.getElementById('calMaster-btn-criar-evento');
  const btnMesAnterior = document.getElementById('calMaster-btn-mes-anterior');
  const btnMesProximo = document.getElementById('calMaster-btn-mes-proximo');

  chkAulas.addEventListener('change', () => {
    calMasterExibirAulas = chkAulas.checked;
    renderGradeCalendarioMaster();
  });
  chkPagamentos.addEventListener('change', () => {
    calMasterExibirPagamentos = chkPagamentos.checked;
    renderGradeCalendarioMaster();
  });
  chkRenovacoes.addEventListener('change', () => {
    calMasterExibirRenovacoes = chkRenovacoes.checked;
    renderGradeCalendarioMaster();
  });
  chkFeriados.addEventListener('change', () => {
    calMasterExibirFeriados = chkFeriados.checked;
    renderGradeCalendarioMaster();
  });
  btnCriarEvento.addEventListener('click', () => abrirModalCriarEvento());
  btnMesAnterior.addEventListener('click', () => mudarMesCalMaster(-1));
  btnMesProximo.addEventListener('click', () => mudarMesCalMaster(1));

  atualizarExibicaoMesCalMaster();
  renderGradeCalendarioMaster();
}

function mudarMesCalMaster(direcao) {
  calMasterMes += direcao;
  if (calMasterMes < 0) {
    calMasterMes = 11;
    calMasterAno -= 1;
  } else if (calMasterMes > 11) {
    calMasterMes = 0;
    calMasterAno += 1;
  }
  atualizarExibicaoMesCalMaster();
  renderGradeCalendarioMaster();
}

function atualizarExibicaoMesCalMaster() {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const el = document.getElementById('calMaster-mes-atual');
  if (el) el.textContent = `${meses[calMasterMes]} ${calMasterAno}`;
}

function _calMasterHorarioToMinutos(hhmm) {
  if (!hhmm) return 0;
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Primeiro e segundo nome (ex: "Maria Eduarda Silva" -> "Maria Eduarda")
function _calMasterDoisNomes(nome) {
  if (!nome) return '';
  const partes = String(nome).trim().split(/\s+/);
  if (partes.length <= 2) return partes.join(' ');
  return `${partes[0]} ${partes[1]}`;
}

// Calcula a data de renovação de cada pacote a partir da última aula válida (ignorando
// Cancelada/Reagendada). Regra: 2 dias antes da última aula; se o pacote tiver só 1 ou 2
// aulas válidas no total, 7 dias depois da última aula.
// Reaproveita BANCO.fetchBancoDeAulasListaBatch() (já cacheado) — nenhuma leitura extra do
// Firestore além da que a coluna "Exibir aulas" já faria. Resultado cacheado localmente por
// CAL_MASTER_RENOVACOES_TTL pra não recalcular a cada troca de mês.
async function calcularRenovacoesPacotes() {
  const agora = Date.now();
  if (calMasterRenovacoesCache && (agora - calMasterRenovacoesCacheTimestamp) < CAL_MASTER_RENOVACOES_TTL) {
    return calMasterRenovacoesCache;
  }

  const aulas = await BANCO.fetchBancoDeAulasListaBatch();
  const porContrato = {}; // { codigoContratacao: { ultimaData, count, nomeCliente } }

  aulas.forEach(aula => {
    if (CAL_MASTER_STATUS_IGNORADOS_RENOVACAO.includes(aula.StatusAula)) return;
    const codigo = aula.codigoContratacao;
    if (!codigo) return;
    const d = _parseDataAula(aula.data);
    if (!d) return;

    const nomeCliente = aula.nomeCliente || aula.nome || '';
    if (!porContrato[codigo]) {
      porContrato[codigo] = { ultimaData: d, count: 1, nomeCliente };
    } else {
      porContrato[codigo].count++;
      if (d.getTime() > porContrato[codigo].ultimaData.getTime()) {
        porContrato[codigo].ultimaData = d;
        if (nomeCliente) porContrato[codigo].nomeCliente = nomeCliente;
      }
    }
  });

  const renovacoes = Object.entries(porContrato).map(([codigoContratacao, info]) => {
    const dataRenovacao = new Date(info.ultimaData);
    if (info.count <= 2) {
      dataRenovacao.setDate(dataRenovacao.getDate() + 7);
    } else {
      dataRenovacao.setDate(dataRenovacao.getDate() - 2);
    }
    return { codigoContratacao, nomeCliente: info.nomeCliente, dataRenovacao };
  });

  calMasterRenovacoesCache = renovacoes;
  calMasterRenovacoesCacheTimestamp = agora;
  return renovacoes;
}

// Converte "yyyy-mm-dd" (input type=date) para "dd/mm/yyyy" (padrão de data usado no resto do sistema)
function _calMasterISOparaBR(iso) {
  if (!iso) return '';
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Converte "dd/mm/yyyy" para "yyyy-mm-dd" (para preencher input type=date)
function _calMasterBRparaISO(br) {
  if (!br) return '';
  const m = String(br).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function renderGradeCalendarioMaster() {
  const grid = document.getElementById('calMaster-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="cal-master-loading">
      <i class="fas fa-spinner fa-spin text-orange-500 text-2xl"></i>
    </div>
  `;

  // Mapa dia -> lista de eventos { tipo, minutos, linhas, onclickAttr }
  const eventosPorDia = {};
  const addEvento = (dia, evento) => {
    if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
    eventosPorDia[dia].push(evento);
  };

  const promessas = [];

  // Aulas (laranja) — vêm de BancoDeAulas-Lista, não são gravadas em "calendario"
  if (calMasterExibirAulas) {
    promessas.push(
      BANCO.fetchBancoDeAulasListaBatch().then(aulas => {
        aulas.forEach(aula => {
          const d = _parseDataAula(aula.data);
          if (!d || d.getMonth() !== calMasterMes || d.getFullYear() !== calMasterAno) return;
          addEvento(d.getDate(), {
            tipo: 'aula',
            minutos: _calMasterHorarioToMinutos(aula.horario),
            linhas: [`Cliente: ${_calMasterDoisNomes(aula.nomeCliente)}`, `Prof.: ${_calMasterDoisNomes(aula.professor)}`, aula.horario || '--'],
            onclickAttr: `abrirDetalhesContratacaoPainelCentral('${escapeHtml(String(aula.codigoContratacao || ''))}')`
          });
        });
      }).catch(err => console.error('❌ Erro ao carregar aulas do Calendário Master:', err))
    );
  }

  // Datas de pagamento (verde) — vêm de BancoDeAulas, não são gravadas em "calendario"
  if (calMasterExibirPagamentos) {
    promessas.push(
      BANCO.fetchBancoDeAulas().then(contratos => {
        contratos.forEach(contrato => {
          const codigo = contrato.codigoContratacao || contrato.id;
          const nomePrimeiro = _primeiroNome(contrato.nomeCliente || contrato.nome);
          const onclickAttr = `abrirDetalhesContratacaoPainelCentral('${escapeHtml(String(codigo || ''))}')`;

          const d1 = _parseDataAula(contrato.dataPrimeiraParcela);
          if (d1 && d1.getMonth() === calMasterMes && d1.getFullYear() === calMasterAno) {
            addEvento(d1.getDate(), {
              tipo: 'pagamento',
              minutos: 0,
              linhas: ['Pagamento 1ª parcela', `(${nomePrimeiro})`],
              onclickAttr
            });
          }

          const d2 = _parseDataAula(contrato.dataSegundaParcela);
          if (d2 && d2.getMonth() === calMasterMes && d2.getFullYear() === calMasterAno) {
            addEvento(d2.getDate(), {
              tipo: 'pagamento',
              minutos: 0,
              linhas: ['Pagamento 2ª parcela', `(${nomePrimeiro})`],
              onclickAttr
            });
          }
        });
      }).catch(err => console.error('❌ Erro ao carregar pagamentos do Calendário Master:', err))
    );
  }

  // Eventos customizados (azul) — únicos que vêm da coleção "calendario", sempre exibidos
  promessas.push(
    BANCO.fetchEventosCalendario().then(eventos => {
      calMasterEventosCache = eventos;
      eventos.forEach(evento => {
        const d = _parseDataAula(evento.data);
        if (!d || d.getMonth() !== calMasterMes || d.getFullYear() !== calMasterAno) return;
        addEvento(d.getDate(), {
          tipo: 'evento',
          minutos: _calMasterHorarioToMinutos(evento.hora),
          linhas: [evento.nome || '--', evento.hora || '--'],
          onclickAttr: `calMasterAbrirDetalhesEvento('${escapeHtml(String(evento.id))}')`
        });
      });
    }).catch(err => console.error('❌ Erro ao carregar eventos do Calendário Master:', err))
  );

  // Feriados (verde) — nacionais, de Alagoas e de Maceió. Vêm de feriados.js, que é
  // cálculo puro: nada de rede nem de Firestore, por isso não entram em "promessas".
  // minutos -1 mantém o feriado no topo do dia, antes de qualquer evento com horário.
  if (calMasterExibirFeriados && typeof Feriados !== 'undefined' && Feriados.porDia) {
    const feriadosPorDia = Feriados.porDia(calMasterMes, calMasterAno);
    Object.keys(feriadosPorDia).forEach(dia => {
      const doDia = feriadosPorDia[dia];
      const rotulo = doDia.length > 1
        ? `${doDia[0].nome} +${doDia.length - 1}`
        : doDia[0].nome;
      addEvento(parseInt(dia, 10), {
        tipo: 'feriado',
        minutos: -1,
        linhas: [rotulo],
        onclickAttr: `CalendarioBusca.abrirModalFeriado(${parseInt(dia, 10)}, ${calMasterMes}, ${calMasterAno})`
      });
    });
  }

  // Renovações de pacote (roxo) — calculadas a partir da última aula válida de cada contrato
  if (calMasterExibirRenovacoes) {
    promessas.push(
      calcularRenovacoesPacotes().then(renovacoes => {
        renovacoes.forEach(r => {
          if (r.dataRenovacao.getMonth() !== calMasterMes || r.dataRenovacao.getFullYear() !== calMasterAno) return;
          addEvento(r.dataRenovacao.getDate(), {
            tipo: 'renovacao',
            minutos: 0,
            linhas: ['Renovação pacote', `(${_calMasterDoisNomes(r.nomeCliente)})`],
            onclickAttr: `abrirDetalhesContratacaoPainelCentral('${escapeHtml(String(r.codigoContratacao))}')`
          });
        });
      }).catch(err => console.error('❌ Erro ao calcular renovações do Calendário Master:', err))
    );
  }

  await Promise.all(promessas);

  // Ordenar eventos de cada dia por horário
  Object.keys(eventosPorDia).forEach(dia => {
    eventosPorDia[dia].sort((a, b) => a.minutos - b.minutos);
  });

  // Montar grid do mês
  const primeiroDiaMes = new Date(calMasterAno, calMasterMes, 1);
  const diaSemanaInicio = primeiroDiaMes.getDay(); // 0=domingo
  const diasNoMes = new Date(calMasterAno, calMasterMes + 1, 0).getDate();
  const diasNoMesAnterior = new Date(calMasterAno, calMasterMes, 0).getDate();

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let html = diasSemana.map(d => `<div class="cal-master-weekday">${d}</div>`).join('');

  const renderEventoHtml = (evento) => {
    const linhasHtml = evento.linhas.map(l => `<span class="cal-master-event-line">${escapeHtml(String(l))}</span>`).join('');
    return `
      <div class="cal-master-event cal-master-event-${evento.tipo}" onclick="${evento.onclickAttr}" title="${escapeHtml(evento.linhas.join(' • '))}">
        ${linhasHtml}
      </div>
    `;
  };

  // Padding: dias do mês anterior
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const dia = diasNoMesAnterior - i;
    html += `<div class="cal-master-day cal-master-day-other"><div class="cal-master-day-num">${dia}</div></div>`;
  }

  // Dias do mês atual
  const hoje = new Date();
  const isMesAtualHoje = hoje.getFullYear() === calMasterAno && hoje.getMonth() === calMasterMes;

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const eventosDoDia = eventosPorDia[dia] || [];
    const classeHoje = (isMesAtualHoje && dia === hoje.getDate()) ? ' cal-master-day-hoje' : '';
    html += `
      <div class="cal-master-day${classeHoje}">
        <div class="cal-master-day-num">${dia}</div>
        <div class="cal-master-day-events">
          ${eventosDoDia.map(renderEventoHtml).join('')}
        </div>
      </div>
    `;
  }

  // Padding: dias do próximo mês (completar última semana)
  const totalCelulas = diaSemanaInicio + diasNoMes;
  const restante = (7 - (totalCelulas % 7)) % 7;
  for (let dia = 1; dia <= restante; dia++) {
    html += `<div class="cal-master-day cal-master-day-other"><div class="cal-master-day-num">${dia}</div></div>`;
  }

  grid.innerHTML = html;
}

function abrirModalCriarEvento() {
  const modalHtml = `
    <div class="modal-overlay" id="modalCriarEventoCalendario">
      <div class="modal-container" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-calendar-plus text-blue-500 mr-2"></i>
            Criar evento
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nome do evento</label>
              <input type="text" id="calMasterNovoNome" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Reunião de equipe">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" id="calMasterNovaData" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" id="calMasterNovaHora" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <select id="calMasterNovoResponsavel" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="Ester Oliveira">Ester Oliveira</option>
                <option value="Ester Calazans">Ester Calazans</option>
                <option value="Todos">Todos</option>
                <option value="A Definir" selected>A Definir</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="calMasterBtnCancelarEvento" class="btn-secondary btn-compact">Cancelar</button>
          <button id="calMasterBtnSalvarEvento" class="btn-primary btn-compact" disabled>
            <i class="fas fa-check mr-2"></i>
            Criar evento
          </button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);

  const modal = container.querySelector('#modalCriarEventoCalendario');
  const closeModal = () => container.remove();

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('#calMasterBtnCancelarEvento').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const inputNome = modal.querySelector('#calMasterNovoNome');
  const inputData = modal.querySelector('#calMasterNovaData');
  const inputHora = modal.querySelector('#calMasterNovaHora');
  const btnSalvar = modal.querySelector('#calMasterBtnSalvarEvento');

  const validar = () => {
    btnSalvar.disabled = !(inputNome.value.trim() && inputData.value && inputHora.value);
  };
  inputNome.addEventListener('input', validar);
  inputData.addEventListener('change', validar);
  inputHora.addEventListener('change', validar);

  btnSalvar.addEventListener('click', async () => {
    const originalHTML = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

    try {
      await BANCO.addEventoCalendario({
        nome: inputNome.value.trim(),
        data: _calMasterISOparaBR(inputData.value),
        hora: inputHora.value,
        responsavel: modal.querySelector('#calMasterNovoResponsavel').value
      });
      showToast('✅ Evento criado com sucesso!', 'success');
      closeModal();
      renderGradeCalendarioMaster();
    } catch (error) {
      console.error('❌ Erro ao criar evento:', error);
      showToast('❌ Erro ao criar evento', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = originalHTML;
    }
  });
}

function calMasterAbrirDetalhesEvento(eventoId) {
  const evento = calMasterEventosCache.find(e => e.id === eventoId);
  if (!evento) {
    showToast('Evento não encontrado', 'error');
    return;
  }

  const opcoesResponsavel = ['Ester Oliveira', 'Ester Calazans', 'Todos', 'A Definir'];
  const dataISO = _calMasterBRparaISO(evento.data);

  const modalHtml = `
    <div class="modal-overlay" id="modalDetalhesEventoCalendario">
      <div class="modal-container" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-calendar-day text-blue-500 mr-2"></i>
            Detalhes do Evento
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nome do evento</label>
              <input type="text" id="calMasterEditNome" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${escapeHtml(evento.nome || '')}">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" id="calMasterEditData" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${dataISO}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" id="calMasterEditHora" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${escapeHtml(evento.hora || '')}">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <select id="calMasterEditResponsavel" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                ${opcoesResponsavel.map(opt => `<option value="${opt}" ${evento.responsavel === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="calMasterBtnExcluirEvento" class="btn-secondary btn-compact text-red-600 hover:bg-red-50">
            <i class="fas fa-trash mr-2"></i>
            Excluir
          </button>
          <button id="calMasterBtnSalvarEdicaoEvento" class="btn-primary btn-compact" disabled>
            <i class="fas fa-save mr-2"></i>
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);

  const modal = container.querySelector('#modalDetalhesEventoCalendario');
  const closeModal = () => container.remove();
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const inputNome = modal.querySelector('#calMasterEditNome');
  const inputData = modal.querySelector('#calMasterEditData');
  const inputHora = modal.querySelector('#calMasterEditHora');
  const selectResp = modal.querySelector('#calMasterEditResponsavel');
  const btnSalvar = modal.querySelector('#calMasterBtnSalvarEdicaoEvento');
  const btnExcluir = modal.querySelector('#calMasterBtnExcluirEvento');

  const valoresOriginais = {
    nome: evento.nome || '',
    data: dataISO,
    hora: evento.hora || '',
    responsavel: evento.responsavel || ''
  };
  const detectarMudanca = () => {
    btnSalvar.disabled = (
      inputNome.value.trim() === valoresOriginais.nome &&
      inputData.value === valoresOriginais.data &&
      inputHora.value === valoresOriginais.hora &&
      selectResp.value === valoresOriginais.responsavel
    );
  };
  inputNome.addEventListener('input', detectarMudanca);
  inputData.addEventListener('change', detectarMudanca);
  inputHora.addEventListener('change', detectarMudanca);
  selectResp.addEventListener('change', detectarMudanca);

  btnSalvar.addEventListener('click', async () => {
    const originalHTML = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
    try {
      await BANCO.updateEventoCalendario(evento.id, {
        nome: inputNome.value.trim(),
        data: _calMasterISOparaBR(inputData.value),
        hora: inputHora.value,
        responsavel: selectResp.value
      });
      showToast('✅ Evento atualizado com sucesso!', 'success');
      closeModal();
      renderGradeCalendarioMaster();
    } catch (error) {
      console.error('❌ Erro ao atualizar evento:', error);
      showToast('❌ Erro ao atualizar evento', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = originalHTML;
    }
  });

  btnExcluir.addEventListener('click', async () => {
    const confirmou = await showConfirmDialog('Excluir evento', `Tem certeza que deseja excluir o evento "${escapeHtml(evento.nome || '')}"?`);
    if (!confirmou) return;

    btnExcluir.disabled = true;
    try {
      await BANCO.deleteEventoCalendario(evento.id);
      showToast('✅ Evento excluído com sucesso!', 'success');
      closeModal();
      renderGradeCalendarioMaster();
    } catch (error) {
      console.error('❌ Erro ao excluir evento:', error);
      showToast('❌ Erro ao excluir evento', 'error');
      btnExcluir.disabled = false;
    }
  });
}
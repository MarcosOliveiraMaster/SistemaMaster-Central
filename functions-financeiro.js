console.log('functions-financeiro.js carregado');

// Variáveis globais para controle do mês
let mesSelecionado = new Date().getMonth(); // 0-11
let anoSelecionado = new Date().getFullYear();

// Array de meses para referência
const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Variáveis para armazenar totais do mês para cálculo de despesas
let totalInvestimentosMesAtual = 0;
let totalPagamentoEquipeMesAtual = 0;

// Variáveis para controlar sincronização de indicadores
let faturamentoValue = 0;
let lucroMasterValue = 0;
let indicadorFaturamentoCarregado = false;
let indicadorInvestimentosCarregado = false;
let indicadorPagamentoEquipeCarregado = false;

// Função para carregar o Painel Financeiro
window.loadPainelFinanceiro = function() {
  const section = document.getElementById('mensagens');
  if (!section) {
    console.error('Section mensagens não encontrada');
    return;
  }

  // Construir HTML do Painel Financeiro
  section.innerHTML = `
    <!-- Seção Vendas -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800">Vendas</h2>
        
        <!-- Botões de Visualização -->
        <div class="flex gap-4 whitespace-nowrap">
          <!-- Botões de Métricas Anual (Múltipla Seleção) -->
          <div id="vendas-metrics-anual" class="flex gap-0">
            <button id="btn-vendas-lucro-atual" class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="lucro-atual" title="Lucro Atual">
              Lucro Atual
            </button>
            <button id="btn-vendas-faturamento" class="py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="faturamento" title="Faturamento">
              Faturamento
            </button>
            <button id="btn-vendas-despesas" class="py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="despesas" title="Despesas">
              Despesas
            </button>
            <button id="btn-vendas-meta-lucro" class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="meta-lucro" title="Meta de Lucro">
              Meta de Lucro
            </button>
          </div>

          <!-- Botões de Métricas Mensal (Entradas, Saídas, Saldos) -->
          <div id="vendas-metrics-mensal" class="flex gap-0" style="display: none;">
            <button id="btn-vendas-entradas" class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="entradas" title="Entradas">
              Entradas
            </button>
            <button id="btn-vendas-saidas" class="py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="saidas" title="Saídas">
              Saídas
            </button>
            <button id="btn-vendas-saldos" class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="saldos" title="Saldos">
              Saldos
            </button>
          </div>

          <!-- Botão Gerar DRE -->
          <button id="gerar-dre" class="p-1.5 rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-orange-500 hover:text-white border border-gray-200" title="Gerar DRE">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          <!-- Botões de Período (Anual/Mensal) - comentados -->
          <!--
          <div class="flex gap-0">
            <button id="btn-vendas-anual" class="py-1.5 px-6 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" data-visualizacao="anual">
              Anual
            </button>
            <button id="btn-vendas-mensal" class="py-1.5 px-6 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-visualizacao="mensal">
              Mensal
            </button>
          </div>
          -->
        </div>
      </div>
      
      <!-- Gráfico de Vendas -->
      <div id="graficoVendas" class="w-full" style="height: 400px;">
        <!-- Gráfico será adicionado aqui -->
      </div>
    </div>

    <!-- Seletor de Mês -->
    <div class="flex justify-start items-center gap-4 mb-2 py-2">
      <button id="btn-mes-anterior" class="p-2.5 text-gray-500 hover:text-orange-500 transition-all duration-300 transform hover:scale-110 rounded-lg hover:bg-orange-50 active:scale-95 border border-gray-300 shadow-md hover:shadow-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>
      
      <div id="mes-selecionado" class="text-lg font-lexend font-bold text-gray-800 tracking-tight transition-all duration-400" style="min-width: 140px; text-align: left; letter-spacing: -0.5px;">
        Fevereiro 2026
      </div>
      
      <button id="btn-mes-proximo" class="p-2.5 text-gray-500 hover:text-orange-500 transition-all duration-300 transform hover:scale-110 rounded-lg hover:bg-orange-50 active:scale-95 border border-gray-300 shadow-md hover:shadow-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    </div>

    <!-- Indicadores Rápidos -->
    <div class="grid grid-cols-3 gap-4 mb-4">
      <!-- Faturamento -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 shadow-md hover:shadow-lg transition">
        <h3 class="text-sm font-semibold text-gray-600 mb-2">Faturamento</h3>
        <p id="indicador-faturamento" class="text-2xl font-bold text-orange-500">R$ 0,00</p>
      </div>
      
      <!-- Lucro Líquido -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 shadow-md hover:shadow-lg transition">
        <h3 class="text-sm font-semibold text-gray-600 mb-2">Lucro Líquido</h3>
        <p id="indicador-lucro-bruto" class="text-2xl font-bold text-green-500">R$ 0,00</p>
      </div>
      
      <!-- Despesas e Investimentos -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 shadow-md hover:shadow-lg transition">
        <h3 class="text-sm font-semibold text-gray-600 mb-2">Despesas e Investimentos</h3>
        <p id="indicador-despesas" class="text-2xl font-bold text-red-500">R$ 0,00</p>
      </div>
    </div>

    <!-- Seção Entradas -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Entradas</h2>
      
      <!-- Tabela de Controle de Caixa -->
      <div class="max-h-[300px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
        <table id="tabelaControleCaixa" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome Cliente</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Horas Contratadas</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Forma de Pagamento</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status Pagamento</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor Contratação</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Lucro Atual</th>
            </tr>
          </thead>
          <tbody id="tabelaControleCaixaBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="7" class="px-4 py-8 text-center text-gray-500 text-sm">
                Nenhum registro encontrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seção Saídas: Investimentos e despesas -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800">Saídas: Investimentos e despesas</h2>
        <button id="btn-adicionar-investimento" class="py-1.5 px-4 text-sm font-medium rounded-lg transition-all bg-orange-500 text-white hover:bg-orange-600">
          + Adicionar informação
        </button>
      </div>
      
      <!-- Tabela de Saídas Investimentos -->
      <div class="max-h-[300px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
        <table id="tabelaSaidasInvestimentos" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700" style="width: 54%; word-break: break-word; overflow-wrap: break-word;">Descrição</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo de Despesa</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
            </tr>
          </thead>
          <tbody id="tabelaSaidasInvestimentosBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="4" class="px-4 py-8 text-center text-gray-500 text-sm">
                Nenhum registro encontrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seção Saída: Pagamento de Equipe -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800">Saída: Pagamento de Equipe</h2>
        <span id="total-pagamento-equipe" class="text-sm font-lexend font-semibold text-black">Total: R$ 0,00</span>
      </div>
      
      <!-- Tabela de Pagamento de Equipe -->
      <div class="max-h-[300px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
        <table id="tabelaPagamentoEquipe" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome Professor</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700" style="display: none;">Nome Cliente</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor das Aulas</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700" style="display: none;">Contratação</th>
            </tr>
          </thead>
          <tbody id="tabelaPagamentoEquipeBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="2" class="px-4 py-8 text-center text-gray-500 text-sm">
                Nenhum registro encontrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seção Indicadores Estratégicos -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800">Indicadores Estratégicos</h2>
        <button id="btn-salvar-indicadores" class="py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm shadow-md">
          <i class="fas fa-save mr-2"></i>Salvar Novos Dados
        </button>
      </div>
      
      <!-- Tabela de Indicadores Estratégicos -->
      <div class="overflow-x-auto">
        <table id="tabelaIndicadoresEstrategicos" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Faturamento</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Repasse para Equipe</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Custos Fixos</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Custos Variáveis</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Custos Extras</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Despesas Totais</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Lucro Bruto</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Lucro Líquido</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reserva de Emergência</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Meta Alcançada</th>
            </tr>
          </thead>
          <tbody id="tabelaIndicadoresEstrategicosBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="10" class="px-4 py-8 text-center text-gray-500 text-sm">
                Nenhum registro encontrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Adicionar modal ao documento
  adicionarModalInvestimento();
  adicionarModalEditarInvestimento();
  adicionarModalDRE();

  // Inicializar eventos dos botões
  initBotoesVendas();
  initSeletorMes();
  inicializarBotaoSalvarIndicadores();
  
  // Aguardar a disponibilidade do Firebase
  setTimeout(() => {
    // Resetar flags de indicadores
    indicadorFaturamentoCarregado = false;
    indicadorInvestimentosCarregado = false;
    indicadorPagamentoEquipeCarregado = false;
    
    // Inicializar gráfico de vendas
    initGraficoVendas();
    
    initBotaoAdicionarInvestimento();
    initModalEditarInvestimento();
    initBotaoDRE();
    carregarInvestimentos();
    carregarEntradas(); // Carregar entradas do mês
    carregarPagamentoEquipe(); // Carregar pagamento de equipe do mês
  }, 500);
};

function adicionarModalInvestimento() {
  console.log('=== CRIANDO MODAL ===');
  
  // Criar backdrop e modal
  const backdrop = document.createElement('div');
  backdrop.id = 'backdrop-modal-investimento';
  backdrop.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300';
  backdrop.style.display = 'none';

  const modal = document.createElement('div');
  modal.id = 'modal-investimento';
  modal.className = 'hidden fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300';
  modal.style.display = 'none';

  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-xl font-lexend font-bold text-gray-800 mb-6">Adicionar Investimento</h3>
      
      <!-- Mensagem de validação -->
      <div id="erro-validacao-investimento" class="hidden mb-4 p-3 bg-red-50 border border-red-300 rounded-lg">
        <p class="text-red-600 text-sm">
          <span id="erro-msg" class="font-semibold">Preencha todos os campos</span>
        </p>
      </div>

      <!-- Campo Data e Tipo lado a lado -->
      <div class="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Data</label>
          <input 
            type="text" 
            id="input-data-investimento" 
            placeholder="DD/MM/YYYY"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition"
            maxlength="10"
          />
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
          <select 
            id="input-tipo-investimento"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition bg-white"
          >
            <option value="recorrente_fixa">Recorrente Fixa</option>
            <option value="recorrente_variavel">Recorrente Variável</option>
            <option value="extra">Extra</option>
          </select>
        </div>
      </div>

      <!-- Campo Descrição -->
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
        <textarea 
          id="input-descricao-investimento" 
          placeholder="Ex: Compra de equipamento"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition resize-none"
          style="overflow-y: hidden; max-height: 300px; min-height: 40px; line-height: 1.5; font-family: inherit;"
        ></textarea>
      </div>

      <!-- Campo Valor -->
      <div class="mb-6">
        <label class="block text-sm font-semibold text-gray-700 mb-1">Valor</label>
        <input 
          type="text" 
          id="input-valor-investimento" 
          placeholder="R$ 0,00"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition"
        />
      </div>

      <!-- Botões -->
      <div class="flex gap-3 justify-end">
        <button 
          id="btn-cancelar-investimento"
          class="py-2 px-4 text-sm font-medium rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button 
          id="btn-salvar-investimento"
          class="py-2 px-4 text-sm font-medium rounded-lg transition-all bg-orange-500 text-white hover:bg-orange-600"
        >
          Salvar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  
  console.log('✅ Modal criado e adicionado ao body');
  console.log('  backdrop.id:', backdrop.id);
  console.log('  modal.id:', modal.id);
}

function adicionarModalEditarInvestimento() {
  console.log('=== CRIANDO MODAL EDITAR ===');
  
  // Criar backdrop e modal
  const backdrop = document.createElement('div');
  backdrop.id = 'backdrop-modal-editar-investimento';
  backdrop.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300';
  backdrop.style.display = 'none';

  const modal = document.createElement('div');
  modal.id = 'modal-editar-investimento';
  modal.className = 'hidden fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300';
  modal.style.display = 'none';

  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-xl font-lexend font-bold text-gray-800 mb-6">Editar Investimento</h3>
      
      <!-- Mensagem de validação -->
      <div id="erro-validacao-editar-investimento" class="hidden mb-4 p-3 bg-red-50 border border-red-300 rounded-lg">
        <p class="text-red-600 text-sm">
          <span id="erro-msg-editar" class="font-semibold">Preencha todos os campos</span>
        </p>
      </div>

      <!-- Campo Data e Tipo lado a lado -->
      <div class="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Data</label>
          <input 
            type="text" 
            id="input-data-editar-investimento" 
            placeholder="DD/MM/YYYY"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition"
            maxlength="10"
          />
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
          <select 
            id="input-tipo-editar-investimento"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition bg-white"
          >
            <option value="recorrente_fixa">Recorrente Fixa</option>
            <option value="recorrente_variavel">Recorrente Variável</option>
            <option value="extra">Extra</option>
          </select>
        </div>
      </div>

      <!-- Campo Descrição -->
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
        <textarea 
          id="input-descricao-editar-investimento" 
          placeholder="Ex: Compra de equipamento"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition resize-none"
          style="overflow-y: hidden; max-height: 300px; min-height: 40px; line-height: 1.5; font-family: inherit;"
        ></textarea>
      </div>

      <!-- Campo Valor -->
      <div class="mb-6">
        <label class="block text-sm font-semibold text-gray-700 mb-1">Valor</label>
        <input 
          type="text" 
          id="input-valor-editar-investimento" 
          placeholder="R$ 0,00"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition"
        />
      </div>

      <!-- Botões -->
      <div class="flex gap-3 justify-end">
        <button 
          id="btn-cancelar-editar-investimento"
          class="py-2 px-4 text-sm font-medium rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button 
          id="btn-salvar-editar-investimento"
          class="py-2 px-4 text-sm font-medium rounded-lg transition-all bg-orange-500 text-white hover:bg-orange-600"
        >
          Salvar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  
  console.log('✅ Modal Editar criado e adicionado ao body');
}

function initBotoesVendas() {
  const btnAnual = document.getElementById('btn-vendas-anual');
  const btnMensal = document.getElementById('btn-vendas-mensal');
  
  // Botões de métricas anuais
  const btnLucroAtual = document.getElementById('btn-vendas-lucro-atual');
  const btnFaturamento = document.getElementById('btn-vendas-faturamento');
  const btnDespesas = document.getElementById('btn-vendas-despesas');
  const btnMetaLucro = document.getElementById('btn-vendas-meta-lucro');
  
  // Botões de métricas mensais
  const btnEntradas = document.getElementById('btn-vendas-entradas');
  const btnSaidas = document.getElementById('btn-vendas-saidas');
  const btnSaldos = document.getElementById('btn-vendas-saldos');

  if (btnAnual) {
    btnAnual.addEventListener('click', () => {
      mudarVisualizacaoVendas('anual');
    });
  }

  if (btnMensal) {
    btnMensal.addEventListener('click', () => {
      mudarVisualizacaoVendas('mensal');
    });
  }

  // Event listeners para os botões de múltipla seleção ANUAIS
  if (btnLucroAtual) {
    btnLucroAtual.addEventListener('click', (e) => handleToggleBotoesVendas(e));
  }

  if (btnFaturamento) {
    btnFaturamento.addEventListener('click', (e) => handleToggleBotoesVendas(e));
  }

  if (btnDespesas) {
    btnDespesas.addEventListener('click', (e) => handleToggleBotoesVendas(e));
  }

  if (btnMetaLucro) {
    btnMetaLucro.addEventListener('click', (e) => handleToggleBotoesVendas(e));
  }

  // Event listeners para os botões de múltipla seleção MENSAIS
  if (btnEntradas) {
    btnEntradas.addEventListener('click', () => {
      toggleMetricaVendas('entradas', btnEntradas);
    });
  }

  if (btnSaidas) {
    btnSaidas.addEventListener('click', () => {
      toggleMetricaVendas('saidas', btnSaidas);
    });
  }

  if (btnSaldos) {
    btnSaldos.addEventListener('click', () => {
      toggleMetricaVendas('saldos', btnSaldos);
    });
  }
}

function toggleMetricaVendas(metrica, btnElement) {
  // Verificar se está ativo ou inativo
  const isActive = btnElement.classList.contains('bg-orange-500');
  
  // Determinar as classes de border-radius com base na posição do botão
  let radiusClass = '';
  
  // Botões anuais
  if (btnElement.id === 'btn-vendas-lucro-atual' || btnElement.id === 'btn-vendas-entradas') {
    radiusClass = 'rounded-l-lg';
  } else if (btnElement.id === 'btn-vendas-despesas' || btnElement.id === 'btn-vendas-saldos') {
    radiusClass = 'rounded-r-lg';
  }
  
  if (isActive) {
    // Desativar
    btnElement.className = `py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 ${radiusClass}`;
  } else {
    // Ativar
    btnElement.className = `py-1.5 px-4 text-sm font-medium transition-all bg-orange-500 text-white hover:bg-orange-600 ${radiusClass}`;
  }

  console.log(`Métrica ${metrica} ${isActive ? 'desativada' : 'ativada'}`);
}

function mudarVisualizacaoVendas(visualizacao) {
  const btnAnual = document.getElementById('btn-vendas-anual');
  const btnMensal = document.getElementById('btn-vendas-mensal');
  const metricsAnual = document.getElementById('vendas-metrics-anual');
  const metricsMensal = document.getElementById('vendas-metrics-mensal');

  if (!btnAnual || !btnMensal) return;

  if (visualizacao === 'anual') {
    // Estilo dos botões de período
    btnAnual.className = "py-1.5 px-6 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600";
    btnMensal.className = "py-1.5 px-6 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200";
    
    // Mostrar métricas anuais, esconder mensais
    if (metricsAnual) metricsAnual.style.display = 'flex';
    if (metricsMensal) metricsMensal.style.display = 'none';
  } else {
    // Estilo dos botões de período
    btnAnual.className = "py-1.5 px-6 text-sm font-medium rounded-l-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200";
    btnMensal.className = "py-1.5 px-6 text-sm font-medium rounded-r-lg transition-all bg-orange-500 text-white hover:bg-orange-600";
    
    // Esconder métricas anuais, mostrar mensais
    if (metricsAnual) metricsAnual.style.display = 'none';
    if (metricsMensal) metricsMensal.style.display = 'flex';
  }

  console.log(`Visualização de vendas alterada para: ${visualizacao}`);
}

function initSeletorMes() {
  const btnMesAnterior = document.getElementById('btn-mes-anterior');
  const btnMesProximo = document.getElementById('btn-mes-proximo');

  if (!btnMesAnterior || !btnMesProximo) {
    console.error('Botões de seletor de mês não encontrados');
    return;
  }

  btnMesAnterior.addEventListener('click', () => {
    mudarMes(-1);
  });

  btnMesProximo.addEventListener('click', () => {
    mudarMes(1);
  });

  // Atualizar o display do mês atual
  atualizarMes();
}

function mudarMes(direcao) {
  mesSelecionado += direcao;

  // Verificar se passou de 11 (dezembro)
  if (mesSelecionado > 11) {
    mesSelecionado = 0;
    anoSelecionado++;
  }

  // Verificar se passou de 0 (janeiro)
  if (mesSelecionado < 0) {
    mesSelecionado = 11;
    anoSelecionado--;
  }

  // Resetar flags de indicadores
  indicadorFaturamentoCarregado = false;
  indicadorInvestimentosCarregado = false;
  indicadorPagamentoEquipeCarregado = false;

  atualizarMes();
  carregarInvestimentos(); // Recarregar investimentos do novo mês
  carregarEntradas(); // Recarregar entradas do novo mês
  carregarPagamentoEquipe(); // Recarregar pagamento de equipe do novo mês
  console.log(`Mês alterado para: ${mesSelecionado + 1}/${anoSelecionado}`);
}

function atualizarMes() {
  const mesDivinf = document.getElementById('mes-selecionado');
  if (!mesDivinf) return;

  mesDivinf.textContent = `${meses[mesSelecionado]} ${anoSelecionado}`;
}

function aplicarAutoGrowDescricao(e) {
  const textarea = e.target;
  
  // Reset a altura para calcular o scrollHeight corretamente
  textarea.style.height = 'auto';
  textarea.style.overflowY = 'hidden'; // Ocultar scrollbar por padrão
  
  // Calcular a altura necessária (máximo 300px)
  const novaAltura = Math.min(textarea.scrollHeight, 300);
  textarea.style.height = novaAltura + 'px';
  
  // Se o conteúdo é maior que 300px, ativar o scrollbar
  if (textarea.scrollHeight > 300) {
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.overflowY = 'hidden';
  }
  
  console.log('Auto-grow aplicado. Nova altura:', novaAltura, '| Scrollbar ativo:', textarea.scrollHeight > 300);
}

// ============================================
// FUNÇÕES PARA MODAL DE INVESTIMENTO
// ============================================

function initBotaoAdicionarInvestimento() {
  console.log('=== DEBUGANDO initBotaoAdicionarInvestimento ===');
  
  const btnAdicionar = document.getElementById('btn-adicionar-investimento');
  console.log('✓ Procurando btn-adicionar-investimento...');
  console.log('  Encontrado?', btnAdicionar ? '✅ SIM' : '❌ NÃO');
  
  if (!btnAdicionar) {
    console.error('❌ ERRO CRÍTICO: Botão adicionar investimento não encontrado!');
    console.log('  Tentando novamente em 1s...');
    setTimeout(() => initBotaoAdicionarInvestimento(), 1000);
    return;
  }

  console.log('✓ Botão encontrado:', btnAdicionar);
  
  // Abrir modal
  btnAdicionar.addEventListener('click', (event) => {
    console.log('🔔 EVENTO DE CLIQUE DETECTADO NO BOTÃO');
    console.log('  Event:', event);
    event.preventDefault();
    event.stopPropagation();
    abrirModalInvestimento();
  });

  console.log('✅ Event listener registrado com sucesso!');

  // Registrar os outros botões do modal
  const btnSalvar = document.getElementById('btn-salvar-investimento');
  const btnCancelar = document.getElementById('btn-cancelar-investimento');
  const backdrop = document.getElementById('backdrop-modal-investimento');
  const inputData = document.getElementById('input-data-investimento');
  const inputValor = document.getElementById('input-valor-investimento');

  if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
      console.log('🔔 Cancelar clicado');
      fecharModalInvestimento();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      console.log('🔔 Backdrop clicado');
      fecharModalInvestimento();
    });
  }

  if (btnSalvar) {
    btnSalvar.addEventListener('click', () => {
      console.log('🔔 Salvar clicado');
      salvarInvestimento();
    });
  }

  if (inputData) {
    inputData.addEventListener('input', (e) => aplicarMascaraData(e));
  }

  if (inputValor) {
    inputValor.addEventListener('input', (e) => aplicarMascaraFinanceira(e));
  }

  // Event listener para auto-grow da descrição
  const inputDescricao = document.getElementById('input-descricao-investimento');
  if (inputDescricao) {
    console.log('✓ Textarea encontrado, adicionando event listener de auto-grow');
    inputDescricao.addEventListener('input', (e) => {
      console.log('📝 Textarea input detectado:', e.target.value.length, 'caracteres');
      aplicarAutoGrowDescricao(e);
    });
  } else {
    console.warn('❌ Textarea não encontrado!');
  }
}

function initModalEditarInvestimento() {
  console.log('=== INICIALIZANDO MODAL EDITAR ===');
  
  const btnSalvar = document.getElementById('btn-salvar-editar-investimento');
  const btnCancelar = document.getElementById('btn-cancelar-editar-investimento');
  const backdrop = document.getElementById('backdrop-modal-editar-investimento');
  const inputData = document.getElementById('input-data-editar-investimento');
  const inputValor = document.getElementById('input-valor-editar-investimento');
  const inputDescricao = document.getElementById('input-descricao-editar-investimento');

  if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
      console.log('🔔 Cancelar edição clicado');
      fecharModalEditarInvestimento();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      console.log('🔔 Backdrop edição clicado');
      fecharModalEditarInvestimento();
    });
  }

  if (btnSalvar) {
    btnSalvar.addEventListener('click', () => {
      console.log('🔔 Salvar edição clicado');
      salvarEdicaoInvestimento();
    });
  }

  if (inputData) {
    inputData.addEventListener('input', (e) => aplicarMascaraData(e));
  }

  if (inputValor) {
    inputValor.addEventListener('input', (e) => aplicarMascaraFinanceira(e));
  }

  if (inputDescricao) {
    inputDescricao.addEventListener('input', (e) => aplicarAutoGrowDescricao(e));
  }
  
  console.log('✅ Modal Editar inicializado');
}

function abrirModalInvestimento() {
  console.log('=== ABRINDO MODAL ===');
  
  const modal = document.getElementById('modal-investimento');
  const backdrop = document.getElementById('backdrop-modal-investimento');
  
  console.log('✓ Procurando elementos...', {
    modal: modal ? '✅ Encontrado' : '❌ Não encontrado',
    backdrop: backdrop ? '✅ Encontrado' : '❌ Não encontrado'
  });

  if (!modal || !backdrop) {
    console.error('❌ Modal ou backdrop não encontrado!');
    return;
  }
  
  // Limpar campos
  document.getElementById('input-data-investimento').value = '';
  document.getElementById('input-tipo-investimento').value = 'recorrente_fixa'; // Padrão: Recorrente Fixa
  document.getElementById('input-descricao-investimento').value = '';
  document.getElementById('input-valor-investimento').value = '';
  document.getElementById('erro-validacao-investimento').classList.add('hidden');

  // Resetar altura do textarea
  const textarea = document.getElementById('input-descricao-investimento');
  if (textarea) {
    textarea.style.height = '40px';
    textarea.style.overflowY = 'hidden';
  }

  console.log('✓ Campos limpados');
  
  // Exibir modal e backdrop
  console.log('✓ Alterando display...');
  // Remover classe 'hidden' do Tailwind que tem !important
  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  
  modal.style.display = 'flex';
  backdrop.style.display = 'block';
  
  console.log('✓ Modal aberto!');
  console.log('  modal.style.display:', modal.style.display);
  console.log('  backdrop.style.display:', backdrop.style.display);

  // Focar no primeiro campo
  document.getElementById('input-data-investimento').focus();
}

function fecharModalInvestimento() {
  const modal = document.getElementById('modal-investimento');
  const backdrop = document.getElementById('backdrop-modal-investimento');
  
  // Adicionar classe hidden de volta
  modal.classList.add('hidden');
  backdrop.classList.add('hidden');
  
  modal.style.display = 'none';
  backdrop.style.display = 'none';
}

function aplicarMascaraData(e) {
  let valor = e.target.value.replace(/\D/g, '');
  
  if (valor.length <= 2) {
    e.target.value = valor;
  } else if (valor.length <= 4) {
    e.target.value = valor.slice(0, 2) + '/' + valor.slice(2);
  } else {
    e.target.value = valor.slice(0, 2) + '/' + valor.slice(2, 4) + '/' + valor.slice(4, 8);
  }
}

function aplicarMascaraFinanceira(e) {
  let valor = e.target.value.replace(/\D/g, '');
  
  // Converter para número e aplicar máscara
  let numero = parseInt(valor || '0') / 100;
  let formatado = numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  e.target.value = formatado;
}

function validarCamposInvestimento() {
  const data = document.getElementById('input-data-investimento').value.trim();
  const tipo = document.getElementById('input-tipo-investimento').value.trim();
  const descricao = document.getElementById('input-descricao-investimento').value.trim();
  const valor = document.getElementById('input-valor-investimento').value.trim();
  const erroDiv = document.getElementById('erro-validacao-investimento');
  const erroMsg = document.getElementById('erro-msg');

  if (!data || !tipo || !descricao || !valor || valor === 'R$ 0,00') {
    let msg = 'Preencha todos os campos';
    if (!data) msg = 'A data é obrigatória';
    if (!tipo) msg = 'O tipo é obrigatório';
    if (!descricao) msg = 'A descrição é obrigatória';
    if (!valor || valor === 'R$ 0,00') msg = 'O valor é obrigatório';

    erroMsg.textContent = msg;
    erroDiv.classList.remove('hidden');
    return false;
  }

  erroDiv.classList.add('hidden');
  return true;
}

function salvarInvestimento() {
  if (!validarCamposInvestimento()) return;

  console.log('🔍 === SALVANDO INVESTIMENTO - DEBUG COMPLETO ===');

  const data = document.getElementById('input-data-investimento').value;
  const tipo = document.getElementById('input-tipo-investimento').value;
  const descricao = document.getElementById('input-descricao-investimento').value;
  const valor = document.getElementById('input-valor-investimento').value;

  console.log('📝 Dados brutos do formulário:');
  console.log(`  data: "${data}" (tipo: ${typeof data})`);
  console.log(`  tipo: "${tipo}" (tipo: ${typeof tipo})`);
  console.log(`  descricao: "${descricao}" (tipo: ${typeof descricao})`);
  console.log(`  valor: "${valor}" (tipo: ${typeof valor})`);

  // Extrair data para obter o mês
  const partes = data.split('/');
  console.log(`📅 Partes da data: [${partes.join(', ')}]`);
  
  const [dia, mes, ano] = partes;
  const mesNumerico = parseInt(mes) - 1;
  const nomeMes = meses[mesNumerico];
  const anoNumerico = parseInt(ano);

  console.log(`📅 Data extraída: dia=${dia}, mes=${mes} (num=${mesNumerico}), ano=${ano}`);
  console.log(`📅 Nome do mês: ${nomeMes}`);

  // Limpar valor para salvar no BD (remover R$ e converter)
  console.log(`💰 Convertendo valor: "${valor}"`);
  const valorLimpo = valor.replace(/[^\d,]/g, '').replace(',', '.');
  console.log(`💰 Valor limpo: "${valorLimpo}"`);
  const valorNumerico = parseFloat(valorLimpo);
  console.log(`💰 Valor numérico: ${valorNumerico} (tipo: ${typeof valorNumerico})`);
  
  // Gerar data e hora atual para o ID
  const agora = new Date();
  const diaAtual = String(agora.getDate()).padStart(2, '0');
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
  const anoAtual = agora.getFullYear();
  const hora = String(agora.getHours()).padStart(2, '0');
  const minuto = String(agora.getMinutes()).padStart(2, '0');
  
  // ID SEM caracteres problemáticos: usar underscores em vez de "/" e ":"
  // Formato: ano-mes-valor-ddmmaaa_hhmm
  // Exemplo: 2026-Fevereiro-180-17022026_1102
  const dataHoraEnvio = `${diaAtual}${mesAtual}${anoAtual}_${hora}${minuto}`;
  
  console.log(`⏰ Data/Hora de envio: ${dataHoraEnvio}`);

  const nomeDocumento = `${anoNumerico}-${nomeMes}-${valorNumerico}-${dataHoraEnvio}`;
  
  console.log(`\n📄 ID DO DOCUMENTO A SALVAR:`);
  console.log(`   ${nomeDocumento}`);

  const dadosParaSalvar = {
    data: data,
    tipo: tipo,
    descricao: descricao,
    valor: valorNumerico,
    criado_em: new Date().toISOString()
  };

  console.log(`\n💾 DADOS PARA SALVAR NO FIREBASE:`);
  console.log(JSON.stringify(dadosParaSalvar, null, 2));

  // Salvar no Firebase
  salvarNoFirebase(nomeDocumento, dadosParaSalvar);

  fecharModalInvestimento();
  console.log(`✅ Investimento enviado para salvar: ${nomeDocumento}\n`);
}

function salvarNoFirebase(nomeDocumento, dados) {
  console.log('\n🔐 === SALVANDO NO FIREBASE ===');
  console.log('Verificando disponibilidade do Firebase...');
  console.log('window.BANCO:', window.BANCO ? 'existe' : 'NÃO existe');
  console.log('window.BANCO.db:', window.BANCO?.db ? 'existe' : 'NÃO existe');
  
  if (!window.BANCO || !window.BANCO.db) {
    console.error('❌ Firebase não está disponível. window.BANCO.db não foi encontrado');
    alert('Erro: Firebase não está pronto. Tente novamente em alguns segundos.');
    return;
  }

  console.log(`\n📝 Preparando para salvar:`);
  console.log(`   Coleção: "investimentos"`);
  console.log(`   Documento ID: ${nomeDocumento}`);
  console.log(`   Dados:`);
  console.log(JSON.stringify(dados, null, 2));

  // Usar Firestore - SEM merge: true para força escrita completa
  console.log('\n⏳ Iniciando operação de escrita...');
  
  window.BANCO.db.collection('investimentos')
    .doc(nomeDocumento)
    .set(dados)
    .then(() => {
      console.log(`✅ SUCESSO! Documento salvo com sucesso:`);
      console.log(`   Coleção: investimentos`);
      console.log(`   ID: ${nomeDocumento}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      console.log(`\n🔄 Recarregando investimentos...`);
      carregarInvestimentos();
    })
    .catch((error) => {
      console.error('❌ ERRO CRÍTICO ao salvar no Firebase:');
      console.error('   Código:', error.code);
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Objeto completo:', error);
      alert(`Erro ao salvar: ${error.code} - ${error.message}`);
    });
}

function carregarInvestimentos() {
  console.log('\n📂 === CARREGANDO INVESTIMENTOS ===');
  console.log('Mês selecionado:', mesSelecionado + 1, '/', anoSelecionado);
  console.log('Mês nome:', meses[mesSelecionado]);
  console.log('window.BANCO disponível?', window.BANCO ? 'SIM' : 'NÃO');
  
  if (!window.BANCO || !window.BANCO.db) {
    console.warn('⚠️ Firebase ainda não está disponível. Tentando novamente em 1s...');
    setTimeout(() => carregarInvestimentos(), 1000);
    return;
  }

  window.BANCO.db.collection('investimentos')
    .get()
    .then((snapshot) => {
      console.log(`📊 Total de documentos na coleção: ${snapshot.size}`);
      
      const tbody = document.getElementById('tabelaSaidasInvestimentosBody');
      if (!tbody) {
        console.error('❌ tbody não encontrado');
        return;
      }

      if (snapshot.empty) {
        console.log('⚠️ Coleção vazia');
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 text-sm">Nenhum registro encontrado</td></tr>`;
        return;
      }

      let html = '';
      let processados = 0;
      let filtrados = 0;

      snapshot.forEach((doc) => {
        processados++;
        const dados = doc.data();
        
        console.log(`\n📄 Documento ${processados}: ${doc.id}`);
        console.log(`   Campos:`, Object.keys(dados).join(', '));
        console.log(`   data: ${dados.data}, tipo: ${dados.tipo}, valor: ${dados.valor}, descricao: ${dados.descricao}`);
        
        // Filtrar por mês selecionado
        if (dados.data) {
          // Formato esperado: DD/MM/YYYY
          const partes = dados.data.split('/');
          if (partes.length === 3) {
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1; // JavaScript months são 0-11
            const ano = parseInt(partes[2]);
            
            console.log(`   Comparação: mes=${mes} vs mesSelecionado=${mesSelecionado}, ano=${ano} vs anoSelecionado=${anoSelecionado}`);
            
            // Verificar se o investimento é do mês selecionado
            if (mes === mesSelecionado && ano === anoSelecionado) {
              filtrados++;
              console.log(`   ✅ INCLUÍDO NA TABELA`);
              html += `
                <tr class="border-b border-gray-200 hover:bg-gray-50" data-doc-id="${doc.id}" data-data="${dados.data}" data-tipo="${dados.tipo || 'fixo'}" data-descricao="${dados.descricao}" data-valor="${dados.valor}">
                  <td class="px-4 py-3 text-sm text-gray-800">${dados.data || '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-800" style="width: 54%; word-break: break-word; overflow-wrap: break-word;">${dados.descricao || '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-800">${dados.tipo ? (dados.tipo.charAt(0).toUpperCase() + dados.tipo.slice(1)) : '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(dados.valor || 0)}</td>
                </tr>
              `;
            } else {
              console.log(`   ❌ Fora do mês selecionado`);
            }
          }
        }
      });

      console.log(`\n📊 Resumo: ${processados} documentos processados, ${filtrados} filtrados para exibição`);

      if (html === '') {
        console.log('⚠️ Nenhum investimento encontrado para este mês');
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 text-sm">Nenhum registro encontrado para este mês</td></tr>`;
        totalInvestimentosMesAtual = 0;
      } else {
        tbody.innerHTML = html;
        // Adicionar event listener para clique direito nas linhas
        const linhas = tbody.querySelectorAll('tr[data-doc-id]');
        linhas.forEach(linha => {
          linha.addEventListener('contextmenu', (e) => exibirMenuContexto(e, 'investimento'));
        });
      }
      
      // Calcular total de investimentos do mês
      totalInvestimentosMesAtual = 0;
      snapshot.forEach((doc) => {
        const dados = doc.data();
        if (dados.data) {
          const partes = dados.data.split('/');
          if (partes.length === 3) {
            const mes = parseInt(partes[1]) - 1;
            const ano = parseInt(partes[2]);
            
            if (mes === mesSelecionado && ano === anoSelecionado) {
              if (dados.valor) {
                totalInvestimentosMesAtual += dados.valor;
              }
            }
          }
        }
      });
      
      console.log(`💰 Total de Investimentos do mês: R$ ${totalInvestimentosMesAtual.toFixed(2)}`);
      atualizarIndicadorDespesas();
    })
    .catch((error) => {
      console.error('❌ Erro ao carregar investimentos:', error);
    });
}

function carregarEntradas() {
  console.log('=== CARREGANDO ENTRADAS ===');
  console.log('Mês selecionado:', mesSelecionado + 1, '/', anoSelecionado);
  console.log('Mês nome:', meses[mesSelecionado]);
  
  if (!window.BANCO || !window.BANCO.db) {
    console.warn('⚠️ Firebase ainda não está disponível. Tentando novamente em 1s...');
    console.log('window.BANCO:', window.BANCO ? 'existe' : 'NÃO existe');
    setTimeout(() => carregarEntradas(), 1000);
    return;
  }

  console.log('✅ Firebase disponível');
  console.log('Buscando coleção "BancoDeAulas"...');

  window.BANCO.db.collection('BancoDeAulas')
    .get()
    .then((snapshot) => {
      console.log(`📊 Total de documentos encontrados: ${snapshot.size}`);

      const tbody = document.getElementById('tabelaControleCaixaBody');
      if (!tbody) {
        console.error('❌ tbody tabelaControleCaixaBody não encontrado no DOM');
        return;
      }

      console.log('✅ tbody encontrado no DOM');

      let entradasDoMes = [];

      snapshot.forEach((doc) => {
        const dados = doc.data();
        console.log(`📄 Documento: ${doc.id}`);
        console.log(`  Campos:`, Object.keys(dados).join(', '));

        let entraNoMes = false;

        // Filtrar pelo mês/ano da data da primeira parcela (formato DD/MM/YYYY)
        if (dados.dataPrimeiraParcela) {
          console.log(`  ✓ dataPrimeiraParcela = ${dados.dataPrimeiraParcela}`);
          const partes = dados.dataPrimeiraParcela.split('/');
          if (partes.length === 3) {
            const mes = parseInt(partes[1]) - 1; // 0-indexed
            const ano = parseInt(partes[2]);
            console.log(`    Comparando: mes=${mes} vs ${mesSelecionado}, ano=${ano} vs ${anoSelecionado}`);
            if (mes === mesSelecionado && ano === anoSelecionado) {
              console.log(`    ✅ DENTRO DO MÊS!`);
              entraNoMes = true;
            } else {
              console.log(`    ❌ Fora do mês`);
            }
          } else {
            console.log(`    ❌ Formato inválido de dataPrimeiraParcela`);
          }
        } else {
          console.log(`  ⚠️ Sem dataPrimeiraParcela — documento ignorado`);
        }

        if (entraNoMes) {
          console.log(`    ✅ ADICIONADO À LISTA`);
          // Preservar o doc.id como codigoContratacao para abrir o modal ao clicar
          entradasDoMes.push({ ...dados, _docId: doc.id });
        }
      });

      console.log(`\n📈 Total de entradas do mês: ${entradasDoMes.length}`);

      if (entradasDoMes.length === 0) {
        console.warn('⚠️ Nenhuma entrada encontrada para este mês');
        tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500 text-sm">Nenhum registro encontrado para este mês</td></tr>`;
        // Atualizar indicadores mesmo com array vazio
        atualizarIndicadores(entradasDoMes);
        return;
      }

      let html = '';
      entradasDoMes.forEach((dados, index) => {
        console.log(`Renderizando entrada ${index + 1}:`, dados.nomeCliente);

        const codigo = dados.codigoContratacao || dados._docId || '';
        const dataFormatada = dados.dataPrimeiraParcela || '-';

        html += `
          <tr class="border-b border-gray-200 hover:bg-orange-50 cursor-pointer transition-colors"
              data-codigo="${codigo}"
              title="Clique para ver detalhes da contratação">
            <td class="px-4 py-3 text-sm text-gray-800">${dataFormatada}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${dados.nomeCliente || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${dados.SomatorioDuracaoAulas || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${dados.metodoPagamento || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${dados.statusPagamento || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-800">R$ ${dados.ValorPacote?.toFixed(2) || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-800">R$ ${dados.lucroMaster?.toFixed(2) || '-'}</td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
      console.log(`✅ Tabela atualizada com ${entradasDoMes.length} entradas`);

      // Clique na linha abre o modal de detalhes da contratação
      tbody.querySelectorAll('tr[data-codigo]').forEach(tr => {
        tr.addEventListener('click', () => {
          const codigo = tr.dataset.codigo;
          if (!codigo) return;
          if (typeof abrirDetalhesContratacaoPagamento === 'function') {
            abrirDetalhesContratacaoPagamento(codigo);
          } else {
            console.warn('abrirDetalhesContratacaoPagamento não está disponível');
          }
        });
      });

      // Atualizar indicadores
      atualizarIndicadores(entradasDoMes);
    })
    .catch((error) => {
      console.error('❌ ERRO ao carregar entradas:', error);
      console.error('Stack:', error.stack);
    });
}

function obterMesNumero(mesPorExtenso) {
  const mesesPt = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };
  return mesesPt[mesPorExtenso.toLowerCase()] || '00';
}

function atualizarIndicadores(entradasDoMes) {
  console.log('=== ATUALIZANDO INDICADORES (FATURAMENTO) ===');
  
  // Calcular Faturamento (somatório de ValorPacote = "Valor Contratação")
  let faturamento = 0;
  let lucroMaster = 0;
  entradasDoMes.forEach((entrada) => {
    if (entrada.ValorPacote) faturamento += entrada.ValorPacote;
    if (entrada.lucroMaster) lucroMaster += entrada.lucroMaster;
  });

  // Armazenar globalmente
  faturamentoValue = faturamento;
  lucroMasterValue = lucroMaster;
  
  console.log(`📊 Faturamento calculado: R$ ${faturamento.toFixed(2)}`);
  
  // Marcar como carregado
  indicadorFaturamentoCarregado = true;
  
  // Verificar se todos os indicadores estão prontos
  verificarAndExibirIndicadores();
}

function formatarMoedaBrasileira(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// ============================================
// FUNÇÕES PARA MENU DE CONTEXTO
// ============================================

function exibirMenuContexto(event, tipo) {
  event.preventDefault();
  
  const linha = event.currentTarget;
  const docId = linha.getAttribute('data-doc-id');
  const data = linha.getAttribute('data-data');
  const tipoInvest = linha.getAttribute('data-tipo');
  const descricao = linha.getAttribute('data-descricao');
  const valor = linha.getAttribute('data-valor');
  
  console.log('🔔 Menu de contexto acionado:', { docId, data, tipoInvest, descricao, valor });
  
  // Remover menu anterior se existir
  const menuAnterior = document.getElementById('menu-contexto-investimento');
  if (menuAnterior) menuAnterior.remove();
  
  // Criar menu suspenso
  const menu = document.createElement('div');
  menu.id = 'menu-contexto-investimento';
  menu.className = 'fixed bg-white border border-gray-300 rounded-lg shadow-lg z-50';
  menu.style.cssText = `
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    min-width: 150px;
  `;
  
  menu.innerHTML = `
    <button class="w-full text-left px-4 py-2 hover:bg-orange-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-700 font-medium" onclick="editarInvestimento('${docId}', '${data}', '${tipoInvest}', '${descricao}', '${valor}')">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
      Editar
    </button>
    <button class="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 font-medium" onclick="excluirInvestimento('${docId}')">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      Excluir
    </button>
  `;
  
  document.body.appendChild(menu);
  
  // Fechar menu ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', fecharMenuContexto);
  }, 0);
}

function fecharMenuContexto() {
  const menu = document.getElementById('menu-contexto-investimento');
  if (menu) {
    menu.remove();
    document.removeEventListener('click', fecharMenuContexto);
  }
}

function editarInvestimento(docId, data, tipoInvest, descricao, valor) {
  console.log('✏️ Editando investimento:', docId);
  
  // Pré-preencher os campos
  document.getElementById('input-data-editar-investimento').value = data;
  document.getElementById('input-tipo-editar-investimento').value = tipoInvest || 'recorrente_fixa';
  document.getElementById('input-descricao-editar-investimento').value = descricao;
  document.getElementById('input-valor-editar-investimento').value = formatarMoedaBrasileira(parseFloat(valor));
  
  // Resetar textarea
  const textarea = document.getElementById('input-descricao-editar-investimento');
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
  }
  
  // Limpar mensagem de erro
  document.getElementById('erro-validacao-editar-investimento').classList.add('hidden');
  
  // Armazenar docId para uso na função salvar
  window.docIdEmEdicao = docId;
  
  // Abrir modal
  abrirModalEditarInvestimento();
  
  // Fechar menu
  fecharMenuContexto();
}

function abrirModalEditarInvestimento() {
  const modal = document.getElementById('modal-editar-investimento');
  const backdrop = document.getElementById('backdrop-modal-editar-investimento');
  
  if (!modal || !backdrop) {
    console.error('❌ Modal ou backdrop de edição não encontrado!');
    return;
  }
  
  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  
  modal.style.display = 'flex';
  backdrop.style.display = 'block';
  
  document.getElementById('input-data-editar-investimento').focus();
}

function fecharModalEditarInvestimento() {
  const modal = document.getElementById('modal-editar-investimento');
  const backdrop = document.getElementById('backdrop-modal-editar-investimento');
  
  modal.classList.add('hidden');
  backdrop.classList.add('hidden');
  
  modal.style.display = 'none';
  backdrop.style.display = 'none';
}

function excluirInvestimento(docId) {
  console.log('🗑️ Excluindo investimento:', docId);
  
  if (!confirm('Tem certeza que deseja excluir este investimento?')) {
    console.log('Exclusão cancelada pelo usuário');
    return;
  }
  
  if (!window.BANCO || !window.BANCO.db) {
    alert('Erro: Firebase não está disponível');
    return;
  }
  
  window.BANCO.db.collection('investimentos')
    .doc(docId)
    .delete()
    .then(() => {
      console.log('✅ Investimento excluído com sucesso');
      carregarInvestimentos(); // Recarregar tabela
    })
    .catch((error) => {
      console.error('❌ Erro ao excluir:', error);
      alert('Erro ao excluir investimento. Tente novamente.');
    });
  
  fecharMenuContexto();
}

function salvarEdicaoInvestimento() {
  console.log('💾 Salvando edição do investimento');
  
  const data = document.getElementById('input-data-editar-investimento').value.trim();
  const tipo = document.getElementById('input-tipo-editar-investimento').value.trim();
  const descricao = document.getElementById('input-descricao-editar-investimento').value.trim();
  const valor = document.getElementById('input-valor-editar-investimento').value.trim();
  const erroDiv = document.getElementById('erro-validacao-editar-investimento');
  const erroMsg = document.getElementById('erro-msg-editar');
  
  // Validação
  if (!data || !tipo || !descricao || !valor || valor === 'R$ 0,00') {
    let msg = 'Preencha todos os campos';
    if (!data) msg = 'A data é obrigatória';
    if (!tipo) msg = 'O tipo é obrigatório';
    if (!descricao) msg = 'A descrição é obrigatória';
    if (!valor || valor === 'R$ 0,00') msg = 'O valor é obrigatório';
    
    erroMsg.textContent = msg;
    erroDiv.classList.remove('hidden');
    return;
  }
  
  erroDiv.classList.add('hidden');
  
  if (!window.BANCO || !window.BANCO.db) {
    alert('Erro: Firebase não está disponível');
    return;
  }
  
  // Limpar valor
  const valorNumerico = parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.'));
  
  // Atualizar documento
  window.BANCO.db.collection('investimentos')
    .doc(window.docIdEmEdicao)
    .update({
      data: data,
      tipo: tipo,
      descricao: descricao,
      valor: valorNumerico
    })
    .then(() => {
      console.log('✅ Investimento atualizado com sucesso');
      fecharModalEditarInvestimento();
      carregarInvestimentos(); // Recarregar tabela
    })
    .catch((error) => {
      console.error('❌ Erro ao atualizar:', error);
      alert('Erro ao atualizar investimento. Tente novamente.');
    });
}

async function carregarPagamentoEquipe() {
  console.log('=== CARREGANDO PAGAMENTO EQUIPE ===');
  console.log('Mês selecionado:', mesSelecionado + 1, '/', anoSelecionado);

  if (!window.BANCO || !window.BANCO.db) {
    console.warn('⚠️ Firebase ainda não está disponível. Tentando novamente em 1s...');
    setTimeout(() => carregarPagamentoEquipe(), 1000);
    return;
  }

  const tbody = document.getElementById('tabelaPagamentoEquipeBody');
  if (!tbody) {
    console.error('❌ tbody tabelaPagamentoEquipeBody não encontrado no DOM');
    return;
  }

  // mes 1-indexed — igual ao campo pag-mes da Área de Pagamento
  const mesComparar = mesSelecionado + 1;
  const anoComparar = anoSelecionado;
  const statusValidos = ['Concluída', 'Reposição'];
  const db = window.BANCO.db;

  try {
    // ── Buscar as duas coleções em paralelo (igual a renderizarGraficoPagamentoGrupo) ──
    const [snapshotAulas, snapshotInfo] = await Promise.all([
      db.collection('BancoDeAulas-Lista').get(),
      db.collection('informacoesPagamento').where('ano', '==', anoComparar).get()
    ]);

    // ── 1. Construir mapa de informações adicionais por professor ────────
    // Estrutura: { [idProfessor]: { entradas: number, saidas: number } }
    const infoAdicionais = {};
    snapshotInfo.forEach(doc => {
      const d = doc.data();
      const id = d.idProfessor || '';
      if (!id) return;
      const match = (d.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return;
      if (parseInt(match[2], 10) !== mesComparar || parseInt(match[3], 10) !== anoComparar) return;
      if (!infoAdicionais[id]) infoAdicionais[id] = { entradas: 0, saidas: 0 };
      if (d.tipo === 'entrada') infoAdicionais[id].entradas += (d.valor || 0);
      else                      infoAdicionais[id].saidas   += (d.valor || 0);
    });
    console.log(`📋 Professores com info adicional: ${Object.keys(infoAdicionais).length}`);

    // ── 2. Agrupar aulas do mês por idProfessor ───────────────────────────
    const agrupado = {}; // { [idProfessor]: { professor: string, valorAulas: number } }
    snapshotAulas.forEach(doc => {
      const d = doc.data();
      if (!statusValidos.includes(d.StatusAula)) return;
      const match = (d.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return;
      if (parseInt(match[2], 10) !== mesComparar || parseInt(match[3], 10) !== anoComparar) return;

      const chave = (d.idProfessor || d.professor || 'N/A').trim();
      if (!agrupado[chave]) {
        agrupado[chave] = { professor: d.professor || d.idProfessor || '-', valorAulas: 0 };
      }
      agrupado[chave].valorAulas += parseFloat(d.ValorAula) || 0;
    });

    // Garantir que professores com apenas info adicional também entrem
    Object.keys(infoAdicionais).forEach(cpf => {
      if (!agrupado[cpf]) agrupado[cpf] = { professor: cpf, valorAulas: 0 };
    });

    // ── 3. Calcular total = valorAulas + entradas − saídas ─────────────────
    // Mesma fórmula de renderizarGraficoPagamentoGrupo
    const registros = Object.entries(agrupado).map(([cpf, r]) => {
      const info = infoAdicionais[cpf] || { entradas: 0, saidas: 0 };
      const total = r.valorAulas + info.entradas - info.saidas;
      return { professor: r.professor, total };
    })
    .filter(r => r.total > 0)
    .sort((a, b) => (a.professor || '').localeCompare(b.professor || '', 'pt-BR'));

    console.log(`📊 Professores no mês: ${registros.length}`);

    if (registros.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="px-4 py-8 text-center text-gray-500 text-sm">Nenhum registro encontrado para este mês</td></tr>`;
      totalPagamentoEquipeMesAtual = 0;
      atualizarIndicadorDespesas();
      return;
    }

    let html = '';
    totalPagamentoEquipeMesAtual = 0;
    registros.forEach(r => {
      totalPagamentoEquipeMesAtual += r.total;
      html += `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
          <td class="px-4 py-3 text-sm text-gray-800">${r.professor}</td>
          <td class="px-4 py-3 text-sm text-gray-800 font-semibold text-orange-600">${formatarMoedaBrasileira(r.total)}</td>
        </tr>`;
    });

    tbody.innerHTML = html;

    const totalElement = document.getElementById('total-pagamento-equipe');
    if (totalElement) {
      totalElement.textContent = `Total: ${formatarMoedaBrasileira(totalPagamentoEquipeMesAtual)}`;
    }

    console.log(`💰 Total Pagamento Equipe: R$ ${totalPagamentoEquipeMesAtual.toFixed(2)}`);
    atualizarIndicadorDespesas();

  } catch (error) {
    console.error('❌ ERRO ao carregar pagamento de equipe:', error);
  }
}

function atualizarIndicadorDespesas() {
  console.log('=== ATUALIZANDO INDICADOR DE DESPESAS ===');
  
  // Somar investimentos + pagamento de equipe
  const totalDespesas = totalInvestimentosMesAtual + totalPagamentoEquipeMesAtual;
  
  console.log(`  Total Investimentos: R$ ${totalInvestimentosMesAtual.toFixed(2)}`);
  console.log(`  Total Pagamento Equipe: R$ ${totalPagamentoEquipeMesAtual.toFixed(2)}`);
  console.log(`  Total Despesas: R$ ${totalDespesas.toFixed(2)}`);
  
  // Marcar como carregado
  indicadorInvestimentosCarregado = true;
  indicadorPagamentoEquipeCarregado = true;
  
  // Verificar se todos os indicadores estão prontos
  verificarAndExibirIndicadores();
}

function verificarAndExibirIndicadores() {
  console.log('🔄 Verificando se todos os indicadores estão prontos...');
  console.log(`  Faturamento: ${indicadorFaturamentoCarregado ? '✅' : '⏳'}`);
  console.log(`  Investimentos: ${indicadorInvestimentosCarregado ? '✅' : '⏳'}`);
  console.log(`  Pagamento Equipe: ${indicadorPagamentoEquipeCarregado ? '✅' : '⏳'}`);
  
  // Se todos estão prontos, exibir os 3 indicadores
  if (indicadorFaturamentoCarregado && indicadorInvestimentosCarregado && indicadorPagamentoEquipeCarregado) {
    console.log('\n✨ TODOS OS INDICADORES PRONTOS! Atualizando tela...\n');
    
    // Calcular total de despesas
    const totalDespesas = totalInvestimentosMesAtual + totalPagamentoEquipeMesAtual;

    // Lucro Atual = somatório da coluna "Lucro Atual" (lucroMaster) da tabelaControleCaixa
    const lucroBruto = lucroMasterValue;

    console.log('📊 RESUMO FINAL:');
    console.log(`  Faturamento: R$ ${faturamentoValue.toFixed(2)}`);
    console.log(`  Despesas: R$ ${totalDespesas.toFixed(2)}`);
    console.log(`  Lucro Atual (lucroMaster): R$ ${lucroBruto.toFixed(2)}`);
    
    // Atualizar os 3 indicadores simultaneamente
    const indicadorFaturamento = document.getElementById('indicador-faturamento');
    const indicadorDespesas = document.getElementById('indicador-despesas');
    const indicadorLucroBruto = document.getElementById('indicador-lucro-bruto');
    
    if (indicadorFaturamento) {
      indicadorFaturamento.textContent = formatarMoedaBrasileira(faturamentoValue);
      console.log('✅ Indicador de Faturamento atualizado');
    }
    
    if (indicadorDespesas) {
      indicadorDespesas.textContent = formatarMoedaBrasileira(totalDespesas);
      console.log('✅ Indicador de Despesas atualizado');
    }
    
    if (indicadorLucroBruto) {
      indicadorLucroBruto.textContent = formatarMoedaBrasileira(lucroBruto);
      
      // Mudar cor baseado no sinal do lucro (verde se positivo, vermelho se negativo)
      if (lucroBruto < 0) {
        indicadorLucroBruto.className = 'text-2xl font-bold text-red-500';
      } else {
        indicadorLucroBruto.className = 'text-2xl font-bold text-green-500';
      }
      
      console.log('✅ Indicador de Lucro Bruto atualizado');
    } else {
      console.warn('⚠️ Elemento indicador-lucro-bruto não encontrado');
    }
    
    console.log('\n✨ Indicadores exibidos!\n');
    
    // Atualizar tabela de indicadores estratégicos
    atualizarIndicadoresEstrategicos();
  }
}

function atualizarIndicadoresEstrategicos() {
  console.log('=== ATUALIZANDO INDICADORES ESTRATÉGICOS ===');
  
  try {
    // 1. Extrair Faturamento do elemento #indicador-faturamento
    const elementoFaturamento = document.getElementById('indicador-faturamento');
    let faturamento = 0;
    if (elementoFaturamento) {
      const textoFaturamento = elementoFaturamento.textContent.replace(/[^0-9,]/g, '').replace(',', '.');
      faturamento = parseFloat(textoFaturamento) || 0;
    }
    console.log(`   Faturamento: R$ ${faturamento.toFixed(2)}`);
    
    // 2. Extrair Repasse para Equipe do elemento #total-pagamento-equipe
    const elementoRepasse = document.getElementById('total-pagamento-equipe');
    let repasseEquipe = 0;
    if (elementoRepasse) {
      const textoRepasse = elementoRepasse.textContent.replace(/[^0-9,]/g, '').replace(',', '.');
      repasseEquipe = parseFloat(textoRepasse) || 0;
    }
    console.log(`   Repasse para Equipe: R$ ${repasseEquipe.toFixed(2)}`);
    
    // 3. Calcular Custos Fixos, Variáveis e Extras da tabela de investimentos
    let custosFixos = 0;
    let custosVariaveis = 0;
    let custosExtras = 0;
    
    const tabelaSaidas = document.getElementById('tabelaSaidasInvestimentos');
    if (tabelaSaidas) {
      const linhas = tabelaSaidas.querySelectorAll('tbody tr[data-tipo]');
      
      linhas.forEach((linha) => {
        const tipoDespesa = linha.getAttribute('data-tipo') || '';
        const valor = parseFloat(linha.getAttribute('data-valor')) || 0;
        
        // Normalizar tipo de despesa (remover maiúsculas e espaços)
        const tipoNormalizado = tipoDespesa.toLowerCase().trim();
        
        console.log(`   Processando: Tipo="${tipoDespesa}" (normalizado="${tipoNormalizado}"), Valor=R$ ${valor.toFixed(2)}`);
        
        // Verificar tipo e somar
        if (tipoNormalizado === 'recorrente_fixa' || tipoNormalizado === 'recorrente fixa') {
          custosFixos += valor;
          console.log(`     ✅ Adicionado a Custos Fixos`);
        } else if (tipoNormalizado === 'recorrente variável' || tipoNormalizado === 'recorrente_variável') {
          custosVariaveis += valor;
          console.log(`     ✅ Adicionado a Custos Variáveis`);
        } else if (tipoNormalizado === 'extra') {
          custosExtras += valor;
          console.log(`     ✅ Adicionado a Custos Extras`);
        }
      });
    }
    
    console.log(`   Custos Fixos: R$ ${custosFixos.toFixed(2)}`);
    console.log(`   Custos Variáveis: R$ ${custosVariaveis.toFixed(2)}`);
    console.log(`   Custos Extras: R$ ${custosExtras.toFixed(2)}`);
    
    // 4. Calcular Despesas Totais (Repasse Equipe + Custos Fixos + Custos Variáveis + Custos Extras)
    const despesasTotais = repasseEquipe + custosFixos + custosVariaveis + custosExtras;
    console.log(`   Despesas Totais: R$ ${despesasTotais.toFixed(2)}`);
    
    // 5. Calcular Lucro Bruto (Faturamento - Repasse Equipe)
    const lucroBruto = faturamento - repasseEquipe;
    console.log(`   Lucro Bruto: R$ ${lucroBruto.toFixed(2)}`);
    
    // 6. Calcular Lucro Líquido (Faturamento - Despesas Totais)
    const lucroLiquido = faturamento - despesasTotais;
    console.log(`   Lucro Líquido: R$ ${lucroLiquido.toFixed(2)}`);
    
    // 7. Calcular Reserva de Emergência (10% do Lucro Líquido)
    const reservaEmergencia = lucroLiquido * 0.10;
    console.log(`   Reserva de Emergência: R$ ${reservaEmergencia.toFixed(2)}`);
    
    // 8. Calcular Meta Alcançada (Lucro Líquido - 4000)
    const metaAlcancada = lucroLiquido - 4000;
    console.log(`   Meta Alcançada: R$ ${metaAlcancada.toFixed(2)}`);
    
    // Atualizar tabela de indicadores estratégicos
    const tbody = document.getElementById('tabelaIndicadoresEstrategicosBody');
    if (tbody) {
      const html = `
        <tr class="border-b border-gray-200">
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(faturamento)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(repasseEquipe)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(custosFixos)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(custosVariaveis)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(custosExtras)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(despesasTotais)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(lucroBruto)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(lucroLiquido)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(reservaEmergencia)}</td>
          <td class="px-4 py-3 text-sm text-gray-800">${formatarMoedaBrasileira(metaAlcancada)}</td>
        </tr>
      `;
      tbody.innerHTML = html;
      console.log('✅ Tabela de Indicadores Estratégicos atualizada!');
    } else {
      console.error('❌ tbody de indicadores estratégicos não encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar indicadores estratégicos:', error);
  }
}

function inicializarBotaoSalvarIndicadores() {
  console.log('=== INICIALIZANDO BOTÃO SALVAR INDICADORES ===');
  
  const btnSalvar = document.getElementById('btn-salvar-indicadores');
  if (!btnSalvar) {
    console.error('❌ Botão de salvar indicadores não encontrado');
    return;
  }
  
  btnSalvar.addEventListener('click', salvarIndicadoresEstrategicos);
  console.log('✅ Botão de salvar indicadores inicializado');
}

function salvarIndicadoresEstrategicos() {
  console.log('=== SALVANDO INDICADORES ESTRATÉGICOS ===');
  
  try {
    if (!window.BANCO || !window.BANCO.db) {
      console.error('❌ Firebase não está disponível');
      if (typeof showToast === 'function') {
        showToast('Erro: Banco de dados não disponível', 'error');
      }
      return;
    }
    
    // Extrair nomes das colunas do cabeçalho
    const thead = document.querySelector('#tabelaIndicadoresEstrategicos thead');
    const thElements = thead?.querySelectorAll('th');
    let nomesColunasRaw = [];
    
    thElements?.forEach((th) => {
      nomesColunasRaw.push(th.textContent.trim());
    });
    
    console.log(`\n📊 Nomes das colunas extraídos do cabeçalho:`, nomesColunasRaw);
    
    // Normalizar nomes para snake_case
    const normalizarNome = (nome) => {
      return nome
        .toLowerCase()
        .replace(/\s+/g, '_')  // Espaços em _
        .normalize('NFD')       // Remove acentos
        .replace(/[\u0300-\u036f]/g, '');
    };
    
    const nomesColunasNormalizados = nomesColunasRaw.map(normalizarNome);
    console.log(`   Nomes normalizados:`, nomesColunasNormalizados);
    
    // Extrair valores da tabela
    const tbody = document.getElementById('tabelaIndicadoresEstrategicosBody');
    const linha = tbody?.querySelector('tr');
    
    if (!linha || !linha.querySelector('td')) {
      if (typeof showToast === 'function') {
        showToast('Erro: Nenhum dado na tabela para salvar', 'error');
      }
      return;
    }
    
    // Extrair valores das células
    const dados = {};
    const celulas = linha.querySelectorAll('td');
    
    celulas.forEach((td, index) => {
      const textoValor = td.textContent.trim();
      // Extrair número removendo "R$", espaços, e pontos (separador de milhares)
      // Converter vírgula em ponto para parseFloat
      const valorCleaned = textoValor
        .replace(/R\$\s?/g, '')  // Remove R$
        .replace(/\./g, '')      // Remove pontos (milhares)
        .replace(',', '.');      // Converte vírgula em ponto
      
      const valor = parseFloat(valorCleaned) || 0;
      const nomeColuna = nomesColunasNormalizados[index];
      
      dados[nomeColuna] = valor;
      console.log(`   ${nomeColuna}: R$ ${valor.toFixed(2)}`);
    });
    
    // Gerar data de hoje (dd/mm/yy)
    const dataHoje = new Date();
    const dia = String(dataHoje.getDate()).padStart(2, '0');
    const mesAtual = String(dataHoje.getMonth() + 1).padStart(2, '0');
    const anoAtual = String(dataHoje.getFullYear() % 100).padStart(2, '0');
    const dataAtual = `${dia}/${mesAtual}/${anoAtual}`;
    
    // Gerar nome do mês selecionado
    const nomesMeses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const mesSelecionadoNome = nomesMeses[mesSelecionado];
    const anoSelecionado4Digitos = String(anoSelecionado).slice(-4);
    
    console.log(`\n📋 DEBUG - Construção do ID:`);
    console.log(`   mesSelecionado: ${mesSelecionado} (tipo: ${typeof mesSelecionado})`);
    console.log(`   mesSelecionadoNome: "${mesSelecionadoNome}" (tipo: ${typeof mesSelecionadoNome})`);
    console.log(`   anoSelecionado: ${anoSelecionado} (tipo: ${typeof anoSelecionado})`);
    console.log(`   anoSelecionado4Digitos: "${anoSelecionado4Digitos}"`);
    console.log(`   dataAtual: "${dataAtual}"`);
    
    // ID principal usa mes_ano como KEY (permanecerá igual mesmo salvando em dias diferentes)
    // Assim garante que não cria duplicatas por mês/ano
    const idBusca = `${anoSelecionado4Digitos}_${mesSelecionadoNome}`;
    const idDocumento = idBusca;  // Usar o mesmo ID para garantir substituição
    
    // Adicionar campo mes_ano para queries
    dados.mes_ano = idBusca;
    dados.data_salvamento = new Date();
    dados.mes_numero = mesSelecionado + 1;
    dados.ano = anoSelecionado;
    
    console.log(`\n📋 DADOS A SALVAR:`);
    console.log(`   ID Documento: ${idDocumento}`);
    console.log(`   Data Atual: ${dataAtual}`);
    console.log(`   Mês Selecionado: ${mesSelecionadoNome} (${anoSelecionado4Digitos})`);
    console.log(`   Dados:`, dados);
    
    // Salvar/Substituir documento (se existir, será sobrescrito automaticamente)
    window.BANCO.db.collection('relatorioFinanceiro')
      .doc(idDocumento)
      .set(dados)
      .then(() => {
        console.log(`\n✅ INDICADORES SALVOS COM SUCESSO!`);
        console.log(`   ID: ${idDocumento}`);
        console.log(`   Data salvamento: ${new Date().toLocaleString('pt-BR')}`);
        
        if (typeof showToast === 'function') {
          showToast(`✅ Dados salvos com sucesso! (${idDocumento})`, 'success');
        } else {
          alert(`Dados salvos com sucesso!\n\nID: ${idDocumento}`);
        }
      })
      .catch((error) => {
        console.error('❌ Erro ao salvar documento:', error);
        console.error('   Código:', error.code);
        console.error('   Mensagem:', error.message);
        if (typeof showToast === 'function') {
          showToast('Erro ao salvar dados: ' + error.message, 'error');
        }
      });
      
  } catch (error) {
    console.error('❌ Erro geral ao salvar indicadores:', error);
    if (typeof showToast === 'function') {
      showToast('Erro ao salvar dados: ' + error.message, 'error');
    }
  }
}

// ===== GRÁFICO DE VENDAS ANUAL =====

// Variáveis globais para o gráfico de vendas
let chartVendas = null;
let metricasAtivasVendas = {}; // { 'lucro-atual': true, 'meta-lucro': false, 'despesas': false }

// Inicializar o gráfico de vendas
function initGraficoVendas() {
  // Carregar dados do Firebase
  carregarDadosVendas();
  
  console.log('✅ Gráfico de vendas inicializado');
}

// Handler para toggle dos botões com validação
function handleToggleBotoesVendas(event) {
  const btnElement = event.target.closest('button');
  if (!btnElement) return;

  const btnId = btnElement.id;
  let metrica = '';

  if (btnId === 'btn-vendas-lucro-atual') metrica = 'lucro-atual';
  if (btnId === 'btn-vendas-faturamento') metrica = 'faturamento';
  if (btnId === 'btn-vendas-despesas') metrica = 'despesas';
  if (btnId === 'btn-vendas-meta-lucro') metrica = 'meta-lucro';

  if (!metrica) return;

  const isCurrentlyActive = btnElement.classList.contains('bg-orange-500');
  
  // Contar quantas métricas estão ativas
  const ativasCount = Object.values(metricasAtivasVendas).filter(v => v).length;

  // Se está ativo e é a última ativa, não permitir desativar
  if (isCurrentlyActive && ativasCount === 1) {
    console.log('⚠️ Pelo menos uma métrica deve estar ativa');
    return;
  }

  // Toggle a métrica
  metricasAtivasVendas[metrica] = !metricasAtivasVendas[metrica];

  // Atualizar estilo do botão
  let radiusClass = '';
  if (btnId === 'btn-vendas-lucro-atual') {
    radiusClass = 'rounded-l-lg';
  } else if (btnId === 'btn-vendas-meta-lucro') {
    radiusClass = 'rounded-r-lg';
  }

  if (metricasAtivasVendas[metrica]) {
    // Ativar
    btnElement.className = `py-1.5 px-4 text-sm font-medium transition-all bg-orange-500 text-white hover:bg-orange-600 ${radiusClass}`;
  } else {
    // Desativar
    btnElement.className = `py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 ${radiusClass}`;
  }

  // Atualizar o gráfico
  atualizarGraficoVendas();
}

// Carregar dados de vendas do Firebase
async function carregarDadosVendas() {
  try {
    console.log('🔄 Iniciando carregamento de dados de vendas...');
    
    // Inicializar com "lucro-atual" ativo por padrão
    metricasAtivasVendas = {
      'lucro-atual': true,
      'faturamento': false,
      'despesas': false,
      'meta-lucro': false
    };

    // Atualizar estilos dos botões
    const btnLucroAtual = document.getElementById('btn-vendas-lucro-atual');
    if (btnLucroAtual) {
      btnLucroAtual.className = 'py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600';
    }

    const db = firebase.firestore();
    const anoAtual = new Date().getFullYear();
    
    console.log(`📅 Ano atual: ${anoAtual}`);
    
    // Inicializar dados para todos os meses com zero
    const dadosMeses = {};
    for (let mes = 0; mes < 12; mes++) {
      dadosMeses[mes] = {
        faturamento: 0,
        lucro_liquido: 0,
        despesas_totais: 0
      };
    }

    // Buscar TODOS os documentos da coleção
    console.log('📂 Buscando todos os documentos de relatorioFinanceiro...');
    const snapshot = await db.collection('relatorioFinanceiro').get();
    
    console.log(`📊 Total de documentos encontrados: ${snapshot.size}`);

    // Iterar sobre cada documento
    snapshot.forEach(doc => {
      const docId = doc.id;
      const docData = doc.data();

      console.log(`\n📄 Analisando documento: ${docId}`);

      // Verificar se o documento começa com o ano atual (ex: 2026_)
      if (docId.startsWith(`${anoAtual}_`)) {
        console.log(`  ✅ Documento é do ano ${anoAtual}`);

        // Extrair o nome do mês do ID do documento
        // Formato esperado: "2026_Fevereiro" ou "2026_fevereiro"
        const partes = docId.split('_');
        if (partes.length === 2) {
          const nomeMesDocumento = partes[1].toLowerCase(); // Converter para minúsculo para comparação
          
          console.log(`  🗓️ Nome do mês no documento: '${nomeMesDocumento}'`);

          // Encontrar o índice do mês correspondente
          const mesIndex = meses.findIndex(m => m.toLowerCase() === nomeMesDocumento);

          if (mesIndex !== -1) {
            console.log(`  🎯 Mês encontrado! Índice: ${mesIndex} (${meses[mesIndex]})`);

            // Extrair valores
            const faturamento = docData.faturamento || 0;
            const lucroLiquido = docData.lucro_liquido || 0;
            const despesasTotais = docData.despesas_totais || 0;

            console.log(`  🟠 Faturamento: ${faturamento}`);
            console.log(`  💰 Lucro Líquido: ${lucroLiquido}`);
            console.log(`  💸 Despesas Totais: ${despesasTotais}`);

            // Adicionar os dados ao índice do mês
            dadosMeses[mesIndex] = {
              faturamento: faturamento,
              lucro_liquido: lucroLiquido,
              despesas_totais: despesasTotais
            };

            console.log(`  ✅ Dados adicionados ao mês ${mesIndex}`);
          } else {
            console.log(`  ❌ Mês '${nomeMesDocumento}' não encontrado no array de meses`);
            console.log(`  📋 Meses disponíveis: ${meses.map(m => m.toLowerCase()).join(', ')}`);
          }
        } else {
          console.log(`  ⚠️ Formato de ID inválido: esperado 'ano_mês', recebido '${docId}'`);
        }
      } else {
        console.log(`  ⏭️ Documento não é do ano ${anoAtual}, ignorando`);
      }
    });

    console.log('\n✅ Processamento de documentos concluído!');
    console.log('📊 Dados finais dos meses:', dadosMeses);
    
    // Renderizar o gráfico com os dados
    renderizarGraficoVendas(dadosMeses);
  } catch (error) {
    console.error('❌ Erro ao carregar dados de vendas:', error);
  }
}

// Renderizar gráfico de vendas
function renderizarGraficoVendas(dadosMeses) {
  console.log('🎨 Iniciando renderização do gráfico...');
  
  const container = document.getElementById('graficoVendas');
  if (!container) {
    console.error('❌ Container graficoVendas não encontrado!');
    return;
  }

  console.log('✅ Container encontrado, limpando...');
  
  // Limpar container
  container.innerHTML = '';

  // Criar canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'graficoVendasCanvas';
  container.appendChild(canvas);

  console.log('✅ Canvas criado e adicionado ao DOM');

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('❌ Não foi possível obter contexto do canvas');
    return;
  }

  // Destruir gráfico anterior se existir
  if (chartVendas) {
    console.log('🗑️ Destruindo gráfico anterior...');
    chartVendas.destroy();
  }

  // Preparar labels dos meses
  const labels = meses; // Array global já definido

  // Preparar datasets
  const datasets = [];

  // Dataset Faturamento (Laranja) — index 0
  datasets.push({
    label: 'Faturamento',
    data: Object.values(dadosMeses).map(d => d.faturamento),
    backgroundColor: '#f28705', // Orange-500
    borderColor: '#d97804', // Orange-600
    borderWidth: 1,
    borderRadius: 4,
    datalabels: { display: true },
    hidden: !metricasAtivasVendas['faturamento']
  });

  // Dataset Lucro Atual (Verde) — index 1
  datasets.push({
    label: 'Lucro Atual',
    data: Object.values(dadosMeses).map(d => d.lucro_liquido),
    backgroundColor: '#22c55e', // Green-500
    borderColor: '#16a34a', // Green-600
    borderWidth: 1,
    borderRadius: 4,
    datalabels: { display: true },
    hidden: !metricasAtivasVendas['lucro-atual']
  });

  // Dataset Despesas (Vermelho) — index 2
  datasets.push({
    label: 'Despesas',
    data: Object.values(dadosMeses).map(d => d.despesas_totais),
    backgroundColor: '#ef4444', // Red-500
    borderColor: '#dc2626', // Red-600
    borderWidth: 1,
    borderRadius: 4,
    datalabels: { display: true },
    hidden: !metricasAtivasVendas['despesas']
  });

  // Dataset Meta de Lucro (linha tracejada) — index 3
  datasets.push({
    label: 'Meta de Lucro',
    data: Array(12).fill(4000),
    type: 'line',
    borderColor: '#6366f1', // Indigo-500
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [5, 5],
    pointBackgroundColor: '#6366f1',
    pointBorderColor: '#fff',
    pointBorderWidth: 1,
    pointRadius: 3,
    tension: 0,
    fill: false,
    datalabels: { display: false },
    hidden: !metricasAtivasVendas['meta-lucro']
  });

  // Registrar plugin datalabels se disponível
  if (typeof ChartDataLabels !== 'undefined') {
    try {
      Chart.register(ChartDataLabels);
      console.log('✅ Plugin ChartDataLabels registrado');
    } catch (e) {
      console.warn('⚠️ ChartDataLabels já estava registrado');
    }
  }

  console.log('📊 Criando Chart.js com', datasets.length, 'datasets');

  // Criar o gráfico
  try {
    chartVendas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: undefined,
        plugins: {
          legend: {
            display: false // Sem legenda
          },
          datalabels: {
            align: 'top',
            anchor: 'end',
            color: '#374151', // Gray-700
            font: {
              weight: 'bold',
              size: 10
            },
            offset: 4,
            formatter: function(value, context) {
              // Mostrar apenas se o dataset tem datalabels ativado
              if (context.dataset.datalabels && context.dataset.datalabels.display && value > 0) {
                return 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
              }
              return '';
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += 'R$ ' + context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                }
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return 'R$ ' + value.toLocaleString('pt-BR');
              }
            },
            grid: {
              borderDash: [2, 4],
              color: '#E5E7EB'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    console.log('✅ Chart.js criado com sucesso!');
    console.log('📊 Gráfico de vendas renderizado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar Chart.js:', error);
  }
}

// Atualizar gráfico ao mudar seleção de métricas
function atualizarGraficoVendas() {
  if (chartVendas && chartVendas.data) {
    // Atualizar hidden de cada dataset
    chartVendas.data.datasets.forEach((dataset, index) => {
      if (index === 0) { // Faturamento
        dataset.hidden = !metricasAtivasVendas['faturamento'];
      } else if (index === 1) { // Lucro Atual
        dataset.hidden = !metricasAtivasVendas['lucro-atual'];
      } else if (index === 2) { // Despesas
        dataset.hidden = !metricasAtivasVendas['despesas'];
      } else if (index === 3) { // Meta de Lucro
        dataset.hidden = !metricasAtivasVendas['meta-lucro'];
      }
    });

    chartVendas.update();
    console.log('🔄 Gráfico de vendas atualizado', metricasAtivasVendas);
  }
}

// ============================================
// MODAL E GERAÇÃO DE DRE (PDF)
// ============================================

function adicionarModalDRE() {
  if (document.getElementById('modal-dre')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'backdrop-modal-dre';
  backdrop.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300';
  backdrop.style.display = 'none';

  const modal = document.createElement('div');
  modal.id = 'modal-dre';
  modal.className = 'hidden fixed inset-0 flex items-center justify-center z-50';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl p-6" style="width:460px;max-width:90vw;">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-lexend font-bold text-gray-800">Gerar DRE</h3>
        <button id="btn-fechar-dre-x" type="button"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <label class="block text-sm font-semibold text-gray-700 mb-2">Quais meses deseja fazer o DRE?</label>

      <div class="relative mb-4" id="dre-dropdown-container">
        <button id="dre-dropdown-toggle" type="button"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-left text-sm text-gray-700 bg-white flex justify-between items-center hover:border-orange-500 transition">
          <span id="dre-dropdown-label">Selecione os meses...</span>
          <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="dre-dropdown-menu"
          class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto"
          style="display:none;"></div>
      </div>

      <div class="flex flex-col gap-2 mb-4">
        <button id="btn-dre-mes-atual" type="button"
          class="py-2 px-4 text-sm font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-700 border border-gray-200 hover:border-orange-300 transition text-left">
          Apenas do mês atual
        </button>
        <button id="btn-dre-mes-anterior" type="button"
          class="py-2 px-4 text-sm font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-700 border border-gray-200 hover:border-orange-300 transition text-left">
          Apenas do mês anterior
        </button>
        <button id="btn-dre-todos-meses" type="button"
          class="py-2 px-4 text-sm font-medium rounded-lg bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-700 border border-gray-200 hover:border-orange-300 transition text-left">
          Todos os meses até agora (Jan – mês atual)
        </button>
      </div>

      <label class="flex items-start gap-3 mb-6 p-3 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer select-none">
        <input type="checkbox" id="dre-check-completo" checked class="mt-0.5 w-4 h-4 accent-orange-500 cursor-pointer flex-shrink-0">
        <div>
          <span class="text-sm font-semibold text-gray-800 block">Criar DRE Completo</span>
          <span class="text-xs text-gray-500">Inclui todas as tabelas (Entradas, Saídas, Equipe) e gráficos de evolução de indicadores. Desmarcado: apenas gráfico anual e tabela de indicadores estratégicos por mês.</span>
        </div>
      </label>

      <div class="flex gap-3">
        <button id="btn-gerar-dre-excel" type="button"
          class="flex-1 py-2 px-4 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Baixar em Planilha
        </button>
        <button id="btn-gerar-dre-pdf" type="button"
          class="flex-1 py-2 px-4 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Imprimir em PDF
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

function abrirModalDRE() {
  const modal = document.getElementById('modal-dre');
  const backdrop = document.getElementById('backdrop-modal-dre');
  if (!modal || !backdrop) return;

  populateDropdownMeses();

  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  modal.style.display = 'flex';
  backdrop.style.display = 'block';

  const toggle = document.getElementById('dre-dropdown-toggle');
  const menu = document.getElementById('dre-dropdown-menu');
  if (toggle && menu) {
    toggle.onclick = () => {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    };
    setTimeout(() => document.addEventListener('click', fecharDropdownDRE), 0);
  }

  document.getElementById('btn-fechar-dre-x').onclick = fecharModalDRE;
  backdrop.onclick = fecharModalDRE;
  document.getElementById('btn-dre-mes-atual').onclick = () => selecionarMesesRapido('atual');
  document.getElementById('btn-dre-mes-anterior').onclick = () => selecionarMesesRapido('anterior');
  document.getElementById('btn-dre-todos-meses').onclick = () => selecionarMesesRapido('todos');
  document.getElementById('btn-gerar-dre-pdf').onclick = gerarDRE;
  document.getElementById('btn-gerar-dre-excel').onclick = gerarPlanilhaDRE;
}

function fecharDropdownDRE(e) {
  const container = document.getElementById('dre-dropdown-container');
  if (container && !container.contains(e.target)) {
    const menu = document.getElementById('dre-dropdown-menu');
    if (menu) menu.style.display = 'none';
    document.removeEventListener('click', fecharDropdownDRE);
  }
}

function fecharModalDRE() {
  const modal = document.getElementById('modal-dre');
  const backdrop = document.getElementById('backdrop-modal-dre');
  if (!modal || !backdrop) return;

  const menu = document.getElementById('dre-dropdown-menu');
  if (menu) menu.style.display = 'none';
  document.removeEventListener('click', fecharDropdownDRE);

  modal.classList.add('hidden');
  backdrop.classList.add('hidden');
  modal.style.display = 'none';
  backdrop.style.display = 'none';
}

function initBotaoDRE() {
  const btn = document.getElementById('gerar-dre');
  if (btn) btn.addEventListener('click', abrirModalDRE);
}

function populateDropdownMeses() {
  const menu = document.getElementById('dre-dropdown-menu');
  if (!menu) return;

  const mesAtual = new Date().getMonth();
  let html = '';
  for (let i = 0; i <= mesAtual; i++) {
    html += `
      <label class="flex items-center gap-2 px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-700">
        <input type="checkbox" value="${i}" class="dre-mes-checkbox accent-orange-500" />
        ${meses[i]}
      </label>`;
  }
  menu.innerHTML = html;

  menu.querySelectorAll('.dre-mes-checkbox').forEach(cb => {
    cb.addEventListener('change', atualizarLabelDropdown);
  });
}

function selecionarMesesRapido(tipo) {
  const mesAtual = new Date().getMonth();
  document.querySelectorAll('.dre-mes-checkbox').forEach(cb => {
    const val = parseInt(cb.value);
    if (tipo === 'atual') {
      cb.checked = (val === mesAtual);
    } else if (tipo === 'anterior') {
      const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
      cb.checked = (val === mesAnterior);
    } else if (tipo === 'todos') {
      cb.checked = (val <= mesAtual);
    }
  });
  atualizarLabelDropdown();
}

function atualizarLabelDropdown() {
  const selecionados = [];
  document.querySelectorAll('.dre-mes-checkbox:checked').forEach(cb => {
    selecionados.push(meses[parseInt(cb.value)]);
  });

  const label = document.getElementById('dre-dropdown-label');
  if (!label) return;

  if (selecionados.length === 0) {
    label.textContent = 'Selecione os meses...';
  } else if (selecionados.length <= 3) {
    label.textContent = selecionados.join(', ');
  } else {
    label.textContent = `${selecionados.length} meses selecionados`;
  }
}

function mostrarLoadingDRE() {
  const el = document.createElement('div');
  el.id = 'dre-loading-overlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="background:#1f2937;padding:36px 44px;border-radius:16px;text-align:center;color:white;font-family:sans-serif;">
      <div style="width:48px;height:48px;border:3px solid #f28705;border-top-color:transparent;border-radius:50%;animation:dreSpinAnim .8s linear infinite;margin:0 auto 16px;"></div>
      <p style="font-size:18px;font-weight:700;margin:0 0 6px;">Gerando DRE...</p>
      <p style="font-size:13px;opacity:.65;margin:0;">Buscando dados e criando o PDF…</p>
    </div>
    <style>@keyframes dreSpinAnim{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(el);
}

function esconderLoadingDRE() {
  const el = document.getElementById('dre-loading-overlay');
  if (el) el.remove();
}

function carregarDadosMesDRE_local(mesIdx, ano, { snapshotEntradas, snapshotInvest, snapshotAulas, snapshotInfo }) {
  const mesComparar = mesIdx + 1;
  const statusValidos = ['Concluída', 'Reposição'];

  const entradas = [];
  snapshotEntradas.forEach(doc => {
    const d = doc.data();
    if (d.dataPrimeiraParcela) {
      const p = d.dataPrimeiraParcela.split('/');
      if (p.length === 3 && parseInt(p[1]) - 1 === mesIdx && parseInt(p[2]) === ano) {
        entradas.push({ ...d, _docId: doc.id });
      }
    }
  });

  const investimentos = [];
  snapshotInvest.forEach(doc => {
    const d = doc.data();
    if (d.data) {
      const p = d.data.split('/');
      if (p.length === 3 && parseInt(p[1]) - 1 === mesIdx && parseInt(p[2]) === ano) {
        investimentos.push({ ...d, _docId: doc.id });
      }
    }
  });

  const infoAdicionais = {};
  snapshotInfo.forEach(doc => {
    const d = doc.data();
    const id = d.idProfessor || '';
    if (!id) return;
    const match = (d.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return;
    if (parseInt(match[2], 10) !== mesComparar || parseInt(match[3], 10) !== ano) return;
    if (!infoAdicionais[id]) infoAdicionais[id] = { entradas: 0, saidas: 0 };
    if (d.tipo === 'entrada') infoAdicionais[id].entradas += (d.valor || 0);
    else infoAdicionais[id].saidas += (d.valor || 0);
  });

  const agrupado = {};
  snapshotAulas.forEach(doc => {
    const d = doc.data();
    if (!statusValidos.includes(d.StatusAula)) return;
    const match = (d.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return;
    if (parseInt(match[2], 10) !== mesComparar || parseInt(match[3], 10) !== ano) return;
    const chave = (d.idProfessor || d.professor || 'N/A').trim();
    if (!agrupado[chave]) agrupado[chave] = { professor: d.professor || d.idProfessor || '-', valorAulas: 0 };
    agrupado[chave].valorAulas += parseFloat(d.ValorAula) || 0;
  });

  Object.keys(infoAdicionais).forEach(cpf => {
    if (!agrupado[cpf]) agrupado[cpf] = { professor: cpf, valorAulas: 0 };
  });

  const equipe = Object.entries(agrupado)
    .map(([cpf, r]) => {
      const info = infoAdicionais[cpf] || { entradas: 0, saidas: 0 };
      return { professor: r.professor, total: r.valorAulas + info.entradas - info.saidas };
    })
    .filter(r => r.total > 0)
    .sort((a, b) => a.professor.localeCompare(b.professor, 'pt-BR'));

  return { entradas, investimentos, equipe };
}

function calcularIndicadoresDRE(entradas, investimentos, equipe) {
  const faturamento = entradas.reduce((s, e) => s + (e.ValorPacote || 0), 0);
  const repasseEquipe = equipe.reduce((s, e) => s + e.total, 0);

  let custosFixos = 0, custosVariaveis = 0, custosExtras = 0;
  investimentos.forEach(inv => {
    const tipo = (inv.tipo || '').toLowerCase().trim();
    if (tipo === 'recorrente_fixa' || tipo === 'recorrente fixa') custosFixos += inv.valor || 0;
    else if (tipo === 'recorrente_variavel' || tipo === 'recorrente variável' || tipo === 'recorrente_variável') custosVariaveis += inv.valor || 0;
    else if (tipo === 'extra') custosExtras += inv.valor || 0;
  });

  const despesasTotais = repasseEquipe + custosFixos + custosVariaveis + custosExtras;
  const lucroBruto = faturamento - repasseEquipe;
  const lucroLiquido = faturamento - despesasTotais;
  const reservaEmergencia = lucroLiquido * 0.10;
  const metaAlcancada = lucroLiquido - 4000;

  return { faturamento, repasseEquipe, custosFixos, custosVariaveis, custosExtras, despesasTotais, lucroBruto, lucroLiquido, reservaEmergencia, metaAlcancada };
}

function buildDREHTML(mesesSelecionados, dadosMeses, ano, completo = true) {
  const fmt = v => formatarMoedaBrasileira(v);
  const cor = v => v >= 0 ? '#16a34a' : '#dc2626';
  const th = 'padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:2px solid #e5e7eb;';
  const td = 'padding:7px 12px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;';

  let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;background:white;padding:24px;width:1000px;">`;

  html += `
    <div style="background:linear-gradient(135deg,#f28705,#d97804);color:white;padding:24px 28px;border-radius:12px;margin-bottom:28px;">
      <h1 style="font-size:22px;font-weight:700;margin:0 0 4px;">Demonstrativo de Resultado do Exercício (DRE)</h1>
      <p style="font-size:14px;margin:0;opacity:.9;">${ano} · Meses: ${mesesSelecionados.map(m => meses[m]).join(', ')}</p>
    </div>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:28px;">
      <h2 style="font-size:16px;font-weight:700;color:#374151;margin:0 0 16px;">Gráfico Anual — Faturamento / Lucro / Despesas por mês</h2>
      <canvas id="dre-chart-anual" width="940" height="280" style="display:block;"></canvas>
    </div>
    <hr style="border:none;border-top:2px solid #e5e7eb;margin:28px 0;">
  `;

  mesesSelecionados.forEach(mesIdx => {
    const dm = dadosMeses[mesIdx];
    const ind = dm.indicadores;
    const nomeMes = `${meses[mesIdx]} ${ano}`;

    html += `<div style="margin-bottom:32px;">`;
    html += `
      <div style="background:#f1f5f9;border-left:4px solid #f28705;padding:14px 18px;border-radius:8px;margin-bottom:18px;">
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0;">${nomeMes}</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Faturamento</p>
          <p style="font-size:20px;font-weight:700;color:#f28705;margin:0;">${fmt(ind.faturamento)}</p>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Lucro Líquido</p>
          <p style="font-size:20px;font-weight:700;color:${cor(ind.lucroLiquido)};margin:0;">${fmt(ind.lucroLiquido)}</p>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Despesas e Investimentos</p>
          <p style="font-size:20px;font-weight:700;color:#dc2626;margin:0;">${fmt(ind.despesasTotais)}</p>
        </div>
      </div>
    `;

    if (completo) {
      html += `
        <div style="margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #f28705;">Entradas (Contratos)</h3>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${th}">Data</th><th style="${th}">Cliente</th><th style="${th}">Horas</th>
              <th style="${th}">Pagamento</th><th style="${th}">Status</th><th style="${th}">Valor</th><th style="${th}">Lucro</th>
            </tr></thead>
            <tbody>
              ${dm.entradas.length === 0
                ? `<tr><td colspan="7" style="${td}text-align:center;color:#9ca3af;">Nenhum registro encontrado</td></tr>`
                : dm.entradas.map((e, i) => `
                  <tr style="background:${i % 2 === 0 ? 'white' : '#f9fafb'};">
                    <td style="${td}">${e.dataPrimeiraParcela || '-'}</td>
                    <td style="${td}">${e.nomeCliente || '-'}</td>
                    <td style="${td}">${e.SomatorioDuracaoAulas || '-'}</td>
                    <td style="${td}">${e.metodoPagamento || '-'}</td>
                    <td style="${td}">${e.statusPagamento || '-'}</td>
                    <td style="${td}font-weight:600;">${fmt(e.ValorPacote || 0)}</td>
                    <td style="${td}font-weight:600;color:#16a34a;">${fmt(e.lucroMaster || 0)}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      `;

      html += `
        <div style="margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #f28705;">Saídas — Investimentos e Despesas</h3>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${th}">Data</th><th style="${th}width:50%;">Descrição</th>
              <th style="${th}">Tipo</th><th style="${th}">Valor</th>
            </tr></thead>
            <tbody>
              ${dm.investimentos.length === 0
                ? `<tr><td colspan="4" style="${td}text-align:center;color:#9ca3af;">Nenhum registro encontrado</td></tr>`
                : dm.investimentos.map((inv, i) => `
                  <tr style="background:${i % 2 === 0 ? 'white' : '#f9fafb'};">
                    <td style="${td}">${inv.data || '-'}</td>
                    <td style="${td}word-break:break-word;">${inv.descricao || '-'}</td>
                    <td style="${td}">${inv.tipo ? inv.tipo.charAt(0).toUpperCase() + inv.tipo.slice(1).replace(/_/g,' ') : '-'}</td>
                    <td style="${td}font-weight:600;color:#dc2626;">${fmt(inv.valor || 0)}</td>
                  </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      `;

      html += `
        <div style="margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #f28705;">Saída — Pagamento de Equipe</h3>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${th}">Nome Professor</th><th style="${th}">Valor das Aulas</th>
            </tr></thead>
            <tbody>
              ${dm.equipe.length === 0
                ? `<tr><td colspan="2" style="${td}text-align:center;color:#9ca3af;">Nenhum registro encontrado</td></tr>`
                : dm.equipe.map((e, i) => `
                  <tr style="background:${i % 2 === 0 ? 'white' : '#f9fafb'};">
                    <td style="${td}">${e.professor}</td>
                    <td style="${td}font-weight:600;color:#f28705;">${fmt(e.total)}</td>
                  </tr>`).join('')
              }
              ${dm.equipe.length > 0 ? `
                <tr style="background:#fff7eb;">
                  <td style="${td}font-weight:700;">Total</td>
                  <td style="${td}font-weight:700;color:#f28705;">${fmt(ind.repasseEquipe)}</td>
                </tr>` : ''}
            </tbody>
          </table>
        </div>
      `;
    }

    html += `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #f28705;">Indicadores Estratégicos</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="${th}">Faturamento</th><th style="${th}">Repasse Equipe</th><th style="${th}">C. Fixos</th>
            <th style="${th}">C. Variáveis</th><th style="${th}">C. Extras</th><th style="${th}">Desp. Totais</th>
            <th style="${th}">Lucro Bruto</th><th style="${th}">Lucro Líquido</th>
            <th style="${th}">Reserva 10%</th><th style="${th}">Meta Alcançada</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style="${td}">${fmt(ind.faturamento)}</td>
              <td style="${td}">${fmt(ind.repasseEquipe)}</td>
              <td style="${td}">${fmt(ind.custosFixos)}</td>
              <td style="${td}">${fmt(ind.custosVariaveis)}</td>
              <td style="${td}">${fmt(ind.custosExtras)}</td>
              <td style="${td}font-weight:600;color:#dc2626;">${fmt(ind.despesasTotais)}</td>
              <td style="${td}font-weight:600;">${fmt(ind.lucroBruto)}</td>
              <td style="${td}font-weight:700;color:${cor(ind.lucroLiquido)};">${fmt(ind.lucroLiquido)}</td>
              <td style="${td}">${fmt(ind.reservaEmergencia)}</td>
              <td style="${td}font-weight:600;color:${cor(ind.metaAlcancada)};">${fmt(ind.metaAlcancada)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    html += `</div><hr style="border:none;border-top:2px solid #e5e7eb;margin:28px 0;">`;
  });

  if (completo) {
    html += `
      <div style="margin-bottom:32px;">
        <h2 style="font-size:18px;font-weight:700;color:#374151;margin:0 0 20px;">Acompanhamento de Indicadores Estratégicos</h2>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 14px;">Receita (Faturamento e Repasse)</h3>
          <canvas id="dre-chart-receita" width="940" height="220" style="display:block;"></canvas>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 14px;">Custos (Fixos, Variáveis, Extras e Total)</h3>
          <canvas id="dre-chart-custos" width="940" height="220" style="display:block;"></canvas>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;">
          <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 14px;">Lucratividade (Lucro Bruto e Líquido)</h3>
          <canvas id="dre-chart-lucro" width="940" height="220" style="display:block;"></canvas>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

async function criarGraficosNoPDF(container, mesesSelecionados, dadosMeses) {
  const labels = mesesSelecionados.map(m => meses[m]);
  const baseOpts = {
    animation: false,
    responsive: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
      datalabels: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') },
        grid: { color: '#e5e7eb' }
      },
      x: { ticks: { font: { size: 10 } }, grid: { display: false } }
    }
  };

  const ctxAnual = container.querySelector('#dre-chart-anual');
  if (ctxAnual) {
    new Chart(ctxAnual.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Faturamento', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.faturamento), backgroundColor: '#f28705', borderRadius: 4 },
          { label: 'Lucro Líquido', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.lucroLiquido), backgroundColor: '#22c55e', borderRadius: 4 },
          { label: 'Despesas', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.despesasTotais), backgroundColor: '#ef4444', borderRadius: 4 }
        ]
      },
      options: {
        ...baseOpts,
        plugins: {
          ...baseOpts.plugins,
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'top',
            color: '#374151',
            font: { weight: 'bold', size: 9 },
            formatter: v => v > 0 ? 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : ''
          }
        }
      }
    });
  }

  const ctxReceita = container.querySelector('#dre-chart-receita');
  if (ctxReceita) {
    new Chart(ctxReceita.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Faturamento', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.faturamento), borderColor: '#f28705', backgroundColor: '#f2870520', tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'Repasse para Equipe', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.repasseEquipe), borderColor: '#6366f1', backgroundColor: '#6366f120', tension: 0.3, fill: false, pointRadius: 4 }
        ]
      },
      options: baseOpts
    });
  }

  const ctxCustos = container.querySelector('#dre-chart-custos');
  if (ctxCustos) {
    new Chart(ctxCustos.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Custos Fixos', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.custosFixos), borderColor: '#3b82f6', tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'Custos Variáveis', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.custosVariaveis), borderColor: '#8b5cf6', tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'Custos Extras', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.custosExtras), borderColor: '#ec4899', tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'Despesas Totais', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.despesasTotais), borderColor: '#ef4444', borderWidth: 2.5, borderDash: [6, 3], tension: 0.3, fill: false, pointRadius: 4 }
        ]
      },
      options: baseOpts
    });
  }

  const ctxLucro = container.querySelector('#dre-chart-lucro');
  if (ctxLucro) {
    new Chart(ctxLucro.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Lucro Bruto', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.lucroBruto), borderColor: '#22c55e', tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'Lucro Líquido', data: mesesSelecionados.map(m => dadosMeses[m].indicadores.lucroLiquido), borderColor: '#16a34a', borderWidth: 2.5, tension: 0.3, fill: false, pointRadius: 4 }
        ]
      },
      options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: false } } }
    });
  }

  await new Promise(resolve => setTimeout(resolve, 300));
}

async function gerarDRE() {
  const checkboxes = document.querySelectorAll('.dre-mes-checkbox:checked');
  const mesesSelecionados = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => a - b);

  if (mesesSelecionados.length === 0) {
    alert('Selecione pelo menos um mês para gerar o DRE.');
    return;
  }

  fecharModalDRE();
  mostrarLoadingDRE();

  try {
    const db = firebase.firestore();
    const ano = anoSelecionado;

    const [snapshotEntradas, snapshotInvest, snapshotAulas, snapshotInfo] = await Promise.all([
      db.collection('BancoDeAulas').get(),
      db.collection('investimentos').get(),
      db.collection('BancoDeAulas-Lista').get(),
      db.collection('informacoesPagamento').where('ano', '==', ano).get()
    ]);

    const snapshots = { snapshotEntradas, snapshotInvest, snapshotAulas, snapshotInfo };
    const dadosMeses = {};
    mesesSelecionados.forEach(mesIdx => {
      const dados = carregarDadosMesDRE_local(mesIdx, ano, snapshots);
      dados.indicadores = calcularIndicadoresDRE(dados.entradas, dados.investimentos, dados.equipe);
      dadosMeses[mesIdx] = dados;
    });

    const completo = document.getElementById('dre-check-completo')?.checked !== false;
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;top:0;left:-9999px;background:white;';
    container.innerHTML = buildDREHTML(mesesSelecionados, dadosMeses, ano, completo);
    document.body.appendChild(container);

    await criarGraficosNoPDF(container, mesesSelecionados, dadosMeses);

    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(container);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const margin = 10;
    const pdfW = 210 - 2 * margin;
    const pdfH = 297 - 2 * margin;
    const pxPerMm = canvas.width / pdfW;
    const pageHeightPx = Math.round(pdfH * pxPerMm);

    let yPx = 0;
    let pageNum = 0;

    while (yPx < canvas.height) {
      const sliceH = Math.min(pageHeightPx, canvas.height - yPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceH);
      ctx.drawImage(canvas, 0, -yPx, canvas.width, canvas.height);

      if (pageNum > 0) pdf.addPage();
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', margin, margin, pdfW, sliceH / pxPerMm);

      yPx += pageHeightPx;
      pageNum++;
    }

    const nomesStr = mesesSelecionados.length <= 2
      ? mesesSelecionados.map(m => meses[m]).join('_')
      : `${mesesSelecionados.length}-meses`;
    pdf.save(`DRE_${ano}_${nomesStr}.pdf`);

  } catch (error) {
    console.error('❌ Erro ao gerar DRE:', error);
    alert('Erro ao gerar DRE: ' + error.message);
  } finally {
    esconderLoadingDRE();
  }
}

// ============================================
// GERAÇÃO DE PLANILHA DRE (EXCEL)
// ============================================

async function gerarPlanilhaDRE() {
  const checkboxes = document.querySelectorAll('.dre-mes-checkbox:checked');
  const mesesSelecionados = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => a - b);

  if (mesesSelecionados.length === 0) {
    alert('Selecione pelo menos um mês para gerar a planilha.');
    return;
  }

  if (typeof ExcelJS === 'undefined') {
    alert('Biblioteca de planilhas não carregada. Recarregue a página e tente novamente.');
    return;
  }

  const completo = document.getElementById('dre-check-completo')?.checked !== false;

  fecharModalDRE();
  mostrarLoadingDRE();

  try {
    const db = firebase.firestore();
    const ano = anoSelecionado;

    const [snapshotEntradas, snapshotInvest, snapshotAulas, snapshotInfo] = await Promise.all([
      db.collection('BancoDeAulas').get(),
      db.collection('investimentos').get(),
      db.collection('BancoDeAulas-Lista').get(),
      db.collection('informacoesPagamento').where('ano', '==', ano).get()
    ]);

    const snapshots = { snapshotEntradas, snapshotInvest, snapshotAulas, snapshotInfo };
    const dadosMeses = {};
    mesesSelecionados.forEach(mesIdx => {
      const dados = carregarDadosMesDRE_local(mesIdx, ano, snapshots);
      dados.indicadores = calcularIndicadoresDRE(dados.entradas, dados.investimentos, dados.equipe);
      dadosMeses[mesIdx] = dados;
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SistemaMaster';
    wb.created = new Date();

    mesesSelecionados.forEach(mesIdx => {
      const nomeMes = meses[mesIdx];
      const dm = dadosMeses[mesIdx];
      const ind = dm.indicadores;
      const n = v => (typeof v === 'number' ? v : 0);

      if (completo) {
        // ── Aba "Descrições [Mês]" ──────────────────────────────────────
        const wsDesc = wb.addWorksheet(`Descrições ${nomeMes}`);

        // Entradas
        _dreSecao(wsDesc, `ENTRADAS (CONTRATOS) — ${nomeMes} ${ano}`, 7);
        _dreCabecalho(wsDesc, ['Data', 'Nome Cliente', 'Horas Contratadas', 'Forma de Pagamento', 'Status Pagamento', 'Valor Contratação', 'Lucro Atual']);
        if (dm.entradas.length === 0) {
          wsDesc.addRow(['Nenhum registro encontrado']);
        } else {
          dm.entradas.forEach(e => {
            const row = wsDesc.addRow([
              e.dataPrimeiraParcela || '-', e.nomeCliente || '-',
              e.SomatorioDuracaoAulas || '-', e.metodoPagamento || '-',
              e.statusPagamento || '-', n(e.ValorPacote), n(e.lucroMaster)
            ]);
            row.getCell(6).numFmt = '"R$ "#,##0.00';
            row.getCell(7).numFmt = '"R$ "#,##0.00';
          });
        }
        wsDesc.addRow([]);

        // Saídas
        _dreSecao(wsDesc, `SAÍDAS — INVESTIMENTOS E DESPESAS — ${nomeMes} ${ano}`, 4);
        _dreCabecalho(wsDesc, ['Data', 'Descrição', 'Tipo de Despesa', 'Valor']);
        if (dm.investimentos.length === 0) {
          wsDesc.addRow(['Nenhum registro encontrado']);
        } else {
          dm.investimentos.forEach(inv => {
            const row = wsDesc.addRow([
              inv.data || '-', inv.descricao || '-',
              inv.tipo ? inv.tipo.charAt(0).toUpperCase() + inv.tipo.slice(1).replace(/_/g, ' ') : '-',
              n(inv.valor)
            ]);
            row.getCell(4).numFmt = '"R$ "#,##0.00';
          });
        }
        wsDesc.addRow([]);

        // Pagamento de Equipe
        _dreSecao(wsDesc, `SAÍDA — PAGAMENTO DE EQUIPE — ${nomeMes} ${ano}`, 2);
        _dreCabecalho(wsDesc, ['Nome Professor', 'Valor das Aulas']);
        if (dm.equipe.length === 0) {
          wsDesc.addRow(['Nenhum registro encontrado']);
        } else {
          dm.equipe.forEach(e => {
            const row = wsDesc.addRow([e.professor, e.total]);
            row.getCell(2).numFmt = '"R$ "#,##0.00';
          });
          const totalRow = wsDesc.addRow(['TOTAL', ind.repasseEquipe]);
          totalRow.getCell(2).numFmt = '"R$ "#,##0.00';
          _dreEstiloTotal(totalRow, 2);
        }

        _dreAjustarColunas(wsDesc);
      }

      // ── Aba "Resumo [Mês]" ─────────────────────────────────────────────
      const wsResumo = wb.addWorksheet(`Resumo ${nomeMes}`);
      const hdrs = [
        'Faturamento', 'Repasse para Equipe', 'Custos Fixos', 'Custos Variáveis',
        'Custos Extras', 'Despesas Totais', 'Lucro Bruto', 'Lucro Líquido',
        'Reserva de Emergência (10%)', 'Meta Alcançada'
      ];
      _dreSecao(wsResumo, `INDICADORES ESTRATÉGICOS — ${nomeMes} ${ano}`, hdrs.length);
      _dreCabecalho(wsResumo, hdrs);
      const dataRow = wsResumo.addRow([
        ind.faturamento, ind.repasseEquipe, ind.custosFixos, ind.custosVariaveis,
        ind.custosExtras, ind.despesasTotais, ind.lucroBruto, ind.lucroLiquido,
        ind.reservaEmergencia, ind.metaAlcancada
      ]);
      for (let c = 1; c <= hdrs.length; c++) {
        dataRow.getCell(c).numFmt = '"R$ "#,##0.00';
      }

      _dreAjustarColunas(wsResumo);
    });

    const nomesStr = mesesSelecionados.length <= 2
      ? mesesSelecionados.map(m => meses[m]).join('_')
      : `${mesesSelecionados.length}-meses`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DRE_${ano}_${nomesStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('❌ Erro ao gerar planilha:', error);
    alert('Erro ao gerar planilha: ' + error.message);
  } finally {
    esconderLoadingDRE();
  }
}

function _dreSecao(ws, titulo, numCols) {
  const row = ws.addRow([titulo]);
  row.height = 18;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF28705' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  }
  if (numCols > 1) ws.mergeCells(row.number, 1, row.number, numCols);
}

function _dreCabecalho(ws, headers) {
  const row = ws.addRow(headers);
  row.height = 16;
  headers.forEach((_, i) => {
    const cell = row.getCell(i + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFE5E7EB' } } };
  });
}

function _dreEstiloTotal(row, numCols) {
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7EB' } };
    cell.font = { bold: true, color: { argb: 'FFF28705' } };
  }
}

function _dreAjustarColunas(ws) {
  ws.columns.forEach(col => {
    let maxLen = 10;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 55);
  });
}

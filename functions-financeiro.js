console.log('functions-financeiro.js carregado');

// Variáveis globais para controle do mês
let mesSelecionado = new Date().getMonth(); // 0-11
let anoSelecionado = new Date().getFullYear();

// Array de meses para referência
const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

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
          <!-- Botões de Período (Exclusivos) -->
          <div class="flex gap-0">
            <button id="btn-vendas-anual" class="py-1.5 px-6 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" data-visualizacao="anual">
              Anual
            </button>
            <button id="btn-vendas-mensal" class="py-1.5 px-6 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-visualizacao="mensal">
              Mensal
            </button>
          </div>
          
          <!-- Botões de Métricas (Múltipla Seleção) -->
          <div class="flex gap-0">
            <button id="btn-vendas-lucro-atual" class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="lucro-atual" title="Lucro Atual">
              Lucro Atual
            </button>
            <button id="btn-vendas-meta-lucro" class="py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="meta-lucro" title="Meta de Lucro">
              Meta de Lucro
            </button>
            <button id="btn-vendas-despesas" class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" data-metrica="despesas" title="Total de Despesas">
              Total de Despesas
            </button>
          </div>
        </div>
      </div>
      
      <!-- Gráfico de Vendas -->
      <div id="graficoVendas" class="w-full" style="height: 150px;">
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

    <!-- Seção Saídas: Investimentos -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-lexend font-bold text-gray-800">Saídas: Investimentos</h2>
        <button id="btn-adicionar-investimento" class="py-1.5 px-4 text-sm font-medium rounded-lg transition-all bg-orange-500 text-white hover:bg-orange-600">
          + Adicionar Investimento
        </button>
      </div>
      
      <!-- Tabela de Saídas Investimentos -->
      <div class="max-h-[300px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
        <table id="tabelaSaidasInvestimentos" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Descrição</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
            </tr>
          </thead>
          <tbody id="tabelaSaidasInvestimentosBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="3" class="px-4 py-8 text-center text-gray-500 text-sm">
                Nenhum registro encontrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seção Saída: Pagamento de Equipe -->
    <div class="bg-white rounded-lg border border-gray-300 p-4 mb-4">
      <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Saída: Pagamento de Equipe</h2>
      
      <!-- Tabela de Pagamento de Equipe -->
      <div class="max-h-[300px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
        <table id="tabelaPagamentoEquipe" class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200">
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome Professor</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome Cliente</th>
              <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor das Aulas</th>
            </tr>
          </thead>
          <tbody id="tabelaPagamentoEquipeBody">
            <!-- Dados serão carregados aqui -->
            <tr>
              <td colspan="3" class="px-4 py-8 text-center text-gray-500 text-sm">
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
        <button id="btn-adicionar-informacao" class="py-1.5 px-4 text-sm font-medium rounded-lg transition-all bg-orange-500 text-white hover:bg-orange-600">
          + Adicionar informação
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
              <td colspan="9" class="px-4 py-8 text-center text-gray-500 text-sm">
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

  // Inicializar eventos dos botões
  initBotoesVendas();
  initSeletorMes();
  
  // Aguardar a disponibilidade do Firebase
  setTimeout(() => {
    initBotaoAdicionarInvestimento();
    initModalEditarInvestimento();
    carregarInvestimentos();
    carregarEntradas(); // Carregar entradas do mês
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

      <!-- Campo Data -->
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 mb-1">Data</label>
        <input 
          type="text" 
          id="input-data-investimento" 
          placeholder="DD/MM/YYYY"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition"
          maxlength="10"
        />
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

      <!-- Campo Data -->
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 mb-1">Data</label>
        <input 
          type="text" 
          id="input-data-editar-investimento" 
          placeholder="DD/MM/YYYY"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 transition"
          maxlength="10"
        />
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
  const btnLucroAtual = document.getElementById('btn-vendas-lucro-atual');
  const btnMetaLucro = document.getElementById('btn-vendas-meta-lucro');
  const btnDespesas = document.getElementById('btn-vendas-despesas');

  if (!btnAnual || !btnMensal) {
    console.error('Botões de visualização de vendas não encontrados');
    return;
  }

  btnAnual.addEventListener('click', () => {
    mudarVisualizacaoVendas('anual');
  });

  btnMensal.addEventListener('click', () => {
    mudarVisualizacaoVendas('mensal');
  });

  // Event listeners para os botões de múltipla seleção
  if (btnLucroAtual) {
    btnLucroAtual.addEventListener('click', () => {
      toggleMetricaVendas('lucro-atual', btnLucroAtual);
    });
  }

  if (btnMetaLucro) {
    btnMetaLucro.addEventListener('click', () => {
      toggleMetricaVendas('meta-lucro', btnMetaLucro);
    });
  }

  if (btnDespesas) {
    btnDespesas.addEventListener('click', () => {
      toggleMetricaVendas('despesas', btnDespesas);
    });
  }
}

function toggleMetricaVendas(metrica, btnElement) {
  // Verificar se está ativo ou inativo
  const isActive = btnElement.classList.contains('bg-orange-500');
  
  // Determinar as classes de border-radius com base na posição do botão
  let radiusClass = '';
  if (btnElement.id === 'btn-vendas-lucro-atual') {
    radiusClass = 'rounded-l-lg';
  } else if (btnElement.id === 'btn-vendas-despesas') {
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

  if (!btnAnual || !btnMensal) return;

  if (visualizacao === 'anual') {
    btnAnual.className = "py-1.5 px-6 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600";
    btnMensal.className = "py-1.5 px-6 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200";
  } else {
    btnAnual.className = "py-1.5 px-6 text-sm font-medium rounded-l-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200";
    btnMensal.className = "py-1.5 px-6 text-sm font-medium rounded-r-lg transition-all bg-orange-500 text-white hover:bg-orange-600";
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

  atualizarMes();
  carregarInvestimentos(); // Recarregar investimentos do novo mês
  carregarEntradas(); // Recarregar entradas do novo mês
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
  const descricao = document.getElementById('input-descricao-investimento').value.trim();
  const valor = document.getElementById('input-valor-investimento').value.trim();
  const erroDiv = document.getElementById('erro-validacao-investimento');
  const erroMsg = document.getElementById('erro-msg');

  if (!data || !descricao || !valor || valor === 'R$ 0,00') {
    let msg = 'Preencha todos os campos';
    if (!data) msg = 'A data é obrigatória';
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

  const data = document.getElementById('input-data-investimento').value;
  const descricao = document.getElementById('input-descricao-investimento').value;
  const valor = document.getElementById('input-valor-investimento').value;

  // Extrair data para obter o mês
  const [dia, mes, ano] = data.split('/');
  const mesNumerico = parseInt(mes) - 1;
  const nomeMes = meses[mesNumerico];
  const anoNumerico = parseInt(ano);

  // Limpar valor para salvar no BD (remover R$ e converter)
  const valorNumerico = parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.'));
  const nomeDocumento = `${anoNumerico}-${nomeMes}-${valorNumerico}`;

  // Salvar no Firebase
  salvarNoFirebase(nomeDocumento, {
    data: data,
    descricao: descricao,
    valor: valorNumerico,
    criado_em: new Date().toISOString()
  });

  fecharModalInvestimento();
  console.log(`Investimento salvo: ${nomeDocumento}`);
}

function salvarNoFirebase(nomeDocumento, dados) {
  console.log('Verificando disponibilidade do Firebase...');
  console.log('window.BANCO:', window.BANCO ? 'existe' : 'NÃO existe');
  console.log('window.BANCO.db:', window.BANCO?.db ? 'existe' : 'NÃO existe');
  
  if (!window.BANCO || !window.BANCO.db) {
    console.error('❌ Firebase não está disponível. window.BANCO.db não foi encontrado');
    alert('Erro: Firebase não está pronto. Tente novamente em alguns segundos.');
    return;
  }

  // Usar Firestore
  window.BANCO.db.collection('investimentos')
    .doc(nomeDocumento)
    .set(dados, { merge: true })
    .then(() => {
      console.log('Documento salvo com sucesso:', nomeDocumento);
      carregarInvestimentos();
    })
    .catch((error) => {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar investimento. Tente novamente.');
    });
}

function carregarInvestimentos() {
  console.log('Carregando investimentos do mês:', meses[mesSelecionado], anoSelecionado);
  console.log('window.BANCO disponível?', window.BANCO ? 'SIM' : 'NÃO');
  
  if (!window.BANCO || !window.BANCO.db) {
    console.warn('⚠️ Firebase ainda não está disponível. Tentando novamente em 1s...');
    setTimeout(() => carregarInvestimentos(), 1000);
    return;
  }

  window.BANCO.db.collection('investimentos')
    .get()
    .then((snapshot) => {
      const tbody = document.getElementById('tabelaSaidasInvestimentosBody');
      if (!tbody) return;

      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-gray-500 text-sm">Nenhum registro encontrado</td></tr>`;
        return;
      }

      let html = '';
      snapshot.forEach((doc) => {
        const dados = doc.data();
        
        // Filtrar por mês selecionado
        if (dados.data) {
          // Formato esperado: DD/MM/YYYY
          const partes = dados.data.split('/');
          if (partes.length === 3) {
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1; // JavaScript months são 0-11
            const ano = parseInt(partes[2]);
            
            // Verificar se o investimento é do mês selecionado
            if (mes === mesSelecionado && ano === anoSelecionado) {
              html += `
                <tr class="border-b border-gray-200 hover:bg-gray-50" data-doc-id="${doc.id}" data-data="${dados.data}" data-descricao="${dados.descricao}" data-valor="${dados.valor}">
                  <td class="px-4 py-3 text-sm text-gray-800">${dados.data || '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-800">${dados.descricao || '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-800">R$ ${dados.valor?.toFixed(2) || '-'}</td>
                </tr>
              `;
            }
          }
        }
      });

      if (html === '') {
        tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-8 text-center text-gray-500 text-sm">Nenhum registro encontrado para este mês</td></tr>`;
      } else {
        tbody.innerHTML = html;
        // Adicionar event listener para clique direito nas linhas
        const linhas = tbody.querySelectorAll('tr[data-doc-id]');
        linhas.forEach(linha => {
          linha.addEventListener('contextmenu', (e) => exibirMenuContexto(e, 'investimento'));
        });
      }
    })
    .catch((error) => {
      console.error('Erro ao carregar investimentos:', error);
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

  // Calcular o range de datas para o mês selecionado
  const dataInicio = new Date(anoSelecionado, mesSelecionado, 1);
  const dataFim = new Date(anoSelecionado, mesSelecionado + 1, 1);
  
  const timestampInicio = dataInicio.getTime();
  const timestampFim = dataFim.getTime();
  
  console.log(`📅 Range de timestamps:`);
  console.log(`  Início: ${dataInicio.toLocaleDateString('pt-BR')} (${timestampInicio})`);
  console.log(`  Fim: ${dataFim.toLocaleDateString('pt-BR')} (${timestampFim})`);

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
        
        // Tentar encontrar o campo de data
        let dataStr = null;
        if (dados.timestamp) {
          console.log(`  ✓ Encontrado: timestamp = ${dados.timestamp}`);
        }
        if (dados.data || dados.Data) {
          dataStr = dados.data || dados.Data;
          console.log(`  ✓ Encontrado: data = ${dataStr}`);
        }
        if (dados.dataContratacao || dados.DataContratacao) {
          dataStr = dados.dataContratacao || dados.DataContratacao;
          console.log(`  ✓ Encontrado: dataContratacao = ${dataStr}`);
        }
        if (dados.dataCriacao || dados.DataCriacao) {
          dataStr = dados.dataCriacao || dados.DataCriacao;
          console.log(`  ✓ Encontrado: dataCriacao = ${dataStr}`);
        }
        
        let entraNoMes = false;
        
        // Estratégia 1: Usar timestamp se existir (converter de Firestore Timestamp para milliseconds)
        if (dados.timestamp) {
          let timestampMs = null;
          
          // Se for objeto Timestamp do Firestore (com propriedade seconds)
          if (dados.timestamp && dados.timestamp.seconds !== undefined) {
            timestampMs = dados.timestamp.seconds * 1000;
            console.log(`    ✓ Convertendo Timestamp Firestore: ${dados.timestamp.seconds}s → ${timestampMs}ms`);
          }
          // Se for número direto (milliseconds)
          else if (typeof dados.timestamp === 'number') {
            timestampMs = dados.timestamp;
            console.log(`    ✓ Timestamp é número: ${timestampMs}ms`);
          }
          
          if (timestampMs) {
            console.log(`    Comparando: ${timestampMs} >= ${timestampInicio} && < ${timestampFim} ?`);
            if (timestampMs >= timestampInicio && timestampMs < timestampFim) {
              console.log(`      ✅ DENTRO DO RANGE!`);
              entraNoMes = true;
            } else {
              console.log(`      ❌ Fora do range`);
            }
          }
        }
        // Estratégia 2: Tentar parsestring de data em português
        else if (dataStr) {
          // Formato: "13 de fevereiro de 2026 às 18:45:28 UTC-3"
          console.log(`    Analisando string: "${dataStr}"`);
          const matches = dataStr.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
          if (matches) {
            const dia = parseInt(matches[1]);
            const mesPortugues = matches[2].toLowerCase();
            const ano = parseInt(matches[3]);
            
            // Encontrar índice do mês português
            const indicesMeses = {
              'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
              'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
              'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
            };
            
            const mesParsed = indicesMeses[mesPortugues];
            console.log(`      Extrado: dia=${dia}, mês=${mesPortugues}(${mesParsed}), ano=${ano}`);
            
            if (mesParsed === mesSelecionado && ano === anoSelecionado) {
              console.log(`      ✅ DENTRO DO MÊS SELECIONADO!`);
              entraNoMes = true;
            } else {
              console.log(`      ❌ Fora do mês. Esperado: ${mesSelecionado}/${anoSelecionado}, Encontrado: ${mesParsed}/${ano}`);
            }
          } else {
            console.log(`      ❌ Não conseguiu fazer parse da data`);
          }
        }
        
        if (entraNoMes) {
          console.log(`    ✅ ADICIONADO À LISTA`);
          entradasDoMes.push(dados);
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
        
        // Tentar converter data
        let dataFormatada = '-';
        if (dados.timestamp) {
          let timestampMs = null;
          // Se for objeto Timestamp do Firestore
          if (dados.timestamp && dados.timestamp.seconds !== undefined) {
            timestampMs = dados.timestamp.seconds * 1000;
          }
          // Se for número direto
          else if (typeof dados.timestamp === 'number') {
            timestampMs = dados.timestamp;
          }
          
          if (timestampMs) {
            const dataObj = new Date(timestampMs);
            dataFormatada = dataObj.toLocaleDateString('pt-BR');
          }
        } else if (dados.data || dados.Data || dados.dataContratacao || dados.DataContratacao) {
          const dataStr = dados.data || dados.Data || dados.dataContratacao || dados.DataContratacao;
          // Tentar extrair data no formato português
          const matches = dataStr.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
          if (matches) {
            dataFormatada = `${matches[1]}/${obterMesNumero(matches[2])}/${matches[3]}`;
          } else {
            dataFormatada = dataStr;
          }
        }
        
        html += `
          <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-800">${dataFormatada || '-'}</td>
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
  console.log('=== ATUALIZANDO INDICADORES ===');
  
  // Calcular Faturamento (somatório de ValorPacote)
  let faturamento = 0;
  entradasDoMes.forEach((entrada) => {
    if (entrada.ValorPacote) {
      faturamento += entrada.ValorPacote;
    }
  });
  
  console.log(`📊 Faturamento calculado: R$ ${faturamento.toFixed(2)}`);
  
  // Atualizar elemento no DOM
  const indicadorFaturamento = document.getElementById('indicador-faturamento');
  if (indicadorFaturamento) {
    indicadorFaturamento.textContent = formatarMoedaBrasileira(faturamento);
    console.log('✅ Indicador de Faturamento atualizado');
  } else {
    console.warn('⚠️ Elemento indicador-faturamento não encontrado');
  }
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
  const descricao = linha.getAttribute('data-descricao');
  const valor = linha.getAttribute('data-valor');
  
  console.log('🔔 Menu de contexto acionado:', { docId, data, descricao, valor });
  
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
    <button class="w-full text-left px-4 py-2 hover:bg-orange-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-700 font-medium" onclick="editarInvestimento('${docId}', '${data}', '${descricao}', '${valor}')">
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

function editarInvestimento(docId, data, descricao, valor) {
  console.log('✏️ Editando investimento:', docId);
  
  // Pré-preencher os campos
  document.getElementById('input-data-editar-investimento').value = data;
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
  const descricao = document.getElementById('input-descricao-editar-investimento').value.trim();
  const valor = document.getElementById('input-valor-editar-investimento').value.trim();
  const erroDiv = document.getElementById('erro-validacao-editar-investimento');
  const erroMsg = document.getElementById('erro-msg-editar');
  
  // Validação
  if (!data || !descricao || !valor || valor === 'R$ 0,00') {
    let msg = 'Preencha todos os campos';
    if (!data) msg = 'A data é obrigatória';
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

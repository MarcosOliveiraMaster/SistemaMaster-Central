console.log('functions-dashboardCliente.js carregado');

// Variáveis de estado do Dashboard Cliente
let _dcClientes = [];
let _dcAulasLista = [];
let _dcGraficoPagamento = null;
let _dcGraficoContrato = null;

// Função principal para carregar o Dashboard Cliente
window.loadDashboardCliente = async function () {
  const section = document.getElementById('clientes');
  if (!section) {
    console.error('Section clientes não encontrada');
    return;
  }

  // Mostrar loading
  section.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16">
      <div class="loading-spinner-large mb-4"></div>
      <p class="text-orange-500 font-comfortaa font-bold">Carregando Dashboard Cliente...</p>
    </div>
  `;

  try {
    // Destruir gráficos anteriores para evitar conflitos
    _dcDestruirGraficos();

    // Buscar dados
    const [clientes, aulasLista] = await Promise.all([
      BANCO.fetchBancoDeAulas(),
      BANCO.fetchBancoDeAulasListaBatch()
    ]);

    _dcClientes = clientes || [];
    _dcAulasLista = aulasLista || [];

    // Calcular KPIs
    const totalClientes = _dcClientes.length;
    const contratosAssinados = _dcClientes.filter(c =>
      c.statusContrato && c.statusContrato.toLowerCase() === 'contrato assinado'
    ).length;
    const pagamentosCompletos = _dcClientes.filter(c =>
      c.statusPagamento && c.statusPagamento.toLowerCase() === 'pagamento completo'
    ).length;
    const aulasConcluidas = _dcAulasLista.filter(a =>
      a.StatusAula && a.StatusAula.toLowerCase() === 'concluída'
    ).length;

    // Renderizar dashboard
    section.innerHTML = `
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="dc-kpi-card">
          <div class="dc-kpi-icon bg-orange-100">
            <i class="fas fa-users text-orange-500"></i>
          </div>
          <div class="dc-kpi-info">
            <span class="dc-kpi-label">Total de Clientes</span>
            <span class="dc-kpi-value text-gray-800">${totalClientes}</span>
          </div>
        </div>

        <div class="dc-kpi-card">
          <div class="dc-kpi-icon bg-green-100">
            <i class="fas fa-file-contract text-green-600"></i>
          </div>
          <div class="dc-kpi-info">
            <span class="dc-kpi-label">Contratos Assinados</span>
            <span class="dc-kpi-value text-green-600">${contratosAssinados}</span>
          </div>
        </div>

        <div class="dc-kpi-card">
          <div class="dc-kpi-icon bg-blue-100">
            <i class="fas fa-money-check-alt text-blue-600"></i>
          </div>
          <div class="dc-kpi-info">
            <span class="dc-kpi-label">Pagamentos Completos</span>
            <span class="dc-kpi-value text-blue-600">${pagamentosCompletos}</span>
          </div>
        </div>

        <div class="dc-kpi-card">
          <div class="dc-kpi-icon bg-purple-100">
            <i class="fas fa-chalkboard-teacher text-purple-600"></i>
          </div>
          <div class="dc-kpi-info">
            <span class="dc-kpi-label">Aulas Concluídas</span>
            <span class="dc-kpi-value text-purple-600">${aulasConcluidas}</span>
          </div>
        </div>
      </div>

      <!-- Gráficos -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <!-- Gráfico Status de Pagamento -->
        <div class="bg-white rounded-lg border border-gray-300 p-4 shadow-sm">
          <h3 class="text-base font-lexend font-bold text-gray-800 mb-4">Status de Pagamento</h3>
          <div class="dc-chart-container">
            <canvas id="dc-grafico-pagamento"></canvas>
          </div>
        </div>

        <!-- Gráfico Status de Contrato -->
        <div class="bg-white rounded-lg border border-gray-300 p-4 shadow-sm">
          <h3 class="text-base font-lexend font-bold text-gray-800 mb-4">Status de Contrato</h3>
          <div class="dc-chart-container">
            <canvas id="dc-grafico-contrato"></canvas>
          </div>
        </div>
      </div>

      <!-- Tabela de Clientes -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 shadow-sm">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h2 class="text-lg font-lexend font-bold text-gray-800">Lista de Clientes</h2>
          <div class="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              id="dc-busca-cliente"
              placeholder="Buscar cliente..."
              class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 flex-1 sm:w-56"
            />
            <select id="dc-filtro-pagamento" class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300">
              <option value="">Todos</option>
              <option value="pagamento completo">Pagamento Completo</option>
              <option value="pagamento pendente">Pagamento Pendente</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Código</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status Pagamento</th>
                <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status Contrato</th>
                <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700">Total Aulas</th>
                <th class="px-4 py-3 text-center text-sm font-semibold text-gray-700">Concluídas</th>
              </tr>
            </thead>
            <tbody id="dc-tabela-body">
              ${_dcRenderLinhasClientes(_dcClientes, _dcAulasLista)}
            </tbody>
          </table>
        </div>

        <div class="mt-3 text-xs text-gray-500">
          <span id="dc-count-clientes">${_dcClientes.length}</span> cliente(s) encontrado(s)
        </div>
      </div>
    `;

    // Inicializar gráficos
    _dcInitGraficoPagamento(_dcClientes);
    _dcInitGraficoContrato(_dcClientes);

    // Inicializar filtros
    _dcInitFiltros(_dcClientes, _dcAulasLista);

  } catch (error) {
    console.error('❌ Erro ao carregar Dashboard Cliente:', error);
    section.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <i class="fas fa-exclamation-circle text-red-400 text-4xl mb-4"></i>
        <h3 class="font-lexend font-bold text-lg text-gray-700 mb-2">Erro ao carregar dados</h3>
        <p class="text-gray-500 text-sm mb-4">Ocorreu um erro ao buscar os dados dos clientes.</p>
        <button onclick="loadDashboardCliente()" class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-semibold">
          <i class="fas fa-redo mr-2"></i>Tentar novamente
        </button>
      </div>
    `;
  }
};

// Renderizar linhas da tabela de clientes
function _dcRenderLinhasClientes(clientes, aulasLista) {
  if (!clientes || clientes.length === 0) {
    return `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-gray-500 text-sm">
          Nenhum cliente encontrado.
        </td>
      </tr>
    `;
  }

  return clientes.map(cliente => {
    const nomeCliente = cliente.nome || cliente.nomeCliente || 'Não informado';
    const codigo = cliente.codigoContratacao || '--';
    const statusPag = cliente.statusPagamento || 'Não informado';
    const statusCont = cliente.statusContrato || 'Não informado';

    // Contar total de aulas e concluídas pelo código de contratação
    const prefixo = (codigo !== '--' && codigo.length >= 4) ? codigo.substring(0, 4) : null;
    const aulasCliente = prefixo
      ? aulasLista.filter(a => {
          const idAula = a['id-Aula'] || a.id || '';
          return idAula.startsWith(prefixo);
        })
      : [];
    const totalAulas = aulasCliente.length;
    const aulasConcluidas = aulasCliente.filter(a =>
      a.StatusAula && a.StatusAula.toLowerCase() === 'concluída'
    ).length;

    const classePag = _dcGetStatusClass(statusPag, 'pagamento');
    const classeCont = _dcGetStatusClass(statusCont, 'contrato');

    return `
      <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 dc-linha-cliente"
          data-nome="${_dcEscape(nomeCliente.toLowerCase())}"
          data-pagamento="${_dcEscape(statusPag.toLowerCase())}">
        <td class="px-4 py-3 text-sm font-medium text-gray-800">${_dcEscape(nomeCliente)}</td>
        <td class="px-4 py-3 text-sm text-gray-600 font-mono">${_dcEscape(codigo)}</td>
        <td class="px-4 py-3 text-sm">
          <span class="dc-badge ${classePag}">${_dcEscape(statusPag)}</span>
        </td>
        <td class="px-4 py-3 text-sm">
          <span class="dc-badge ${classeCont}">${_dcEscape(statusCont)}</span>
        </td>
        <td class="px-4 py-3 text-sm text-center font-medium text-gray-700">${totalAulas}</td>
        <td class="px-4 py-3 text-sm text-center">
          <span class="${aulasConcluidas > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}">${aulasConcluidas}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// Inicializar o gráfico de status de pagamento
function _dcInitGraficoPagamento(clientes) {
  const canvas = document.getElementById('dc-grafico-pagamento');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js não carregado; gráfico de pagamento não será renderizado.');
    return;
  }

  const pagamentos = _dcContarStatus(clientes, 'statusPagamento');
  const labels = Object.keys(pagamentos);
  const valores = Object.values(pagamentos);

  _dcGraficoPagamento = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: _dcGerarCores(labels.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Lexend', size: 11 },
            padding: 12,
            boxWidth: 14
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      },
      cutout: '60%'
    }
  });
}

// Inicializar o gráfico de status de contrato
function _dcInitGraficoContrato(clientes) {
  const canvas = document.getElementById('dc-grafico-contrato');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js não carregado; gráfico de contrato não será renderizado.');
    return;
  }

  const contratos = _dcContarStatus(clientes, 'statusContrato');
  const labels = Object.keys(contratos);
  const valores = Object.values(contratos);

  _dcGraficoContrato = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: _dcGerarCores(labels.length, true),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Lexend', size: 11 },
            padding: 12,
            boxWidth: 14
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      },
      cutout: '60%'
    }
  });
}

// Destruir gráficos existentes
function _dcDestruirGraficos() {
  if (_dcGraficoPagamento) {
    _dcGraficoPagamento.destroy();
    _dcGraficoPagamento = null;
  }
  if (_dcGraficoContrato) {
    _dcGraficoContrato.destroy();
    _dcGraficoContrato = null;
  }
}

// Inicializar filtros da tabela
function _dcInitFiltros(clientes, aulasLista) {
  const inputBusca = document.getElementById('dc-busca-cliente');
  const selectPag = document.getElementById('dc-filtro-pagamento');

  if (!inputBusca || !selectPag) return;

  const aplicarFiltro = () => {
    const termoBusca = inputBusca.value.toLowerCase().trim();
    const filtroPag = selectPag.value.toLowerCase();

    const linhas = document.querySelectorAll('.dc-linha-cliente');
    let visiveis = 0;

    linhas.forEach(linha => {
      const nome = linha.dataset.nome || '';
      const pagamento = linha.dataset.pagamento || '';

      const matchBusca = !termoBusca || nome.includes(termoBusca);
      const matchPag = !filtroPag || pagamento === filtroPag;

      if (matchBusca && matchPag) {
        linha.style.display = '';
        visiveis++;
      } else {
        linha.style.display = 'none';
      }
    });

    const contador = document.getElementById('dc-count-clientes');
    if (contador) contador.textContent = visiveis;
  };

  inputBusca.addEventListener('input', aplicarFiltro);
  selectPag.addEventListener('change', aplicarFiltro);
}

// Contar ocorrências de um campo de status nos clientes
function _dcContarStatus(clientes, campo) {
  const contagem = {};
  clientes.forEach(c => {
    const valor = c[campo] || 'Não informado';
    contagem[valor] = (contagem[valor] || 0) + 1;
  });
  return contagem;
}

// Gerar array de cores para os gráficos
function _dcGerarCores(quantidade, alternativo) {
  const paleta = alternativo
    ? ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6']
    : ['#f28705', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6'];
  const resultado = [];
  for (let i = 0; i < quantidade; i++) {
    resultado.push(paleta[i % paleta.length]);
  }
  return resultado;
}

// Retornar classe CSS para o badge de status
function _dcGetStatusClass(status, tipo) {
  const s = (status || '').toLowerCase();
  if (tipo === 'pagamento') {
    if (s === 'pagamento completo') return 'dc-badge-success';
    if (s.includes('pendente')) return 'dc-badge-warning';
    return 'dc-badge-info';
  }
  if (tipo === 'contrato') {
    if (s === 'contrato assinado') return 'dc-badge-success';
    if (s.includes('pendente')) return 'dc-badge-warning';
    return 'dc-badge-info';
  }
  return 'dc-badge-info';
}

// Escapar caracteres HTML para evitar XSS
function _dcEscape(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

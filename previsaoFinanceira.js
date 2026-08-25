console.log('✅ previsaoFinanceira.js carregado');

const PREV_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let prevMesAtual      = new Date().getMonth();
let prevAnoAtual      = new Date().getFullYear();
let prevModoGrafico   = 'individual'; // 'individual' | 'montante'
let prevChartInstance = null;
let prevShowMedia     = false;
let prevShowMeta      = false;
let prevEntradasCache = [];
let prevSaidasCache   = [];
let prevMetricaAtual  = 'entradas'; // 'entradas' | 'saidas' | 'saldo'

// ─── Entrada principal ────────────────────────────────────────────────────────

window.loadPrevisaoFinanceira = function () {
  const section = document.getElementById('previsao-financeira');
  if (!section) { console.error('Section previsao-financeira não encontrada'); return; }

  prevMesAtual      = new Date().getMonth();
  prevAnoAtual      = new Date().getFullYear();
  prevModoGrafico   = 'individual';
  prevChartInstance = null;
  prevShowMedia     = false;
  prevShowMeta      = false;
  prevEntradasCache = [];
  prevSaidasCache   = [];
  prevMetricaAtual  = 'entradas';

  section.innerHTML = `
    <!-- Gráfico -->
    <div id="grafico" class="bg-white rounded-lg border border-gray-300 p-4 mb-4 w-full" style="min-height: 280px;">
      <div class="flex items-center justify-between mb-4">

        <!-- Esquerda: seletor de mês -->
        <div class="flex items-center gap-2">
          <button id="btn-prev-mes-anterior" class="p-1.5 transition-all rounded-lg border border-gray-300 text-gray-300 cursor-not-allowed" disabled>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <span id="prev-mes-label" class="text-sm font-lexend font-bold text-gray-800 min-w-[130px] text-center"></span>
          <button id="btn-prev-mes-proximo" class="p-1.5 text-gray-500 hover:text-orange-500 transition-all rounded-lg hover:bg-orange-50 border border-gray-300">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>

        <!-- Direita: Entradas/Saídas/Saldo + Valor Individual/Montante -->
        <div class="flex items-center gap-3">
          <div class="flex gap-0">
            <button class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" id="btn-prev-entradas">
              Entradas
            </button>
            <button class="py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-prev-saidas">
              Saídas
            </button>
            <button class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-prev-saldo">
              Saldo
            </button>
          </div>

          <div class="flex gap-0">
            <button class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" id="btn-prev-individual">
              Valor Individual
            </button>
            <button class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-prev-montante">
              Montante
            </button>
          </div>

          <div class="flex gap-1">
            <button class="py-1.5 px-4 text-sm font-medium rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-prev-media">
              Média
            </button>
            <button class="py-1.5 px-4 text-sm font-medium rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-prev-meta">
              Meta
            </button>
            <button class="py-1.5 px-4 text-sm font-medium rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1" id="btn-prev-atualizar">
              <i class="fas fa-sync-alt text-xs"></i>
              Atualizar
            </button>
          </div>
        </div>

      </div>
      <div style="position: relative; height: 200px; width: 100%;">
        <canvas id="canvas-previsao"></canvas>
      </div>
    </div>

    <!-- Entradas e Saídas previstas: lado a lado -->
    <div class="flex gap-4">

      <!-- Entradas previstas -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 flex-1">
        <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Entradas previstas</h2>

        <div class="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p class="text-xs font-semibold text-green-700 mb-0.5">Total previsto</p>
          <p id="total-entradas-previstas" class="text-2xl font-bold text-green-600">R$ 0,00</p>
        </div>

        <div class="overflow-y-auto" style="max-height: 340px;">
          <table class="w-full">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Descrição</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Valor</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Data</th>
              </tr>
            </thead>
            <tbody id="tbody-entradas-previstas">
              <tr>
                <td colspan="3" class="px-3 py-8 text-center text-gray-400 text-sm">
                  <i class="fas fa-arrow-down text-2xl text-gray-300 mb-2 block"></i>
                  Nenhuma entrada prevista
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Saídas previstas -->
      <div class="bg-white rounded-lg border border-gray-300 p-4 flex-1">
        <h2 class="text-lg font-lexend font-bold text-gray-800 mb-4">Saídas previstas</h2>

        <div class="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p class="text-xs font-semibold text-red-700 mb-0.5">Total previsto</p>
          <p id="total-saidas-previstas" class="text-2xl font-bold text-red-600">R$ 0,00</p>
        </div>

        <div class="overflow-y-auto" style="max-height: 340px;">
          <table class="w-full">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Descrição</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Valor</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">Data</th>
              </tr>
            </thead>
            <tbody id="tbody-saidas-previstas">
              <tr>
                <td colspan="3" class="px-3 py-8 text-center text-gray-400 text-sm">
                  <i class="fas fa-arrow-up text-2xl text-gray-300 mb-2 block"></i>
                  Nenhuma saída prevista
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  setupPrevisaoListeners();
  atualizarLabelMes();
  Promise.all([
    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual),
    carregarSaidasPrevistas(prevMesAtual, prevAnoAtual)
  ]).then(() => atualizarGraficoAtual());
};

// ─── Gráfico ──────────────────────────────────────────────────────────────────

function atualizarGrafico(entradas, tipo = 'entradas') {
  const canvas = document.getElementById('canvas-previsao');
  if (!canvas || typeof Chart === 'undefined') return;

  if (prevChartInstance) {
    prevChartInstance.destroy();
    prevChartInstance = null;
  }

  const fontBase = { family: 'Lexend', size: 11 };
  const tickColor = '#6b7280';
  const moedaFmt  = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const corBorda  = tipo === 'saidas' ? 'rgba(239,68,68,1)'    : tipo === 'saldo' ? 'rgba(34,197,94,1)'    : 'rgba(249,115,22,1)';
  const corFundo  = tipo === 'saidas' ? 'rgba(239,68,68,0.08)' : tipo === 'saldo' ? 'rgba(34,197,94,0.08)' : 'rgba(249,115,22,0.08)';
  const corFill   = tipo === 'saidas' ? 'rgba(239,68,68,0.12)' : tipo === 'saldo' ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)';

  const linhaConstante = (labels, valor, cor, label) => ({
    label,
    data: labels.map(() => valor),
    borderColor: cor,
    backgroundColor: 'transparent',
    pointRadius: 0,
    pointHoverRadius: 0,
    borderWidth: 2,
    borderDash: [6, 4],
    tension: 0,
    fill: false
  });

  // Itens individuais de cada dia (para o tooltip em lista). Aceita entradas de pacote
  // {raw, valor} (tipo 'entradas'), saídas com {descricao, valor}, ou pontos de saldo
  // com {itens: [{descricao, valor, tipo}]}.
  const itensPorData = {};
  entradas.forEach(e => {
    if (!itensPorData[e.data]) itensPorData[e.data] = [];
    if (Array.isArray(e.itens)) {
      e.itens.forEach(it => itensPorData[e.data].push(it));
    } else if (tipo === 'entradas') {
      const rawNome = (e.raw && (e.raw.nome || e.raw.nomeCliente)) || '';
      const nome    = rawNome.trim().split(/\s+/).slice(0, 2).join(' ') || '-';
      const horas   = (e.raw && e.raw.SomatorioDuracaoAulas) || '-';
      itensPorData[e.data].push({ nome, horas, valor: e.valor });
    } else {
      itensPorData[e.data].push({ descricao: e.descricao || '-', valor: e.valor });
    }
  });

  const formatarLinhaItem = (it) => {
    if (it.nome !== undefined) return `• ${it.nome} - ${it.horas} - ${moedaFmt(it.valor)}`;
    if (it.tipo === 'entrada') return `• ${it.descricao} (Entrada) - ${moedaFmt(it.valor)}`;
    if (it.tipo === 'saida')   return `• ${it.descricao} (Saída) - ${moedaFmt(it.valor)}`;
    return `• ${it.descricao} - ${moedaFmt(it.valor)}`;
  };
  const calcularTotalItens = (itens) => itens.reduce((s, it) => s + (it.tipo === 'saida' ? -it.valor : it.valor), 0);

  const options = () => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        displayColors: false,
        padding: 10,
        titleMarginBottom: 8,
        bodySpacing: 6,
        footerMarginTop: 10,
        callbacks: {
          label: function (ctx) {
            if (ctx.dataset.label) {
              return ' ' + ctx.dataset.label + ': ' + moedaFmt(ctx.parsed.y);
            }
            const itens = itensPorData[ctx.label] || [];
            if (itens.length === 0) return ' ' + moedaFmt(ctx.parsed.y);
            return itens.map(formatarLinhaItem);
          },
          footer: function (tooltipItems) {
            const label = tooltipItems && tooltipItems[0] ? tooltipItems[0].label : null;
            const itens = label ? (itensPorData[label] || []) : [];
            if (itens.length === 0) return '';
            return `Total: ${moedaFmt(calcularTotalItens(itens))}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: true,
          drawTicks: false,
          color: 'rgba(0,0,0,0.12)',
          borderDash: [3, 3]
        },
        ticks: {
          font: fontBase,
          color: tickColor,
          callback: function (value) {
            const label = this.getLabelForValue(value);
            const dia = (label || '').split('/')[0];
            return dia;
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: fontBase, color: tickColor, callback: moedaFmt }
      }
    }
  });

  if (prevModoGrafico === 'individual') {
    const porDataSoma = {};
    entradas.forEach(e => { porDataSoma[e.data] = (porDataSoma[e.data] || 0) + e.valor; });
    const labels  = Object.keys(porDataSoma).sort((a, b) => parseDateBR(a) - parseDateBR(b));
    const valores = labels.map(d => porDataSoma[d]);
    const media   = valores.length > 0 ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;

    const datasets = [{
      data: valores,
      borderColor: corBorda,
      backgroundColor: corFundo,
      pointBackgroundColor: corBorda,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.4,
      fill: false
    }];

    if (prevShowMedia) datasets.push(linhaConstante(labels, media, 'rgba(139,92,246,1)', 'Média'));
    if (prevShowMeta)  datasets.push(linhaConstante(labels, 4000,  'rgba(34,197,94,1)',  'Meta'));

    prevChartInstance = new Chart(canvas, { type: 'line', data: { labels, datasets }, options: options() });

  } else {
    const porData = {};
    entradas.forEach(e => { porData[e.data] = (porData[e.data] || 0) + e.valor; });
    const datas = Object.keys(porData).sort((a, b) => parseDateBR(a) - parseDateBR(b));
    let acum = 0;
    const valores = datas.map(d => { acum += porData[d]; return acum; });
    const mediaAcum = valores.length > 0 ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;

    const datasets = [{
      data: valores,
      borderColor: corBorda,
      backgroundColor: corFill,
      pointBackgroundColor: corBorda,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: true
    }];

    if (prevShowMedia) datasets.push(linhaConstante(datas, mediaAcum, 'rgba(139,92,246,1)', 'Média'));
    if (prevShowMeta)  datasets.push(linhaConstante(datas, 4000,      'rgba(34,197,94,1)',  'Meta'));

    prevChartInstance = new Chart(canvas, { type: 'line', data: { labels: datas, datasets }, options: options() });
  }
}

// ─── Entradas previstas ───────────────────────────────────────────────────────

function carregarEntradasPrevistas(mes, ano) {
  const tbody   = document.getElementById('tbody-entradas-previstas');
  const totalEl = document.getElementById('total-entradas-previstas');
  if (!tbody) return Promise.resolve();

  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="px-3 py-8 text-center text-gray-400 text-sm">
        <div class="loading-spinner-small mx-auto mb-2"></div>
        Carregando...
      </td>
    </tr>`;

  if (!window.BANCO || !window.BANCO.db) {
    tbody.innerHTML = estadoVazioEntradas('Firebase não disponível');
    prevEntradasCache = [];
    return Promise.resolve();
  }

  return window.BANCO.db.collection('BancoDeAulas').get()
    .then(snapshot => {
      const entradas = [];

      snapshot.forEach(doc => {
        const d        = { id: doc.id, ...doc.data() };
        const primDate = (d.dataPrimeiraParcela || '').trim();
        const segDate  = (d.dataSegundaParcela  || '').trim();
        const valor    = parseFloat(d.ValorPacote) || 0;

        if (!primDate || valor === 0) return;

        const isIntegral = segDate === '' || primDate === segDate;

        if (isIntegral) {
          if (dataPertenceAoMes(primDate, mes, ano)) {
            entradas.push(montarEntrada(d, valor, primDate));
          }
        } else {
          const metade = valor / 2;
          if (dataPertenceAoMes(primDate, mes, ano)) {
            entradas.push(montarEntrada(d, metade, primDate));
          }
          if (dataPertenceAoMes(segDate, mes, ano)) {
            entradas.push(montarEntrada(d, metade, segDate));
          }
        }
      });

      entradas.sort((a, b) => parseDateBR(a.data) - parseDateBR(b.data));

      if (entradas.length === 0) {
        tbody.innerHTML = estadoVazioEntradas();
        if (totalEl) totalEl.textContent = 'R$ 0,00';
        prevEntradasCache = [];
        return;
      }

      let total = 0;
      tbody.innerHTML = entradas.map((e, i) => {
        total += e.valor;
        return `
          <tr class="border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition-colors" data-entrada-idx="${i}">
            <td class="px-3 py-2.5 text-sm text-gray-800">${e.descricao}</td>
            <td class="px-3 py-2.5 text-sm font-medium text-green-600 whitespace-nowrap">${formatarMoeda(e.valor)}</td>
            <td class="px-3 py-2.5 text-sm text-gray-500">${e.data}</td>
          </tr>`;
      }).join('');

      tbody.querySelectorAll('tr[data-entrada-idx]').forEach(tr => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.getAttribute('data-entrada-idx'));
          if (window.BancoDeAulasCards && typeof window.BancoDeAulasCards.viewAulaDetails === 'function') {
            window.BancoDeAulasCards.viewAulaDetails(entradas[idx].raw);
          }
        });
      });

      if (totalEl) totalEl.textContent = formatarMoeda(total);
      prevEntradasCache = entradas;
    })
    .catch(err => {
      console.error('Erro ao carregar entradas previstas:', err);
      tbody.innerHTML = estadoVazioEntradas('Erro ao carregar dados');
      prevEntradasCache = [];
    });
}

function montarEntrada(d, valor, data) {
  return {
    descricao: formatarDescricao(d.nome || d.nomeCliente, d.SomatorioDuracaoAulas),
    valor,
    data,
    raw: d
  };
}

function parseDateBR(dataStr) {
  if (!dataStr) return 0;
  const [d, m, a] = dataStr.split('/');
  return new Date(parseInt(a), parseInt(m) - 1, parseInt(d)).getTime();
}

function dataPertenceAoMes(dataStr, mes, ano) {
  if (!dataStr) return false;
  const p = dataStr.split('/');
  if (p.length !== 3) return false;
  return parseInt(p[1]) - 1 === mes && parseInt(p[2]) === ano;
}

function formatarDescricao(nome, somatorio) {
  const primeiros2 = (nome || '').trim().split(/\s+/).slice(0, 2).join(' ');
  return `Pagamento ${primeiros2} - pacote ${somatorio || ''}`;
}

function formatarMoeda(valor) {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function estadoVazioEntradas(msg) {
  return `
    <tr>
      <td colspan="3" class="px-3 py-8 text-center text-gray-400 text-sm">
        <i class="fas fa-arrow-down text-2xl text-gray-300 mb-2 block"></i>
        ${msg || 'Nenhuma entrada prevista'}
      </td>
    </tr>`;
}

// ─── Seletor de mês ───────────────────────────────────────────────────────────

function atualizarLabelMes() {
  const el = document.getElementById('prev-mes-label');
  if (el) el.textContent = `${PREV_MESES[prevMesAtual]} ${prevAnoAtual}`;
  atualizarBotaoAnterior();
}

function atualizarBotaoAnterior() {
  const btn = document.getElementById('btn-prev-mes-anterior');
  if (!btn) return;
  btn.disabled = false;
  btn.className = 'p-1.5 text-gray-500 hover:text-orange-500 transition-all rounded-lg hover:bg-orange-50 border border-gray-300';
}

// ─── Estados dos botões ───────────────────────────────────────────────────────


function setMetricaBtns(metrica) {
  const ativo   = 'py-1.5 px-4 text-sm font-medium transition-all bg-orange-500 text-white hover:bg-orange-600';
  const inativo = 'py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
  document.getElementById('btn-prev-entradas').className = (metrica === 'entradas' ? ativo : inativo) + ' rounded-l-lg';
  document.getElementById('btn-prev-saidas').className   = (metrica === 'saidas'   ? ativo : inativo);
  document.getElementById('btn-prev-saldo').className    = (metrica === 'saldo'    ? ativo : inativo) + ' rounded-r-lg';
}

function setModoGraficoBtns(modo) {
  const ativo   = 'py-1.5 px-4 text-sm font-medium transition-all bg-orange-500 text-white hover:bg-orange-600';
  const inativo = 'py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
  document.getElementById('btn-prev-individual').className = (modo === 'individual' ? ativo : inativo) + ' rounded-l-lg';
  document.getElementById('btn-prev-montante').className   = (modo === 'montante'   ? ativo : inativo) + ' rounded-r-lg';
}

function setToggleBtnEstado(id, ativo, cor) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (ativo) {
    btn.style.backgroundColor = cor;
    btn.style.color = '#ffffff';
    btn.style.borderColor = cor;
  } else {
    btn.style.backgroundColor = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────────

function setupPrevisaoListeners() {

  document.getElementById('btn-prev-mes-anterior')?.addEventListener('click', () => {
    prevMesAtual--;
    if (prevMesAtual < 0) { prevMesAtual = 11; prevAnoAtual--; }
    atualizarLabelMes();
    recarregarDadosMes();
  });

  document.getElementById('btn-prev-mes-proximo')?.addEventListener('click', () => {
    prevMesAtual++;
    if (prevMesAtual > 11) { prevMesAtual = 0; prevAnoAtual++; }
    atualizarLabelMes();
    recarregarDadosMes();
  });

  document.getElementById('btn-prev-entradas')?.addEventListener('click', () => {
    prevMetricaAtual = 'entradas';
    setMetricaBtns('entradas');
    atualizarGrafico(prevEntradasCache, 'entradas');
  });

  document.getElementById('btn-prev-saidas')?.addEventListener('click', () => {
    prevMetricaAtual = 'saidas';
    setMetricaBtns('saidas');
    atualizarGrafico(prevSaidasCache, 'saidas');
  });

  document.getElementById('btn-prev-saldo')?.addEventListener('click', () => {
    prevMetricaAtual = 'saldo';
    setMetricaBtns('saldo');
    atualizarGraficoSaldo();
  });

  document.getElementById('btn-prev-individual')?.addEventListener('click', () => {
    prevModoGrafico = 'individual';
    setModoGraficoBtns('individual');
    atualizarGraficoAtual();
  });

  document.getElementById('btn-prev-montante')?.addEventListener('click', () => {
    prevModoGrafico = 'montante';
    setModoGraficoBtns('montante');
    atualizarGraficoAtual();
  });

  document.getElementById('btn-prev-media')?.addEventListener('click', () => {
    prevShowMedia = !prevShowMedia;
    setToggleBtnEstado('btn-prev-media', prevShowMedia, 'rgba(139, 92, 246, 1)');
    atualizarGraficoAtual();
  });

  document.getElementById('btn-prev-meta')?.addEventListener('click', () => {
    prevShowMeta = !prevShowMeta;
    setToggleBtnEstado('btn-prev-meta', prevShowMeta, 'rgba(34, 197, 94, 1)');
    atualizarGraficoAtual();
  });

  document.getElementById('btn-prev-atualizar')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-prev-atualizar');
    if (!btn || btn.disabled) return;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i> Atualizando...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    if (window.BANCO && typeof window.BANCO.forceCacheRefresh === 'function') {
      window.BANCO.forceCacheRefresh();
    }

    Promise.all([
      carregarEntradasPrevistas(prevMesAtual, prevAnoAtual),
      carregarSaidasPrevistas(prevMesAtual, prevAnoAtual)
    ]).then(() => atualizarGraficoAtual()).finally(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.style.opacity = '';
    });
  });
}

// ─── Helpers de gráfico ──────────────────────────────────────────────────────

function recarregarDadosMes() {
  Promise.all([
    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual),
    carregarSaidasPrevistas(prevMesAtual, prevAnoAtual)
  ]).then(() => atualizarGraficoAtual());
}

function atualizarGraficoAtual() {
  if (prevMetricaAtual === 'saidas')     atualizarGrafico(prevSaidasCache, 'saidas');
  else if (prevMetricaAtual === 'saldo') atualizarGraficoSaldo();
  else                                   atualizarGrafico(prevEntradasCache, 'entradas');
}

function atualizarGraficoSaldo() {
  const porDataE = {};
  prevEntradasCache.forEach(e => {
    if (!porDataE[e.data]) porDataE[e.data] = { total: 0, itens: [] };
    porDataE[e.data].total += e.valor;
    porDataE[e.data].itens.push({ descricao: e.descricao || '-', valor: e.valor, tipo: 'entrada' });
  });

  const porDataS = {};
  prevSaidasCache.forEach(s => {
    if (!porDataS[s.data]) porDataS[s.data] = { total: 0, itens: [] };
    porDataS[s.data].total += s.valor;
    porDataS[s.data].itens.push({ descricao: s.descricao || '-', valor: s.valor, tipo: 'saida' });
  });

  const todasDatas = [...new Set([...Object.keys(porDataE), ...Object.keys(porDataS)])];
  const saldoEntries = todasDatas.map(d => ({
    data: d,
    valor: (porDataE[d]?.total || 0) - (porDataS[d]?.total || 0),
    itens: [...(porDataE[d]?.itens || []), ...(porDataS[d]?.itens || [])]
  }));

  atualizarGrafico(saldoEntries, 'saldo');
}

// ─── Saídas previstas ────────────────────────────────────────────────────────

function carregarSaidasPrevistas(mes, ano) {
  const tbody   = document.getElementById('tbody-saidas-previstas');
  const totalEl = document.getElementById('total-saidas-previstas');
  if (!tbody) return Promise.resolve();

  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="px-3 py-8 text-center text-gray-400 text-sm">
        <div class="loading-spinner-small mx-auto mb-2"></div>
        Carregando...
      </td>
    </tr>`;

  if (!window.BANCO || !window.BANCO.db) {
    tbody.innerHTML = estadoVazioSaidas('Firebase não disponível');
    if (totalEl) totalEl.textContent = 'R$ 0,00';
    prevSaidasCache = [];
    return Promise.resolve();
  }

  const promInvest = window.BANCO.db.collection('investimentos').get();
  const promAulas  = window.BANCO.db.collection('BancoDeAulas-Lista').get();
  const promProf   = typeof fetchDataBaseProfessores === 'function' ? fetchDataBaseProfessores() : Promise.resolve([]);

  return Promise.all([promInvest, promAulas, promProf])
    .then(([snapInvest, snapAulas, professores]) => {
      const cpfsProfessoresAtivos = new Set(
        (professores || [])
          .filter(p => (p.status || '').toLowerCase() === 'ativo' && p.cpf)
          .map(p => p.cpf)
      );

      const saidas      = [];
      const saidasChart = [];

      snapInvest.forEach(doc => {
        const d = doc.data();
        if (!d.data) return;
        const partes = d.data.split('/');
        if (partes.length !== 3) return;
        const docMes = parseInt(partes[1]) - 1;
        const docAno = parseInt(partes[2]);
        if (docMes === mes && docAno === ano) {
          const entrada = { descricao: d.descricao || '-', valor: parseFloat(d.valor) || 0, data: d.data };
          saidas.push(entrada);
          saidasChart.push(entrada);
        }
      });

      saidas.sort((a, b) => parseDateBR(a.data) - parseDateBR(b.data));

      let totalProfessores = 0;
      snapAulas.forEach(doc => {
        const d = doc.data();
        if (!d.data) return;
        // Formato: "ddd - dd/mm/yyyy"
        const match = d.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (!match) return;
        const docMes = parseInt(match[2]) - 1;
        const docAno = parseInt(match[3]);
        if (
          docMes === mes && docAno === ano &&
          d.StatusAula !== 'Reagendada' &&
          d.idProfessor && cpfsProfessoresAtivos.has(d.idProfessor)
        ) {
          const valorAula = parseFloat(d.ValorAula) || 0;
          totalProfessores += valorAula;
        }
      });

      // O gráfico de Saídas reflete apenas o que está de fato cadastrado na coleção
      // de Saídas (Investimentos e despesas). O pagamento de professores não é um
      // registro dessa coleção — é calculado a partir das aulas do mês — então entra
      // no gráfico como um único ponto agregado, sempre no último dia do mês.
      if (totalProfessores > 0) {
        const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
        const dataUltimoDia = `${String(ultimoDiaMes).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;
        saidasChart.push({ descricao: 'Pagamento de professores', valor: totalProfessores, data: dataUltimoDia });
      }

      saidasChart.sort((a, b) => parseDateBR(a.data) - parseDateBR(b.data));
      prevSaidasCache = saidasChart;

      let total = 0;
      let html  = '';

      saidas.forEach(s => {
        total += s.valor;
        html  += `
          <tr class="border-b border-gray-100 hover:bg-red-50 transition-colors">
            <td class="px-3 py-2.5 text-sm text-gray-800">${s.descricao}</td>
            <td class="px-3 py-2.5 text-sm font-medium text-red-600 whitespace-nowrap">${formatarMoeda(s.valor)}</td>
            <td class="px-3 py-2.5 text-sm text-gray-500">${s.data}</td>
          </tr>`;
      });

      total += totalProfessores;
      html  += `
        <tr class="border-b border-gray-100 bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors" data-prof="1">
          <td class="px-3 py-2.5 text-sm font-semibold text-gray-800">Pagamento de professores</td>
          <td class="px-3 py-2.5 text-sm font-medium text-red-600 whitespace-nowrap">${formatarMoeda(totalProfessores)}</td>
          <td class="px-3 py-2.5 text-sm text-gray-500">-</td>
        </tr>`;

      tbody.innerHTML = html;
      if (totalEl) totalEl.textContent = formatarMoeda(total);

      const rowProf = tbody.querySelector('tr[data-prof]');
      if (rowProf) {
        rowProf.addEventListener('click', () => abrirModalPagamentoProfessores(mes, ano));
      }
    })
    .catch(err => {
      console.error('Erro ao carregar saídas previstas:', err);
      tbody.innerHTML = estadoVazioSaidas('Erro ao carregar dados');
      if (totalEl) totalEl.textContent = 'R$ 0,00';
      prevSaidasCache = [];
    });
}

function estadoVazioSaidas(msg) {
  return `
    <tr>
      <td colspan="3" class="px-3 py-8 text-center text-gray-400 text-sm">
        <i class="fas fa-arrow-up text-2xl text-gray-300 mb-2 block"></i>
        ${msg || 'Nenhuma saída prevista'}
      </td>
    </tr>`;
}

// ─── Modal Pagamento de Professores ──────────────────────────────────────────

function abrirModalPagamentoProfessores(mes, ano) {
  const existing = document.getElementById('modal-pagamento-professores');
  if (existing) existing.remove();

  const modalEl = document.createElement('div');
  modalEl.id = 'modal-pagamento-professores';
  modalEl.className = 'modal-overlay';
  modalEl.style.zIndex = '1000';
  modalEl.innerHTML = `
    <div class="modal-container" style="max-width: 680px;">
      <div class="modal-header">
        <div>
          <h3 class="text-lg font-lexend font-bold text-gray-800">Pagamento de Professores</h3>
          <p class="text-sm text-gray-500 mt-0.5">${PREV_MESES[mes]} ${ano}</p>
        </div>
        <button id="btn-fechar-modal-prof" class="text-gray-400 hover:text-gray-600 transition-colors p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body" style="padding: 0;">
        <div id="modal-prof-loading" class="px-6 py-10 text-center text-gray-400 text-sm">
          <div class="loading-spinner-small mx-auto mb-2"></div>
          Carregando...
        </div>
        <div id="modal-prof-content" class="hidden">
          <div class="flex gap-0 px-4 pt-4 pb-1">
            <button class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" id="btn-modal-prof-tab-clientes">
              Clientes
            </button>
            <button class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-modal-prof-tab-professores">
              Professores
            </button>
          </div>
          <div id="modal-prof-tab-clientes-content" class="overflow-y-auto" style="max-height: 420px;">
            <table class="w-full">
              <thead class="sticky top-0 bg-gray-50">
                <tr class="border-b border-gray-200">
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nome Cliente</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600">Duração do Pacote</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600">Aulas no Mês</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600">Valor Direcionado</th>
                </tr>
              </thead>
              <tbody id="modal-prof-tbody"></tbody>
            </table>
          </div>
          <div id="modal-prof-tab-professores-content" class="hidden overflow-y-auto" style="max-height: 420px;">
            <table class="w-full">
              <thead class="sticky top-0 bg-gray-50">
                <tr class="border-b border-gray-200">
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600">Professor</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600">Aulas no Mês</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600">Valor Direcionado</th>
                </tr>
              </thead>
              <tbody id="modal-prof-professores-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="justify-content: space-between; align-items: center;">
        <p id="modal-prof-footer-hint" class="text-xs text-gray-400">Clique em um cliente para ver os detalhes da contratação</p>
        <button id="btn-fechar-modal-prof-footer" class="py-2 px-4 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
          Fechar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  const fecharModal = () => modalEl.remove();
  document.getElementById('btn-fechar-modal-prof').addEventListener('click', fecharModal);
  document.getElementById('btn-fechar-modal-prof-footer').addEventListener('click', fecharModal);
  modalEl.addEventListener('click', e => { if (e.target === modalEl) fecharModal(); });

  const setModalProfTab = (tab) => {
    const ativo   = 'py-1.5 px-4 text-sm font-medium transition-all bg-orange-500 text-white hover:bg-orange-600';
    const inativo = 'py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
    document.getElementById('btn-modal-prof-tab-clientes').className    = (tab === 'clientes'    ? ativo : inativo) + ' rounded-l-lg';
    document.getElementById('btn-modal-prof-tab-professores').className = (tab === 'professores' ? ativo : inativo) + ' rounded-r-lg';
    document.getElementById('modal-prof-tab-clientes-content').classList.toggle('hidden', tab !== 'clientes');
    document.getElementById('modal-prof-tab-professores-content').classList.toggle('hidden', tab !== 'professores');
    const hint = document.getElementById('modal-prof-footer-hint');
    if (hint) hint.textContent = tab === 'clientes'
      ? 'Clique em um cliente para ver os detalhes da contratação'
      : 'Clique em um professor para ver as aulas do mês';
  };
  document.getElementById('btn-modal-prof-tab-clientes')?.addEventListener('click', () => setModalProfTab('clientes'));
  document.getElementById('btn-modal-prof-tab-professores')?.addEventListener('click', () => setModalProfTab('professores'));

  if (!window.BANCO || !window.BANCO.db) {
    document.getElementById('modal-prof-loading').innerHTML =
      '<p class="text-red-500 text-sm">Firebase não disponível</p>';
    return;
  }

  Promise.all([
    window.BANCO.db.collection('BancoDeAulas-Lista').get(),
    window.BANCO.db.collection('BancoDeAulas').get(),
    typeof fetchDataBaseProfessores === 'function' ? fetchDataBaseProfessores() : Promise.resolve([])
  ]).then(([snapLista, snapBanco, professores]) => {
    const mapPacotes = {};
    snapBanco.forEach(doc => { mapPacotes[doc.id] = doc.data(); });

    const cpfsProfessoresAtivos = new Set(
      (professores || [])
        .filter(p => (p.status || '').toLowerCase() === 'ativo' && p.cpf)
        .map(p => p.cpf)
    );
    const nomeProfessorPorCpf = {};
    (professores || []).forEach(p => { if (p.cpf) nomeProfessorPorCpf[p.cpf] = p.nome || ''; });

    const grupos     = {};
    const gruposProf = {};
    snapLista.forEach(doc => {
      const d = doc.data();
      if (!d.data) return;
      const match = d.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return;
      if (parseInt(match[2]) - 1 !== mes || parseInt(match[3]) !== ano) return;
      if (d.StatusAula === 'Reagendada') return;
      if (!d.idProfessor || !cpfsProfessoresAtivos.has(d.idProfessor)) return;

      const codigo = d.codigoContratacao || (d['id-Aula'] || '').substring(0, 4);
      if (!codigo) return;

      const valorAula = parseFloat(d.ValorAula) || 0;

      if (!grupos[codigo]) {
        grupos[codigo] = { nomeCliente: d.nomeCliente || '', quantidade: 0, totalValor: 0 };
      }
      grupos[codigo].quantidade++;
      grupos[codigo].totalValor += valorAula;

      const cpfProf = d.idProfessor;
      if (!gruposProf[cpfProf]) {
        gruposProf[cpfProf] = {
          nome: nomeProfessorPorCpf[cpfProf] || 'Professor não identificado',
          quantidade: 0,
          totalValor: 0,
          aulas: []
        };
      }
      gruposProf[cpfProf].quantidade++;
      gruposProf[cpfProf].totalValor += valorAula;
      gruposProf[cpfProf].aulas.push({
        codigo,
        data: `${match[1]}/${match[2]}/${match[3]}`,
        nomeCliente: d.nomeCliente || '-',
        duracao: d.duracao || '-',
        valor: valorAula,
        status: d.StatusAula || '-'
      });
    });

    const loading = document.getElementById('modal-prof-loading');
    const content = document.getElementById('modal-prof-content');
    const tbody   = document.getElementById('modal-prof-tbody');

    const codigos = Object.keys(grupos);
    if (codigos.length === 0) {
      loading.innerHTML = '<p class="text-gray-400 text-sm">Nenhum professor encontrado para este mês</p>';
      return;
    }

    let totalGeral = 0;
    let html = '';

    codigos.forEach(codigo => {
      const g      = grupos[codigo];
      const pacote = mapPacotes[codigo] || {};
      const nome   = (g.nomeCliente || '').trim().split(/\s+/).slice(0, 2).join(' ') || '-';
      const duracao = pacote.SomatorioDuracaoAulas || '-';
      totalGeral += g.totalValor;

      html += `
        <tr class="border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition-colors" data-codigo="${codigo}">
          <td class="px-4 py-3 text-sm font-medium text-gray-800">${nome}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${duracao}</td>
          <td class="px-4 py-3 text-sm text-gray-600 text-center">${g.quantidade}</td>
          <td class="px-4 py-3 text-sm font-semibold text-red-600 text-right">${formatarMoeda(g.totalValor)}</td>
        </tr>`;
    });

    html += `
      <tr class="bg-gray-50 border-t-2 border-gray-300">
        <td class="px-4 py-3 text-sm font-bold text-gray-800" colspan="3">Total</td>
        <td class="px-4 py-3 text-sm font-bold text-red-600 text-right">${formatarMoeda(totalGeral)}</td>
      </tr>`;

    tbody.innerHTML = html;

    tbody.querySelectorAll('tr[data-codigo]').forEach(tr => {
      tr.addEventListener('click', () => {
        const codigo = tr.dataset.codigo;
        fecharModal();
        if (typeof abrirDetalhesContratacaoPagamento === 'function') {
          abrirDetalhesContratacaoPagamento(codigo);
        } else {
          console.warn('abrirDetalhesContratacaoPagamento não disponível');
        }
      });
    });

    // ─── Aba Professores ───
    const tbodyProf = document.getElementById('modal-prof-professores-tbody');
    const listaProf = Object.keys(gruposProf)
      .map(cpf => ({ cpf, ...gruposProf[cpf] }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    let totalGeralProf = 0;
    let htmlProf = '';

    listaProf.forEach(p => {
      totalGeralProf += p.totalValor;
      htmlProf += `
        <tr class="border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition-colors" data-cpf-prof="${p.cpf}">
          <td class="px-4 py-3 text-sm font-medium text-gray-800">${p.nome}</td>
          <td class="px-4 py-3 text-sm text-gray-600 text-center">${p.quantidade}</td>
          <td class="px-4 py-3 text-sm font-semibold text-red-600 text-right">${formatarMoeda(p.totalValor)}</td>
        </tr>`;
    });

    htmlProf += `
      <tr class="bg-gray-50 border-t-2 border-gray-300">
        <td class="px-4 py-3 text-sm font-bold text-gray-800" colspan="2">Total</td>
        <td class="px-4 py-3 text-sm font-bold text-red-600 text-right">${formatarMoeda(totalGeralProf)}</td>
      </tr>`;

    tbodyProf.innerHTML = htmlProf;

    tbodyProf.querySelectorAll('tr[data-cpf-prof]').forEach(tr => {
      tr.addEventListener('click', () => {
        const p = gruposProf[tr.dataset.cpfProf];
        abrirModalAulasProfessor(p.nome, mes, ano, p.aulas);
      });
    });

    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }).catch(err => {
    console.error('Erro ao carregar modal de professores:', err);
    document.getElementById('modal-prof-loading').innerHTML =
      '<p class="text-red-500 text-sm">Erro ao carregar dados</p>';
  });
}

// ─── Modal Aulas do Professor (detalhe, aberto a partir da aba Professores) ──

function abrirModalAulasProfessor(nomeProfessor, mes, ano, aulas) {
  const existing = document.getElementById('modal-aulas-professor');
  if (existing) existing.remove();

  let sortKey = 'data';
  let sortAsc = true;

  const modalEl = document.createElement('div');
  modalEl.id = 'modal-aulas-professor';
  modalEl.className = 'modal-overlay';
  modalEl.style.zIndex = '1100';
  modalEl.innerHTML = `
    <div class="modal-container" style="max-width: 760px;">
      <div class="modal-header">
        <div>
          <h3 class="text-lg font-lexend font-bold text-gray-800">${nomeProfessor}</h3>
          <p class="text-sm text-gray-500 mt-0.5">${PREV_MESES[mes]} ${ano} — Aulas do mês</p>
        </div>
        <button id="btn-fechar-modal-aulas-prof" class="text-gray-400 hover:text-gray-600 transition-colors p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body" style="padding: 0;">
        <div class="overflow-y-auto" style="max-height: 460px;">
          <table class="w-full">
            <thead class="sticky top-0 bg-gray-50">
              <tr class="border-b border-gray-200">
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none" data-sort-key="codigo">Nº Pacote<span class="sort-arrow"></span></th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none" data-sort-key="data">Data da Aula<span class="sort-arrow"></span></th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none" data-sort-key="nomeCliente">Nome Cliente<span class="sort-arrow"></span></th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none" data-sort-key="duracao">Duração<span class="sort-arrow"></span></th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 cursor-pointer select-none" data-sort-key="valor">Valor da Aula<span class="sort-arrow"></span></th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none" data-sort-key="status">Status<span class="sort-arrow"></span></th>
              </tr>
            </thead>
            <tbody id="modal-aulas-prof-tbody"></tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer" style="justify-content: space-between; align-items: center;">
        <p id="modal-aulas-prof-total" class="text-sm font-lexend font-bold text-gray-800">TOTAL: R$ 0,00</p>
        <button id="btn-fechar-modal-aulas-prof-footer" class="py-2 px-4 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
          Fechar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  const fecharModal = () => modalEl.remove();
  document.getElementById('btn-fechar-modal-aulas-prof').addEventListener('click', fecharModal);
  document.getElementById('btn-fechar-modal-aulas-prof-footer').addEventListener('click', fecharModal);
  modalEl.addEventListener('click', e => { if (e.target === modalEl) fecharModal(); });

  function renderLinhas() {
    const ordenadas = [...aulas].sort((a, b) => {
      let cmp;
      if (sortKey === 'data')       cmp = parseDateBR(a.data) - parseDateBR(b.data);
      else if (sortKey === 'valor') cmp = a.valor - b.valor;
      else                          cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), 'pt-BR');
      return sortAsc ? cmp : -cmp;
    });

    const tbody = document.getElementById('modal-aulas-prof-tbody');
    if (!tbody) return;
    tbody.innerHTML = ordenadas.map(a => `
      <tr class="border-b border-gray-100">
        <td class="px-4 py-2.5 text-sm text-gray-700">${a.codigo || '-'}</td>
        <td class="px-4 py-2.5 text-sm text-gray-700">${a.data}</td>
        <td class="px-4 py-2.5 text-sm text-gray-800">${a.nomeCliente}</td>
        <td class="px-4 py-2.5 text-sm text-gray-600">${a.duracao}</td>
        <td class="px-4 py-2.5 text-sm font-medium text-red-600 text-right">${formatarMoeda(a.valor)}</td>
        <td class="px-4 py-2.5 text-sm text-gray-600">${a.status}</td>
      </tr>`).join('');

    const totalEl = document.getElementById('modal-aulas-prof-total');
    if (totalEl) {
      const total = aulas.reduce((soma, a) => soma + a.valor, 0);
      totalEl.textContent = `TOTAL: ${formatarMoeda(total)}`;
    }

    modalEl.querySelectorAll('th[data-sort-key]').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      if (!arrow) return;
      arrow.textContent = th.dataset.sortKey === sortKey ? (sortAsc ? ' ▲' : ' ▼') : '';
    });
  }

  modalEl.querySelectorAll('th[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = true; }
      renderLinhas();
    });
  });

  renderLinhas();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToastPrevisao(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500' };
  const toast = document.createElement('div');
  toast.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-lexend transition-all`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

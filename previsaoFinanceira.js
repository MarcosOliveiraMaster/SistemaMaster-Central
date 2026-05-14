console.log('✅ previsaoFinanceira.js carregado');

const PREV_MESES   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const PREV_MES_MIN = new Date().getMonth();
const PREV_ANO_MIN = new Date().getFullYear();

let prevMesAtual      = new Date().getMonth();
let prevAnoAtual      = new Date().getFullYear();
let prevModoGrafico   = 'individual'; // 'individual' | 'montante'
let prevChartInstance = null;
let prevShowMedia     = false;
let prevShowMeta      = false;
let prevEntradasCache = [];

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

    <!-- Botões de navegação das tabelas -->
    <div class="flex gap-0 mb-4">
      <button class="py-1.5 px-4 text-sm font-medium rounded-l-lg transition-all bg-orange-500 text-white hover:bg-orange-600" id="btn-tabela-entradas">
        Entradas
      </button>
      <button class="py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-tabela-saidas">
        Saídas
      </button>
      <button class="py-1.5 px-4 text-sm font-medium rounded-r-lg transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" id="btn-tabela-saldo">
        Saldo
      </button>
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
  carregarEntradasPrevistas(prevMesAtual, prevAnoAtual);
};

// ─── Gráfico ──────────────────────────────────────────────────────────────────

function atualizarGrafico(entradas) {
  const canvas = document.getElementById('canvas-previsao');
  if (!canvas || typeof Chart === 'undefined') return;

  if (prevChartInstance) {
    prevChartInstance.destroy();
    prevChartInstance = null;
  }

  const fontBase = { family: 'Lexend', size: 11 };
  const tickColor = '#6b7280';
  const moedaFmt  = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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

  const options = (tooltipLabel) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        callbacks: { label: ctx => ' ' + (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + moedaFmt(ctx.parsed.y) }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: fontBase, color: tickColor }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: fontBase, color: tickColor, callback: moedaFmt }
      }
    }
  });

  if (prevModoGrafico === 'individual') {
    const labels  = entradas.map(e => e.data);
    const valores = entradas.map(e => e.valor);
    const media   = entradas.length > 0 ? valores.reduce((s, v) => s + v, 0) / entradas.length : 0;

    const datasets = [{
      data: valores,
      borderColor: 'rgba(249, 115, 22, 1)',
      backgroundColor: 'rgba(249, 115, 22, 0.08)',
      pointBackgroundColor: 'rgba(249, 115, 22, 1)',
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.4,
      fill: false
    }];

    if (prevShowMedia) datasets.push(linhaConstante(labels, media,  'rgba(139, 92, 246, 1)', 'Média'));
    if (prevShowMeta)  datasets.push(linhaConstante(labels, 4000,   'rgba(34, 197, 94, 1)',  'Meta'));

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
      borderColor: 'rgba(249, 115, 22, 1)',
      backgroundColor: 'rgba(249, 115, 22, 0.12)',
      pointBackgroundColor: 'rgba(249, 115, 22, 1)',
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: true
    }];

    if (prevShowMedia) datasets.push(linhaConstante(datas, mediaAcum, 'rgba(139, 92, 246, 1)', 'Média'));
    if (prevShowMeta)  datasets.push(linhaConstante(datas, 4000,      'rgba(34, 197, 94, 1)',  'Meta'));

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
    atualizarGrafico([]);
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
        atualizarGrafico([]);
        return;
      }

      let total = 0;
      tbody.innerHTML = entradas.map((e, i) => {
        total += e.valor;
        return `
          <tr class="border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition-colors" data-entrada-idx="${i}">
            <td class="px-3 py-2.5 text-sm text-gray-800">${e.descricao}</td>
            <td class="px-3 py-2.5 text-sm font-medium text-green-600">${formatarMoeda(e.valor)}</td>
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
      atualizarGrafico(entradas);
    })
    .catch(err => {
      console.error('Erro ao carregar entradas previstas:', err);
      tbody.innerHTML = estadoVazioEntradas('Erro ao carregar dados');
      atualizarGrafico([]);
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
  const noMinimo = prevMesAtual === PREV_MES_MIN && prevAnoAtual === PREV_ANO_MIN;
  btn.disabled = noMinimo;
  btn.className = noMinimo
    ? 'p-1.5 transition-all rounded-lg border border-gray-200 text-gray-300 cursor-not-allowed'
    : 'p-1.5 text-gray-500 hover:text-orange-500 transition-all rounded-lg hover:bg-orange-50 border border-gray-300';
}

// ─── Estados dos botões ───────────────────────────────────────────────────────

function setTabelaBtns(aba) {
  const ativo   = 'py-1.5 px-4 text-sm font-medium transition-all bg-orange-500 text-white hover:bg-orange-600';
  const inativo = 'py-1.5 px-4 text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200';
  document.getElementById('btn-tabela-entradas').className = (aba === 'entradas' ? ativo : inativo) + ' rounded-l-lg';
  document.getElementById('btn-tabela-saidas').className   = (aba === 'saidas'   ? ativo : inativo);
  document.getElementById('btn-tabela-saldo').className    = (aba === 'saldo'    ? ativo : inativo) + ' rounded-r-lg';
}

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
  document.getElementById('btn-tabela-entradas')?.addEventListener('click', () => setTabelaBtns('entradas'));
  document.getElementById('btn-tabela-saidas')?.addEventListener('click',   () => setTabelaBtns('saidas'));
  document.getElementById('btn-tabela-saldo')?.addEventListener('click',    () => setTabelaBtns('saldo'));

  document.getElementById('btn-prev-mes-anterior')?.addEventListener('click', () => {
    if (prevMesAtual === PREV_MES_MIN && prevAnoAtual === PREV_ANO_MIN) return;
    prevMesAtual--;
    if (prevMesAtual < 0) { prevMesAtual = 11; prevAnoAtual--; }
    atualizarLabelMes();
    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual);
  });

  document.getElementById('btn-prev-mes-proximo')?.addEventListener('click', () => {
    prevMesAtual++;
    if (prevMesAtual > 11) { prevMesAtual = 0; prevAnoAtual++; }
    atualizarLabelMes();
    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual);
  });

  document.getElementById('btn-prev-entradas')?.addEventListener('click', () => setMetricaBtns('entradas'));
  document.getElementById('btn-prev-saidas')?.addEventListener('click',   () => setMetricaBtns('saidas'));
  document.getElementById('btn-prev-saldo')?.addEventListener('click',    () => setMetricaBtns('saldo'));

  document.getElementById('btn-prev-individual')?.addEventListener('click', () => {
    prevModoGrafico = 'individual';
    setModoGraficoBtns('individual');
    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual);
  });

  document.getElementById('btn-prev-montante')?.addEventListener('click', () => {
    prevModoGrafico = 'montante';
    setModoGraficoBtns('montante');
    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual);
  });

  document.getElementById('btn-prev-media')?.addEventListener('click', () => {
    prevShowMedia = !prevShowMedia;
    setToggleBtnEstado('btn-prev-media', prevShowMedia, 'rgba(139, 92, 246, 1)');
    atualizarGrafico(prevEntradasCache);
  });

  document.getElementById('btn-prev-meta')?.addEventListener('click', () => {
    prevShowMeta = !prevShowMeta;
    setToggleBtnEstado('btn-prev-meta', prevShowMeta, 'rgba(34, 197, 94, 1)');
    atualizarGrafico(prevEntradasCache);
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

    carregarEntradasPrevistas(prevMesAtual, prevAnoAtual).finally(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.style.opacity = '';
    });
  });
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

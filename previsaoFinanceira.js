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

  const options = () => ({
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
  prevEntradasCache.forEach(e => { porDataE[e.data] = (porDataE[e.data] || 0) + e.valor; });

  const porDataS = {};
  prevSaidasCache.forEach(s => { porDataS[s.data] = (porDataS[s.data] || 0) + s.valor; });

  const todasDatas = [...new Set([...Object.keys(porDataE), ...Object.keys(porDataS)])];
  const saldoEntries = todasDatas.map(d => ({
    data: d,
    valor: (porDataE[d] || 0) - (porDataS[d] || 0)
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

  return Promise.all([promInvest, promAulas])
    .then(([snapInvest, snapAulas]) => {
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
        if (docMes === mes && docAno === ano) {
          const valorAula = parseFloat(d.ValorAula) || 0;
          totalProfessores += valorAula;
          const dateStr = `${match[1]}/${match[2]}/${match[3]}`;
          saidasChart.push({ descricao: `Aula - ${d.nomeCliente || ''}`, valor: valorAula, data: dateStr });
        }
      });

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
        <div id="modal-prof-content" class="hidden overflow-y-auto" style="max-height: 460px;">
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
      </div>
      <div class="modal-footer" style="justify-content: space-between; align-items: center;">
        <p class="text-xs text-gray-400">Clique em um cliente para ver os detalhes da contratação</p>
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

  if (!window.BANCO || !window.BANCO.db) {
    document.getElementById('modal-prof-loading').innerHTML =
      '<p class="text-red-500 text-sm">Firebase não disponível</p>';
    return;
  }

  Promise.all([
    window.BANCO.db.collection('BancoDeAulas-Lista').get(),
    window.BANCO.db.collection('BancoDeAulas').get()
  ]).then(([snapLista, snapBanco]) => {
    const mapPacotes = {};
    snapBanco.forEach(doc => { mapPacotes[doc.id] = doc.data(); });

    const grupos = {};
    snapLista.forEach(doc => {
      const d = doc.data();
      if (!d.data) return;
      const match = d.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return;
      if (parseInt(match[2]) - 1 !== mes || parseInt(match[3]) !== ano) return;

      const codigo = d.codigoContratacao || (d['id-Aula'] || '').substring(0, 4);
      if (!codigo) return;

      if (!grupos[codigo]) {
        grupos[codigo] = { nomeCliente: d.nomeCliente || '', quantidade: 0, totalValor: 0 };
      }
      grupos[codigo].quantidade++;
      grupos[codigo].totalValor += parseFloat(d.ValorAula) || 0;
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

    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }).catch(err => {
    console.error('Erro ao carregar modal de professores:', err);
    document.getElementById('modal-prof-loading').innerHTML =
      '<p class="text-red-500 text-sm">Erro ao carregar dados</p>';
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

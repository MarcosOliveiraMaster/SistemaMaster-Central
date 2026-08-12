/**
 * CALENDÁRIO MASTER — seção "calendario"
 *
 * Orquestra a seção Calendário Master: barra de filtros (toggle professor/cliente,
 * dropdown de nomes com busca e multi-seleção, seletor de mês/ano) e uma grade
 * mensal com as aulas dos selecionados. Clicar numa aula abre o modal
 * "Detalhes da Contratação".
 *
 * Somente leitura: nada é criado ou editado por esta tela.
 *
 * Fonte dos dados: BANCO.fetchBancoDeAulasListaBatch() — traz toda a coleção
 * BancoDeAulas-Lista de uma vez e já é cacheada, então trocar de mês ou de seleção
 * não gera leitura nova no Firestore.
 *
 * Reaproveita a grade .cal-master-* do style.css e o abridor de modal
 * abrirDetalhesContratacaoPainelCentral() de functions-PainelCentral.js.
 */
const CalendarioBusca = (function () {
  'use strict';

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Aulas nesses status aparecem esmaecidas, para não se confundirem com aula ativa.
  const STATUS_INATIVOS = ['Cancelada', 'Reagendada'];

  const SEM_PROFESSOR = 'A definir';
  const SEM_CLIENTE = 'Sem cliente';

  // Paleta para diferenciar os selecionados, derivada de CORES_CAL
  // (functions-calendario-visual.js) e replicada aqui para o módulo ficar autocontido.
  // Sem verde de propósito: verde é reservado para feriado.
  const PALETA = ['#3B82F6', '#F97316', '#EF4444', '#8B5CF6',
                  '#EC4899', '#F59E0B', '#6366F1', '#0EA5E9'];

  // Cor única dos feriados, em qualquer esfera.
  const COR_FERIADO = '#16A34A';

  const LARGURA_DROPDOWN_MIN = 220;
  const LARGURA_DROPDOWN_MAX = 440;
  // Espaço do checkbox, do ponto de cor, dos paddings e da barra de rolagem.
  const LARGURA_DROPDOWN_EXTRA = 76;

  const estado = {
    modo: 'professor',            // 'professor' | 'cliente'
    selecionados: new Set(),
    mes: new Date().getMonth(),   // 0-11
    ano: new Date().getFullYear(),
    termoBusca: '',
    aulas: null,                  // cache local do batch
    carregando: false,
    erro: null
  };

  /* ──────────────── helpers locais ────────────────
     Prefixados com _cb e mantidos aqui de propósito: escapeHtml está definido em
     três arquivos do projeto e depender de qual prevalece seria frágil. */

  function _cbEsc(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Aceita "12/08/2026" e também "seg - 12/08/2026".
  function _cbParseData(dataStr) {
    if (!dataStr) return null;
    const m = String(dataStr).match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }

  // "Maria Eduarda Silva Costa" -> "Maria Eduarda"
  function _cbDoisNomes(nome) {
    if (!nome) return '';
    const partes = String(nome).trim().split(/\s+/);
    return partes.length <= 2 ? partes.join(' ') : `${partes[0]} ${partes[1]}`;
  }

  function _cbHorarioMinutos(hhmm) {
    const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  }

  // Nome pelo qual a aula é agrupada, conforme o lado ativo do toggle.
  function _cbNomeChave(aula, modo) {
    const bruto = modo === 'professor' ? aula.professor : aula.nomeCliente;
    const limpo = String(bruto || '').trim();
    if (!limpo) return modo === 'professor' ? SEM_PROFESSOR : SEM_CLIENTE;
    return limpo;
  }

  function _cbEstaInativa(aula) {
    return STATUS_INATIVOS.indexOf(String(aula.StatusAula || '').trim()) !== -1;
  }

  /**
   * Mede a largura do maior nome para dimensionar o dropdown. Usa o canvas quando
   * disponível e cai para uma estimativa por caractere quando não há contexto 2D.
   */
  function _cbMedirTexto(texto, fonte) {
    try {
      if (!_cbMedirTexto._ctx) {
        const canvas = document.createElement('canvas');
        _cbMedirTexto._ctx = canvas.getContext ? canvas.getContext('2d') : null;
      }
      if (_cbMedirTexto._ctx) {
        _cbMedirTexto._ctx.font = fonte || '14px sans-serif';
        return _cbMedirTexto._ctx.measureText(String(texto)).width;
      }
    } catch (e) { /* segue para a estimativa */ }
    return String(texto).length * 7.2;
  }

  /* ──────────────── dados ──────────────── */

  async function carregarAulas(forceRefresh) {
    if (!window.BANCO || typeof BANCO.fetchBancoDeAulasListaBatch !== 'function') {
      throw new Error('Módulo BANCO não disponível.');
    }
    estado.aulas = await BANCO.fetchBancoDeAulasListaBatch(!!forceRefresh);
    return estado.aulas;
  }

  function aulasDoMes() {
    if (!Array.isArray(estado.aulas)) return [];
    return estado.aulas.filter(aula => {
      const d = _cbParseData(aula.data);
      return d && d.getMonth() === estado.mes && d.getFullYear() === estado.ano;
    });
  }

  // Nomes distintos com aula no mês exibido, ordenados em pt-BR.
  function opcoesDoMes() {
    const nomes = new Set();
    aulasDoMes().forEach(aula => nomes.add(_cbNomeChave(aula, estado.modo)));
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  // Anos com alguma aula, sempre incluindo o ano corrente e o exibido.
  function anosDisponiveis() {
    const anos = new Set([new Date().getFullYear(), estado.ano]);
    (estado.aulas || []).forEach(aula => {
      const d = _cbParseData(aula.data);
      if (d) anos.add(d.getFullYear());
    });
    return [...anos].sort((a, b) => a - b);
  }

  function corDoNome(nome) {
    const ordenados = [...estado.selecionados].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const idx = ordenados.indexOf(nome);
    return idx === -1 ? PALETA[0] : PALETA[idx % PALETA.length];
  }

  /* ──────────────── shell da seção ──────────────── */

  function montarShell(container) {
    container.innerHTML = `
      <div class="cbusca-wrapper">
        <div class="cbusca-filtros">

          <div class="cbusca-campo">
            <label class="cbusca-label">Filtrar por</label>
            <div class="cbusca-toggle" id="cbusca-toggle">
              <button type="button" class="cbusca-toggle-opt" data-modo="professor">
                <i class="fas fa-chalkboard-teacher mr-1"></i>Professor
              </button>
              <button type="button" class="cbusca-toggle-opt" data-modo="cliente">
                <i class="fas fa-user mr-1"></i>Cliente
              </button>
            </div>
          </div>

          <div class="cbusca-campo">
            <label class="cbusca-label" id="cbusca-dd-label">Professores</label>
            <div class="cbusca-dd-wrapper" id="cbusca-dd-wrapper">
              <button type="button" class="cbusca-dd-btn" id="cbusca-dd-btn">
                <span id="cbusca-dd-texto">Selecione...</span>
                <i class="fas fa-chevron-down text-xs ml-2"></i>
              </button>
              <div class="cbusca-dd-menu hidden" id="cbusca-dd-menu">
                <div class="cbusca-dd-busca-wrap">
                  <i class="fas fa-search text-xs text-gray-400"></i>
                  <input type="text" id="cbusca-dd-busca" class="cbusca-dd-busca"
                         placeholder="Buscar..." autocomplete="off">
                </div>
                <div class="cbusca-dd-lista" id="cbusca-dd-lista"></div>
              </div>
            </div>
          </div>

          <div class="cbusca-campo">
            <label class="cbusca-label">Mês</label>
            <select id="cbusca-mes" class="cbusca-select"></select>
          </div>

          <div class="cbusca-campo">
            <label class="cbusca-label">Ano</label>
            <select id="cbusca-ano" class="cbusca-select"></select>
          </div>

          <div class="cbusca-campo">
            <label class="cbusca-label">&nbsp;</label>
            <button type="button" id="cbusca-limpar" class="btn-secondary btn-compact">
              <i class="fas fa-eraser mr-2"></i>Limpar
            </button>
          </div>

        </div>

        <div id="cbusca-resumo" class="cbusca-resumo"></div>
        <div id="cbusca-conteudo"></div>
      </div>
    `;
  }

  /* ──────────────── filtros ──────────────── */

  function renderToggle() {
    document.querySelectorAll('#cbusca-toggle .cbusca-toggle-opt').forEach(btn => {
      btn.classList.toggle('cbusca-toggle-ativo', btn.dataset.modo === estado.modo);
    });
    const label = document.getElementById('cbusca-dd-label');
    if (label) label.textContent = estado.modo === 'professor' ? 'Professores' : 'Clientes';
  }

  function renderSelectsData() {
    const selMes = document.getElementById('cbusca-mes');
    const selAno = document.getElementById('cbusca-ano');
    if (selMes) {
      selMes.innerHTML = MESES
        .map((m, i) => `<option value="${i}"${i === estado.mes ? ' selected' : ''}>${m}</option>`)
        .join('');
    }
    if (selAno) {
      selAno.innerHTML = anosDisponiveis()
        .map(a => `<option value="${a}"${a === estado.ano ? ' selected' : ''}>${a}</option>`)
        .join('');
    }
  }

  function renderDropdown() {
    const lista = document.getElementById('cbusca-dd-lista');
    const menu = document.getElementById('cbusca-dd-menu');
    const texto = document.getElementById('cbusca-dd-texto');
    if (!lista) return;

    const opcoes = opcoesDoMes();

    // Selecionados que não têm aula no mês exibido continuam na lista, marcados.
    // Trocar de mês não deve destruir o filtro que o usuário montou.
    const orfaos = [...estado.selecionados].filter(n => opcoes.indexOf(n) === -1);
    const todas = opcoes.concat(orfaos.sort((a, b) => a.localeCompare(b, 'pt-BR')));

    // Largura acompanha o maior nome da lista.
    if (menu) {
      const fonte = (window.getComputedStyle && getComputedStyle(lista).font) || '14px sans-serif';
      let maior = 0;
      todas.forEach(n => { maior = Math.max(maior, _cbMedirTexto(n, fonte)); });
      const largura = Math.min(LARGURA_DROPDOWN_MAX,
                      Math.max(LARGURA_DROPDOWN_MIN, Math.ceil(maior) + LARGURA_DROPDOWN_EXTRA));
      menu.style.width = largura + 'px';
    }

    const termo = estado.termoBusca.trim().toLowerCase();
    const visiveis = termo
      ? todas.filter(n => n.toLowerCase().indexOf(termo) !== -1)
      : todas;

    if (!todas.length) {
      lista.innerHTML = `<div class="cbusca-dd-vazio">Nenhuma aula neste mês</div>`;
    } else if (!visiveis.length) {
      lista.innerHTML = `<div class="cbusca-dd-vazio">Nenhum nome corresponde à busca</div>`;
    } else {
      lista.innerHTML = visiveis.map(nome => {
        const marcado = estado.selecionados.has(nome);
        const semAulas = opcoes.indexOf(nome) === -1;
        const cor = marcado ? corDoNome(nome) : 'transparent';
        return `
          <label class="cbusca-dd-item${semAulas ? ' cbusca-dd-item-vazio' : ''}"
                 title="${_cbEsc(nome)}${semAulas ? ' — sem aulas neste mês' : ''}">
            <input type="checkbox" class="cbusca-dd-chk" data-nome="${_cbEsc(nome)}"${marcado ? ' checked' : ''}>
            <span class="cbusca-dd-cor" style="background:${cor}"></span>
            <span class="cbusca-dd-nome">${_cbEsc(nome)}</span>
            ${semAulas ? '<span class="cbusca-dd-tag">sem aulas</span>' : ''}
          </label>
        `;
      }).join('');
    }

    if (texto) {
      const n = estado.selecionados.size;
      texto.textContent = n === 0
        ? 'Selecione...'
        : (n === 1 ? [...estado.selecionados][0] : `${n} selecionados`);
    }
  }

  function renderResumo() {
    const el = document.getElementById('cbusca-resumo');
    if (!el) return;
    if (estado.selecionados.size === 0) { el.innerHTML = ''; return; }
    const total = aulasFiltradas().length;
    const rotulo = estado.modo === 'professor' ? 'professor(es)' : 'cliente(s)';
    el.innerHTML = `
      <i class="fas fa-circle-info text-orange-500 mr-1"></i>
      <strong>${total}</strong> aula(s) em ${MESES[estado.mes]} ${estado.ano}
      para ${estado.selecionados.size} ${rotulo} selecionado(s).
    `;
  }

  /* ──────────────── calendário ──────────────── */

  function aulasFiltradas() {
    if (estado.selecionados.size === 0) return [];
    return aulasDoMes().filter(a => estado.selecionados.has(_cbNomeChave(a, estado.modo)));
  }

  function renderConteudo() {
    const alvo = document.getElementById('cbusca-conteudo');
    if (!alvo) return;

    if (estado.carregando) {
      alvo.innerHTML = `
        <div class="cbusca-placeholder">
          <i class="fas fa-spinner fa-spin text-orange-500 text-2xl mb-3"></i>
          <p>Carregando aulas...</p>
        </div>`;
      return;
    }

    if (estado.erro) {
      alvo.innerHTML = `
        <div class="cbusca-placeholder">
          <i class="fas fa-triangle-exclamation text-3xl text-red-300 mb-3"></i>
          <p>${_cbEsc(estado.erro)}</p>
        </div>`;
      return;
    }

    // Sem seleção, nada de grade.
    if (estado.selecionados.size === 0) {
      const alvoTexto = estado.modo === 'professor' ? 'um ou mais professores' : 'um ou mais clientes';
      alvo.innerHTML = `
        <div class="cbusca-placeholder">
          <i class="fas fa-calendar-days text-3xl text-gray-300 mb-3"></i>
          <h3 class="font-lexend text-base mb-1">Selecione ${alvoTexto}</h3>
          <p class="text-sm text-gray-500">O calendário aparece assim que houver uma seleção.</p>
        </div>`;
      return;
    }

    alvo.innerHTML = `<div class="cal-master-grid" id="cbusca-grid"></div>`;
    renderGrade(document.getElementById('cbusca-grid'));
  }

  function renderGrade(grid) {
    if (!grid) return;

    const eventosPorDia = {};
    aulasFiltradas().forEach(aula => {
      const d = _cbParseData(aula.data);
      if (!d) return;
      const dia = d.getDate();
      if (!eventosPorDia[dia]) eventosPorDia[dia] = [];
      eventosPorDia[dia].push(aula);
    });
    Object.keys(eventosPorDia).forEach(dia => {
      eventosPorDia[dia].sort((a, b) => _cbHorarioMinutos(a.horario) - _cbHorarioMinutos(b.horario));
    });

    // Feriados são independentes do filtro: aparecem sempre que a grade é montada.
    const feriadosPorDia = (typeof Feriados !== 'undefined' && Feriados.porDia)
      ? Feriados.porDia(estado.mes, estado.ano)
      : {};

    const primeiroDia = new Date(estado.ano, estado.mes, 1).getDay();
    const diasNoMes = new Date(estado.ano, estado.mes + 1, 0).getDate();
    const diasMesAnterior = new Date(estado.ano, estado.mes, 0).getDate();

    let html = DIAS_SEMANA.map(d => `<div class="cal-master-weekday">${d}</div>`).join('');

    for (let i = primeiroDia - 1; i >= 0; i--) {
      html += `<div class="cal-master-day cal-master-day-other"><div class="cal-master-day-num">${diasMesAnterior - i}</div></div>`;
    }

    const hoje = new Date();
    const mesCorrente = hoje.getFullYear() === estado.ano && hoje.getMonth() === estado.mes;

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const doDia = eventosPorDia[dia] || [];
      const feriadosDoDia = feriadosPorDia[dia] || [];
      const classeHoje = (mesCorrente && dia === hoje.getDate()) ? ' cal-master-day-hoje' : '';
      html += `
        <div class="cal-master-day${classeHoje}">
          <div class="cal-master-day-num">${dia}</div>
          <div class="cal-master-day-events">
            ${feriadosDoDia.length ? cardFeriadoHtml(dia, feriadosDoDia) : ''}
            ${doDia.map(cardHtml).join('')}
          </div>
        </div>`;
    }

    const restante = (7 - ((primeiroDia + diasNoMes) % 7)) % 7;
    for (let dia = 1; dia <= restante; dia++) {
      html += `<div class="cal-master-day cal-master-day-other"><div class="cal-master-day-num">${dia}</div></div>`;
    }

    grid.innerHTML = html;
  }

  function cardHtml(aula) {
    const cor = corDoNome(_cbNomeChave(aula, estado.modo));
    const inativa = _cbEstaInativa(aula);
    const codigo = String(aula.codigoContratacao || '').trim();

    const linhas = [
      aula.horario || '--',
      `Cliente: ${_cbDoisNomes(aula.nomeCliente) || '--'}`,
      `Prof.: ${_cbDoisNomes(aula.professor) || '--'}`
    ];

    const titulo = [
      aula.data || '',
      aula.horario || '',
      aula.materia || '',
      aula.nomeCliente || '',
      aula.professor || '',
      aula.StatusAula || ''
    ].filter(Boolean).join(' • ');

    return `
      <div class="cal-master-event cbusca-event${inativa ? ' cbusca-event-inativo' : ''}${codigo ? '' : ' cbusca-event-sem-codigo'}"
           style="background:${cor}"
           data-codigo="${_cbEsc(codigo)}"
           title="${_cbEsc(titulo)}">
        ${linhas.map(l => `<span class="cal-master-event-line">${_cbEsc(l)}</span>`).join('')}
      </div>`;
  }

  /**
   * Card verde do feriado. Uma mesma data pode acumular mais de um feriado
   * (29/06 é São Pedro no estado e Marechal Floriano Peixoto no município):
   * o card mostra o primeiro e sinaliza o resto, e o modal lista todos.
   */
  function cardFeriadoHtml(dia, feriados) {
    const rotulo = feriados.length > 1
      ? `${feriados[0].nome} +${feriados.length - 1}`
      : feriados[0].nome;
    const titulo = feriados.map(f => `${f.nome} (${f.esfera})`).join(' • ');
    return `
      <div class="cal-master-event cbusca-feriado"
           style="background:${COR_FERIADO}"
           data-feriado-dia="${dia}"
           title="${_cbEsc(titulo)}">
        <span class="cal-master-event-line">
          <i class="fas fa-star" style="font-size:0.55rem;margin-right:3px;"></i>${_cbEsc(rotulo)}
        </span>
      </div>`;
  }

  /** Modal do feriado: nome, esfera e botão de fechar. */
  function abrirModalFeriado(dia) {
    const feriados = (typeof Feriados !== 'undefined' && Feriados.doDia)
      ? Feriados.doDia(dia, estado.mes, estado.ano)
      : [];
    if (!feriados.length) return;

    const anterior = document.getElementById('cbusca-modal-feriado');
    if (anterior) anterior.remove();

    const dataFmt = `${String(dia).padStart(2, '0')}/${String(estado.mes + 1).padStart(2, '0')}/${estado.ano}`;

    const modal = document.createElement('div');
    modal.id = 'cbusca-modal-feriado';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1000';
    modal.innerHTML = `
      <div class="modal-container" style="max-width: 420px;">
        <div class="modal-header">
          <div>
            <h3 class="text-lg font-lexend font-bold text-gray-800">
              ${feriados.length > 1 ? 'Feriados' : 'Feriado'}
            </h3>
            <p class="text-sm text-gray-500 mt-0.5">${dataFmt}</p>
          </div>
          <button type="button" id="cbusca-modal-feriado-x"
                  class="text-gray-400 hover:text-gray-600 transition-colors p-1" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          ${feriados.map(f => `
            <div class="cbusca-feriado-item">
              <span class="cbusca-feriado-bolinha"></span>
              <div>
                <p class="cbusca-feriado-nome">${_cbEsc(f.nome)}</p>
                <p class="cbusca-feriado-esfera">${_cbEsc(f.esfera)}</p>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="modal-footer" style="justify-content: flex-end;">
          <button type="button" id="cbusca-modal-feriado-fechar"
                  class="py-2 px-4 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
            Fechar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const fechar = () => {
      modal.remove();
      document.removeEventListener('keydown', onEsc);
    };
    function onEsc(e) { if (e.key === 'Escape') fechar(); }

    modal.querySelector('#cbusca-modal-feriado-x').addEventListener('click', fechar);
    modal.querySelector('#cbusca-modal-feriado-fechar').addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
    document.addEventListener('keydown', onEsc);
  }

  /**
   * Abre o modal "Detalhes da Contratação" reaproveitando o abridor já existente.
   * Isolado numa função própria para servir de ponto de teste.
   */
  function abrirDetalhes(codigoContratacao) {
    if (!codigoContratacao) {
      if (typeof showToast === 'function') {
        showToast('Esta aula não possui código de contratação vinculado.', 'warning');
      }
      return;
    }
    if (typeof abrirDetalhesContratacaoPainelCentral === 'function') {
      abrirDetalhesContratacaoPainelCentral(codigoContratacao);
    } else if (typeof showToast === 'function') {
      showToast('Módulo de detalhes da contratação não carregado.', 'error');
    }
  }

  /* ──────────────── eventos ──────────────── */

  function atualizarTudo() {
    renderToggle();
    renderDropdown();
    renderResumo();
    renderConteudo();
  }

  function ligarEventos(container) {
    // Toggle professor/cliente: exclusivo, e trocar de lado limpa a seleção.
    container.querySelectorAll('#cbusca-toggle .cbusca-toggle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const novo = btn.dataset.modo;
        if (novo === estado.modo) return;
        estado.modo = novo;
        estado.selecionados.clear();
        estado.termoBusca = '';
        const inputBusca = document.getElementById('cbusca-dd-busca');
        if (inputBusca) inputBusca.value = '';
        atualizarTudo();
      });
    });

    const ddBtn = document.getElementById('cbusca-dd-btn');
    const ddMenu = document.getElementById('cbusca-dd-menu');
    if (ddBtn && ddMenu) {
      ddBtn.addEventListener('click', e => {
        e.stopPropagation();
        ddMenu.classList.toggle('hidden');
        if (!ddMenu.classList.contains('hidden')) {
          const inputBusca = document.getElementById('cbusca-dd-busca');
          if (inputBusca) inputBusca.focus();
        }
      });
      document.addEventListener('click', e => {
        if (ddMenu.classList.contains('hidden')) return;
        const wrapper = document.getElementById('cbusca-dd-wrapper');
        if (wrapper && !wrapper.contains(e.target)) ddMenu.classList.add('hidden');
      });
    }

    const inputBusca = document.getElementById('cbusca-dd-busca');
    if (inputBusca) {
      inputBusca.addEventListener('input', function () {
        estado.termoBusca = this.value || '';
        renderDropdown();
      });
    }

    // Delegação: a lista é reconstruída a cada render.
    const lista = document.getElementById('cbusca-dd-lista');
    if (lista) {
      lista.addEventListener('change', e => {
        const chk = e.target.closest ? e.target.closest('.cbusca-dd-chk') : null;
        const alvo = chk || (e.target.classList && e.target.classList.contains('cbusca-dd-chk') ? e.target : null);
        if (!alvo) return;
        const nome = alvo.dataset.nome;
        if (!nome) return;
        if (alvo.checked) estado.selecionados.add(nome);
        else estado.selecionados.delete(nome);
        renderDropdown();
        renderResumo();
        renderConteudo();
      });
    }

    const selMes = document.getElementById('cbusca-mes');
    if (selMes) {
      selMes.addEventListener('change', function () {
        estado.mes = parseInt(this.value, 10);
        atualizarTudo();
      });
    }

    const selAno = document.getElementById('cbusca-ano');
    if (selAno) {
      selAno.addEventListener('change', function () {
        estado.ano = parseInt(this.value, 10);
        atualizarTudo();
      });
    }

    const btnLimpar = document.getElementById('cbusca-limpar');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        estado.selecionados.clear();
        estado.termoBusca = '';
        const busca = document.getElementById('cbusca-dd-busca');
        if (busca) busca.value = '';
        atualizarTudo();
      });
    }

    // Delegação no conteúdo: a grade é recriada a cada render.
    const conteudo = document.getElementById('cbusca-conteudo');
    if (conteudo) {
      conteudo.addEventListener('click', e => {
        if (!e.target.closest) return;
        // Feriado antes de aula: os dois são cards dentro do mesmo dia.
        const feriado = e.target.closest('.cbusca-feriado');
        if (feriado) {
          abrirModalFeriado(parseInt(feriado.dataset.feriadoDia, 10));
          return;
        }
        const card = e.target.closest('.cbusca-event');
        if (card) abrirDetalhes(card.dataset.codigo);
      });
    }
  }

  /* ──────────────── entrada ──────────────── */

  async function loadCalendarioMaster() {
    const container = document.getElementById('calendario');
    if (!container) return;

    montarShell(container);
    ligarEventos(container);

    estado.carregando = true;
    estado.erro = null;
    renderToggle();
    renderConteudo();

    try {
      await carregarAulas(false);
    } catch (err) {
      console.error('❌ Erro ao carregar aulas do Calendário Master:', err);
      estado.erro = 'Não foi possível carregar as aulas.';
    } finally {
      estado.carregando = false;
    }

    renderSelectsData();
    atualizarTudo();
  }

  return {
    loadCalendarioMaster,
    abrirDetalhes,
    abrirModalFeriado,
    // Expostos para teste e depuração.
    _estado: estado,
    _opcoesDoMes: opcoesDoMes,
    _aulasFiltradas: aulasFiltradas,
    _aulasDoMes: aulasDoMes
  };
})();

if (typeof window !== 'undefined') {
  window.CalendarioBusca = CalendarioBusca;
  // script.js chama esta função ao abrir a seção "calendario".
  window.loadCalendarioMaster = CalendarioBusca.loadCalendarioMaster;
}

console.log('✅ simulacao-v2.js carregado');

// Versão principal do modal de Simulação (functions-simulacoes.js), no mesmo layout de
// Detalhes da Contratação (detalhes-contratacao-v2.js / .css). abrirModalSimulacao monta
// a versão antiga e chama abrir() logo em seguida: esta camada cobre a tela, mas NÃO
// duplica nenhuma função — campos, botões, tabela e valores da versão antiga são movidos
// para cá com os listeners intactos e voltam ao lugar em "Visualizar versão antiga".
//
// A camada fica DENTRO do #modal-simulacao porque os handlers de lá usam
// modal.querySelector(...); fechar o modal (modal.remove()) leva a camada junto.
window.SimulacaoV2 = (function () {
  'use strict';

  let ativo = null; // { el, overlayV1, movidos, rotulos, info }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // Os displays da simulação usam "R$ 1234.50" (toFixed) ou "R$ 1.234,50" (Novo Valor).
  const parseValor = (txt) => {
    let s = String(txt || '').replace(/[^\d.,-]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  function mover(node, destino) {
    if (!node || !destino) return;
    ativo.movidos.push({ node, parent: node.parentNode, next: node.nextSibling });
    destino.appendChild(node);
  }

  function restaurarMovidos() {
    for (let i = ativo.movidos.length - 1; i >= 0; i--) {
      const { node, parent, next } = ativo.movidos[i];
      if (!parent) continue;
      parent.insertBefore(node, next && next.parentNode === parent ? next : null);
    }
    ativo.movidos = [];
  }

  // Os botões da versão antiga são <i> + texto solto: troca só o último texto.
  function renomear(btn, novo) {
    if (!btn) return;
    const textos = [...btn.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    const alvo = textos[textos.length - 1];
    if (!alvo) return;
    ativo.rotulos.push({ alvo, original: alvo.textContent });
    alvo.textContent = ' ' + novo + ' ';
  }

  function chip(texto, tom) {
    return `<span class="mdc2-chip"${tom ? ` data-tom="${tom}"` : ''}><span class="mdc2-chip-ponto"></span><span class="mdc2-chip-texto">${esc(texto)}</span></span>`;
  }

  function linhaResumo(rotulo, slot, extra = '') {
    return `<div class="mdc2-linha"><span class="mdc2-linha-rotulo">${rotulo}</span><span class="mdc2-linha-valor${extra}" data-v2="${slot}"></span></div>`;
  }

  function montarHTML(isNova) {
    return `
      <div class="mdc2-overlay msim2" role="dialog" aria-modal="true" aria-label="Simulação">
        <div class="mdc2-shell">
          <header class="mdc2-header mdc2-glass">
            <div class="mdc2-header-topo">
              <div class="mdc2-header-id">
                <h2 class="mdc2-nome" data-v2="titulo"></h2>
                <span class="mdc2-contrato" data-v2="numero"></span>
                <div class="mdc2-chips" data-v2="chips"></div>
              </div>
              <div class="mdc2-header-acoes">
                <button type="button" class="mdc2-btn-perfil" data-v2="perfil" title="Abrir o perfil completo do cliente">
                  <i class="fas fa-user"></i><span>Perfil do cliente</span>
                </button>
                <button type="button" class="mdc2-btn-icone" data-v2="expandir" aria-expanded="false" title="Mostrar dados da simulação">
                  <i class="fas fa-chevron-down"></i>
                </button>
                <button type="button" class="mdc2-btn-perfil mdc2-btn-versao" data-v2="versao-antiga" aria-label="Visualizar versão antiga">
                  <i class="fas fa-clock-rotate-left"></i><span>Visualizar versão antiga</span>
                </button>
                <span class="mdc2-slot-fechar" data-v2="fechar"></span>
              </div>
            </div>
            <div class="mdc2-header-info"><div class="msim2-dados" data-v2="info"></div></div>
          </header>

          <div class="mdc2-main">
            <nav class="mdc2-nav mdc2-glass" aria-label="Ações da simulação">
              <div class="mdc2-nav-grupo">
                <span class="mdc2-nav-titulo">Aulas</span>
                <div class="mdc2-nav-itens" data-v2="nav-aulas"></div>
              </div>
              <div class="mdc2-nav-grupo">
                <span class="mdc2-nav-titulo">Ações</span>
                <div class="mdc2-nav-itens" data-v2="nav-acoes"></div>
              </div>
            </nav>

            <section class="mdc2-centro mdc2-glass">
              <h3 class="mdc2-secao-titulo"><i class="fas fa-calendar-alt"></i> Cronograma de Aula</h3>
              <div class="mdc2-tabela" data-v2="tabela"></div>
            </section>

            <aside class="mdc2-lateral">
              <div class="mdc2-card mdc2-glass">
                <div class="mdc2-card-titulo"><span class="mdc2-card-icone"><i class="fas fa-wallet"></i></span>Resumo financeiro</div>
                ${linhaResumo('Valor do pacote', 'pacote')}
                ${linhaResumo('Valor da equipe', 'equipe')}
                ${linhaResumo('Lucro Master', 'lucro', ' mdc2-valor-lucro')}
                <div class="mdc2-card-acao msim2-modo" data-v2="modo-valor"></div>
              </div>
              <div class="mdc2-card mdc2-glass">
                <div class="mdc2-card-titulo"><span class="mdc2-card-icone"><i class="fas fa-clock"></i></span>Valores por aula</div>
                ${linhaResumo('Total de horas', 'total-horas')}
                ${linhaResumo('Hora/aula professor', 'hora-aula')}
                ${linhaResumo('Lucro por aula', 'lucro-aula', ' mdc2-valor-lucro')}
                ${linhaResumo('Total por aula', 'total-aula')}
              </div>
              <div class="mdc2-card mdc2-glass">
                <div class="mdc2-card-titulo"><span class="mdc2-card-icone"><i class="fas fa-file-signature"></i></span>Simulação</div>
                <div class="mdc2-card-botoes" data-v2="simulacao"></div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    `;
  }

  // Lucro por aula = lucro por hora salvo ("Novo Valor") ou lucro ÷ horas;
  // Total por aula = hora/aula do professor + lucro por hora.
  function atualizarDerivados() {
    if (!ativo) return;
    const { el, simulacao } = ativo;
    const elHoras = document.getElementById('display-total-horas');
    // Total de horas vem como '10h30' ou '10h'.
    const mh = String((elHoras && elHoras.textContent) || '').match(/(\d+)\s*h\s*(\d{1,2})?/);
    const horas = mh ? Number(mh[1]) + (mh[2] ? Number(mh[2]) / 60 : 0) : 0;
    const horaProf = parseValor((document.getElementById('display-valor-hora-aula') || {}).textContent);
    const lucro = parseValor((document.getElementById('display-lucro-master') || {}).textContent);
    const porHora = Number(simulacao.valorLucroMasterPorHora) > 0
      ? Number(simulacao.valorLucroMasterPorHora)
      : (horas > 0 ? lucro / horas : 0);
    const set = (chave, valor) => {
      const n = el.querySelector(`[data-v2="${chave}"]`);
      if (n && n.textContent !== valor) n.textContent = valor;
    };
    set('lucro-aula', moeda(porHora));
    set('total-aula', moeda(horaProf + porHora));
  }

  // Título, número e chips acompanham os campos (que continuam sendo a fonte dos dados).
  function atualizarCabecalho() {
    if (!ativo) return;
    const { el, overlayV1, simulacao, isNova, doApp } = ativo;
    const val = (sel) => { const n = overlayV1.querySelector(sel); return n ? String(n.value || '').trim() : ''; };
    const titulo = val('#titulo-simulacao') || (isNova ? 'Nova Simulação' : 'Simulação sem título');
    el.querySelector('[data-v2="titulo"]').textContent = titulo;
    el.querySelector('[data-v2="numero"]').textContent = isNova || !simulacao.idSimulacao ? 'Ainda não salva' : `Simulação nº ${simulacao.idSimulacao}`;
    const chips = [];
    if (doApp) chips.push(chip('Via App', 'app'));
    const pag = val('#metodo-pagamento'); if (pag) chips.push(chip(pag));
    const eq = val('#tipo-equipe'); if (eq) chips.push(chip(eq));
    el.querySelector('[data-v2="chips"]').innerHTML = chips.join('');
    const perfil = el.querySelector('[data-v2="perfil"]');
    const temCliente = !!val('#cpf-cliente');
    perfil.disabled = !temCliente;
    perfil.title = temCliente ? 'Abrir o perfil completo do cliente' : 'Escolha um cliente com CPF cadastrado para abrir o perfil';
  }

  function expandir(aberto) {
    const { el } = ativo;
    el.querySelector('.mdc2-header').classList.toggle('mdc2-header-aberto', aberto);
    const btn = el.querySelector('[data-v2="expandir"]');
    btn.setAttribute('aria-expanded', String(aberto));
    btn.title = aberto ? 'Ocultar dados da simulação' : 'Mostrar dados da simulação';
  }

  function limparSeOrfao() {
    if (ativo && !document.body.contains(ativo.el)) {
      ativo.observers.forEach(o => o.disconnect());
      ativo = null;
    }
  }

  // "Visualizar versão antiga": devolve tudo ao layout anterior e o exibe.
  function fechar() {
    limparSeOrfao();
    if (!ativo) return;
    ativo.observers.forEach(o => o.disconnect());
    ativo.rotulos.forEach(({ alvo, original }) => { alvo.textContent = original; });
    restaurarMovidos();
    ativo.overlayV1.classList.remove('mdc2-v1-oculta');
    ativo.el.remove();
    ativo = null;
  }

  /**
   * @param {HTMLElement} overlayV1  #modal-simulacao (versão antiga)
   * @param {Object} simulacao       a simulação em edição
   * @param {Object} opcoes          { isNova, doApp }
   */
  function abrir(overlayV1, simulacao, { isNova = false, doApp = false } = {}) {
    limparSeOrfao();
    if (ativo) fechar();
    const wrap = document.createElement('div');
    wrap.innerHTML = montarHTML(isNova);
    const el = wrap.firstElementChild;
    overlayV1.appendChild(el);
    overlayV1.classList.add('mdc2-v1-oculta');
    ativo = { el, overlayV1, simulacao, isNova, doApp, movidos: [], rotulos: [], observers: [] };

    const slot = (chave) => el.querySelector(`[data-v2="${chave}"]`);
    const daV1 = (sel) => overlayV1.querySelector(sel);

    // Cabeçalho expansível: os campos da simulação e os estudantes do cliente.
    const info = slot('info');
    const campos = daV1('#titulo-simulacao');
    mover(campos && campos.closest('.grid'), info);
    const estudantes = daV1('#lista-estudantes-cliente-sim');
    mover(estudantes && estudantes.parentElement, info);

    // Menu lateral — Aulas.
    const navAulas = slot('nav-aulas');
    ['#btn-adicionar-aula-simulacao', '#btn-remover-aula-simulacao', '#btn-calendario-simulacao',
      '#btn-verificar-datas-simulacao', '#btn-match-simulacao'].forEach(sel => mover(daV1(sel), navAulas));

    // Menu lateral — Ações.
    const navAcoes = slot('nav-acoes');
    ['#btn-gerar-solicitacao-simulacao', '#btn-enviar-simulacao'].forEach(sel => mover(daV1(sel), navAcoes));

    // Centro: a mesma tabela.
    mover(daV1('.table-container-double-scroll'), slot('tabela'));

    // Lateral direita: valores e o seletor Valor Padrão / Novo Valor.
    mover(daV1('#display-valor-pacote'), slot('pacote'));
    mover(daV1('#display-valor-equipe'), slot('equipe'));
    mover(daV1('#display-lucro-master'), slot('lucro'));
    mover(daV1('#display-total-horas'), slot('total-horas'));
    mover(daV1('#display-valor-hora-aula'), slot('hora-aula'));
    const toggle = daV1('#toggle-valor-mode');
    mover(toggle && toggle.closest('.toggle-switch'), slot('modo-valor'));

    // Cartão Simulação.
    const cartao = slot('simulacao');
    const btnSalvar = daV1('#btn-salvar-simulacao');
    mover(btnSalvar, cartao);
    renomear(btnSalvar, isNova ? 'Salvar dados' : 'Atualizar dados');
    mover(daV1('#btn-aprovar-simulacao'), cartao);
    mover(daV1('#btn-proposta-professores-simulacao'), cartao);
    const btnExcluir = daV1('#btn-excluir-simulacao');
    mover(btnExcluir, cartao);
    renomear(btnExcluir, 'Excluir simulação');
    renomear(daV1('#btn-aprovar-simulacao'), 'Aprovar simulação');

    // "Fechar" (X) da versão antiga vai para o fim do cabeçalho.
    mover(daV1('.modal-header .modal-close'), slot('fechar'));

    // Pesos dos grupos/cartões (itens equidistantes, como na contratação).
    el.querySelectorAll('.mdc2-nav-grupo').forEach(g => {
      g.style.setProperty('--mdc2-peso', g.querySelector('.mdc2-nav-itens').children.length + 1);
    });
    el.querySelectorAll('.mdc2-lateral > .mdc2-card').forEach(c => {
      c.style.setProperty('--mdc2-peso', c.querySelectorAll('.mdc2-linha, .mdc2-card-acao, .mdc2-card-botoes > *').length + 1);
    });

    slot('expandir').addEventListener('click', () => expandir(!el.querySelector('.mdc2-header').classList.contains('mdc2-header-aberto')));
    slot('versao-antiga').addEventListener('click', fechar);
    slot('perfil').addEventListener('click', () => {
      const cpf = (daV1('#cpf-cliente') || {}).value || '';
      if (cpf && typeof abrirPerfilClientePorCpf === 'function') abrirPerfilClientePorCpf(cpf);
    });
    // Nova simulação: os dados (título obrigatório, cliente) já vêm à vista.
    expandir(!!isNova);

    // Cabeçalho segue os campos; valores por aula seguem os displays.
    ['#titulo-simulacao', '#metodo-pagamento', '#tipo-equipe', '#select-cliente'].forEach(sel => {
      const n = daV1(sel);
      if (n) { n.addEventListener('input', atualizarCabecalho); n.addEventListener('change', atualizarCabecalho); }
    });
    const oValores = new MutationObserver(() => { atualizarDerivados(); atualizarCabecalho(); });
    oValores.observe(el.querySelector('.mdc2-lateral'), { childList: true, characterData: true, subtree: true });
    ativo.observers.push(oValores);

    atualizarCabecalho();
    atualizarDerivados();
  }

  return { abrir, fechar };
})();

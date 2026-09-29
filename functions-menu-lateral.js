// functions-menu-lateral.js — Menu lateral organizável + tela "Organizar Menu"
//
// O menu lateral é montado aqui a partir de uma configuração:
//   { versao, secoes: [ { id, nome, itens: [nó] } ] }
//   nó = { tipo: 'funcao', funcao: <chave de FUNCOES>, nome?, icone? }
//      | { tipo: 'gaveta', id, nome, icone, itens: [nó] }   (menu recolhido)
// Gavetas podem ter no máximo 2 níveis (gaveta dentro de gaveta, não mais).
//
// As funções (telas) são fixas em FUNCOES: a configuração só escolhe onde cada
// uma aparece, com que nome e ícone. Função que não estiver em lugar nenhum
// (ex.: tela nova criada no código) entra no fim da última seção — nenhuma some.
//
// Gravação: configuracoes/menuLateral (Firestore, igual para todos os admins —
// coleção só de admin pela regra global do firestore.rules). Uma cópia fica no
// localStorage só para o menu abrir já organizado, sem esperar a leitura.
//
// A navegação (cliques nos itens e gavetas) fica em script.js, por delegação.

(function () {
  'use strict';

  const COLECAO = 'configuracoes';
  const DOC_ID = 'menuLateral';
  const CHAVE_LOCAL = 'menuLateralConfig';
  const MAX_NIVEL_GAVETA = 2;

  // ── Catálogo de funções (telas) ──────────────────────────────────────────
  // chave → { secao: id da <section>, aba?: aba de Professores, nome, icone }
  const FUNCOES = {
    'painel-central':          { secao: 'painel-central', nome: 'Painel Central', icone: 'fas fa-home' },
    'banco-aulas':             { secao: 'banco-aulas', nome: 'Banco de Aulas', icone: 'fas fa-book' },
    'calendario':              { secao: 'calendario', nome: 'Calendário Master', icone: 'fas fa-calendar-alt' },
    'fluxo-processos':         { secao: 'fluxo-processos', nome: 'Processos', icone: 'fas fa-route' },
    'quadros-aula':            { secao: 'quadros-aula', nome: 'Quadros de aula', icone: 'fas fa-chalkboard' },
    'notificacoes':            { secao: 'notificacoes', nome: 'Notificações', icone: 'fas fa-bell' },
    'mensagens':               { secao: 'mensagens', nome: 'Painel Financeiro', icone: 'fas fa-wallet' },
    'area-pagamento':          { secao: 'area-pagamento', nome: 'Área Pagamento', icone: 'fas fa-credit-card' },
    'cofres-pagamento':        { secao: 'cofres-pagamento', nome: 'Cofres e Reservas', icone: 'fas fa-vault' },
    'previsao-financeira':     { secao: 'previsao-financeira', nome: 'Previsão Financeira', icone: 'fas fa-chart-pie' },
    'simulacoes':              { secao: 'simulacoes', nome: 'Simulações', icone: 'fas fa-chart-line' },
    'clientes':                { secao: 'clientes', nome: 'BD Clientes', icone: 'fas fa-database' },
    'galeria-professores':     { secao: 'galeria-professores', nome: 'BD Professores', icone: 'fas fa-database' },
    'avaliacao-candidatos':    { secao: 'professores', aba: 'dp-tab-candidatos', nome: 'Avaliação de Candidatos', icone: 'fas fa-user-check' },
    'desempenho-equipe':       { secao: 'professores', aba: 'dp-tab-equipe', nome: 'Análise e Desempenho de Equipe', icone: 'fas fa-chart-line' },
    'agendamento-entrevistas': { secao: 'professores', aba: 'dp-tab-agendamento', nome: 'Agendamento de Entrevistas', icone: 'fas fa-calendar-check' },
    'exportar-dados':          { secao: 'exportar-dados', nome: 'Exportar Dados', icone: 'fas fa-file-export' },
    'organizar-menu':          { secao: 'organizar-menu', nome: 'Organizar Menu', icone: 'fas fa-sitemap' },
    'detalhes-banco-de-aulas': { secao: 'detalhes-banco-de-aulas', nome: 'Detalhes Banco de Aulas', icone: 'fas fa-table-cells' }
  };

  const f = (funcao) => ({ tipo: 'funcao', funcao });

  // Estrutura de fábrica (a mesma que existia fixa no index.html)
  const PADRAO = {
    versao: 1,
    secoes: [
      { id: 's-operacao', nome: 'Operação', itens: [
        f('painel-central'), f('banco-aulas'), f('calendario'),
        f('fluxo-processos'), f('quadros-aula'), f('notificacoes')
      ] },
      { id: 's-financeiro', nome: 'Financeiro', itens: [
        f('mensagens'), f('area-pagamento'), f('cofres-pagamento'),
        f('previsao-financeira'), f('simulacoes')
      ] },
      { id: 's-pessoas', nome: 'Pessoas', itens: [
        { tipo: 'gaveta', id: 'g-clientes-professores', nome: 'Clientes e Professores', icone: 'fas fa-tachometer-alt', itens: [
          { tipo: 'gaveta', id: 'g-clientes', nome: 'Clientes', icone: 'fas fa-users', itens: [f('clientes')] },
          { tipo: 'gaveta', id: 'g-professores', nome: 'Professores', icone: 'fas fa-chalkboard-user', itens: [
            f('galeria-professores'), f('avaliacao-candidatos'),
            f('desempenho-equipe'), f('agendamento-entrevistas')
          ] }
        ] }
      ] },
      { id: 's-ferramentas', nome: 'Ferramentas e Administrativo', itens: [
        f('exportar-dados'), f('organizar-menu'),
        { tipo: 'gaveta', id: 'g-area-dev', nome: 'Área Dev', icone: 'fas fa-code', itens: [f('detalhes-banco-de-aulas')] }
      ] }
    ]
  };

  // Ícones oferecidos no seletor (qualquer classe Font Awesome 6 também é aceita)
  const ICONES = [
    'fas fa-home', 'fas fa-book', 'fas fa-book-open', 'fas fa-calendar-alt', 'fas fa-calendar-check',
    'fas fa-route', 'fas fa-chalkboard', 'fas fa-chalkboard-user', 'fas fa-bell', 'fas fa-wallet',
    'fas fa-credit-card', 'fas fa-vault', 'fas fa-chart-pie', 'fas fa-chart-line', 'fas fa-chart-bar',
    'fas fa-database', 'fas fa-users', 'fas fa-user', 'fas fa-user-check', 'fas fa-user-graduate',
    'fas fa-file-export', 'fas fa-file-lines', 'fas fa-file-signature', 'fas fa-folder', 'fas fa-folder-open',
    'fas fa-box-archive', 'fas fa-code', 'fas fa-table-cells', 'fas fa-tachometer-alt', 'fas fa-gear',
    'fas fa-screwdriver-wrench', 'fas fa-toolbox', 'fas fa-sitemap', 'fas fa-list-check', 'fas fa-clipboard-list',
    'fas fa-envelope', 'fas fa-comments', 'fas fa-phone', 'fas fa-money-bill-wave', 'fas fa-coins',
    'fas fa-receipt', 'fas fa-briefcase', 'fas fa-building', 'fas fa-star', 'fas fa-flag',
    'fas fa-lightbulb', 'fas fa-shield-halved', 'fas fa-magnifying-glass'
  ];
  const ICONE_VALIDO = /^(fas|far|fab|fa-solid|fa-regular|fa-brands)( fa-[a-z0-9-]+)+$/;
  const ICONE_GAVETA = 'fas fa-folder';

  // ── Normalização ─────────────────────────────────────────────────────────
  // Aceita qualquer coisa vinda do Firestore/localStorage e devolve uma
  // configuração válida: sem funções desconhecidas ou repetidas, sem gavetas
  // além do limite e com todas as funções presentes em algum lugar.
  const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const icone = (v) => (typeof v === 'string' && ICONE_VALIDO.test(v.trim()) ? v.trim() : '');
  const novoId = (prefixo) => prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function normalizar(bruto) {
    if (!bruto || !Array.isArray(bruto.secoes) || bruto.secoes.length === 0) return clonar(PADRAO);
    const usadas = new Set();

    function nos(lista, nivelGaveta) {
      const saida = [];
      (Array.isArray(lista) ? lista : []).forEach((no) => {
        if (!no || typeof no !== 'object') return;
        if (no.tipo === 'funcao') {
          if (!FUNCOES[no.funcao] || usadas.has(no.funcao)) return;
          usadas.add(no.funcao);
          const item = { tipo: 'funcao', funcao: no.funcao };
          const nome = texto(no.nome, 60);
          const ic = icone(no.icone);
          if (nome && nome !== FUNCOES[no.funcao].nome) item.nome = nome;
          if (ic && ic !== FUNCOES[no.funcao].icone) item.icone = ic;
          saida.push(item);
        } else if (no.tipo === 'gaveta') {
          const filhos = nos(no.itens, nivelGaveta + 1);
          // Gaveta além do limite: os itens dela sobem para o nível atual
          if (nivelGaveta >= MAX_NIVEL_GAVETA) { saida.push(...filhos); return; }
          saida.push({
            tipo: 'gaveta',
            id: texto(no.id, 40) || novoId('g-'),
            nome: texto(no.nome, 60) || 'Nova gaveta',
            icone: icone(no.icone) || ICONE_GAVETA,
            itens: filhos
          });
        }
      });
      return saida;
    }

    const secoes = bruto.secoes.filter((s) => s && typeof s === 'object').map((s) => ({
      id: texto(s.id, 40) || novoId('s-'),
      nome: texto(s.nome, 60) || 'Nova seção',
      itens: nos(s.itens, 0)
    }));
    if (secoes.length === 0) return clonar(PADRAO);

    Object.keys(FUNCOES).forEach((chave) => {
      if (!usadas.has(chave)) secoes[secoes.length - 1].itens.push({ tipo: 'funcao', funcao: chave });
    });
    return { versao: 1, secoes };
  }

  function clonar(obj) { return JSON.parse(JSON.stringify(obj)); }

  // ── Montagem do menu lateral ─────────────────────────────────────────────
  function el(tag, classe, attrs) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== null) e.setAttribute(k, v); });
    return e;
  }
  function iconeEl(classe, extra) { return el('i', classe + (extra ? ' ' + extra : '')); }
  function spanTexto(t) { const s = el('span'); s.textContent = t; return s; }

  // nivel: 0 = direto na seção, 1 = dentro de gaveta, 2 = dentro de sub-gaveta
  function montarNo(no, nivel) {
    if (no.tipo === 'funcao') {
      const def = FUNCOES[no.funcao];
      const nome = no.nome || def.nome;
      const btn = el('button', nivel === 0 ? 'menu-item' : 'menu-item-submenu-leaf', {
        type: 'button', 'data-section': def.secao, 'data-tab': def.aba, 'data-title': nome, title: nome
      });
      btn.append(iconeEl(no.icone || def.icone, 'mr-3'), spanTexto(nome));
      if (no.funcao === 'notificacoes') {
        btn.style.position = 'relative';
        const contador = el('span', null, { id: 'contador-notificacoes', 'aria-label': 'respostas não lidas' });
        contador.hidden = true;
        contador.textContent = '0';
        btn.appendChild(contador);
      }
      return [btn];
    }

    const topo = nivel === 0;
    const btn = el('button', topo ? 'menu-item menu-item-expandable' : 'menu-item-submenu menu-item-submenu-expandable', {
      type: 'button', 'data-gaveta': no.id, title: no.nome
    });
    btn.append(
      iconeEl(no.icone, 'mr-3'),
      spanTexto(no.nome),
      iconeEl(topo ? 'fas fa-chevron-down ml-auto text-sm transition-transform' : 'fas fa-chevron-right ml-auto text-xs', 'menu-gaveta-seta')
    );
    const conteudo = el('div', 'menu-gaveta-conteudo space-y-1 hidden ' + (topo ? 'ml-4' : 'ml-3'));
    no.itens.forEach((filho) => conteudo.append(...montarNo(filho, nivel + 1)));
    return [btn, conteudo];
  }

  function renderizarMenu(config) {
    const nav = document.getElementById('div-menuLateral');
    if (!nav) return;

    // Preserva o item ativo e o contador de notificações entre remontagens
    const ativoAntes = nav.querySelector('button.active[data-section]');
    const secaoAtiva = ativoAntes ? ativoAntes.getAttribute('data-section') : 'painel-central';
    const abaAtiva = ativoAntes ? ativoAntes.getAttribute('data-tab') : null;
    const contadorAntes = document.getElementById('contador-notificacoes');
    const contador = contadorAntes ? { texto: contadorAntes.textContent, oculto: contadorAntes.hidden } : null;

    nav.innerHTML = '';
    config.secoes.forEach((secao) => {
      if (secao.itens.length === 0) return;
      const grupo = el('p', 'menu-grupo', { role: 'presentation' });
      grupo.appendChild(spanTexto(secao.nome));
      nav.appendChild(grupo);
      secao.itens.forEach((no) => nav.append(...montarNo(no, 0)));
    });

    const seletor = `button[data-section="${secaoAtiva}"]` + (abaAtiva ? `[data-tab="${abaAtiva}"]` : '');
    const ativo = nav.querySelector(seletor) || nav.querySelector(`button[data-section="${secaoAtiva}"]`);
    if (ativo) ativo.classList.add('active');

    const novoContador = document.getElementById('contador-notificacoes');
    if (contador && novoContador) {
      novoContador.textContent = contador.texto;
      novoContador.hidden = contador.oculto;
    }
  }

  // ── Carregamento da configuração ─────────────────────────────────────────
  let configAtual = normalizar(lerLocal() || PADRAO);

  function lerLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch (e) { return null; }
  }
  function gravarLocal(config) {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(config)); } catch (e) { /* sem armazenamento local */ }
  }

  function docRef() { return firebase.firestore().collection(COLECAO).doc(DOC_ID); }

  // Lê a configuração salva; sem documento, fica a estrutura de fábrica.
  async function carregarRemoto() {
    const snap = await docRef().get();
    const config = normalizar(snap.exists ? snap.data() : PADRAO);
    aplicar(config);
    return config;
  }

  function aplicar(config) {
    const mudou = JSON.stringify(config) !== JSON.stringify(configAtual);
    configAtual = config;
    gravarLocal(config);
    if (mudou) renderizarMenu(config);
  }

  // A leitura exige login: espera o auth.js definir window.currentUser
  function aoAutenticar(fn) {
    let esperado = 0;
    const timer = setInterval(() => {
      esperado += 200;
      if (window.currentUser) { clearInterval(timer); fn(); }
      else if (esperado >= 15000) clearInterval(timer);
    }, 200);
  }

  renderizarMenu(configAtual);
  aoAutenticar(() => {
    carregarRemoto().catch((err) => console.warn('[Menu] Usando menu salvo neste navegador:', err && (err.code || err.message)));
  });

  // ── Tela "Organizar Menu" ────────────────────────────────────────────────
  let raiz = null;          // container da tela
  let alterado = false;
  let seletorIcone = null;  // popover aberto

  function injetarEstilos() {
    if (document.getElementById('om-estilos')) return;
    const s = document.createElement('style');
    s.id = 'om-estilos';
    s.textContent = `
      .om-wrap{max-width:860px;margin:0 auto;font-family:'Open Sans',sans-serif;}
      .om-topo{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;position:sticky;top:0;z-index:5;}
      .om-topo h2{font:700 1.1rem 'Lexend',sans-serif;color:#1f2937;margin:0;}
      .om-topo p{font-size:.8rem;color:#6b7280;margin:.15rem 0 0;}
      .om-acoes{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;}
      .om-status{font-size:.75rem;color:#b45309;font-weight:600;}
      .om-btn{display:inline-flex;align-items:center;gap:.4rem;border-radius:8px;padding:.45rem .8rem;font-size:.8rem;font-weight:600;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;transition:background .15s,border-color .15s;}
      .om-btn:hover{background:#f9fafb;border-color:#d1d5db;}
      .om-btn:disabled{opacity:.45;cursor:not-allowed;}
      .om-btn-primario{background:#f28705;border-color:#f28705;color:#fff;}
      .om-btn-primario:hover{background:#d97804;border-color:#d97804;}
      .om-btn-perigo{color:#b91c1c;}
      .om-btn-icone{padding:.35rem .5rem;}
      .om-secao{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:.9rem;overflow:hidden;}
      .om-secao-cab{display:flex;align-items:center;gap:.5rem;padding:.6rem .75rem;background:#fff7eb;border-bottom:1px solid #fde3bf;}
      .om-secao-cab .om-nome{font:700 .8rem 'Lexend',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#b45309;}
      .om-lista{min-height:40px;padding:.4rem .5rem .5rem;display:flex;flex-direction:column;gap:.3rem;}
      .om-lista:empty::before{content:'Arraste itens para cá';display:block;text-align:center;font-size:.75rem;color:#9ca3af;border:1px dashed #d1d5db;border-radius:8px;padding:.6rem;}
      .om-gaveta > .om-lista{margin:0 0 .15rem 1.6rem;border-left:2px solid #fde3bf;padding-left:.6rem;}
      .om-linha{display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;border:1px solid #f3f4f6;border-radius:8px;background:#fff;}
      .om-linha:hover{border-color:#fcd9a8;}
      .om-gaveta > .om-linha{background:#fffbf5;}
      .om-alca{cursor:grab;color:#9ca3af;padding:0 .2rem;touch-action:none;}
      .om-alca:active{cursor:grabbing;}
      .om-nome{flex:1;min-width:0;border:1px solid transparent;border-radius:6px;padding:.3rem .45rem;font-size:.85rem;color:#1f2937;background:transparent;}
      .om-nome:hover{border-color:#e5e7eb;}
      .om-nome:focus{outline:none;border-color:#f28705;background:#fff;}
      .om-icone{width:2rem;height:2rem;flex-shrink:0;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#d97804;cursor:pointer;}
      .om-icone:hover{border-color:#f28705;}
      .om-tag{font-size:.68rem;color:#6b7280;background:#f3f4f6;border-radius:999px;padding:.1rem .5rem;white-space:nowrap;}
      .om-tag-gaveta{background:#fff1dc;color:#b45309;}
      .om-fantasma{opacity:.4;}
      .om-escolhido > .om-linha{box-shadow:0 6px 16px rgba(0,0,0,.12);border-color:#f28705;}
      .om-popover{position:absolute;z-index:60;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.15);padding:.75rem;width:292px;}
      .om-popover-grade{display:grid;grid-template-columns:repeat(8,1fr);gap:.25rem;margin-bottom:.6rem;}
      .om-popover-grade button{height:2rem;border-radius:6px;border:1px solid transparent;background:#f9fafb;color:#374151;cursor:pointer;}
      .om-popover-grade button:hover,.om-popover-grade button.ativo{border-color:#f28705;color:#d97804;background:#fff7eb;}
      .om-popover input{width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:.35rem .5rem;font-size:.75rem;}
      .om-ajuda{font-size:.78rem;color:#6b7280;background:#fff;border:1px dashed #e5e7eb;border-radius:12px;padding:.75rem 1rem;margin-bottom:1rem;line-height:1.5;}
      @media (max-width:768px){.om-tag{display:none;}.om-gaveta > .om-lista{margin-left:.8rem;}}
    `;
    document.head.appendChild(s);
  }

  function botao(classe, conteudoHtml, titulo, aoClicar) {
    const b = el('button', 'om-btn ' + (classe || ''), { type: 'button', title: titulo });
    b.innerHTML = conteudoHtml;
    b.addEventListener('click', aoClicar);
    return b;
  }

  function inputNome(valor, placeholder) {
    const i = el('input', 'om-nome', { type: 'text', maxlength: '60', placeholder });
    i.value = valor;
    i.addEventListener('input', marcarAlterado);
    return i;
  }

  function botaoIcone(classeIcone) {
    const b = el('button', 'om-icone', { type: 'button', title: 'Trocar ícone', 'data-icone': classeIcone });
    b.appendChild(iconeEl(classeIcone));
    b.addEventListener('click', (e) => { e.stopPropagation(); abrirSeletorIcone(b); });
    return b;
  }

  function linhaFuncao(no) {
    const def = FUNCOES[no.funcao];
    const wrap = el('div', 'om-no om-funcao', { 'data-funcao': no.funcao });
    const linha = el('div', 'om-linha');
    const alca = el('span', 'om-alca om-alca-item', { title: 'Arrastar' });
    alca.appendChild(iconeEl('fas fa-grip-vertical'));
    const tag = el('span', 'om-tag', { title: 'Tela original' });
    tag.textContent = def.nome;
    linha.append(alca, botaoIcone(no.icone || def.icone), inputNome(no.nome || def.nome, def.nome), tag);
    wrap.appendChild(linha);
    return wrap;
  }

  function linhaGaveta(no) {
    const wrap = el('div', 'om-no om-gaveta', { 'data-id': no.id });
    const linha = el('div', 'om-linha');
    const alca = el('span', 'om-alca om-alca-item', { title: 'Arrastar' });
    alca.appendChild(iconeEl('fas fa-grip-vertical'));
    const tag = el('span', 'om-tag om-tag-gaveta');
    tag.innerHTML = '<i class="fas fa-layer-group"></i> Gaveta';
    const btnSub = botao('om-btn-icone om-add-sub', '<i class="fas fa-folder-plus"></i>', 'Nova gaveta dentro desta', () => {
      const lista = wrap.querySelector(':scope > .om-lista');
      const nova = linhaGaveta({ id: novoId('g-'), nome: 'Nova gaveta', icone: ICONE_GAVETA, itens: [] });
      lista.prepend(nova);
      marcarAlterado();
      nova.querySelector('.om-nome').select();
    });
    const btnExcluir = botao('om-btn-icone om-btn-perigo om-excluir', '<i class="fas fa-trash"></i>', 'Excluir gaveta (só vazia)', () => {
      wrap.remove();
      marcarAlterado();
    });
    linha.append(alca, botaoIcone(no.icone), inputNome(no.nome, 'Nome da gaveta'), tag, btnSub, btnExcluir);
    const lista = el('div', 'om-lista');
    no.itens.forEach((filho) => lista.appendChild(filho.tipo === 'funcao' ? linhaFuncao(filho) : linhaGaveta(filho)));
    wrap.append(linha, lista);
    ativarLista(lista);
    return wrap;
  }

  function blocoSecao(secao) {
    const wrap = el('div', 'om-secao', { 'data-id': secao.id });
    const cab = el('div', 'om-secao-cab');
    const alca = el('span', 'om-alca om-alca-secao', { title: 'Arrastar seção' });
    alca.appendChild(iconeEl('fas fa-grip-vertical'));
    const btnGaveta = botao('om-btn-icone', '<i class="fas fa-folder-plus"></i><span class="hidden sm:inline">Gaveta</span>', 'Nova gaveta nesta seção', () => {
      const nova = linhaGaveta({ id: novoId('g-'), nome: 'Nova gaveta', icone: ICONE_GAVETA, itens: [] });
      lista.prepend(nova);
      marcarAlterado();
      nova.querySelector('.om-nome').select();
    });
    const btnExcluir = botao('om-btn-icone om-btn-perigo om-excluir-secao', '<i class="fas fa-trash"></i>', 'Excluir seção (só vazia)', () => {
      wrap.remove();
      marcarAlterado();
    });
    cab.append(alca, inputNome(secao.nome, 'Nome da seção'), btnGaveta, btnExcluir);
    const lista = el('div', 'om-lista');
    secao.itens.forEach((no) => lista.appendChild(no.tipo === 'funcao' ? linhaFuncao(no) : linhaGaveta(no)));
    wrap.append(cab, lista);
    ativarLista(lista);
    return wrap;
  }

  // Quantas gavetas envolvem esta lista (0 = lista da própria seção)
  function nivelDaLista(lista) {
    let n = 0;
    let p = lista.parentElement;
    while (p && p !== raiz) {
      if (p.classList.contains('om-gaveta')) n++;
      p = p.parentElement;
    }
    return n;
  }

  function ativarLista(lista) {
    if (typeof Sortable === 'undefined') return;
    Sortable.create(lista, {
      group: 'om-itens',
      handle: '.om-alca-item',
      draggable: '.om-no',
      animation: 150,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      ghostClass: 'om-fantasma',
      chosenClass: 'om-escolhido',
      // Gaveta só entra onde não passa do limite de 2 níveis
      onMove: (evt) => {
        const arrastado = evt.dragged;
        if (!arrastado.classList.contains('om-gaveta')) return true;
        const altura = arrastado.querySelector('.om-gaveta') ? 2 : 1;
        return nivelDaLista(evt.to) + altura <= MAX_NIVEL_GAVETA;
      },
      onEnd: marcarAlterado
    });
  }

  function marcarAlterado() {
    alterado = true;
    atualizarControles();
  }

  // Excluir só aparece em seção/gaveta vazia (nenhuma função se perde) e
  // "nova gaveta dentro" só em gaveta de primeiro nível.
  function atualizarControles() {
    if (!raiz) return;
    const secoes = raiz.querySelectorAll('.om-secao');
    secoes.forEach((s) => {
      const vazia = !s.querySelector(':scope > .om-lista > .om-no');
      s.querySelector('.om-excluir-secao').disabled = !vazia || secoes.length === 1;
    });
    raiz.querySelectorAll('.om-gaveta').forEach((g) => {
      g.querySelector(':scope > .om-linha .om-excluir').disabled = !!g.querySelector(':scope > .om-lista > .om-no');
      g.querySelector(':scope > .om-linha .om-add-sub').hidden = nivelDaLista(g.parentElement) !== 0;
    });
    const status = raiz.querySelector('.om-status');
    if (status) status.textContent = alterado ? 'Alterações não salvas' : '';
    const salvar = raiz.querySelector('.om-salvar');
    if (salvar) salvar.disabled = !alterado;
    const descartar = raiz.querySelector('.om-descartar');
    if (descartar) descartar.disabled = !alterado;
  }

  // Lê a árvore da tela de volta para o formato da configuração
  function lerEditor() {
    function lerLista(lista) {
      return Array.from(lista.children).filter((n) => n.classList.contains('om-no')).map((n) => {
        const nome = n.querySelector(':scope > .om-linha .om-nome').value.trim();
        const ic = n.querySelector(':scope > .om-linha .om-icone').getAttribute('data-icone');
        if (n.classList.contains('om-funcao')) {
          return { tipo: 'funcao', funcao: n.getAttribute('data-funcao'), nome, icone: ic };
        }
        return { tipo: 'gaveta', id: n.getAttribute('data-id'), nome, icone: ic, itens: lerLista(n.querySelector(':scope > .om-lista')) };
      });
    }
    return {
      versao: 1,
      secoes: Array.from(raiz.querySelectorAll('.om-secoes > .om-secao')).map((s) => ({
        id: s.getAttribute('data-id'),
        nome: s.querySelector(':scope > .om-secao-cab .om-nome').value.trim(),
        itens: lerLista(s.querySelector(':scope > .om-lista'))
      }))
    };
  }

  function desenharArvore(config) {
    const container = raiz.querySelector('.om-secoes');
    container.innerHTML = '';
    config.secoes.forEach((s) => container.appendChild(blocoSecao(s)));
    alterado = false;
    atualizarControles();
  }

  // ── Seletor de ícone ──
  function fecharSeletorIcone() {
    if (seletorIcone) { seletorIcone.remove(); seletorIcone = null; }
  }

  function abrirSeletorIcone(btnAlvo) {
    fecharSeletorIcone();
    const atual = btnAlvo.getAttribute('data-icone');
    const pop = el('div', 'om-popover');
    const grade = el('div', 'om-popover-grade');
    const escolher = (classe) => {
      btnAlvo.setAttribute('data-icone', classe);
      btnAlvo.innerHTML = '';
      btnAlvo.appendChild(iconeEl(classe));
      fecharSeletorIcone();
      marcarAlterado();
    };
    ICONES.forEach((classe) => {
      const b = el('button', classe === atual ? 'ativo' : '', { type: 'button', title: classe.replace(/^fas fa-/, '') });
      b.appendChild(iconeEl(classe));
      b.addEventListener('click', () => escolher(classe));
      grade.appendChild(b);
    });
    const outro = el('input', null, { type: 'text', placeholder: 'Outro ícone Font Awesome (ex.: fas fa-rocket) + Enter' });
    outro.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const v = outro.value.trim();
      if (ICONE_VALIDO.test(v)) escolher(v);
      else outro.style.borderColor = '#ef4444';
    });
    pop.append(grade, outro);
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(pop);

    const r = btnAlvo.getBoundingClientRect();
    const largura = pop.offsetWidth;
    pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - largura - 8)) + 'px';
    seletorIcone = pop;
  }

  document.addEventListener('click', fecharSeletorIcone);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharSeletorIcone(); });

  // ── Ações ──
  async function salvar(btn) {
    const config = normalizar(lerEditor());
    btn.disabled = true;
    try {
      const usuario = (window.currentUser && window.currentUser.email) || (firebase.auth().currentUser || {}).email || '';
      await docRef().set({
        versao: config.versao,
        secoes: config.secoes,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoPor: usuario
      });
      aplicar(config);
      desenharArvore(config);
      if (typeof showToast === 'function') showToast('Menu lateral salvo.', 'success');
    } catch (err) {
      console.error('[Menu] Erro ao salvar:', err);
      const cota = err && err.code === 'resource-exhausted';
      if (typeof showToast === 'function') {
        showToast(cota ? 'Cota do Firestore esgotada — tente salvar mais tarde.' : 'Não foi possível salvar o menu.', 'error');
      }
      btn.disabled = false;
    }
  }

  // Restaurar é destrutivo para a organização atual: pede um segundo clique
  function confirmarDuasVezes(btn, textoConfirmar, acao) {
    let armado = false;
    let timer = null;
    const original = btn.innerHTML;
    btn.addEventListener('click', () => {
      if (!armado) {
        armado = true;
        btn.innerHTML = textoConfirmar;
        timer = setTimeout(() => { armado = false; btn.innerHTML = original; }, 4000);
        return;
      }
      clearTimeout(timer);
      armado = false;
      btn.innerHTML = original;
      acao();
    });
  }

  async function abrirEditor() {
    const secao = document.getElementById('organizar-menu');
    if (!secao) return;
    injetarEstilos();
    secao.innerHTML = '';
    raiz = el('div', 'om-wrap');
    secao.appendChild(raiz);

    if (typeof Sortable === 'undefined') {
      raiz.innerHTML = '<div class="om-ajuda">Não foi possível carregar a biblioteca de arrastar (SortableJS). Recarregue a página.</div>';
      return;
    }

    const topo = el('div', 'om-topo');
    const titulo = el('div');
    titulo.innerHTML = '<h2><i class="fas fa-sitemap mr-2 text-orange-500"></i>Organizar Menu</h2><p>Vale para todos os administradores depois de salvar.</p>';
    const acoes = el('div', 'om-acoes');
    const status = el('span', 'om-status');
    const btnSecao = botao('', '<i class="fas fa-plus"></i> Nova seção', 'Adicionar seção', () => {
      const nova = blocoSecao({ id: novoId('s-'), nome: 'Nova seção', itens: [] });
      raiz.querySelector('.om-secoes').appendChild(nova);
      marcarAlterado();
      nova.querySelector('.om-nome').select();
    });
    const btnPadrao = el('button', 'om-btn', { type: 'button', title: 'Voltar à organização original (só vale depois de salvar)' });
    btnPadrao.innerHTML = '<i class="fas fa-rotate-left"></i> Restaurar padrão';
    confirmarDuasVezes(btnPadrao, '<i class="fas fa-rotate-left"></i> Clique de novo para restaurar', () => {
      desenharArvore(normalizar(PADRAO));
      marcarAlterado();
    });
    const btnDescartar = botao('om-descartar', '<i class="fas fa-xmark"></i> Descartar', 'Descartar alterações não salvas', () => desenharArvore(configAtual));
    const btnSalvar = botao('om-btn-primario om-salvar', '<i class="fas fa-floppy-disk"></i> Salvar', 'Salvar organização do menu', () => salvar(btnSalvar));
    acoes.append(status, btnSecao, btnPadrao, btnDescartar, btnSalvar);
    topo.append(titulo, acoes);

    const ajuda = el('div', 'om-ajuda');
    ajuda.innerHTML = '<i class="fas fa-circle-info mr-1 text-orange-400"></i>'
      + 'Arraste pela alça <i class="fas fa-grip-vertical"></i> para mudar a ordem ou mover itens entre seções e gavetas. '
      + 'Clique no ícone para trocá-lo e no nome para renomear. Gavetas aceitam até 2 níveis. '
      + 'Seções e gavetas só podem ser excluídas quando estiverem vazias.';

    const secoes = el('div', 'om-secoes');
    Sortable.create(secoes, { handle: '.om-alca-secao', draggable: '.om-secao', animation: 150, ghostClass: 'om-fantasma', onEnd: marcarAlterado });
    raiz.append(topo, ajuda, secoes);

    // Relê do Firestore para não editar por cima de uma versão mais nova
    let config = configAtual;
    try { config = await carregarRemoto(); } catch (err) {
      console.warn('[Menu] Editando a versão salva neste navegador:', err && (err.code || err.message));
    }
    if (!raiz || !raiz.isConnected) return;
    desenharArvore(config);
  }

  window.MenuLateral = { abrirEditor, renderizar: () => renderizarMenu(configAtual) };
})();

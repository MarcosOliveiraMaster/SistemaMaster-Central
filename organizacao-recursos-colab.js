// organizacao-recursos-colab.js — Colaboração ao vivo na "Organização de recursos"
//
// Só nesta área e só no computador (tela ≥ 1024px com mouse):
//   - Presença: quem está online/ausente e onde (Visão geral ou qual simulação).
//     A simulação em que cada pessoa está ganha a borda na cor dela (azul =
//     Marcos, rosa = Ester; as duas cores quando os dois estão nela).
//   - Edição ao vivo: o que a outra pessoa digita num lançamento aparece
//     enquanto ela digita, com o campo contornado na cor dela (sem travar).
//   - Setas: com os dois no mesmo ambiente, cada um vê a seta do outro. A
//     posição vai presa ao elemento sob o mouse (card, lançamento...), para
//     cair no lugar certo mesmo com telas de tamanhos diferentes.
//
// Tempo real pelo Firebase Realtime Database (o salvamento continua no
// Firestore). Estrutura, sob /orColab:
//   config/ativo                       false desliga tudo (chave de emergência)
//   presenca/{pessoa}/{sessao}         { ambiente, estado, modal, t }
//   cursores/{ambiente}/{pessoa}       { a: âncora, x, y }  (frações dentro da âncora)
//   rascunhos/{simulacao}/{pessoa}     { tabela, lanc, campo, valor, t }
// Tudo some sozinho quando a aba fecha (onDisconnect). As setas só são
// enviadas com a outra pessoa no mesmo ambiente, até ~15 vezes por segundo.
//
// Integração: organizacao-recursos.js chama iniciar(raiz, api), aposRender(),
// aposModal() e parar().

(function () {
  'use strict';

  const RAIZ = 'orColab';
  const PESSOAS = {
    marcos: { nome: 'Marcos', cor: '#2f6fed', email: 'marcos.lucas.ti@gmail.com' },
    // A chave 'esther' fica como está: é o nome do nó no banco e nas regras
    esther: { nome: 'Ester', cor: '#e2457f', email: 'mastereducacaoadm@gmail.com' }
  };
  const CHAVE_PESSOA = 'orColabPessoa';
  const SDK_DATABASE = 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database-compat.js';
  const INTERVALO_SETA = 66;        // ~15 envios/s, só enquanto o mouse se move
  const INTERVALO_RASCUNHO = 60;
  const AUSENTE_APOS = 2 * 60 * 1000;
  const CAMPOS_AO_VIVO = new Set(['descricao', 'valor', 'data']);
  const NOMES_MODAL = { criar: 'criando simulação', editar: 'editando a simulação', analise: 'na análise', areas: 'nas áreas', detalhes: 'nas anotações' };
  const COMPUTADOR = window.matchMedia('(min-width: 1024px) and (pointer: fine)');

  let raiz = null;
  let api = null;
  let rdb = null;
  let eu = null;
  let sessao = null;
  let ligado = false;
  let desligadoNoBanco = false;
  let camada = null;            // camada fixa das setas
  let menuAberto = false;
  const ouvintes = [];          // [ref, evento, fn] para desligar
  let refPresenca = null;
  let refCursor = null;
  let refRascunho = null;
  let ambienteAssinado = null;  // ambiente cujas setas estou ouvindo
  let simAssinada = null;       // simulação cujos rascunhos estou ouvindo
  let presencas = {};           // { pessoa: { sessao: dados } }
  let cursores = {};            // { pessoa: { a, x, y } }
  let rascunhos = {};           // { pessoa: { tabela, lanc, campo, valor } }
  let ultimaPresenca = '';
  let estado = 'online';
  let timerAusente = null;
  let ultimoMouse = null;
  let ultimoEnvioSeta = 0;
  let timerSeta = null;
  let ultimaSeta = '';
  let timerRascunho = null;
  let campoFocado = null;
  let rascunhoAplicado = null;  // { lanc, campo } mostrado agora no meu card
  const uso = { enviados: 0, recebidos: 0 };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const outra = () => (eu === 'marcos' ? 'esther' : 'marcos');
  const tamanho = (v) => (v == null ? 0 : JSON.stringify(v).length);

  function pessoaPorEmail(email) {
    return Object.keys(PESSOAS).find((p) => PESSOAS[p].email === String(email || '').toLowerCase()) || null;
  }

  // Quem sou: escolha guardada neste navegador (dropdown) ou, na primeira vez,
  // o dono do e-mail logado
  function pessoaInicial() {
    let salva = null;
    try { salva = localStorage.getItem(CHAVE_PESSOA); } catch (e) { /* sem armazenamento */ }
    if (PESSOAS[salva]) return salva;
    return pessoaPorEmail(api.email());
  }

  function carregarSdk() {
    if (firebase.database) return Promise.resolve(true);
    const temBanco = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.databaseURL;
    if (!temBanco) return Promise.resolve(false);
    return new Promise((ok) => {
      const s = document.createElement('script');
      s.src = SDK_DATABASE;
      s.onload = () => ok(!!firebase.database);
      s.onerror = () => ok(false);
      document.head.appendChild(s);
    });
  }

  function ouvir(ref, evento, fn) {
    const cb = ref.on(evento, (snap) => { uso.recebidos += tamanho(snap.val()) + 40; fn(snap); }, (err) => console.warn('[Colaboração]', err && (err.code || err.message)));
    ouvintes.push([ref, evento, cb]);
    return cb;
  }
  function desouvir(ref, evento) {
    for (let i = ouvintes.length - 1; i >= 0; i--) {
      if (ouvintes[i][0] === ref && ouvintes[i][1] === evento) { ref.off(evento, ouvintes[i][2]); ouvintes.splice(i, 1); }
    }
  }
  function escrever(ref, valor) {
    uso.enviados += tamanho(valor) + 60;
    return ref.set(valor).catch((err) => console.warn('[Colaboração] Falha ao enviar:', err && (err.code || err.message)));
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────
  async function iniciar(r, a) {
    raiz = r;
    api = a;
    eu = pessoaInicial();
    if (!eu) return;                                   // só Marcos e Ester colaboram
    if (!(await carregarSdk()) || !raiz) return;
    try { rdb = firebase.database(); } catch (err) { console.warn('[Colaboração] Realtime Database indisponível:', err); return; }
    sessao = Math.random().toString(36).slice(2, 10);
    camada = document.createElement('div');
    camada.className = 'or-cursores';
    camada.setAttribute('aria-hidden', 'true');
    raiz.appendChild(camada);

    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('mousemove', aoMover, { passive: true });
    raiz.addEventListener('mouseleave', esconderMinhaSeta);
    raiz.addEventListener('focusin', aoFocar);
    raiz.addEventListener('focusout', aoDesfocar);
    raiz.addEventListener('input', aoDigitar);
    raiz.addEventListener('scroll', posicionarSetas, { passive: true });
    window.addEventListener('resize', posicionarSetas);
    document.addEventListener('visibilitychange', atualizarEstado);
    ['mousemove', 'keydown', 'pointerdown', 'wheel'].forEach((t) => document.addEventListener(t, marcarAtividade, { passive: true }));
    COMPUTADOR.addEventListener ? COMPUTADOR.addEventListener('change', reavaliar) : COMPUTADOR.addListener(reavaliar);

    // Chave de emergência no banco: orColab/config/ativo = false
    ouvir(rdb.ref(`${RAIZ}/config/ativo`), 'value', (snap) => { desligadoNoBanco = snap.val() === false; reavaliar(); });
    marcarAtividade();
  }

  function deveLigar() { return !!(raiz && rdb && eu && COMPUTADOR.matches && !desligadoNoBanco); }

  function reavaliar() {
    if (deveLigar() && !ligado) ligar();
    else if (!deveLigar() && ligado) desligar();
    renderizar();
  }

  function ligar() {
    ligado = true;
    refPresenca = rdb.ref(`${RAIZ}/presenca/${eu}/${sessao}`);
    // Reconectou: registra de novo a remoção automática e republica
    ouvir(rdb.ref('.info/connected'), 'value', (snap) => {
      if (!snap.val() || !refPresenca) return;
      refPresenca.onDisconnect().remove();
      ultimaPresenca = '';
      publicarPresenca();
    });
    ouvir(rdb.ref(`${RAIZ}/presenca`), 'value', (snap) => {
      presencas = snap.val() || {};
      sincronizarAssinaturas();
      renderizar();
    });
    publicarPresenca();
  }

  function desligar() {
    ligado = false;
    limparMeusDados();
    ouvintes.filter(([ref]) => !String(ref.toString()).endsWith(`${RAIZ}/config/ativo`)).forEach(([ref, ev]) => desouvir(ref, ev));
    ambienteAssinado = null;
    simAssinada = null;
    presencas = {};
    cursores = {};
    rascunhos = {};
    ultimaPresenca = '';
  }

  function limparMeusDados() {
    if (refPresenca) { refPresenca.onDisconnect().cancel(); refPresenca.remove(); refPresenca = null; }
    if (refCursor) { refCursor.onDisconnect().cancel(); refCursor.remove(); refCursor = null; }
    if (refRascunho) { refRascunho.onDisconnect().cancel(); refRascunho.remove(); refRascunho = null; }
    ultimaSeta = '';
  }

  function parar() {
    if (!raiz) return;
    desligar();
    ouvintes.slice().forEach(([ref, ev]) => desouvir(ref, ev));
    raiz.removeEventListener('click', aoClicar);
    raiz.removeEventListener('mousemove', aoMover);
    raiz.removeEventListener('mouseleave', esconderMinhaSeta);
    raiz.removeEventListener('focusin', aoFocar);
    raiz.removeEventListener('focusout', aoDesfocar);
    raiz.removeEventListener('input', aoDigitar);
    raiz.removeEventListener('scroll', posicionarSetas);
    window.removeEventListener('resize', posicionarSetas);
    document.removeEventListener('visibilitychange', atualizarEstado);
    ['mousemove', 'keydown', 'pointerdown', 'wheel'].forEach((t) => document.removeEventListener(t, marcarAtividade));
    COMPUTADOR.removeEventListener ? COMPUTADOR.removeEventListener('change', reavaliar) : COMPUTADOR.removeListener(reavaliar);
    clearTimeout(timerAusente);
    clearTimeout(timerSeta);
    clearTimeout(timerRascunho);
    if (camada) camada.remove();
    raiz = null;
    api = null;
    camada = null;
    menuAberto = false;
  }

  // ── Presença ─────────────────────────────────────────────────────────────
  function publicarPresenca() {
    if (!ligado || !refPresenca) return;
    const dados = { ambiente: api.ambiente(), estado, modal: api.modalAberto() || '' };
    const assinatura = JSON.stringify(dados);
    if (assinatura === ultimaPresenca) return;
    ultimaPresenca = assinatura;
    escrever(refPresenca, { ...dados, t: firebase.database.ServerValue.TIMESTAMP });
  }

  // Resumo por pessoa: a sessão mais recente (abas da mesma pessoa contam como uma)
  function resumo(pessoa) {
    const sessoes = Object.values(presencas[pessoa] || {}).filter((x) => x && x.ambiente);
    if (!sessoes.length) return null;
    const online = sessoes.filter((x) => x.estado !== 'ausente');
    const lista = (online.length ? online : sessoes).sort((x, y) => (y.t || 0) - (x.t || 0));
    return { ...lista[0], ausente: !online.length };
  }

  function marcarAtividade() {
    clearTimeout(timerAusente);
    timerAusente = setTimeout(() => atualizarEstado(true), AUSENTE_APOS);
    if (estado === 'ausente' && !document.hidden) atualizarEstado();
  }

  function atualizarEstado(ocioso) {
    const novo = document.hidden || ocioso === true ? 'ausente' : 'online';
    if (novo === estado) return;
    estado = novo;
    if (estado === 'ausente') esconderMinhaSeta();
    publicarPresenca();
    renderizar();
  }

  function mesmoAmbiente() {
    const o = resumo(outra());
    return !!(ligado && o && !o.ausente && o.ambiente === api.ambiente());
  }

  // Assina setas do ambiente atual e rascunhos da simulação aberta; tira a
  // minha seta/rascunho de onde eu não estou mais
  function sincronizarAssinaturas() {
    if (!ligado) return;
    const amb = api.ambiente();
    if (amb !== ambienteAssinado) {
      if (ambienteAssinado) desouvir(rdb.ref(`${RAIZ}/cursores/${ambienteAssinado}`), 'value');
      if (refCursor) { refCursor.onDisconnect().cancel(); refCursor.remove(); refCursor = null; }
      ultimaSeta = '';
      cursores = {};
      ambienteAssinado = amb;
      ouvir(rdb.ref(`${RAIZ}/cursores/${amb}`), 'value', (snap) => { cursores = snap.val() || {}; desenharSetas(); });
    }
    const sim = api.simulacaoAberta();
    if (sim !== simAssinada) {
      if (simAssinada) desouvir(rdb.ref(`${RAIZ}/rascunhos/${simAssinada}`), 'value');
      if (refRascunho) { refRascunho.onDisconnect().cancel(); refRascunho.remove(); refRascunho = null; }
      rascunhos = {};
      simAssinada = sim;
      if (sim) ouvir(rdb.ref(`${RAIZ}/rascunhos/${sim}`), 'value', (snap) => { rascunhos = snap.val() || {}; aplicarRascunhos(); });
    }
    // A outra pessoa acabou de chegar: mostra o campo em que já estou
    if (campoFocado && mesmoAmbiente() && !refRascunho) enviarRascunho(campoFocado);
    if (!mesmoAmbiente()) esconderMinhaSeta();
  }

  // ── Setas ────────────────────────────────────────────────────────────────
  function aoMover(e) {
    if (!mesmoAmbiente() || estado !== 'online') return;
    ultimoMouse = { x: e.clientX, y: e.clientY, alvo: e.target };
    const espera = INTERVALO_SETA - (performance.now() - ultimoEnvioSeta);
    if (espera <= 0) enviarSeta();
    else if (!timerSeta) timerSeta = setTimeout(enviarSeta, espera);
  }

  function enviarSeta() {
    timerSeta = null;
    if (!ultimoMouse || !mesmoAmbiente()) return;
    ultimoEnvioSeta = performance.now();
    let dados = { a: '' };
    const ancora = !api.modalAberto() && ultimoMouse.alvo.closest && ultimoMouse.alvo.closest('[data-ancora]');
    if (ancora && raiz.contains(ancora) && !ancora.closest('.or-modais')) {
      const r = ancora.getBoundingClientRect();
      if (r.width && r.height) {
        dados = {
          a: ancora.dataset.ancora,
          x: Math.round(((ultimoMouse.x - r.left) / r.width) * 1000) / 1000,
          y: Math.round(((ultimoMouse.y - r.top) / r.height) * 1000) / 1000
        };
      }
    }
    const assinatura = JSON.stringify(dados);
    if (assinatura === ultimaSeta) return;
    ultimaSeta = assinatura;
    if (!refCursor) {
      refCursor = rdb.ref(`${RAIZ}/cursores/${api.ambiente()}/${eu}`);
      refCursor.onDisconnect().remove();
    }
    escrever(refCursor, dados);
  }

  function esconderMinhaSeta() {
    clearTimeout(timerSeta);
    timerSeta = null;
    if (refCursor && ultimaSeta !== '{"a":""}') { ultimaSeta = '{"a":""}'; escrever(refCursor, { a: '' }); }
  }

  function desenharSetas() {
    if (!camada) return;
    const o = outra();
    const c = cursores[o];
    const visivel = mesmoAmbiente() && c && c.a;
    let el = camada.querySelector(`[data-pessoa="${o}"]`);
    if (!visivel) { if (el) el.hidden = true; return; }
    if (!el) {
      const p = PESSOAS[o];
      el = document.createElement('div');
      el.className = 'or-cursor';
      el.dataset.pessoa = o;
      el.style.setProperty('--or-cor', p.cor);
      el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" fill="currentColor" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>'
        + `<span>${esc(p.nome)}</span>`;
      camada.appendChild(el);
    }
    el.hidden = false;
    posicionarSeta(el, c);
  }

  function posicionarSeta(el, c) {
    const ancora = raiz && raiz.querySelector(`[data-ancora="${CSS.escape(c.a)}"]`);
    if (!ancora || ancora.closest('.or-modais')) { el.hidden = true; return; }
    const r = ancora.getBoundingClientRect();
    if (!r.width && !r.height) { el.hidden = true; return; }
    const x = r.left + (Number(c.x) || 0) * r.width;
    const y = r.top + (Number(c.y) || 0) * r.height;
    // Fora da área visível: fica na borda, apagada, indicando a direção
    const cx = Math.min(Math.max(x, 4), window.innerWidth - 24);
    const cy = Math.min(Math.max(y, 4), window.innerHeight - 24);
    el.classList.toggle('or-cursor-fora', cx !== x || cy !== y);
    el.style.transform = `translate(${cx}px, ${cy}px)`;
  }

  function posicionarSetas() {
    if (!camada) return;
    camada.querySelectorAll('.or-cursor').forEach((el) => {
      const c = cursores[el.dataset.pessoa];
      if (!el.hidden && c && c.a) posicionarSeta(el, c);
    });
  }

  // ── Edição ao vivo (rascunhos) ───────────────────────────────────────────
  const ehCampoAoVivo = (el) => el && el.dataset && CAMPOS_AO_VIVO.has(el.dataset.campo) && el.dataset.lanc;

  function aoFocar(e) {
    if (!ehCampoAoVivo(e.target)) return;
    campoFocado = e.target;
    if (mesmoAmbiente()) enviarRascunho(e.target);
  }

  function aoDigitar(e) {
    if (!ehCampoAoVivo(e.target) || !mesmoAmbiente()) return;
    const alvo = e.target;
    if (timerRascunho) return;
    timerRascunho = setTimeout(() => { timerRascunho = null; if (document.activeElement === alvo) enviarRascunho(alvo); }, INTERVALO_RASCUNHO);
  }

  function aoDesfocar(e) {
    if (!ehCampoAoVivo(e.target)) return;
    if (campoFocado === e.target) campoFocado = null;
    clearTimeout(timerRascunho);
    timerRascunho = null;
    if (refRascunho) { refRascunho.onDisconnect().cancel(); refRascunho.remove(); refRascunho = null; }
  }

  function enviarRascunho(el) {
    const sim = api.simulacaoAberta();
    if (!sim || !ligado) return;
    if (!refRascunho) {
      refRascunho = rdb.ref(`${RAIZ}/rascunhos/${sim}/${eu}`);
      refRascunho.onDisconnect().remove();
    }
    escrever(refRascunho, { tabela: el.dataset.tabela || '', lanc: el.dataset.lanc, campo: el.dataset.campo, valor: String(el.value ?? '').slice(0, 200) });
  }

  // Mostra no meu card o que a outra pessoa está digitando, sem mexer no
  // campo que eu estiver editando
  function aplicarRascunhos() {
    if (!raiz) return;
    raiz.querySelectorAll('.or-editando').forEach((td) => { td.classList.remove('or-editando'); td.removeAttribute('data-editor'); td.style.removeProperty('--or-cor'); });
    const o = outra();
    const r = ligado ? rascunhos[o] : null;
    const valido = r && r.lanc && CAMPOS_AO_VIVO.has(r.campo);
    // O rascunho anterior acabou (ou mudou de campo): o campo volta ao valor
    // salvo, que já chegou ou chega em seguida pelo Firestore
    if (rascunhoAplicado && (!valido || rascunhoAplicado.lanc !== r.lanc || rascunhoAplicado.campo !== r.campo)) {
      const antigo = raiz.querySelector(`[data-campo="${CSS.escape(rascunhoAplicado.campo)}"][data-lanc="${CSS.escape(rascunhoAplicado.lanc)}"]`);
      const salvo = api && api.valorCampo(rascunhoAplicado.lanc, rascunhoAplicado.campo);
      if (antigo && antigo !== document.activeElement && salvo !== undefined) antigo.value = salvo;
      rascunhoAplicado = null;
    }
    if (!valido) return;
    rascunhoAplicado = { lanc: r.lanc, campo: r.campo };
    const campo = raiz.querySelector(`[data-campo="${CSS.escape(r.campo)}"][data-lanc="${CSS.escape(r.lanc)}"]`);
    if (!campo) return;
    const celula = campo.closest('td');
    if (celula) {
      celula.classList.add('or-editando');
      celula.dataset.editor = PESSOAS[o].nome;
      celula.style.setProperty('--or-cor', PESSOAS[o].cor);
    }
    if (campo !== document.activeElement && campo.value !== r.valor) campo.value = r.valor;
  }

  // ── Interface: faixa no topo e bordas ────────────────────────────────────
  function onde(info) {
    if (!info) return 'offline';
    if (info.ausente) return 'ausente';
    const lugar = info.ambiente === 'lista' ? 'na Visão geral'
      : `em “${api.tituloSimulacao(String(info.ambiente).replace(/^sim_/, '')) || 'simulação'}”`;
    return info.modal && NOMES_MODAL[info.modal] ? `${lugar} · ${NOMES_MODAL[info.modal]}` : lugar;
  }

  function chip(pessoa, info, meu) {
    const p = PESSOAS[pessoa];
    const status = meu ? (estado === 'ausente' ? 'ausente' : 'você') : onde(info);
    const classe = !meu && (!info || info.ausente) ? ' or-chip-off' : '';
    const conteudo = `<span class="or-chip-avatar" style="--or-cor:${p.cor}">${p.nome[0]}</span><span class="or-chip-texto"><strong>${esc(p.nome)}</strong><small>${esc(status)}</small></span>`;
    if (!meu) return `<div class="or-chip${classe}" title="${esc(p.nome)} — ${esc(status)}">${conteudo}</div>`;
    return `<button type="button" class="or-chip or-chip-eu" data-colab="menu" aria-haspopup="menu" aria-expanded="${menuAberto}" title="Trocar usuário">${conteudo}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`;
  }

  function htmlMenu() {
    if (!menuAberto) return '';
    const kb = (n) => (n / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `<div class="or-chip-menu" role="menu"><span class="or-chip-menu-titulo">Estou usando como</span>${Object.keys(PESSOAS).map((k) => `<button type="button" role="menuitemradio" aria-checked="${k === eu}" data-colab="trocar" data-pessoa="${k}"><span class="or-chip-avatar" style="--or-cor:${PESSOAS[k].cor}">${PESSOAS[k].nome[0]}</span>${PESSOAS[k].nome}${k === eu ? ' <b>✓</b>' : ''}</button>`).join('')}<span class="or-chip-menu-uso">Tráfego desta sessão: ~${kb(uso.enviados)} KB enviados · ~${kb(uso.recebidos)} KB recebidos</span></div>`;
  }

  function renderizar() {
    if (!raiz) return;
    const host = raiz.querySelector('[data-ref="colab"]');
    if (host) host.innerHTML = ligado ? `<div class="or-colab-chips">${chip(eu, null, true)}${chip(outra(), resumo(outra()), false)}${htmlMenu()}</div>` : '';
    decorarBordas();
    aplicarRascunhos();
    desenharSetas();
  }

  // Borda na cor de quem está em cada simulação (e na Visão geral)
  function decorarBordas() {
    if (!raiz) return;
    const ondeEsta = {};
    if (ligado) {
      [eu, outra()].forEach((p) => {
        const info = p === eu ? { ambiente: api.ambiente(), ausente: estado === 'ausente' } : resumo(p);
        if (!info) return;
        const chave = info.ambiente === 'lista' ? '__lista__' : String(info.ambiente).replace(/^sim_/, '');
        (ondeEsta[chave] = ondeEsta[chave] || []).push({ p, ausente: info.ausente });
      });
    }
    raiz.querySelectorAll('[data-sim]').forEach((el) => {
      const quem = ondeEsta[el.dataset.sim] || [];
      const marcos = quem.some((q) => q.p === 'marcos');
      const esther = quem.some((q) => q.p === 'esther');
      el.classList.toggle('or-pres', marcos || esther);
      el.classList.toggle('or-pres-marcos', marcos && !esther);
      el.classList.toggle('or-pres-esther', esther && !marcos);
      el.classList.toggle('or-pres-ambos', marcos && esther);
      el.classList.toggle('or-pres-ausente', quem.length > 0 && quem.every((q) => q.ausente));
    });
  }

  function aoClicar(e) {
    const alvo = e.target.closest('[data-colab]');
    if (!alvo) {
      if (menuAberto) { menuAberto = false; renderizar(); }
      return;
    }
    if (alvo.dataset.colab === 'menu') { menuAberto = !menuAberto; renderizar(); return; }
    if (alvo.dataset.colab === 'trocar') trocarPessoa(alvo.dataset.pessoa);
  }

  function trocarPessoa(pessoa) {
    menuAberto = false;
    if (!PESSOAS[pessoa] || pessoa === eu) { renderizar(); return; }
    try { localStorage.setItem(CHAVE_PESSOA, pessoa); } catch (e) { /* sem armazenamento */ }
    const estava = ligado;
    if (estava) desligar();
    eu = pessoa;
    if (estava) ligar();
    renderizar();
  }

  // ── Ganchos chamados pela área ───────────────────────────────────────────
  function aposRender() {
    if (!raiz) return;
    if (ligado) { publicarPresenca(); sincronizarAssinaturas(); }
    renderizar();
  }

  function aposModal() {
    if (!ligado) return;
    publicarPresenca();
    if (api.modalAberto()) esconderMinhaSeta();
    renderizar();
  }

  window.OrganizacaoRecursosColab = { iniciar, parar, aposRender, aposModal };
})();

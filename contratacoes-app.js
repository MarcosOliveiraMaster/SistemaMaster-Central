// contratacoes-app.js
// Sino de "Nova contratação via App" no cabeçalho da Central.
//
// O cliente contrata pelo portal (SistemMaster-Login/contratacao.js) e a
// contratação vira um documento em "simulacoes" com origem "app-cliente" e
// lidaCentral false. Aqui a Central escuta essas contratações em tempo real:
//   - sino no cabeçalho com o número de contratações ainda não abertas e uma
//     lista rápida (clicar abre a simulação na área Simulações);
//   - contador no item "Simulações" do menu lateral;
//   - aviso (toast) quando chega uma nova com o painel aberto;
//   - "(n)" no título da aba do navegador.
// Abrir a simulação marca lidaCentral = true (functions-simulacoes.js).
// Regras: SistemMaster-Login/firestore.rules → match /simulacoes.

(function () {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fdb = () => firebase.firestore();
  const TITULO_BASE = document.title;

  let novas = [];
  let cancelar = null;
  let primeiraLeitura = true;

  function horasDe(duracao) {
    const m = String(duracao || '').match(/(\d+)\s*h\s*(\d+)?/i);
    return m ? (parseInt(m[1], 10) || 0) + (parseInt(m[2] || '0', 10) || 0) / 60 : 0;
  }
  function fmtHoras(h) {
    const i = Math.floor(h), min = Math.round((h - i) * 60);
    return min ? `${i}h${String(min).padStart(2, '0')}` : `${i}h`;
  }
  function haQuanto(ts) {
    const d = ts && ts.toDate ? ts.toDate() : null;
    if (!d) return 'agora';
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Estilos (sino, painel, contadores do menu e selo dos cards) ─────────
  function injetarEstilo() {
    if (document.getElementById('ca-estilo')) return;
    const s = document.createElement('style');
    s.id = 'ca-estilo';
    s.textContent = `
    .ca-acoes{display:flex;align-items:center;gap:.5rem;}
    .ca-sino{position:relative;width:40px;height:40px;border-radius:12px;border:1.5px solid #f3f4f6;background:#fff;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.05rem;transition:all .15s;}
    .ca-sino:hover{border-color:#fcd9a8;color:#f28705;}
    .ca-sino.tem{color:#f28705;border-color:#fcd9a8;background:#fff7eb;}
    .ca-sino.tem i{animation:ca-balanca 1.6s ease-in-out infinite;transform-origin:50% 0;}
    .ca-sino .ca-num{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#dc2626;color:#fff;font:700 .68rem 'Lexend',sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;}
    .ca-painel{position:fixed;z-index:10040;width:min(380px,calc(100vw - 24px));max-height:min(70vh,520px);background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(17,24,39,.22);border:1px solid #f3f4f6;display:flex;flex-direction:column;overflow:hidden;font-family:'Comfortaa',sans-serif;animation:ca-surge .18s ease;}
    .ca-painel-topo{padding:.85rem 1rem;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:.5rem;}
    .ca-painel-topo h4{margin:0;flex:1;font:700 .92rem 'Lexend',sans-serif;color:#111827;}
    .ca-painel-lista{overflow-y:auto;padding:.4rem;}
    .ca-item{width:100%;text-align:left;border:0;background:none;border-radius:12px;padding:.7rem .75rem;cursor:pointer;display:flex;gap:.7rem;align-items:flex-start;font:inherit;}
    .ca-item:hover,.ca-item:focus-visible{background:#fff7eb;outline:none;}
    .ca-item-ico{flex-shrink:0;width:36px;height:36px;border-radius:10px;background:#fff1de;color:#f28705;display:flex;align-items:center;justify-content:center;}
    .ca-item b{display:block;font:700 .84rem 'Lexend',sans-serif;color:#111827;line-height:1.3;}
    .ca-item small{display:block;font-size:.74rem;color:#6b7280;margin-top:.15rem;}
    .ca-vazio{padding:1.6rem 1rem;text-align:center;color:#9ca3af;font-size:.85rem;}
    .ca-vazio i{display:block;font-size:1.6rem;margin-bottom:.4rem;color:#d1d5db;}
    .ca-painel-rodape{border-top:1px solid #f3f4f6;padding:.6rem;}
    .ca-painel-rodape button{width:100%;border:0;background:#f9fafb;border-radius:10px;padding:.6rem;font:700 .8rem 'Lexend',sans-serif;color:#d97804;cursor:pointer;}
    .ca-painel-rodape button:hover{background:#fff7eb;}
    .contador-menu{margin-left:auto;background:#fff;color:#d97804;border-radius:999px;font:700 .7rem 'Lexend',sans-serif;padding:.05rem .45rem;min-width:1.2rem;text-align:center;}
    #menu-lateral.collapsed .contador-menu{display:inline-block !important;position:absolute;top:4px;right:8px;margin:0;}
    #menu-lateral .contador-menu[hidden],#menu-lateral.collapsed .contador-menu[hidden]{display:none !important;}
    .card.card-app{border-left:4px solid #f28705;}
    .card.card-app-nova{box-shadow:0 0 0 2px rgba(242,135,5,.35),0 8px 22px rgba(242,135,5,.18);}
    .selo-app-linha{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem;}
    .selo-app{display:inline-flex;align-items:center;gap:.3rem;font:700 .68rem 'Lexend',sans-serif;background:#fff7eb;color:#d97804;border-radius:999px;padding:.18rem .55rem;}
    .selo-app-nova{display:inline-flex;align-items:center;gap:.3rem;font:700 .68rem 'Lexend',sans-serif;background:#dc2626;color:#fff;border-radius:999px;padding:.18rem .55rem;}
    .selo-app-nova i{animation:ca-balanca 1.6s ease-in-out infinite;transform-origin:50% 0;}
    body.theme-blue .ca-sino.tem{color:#2563eb;border-color:#bfdbfe;background:#eff6ff;}
    @keyframes ca-balanca{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-12deg)}30%{transform:rotate(8deg)}40%{transform:rotate(-5deg)}}
    @keyframes ca-surge{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.ca-sino.tem i,.selo-app-nova i,.ca-painel{animation:none}}
    `;
    document.head.appendChild(s);
  }

  // ── Sino no cabeçalho ───────────────────────────────────────────────────
  let sino = null;
  function montarSino() {
    if (sino) return;
    const tema = document.getElementById('btn-theme-toggle');
    if (!tema || !tema.parentElement) return;
    const grupo = document.createElement('div');
    grupo.className = 'ca-acoes';
    tema.parentElement.insertBefore(grupo, tema);
    sino = document.createElement('button');
    sino.type = 'button';
    sino.className = 'ca-sino';
    sino.id = 'btn-sino-contratacoes';
    sino.setAttribute('aria-haspopup', 'dialog');
    sino.innerHTML = '<i class="fas fa-bell"></i>';
    sino.onclick = (e) => { e.stopPropagation(); alternarPainel(); };
    grupo.appendChild(sino);
    grupo.appendChild(tema);
  }

  function atualizarContadores() {
    const n = novas.length;
    const txt = n > 99 ? '99+' : String(n);
    if (sino) {
      sino.classList.toggle('tem', n > 0);
      sino.innerHTML = `<i class="fas fa-bell"></i>${n ? `<span class="ca-num">${txt}</span>` : ''}`;
      const rotulo = n ? `${n} ${n === 1 ? 'nova contratação' : 'novas contratações'} via app` : 'Nenhuma contratação nova via app';
      sino.title = rotulo;
      sino.setAttribute('aria-label', rotulo);
    }
    const menu = document.getElementById('contador-contratacoes-app');
    if (menu) { menu.textContent = txt; menu.hidden = n === 0; }
    const outros = ((typeof window.contadorAvaliacoesNaoLidas === 'function') ? window.contadorAvaliacoesNaoLidas() : 0)
      + ((typeof window.contadorSolicitacoesNaoLidas === 'function') ? window.contadorSolicitacoesNaoLidas() : 0);
    const total = n + outros;
    document.title = total ? `(${total > 99 ? '99+' : total}) ${TITULO_BASE}` : TITULO_BASE;
    const painel = document.querySelector('.ca-painel');
    if (painel) desenharLista(painel);
  }
  window.atualizarTituloNotificacoes = atualizarContadores;

  // ── Painel com a lista ──────────────────────────────────────────────────
  function desenharLista(painel) {
    const lista = painel.querySelector('.ca-painel-lista');
    if (!novas.length) {
      lista.innerHTML = '<div class="ca-vazio"><i class="fas fa-bell-slash"></i>Nenhuma contratação nova via app.</div>';
      return;
    }
    lista.innerHTML = novas.map(s => {
      const aulas = s.aulas || [];
      const horas = typeof s.SomatorioDuracaoAulas === 'number' ? s.SomatorioDuracaoAulas : aulas.reduce((t, a) => t + horasDe(a.duracao), 0);
      return `<button type="button" class="ca-item" data-id="${esc(s.idSimulacao || s.id)}">
        <span class="ca-item-ico"><i class="fas fa-mobile-screen-button"></i></span>
        <span><b>${esc(s.tituloSimulacao || ('Contratação via App: ' + (s.nomeCliente || '')))}</b>
        <small>${aulas.length} ${aulas.length === 1 ? 'aula' : 'aulas'} · ${fmtHoras(horas)} · ${esc(haQuanto(s.timestamp))}</small></span>
      </button>`;
    }).join('');
    lista.querySelectorAll('.ca-item').forEach(b => { b.onclick = () => { fecharPainel(); abrirSimulacao(b.dataset.id); }; });
  }

  function fecharPainel() {
    document.querySelector('.ca-painel')?.remove();
    document.removeEventListener('mousedown', foraDoPainel, true);
    document.removeEventListener('keydown', escPainel);
    sino?.setAttribute('aria-expanded', 'false');
  }
  function foraDoPainel(e) {
    const p = document.querySelector('.ca-painel');
    if (p && !p.contains(e.target) && !sino.contains(e.target)) fecharPainel();
  }
  function escPainel(e) { if (e.key === 'Escape') { fecharPainel(); sino?.focus(); } }

  function alternarPainel() {
    if (document.querySelector('.ca-painel')) { fecharPainel(); return; }
    const p = document.createElement('div');
    p.className = 'ca-painel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Contratações via app');
    p.innerHTML = `
      <div class="ca-painel-topo"><i class="fas fa-bell" style="color:#f28705"></i><h4>Contratações via App</h4></div>
      <div class="ca-painel-lista"></div>
      <div class="ca-painel-rodape"><button type="button">Ver todas em Simulações</button></div>`;
    const r = sino.getBoundingClientRect();
    p.style.top = (r.bottom + 8) + 'px';
    document.body.appendChild(p);
    // Alinha pela direita do sino, sem sair da tela no celular.
    const largura = p.offsetWidth;
    p.style.left = Math.max(12, Math.min(r.right - largura, window.innerWidth - largura - 12)) + 'px';
    desenharLista(p);
    p.querySelector('.ca-painel-rodape button').onclick = () => { fecharPainel(); irParaSimulacoes(); };
    sino.setAttribute('aria-expanded', 'true');
    setTimeout(() => {
      document.addEventListener('mousedown', foraDoPainel, true);
      document.addEventListener('keydown', escPainel);
    }, 0);
    p.querySelector('.ca-item')?.focus();
  }

  function irParaSimulacoes() {
    const item = document.querySelector('#menu-lateral .menu-item[data-section="simulacoes"]');
    if (item && !item.classList.contains('active')) item.click();
  }

  function abrirSimulacao(id) {
    if (typeof Simulacoes === 'undefined' || !Simulacoes.abrirPorId) return;
    // Abre direto se a seção já está aberta; senão navega e abre ao carregar.
    Simulacoes.abrirPorId(id);
    irParaSimulacoes();
  }

  // ── Escuta em tempo real ────────────────────────────────────────────────
  function iniciarEscuta() {
    if (cancelar || !window.firebase || !window.currentUser) return;
    injetarEstilo();
    montarSino();
    cancelar = fdb().collection('simulacoes')
      .where('origem', '==', 'app-cliente')
      .where('lidaCentral', '==', false)
      .onSnapshot((snap) => {
        const chegaram = [];
        snap.docChanges().forEach(ch => { if (ch.type === 'added' && !primeiraLeitura) chegaram.push(ch.doc.data()); });
        novas = [];
        snap.forEach(d => novas.push({ id: d.id, ...d.data() }));
        const t = (x) => (x && x.toMillis ? x.toMillis() : Date.now());
        novas.sort((a, b) => t(b.timestamp) - t(a.timestamp));
        atualizarContadores();
        if (chegaram.length) avisarChegada(chegaram);
        primeiraLeitura = false;
      }, (err) => console.warn('[Contratações via App] Escuta indisponível:', err && err.code));
  }

  function avisarChegada(lista) {
    const nome = lista[0].nomeCliente || 'cliente';
    const msg = lista.length === 1 ? `🔔 Nova contratação via App: ${nome}` : `🔔 ${lista.length} novas contratações via App`;
    if (typeof showToast === 'function') showToast(msg, 'success', 7000);
    if (typeof Simulacoes !== 'undefined' && Simulacoes.recarregarSeAberta) Simulacoes.recarregarSeAberta();
    // Aba em segundo plano: notificação do navegador (se o admin já permitiu).
    try {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Master · Nova contratação via App', { body: lista.length === 1 ? nome : msg, icon: 'img/logo.png' });
      }
    } catch (_) { /* navegador sem suporte */ }
  }

  // Começa a escutar assim que o login do Central terminar.
  const espera = setInterval(() => { if (window.currentUser && window.firebase) { clearInterval(espera); iniciarEscuta(); } }, 500);
  setTimeout(() => clearInterval(espera), 60000);

  // Pede permissão de notificação do navegador no primeiro clique no sino.
  document.addEventListener('click', function pedir(e) {
    if (!e.target.closest || !e.target.closest('#btn-sino-contratacoes')) return;
    document.removeEventListener('click', pedir);
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (_) { /* ignora */ }
  });
})();

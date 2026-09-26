// layout-responsivo.js
// Comportamento do layout em celular e tablet (estilos em layout-responsivo.css).
// Não muda a navegação existente (script.js): os atalhos só "clicam" nos
// mesmos botões do menu lateral.
//  - Celular: botão ☰ no cabeçalho abre o menu como gaveta; barra de atalhos
//    embaixo; tabelas viram cartões (rótulos tirados do cabeçalho da tabela).
//  - Tablet: o menu começa recolhido (só ícones); o logo continua alternando.

(function () {
  'use strict';

  var CELULAR = window.matchMedia('(max-width: 768px)');
  var TABLET = window.matchMedia('(min-width: 769px) and (max-width: 1180px)');
  var menu = document.getElementById('menu-lateral');
  var header = document.getElementById('app-header');
  if (!menu || !header) return;

  // ── Data no cabeçalho ──
  var data = document.getElementById('section-date');
  if (data) {
    var hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    data.textContent = hoje.charAt(0).toUpperCase() + hoje.slice(1);
  }

  // ── Dicas nos ícones (menu recolhido) ──
  menu.querySelectorAll('.menu-item, .menu-item-submenu, .menu-item-submenu-leaf').forEach(function (b) {
    var span = b.querySelector('span');
    if (span && !b.title) b.title = span.textContent.trim();
  });

  // ── Gaveta (celular) ──
  var linhaHeader = header.firstElementChild;
  var btnGaveta = document.createElement('button');
  btnGaveta.type = 'button';
  btnGaveta.className = 'btn-gaveta';
  btnGaveta.setAttribute('aria-label', 'Abrir menu');
  btnGaveta.setAttribute('aria-controls', 'menu-lateral');
  btnGaveta.setAttribute('aria-expanded', 'false');
  btnGaveta.innerHTML = '<i class="fas fa-bars"></i>';
  if (linhaHeader) linhaHeader.insertBefore(btnGaveta, linhaHeader.firstChild);

  var fundo = document.createElement('div');
  fundo.id = 'gaveta-fundo';
  document.body.appendChild(fundo);

  function abrirGaveta(abrir) {
    menu.classList.toggle('menu-open', abrir);
    document.body.classList.toggle('gaveta-aberta', abrir);
    btnGaveta.setAttribute('aria-expanded', String(abrir));
  }
  btnGaveta.addEventListener('click', function () { abrirGaveta(!menu.classList.contains('menu-open')); });
  fundo.addEventListener('click', function () { abrirGaveta(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('menu-open')) abrirGaveta(false);
  });
  // Escolher uma tela fecha a gaveta (abrir submenu não fecha).
  menu.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-section]');
    if (!alvo || alvo.classList.contains('menu-item-expandable')) return;
    if (CELULAR.matches) setTimeout(function () { abrirGaveta(false); }, 120);
  });

  // ── Barra de atalhos (celular) ──
  var ATALHOS = [
    { secao: 'painel-central', rotulo: 'Painel', icone: 'fas fa-home' },
    { secao: 'banco-aulas', rotulo: 'Aulas', icone: 'fas fa-book' },
    { secao: 'calendario', rotulo: 'Calendário', icone: 'fas fa-calendar-alt' },
    { secao: 'mensagens', rotulo: 'Financeiro', icone: 'fas fa-wallet' }
  ];
  var barra = document.createElement('nav');
  barra.id = 'barra-inferior';
  barra.setAttribute('aria-label', 'Atalhos');
  barra.innerHTML = ATALHOS.map(function (a) {
    return '<button type="button" data-atalho="' + a.secao + '"><i class="' + a.icone + '"></i>' + a.rotulo + '</button>';
  }).join('') + '<button type="button" data-atalho="menu"><i class="fas fa-bars"></i>Menu</button>';
  document.body.appendChild(barra);
  barra.addEventListener('click', function (e) {
    var b = e.target.closest('[data-atalho]');
    if (!b) return;
    var secao = b.getAttribute('data-atalho');
    if (secao === 'menu') { abrirGaveta(true); return; }
    var item = menu.querySelector('.menu-item[data-section="' + secao + '"]');
    if (item) item.click();
  });

  function marcarAtalho() {
    var ativo = menu.querySelector('.active[data-section]');
    var secao = ativo ? ativo.getAttribute('data-section') : '';
    barra.querySelectorAll('[data-atalho]').forEach(function (b) {
      var eh = b.getAttribute('data-atalho') === secao;
      b.classList.toggle('ativo', eh);
      if (eh) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  new MutationObserver(marcarAtalho).observe(menu, { subtree: true, attributes: true, attributeFilter: ['class'] });
  marcarAtalho();

  // ── Tablet: começa com o menu recolhido (só ícones) ──
  function aplicarTamanho() {
    if (TABLET.matches) menu.classList.add('collapsed');
    else if (!CELULAR.matches) menu.classList.remove('collapsed');
    if (!CELULAR.matches) abrirGaveta(false);
  }
  (TABLET.addEventListener ? TABLET.addEventListener('change', aplicarTamanho) : TABLET.addListener(aplicarTamanho));
  (CELULAR.addEventListener ? CELULAR.addEventListener('change', aplicarTamanho) : CELULAR.addListener(aplicarTamanho));
  aplicarTamanho();

  // ── Tabelas em cartões (celular) ──
  // Cada célula recebe data-label com o texto do cabeçalho da coluna. O CSS só
  // usa isso no celular; no computador e no tablet as tabelas ficam iguais.
  function rotulosDe(tabela) {
    var linha = tabela.tHead && tabela.tHead.rows[tabela.tHead.rows.length - 1];
    if (!linha) return null;
    var rotulos = [];
    Array.prototype.forEach.call(linha.cells, function (th) {
      var texto = th.textContent.replace(/\s+/g, ' ').trim();
      for (var i = 0; i < (th.colSpan || 1); i++) rotulos.push(texto);
    });
    return rotulos;
  }
  function prepararTabela(tabela) {
    if (tabela.closest('[class*="calend"], [id*="calend"], .sem-cartao')) return;
    var rotulos = rotulosDe(tabela);
    if (!rotulos || rotulos.length < 3) return;
    tabela.classList.add('rt');
    var pai = tabela.parentElement;
    if (pai && getComputedStyle(pai).overflowX !== 'visible') pai.classList.add('rt-pai');
    Array.prototype.forEach.call(tabela.tBodies, function (tbody) {
      Array.prototype.forEach.call(tbody.rows, function (tr) {
        var col = 0;
        Array.prototype.forEach.call(tr.cells, function (td) {
          var span = td.colSpan || 1;
          if (span >= Math.max(3, rotulos.length - 1)) td.classList.add('rt-cheia');
          else td.setAttribute('data-label', rotulos[col] || '');
          col += span;
        });
      });
    });
  }
  var pendente = false;
  function prepararTudo() {
    pendente = false;
    document.querySelectorAll('main table, .modal-container table').forEach(prepararTabela);
  }
  function agendar() {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(prepararTudo);
  }
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
  agendar();
})();

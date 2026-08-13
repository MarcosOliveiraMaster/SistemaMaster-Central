/* =========================================================================
   Partes do Corpo | Secao 2: Jogo da Memoria
   24 cartas = 12 pares (desenho + palavra em ingles) das mesmas 12 partes
   ========================================================================= */
(function (global) {
  'use strict';

  var BP = global.BP;
  var CHAVE_RECORDE = 'bp:memoria:recorde';

  var tabuleiro, elJogadas, elPares, elRecorde, elTempo;
  var viradas = [];      // cartas aguardando comparacao
  var travado = false;
  var jogadas = 0;
  var paresFeitos = 0;
  var relogio = null;
  var segundos = 0;
  var montado = false;

  /* ------------------------------------------------------------ cartas */

  function criarCarta(parte, tipo) {
    var carta = document.createElement('button');
    carta.type = 'button';
    carta.className = 'mem-carta fig-' + parte.id;
    carta.setAttribute('data-id', parte.id);
    carta.setAttribute('data-tipo', tipo);
    carta.setAttribute('aria-label', 'Carta virada para baixo');

    var frente = tipo === 'imagem'
      ? '<span class="mem-palco">' + parte.svg + '</span>'
      : '<span class="mem-palavra">' + parte.en + '<em>' + parte.fonetica + '</em></span>';

    carta.innerHTML =
      '<span class="mem-face mem-verso">' + BP.icones.logoCarta + '</span>' +
      '<span class="mem-face mem-frente mem-frente-' + tipo + '">' + frente + '</span>';

    carta.addEventListener('click', function () { virar(carta, parte); });
    return carta;
  }

  function virar(carta, parte) {
    if (travado) return;
    if (carta.classList.contains('virada') || carta.classList.contains('casada')) return;

    carta.classList.add('virada');
    carta.setAttribute('aria-label', parte.pt + ' / ' + parte.en);
    BP.audio.clique();

    if (carta.getAttribute('data-tipo') === 'palavra') BP.audio.falarPalavra(parte.en);

    viradas.push({ el: carta, parte: parte });
    if (viradas.length < 2) return;

    jogadas++;
    atualizarPlacar();
    travado = true;

    var a = viradas[0], b = viradas[1];

    if (a.parte.id === b.parte.id && a.el !== b.el) {
      global.setTimeout(function () {
        a.el.classList.add('casada');
        b.el.classList.add('casada');
        paresFeitos++;
        atualizarPlacar();
        BP.audio.acerto();
        if (a.el.getAttribute('data-tipo') === 'imagem') BP.audio.falarPalavra(a.parte.en);
        viradas = [];
        travado = false;
        if (paresFeitos === BP.PARTES.length) vencer();
      }, 320);
    } else {
      global.setTimeout(function () {
        a.el.classList.add('errou');
        b.el.classList.add('errou');
        BP.audio.erro();
      }, 200);
      global.setTimeout(function () {
        [a, b].forEach(function (c) {
          c.el.classList.remove('virada', 'errou');
          c.el.setAttribute('aria-label', 'Carta virada para baixo');
        });
        viradas = [];
        travado = false;
      }, 1000);
    }
  }

  /* ----------------------------------------------------------- placar */

  function atualizarPlacar() {
    if (elJogadas) elJogadas.textContent = jogadas;
    if (elPares) elPares.textContent = paresFeitos + '/' + BP.PARTES.length;
  }

  function formatarTempo(s) {
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function correrRelogio() {
    pararRelogio();
    relogio = global.setInterval(function () {
      segundos++;
      if (elTempo) elTempo.textContent = formatarTempo(segundos);
    }, 1000);
  }

  function iniciarRelogio() {
    segundos = 0;
    if (elTempo) elTempo.textContent = '00:00';
    correrRelogio();
  }

  function pararRelogio() {
    if (relogio) { global.clearInterval(relogio); relogio = null; }
  }

  function lerRecorde() {
    try {
      var v = parseInt(localStorage.getItem(CHAVE_RECORDE), 10);
      return isNaN(v) ? null : v;
    } catch (e) { return null; }
  }

  function mostrarRecorde() {
    var r = lerRecorde();
    if (elRecorde) elRecorde.textContent = r === null ? '—' : r + ' jogadas';
  }

  function vencer() {
    pararRelogio();
    BP.audio.vitoria();
    var recorde = lerRecorde();
    var novo = recorde === null || jogadas < recorde;
    if (novo) {
      try { localStorage.setItem(CHAVE_RECORDE, String(jogadas)); } catch (e) {}
      mostrarRecorde();
    }
    BP.ui.festa(
      'Parabéns! 🎉',
      'Você encontrou os 12 pares em <strong>' + jogadas + ' jogadas</strong> e ' +
      '<strong>' + formatarTempo(segundos) + '</strong>.' +
      (novo ? '<br><span class="destaque">Novo recorde!</span>' : ''),
      novo
    );
  }

  /* ------------------------------------------------------------ setup */

  function novoJogo() {
    if (!tabuleiro) return;
    tabuleiro.innerHTML = '';
    viradas = [];
    travado = false;
    jogadas = 0;
    paresFeitos = 0;
    atualizarPlacar();
    mostrarRecorde();

    var cartas = [];
    BP.PARTES.forEach(function (parte) {
      cartas.push({ parte: parte, tipo: 'imagem' });
      cartas.push({ parte: parte, tipo: 'palavra' });
    });

    var frag = document.createDocumentFragment();
    BP.embaralhar(cartas).forEach(function (c) {
      frag.appendChild(criarCarta(c.parte, c.tipo));
    });
    tabuleiro.appendChild(frag);
    iniciarRelogio();
  }

  function montar() {
    tabuleiro = document.getElementById('mem-tabuleiro');
    elJogadas = document.getElementById('mem-jogadas');
    elPares = document.getElementById('mem-pares');
    elRecorde = document.getElementById('mem-recorde');
    elTempo = document.getElementById('mem-tempo');

    if (!montado) {
      var btn = document.getElementById('mem-novo');
      if (btn) btn.addEventListener('click', novoJogo);
      montado = true;
      novoJogo();
    } else if (relogio === null && paresFeitos < BP.PARTES.length) {
      correrRelogio(); // retomou a secao com jogo em andamento: mantem o tempo
    }
  }

  function pausar() {
    pararRelogio();
  }

  BP.secoes = BP.secoes || {};
  BP.secoes.memoria = { montar: montar, pausar: pausar, novoJogo: novoJogo };
})(window);

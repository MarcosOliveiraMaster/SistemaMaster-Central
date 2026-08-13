/* =========================================================================
   Partes do Corpo | Nucleo da aplicacao
   Navegacao entre secoes, icones compartilhados e helpers de interface
   ========================================================================= */
(function (global) {
  'use strict';

  var BP = global.BP = global.BP || {};

  /* ------------------------------------------------------------ icones */

  BP.icones = {
    altoFalante:
      '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">' +
        '<path d="M4 9h3l5-4v14l-5-4H4z"/>' +
        '<path class="ic-onda" d="M16 8.5c1.6 1.6 1.6 5.4 0 7"/>' +
        '<path class="ic-onda" d="M19 6c3 3 3 9 0 12"/>' +
      '</svg>',
    logoCarta:
      '<svg viewBox="0 0 40 40" class="ic-carta" aria-hidden="true">' +
        '<circle cx="20" cy="13" r="6"/>' +
        '<path d="M20 21c-7 0-12 5-12 12h24c0-7-5-12-12-12z"/>' +
      '</svg>'
  };

  /* ------------------------------------------------------ interface */

  BP.ui = {
    /* Aviso discreto no topo */
    aviso: function (texto) {
      var box = document.getElementById('aviso');
      if (!box) return;
      box.textContent = texto;
      box.classList.add('visivel');
      global.clearTimeout(BP.ui._t);
      BP.ui._t = global.setTimeout(function () {
        box.classList.remove('visivel');
      }, 5000);
    },

    /* Modal de conclusao de jogo */
    festa: function (titulo, html, comConfete) {
      var modal = document.getElementById('modal');
      if (!modal) return;
      modal.querySelector('.modal-titulo').innerHTML = titulo;
      modal.querySelector('.modal-corpo').innerHTML = html;
      modal.classList.add('aberto');
      modal.setAttribute('aria-hidden', 'false');
      var fechar = modal.querySelector('.modal-fechar');
      if (fechar) fechar.focus();
      if (comConfete) confete();
    },

    fecharModal: function () {
      var modal = document.getElementById('modal');
      if (!modal) return;
      modal.classList.remove('aberto');
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  function confete() {
    var palco = document.getElementById('confete');
    if (!palco) return;
    palco.innerHTML = '';
    var cores = ['#f28705', '#ffb347', '#48bb78', '#4299e1', '#ed64a6', '#ecc94b'];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement('i');
      p.className = 'confete-peca';
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = cores[i % cores.length];
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      p.style.animationDuration = (2 + Math.random() * 1.6) + 's';
      p.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      palco.appendChild(p);
    }
    global.setTimeout(function () { palco.innerHTML = ''; }, 4200);
  }

  /* ------------------------------------------------------ navegacao */

  var SECOES = ['cards', 'memoria', 'forca', 'ligar', 'caca'];
  var atual = null;

  function irPara(nome, semHash) {
    if (SECOES.indexOf(nome) === -1) nome = 'cards';
    if (atual === nome) return;

    // Pausa a secao anterior (ex.: cronometro da memoria)
    if (atual && BP.secoes[atual] && BP.secoes[atual].pausar) BP.secoes[atual].pausar();

    SECOES.forEach(function (s) {
      var secao = document.getElementById('secao-' + s);
      var botao = document.querySelector('.nav-btn[data-secao="' + s + '"]');
      var ativa = s === nome;
      if (secao) {
        secao.classList.toggle('ativa', ativa);
        secao.hidden = !ativa;
      }
      if (botao) {
        botao.classList.toggle('ativo', ativa);
        botao.setAttribute('aria-selected', ativa ? 'true' : 'false');
      }
    });

    atual = nome;
    if (!semHash) {
      try { global.history.replaceState(null, '', '#' + nome); } catch (e) { global.location.hash = nome; }
    }

    if (BP.secoes[nome] && BP.secoes[nome].montar) BP.secoes[nome].montar();
    var menu = document.getElementById('nav');
    if (menu) menu.classList.remove('aberto');
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------------------------------------------------- boot */

  function ligarNavegacao() {
    var botoes = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < botoes.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { irPara(b.getAttribute('data-secao')); });
      })(botoes[i]);
    }

    var hamburguer = document.getElementById('nav-toggle');
    if (hamburguer) {
      hamburguer.addEventListener('click', function () {
        var menu = document.getElementById('nav');
        if (menu) menu.classList.toggle('aberto');
      });
    }

    global.addEventListener('hashchange', function () {
      irPara((global.location.hash || '').replace('#', ''), true);
    });
  }

  function ligarSom() {
    var btn = document.getElementById('btn-som');
    if (!btn) return;

    function pintar() {
      var mudo = BP.audio.estaMudo();
      btn.classList.toggle('mudo', mudo);
      btn.setAttribute('aria-pressed', mudo ? 'true' : 'false');
      btn.title = mudo ? 'Som desligado — clique para ligar' : 'Som ligado — clique para desligar';
      btn.querySelector('.som-texto').textContent = mudo ? 'Som off' : 'Som on';
    }

    btn.addEventListener('click', function () {
      BP.audio.alternarMudo();
      pintar();
      if (!BP.audio.estaMudo()) BP.audio.clique();
    });
    pintar();

    if (!BP.audio.disponivel()) {
      BP.ui.aviso('Este navegador não tem sintetizador de voz: a pronúncia em inglês pode não funcionar. Use Chrome, Edge ou Safari atualizados.');
    }
  }

  function ligarModal() {
    var modal = document.getElementById('modal');
    if (!modal) return;
    modal.addEventListener('click', function (e) {
      if (e.target === modal || (e.target.closest && e.target.closest('.modal-fechar'))) {
        BP.ui.fecharModal();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') BP.ui.fecharModal();
    });
  }

  function iniciar() {
    ligarNavegacao();
    ligarSom();
    ligarModal();

    // A secao de cards e montada sempre, pois é a porta de entrada
    BP.secoes.cards.montar();
    atual = 'cards';

    var inicial = (global.location.hash || '').replace('#', '');
    if (inicial && inicial !== 'cards') irPara(inicial, true);

    var ano = document.getElementById('ano');
    if (ano) ano.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  BP.irPara = irPara;
})(window);

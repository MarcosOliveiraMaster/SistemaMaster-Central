/* =========================================================================
   Partes do Corpo | Secao 1: grid de 12 cards
   Imagem animada + nome em portugues + nome em ingles + pronuncia no clique
   ========================================================================= */
(function (global) {
  'use strict';

  var BP = global.BP;
  var montado = false;

  function criarCard(parte) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'card fig-' + parte.id;
    card.setAttribute('data-id', parte.id);
    card.setAttribute('aria-label', parte.pt + ' — em inglês: ' + parte.en + '. Clique para ouvir a pronúncia.');

    card.innerHTML =
      '<span class="card-palco">' + parte.svg + '</span>' +
      '<span class="card-textos">' +
        '<span class="card-pt">' + parte.pt + '</span>' +
        '<span class="card-en">' + parte.en + '</span>' +
        '<span class="card-fon">' + parte.fonetica + '</span>' +
      '</span>' +
      '<span class="card-alto" aria-hidden="true">' + BP.icones.altoFalante + '</span>';

    card.addEventListener('click', function () {
      // Reinicia a animacao "forte" a cada clique
      card.classList.remove('tocando');
      void card.offsetWidth;
      card.classList.add('tocando');
      BP.audio.falarPalavra(parte.en);
      global.setTimeout(function () { card.classList.remove('tocando'); }, 1400);
    });

    return card;
  }

  function montar() {
    if (montado) return;
    var grid = document.getElementById('grid-cards');
    if (!grid) return;

    var frag = document.createDocumentFragment();
    BP.PARTES.forEach(function (parte) {
      frag.appendChild(criarCard(parte));
    });
    grid.appendChild(frag);

    var btnTodos = document.getElementById('btn-ouvir-todos');
    if (btnTodos) {
      btnTodos.addEventListener('click', function () {
        ouvirTodos(grid, btnTodos);
      });
    }

    montado = true;
  }

  /* Passa por todas as 12 partes falando uma a uma ---------------------- */
  var tourAtivo = false;

  function ouvirTodos(grid, botao) {
    if (tourAtivo) return;
    if (!BP.audio.disponivel()) {
      BP.ui.aviso('Seu navegador não tem sintetizador de voz disponível.');
      return;
    }
    tourAtivo = true;
    botao.disabled = true;
    botao.classList.add('ocupado');

    var i = 0;
    var cards = grid.querySelectorAll('.card');

    function passo() {
      if (i >= BP.PARTES.length) {
        tourAtivo = false;
        botao.disabled = false;
        botao.classList.remove('ocupado');
        return;
      }
      var card = cards[i];
      var parte = BP.PARTES[i];
      for (var k = 0; k < cards.length; k++) cards[k].classList.remove('tocando');
      card.classList.add('tocando');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      BP.audio.falarPalavra(parte.en);
      i++;
      global.setTimeout(passo, 1700);
    }
    passo();
  }

  BP.secoes = BP.secoes || {};
  BP.secoes.cards = { montar: montar };
})(window);

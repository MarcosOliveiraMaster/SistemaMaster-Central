/* =========================================================================
   Partes do Corpo | Secao 3: Jogo da Forca
   Toda a interface em PORTUGUES.
   A palavra a descobrir esta em INGLES e a dica tambem esta em INGLES.
   ========================================================================= */
(function (global) {
  'use strict';

  var BP = global.BP;
  var ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var MAX_ERROS = 6;

  var elPalavra, elDica, elTeclado, elErros, elBoneco, elMensagem, elPlacar;
  var alvo = null;
  var acertadas = [];
  var erradas = [];
  var fim = false;
  var montado = false;
  var placar = { vitorias: 0, derrotas: 0 };

  /* --------------------------------------------------------- desenho */
  // Cada parte do boneco aparece conforme o numero de erros
  var PECAS = ['f-cabeca', 'f-tronco', 'f-braco-e', 'f-braco-d', 'f-perna-e', 'f-perna-d'];

  function desenharForca() {
    if (!elBoneco) return;
    PECAS.forEach(function (classe, i) {
      var peca = elBoneco.querySelector('.' + classe);
      if (peca) peca.classList.toggle('visivel', erradas.length > i);
    });
    elBoneco.classList.toggle('perdeu', erradas.length >= MAX_ERROS);
  }

  /* --------------------------------------------------------- palavra */

  function renderPalavra(revelarTudo) {
    if (!elPalavra) return;
    var letras = alvo.en.toUpperCase().split('');
    elPalavra.innerHTML = letras.map(function (l) {
      var achou = acertadas.indexOf(l) !== -1;
      var classe = 'fc-letra' + (achou ? ' preenchida' : '') + (!achou && revelarTudo ? ' revelada' : '');
      return '<span class="' + classe + '">' + (achou || revelarTudo ? l : '') + '</span>';
    }).join('');
    elPalavra.setAttribute('aria-label',
      'Palavra em inglês com ' + letras.length + ' letras: ' +
      letras.map(function (l) { return acertadas.indexOf(l) !== -1 ? l : 'espaço'; }).join(', '));
  }

  function renderTeclado() {
    if (!elTeclado) return;
    elTeclado.innerHTML = '';
    ALFABETO.forEach(function (letra) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-tecla';
      b.textContent = letra;
      b.setAttribute('data-letra', letra);
      b.addEventListener('click', function () { tentar(letra); });
      elTeclado.appendChild(b);
    });
  }

  function marcarTecla(letra, certa) {
    if (!elTeclado) return;
    var b = elTeclado.querySelector('[data-letra="' + letra + '"]');
    if (b) {
      b.disabled = true;
      b.classList.add(certa ? 'certa' : 'errada');
    }
  }

  /* ---------------------------------------------------------- jogada */

  function tentar(letra) {
    if (fim || !alvo) return;
    letra = letra.toUpperCase();
    if (acertadas.indexOf(letra) !== -1 || erradas.indexOf(letra) !== -1) return;

    var palavra = alvo.en.toUpperCase();

    if (palavra.indexOf(letra) !== -1) {
      acertadas.push(letra);
      marcarTecla(letra, true);
      BP.audio.acerto();
      renderPalavra(false);
      if (completou()) ganhar();
    } else {
      erradas.push(letra);
      marcarTecla(letra, false);
      BP.audio.erro();
      atualizarErros();
      desenharForca();
      if (erradas.length >= MAX_ERROS) perder();
    }
  }

  function completou() {
    var palavra = alvo.en.toUpperCase();
    for (var i = 0; i < palavra.length; i++) {
      if (acertadas.indexOf(palavra[i]) === -1) return false;
    }
    return true;
  }

  function atualizarErros() {
    if (elErros) elErros.textContent = erradas.length + '/' + MAX_ERROS;
  }

  function mensagem(html, tipo) {
    if (!elMensagem) return;
    elMensagem.className = 'fc-mensagem ' + (tipo || '');
    elMensagem.innerHTML = html;
  }

  function atualizarPlacar() {
    if (elPlacar) {
      elPlacar.innerHTML =
        '<span class="ok">' + placar.vitorias + ' vitória' + (placar.vitorias === 1 ? '' : 's') + '</span>' +
        '<span class="sep">·</span>' +
        '<span class="ruim">' + placar.derrotas + ' derrota' + (placar.derrotas === 1 ? '' : 's') + '</span>';
    }
  }

  function ganhar() {
    fim = true;
    placar.vitorias++;
    atualizarPlacar();
    BP.audio.vitoria();
    BP.audio.falarPalavra(alvo.en);
    mensagem('Você acertou! <strong>' + alvo.en + '</strong> significa <strong>' + alvo.pt + '</strong>.', 'ganhou');
    desabilitarTeclado();
  }

  function perder() {
    fim = true;
    placar.derrotas++;
    atualizarPlacar();
    BP.audio.erro();
    renderPalavra(true);
    BP.audio.falarPalavra(alvo.en);
    mensagem('Não foi essa vez. A palavra era <strong>' + alvo.en + '</strong> (' + alvo.pt + ').', 'perdeu');
    desabilitarTeclado();
  }

  function desabilitarTeclado() {
    if (!elTeclado) return;
    var teclas = elTeclado.querySelectorAll('.fc-tecla');
    for (var i = 0; i < teclas.length; i++) teclas[i].disabled = true;
  }

  /* ------------------------------------------------------- novo jogo */

  function novoJogo() {
    // Evita repetir a mesma palavra duas vezes seguidas
    var anterior = alvo;
    var candidatos = BP.PARTES.filter(function (p) { return !anterior || p.id !== anterior.id; });
    alvo = BP.sortear(candidatos, 1)[0];
    acertadas = [];
    erradas = [];
    fim = false;

    renderTeclado();
    renderPalavra(false);
    atualizarErros();
    desenharForca();
    mensagem('Descubra a palavra em inglês. Você tem ' + MAX_ERROS + ' tentativas erradas.', '');

    if (elDica) {
      elDica.innerHTML =
        '<span class="fc-dica-rotulo">Hint (in English)</span>' +
        '<span class="fc-dica-texto">' + alvo.dica + '</span>' +
        '<button type="button" class="fc-ouvir-dica" title="Ouvir a dica em inglês">' +
          BP.icones.altoFalante + '<span>Ouvir a dica</span>' +
        '</button>';
      var btnDica = elDica.querySelector('.fc-ouvir-dica');
      if (btnDica) {
        btnDica.addEventListener('click', function () {
          BP.audio.falar(alvo.dica, { rate: 0.85 });
        });
      }
    }
  }

  /* ----------------------------------------------------------- setup */

  function aoTeclar(e) {
    // Só responde quando a seção da forca está visível
    var secao = document.getElementById('secao-forca');
    if (!secao || !secao.classList.contains('ativa')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var letra = (e.key || '').toUpperCase();
    if (letra.length === 1 && letra >= 'A' && letra <= 'Z') {
      tentar(letra);
    }
  }

  function montar() {
    elPalavra = document.getElementById('fc-palavra');
    elDica = document.getElementById('fc-dica');
    elTeclado = document.getElementById('fc-teclado');
    elErros = document.getElementById('fc-erros');
    elBoneco = document.getElementById('fc-boneco');
    elMensagem = document.getElementById('fc-mensagem');
    elPlacar = document.getElementById('fc-placar');

    if (montado) return;
    var btn = document.getElementById('fc-novo');
    if (btn) btn.addEventListener('click', novoJogo);
    document.addEventListener('keydown', aoTeclar);
    atualizarPlacar();
    novoJogo();
    montado = true;
  }

  BP.secoes = BP.secoes || {};
  BP.secoes.forca = { montar: montar, novoJogo: novoJogo };
})(window);

/* =========================================================================
   Partes do Corpo | Secao 4: Liga Pontos
   Esquerda = desenho | Direita = nome em ingles
   O usuario liga arrastando (ou clicando em um lado e depois no outro)
   ========================================================================= */
(function (global) {
  'use strict';

  var BP = global.BP;
  var POR_RODADA = 6; // 6 pares por rodada mantem a tela legivel

  var elEsq, elDir, elSvg, elPlacar, elMensagem, elArea;
  var rodada = [];
  var ligacoes = {};      // { idEsquerda: idDireita }  (apenas acertos)
  var selecionado = null; // { lado: 'esq'|'dir', id, el }
  var arrasto = null;
  var acertos = 0;
  var erros = 0;
  var montado = false;

  /* ---------------------------------------------------------- desenho */

  function centro(el) {
    var r = el.getBoundingClientRect();
    var base = elArea.getBoundingClientRect();
    var esquerda = el.getAttribute('data-lado') === 'esq';
    return {
      x: (esquerda ? r.right : r.left) - base.left,
      y: r.top + r.height / 2 - base.top
    };
  }

  function pontoDoEvento(e) {
    var base = elArea.getBoundingClientRect();
    return { x: e.clientX - base.left, y: e.clientY - base.top };
  }

  function linha(a, b, classe) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    var meio = (a.x + b.x) / 2;
    el.setAttribute('d', 'M' + a.x + ' ' + a.y + ' C' + meio + ' ' + a.y + ' ' + meio + ' ' + b.y + ' ' + b.x + ' ' + b.y);
    el.setAttribute('class', classe);
    return el;
  }

  function redesenhar() {
    if (!elSvg) return;
    var base = elArea.getBoundingClientRect();
    elSvg.setAttribute('viewBox', '0 0 ' + base.width + ' ' + base.height);
    elSvg.setAttribute('width', base.width);
    elSvg.setAttribute('height', base.height);
    elSvg.innerHTML = '';

    Object.keys(ligacoes).forEach(function (id) {
      var a = elEsq.querySelector('[data-id="' + id + '"]');
      var b = elDir.querySelector('[data-id="' + ligacoes[id] + '"]');
      if (a && b) elSvg.appendChild(linha(centro(a), centro(b), 'lp-linha certa'));
    });

    if (arrasto) {
      var origem = centro(arrasto.el);
      elSvg.appendChild(linha(origem, arrasto.ponto, 'lp-linha temp'));
    }
  }

  /* ------------------------------------------------------- interacao */

  function limparSelecao() {
    if (selecionado && selecionado.el) selecionado.el.classList.remove('selecionado');
    selecionado = null;
  }

  function tentarLigar(a, b) {
    // a e b sempre em lados opostos
    var esq = a.lado === 'esq' ? a : b;
    var dir = a.lado === 'dir' ? a : b;

    if (ligacoes[esq.id] || jaUsado(dir.id)) return;

    if (esq.id === dir.id) {
      ligacoes[esq.id] = dir.id;
      acertos++;
      esq.el.classList.add('casado');
      dir.el.classList.add('casado');
      BP.audio.acerto();
      BP.audio.falarPalavra(BP.porId(esq.id).en);
      atualizar();
      redesenhar();
      if (acertos === rodada.length) vencer();
    } else {
      erros++;
      atualizar();
      BP.audio.erro();
      [esq.el, dir.el].forEach(function (el) {
        el.classList.add('errou');
        global.setTimeout(function () { el.classList.remove('errou'); }, 620);
      });
      var parte = BP.porId(dir.id);
      mensagem('<strong>' + parte.en + '</strong> é <strong>' + parte.pt + '</strong>. Tente de novo!', 'erro');
    }
  }

  function jaUsado(idDireita) {
    var chaves = Object.keys(ligacoes);
    for (var i = 0; i < chaves.length; i++) {
      if (ligacoes[chaves[i]] === idDireita) return true;
    }
    return false;
  }

  function dados(el) {
    return { lado: el.getAttribute('data-lado'), id: el.getAttribute('data-id'), el: el };
  }

  function ligavel(el) {
    return el && !el.classList.contains('casado');
  }

  function aoClicar(el) {
    if (!ligavel(el)) return;
    var atual = dados(el);

    if (!selecionado) {
      selecionado = atual;
      el.classList.add('selecionado');
      if (atual.lado === 'dir') BP.audio.falarPalavra(BP.porId(atual.id).en);
      else BP.audio.clique();
      return;
    }
    if (selecionado.el === el) { limparSelecao(); return; }
    if (selecionado.lado === atual.lado) {
      limparSelecao();
      selecionado = atual;
      el.classList.add('selecionado');
      return;
    }
    var origem = selecionado;
    limparSelecao();
    tentarLigar(origem, atual);
  }

  function aoPressionar(e, el) {
    if (!ligavel(el)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    arrasto = { el: el, dados: dados(el), ponto: pontoDoEvento(e), moveu: false };
    redesenhar();
  }

  function aoMover(e) {
    if (!arrasto) return;
    arrasto.ponto = pontoDoEvento(e);
    arrasto.moveu = true;
    redesenhar();
  }

  function aoSoltar(e) {
    if (!arrasto) return;
    var origem = arrasto.dados;
    var moveu = arrasto.moveu;
    arrasto = null;

    var destino = document.elementFromPoint(e.clientX, e.clientY);
    var no = destino && destino.closest ? destino.closest('.lp-item') : null;

    if (moveu && no && ligavel(no) && no !== origem.el) {
      var alvo = dados(no);
      limparSelecao();
      if (alvo.lado !== origem.lado) tentarLigar(origem, alvo);
      redesenhar();
      return;
    }
    // Sem arrasto valido: trata como clique (modo clique-clique)
    redesenhar();
    if (!moveu) aoClicar(origem.el);
  }

  /* ---------------------------------------------------------- montagem */

  function itemDesenho(parte) {
    var el = document.createElement('div');
    el.className = 'lp-item lp-desenho fig-' + parte.id;
    el.setAttribute('data-id', parte.id);
    el.setAttribute('data-lado', 'esq');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Desenho: ' + parte.pt);
    el.innerHTML = '<span class="lp-palco">' + parte.svg + '</span><span class="lp-ponto"></span>';
    return el;
  }

  function itemPalavra(parte) {
    var el = document.createElement('div');
    el.className = 'lp-item lp-palavra';
    el.setAttribute('data-id', parte.id);
    el.setAttribute('data-lado', 'dir');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Palavra em inglês: ' + parte.en);
    el.innerHTML = '<span class="lp-ponto"></span><span class="lp-texto">' + parte.en +
      '<em>' + parte.fonetica + '</em></span>';
    return el;
  }

  function ligarEventos(el) {
    el.addEventListener('pointerdown', function (e) { aoPressionar(e, el); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoClicar(el); }
    });
  }

  function mensagem(html, tipo) {
    if (!elMensagem) return;
    elMensagem.className = 'lp-mensagem ' + (tipo || '');
    elMensagem.innerHTML = html;
  }

  function atualizar() {
    if (elPlacar) {
      elPlacar.innerHTML =
        '<span class="ok">' + acertos + '/' + rodada.length + ' ligados</span>' +
        '<span class="sep">·</span><span class="ruim">' + erros + ' erro' + (erros === 1 ? '' : 's') + '</span>';
    }
  }

  function vencer() {
    BP.audio.vitoria();
    BP.ui.festa('Muito bem! 🎯', 'Você ligou todos os desenhos aos nomes em inglês' +
      (erros === 0 ? ' <strong>sem nenhum erro</strong>!' : ' com ' + erros + ' erro(s).'), erros === 0);
  }

  function novoJogo() {
    if (!elEsq || !elDir) return;
    rodada = BP.sortear(BP.PARTES, POR_RODADA);
    ligacoes = {};
    acertos = 0;
    erros = 0;
    limparSelecao();
    arrasto = null;

    elEsq.innerHTML = '';
    elDir.innerHTML = '';

    BP.embaralhar(rodada).forEach(function (p) {
      var el = itemDesenho(p);
      ligarEventos(el);
      elEsq.appendChild(el);
    });
    BP.embaralhar(rodada).forEach(function (p) {
      var el = itemPalavra(p);
      ligarEventos(el);
      elDir.appendChild(el);
    });

    atualizar();
    mensagem('Arraste do desenho até a palavra em inglês — ou toque em um e depois no outro.', '');
    global.requestAnimationFrame(redesenhar);
  }

  function montar() {
    elEsq = document.getElementById('lp-esquerda');
    elDir = document.getElementById('lp-direita');
    elSvg = document.getElementById('lp-linhas');
    elPlacar = document.getElementById('lp-placar');
    elMensagem = document.getElementById('lp-mensagem');
    elArea = document.getElementById('lp-area');

    if (!montado) {
      var btn = document.getElementById('lp-novo');
      if (btn) btn.addEventListener('click', novoJogo);
      document.addEventListener('pointermove', aoMover);
      document.addEventListener('pointerup', aoSoltar);
      document.addEventListener('pointercancel', function () { arrasto = null; redesenhar(); });
      global.addEventListener('resize', redesenhar);
      montado = true;
      novoJogo();
    } else {
      global.requestAnimationFrame(redesenhar);
    }
  }

  BP.secoes = BP.secoes || {};
  BP.secoes.ligar = { montar: montar, novoJogo: novoJogo, redesenhar: redesenhar };
})(window);

/* =========================================================================
   Partes do Corpo | Secao 5: Caca-Palavras
   Sempre 6 palavras, sorteadas entre as 12 partes.
   A cada carregamento da pagina (ou "Novo jogo") o sorteio e refeito.
   ========================================================================= */
(function (global) {
  'use strict';

  var BP = global.BP;
  var TAM = 10;          // grade 10x10
  var QUANTIDADE = 6;    // sempre 6 palavras por rodada

  var DIRECOES = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
    { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
  ];

  var elGrade, elLista, elPlacar, elMensagem;
  var grade = [];        // matriz de letras
  var celulas = [];      // matriz de elementos
  var colocadas = [];    // { parte, celulas:[{x,y}] }
  var encontradas = {};  // { id: true }
  var selecao = [];      // celulas da selecao atual
  var arrastando = false;
  var inicio = null;
  var montado = false;

  /* ------------------------------------------------------ geracao */

  function vazia() {
    var g = [];
    for (var y = 0; y < TAM; y++) {
      g[y] = [];
      for (var x = 0; x < TAM; x++) g[y][x] = '';
    }
    return g;
  }

  function cabe(g, palavra, x, y, dir) {
    for (var i = 0; i < palavra.length; i++) {
      var cx = x + dir.dx * i;
      var cy = y + dir.dy * i;
      if (cx < 0 || cy < 0 || cx >= TAM || cy >= TAM) return false;
      var atual = g[cy][cx];
      if (atual !== '' && atual !== palavra[i]) return false;
    }
    return true;
  }

  function escrever(g, palavra, x, y, dir) {
    var pontos = [];
    for (var i = 0; i < palavra.length; i++) {
      var cx = x + dir.dx * i;
      var cy = y + dir.dy * i;
      g[cy][cx] = palavra[i];
      pontos.push({ x: cx, y: cy });
    }
    return pontos;
  }

  function gerar(partes) {
    var g = vazia();
    var postas = [];

    partes.forEach(function (parte) {
      var palavra = parte.en.toUpperCase();
      var tentativas = 0;
      var ok = false;
      var dirs = BP.embaralhar(DIRECOES);

      while (!ok && tentativas < 400) {
        var dir = dirs[tentativas % dirs.length];
        var x = Math.floor(Math.random() * TAM);
        var y = Math.floor(Math.random() * TAM);
        if (cabe(g, palavra, x, y, dir)) {
          postas.push({ parte: parte, celulas: escrever(g, palavra, x, y, dir) });
          ok = true;
        }
        tentativas++;
      }
      if (!ok) {
        // Fallback: primeira posicao horizontal livre
        for (var yy = 0; yy < TAM && !ok; yy++) {
          for (var xx = 0; xx + palavra.length <= TAM && !ok; xx++) {
            if (cabe(g, palavra, xx, yy, DIRECOES[0])) {
              postas.push({ parte: parte, celulas: escrever(g, palavra, xx, yy, DIRECOES[0]) });
              ok = true;
            }
          }
        }
      }
    });

    // Preenche o resto com letras aleatorias
    var letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var y2 = 0; y2 < TAM; y2++) {
      for (var x2 = 0; x2 < TAM; x2++) {
        if (g[y2][x2] === '') g[y2][x2] = letras[Math.floor(Math.random() * letras.length)];
      }
    }
    return { grade: g, colocadas: postas };
  }

  /* ------------------------------------------------------- render */

  function render() {
    elGrade.innerHTML = '';
    elGrade.style.setProperty('--cp-colunas', TAM);
    celulas = [];

    for (var y = 0; y < TAM; y++) {
      celulas[y] = [];
      for (var x = 0; x < TAM; x++) {
        var c = document.createElement('div');
        c.className = 'cp-celula';
        c.textContent = grade[y][x];
        c.setAttribute('data-x', x);
        c.setAttribute('data-y', y);
        elGrade.appendChild(c);
        celulas[y][x] = c;
      }
    }

    elLista.innerHTML = '';
    colocadas.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'cp-item';
      li.setAttribute('data-id', item.parte.id);
      li.innerHTML =
        '<button type="button" class="cp-ouvir" title="Ouvir em inglês" aria-label="Ouvir ' + item.parte.en + '">' +
          BP.icones.altoFalante +
        '</button>' +
        '<span class="cp-en">' + item.parte.en + '</span>' +
        '<span class="cp-pt">' + item.parte.pt + '</span>';
      li.querySelector('.cp-ouvir').addEventListener('click', function () {
        BP.audio.falarPalavra(item.parte.en);
      });
      elLista.appendChild(li);
    });

    atualizarPlacar();
  }

  function atualizarPlacar() {
    var achadas = Object.keys(encontradas).length;
    if (elPlacar) elPlacar.textContent = achadas + '/' + colocadas.length + ' encontradas';
  }

  function mensagem(html, tipo) {
    if (!elMensagem) return;
    elMensagem.className = 'cp-mensagem ' + (tipo || '');
    elMensagem.innerHTML = html;
  }

  /* ---------------------------------------------------- selecao */

  function celulaDoEvento(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.classList || !el.classList.contains('cp-celula')) return null;
    return { x: +el.getAttribute('data-x'), y: +el.getAttribute('data-y') };
  }

  function caminho(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    if (dx === 0 && dy === 0) return [{ x: a.x, y: a.y }];
    var alinhado = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    if (!alinhado) return null;
    var passos = Math.max(Math.abs(dx), Math.abs(dy));
    var px = dx === 0 ? 0 : dx / Math.abs(dx);
    var py = dy === 0 ? 0 : dy / Math.abs(dy);
    var lista = [];
    for (var i = 0; i <= passos; i++) lista.push({ x: a.x + px * i, y: a.y + py * i });
    return lista;
  }

  function pintarSelecao(lista) {
    limparSelecao();
    selecao = lista || [];
    selecao.forEach(function (p) { celulas[p.y][p.x].classList.add('selecionada'); });
  }

  function limparSelecao() {
    selecao.forEach(function (p) {
      var c = celulas[p.y] && celulas[p.y][p.x];
      if (c) c.classList.remove('selecionada');
    });
    selecao = [];
  }

  function textoDa(lista) {
    return lista.map(function (p) { return grade[p.y][p.x]; }).join('');
  }

  function marcarAchada(p) {
    var c = celulas[p.y] && celulas[p.y][p.x];
    if (!c) return;
    c.classList.remove('selecionada');
    c.classList.add('achada');
  }

  function validar() {
    if (selecao.length < 2) { limparSelecao(); return; }

    var texto = textoDa(selecao);
    var textoInv = textoDa(selecao.slice().reverse());

    for (var i = 0; i < colocadas.length; i++) {
      var item = colocadas[i];
      var palavra = item.parte.en.toUpperCase();
      if (encontradas[item.parte.id]) continue;
      if (texto !== palavra && textoInv !== palavra) continue;

      encontradas[item.parte.id] = true;
      // Marca a selecao e tambem a posicao oficial da palavra na grade,
      // para o caso de o jogador achar a mesma sequencia em outro lugar
      selecao.forEach(marcarAchada);
      item.celulas.forEach(marcarAchada);
      selecao = [];
      var li = elLista.querySelector('[data-id="' + item.parte.id + '"]');
      if (li) li.classList.add('achada');
      BP.audio.acerto();
      BP.audio.falarPalavra(item.parte.en);
      mensagem('<strong>' + item.parte.en + '</strong> = ' + item.parte.pt + ' ✅', 'ok');
      atualizarPlacar();
      if (Object.keys(encontradas).length === colocadas.length) {
        global.setTimeout(function () {
          BP.audio.vitoria();
          BP.ui.festa('Você achou todas! 🔎', 'As 6 palavras foram encontradas. Clique em <strong>Novo jogo</strong> para sortear outras 6.', true);
        }, 500);
      }
      return;
    }

    // Errou: pisca em vermelho
    var atual = selecao.slice();
    atual.forEach(function (p) {
      var c = celulas[p.y][p.x];
      c.classList.remove('selecionada');
      c.classList.add('errada');
      global.setTimeout(function () { c.classList.remove('errada'); }, 520);
    });
    selecao = [];
    BP.audio.erro();
  }

  function aoPressionar(e) {
    var c = celulaDoEvento(e);
    if (!c) return;
    e.preventDefault();
    arrastando = true;
    inicio = c;
    pintarSelecao([c]);
  }

  function aoMover(e) {
    if (!arrastando) return;
    var c = celulaDoEvento(e);
    if (!c) return;
    var lista = caminho(inicio, c);
    if (lista) pintarSelecao(lista);
  }

  function aoSoltar(e) {
    if (!arrastando) return;
    arrastando = false;
    // Recalcula pela posicao da soltura: o navegador pode agrupar os eventos
    // de movimento e a ultima celula do arrasto se perderia
    if (e && inicio) {
      var c = celulaDoEvento(e);
      if (c) {
        var lista = caminho(inicio, c);
        if (lista) pintarSelecao(lista);
      }
    }
    inicio = null;
    validar();
  }

  function aoCancelar() {
    if (!arrastando) return;
    arrastando = false;
    inicio = null;
    limparSelecao();
  }

  /* -------------------------------------------------- novo jogo */

  function novoJogo() {
    if (!elGrade) return;
    var sorteadas = BP.sortear(BP.PARTES, QUANTIDADE);
    var resultado = gerar(sorteadas);
    grade = resultado.grade;
    colocadas = resultado.colocadas;
    encontradas = {};
    selecao = [];
    arrastando = false;
    render();
    mensagem('Arraste sobre as letras para marcar a palavra (em qualquer direção).', '');
  }

  function montar() {
    elGrade = document.getElementById('cp-grade');
    elLista = document.getElementById('cp-lista');
    elPlacar = document.getElementById('cp-placar');
    elMensagem = document.getElementById('cp-mensagem');

    if (montado) return;
    var btn = document.getElementById('cp-novo');
    if (btn) btn.addEventListener('click', novoJogo);
    elGrade.addEventListener('pointerdown', aoPressionar);
    document.addEventListener('pointermove', aoMover);
    document.addEventListener('pointerup', aoSoltar);
    document.addEventListener('pointercancel', aoCancelar);
    montado = true;
    novoJogo();
  }

  BP.secoes = BP.secoes || {};
  BP.secoes.caca = { montar: montar, novoJogo: novoJogo };
})(window);

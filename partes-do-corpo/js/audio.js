/* =========================================================================
   Partes do Corpo | Audio
   -------------------------------------------------------------------------
   Pronuncia em ingles via Web Speech API (nao precisa de arquivos de audio)
   + efeitos curtos de acerto/erro gerados pela Web Audio API.
   ========================================================================= */
(function (global) {
  'use strict';

  var CHAVE_MUDO = 'bp:mudo';
  var sintese = global.speechSynthesis || null;
  var vozes = [];
  var vozEn = null;
  var mudo = false;
  var audioCtx = null;

  try {
    mudo = localStorage.getItem(CHAVE_MUDO) === '1';
  } catch (e) { /* localStorage bloqueado: segue sem persistir */ }

  /* ---------------------------------------------------- selecao de voz */

  function escolherVoz() {
    if (!sintese) return;
    vozes = sintese.getVoices() || [];
    var preferidas = ['Google US English', 'Samantha', 'Microsoft Aria', 'Microsoft Zira', 'Karen', 'Daniel'];
    var i, v;

    for (i = 0; i < preferidas.length; i++) {
      for (var j = 0; j < vozes.length; j++) {
        if (vozes[j].name.indexOf(preferidas[i]) !== -1 && /^en/i.test(vozes[j].lang)) {
          vozEn = vozes[j];
          return;
        }
      }
    }
    for (i = 0; i < vozes.length; i++) {
      v = vozes[i];
      if (/^en[-_]US/i.test(v.lang)) { vozEn = v; return; }
    }
    for (i = 0; i < vozes.length; i++) {
      v = vozes[i];
      if (/^en/i.test(v.lang)) { vozEn = v; return; }
    }
    vozEn = null; // usa a voz padrao do sistema
  }

  if (sintese) {
    escolherVoz();
    // Em vários navegadores a lista de vozes chega de forma assíncrona
    if (typeof sintese.addEventListener === 'function') {
      sintese.addEventListener('voiceschanged', escolherVoz);
    } else {
      sintese.onvoiceschanged = escolherVoz;
    }
  }

  /* ------------------------------------------------------------- fala */

  function falar(texto, opcoes) {
    if (mudo || !sintese || !texto) return false;
    opcoes = opcoes || {};
    try {
      sintese.cancel(); // evita fila acumulada em cliques rapidos
      var f = new global.SpeechSynthesisUtterance(String(texto));
      f.lang = (vozEn && vozEn.lang) || 'en-US';
      if (vozEn) f.voice = vozEn;
      f.rate = opcoes.rate || 0.85;   // devagar: publico infantil aprendendo
      f.pitch = opcoes.pitch || 1.05;
      f.volume = 1;
      sintese.speak(f);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Fala a palavra e, opcionalmente, repete dentro de uma frase de exemplo
  function falarPalavra(en) {
    return falar(en, { rate: 0.8 });
  }

  function disponivel() {
    return !!sintese;
  }

  /* --------------------------------------------------------- efeitos */

  function contexto() {
    if (mudo) return null;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
    return audioCtx;
  }

  function tocarNotas(notas) {
    var ctx = contexto();
    if (!ctx) return;
    var inicio = ctx.currentTime;
    notas.forEach(function (nota) {
      var osc = ctx.createOscillator();
      var vol = ctx.createGain();
      osc.type = nota.tipo || 'sine';
      osc.frequency.value = nota.hz;
      vol.gain.setValueAtTime(0.0001, inicio + nota.em);
      vol.gain.exponentialRampToValueAtTime(nota.vol || 0.18, inicio + nota.em + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + nota.em + nota.dur);
      osc.connect(vol).connect(ctx.destination);
      osc.start(inicio + nota.em);
      osc.stop(inicio + nota.em + nota.dur + 0.02);
    });
  }

  function acerto() {
    tocarNotas([
      { hz: 659, em: 0, dur: 0.12 },
      { hz: 880, em: 0.1, dur: 0.18 }
    ]);
  }

  function erro() {
    tocarNotas([
      { hz: 220, em: 0, dur: 0.16, tipo: 'triangle' },
      { hz: 165, em: 0.12, dur: 0.2, tipo: 'triangle' }
    ]);
  }

  function vitoria() {
    tocarNotas([
      { hz: 523, em: 0, dur: 0.14 },
      { hz: 659, em: 0.13, dur: 0.14 },
      { hz: 784, em: 0.26, dur: 0.14 },
      { hz: 1047, em: 0.39, dur: 0.3 }
    ]);
  }

  function clique() {
    tocarNotas([{ hz: 520, em: 0, dur: 0.05, vol: 0.08, tipo: 'square' }]);
  }

  /* ------------------------------------------------------------ mudo */

  function estaMudo() { return mudo; }

  function alternarMudo() {
    mudo = !mudo;
    if (mudo && sintese) { try { sintese.cancel(); } catch (e) {} }
    try { localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0'); } catch (e) {}
    return mudo;
  }

  global.BP = global.BP || {};
  global.BP.audio = {
    falar: falar,
    falarPalavra: falarPalavra,
    disponivel: disponivel,
    acerto: acerto,
    erro: erro,
    vitoria: vitoria,
    clique: clique,
    estaMudo: estaMudo,
    alternarMudo: alternarMudo
  };
})(window);

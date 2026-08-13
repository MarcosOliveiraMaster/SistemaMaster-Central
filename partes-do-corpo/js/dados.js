/* =========================================================================
   Partes do Corpo | Base de dados
   -------------------------------------------------------------------------
   Cada item traz:
     id        -> identificador interno (usado em CSS/animacoes)
     pt        -> nome em portugues
     en        -> nome em ingles (usado na pronuncia e nos jogos)
     fonetica  -> transcricao fonetica exibida no card
     dica      -> definicao em INGLES (usada no jogo da forca)
     svg       -> ilustracao inline animada por CSS
   ========================================================================= */
(function (global) {
  'use strict';

  /* Helpers de desenho -----------------------------------------------------
     ctx  = partes de contexto (tom neutro, apenas para dar referencia)
     alvo = parte destacada (a que esta sendo ensinada)                     */

  function svg(inner) {
    return '<svg class="figura" viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  // Silhueta de ombros + pescoco, usada nos itens da cabeca
  var OMBROS =
    '<path class="ctx" d="M50 66h0c-4 0-7 3-7 7v6c-14 2-24 9-27 21h68c-3-12-13-19-27-21v-6c0-4-3-7-7-7z"/>';

  var PARTES = [
    /* 1 ------------------------------------------------------------------ */
    {
      id: 'head',
      pt: 'Cabeça',
      en: 'head',
      fonetica: '/hɛd/',
      dica: 'The top part of your body. Your brain is inside it.',
      svg: svg(
        OMBROS +
        '<g class="an-nod">' +
          '<ellipse class="alvo" cx="50" cy="43" rx="25" ry="28"/>' +
          '<ellipse class="ctx" cx="25" cy="46" rx="4.5" ry="6.5"/>' +
          '<ellipse class="ctx" cx="75" cy="46" rx="4.5" ry="6.5"/>' +
          '<path class="cabelo" d="M24 40C24 18 36 12 50 12s26 6 26 28c-5-11-14-15-26-15s-21 4-26 15z"/>' +
          '<circle class="olho" cx="41" cy="43" r="3"/>' +
          '<circle class="olho" cx="59" cy="43" r="3"/>' +
          '<path class="traco" d="M42 56q8 8 16 0"/>' +
        '</g>'
      )
    },
    /* 2 ------------------------------------------------------------------ */
    {
      id: 'hair',
      pt: 'Cabelo',
      en: 'hair',
      fonetica: '/hɛər/',
      dica: 'It grows on your head. You wash it and comb it.',
      svg: svg(
        OMBROS +
        '<ellipse class="ctx" cx="50" cy="43" rx="25" ry="28"/>' +
        '<ellipse class="ctx" cx="25" cy="46" rx="4.5" ry="6.5"/>' +
        '<ellipse class="ctx" cx="75" cy="46" rx="4.5" ry="6.5"/>' +
        '<circle class="olho" cx="41" cy="43" r="2.6"/>' +
        '<circle class="olho" cx="59" cy="43" r="2.6"/>' +
        '<path class="traco" d="M43 56q7 7 14 0"/>' +
        '<g class="an-sway">' +
          '<path class="alvo" d="M23 42C22 16 35 10 50 10s28 6 27 32c-4-12-14-17-27-17s-23 5-27 17z"/>' +
          '<path class="alvo" d="M50 10c9 0 14 5 14 5-6 8-18 9-24 5 3-6 6-10 10-10z" opacity=".55"/>' +
        '</g>' +
        '<g class="an-strand">' +
          '<path class="alvo-t" d="M24 34q-7 8-5 20"/>' +
          '<path class="alvo-t" d="M76 34q7 8 5 20"/>' +
        '</g>'
      )
    },
    /* 3 ------------------------------------------------------------------ */
    {
      id: 'eye',
      pt: 'Olho',
      en: 'eye',
      fonetica: '/aɪ/',
      dica: 'You use it to see things around you.',
      svg: svg(
        '<path class="branco" d="M12 50c10-16 24-24 38-24s28 8 38 24c-10 16-24 24-38 24s-28-8-38-24z"/>' +
        '<g class="an-look">' +
          '<circle class="alvo" cx="50" cy="50" r="15"/>' +
          '<circle class="pupila" cx="50" cy="50" r="7"/>' +
          '<circle class="brilho" cx="45" cy="44" r="3.4"/>' +
        '</g>' +
        // A palpebra repete o contorno do olho e "fecha" achatando-se para cima
        '<path class="palpebra an-blink" d="M12 50c10-16 24-24 38-24s28 8 38 24c-10 16-24 24-38 24s-28-8-38-24z"/>' +
        '<path class="traco" d="M12 50c10-16 24-24 38-24s28 8 38 24c-10 16-24 24-38 24s-28-8-38-24z" fill="none"/>' +
        '<g class="cilios">' +
          '<path d="M22 33l-6-6"/><path d="M38 25l-3-8"/><path d="M62 25l3-8"/><path d="M78 33l6-6"/>' +
        '</g>'
      )
    },
    /* 4 ------------------------------------------------------------------ */
    {
      id: 'ear',
      pt: 'Orelha',
      en: 'ear',
      fonetica: '/ɪər/',
      dica: 'You use it to hear sounds and music.',
      svg: svg(
        '<path class="ctx" d="M74 6c14 12 18 34 10 52-6 14-4 24-2 36H62c-4-14-2-22 2-34 4-14 2-34-8-44z"/>' +
        '<path class="alvo" d="M60 20c10-12 26-8 30 6 4 15-4 26-10 34-4 6-3 12-8 16-6 4-13 0-13-7 0-6 6-8 8-13 2-6-1-11 1-18 1-6 4-9 6-11 3-3 1-9-4-9-4 0-6 3-6 6z"/>' +
        '<path class="traco" d="M70 40c5-3 9 1 8 6-1 6-6 8-7 13" fill="none"/>' +
        '<g class="ondas">' +
          '<path class="onda o1" d="M40 34c-8 9-8 23 0 32"/>' +
          '<path class="onda o2" d="M28 26c-13 14-13 34 0 48"/>' +
          '<path class="onda o3" d="M16 18c-18 19-18 45 0 64"/>' +
        '</g>'
      )
    },
    /* 5 ------------------------------------------------------------------ */
    {
      id: 'nose',
      pt: 'Nariz',
      en: 'nose',
      fonetica: '/noʊz/',
      dica: 'You use it to smell and to breathe.',
      svg: svg(
        // Rosto de frente, em tom neutro, com o nariz em destaque no centro
        '<ellipse class="ctx" cx="50" cy="50" rx="33" ry="41"/>' +
        '<ellipse class="ctx-d" cx="35" cy="35" rx="4" ry="5"/>' +
        '<ellipse class="ctx-d" cx="65" cy="35" rx="4" ry="5"/>' +
        '<path class="ctx-linha" d="M40 82q10 7 20 0"/>' +
        '<g class="an-sniff">' +
          '<path class="alvo" d="M50 30c4 0 6 4 7 10 1 6 5 11 5 17 0 7-6 10-12 10s-12-3-12-10c0-6 4-11 5-17 1-6 3-10 7-10z"/>' +
          '<path class="traco" d="M50 36v16"/>' +
          '<ellipse class="narina" cx="44" cy="60" rx="3.6" ry="2.6"/>' +
          '<ellipse class="narina" cx="56" cy="60" rx="3.6" ry="2.6"/>' +
        '</g>' +
        '<g class="ar">' +
          '<path class="a1" d="M34 62c-4 2-6 5-7 9"/>' +
          '<path class="a2" d="M66 62c4 2 6 5 7 9"/>' +
        '</g>'
      )
    },
    /* 6 ------------------------------------------------------------------ */
    {
      id: 'mouth',
      pt: 'Boca',
      en: 'mouth',
      fonetica: '/maʊθ/',
      dica: 'You use it to eat, to drink and to speak.',
      svg: svg(
        '<ellipse class="ctx" cx="50" cy="50" rx="42" ry="46"/>' +
        '<g class="an-talk">' +
          '<path class="boca-interior" d="M22 50h56c0 18-13 30-28 30S22 68 22 50z"/>' +
          '<path class="alvo" d="M22 50c6-12 15-16 28-16s22 4 28 16c-4 3-9 2-13 0-5-3-10-4-15-4s-10 1-15 4c-4 2-9 3-13 0z"/>' +
          '<path class="alvo" d="M22 50h56c0 6-2 11-5 15-6-4-14-6-23-6s-17 2-23 6c-3-4-5-9-5-15z"/>' +
          '<path class="dentinho" d="M31 51h38c0 4-1 7-3 9-5-2-10-3-16-3s-11 1-16 3c-2-2-3-5-3-9z"/>' +
          '<path class="lingua" d="M38 74c0-6 5-10 12-10s12 4 12 10c-3 4-7 6-12 6s-9-2-12-6z"/>' +
        '</g>'
      )
    },
    /* 7 ------------------------------------------------------------------ */
    {
      id: 'tooth',
      pt: 'Dente',
      en: 'tooth',
      fonetica: '/tuːθ/',
      dica: 'It is white and hard. You use it to bite and to chew.',
      svg: svg(
        '<path class="gengiva" d="M14 20c0-8 7-14 16-14h40c9 0 16 6 16 14 0 9-6 15-14 15H28c-8 0-14-6-14-15z"/>' +
        '<g class="an-wiggle">' +
          '<path class="alvo" d="M50 16c14 0 24 9 24 22 0 14-4 22-7 34-2 9-5 14-9 14-4 0-5-8-8-8s-4 8-8 8c-4 0-7-5-9-14-3-12-7-20-7-34 0-13 10-22 24-22z"/>' +
          '<path class="brilho-dente" d="M40 30c4-5 10-7 15-6-8 3-12 8-13 15-2-4-3-7-2-9z"/>' +
        '</g>' +
        '<g class="faisca">' +
          '<path class="f1" d="M78 30l3-9 3 9 9 3-9 3-3 9-3-9-9-3z"/>' +
          '<path class="f2" d="M20 54l2-6 2 6 6 2-6 2-2 6-2-6-6-2z"/>' +
        '</g>'
      )
    },
    /* 8 ------------------------------------------------------------------ */
    {
      id: 'arm',
      pt: 'Braço',
      en: 'arm',
      fonetica: '/ɑːrm/',
      dica: 'It goes from your shoulder to your hand.',
      svg: svg(
        // Tronco em tom neutro à esquerda; braço inteiro (ombro → mão) em destaque
        '<rect class="ctx" x="0" y="8" width="20" height="90" rx="10"/>' +
        '<circle class="ctx-d" cx="24" cy="30" r="15"/>' +
        '<g class="an-flex">' +
          '<path class="tubo-borda" d="M28 30L44 58"/>' +
          '<path class="tubo" d="M28 30L44 58"/>' +
          '<ellipse class="junta an-bicep" cx="34" cy="40" rx="12" ry="10"/>' +
          '<g class="an-forearm">' +
            '<path class="tubo-borda" d="M44 58L62 82"/>' +
            '<path class="tubo" d="M44 58L62 82"/>' +
            '<circle class="alvo-b" cx="66" cy="86" r="12"/>' +
            '<circle class="alvo-b" cx="74" cy="78" r="4.5"/>' +
            '<circle class="alvo-b" cx="78" cy="86" r="4.5"/>' +
            '<circle class="alvo-b" cx="74" cy="93" r="4.5"/>' +
          '</g>' +
        '</g>'
      )
    },
    /* 9 ------------------------------------------------------------------ */
    {
      id: 'hand',
      pt: 'Mão',
      en: 'hand',
      fonetica: '/hænd/',
      dica: 'It has five fingers. You use it to hold things.',
      svg: svg(
        '<path class="ctx" d="M40 96h20v-14H40z"/>' +
        '<g class="an-wave">' +
          '<rect class="alvo" x="40" y="70" width="20" height="20" rx="8"/>' +
          '<path class="alvo" d="M28 52c0-12 9-20 22-20s22 8 22 20v18c0 9-8 16-22 16s-22-7-22-16z"/>' +
          '<rect class="alvo" x="35" y="18" width="10" height="34" rx="5"/>' +
          '<rect class="alvo" x="46" y="12" width="10" height="40" rx="5"/>' +
          '<rect class="alvo" x="57" y="17" width="10" height="35" rx="5"/>' +
          '<rect class="alvo" x="68" y="26" width="9" height="28" rx="4.5"/>' +
          '<rect class="alvo" x="14" y="46" width="9" height="24" rx="4.5" transform="rotate(-32 18 58)"/>' +
        '</g>'
      )
    },
    /* 10 ----------------------------------------------------------------- */
    {
      id: 'finger',
      pt: 'Dedo',
      en: 'finger',
      fonetica: '/ˈfɪŋ.ɡɚ/',
      dica: 'You have five on each hand. You point with it.',
      svg: svg(
        // Mão fechada em tom neutro, com o dedo indicador em destaque
        '<path class="ctx" d="M30 62h40v20c0 8-9 14-20 14s-20-6-20-14z"/>' +
        '<rect class="ctx" x="30" y="52" width="40" height="26" rx="13"/>' +
        '<path class="ctx-linha" d="M40 58v14M50 58v14M60 58v14"/>' +
        '<rect class="ctx-d" x="18" y="56" width="14" height="24" rx="7"/>' +
        '<g class="an-tap">' +
          '<rect class="alvo" x="42" y="10" width="16" height="52" rx="8"/>' +
          '<rect class="unha" x="45" y="14" width="10" height="11" rx="5"/>' +
          '<path class="traco" d="M45 34h10M45 46h10"/>' +
        '</g>'
      )
    },
    /* 11 ----------------------------------------------------------------- */
    {
      id: 'leg',
      pt: 'Perna',
      en: 'leg',
      fonetica: '/lɛɡ/',
      dica: 'You have two of them. You use them to walk and to run.',
      svg: svg(
        // Quadril em tom neutro no topo; perna inteira em destaque
        '<rect class="ctx" x="20" y="0" width="60" height="30" rx="14"/>' +
        '<g class="an-swing">' +
          '<path class="tubo-borda" d="M50 24L44 58L48 84"/>' +
          '<path class="tubo" d="M50 24L44 58L48 84"/>' +
          '<circle class="junta" cx="44" cy="58" r="11"/>' +
          '<path class="alvo" d="M40 82h16c1 6 6 9 13 11 5 1 8 3 8 6 0 3-3 5-9 5H44c-5 0-8-3-8-9 0-6 2-9 4-13z"/>' +
        '</g>'
      )
    },
    /* 12 ----------------------------------------------------------------- */
    {
      id: 'foot',
      pt: 'Pé',
      en: 'foot',
      fonetica: '/fʊt/',
      dica: 'It is at the end of your leg. You wear a shoe on it.',
      svg: svg(
        '<path class="ctx" d="M26 2h22c0 16 2 26 4 34 2 7 2 12 2 20H30c0-8 0-13-2-20-2-8-2-18-2-34z"/>' +
        '<g class="an-tapfoot">' +
          '<path class="alvo" d="M24 58h30c2 8 8 12 18 14 8 2 14 4 14 10 0 7-6 10-16 10H30c-6 0-10-4-10-12 0-9 3-14 4-22z"/>' +
          '<circle class="dedin" cx="76" cy="72" r="4"/>' +
          '<circle class="dedin" cx="70" cy="66" r="3.4"/>' +
          '<circle class="dedin" cx="63" cy="62" r="2.8"/>' +
          '<path class="traco" d="M28 80h40" fill="none"/>' +
        '</g>'
      )
    }
  ];

  /* Utilitarios compartilhados ------------------------------------------- */

  function embaralhar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sortear(lista, quantidade) {
    return embaralhar(lista).slice(0, quantidade);
  }

  function porId(id) {
    for (var i = 0; i < PARTES.length; i++) {
      if (PARTES[i].id === id) return PARTES[i];
    }
    return null;
  }

  global.BP = global.BP || {};
  global.BP.PARTES = PARTES;
  global.BP.embaralhar = embaralhar;
  global.BP.sortear = sortear;
  global.BP.porId = porId;
})(window);

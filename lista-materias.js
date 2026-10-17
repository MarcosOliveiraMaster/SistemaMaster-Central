// lista-materias.js
// Área "Lista de matérias" (menu Pessoas › Professores): mostra as disciplinas da
// coleção Disciplinas (functions-disciplinas.js / DisciplinasStore), permite
// adicionar, renomear, remover e escolher o ícone (Font Awesome) de cada uma.
// O ícone é usado nos cards da vista de indicadores do "Enviar proposta"
// (propostas-professores.js).
//
// Renomear atualiza também o nome gravado nos professores (dataBaseProfessores.disciplinas),
// nas aulas (BancoDeAulas-Lista.materia), nas contratações (BancoDeAulas.aulas[].materia)
// e nas simulações (simulacoes.aulas[].materia) — com confirmação antes, mostrando
// quantos registros serão alterados.

(function () {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const fdb = () => firebase.firestore();
  const ICONE_VALIDO = /^(fas|far|fab|fa-solid|fa-regular|fa-brands)( fa-[a-z0-9-]+)+$/;

  // Galeria de ícones (Font Awesome 6 Free, já carregado no index.html).
  // [classe, palavras para a busca]
  const ICONES = [
    ['fas fa-book', 'livro leitura'], ['fas fa-book-open', 'livro aberto leitura portugues'], ['fas fa-book-open-reader', 'leitor leitura'],
    ['fas fa-book-bookmark', 'livro marcador'], ['fas fa-bookmark', 'marcador'], ['fas fa-graduation-cap', 'formatura graduacao'],
    ['fas fa-school', 'escola'], ['fas fa-chalkboard', 'quadro lousa'], ['fas fa-chalkboard-user', 'professor aula pedagogia'],
    ['fas fa-pencil', 'lapis escrita'], ['fas fa-pen', 'caneta escrita'], ['fas fa-pen-nib', 'caneta redacao escrita'],
    ['fas fa-pen-fancy', 'caneta tinteiro'], ['fas fa-marker', 'marcador'], ['fas fa-highlighter', 'marca texto'],
    ['fas fa-eraser', 'borracha'], ['fas fa-ruler', 'regua geometria'], ['fas fa-ruler-combined', 'esquadro geometria'],
    ['fas fa-compass-drafting', 'compasso geometria desenho'], ['fas fa-calculator', 'calculadora matematica'],
    ['fas fa-square-root-variable', 'raiz matematica algebra'], ['fas fa-superscript', 'potencia expoente matematica'],
    ['fas fa-subscript', 'indice'], ['fas fa-infinity', 'infinito matematica'], ['fas fa-percent', 'porcentagem matematica'],
    ['fas fa-divide', 'divisao matematica'], ['fas fa-plus-minus', 'mais menos matematica'], ['fas fa-shapes', 'formas geometria'],
    ['fas fa-cube', 'cubo geometria'], ['fas fa-cubes', 'cubos'], ['fas fa-chart-line', 'grafico estatistica'],
    ['fas fa-chart-pie', 'grafico pizza estatistica'], ['fas fa-chart-bar', 'grafico barras'], ['fas fa-chart-simple', 'grafico'],
    ['fas fa-atom', 'atomo fisica quimica'], ['fas fa-flask', 'frasco quimica laboratorio'], ['fas fa-flask-vial', 'quimica laboratorio'],
    ['fas fa-vial', 'tubo ensaio'], ['fas fa-vials', 'tubos ensaio'], ['fas fa-microscope', 'microscopio ciencias biologia'],
    ['fas fa-dna', 'dna biologia genetica'], ['fas fa-virus', 'virus biologia'], ['fas fa-bacteria', 'bacteria biologia'],
    ['fas fa-seedling', 'planta broto biologia'], ['fas fa-leaf', 'folha natureza'], ['fas fa-tree', 'arvore natureza'],
    ['fas fa-bug', 'inseto'], ['fas fa-frog', 'sapo'], ['fas fa-fish', 'peixe'], ['fas fa-dove', 'pomba'],
    ['fas fa-paw', 'pata animal'], ['fas fa-brain', 'cerebro neurociencia psicologia'], ['fas fa-heart-pulse', 'coracao saude'],
    ['fas fa-lungs', 'pulmao corpo humano'], ['fas fa-bone', 'osso anatomia'], ['fas fa-tooth', 'dente'],
    ['fas fa-stethoscope', 'saude medicina'], ['fas fa-magnet', 'ima fisica magnetismo'], ['fas fa-bolt', 'raio eletricidade fisica'],
    ['fas fa-lightbulb', 'lampada ideia filosofia'], ['fas fa-fire', 'fogo'], ['fas fa-droplet', 'gota agua'],
    ['fas fa-temperature-half', 'termometro temperatura'], ['fas fa-sun', 'sol'], ['fas fa-moon', 'lua'], ['fas fa-star', 'estrela'],
    ['fas fa-meteor', 'meteoro astronomia'], ['fas fa-rocket', 'foguete espaco astronomia'], ['fas fa-satellite', 'satelite espaco'],
    ['fas fa-earth-americas', 'terra mundo geografia'], ['fas fa-earth-europe', 'terra europa geografia'], ['fas fa-earth-asia', 'terra asia geografia'],
    ['fas fa-globe', 'globo mundo geografia'], ['fas fa-map', 'mapa geografia'], ['fas fa-map-location-dot', 'mapa localizacao'],
    ['fas fa-compass', 'bussola'], ['fas fa-mountain', 'montanha relevo'], ['fas fa-volcano', 'vulcao geologia'],
    ['fas fa-water', 'agua mar'], ['fas fa-wind', 'vento'], ['fas fa-cloud', 'nuvem clima'], ['fas fa-landmark', 'monumento historia'],
    ['fas fa-building-columns', 'colunas historia governo'], ['fas fa-monument', 'monumento'], ['fas fa-scroll', 'pergaminho historia'],
    ['fas fa-crown', 'coroa historia'], ['fas fa-chess', 'xadrez'], ['fas fa-chess-knight', 'cavalo xadrez'], ['fas fa-flag', 'bandeira'],
    ['fas fa-scale-balanced', 'balanca direito justica'], ['fas fa-gavel', 'martelo direito'], ['fas fa-users', 'pessoas grupo'],
    ['fas fa-people-group', 'sociedade sociologia grupo'], ['fas fa-person', 'pessoa'], ['fas fa-children', 'criancas'],
    ['fas fa-child', 'crianca alfabetizacao'], ['fas fa-baby', 'bebe'], ['fas fa-handshake', 'aperto mao'],
    ['fas fa-hand-holding-heart', 'cuidado'], ['fas fa-comments', 'conversa'], ['fas fa-comment-dots', 'fala'],
    ['fas fa-language', 'idioma lingua ingles espanhol'], ['fas fa-spell-check', 'ortografia gramatica'], ['fas fa-quote-left', 'citacao'],
    ['fas fa-feather', 'pena literatura'], ['fas fa-feather-pointed', 'pena literatura poesia'], ['fas fa-masks-theater', 'teatro artes'],
    ['fas fa-music', 'musica'], ['fas fa-guitar', 'violao musica'], ['fas fa-drum', 'tambor musica'], ['fas fa-microphone', 'microfone'],
    ['fas fa-headphones', 'fone audio'], ['fas fa-palette', 'paleta artes pintura'], ['fas fa-paintbrush', 'pincel artes'],
    ['fas fa-brush', 'pincel'], ['fas fa-image', 'imagem'], ['fas fa-camera', 'camera fotografia'], ['fas fa-film', 'filme cinema'],
    ['fas fa-code', 'codigo programacao'], ['fas fa-laptop-code', 'programacao computador'], ['fas fa-terminal', 'terminal programacao'],
    ['fas fa-microchip', 'chip robotica'], ['fas fa-robot', 'robo robotica'], ['fas fa-computer', 'computador informatica'],
    ['fas fa-laptop', 'notebook'], ['fas fa-keyboard', 'teclado digitacao'], ['fas fa-mobile-screen', 'celular'],
    ['fas fa-database', 'banco dados'], ['fas fa-gears', 'engrenagens'], ['fas fa-puzzle-piece', 'quebra cabeca logica'],
    ['fas fa-futbol', 'futebol esporte educacao fisica'], ['fas fa-basketball', 'basquete esporte'], ['fas fa-volleyball', 'volei esporte'],
    ['fas fa-person-running', 'corrida educacao fisica'], ['fas fa-person-swimming', 'natacao'], ['fas fa-dumbbell', 'academia'],
    ['fas fa-bicycle', 'bicicleta'], ['fas fa-table-tennis-paddle-ball', 'ping pong'], ['fas fa-medal', 'medalha'],
    ['fas fa-trophy', 'trofeu olimpiada'], ['fas fa-award', 'premio'], ['fas fa-coins', 'moedas financeira'],
    ['fas fa-money-bill', 'dinheiro economia'], ['fas fa-piggy-bank', 'cofre educacao financeira'], ['fas fa-briefcase', 'maleta carreira'],
    ['fas fa-glasses', 'oculos'], ['fas fa-magnifying-glass', 'lupa pesquisa'], ['fas fa-hourglass-half', 'ampulheta tempo'],
    ['fas fa-clock', 'relogio'], ['fas fa-calendar', 'calendario'], ['fas fa-pen-ruler', 'desenho tecnico'],
    ['fas fa-hands-praying', 'religiao ensino religioso'], ['fas fa-om', 'religiao'], ['fas fa-yin-yang', 'filosofia equilibrio'],
    ['fas fa-signs-post', 'orientacao'], ['fas fa-clipboard-list', 'lista tarefas'], ['fas fa-list-check', 'checklist revisao'],
    ['fas fa-file-pen', 'prova redacao'], ['fas fa-file-lines', 'texto documento'], ['fas fa-newspaper', 'jornal atualidades'],
    ['fas fa-universal-access', 'acessibilidade inclusao'], ['fas fa-hands', 'libras maos'], ['fas fa-ear-listen', 'audicao']
  ];

  // ── Estilos ──────────────────────────────────────────────────────────────
  let estilo = false;
  function injetarEstilo() {
    if (estilo) return;
    estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .lm{--lm-acc:var(--orange,#f28705);padding:1rem 1.2rem 2rem;font-family:'Comfortaa',sans-serif;color:#374151;}
    .lm-topo{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:1rem;}
    .lm-topo h2{font:700 1.15rem 'Lexend',sans-serif;color:#111827;margin:0;flex:1 1 220px;}
    .lm-topo p{margin:.15rem 0 0;font-size:.82rem;color:#6b7280;font-family:'Comfortaa',sans-serif;font-weight:400;}
    .lm-campo{box-sizing:border-box;max-width:100%;border:2px solid #e5e7eb;border-radius:10px;padding:.55rem .7rem;font:.9rem 'Comfortaa',sans-serif;min-height:42px;background:#fff;}
    .lm-campo:focus{outline:0;border-color:var(--lm-acc);}
    .lm-btn{border-radius:10px;padding:.55rem 1rem;font:700 .85rem 'Comfortaa',sans-serif;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#374151;display:inline-flex;gap:.45rem;align-items:center;min-height:42px;}
    .lm-btn.pri{background:var(--lm-acc);border-color:var(--lm-acc);color:#fff;}
    .lm-btn.perigo{color:#dc2626;border-color:#fecaca;}
    .lm-btn.perigo:hover{background:#fef2f2;}
    .lm-btn:disabled{opacity:.5;cursor:not-allowed;}
    .lm-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.8rem;}
    .lm-card{display:flex;align-items:center;gap:.8rem;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:.75rem .8rem;}
    .lm-ico{width:46px;height:46px;flex:none;border-radius:12px;background:color-mix(in srgb,var(--lm-acc) 12%,#fff);color:var(--lm-acc);display:flex;align-items:center;justify-content:center;font-size:1.3rem;}
    .lm-card b{flex:1;min-width:0;font:700 .92rem 'Lexend',sans-serif;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .lm-acoes{display:flex;gap:.3rem;}
    .lm-acoes button{width:34px;height:34px;border-radius:9px;border:1.5px solid #e5e7eb;background:#fff;color:#6b7280;cursor:pointer;}
    .lm-acoes button:hover{border-color:var(--lm-acc);color:var(--lm-acc);}
    .lm-acoes button.rem:hover{border-color:#fca5a5;color:#dc2626;}
    .lm-vazio{grid-column:1/-1;text-align:center;color:#6b7280;padding:2rem;}
    .lm-fundo{position:fixed;inset:0;z-index:10040;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;padding:1rem;}
    .lm-modal{box-sizing:border-box;background:#fff;border-radius:18px;width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:'Comfortaa',sans-serif;}
    .lm-modal-topo{background:var(--lm-acc);color:#fff;padding:.9rem 1.2rem;display:flex;align-items:center;gap:.7rem;}
    .lm-modal-topo h3{font:700 1.02rem 'Lexend',sans-serif;margin:0;flex:1;}
    .lm-x{background:rgba(255,255,255,.2);border:0;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1.1rem;}
    .lm-modal-corpo{padding:1rem 1.2rem;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:.8rem;}
    .lm-linha{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;}
    .lm-linha .lm-campo{flex:1 1 220px;}
    .lm-rotulo{font:700 .78rem 'Lexend',sans-serif;color:#6b7280;margin-bottom:.3rem;display:block;}
    .lm-galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:.4rem;max-height:300px;overflow-y:auto;padding:.2rem;}
    .lm-galeria button{aspect-ratio:1/1;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;font-size:1.15rem;}
    .lm-galeria button:hover{border-color:var(--lm-acc);color:var(--lm-acc);}
    .lm-galeria button[aria-pressed="true"]{background:var(--lm-acc);border-color:var(--lm-acc);color:#fff;}
    .lm-rodape{border-top:1px solid #e5e7eb;padding:.8rem 1.2rem;display:flex;gap:.6rem;justify-content:flex-end;flex-wrap:wrap;align-items:center;}
    .lm-rodape .lm-status{flex:1;font-size:.8rem;color:#6b7280;}
    .lm-dica{font-size:.75rem;color:#9ca3af;}
    @media (max-width:640px){ .lm-fundo{padding:0;align-items:flex-end;} .lm-modal{border-radius:18px 18px 0 0;max-height:94vh;} }
    `;
    document.head.appendChild(s);
  }

  // ── Renomear em todo o sistema ──────────────────────────────────────────
  // As matérias aparecem como texto: "Matemática", "Física, Química" (professores)
  // ou "Matemática, Física e Química" (aulas). Troca só o item igual ao nome antigo
  // (sem diferenciar acento/maiúsculas) e mantém o formato original.
  const SEP = /,\s*|\s+e\s+/;
  function trocarNoTexto(valor, antigo, novo) {
    const alvo = norm(antigo);
    if (Array.isArray(valor)) {
      let mudou = false;
      const lista = valor.map(v => (norm(v) === alvo ? (mudou = true, novo) : v));
      return mudou ? lista : null;
    }
    const txt = String(valor || '');
    if (!txt.trim()) return null;
    if (norm(txt) === alvo) return novo;
    const partes = txt.split(SEP).map(p => p.trim()).filter(Boolean);
    if (!partes.some(p => norm(p) === alvo)) return null;
    const novas = partes.map(p => (norm(p) === alvo ? novo : p));
    if (/\s+e\s+/.test(txt)) return novas.length === 1 ? novas[0] : novas.slice(0, -1).join(', ') + ' e ' + novas[novas.length - 1];
    return novas.join(', ');
  }
  const trocarNasAulas = (aulas, antigo, novo) => {
    if (!Array.isArray(aulas)) return null;
    let mudou = false;
    const lista = aulas.map(a => {
      if (!a || typeof a !== 'object') return a;
      const m = trocarNoTexto(a.materia, antigo, novo);
      if (m === null) return a;
      mudou = true;
      return { ...a, materia: m };
    });
    return mudou ? lista : null;
  };

  // Lê as coleções e devolve as alterações a fazer: [{ ref, campos, grupo }]
  async function planejarRenomear(antigo, novo) {
    const [profs, lista, contratos, sims] = await Promise.all([
      fdb().collection('dataBaseProfessores').get(),
      fdb().collection('BancoDeAulas-Lista').get(),
      fdb().collection('BancoDeAulas').get(),
      fdb().collection('simulacoes').get()
    ]);
    const plano = [];
    profs.forEach(d => { const v = trocarNoTexto(d.data().disciplinas, antigo, novo); if (v !== null) plano.push({ ref: d.ref, campos: { disciplinas: v }, grupo: 'professores' }); });
    lista.forEach(d => { const v = trocarNoTexto(d.data().materia, antigo, novo); if (v !== null) plano.push({ ref: d.ref, campos: { materia: v }, grupo: 'aulas' }); });
    contratos.forEach(d => { const v = trocarNasAulas(d.data().aulas, antigo, novo); if (v !== null) plano.push({ ref: d.ref, campos: { aulas: v }, grupo: 'contratacoes' }); });
    sims.forEach(d => { const v = trocarNasAulas(d.data().aulas, antigo, novo); if (v !== null) plano.push({ ref: d.ref, campos: { aulas: v }, grupo: 'simulacoes' }); });
    return plano;
  }

  async function executarPlano(plano, aoProgredir) {
    const LOTE = 400;
    for (let i = 0; i < plano.length; i += LOTE) {
      const batch = fdb().batch();
      plano.slice(i, i + LOTE).forEach(p => batch.update(p.ref, p.campos));
      await batch.commit();
      if (aoProgredir) aoProgredir(Math.min(i + LOTE, plano.length), plano.length);
    }
  }

  // ── Modal de edição (nome + ícone) ──────────────────────────────────────
  function abrirEdicao(disc, todas, aoSalvar) {
    injetarEstilo();
    const D = window.DisciplinasStore;
    let iconeSel = D.iconeDe(disc);
    const fundo = document.createElement('div');
    fundo.className = 'lm-fundo';
    fundo.innerHTML = `
      <div class="lm-modal lm" role="dialog" aria-modal="true" aria-label="Editar matéria" style="padding:0">
        <div class="lm-modal-topo"><h3><i class="fas fa-pen-to-square mr-2"></i>Editar matéria</h3><button class="lm-x" aria-label="Fechar">&times;</button></div>
        <div class="lm-modal-corpo">
          <div class="lm-linha">
            <span class="lm-ico" id="lm-prev" style="width:56px;height:56px;font-size:1.6rem"><i class="${esc(iconeSel)}"></i></span>
            <div style="flex:1 1 240px"><label class="lm-rotulo" for="lm-nome">Nome da matéria</label>
              <input id="lm-nome" class="lm-campo" style="width:100%" maxlength="60" value="${esc(disc.nome)}"></div>
          </div>
          <div>
            <label class="lm-rotulo" for="lm-busca">Ícone</label>
            <div class="lm-linha"><input id="lm-busca" class="lm-campo" type="search" placeholder="Buscar ícone (ex.: livro, átomo, música)"></div>
          </div>
          <div class="lm-galeria" id="lm-galeria" role="listbox" aria-label="Ícones"></div>
          <div>
            <label class="lm-rotulo" for="lm-classe">Ou digite a classe de qualquer ícone do Font Awesome</label>
            <input id="lm-classe" class="lm-campo" style="width:100%" placeholder="fas fa-calculator" value="${esc(iconeSel)}">
            <span class="lm-dica">Lista completa em fontawesome.com/icons (versão 6, ícones Free).</span>
          </div>
        </div>
        <div class="lm-rodape"><span class="lm-status" id="lm-status"></span>
          <button class="lm-btn" id="lm-cancelar">Cancelar</button><button class="lm-btn pri" id="lm-salvar"><i class="fas fa-check"></i> Salvar</button></div>
      </div>`;
    document.body.appendChild(fundo);
    const $ = (q) => fundo.querySelector(q);
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', teclas);
    $('.lm-x').onclick = fechar; $('#lm-cancelar').onclick = fechar;
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });

    function escolher(classe) {
      iconeSel = classe;
      $('#lm-prev').innerHTML = `<i class="${esc(classe)}"></i>`;
      $('#lm-classe').value = classe;
      fundo.querySelectorAll('.lm-galeria button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ic === classe)));
    }
    function desenharGaleria() {
      const q = norm($('#lm-busca').value);
      const lista = ICONES.filter(([c, p]) => !q || norm(p).includes(q) || c.includes(q));
      $('#lm-galeria').innerHTML = lista.length ? lista.map(([c, p]) =>
        `<button type="button" data-ic="${esc(c)}" title="${esc(p)}" aria-label="${esc(p)}" aria-pressed="${c === iconeSel}"><i class="${esc(c)}"></i></button>`).join('')
        : '<p class="lm-dica" style="grid-column:1/-1">Nenhum ícone encontrado. Digite a classe abaixo.</p>';
      fundo.querySelectorAll('.lm-galeria button').forEach(b => { b.onclick = () => escolher(b.dataset.ic); });
    }
    $('#lm-busca').oninput = desenharGaleria;
    $('#lm-classe').oninput = (e) => { const v = e.target.value.trim(); if (ICONE_VALIDO.test(v)) escolher(v); };
    desenharGaleria();
    $('#lm-nome').focus();

    $('#lm-salvar').onclick = async () => {
      const nome = $('#lm-nome').value.trim();
      const status = $('#lm-status'), btn = $('#lm-salvar');
      if (!nome) { aviso('Digite o nome da matéria.', 'warning'); return; }
      if (!ICONE_VALIDO.test(iconeSel)) { aviso('Classe de ícone inválida (ex.: fas fa-calculator).', 'warning'); return; }
      if (todas.some(d => d.id !== disc.id && norm(d.nome) === norm(nome))) { aviso(`Já existe a matéria "${nome}".`, 'warning'); return; }
      const renomear = nome !== disc.nome;
      btn.disabled = true;
      try {
        if (renomear && norm(nome) !== norm(disc.nome)) {
          status.textContent = 'Verificando onde o nome é usado...';
          const plano = await planejarRenomear(disc.nome, nome);
          const conta = (g) => plano.filter(p => p.grupo === g).length;
          if (plano.length) {
            const ok = await window.showConfirmDialog('Renomear em todo o sistema?',
              `"<b>${esc(disc.nome)}</b>" passará a ser "<b>${esc(nome)}</b>" em:<br>
              • ${conta('professores')} professor(es)<br>• ${conta('aulas')} aula(s)<br>• ${conta('contratacoes')} contratação(ões)<br>• ${conta('simulacoes')} simulação(ões)<br><br>
              Essa alteração grava em todos esses registros e não tem desfazer automático.`, { textoSim: 'Renomear tudo', textoNao: 'Cancelar' });
            if (!ok) { status.textContent = ''; btn.disabled = false; return; }
            await executarPlano(plano, (feito, total) => { status.textContent = `Atualizando registros: ${feito} de ${total}...`; });
          }
        }
        // Só a diferença de maiúsculas/acentos também vale como renomear (sem tocar nos registros).
        await window.DisciplinasStore.update(disc.id, { nome, icone: iconeSel });
        aviso(renomear ? `Matéria renomeada para "${nome}".` : 'Ícone atualizado.', 'success');
        fechar();
        if (aoSalvar) aoSalvar();
      } catch (err) {
        console.error('[Lista de matérias] Erro ao salvar:', err);
        aviso('Não foi possível salvar. Se o erro foi durante a atualização dos registros, parte deles pode já ter sido alterada — tente salvar de novo.', 'error');
        status.textContent = '';
        btn.disabled = false;
      }
    };
  }

  // ── Área principal ───────────────────────────────────────────────────────
  async function loadListaMaterias() {
    injetarEstilo();
    const sec = document.getElementById('lista-materias');
    if (!sec) return;
    sec.innerHTML = `
      <div class="lm">
        <div class="lm-topo">
          <h2><i class="fas fa-shapes mr-2" style="color:var(--lm-acc)"></i>Lista de matérias
            <p>Disciplinas usadas nas aulas, simulações e na proposta para professores. O ícone aparece nos cards do "Enviar proposta".</p></h2>
          <input id="lm-filtro" class="lm-campo" type="search" placeholder="Buscar matéria" aria-label="Buscar matéria" style="flex:0 1 220px">
          <input id="lm-nova" class="lm-campo" placeholder="Nova matéria" aria-label="Nome da nova matéria" maxlength="60" style="flex:0 1 220px">
          <button class="lm-btn pri" id="lm-adicionar"><i class="fas fa-plus"></i> Adicionar</button>
        </div>
        <div class="lm-grade" id="lm-grade"><p class="lm-vazio"><i class="fas fa-spinner fa-spin"></i> Carregando matérias...</p></div>
      </div>`;
    const $ = (q) => sec.querySelector(q);
    const D = window.DisciplinasStore;
    let todas = [];

    async function recarregar(forcar) {
      if (forcar) D.limparCache();
      todas = await D.getAll();
      desenhar();
    }
    function desenhar() {
      const q = norm($('#lm-filtro').value);
      const lista = todas.filter(d => !q || norm(d.nome).includes(q));
      $('#lm-grade').innerHTML = lista.length ? lista.map(d => `
        <div class="lm-card"><span class="lm-ico"><i class="${esc(D.iconeDe(d))}"></i></span><b title="${esc(d.nome)}">${esc(d.nome)}</b>
          <span class="lm-acoes"><button type="button" class="ed" data-id="${esc(d.id)}" title="Editar nome e ícone" aria-label="Editar ${esc(d.nome)}"><i class="fas fa-pen"></i></button>
          <button type="button" class="rem" data-id="${esc(d.id)}" title="Remover da lista" aria-label="Remover ${esc(d.nome)}"><i class="fas fa-trash"></i></button></span></div>`).join('')
        : `<p class="lm-vazio">${todas.length ? 'Nenhuma matéria encontrada.' : 'Nenhuma matéria cadastrada.'}</p>`;
      sec.querySelectorAll('.lm-acoes .ed').forEach(b => { b.onclick = () => { const d = todas.find(x => x.id === b.dataset.id); if (d) abrirEdicao(d, todas, () => recarregar()); }; });
      sec.querySelectorAll('.lm-acoes .rem').forEach(b => {
        b.onclick = async () => {
          const d = todas.find(x => x.id === b.dataset.id);
          if (!d) return;
          const ok = await window.showConfirmDialog('Remover matéria?', `Remover "<b>${esc(d.nome)}</b>" da lista? Aulas e professores que já usam esse nome continuam como estão.`, { textoSim: 'Remover', textoNao: 'Cancelar' });
          if (!ok) return;
          try { await D.remove(d.id); aviso(`"${d.nome}" removida da lista.`, 'success'); await recarregar(); }
          catch (err) { console.error('[Lista de matérias] Erro ao remover:', err); aviso('Não foi possível remover a matéria.', 'error'); }
        };
      });
    }
    $('#lm-filtro').oninput = desenhar;
    const adicionar = async () => {
      const nome = $('#lm-nova').value.trim();
      if (!nome) { aviso('Digite o nome da nova matéria.', 'warning'); return; }
      if (todas.some(d => norm(d.nome) === norm(nome))) { aviso(`Já existe a matéria "${nome}".`, 'warning'); return; }
      $('#lm-adicionar').disabled = true;
      try { await D.add(nome); $('#lm-nova').value = ''; aviso(`"${nome}" adicionada.`, 'success'); await recarregar(); }
      catch (err) { console.error('[Lista de matérias] Erro ao adicionar:', err); aviso('Não foi possível adicionar a matéria.', 'error'); }
      $('#lm-adicionar').disabled = false;
    };
    $('#lm-adicionar').onclick = adicionar;
    $('#lm-nova').onkeydown = (e) => { if (e.key === 'Enter') adicionar(); };
    await recarregar(true);
  }

  window.loadListaMaterias = loadListaMaterias;
  window.ListaMaterias = { load: loadListaMaterias, _trocarNoTexto: trocarNoTexto };
})();

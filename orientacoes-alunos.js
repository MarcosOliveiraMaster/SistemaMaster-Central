// orientacoes-alunos.js
// Central → Clientes → "Orientações para alunos": CRUD dos chips que o
// responsável marca para cada estudante no portal do cliente
// (SistemMaster-Login/orientacoes-aluno.js) e que o professor vê antes de
// cada aula, com a instrução de cada chip.
//
// configOrientacoes/{chipId} = { grupo: 'tipoAula' | 'neurodivergencia', nome,
//   icone (Font Awesome), instrucao, ordem, ativo }
// Regras: SistemMaster-Login/firestore.rules → match /configOrientacoes
// (qualquer conta logada lê; só admin grava).
// Desativar esconde o chip para quem ainda não marcou; alunos que já marcaram
// continuam vendo o nome e a instrução. Excluir só quando nunca foi usado.
// Ids do seed iguais a CHIPS_PADRAO do portal (não mudar os ids).

(function () {
  'use strict';

  const COLECAO = 'configOrientacoes';
  const fdb = () => firebase.firestore();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avisar = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info') : alert(msg));
  const GRUPOS = {
    tipoAula:         { titulo: 'Tipo de aula preferida', icone: 'fas fa-chalkboard' },
    neurodivergencia: { titulo: 'Neurodivergência',       icone: 'fas fa-brain' }
  };
  const ICONES = [
    'fa-solid fa-puzzle-piece', 'fa-solid fa-person-chalkboard', 'fa-solid fa-comments', 'fa-solid fa-graduation-cap',
    'fa-solid fa-rotate', 'fa-solid fa-book-open-reader', 'fa-solid fa-pencil', 'fa-solid fa-layer-group',
    'fa-solid fa-file-circle-check', 'fa-solid fa-list-check', 'fa-solid fa-bolt', 'fa-solid fa-infinity',
    'fa-solid fa-font', 'fa-solid fa-calculator', 'fa-solid fa-pen-nib', 'fa-solid fa-hand', 'fa-solid fa-star',
    'fa-solid fa-heart-pulse', 'fa-solid fa-hands-holding-child', 'fa-solid fa-circle-question', 'fa-solid fa-brain',
    'fa-solid fa-lightbulb', 'fa-solid fa-music', 'fa-solid fa-palette', 'fa-solid fa-gamepad', 'fa-solid fa-flask',
    'fa-solid fa-globe', 'fa-solid fa-clock', 'fa-solid fa-ear-listen', 'fa-solid fa-eye', 'fa-solid fa-hand-holding-heart',
    'fa-solid fa-person-running', 'fa-solid fa-chess', 'fa-solid fa-microphone', 'fa-solid fa-laptop', 'fa-solid fa-seedling'
  ];
  const SEED = [
    {
      "id": "ludica",
      "grupo": "tipoAula",
      "nome": "Lúdica",
      "icone": "fa-solid fa-puzzle-piece",
      "instrucao": "Use jogos, desafios e materiais concretos para ensinar. Transforme exercícios em pequenas competições ou histórias. Alterne atividades curtas para manter o interesse.",
      "ordem": 1
    },
    {
      "id": "expositiva",
      "grupo": "tipoAula",
      "nome": "Expositiva",
      "icone": "fa-solid fa-person-chalkboard",
      "instrucao": "Explique o conteúdo de forma organizada, com começo, meio e fim. Use exemplos no quadro e confira o entendimento com perguntas curtas ao final de cada parte.",
      "ordem": 2
    },
    {
      "id": "interativa",
      "grupo": "tipoAula",
      "nome": "Interativa",
      "icone": "fa-solid fa-comments",
      "instrucao": "Faça perguntas o tempo todo e deixe o estudante explicar com as palavras dele. Construa o raciocínio junto, em diálogo, em vez de só expor.",
      "ordem": 3
    },
    {
      "id": "vestibular-enem",
      "grupo": "tipoAula",
      "nome": "Focada em vestibular/ENEM",
      "icone": "fa-solid fa-graduation-cap",
      "instrucao": "Priorize os temas mais cobrados e resolva questões de provas anteriores. Ensine estratégias de prova: gestão do tempo, eliminação de alternativas e leitura de enunciados.",
      "ordem": 4
    },
    {
      "id": "revisao",
      "grupo": "tipoAula",
      "nome": "Focada em revisão",
      "icone": "fa-solid fa-rotate",
      "instrucao": "Retome os pontos principais do conteúdo já visto com resumos e mapas. Identifique as dúvidas que restaram e reforce só onde for preciso.",
      "ordem": 5
    },
    {
      "id": "leitura",
      "grupo": "tipoAula",
      "nome": "Melhorar leitura",
      "icone": "fa-solid fa-book-open-reader",
      "instrucao": "Inclua leitura em voz alta e interpretação de textos curtos em toda aula. Trabalhe vocabulário e peça para o estudante resumir o que leu.",
      "ordem": 6
    },
    {
      "id": "exercicios",
      "grupo": "tipoAula",
      "nome": "Exercícios práticos",
      "icone": "fa-solid fa-pencil",
      "instrucao": "Explique pouco e pratique muito. Comece com exercícios guiados e aumente a dificuldade aos poucos, corrigindo junto com o estudante.",
      "ordem": 7
    },
    {
      "id": "reforco-base",
      "grupo": "tipoAula",
      "nome": "Reforço de base",
      "icone": "fa-solid fa-layer-group",
      "instrucao": "Descubra quais conteúdos anteriores estão faltando e volte neles antes do conteúdo atual. Avance só quando a base estiver firme.",
      "ordem": 8
    },
    {
      "id": "preparacao-provas",
      "grupo": "tipoAula",
      "nome": "Preparação para provas",
      "icone": "fa-solid fa-file-circle-check",
      "instrucao": "Organize a aula pelo conteúdo e pela data da próxima prova. Faça simulados curtos e revise os erros mais comuns antes do dia da prova.",
      "ordem": 9
    },
    {
      "id": "organizacao-estudo",
      "grupo": "tipoAula",
      "nome": "Organização e método de estudo",
      "icone": "fa-solid fa-list-check",
      "instrucao": "Ajude o estudante a montar uma rotina e um cronograma de estudos. Ensine técnicas como resumos, revisões espaçadas e uso da agenda.",
      "ordem": 10
    },
    {
      "id": "tdah",
      "grupo": "neurodivergencia",
      "nome": "TDAH",
      "icone": "fa-solid fa-bolt",
      "instrucao": "Divida a aula em blocos curtos (10–15 min) com pausas. Dê uma instrução por vez e reduza distrações na mesa. Elogie o esforço e use lembretes visuais.",
      "ordem": 1
    },
    {
      "id": "tea",
      "grupo": "neurodivergencia",
      "nome": "TEA (autismo)",
      "icone": "fa-solid fa-infinity",
      "instrucao": "Mantenha uma rotina previsível e avise antes de mudar de atividade. Use linguagem direta e literal, apoio visual e respeite as sensibilidades sensoriais do estudante.",
      "ordem": 2
    },
    {
      "id": "dislexia",
      "grupo": "neurodivergencia",
      "nome": "Dislexia",
      "icone": "fa-solid fa-font",
      "instrucao": "Leia os enunciados em voz alta junto com o estudante e use letras grandes e espaçadas. Valorize a resposta oral e dê mais tempo para leitura e escrita.",
      "ordem": 3
    },
    {
      "id": "discalculia",
      "grupo": "neurodivergencia",
      "nome": "Discalculia",
      "icone": "fa-solid fa-calculator",
      "instrucao": "Use materiais concretos e desenhos para representar quantidades. Avance passo a passo, permita tabelas de apoio e dê mais tempo nos cálculos.",
      "ordem": 4
    },
    {
      "id": "disgrafia",
      "grupo": "neurodivergencia",
      "nome": "Disgrafia",
      "icone": "fa-solid fa-pen-nib",
      "instrucao": "Reduza a quantidade de cópia e aceite respostas curtas ou orais. Use folhas pautadas e avalie o conteúdo, não a caligrafia.",
      "ordem": 5
    },
    {
      "id": "tod",
      "grupo": "neurodivergencia",
      "nome": "TOD",
      "icone": "fa-solid fa-hand",
      "instrucao": "Combine as regras no início da aula e ofereça escolhas (\"começamos por A ou B?\"). Evite disputas de poder, mantenha a calma e reforce os comportamentos positivos.",
      "ordem": 6
    },
    {
      "id": "altas-habilidades",
      "grupo": "neurodivergencia",
      "nome": "Altas habilidades/superdotação",
      "icone": "fa-solid fa-star",
      "instrucao": "Ofereça desafios além do conteúdo básico e evite repetição excessiva. Estimule perguntas, pesquisa e conexões entre assuntos.",
      "ordem": 7
    },
    {
      "id": "ansiedade",
      "grupo": "neurodivergencia",
      "nome": "Ansiedade",
      "icone": "fa-solid fa-heart-pulse",
      "instrucao": "Crie um ambiente acolhedor e sem pressão. Antecipe o que será feito na aula, comece por tarefas fáceis e trate o erro como parte do aprendizado.",
      "ordem": 8
    },
    {
      "id": "deficiencia-intelectual",
      "grupo": "neurodivergencia",
      "nome": "Deficiência intelectual",
      "icone": "fa-solid fa-hands-holding-child",
      "instrucao": "Use linguagem simples e exemplos do dia a dia. Repita os conceitos com paciência, divida as tarefas em etapas pequenas e celebre cada avanço.",
      "ordem": 9
    },
    {
      "id": "outro",
      "grupo": "neurodivergencia",
      "nome": "Outro (descrever)",
      "icone": "fa-solid fa-circle-question",
      "instrucao": "O responsável descreveu a necessidade nas recomendações abaixo. Leia com atenção e, em caso de dúvida, fale com a Master antes da aula.",
      "ordem": 10
    }
  ];

  let chips = [];
  let cancelar = null;

  const iconeSeguro = (v) => /^(fa-(solid|regular|brands) |fas |far )?fa-[a-z0-9-]+$/.test(String(v || '')) ? v : 'fa-solid fa-circle';
  const ordenar = (lista) => lista.sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

  function itemHtml(c, i, arr) {
    return `
      <div class="oc-item${c.ativo === false ? ' inativo' : ''}">
        <span class="oc-ico"><i class="${esc(iconeSeguro(c.icone))}"></i></span>
        <div class="oc-txt">
          <b>${esc(c.nome)}${c.ativo === false ? ' <small>(desativada)</small>' : ''}</b>
          <span>${esc(c.instrucao || '—')}</span>
        </div>
        <div class="oc-btns">
          <button type="button" title="Subir" data-acao="subir" data-id="${esc(c.id)}" ${i === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
          <button type="button" title="Descer" data-acao="descer" data-id="${esc(c.id)}" ${i === arr.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
          <button type="button" title="Editar" data-acao="editar" data-id="${esc(c.id)}"><i class="fas fa-pen"></i></button>
          <button type="button" title="${c.ativo === false ? 'Reativar' : 'Desativar'}" data-acao="ativo" data-id="${esc(c.id)}"><i class="fas ${c.ativo === false ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
          <button type="button" title="Excluir" data-acao="excluir" data-id="${esc(c.id)}"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }

  function render() {
    const sec = document.getElementById('orientacoes-alunos');
    if (!sec) return;
    sec.innerHTML = `
      <div class="oc-wrap">
        <div class="oc-topo">
          <div>
            <h2 class="oc-titulo"><i class="fas fa-hand-holding-heart"></i> Orientações para alunos</h2>
            <p class="oc-sub">Opções que o responsável marca para cada estudante no portal. O professor vê o nome, o ícone e a
              <b>instrução</b> de cada opção antes da aula.</p>
          </div>
          <div class="oc-acoes-topo">
            ${chips.length ? '' : '<button type="button" class="oc-btn pri" data-acao="seed"><i class="fas fa-wand-magic-sparkles"></i> Criar as 20 opções iniciais</button>'}
            <button type="button" class="oc-btn" data-acao="novo"><i class="fas fa-plus"></i> Nova opção</button>
          </div>
        </div>
        ${chips.length ? '' : '<p class="oc-vazio">Nenhuma opção cadastrada. Enquanto isso, o portal usa as 20 opções iniciais de fábrica.</p>'}
        ${Object.entries(GRUPOS).map(([g, def]) => {
          const lista = ordenar(chips.filter(c => c.grupo === g));
          return `
          <div class="oc-grupo">
            <h3><i class="${def.icone}"></i> ${def.titulo}</h3>
            <div class="oc-lista">${lista.map(itemHtml).join('') || '<p class="oc-vazio">Nenhuma opção neste grupo.</p>'}</div>
          </div>`;
        }).join('')}
      </div>`;
    sec.querySelectorAll('[data-acao]').forEach(b => { b.onclick = () => acao(b.dataset.acao, b.dataset.id); });
  }

  async function acao(nome, id) {
    const c = chips.find(x => x.id === id);
    try {
      if (nome === 'seed') return await semear();
      if (nome === 'novo') return editar(null);
      if (nome === 'editar') return editar(c);
      if (nome === 'ativo') return await fdb().collection(COLECAO).doc(id).update({ ativo: c.ativo === false });
      if (nome === 'subir' || nome === 'descer') return await mover(c, nome === 'subir' ? -1 : 1);
      if (nome === 'excluir') {
        if (!confirm(`Excluir "${c.nome}"? Se algum responsável já marcou esta opção, prefira DESATIVAR: excluindo, ela some das orientações desses alunos.`)) return;
        await fdb().collection(COLECAO).doc(id).delete();
        avisar('Opção excluída.', 'success');
      }
    } catch (err) {
      console.error('[Orientações] Erro:', err);
      avisar('Não foi possível salvar. Tente novamente.', 'error');
    }
  }

  async function semear() {
    const lote = fdb().batch();
    SEED.forEach(({ id, ...dados }) => {
      lote.set(fdb().collection(COLECAO).doc(id), { ...dados, ativo: true, atualizadoPor: 'master',
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await lote.commit();
    avisar('20 opções criadas. Revise as instruções quando puder.', 'success');
  }

  async function mover(c, dir) {
    const lista = ordenar(chips.filter(x => x.grupo === c.grupo));
    const i = lista.findIndex(x => x.id === c.id), j = i + dir;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    const lote = fdb().batch();
    lista.forEach((x, k) => { if ((x.ordem || 0) !== k + 1) lote.update(fdb().collection(COLECAO).doc(x.id), { ordem: k + 1 }); });
    await lote.commit();
  }

  function editar(c) {
    document.getElementById('oc-modal')?.remove();
    const atual = c || { grupo: 'tipoAula', nome: '', icone: ICONES[0], instrucao: '' };
    const m = document.createElement('div');
    m.id = 'oc-modal';
    m.className = 'oc-fundo';
    m.innerHTML = `
      <div class="oc-caixa" role="dialog" aria-modal="true">
        <h3>${c ? 'Editar opção' : 'Nova opção'}</h3>
        <label>Grupo<select id="oc-grupo">${Object.entries(GRUPOS).map(([g, d]) => `<option value="${g}" ${atual.grupo === g ? 'selected' : ''}>${d.titulo}</option>`).join('')}</select></label>
        <label>Nome<input id="oc-nome" maxlength="60" value="${esc(atual.nome)}"></label>
        <label>Ícone</label>
        <div class="oc-icones">${ICONES.map(i => `<button type="button" class="${i === atual.icone ? 'sel' : ''}" data-ico="${i}" title="${i}"><i class="${i}"></i></button>`).join('')}</div>
        <label>Instrução para o professor<textarea id="oc-instrucao" maxlength="600" rows="4">${esc(atual.instrucao)}</textarea></label>
        <div class="oc-rodape">
          <button type="button" class="oc-btn" data-fechar>Cancelar</button>
          <button type="button" class="oc-btn pri" data-salvar><i class="fas fa-floppy-disk"></i> Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    let icone = iconeSeguro(atual.icone);
    m.querySelectorAll('[data-ico]').forEach(b => {
      b.onclick = () => { icone = b.dataset.ico; m.querySelectorAll('[data-ico]').forEach(x => x.classList.toggle('sel', x === b)); };
    });
    const fechar = () => m.remove();
    m.querySelector('[data-fechar]').onclick = fechar;
    m.addEventListener('mousedown', e => { if (e.target === m) fechar(); });
    m.querySelector('[data-salvar]').onclick = async () => {
      const nome = m.querySelector('#oc-nome').value.trim();
      if (!nome) { avisar('Informe o nome da opção.', 'warning'); return; }
      const grupo = m.querySelector('#oc-grupo').value;
      const dados = { grupo, nome, icone, instrucao: m.querySelector('#oc-instrucao').value.trim(),
        atualizadoPor: 'master', atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() };
      try {
        if (c) await fdb().collection(COLECAO).doc(c.id).update(dados);
        else await fdb().collection(COLECAO).add({ ...dados, ativo: true,
          ordem: chips.filter(x => x.grupo === grupo).reduce((mx, x) => Math.max(mx, x.ordem || 0), 0) + 1 });
        fechar();
        avisar('Opção salva.', 'success');
      } catch (err) {
        console.error('[Orientações] Erro ao salvar:', err);
        avisar('Não foi possível salvar. Tente novamente.', 'error');
      }
    };
  }

  function injetarEstilo() {
    if (document.getElementById('oc-estilo')) return;
    const s = document.createElement('style');
    s.id = 'oc-estilo';
    s.textContent = `
      .oc-wrap{padding:1.5rem;max-width:1000px;font-family:'Comfortaa',sans-serif;}
      .oc-topo{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start;margin-bottom:1rem;}
      .oc-titulo{font:700 1.3rem 'Lexend',sans-serif;color:#111827;margin:0 0 .3rem;display:flex;gap:.5rem;align-items:center;}
      .oc-titulo i{color:#f28705;}
      .oc-sub{font-size:.88rem;color:#6b7280;margin:0;max-width:640px;line-height:1.5;}
      .oc-acoes-topo{display:flex;gap:.5rem;flex-wrap:wrap;}
      .oc-btn{border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:.55rem .9rem;font:700 .85rem 'Comfortaa',sans-serif;cursor:pointer;display:inline-flex;gap:.4rem;align-items:center;color:#374151;}
      .oc-btn.pri{background:#f28705;border-color:#f28705;color:#fff;}
      .oc-grupo{margin-top:1.2rem;}
      .oc-grupo h3{font:700 1rem 'Lexend',sans-serif;color:#374151;margin:0 0 .6rem;display:flex;gap:.45rem;align-items:center;}
      .oc-grupo h3 i{color:#f28705;}
      .oc-lista{display:flex;flex-direction:column;gap:.5rem;}
      .oc-item{display:flex;gap:.8rem;align-items:flex-start;background:#fff;border:1.5px solid #f3f4f6;border-radius:12px;padding:.7rem .8rem;}
      .oc-item.inativo{opacity:.55;}
      .oc-ico{width:36px;height:36px;border-radius:10px;background:#fff7ed;color:#f28705;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .oc-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:.2rem;font-size:.85rem;color:#4b5563;line-height:1.45;}
      .oc-txt b{color:#111827;font-size:.92rem;} .oc-txt small{color:#9ca3af;font-weight:400;}
      .oc-btns{display:flex;gap:.25rem;flex-shrink:0;}
      .oc-btns button{width:32px;height:32px;border:1.5px solid #e5e7eb;background:#fff;border-radius:8px;cursor:pointer;color:#6b7280;}
      .oc-btns button:disabled{opacity:.35;cursor:default;}
      .oc-vazio{font-size:.85rem;color:#9ca3af;}
      .oc-fundo{position:fixed;inset:0;z-index:10050;background:rgba(17,24,39,.5);display:flex;align-items:center;justify-content:center;padding:1rem;}
      .oc-caixa{background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:1.2rem;font-family:'Comfortaa',sans-serif;}
      .oc-caixa h3{font:700 1.05rem 'Lexend',sans-serif;margin:0 0 .8rem;}
      .oc-caixa label{display:block;font-size:.8rem;font-weight:700;color:#374151;margin:.6rem 0 .25rem;}
      .oc-caixa input,.oc-caixa select,.oc-caixa textarea{display:block;width:100%;box-sizing:border-box;margin-top:.25rem;border:1.5px solid #e5e7eb;border-radius:10px;padding:.5rem .65rem;font:.88rem 'Comfortaa',sans-serif;}
      .oc-icones{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:.3rem;}
      .oc-icones button{height:38px;border:1.5px solid #e5e7eb;background:#fff;border-radius:8px;cursor:pointer;color:#4b5563;}
      .oc-icones button.sel{border-color:#f28705;background:#fff7ed;color:#f28705;}
      .oc-rodape{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem;}
      @media (max-width:640px){.oc-item{flex-wrap:wrap;}.oc-btns{width:100%;justify-content:flex-end;}}
    `;
    document.head.appendChild(s);
  }

  function loadOrientacoesAlunos() {
    injetarEstilo();
    const sec = document.getElementById('orientacoes-alunos');
    if (cancelar) { render(); return; }
    if (sec) sec.innerHTML = '<div class="oc-wrap">Carregando…</div>';
    cancelar = fdb().collection(COLECAO).onSnapshot(snap => {
      chips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    }, err => {
      console.error('[Orientações] Erro ao ouvir:', err);
      cancelar = null;
      if (sec) sec.innerHTML = '<div class="oc-wrap">Não foi possível carregar as opções.</div>';
    });
  }

  window.loadOrientacoesAlunos = loadOrientacoesAlunos;
})();

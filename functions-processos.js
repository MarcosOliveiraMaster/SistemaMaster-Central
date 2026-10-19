// functions-processos.js — Processos (jornada do cliente por contratação)
// Substitui a antiga área "Demandas" (mesma seção: #fluxo-processos).
//
// Cada contratação (BancoDeAulas) vira um card: apelido do cliente em destaque,
// nome completo embaixo, uma trilha de etapas (bolinhas com ícone) e a barra de
// progresso. A área escuta em tempo real as contratações, as aulas
// (BancoDeAulas-Lista, a mesma fonte da tabela "Aulas Agendadas") e as marcações
// manuais: qualquer alteração no contrato ou nas aulas atualiza o card sozinha.
//
// Etapas automáticas seguem sempre os dados (não aceitam marcação manual); um
// clique nelas abre o modal onde o dado é editado. Só "Contrato enviado" e
// "Renovação oferecida" são manuais.
//
// Gravação: processos/{idContratacao} → { etapas: { chave: { feito, em, por } } }
// (coleção só de admin — regra global do firestore.rules).

(function () {
  'use strict';

  const COLECAO = 'processos';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');
  const fdb = () => firebase.firestore();
  const aviso = (m, t) => (typeof showToast === 'function' ? showToast(m, t || 'info', 3500) : alert(m));
  const fmtData = (ts) => { const d = ts && ts.toDate ? ts.toDate() : null; return d ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
  const semMovimento = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ── Regras ───────────────────────────────────────────────────────────────
  const cancelada = (a) => /cancel/.test(norm(a.StatusAula));
  function profDefinido(p) { const n = norm(p); return !!n && n !== 'a definir' && n !== '-'; }
  // Aula sem status conta como Pendente.
  function aulaEmAberto(a) { const s = norm(a.StatusAula); return !s || s.startsWith('pendente') || s.startsWith('reagend'); }

  // Ordem = ordem da jornada.
  // acao: 'nenhuma' | 'manual' (clique marca/desmarca) | 'editar' (abre Editar contratação)
  //       | 'detalhes' (abre Detalhes da contratação, onde ficam as aulas)
  // auto(c, aulas) → etapa calculada pelos dados.
  const ETAPAS = [
    { chave: 'simulacao', rotulo: 'Simulação aprovada', icone: 'fas fa-calculator', acao: 'nenhuma',
      origem: 'contratação criada a partir da simulação aprovada', auto: () => true },
    { chave: 'contratoEnviado', rotulo: 'Contrato enviado', icone: 'fas fa-paper-plane', acao: 'manual' },
    { chave: 'contratoAssinado', rotulo: 'Contrato assinado', icone: 'fas fa-file-signature', acao: 'editar',
      origem: 'Status do contrato',
      auto: (c) => /assinado/i.test(c.statusContrato || '') && !/pendente/i.test(c.statusContrato || '') },
    { chave: 'pagamento', rotulo: 'Pagamento confirmado', icone: 'fas fa-money-bill-wave', acao: 'editar',
      origem: 'Status de pagamento', auto: (c) => /completo/i.test(c.statusPagamento || '') },
    { chave: 'professores', rotulo: 'Professores definidos', icone: 'fas fa-chalkboard-user', acao: 'detalhes',
      origem: 'professores das aulas',
      auto: (c, aulas) => { const a = aulas.filter(x => !cancelada(x)); return a.length > 0 && a.every(x => profDefinido(x.professor)); } },
    { chave: 'finalizada', rotulo: 'Contratação finalizada', icone: 'fas fa-trophy', acao: 'detalhes',
      origem: 'status das aulas', auto: (c, aulas) => aulas.length > 0 && !aulas.some(aulaEmAberto) },
    { chave: 'renovacao', rotulo: 'Renovação oferecida', icone: 'fas fa-rotate', acao: 'manual' }
  ];
  const iEtapa = Object.fromEntries(ETAPAS.map((e, i) => [e.chave, i]));

  // Contadores do topo (contam só contratações em andamento): clicar filtra a lista.
  const CONTADORES = [
    { k: 'assinar', rotulo: 'para assinar', icone: 'fas fa-file-signature', teste: (f) => !f[iEtapa.contratoAssinado] },
    { k: 'pagar', rotulo: 'pagamentos pendentes', icone: 'fas fa-money-bill-wave', teste: (f) => !f[iEtapa.pagamento] },
    { k: 'professor', rotulo: 'sem professor', icone: 'fas fa-chalkboard-user', teste: (f) => !f[iEtapa.professores] },
    { k: 'renovar', rotulo: 'para renovar', icone: 'fas fa-rotate', teste: (f) => f[iEtapa.finalizada] && !f[iEtapa.renovacao] }
  ];

  // ── Estado ───────────────────────────────────────────────────────────────
  let contratacoes = [];          // [{ id, ...BancoDeAulas }]
  let aulasPorCodigo = new Map(); // codigoContratacao → aulas da BancoDeAulas-Lista
  let marcacoes = {};             // idContratacao → { chave: { feito, em, por } }
  let apelidos = {};              // cpf(dígitos) → apelido
  let filtroTexto = '';
  let filtroSituacao = 'andamento';
  let filtroContador = '';
  let atualizadoEm = null;

  let escutas = [];               // funções de cancelamento dos onSnapshot
  let prontos = { contratos: false, lista: false, marcacoes: false };
  let carregou = false;           // primeiro desenho feito (antes dele não há pop nem confete)
  let timerDesenho = null;
  let observador = null;

  // Cálculo por contratação, refeito só quando os dados mudam (não a cada tecla da busca).
  const calc = new Map();         // id → { c, estados, feitos, p, nAulas, sig }
  const animPendente = new Map(); // id → { pops:Set<índice>, completou:bool }
  const concluidasAgora = new Set();

  function aulasDe(c) {
    const lista = aulasPorCodigo.get(String(c.codigoContratacao || c.id));
    return lista && lista.length ? lista : (c.aulas || []);
  }

  function estadoEtapa(c, etapa, aulas) {
    if (etapa.auto) return { feito: !!etapa.auto(c, aulas || aulasDe(c)), auto: true };
    const m = (marcacoes[c.id] || {})[etapa.chave];
    if (m && typeof m.feito === 'boolean') return { feito: m.feito, manual: true, em: m.em, por: m.por };
    return { feito: false };
  }
  function progresso(c) {
    const aulas = aulasDe(c);
    const feitas = ETAPAS.filter(e => estadoEtapa(c, e, aulas).feito).length;
    return { feitas, total: ETAPAS.length, pct: Math.round(feitas / ETAPAS.length * 100) };
  }

  // ── Estilos ──────────────────────────────────────────────────────────────
  let estilo = false;
  function injetarEstilo() {
    if (estilo) return; estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .pr-wrap{padding:1rem 1.2rem 2rem;font-family:'Comfortaa',sans-serif;}
    .pr-barra{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.7rem;}
    .pr-busca{flex:1 1 260px;border:2px solid #e5e7eb;border-radius:12px;padding:.6rem .9rem;font:.92rem 'Comfortaa',sans-serif;min-height:44px;}
    .pr-busca:focus{outline:none;border-color:#f28705;}
    .pr-chip{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:.4rem .9rem;font:700 .82rem 'Comfortaa',sans-serif;cursor:pointer;color:#374151;min-height:36px;}
    .pr-chip.on{background:#fff7eb;border-color:#f28705;color:#d97804;}
    .pr-atualizar{display:inline-flex;align-items:center;gap:.4rem;border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:.4rem .8rem;font:700 .8rem 'Comfortaa',sans-serif;color:#374151;cursor:pointer;min-height:36px;}
    .pr-atualizar:hover{border-color:#f28705;color:#d97804;}
    .pr-atualizar:disabled{opacity:.6;cursor:wait;}
    .pr-resumo{font-size:.8rem;color:#6b7280;margin-left:auto;}
    .pr-conts{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;}
    .pr-cont{display:inline-flex;align-items:center;gap:.45rem;border:1.5px solid #eef0f3;background:#fafafa;border-radius:12px;padding:.35rem .75rem;font:.78rem 'Comfortaa',sans-serif;color:#4b5563;cursor:pointer;min-height:34px;}
    .pr-cont b{font:700 .9rem 'Lexend',sans-serif;color:#111827;font-variant-numeric:tabular-nums;}
    .pr-cont i{color:#f28705;font-size:.8rem;}
    .pr-cont:hover{border-color:#fcd9a8;}
    .pr-cont.on{background:#fff7eb;border-color:#f28705;color:#d97804;}
    .pr-cont.zero{opacity:.55;}
    .pr-lista{display:flex;flex-direction:column;gap:.9rem;}
    .pr-card{background:#fff;border:1.5px solid #eef0f3;border-radius:16px;padding:1rem 1.1rem;box-shadow:0 2px 10px rgba(0,0,0,.04);}
    .pr-card.completo{border-color:#86efac;}
    .pr-topo{display:flex;align-items:flex-start;gap:.8rem;flex-wrap:wrap;}
    .pr-quem{flex:1;min-width:180px;}
    .pr-apelido{font:700 1.15rem 'Lexend',sans-serif;color:#111827;line-height:1.2;}
    .pr-nome{font-size:.85rem;color:#6b7280;margin-top:.1rem;}
    .pr-cod{font:700 .72rem 'Lexend',sans-serif;color:#9ca3af;letter-spacing:.04em;text-transform:uppercase;margin-top:.25rem;}
    .pr-abrir{border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:.4rem .75rem;font:700 .78rem 'Comfortaa',sans-serif;color:#374151;cursor:pointer;white-space:nowrap;}
    .pr-abrir:hover{border-color:#f28705;color:#d97804;}
    .pr-trilha{display:flex;align-items:flex-start;margin:1rem 0 .4rem;overflow-x:auto;padding:.4rem .1rem .4rem;scrollbar-width:thin;}
    .pr-etapa{flex:1 0 64px;display:flex;flex-direction:column;align-items:center;position:relative;min-width:64px;}
    .pr-etapa:not(:last-child)::after{content:'';position:absolute;top:21px;left:calc(50% + 22px);right:calc(-50% + 22px);height:3px;border-radius:2px;background:#e5e7eb;}
    .pr-etapa.feito:not(:last-child)::after{background:#f28705;}
    .pr-bola{width:44px;height:44px;border-radius:50%;border:2.5px solid #d1d5db;background:#fff;color:#9ca3af;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;position:relative;z-index:1;transition:transform .15s,background .15s,border-color .15s,color .15s;}
    .pr-bola:hover{transform:scale(1.08);border-color:#f28705;color:#f28705;}
    .pr-bola.fixa{cursor:default;}
    .pr-bola.fixa:hover{transform:none;}
    .pr-bola:focus-visible{outline:3px solid #fcd9a8;outline-offset:2px;}
    .pr-etapa.feito .pr-bola{background:#f28705;border-color:#f28705;color:#fff;}
    .pr-etapa.proxima .pr-bola{border-color:#f28705;color:#f28705;box-shadow:0 0 0 4px #fff1dc;}
    .pr-bola.pop{animation:pr-pop .65s cubic-bezier(.34,1.56,.64,1);}
    @keyframes pr-pop{
      0%{transform:scale(.7);box-shadow:0 0 0 0 rgba(22,163,74,.55);}
      45%{transform:scale(1.22);box-shadow:0 0 0 8px rgba(22,163,74,.28);}
      100%{transform:scale(1);box-shadow:0 0 0 14px rgba(22,163,74,0);}
    }
    .pr-auto{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;background:#fff;color:#15803d;font-size:.55rem;display:flex;align-items:center;justify-content:center;border:1.5px solid #bbf7d0;}
    .pr-rot{font-size:.68rem;color:#6b7280;text-align:center;margin-top:.35rem;line-height:1.25;max-width:84px;}
    .pr-etapa.feito .pr-rot{color:#111827;font-weight:700;}
    .pr-prog{position:relative;display:flex;align-items:center;gap:.7rem;}
    .pr-trilho{flex:1;height:8px;background:#f3f4f6;border-radius:999px;overflow:hidden;}
    .pr-enchido{height:100%;background:linear-gradient(90deg,#f5a524,#f28705);border-radius:999px;transition:width .9s cubic-bezier(.22,1,.36,1);}
    .pr-confete{position:absolute;top:4px;width:8px;height:8px;border-radius:2px;pointer-events:none;z-index:5;}
    .pr-card.completo .pr-enchido{background:linear-gradient(90deg,#4ade80,#16a34a);}
    .pr-pct{font:700 .8rem 'Lexend',sans-serif;color:#374151;min-width:3.2rem;text-align:right;}
    .pr-prox{font-size:.8rem;color:#6b7280;margin-top:.45rem;}
    .pr-prox b{color:#d97804;}
    .pr-vazio{text-align:center;color:#6b7280;padding:2.5rem 1rem;}
    @media (prefers-reduced-motion:reduce){.pr-enchido{transition:none;} .pr-bola.pop{animation:none;}}
    @media (max-width:640px){
      .pr-wrap{padding:.8rem .8rem 1.5rem;} .pr-resumo{margin-left:0;flex-basis:100%;}
      .pr-etapa{flex:0 0 64px;} .pr-bola{width:40px;height:40px;}
      .pr-etapa:not(:last-child)::after{top:19px;left:calc(50% + 20px);right:calc(-50% + 20px);}
    }`;
    document.head.appendChild(s);
  }

  // ── Dados (tempo real) ───────────────────────────────────────────────────
  async function carregarApelidos() {
    try {
      const snap = await fdb().collection('cadastroClientes').get();
      apelidos = {};
      snap.forEach(d => { const x = d.data(); if (x.cpf && x.apelido) apelidos[soDigitos(x.cpf)] = x.apelido; });
      agendar();
    } catch (_) { /* sem apelidos: usa o primeiro nome */ }
  }

  // Agrupa as aulas pelo código da contratação (prefixo do id-Aula), como a tabela
  // "Aulas Agendadas" faz; aulas sem o campo data também ficam de fora, como lá.
  function agruparAulas(snap) {
    const tamanhos = new Set(contratacoes.map(c => String(c.codigoContratacao || c.id).length));
    if (!tamanhos.size) tamanhos.add(4);
    const mapa = new Map();
    snap.forEach(doc => {
      const a = doc.data();
      if (!('data' in a)) return;
      const idA = String(a['id-Aula'] || '');
      tamanhos.forEach(t => {
        const cod = idA.slice(0, t);
        if (cod.length !== t) return;
        if (!mapa.has(cod)) mapa.set(cod, []);
        mapa.get(cod).push(a);
      });
    });
    return mapa;
  }

  function ligar() {
    desligar();
    prontos = { contratos: false, lista: false, marcacoes: false };
    let ultimaLista = null;
    const marcarPronto = (k) => { prontos[k] = true; atualizadoEm = new Date(); agendar(); };
    const falha = (k, nome) => (err) => { console.warn(`[Processos] Escuta de ${nome} indisponível:`, err && err.code); marcarPronto(k); };

    escutas.push(fdb().collection('BancoDeAulas').onSnapshot((snap) => {
      contratacoes = [];
      snap.forEach(d => contratacoes.push({ id: d.id, ...d.data() }));
      if (ultimaLista) aulasPorCodigo = agruparAulas(ultimaLista); // códigos novos podem mudar o agrupamento
      marcarPronto('contratos');
    }, (err) => {
      console.error('[Processos] Erro ao carregar contratações:', err);
      const l = document.querySelector('#fluxo-processos .pr-lista');
      if (l && !carregou) l.innerHTML = '<p class="pr-vazio">Não foi possível carregar as contratações.</p>';
    }));
    escutas.push(fdb().collection('BancoDeAulas-Lista').onSnapshot((snap) => {
      ultimaLista = snap;
      aulasPorCodigo = agruparAulas(snap);
      marcarPronto('lista');
    }, falha('lista', 'aulas')));
    escutas.push(fdb().collection(COLECAO).onSnapshot((snap) => {
      marcacoes = {};
      snap.forEach(d => { marcacoes[d.id] = (d.data() || {}).etapas || {}; });
      marcarPronto('marcacoes');
    }, falha('marcacoes', 'marcações')));
  }

  function desligar() {
    escutas.forEach(f => { try { f(); } catch (_) {} });
    escutas = [];
    clearTimeout(timerDesenho);
  }

  // Rajadas de mudanças (ex.: salvar várias aulas) viram um único redesenho.
  function agendar() {
    clearTimeout(timerDesenho);
    timerDesenho = setTimeout(() => {
      if (!prontos.contratos || !prontos.lista || !prontos.marcacoes) return;
      recalcular();
      desenhar();
      carregou = true;
    }, 150);
  }

  // ── Cálculo ──────────────────────────────────────────────────────────────
  const apelidoDe = (c) => apelidos[soDigitos(c.cpf)] || String(c.nomeCliente || c.nome || 'Cliente').split(' ')[0];
  const nomeDe = (c) => c.nomeCliente || c.nome || '';

  function recalcular() {
    const vistos = new Set();
    contratacoes.forEach(c => {
      vistos.add(c.id);
      const aulas = aulasDe(c);
      const estados = ETAPAS.map(e => estadoEtapa(c, e, aulas));
      const feitos = estados.map(s => s.feito);
      const nf = feitos.filter(Boolean).length;
      const p = { feitas: nf, total: ETAPAS.length, pct: Math.round(nf / ETAPAS.length * 100) };
      const nAulas = aulas.filter(a => !cancelada(a)).length;
      const sig = JSON.stringify([apelidoDe(c), nomeDe(c), c.codigoContratacao, nAulas,
        estados.map(s => [s.feito, s.manual ? 1 : 0, s.por || '', (s.em && s.em.seconds) || 0])]);
      const antes = calc.get(c.id);
      if (carregou && antes) {
        const pops = new Set();
        feitos.forEach((f, i) => { if (f && !antes.feitos[i]) pops.add(i); });
        const completou = antes.p.feitas < p.total && p.feitas === p.total;
        if (pops.size || completou) {
          const a = animPendente.get(c.id) || { pops: new Set(), completou: false };
          pops.forEach(i => a.pops.add(i));
          a.completou = a.completou || completou;
          animPendente.set(c.id, a);
        }
        if (completou) concluidasAgora.add(c.id); // fica à vista em "Em andamento" para ver os confetes
      }
      calc.set(c.id, { c, estados, feitos, p, nAulas, sig });
    });
    [...calc.keys()].forEach(id => { if (!vistos.has(id)) calc.delete(id); });
  }

  function filtradas() {
    const t = norm(filtroTexto);
    const cont = CONTADORES.find(x => x.k === filtroContador);
    return [...calc.values()].filter(({ c, feitos, p }) => {
      if (t && !(norm(apelidoDe(c)).includes(t) || norm(nomeDe(c)).includes(t) || norm(c.codigoContratacao).includes(t))) return false;
      if (cont && !cont.teste(feitos)) return false;
      if (filtroSituacao === 'andamento') return p.feitas < p.total || concluidasAgora.has(c.id);
      if (filtroSituacao === 'concluidas') return p.feitas === p.total;
      return true;
    }).sort((a, b) => String(b.c.codigoContratacao || '').localeCompare(String(a.c.codigoContratacao || ''), 'pt-BR', { numeric: true }));
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function dicaEtapa(e, s) {
    if (e.acao === 'nenhuma') return `${e.rotulo} — concluída (${e.origem})`;
    if (e.auto) {
      const onde = e.acao === 'editar' ? 'Editar contratação' : 'Detalhes da contratação';
      return `${e.rotulo} — ${s.feito ? 'concluída' : 'pendente'} (automático: ${e.origem}). Clique para abrir ${onde}.`;
    }
    if (s.feito) return `${e.rotulo} — concluída${s.por ? ` por ${s.por}` : ''}${s.em ? ` em ${fmtData(s.em)}` : ''}. Clique para desmarcar.`;
    return `${e.rotulo} — pendente. Clique para marcar.`;
  }

  function htmlCard(item, larguraInicial) {
    const { c, estados, p, nAulas, sig } = item;
    const iProx = estados.findIndex(s => !s.feito);
    const etapas = ETAPAS.map((e, i) => {
      const s = estados[i];
      const dica = dicaEtapa(e, s);
      return `<div class="pr-etapa ${s.feito ? 'feito' : ''} ${i === iProx ? 'proxima' : ''}">
        <button type="button" class="pr-bola${e.acao === 'nenhuma' ? ' fixa' : ''}" data-c="${esc(c.id)}" data-e="${e.chave}" title="${esc(dica)}" aria-label="${esc(dica)}"${e.acao === 'manual' ? ` aria-pressed="${s.feito}"` : ''}>
          <i class="${e.icone}"></i>${s.feito && s.auto ? '<span class="pr-auto" aria-hidden="true"><i class="fas fa-bolt"></i></span>' : ''}
        </button><span class="pr-rot">${esc(e.rotulo)}</span></div>`;
    }).join('');
    return `<article class="pr-card ${p.feitas === p.total ? 'completo' : ''}" data-id="${esc(c.id)}" data-sig="${esc(sig)}">
      <div class="pr-topo">
        <div class="pr-quem">
          <div class="pr-apelido">${esc(apelidoDe(c))}</div>
          <div class="pr-nome">${esc(nomeDe(c))}</div>
          <div class="pr-cod">Contratação ${esc(c.codigoContratacao || c.id)} · ${nAulas} aulas</div>
        </div>
        <button type="button" class="pr-abrir" data-abrir="${esc(c.id)}"><i class="fas fa-up-right-from-square mr-1"></i> Detalhes</button>
      </div>
      <div class="pr-trilha">${etapas}</div>
      <div class="pr-prog"><div class="pr-trilho" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}" aria-label="Progresso da jornada"><div class="pr-enchido" data-pct="${p.pct}" style="width:${larguraInicial}%"></div></div><span class="pr-pct">${p.feitas}/${p.total}</span></div>
      <div class="pr-prox">${iProx === -1 ? '<b>Jornada concluída</b> 🎉' : `Próxima etapa: <b>${esc(ETAPAS[iProx].rotulo)}</b>`}</div>
    </article>`;
  }

  function desenharTopo(sec, itens) {
    sec.querySelectorAll('.pr-chip').forEach(ch => ch.classList.toggle('on', ch.dataset.f === filtroSituacao));
    const hora = atualizadoEm ? ' · Atualizado às ' + atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    sec.querySelector('.pr-resumo').textContent = `${itens.length} de ${calc.size} contratações${hora}`;
    const emAndamento = [...calc.values()].filter(x => x.p.feitas < x.p.total);
    sec.querySelector('.pr-conts').innerHTML = CONTADORES.map(k => {
      const n = emAndamento.filter(x => k.teste(x.feitos)).length;
      const on = filtroContador === k.k;
      return `<button type="button" class="pr-cont${on ? ' on' : ''}${n ? '' : ' zero'}" data-k="${k.k}" aria-pressed="${on}" title="${on ? 'Limpar filtro' : 'Mostrar só estas contratações'}"><i class="${k.icone}"></i><b>${n}</b> ${k.rotulo}</button>`;
    }).join('');
  }

  // Redesenha só os cards que mudaram; os demais ficam intactos (sem piscar e sem
  // reiniciar animações). A barra desliza do valor anterior (na 1ª vez, de 0).
  function desenhar() {
    const sec = document.getElementById('fluxo-processos');
    const lista = sec && sec.querySelector('.pr-lista');
    if (!lista) return;
    const itens = filtradas();
    desenharTopo(sec, itens);

    if (!itens.length) {
      lista.innerHTML = `<p class="pr-vazio">${calc.size ? 'Nenhuma contratação para este filtro.' : 'Nenhuma contratação cadastrada.'}</p>`;
      animPendente.clear();
      return;
    }
    const existentes = new Map();
    [...lista.children].forEach(el => { if (el.dataset && el.dataset.id) existentes.set(el.dataset.id, el); else el.remove(); });

    const novos = [];
    itens.forEach((item, pos) => {
      const id = item.c.id;
      let el = existentes.get(id);
      existentes.delete(id);
      if (!el || el.dataset.sig !== item.sig) {
        const barraAntiga = el && el.querySelector('.pr-enchido');
        const largura = barraAntiga ? Number(barraAntiga.dataset.pct) || 0 : 0;
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlCard(item, largura);
        const novo = tmp.firstElementChild;
        if (el) el.replaceWith(novo);
        el = novo;
        novos.push({ el, id });
      }
      if (lista.children[pos] !== el) lista.insertBefore(el, lista.children[pos] || null);
    });
    existentes.forEach(el => el.remove());

    const anims = new Map(animPendente);
    animPendente.clear();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      novos.forEach(({ el, id }) => {
        const barra = el.querySelector('.pr-enchido');
        if (barra) barra.style.width = barra.dataset.pct + '%';
        const a = anims.get(id);
        if (!a) return;
        const bolas = el.querySelectorAll('.pr-bola');
        a.pops.forEach(i => { if (bolas[i]) bolas[i].classList.add('pop'); });
        if (a.completou) setTimeout(() => { if (el.isConnected) soltarConfetes(el.querySelector('.pr-prog')); }, 650);
      });
    }));
  }

  function soltarConfetes(alvo) {
    if (!alvo || !alvo.isConnected || semMovimento()) return;
    const cores = ['#f28705', '#f5a524', '#16a34a', '#4ade80', '#3b82f6', '#ec4899', '#facc15'];
    const fim = alvo.querySelector('.pr-trilho');
    const x0 = fim ? fim.offsetLeft + fim.offsetWidth : alvo.offsetWidth;
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('span');
      p.className = 'pr-confete';
      p.style.left = x0 + 'px';
      p.style.background = cores[i % cores.length];
      if (i % 3 === 0) p.style.borderRadius = '50%';
      alvo.appendChild(p);
      const ang = (-160 + Math.random() * 140) * Math.PI / 180; // leque para cima e para a esquerda
      const dist = 60 + Math.random() * 110;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      const anim = p.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px,${dy + 90}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], { duration: 1300 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.4,1)' });
      anim.onfinish = () => p.remove();
    }
  }

  // ── Ações ────────────────────────────────────────────────────────────────
  function clicarEtapa(idC, chave) {
    const c = contratacoes.find(x => x.id === idC);
    const etapa = ETAPAS.find(e => e.chave === chave);
    if (!c || !etapa) return;
    const BC = window.BancoDeAulasCards;
    if (etapa.acao === 'manual') return alternarEtapa(c, etapa);
    if (etapa.acao === 'editar' && BC && BC.openEditModal) return BC.openEditModal(c);
    if (etapa.acao === 'detalhes' && BC && BC.viewAulaDetails) return BC.viewAulaDetails(c);
  }

  async function alternarEtapa(c, etapa) {
    const idC = c.id, chave = etapa.chave;
    const novo = !estadoEtapa(c, etapa).feito;
    const quem = (window.currentUser && window.currentUser.email) || '';
    // Mostra na hora; o onSnapshot confirma depois.
    marcacoes[idC] = { ...(marcacoes[idC] || {}), [chave]: { feito: novo, em: null, por: quem } };
    agendar();
    try {
      await fdb().collection(COLECAO).doc(idC).set({
        codigoContratacao: c.codigoContratacao || idC,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        etapas: { [chave]: { feito: novo, em: firebase.firestore.FieldValue.serverTimestamp(), por: quem } }
      }, { merge: true });
    } catch (err) {
      console.error('[Processos] Erro ao salvar etapa:', err);
      aviso('Não foi possível salvar a etapa.', 'error');
    }
  }

  // Recarga forçada: refaz as escutas (lê tudo de novo) e os apelidos.
  function atualizar(btn) {
    btn.disabled = true;
    const ic = btn.querySelector('i');
    if (ic) ic.classList.add('fa-spin');
    ligar();
    carregarApelidos();
    const inicio = Date.now();
    const esperar = () => {
      const ok = prontos.contratos && prontos.lista && prontos.marcacoes;
      if (ok || Date.now() - inicio > 15000 || !btn.isConnected) { btn.disabled = false; if (ic) ic.classList.remove('fa-spin'); }
      else setTimeout(esperar, 200);
    };
    esperar();
  }

  async function loadFluxoProcessos() {
    injetarEstilo();
    const sec = document.getElementById('fluxo-processos');
    if (!sec) return;
    carregou = false;
    calc.clear(); animPendente.clear(); concluidasAgora.clear();
    sec.innerHTML = `<div class="pr-wrap">
      <div class="pr-barra">
        <input type="search" class="pr-busca" placeholder="Filtrar por apelido, nome do cliente ou nº da contratação" aria-label="Filtrar contratações" value="${esc(filtroTexto)}">
        <button type="button" class="pr-chip" data-f="andamento">Em andamento</button>
        <button type="button" class="pr-chip" data-f="concluidas">Concluídas</button>
        <button type="button" class="pr-chip" data-f="todas">Todas</button>
        <button type="button" class="pr-atualizar" title="Recarregar contratações, aulas e etapas"><i class="fas fa-rotate"></i> Atualizar</button>
        <span class="pr-resumo"></span>
      </div>
      <div class="pr-conts"></div>
      <div class="pr-lista"><p class="pr-vazio"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando contratações…</p></div>
    </div>`;
    sec.querySelector('.pr-busca').addEventListener('input', (e) => { filtroTexto = e.target.value; desenhar(); });
    sec.querySelectorAll('.pr-chip').forEach(ch => ch.addEventListener('click', () => { filtroSituacao = ch.dataset.f; concluidasAgora.clear(); desenhar(); }));
    sec.querySelector('.pr-conts').addEventListener('click', (e) => {
      const b = e.target.closest('.pr-cont');
      if (!b) return;
      filtroContador = filtroContador === b.dataset.k ? '' : b.dataset.k;
      desenhar();
    });
    sec.querySelector('.pr-atualizar').addEventListener('click', (e) => atualizar(e.currentTarget));
    const lista = sec.querySelector('.pr-lista');
    lista.addEventListener('click', (e) => {
      const bola = e.target.closest('.pr-bola');
      if (bola) { clicarEtapa(bola.dataset.c, bola.dataset.e); return; }
      const abrir = e.target.closest('[data-abrir]');
      if (abrir) {
        const c = contratacoes.find(x => x.id === abrir.dataset.abrir);
        if (c && window.BancoDeAulasCards && BancoDeAulasCards.viewAulaDetails) BancoDeAulasCards.viewAulaDetails(c);
      }
    });
    lista.addEventListener('animationend', (e) => { if (e.target.classList && e.target.classList.contains('pop')) e.target.classList.remove('pop'); });

    // Ao sair da área a navegação esvazia a seção: desliga as escutas.
    if (observador) observador.disconnect();
    observador = new MutationObserver(() => {
      if (!sec.querySelector('.pr-wrap')) { desligar(); observador.disconnect(); observador = null; }
    });
    observador.observe(sec, { childList: true });

    carregarApelidos();
    ligar();
  }

  window.loadFluxoProcessos = loadFluxoProcessos;
  window.Processos = { ETAPAS, estadoEtapa, progresso };
})();

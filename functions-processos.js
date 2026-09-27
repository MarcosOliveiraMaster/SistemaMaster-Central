// functions-processos.js — Processos (jornada do cliente por contratação)
// Substitui a antiga área "Demandas" (mesma seção: #fluxo-processos).
//
// Cada contratação (BancoDeAulas) vira um card: apelido do cliente em destaque,
// nome completo embaixo, uma trilha de etapas (bolinhas com ícone) e a barra de
// progresso. Clicar numa bolinha marca/desmarca a etapa (fica gravado quem e
// quando). Algumas etapas se marcam sozinhas a partir dos dados (contrato
// assinado, pagamento completo, professores definidos, 1ª aula, relatórios);
// um clique nelas grava uma decisão manual, que passa a valer no lugar da automática.
//
// Gravação: processos/{idContratacao} → { etapas: { chave: { feito, em, por } } }
// (coleção só de admin — regra global do firestore.rules).

(function () {
  'use strict';

  const COLECAO = 'processos';

  // Ordem = ordem da jornada. auto(c, ctx) → true/false quando os dados
  // permitem concluir; ausente = etapa só manual.
  const ETAPAS = [
    { chave: 'simulacao', rotulo: 'Simulação aprovada', icone: 'fas fa-calculator',
      auto: () => true },
    { chave: 'contratoEnviado', rotulo: 'Contrato enviado', icone: 'fas fa-paper-plane' },
    { chave: 'contratoAssinado', rotulo: 'Contrato assinado', icone: 'fas fa-file-signature',
      auto: (c) => /assinado/i.test(c.statusContrato || '') && !/pendente/i.test(c.statusContrato || '') },
    { chave: 'pagamento', rotulo: 'Pagamento confirmado', icone: 'fas fa-money-bill-wave',
      auto: (c) => /completo/i.test(c.statusPagamento || '') },
    { chave: 'professores', rotulo: 'Professores definidos', icone: 'fas fa-chalkboard-user',
      auto: (c) => { const a = aulasAtivas(c); return a.length > 0 && a.every(x => profDefinido(x.professor)); } },
    { chave: 'boasVindas', rotulo: 'Boas-vindas ao cliente', icone: 'fas fa-envelope-open-text' },
    { chave: 'primeiraAula', rotulo: 'Primeira aula realizada', icone: 'fas fa-flag',
      auto: (c) => aulasAtivas(c).some(aulaRealizada) },
    { chave: 'relatorios', rotulo: 'Relatórios em dia', icone: 'fas fa-clipboard-check',
      auto: (c) => { const r = aulasAtivas(c).filter(aulaRealizada); return r.length > 0 && r.every(x => String(x.RelatorioAula || '').trim()); } },
    { chave: 'finalizada', rotulo: 'Contratação finalizada', icone: 'fas fa-trophy',
      auto: (c) => { const a = aulasAtivas(c); return a.length > 0 && a.every(aulaRealizada); } },
    { chave: 'renovacao', rotulo: 'Renovação oferecida', icone: 'fas fa-rotate' }
  ];

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');
  const fdb = () => firebase.firestore();
  const aviso = (m, t) => (typeof showToast === 'function' ? showToast(m, t || 'info', 3500) : alert(m));
  const fmtData = (ts) => { const d = ts && ts.toDate ? ts.toDate() : null; return d ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };

  function aulasAtivas(c) { return (c.aulas || []).filter(a => !/cancel/i.test(a.StatusAula || '')); }
  function profDefinido(p) { const n = norm(p); return !!n && n !== 'a definir' && n !== '-'; }
  function aulaRealizada(a) { return a.ConfirmacaoProfessorAula === true || a.ConfirmacaoProfessorAula === 'true' || /conclu|realizad/i.test(a.StatusAula || ''); }

  // Estado
  let contratacoes = [];          // [{ id, ...BancoDeAulas }]
  let marcacoes = {};             // idContratacao → { chave: { feito, em, por } }
  let apelidos = {};              // cpf(dígitos) → apelido
  let filtroTexto = '';
  let filtroSituacao = 'andamento';
  let cancelarEscuta = null;

  function estadoEtapa(c, etapa) {
    const m = (marcacoes[c.id] || {})[etapa.chave];
    if (m && typeof m.feito === 'boolean') return { feito: m.feito, manual: true, em: m.em, por: m.por };
    if (etapa.auto) return { feito: !!etapa.auto(c), manual: false };
    return { feito: false, manual: false };
  }
  function progresso(c) {
    const feitas = ETAPAS.filter(e => estadoEtapa(c, e).feito).length;
    return { feitas, total: ETAPAS.length, pct: Math.round(feitas / ETAPAS.length * 100) };
  }

  // ── Estilos ──────────────────────────────────────────────────────────────
  let estilo = false;
  function injetarEstilo() {
    if (estilo) return; estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .pr-wrap{padding:1rem 1.2rem 2rem;font-family:'Comfortaa',sans-serif;}
    .pr-barra{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;}
    .pr-busca{flex:1 1 260px;border:2px solid #e5e7eb;border-radius:12px;padding:.6rem .9rem;font:.92rem 'Comfortaa',sans-serif;min-height:44px;}
    .pr-busca:focus{outline:none;border-color:#f28705;}
    .pr-chip{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:.4rem .9rem;font:700 .82rem 'Comfortaa',sans-serif;cursor:pointer;color:#374151;min-height:36px;}
    .pr-chip.on{background:#fff7eb;border-color:#f28705;color:#d97804;}
    .pr-resumo{font-size:.8rem;color:#6b7280;margin-left:auto;}
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
    .pr-trilha{display:flex;align-items:flex-start;margin:1rem 0 .4rem;overflow-x:auto;padding:.2rem .1rem .4rem;scrollbar-width:thin;}
    .pr-etapa{flex:1 0 64px;display:flex;flex-direction:column;align-items:center;position:relative;min-width:64px;}
    .pr-etapa:not(:last-child)::after{content:'';position:absolute;top:21px;left:calc(50% + 22px);right:calc(-50% + 22px);height:3px;border-radius:2px;background:#e5e7eb;}
    .pr-etapa.feito:not(:last-child)::after{background:#f28705;}
    .pr-bola{width:44px;height:44px;border-radius:50%;border:2.5px solid #d1d5db;background:#fff;color:#9ca3af;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;position:relative;z-index:1;transition:transform .15s,background .15s,border-color .15s,color .15s;}
    .pr-bola:hover{transform:scale(1.08);border-color:#f28705;color:#f28705;}
    .pr-bola:focus-visible{outline:3px solid #fcd9a8;outline-offset:2px;}
    .pr-etapa.feito .pr-bola{background:#f28705;border-color:#f28705;color:#fff;}
    .pr-etapa.proxima .pr-bola{border-color:#f28705;color:#f28705;box-shadow:0 0 0 4px #fff1dc;}
    .pr-auto{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;background:#fff;color:#15803d;font-size:.55rem;display:flex;align-items:center;justify-content:center;border:1.5px solid #bbf7d0;}
    .pr-rot{font-size:.68rem;color:#6b7280;text-align:center;margin-top:.35rem;line-height:1.25;max-width:84px;}
    .pr-etapa.feito .pr-rot{color:#111827;font-weight:700;}
    .pr-prog{display:flex;align-items:center;gap:.7rem;}
    .pr-trilho{flex:1;height:8px;background:#f3f4f6;border-radius:999px;overflow:hidden;}
    .pr-enchido{height:100%;background:linear-gradient(90deg,#f5a524,#f28705);border-radius:999px;transition:width .35s ease;}
    .pr-card.completo .pr-enchido{background:linear-gradient(90deg,#4ade80,#16a34a);}
    .pr-pct{font:700 .8rem 'Lexend',sans-serif;color:#374151;min-width:3.2rem;text-align:right;}
    .pr-prox{font-size:.8rem;color:#6b7280;margin-top:.45rem;}
    .pr-prox b{color:#d97804;}
    .pr-vazio{text-align:center;color:#6b7280;padding:2.5rem 1rem;}
    @media (max-width:640px){
      .pr-wrap{padding:.8rem .8rem 1.5rem;} .pr-resumo{margin-left:0;flex-basis:100%;}
      .pr-etapa{flex:0 0 64px;} .pr-bola{width:40px;height:40px;}
      .pr-etapa:not(:last-child)::after{top:19px;left:calc(50% + 20px);right:calc(-50% + 20px);}
    }`;
    document.head.appendChild(s);
  }

  // ── Dados ────────────────────────────────────────────────────────────────
  async function carregarDados() {
    const [snapC, snapCli] = await Promise.all([
      fdb().collection('BancoDeAulas').get(),
      fdb().collection('cadastroClientes').get().catch(() => null)
    ]);
    contratacoes = [];
    snapC.forEach(d => contratacoes.push({ id: d.id, ...d.data() }));
    apelidos = {};
    if (snapCli) snapCli.forEach(d => { const x = d.data(); if (x.cpf && x.apelido) apelidos[soDigitos(x.cpf)] = x.apelido; });
  }

  function escutarMarcacoes() {
    if (cancelarEscuta) return;
    cancelarEscuta = fdb().collection(COLECAO).onSnapshot((snap) => {
      marcacoes = {};
      snap.forEach(d => { marcacoes[d.id] = (d.data() || {}).etapas || {}; });
      desenhar();
    }, (err) => console.warn('[Processos] Escuta indisponível:', err && err.code));
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const apelidoDe = (c) => apelidos[soDigitos(c.cpf)] || String(c.nomeCliente || c.nome || 'Cliente').split(' ')[0];
  const nomeDe = (c) => c.nomeCliente || c.nome || '';

  function filtradas() {
    const t = norm(filtroTexto);
    return contratacoes.filter(c => {
      if (t && !(norm(apelidoDe(c)).includes(t) || norm(nomeDe(c)).includes(t) || norm(c.codigoContratacao).includes(t))) return false;
      const p = progresso(c);
      if (filtroSituacao === 'andamento') return p.feitas < p.total;
      if (filtroSituacao === 'concluidas') return p.feitas === p.total;
      return true;
    }).sort((a, b) => String(b.codigoContratacao || '').localeCompare(String(a.codigoContratacao || ''), 'pt-BR', { numeric: true }));
  }

  function htmlCard(c) {
    const p = progresso(c);
    const estados = ETAPAS.map(e => estadoEtapa(c, e));
    const iProx = estados.findIndex(s => !s.feito);
    const etapas = ETAPAS.map((e, i) => {
      const s = estados[i];
      const dica = s.feito
        ? `${e.rotulo} — concluída${s.manual ? (s.por ? ` por ${s.por}` : '') + (s.em ? ` em ${fmtData(s.em)}` : '') : ' (automático pelos dados)'}`
        : `${e.rotulo} — pendente. Clique para marcar.`;
      return `<div class="pr-etapa ${s.feito ? 'feito' : ''} ${i === iProx ? 'proxima' : ''}">
        <button type="button" class="pr-bola" data-c="${esc(c.id)}" data-e="${e.chave}" title="${esc(dica)}" aria-label="${esc(dica)}" aria-pressed="${s.feito}">
          <i class="${e.icone}"></i>${s.feito && !s.manual ? '<span class="pr-auto" aria-hidden="true"><i class="fas fa-bolt"></i></span>' : ''}
        </button><span class="pr-rot">${esc(e.rotulo)}</span></div>`;
    }).join('');
    return `<article class="pr-card ${p.feitas === p.total ? 'completo' : ''}">
      <div class="pr-topo">
        <div class="pr-quem">
          <div class="pr-apelido">${esc(apelidoDe(c))}</div>
          <div class="pr-nome">${esc(nomeDe(c))}</div>
          <div class="pr-cod">Contratação ${esc(c.codigoContratacao || c.id)} · ${aulasAtivas(c).length} aulas</div>
        </div>
        <button type="button" class="pr-abrir" data-abrir="${esc(c.id)}"><i class="fas fa-up-right-from-square mr-1"></i> Detalhes</button>
      </div>
      <div class="pr-trilha">${etapas}</div>
      <div class="pr-prog"><div class="pr-trilho" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}" aria-label="Progresso da jornada"><div class="pr-enchido" style="width:${p.pct}%"></div></div><span class="pr-pct">${p.feitas}/${p.total}</span></div>
      <div class="pr-prox">${iProx === -1 ? '<b>Jornada concluída</b> 🎉' : `Próxima etapa: <b>${esc(ETAPAS[iProx].rotulo)}</b>`}</div>
    </article>`;
  }

  function desenhar() {
    const sec = document.getElementById('fluxo-processos');
    const lista = sec && sec.querySelector('.pr-lista');
    if (!lista) return;
    const itens = filtradas();
    sec.querySelectorAll('.pr-chip').forEach(ch => ch.classList.toggle('on', ch.dataset.f === filtroSituacao));
    sec.querySelector('.pr-resumo').textContent = `${itens.length} de ${contratacoes.length} contratações`;
    lista.innerHTML = itens.length ? itens.map(htmlCard).join('')
      : `<p class="pr-vazio">${contratacoes.length ? 'Nenhuma contratação para este filtro.' : 'Nenhuma contratação cadastrada.'}</p>`;
  }

  async function alternarEtapa(idC, chave) {
    const c = contratacoes.find(x => x.id === idC);
    const etapa = ETAPAS.find(e => e.chave === chave);
    if (!c || !etapa) return;
    const atual = estadoEtapa(c, etapa);
    const novo = !atual.feito;
    const quem = (window.currentUser && window.currentUser.email) || '';
    // Mostra na hora; o onSnapshot confirma depois.
    marcacoes[idC] = { ...(marcacoes[idC] || {}), [chave]: { feito: novo, em: null, por: quem } };
    desenhar();
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

  async function loadFluxoProcessos() {
    injetarEstilo();
    const sec = document.getElementById('fluxo-processos');
    if (!sec) return;
    sec.innerHTML = `<div class="pr-wrap">
      <div class="pr-barra">
        <input type="search" class="pr-busca" placeholder="Filtrar por apelido, nome do cliente ou nº da contratação" aria-label="Filtrar contratações" value="${esc(filtroTexto)}">
        <button type="button" class="pr-chip" data-f="andamento">Em andamento</button>
        <button type="button" class="pr-chip" data-f="concluidas">Concluídas</button>
        <button type="button" class="pr-chip" data-f="todas">Todas</button>
        <span class="pr-resumo"></span>
      </div>
      <div class="pr-lista"><p class="pr-vazio"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando contratações…</p></div>
    </div>`;
    sec.querySelector('.pr-busca').addEventListener('input', (e) => { filtroTexto = e.target.value; desenhar(); });
    sec.querySelectorAll('.pr-chip').forEach(ch => ch.addEventListener('click', () => { filtroSituacao = ch.dataset.f; desenhar(); }));
    sec.querySelector('.pr-lista').addEventListener('click', (e) => {
      const bola = e.target.closest('.pr-bola');
      if (bola) { alternarEtapa(bola.dataset.c, bola.dataset.e); return; }
      const abrir = e.target.closest('[data-abrir]');
      if (abrir) {
        const c = contratacoes.find(x => x.id === abrir.dataset.abrir);
        if (c && window.BancoDeAulasCards && BancoDeAulasCards.viewAulaDetails) BancoDeAulasCards.viewAulaDetails(c);
      }
    });
    try {
      await carregarDados();
      escutarMarcacoes();
      desenhar();
    } catch (err) {
      console.error('[Processos] Erro ao carregar:', err);
      const l = sec.querySelector('.pr-lista');
      if (l) l.innerHTML = '<p class="pr-vazio">Não foi possível carregar as contratações.</p>';
    }
  }

  window.loadFluxoProcessos = loadFluxoProcessos;
  window.Processos = { ETAPAS, estadoEtapa, progresso };
})();

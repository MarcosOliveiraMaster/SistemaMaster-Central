// avaliacoes-equipe.js
// Área "Avaliações da equipe" da Central.
//
// Os clientes avaliam, pelo portal (SistemMaster-Login/avaliacao-equipe.js),
// os professores que já deram aula para eles: estrelas (1–5), pontos fortes,
// comentário e sugestões de melhoria. Cada envio é um documento em
// "avaliacoesEquipe". Aqui a Central vê tudo em tempo real, em três visões:
//   - Por professor: média, distribuição de estrelas, pontos fortes citados;
//   - Por cliente: quem avaliou, quantas vezes e a média que deu;
//   - Comentários: um por um, do mais recente ao mais antigo.
// Avaliações não lidas ficam destacadas e contam no menu e no título da aba;
// abrir um professor/cliente (ou clicar no comentário) marca como lida.
// Regras: SistemMaster-Login/firestore.rules → match /avaliacoesEquipe.

(function () {
  'use strict';

  const COLECAO = 'avaliacoesEquipe';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const fdb = () => firebase.firestore();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const ms = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);
  const fmtData = (ts) => {
    const d = ts && ts.toDate ? ts.toDate() : null;
    return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  };

  let avaliacoes = [];
  let cancelar = null;
  let visao = 'professor';
  let filtros = { busca: '', estrelas: '', naoLidas: false };

  const naoLida = (a) => a.lidaCentral === false;
  window.contadorAvaliacoesNaoLidas = () => avaliacoes.filter(naoLida).length;

  function estrelas(n, classe = '') {
    const cheio = Math.round(n * 2) / 2;
    return `<span class="ae-estrelas ${classe}" aria-label="${n.toFixed(1).replace('.', ',')} de 5">${[1, 2, 3, 4, 5].map(i =>
      `<i class="${cheio >= i ? 'fas fa-star' : cheio >= i - .5 ? 'fas fa-star-half-stroke' : 'far fa-star'}"></i>`).join('')}</span>`;
  }
  const media = (lista) => lista.length ? lista.reduce((t, a) => t + (Number(a.estrelas) || 0), 0) / lista.length : 0;
  const fmtMedia = (m) => m.toFixed(1).replace('.', ',');
  const iniciais = (nome) => {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
  };

  // ── Estilos ──────────────────────────────────────────────────────────────
  function injetarEstilo() {
    if (document.getElementById('ae-estilo')) return;
    const s = document.createElement('style');
    s.id = 'ae-estilo';
    s.textContent = `
    .ae-wrap{display:flex;flex-direction:column;gap:1rem;font-family:'Comfortaa',sans-serif;}
    .ae-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem;}
    .ae-kpi{background:#fff;border:1px solid #f3f4f6;border-radius:16px;padding:1rem;box-shadow:0 2px 10px rgba(0,0,0,.04);}
    .ae-kpi small{display:block;font-size:.72rem;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
    .ae-kpi b{display:block;font:700 1.5rem 'Lexend',sans-serif;color:#111827;margin-top:.25rem;}
    .ae-kpi .ae-estrelas{font-size:.85rem;}
    .ae-kpi.destaque{background:linear-gradient(135deg,#f28705,#d97804);border:0;}
    .ae-kpi.destaque small,.ae-kpi.destaque b{color:#fff;}
    .ae-kpi.destaque .ae-estrelas{color:#fff;}
    .ae-barra{background:#fff;border:1px solid #f3f4f6;border-radius:16px;padding:.75rem;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;}
    .ae-abas{display:flex;background:#f3f4f6;border-radius:12px;padding:3px;gap:2px;}
    .ae-aba{border:0;background:none;border-radius:10px;padding:.5rem .85rem;font:700 .8rem 'Lexend',sans-serif;color:#6b7280;cursor:pointer;white-space:nowrap;}
    .ae-aba.on{background:#fff;color:#d97804;box-shadow:0 1px 4px rgba(0,0,0,.08);}
    .ae-busca{flex:1 1 200px;min-width:0;border:1.5px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;font:400 .85rem 'Comfortaa',sans-serif;}
    .ae-busca:focus,.ae-sel:focus{outline:none;border-color:#f28705;}
    .ae-sel{border:1.5px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;font:700 .8rem 'Comfortaa',sans-serif;background:#fff;}
    .ae-check{display:flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:700;color:#374151;cursor:pointer;white-space:nowrap;}
    .ae-btn{border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:.5rem .8rem;font:700 .8rem 'Lexend',sans-serif;color:#374151;cursor:pointer;display:inline-flex;gap:.4rem;align-items:center;white-space:nowrap;}
    .ae-btn:hover{border-color:#fcd9a8;color:#d97804;}
    .ae-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.9rem;}
    .ae-card{background:#fff;border:1.5px solid #f3f4f6;border-radius:18px;padding:1rem;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:.65rem;font:inherit;color:inherit;position:relative;box-shadow:0 2px 10px rgba(0,0,0,.04);transition:transform .15s,box-shadow .15s,border-color .15s;}
    .ae-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.08);border-color:#fcd9a8;}
    .ae-card.nova{border-color:#fdba74;}
    .ae-novo{position:absolute;top:.8rem;right:.8rem;background:#dc2626;color:#fff;border-radius:999px;font:700 .65rem 'Lexend',sans-serif;padding:.15rem .5rem;}
    .ae-topo{display:flex;gap:.7rem;align-items:center;min-width:0;padding-right:3.5rem;}
    .ae-av{flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#fff1de;color:#d97804;display:flex;align-items:center;justify-content:center;font:700 .9rem 'Lexend',sans-serif;}
    .ae-av.cli{background:#eff6ff;color:#2563eb;}
    .ae-topo h4{margin:0;font:700 .95rem 'Lexend',sans-serif;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .ae-topo small{display:block;font-size:.74rem;color:#6b7280;}
    .ae-media{display:flex;align-items:center;gap:.5rem;}
    .ae-media b{font:700 1.35rem 'Lexend',sans-serif;color:#111827;}
    .ae-estrelas{color:#f59e0b;display:inline-flex;gap:1px;}
    .ae-dist{display:flex;flex-direction:column;gap:.2rem;}
    .ae-dist div{display:grid;grid-template-columns:1.6rem 1fr 1.6rem;align-items:center;gap:.4rem;font-size:.7rem;color:#6b7280;font-weight:700;}
    .ae-dist span.bar{height:6px;border-radius:999px;background:#f3f4f6;overflow:hidden;}
    .ae-dist span.bar i{display:block;height:100%;background:#f59e0b;border-radius:999px;}
    .ae-tags{display:flex;flex-wrap:wrap;gap:.3rem;}
    .ae-tag{font:700 .68rem 'Comfortaa',sans-serif;background:#ecfdf5;color:#047857;border-radius:999px;padding:.18rem .55rem;}
    .ae-trecho{font-size:.8rem;color:#374151;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .ae-lista{display:flex;flex-direction:column;gap:.75rem;}
    .ae-com{background:#fff;border:1.5px solid #f3f4f6;border-radius:16px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.5rem;position:relative;}
    .ae-com.nova{border-color:#fdba74;background:#fffaf3;cursor:pointer;}
    .ae-com-topo{display:flex;flex-wrap:wrap;gap:.4rem .9rem;align-items:center;}
    .ae-com-topo b{font:700 .88rem 'Lexend',sans-serif;color:#111827;}
    .ae-com-topo .ae-seta{color:#9ca3af;font-size:.75rem;}
    .ae-com-data{font-size:.72rem;color:#9ca3af;margin-left:auto;}
    .ae-com p{margin:0;font-size:.85rem;color:#374151;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
    .ae-com p strong{display:block;font:700 .68rem 'Lexend',sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:.1rem;}
    .ae-com .sug{background:#eff6ff;border-radius:10px;padding:.55rem .7rem;}
    .ae-com .sug strong{color:#2563eb;}
    .ae-com-meta{font-size:.72rem;color:#6b7280;}
    .ae-vazio{text-align:center;padding:3rem 1rem;color:#9ca3af;background:#fff;border:2px dashed #e5e7eb;border-radius:16px;}
    .ae-vazio i{font-size:2.2rem;display:block;margin-bottom:.6rem;color:#d1d5db;}
    .ae-fundo{position:fixed;inset:0;z-index:10050;background:rgba(17,24,39,.5);display:flex;justify-content:flex-end;animation:ae-fade .18s ease;}
    .ae-gaveta{background:#f9fafb;width:min(620px,100vw);height:100%;display:flex;flex-direction:column;box-shadow:-10px 0 40px rgba(0,0,0,.2);animation:ae-entra .25s cubic-bezier(.2,.8,.2,1);}
    .ae-gaveta-topo{background:#fff;padding:1rem 1.2rem;border-bottom:1px solid #f3f4f6;display:flex;gap:.8rem;align-items:center;}
    .ae-gaveta-topo h3{margin:0;flex:1;min-width:0;font:700 1.05rem 'Lexend',sans-serif;color:#111827;}
    .ae-gaveta-topo small{display:block;font:400 .78rem 'Comfortaa',sans-serif;color:#6b7280;margin-top:.15rem;}
    .ae-x{border:0;background:#f3f4f6;width:38px;height:38px;border-radius:50%;cursor:pointer;color:#374151;flex-shrink:0;}
    .ae-gaveta-corpo{flex:1;overflow-y:auto;padding:1rem 1.2rem 2rem;display:flex;flex-direction:column;gap:1rem;}
    .ae-resumo{background:#fff;border-radius:16px;padding:1rem;display:grid;grid-template-columns:auto 1fr;gap:1.2rem;align-items:center;border:1px solid #f3f4f6;}
    .ae-resumo .ae-media{flex-direction:column;align-items:flex-start;gap:.1rem;}
    .ae-resumo .ae-media b{font-size:2.2rem;}
    body.theme-blue .ae-aba.on,body.theme-blue .ae-av{color:#2563eb;}
    body.theme-blue .ae-kpi.destaque{background:linear-gradient(135deg,#3b82f6,#1d4ed8);}
    @keyframes ae-fade{from{opacity:0}to{opacity:1}}
    @keyframes ae-entra{from{transform:translateX(40px);opacity:.5}to{transform:none;opacity:1}}
    @media (prefers-reduced-motion:reduce){.ae-fundo,.ae-gaveta{animation:none}.ae-card{transition:none}}
    @media (max-width:900px){.ae-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}
    @media (max-width:560px){.ae-abas{width:100%;}.ae-aba{flex:1;padding:.5rem .4rem;font-size:.74rem;}.ae-resumo{grid-template-columns:1fr;}.ae-kpi b{font-size:1.25rem;}}
    `;
    document.head.appendChild(s);
  }

  // ── Dados ────────────────────────────────────────────────────────────────
  function atualizarContador() {
    const n = window.contadorAvaliacoesNaoLidas();
    const el = document.getElementById('contador-avaliacoes');
    if (el) { el.textContent = n > 99 ? '99+' : String(n); el.hidden = n === 0; }
    if (typeof window.atualizarTituloNotificacoes === 'function') window.atualizarTituloNotificacoes();
  }

  let primeira = true;
  function iniciarEscuta() {
    if (cancelar || !window.firebase || !window.currentUser) return;
    cancelar = fdb().collection(COLECAO).onSnapshot((snap) => {
      const chegaram = primeira ? [] : snap.docChanges().filter(c => c.type === 'added').map(c => c.doc.data());
      avaliacoes = [];
      snap.forEach(d => avaliacoes.push({ id: d.id, ...d.data() }));
      avaliacoes.sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm));
      atualizarContador();
      if (chegaram.length) {
        const a = chegaram[0];
        aviso(chegaram.length === 1 ? `⭐ Nova avaliação: ${a.clienteNome || 'Cliente'} → ${a.professorNome || 'professor'} (${a.estrelas}★)` : `⭐ ${chegaram.length} novas avaliações da equipe`, 'success');
      }
      primeira = false;
      const sec = document.getElementById('avaliacoes-equipe');
      if (sec && sec.classList.contains('active') && sec.querySelector('.ae-wrap')) desenhar();
    }, (err) => console.warn('[Avaliações] Escuta indisponível:', err && err.code));
  }

  async function marcarLidas(lista) {
    const pend = lista.filter(naoLida);
    if (!pend.length) return;
    try {
      const lote = fdb().batch();
      pend.slice(0, 450).forEach(a => lote.update(fdb().collection(COLECAO).doc(a.id), { lidaCentral: true }));
      await lote.commit();
    } catch (err) {
      console.warn('[Avaliações] Não marcou como lidas:', err && err.code);
    }
  }

  function filtradas() {
    const b = norm(filtros.busca);
    return avaliacoes.filter(a => {
      if (filtros.naoLidas && !naoLida(a)) return false;
      if (filtros.estrelas === 'baixa' && a.estrelas > 2) return false;
      if (filtros.estrelas && filtros.estrelas !== 'baixa' && String(a.estrelas) !== filtros.estrelas) return false;
      if (b && !norm([a.professorNome, a.clienteNome, a.comentario, a.sugestoes, (a.destaques || []).join(' ')].join(' ')).includes(b)) return false;
      return true;
    });
  }

  function agrupar(lista, chaveDe, nomeDe) {
    const mapa = new Map();
    lista.forEach(a => {
      const k = chaveDe(a);
      if (!mapa.has(k)) mapa.set(k, { chave: k, nome: nomeDe(a), itens: [] });
      mapa.get(k).itens.push(a);
    });
    return [...mapa.values()];
  }
  const chaveProf = (a) => a.professorEmail || a.professorId || norm(a.professorNome);
  const chaveCli = (a) => a.clienteUid || norm(a.clienteNome);

  // ── Desenho ─────────────────────────────────────────────────────────────
  function kpis() {
    const profs = new Set(avaliacoes.map(chaveProf)).size;
    const m = media(avaliacoes);
    return `<div class="ae-kpis">
      <div class="ae-kpi destaque"><small>Média geral</small><b>${avaliacoes.length ? fmtMedia(m) : '—'}</b>${avaliacoes.length ? estrelas(m) : ''}</div>
      <div class="ae-kpi"><small>Avaliações</small><b>${avaliacoes.length}</b></div>
      <div class="ae-kpi"><small>Professores avaliados</small><b>${profs}</b></div>
      <div class="ae-kpi"><small>Não lidas</small><b style="color:${window.contadorAvaliacoesNaoLidas() ? '#dc2626' : '#111827'}">${window.contadorAvaliacoesNaoLidas()}</b></div>
    </div>`;
  }

  function distribuicao(itens) {
    return `<div class="ae-dist">${[5, 4, 3, 2, 1].map(n => {
      const q = itens.filter(a => a.estrelas === n).length;
      const pct = itens.length ? Math.round(q / itens.length * 100) : 0;
      return `<div><span>${n}★</span><span class="bar"><i style="width:${pct}%"></i></span><span>${q}</span></div>`;
    }).join('')}</div>`;
  }

  function topDestaques(itens, max = 4) {
    const cont = new Map();
    itens.forEach(a => (a.destaques || []).forEach(d => cont.set(d, (cont.get(d) || 0) + 1)));
    const top = [...cont.entries()].sort((x, y) => y[1] - x[1]).slice(0, max);
    return top.length ? `<div class="ae-tags">${top.map(([d, q]) => `<span class="ae-tag">${esc(d)} · ${q}</span>`).join('')}</div>` : '';
  }

  function comentarioHtml(a, { prof = true, cli = true } = {}) {
    return `<article class="ae-com ${naoLida(a) ? 'nova' : ''}" data-id="${esc(a.id)}">
      ${naoLida(a) ? '<span class="ae-novo" style="position:static;align-self:flex-start">Nova</span>' : ''}
      <div class="ae-com-topo">
        ${estrelas(a.estrelas || 0)}
        ${cli ? `<b>${esc(a.clienteNome || 'Cliente')}</b>` : ''}
        ${cli && prof ? '<i class="fas fa-arrow-right ae-seta"></i>' : ''}
        ${prof ? `<b>${esc(a.professorNome || 'Professor')}</b>` : ''}
        <span class="ae-com-data">${esc(fmtData(a.criadoEm))}</span>
      </div>
      ${(a.destaques || []).length ? `<div class="ae-tags">${a.destaques.map(d => `<span class="ae-tag">${esc(d)}</span>`).join('')}</div>` : ''}
      ${a.comentario ? `<p><strong>Comentário</strong>${esc(a.comentario)}</p>` : ''}
      ${a.sugestoes ? `<p class="sug"><strong>Sugestão de melhoria</strong>${esc(a.sugestoes)}</p>` : ''}
      ${!a.comentario && !a.sugestoes ? '<p style="color:#9ca3af">Sem comentário — só a nota.</p>' : ''}
      <span class="ae-com-meta">${a.totalAulas ? `${a.totalAulas} ${a.totalAulas === 1 ? 'aula' : 'aulas'} com o professor` : ''}${a.ultimaAula ? ` · última em ${esc(a.ultimaAula)}` : ''}${a.clienteEmail && cli ? ` · ${esc(a.clienteEmail)}` : ''}</span>
    </article>`;
  }

  function cardGrupo(g, tipo) {
    const m = media(g.itens);
    const novas = g.itens.filter(naoLida).length;
    const ult = g.itens[0];
    const sub = tipo === 'professor'
      ? `${g.itens.length} ${g.itens.length === 1 ? 'avaliação' : 'avaliações'} · ${new Set(g.itens.map(chaveCli)).size} ${new Set(g.itens.map(chaveCli)).size === 1 ? 'cliente' : 'clientes'}`
      : `${g.itens.length} ${g.itens.length === 1 ? 'avaliação' : 'avaliações'} · ${new Set(g.itens.map(chaveProf)).size} ${new Set(g.itens.map(chaveProf)).size === 1 ? 'professor' : 'professores'}`;
    const trecho = g.itens.find(a => a.comentario || a.sugestoes);
    return `<button type="button" class="ae-card ${novas ? 'nova' : ''}" data-chave="${esc(g.chave)}">
      ${novas ? `<span class="ae-novo">${novas} ${novas === 1 ? 'nova' : 'novas'}</span>` : ''}
      <div class="ae-topo"><div class="ae-av ${tipo === 'cliente' ? 'cli' : ''}">${esc(iniciais(g.nome))}</div>
        <div style="min-width:0"><h4 title="${esc(g.nome)}">${esc(g.nome)}</h4><small>${sub}</small></div></div>
      <div class="ae-media"><b>${fmtMedia(m)}</b>${estrelas(m)}</div>
      ${tipo === 'professor' ? distribuicao(g.itens) + topDestaques(g.itens) : ''}
      ${trecho ? `<p class="ae-trecho">“${esc(trecho.comentario || trecho.sugestoes)}”</p>` : ''}
      <small style="font-size:.7rem;color:#9ca3af">Última: ${esc(fmtData(ult.criadoEm))}</small>
    </button>`;
  }

  function desenhar() {
    const sec = document.getElementById('avaliacoes-equipe');
    if (!sec) return;
    sec.querySelector('.ae-kpis-slot').innerHTML = kpis();
    sec.querySelectorAll('.ae-aba').forEach(b => { b.classList.toggle('on', b.dataset.v === visao); b.setAttribute('aria-selected', String(b.dataset.v === visao)); });
    const cont = sec.querySelector('.ae-conteudo');
    const lista = filtradas();

    if (!avaliacoes.length) {
      cont.innerHTML = '<div class="ae-vazio"><i class="far fa-star"></i>Nenhuma avaliação ainda.<br>Quando os clientes avaliarem a equipe pelo portal, as avaliações aparecem aqui.</div>';
      return;
    }
    if (!lista.length) {
      cont.innerHTML = '<div class="ae-vazio"><i class="fas fa-filter"></i>Nenhuma avaliação com esses filtros.</div>';
      return;
    }

    if (visao === 'comentarios') {
      cont.innerHTML = `<div class="ae-lista">${lista.map(a => comentarioHtml(a)).join('')}</div>`;
      cont.querySelectorAll('.ae-com.nova').forEach(el => {
        el.onclick = () => marcarLidas(avaliacoes.filter(a => a.id === el.dataset.id));
      });
      return;
    }

    const tipo = visao === 'cliente' ? 'cliente' : 'professor';
    const grupos = tipo === 'professor'
      ? agrupar(lista, chaveProf, a => a.professorNome || 'Professor')
      : agrupar(lista, chaveCli, a => a.clienteNome || 'Cliente');
    // Com novas primeiro; depois professores pela menor média (onde agir) e clientes pela mais recente.
    grupos.sort((x, y) => {
      const nx = x.itens.some(naoLida), ny = y.itens.some(naoLida);
      if (nx !== ny) return nx ? -1 : 1;
      return tipo === 'professor' ? media(x.itens) - media(y.itens) : ms(y.itens[0].criadoEm) - ms(x.itens[0].criadoEm);
    });
    cont.innerHTML = `<div class="ae-grade">${grupos.map(g => cardGrupo(g, tipo)).join('')}</div>`;
    cont.querySelectorAll('.ae-card').forEach(c => {
      c.onclick = () => abrirDetalhe(grupos.find(g => g.chave === c.dataset.chave), tipo);
    });
  }

  function abrirDetalhe(g, tipo) {
    const anterior = document.activeElement;
    const m = media(g.itens);
    const f = document.createElement('div');
    f.className = 'ae-fundo';
    f.innerHTML = `<aside class="ae-gaveta" role="dialog" aria-modal="true" aria-labelledby="ae-gaveta-titulo">
      <div class="ae-gaveta-topo">
        <div class="ae-av ${tipo === 'cliente' ? 'cli' : ''}">${esc(iniciais(g.nome))}</div>
        <h3 id="ae-gaveta-titulo">${esc(g.nome)}<small>${tipo === 'professor' ? 'Professor' : 'Cliente'} · ${g.itens.length} ${g.itens.length === 1 ? 'avaliação' : 'avaliações'}</small></h3>
        <button type="button" class="ae-x" aria-label="Fechar"><i class="fas fa-times"></i></button>
      </div>
      <div class="ae-gaveta-corpo">
        <div class="ae-resumo">
          <div class="ae-media"><b>${fmtMedia(m)}</b>${estrelas(m)}<small style="font-size:.72rem;color:#6b7280">${tipo === 'professor' ? 'média recebida' : 'média dada'}</small></div>
          <div>${distribuicao(g.itens)}${tipo === 'professor' ? `<div style="margin-top:.6rem">${topDestaques(g.itens, 8)}</div>` : ''}</div>
        </div>
        <div class="ae-lista">${g.itens.map(a => comentarioHtml(a, { prof: tipo !== 'professor', cli: tipo !== 'cliente' })).join('')}</div>
      </div>
    </aside>`;
    const fechar = () => { f.remove(); document.removeEventListener('keydown', k); anterior?.focus?.(); };
    const k = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', k);
    f.querySelector('.ae-x').onclick = fechar;
    f.addEventListener('mousedown', (e) => { if (e.target === f) fechar(); });
    document.body.appendChild(f);
    f.querySelector('.ae-x').focus();
    marcarLidas(g.itens);
  }

  function loadAvaliacoesEquipe() {
    injetarEstilo();
    iniciarEscuta();
    const sec = document.getElementById('avaliacoes-equipe');
    if (!sec) return;
    sec.innerHTML = `<div class="ae-wrap">
      <div class="ae-kpis-slot"></div>
      <div class="ae-barra">
        <div class="ae-abas" role="tablist" aria-label="Visão">
          <button class="ae-aba" role="tab" data-v="professor"><i class="fas fa-chalkboard-user"></i> Por professor</button>
          <button class="ae-aba" role="tab" data-v="cliente"><i class="fas fa-users"></i> Por cliente</button>
          <button class="ae-aba" role="tab" data-v="comentarios"><i class="fas fa-comments"></i> Comentários</button>
        </div>
        <input type="search" class="ae-busca" placeholder="Buscar professor, cliente ou texto…" aria-label="Buscar" value="${esc(filtros.busca)}">
        <select class="ae-sel" aria-label="Filtrar por estrelas">
          <option value="">Todas as notas</option>
          <option value="5">5 estrelas</option><option value="4">4 estrelas</option><option value="3">3 estrelas</option>
          <option value="baixa">1–2 estrelas</option>
        </select>
        <label class="ae-check"><input type="checkbox" class="ae-so-novas" ${filtros.naoLidas ? 'checked' : ''}> Só não lidas</label>
        <button type="button" class="ae-btn ae-ler-todas"><i class="fas fa-check-double"></i> Marcar todas como lidas</button>
      </div>
      <div class="ae-conteudo"><div class="ae-vazio"><i class="fas fa-spinner fa-spin"></i>Carregando avaliações…</div></div>
    </div>`;
    sec.querySelector('.ae-sel').value = filtros.estrelas;
    sec.querySelectorAll('.ae-aba').forEach(b => { b.onclick = () => { visao = b.dataset.v; desenhar(); }; });
    sec.querySelector('.ae-busca').oninput = (e) => { filtros.busca = e.target.value; desenhar(); };
    sec.querySelector('.ae-sel').onchange = (e) => { filtros.estrelas = e.target.value; desenhar(); };
    sec.querySelector('.ae-so-novas').onchange = (e) => { filtros.naoLidas = e.target.checked; desenhar(); };
    sec.querySelector('.ae-ler-todas').onclick = async () => {
      if (!window.contadorAvaliacoesNaoLidas()) { aviso('Nenhuma avaliação não lida.', 'info'); return; }
      await marcarLidas(avaliacoes);
      aviso('Avaliações marcadas como lidas.', 'success');
    };
    if (!primeira) desenhar();
  }

  // Começa a escutar assim que o login do Central terminar (contador no menu).
  const espera = setInterval(() => { if (window.currentUser && window.firebase) { clearInterval(espera); injetarEstilo(); iniciarEscuta(); } }, 500);
  setTimeout(() => clearInterval(espera), 60000);

  window.loadAvaliacoesEquipe = loadAvaliacoesEquipe;
})();

// solicitacoes-clientes.js
// Pedidos de "Reagendar" e "Cancelar" enviados pelos clientes (portal do
// cliente → SistemMaster-Login/solicitacao-aula.js), coleção "solicitacoesCliente".
// Aparecem na área Notificações da Central (aba "Clientes", ligada por
// propostas-professores.js), com contador no menu e aviso quando chega um novo.
// A Central abre o pedido (marca como lido) e responde: Aprovar, Não aprovar
// ou Resolvida, com um texto que o cliente vê na área Notificações dele.
// A alteração da aula em si continua sendo feita no Banco de Aulas.
// Regras: SistemMaster-Login/firestore.rules → match /solicitacoesCliente.

(function () {
  'use strict';

  const COLECAO = 'solicitacoesCliente';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fdb = () => firebase.firestore();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 5000) : alert(msg));
  const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
  const fmtData = (ts) => { const d = ts && ts.toDate ? ts.toDate() : null; return d ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
  const dataBR = (iso) => { const [a, m, d] = String(iso || '').split('-'); return d ? `${d}/${m}/${a}` : ''; };

  const TIPOS = {
    reagendar: { rotulo: 'Reagendar', titulo: 'Reagendamento', icone: 'fas fa-calendar-days', cor: '#1d4ed8', bg: '#eff6ff' },
    cancelar:  { rotulo: 'Cancelar',  titulo: 'Cancelamento',  icone: 'fas fa-ban',           cor: '#b91c1c', bg: '#fef2f2' }
  };
  const STATUS = {
    pendente:  { rotulo: 'Aguardando resposta', cor: '#b45309', bg: '#fef3c7' },
    aceita:    { rotulo: 'Aprovada',            cor: '#047857', bg: '#d1fae5' },
    recusada:  { rotulo: 'Não aprovada',        cor: '#b91c1c', bg: '#fee2e2' },
    resolvida: { rotulo: 'Resolvida',           cor: '#1d4ed8', bg: '#dbeafe' }
  };

  let lista = [];
  let cancelar = null;
  let primeira = true;
  let filtro = 'pendentes';
  let alvoAtual = null;

  const naoLidas = () => lista.filter(s => s.lidaCentral === false).length;
  window.contadorSolicitacoesNaoLidas = naoLidas;

  function injetarEstilo() {
    if (document.getElementById('sc-estilo')) return;
    const s = document.createElement('style');
    s.id = 'sc-estilo';
    s.textContent = `
    .sc-sub{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.9rem;}
    .sc-sub button{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:.3rem .75rem;font:700 .76rem 'Comfortaa',sans-serif;cursor:pointer;color:#6b7280;}
    .sc-sub button.on{border-color:#374151;color:#111827;background:#f9fafb;}
    .sc-card{position:relative;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:1rem;cursor:pointer;text-align:left;font:inherit;display:flex;flex-direction:column;gap:.35rem;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:box-shadow .15s,transform .15s;}
    .sc-card:hover{box-shadow:0 8px 22px rgba(0,0,0,.08);transform:translateY(-2px);}
    .sc-card.nova{border-color:#fdba74;background:#fffbf5;}
    .sc-tipo{display:inline-flex;align-items:center;gap:.35rem;font:700 .72rem 'Lexend',sans-serif;border-radius:999px;padding:.2rem .6rem;align-self:flex-start;}
    .sc-st{display:inline-flex;font:700 .7rem 'Comfortaa',sans-serif;border-radius:999px;padding:.15rem .55rem;align-self:flex-start;}
    .sc-nome{font:700 1rem 'Lexend',sans-serif;color:#111827;}
    .sc-aula{font-size:.84rem;color:#374151;}
    .sc-msg{font-size:.82rem;color:#6b7280;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .sc-data{font-size:.72rem;color:#9ca3af;}
    .sc-det dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem .8rem;margin:0 0 .9rem;font-size:.86rem;}
    .sc-det dt{font-weight:700;color:#6b7280;}
    .sc-det dd{margin:0;color:#111827;}
    .sc-det textarea{width:100%;box-sizing:border-box;border:2px solid #e5e7eb;border-radius:10px;padding:.6rem .7rem;font:.9rem 'Comfortaa',sans-serif;min-height:90px;resize:vertical;}
    .sc-det textarea:focus{outline:none;border-color:#f28705;}
    .sc-det label{display:block;font:700 .82rem 'Lexend',sans-serif;margin:.9rem 0 .35rem;color:#374151;}
    .pe-btn.ok{background:#16a34a;border-color:#16a34a;color:#fff;}
    `;
    document.head.appendChild(s);
  }

  function atualizarContadores() {
    if (typeof window.atualizarContadorNotificacoesCentral === 'function') window.atualizarContadorNotificacoesCentral();
    if (typeof window.atualizarTituloNotificacoes === 'function') window.atualizarTituloNotificacoes();
  }

  function iniciarEscuta() {
    if (cancelar || !window.firebase || !window.currentUser) return;
    injetarEstilo();
    cancelar = fdb().collection(COLECAO).onSnapshot((snap) => {
      const chegaram = primeira ? [] : snap.docChanges().filter(c => c.type === 'added').map(c => c.doc.data());
      lista = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
      lista.sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm));
      atualizarContadores();
      if (chegaram.length) {
        const s = chegaram[0];
        aviso(chegaram.length === 1
          ? `📅 ${(TIPOS[s.tipo] || TIPOS.reagendar).titulo} pedido por ${s.clienteNome || 'cliente'} (${s.aulaMateria || 'aula'} · ${s.aulaData || ''})`
          : `📅 ${chegaram.length} novos pedidos de clientes`, 'success');
      }
      primeira = false;
      if (alvoAtual && document.body.contains(alvoAtual)) desenhar(alvoAtual);
    }, (err) => console.warn('[Solicitações de clientes] Escuta indisponível:', err && err.code));
  }

  function desenhar(cont) {
    injetarEstilo();
    iniciarEscuta();
    alvoAtual = cont;
    const filtradas = lista.filter(s => filtro === 'todas' ? true : filtro === 'pendentes' ? (s.status || 'pendente') === 'pendente' : (s.status || 'pendente') !== 'pendente');
    const cont2 = (f) => lista.filter(s => f === 'pendentes' ? (s.status || 'pendente') === 'pendente' : f === 'respondidas' ? (s.status || 'pendente') !== 'pendente' : true).length;
    cont.innerHTML = `
      <div class="sc-sub">
        ${[['pendentes', 'Pendentes'], ['respondidas', 'Respondidas'], ['todas', 'Todas']].map(([f, r]) => `<button type="button" data-f="${f}" class="${f === filtro ? 'on' : ''}">${r} (${cont2(f)})</button>`).join('')}
      </div>
      ${!filtradas.length ? `<p class="pe-vazio">${primeira ? 'Carregando…' : filtro === 'pendentes' ? 'Nenhum pedido de cliente aguardando resposta.' : 'Nenhum pedido por aqui.'}</p>` : `
      <div class="nt-grade">${filtradas.map(s => {
        const t = TIPOS[s.tipo] || TIPOS.reagendar;
        const st = STATUS[s.status] || STATUS.pendente;
        return `<button type="button" class="sc-card ${s.lidaCentral === false ? 'nova' : ''}" data-id="${esc(s.id)}">
          ${s.lidaCentral === false ? '<span class="nt-novo" title="Não lida"></span>' : ''}
          <span class="sc-tipo" style="background:${t.bg};color:${t.cor}"><i class="${t.icone}"></i>${t.titulo}</span>
          <span class="sc-nome">${esc(s.clienteNome || 'Cliente')}</span>
          <span class="sc-aula">${esc(s.aulaMateria || 'Aula')} · ${esc(s.aulaData || '')}${s.aulaHorario ? ` às ${esc(s.aulaHorario)}` : ''}${s.professorNome ? ` · Prof. ${esc(s.professorNome)}` : ''}</span>
          <span class="sc-msg">“${esc(s.mensagem || '')}”</span>
          <span class="sc-st" style="background:${st.bg};color:${st.cor}">${st.rotulo}</span>
          <span class="sc-data">Enviado em ${esc(fmtData(s.criadoEm))}${s.idContratacao ? ` · Contratação ${esc(s.idContratacao)}` : ''}</span>
        </button>`;
      }).join('')}</div>`}`;
    cont.querySelectorAll('.sc-sub button').forEach(b => { b.onclick = () => { filtro = b.dataset.f; desenhar(cont); }; });
    cont.querySelectorAll('.sc-card').forEach(c => { c.onclick = () => abrirDetalhe(lista.find(s => s.id === c.dataset.id)); });
  }

  function abrirDetalhe(s) {
    if (!s) return;
    if (s.lidaCentral === false) {
      fdb().collection(COLECAO).doc(s.id).update({ lidaCentral: true })
        .catch(err => console.warn('[Solicitações de clientes] Não marcou como lida:', err && err.code));
    }
    const t = TIPOS[s.tipo] || TIPOS.reagendar;
    const st = STATUS[s.status] || STATUS.pendente;
    const sugestao = [dataBR(s.novaDataSugerida), s.novoHorarioSugerido].filter(Boolean).join(' às ');
    const f = document.createElement('div');
    f.className = 'pe-fundo';
    f.innerHTML = `<div class="pe-caixa" style="max-width:560px" role="dialog" aria-modal="true" aria-label="${esc(t.titulo)} de ${esc(s.clienteNome || '')}">
      <div class="pe-topo"><h3><i class="${t.icone}"></i> ${esc(t.titulo)} · ${esc(s.clienteNome || 'Cliente')}</h3><button class="pe-x" aria-label="Fechar">&times;</button></div>
      <div class="pe-corpo sc-det">
        <dl>
          <dt>Situação</dt><dd><span class="sc-st" style="background:${st.bg};color:${st.cor}">${st.rotulo}</span></dd>
          <dt>Aula</dt><dd>${esc(s.aulaMateria || '')} · ${esc(s.aulaData || '')}${s.aulaHorario ? ` às ${esc(s.aulaHorario)}` : ''}</dd>
          ${s.professorNome ? `<dt>Professor</dt><dd>${esc(s.professorNome)}</dd>` : ''}
          ${s.estudante ? `<dt>Aluno</dt><dd>${esc(s.estudante)}</dd>` : ''}
          ${s.idContratacao ? `<dt>Contratação</dt><dd>${esc(s.idContratacao)}</dd>` : ''}
          ${sugestao ? `<dt>Sugestão</dt><dd><b>${esc(sugestao)}</b></dd>` : ''}
          <dt>Cliente</dt><dd>${esc(s.clienteNome || '')}${s.clienteEmail ? ` · ${esc(s.clienteEmail)}` : ''}</dd>
          <dt>Enviado</dt><dd>${esc(fmtData(s.criadoEm))}</dd>
        </dl>
        <p style="font-weight:700;margin:0 0 .4rem;font-size:.85rem">Mensagem do cliente</p>
        <div class="nt-texto">${esc(s.mensagem || '')}</div>
        <label for="sc-resposta">Resposta para o cliente</label>
        <textarea id="sc-resposta" maxlength="1000" placeholder="Ex.: Remarcamos para quarta, 07/10, às 15h com a mesma professora.">${esc(s.respostaCentral || '')}</textarea>
        <p style="font-size:.75rem;color:#9ca3af;margin:.4rem 0 0">O cliente vê a resposta na área Notificações. Lembre de ajustar a aula no Banco de Aulas.</p>
      </div>
      <div class="pe-rodape" style="justify-content:flex-end">
        <button class="pe-btn" data-st="resolvida"><i class="fas fa-check-double"></i>Resolvida</button>
        <button class="pe-btn perigo" data-st="recusada"><i class="fas fa-xmark"></i>Não aprovar</button>
        <button class="pe-btn ok" data-st="aceita"><i class="fas fa-check"></i>Aprovar</button>
      </div></div>`;
    const fechar = () => { f.remove(); document.removeEventListener('keydown', k); };
    const k = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', k);
    f.querySelector('.pe-x').onclick = fechar;
    f.addEventListener('mousedown', e => { if (e.target === f) fechar(); });
    f.querySelectorAll('[data-st]').forEach(b => {
      b.onclick = async () => {
        const resposta = f.querySelector('#sc-resposta').value.trim();
        if (!resposta && b.dataset.st !== 'resolvida') { aviso('Escreva uma resposta para o cliente.', 'error'); f.querySelector('#sc-resposta').focus(); return; }
        f.querySelectorAll('[data-st]').forEach(x => { x.disabled = true; });
        try {
          await fdb().collection(COLECAO).doc(s.id).update({
            status: b.dataset.st,
            respostaCentral: resposta,
            respondidoEm: firebase.firestore.FieldValue.serverTimestamp(),
            respondidoPor: (window.currentUser && window.currentUser.email) || '',
            lidaCentral: true
          });
          aviso('Resposta enviada ao cliente.', 'success');
          fechar();
        } catch (err) {
          console.error('[Solicitações de clientes] Erro ao responder:', err);
          aviso('Não foi possível salvar a resposta.', 'error');
          f.querySelectorAll('[data-st]').forEach(x => { x.disabled = false; });
        }
      };
    });
    document.body.appendChild(f);
    f.querySelector('#sc-resposta').focus();
  }

  const espera = setInterval(() => { if (window.currentUser && window.firebase) { clearInterval(espera); iniciarEscuta(); } }, 500);
  setTimeout(() => clearInterval(espera), 60000);

  window.SolicitacoesClientes = { desenhar, naoLidas };
})();

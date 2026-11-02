// logs-atendimento.js
// Área "Logs" (menu Atendimento): o que cada atendente fez no portal de
// atendimento, uma linha por registro: "data + hora — atendente — atividade".
//
// Fonte: coleção logsAtendimento, gravada pelo portal (log-atendimento.js do
// repositório atendimentomastereducacao). Cada documento:
//   { uid, email, nome, atividade, area, criadoEm (hora do servidor) }
// Regras: o atendente só CRIA registros com o próprio uid/e-mail e a hora do
// servidor; ninguém edita; só os admins leem e apagam.
//
// A consulta pega o período escolhido (padrão: últimos 7 dias) por criadoEm,
// em páginas de 300; atendente e texto filtram na tela (sem índice composto).

(function () {
  'use strict';

  const COLECAO = 'logsAtendimento';
  const PAGINA = 300;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const fdb = () => firebase.firestore();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const pad = (n) => String(n).padStart(2, '0');
  const dataDe = (r) => (r.criadoEm && r.criadoEm.toDate ? r.criadoEm.toDate() : null);
  const fmt = (d) => d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let registros = [];
  let ultimoDoc = null;
  let temMais = false;
  const filtro = { de: '', ate: '', atendente: '', texto: '' };

  let estilo = false;
  function injetarEstilo() {
    if (estilo) return;
    estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .lg-wrap{padding:1.2rem 1.4rem 2.5rem;font-family:'Comfortaa',sans-serif;color:#374151;display:flex;flex-direction:column;gap:1rem;}
    .lg-topo h2{margin:0;font:700 1.3rem 'Lexend',sans-serif;color:#111827;}
    .lg-topo p{margin:.2rem 0 0;font-size:.84rem;color:#6b7280;max-width:75ch;}
    .lg-filtros{display:flex;flex-wrap:wrap;gap:.6rem;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:.8rem;align-items:flex-end;}
    .lg-filtros label{display:flex;flex-direction:column;gap:.25rem;font:700 .74rem 'Lexend',sans-serif;color:#111827;flex:1 1 160px;}
    .lg-filtros input,.lg-filtros select{border:2px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;font:.86rem 'Comfortaa',sans-serif;min-height:40px;background:#fff;}
    .lg-filtros input:focus,.lg-filtros select:focus{outline:none;border-color:#f28705;}
    .lg-btn{border:2px solid #e5e7eb;background:#fff;border-radius:10px;padding:.5rem .9rem;font:700 .82rem 'Comfortaa',sans-serif;color:#374151;cursor:pointer;display:inline-flex;gap:.45rem;align-items:center;min-height:40px;}
    .lg-btn:hover{border-color:#fdba74;color:#d97804;}
    .lg-btn:disabled{opacity:.5;cursor:not-allowed;}
    .lg-caixa{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:.6rem 1rem;}
    .lg-resumo{font-size:.8rem;color:#6b7280;padding:.3rem 0 .6rem;}
    .lg-linhas{list-style:none;margin:0;padding:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;}
    .lg-linhas li{padding:.45rem 0;border-bottom:1px solid #f1f2f4;line-height:1.45;word-break:break-word;}
    .lg-linhas li:last-child{border-bottom:0;}
    .lg-linhas .q{color:#6b7280;white-space:nowrap;}
    .lg-linhas .n{color:#d97804;font-weight:700;}
    .lg-vazio{text-align:center;color:#6b7280;padding:2rem 1rem;font-size:.9rem;font-family:'Comfortaa',sans-serif;}
    .lg-mais{display:flex;justify-content:center;padding:.8rem 0 .2rem;}
    @media (max-width:900px){ .lg-wrap{padding:1rem;} }`;
    document.head.appendChild(s);
  }

  function consultaBase() {
    let q = fdb().collection(COLECAO);
    if (filtro.de) q = q.where('criadoEm', '>=', firebase.firestore.Timestamp.fromDate(new Date(filtro.de + 'T00:00:00')));
    if (filtro.ate) q = q.where('criadoEm', '<=', firebase.firestore.Timestamp.fromDate(new Date(filtro.ate + 'T23:59:59.999')));
    return q.orderBy('criadoEm', 'desc');
  }

  async function buscar(continuar) {
    let q = consultaBase();
    if (continuar && ultimoDoc) q = q.startAfter(ultimoDoc);
    const snap = await q.limit(PAGINA).get();
    const novos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    registros = continuar ? registros.concat(novos) : novos;
    ultimoDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : ultimoDoc;
    temMais = snap.docs.length === PAGINA;
    desenhar();
  }

  function filtrados() {
    const t = norm(filtro.texto);
    return registros.filter(r => {
      if (filtro.atendente && r.email !== filtro.atendente) return false;
      if (t && !norm(`${r.nome} ${r.email} ${r.atividade}`).includes(t)) return false;
      return true;
    });
  }

  function opcoesAtendentes(atendentes) {
    const sel = document.querySelector('#logs-atendimento select[name=atendente]');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todos</option>' + atendentes
      .map(a => `<option value="${esc(a.email)}">${esc(a.nome || a.email)}</option>`).join('');
    sel.value = filtro.atendente;
  }

  function desenhar() {
    const alvo = document.querySelector('#logs-atendimento .lg-caixa');
    if (!alvo) return;
    const lista = filtrados();
    if (!lista.length) {
      alvo.innerHTML = '<div class="lg-vazio">Nenhum registro neste período.</div>';
      return;
    }
    alvo.innerHTML = `<div class="lg-resumo">${lista.length} registro(s)${temMais ? ' — há registros mais antigos neste período' : ''}</div>
      <ul class="lg-linhas">${lista.map(r => `<li><span class="q">${fmt(dataDe(r))}</span> — <span class="n">${esc(r.nome || r.email)}</span> — ${esc(r.atividade)}</li>`).join('')}</ul>
      ${temMais ? '<div class="lg-mais"><button type="button" class="lg-btn" data-mais><i class="fas fa-angles-down"></i> Carregar mais antigos</button></div>' : ''}`;
  }

  function exportarTxt() {
    const lista = filtrados();
    if (!lista.length) return aviso('Nada para exportar.', 'warning');
    const txt = lista.map(r => `${fmt(dataDe(r))} — ${r.nome || r.email} — ${r.atividade}`).join('\n');
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-atendimento-${filtro.de || 'inicio'}-a-${filtro.ate || 'hoje'}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function abrir() {
    injetarEstilo();
    const sec = document.getElementById('logs-atendimento');
    if (!sec) return;
    const hoje = new Date();
    const semana = new Date(hoje.getTime() - 6 * 86400000);
    filtro.de = isoDia(semana);
    filtro.ate = isoDia(hoje);
    filtro.atendente = '';
    filtro.texto = '';

    sec.innerHTML = `<div class="lg-wrap">
      <div class="lg-topo">
        <h2>Logs do atendimento</h2>
        <p>Tudo o que os atendentes fazem no portal de atendimento: entradas e saídas, áreas abertas e cada gravação (criar, editar, excluir, aprovar, enviar).</p>
      </div>
      <div class="lg-filtros">
        <label>De<input type="date" name="de" value="${filtro.de}"></label>
        <label>Até<input type="date" name="ate" value="${filtro.ate}"></label>
        <label>Atendente<select name="atendente"><option value="">Todos</option></select></label>
        <label>Buscar no texto<input type="search" name="texto" placeholder="Ex.: simulação, 0158, Fulana"></label>
        <button type="button" class="lg-btn" data-atualizar><i class="fas fa-rotate"></i> Atualizar</button>
        <button type="button" class="lg-btn" data-exportar><i class="fas fa-file-arrow-down"></i> Exportar .txt</button>
      </div>
      <div class="lg-caixa"><div class="lg-vazio">Carregando…</div></div>
    </div>`;

    const recarregar = () => {
      ultimoDoc = null;
      buscar(false).catch(erro);
    };
    const erro = (err) => {
      console.error('[Logs] Erro ao carregar:', err);
      const alvo = sec.querySelector('.lg-caixa');
      if (alvo) alvo.innerHTML = `<div class="lg-vazio">Não foi possível carregar os logs (${esc(err.code || err.message)}).</div>`;
    };

    sec.querySelector('[name=de]').addEventListener('change', (e) => { filtro.de = e.target.value; recarregar(); });
    sec.querySelector('[name=ate]').addEventListener('change', (e) => { filtro.ate = e.target.value; recarregar(); });
    sec.querySelector('[name=atendente]').addEventListener('change', (e) => { filtro.atendente = e.target.value; desenhar(); });
    sec.querySelector('[name=texto]').addEventListener('input', (e) => { filtro.texto = e.target.value; desenhar(); });
    sec.querySelector('[data-atualizar]').addEventListener('click', recarregar);
    sec.querySelector('[data-exportar]').addEventListener('click', exportarTxt);
    sec.querySelector('.lg-caixa').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mais]');
      if (!b) return;
      b.disabled = true;
      buscar(true).catch(erro);
    });

    fdb().collection('atendentes').get()
      .then(snap => opcoesAtendentes(snap.docs.map(d => ({ email: d.id, ...d.data() }))
        .sort((x, y) => String(x.nome || x.email).localeCompare(String(y.nome || y.email), 'pt-BR'))))
      .catch(() => { /* lista de atendentes é só para o filtro */ });
    recarregar();
  }

  window.LogsAtendimento = { abrir };
})();

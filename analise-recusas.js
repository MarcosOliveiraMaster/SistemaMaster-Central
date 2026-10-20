// analise-recusas.js
// Área "Análise de recusas de aulas" (menu Pessoas): aceites, contrapropostas e
// recusas dos professores às propostas de aulas.
//
// Fonte: coleção respostasPropostas — um documento por proposta respondida
// (id = id da proposta), gravado pelo portal do professor no momento da
// resposta (SistemMaster-Login/propostas-professor.js). Fica guardado mesmo
// depois que a proposta é apagada em Notificações.
// Campos: professorNome, professorEmail, clienteNome, codigo, origem,
//         resposta ('aceita' | 'contraproposta' | 'recusada'), motivo, texto,
//         aulasQtd, aulasAlteradas, valorTotal, data.
// "Importar respostas antigas" copia as respostas que já estavam em
// propostasProfessores antes desta área existir (não sobrescreve nada).

(function () {
  'use strict';

  const COLECAO = 'respostasPropostas';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const fdb = () => firebase.firestore();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const pad = (n) => String(n).padStart(2, '0');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const RESP = {
    aceita: { rot: 'Aceitou', cor: 'g' },
    contraproposta: { rot: 'Contraproposta', cor: 'y' },
    recusada: { rot: 'Recusou', cor: 'r' }
  };
  const dataDe = (r) => (r.data && r.data.toDate ? r.data.toDate() : null);
  const fmt = (d) => d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';

  let respostas = [];
  let cancelar = null;
  const filtro = { mes: '', professor: '', cliente: '', resposta: '' };

  let estilo = false;
  function injetarEstilo() {
    if (estilo) return;
    estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .ar-wrap{padding:1.2rem 1.4rem 2.5rem;font-family:'Comfortaa',sans-serif;color:#374151;display:flex;flex-direction:column;gap:1.2rem;}
    .ar-topo{display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-end;justify-content:space-between;}
    .ar-topo h2{margin:0;font:700 1.3rem 'Lexend',sans-serif;color:#111827;}
    .ar-topo p{margin:.2rem 0 0;font-size:.84rem;color:#6b7280;max-width:70ch;}
    .ar-btn{border:2px solid #e5e7eb;background:#fff;border-radius:10px;padding:.5rem .9rem;font:700 .82rem 'Comfortaa',sans-serif;color:#374151;cursor:pointer;display:inline-flex;gap:.45rem;align-items:center;}
    .ar-btn:hover{border-color:#fdba74;color:#d97804;}
    .ar-btn:disabled{opacity:.5;cursor:not-allowed;}
    .ar-filtros{display:flex;flex-wrap:wrap;gap:.6rem;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:.8rem;}
    .ar-filtros label{display:flex;flex-direction:column;gap:.25rem;font:700 .74rem 'Lexend',sans-serif;color:#111827;flex:1 1 170px;}
    .ar-filtros input,.ar-filtros select{border:2px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;font:.86rem 'Comfortaa',sans-serif;min-height:40px;background:#fff;}
    .ar-filtros input:focus,.ar-filtros select:focus{outline:none;border-color:#f28705;}
    .ar-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.8rem;}
    .ar-kpi{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.2rem;}
    .ar-kpi span{font:700 .68rem 'Comfortaa',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;}
    .ar-kpi strong{font:700 1.6rem 'Lexend',sans-serif;color:#111827;font-variant-numeric:tabular-nums;}
    .ar-kpi.g strong{color:#15803d;} .ar-kpi.y strong{color:#a16207;} .ar-kpi.r strong{color:#b91c1c;}
    .ar-kpi small{font-size:.74rem;color:#6b7280;}
    .ar-duas{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:1rem;align-items:start;}
    .ar-caixa{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1rem;min-width:0;}
    .ar-caixa h3{margin:0 0 .8rem;font:700 .95rem 'Lexend',sans-serif;color:#111827;display:flex;gap:.5rem;align-items:center;}
    .ar-caixa h3 i{color:#f28705;}
    .ar-barra{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.2rem .6rem;margin-bottom:.6rem;font-size:.82rem;}
    .ar-barra b{color:#111827;font-variant-numeric:tabular-nums;}
    .ar-barra .trilho{grid-column:1/-1;height:10px;background:#f3f4f6;border-radius:999px;overflow:hidden;}
    .ar-barra .trilho i{display:block;height:100%;background:#dc2626;border-radius:999px;}
    .ar-tabela{overflow-x:auto;}
    .ar-tabela table{width:100%;border-collapse:collapse;font-size:.82rem;min-width:560px;}
    .ar-tabela th{text-align:left;font:700 .7rem 'Comfortaa',sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;padding:.5rem .6rem;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
    .ar-tabela td{padding:.55rem .6rem;border-bottom:1px solid #f1f2f4;vertical-align:top;}
    .ar-tabela td.n{text-align:right;font-variant-numeric:tabular-nums;}
    .ar-tabela th.n{text-align:right;}
    .ar-pill{display:inline-block;font:700 .7rem 'Comfortaa',sans-serif;border-radius:999px;padding:.15rem .55rem;border:1px solid;white-space:nowrap;}
    .ar-pill.g{background:#f0fdf4;color:#15803d;border-color:#bbf7d0;} .ar-pill.y{background:#fffbeb;color:#a16207;border-color:#fde68a;} .ar-pill.r{background:#fef2f2;color:#b91c1c;border-color:#fecaca;}
    .ar-taxa{font-weight:700;} .ar-taxa.alta{color:#b91c1c;}
    .ar-vazio{text-align:center;color:#6b7280;padding:2rem 1rem;font-size:.9rem;}
    .ar-obs{color:#6b7280;font-size:.78rem;margin-top:.15rem;}
    @media (max-width:900px){ .ar-duas{grid-template-columns:1fr;} .ar-wrap{padding:1rem;} }`;
    document.head.appendChild(s);
  }

  function filtradas() {
    return respostas.filter(r => {
      const d = dataDe(r);
      if (filtro.mes && (!d || `${d.getFullYear()}-${pad(d.getMonth() + 1)}` !== filtro.mes)) return false;
      if (filtro.resposta && r.resposta !== filtro.resposta) return false;
      if (filtro.professor && !norm(r.professorNome).includes(norm(filtro.professor))) return false;
      if (filtro.cliente && !norm(r.clienteNome).includes(norm(filtro.cliente))) return false;
      return true;
    });
  }

  function desenhar() {
    const sec = document.getElementById('analise-recusas');
    const alvo = sec && sec.querySelector('.ar-conteudo');
    if (!alvo) return;
    const lista = filtradas().sort((a, b) => (dataDe(b) || 0) - (dataDe(a) || 0));
    const conta = (t) => lista.filter(r => r.resposta === t).length;
    const total = lista.length, nA = conta('aceita'), nC = conta('contraproposta'), nR = conta('recusada');
    const pct = (n) => total ? Math.round(n / total * 100) : 0;

    // Motivos de recusa
    const motivos = new Map();
    lista.filter(r => r.resposta === 'recusada').forEach(r => { const m = r.motivo || 'Não informado'; motivos.set(m, (motivos.get(m) || 0) + 1); });
    const motivosOrd = [...motivos.entries()].sort((a, b) => b[1] - a[1]);
    const maxMotivo = motivosOrd.length ? motivosOrd[0][1] : 1;

    // Por professor
    const porProf = new Map();
    lista.forEach(r => {
      const k = r.professorEmail || r.professorNome || '—';
      if (!porProf.has(k)) porProf.set(k, { nome: r.professorNome || r.professorEmail || '—', a: 0, c: 0, r: 0, ultimo: '' });
      const p = porProf.get(k);
      if (r.resposta === 'aceita') p.a++; else if (r.resposta === 'contraproposta') p.c++; else if (r.resposta === 'recusada') { p.r++; if (!p.ultimo) p.ultimo = r.motivo || ''; }
    });
    const profs = [...porProf.values()].map(p => ({ ...p, t: p.a + p.c + p.r })).sort((x, y) => (y.r / y.t) - (x.r / x.t) || y.t - x.t);

    alvo.innerHTML = !respostas.length
      ? '<div class="ar-caixa ar-vazio">Nenhuma resposta registrada ainda. As próximas respostas dos professores aparecem aqui. Use "Importar respostas antigas" para trazer as que já existem nas propostas.</div>'
      : `<div class="ar-kpis">
          <div class="ar-kpi"><span>Respostas</span><strong>${total}</strong><small>no filtro atual</small></div>
          <div class="ar-kpi g"><span>Aceites</span><strong>${nA}</strong><small>${pct(nA)}% das respostas</small></div>
          <div class="ar-kpi y"><span>Contrapropostas</span><strong>${nC}</strong><small>${pct(nC)}% das respostas</small></div>
          <div class="ar-kpi r"><span>Recusas</span><strong>${nR}</strong><small>taxa de recusa ${pct(nR)}%</small></div>
        </div>
        <div class="ar-duas">
          <div class="ar-caixa"><h3><i class="fas fa-chart-bar"></i> Motivos de recusa</h3>
            ${motivosOrd.length ? motivosOrd.map(([m, n]) => `<div class="ar-barra"><span>${esc(m)}</span><b>${n}</b><span class="trilho"><i style="width:${Math.max(4, n / maxMotivo * 100)}%"></i></span></div>`).join('')
              : '<p class="ar-vazio" style="padding:1rem">Nenhuma recusa no filtro atual.</p>'}</div>
          <div class="ar-caixa"><h3><i class="fas fa-chalkboard-user"></i> Por professor</h3>
            <div class="ar-tabela"><table><thead><tr><th>Professor</th><th class="n">Respostas</th><th class="n">Aceites</th><th class="n">Contrap.</th><th class="n">Recusas</th><th class="n">% recusa</th><th>Último motivo</th></tr></thead>
            <tbody>${profs.map(p => { const tx = p.t ? Math.round(p.r / p.t * 100) : 0;
              return `<tr><td>${esc(p.nome)}</td><td class="n">${p.t}</td><td class="n">${p.a}</td><td class="n">${p.c}</td><td class="n">${p.r}</td><td class="n"><span class="ar-taxa${tx >= 50 ? ' alta' : ''}">${tx}%</span></td><td>${esc(p.ultimo || '—')}</td></tr>`; }).join('')}</tbody></table></div></div>
        </div>
        <div class="ar-caixa"><h3><i class="fas fa-list"></i> Histórico de respostas (${total})</h3>
          ${total ? `<div class="ar-tabela"><table><thead><tr><th>Data</th><th>Professor</th><th>Cliente</th><th>Contratação</th><th>Resposta</th><th>Razão da recusa / observação</th></tr></thead>
          <tbody>${lista.map(r => { const st = RESP[r.resposta] || { rot: r.resposta || '—', cor: 'y' };
            return `<tr><td>${fmt(dataDe(r))}</td><td>${esc(r.professorNome || r.professorEmail || '—')}</td><td>${esc(r.clienteNome || '—')}</td>
              <td>${r.origem === 'simulacao' ? 'Simulação' : 'Contratação'} ${esc(r.codigo || '')}</td>
              <td><span class="ar-pill ${st.cor}">${esc(st.rot)}</span></td>
              <td>${r.resposta === 'recusada' ? esc(r.motivo || 'Não informado') : (r.resposta === 'contraproposta' ? `${r.aulasAlteradas || 0} aula(s) com nova data/horário` : '—')}
                ${r.texto ? `<div class="ar-obs">${esc(r.texto)}</div>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
            : '<p class="ar-vazio">Nenhuma resposta para este filtro.</p>'}</div>`;
  }

  function opcoesMes() {
    const meses = [...new Set(respostas.map(dataDe).filter(Boolean).map(d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`))].sort().reverse();
    return '<option value="">Todos os meses</option>' + meses.map(m => {
      const [y, mm] = m.split('-').map(Number);
      return `<option value="${m}" ${filtro.mes === m ? 'selected' : ''}>${MESES[mm - 1].replace(/^./, c => c.toUpperCase())} ${y}</option>`;
    }).join('');
  }

  function escutar() {
    if (cancelar) return;
    cancelar = fdb().collection(COLECAO).onSnapshot((snap) => {
      respostas = [];
      snap.forEach(d => respostas.push({ id: d.id, ...d.data() }));
      const sel = document.getElementById('ar-mes');
      if (sel) sel.innerHTML = opcoesMes();
      desenhar();
    }, (err) => {
      console.warn('[Análise de recusas] Leitura indisponível:', err && err.code);
      const alvo = document.querySelector('#analise-recusas .ar-conteudo');
      if (alvo) alvo.innerHTML = '<div class="ar-caixa ar-vazio">Não foi possível carregar as respostas.</div>';
    });
  }

  // Copia para respostasPropostas as respostas já registradas nas propostas
  // (antes desta área existir). Documentos que já existem não são tocados.
  async function importarAntigas(btn) {
    btn.disabled = true;
    try {
      const snap = await fdb().collection('propostasProfessores').get();
      const existentes = new Set(respostas.map(r => r.id));
      const novos = [];
      snap.forEach(d => {
        const p = d.data();
        if (existentes.has(d.id) || !p.respondidoEm || !['aceita', 'recusada', 'contraproposta', 'aprovado'].includes(p.status)) return;
        const alts = Array.isArray(p.alteracoes) ? p.alteracoes : [];
        const resposta = p.status === 'aprovado' ? (alts.length || p.contraproposta ? 'contraproposta' : 'aceita') : p.status;
        novos.push({ id: d.id, dados: {
          propostaId: d.id, professorEmail: p.professorEmail || '', professorNome: p.professorNome || '',
          clienteNome: p.clienteNome || '', codigo: String(p.codigo || ''), origem: p.origem || '',
          resposta, motivo: resposta === 'recusada' ? (p.motivoRecusa || '') : '',
          texto: String((resposta === 'recusada' ? p.textoRecusa : p.contraproposta) || '').slice(0, 500),
          aulasQtd: (p.aulas || []).length, aulasAlteradas: alts.length, valorTotal: Number(p.valorTotal) || 0,
          data: p.respondidoEm, importado: true
        } });
      });
      for (let i = 0; i < novos.length; i += 400) {
        const lote = fdb().batch();
        novos.slice(i, i + 400).forEach(n => lote.set(fdb().collection(COLECAO).doc(n.id), n.dados));
        await lote.commit();
      }
      aviso(novos.length ? `${novos.length} resposta(s) importada(s).` : 'Não há respostas antigas para importar.', 'success');
    } catch (err) {
      console.error('[Análise de recusas] Erro ao importar:', err);
      aviso('Não foi possível importar as respostas antigas.', 'error');
    }
    btn.disabled = false;
  }

  function loadAnaliseRecusas() {
    injetarEstilo();
    const sec = document.getElementById('analise-recusas');
    if (!sec || !window.firebase) return;
    sec.innerHTML = `<div class="ar-wrap">
      <div class="ar-topo">
        <div><h2>Análise de recusas de aulas</h2>
          <p>Aceites, contrapropostas e recusas dos professores às propostas de aulas, com a razão de cada recusa. O histórico continua aqui mesmo depois que a proposta é apagada.</p></div>
        <button type="button" class="ar-btn" id="ar-importar"><i class="fas fa-file-import"></i> Importar respostas antigas</button>
      </div>
      <div class="ar-filtros">
        <label>Mês<select id="ar-mes">${opcoesMes()}</select></label>
        <label>Resposta<select id="ar-resp"><option value="">Todas</option><option value="aceita">Aceitou</option><option value="contraproposta">Contraproposta</option><option value="recusada">Recusou</option></select></label>
        <label>Professor<input type="search" id="ar-prof" placeholder="Nome do professor"></label>
        <label>Cliente<input type="search" id="ar-cli" placeholder="Nome do cliente"></label>
      </div>
      <div class="ar-conteudo"><div class="ar-caixa ar-vazio">Carregando…</div></div>
    </div>`;
    sec.querySelector('#ar-resp').value = filtro.resposta;
    sec.querySelector('#ar-prof').value = filtro.professor;
    sec.querySelector('#ar-cli').value = filtro.cliente;
    sec.querySelector('#ar-mes').onchange = (e) => { filtro.mes = e.target.value; desenhar(); };
    sec.querySelector('#ar-resp').onchange = (e) => { filtro.resposta = e.target.value; desenhar(); };
    sec.querySelector('#ar-prof').oninput = (e) => { filtro.professor = e.target.value.trim(); desenhar(); };
    sec.querySelector('#ar-cli').oninput = (e) => { filtro.cliente = e.target.value.trim(); desenhar(); };
    sec.querySelector('#ar-importar').onclick = (e) => importarAntigas(e.currentTarget);
    escutar();
    desenhar();
  }

  window.loadAnaliseRecusas = loadAnaliseRecusas;
})();

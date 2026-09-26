// propostas-professores.js
// Propostas de aulas para professores (coleção propostasProfessores).
//
// 1) Envio — botão "Enviar proposta para professores" nos modais de Simulação e
//    de Detalhes da contratação:
//      passo 1: caixas de seleção das aulas (versão SALVA da simulação/contratação);
//      passo 2 (com animação): grade de professores com filtro por nome e
//      disciplina — só quem tem acesso à plataforma, professores de ouro primeiro.
//    Cada professor escolhido recebe um documento com as aulas marcadas e o total
//    que ELE recebe (hora/aula do professor × duração). Sem CPF, pacote ou lucro.
// 2) Área "Notificações" — cards com as respostas (aceitou / recusou /
//    contraproposta). Aceita: borda verde e etiqueta "Aula fechada". Clique abre
//    os detalhes (e o texto da contraproposta). Botão direito (ou segurar o dedo)
//    → Excluir: some também para o professor.
// O professor responde pelo portal (SistemMaster-Login/propostas-professor.js).
// Regras: SistemMaster-Login/firestore.rules → match /propostasProfessores.

(function () {
  'use strict';

  const COLECAO = 'propostasProfessores';
  const HORA_PADRAO = 35;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fdb = () => firebase.firestore();
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const dataDe = (ts) => (ts && ts.toDate ? ts.toDate() : null);
  const fmtData = (ts) => { const d = dataDe(ts); return d ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };

  function horasDe(duracao) {
    const m = String(duracao || '').match(/(\d+)\s*h\s*(\d+)?/i);
    return m ? (parseInt(m[1], 10) || 0) + (parseInt(m[2] || '0', 10) || 0) / 60 : 0;
  }

  // ── Estilos ──────────────────────────────────────────────────────────────
  let estilo = false;
  function injetarEstilo() {
    if (estilo) return;
    estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .pe-fundo{position:fixed;inset:0;z-index:10050;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;padding:1rem;}
    .pe-caixa{background:#fff;border-radius:18px;width:100%;max-width:1040px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:'Comfortaa',sans-serif;}
    .pe-topo{background:#f28705;color:#fff;padding:.9rem 1.2rem;display:flex;align-items:center;gap:.7rem;}
    .pe-topo h3{font-family:'Lexend',sans-serif;font-size:1.05rem;margin:0;flex:1;min-width:0;}
    .pe-passos{display:flex;gap:.35rem;font-size:.72rem;font-weight:700;}
    .pe-passos span{background:rgba(255,255,255,.25);border-radius:999px;padding:.2rem .6rem;}
    .pe-passos span.on{background:#fff;color:#d97804;}
    .pe-x{background:rgba(255,255,255,.2);border:0;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1.1rem;}
    .pe-trilho{flex:1;min-height:0;overflow:hidden;position:relative;}
    .pe-palco{display:flex;width:200%;height:100%;transition:transform .45s cubic-bezier(.4,0,.2,1);}
    .pe-palco.passo2{transform:translateX(-50%);}
    .pe-pag{width:50%;display:flex;flex-direction:column;min-height:0;max-height:calc(92vh - 60px);}
    .pe-corpo{padding:1rem 1.2rem;overflow-y:auto;flex:1;}
    .pe-rodape{border-top:1px solid #e5e7eb;padding:.8rem 1.2rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;}
    .pe-rodape .pe-info{flex:1;font-size:.85rem;color:#374151;}
    .pe-rodape .pe-info b{color:#15803d;font-family:'Lexend',sans-serif;}
    .pe-btn{border-radius:10px;padding:.6rem 1.1rem;font:700 .88rem 'Comfortaa',sans-serif;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#374151;display:inline-flex;gap:.45rem;align-items:center;}
    .pe-btn.pri{background:#f28705;border-color:#f28705;color:#fff;}
    .pe-btn.perigo{background:#dc2626;border-color:#dc2626;color:#fff;}
    .pe-btn:disabled{opacity:.5;cursor:not-allowed;}
    .pe-aula{display:flex;gap:.75rem;align-items:center;border:1.5px solid #e5e7eb;border-radius:12px;padding:.6rem .8rem;margin-bottom:.5rem;cursor:pointer;}
    .pe-aula:has(input:checked){border-color:#f28705;background:#fff7eb;}
    .pe-aula input{width:18px;height:18px;accent-color:#f28705;flex-shrink:0;}
    .pe-aula .pe-a1{flex:1;min-width:0;font-size:.85rem;color:#374151;line-height:1.45;}
    .pe-aula .pe-a1 b{color:#111827;}
    .pe-aula .pe-a2{font-family:'Lexend',sans-serif;font-weight:700;color:#15803d;white-space:nowrap;}
    .pe-todas{display:flex;gap:.5rem;align-items:center;font-size:.85rem;font-weight:700;margin-bottom:.7rem;cursor:pointer;}
    .pe-todas input{width:18px;height:18px;accent-color:#f28705;}
    .pe-filtros{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.9rem;}
    .pe-filtros input,.pe-filtros select{border:2px solid #e5e7eb;border-radius:10px;padding:.55rem .7rem;font:.9rem 'Comfortaa',sans-serif;min-height:42px;}
    .pe-filtros input{flex:1 1 220px;} .pe-filtros select{flex:0 1 220px;}
    .pe-grade{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;}
    .pe-prof{position:relative;border:2px solid #e5e7eb;border-radius:14px;padding:.8rem .6rem;text-align:center;cursor:pointer;background:#fff;font:inherit;transition:border-color .15s,box-shadow .15s,transform .15s;}
    .pe-prof:hover{border-color:#fcd9a8;transform:translateY(-2px);}
    .pe-prof[aria-pressed="true"]{border-color:#f28705;background:#fff7eb;box-shadow:0 6px 18px rgba(242,135,5,.2);}
    .pe-prof .pe-foto{width:84px;height:84px;border-radius:50%;object-fit:cover;margin:0 auto .5rem;display:block;background:#f3f4f6;}
    .pe-prof .pe-iniciais{width:84px;height:84px;border-radius:50%;margin:0 auto .5rem;display:flex;align-items:center;justify-content:center;background:#fff7eb;color:#d97804;font:700 1.6rem 'Lexend',sans-serif;}
    .pe-prof b{display:block;font-family:'Lexend',sans-serif;font-size:.92rem;color:#111827;}
    .pe-prof small{display:block;font-size:.75rem;color:#6b7280;line-height:1.35;margin-top:.15rem;}
    .pe-prof .pe-ouro{position:absolute;top:8px;left:8px;color:#eab308;font-size:.9rem;}
    .pe-prof .pe-marca{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:#f28705;color:#fff;display:none;align-items:center;justify-content:center;font-size:.75rem;}
    .pe-prof[aria-pressed="true"] .pe-marca{display:flex;}
    .pe-vazio{text-align:center;color:#6b7280;padding:2rem;font-size:.9rem;}
    @media (max-width:900px){ .pe-grade{grid-template-columns:repeat(3,minmax(0,1fr));} }
    @media (max-width:640px){
      .pe-fundo{padding:0;align-items:flex-end;} .pe-caixa{border-radius:18px 18px 0 0;max-height:94vh;}
      .pe-grade{grid-template-columns:repeat(2,minmax(0,1fr));} .pe-passos{display:none;}
      .pe-rodape{padding-bottom:calc(.8rem + env(safe-area-inset-bottom));}
      .pe-rodape .pe-info{flex-basis:100%;order:-1;font-size:.8rem;}
      .pe-rodape .pe-btn{flex:1;justify-content:center;}
      .pe-prof .pe-foto,.pe-prof .pe-iniciais{width:60px;height:60px;font-size:1.2rem;}
      .pe-topo h3{font-size:.95rem;}
    }
    /* Notificações */
    .nt-wrap{padding:1rem 1.2rem 2rem;}
    .nt-barra{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;}
    .nt-chip{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:.35rem .85rem;font:700 .82rem 'Comfortaa',sans-serif;cursor:pointer;color:#374151;}
    .nt-chip.on{background:#fff7eb;border-color:#f28705;color:#d97804;}
    .nt-dica{margin-left:auto;font-size:.75rem;color:#9ca3af;}
    .nt-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem;}
    .nt-card{position:relative;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:1rem;cursor:pointer;text-align:left;font:inherit;display:flex;flex-direction:column;gap:.35rem;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:box-shadow .15s,transform .15s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}
    .nt-card:hover{box-shadow:0 8px 22px rgba(0,0,0,.08);transform:translateY(-2px);}
    .nt-card.aceita{border-color:#16a34a;}
    .nt-card.recusada{border-color:#fca5a5;}
    .nt-card.contraproposta{border-color:#fdba74;}
    .nt-card.pendente{border-style:dashed;opacity:.85;}
    .nt-tag{position:absolute;top:-11px;left:12px;background:#16a34a;color:#fff;font:700 .7rem 'Lexend',sans-serif;padding:.2rem .6rem;border-radius:999px;letter-spacing:.02em;}
    .nt-novo{position:absolute;top:12px;right:12px;width:10px;height:10px;border-radius:50%;background:#ef4444;}
    .nt-num{font:700 .78rem 'Lexend',sans-serif;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;}
    .nt-apelido{font:700 1.05rem 'Lexend',sans-serif;color:#111827;}
    .nt-nome{font-size:.85rem;color:#6b7280;}
    .nt-status{font-size:.88rem;font-weight:700;margin-top:.3rem;display:flex;gap:.4rem;align-items:center;}
    .nt-status.aceita{color:#15803d;} .nt-status.recusada{color:#dc2626;} .nt-status.contraproposta{color:#d97804;} .nt-status.pendente{color:#6b7280;}
    .nt-data{font-size:.75rem;color:#9ca3af;}
    .nt-menu{position:fixed;z-index:10060;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:.3rem;min-width:160px;}
    .nt-menu button{display:flex;gap:.5rem;align-items:center;width:100%;background:none;border:0;padding:.6rem .8rem;border-radius:8px;cursor:pointer;font:700 .88rem 'Comfortaa',sans-serif;color:#dc2626;}
    .nt-menu button:hover{background:#fef2f2;}
    .nt-texto{background:#fff7eb;border-left:4px solid #f28705;border-radius:8px;padding:.8rem 1rem;white-space:pre-wrap;font-size:.92rem;color:#111827;line-height:1.55;}
    .nt-aulas{list-style:none;padding:0;margin:.6rem 0 0;display:flex;flex-direction:column;gap:.35rem;font-size:.85rem;color:#374151;}
    .nt-aulas li{background:#f9fafb;border-radius:8px;padding:.45rem .6rem;}
    #contador-notificacoes{margin-left:auto;background:#fff;color:#d97804;border-radius:999px;font:700 .7rem 'Lexend',sans-serif;padding:.05rem .45rem;min-width:1.2rem;text-align:center;}
    #menu-lateral.collapsed #contador-notificacoes{position:absolute;top:4px;right:8px;margin:0;}
    `;
    document.head.appendChild(s);
  }

  // ── Dados ────────────────────────────────────────────────────────────────
  let professoresCache = null;
  async function carregarProfessores() {
    if (professoresCache) return professoresCache;
    const snap = await fdb().collection('dataBaseProfessores').get();
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    professoresCache = lista;
    return lista;
  }
  const disciplinasDe = (p) => (Array.isArray(p.disciplinas) ? p.disciplinas : String(p.disciplinas || '').split(/[,;/]/))
    .map(s => String(s).trim()).filter(Boolean);
  const fotoDe = (p) => p.fotoUpload || (p.fotoPerfil && p.fotoPerfil !== 'icone-padrao' ? `img-professor/${p.fotoPerfil}` : '');
  const ehOuro = (p) => p.prof_ouro === true || p.prof_ouro === 'true';
  const iniciais = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();

  async function carregarOrigem(origem, id) {
    const col = origem === 'simulacao' ? 'simulacoes' : 'BancoDeAulas';
    const snap = await fdb().collection(col).doc(String(id)).get();
    if (!snap.exists) return null;
    const d = snap.data();
    const hora = Number(origem === 'simulacao' ? d.valorHoraProfessor : d.horaAulaProfessor) || HORA_PADRAO;
    const aulas = (d.aulas || []).map((a, i) => {
      const valorSalvo = Number(a.ValorAula);
      return {
        i, data: a.data || '', horario: a.horario || '', duracao: a.duracao || '', materia: a.materia || '',
        estudante: a.estudante || '', professor: a.professor || '', status: a.StatusAula || '',
        valor: Number((valorSalvo > 0 ? valorSalvo : hora * horasDe(a.duracao)).toFixed(2))
      };
    });
    let apelido = '';
    try {
      if (d.cpf) {
        const c = await fdb().collection('cadastroClientes').where('cpf', '==', d.cpf).limit(1).get();
        if (!c.empty) apelido = c.docs[0].data().apelido || '';
      }
    } catch (_) { /* apelido é opcional */ }
    return {
      origem, id: String(id),
      codigo: origem === 'simulacao' ? (d.idSimulacao || id) : (d.codigoContratacao || id),
      clienteNome: d.nomeCliente || d.nome || '', clienteApelido: apelido, aulas
    };
  }

  // ── Envio (2 passos) ─────────────────────────────────────────────────────
  async function abrirEnvio({ origem, id }) {
    injetarEstilo();
    if (!id) { aviso('Salve antes de enviar a proposta para professores.', 'warning'); return; }
    let dados, profs;
    try {
      [dados, profs] = await Promise.all([carregarOrigem(origem, id), carregarProfessores()]);
    } catch (err) {
      console.error('[Propostas] Erro ao carregar:', err);
      aviso('Não foi possível carregar os dados para a proposta.', 'error');
      return;
    }
    if (!dados) { aviso(origem === 'simulacao' ? 'Salve a simulação antes de enviar a proposta.' : 'Contratação não encontrada.', 'warning'); return; }
    if (!dados.aulas.length) { aviso('Não há aulas para enviar.', 'warning'); return; }

    // Só professores com acesso à plataforma (e e-mail) — os outros não veriam a proposta.
    const elegiveis = profs.filter(p => p.acessoPlataforma === true && p.email)
      .sort((a, b) => (ehOuro(a) === ehOuro(b)) ? String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR') : (ehOuro(a) ? -1 : 1));
    const disciplinas = [...new Set(elegiveis.flatMap(disciplinasDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const escolhidos = new Set();
    const titulo = origem === 'simulacao' ? `Simulação ${dados.codigo}` : `Contratação ${dados.codigo}`;

    const fundo = document.createElement('div');
    fundo.className = 'pe-fundo';
    fundo.innerHTML = `
      <div class="pe-caixa" role="dialog" aria-modal="true" aria-label="Enviar proposta para professores">
        <div class="pe-topo">
          <h3><i class="fas fa-paper-plane mr-2"></i>Enviar proposta · ${esc(titulo)} · ${esc(dados.clienteNome)}</h3>
          <div class="pe-passos"><span class="on" data-p="1">1. Aulas</span><span data-p="2">2. Professores</span></div>
          <button class="pe-x" aria-label="Fechar">&times;</button>
        </div>
        <div class="pe-trilho"><div class="pe-palco">
          <section class="pe-pag" aria-label="Escolher aulas">
            <div class="pe-corpo">
              <label class="pe-todas"><input type="checkbox" id="pe-todas" checked> Selecionar todas as aulas</label>
              ${dados.aulas.map(a => `
                <label class="pe-aula"><input type="checkbox" class="pe-chk" value="${a.i}" checked>
                  <span class="pe-a1"><b>${esc(a.data || '—')}</b>${a.horario ? ' · ' + esc(a.horario) : ''}${a.duracao ? ' · ' + esc(a.duracao) : ''}<br>
                  ${esc(a.materia || '—')}${a.estudante ? ' · ' + esc(a.estudante) : ''}${a.professor ? ` · <span style="color:#9ca3af">atual: ${esc(a.professor)}</span>` : ''}</span>
                  <span class="pe-a2">${moeda(a.valor)}</span></label>`).join('')}
            </div>
            <div class="pe-rodape">
              <span class="pe-info" id="pe-resumo"></span>
              <button class="pe-btn pri" id="pe-avancar">Escolher professores <i class="fas fa-arrow-right"></i></button>
            </div>
          </section>
          <section class="pe-pag" aria-label="Escolher professores">
            <div class="pe-corpo">
              <div class="pe-filtros">
                <input type="search" id="pe-busca" placeholder="Buscar professor pelo nome ou apelido" aria-label="Buscar professor">
                <select id="pe-disc" aria-label="Disciplina"><option value="">Todas as disciplinas</option>
                  ${disciplinas.map(d => `<option value="${esc(norm(d))}">${esc(d)}</option>`).join('')}</select>
              </div>
              <div class="pe-grade" id="pe-grade"></div>
            </div>
            <div class="pe-rodape">
              <button class="pe-btn" id="pe-voltar"><i class="fas fa-arrow-left"></i> Voltar</button>
              <span class="pe-info" id="pe-resumo2"></span>
              <button class="pe-btn pri" id="pe-enviar" disabled><i class="fas fa-paper-plane"></i> Enviar proposta</button>
            </div>
          </section>
        </div></div>
      </div>`;
    document.body.appendChild(fundo);
    const $ = (s) => fundo.querySelector(s);
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', teclas); };
    const teclas = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', teclas);
    $('.pe-x').onclick = fechar;
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });

    const selecionadas = () => [...fundo.querySelectorAll('.pe-chk:checked')].map(c => dados.aulas[+c.value]);
    function resumo() {
      const s = selecionadas(); const total = s.reduce((t, a) => t + a.valor, 0);
      const txt = `${s.length} ${s.length === 1 ? 'aula' : 'aulas'} · professor recebe <b>${moeda(total)}</b>`;
      $('#pe-resumo').innerHTML = txt;
      $('#pe-resumo2').innerHTML = `${txt} · ${escolhidos.size} ${escolhidos.size === 1 ? 'professor' : 'professores'}`;
      $('#pe-avancar').disabled = !s.length;
      $('#pe-enviar').disabled = !s.length || !escolhidos.size;
      $('#pe-todas').checked = s.length === dados.aulas.length;
    }
    $('#pe-todas').onchange = (e) => { fundo.querySelectorAll('.pe-chk').forEach(c => { c.checked = e.target.checked; }); resumo(); };
    fundo.querySelectorAll('.pe-chk').forEach(c => { c.onchange = resumo; });

    function passo(n) {
      $('.pe-palco').classList.toggle('passo2', n === 2);
      fundo.querySelectorAll('.pe-passos span').forEach(s => s.classList.toggle('on', s.dataset.p === String(n)));
      setTimeout(() => (n === 2 ? $('#pe-busca') : $('#pe-avancar')).focus(), 460);
    }
    $('#pe-avancar').onclick = () => passo(2);
    $('#pe-voltar').onclick = () => passo(1);

    function desenharGrade() {
      const busca = norm($('#pe-busca').value), disc = $('#pe-disc').value;
      const lista = elegiveis.filter(p => (!busca || norm(p.nome).includes(busca) || norm(p.apelido).includes(busca))
        && (!disc || disciplinasDe(p).some(d => norm(d) === disc)));
      $('#pe-grade').innerHTML = lista.length ? lista.map(p => {
        const foto = fotoDe(p);
        return `<button type="button" class="pe-prof" data-id="${esc(p.id)}" aria-pressed="${escolhidos.has(p.id)}">
          ${ehOuro(p) ? '<i class="fas fa-star pe-ouro" title="Professor de ouro"></i>' : ''}<span class="pe-marca"><i class="fas fa-check"></i></span>
          ${foto ? `<img class="pe-foto" src="${esc(foto)}" alt="" loading="lazy">` : `<span class="pe-iniciais">${esc(iniciais(p.nome))}</span>`}
          <b>${esc(p.apelido || String(p.nome || '').split(' ')[0] || 'Professor')}</b><small>${esc(p.nome || '')}</small></button>`;
      }).join('') : '<p class="pe-vazio" style="grid-column:1/-1">Nenhum professor com acesso à plataforma encontrado para este filtro.</p>';
      fundo.querySelectorAll('.pe-prof').forEach(b => {
        b.onclick = () => {
          const pid = b.dataset.id;
          if (escolhidos.has(pid)) escolhidos.delete(pid); else escolhidos.add(pid);
          b.setAttribute('aria-pressed', String(escolhidos.has(pid)));
          resumo();
        };
      });
    }
    $('#pe-busca').oninput = desenharGrade;
    $('#pe-disc').onchange = desenharGrade;
    desenharGrade();
    resumo();

    $('#pe-enviar').onclick = async () => {
      const aulas = selecionadas().map(a => ({ data: a.data, horario: a.horario, duracao: a.duracao, materia: a.materia, estudante: a.estudante, valor: a.valor }));
      const total = Number(aulas.reduce((t, a) => t + a.valor, 0).toFixed(2));
      const lote = fdb().batch();
      const quem = (window.currentUser && window.currentUser.email) || '';
      [...escolhidos].forEach(pid => {
        const p = elegiveis.find(x => x.id === pid);
        lote.set(fdb().collection(COLECAO).doc(), {
          origem: dados.origem, idOrigem: dados.id, codigo: String(dados.codigo),
          clienteNome: dados.clienteNome, clienteApelido: dados.clienteApelido,
          professorId: p.id, professorEmail: String(p.email).trim().toLowerCase(),
          professorNome: p.nome || '', professorApelido: p.apelido || '',
          aulas, valorTotal: total,
          status: 'pendente', contraproposta: '', respondidoEm: null, lidaCentral: false,
          enviadoPor: quem, criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      const btn = $('#pe-enviar');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      try {
        await lote.commit();
        aviso(`Proposta enviada para ${escolhidos.size} ${escolhidos.size === 1 ? 'professor' : 'professores'}.`, 'success');
        fechar();
      } catch (err) {
        console.error('[Propostas] Erro ao enviar:', err);
        aviso('Não foi possível enviar a proposta. Tente novamente.', 'error');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar proposta';
      }
    };
  }

  // ── Notificações ─────────────────────────────────────────────────────────
  let propostas = [];
  let filtro = 'respondidas';
  let cancelar = null;

  const STATUS = {
    aceita:         { texto: 'aceitou', icone: 'fas fa-circle-check' },
    recusada:       { texto: 'recusou', icone: 'fas fa-circle-xmark' },
    contraproposta: { texto: 'realizou contraproposta', icone: 'fas fa-comment-dots' },
    pendente:       { texto: '', icone: 'far fa-clock' }
  };
  const naoLidas = () => propostas.filter(p => p.status !== 'pendente' && !p.lidaCentral).length;

  function atualizarContador() {
    const el = document.getElementById('contador-notificacoes');
    if (!el) return;
    const n = naoLidas();
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
  }

  function iniciarEscuta() {
    if (cancelar || !window.firebase || !window.currentUser) return;
    injetarEstilo();
    cancelar = fdb().collection(COLECAO).onSnapshot((snap) => {
      propostas = [];
      snap.forEach(d => propostas.push({ id: d.id, ...d.data() }));
      atualizarContador();
      const sec = document.getElementById('notificacoes');
      if (sec && sec.classList.contains('active') && sec.querySelector('.nt-wrap')) desenharNotificacoes();
    }, (err) => console.warn('[Notificações] Escuta indisponível:', err && err.code));
  }

  function ordenar(lista) {
    const t = (x) => (x && x.toMillis ? x.toMillis() : 0);
    return lista.slice().sort((a, b) => {
      const na = a.status !== 'pendente' && !a.lidaCentral, nb = b.status !== 'pendente' && !b.lidaCentral;
      if (na !== nb) return na ? -1 : 1;
      return (t(b.respondidoEm) || t(b.criadoEm)) - (t(a.respondidoEm) || t(a.criadoEm));
    });
  }

  function desenharNotificacoes() {
    const sec = document.getElementById('notificacoes');
    if (!sec) return;
    const cont = sec.querySelector('.nt-conteudo');
    const lista = ordenar(propostas.filter(p => filtro === 'todas' ? true : filtro === 'aguardando' ? p.status === 'pendente' : p.status !== 'pendente'));
    sec.querySelectorAll('.nt-chip').forEach(c => c.classList.toggle('on', c.dataset.f === filtro));
    if (!lista.length) {
      cont.innerHTML = `<p class="pe-vazio">${filtro === 'aguardando' ? 'Nenhuma proposta aguardando resposta.' : 'Nenhuma notificação por aqui.'}</p>`;
      return;
    }
    cont.innerHTML = `<div class="nt-grade">${lista.map(p => {
      const st = STATUS[p.status] || STATUS.pendente;
      const prof = p.professorApelido || String(p.professorNome || '').split(' ')[0] || 'Professor';
      const linha = p.status === 'pendente' ? `Aguardando resposta do professor ${esc(prof)}` : `Professor ${esc(prof)} ${st.texto}`;
      return `<button type="button" class="nt-card ${esc(p.status)}" data-id="${esc(p.id)}">
        ${p.status === 'aceita' ? '<span class="nt-tag">Aula fechada</span>' : ''}
        ${p.status !== 'pendente' && !p.lidaCentral ? '<span class="nt-novo" title="Não lida"></span>' : ''}
        <span class="nt-num">${p.origem === 'simulacao' ? 'Simulação' : 'Contratação'} ${esc(p.codigo || '')}</span>
        <span class="nt-apelido">${esc(p.clienteApelido || String(p.clienteNome || '').split(' ')[0] || 'Cliente')}</span>
        <span class="nt-nome">${esc(p.clienteNome || '')}</span>
        <span class="nt-status ${esc(p.status)}"><i class="${st.icone}"></i>${linha}</span>
        <span class="nt-data">${esc(fmtData(p.respondidoEm) || ('Enviada em ' + fmtData(p.criadoEm)))} · ${(p.aulas || []).length} aulas · ${moeda(p.valorTotal)}</span>
      </button>`;
    }).join('')}</div>`;

    cont.querySelectorAll('.nt-card').forEach(card => {
      const p = propostas.find(x => x.id === card.dataset.id);
      card.onclick = () => abrirDetalhe(p);
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); menuExcluir(p, e.clientX, e.clientY); });
      // Toque longo (celular/tablet) abre o mesmo menu.
      let timer = null;
      card.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        timer = setTimeout(() => { timer = 'aberto'; menuExcluir(p, t.clientX, t.clientY); }, 550);
      }, { passive: true });
      const parar = () => { if (timer && timer !== 'aberto') clearTimeout(timer); };
      card.addEventListener('touchmove', parar, { passive: true });
      card.addEventListener('touchend', (e) => { if (timer === 'aberto') e.preventDefault(); parar(); timer = null; });
    });
  }

  function janela(titulo, corpo, botoes) {
    return new Promise(resolve => {
      const f = document.createElement('div');
      f.className = 'pe-fundo';
      f.innerHTML = `<div class="pe-caixa" style="max-width:520px" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="pe-topo"><h3>${esc(titulo)}</h3><button class="pe-x" aria-label="Fechar">&times;</button></div>
        <div class="pe-corpo">${corpo}</div>
        <div class="pe-rodape" style="justify-content:flex-end">${botoes.map((b, i) => `<button class="pe-btn ${b.classe || ''}" data-i="${i}">${esc(b.rotulo)}</button>`).join('')}</div></div>`;
      const fim = (v) => { f.remove(); document.removeEventListener('keydown', k); resolve(v); };
      const k = (e) => { if (e.key === 'Escape') fim(null); };
      document.addEventListener('keydown', k);
      f.querySelector('.pe-x').onclick = () => fim(null);
      f.addEventListener('mousedown', e => { if (e.target === f) fim(null); });
      f.querySelectorAll('[data-i]').forEach(b => { b.onclick = () => fim(botoes[+b.dataset.i].valor); });
      document.body.appendChild(f);
    });
  }

  async function abrirDetalhe(p) {
    if (p.status !== 'pendente' && !p.lidaCentral) {
      fdb().collection(COLECAO).doc(p.id).update({ lidaCentral: true }).catch(err => console.warn('[Notificações] Não marcou como lida:', err && err.code));
    }
    const st = STATUS[p.status] || STATUS.pendente;
    const prof = p.professorApelido || p.professorNome || 'Professor';
    const aulas = (p.aulas || []).map(a => `<li><b>${esc(a.data)}</b> · ${esc(a.horario)} · ${esc(a.duracao)} · ${esc(a.materia)}${a.estudante ? ' · ' + esc(a.estudante) : ''}</li>`).join('');
    await janela(`${p.origem === 'simulacao' ? 'Simulação' : 'Contratação'} ${p.codigo || ''} · ${p.clienteNome || ''}`, `
      <p class="nt-status ${esc(p.status)}" style="margin:0 0 .8rem"><i class="${st.icone}"></i>${p.status === 'pendente' ? `Aguardando resposta do professor ${esc(prof)}` : `Professor ${esc(prof)} ${st.texto}`}</p>
      ${p.status === 'contraproposta' ? `<p style="font-weight:700;margin:0 0 .4rem">Contraproposta do professor:</p><div class="nt-texto">${esc(p.contraproposta || '')}</div>` : ''}
      <p style="margin:1rem 0 0;font-size:.85rem;color:#374151">Aulas enviadas (${(p.aulas || []).length}) · professor recebe <b>${moeda(p.valorTotal)}</b> · professor: ${esc(p.professorNome || '')}</p>
      <ul class="nt-aulas">${aulas}</ul>`, [{ rotulo: 'Fechar', valor: null, classe: 'pri' }]);
  }

  function menuExcluir(p, x, y) {
    document.querySelector('.nt-menu')?.remove();
    const m = document.createElement('div');
    m.className = 'nt-menu';
    m.innerHTML = '<button type="button"><i class="fas fa-trash"></i> Excluir</button>';
    m.style.left = Math.min(x, innerWidth - 180) + 'px';
    m.style.top = Math.min(y, innerHeight - 60) + 'px';
    document.body.appendChild(m);
    const fora = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', fora, true); document.removeEventListener('touchstart', fora, true); } };
    setTimeout(() => { document.addEventListener('mousedown', fora, true); document.addEventListener('touchstart', fora, true); }, 0);
    m.querySelector('button').onclick = async () => {
      m.remove();
      const ok = await janela('Excluir proposta', `<p style="margin:0;font-size:.92rem;color:#374151;line-height:1.55">Excluir a proposta de <b>${esc(p.clienteNome || '')}</b> enviada ao professor <b>${esc(p.professorApelido || p.professorNome || '')}</b>?<br><br>Ela também <b>some da área do professor</b>. Para mudar as aulas, exclua e envie uma nova proposta.</p>`,
        [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Excluir', valor: true, classe: 'perigo' }]);
      if (!ok) return;
      try { await fdb().collection(COLECAO).doc(p.id).delete(); aviso('Proposta excluída.', 'success'); }
      catch (err) { console.error('[Notificações] Erro ao excluir:', err); aviso('Não foi possível excluir.', 'error'); }
    };
  }

  function loadNotificacoes() {
    injetarEstilo();
    iniciarEscuta();
    const sec = document.getElementById('notificacoes');
    if (!sec) return;
    sec.innerHTML = `<div class="nt-wrap">
      <div class="nt-barra">
        <button class="nt-chip" data-f="respondidas">Respondidas</button>
        <button class="nt-chip" data-f="aguardando">Aguardando resposta</button>
        <button class="nt-chip" data-f="todas">Todas</button>
        <span class="nt-dica">Clique com o botão direito (ou segure o dedo) num card para excluir.</span>
      </div>
      <div class="nt-conteudo"><p class="pe-vazio">Carregando…</p></div></div>`;
    sec.querySelectorAll('.nt-chip').forEach(c => { c.onclick = () => { filtro = c.dataset.f; desenharNotificacoes(); }; });
    if (cancelar) desenharNotificacoes();
  }

  // Começa a escutar assim que o login do Central terminar (contador no menu).
  const espera = setInterval(() => { if (window.currentUser && window.firebase) { clearInterval(espera); iniciarEscuta(); } }, 500);
  setTimeout(() => clearInterval(espera), 60000);

  window.PropostasProfessores = { abrirEnvio };
  window.loadNotificacoes = loadNotificacoes;
})();

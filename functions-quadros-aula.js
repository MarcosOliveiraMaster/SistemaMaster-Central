// functions-quadros-aula.js
// "Quadros de aula": todos os quadros do Quadro Master criados pelos professores
// no portal (SistemMaster-Login), com filtros por professor, cliente e datas.
// Abrir um card mostra a descrição e as páginas (somente leitura) e permite
// baixar o PDF.
//
// Dados: quadros/{id} e quadros/{id}/paginas/{0..9}. O admin lê tudo pelas
// regras do Firestore. As páginas são desenhadas por quadro-render.js (cópia
// do arquivo do portal) SÓ em <canvas>: nada do conteúdo vira HTML.
//
// Vínculo com o cliente: o cliente só vê o quadro com clienteUid preenchido.
// Quando o professor cria o quadro com uma aula ainda sem professorEmail ou sem
// clienteUid, o quadro nasce "não visível". O botão "Vincular ao cliente" (e
// "Vincular pendentes") acha a aula do mesmo professor e aluno, corrige a aula
// (professorEmail/clienteUid) e liga o quadro a ela — o mesmo vínculo que as
// regras exigem quando o professor salva o quadro (vinculoValido).

import { abrirVisualizadorQuadro, MAX_PAGINAS } from './quadro-render.js';

(function () {
  let quadros = [];
  const filtros = { professor: '', cliente: '', de: '', ate: '', busca: '' };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dataDe = (ts) => (ts && ts.toDate ? ts.toDate() : null);
  const fmt = (ts) => { const d = dataDe(ts); return d ? d.toLocaleDateString('pt-BR') : '—'; };

  function opcoes(campo, rotulo) {
    const valores = [...new Set(quadros.map(q => (q[campo] || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return `<option value="">${rotulo}</option>` + valores.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  function filtrados() {
    const de = filtros.de ? new Date(filtros.de + 'T00:00:00') : null;
    const ate = filtros.ate ? new Date(filtros.ate + 'T23:59:59') : null;
    const busca = filtros.busca.trim().toLowerCase();
    return quadros.filter(q => {
      if (filtros.professor && (q.professorNome || q.professorEmail || '').trim() !== filtros.professor) return false;
      if (filtros.cliente && (q.clienteNome || '').trim() !== filtros.cliente) return false;
      const d = dataDe(q.atualizadoEm) || dataDe(q.criadoEm);
      if (de && (!d || d < de)) return false;
      if (ate && (!d || d > ate)) return false;
      if (busca && !`${q.titulo} ${q.descricao} ${q.alunoNome}`.toLowerCase().includes(busca)) return false;
      return true;
    });
  }

  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const naoVinculado = (q) => !q.clienteUid && !!(q.aulaEscolhida || q.alunoNome || q.clienteNome);

  function seloVinculo(q) {
    if (q.clienteUid) return '<span class="text-xs font-semibold bg-green-50 text-green-700 rounded-full px-2 py-0.5"><i class="fas fa-eye"></i> Visível ao cliente</span>';
    if (!naoVinculado(q)) return '<span class="text-xs font-semibold bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">Sem aluno · só professor e Master</span>';
    return '<span class="text-xs font-semibold bg-red-50 text-red-700 rounded-full px-2 py-0.5"><i class="fas fa-eye-slash"></i> Não visível ao cliente</span>';
  }

  function formasCpf(cpf) {
    const dig = String(cpf || '').replace(/\D/g, '');
    if (dig.length !== 11) return [];
    return [...new Set([dig, `${dig.slice(0, 3)}.${dig.slice(3, 6)}.${dig.slice(6, 9)}-${dig.slice(9)}`, String(cpf).trim()])];
  }

  // Liga o quadro ao cliente. Lança Error com mensagem para o usuário.
  async function vincular(q) {
    const db = firebase.firestore();
    const email = String(q.professorEmail || '').trim().toLowerCase();
    // O professor escolheu a aula do quadro (aulaEscolhida): usa exatamente ela,
    // desde que a aula seja mesmo desse professor (as regras conferem isso).
    if (q.aulaEscolhida) {
      const s = await db.collection('BancoDeAulas-Lista').doc(q.aulaEscolhida).get();
      if (s.exists) {
        const a = s.data();
        let doProfessor = String(a.professorEmail || '').toLowerCase() === email;
        if (!doProfessor && typeof window.BANCO?.resolverEmailProfessor === 'function') {
          doProfessor = (await window.BANCO.resolverEmailProfessor({ cpf: a.idProfessor, nome: a.professor })) === email;
        }
        if (doProfessor) return vincularNaAula(q, { id: s.id, ref: s.ref, a }, email);
      }
    }
    const snap = q.clienteNome
      ? await db.collection('BancoDeAulas-Lista').where('nomeCliente', '==', q.clienteNome).get()
      : await db.collection('BancoDeAulas-Lista').where('estudante', '==', q.alunoNome).get();
    const aluno = norm(q.alunoNome);
    let candidatas = snap.docs
      .map(d => ({ id: d.id, ref: d.ref, a: d.data() }))
      .filter(c => !aluno || norm(c.a.estudante) === aluno);
    if (!candidatas.length) throw new Error('Nenhuma aula encontrada para este aluno/cliente.');

    // A aula precisa ser do professor do quadro (as regras conferem isso).
    for (const c of candidatas) {
      if (String(c.a.professorEmail || '').toLowerCase() !== email && typeof window.BANCO?.resolverEmailProfessor === 'function') {
        c.emailResolvido = await window.BANCO.resolverEmailProfessor({ cpf: c.a.idProfessor, nome: c.a.professor });
      }
    }
    candidatas = candidatas.filter(c => String(c.a.professorEmail || '').toLowerCase() === email || c.emailResolvido === email);
    if (!candidatas.length) throw new Error('Nenhuma aula deste aluno está atribuída ao professor do quadro.');
    const naoCancelada = candidatas.filter(c => !String(c.a.StatusAula || '').toLowerCase().includes('cancel'));
    const aula = (naoCancelada.length ? naoCancelada : candidatas)
      .sort((x, y) => (y.a.clienteUid ? 1 : 0) - (x.a.clienteUid ? 1 : 0))[0];
    return vincularNaAula(q, aula, email);
  }

  // Completa a aula (cliente e professor) e liga o quadro a ela.
  async function vincularNaAula(q, aula, email) {
    const db = firebase.firestore();
    let uid = aula.a.clienteUid || aula.a.clientUid || '';
    if (!uid) {
      const formas = formasCpf(aula.a.cpf);
      if (formas.length) {
        const cad = await db.collection('cadastroClientes').where('cpf', 'in', formas).limit(1).get();
        if (!cad.empty) uid = cad.docs[0].data().uid || '';
      }
      if (!uid) throw new Error('O cliente ainda não tem acesso ao portal. Libere o acesso em Clientes e tente de novo.');
      if (typeof window.BANCO?.vincularAulasAoCliente === 'function') await window.BANCO.vincularAulasAoCliente(aula.a.cpf, uid);
      else await aula.ref.update({ clienteUid: uid, clientUid: uid });
    }
    if (String(aula.a.professorEmail || '').toLowerCase() !== email) await aula.ref.update({ professorEmail: email });

    await db.collection('quadros').doc(q.id).update({ aulaId: aula.id, clienteUid: uid });
    q.aulaId = aula.id; q.clienteUid = uid;
  }

  const avisar = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo) : alert(msg));

  async function vincularPendentes(btn) {
    const pendentes = quadros.filter(naoVinculado);
    if (!pendentes.length) return;
    btn.disabled = true;
    let ok = 0; const falhas = [];
    for (const q of pendentes) {
      btn.textContent = `Vinculando ${ok + falhas.length + 1}/${pendentes.length}…`;
      try { await vincular(q); ok++; }
      catch (err) { falhas.push(`${q.titulo}: ${err.message}`); }
    }
    if (falhas.length) console.warn('[Quadros de aula] Não vinculados:\n' + falhas.join('\n'));
    avisar(`${ok} quadro(s) vinculado(s)${falhas.length ? ` · ${falhas.length} sem vínculo possível (detalhes no console)` : ''}.`, falhas.length ? 'warning' : 'success');
    desenharCards();
  }

  function desenharCards() {
    const lista = document.getElementById('qa-lista');
    const cont = document.getElementById('qa-contagem');
    if (!lista) return;
    const itens = filtrados();
    cont.textContent = `${itens.length} ${itens.length === 1 ? 'quadro' : 'quadros'}`;
    const pend = quadros.filter(naoVinculado).length;
    const btnPend = document.getElementById('qa-vincular-pendentes');
    if (btnPend) {
      btnPend.style.display = pend ? '' : 'none';
      btnPend.disabled = false;
      btnPend.innerHTML = `<i class="fas fa-link"></i> Vincular pendentes (${pend})`;
    }
    if (!itens.length) {
      lista.innerHTML = `<div class="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl border border-dashed">
        <i class="fas fa-chalkboard text-4xl text-orange-300 mb-3 block"></i>Nenhum quadro encontrado com estes filtros.</div>`;
      return;
    }
    lista.innerHTML = itens.map(q => `
      <div class="qa-card text-left bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md hover:border-orange-300 transition" data-id="${esc(q.id)}">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-lexend font-bold text-gray-800 break-words">${esc(q.titulo)}</h3>
          <span class="text-xs font-semibold bg-orange-50 text-orange-600 rounded-full px-2 py-0.5 whitespace-nowrap">${Number(q.paginas) || 1} pág.</span>
        </div>
        ${q.descricao ? `<p class="text-sm text-gray-600 qa-desc">${esc(q.descricao)}</p>` : ''}
        <div class="text-xs text-gray-500 space-y-0.5">
          <div><i class="fas fa-chalkboard-teacher w-4 text-orange-500"></i> ${esc(q.professorNome || q.professorEmail || '—')}</div>
          <div><i class="fas fa-user-graduate w-4 text-orange-500"></i> ${esc(q.alunoNome || 'Sem aluno')}${q.clienteNome ? ` · ${esc(q.clienteNome)}` : ''}</div>
          <div><i class="far fa-calendar w-4 text-orange-500"></i> Criado em ${esc(fmt(q.criadoEm))} · Atualizado em ${esc(fmt(q.atualizadoEm))}</div>
        </div>
        <div>${seloVinculo(q)}</div>
        <div class="flex flex-wrap items-center gap-3 mt-1">
          <button type="button" class="qa-ver text-sm font-semibold text-orange-600 hover:underline">Ver quadro <i class="fas fa-arrow-right text-xs"></i></button>
          ${naoVinculado(q) ? '<button type="button" class="qa-vincular text-sm font-semibold text-red-700 hover:underline"><i class="fas fa-link"></i> Vincular ao cliente</button>' : ''}
        </div>
      </div>`).join('');
    lista.querySelectorAll('.qa-card').forEach(card => {
      const q = quadros.find(x => x.id === card.dataset.id);
      card.querySelector('.qa-ver').onclick = () => abrir(q);
      const btn = card.querySelector('.qa-vincular');
      if (btn) btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Vinculando…';
        try {
          await vincular(q);
          avisar('Quadro vinculado: o cliente já pode vê-lo no portal.', 'success');
        } catch (err) {
          console.error('[Quadros de aula] Vincular:', err);
          avisar(err.message || 'Não foi possível vincular o quadro.', 'error');
        }
        desenharCards();
      };
    });
  }

  async function lerPaginas(q) {
    const snap = await firebase.firestore().collection('quadros').doc(q.id).collection('paginas').get();
    const porIndice = new Map();
    snap.forEach(d => porIndice.set(d.id, d.data().dados));
    const n = Math.max(1, Math.min(MAX_PAGINAS, Number(q.paginas) || porIndice.size || 1));
    return Array.from({ length: n }, (_, i) => porIndice.get(String(i)) || '');
  }

  function abrir(q) {
    if (!q) return;
    abrirVisualizadorQuadro({
      titulo: q.titulo, descricao: q.descricao,
      professorNome: q.professorNome || q.professorEmail,
      alunoNome: q.alunoNome, clienteNome: q.clienteNome, atualizadoEm: q.atualizadoEm
    }, () => lerPaginas(q));
  }

  async function loadQuadrosDeAula() {
    const section = document.getElementById('quadros-aula');
    if (!section) return;
    section.innerHTML = `
      <style>.qa-desc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;}</style>
      <div class="p-4 md:p-6 space-y-4">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label class="text-xs font-semibold text-gray-500">Professor
              <select id="qa-f-professor" class="mt-1 w-full border rounded-lg px-2 py-2 text-sm text-gray-700"><option value="">Todos</option></select></label>
            <label class="text-xs font-semibold text-gray-500">Cliente
              <select id="qa-f-cliente" class="mt-1 w-full border rounded-lg px-2 py-2 text-sm text-gray-700"><option value="">Todos</option></select></label>
            <label class="text-xs font-semibold text-gray-500">De
              <input id="qa-f-de" type="date" class="mt-1 w-full border rounded-lg px-2 py-2 text-sm text-gray-700"></label>
            <label class="text-xs font-semibold text-gray-500">Até
              <input id="qa-f-ate" type="date" class="mt-1 w-full border rounded-lg px-2 py-2 text-sm text-gray-700"></label>
            <label class="text-xs font-semibold text-gray-500">Buscar
              <input id="qa-f-busca" type="search" placeholder="Título, descrição ou aluno" class="mt-1 w-full border rounded-lg px-2 py-2 text-sm text-gray-700"></label>
          </div>
          <div class="flex items-center justify-between mt-3">
            <span id="qa-contagem" class="text-sm text-gray-500">Carregando…</span>
            <div class="flex items-center gap-4">
              <button id="qa-vincular-pendentes" type="button" class="text-sm font-semibold text-red-700 hover:underline" style="display:none"></button>
              <button id="qa-limpar" type="button" class="text-sm font-semibold text-orange-600 hover:underline">Limpar filtros</button>
            </div>
          </div>
        </div>
        <div id="qa-lista" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"></div>
      </div>`;

    try {
      const snap = await firebase.firestore().collection('quadros').get();
      quadros = [];
      snap.forEach(d => quadros.push({ id: d.id, ...d.data() }));
      quadros.sort((a, b) => (dataDe(b.atualizadoEm)?.getTime() || 0) - (dataDe(a.atualizadoEm)?.getTime() || 0));
    } catch (err) {
      console.error('[Quadros de aula] Erro ao carregar:', err);
      document.getElementById('qa-contagem').textContent = 'Não foi possível carregar os quadros.';
      return;
    }

    // "Professor" filtra pelo nome (ou e-mail, se o nome estiver vazio).
    quadros.forEach(q => { q._professor = (q.professorNome || q.professorEmail || '').trim(); });
    const selProf = document.getElementById('qa-f-professor');
    const nomesProf = [...new Set(quadros.map(q => q._professor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    selProf.innerHTML = '<option value="">Todos</option>' + nomesProf.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    document.getElementById('qa-f-cliente').innerHTML = opcoes('clienteNome', 'Todos');

    const ligar = (id, campo, evento = 'change') => {
      const el = document.getElementById(id);
      el.value = filtros[campo];
      el.addEventListener(evento, () => { filtros[campo] = el.value; desenharCards(); });
    };
    ligar('qa-f-professor', 'professor');
    ligar('qa-f-cliente', 'cliente');
    ligar('qa-f-de', 'de');
    ligar('qa-f-ate', 'ate');
    ligar('qa-f-busca', 'busca', 'input');
    const btnPend = document.getElementById('qa-vincular-pendentes');
    btnPend.onclick = () => vincularPendentes(btnPend);
    document.getElementById('qa-limpar').onclick = () => {
      Object.keys(filtros).forEach(k => { filtros[k] = ''; });
      ['qa-f-professor', 'qa-f-cliente', 'qa-f-de', 'qa-f-ate', 'qa-f-busca'].forEach(id => { document.getElementById(id).value = ''; });
      desenharCards();
    };
    desenharCards();
  }

  window.loadQuadrosDeAula = loadQuadrosDeAula;
})();

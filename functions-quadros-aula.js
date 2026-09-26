// functions-quadros-aula.js
// "Quadros de aula": todos os quadros do Quadro Master criados pelos professores
// no portal (SistemMaster-Login), com filtros por professor, cliente e datas.
// Abrir um card mostra a descrição e as páginas (somente leitura) e permite
// baixar o PDF.
//
// Dados: quadros/{id} e quadros/{id}/paginas/{0..9}. O admin lê tudo pelas
// regras do Firestore. As páginas são desenhadas por quadro-render.js (cópia
// do arquivo do portal) SÓ em <canvas>: nada do conteúdo vira HTML.

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

  function desenharCards() {
    const lista = document.getElementById('qa-lista');
    const cont = document.getElementById('qa-contagem');
    if (!lista) return;
    const itens = filtrados();
    cont.textContent = `${itens.length} ${itens.length === 1 ? 'quadro' : 'quadros'}`;
    if (!itens.length) {
      lista.innerHTML = `<div class="col-span-full text-center text-gray-500 py-12 bg-white rounded-xl border border-dashed">
        <i class="fas fa-chalkboard text-4xl text-orange-300 mb-3 block"></i>Nenhum quadro encontrado com estes filtros.</div>`;
      return;
    }
    lista.innerHTML = itens.map(q => `
      <button type="button" class="qa-card text-left bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md hover:border-orange-300 transition" data-id="${esc(q.id)}">
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
        <span class="text-sm font-semibold text-orange-600 mt-1">Ver quadro <i class="fas fa-arrow-right text-xs"></i></span>
      </button>`).join('');
    lista.querySelectorAll('.qa-card').forEach(card => {
      card.onclick = () => abrir(quadros.find(q => q.id === card.dataset.id));
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
            <button id="qa-limpar" type="button" class="text-sm font-semibold text-orange-600 hover:underline">Limpar filtros</button>
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
    document.getElementById('qa-limpar').onclick = () => {
      Object.keys(filtros).forEach(k => { filtros[k] = ''; });
      ['qa-f-professor', 'qa-f-cliente', 'qa-f-de', 'qa-f-ate', 'qa-f-busca'].forEach(id => { document.getElementById(id).value = ''; });
      desenharCards();
    };
    desenharCards();
  }

  window.loadQuadrosDeAula = loadQuadrosDeAula;
})();

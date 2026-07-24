console.log('✅ functions-disciplinas.js carregado');

// ──────────────────────────────────────────────────────────
//  Fonte central de disciplinas (Firestore) — substitui as
//  listas hardcoded que existiam duplicadas em Cards.js,
//  simulacoes.js e calendario-visual.js
// ──────────────────────────────────────────────────────────

const DISCIPLINAS_SEED = [
  "Biologia", "Ciências", "Ciências da Natureza", "Ciências Humanas",
  "Filosofia", "Física", "Geografia", "História", "Inglês",
  "Língua Inglesa", "Língua Portuguesa", "Literatura", "Matemática",
  "Pedagogia", "Português", "Química", "Redação", "Sociologia"
];

function _escapeHtmlDisc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.DisciplinasStore = (function () {
  let cache = null;
  let loadingPromise = null;

  async function _loadFromFirestore() {
    const col = firebase.firestore().collection('Disciplinas');
    const snap = await col.get();

    if (snap.empty) {
      const batch = firebase.firestore().batch();
      const seeded = [];
      DISCIPLINAS_SEED.forEach(nome => {
        const ref = col.doc();
        batch.set(ref, { nome, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
        seeded.push({ id: ref.id, nome });
      });
      await batch.commit();
      return seeded.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    return snap.docs
      .map(d => ({ id: d.id, nome: d.data().nome || '' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async function getAll() {
    if (cache) return cache;
    if (!loadingPromise) {
      loadingPromise = _loadFromFirestore()
        .then(list => { cache = list; return cache; })
        .catch(err => {
          console.error('❌ Erro ao carregar disciplinas:', err);
          cache = [];
          return cache;
        })
        .finally(() => { loadingPromise = null; });
    }
    return loadingPromise;
  }

  async function add(nome) {
    const nomeLimpo = (nome || '').trim();
    if (!nomeLimpo) throw new Error('Nome da disciplina não pode ser vazio');

    const col = firebase.firestore().collection('Disciplinas');
    const ref = await col.add({ nome: nomeLimpo, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
    cache = null;
    await getAll();
    return { id: ref.id, nome: nomeLimpo };
  }

  async function remove(id) {
    await firebase.firestore().collection('Disciplinas').doc(id).delete();
    cache = null;
    await getAll();
  }

  return { getAll, add, remove };
})();

// ──────────────────────────────────────────────────────────
//  Popup genérico de confirmação Sim/Não
// ──────────────────────────────────────────────────────────
window.showConfirmDialog = function (title, message, opts = {}) {
  const textoSim = opts.textoSim || 'Sim';
  const textoNao = opts.textoNao || 'Não';

  return new Promise(resolve => {
    const modalId = 'discConfirmModal-' + Date.now();
    const html = `
      <div class="modal-overlay" id="${modalId}" style="z-index: 10010;">
        <div class="modal-container" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">${_escapeHtmlDisc(title)}</h3>
          </div>
          <div class="modal-body">
            <p class="text-sm text-gray-700">${message}</p>
          </div>
          <div class="modal-footer">
            <button id="${modalId}-nao" class="btn-secondary btn-compact">${_escapeHtmlDisc(textoNao)}</button>
            <button id="${modalId}-sim" class="btn-primary btn-compact">${_escapeHtmlDisc(textoSim)}</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById(modalId);

    const finish = (result) => {
      modal.remove();
      resolve(result);
    };

    modal.querySelector(`#${modalId}-sim`).addEventListener('click', () => finish(true));
    modal.querySelector(`#${modalId}-nao`).addEventListener('click', () => finish(false));
    modal.addEventListener('click', (e) => { if (e.target === modal) finish(false); });
  });
};

// ──────────────────────────────────────────────────────────
//  Modal "Nova Disciplina"
// ──────────────────────────────────────────────────────────
window.showNovaDisciplinaModal = function ({ onAdicionarNaLista, onApenasNestaAula } = {}) {
  const modalId = 'novaDisciplinaModal-' + Date.now();
  const html = `
    <div class="modal-overlay" id="${modalId}" style="z-index: 10010;">
      <div class="modal-container" style="max-width: 420px;">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-plus text-orange-500 mr-2"></i>Nova disciplina
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <label class="block text-sm font-medium text-gray-700 mb-2">Nome da disciplina</label>
          <input type="text" id="${modalId}-input" class="dc-form-input" placeholder="Ex: Literatura" maxlength="60" autocomplete="off">
        </div>
        <div class="modal-footer">
          <button id="${modalId}-cancelar" class="btn-secondary btn-compact">Cancelar</button>
          <button id="${modalId}-salvar" class="btn-primary btn-compact">Salvar</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById(modalId);
  const input = modal.querySelector(`#${modalId}-input`);
  const closeModal = () => modal.remove();

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector(`#${modalId}-cancelar`).addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const salvar = async () => {
    const nome = input.value.trim();
    if (!nome) {
      if (typeof showToast === 'function') showToast('⚠️ Digite o nome da disciplina', 'warning');
      return;
    }
    closeModal();

    const adicionar = await showConfirmDialog(
      'Nova disciplina',
      `Deseja adicionar <strong>"${_escapeHtmlDisc(nome)}"</strong> à lista de disciplinas?`
    );

    if (adicionar) {
      try {
        await DisciplinasStore.add(nome);
        if (typeof onAdicionarNaLista === 'function') onAdicionarNaLista(nome);
        if (typeof showToast === 'function') showToast(`✅ Disciplina "${nome}" adicionada`, 'success');
      } catch (err) {
        console.error('❌ Erro ao adicionar disciplina:', err);
        if (typeof showToast === 'function') showToast('❌ Erro ao adicionar disciplina', 'error');
      }
    } else {
      if (typeof onApenasNestaAula === 'function') onApenasNestaAula(nome);
    }
  };

  modal.querySelector(`#${modalId}-salvar`).addEventListener('click', salvar);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvar(); });
  setTimeout(() => input.focus(), 50);
};

// ──────────────────────────────────────────────────────────
//  Menu de contexto (botão direito) "Excluir" para disciplinas
// ──────────────────────────────────────────────────────────
window.showExcluirDisciplinaMenu = function (x, y, disciplina, onExcluido) {
  const existente = document.getElementById('discCtxMenu');
  if (existente) existente.remove();

  const menu = document.createElement('div');
  menu.id = 'discCtxMenu';
  menu.className = 'cal-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.innerHTML = `
    <div class="cal-ctx-item danger" id="discCtxExcluir">
      <i class="fas fa-trash text-red-500 mr-2"></i>Excluir
    </div>`;
  document.body.appendChild(menu);

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);

  menu.querySelector('#discCtxExcluir').addEventListener('click', async (e) => {
    e.stopPropagation();
    closeMenu();

    const confirmar = await showConfirmDialog(
      'Excluir disciplina',
      `Remover <strong>"${_escapeHtmlDisc(disciplina.nome)}"</strong> da lista de disciplinas? Isso não afeta aulas que já usam esse nome.`,
      { textoSim: 'Excluir' }
    );

    if (!confirmar) return;

    try {
      await DisciplinasStore.remove(disciplina.id);
      if (typeof onExcluido === 'function') onExcluido();
      if (typeof showToast === 'function') showToast(`🗑️ Disciplina "${disciplina.nome}" excluída`, 'success');
    } catch (err) {
      console.error('❌ Erro ao excluir disciplina:', err);
      if (typeof showToast === 'function') showToast('❌ Erro ao excluir disciplina', 'error');
    }
  });
};

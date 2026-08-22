// ============================================================
// dashboardProfessores.js
// Galeria de Professores — busca + cards com foto (módulo autocontido)
// Orquestra a nova área "Professores" em desenvolvimento.
// ============================================================

window.GaleriaProfessores = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CONFIG
  // ─────────────────────────────────────────────────────────────
  const CFG = {
    colProfessores: 'dataBaseProfessores',
    campoFoto:     'fotoUpload',      // data URL (base64) da foto enviada
    campoFotoEm:   'fotoUploadEm',    // timestamp do último envio
    maxDim:        480,               // maior lado da imagem redimensionada (px)
    jpegQuality:   0.82,
    limiteAviso:   700 * 1024,        // aviso se o base64 passar disso (~700KB)
  };

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  const S = {
    db: null,
    professores: [],
    carregado: false,
    termoBusca: '',
    profSelecionado: null,
    pendingDataURL: null,
  };

  // ─────────────────────────────────────────────────────────────
  // FIREBASE
  // ─────────────────────────────────────────────────────────────
  function initFirebase() {
    try {
      if (typeof firebase === 'undefined') throw new Error('Firebase SDK não encontrado.');
      if (typeof FIREBASE_CONFIG === 'undefined') throw new Error('FIREBASE_CONFIG não encontrado.');
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      S.db = firebase.firestore();
      return true;
    } catch (e) {
      console.error('❌ GaleriaProfessores — Firebase init error:', e);
      return false;
    }
  }

  async function fetchProfessores() {
    const snap = await S.db.collection(CFG.colProfessores).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ─────────────────────────────────────────────────────────────
  // UTILS
  // ─────────────────────────────────────────────────────────────
  function $root() { return document.getElementById('galeria-professores'); }
  function $id(id) { return document.getElementById(id); }

  function getField(item, key) {
    if (!item || !key) return undefined;
    if (Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    for (const k of [key, key.charAt(0).toLowerCase() + key.slice(1), key.toLowerCase()]) {
      if (Object.prototype.hasOwnProperty.call(item, k)) return item[k];
    }
    return undefined;
  }

  function normalizeStr(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function toast(msg, tipo = 'info') {
    if (typeof window.showToast === 'function') window.showToast(msg, tipo);
    else if (tipo === 'error') alert(msg);
  }

  function isAtivo(p) {
    const status = normalizeStr(getField(p, 'status') || 'ativo');
    return status !== 'desligado';
  }

  // ─────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('gp-styles')) return;
    const style = document.createElement('style');
    style.id = 'gp-styles';
    style.textContent = `
#galeria-professores {
  --gp-orange:       #f28705;
  --gp-orange-light: #fef3e2;
  --gp-orange-dk:    #c96e04;
  --gp-red:          #dc2626;
  --gp-gray-50:      #f9fafb;
  --gp-gray-100:     #f3f4f6;
  --gp-gray-200:     #e5e7eb;
  --gp-gray-400:     #9ca3af;
  --gp-gray-600:     #4b5563;
  --gp-gray-800:     #1f2937;
  --gp-shadow:       0 4px 16px rgba(0,0,0,.08);
  --gp-transition:   0.2s ease;
  /* dimensões do card: largura = a · altura = a + b */
  --gp-a: 160px;
  --gp-b: 48px;
  font-family: 'Lexend', sans-serif;
  display: flex; flex-direction: column; height: 100%; overflow: auto; background: var(--gp-gray-100);
}

.gp-toolbar { display:flex; align-items:center; gap:.6rem; padding:.85rem 1rem; background:white; border-bottom:1px solid var(--gp-gray-200); flex-shrink:0; position:sticky; top:0; z-index:20; }
.gp-search { position:relative; flex:1; max-width:420px; }
.gp-search i { position:absolute; left:.75rem; top:50%; transform:translateY(-50%); color:var(--gp-gray-400); font-size:.85rem; }
.gp-input { width:100%; font-family:'Lexend',sans-serif; font-size:.85rem; border:1px solid var(--gp-gray-200); border-radius:.6rem; padding:.55rem .75rem .55rem 2.1rem; background:var(--gp-gray-50); transition:border-color var(--gp-transition), box-shadow var(--gp-transition); }
.gp-input:focus { outline:none; border-color:var(--gp-orange); box-shadow:0 0 0 3px rgba(242,135,5,.12); background:white; }
.gp-contador { font-size:.75rem; color:var(--gp-gray-600); white-space:nowrap; }

.gp-grid { display:grid; grid-template-columns:repeat(auto-fill, var(--gp-a)); gap:1.1rem; padding:1.1rem; justify-content:start; align-content:start; flex:1; }

.gp-card { width:var(--gp-a); height:calc(var(--gp-a) + var(--gp-b)); display:flex; flex-direction:column; background:white; border:1px solid var(--gp-gray-200); border-radius:.65rem; overflow:hidden; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.05); transition:box-shadow var(--gp-transition), border-color var(--gp-transition), transform .15s ease; }
.gp-card:hover { box-shadow:0 8px 22px rgba(242,135,5,.18); border-color:var(--gp-orange); transform:translateY(-2px); }
.gp-card__img-box { width:100%; height:var(--gp-a); flex-shrink:0; background:var(--gp-gray-100); overflow:hidden; }
.gp-card__img-box img { width:100%; height:100%; object-fit:cover; display:block; }
.gp-card__fallback { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:2.3rem; color:var(--gp-orange); background:var(--gp-orange-light); }
.gp-card__label { height:var(--gp-b); flex-shrink:0; display:flex; align-items:center; padding:0 .6rem; font-size:.78rem; font-weight:600; color:var(--gp-gray-800); text-align:left; line-height:1.2; overflow:hidden; }
.gp-card__label span { overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

.gp-empty { grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--gp-gray-400); }
.gp-empty i { font-size:2.2rem; margin-bottom:.6rem; display:block; }

/* ── modal de envio de foto ── */
.gp-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:9500; animation:gpFadeIn .15s ease; }
@keyframes gpFadeIn { from{opacity:0} to{opacity:1} }
.gp-modal { background:white; border-radius:.9rem; box-shadow:0 20px 48px rgba(0,0,0,.2); width:92%; max-width:360px; overflow:hidden; }
.gp-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.1rem; border-bottom:1px solid var(--gp-gray-200); }
.gp-modal-header h3 { font-family:'Comfortaa',cursive; font-size:.95rem; font-weight:700; color:var(--gp-gray-800); margin:0; }
.gp-modal-close { background:none; border:none; font-size:1.3rem; line-height:1; cursor:pointer; color:var(--gp-gray-400); transition:color var(--gp-transition); }
.gp-modal-close:hover { color:var(--gp-red); }
.gp-modal-body { padding:1.1rem; display:flex; flex-direction:column; align-items:center; gap:.85rem; }
.gp-modal-preview-wrap { width:160px; height:160px; border-radius:.65rem; overflow:hidden; background:var(--gp-gray-100); border:2px solid var(--gp-orange-light); display:flex; align-items:center; justify-content:center; }
.gp-modal-preview-wrap img { width:100%; height:100%; object-fit:cover; display:none; }
.gp-modal-preview-wrap img.gp-show { display:block; }
.gp-modal-preview-wrap i { font-size:2.6rem; color:var(--gp-orange); }
.gp-upload-btn { font-family:'Comfortaa',cursive; font-size:.78rem; font-weight:600; padding:.5rem 1rem; border-radius:.5rem; background:var(--gp-orange-light); color:var(--gp-orange-dk); cursor:pointer; border:1px solid var(--gp-orange); transition:background var(--gp-transition); }
.gp-upload-btn:hover { background:#fde3bd; }
.gp-file-info { font-size:.68rem; color:var(--gp-gray-600); text-align:center; min-height:1rem; margin:0; }
.gp-modal-footer { display:flex; gap:.6rem; padding:1rem 1.1rem; border-top:1px solid var(--gp-gray-200); }
.gp-btn { flex:1; font-family:'Comfortaa',cursive; font-size:.8rem; font-weight:600; padding:.5rem .9rem; border-radius:.5rem; cursor:pointer; border:1px solid transparent; text-align:center; transition:all var(--gp-transition); }
.gp-btn--ghost { background:var(--gp-gray-100); color:var(--gp-gray-800); border-color:var(--gp-gray-200); }
.gp-btn--ghost:hover { background:var(--gp-gray-200); }
.gp-btn--primary { background:var(--gp-orange); color:white; }
.gp-btn--primary:hover { background:var(--gp-orange-dk); }
.gp-btn:disabled { opacity:.5; cursor:not-allowed; }

#galeria-professores ::-webkit-scrollbar { width:5px; height:5px; }
#galeria-professores ::-webkit-scrollbar-track { background:var(--gp-gray-100); }
#galeria-professores ::-webkit-scrollbar-thumb { background:var(--gp-gray-400); border-radius:4px; }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────────
  // HTML
  // ─────────────────────────────────────────────────────────────
  function injectHTML() {
    const root = $root();
    if (!root) return;
    root.innerHTML = `
<div class="gp-toolbar">
  <div class="gp-search">
    <i class="fas fa-search"></i>
    <input type="text" id="gp-busca" class="gp-input" placeholder="Buscar professor pelo nome...">
  </div>
  <span id="gp-contador" class="gp-contador"></span>
</div>
<div id="gp-grid" class="gp-grid"></div>

<div id="gp-modalOverlay" class="gp-modal-overlay" style="display:none">
  <div class="gp-modal">
    <div class="gp-modal-header">
      <h3 id="gp-modalNome">Professor</h3>
      <button id="gp-modalClose" class="gp-modal-close" type="button">&times;</button>
    </div>
    <div class="gp-modal-body">
      <div class="gp-modal-preview-wrap">
        <img id="gp-modalPreview" alt="Foto do professor">
        <i id="gp-modalIconeFallback" class="fas fa-user"></i>
      </div>
      <label class="gp-upload-btn" for="gp-fileInput"><i class="fas fa-camera" style="margin-right:.35rem"></i>Escolher foto</label>
      <input type="file" id="gp-fileInput" accept="image/*" style="display:none">
      <p id="gp-fileInfo" class="gp-file-info"></p>
    </div>
    <div class="gp-modal-footer">
      <button id="gp-btnCancelar" class="gp-btn gp-btn--ghost" type="button">Cancelar</button>
      <button id="gp-btnSalvar" class="gp-btn gp-btn--primary" type="button" disabled>Salvar foto</button>
    </div>
  </div>
</div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  function filtrarProfessores() {
    const termo = normalizeStr(S.termoBusca);
    const ativos = S.professores.filter(isAtivo);
    if (!termo) return ativos;
    return ativos.filter(p => normalizeStr(getField(p, 'nome')).includes(termo));
  }

  function renderGrid(lista) {
    const grid = $id('gp-grid');
    const contador = $id('gp-contador');
    if (!grid) return;

    if (contador) contador.textContent = `${lista.length} professor(es)`;

    if (!lista.length) {
      grid.innerHTML = `
        <div class="gp-empty">
          <i class="fas fa-chalkboard-user"></i>
          <p>Nenhum professor encontrado.</p>
        </div>`;
      return;
    }

    grid.innerHTML = lista.map(p => cardHTML(p)).join('');
    grid.querySelectorAll('.gp-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const prof = S.professores.find(p => p.id === id);
        if (prof) abrirModal(prof);
      });
    });
  }

  function cardHTML(p) {
    const nome = getField(p, 'nome') || 'Sem nome';
    const foto = getField(p, CFG.campoFoto);
    const imgOuFallback = foto
      ? `<img src="${foto}" alt="${escapeHtml(nome)}">`
      : `<div class="gp-card__fallback"><i class="fas fa-user"></i></div>`;

    return `
      <div class="gp-card" data-id="${p.id}">
        <div class="gp-card__img-box">${imgOuFallback}</div>
        <div class="gp-card__label"><span>${escapeHtml(nome)}</span></div>
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────
  // MODAL — envio de foto
  // ─────────────────────────────────────────────────────────────
  function abrirModal(prof) {
    S.profSelecionado = prof;
    S.pendingDataURL = null;

    $id('gp-modalNome').textContent = getField(prof, 'nome') || 'Professor';

    const foto = getField(prof, CFG.campoFoto);
    const img = $id('gp-modalPreview');
    const icone = $id('gp-modalIconeFallback');
    if (foto) {
      img.src = foto; img.classList.add('gp-show'); icone.style.display = 'none';
    } else {
      img.src = ''; img.classList.remove('gp-show'); icone.style.display = 'block';
    }

    $id('gp-fileInput').value = '';
    $id('gp-fileInfo').textContent = '';
    $id('gp-btnSalvar').disabled = true;
    $id('gp-btnSalvar').textContent = 'Salvar foto';

    $id('gp-modalOverlay').style.display = 'flex';
  }

  function fecharModal() {
    $id('gp-modalOverlay').style.display = 'none';
    S.profSelecionado = null;
    S.pendingDataURL = null;
  }

  function resizeImageToDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file.type || !file.type.startsWith('image/')) {
        reject(new Error('Selecione um arquivo de imagem válido.')); return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
        img.onload = () => {
          const maxDim = CFG.maxDim;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
            else { width = Math.round(width * (maxDim / height)); height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', CFG.jpegQuality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function onFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const info = $id('gp-fileInfo');
    const btnSalvar = $id('gp-btnSalvar');
    btnSalvar.disabled = true;
    info.textContent = 'Processando imagem...';
    try {
      const dataURL = await resizeImageToDataURL(file);
      S.pendingDataURL = dataURL;

      const img = $id('gp-modalPreview');
      img.src = dataURL; img.classList.add('gp-show');
      $id('gp-modalIconeFallback').style.display = 'none';

      const kb = Math.round(dataURL.length / 1024);
      info.textContent = kb > (CFG.limiteAviso / 1024)
        ? `Pronto (${kb} KB — imagem grande, pode demorar um pouco a salvar)`
        : `Pronto para salvar (${kb} KB)`;
      btnSalvar.disabled = false;
    } catch (err) {
      info.textContent = '';
      toast(err.message || 'Erro ao processar imagem.', 'error');
    }
  }

  async function salvarFoto() {
    if (!S.profSelecionado || !S.pendingDataURL) return;
    const btn = $id('gp-btnSalvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await S.db.collection(CFG.colProfessores).doc(S.profSelecionado.id).update({
        [CFG.campoFoto]: S.pendingDataURL,
        [CFG.campoFotoEm]: Date.now(),
      });

      const idx = S.professores.findIndex(p => p.id === S.profSelecionado.id);
      if (idx > -1) S.professores[idx][CFG.campoFoto] = S.pendingDataURL;

      renderGrid(filtrarProfessores());
      toast('Foto atualizada com sucesso!', 'success');
      fecharModal();
    } catch (err) {
      toast('Erro ao salvar foto: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Salvar foto';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EVENTOS
  // ─────────────────────────────────────────────────────────────
  function initEventos() {
    $id('gp-busca')?.addEventListener('input', debounce(e => {
      S.termoBusca = e.target.value;
      renderGrid(filtrarProfessores());
    }, 200));

    $id('gp-fileInput')?.addEventListener('change', onFileChange);
    $id('gp-btnSalvar')?.addEventListener('click', salvarFoto);
    $id('gp-btnCancelar')?.addEventListener('click', fecharModal);
    $id('gp-modalClose')?.addEventListener('click', fecharModal);
    $id('gp-modalOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'gp-modalOverlay') fecharModal();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // INIT — ponto de entrada público
  // ─────────────────────────────────────────────────────────────
  async function init() {
    if (!$root()) { console.warn('GaleriaProfessores: #galeria-professores não encontrado.'); return; }

    injectStyles();
    injectHTML();
    initEventos();

    if (!S.db && !initFirebase()) {
      toast('Falha ao conectar com o Firebase.', 'error');
      return;
    }

    const grid = $id('gp-grid');
    if (grid) grid.innerHTML = `<div class="gp-empty"><i class="fas fa-spinner fa-spin"></i><p>Carregando professores...</p></div>`;

    try {
      if (!S.carregado) {
        S.professores = await fetchProfessores();
        S.carregado = true;
      }
      renderGrid(filtrarProfessores());
    } catch (err) {
      console.error('❌ GaleriaProfessores — erro ao carregar professores:', err);
      if (grid) grid.innerHTML = `<div class="gp-empty"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar professores: ${escapeHtml(err.message)}</p></div>`;
    }
  }

  return { init };
})();

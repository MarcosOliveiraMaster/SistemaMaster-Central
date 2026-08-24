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
    campoBairros:     'bairros',      // string livre (mesmo campo usado em BD Professores)
    campoDisciplinas: 'disciplinas',  // string ou array (idem)
    maxDim:        480,               // maior lado da imagem redimensionada (px)
    jpegQuality:   0.82,
    limiteAviso:   700 * 1024,        // aviso se o base64 passar disso (~700KB)
    // mesma lista fixa usada em BD Professores (functions-dashboardProfessor.js)
    disciplinasFixas: ['Ciências', 'Física', 'Geografia', 'História', 'Inglês', 'Literatura', 'Matemática', 'Pedagogia', 'Português', 'Química', 'Biologia'],
    // rótulos — mesmos de BD Professores (CFG.defaultMasks)
    masks: {
      nome: 'Nome', cpf: 'CPF', email: 'E-mail', contato: 'Telefone', apelido: 'Apelido',
      endereco: 'Endereço', nivel: 'Nível Acadêmico', descricaoExpAulas: 'Descrição — Aulas',
      bairros: 'Bairros de acesso', disciplinas: 'Disciplinas', curso: 'Curso e Instituição',
      descricaoExpNeuro: 'Descrição — Alunos Atípicos', descricaoTdics: 'Descrição — TDICs', pix: 'Chave Pix',
      dataNascimento: 'Data de Nascimento',
    },
    diasSemana: [
      { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terça' }, { key: 'qua', label: 'Quarta' },
      { key: 'qui', label: 'Quinta' }, { key: 'sex', label: 'Sexta' }, { key: 'sab', label: 'Sábado' },
    ],
  };

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  const S = {
    db: null,
    professores: [],
    carregado: false,
    termoNome: '',
    termoBairro: '',
    discsSelecionadas: [],
    slotsSelecionados: [],
    filtroRapido: 'todos', // 'todos' | 'tdics' | 'neuro'
    profSelecionado: null,
    pendingDataURL: null,
    // modal contrato (vínculo/desligamento) — porta a lógica de BD Professores
    desligamentoSelecionados: [],
    // modal desligar professores (novo)
    detalhesTabAtiva: 'gp-det-aulas',
    detProfSelecionado: null,
    detDiscSelecionadas: [],
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
  function $qa(sel) { return Array.from(document.querySelectorAll(sel)); }

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

  // mesma semântica de BD Professores: aceita boolean, "sim"/"true"/1 etc.
  function formatCPF(v) {
    const n = String(v || '').replace(/\D/g, '');
    return n.length === 11 ? n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v || '');
  }

  function formatTel(v) {
    const n = String(v || '').replace(/\D/g, '');
    if (n.length === 11) return n.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2.$3-$4');
    if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return v || '';
  }

  function isTruthy(v) {
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    if (Array.isArray(v)) return v.some(isTruthy);
    return ['true', '1', 'sim', 's', 'yes', 'on'].includes(String(v).toLowerCase().trim());
  }

  // aceita array ou string separada por , ; | /
  function listaDisciplinas(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map(x => normalizeStr(String(x))).filter(Boolean);
    return String(raw).split(/[,;|/]/).map(s => normalizeStr(s)).filter(Boolean);
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

/* ── canal de filtros (3 colunas iguais) ── */
.gp-filterbar { display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; padding:1rem; background:white; border-bottom:1px solid var(--gp-gray-200); flex-shrink:0; position:sticky; top:0; z-index:20; }
.gp-filter-col { display:flex; flex-direction:column; gap:.55rem; min-width:0; }
/* cada linha da coluna 1/2 cresce para preencher a altura total da coluna —
   que por sua vez acompanha a altura natural da tabela de disponibilidade
   (colunas de um grid esticam para a altura da linha mais alta por padrão).
   flex-basis "auto" preserva a altura natural em telas estreitas, onde as
   3 colunas empilham e não há uma linha mais alta pra acompanhar. */
.gp-filter-col > * { flex:1 1 auto; min-height:0; }

.gp-field { position:relative; display:flex; }
.gp-field > i { position:absolute; left:.75rem; top:50%; transform:translateY(-50%); color:var(--gp-gray-400); font-size:.85rem; z-index:1; pointer-events:none; }
.gp-field input, .gp-field-btn { width:100%; flex:1; font-family:'Lexend',sans-serif; font-size:.85rem; border:1px solid var(--gp-gray-200); border-radius:.6rem; padding:.55rem .75rem .55rem 2.1rem; background:var(--gp-gray-50); color:var(--gp-gray-800); transition:border-color var(--gp-transition), box-shadow var(--gp-transition), background var(--gp-transition); }
.gp-field input:focus, .gp-field-btn:focus, .gp-field-btn.gp-open { outline:none; border-color:var(--gp-orange); box-shadow:0 0 0 3px rgba(242,135,5,.12); background:white; }
.gp-field-btn { display:flex; align-items:center; text-align:left; cursor:pointer; color:var(--gp-gray-600); }
.gp-field-btn.gp-has-value { color:var(--gp-gray-800); font-weight:600; }
.gp-field-btn .gp-chev { margin-left:auto; color:var(--gp-gray-400); transition:transform .2s ease; }
.gp-field-btn.gp-open .gp-chev { transform:rotate(180deg); }

.gp-dropdown-panel { position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:60; background:white; border:1px solid var(--gp-gray-200); border-radius:.6rem; box-shadow:var(--gp-shadow); padding:.4rem; display:none; }
.gp-dropdown-panel.gp-open { display:block; }
.gp-dropdown-search { position:relative; margin-bottom:.3rem; }
.gp-dropdown-search i { position:absolute; left:.6rem; top:50%; transform:translateY(-50%); color:var(--gp-gray-400); font-size:.7rem; }
.gp-dropdown-search input { width:100%; font-family:'Lexend',sans-serif; font-size:.78rem; border:1px solid var(--gp-gray-200); border-radius:.4rem; padding:.35rem .5rem .35rem 1.7rem; }
.gp-dropdown-search input:focus { outline:none; border-color:var(--gp-orange); }
.gp-dropdown-list { max-height:180px; overflow-y:auto; }
.gp-dropdown-empty { padding:.5rem; font-size:.75rem; color:var(--gp-gray-400); text-align:center; }
/* coluna do checkbox = 10% da linha, label ocupa o restante */
.gp-dropdown-item { display:grid; grid-template-columns:10% 1fr; align-items:center; text-align:left; padding:.4rem .5rem; border-radius:.4rem; font-size:.8rem; cursor:pointer; }
.gp-dropdown-item:hover { background:var(--gp-gray-50); }
.gp-dropdown-item input { accent-color:var(--gp-orange); width:14px; height:14px; margin:0; justify-self:start; }
.gp-dropdown-item span { text-align:left; }

.gp-more-btn { justify-content:flex-start; }
.gp-more-btn > i { position:static; margin-right:.55rem; transform:none; }

.gp-more-panel { position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:60; background:white; border:1px solid var(--gp-gray-200); border-radius:.6rem; box-shadow:var(--gp-shadow); padding:.5rem; display:none; flex-direction:column; gap:.3rem; }
.gp-more-panel.gp-open { display:flex; }
.gp-more-panel .gp-btn { width:100%; justify-content:flex-start; display:flex; align-items:center; gap:.5rem; }
.gp-more-panel .gp-btn i { width:16px; text-align:center; }
/* esconde a engrenagem que authProfessores.js injeta ao lado de #dp-btnGerarContrato —
   aqui usamos nosso próprio botão "Atualizar Permissões", com rótulo explícito */
.gp-more-panel #configuracao { display:none !important; }
.gp-more-section-title { font-size:.63rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--gp-gray-400); padding:.2rem .5rem 0; }
.gp-more-divider { border-top:1px solid var(--gp-gray-200); margin:.35rem 0; }
.gp-more-radio { width:100%; display:flex; align-items:center; gap:.5rem; text-align:left; padding:.45rem .6rem; border-radius:.4rem; border:1px solid transparent; background:none; font-family:'Lexend',sans-serif; font-size:.8rem; color:var(--gp-gray-800); cursor:pointer; }
.gp-more-radio:hover { background:var(--gp-gray-50); }
.gp-more-radio.gp-active { background:var(--gp-orange-light); color:var(--gp-orange-dk); font-weight:600; border-color:var(--gp-orange); }
.gp-more-radio i { width:16px; text-align:center; }
.gp-btn--info { background:#2563eb; color:white; }
.gp-btn--info:hover { background:#1d4ed8; }

.gp-avail-wrap { overflow-x:auto; }
.gp-avail-table { border-collapse:separate; border-spacing:3px; width:100%; min-width:250px; }
.gp-avail-table th, .gp-avail-table td { text-align:center; padding:0; }
.gp-avail-table th { font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:white; background:var(--gp-orange); padding:.3rem .1rem; border-radius:.35rem; }
.gp-avail-table th:first-child { background:transparent; }
.gp-avail-th-period { text-align:left; font-size:.68rem; font-weight:700; color:var(--gp-gray-600); background:var(--gp-gray-100); padding:.4rem .5rem; border-radius:.35rem; white-space:nowrap; }
.gp-avail-table td.gp-cell { background:var(--gp-gray-50); border-radius:.35rem; padding:.45rem 0; }
.gp-avail-table input[type=checkbox] { width:15px; height:15px; accent-color:var(--gp-orange); cursor:pointer; }

.gp-toolbar { display:flex; align-items:center; gap:.6rem; padding:.6rem 1rem; background:white; border-bottom:1px solid var(--gp-gray-200); flex-shrink:0; }
.gp-search { position:relative; flex:1; max-width:420px; }
.gp-search i { position:absolute; left:.75rem; top:50%; transform:translateY(-50%); color:var(--gp-gray-400); font-size:.85rem; }
.gp-input { width:100%; font-family:'Lexend',sans-serif; font-size:.85rem; border:1px solid var(--gp-gray-200); border-radius:.6rem; padding:.55rem .75rem .55rem 2.1rem; background:var(--gp-gray-50); transition:border-color var(--gp-transition), box-shadow var(--gp-transition); }
.gp-input:focus { outline:none; border-color:var(--gp-orange); box-shadow:0 0 0 3px rgba(242,135,5,.12); background:white; }
.gp-contador { font-size:.75rem; color:var(--gp-gray-600); white-space:nowrap; }
.gp-clear { font-size:.75rem; color:var(--gp-orange-dk); background:none; border:none; cursor:pointer; font-weight:600; margin-left:auto; padding:.2rem .3rem; display:none; }
.gp-clear.gp-show { display:inline-block; }
.gp-clear:hover { text-decoration:underline; }

@media (max-width: 860px) {
  .gp-filterbar { grid-template-columns: 1fr; }
}

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
.gp-btn--success { background:#16a34a; color:white; }
.gp-btn--success:hover { background:#15803d; }
.gp-btn--danger { background:var(--gp-red); color:white; }
.gp-btn--danger:hover { background:#b91c1c; }
.gp-btn:disabled { opacity:.5; cursor:not-allowed; }

/* ── ícone de câmera sobre o card (abre o modal de foto sem abrir Detalhes) ── */

/* ── modal Gerar Contrato (portado de BD Professores) ── */
.gp-modalC-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:9500; animation:gpFadeIn .15s ease; padding:1rem; }
.gp-modalC-overlay.gp-open { display:flex; }
.gp-modalC { background:white; border-radius:1rem; box-shadow:0 24px 48px rgba(0,0,0,.2); width:100%; max-width:600px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
.gp-modalC-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid var(--gp-gray-200); }
.gp-modalC-header h2 { font-size:1.1rem; font-weight:700; margin:0; color:var(--gp-gray-800); }
.gp-modalC-tabs { display:flex; border-bottom:1px solid var(--gp-gray-200); }
.gp-modalC-tab { flex:1; padding:.75rem 1rem; font-family:'Comfortaa',cursive; font-size:.85rem; font-weight:600; border:none; cursor:pointer; background:var(--gp-gray-50); color:var(--gp-gray-600); border-bottom:3px solid transparent; }
.gp-modalC-tab.gp-active { background:white; color:var(--gp-orange); border-bottom-color:var(--gp-orange); }
.gp-modalC-body { flex:1; overflow-y:auto; padding:1rem 1.25rem; }
.gp-modalC-panel { display:none; }
.gp-modalC-panel.gp-active { display:block; }
.gp-modalC-marcarTodos { display:flex; align-items:center; gap:.5rem; padding:.5rem .75rem; background:var(--gp-gray-50); border-radius:.5rem; margin-bottom:.75rem; cursor:pointer; font-size:.8rem; font-weight:600; color:var(--gp-gray-600); }
.gp-modalC-lista { display:flex; flex-direction:column; gap:.35rem; max-height:320px; overflow-y:auto; }
.gp-modalC-item { display:flex; align-items:center; gap:.6rem; padding:.5rem .75rem; border-radius:.5rem; cursor:pointer; font-size:.82rem; }
.gp-modalC-item:hover { background:var(--gp-gray-50); }
.gp-modalC-busca { position:relative; margin-bottom:.75rem; }
.gp-modalC-autocomplete { position:absolute; top:100%; left:0; right:0; background:white; border:1px solid var(--gp-gray-200); border-radius:.5rem; box-shadow:var(--gp-shadow); max-height:200px; overflow-y:auto; z-index:100; margin-top:.25rem; display:none; }
.gp-modalC-autocomplete.gp-open { display:block; }
.gp-modalC-autocomplete-item { padding:.5rem .75rem; cursor:pointer; font-size:.82rem; }
.gp-modalC-autocomplete-item:hover { background:var(--gp-gray-50); }
.gp-modalC-selecionado { padding:.5rem .75rem; background:var(--gp-orange-light); border-radius:.5rem; font-size:.82rem; display:flex; align-items:center; justify-content:space-between; margin-bottom:.35rem; }
.gp-modalC-selecionado button { background:none; border:none; color:var(--gp-red); cursor:pointer; font-size:.9rem; }
.gp-modalC-motivo { display:flex; align-items:center; gap:.6rem; padding:.5rem .75rem; border-radius:.5rem; font-size:.82rem; cursor:pointer; }
.gp-modalC-footer { padding:1rem 1.25rem; border-top:1px solid var(--gp-gray-200); }
.gp-modalC-footer .gp-btn { width:100%; }

/* ── modal Desligar Professores (novo) ── */
.gp-modalD-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:9500; animation:gpFadeIn .15s ease; padding:1rem; }
.gp-modalD-overlay.gp-open { display:flex; }
.gp-modalD { background:white; border-radius:1rem; box-shadow:0 24px 48px rgba(0,0,0,.2); width:100%; max-width:420px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden; }

/* ── modal Detalhes Professor (novo) ── */
.gp-det-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:9500; animation:gpFadeIn .15s ease; padding:1rem; }
.gp-det-overlay.gp-open { display:flex; }
.gp-det { background:white; border-radius:1rem; box-shadow:0 24px 48px rgba(0,0,0,.2); width:100%; max-width:560px; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
.gp-det-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid var(--gp-gray-200); }
.gp-det-header h2 { font-size:1.05rem; font-weight:700; margin:0; color:var(--gp-gray-800); }
.gp-det-tabs { display:flex; border-bottom:1px solid var(--gp-gray-200); flex-shrink:0; }
.gp-det-tab { flex:1; padding:.7rem .5rem; font-family:'Comfortaa',cursive; font-size:.8rem; font-weight:600; border:none; cursor:pointer; background:var(--gp-gray-50); color:var(--gp-gray-600); border-bottom:3px solid transparent; }
.gp-det-tab.gp-active { background:white; color:var(--gp-orange); border-bottom-color:var(--gp-orange); }
.gp-det-body { flex:1; overflow-y:auto; padding:1.1rem 1.25rem; }
.gp-det-panel { display:none; flex-direction:column; gap:.9rem; }
.gp-det-panel.gp-active { display:flex; }
.gp-det-secao h4 { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--gp-gray-600); margin:0 0 .4rem; }
.gp-det-grid { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }
.gp-info-card { position:relative; background:var(--gp-gray-50); border:1px solid var(--gp-gray-200); border-radius:.5rem; padding:.5rem .65rem; display:flex; flex-direction:column; gap:.15rem; }
.gp-info-card--full { grid-column:1/-1; }
.gp-info-label { font-size:.63rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--gp-gray-400); }
.gp-info-value { font-size:.82rem; color:var(--gp-gray-800); font-weight:500; word-break:break-word; white-space:pre-wrap; }
.gp-det-input { display:block; width:100%; font-family:'Lexend',sans-serif; font-size:.82rem; color:var(--gp-gray-800); font-weight:500; border:1px solid transparent; background:transparent; border-radius:.35rem; padding:.15rem .3rem; margin:0 -.3rem; }
.gp-det-input:hover { background:var(--gp-gray-100); }
.gp-det-input:focus { outline:none; border-color:var(--gp-orange); background:white; box-shadow:0 0 0 3px rgba(242,135,5,.12); }
textarea.gp-det-input { resize:vertical; min-height:60px; }
.gp-det-footer { padding:.85rem 1.25rem; border-top:1px solid var(--gp-gray-200); flex-shrink:0; }
.gp-det-footer .gp-btn { width:100%; }
.gp-avail-summary { display:flex; flex-wrap:wrap; gap:.35rem; }
.gp-avail-chip { background:var(--gp-orange-light); color:var(--gp-orange-dk); border-radius:999px; padding:.2rem .65rem; font-size:.7rem; font-weight:600; }
.gp-det-empty { text-align:center; color:var(--gp-gray-400); padding:2.5rem 1rem; font-size:.85rem; }

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
<div class="gp-filterbar">
  <!-- Parte 1: nome + disciplinas -->
  <div class="gp-filter-col">
    <div class="gp-field">
      <i class="fas fa-search"></i>
      <input type="text" id="gp-fNome" placeholder="Buscar professor pelo nome...">
    </div>
    <div class="gp-field" id="gp-discWrap">
      <i class="fas fa-book"></i>
      <button type="button" class="gp-field-btn" id="gp-discBtn">
        <span id="gp-discLabel">Disciplinas</span>
        <i class="fas fa-chevron-down gp-chev"></i>
      </button>
      <div class="gp-dropdown-panel" id="gp-discPanel"></div>
    </div>
  </div>

  <!-- Parte 2: bairro + mais filtros -->
  <div class="gp-filter-col">
    <div class="gp-field">
      <i class="fas fa-map-marker-alt"></i>
      <input type="text" id="gp-fBairro" placeholder="Buscar por bairro...">
    </div>
    <div class="gp-field" id="gp-maisWrap">
      <button type="button" class="gp-field-btn gp-more-btn" id="gp-btnMaisFiltros">
        <i class="fas fa-sliders-h"></i>
        <span>Mais filtros e configurações</span>
      </button>
      <div class="gp-more-panel" id="gp-maisPanel">
        <span class="gp-more-section-title">Filtros</span>
        <button type="button" class="gp-more-radio gp-active" id="gp-radioTodos" data-quick="todos"><i class="fas fa-users"></i>Todos os professores</button>
        <button type="button" class="gp-more-radio" id="gp-radioTdics" data-quick="tdics"><i class="fas fa-laptop"></i>Tecnologias Educacionais</button>
        <button type="button" class="gp-more-radio" id="gp-radioNeuro" data-quick="neuro"><i class="fas fa-puzzle-piece"></i>Alunos Neurodivergentes</button>
        <div class="gp-more-divider"></div>
        <span class="gp-more-section-title">Configurações</span>
        <button type="button" class="gp-btn gp-btn--info" id="dp-btnGerarContrato"><i class="fas fa-file-contract"></i>Gerar Contrato</button>
        <button type="button" class="gp-btn gp-btn--success" id="gp-btnAtualizarPermissoes"><i class="fas fa-shield-alt"></i>Atualizar Permissões</button>
        <button type="button" class="gp-btn gp-btn--danger" id="gp-btnDesligar"><i class="fas fa-user-slash"></i>Desligar Professores</button>
      </div>
    </div>
  </div>

  <!-- Parte 3: disponibilidade (dia x turno) -->
  <div class="gp-filter-col">
    <div class="gp-avail-wrap">
      <table class="gp-avail-table" id="gp-availTable">
        <thead>
          <tr><th></th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sáb</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="gp-avail-th-period">Manhã</td>
            <td class="gp-cell"><input type="checkbox" data-slot="segManha"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="terManha"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="quaManha"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="quiManha"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="sexManha"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="sabManha"></td>
          </tr>
          <tr>
            <td class="gp-avail-th-period">Tarde</td>
            <td class="gp-cell"><input type="checkbox" data-slot="segTarde"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="terTarde"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="quaTarde"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="quiTarde"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="sexTarde"></td>
            <td class="gp-cell"><input type="checkbox" data-slot="sabTarde"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="gp-toolbar">
  <span id="gp-contador" class="gp-contador"></span>
  <button type="button" class="gp-clear" id="gp-btnLimpar">Limpar filtros</button>
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

<!-- Gerar Contrato — portado de BD Professores (vínculo funcional / desligamento é placeholder lá também) -->
<div id="gp-modalContratoOverlay" class="gp-modalC-overlay">
  <div class="gp-modalC">
    <div class="gp-modalC-header">
      <h2><i class="fas fa-file-contract" style="margin-right:.5rem;color:var(--gp-orange)"></i>Gerar Contrato</h2>
      <button id="gp-modalContratoClose" class="gp-modal-close" type="button">&times;</button>
    </div>
    <div class="gp-modalC-tabs">
      <button class="gp-modalC-tab gp-active" data-panel="vinculo" type="button">Contratação e Renovação</button>
      <button class="gp-modalC-tab" data-panel="desligamento" type="button">Desligamento</button>
    </div>
    <div class="gp-modalC-body">
      <div id="gp-panelVinculo" class="gp-modalC-panel gp-active">
        <label class="gp-modalC-marcarTodos">
          <input type="checkbox" id="gp-marcarTodosProfessores"> Marcar todos
        </label>
        <div id="gp-listaProfessoresVinculo" class="gp-modalC-lista"></div>
      </div>
      <div id="gp-panelDesligamento" class="gp-modalC-panel">
        <div class="gp-modalC-busca">
          <input type="text" id="gp-buscaProfessorDesligamento" class="gp-input" placeholder="Buscar professor para desligamento...">
          <div id="gp-autocompleteProfessor" class="gp-modalC-autocomplete"></div>
        </div>
        <div id="gp-professorSelecionadoDesligamento"></div>
        <div id="gp-motivosDesligamento" style="display:none">
          <p style="font-size:.78rem;color:var(--gp-gray-600);margin-bottom:.5rem;font-weight:600">Motivos do desligamento:</p>
          ${['Baixo desempenho', 'Falta de comprometimento', 'Pedido de desligamento', 'Quebra de contrato', 'Indisponibilidade de horários', 'Outros motivos'].map(m => `
          <label class="gp-modalC-motivo"><input type="checkbox" name="gp-motivoDesligamento" value="${m}"> ${m}</label>`).join('')}
          <textarea id="gp-observacoesDesligamento" class="gp-input" placeholder="Observações adicionais..." style="width:100%;min-height:70px;margin-top:.6rem;resize:vertical"></textarea>
        </div>
      </div>
    </div>
    <div class="gp-modalC-footer">
      <button id="gp-btnGerarContratoVinculo" class="gp-btn gp-btn--success" type="button"><i class="fas fa-file-signature" style="margin-right:.4rem"></i>Gerar Contrato de Vínculo</button>
      <button id="gp-btnGerarContratoDesligamento" class="gp-btn gp-btn--danger" type="button" style="display:none"><i class="fas fa-file-signature" style="margin-right:.4rem"></i>Gerar Contrato de Desligamento</button>
    </div>
  </div>
</div>

<!-- Desligar Professores — novo: muda status para Desligado de vez -->
<div id="gp-modalDesligarOverlay" class="gp-modalD-overlay">
  <div class="gp-modalD">
    <div class="gp-modalC-header">
      <h2><i class="fas fa-user-slash" style="margin-right:.5rem;color:var(--gp-red)"></i>Desligar Professores</h2>
      <button id="gp-modalDesligarClose" class="gp-modal-close" type="button">&times;</button>
    </div>
    <div class="gp-modalC-body">
      <label class="gp-modalC-marcarTodos">
        <input type="checkbox" id="gp-marcarTodosDesligar"> Marcar todos
      </label>
      <div id="gp-listaDesligar" class="gp-modalC-lista"></div>
    </div>
    <div class="gp-modalC-footer">
      <button id="gp-btnConfirmarDesligar" class="gp-btn gp-btn--danger" type="button"><i class="fas fa-user-slash" style="margin-right:.4rem"></i>Desligar selecionados</button>
    </div>
  </div>
</div>

<!-- Detalhes Professor — novo: 3 abas (Aulas / Perfil / Avaliação de Desempenho) -->
<div id="gp-detOverlay" class="gp-det-overlay">
  <div class="gp-det">
    <div class="gp-det-header">
      <h2 id="gp-detNome">Professor</h2>
      <button id="gp-detClose" class="gp-modal-close" type="button">&times;</button>
    </div>
    <div class="gp-det-tabs">
      <button class="gp-det-tab gp-active" data-detpanel="gp-det-aulas" type="button">Aulas</button>
      <button class="gp-det-tab" data-detpanel="gp-det-perfil" type="button">Perfil</button>
      <button class="gp-det-tab" data-detpanel="gp-det-avaliacao" type="button">Avaliação de Desempenho</button>
    </div>
    <div class="gp-det-body">
      <div id="gp-det-aulas" class="gp-det-panel gp-active"></div>
      <div id="gp-det-perfil" class="gp-det-panel"></div>
      <div id="gp-det-avaliacao" class="gp-det-panel">
        <div class="gp-det-empty"><i class="fas fa-chart-line" style="font-size:1.8rem;display:block;margin-bottom:.5rem"></i>Em breve — gráficos de desempenho.</div>
      </div>
    </div>
    <div class="gp-det-footer">
      <button type="button" class="gp-btn gp-btn--primary" id="gp-btnSalvarDetalhes"><i class="fas fa-save" style="margin-right:.4rem"></i>Salvar alterações</button>
    </div>
  </div>
</div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  function filtroAtivo() {
    return !!(S.termoNome || S.termoBairro || S.discsSelecionadas.length || S.slotsSelecionados.length || S.filtroRapido !== 'todos');
  }

  // Combinação entre grupos: E (nome E disciplina E bairro E disponibilidade E filtro rápido).
  // Dentro de disciplinas: E — professor precisa lecionar TODAS as marcadas (mesma
  // convenção já usada no filtro de disciplinas da aba BD Professores).
  // Dentro de disponibilidade: E — professor precisa atender TODOS os horários marcados.
  function filtrarProfessores() {
    const termoNome = normalizeStr(S.termoNome);
    const termoBairro = normalizeStr(S.termoBairro);
    const discs = S.discsSelecionadas.map(normalizeStr);
    const slots = S.slotsSelecionados;

    return S.professores.filter(isAtivo).filter(p => {
      if (termoNome && !normalizeStr(getField(p, 'nome')).includes(termoNome)) return false;
      if (termoBairro && !normalizeStr(getField(p, CFG.campoBairros)).includes(termoBairro)) return false;
      if (discs.length) {
        const lista = listaDisciplinas(getField(p, CFG.campoDisciplinas));
        if (!discs.every(d => lista.includes(d))) return false;
      }
      if (slots.length && !slots.every(s => isTruthy(getField(p, s)))) return false;
      if (S.filtroRapido === 'tdics' && !isTruthy(getField(p, 'expTdics'))) return false;
      if (S.filtroRapido === 'neuro' && !isTruthy(getField(p, 'expNeuro'))) return false;
      return true;
    }).sort((a, b) => (getField(a, 'nome') || '').localeCompare(getField(b, 'nome') || '', 'pt-BR'));
  }

  function renderGrid(lista) {
    const grid = $id('gp-grid');
    const contador = $id('gp-contador');
    if (!grid) return;

    const total = S.professores.filter(isAtivo).length;
    if (contador) contador.textContent = `${lista.length} de ${total} professor(es)`;
    $id('gp-btnLimpar')?.classList.toggle('gp-show', filtroAtivo());

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
      const id = card.getAttribute('data-id');
      card.addEventListener('click', () => {
        const prof = S.professores.find(p => p.id === id);
        if (prof) abrirDetalhes(prof);
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
  // DETALHES PROFESSOR — modal com 3 abas (Aulas / Perfil / Avaliação)
  // ─────────────────────────────────────────────────────────────
  // campo de texto editável, no formato "card" (rótulo em cima, valor embaixo)
  function campoTexto(key, label, valor, opts) {
    opts = opts || {};
    const full = opts.full ? ' gp-info-card--full' : '';
    const tag = opts.textarea
      ? `<textarea class="gp-det-input" data-field="${key}" rows="3">${escapeHtml(valor || '')}</textarea>`
      : `<input type="text" class="gp-det-input" data-field="${key}" value="${escapeHtml(valor || '')}">`;
    return `<div class="gp-info-card${full}">
      <span class="gp-info-label">${escapeHtml(label)}</span>
      ${tag}
    </div>`;
  }

  // mesma tabela (dia x turno) usada no filtro, agora editável
  function tabelaDisponibilidade(p) {
    const linha = turno => CFG.diasSemana.map(d =>
      `<td class="gp-cell"><input type="checkbox" data-slot="${d.key}${turno}" ${isTruthy(getField(p, d.key + turno)) ? 'checked' : ''}></td>`
    ).join('');
    return `
      <div class="gp-avail-wrap">
        <table class="gp-avail-table">
          <thead><tr><th></th>${CFG.diasSemana.map(d => `<th>${d.label.slice(0, 3)}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><td class="gp-avail-th-period">Manhã</td>${linha('Manha')}</tr>
            <tr><td class="gp-avail-th-period">Tarde</td>${linha('Tarde')}</tr>
          </tbody>
        </table>
      </div>`;
  }

  function renderDetAulas(p) {
    return `
      <div class="gp-det-secao">
        <h4>Disponibilidade</h4>
        ${tabelaDisponibilidade(p)}
      </div>
      <div class="gp-det-secao">
        <h4>Atuação</h4>
        <div class="gp-det-grid">
          ${campoTexto(CFG.campoBairros, CFG.masks.bairros, getField(p, CFG.campoBairros), { full: true })}
          <div class="gp-info-card gp-info-card--full" id="gp-detDiscWrap">
            <span class="gp-info-label">${escapeHtml(CFG.masks.disciplinas)}</span>
            <div id="gp-detDiscChips" class="gp-avail-summary" style="cursor:pointer;min-height:1.4rem"></div>
            <div class="gp-dropdown-panel" id="gp-detDiscPanel"></div>
          </div>
          ${campoTexto('nivel', CFG.masks.nivel, getField(p, 'nivel'))}
          ${campoTexto('curso', CFG.masks.curso, getField(p, 'curso'))}
        </div>
      </div>
      <div class="gp-det-secao">
        <h4>Experiência</h4>
        <div class="gp-det-grid">
          ${campoTexto('descricaoExpAulas', CFG.masks.descricaoExpAulas, getField(p, 'descricaoExpAulas'), { full: true, textarea: true })}
          ${campoTexto('descricaoExpNeuro', CFG.masks.descricaoExpNeuro, getField(p, 'descricaoExpNeuro'), { full: true, textarea: true })}
          ${campoTexto('descricaoTdics', CFG.masks.descricaoTdics, getField(p, 'descricaoTdics'), { full: true, textarea: true })}
        </div>
      </div>`;
  }

  function renderDetPerfil(p) {
    const foto = getField(p, CFG.campoFoto);
    return `
      <div class="gp-det-secao" style="display:flex;flex-direction:column;align-items:center;gap:.6rem">
        <div class="gp-modal-preview-wrap" style="width:120px;height:120px">
          ${foto ? `<img src="${foto}" alt="${escapeHtml(getField(p, 'nome'))}" class="gp-show">` : `<i class="fas fa-user" style="font-size:2.4rem;color:var(--gp-orange)"></i>`}
        </div>
        <button type="button" class="gp-upload-btn" id="gp-detTrocarFoto"><i class="fas fa-camera" style="margin-right:.35rem"></i>Alterar foto de perfil</button>
      </div>
      <div class="gp-det-grid">
        ${campoTexto('nome', CFG.masks.nome, getField(p, 'nome'))}
        ${campoTexto('apelido', CFG.masks.apelido, getField(p, 'apelido'))}
        ${campoTexto('email', CFG.masks.email, getField(p, 'email'))}
        ${campoTexto('contato', CFG.masks.contato, getField(p, 'contato'))}
        ${campoTexto('cpf', CFG.masks.cpf, getField(p, 'cpf'))}
        ${campoTexto('dataNascimento', CFG.masks.dataNascimento, getField(p, 'dataNascimento'))}
        ${campoTexto('pix', CFG.masks.pix, getField(p, 'pix'))}
        ${campoTexto('endereco', CFG.masks.endereco, getField(p, 'endereco'), { full: true })}
      </div>`;
  }

  function trocarDetTab(tabId) {
    $qa('.gp-det-tab').forEach(btn => btn.classList.toggle('gp-active', btn.dataset.detpanel === tabId));
    $qa('.gp-det-panel').forEach(el => el.classList.toggle('gp-active', el.id === tabId));
    S.detalhesTabAtiva = tabId;
  }

  // dropdown de disciplinas reutilizável: busca + ordem alfabética + coluna do
  // checkbox em 10%. `selecionadasArr` é mutado in-place (push/splice) para
  // preservar a seleção mesmo com itens escondidos pela busca.
  function montarDropdownDisciplinas(panel, selecionadasArr, onChange) {
    const ordenada = [...CFG.disciplinasFixas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    panel.innerHTML = `
      <div class="gp-dropdown-search"><i class="fas fa-search"></i><input type="text" placeholder="Buscar disciplina..." autocomplete="off"></div>
      <div class="gp-dropdown-list"></div>`;
    const input = panel.querySelector('.gp-dropdown-search input');
    const list = panel.querySelector('.gp-dropdown-list');

    function render(filtro) {
      const termo = normalizeStr(filtro);
      const itens = termo ? ordenada.filter(d => normalizeStr(d).includes(termo)) : ordenada;
      list.innerHTML = itens.length
        ? itens.map(d => `
          <label class="gp-dropdown-item">
            <input type="checkbox" value="${escapeHtml(d)}" ${selecionadasArr.includes(d) ? 'checked' : ''}><span>${escapeHtml(d)}</span>
          </label>`).join('')
        : '<div class="gp-dropdown-empty">Nenhuma disciplina encontrada</div>';
    }
    render('');

    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('input', debounce(() => render(input.value), 120));

    list.addEventListener('change', e => {
      const cb = e.target;
      if (!cb.matches('input[type=checkbox]')) return;
      const idx = selecionadasArr.indexOf(cb.value);
      if (cb.checked && idx === -1) selecionadasArr.push(cb.value);
      if (!cb.checked && idx > -1) selecionadasArr.splice(idx, 1);
      onChange();
    });
  }

  function initDetDisciplinasDropdown(p) {
    S.detDiscSelecionadas.length = 0;
    S.detDiscSelecionadas.push(...listaDisciplinas(getField(p, CFG.campoDisciplinas))
      .map(norm => CFG.disciplinasFixas.find(d => normalizeStr(d) === norm) || norm));

    const panel = $id('gp-detDiscPanel');
    const chips = $id('gp-detDiscChips');
    const atualizarChips = () => {
      chips.innerHTML = S.detDiscSelecionadas.length
        ? S.detDiscSelecionadas.map(d => `<span class="gp-avail-chip">${escapeHtml(d)}</span>`).join('')
        : `<span class="gp-info-value" style="color:var(--gp-gray-400)">Clique para selecionar...</span>`;
    };
    atualizarChips();

    montarDropdownDisciplinas(panel, S.detDiscSelecionadas, atualizarChips);

    chips.onclick = e => {
      e.stopPropagation();
      panel.classList.toggle('gp-open');
    };
  }

  function fecharDetDiscDropdown(e) {
    const wrap = $id('gp-detDiscWrap');
    if (wrap && !wrap.contains(e.target)) {
      $id('gp-detDiscPanel')?.classList.remove('gp-open');
    }
  }

  function abrirDetalhes(prof) {
    S.detProfSelecionado = prof;
    $id('gp-detNome').textContent = getField(prof, 'nome') || 'Professor';
    $id('gp-det-aulas').innerHTML = renderDetAulas(prof);
    $id('gp-det-perfil').innerHTML = renderDetPerfil(prof);
    initDetDisciplinasDropdown(prof);
    $id('gp-detTrocarFoto')?.addEventListener('click', () => {
      fecharDetalhes();
      abrirModal(prof);
    });
    trocarDetTab('gp-det-aulas');
    $id('gp-detOverlay').classList.add('gp-open');
  }

  function fecharDetalhes() {
    $id('gp-detOverlay').classList.remove('gp-open');
    S.detProfSelecionado = null;
  }

  async function salvarDetalhes() {
    const prof = S.detProfSelecionado;
    if (!prof) return;
    const btn = $id('gp-btnSalvarDetalhes');
    const dados = {};
    $qa('#gp-detOverlay [data-field]').forEach(el => { dados[el.dataset.field] = el.value.trim(); });
    dados[CFG.campoDisciplinas] = S.detDiscSelecionadas.join(', ');
    $qa('#gp-det-aulas .gp-avail-table input[type=checkbox]').forEach(cb => { dados[cb.dataset.slot] = cb.checked; });

    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await S.db.collection(CFG.colProfessores).doc(prof.id).update(dados);
      Object.assign(prof, dados);
      const idx = S.professores.findIndex(x => x.id === prof.id);
      if (idx > -1) Object.assign(S.professores[idx], dados);
      $id('gp-detNome').textContent = dados.nome || 'Professor';
      renderGrid(filtrarProfessores());
      toast('Dados do professor atualizados!', 'success');
    } catch (err) {
      toast('Erro ao salvar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar alterações';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GERAR CONTRATO — portado de BD Professores (vínculo funcional;
  // desligamento é apenas rascunho lá também — ver ressalva no README do PR)
  // ─────────────────────────────────────────────────────────────
  function popularListaProfessoresVinculo() {
    const lista = $id('gp-listaProfessoresVinculo');
    const ativos = [...S.professores].filter(isAtivo).sort((a, b) => (getField(a, 'nome') || '').localeCompare(getField(b, 'nome') || '', 'pt-BR'));
    lista.innerHTML = ativos.map(p => `
      <label class="gp-modalC-item">
        <input type="checkbox" name="gp-professorVinculo" value="${p.id}"> ${escapeHtml(getField(p, 'nome'))}
      </label>`).join('');
    $id('gp-marcarTodosProfessores').checked = false;
  }

  function renderizarSelecionadosDesligamento() {
    const cont = $id('gp-professorSelecionadoDesligamento');
    if (!S.desligamentoSelecionados.length) {
      cont.innerHTML = '';
      $id('gp-motivosDesligamento').style.display = 'none';
      return;
    }
    cont.innerHTML = S.desligamentoSelecionados.map(p => `
      <div class="gp-modalC-selecionado" data-id="${p.id}">
        <span>${escapeHtml(p.nome)}</span>
        <button type="button" data-id="${p.id}">&times;</button>
      </div>`).join('');
    $id('gp-motivosDesligamento').style.display = 'block';
    cont.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        S.desligamentoSelecionados = S.desligamentoSelecionados.filter(p => p.id !== btn.dataset.id);
        renderizarSelecionadosDesligamento();
      });
    });
  }

  function trocarTabContrato(panel) {
    $qa('.gp-modalC-tab').forEach(t => t.classList.toggle('gp-active', t.dataset.panel === panel));
    $id('gp-panelVinculo').classList.toggle('gp-active', panel === 'vinculo');
    $id('gp-panelDesligamento').classList.toggle('gp-active', panel === 'desligamento');
    $id('gp-btnGerarContratoVinculo').style.display = panel === 'vinculo' ? 'block' : 'none';
    $id('gp-btnGerarContratoDesligamento').style.display = panel === 'desligamento' ? 'block' : 'none';
  }

  function abrirModalContrato() {
    S.desligamentoSelecionados = [];
    popularListaProfessoresVinculo();
    trocarTabContrato('vinculo');
    $id('gp-buscaProfessorDesligamento').value = '';
    renderizarSelecionadosDesligamento();
    $qa('input[name="gp-motivoDesligamento"]').forEach(cb => { cb.checked = false; });
    $id('gp-observacoesDesligamento').value = '';
    $id('gp-modalContratoOverlay').classList.add('gp-open');
  }

  function fecharModalContrato() {
    $id('gp-modalContratoOverlay').classList.remove('gp-open');
  }

  function initModalContrato() {
    $id('gp-modalContratoClose')?.addEventListener('click', fecharModalContrato);
    $id('gp-modalContratoOverlay')?.addEventListener('click', e => { if (e.target.id === 'gp-modalContratoOverlay') fecharModalContrato(); });
    $qa('.gp-modalC-tab').forEach(tab => tab.addEventListener('click', () => trocarTabContrato(tab.dataset.panel)));

    $id('gp-marcarTodosProfessores')?.addEventListener('change', e => {
      $qa('input[name="gp-professorVinculo"]').forEach(cb => { cb.checked = e.target.checked; });
    });

    const buscaInput = $id('gp-buscaProfessorDesligamento');
    const autocomplete = $id('gp-autocompleteProfessor');
    buscaInput?.addEventListener('input', debounce(() => {
      const termo = normalizeStr(buscaInput.value);
      if (!termo || termo.length < 2) { autocomplete.classList.remove('gp-open'); return; }
      const idsSel = S.desligamentoSelecionados.map(p => p.id);
      const resultados = S.professores
        .filter(p => getField(p, 'nome') && normalizeStr(getField(p, 'nome')).includes(termo) && !idsSel.includes(p.id))
        .sort((a, b) => (getField(a, 'nome') || '').localeCompare(getField(b, 'nome') || '', 'pt-BR'))
        .slice(0, 10);
      autocomplete.innerHTML = resultados.length
        ? resultados.map(p => `<div class="gp-modalC-autocomplete-item" data-id="${p.id}" data-nome="${escapeHtml(getField(p, 'nome'))}">${escapeHtml(getField(p, 'nome'))}</div>`).join('')
        : '<div class="gp-modalC-autocomplete-item" style="color:var(--gp-gray-400);cursor:default">Nenhum professor encontrado</div>';
      autocomplete.classList.add('gp-open');
    }, 200));
    autocomplete?.addEventListener('click', e => {
      const item = e.target.closest('.gp-modalC-autocomplete-item[data-id]');
      if (!item) return;
      if (!S.desligamentoSelecionados.some(p => p.id === item.dataset.id)) {
        S.desligamentoSelecionados.push({ id: item.dataset.id, nome: item.dataset.nome });
        renderizarSelecionadosDesligamento();
      }
      buscaInput.value = '';
      autocomplete.classList.remove('gp-open');
    });
    document.addEventListener('click', e => {
      if (buscaInput && !buscaInput.contains(e.target) && !autocomplete.contains(e.target)) autocomplete.classList.remove('gp-open');
    });

    $id('gp-btnGerarContratoVinculo')?.addEventListener('click', () => {
      const sel = $qa('input[name="gp-professorVinculo"]:checked');
      if (!sel.length) { toast('Selecione pelo menos um professor.', 'error'); return; }
      const profs = sel.map(cb => {
        const p = S.professores.find(x => x.id === cb.value);
        return { id: cb.value, nome: getField(p, 'nome') || '', cpf: getField(p, 'cpf') || '', endereco: getField(p, 'endereco') || '' };
      });
      fecharModalContrato();
      if (typeof window.gerarContratosVinculoProfessores === 'function') window.gerarContratosVinculoProfessores(profs);
      else toast('Função de geração de contratos não encontrada.', 'error');
    });

    $id('gp-btnGerarContratoDesligamento')?.addEventListener('click', () => {
      if (!S.desligamentoSelecionados.length) { toast('Selecione pelo menos um professor.', 'error'); return; }
      const motivos = $qa('input[name="gp-motivoDesligamento"]:checked').map(cb => cb.value);
      if (!motivos.length) { toast('Selecione pelo menos um motivo.', 'error'); return; }
      // Igual à BD Professores hoje: a geração do PDF de desligamento ainda não está
      // implementada — use o botão "Desligar Professores" para mudar o status de fato.
      toast('Geração de contrato de desligamento ainda não implementada.', 'info');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // DESLIGAR PROFESSORES — muda status Ativo → Desligado (real)
  // ─────────────────────────────────────────────────────────────
  function popularListaDesligar() {
    const lista = $id('gp-listaDesligar');
    const ativos = [...S.professores].filter(isAtivo).sort((a, b) => (getField(a, 'nome') || '').localeCompare(getField(b, 'nome') || '', 'pt-BR'));
    lista.innerHTML = ativos.map(p => `
      <label class="gp-modalC-item">
        <input type="checkbox" name="gp-professorDesligar" value="${p.id}"> ${escapeHtml(getField(p, 'nome'))}
      </label>`).join('');
    $id('gp-marcarTodosDesligar').checked = false;
  }

  function abrirModalDesligar() {
    popularListaDesligar();
    $id('gp-modalDesligarOverlay').classList.add('gp-open');
  }

  function fecharModalDesligar() {
    $id('gp-modalDesligarOverlay').classList.remove('gp-open');
  }

  async function confirmarDesligamento() {
    const sel = $qa('input[name="gp-professorDesligar"]:checked').map(cb => cb.value);
    if (!sel.length) { toast('Selecione pelo menos um professor.', 'error'); return; }
    const btn = $id('gp-btnConfirmarDesligar');
    btn.disabled = true;
    btn.textContent = 'Desligando...';
    try {
      await Promise.all(sel.map(id => S.db.collection(CFG.colProfessores).doc(id).update({ status: 'Desligado' })));
      sel.forEach(id => {
        const p = S.professores.find(x => x.id === id);
        if (p) p.status = 'Desligado';
      });
      renderGrid(filtrarProfessores());
      toast(`${sel.length} professor(es) desligado(s).`, 'success');
      fecharModalDesligar();
    } catch (err) {
      toast('Erro ao desligar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Desligar selecionados';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EVENTOS
  // ─────────────────────────────────────────────────────────────
  function initDisciplinasDropdown() {
    const panel = $id('gp-discPanel');
    const btn = $id('gp-discBtn');
    const wrap = $id('gp-discWrap');
    if (!panel || !btn || !wrap) return;

    const atualizarLabel = () => {
      const label = $id('gp-discLabel');
      if (!S.discsSelecionadas.length) { label.textContent = 'Disciplinas'; btn.classList.remove('gp-has-value'); }
      else { label.textContent = S.discsSelecionadas.length === 1 ? S.discsSelecionadas[0] : `${S.discsSelecionadas.length} disciplinas`; btn.classList.add('gp-has-value'); }
    };

    montarDropdownDisciplinas(panel, S.discsSelecionadas, () => {
      atualizarLabel();
      renderGrid(filtrarProfessores());
    });

    btn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('gp-open');
      btn.classList.toggle('gp-open', panel.classList.contains('gp-open'));
    });
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) {
        panel.classList.remove('gp-open');
        btn.classList.remove('gp-open');
      }
    });
  }

  function limparFiltros() {
    S.termoNome = ''; S.termoBairro = ''; S.discsSelecionadas.length = 0; S.slotsSelecionados = [];
    S.filtroRapido = 'todos';
    $id('gp-fNome').value = ''; $id('gp-fBairro').value = '';
    $id('gp-discPanel')?.querySelectorAll('input:checked').forEach(i => { i.checked = false; });
    $id('gp-discLabel').textContent = 'Disciplinas';
    $id('gp-discBtn')?.classList.remove('gp-has-value');
    $id('gp-availTable')?.querySelectorAll('input:checked').forEach(i => { i.checked = false; });
    $qa('.gp-more-radio').forEach(b => b.classList.toggle('gp-active', b.dataset.quick === 'todos'));
    renderGrid(filtrarProfessores());
  }

  function initEventos() {
    $id('gp-fNome')?.addEventListener('input', debounce(e => {
      S.termoNome = e.target.value;
      renderGrid(filtrarProfessores());
    }, 200));

    $id('gp-fBairro')?.addEventListener('input', debounce(e => {
      S.termoBairro = e.target.value;
      renderGrid(filtrarProfessores());
    }, 200));

    initDisciplinasDropdown();

    $id('gp-availTable')?.addEventListener('change', e => {
      const cb = e.target;
      if (!cb.matches('input[type=checkbox]')) return;
      const slot = cb.getAttribute('data-slot');
      const idx = S.slotsSelecionados.indexOf(slot);
      if (cb.checked && idx === -1) S.slotsSelecionados.push(slot);
      if (!cb.checked && idx > -1) S.slotsSelecionados.splice(idx, 1);
      renderGrid(filtrarProfessores());
    });

    const maisBtn = $id('gp-btnMaisFiltros');
    const maisPanel = $id('gp-maisPanel');
    maisBtn?.addEventListener('click', e => {
      e.stopPropagation();
      maisPanel.classList.toggle('gp-open');
      maisBtn.classList.toggle('gp-open', maisPanel.classList.contains('gp-open'));
    });
    document.addEventListener('click', e => {
      if (!$id('gp-maisWrap')?.contains(e.target)) {
        maisPanel?.classList.remove('gp-open');
        maisBtn?.classList.remove('gp-open');
      }
    });

    $id('gp-btnLimpar')?.addEventListener('click', limparFiltros);

    // Filtros rápidos (tipo rádio: só 1 ativo por vez)
    $qa('.gp-more-radio').forEach(radio => {
      radio.addEventListener('click', () => {
        S.filtroRapido = radio.dataset.quick;
        $qa('.gp-more-radio').forEach(b => b.classList.toggle('gp-active', b === radio));
        maisPanel?.classList.remove('gp-open');
        maisBtn?.classList.remove('gp-open');
        renderGrid(filtrarProfessores());
      });
    });

    $id('gp-fileInput')?.addEventListener('change', onFileChange);
    $id('gp-btnSalvar')?.addEventListener('click', salvarFoto);
    $id('gp-btnCancelar')?.addEventListener('click', fecharModal);
    $id('gp-modalClose')?.addEventListener('click', fecharModal);
    $id('gp-modalOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'gp-modalOverlay') fecharModal();
    });

    // Detalhes Professor
    $id('gp-detClose')?.addEventListener('click', fecharDetalhes);
    $id('gp-detOverlay')?.addEventListener('click', e => { if (e.target.id === 'gp-detOverlay') fecharDetalhes(); });
    $qa('.gp-det-tab').forEach(tab => tab.addEventListener('click', () => trocarDetTab(tab.dataset.detpanel)));
    $id('gp-btnSalvarDetalhes')?.addEventListener('click', salvarDetalhes);
    document.addEventListener('click', fecharDetDiscDropdown);

    // Gerar Contrato (abre — lógica interna em initModalContrato)
    $id('dp-btnGerarContrato')?.addEventListener('click', () => {
      maisPanel?.classList.remove('gp-open');
      abrirModalContrato();
    });
    initModalContrato();

    // Atualizar Permissões (authProfessores.js — mesma função da engrenagem, direto)
    $id('gp-btnAtualizarPermissoes')?.addEventListener('click', () => {
      maisPanel?.classList.remove('gp-open');
      if (typeof window.AuthProfessores !== 'undefined' && window.AuthProfessores.openPermModal) {
        window.AuthProfessores.openPermModal();
      } else {
        toast('Módulo de permissões não encontrado.', 'error');
      }
    });

    // Desligar Professores
    $id('gp-btnDesligar')?.addEventListener('click', () => {
      maisPanel?.classList.remove('gp-open');
      abrirModalDesligar();
    });
    $id('gp-modalDesligarClose')?.addEventListener('click', fecharModalDesligar);
    $id('gp-modalDesligarOverlay')?.addEventListener('click', e => { if (e.target.id === 'gp-modalDesligarOverlay') fecharModalDesligar(); });
    $id('gp-marcarTodosDesligar')?.addEventListener('change', e => {
      $qa('input[name="gp-professorDesligar"]').forEach(cb => { cb.checked = e.target.checked; });
    });
    $id('gp-btnConfirmarDesligar')?.addEventListener('click', confirmarDesligamento);
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

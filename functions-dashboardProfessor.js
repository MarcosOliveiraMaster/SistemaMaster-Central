// ============================================================
// functions-dashboardProfessor.js
// Dashboard de Professores — módulo autocontido
// Divide-se em 3 blocos de entrega:
//   Parte 1: CONFIG · STATE · FIREBASE · UTILS · STYLES · HTML · TABS · PERSIST
//   Parte 2: TAB1 — Banco de Dados (tabela, filtros, colunas, sort, resize)
//   Parte 3: TAB2 — Edição de Professores · TAB3 — Candidatos · TOAST · INIT
// ============================================================

window.DashboardProfessores = (function () {
  'use strict';

  // ============================================================
  // PARTE 1 — CONFIG · STATE · FIREBASE · UTILS · STYLES · HTML · TABS · PERSIST
  // ============================================================

  // ─────────────────────────────────────────────────────────────
  // 1.1  CONFIG
  // ─────────────────────────────────────────────────────────────
  const CFG = {
    firebase: {
      apiKey: 'AIzaSyDPPbSA8SB-L_giAhWIqGbPGSMRBDTPi40',
      authDomain: 'master-ecossistemaprofessor.firebaseapp.com',
      databaseURL: 'https://master-ecossistemaprofessor-default-rtdb.firebaseio.com',
      projectId: 'master-ecossistemaprofessor',
      storageBucket: 'master-ecossistemaprofessor.firebasestorage.app',
      messagingSenderId: '532224860209',
      appId: '1:532224860209:web:686657b6fae13b937cf510',
      measurementId: 'G-B0KMX4E67D',
    },
    colProfessores: 'dataBaseProfessores',
    colCandidatos: 'candidatos',
    colunasOcultas: ['id', 'expAulas', 'expNeuro', 'expTdics', 'foto', 'fotoPerfil', 'dataEnvio', 'timeStamp', 'timestamp'],
    colunasDiasTurnos: [
      'segManha','segTarde','terManha','terTarde',
      'quaManha','quaTarde','quiManha','quiTarde',
      'sexManha','sexTarde','sabManha','sabTarde',
    ],
    disciplinasFixas: [
      { label: 'Ciências',   img: 'cienc.png'    },
      { label: 'Física',     img: 'fis.png'       },
      { label: 'Geografia',  img: 'geo.png'       },
      { label: 'História',   img: 'hist.png'      },
      { label: 'Inglês',     img: 'engl.png'      },
      { label: 'Literatura', img: 'humanas.png'   },
      { label: 'Matemática', img: 'mat.png'       },
      { label: 'Pedagogia',  img: 'humanas.png'   },
      { label: 'Português',  img: 'port.png'      },
      { label: 'Química',    img: 'qui.png'       },
      { label: 'Biologia',   img: 'bio.png'       },
    ],
    ls: {
      colunas   : 'dp_colunasSelecionadas',
      colWidths : 'dp_colWidths_v1',
      masks     : 'dp_masks',
      colOrder  : 'dp_columnOrder',
    },
    defaultMasks: {
      nome             : 'Nome Professor',
      cpf              : 'CPF',
      email            : 'E-mail',
      contato          : 'Contato',
      endereco         : 'Endereço',
      nivel            : 'Nível Acadêmico',
      descricaoExpAulas: 'Descrição — Aulas',
      bairros          : 'Bairros de acesso',
      disciplinas      : 'Disciplinas',
      curso            : 'Curso e Instituição',
      descricaoExpNeuro: 'Descrição — Alunos Atípicos',
      descricaoTdics   : 'Descrição — TDICs',
      pix              : 'Chave Pix',
      status           : 'Status',
      dataAtivacao     : 'Data de Ativação',
      dataNascimento   : 'Data de Nascimento',
    },
    msgAprovacao: `É com muita alegria que informamos sua aprovação no processo seletivo da Master Educação! 🌟\n\nFicamos impressionados com sua didática e paixão pelo ensino. Estamos ansiosos para iniciar essa parceria de sucesso e transformar a educação juntos. 🧑‍🏫✨\n\nEntre no Link abaixo para participar no nosso grupo de professores. Enviamos solicitações de aulas no privado, porém quando surge solicitação emergencial nós enviamos no grupo:\n\nhttps://chat.whatsapp.com/Km8Ap56yusNKef1W5d6aMS\n\nVamos encaminhar o manual de Tutores Master, com todas as informações sobre a Empresa e boas práticas. Entraremos em contato para alinhar os detalhes e próximos passos. 🚀\n\nSeja bem-vindo(a) à equipe Master Educação! 💼💙`,
    msgReprovacao: `Olá Professor\n\nAgradecemos muito por participar do processo seletivo da Master Educação e por compartilhar suas habilidades e experiências conosco. 🙏\n\nApós uma análise cuidadosa, informamos que, no momento, você não foi selecionado para a vaga.\n\nNo entanto, ficaremos felizes em manter seu perfil em nosso banco de talentos para futuras oportunidades.\n\nDesejamos muito sucesso em sua trajetória e esperamos ter a chance de trabalharmos juntos em breve! 💼\n\nAtenciosamente, Equipe Master Educação`,
    msgDesistente: `Olá Professor, o avaliador esperou mais de 10min por você na sala e infelizmente não conseguimos esperar mais. Infelizmente vamos precisar cancelar nossa entrevista por enquanto e logo mais, entramos em contato assim que iniciarmos um novo ciclo de entrevistas.\n\nAgradecemos por ter se inscrito no processo seletivo e nos vemos em breve.`,
  };

  // ─────────────────────────────────────────────────────────────
  // 1.2  STATE
  // ─────────────────────────────────────────────────────────────
  const S = {
    db: null,
    tabAtiva: 'dp-tab-bancoDados',
    // Tab1
    dadosTabela        : null,
    colunasDisponiveis : [],
    colunasSelecionadas: [],
    colunasOrdem       : [],
    colWidths          : {},
    masks              : {},
    sortState          : { column: null, dir: null },
    isResizing         : false,
    currentTh          : null,
    startX             : 0,
    startWidth         : 0,
    // Tab2
    t2Loaded    : false,
    registros   : [],
    t2Selecionado  : null,
    t2SelecionadoId: null,
    // Tab3
    t3Loaded       : false,
    candidatos     : [],
    candidatoAtual : null,
    mesSelecionado : null,
  };

  // ─────────────────────────────────────────────────────────────
  // 1.3  FIREBASE
  // ─────────────────────────────────────────────────────────────
  function initFirebase() {
    try {
      if (typeof firebase === 'undefined') throw new Error('Firebase SDK não encontrado.');
      if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
      S.db = firebase.firestore();
      return true;
    } catch (e) {
      console.error('❌ Firebase init error:', e);
      return false;
    }
  }

  async function fetchColecao(nome) {
    const snap = await S.db.collection(nome).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function updateDoc(colecao, id, dados) {
    return S.db.collection(colecao).doc(id).update(dados);
  }

  async function deleteDoc(colecao, id) {
    return S.db.collection(colecao).doc(id).delete();
  }

  async function addDoc(colecao, dados) {
    return S.db.collection(colecao).add(dados);
  }

  // ─────────────────────────────────────────────────────────────
  // 1.4  UTILS
  // ─────────────────────────────────────────────────────────────
  function debounce(fn, ms = 160) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function safe(v) { return v == null ? '' : String(v); }

  function normalizeStr(s) {
    return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  function formatCPF(v) {
    const n = (v || '').toString().replace(/\D/g, '');
    return n.length === 11 ? n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v;
  }

  function formatTel(v) {
    const n = (v || '').toString().replace(/\D/g, '');
    if (n.length === 11) return n.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2.$3-$4');
    if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return v;
  }

  function cleanTel(v) { return (v || '').replace(/\D/g, ''); }

  function isDateCol(name) {
    if (!name) return false;
    const k = name.toLowerCase();
    return k.includes('data') || k.includes('cadastro');
  }

  function parseDateMs(raw) {
    if (!raw) return null;
    if (typeof raw === 'number') return raw;
    if (!isNaN(Number(raw))) return Number(raw);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  function formatDateDisplay(raw) {
    if (!raw) return '';
    const ms = parseDateMs(raw);
    if (!ms) return String(raw);
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const wd = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()];
    return `${dd}/${mm}/${yyyy} — ${wd}`;
  }

  function isTruthy(v) {
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    if (Array.isArray(v)) return v.some(isTruthy);
    return ['true','1','sim','s','yes','on'].includes(String(v).toLowerCase().trim());
  }

  function getField(item, key) {
    if (!item || !key) return undefined;
    if (Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    for (const k of [key, key.charAt(0).toLowerCase()+key.slice(1), key.toLowerCase()]) {
      if (Object.prototype.hasOwnProperty.call(item, k)) return item[k];
    }
    return undefined;
  }

  function getCaminhoFoto(nomeFoto) {
    if (!nomeFoto || nomeFoto === 'icone-padrao') return null;
    return `img-professor/${nomeFoto}`;
  }

  function getOpcoesFoto() {
    if (window.FOTOS_PERFIL_DISPONIVEIS && Array.isArray(window.FOTOS_PERFIL_DISPONIVEIS)) {
      return ['icone-padrao', ...window.FOTOS_PERFIL_DISPONIVEIS];
    }
    return ['icone-padrao'];
  }

  // Escopado em #professores
  function $root() { return document.getElementById('professores'); }
  function $q(sel)  { const r = $root(); return r ? r.querySelector(sel) : null; }
  function $qa(sel) { const r = $root(); return r ? Array.from(r.querySelectorAll(sel)) : []; }
  function $id(id)  { return document.getElementById(id); }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch { return false; }
  }

  // ─────────────────────────────────────────────────────────────
  // 1.5  PERSISTÊNCIA
  // ─────────────────────────────────────────────────────────────
  function lsGet(key, def = null) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function loadMasks() {
    const saved = lsGet(CFG.ls.masks, {});
    S.masks = Object.assign({}, CFG.defaultMasks, saved);
  }

  function loadColPrefs() {
    S.colunasSelecionadas = lsGet(CFG.ls.colunas, []);
    S.colWidths           = lsGet(CFG.ls.colWidths, {});
    S.colunasOrdem        = lsGet(CFG.ls.colOrder, []);
  }

  function saveColPrefs() { lsSet(CFG.ls.colunas, S.colunasSelecionadas); }
  function saveColWidths() { lsSet(CFG.ls.colWidths, S.colWidths); }
  function saveColOrder()  { lsSet(CFG.ls.colOrder, S.colunasOrdem); }

  function aplicarOrdem(colunas) {
    if (!S.colunasOrdem.length) return colunas;
    const ord = S.colunasOrdem.filter(c => colunas.includes(c));
    colunas.forEach(c => { if (!ord.includes(c)) ord.push(c); });
    return ord;
  }

  // ─────────────────────────────────────────────────────────────
  // 1.6  INJECT STYLES
  // ─────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('dp-styles')) return;
    const style = document.createElement('style');
    style.id = 'dp-styles';
    style.textContent = `
/* ── variáveis ── */
#professores {
  --dp-orange:       #f28705;
  --dp-orange-light: #fef3e2;
  --dp-orange-dk:    #c96e04;
  --dp-green:        #16a34a;
  --dp-green-light:  #dcfce7;
  --dp-red:          #dc2626;
  --dp-red-light:    #fee2e2;
  --dp-yellow:       #ca8a04;
  --dp-yellow-light: #fef9c3;
  --dp-blue:         #2563eb;
  --dp-blue-light:   #dbeafe;
  --dp-gray-50:      #f9fafb;
  --dp-gray-100:     #f3f4f6;
  --dp-gray-200:     #e5e7eb;
  --dp-gray-400:     #9ca3af;
  --dp-gray-600:     #4b5563;
  --dp-gray-800:     #1f2937;
  --dp-radius:       0.75rem;
  --dp-shadow:       0 4px 16px rgba(0,0,0,.08);
  --dp-transition:   0.2s ease;
  font-family: 'Lexend', sans-serif;
}

/* ── layout geral ── */
#professores { display: flex; flex-direction: column; height: 100%; overflow: visible; background: var(--dp-gray-100); }

/* ── tabs bar ── */
.dp-tabs-bar { display: flex; gap: .25rem; padding: .5rem .75rem 0; background: white; border-bottom: 1px solid var(--dp-gray-200); flex-shrink: 0; align-items: center; }
.dp-tab { flex: 1; text-align: center; font-family: 'Comfortaa', cursive; font-size: .8rem; padding: .45rem 1rem; border-radius: .5rem .5rem 0 0; border: 1px solid transparent; border-bottom: none; cursor: pointer; background: var(--dp-gray-100); color: var(--dp-gray-600); transition: background var(--dp-transition), color var(--dp-transition); white-space: nowrap; }
.dp-tab:hover { background: var(--dp-orange-light); color: var(--dp-orange); }
.dp-tab--active { background: white; color: var(--dp-orange); border-color: var(--dp-gray-200); font-weight: 700; position: relative; }
.dp-tab--active::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:2px; background:var(--dp-orange); }
.dp-tabs-bar .dp-btn { flex: none; margin-left: auto; }

/* ── tab contents ── */
.dp-tab-content { display: none; flex: 1; overflow: visible; }
.dp-tab-content--active { display: flex; flex-direction: column; }

/* ── botões genéricos ── */
.dp-btn { font-family:'Comfortaa',cursive; font-size:.8rem; padding:.45rem .9rem; border-radius:.5rem; cursor:pointer; border:1px solid transparent; transition:all var(--dp-transition); }
.dp-btn--primary { background:var(--dp-orange); color:white; } .dp-btn--primary:hover { background:var(--dp-orange-dk); }
.dp-btn--ghost   { background:var(--dp-gray-100); color:var(--dp-gray-800); border-color:var(--dp-gray-200); } .dp-btn--ghost:hover { background:var(--dp-gray-200); }
.dp-btn--danger  { background:var(--dp-red); color:white; } .dp-btn--danger:hover { background:#b91c1c; }
.dp-btn--success { background:var(--dp-green); color:white; } .dp-btn--success:hover { background:#15803d; }
.dp-btn--yellow  { background:var(--dp-yellow); color:white; } .dp-btn--yellow:hover { background:#a16207; }
.dp-btn--sm { font-size:.72rem; padding:.3rem .65rem; }
.dp-btn:disabled { opacity:.5; cursor:not-allowed; }
.dp-btn-active-success { background:var(--dp-green)!important; color:#fff!important; border-color:var(--dp-green)!important; }
.dp-btn-active-danger  { background:var(--dp-red)!important;   color:#fff!important; border-color:var(--dp-red)!important; }

/* ── inputs / selects / textareas ── */
.dp-input, .dp-select, .dp-textarea {
  font-family:'Lexend',sans-serif; font-size:.8rem;
  border:1px solid var(--dp-gray-200); border-radius:.5rem;
  padding:.45rem .7rem; background:white; width:100%;
  transition:border-color var(--dp-transition), box-shadow var(--dp-transition);
}
.dp-input:focus, .dp-select:focus, .dp-textarea:focus {
  outline:none; border-color:var(--dp-orange);
  box-shadow:0 0 0 3px rgba(242,135,5,.12);
}
.dp-textarea { resize:vertical; min-height:80px; }
.dp-field-label { font-size:.75rem; font-weight:600; color:var(--dp-gray-600); margin-bottom:.25rem; display:block; }

/* ── TAB1: filtros ── */
.dp-filters-bar { display:flex; flex-wrap:wrap; align-items:flex-start; gap:.5rem; padding:.6rem .75rem; background:white; border-bottom:1px solid var(--dp-gray-200); flex-shrink:0; position:relative; z-index:300; }
.dp-filter-group { position:relative; }
.dp-dropdown-btn { display:flex; align-items:center; justify-content:space-between; gap:.4rem; white-space:nowrap; }
.dp-dropdown-menu { position:absolute; top:calc(100% + 4px); left:0; z-index:9999; background:white; border:1px solid var(--dp-gray-200); border-radius:.5rem; box-shadow:var(--dp-shadow); min-width:220px; max-height:400px; overflow-y:auto; }
.dp-dropdown-item { padding:.35rem .75rem; font-size:.78rem; display:flex; align-items:center; gap:.4rem; cursor:pointer; }
.dp-dropdown-item:hover { background:var(--dp-gray-50); }
.dp-dias-subturnos { padding-left:1rem; }

/* ── TAB1: tabela ── */
.dp-table-wrapper { flex:1; overflow:auto; max-height:calc(100vh - 180px); }
#dp-tabela { border-collapse:collapse; width:100%; min-width:max-content; }
#dp-tabela thead { background:var(--dp-gray-50); position:sticky; top:0; z-index:40; }
#dp-tabela th, #dp-tabela td { padding:10px 14px; text-align:left; border-bottom:1px solid var(--dp-gray-200); border-right:1px dashed var(--dp-gray-200); font-size:.78rem; white-space:normal; word-break:break-word; }
#dp-tabela th { font-size:.7rem; text-transform:uppercase; letter-spacing:.03em; color:var(--dp-gray-600); font-weight:600; position:relative; cursor:pointer; user-select:none; }
#dp-tabela tbody tr:hover td { background:var(--dp-orange-light); }
.dp-resize-handle { position:absolute; top:0; right:0; width:6px; height:100%; cursor:col-resize; z-index:1; }
body.dp-resizing { cursor:col-resize!important; user-select:none!important; }
.dp-cell-copy { cursor:pointer; }
.dp-cell-copy:hover { background:var(--dp-gray-100); border-radius:3px; padding:1px 3px; }

/* ── badges de status ── */
.dp-badge { display:inline-block; font-size:.65rem; font-weight:600; padding:.15rem .6rem; border-radius:999px; font-family:'Comfortaa',cursive; }
.dp-badge--ativo    { background:var(--dp-green-light);  color:var(--dp-green); }
.dp-badge--inativo  { background:var(--dp-red-light);    color:var(--dp-red); }
.dp-badge--ferias   { background:var(--dp-yellow-light); color:var(--dp-yellow); }
.dp-badge--afastado { background:var(--dp-gray-200);     color:var(--dp-gray-600); }
.dp-badge--candidato{ background:var(--dp-blue-light);   color:var(--dp-blue); }
.dp-badge--aprovado { background:var(--dp-green-light);  color:var(--dp-green); }
.dp-badge--reprovado{ background:var(--dp-red-light);    color:var(--dp-red); }
.dp-badge--desistente{background:var(--dp-gray-200);     color:var(--dp-gray-600); }

/* ── TAB2: grid de cards ── */
#dp-gridPerfis { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1rem; }
@media (max-width:1600px){#dp-gridPerfis{grid-template-columns:repeat(4,minmax(0,1fr));}}
@media (max-width:1366px){#dp-gridPerfis{grid-template-columns:repeat(3,minmax(0,1fr));}}
.dp-card { position:relative; display:flex; flex-direction:column; align-items:center; background:white; padding:.75rem; border-radius:.75rem; box-shadow:0 2px 8px rgba(0,0,0,.06); border:1px solid var(--dp-gray-200); cursor:pointer; transition:box-shadow var(--dp-transition), border-color var(--dp-transition); min-height:240px; }
.dp-card:hover { box-shadow:0 8px 24px rgba(242,135,5,.15); border-color:var(--dp-orange); }
.dp-card__del { position:absolute; top:.4rem; right:.4rem; width:1.5rem; height:1.5rem; display:flex; align-items:center; justify-content:center; border-radius:.35rem; border:none; background:transparent; cursor:pointer; z-index:10; }
.dp-card__del:hover { background:var(--dp-red-light); }
.dp-card__img { width:7rem; height:7rem; border-radius:.5rem; object-fit:cover; border:2px solid var(--dp-orange-light); }
.dp-card__fallback { width:7rem; height:7rem; display:flex; align-items:center; justify-content:center; background:var(--dp-orange-light); border-radius:.5rem; font-size:2.5rem; }
.dp-card__nome { font-size:.75rem; text-align:center; margin:.4rem 0 .25rem; font-weight:500; }

/* ── TAB2: painel de edição ── */
#dp-painelView { flex:1; overflow:auto; padding:1.5rem; }
.dp-painel-secao { margin-bottom:1.5rem; }
.dp-painel-secao h3 { font-size:.9rem; font-weight:700; color:var(--dp-gray-800); border-bottom:1px solid var(--dp-gray-200); padding-bottom:.35rem; margin-bottom:.75rem; }
.dp-painel-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
@media (max-width:1100px){ .dp-painel-grid { grid-template-columns:1fr; } }
.dp-painel-grid3 { grid-template-columns:1fr 1fr 1fr; }
.dp-field { display:flex; flex-direction:column; gap:.25rem; }

/* ── TAB3: layout 3 colunas ── */
.dp-cand-layout { display:grid; grid-template-columns:1fr 2fr 1fr; gap:0; flex:1; overflow:hidden; }
.dp-cand-col { display:flex; flex-direction:column; overflow:hidden; border-right:1px solid var(--dp-gray-200); }
.dp-cand-col:last-child { border-right:none; }
.dp-cand-col-inner { flex:1; overflow-y:auto; padding:.75rem; }
#dp-listaCandidatos { display:flex; flex-direction:column; gap:.25rem; max-height:52vh; overflow-y:auto; }
.dp-cand-item { padding:.5rem .65rem; border-radius:.5rem; cursor:pointer; border:1px solid transparent; font-size:.78rem; transition:all var(--dp-transition); }
.dp-cand-item:hover { background:var(--dp-orange-light); border-color:var(--dp-orange); }
.dp-cand-item--active { background:var(--dp-orange-light); border-color:var(--dp-orange); font-weight:600; }

/* disponibilidade tabela */
.dp-disp-table { width:100%; border-collapse:collapse; font-size:.72rem; margin-bottom:.75rem; }
.dp-disp-table th, .dp-disp-table td { text-align:center; padding:.3rem .5rem; border:1px solid var(--dp-gray-200); }
.dp-disp-table thead th { background:var(--dp-gray-50); font-weight:600; font-size:.65rem; text-transform:uppercase; }
.dp-disp-ok  { color:var(--dp-green); font-size:1rem; }
.dp-disp-no  { color:var(--dp-red);   font-size:1rem; }

/* disciplinas grid */
.dp-disc-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:.4rem; max-height:110px; overflow-y:auto; }
.dp-disc-item { display:flex; flex-direction:column; align-items:center; background:var(--dp-gray-50); border:1px solid var(--dp-gray-200); padding:.3rem; border-radius:.4rem; font-size:.6rem; text-align:center; }
.dp-disc-item img { width:2.8rem; height:2.8rem; object-fit:contain; margin-bottom:.15rem; }

/* avaliação col direita */
.dp-aval-section { display:flex; flex-direction:column; gap:.6rem; }
.dp-aval-row { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }

/* ── TOAST ── */
.dp-toast { position:fixed; top:1.2rem; right:1.2rem; z-index:9999; max-width:320px; background:white; border-radius:.6rem; box-shadow:0 8px 24px rgba(0,0,0,.14); padding:.7rem 1rem; font-size:.8rem; display:flex; gap:.6rem; align-items:flex-start; border-left:4px solid var(--dp-blue); animation:dpSlideIn .25s ease; }
.dp-toast--success { border-color:var(--dp-green); }
.dp-toast--error   { border-color:var(--dp-red); }
.dp-toast--info    { border-color:var(--dp-blue); }
@keyframes dpSlideIn { from{opacity:0;transform:translateX(60px)} to{opacity:1;transform:none} }

/* ── POPUP overlay ── */
.dp-popup-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index:8888; animation:dpFadeIn .15s ease; }
@keyframes dpFadeIn { from{opacity:0} to{opacity:1} }
.dp-popup-box { background:white; border-radius:.9rem; box-shadow:0 20px 48px rgba(0,0,0,.18); padding:1.5rem; max-width:26rem; width:90%; }
.dp-popup-box h3 { font-size:1rem; font-weight:700; text-align:center; margin:.5rem 0 .4rem; }
.dp-popup-box p  { font-size:.82rem; text-align:center; color:var(--dp-gray-600); margin-bottom:1.2rem; }
.dp-popup-actions { display:flex; gap:.6rem; }
.dp-popup-actions .dp-btn { flex:1; justify-content:center; text-align:center; }

/* ── scrollbars personalizadas dentro do módulo ── */
#professores ::-webkit-scrollbar { width:5px; height:5px; }
#professores ::-webkit-scrollbar-track { background:var(--dp-gray-100); }
#professores ::-webkit-scrollbar-thumb { background:var(--dp-gray-400); border-radius:4px; }

/* ── MODAL CONTRATO ── */
.dp-modal-contrato-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:9000; animation:dpFadeIn .15s ease; }
.dp-modal-contrato { background:white; border-radius:1rem; box-shadow:0 24px 48px rgba(0,0,0,.2); width:95%; max-width:600px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
.dp-modal-contrato-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid var(--dp-gray-200); }
.dp-modal-contrato-header h2 { font-size:1.1rem; font-weight:700; margin:0; color:var(--dp-gray-800); }
.dp-modal-contrato-close { background:none; border:none; font-size:1.4rem; cursor:pointer; color:var(--dp-gray-400); transition:color var(--dp-transition); }
.dp-modal-contrato-close:hover { color:var(--dp-red); }
.dp-modal-contrato-tabs { display:flex; border-bottom:1px solid var(--dp-gray-200); }
.dp-modal-contrato-tab { flex:1; padding:.75rem 1rem; font-family:'Comfortaa',cursive; font-size:.85rem; font-weight:600; border:none; cursor:pointer; transition:all var(--dp-transition); border-bottom:3px solid transparent; }
.dp-modal-contrato-tab--vinculo { background:var(--dp-green-light); color:var(--dp-green); }
.dp-modal-contrato-tab--vinculo:hover { background:#bbf7d0; }
.dp-modal-contrato-tab--vinculo.active { border-bottom-color:var(--dp-green); background:#bbf7d0; }
.dp-modal-contrato-tab--desligamento { background:var(--dp-red-light); color:var(--dp-red); }
.dp-modal-contrato-tab--desligamento:hover { background:#fecaca; }
.dp-modal-contrato-tab--desligamento.active { border-bottom-color:var(--dp-red); background:#fecaca; }
.dp-modal-contrato-body { flex:1; overflow-y:auto; padding:1rem 1.25rem; }
.dp-modal-contrato-panel { display:none; }
.dp-modal-contrato-panel.active { display:block; }
.dp-modal-contrato-marcar-todos { display:flex; align-items:center; gap:.5rem; padding:.5rem .75rem; background:var(--dp-gray-50); border-radius:.5rem; margin-bottom:.75rem; cursor:pointer; font-size:.8rem; font-weight:600; color:var(--dp-gray-600); transition:background var(--dp-transition); }
.dp-modal-contrato-marcar-todos:hover { background:var(--dp-gray-100); }
.dp-modal-contrato-lista { display:flex; flex-direction:column; gap:.35rem; max-height:320px; overflow-y:auto; }
.dp-modal-contrato-item { display:flex; align-items:center; gap:.6rem; padding:.5rem .75rem; border-radius:.5rem; cursor:pointer; transition:background var(--dp-transition); font-size:.82rem; }
.dp-modal-contrato-item:hover { background:var(--dp-gray-50); }
.dp-modal-contrato-item input[type="checkbox"] { width:1rem; height:1rem; accent-color:var(--dp-green); }
.dp-modal-contrato-busca { margin-bottom:.75rem; }
.dp-modal-contrato-selecionados-lista { display:flex; flex-direction:column; gap:.35rem; max-height:150px; overflow-y:auto; margin-bottom:.75rem; }
.dp-modal-contrato-selecionado { padding:.5rem .75rem; background:var(--dp-orange-light); border-radius:.5rem; font-size:.82rem; display:flex; align-items:center; justify-content:space-between; }
.dp-modal-contrato-selecionado-nome { font-weight:600; color:var(--dp-orange); }
.dp-modal-contrato-selecionado-remover { background:none; border:none; color:var(--dp-red); cursor:pointer; font-size:.9rem; padding:0 .25rem; }
.dp-modal-contrato-selecionado-remover:hover { color:#991b1b; }
.dp-modal-contrato-motivos { display:flex; flex-direction:column; gap:.35rem; }
.dp-modal-contrato-motivo { display:flex; align-items:center; gap:.6rem; padding:.5rem .75rem; border-radius:.5rem; cursor:pointer; transition:background var(--dp-transition); font-size:.82rem; }
.dp-modal-contrato-motivo:hover { background:var(--dp-red-light); }
.dp-modal-contrato-motivo input[type="checkbox"] { width:1rem; height:1rem; accent-color:var(--dp-red); }
.dp-modal-contrato-footer { padding:1rem 1.25rem; border-top:1px solid var(--dp-gray-200); }
.dp-modal-contrato-footer .dp-btn { width:100%; justify-content:center; font-size:.9rem; padding:.6rem 1rem; }
.dp-autocomplete-dropdown { position:absolute; top:100%; left:0; right:0; background:white; border:1px solid var(--dp-gray-200); border-radius:.5rem; box-shadow:var(--dp-shadow); max-height:200px; overflow-y:auto; z-index:100; margin-top:.25rem; }
.dp-autocomplete-item { padding:.5rem .75rem; cursor:pointer; font-size:.82rem; transition:background var(--dp-transition); }
.dp-autocomplete-item:hover { background:var(--dp-orange-light); }
.dp-autocomplete-empty { padding:.5rem .75rem; color:var(--dp-gray-400); font-size:.82rem; font-style:italic; }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────────
  // 1.7  INJECT HTML
  // ─────────────────────────────────────────────────────────────
  function injectHTML() {
    const root = $root();
    if (!root) return;
    root.innerHTML = `
<!-- Tabs bar -->
<div class="dp-tabs-bar">
  <button class="dp-tab dp-tab--active" data-dptab="dp-tab-bancoDados">🗂 Banco de Dados</button>
  <button class="dp-tab"               data-dptab="dp-tab-edicao">✏️ Edição de Professores</button>
  <button class="dp-tab"               data-dptab="dp-tab-candidatos">👥 Avaliação de Candidatos</button>
  <button id="dp-btnGerarContrato" class="dp-btn dp-btn--success"><i class="fas fa-file-contract" style="margin-right:.4rem"></i>Gerar Contrato</button>
</div>

<!-- ═══ TAB 1 — BANCO DE DADOS ═══════════════════════════════ -->
<div id="dp-tab-bancoDados" class="dp-tab-content dp-tab-content--active">
  <!-- Filtros -->
  <div class="dp-filters-bar" id="dp-filtrosBar">
    <div class="dp-filter-group" style="flex:1;min-width:160px">
      <input id="dp-filtroNome"   type="search" class="dp-input" placeholder="Buscar por nome…">
    </div>
    <div class="dp-filter-group" style="flex:1;min-width:140px">
      <input id="dp-filtroBairro" type="search" class="dp-input" placeholder="Buscar por bairro…">
    </div>
    <!-- Dias / Turnos -->
    <div class="dp-filter-group">
      <button id="dp-diasTurnosToggle" class="dp-btn dp-btn--ghost dp-dropdown-btn" style="min-width:180px">
        Dias e turnos <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
      <div id="dp-diasTurnosMenu" class="dp-dropdown-menu" style="display:none;min-width:220px;padding:.5rem">
        <div id="dp-diasTurnosContainer"></div>
      </div>
    </div>
    <!-- Disciplinas -->
    <div class="dp-filter-group">
      <button id="dp-disciplinasToggle" class="dp-btn dp-btn--ghost dp-dropdown-btn" style="min-width:170px">
        Disciplinas <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
      <div id="dp-disciplinasMenu" class="dp-dropdown-menu" style="display:none;padding:.5rem">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem" id="dp-disciplinasList"></div>
      </div>
    </div>
    <!-- Experiências -->
    <div class="dp-filter-group">
      <button id="dp-expToggle" class="dp-btn dp-btn--ghost dp-dropdown-btn" style="min-width:160px">
        Experiências <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
      <div id="dp-expMenu" class="dp-dropdown-menu" style="display:none;padding:.5rem">
        <label class="dp-dropdown-item"><input type="checkbox" name="dp-filtroCat" value="expTdics"> Tecnologias Educacionais</label>
        <label class="dp-dropdown-item"><input type="checkbox" name="dp-filtroCat" value="expAulas"> Aulas Particulares</label>
        <label class="dp-dropdown-item"><input type="checkbox" name="dp-filtroCat" value="expNeuro"> Alunos Atípicos</label>
      </div>
    </div>
    <!-- Selecionar colunas -->
    <div class="dp-filter-group">
      <button id="dp-colunasToggle" class="dp-btn dp-btn--ghost dp-dropdown-btn" style="min-width:170px;color:var(--dp-orange)">
        Selecionar colunas <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
      <div id="dp-colunasMenu" class="dp-dropdown-menu" style="display:none">
        <div id="dp-colunasList"></div>
      </div>
    </div>
    <!-- Limpar -->
    <button id="dp-limparBusca" class="dp-btn dp-btn--primary dp-btn--sm" style="margin-left:auto;align-self:center">Limpar Busca</button>
  </div>
  <!-- Tabela -->
  <div class="dp-table-wrapper">
    <table id="dp-tabela" aria-label="Tabela de Professores">
      <thead><tr></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</div>

<!-- ═══ TAB 2 — EDIÇÃO DE PROFESSORES ════════════════════════ -->
<div id="dp-tab-edicao" class="dp-tab-content" style="overflow:hidden;position:relative">
  <!-- Grid view -->
  <div id="dp-gridView" style="display:flex;flex-direction:column;height:100%;overflow:hidden">
    <div style="padding:.75rem 1rem;background:white;border-bottom:1px solid var(--dp-gray-200);display:flex;align-items:center;gap:.75rem;flex-shrink:0">
      <h2 style="font-size:.95rem;font-weight:700;color:var(--dp-gray-800);flex:1">Professores</h2>
    </div>
    <div style="flex:1;overflow-y:auto;padding:1rem">
      <div id="dp-gridPerfis"></div>
    </div>
  </div>
  <!-- Painel detalhe -->
  <div id="dp-painelView" style="display:none;flex-direction:column;height:100%;overflow:hidden;background:white">
    <div style="padding:.6rem 1rem;background:white;border-bottom:1px solid var(--dp-gray-200);display:flex;align-items:center;gap:.6rem;flex-shrink:0">
      <button id="dp-btnVoltar" class="dp-btn dp-btn--ghost dp-btn--sm">← Voltar</button>
      <h2 id="dp-painelTitulo" style="font-size:.9rem;font-weight:700;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"></h2>
      <button id="dp-btnSalvarEdicao" class="dp-btn dp-btn--primary dp-btn--sm">Salvar Alterações</button>
    </div>
    <div id="dp-painelCampos" style="flex:1;overflow-y:auto;padding:1rem"></div>
  </div>
</div>

<!-- ═══ TAB 3 — CANDIDATOS ════════════════════════════════════ -->
<div id="dp-tab-candidatos" class="dp-tab-content">
  <div class="dp-cand-layout">
    <!-- Coluna 1: filtros + lista -->
    <div class="dp-cand-col">
      <div style="padding:.6rem .75rem;background:white;border-bottom:1px solid var(--dp-gray-200);display:flex;flex-direction:column;gap:.4rem;flex-shrink:0">
        <select id="dp-filtroStatusCand" class="dp-select" style="font-size:.75rem">
          <option value="">Todos os status</option>
          <option value="Candidato">Candidato</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Reprovado">Reprovado</option>
        </select>
        <select id="dp-filtroDiscCand" class="dp-select" style="font-size:.75rem">
          <option value="">Todas as disciplinas</option>
        </select>
        <select id="dp-filtroDataCand" class="dp-select" style="font-size:.75rem">
          <option value="">Todas as datas</option>
          <option value="sem-data">Sem data agendada</option>
          <option value="mes">Selecionar mês</option>
        </select>
        <div id="dp-listaMeses" style="display:none;max-height:90px;overflow-y:auto;border:1px solid var(--dp-gray-200);border-radius:.4rem;background:white"></div>
      </div>
      <div class="dp-cand-col-inner" style="padding:.5rem">
        <div id="dp-listaCandidatos"></div>
      </div>
    </div>
    <!-- Coluna 2: dados candidato -->
    <div class="dp-cand-col">
      <div id="dp-candDados" class="dp-cand-col-inner">
        <p id="dp-candPlaceholder" style="color:var(--dp-gray-400);font-size:.8rem;text-align:center;margin-top:2rem">Selecione um candidato para ver os detalhes</p>
        <!-- disponibilidade -->
        <div id="dp-secDisp" style="display:none;margin-bottom:.75rem">
          <h4 style="font-size:.75rem;font-weight:700;color:var(--dp-gray-600);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">Disponibilidade</h4>
          <table class="dp-disp-table">
            <thead><tr>
              <th></th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sáb</th>
            </tr></thead>
            <tbody>
              <tr>
                <th>Manhã</th>
                <td id="dp-segManha">-</td><td id="dp-terManha">-</td><td id="dp-quaManha">-</td>
                <td id="dp-quiManha">-</td><td id="dp-sexManha">-</td><td id="dp-sabManha">-</td>
              </tr>
              <tr>
                <th>Tarde</th>
                <td id="dp-segTarde">-</td><td id="dp-terTarde">-</td><td id="dp-quaTarde">-</td>
                <td id="dp-quiTarde">-</td><td id="dp-sexTarde">-</td><td id="dp-sabTarde">-</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- disciplinas -->
        <div id="dp-secDisc" style="display:none;margin-bottom:.75rem">
          <h4 style="font-size:.75rem;font-weight:700;color:var(--dp-gray-600);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">Disciplinas</h4>
          <div id="dp-gridDisciplinas" class="dp-disc-grid"></div>
        </div>
        <!-- informações -->
        <div id="dp-secInfo" style="display:none;margin-bottom:.75rem">
          <h4 style="font-size:.75rem;font-weight:700;color:var(--dp-gray-600);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">Informações</h4>
          <div id="dp-informacoesCandidato" style="font-size:.78rem;display:flex;flex-direction:column;gap:.3rem;max-height:200px;overflow-y:auto;padding-right:4px"></div>
        </div>
        <!-- experiências -->
        <div id="dp-secExp" style="display:none">
          <h4 style="font-size:.75rem;font-weight:700;color:var(--dp-gray-600);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">Experiências</h4>
          <div id="dp-experienciasConteudo" style="max-height:220px;overflow-y:auto;padding-right:4px;display:flex;flex-direction:column;gap:.5rem;font-size:.78rem"></div>
        </div>
      </div>
    </div>
    <!-- Coluna 3: avaliação -->
    <div class="dp-cand-col">
      <div class="dp-cand-col-inner dp-aval-section">
        <h4 style="font-size:.8rem;font-weight:700;color:var(--dp-gray-800);margin-bottom:.5rem">Avaliação</h4>
        <div class="dp-aval-row">
          <div class="dp-field">
            <label class="dp-field-label">Data entrevista</label>
            <input id="dp-dataEntrevista" type="text" class="dp-input" placeholder="dd/mm/aaaa" maxlength="10">
          </div>
          <div class="dp-field">
            <label class="dp-field-label">Hora</label>
            <input id="dp-horaEntrevista" type="text" class="dp-input" placeholder="HH:MM" maxlength="5">
          </div>
        </div>
        <div class="dp-field">
          <label class="dp-field-label">Link entrevista</label>
          <div style="display:flex;gap:.4rem">
            <input id="dp-linkEntrevista" type="text" class="dp-input" placeholder="https://…">
            <button id="dp-copiarLink" class="dp-btn dp-btn--ghost dp-btn--sm" style="white-space:nowrap">Copiar</button>
          </div>
        </div>
        <div class="dp-field">
          <label class="dp-field-label">Impressões do avaliador</label>
          <textarea id="dp-impressoesCandidato" class="dp-textarea" rows="3" placeholder="Anotações da entrevista…" style="resize:none;height:80px"></textarea>
        </div>
        <div class="dp-field">
          <label class="dp-field-label">Status</label>
          <select id="dp-statusCandidato" class="dp-select">
            <option value="Candidato">Candidato</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Aprovado">Aprovado</option>
          </select>
        </div>
        <button id="dp-btnSalvarAval" class="dp-btn dp-btn--primary" style="width:100%">💾 Salvar Alterações</button>
        <button id="dp-btnCopiarRelatorio" class="dp-btn dp-btn--ghost" style="width:100%">📋 Copiar Relatório</button>
        <div style="display:flex;flex-direction:column;gap:.35rem;margin-top:.25rem">
          <button id="dp-btnAprovado"   class="dp-btn" style="width:100%;background:var(--dp-green-light);color:var(--dp-green);border-color:var(--dp-green)">✅ Candidato Aprovado</button>
          <button id="dp-btnReprovado"  class="dp-btn" style="width:100%;background:var(--dp-red-light);color:var(--dp-red);border-color:var(--dp-red)">❌ Candidato Reprovado</button>
          <button id="dp-btnDesistente" class="dp-btn" style="width:100%;background:var(--dp-gray-100);color:var(--dp-gray-600);border-color:var(--dp-gray-200)">🚫 Candidato Desistente</button>
        </div>
        <hr style="margin:.4rem 0;border-color:var(--dp-gray-200)">
        <button id="dp-btnExcluirCand"  class="dp-btn dp-btn--danger"  style="width:100%">🗑 Excluir Candidato</button>
        <button id="dp-btnPromover"     class="dp-btn dp-btn--success" style="width:100%">🎓 Promover Professor</button>
      </div>
    </div>
  </div>
</div>

<!-- TOAST -->
<div id="dp-toast" style="position:fixed;top:1.2rem;right:1.2rem;z-index:9999;display:flex;flex-direction:column;gap:.4rem;pointer-events:none"></div>

<!-- POPUP OVERLAY -->
<div id="dp-popupOverlay" class="dp-popup-overlay" style="display:none"></div>

<!-- MODAL CONTRATO -->
<div id="dp-modalContratoOverlay" class="dp-modal-contrato-overlay" style="display:none">
  <div class="dp-modal-contrato">
    <div class="dp-modal-contrato-header">
      <h2><i class="fas fa-file-contract" style="margin-right:.5rem;color:var(--dp-orange)"></i>Gerar Contrato</h2>
      <button id="dp-modalContratoClose" class="dp-modal-contrato-close">&times;</button>
    </div>
    <div class="dp-modal-contrato-tabs">
      <button class="dp-modal-contrato-tab dp-modal-contrato-tab--vinculo active" data-panel="vinculo">Contratação e Renovação de Equipe</button>
      <button class="dp-modal-contrato-tab dp-modal-contrato-tab--desligamento" data-panel="desligamento">Desligamento</button>
    </div>
    <div class="dp-modal-contrato-body">
      <!-- Painel Vinculo -->
      <div id="dp-panelVinculo" class="dp-modal-contrato-panel active">
        <label class="dp-modal-contrato-marcar-todos">
          <input type="checkbox" id="dp-marcarTodosProfessores">
          <span>Marcar todos</span>
        </label>
        <div id="dp-listaProfessoresVinculo" class="dp-modal-contrato-lista"></div>
      </div>
      <!-- Painel Desligamento -->
      <div id="dp-panelDesligamento" class="dp-modal-contrato-panel">
        <div class="dp-modal-contrato-busca" style="position:relative">
          <input type="text" id="dp-buscaProfessorDesligamento" class="dp-input" placeholder="Buscar professor para desligamento...">
          <div id="dp-autocompleteProfessor" class="dp-autocomplete-dropdown" style="display:none"></div>
        </div>
        <div id="dp-professorSelecionadoDesligamento"></div>
        <div id="dp-motivosDesligamento" class="dp-modal-contrato-motivos" style="display:none">
          <p style="font-size:.78rem;color:var(--dp-gray-600);margin-bottom:.5rem;font-weight:600">Motivos do desligamento:</p>
          <label class="dp-modal-contrato-motivo">
            <input type="checkbox" name="motivoDesligamento" value="Baixo desempenho">
            <span>Baixo desempenho</span>
          </label>
          <label class="dp-modal-contrato-motivo">
            <input type="checkbox" name="motivoDesligamento" value="Falta de comprometimento">
            <span>Falta de comprometimento</span>
          </label>
          <label class="dp-modal-contrato-motivo">
            <input type="checkbox" name="motivoDesligamento" value="Pedido de desligamento">
            <span>Pedido de desligamento</span>
          </label>
          <label class="dp-modal-contrato-motivo">
            <input type="checkbox" name="motivoDesligamento" value="Quebra de contrato">
            <span>Quebra de contrato</span>
          </label>
          <label class="dp-modal-contrato-motivo">
            <input type="checkbox" name="motivoDesligamento" value="Indisponibilidade de horários">
            <span>Indisponibilidade de horários</span>
          </label>
          <label class="dp-modal-contrato-motivo">
            <input type="checkbox" name="motivoDesligamento" value="Outros motivos">
            <span>Outros motivos</span>
          </label>
          <div style="margin-top:.75rem">
            <label style="font-size:.78rem;color:var(--dp-gray-600);font-weight:600;display:block;margin-bottom:.35rem">Observações adicionais:</label>
            <textarea id="dp-observacoesDesligamento" class="dp-input" placeholder="Descreva detalhes adicionais sobre o desligamento..." style="width:100%;max-height:200px;min-height:80px;resize:vertical;overflow-y:auto"></textarea>
          </div>
        </div>
      </div>
    </div>
    <div class="dp-modal-contrato-footer">
      <button id="dp-btnGerarContratoVinculo" class="dp-btn dp-btn--success"><i class="fas fa-file-signature" style="margin-right:.4rem"></i>Gerar Contrato de Vínculo</button>
      <button id="dp-btnGerarContratoDesligamento" class="dp-btn dp-btn--danger" style="display:none"><i class="fas fa-file-signature" style="margin-right:.4rem"></i>Gerar Contrato de Desligamento</button>
    </div>
  </div>
</div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // 1.7.1  MODAL CONTRATO — Funções
  // ─────────────────────────────────────────────────────────────
  let professoresDesligamentoSelecionados = [];

  function abrirModalContrato() {
    const overlay = $id('dp-modalContratoOverlay');
    if (!overlay) return;
    
    // Resetar estado
    professoresDesligamentoSelecionados = [];
    
    // Popular lista de professores
    popularListaProfessoresVinculo();
    
    // Resetar para tab de vínculo
    trocarTabContrato('vinculo');
    
    // Limpar campos de desligamento
    const buscaInput = $id('dp-buscaProfessorDesligamento');
    if (buscaInput) buscaInput.value = '';
    renderizarProfessoresSelecionadosDesligamento();
    const motivosDiv = $id('dp-motivosDesligamento');
    if (motivosDiv) motivosDiv.style.display = 'none';
    $qa('input[name="motivoDesligamento"]').forEach(cb => cb.checked = false);
    const observacoesTextarea = $id('dp-observacoesDesligamento');
    if (observacoesTextarea) observacoesTextarea.value = '';
    
    overlay.style.display = 'flex';
  }

  function renderizarProfessoresSelecionadosDesligamento() {
    const container = $id('dp-professorSelecionadoDesligamento');
    if (!container) return;
    
    if (professoresDesligamentoSelecionados.length === 0) {
      container.innerHTML = '';
      $id('dp-motivosDesligamento').style.display = 'none';
      return;
    }
    
    container.innerHTML = `
      <div class="dp-modal-contrato-selecionados-lista">
        ${professoresDesligamentoSelecionados.map(prof => `
          <div class="dp-modal-contrato-selecionado" data-id="${prof.id}">
            <span class="dp-modal-contrato-selecionado-nome">${safe(prof.nome)}</span>
            <button class="dp-modal-contrato-selecionado-remover" data-id="${prof.id}" title="Remover">&times;</button>
          </div>
        `).join('')}
      </div>
    `;
    
    // Mostrar motivos
    $id('dp-motivosDesligamento').style.display = 'block';
    
    // Adicionar event listeners aos botões de remover
    container.querySelectorAll('.dp-modal-contrato-selecionado-remover').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        professoresDesligamentoSelecionados = professoresDesligamentoSelecionados.filter(p => p.id !== id);
        renderizarProfessoresSelecionadosDesligamento();
      });
    });
  }

  function fecharModalContrato() {
    const overlay = $id('dp-modalContratoOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function trocarTabContrato(panel) {
    // Atualizar tabs
    $qa('.dp-modal-contrato-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.panel === panel);
    });
    
    // Atualizar painéis
    $id('dp-panelVinculo').classList.toggle('active', panel === 'vinculo');
    $id('dp-panelDesligamento').classList.toggle('active', panel === 'desligamento');
    
    // Atualizar botões do footer
    $id('dp-btnGerarContratoVinculo').style.display = panel === 'vinculo' ? 'block' : 'none';
    $id('dp-btnGerarContratoDesligamento').style.display = panel === 'desligamento' ? 'block' : 'none';
  }

  function popularListaProfessoresVinculo() {
    const lista = $id('dp-listaProfessoresVinculo');
    if (!lista || !S.dadosTabela) return;
    
    // Filtrar apenas professores ativos e ordenar alfabeticamente
    const professores = [...S.dadosTabela]
      .filter(p => p.nome)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    
    lista.innerHTML = professores.map(prof => `
      <label class="dp-modal-contrato-item">
        <input type="checkbox" name="professorVinculo" value="${prof.id}" data-nome="${safe(prof.nome)}">
        <span>${safe(prof.nome)}</span>
      </label>
    `).join('');
    
    // Desmarcar todos
    const marcarTodos = $id('dp-marcarTodosProfessores');
    if (marcarTodos) marcarTodos.checked = false;
  }

  function initModalContrato() {
    // Fechar modal
    $id('dp-modalContratoClose')?.addEventListener('click', fecharModalContrato);
    $id('dp-modalContratoOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'dp-modalContratoOverlay') fecharModalContrato();
    });
    
    // Tabs do modal
    $qa('.dp-modal-contrato-tab').forEach(tab => {
      tab.addEventListener('click', () => trocarTabContrato(tab.dataset.panel));
    });
    
    // Marcar todos
    $id('dp-marcarTodosProfessores')?.addEventListener('change', (e) => {
      const checkboxes = $qa('input[name="professorVinculo"]');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
    
    // Busca de professor para desligamento (autocomplete)
    const buscaInput = $id('dp-buscaProfessorDesligamento');
    const autocompleteDropdown = $id('dp-autocompleteProfessor');
    
    if (buscaInput && autocompleteDropdown) {
      buscaInput.addEventListener('input', debounce(() => {
        const termo = buscaInput.value.trim().toLowerCase();
        if (!termo || termo.length < 2) {
          autocompleteDropdown.style.display = 'none';
          return;
        }
        
        // Filtrar professores já selecionados
        const idsSelecionados = professoresDesligamentoSelecionados.map(p => p.id);
        const resultados = (S.dadosTabela || [])
          .filter(p => p.nome && p.nome.toLowerCase().includes(termo) && !idsSelecionados.includes(p.id))
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
          .slice(0, 10);
        
        if (resultados.length === 0) {
          autocompleteDropdown.innerHTML = '<div class="dp-autocomplete-empty">Nenhum professor encontrado</div>';
        } else {
          autocompleteDropdown.innerHTML = resultados.map(prof => `
            <div class="dp-autocomplete-item" data-id="${prof.id}" data-nome="${safe(prof.nome)}">${safe(prof.nome)}</div>
          `).join('');
        }
        
        autocompleteDropdown.style.display = 'block';
      }, 200));
      
      // Selecionar professor do autocomplete
      autocompleteDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dp-autocomplete-item');
        if (!item) return;
        
        const novoProfessor = {
          id: item.dataset.id,
          nome: item.dataset.nome
        };
        
        // Verificar se já está na lista
        if (professoresDesligamentoSelecionados.some(p => p.id === novoProfessor.id)) {
          toast('Este professor já foi selecionado.', 'info');
          buscaInput.value = '';
          autocompleteDropdown.style.display = 'none';
          return;
        }
        
        // Adicionar à lista
        professoresDesligamentoSelecionados.push(novoProfessor);
        
        buscaInput.value = '';
        autocompleteDropdown.style.display = 'none';
        
        // Renderizar lista atualizada
        renderizarProfessoresSelecionadosDesligamento();
      });
      
      // Fechar autocomplete ao clicar fora
      document.addEventListener('click', (e) => {
        if (!buscaInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
          autocompleteDropdown.style.display = 'none';
        }
      });
    }
    
    // Botão Gerar Contrato de Vínculo
    $id('dp-btnGerarContratoVinculo')?.addEventListener('click', () => {
      const selecionados = $qa('input[name="professorVinculo"]:checked');
      if (selecionados.length === 0) {
        toast('Selecione pelo menos um professor para gerar o contrato.', 'error');
        return;
      }
      
      // Obter dados completos dos professores selecionados
      const idsSelecionados = Array.from(selecionados).map(cb => cb.value);
      const professoresComDados = idsSelecionados.map(id => {
        const prof = S.dadosTabela.find(p => p.id === id);
        return {
          id: id,
          nome: prof?.nome || '',
          cpf: prof?.cpf || '',
          endereco: prof?.endereco || ''
        };
      });
      
      fecharModalContrato();
      
      // Chamar função de geração de contratos
      if (typeof window.gerarContratosVinculoProfessores === 'function') {
        window.gerarContratosVinculoProfessores(professoresComDados);
      } else {
        toast('Função de geração de contratos não encontrada. Verifique se o arquivo functions-contratoProfessor.js está carregado.', 'error');
      }
    });
    
    // Botão Gerar Contrato de Desligamento
    $id('dp-btnGerarContratoDesligamento')?.addEventListener('click', () => {
      if (professoresDesligamentoSelecionados.length === 0) {
        toast('Selecione pelo menos um professor para desligamento.', 'error');
        return;
      }
      
      const motivosSelecionados = Array.from($qa('input[name="motivoDesligamento"]:checked')).map(cb => cb.value);
      if (motivosSelecionados.length === 0) {
        toast('Selecione pelo menos um motivo de desligamento.', 'error');
        return;
      }
      
      const nomes = professoresDesligamentoSelecionados.map(p => p.nome);
      const observacoes = ($id('dp-observacoesDesligamento')?.value || '').trim();
      toast(`Gerando contrato de desligamento para ${professoresDesligamentoSelecionados.length} professor(es)...`, 'info');
      fecharModalContrato();
      
      // Aqui você pode chamar a função que gera o contrato
      // gerarContratoDesligamento(professoresDesligamentoSelecionados, motivosSelecionados, observacoes);
      console.log('Professores para desligamento:', nomes);
      console.log('Motivos:', motivosSelecionados);
      console.log('Observações:', observacoes);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 1.8  TABS
  // ─────────────────────────────────────────────────────────────
  function initTabs() {
    $qa('[data-dptab]').forEach(btn => {
      btn.addEventListener('click', () => trocarTab(btn.dataset.dptab));
    });
  }

  function trocarTab(tabId) {
    $qa('[data-dptab]').forEach(btn => {
      btn.classList.toggle('dp-tab--active', btn.dataset.dptab === tabId);
    });
    $qa('.dp-tab-content').forEach(el => {
      el.classList.toggle('dp-tab-content--active', el.id === tabId);
    });
    S.tabAtiva = tabId;

    if (tabId === 'dp-tab-edicao'     && !S.t2Loaded) { S.t2Loaded = true; carregarT2(); }
    if (tabId === 'dp-tab-candidatos' && !S.t3Loaded) { S.t3Loaded = true; carregarT3(); }
  }

  // ─────────────────────────────────────────────────────────────
  // 1.9  TOAST
  // ─────────────────────────────────────────────────────────────
  function toast(msg, tipo = 'info') {
    const cnt = $id('dp-toast');
    if (!cnt) return;
    const t = document.createElement('div');
    t.className = `dp-toast dp-toast--${tipo}`;
    t.style.pointerEvents = 'auto';
    const icon = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    t.innerHTML = `<span style="font-size:1rem">${icon}</span><span>${msg}</span>`;
    cnt.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2800);
    setTimeout(() => t.remove(), 3200);
  }

  // ─────────────────────────────────────────────────────────────
  // 1.10  POPUP genérico de confirmação
  // ─────────────────────────────────────────────────────────────
  function popup({ titulo, corpo, labelOk = 'Confirmar', labelCancel = 'Cancelar', tipoOk = 'danger', onOk }) {
    const overlay = $id('dp-popupOverlay');
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="dp-popup-box">
        <div style="display:flex;justify-content:center;margin-bottom:.6rem">
          <div style="width:3.5rem;height:3.5rem;background:var(--dp-red-light);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem">${tipoOk === 'danger' ? '🗑' : '✅'}</div>
        </div>
        <h3>${titulo}</h3>
        <p>${corpo}</p>
        <div class="dp-popup-actions">
          <button id="dp-popupCancel" class="dp-btn dp-btn--ghost">${labelCancel}</button>
          <button id="dp-popupOk"     class="dp-btn dp-btn--${tipoOk}">${labelOk}</button>
        </div>
      </div>`;
    overlay.style.display = 'flex';
    $id('dp-popupCancel').onclick = () => { overlay.style.display = 'none'; };
    $id('dp-popupOk').onclick     = async () => { overlay.style.display = 'none'; if (onOk) await onOk(); };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
  }

    // ============================================================
  // PARTE 2 — TAB1: BANCO DE DADOS
  // ============================================================

  // ─────────────────────────────────────────────────────────────
  // 2.1  Carregar dados do Firebase → Tab1
  // ─────────────────────────────────────────────────────────────
  async function carregarT1() {
    tabelaLoading();
    try {
      const data = await fetchColecao(CFG.colProfessores);
      if (!data.length) { tabelaVazia('Nenhum professor encontrado.'); return; }

      S.dadosTabela = data;
      const todas = Object.keys(data[0]);
      S.colunasDisponiveis = todas
        .filter(c => !CFG.colunasOcultas.includes(c) && !CFG.colunasDiasTurnos.includes(c))
        .concat(['Disponibilidade']);

      if (!S.colunasSelecionadas.length) S.colunasSelecionadas = [...S.colunasDisponiveis];
      S.colunasSelecionadas = aplicarOrdem(S.colunasSelecionadas);

      montarDropdownColunas();
      montarDisciplinasFiltro();
      montarDiasTurnos();
      aplicarFiltros();
    } catch (e) {
      console.error(e);
      tabelaErro('Erro ao carregar dados do Firebase.');
    }
  }

  function tabelaLoading() {
    const tb = $q('#dp-tabela tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="100%" style="padding:2rem;text-align:center;color:var(--dp-gray-400)">Carregando professores…</td></tr>';
  }
  function tabelaVazia(msg) {
    const tb = $q('#dp-tabela tbody');
    if (tb) tb.innerHTML = `<tr><td colspan="100%" style="padding:2rem;text-align:center;color:var(--dp-gray-400)">${msg}</td></tr>`;
  }
  function tabelaErro(msg) {
    const tb = $q('#dp-tabela tbody');
    if (tb) tb.innerHTML = `<tr><td colspan="100%" style="padding:2rem;text-align:center;color:var(--dp-red)">${msg}</td></tr>`;
  }

  // ─────────────────────────────────────────────────────────────
  // 2.2  Dropdown — selecionar colunas (organizado por seções)
  // ─────────────────────────────────────────────────────────────
  const SECOES_COLUNAS = [
    {
      titulo: 'Informações de Perfil',
      campos: ['nome', 'cpf', 'email', 'contato', 'endereco']
    },
    {
      titulo: 'Informações de Aula',
      campos: ['bairros', 'Disponibilidade', 'disciplinas']
    },
    {
      titulo: 'Informações Acadêmicas',
      campos: ['nivel', 'curso', 'descricaoExpAulas', 'descricaoTdics', 'descricaoExpNeuro']
    },
    {
      titulo: 'Informações de Pagamento',
      campos: ['pix']
    },
    {
      titulo: 'Informações do Professor',
      campos: ['dataNascimento', 'status', 'dataAtivacao']
    }
  ];

  // Campos a serem excluídos do dropdown
  const CAMPOS_EXCLUIDOS = ['expAulas', 'expNeuro', 'expTdics', 'foto', 'fotoPerfil', 'dataEnvio', 'timeStamp', 'timestamp'];

  function montarDropdownColunas() {
    const list = $id('dp-colunasList');
    if (!list) return;
    list.innerHTML = '';

    // Filtrar colunas disponíveis removendo as excluídas
    const colunasDispFiltradas = S.colunasDisponiveis.filter(c => !CAMPOS_EXCLUIDOS.includes(c));

    SECOES_COLUNAS.forEach(secao => {
      // Header da seção
      const header = document.createElement('div');
      header.style.cssText = 'padding:.5rem .75rem;font-size:.7rem;font-weight:700;color:var(--dp-gray-600);background:var(--dp-gray-100);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--dp-gray-200);margin-top:.25rem;';
      header.textContent = secao.titulo;
      list.append(header);

      // Campos da seção
      secao.campos.forEach(col => {
        if (!colunasDispFiltradas.includes(col)) return;

        const div = document.createElement('div');
        div.className = 'dp-dropdown-item';
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;gap:.4rem;align-items:center;cursor:pointer;width:100%';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = col;
        cb.className = 'dp-col-cb';
        cb.checked = S.colunasSelecionadas.includes(col);
        cb.addEventListener('change', (e) => {
          e.stopPropagation();
          if (cb.checked) {
            // Adiciona à lista de selecionadas
            if (!S.colunasSelecionadas.includes(col)) S.colunasSelecionadas.push(col);
            // Adiciona ao FINAL da ordem (nova seleção vai para o fim)
            S.colunasOrdem = S.colunasOrdem.filter(c => c !== col); // Remove se existir
            S.colunasOrdem.push(col); // Adiciona no final
          } else {
            // Remove da lista de selecionadas
            S.colunasSelecionadas = S.colunasSelecionadas.filter(c => c !== col);
            // Remove da ordem também
            S.colunasOrdem = S.colunasOrdem.filter(c => c !== col);
          }
          // Aplica a ordem às colunas selecionadas
          S.colunasSelecionadas = aplicarOrdem(S.colunasSelecionadas);
          saveColOrder();
          saveColPrefs();
          aplicarFiltros();
        });
        label.addEventListener('click', e => e.stopPropagation());
        const span = document.createElement('span');
        span.textContent = S.masks[col] || col;
        label.append(cb, span);
        div.append(label);
        list.append(div);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2.3  Filtro disciplinas (lista dinâmica)
  // ─────────────────────────────────────────────────────────────
  function montarDisciplinasFiltro() {
    const cnt = $id('dp-disciplinasList');
    if (!cnt) return;
    cnt.innerHTML = '';
    CFG.disciplinasFixas.forEach(d => {
      const label = document.createElement('label');
      label.className = 'dp-dropdown-item';
      label.style.cssText = 'display:flex;gap:.35rem;align-items:center;padding:.3rem .5rem;';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.name = 'dp-filtroDisciplina'; cb.value = d.label;
      cb.addEventListener('change', (e) => { e.stopPropagation(); aplicarFiltros(); });
      label.addEventListener('click', e => e.stopPropagation());
      label.append(cb, document.createTextNode(' '+d.label));
      cnt.append(label);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2.4  Filtro dias/turnos
  // ─────────────────────────────────────────────────────────────
  function montarDiasTurnos() {
    const cnt = $id('dp-diasTurnosContainer');
    if (!cnt) return;
    cnt.innerHTML = '';
    const dias = [
      { name:'Segunda', key:'seg' },{ name:'Terça',   key:'ter' },
      { name:'Quarta',  key:'qua' },{ name:'Quinta',  key:'qui' },
      { name:'Sexta',   key:'sex' },{ name:'Sábado',  key:'sab' },
    ];
    dias.forEach(d => {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '.2rem';

      const top = document.createElement('label');
      top.style.cssText = 'display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.78rem;padding:.2rem .3rem;border-radius:.3rem';
      top.onmouseenter = () => top.style.background = 'var(--dp-gray-100)';
      top.onmouseleave = () => top.style.background = '';
      const cbDia = document.createElement('input');
      cbDia.type = 'checkbox'; cbDia.value = d.key; cbDia.id = `dp_chk_${d.key}`;
      top.append(cbDia, document.createTextNode(' '+d.name));

      const sub = document.createElement('div');
      sub.className = 'dp-dias-subturnos'; sub.style.display = 'none';

      ['Manhã', 'Tarde'].forEach(t => {
        const tKey = d.key + (t === 'Manhã' ? 'Manha' : 'Tarde');
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;align-items:center;gap:.35rem;font-size:.75rem;padding:.2rem .3rem;cursor:pointer;border-radius:.3rem';
        lbl.onmouseenter = () => lbl.style.background = 'var(--dp-gray-100)';
        lbl.onmouseleave = () => lbl.style.background = '';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.name = 'dp-filtroTurno'; cb.value = tKey;
        cb.addEventListener('change', (e) => { e.stopPropagation(); aplicarFiltros(); });
        lbl.addEventListener('click', e => e.stopPropagation());
        lbl.append(cb, document.createTextNode(' '+t));
        sub.append(lbl);
      });

      cbDia.addEventListener('change', (e) => {
        e.stopPropagation();
        sub.style.display = cbDia.checked ? 'block' : 'none';
        if (!cbDia.checked) sub.querySelectorAll('input').forEach(i => i.checked = false);
        aplicarFiltros();
      });
      top.addEventListener('click', e => e.stopPropagation());

      wrap.append(top, sub);
      cnt.append(wrap);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2.5  Aplicar filtros e renderizar tabela
  // ─────────────────────────────────────────────────────────────
  function aplicarFiltros() {
    if (!S.dadosTabela) return;
    let res = [...S.dadosTabela];

    const nome   = ($id('dp-filtroNome')?.value   || '').trim().toLowerCase();
    const bairro = ($id('dp-filtroBairro')?.value || '').trim().toLowerCase();

    if (nome)   res = res.filter(i => (getField(i,'nome')   || '').toString().toLowerCase().includes(nome));
    if (bairro) res = res.filter(i => (getField(i,'bairros')|| '').toString().toLowerCase().includes(bairro));

    const turnos = $qa('input[name="dp-filtroTurno"]:checked').map(x => x.value);
    if (turnos.length) res = res.filter(i => turnos.some(t => isTruthy(getField(i, t))));

    const discs = $qa('input[name="dp-filtroDisciplina"]:checked').map(x => normalizeStr(x.value));
    if (discs.length) {
      res = res.filter(i => {
        const raw = getField(i,'disciplinas') || '';
        const lista = Array.isArray(raw)
          ? raw.map(x => normalizeStr(String(x))).filter(Boolean)
          : String(raw).split(/[,;|/]/).map(s => normalizeStr(s)).filter(Boolean);
        return discs.every(d => lista.includes(d));
      });
    }

    const cats = $qa('input[name="dp-filtroCat"]:checked').map(x => x.value);
    if (cats.length) res = res.filter(i => cats.every(c => isTruthy(getField(i, c))));

    // sort
    if (S.sortState.column) {
      res.sort((a, b) => {
        const av = getField(a, S.sortState.column), bv = getField(b, S.sortState.column);
        if (isDateCol(S.sortState.column)) {
          const da = parseDateMs(av) || 0, db = parseDateMs(bv) || 0;
          return S.sortState.dir === 'asc' ? da - db : db - da;
        }
        const sa = (av ?? '').toString().toLowerCase();
        const sb = (bv ?? '').toString().toLowerCase();
        if (sa < sb) return S.sortState.dir === 'asc' ? -1 : 1;
        if (sa > sb) return S.sortState.dir === 'asc' ?  1 : -1;
        return 0;
      });
    }

    renderTabela(res);
  }

  function limparFiltros() {
    const nom = $id('dp-filtroNome');   if (nom) nom.value = '';
    const bai = $id('dp-filtroBairro'); if (bai) bai.value = '';
    $qa('input[name="dp-filtroTurno"]').forEach(i => i.checked = false);
    $qa('input[name="dp-filtroDisciplina"]').forEach(i => i.checked = false);
    $qa('input[name="dp-filtroCat"]').forEach(i => i.checked = false);
    $qa('#dp-diasTurnosContainer .dp-dias-subturnos').forEach(s => s.style.display = 'none');
    $qa(`#dp-diasTurnosContainer input[type="checkbox"]`).forEach(i => i.checked = false);
    S.sortState = { column: null, dir: null };
    aplicarFiltros();
  }

  // ─────────────────────────────────────────────────────────────
  // 2.6  Renderizar tabela
  // ─────────────────────────────────────────────────────────────
  function renderTabela(dados) {
    const tab = $id('dp-tabela');
    if (!tab) return;
    const thead = tab.querySelector('thead tr');
    const tbody = tab.querySelector('tbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const cols = S.colunasSelecionadas.filter(c =>
      !CFG.colunasOcultas.includes(c) && !CFG.colunasDiasTurnos.includes(c)
    );

    // cabeçalho
    cols.forEach(col => {
      const th = document.createElement('th');
      th.dataset.col = col;
      th.style.position = 'relative';

      if (isDateCol(col)) {
        const btn = document.createElement('button');
        btn.style.cssText = 'background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:.3rem;font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit;padding:0;width:100%';
        const sp = document.createElement('span'); sp.textContent = S.masks[col] || col;
        const ic = document.createElement('span'); ic.innerHTML = getSortIcon(S.sortState.column === col ? S.sortState.dir : null);
        btn.append(sp, ic);
        btn.addEventListener('click', e => { e.stopPropagation(); toggleSort(col); });
        th.appendChild(btn);
      } else {
        th.textContent = S.masks[col] || col;
        th.addEventListener('click', () => toggleSort(col));
      }

      // resize handle
      const rh = document.createElement('div');
      rh.className = 'dp-resize-handle';
      rh.addEventListener('mousedown', e => iniciarResize(e, th));
      th.appendChild(rh);

      if (S.colWidths[col]) { th.style.width = S.colWidths[col] + 'px'; th.style.minWidth = '40px'; }
      thead.appendChild(th);
    });

    if (!dados.length) { tabelaVazia('Nenhum resultado encontrado.'); return; }

    dados.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.rowId = item.id || idx;

      cols.forEach(col => {
        const td = document.createElement('td');
        td.dataset.field = col;

        if (col === 'Disponibilidade') {
          td.textContent = formatarDisponibilidade(item);
        } else if (col === 'status') {
          const badge = document.createElement('span');
          badge.className = `dp-badge dp-badge--${(item.status || 'candidato').toLowerCase().replace('é','e')}`;
          badge.textContent = item.status || '—';
          td.appendChild(badge);
        } else if (col.toLowerCase() === 'cpf') {
          td.textContent = formatCPF(getField(item, col) || '');
        } else if (['telefone','celular','contato','whatsapp'].some(k => col.toLowerCase().includes(k))) {
          const numero = getField(item, col) || '';
          const span = document.createElement('span');
          span.className = 'dp-cell-copy';
          span.textContent = formatTel(numero);
          const tip = document.createElement('div');
          tip.style.cssText = 'display:none;position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:var(--dp-gray-800);color:white;font-size:.65rem;padding:.2rem .5rem;border-radius:.3rem;white-space:nowrap;z-index:50;pointer-events:none';
          tip.textContent = 'Abrir WhatsApp';
          td.style.position = 'relative';
          td.append(span, tip);
          td.addEventListener('mouseenter', () => tip.style.display = 'block');
          td.addEventListener('mouseleave', () => tip.style.display = 'none');
          td.addEventListener('click', () => { const n = cleanTel(numero); if (n) window.open(`https://wa.me/55${n}`, '_blank'); });
        } else if (['email','e-mail'].some(k => col.toLowerCase().includes(k))) {
          const val = getField(item, col) || '';
          const span = document.createElement('span');
          span.className = 'dp-cell-copy'; span.textContent = val;
          span.addEventListener('click', async e => {
            e.stopPropagation(); await copiar(val); toast('E-mail copiado!', 'success');
          });
          td.appendChild(span);
        } else if (isDateCol(col)) {
          td.textContent = formatDateDisplay(getField(item, col));
        } else {
          const val = getField(item, col);
          td.textContent = val != null ? String(val) : '';
          td.className = 'dp-cell-copy';
          td.addEventListener('click', async () => {
            await copiar(td.textContent.trim());
            toast((S.masks[col] || col) + ' copiado', 'info');
          });
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2.7  Sort
  // ─────────────────────────────────────────────────────────────
  function toggleSort(col) {
    if (S.sortState.column !== col) { S.sortState = { column: col, dir: 'asc' }; }
    else if (S.sortState.dir === 'asc') { S.sortState.dir = 'desc'; }
    else { S.sortState = { column: null, dir: null }; }
    aplicarFiltros();
  }

  function getSortIcon(dir) {
    if (!dir) return `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" opacity=".4"><path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5 5 5M7 13l5 5 5-5"/></svg>`;
    if (dir === 'asc') return `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>`;
    return `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
  }

  // ─────────────────────────────────────────────────────────────
  // 2.8  Resize colunas
  // ─────────────────────────────────────────────────────────────
  function iniciarResize(e, th) {
    S.isResizing = true; S.currentTh = th;
    S.startX = e.pageX; S.startWidth = th.offsetWidth;
    document.body.classList.add('dp-resizing');
    e.preventDefault(); e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!S.isResizing || !S.currentTh) return;
    const w = S.startWidth + (e.pageX - S.startX);
    if (w > 40) {
      S.currentTh.style.width = w + 'px';
      const col = S.currentTh.dataset.col;
      if (col) { S.colWidths[col] = Math.round(w); saveColWidths(); }
    }
  }

  function onMouseUp() {
    if (!S.isResizing) return;
    S.isResizing = false; S.currentTh = null;
    document.body.classList.remove('dp-resizing');
  }

  // ─────────────────────────────────────────────────────────────
  // 2.9  Disponibilidade (coluna virtual)
  // ─────────────────────────────────────────────────────────────
  function formatarDisponibilidade(item) {
    const map = {
      segManha:{dia:'Segunda',t:'Manhã'},segTarde:{dia:'Segunda',t:'Tarde'},
      terManha:{dia:'Terça',  t:'Manhã'},terTarde:{dia:'Terça',  t:'Tarde'},
      quaManha:{dia:'Quarta', t:'Manhã'},quaTarde:{dia:'Quarta', t:'Tarde'},
      quiManha:{dia:'Quinta', t:'Manhã'},quiTarde:{dia:'Quinta', t:'Tarde'},
      sexManha:{dia:'Sexta',  t:'Manhã'},sexTarde:{dia:'Sexta',  t:'Tarde'},
      sabManha:{dia:'Sábado', t:'Manhã'},sabTarde:{dia:'Sábado', t:'Tarde'},
    };
    const por = {};
    Object.entries(map).forEach(([k,v]) => {
      if (isTruthy(getField(item, k))) {
        if (!por[v.dia]) por[v.dia] = [];
        por[v.dia].push(v.t);
      }
    });
    return Object.entries(por).map(([dia, ts]) =>
      ts.length === 2 ? `${dia}: Manhã e Tarde` : `${dia}: ${ts[0]}`
    ).join(', ');
  }

  // ─────────────────────────────────────────────────────────────
  // 2.10  Dropdowns genéricos (fechar ao clicar fora)
  // ─────────────────────────────────────────────────────────────
  function initDropdownsT1() {
    const pairs = [
      ['dp-diasTurnosToggle',  'dp-diasTurnosMenu'],
      ['dp-disciplinasToggle', 'dp-disciplinasMenu'],
      ['dp-expToggle',         'dp-expMenu'],
      ['dp-colunasToggle',     'dp-colunasMenu'],
    ];
    pairs.forEach(([btnId, menuId]) => {
      const btn = $id(btnId), menu = $id(menuId);
      if (!btn || !menu) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = menu.style.display !== 'none';
        closeAllDropdowns();
        if (!open) {
          menu.style.display = 'block';
        }
      });
      // Impedir fechamento ao clicar dentro do menu
      menu.addEventListener('click', e => e.stopPropagation());
    });
    document.addEventListener('click', closeAllDropdowns);
    $id('dp-limparBusca')?.addEventListener('click', limparFiltros);

    // Event listeners para checkboxes de experiências (definidos no HTML)
    $qa('input[name="dp-filtroCat"]').forEach(cb => {
      cb.addEventListener('change', (e) => { e.stopPropagation(); aplicarFiltros(); });
      cb.parentElement?.addEventListener('click', e => e.stopPropagation());
    });

    const dbn = debounce(aplicarFiltros);
    $id('dp-filtroNome')?.addEventListener('input',   dbn);
    $id('dp-filtroBairro')?.addEventListener('input', dbn);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }

  function closeAllDropdowns() {
    ['dp-diasTurnosMenu','dp-disciplinasMenu','dp-expMenu','dp-colunasMenu'].forEach(id => {
      const m = $id(id);
      if (m) m.style.display = 'none';
    });
  }

  // ============================================================
  // PARTE 3 — TAB2: EDIÇÃO · TAB3: CANDIDATOS · INIT
  // ============================================================

  // ─────────────────────────────────────────────────────────────
  // 3.1  TAB2 — Carregar e renderizar grid de professores
  // ─────────────────────────────────────────────────────────────
  async function carregarT2() {
    const grid = $id('dp-gridPerfis');
    if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--dp-gray-400);padding:2rem">Carregando professores…</p>';
    try {
      S.registros = await fetchColecao(CFG.colProfessores);
      renderGridProfessores();
    } catch (e) {
      if (grid) grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--dp-red);padding:2rem">Erro: ${e.message}</p>`;
    }
  }

  function renderGridProfessores() {
    const grid = $id('dp-gridPerfis');
    if (!grid) return;
    grid.innerHTML = '';

    if (!S.registros.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--dp-gray-400);padding:3rem;font-size:.9rem">👨‍🏫<br>Nenhum professor encontrado</div>';
      return;
    }

    S.registros
      .slice()
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
      .forEach(prof => grid.appendChild(criarCardProfessor(prof)));
  }

  function criarCardProfessor(item) {
    const card = document.createElement('div');
    card.className = 'dp-card';
    card.dataset.id = item.id;

    // botão excluir
    const btnDel = document.createElement('button');
    btnDel.className = 'dp-card__del';
    btnDel.title = 'Excluir professor';
    btnDel.innerHTML = `<svg width="14" height="14" fill="none" stroke="var(--dp-red)" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
    btnDel.addEventListener('click', e => { e.stopPropagation(); confirmarExclusaoProfessor(item); });
    card.appendChild(btnDel);

    // foto
    const img = document.createElement('div');
    const caminho = getCaminhoFoto(item.fotoPerfil);
    if (caminho) {
      const el = document.createElement('img');
      el.src = caminho; el.alt = item.nome || 'Professor';
      el.className = 'dp-card__img';
      el.onerror = () => { el.replaceWith(fallbackIcon()); };
      img.appendChild(el);
    } else {
      img.appendChild(fallbackIcon());
    }
    card.appendChild(img);

    // nome
    const nome = document.createElement('p');
    nome.className = 'dp-card__nome';
    const nomeComp = item.nome || 'Sem nome';
    nome.textContent = nomeComp.length > 26 ? nomeComp.slice(0, 26) + '…' : nomeComp;
    nome.title = nomeComp;
    card.appendChild(nome);

    // status badge
    const badge = document.createElement('span');
    badge.className = `dp-badge dp-badge--${(item.status||'ativo').toLowerCase().replace('é','e').replace('ã','a')}`;
    badge.textContent = item.status || 'Ativo';
    card.appendChild(badge);

    card.addEventListener('click', () => abrirPainelEdicao(item));
    return card;
  }

  function fallbackIcon() {
    const d = document.createElement('div');
    d.className = 'dp-card__fallback'; d.innerHTML = '👨‍🏫'; return d;
  }

  // ─────────────────────────────────────────────────────────────
  // 3.2  TAB2 — Painel de edição
  // ─────────────────────────────────────────────────────────────
  function abrirPainelEdicao(item) {
    S.t2Selecionado   = item;
    S.t2SelecionadoId = item.id;

    const titulo = $id('dp-painelTitulo');
    if (titulo) titulo.textContent = item.nome || 'Detalhes do Professor';

    const campos = $id('dp-painelCampos');
    campos.innerHTML = '';

    const prioridades   = ['nome','cpf','email','contato','nivel','curso','pix','bairros','disciplinas','status','fotoPerfil'];
    const disponibilidades = CFG.colunasDiasTurnos;
    const outros = Object.keys(item).filter(k => k !== 'id' && !prioridades.includes(k) && !disponibilidades.includes(k));

    const mkSection = (titulo, gridClass = 'dp-painel-grid') => {
      const sec = document.createElement('div'); sec.className = 'dp-painel-secao';
      sec.innerHTML = `<h3>${titulo}</h3>`;
      const g = document.createElement('div'); g.className = gridClass;
      sec.appendChild(g); campos.appendChild(sec); return g;
    };

    const gInfo = mkSection('Informações Básicas');
    prioridades.forEach(k => {
      if (item.hasOwnProperty(k) || k === 'status' || k === 'fotoPerfil') {
        gInfo.appendChild(criarCampoEdicao(k, item[k] ?? (k === 'fotoPerfil' ? 'icone-padrao' : '')));
      }
    });

    const gDisp = mkSection('Disponibilidade', 'dp-painel-grid dp-painel-grid3');
    disponibilidades.forEach(k => gDisp.appendChild(criarCampoEdicao(k, item[k] ?? false)));

    if (outros.length) {
      const gExp = mkSection('Experiências e Observações', 'dp-painel-grid');
      outros.forEach(k => gExp.appendChild(criarCampoEdicao(k, item[k] ?? '')));
    }

    $id('dp-gridView').style.display  = 'none';
    $id('dp-painelView').style.display = 'flex';
    campos.scrollTop = 0;
  }

  function criarCampoEdicao(chave, valor) {
    const wrap = document.createElement('div'); wrap.className = 'dp-field';
    const label = document.createElement('label'); label.className = 'dp-field-label';
    label.htmlFor = `dp-campo-${chave}`; label.textContent = labelDeChave(chave);
    wrap.appendChild(label);

    let inp;
    const vs = safe(valor);

    if (chave === 'status') {
      inp = document.createElement('select'); inp.className = 'dp-select';
      ['Ativo','Inativo','Férias','Afastado'].forEach(o => {
        const op = document.createElement('option'); op.value = o; op.textContent = o;
        op.selected = vs === o; inp.appendChild(op);
      });
    } else if (chave === 'fotoPerfil') {
      inp = document.createElement('select'); inp.className = 'dp-select';
      getOpcoesFoto().forEach(o => {
        const op = document.createElement('option'); op.value = o;
        op.textContent = o === 'icone-padrao' ? 'Ícone Padrão' : o.replace('.png','');
        op.selected = vs === o || (!vs && o === 'icone-padrao'); inp.appendChild(op);
      });
      // preview
      const pv = document.createElement('div'); pv.id = 'dp-preview-foto'; pv.style.cssText = 'margin-top:.5rem;display:flex;justify-content:center';
      const atualizarPv = v => {
        pv.innerHTML = '';
        const p = getCaminhoFoto(v);
        if (p) {
          const im = document.createElement('img'); im.src = p; im.style.cssText = 'width:10rem;height:10rem;object-fit:cover;border-radius:.5rem;border:2px solid var(--dp-orange)';
          im.onerror = () => pv.innerHTML = '<span style="font-size:3rem">👨‍🏫</span>';
          pv.appendChild(im);
        } else { pv.innerHTML = '<span style="font-size:3rem">👨‍🏫</span>'; }
      };
      atualizarPv(vs || 'icone-padrao');
      inp.addEventListener('change', e => atualizarPv(e.target.value));
      wrap.appendChild(inp); wrap.appendChild(pv); inp.dataset.field = chave; return wrap;
    } else if (CFG.colunasDiasTurnos.includes(chave)) {
      inp = document.createElement('select'); inp.className = 'dp-select';
      [{ v:'true', l:'✅ Disponível' },{ v:'false', l:'❌ Indisponível' }].forEach(({ v, l }) => {
        const op = document.createElement('option'); op.value = v; op.textContent = l;
        op.selected = String(vs) === v; inp.appendChild(op);
      });
    } else if (vs.length > 100 || chave.includes('descricao')) {
      inp = document.createElement('textarea'); inp.className = 'dp-textarea'; inp.rows = 4; inp.value = vs;
    } else {
      inp = document.createElement('input'); inp.type = 'text'; inp.className = 'dp-input'; inp.value = vs;
    }

    inp.id = `dp-campo-${chave}`; inp.name = chave; inp.dataset.field = chave;
    wrap.appendChild(inp); return wrap;
  }

  function labelDeChave(k) {
    const map = {
      nome:'Nome Completo',cpf:'CPF',email:'E-mail',contato:'Telefone/WhatsApp',nivel:'Nível Acadêmico',
      curso:'Curso',pix:'Chave PIX',bairros:'Bairros de Atuação',disciplinas:'Disciplinas (separadas por vírgula)',
      expAulas:'Exp. Aulas Particulares',descricaoExpAulas:'Desc. Exp. Aulas',
      expNeuro:'Exp. Alunos Atípicos',descricaoExpNeuro:'Desc. Exp. Alunos Atípicos',
      expTdics:'Exp. TDICs',descricaoTdics:'Desc. Exp. TDICs',
      endereco:'Endereço',cep:'CEP',status:'Status',dataAtivacao:'Data de Ativação',fotoPerfil:'Foto de Perfil',
      segManha:'Segunda — Manhã',segTarde:'Segunda — Tarde',terManha:'Terça — Manhã',terTarde:'Terça — Tarde',
      quaManha:'Quarta — Manhã',quaTarde:'Quarta — Tarde',quiManha:'Quinta — Manhã',quiTarde:'Quinta — Tarde',
      sexManha:'Sexta — Manhã',sexTarde:'Sexta — Tarde',sabManha:'Sábado — Manhã',sabTarde:'Sábado — Tarde',
    };
    return map[k] || k.charAt(0).toUpperCase() + k.slice(1);
  }

  async function salvarEdicao() {
    if (!S.t2SelecionadoId) { toast('Nenhum professor selecionado.', 'error'); return; }
    const campos = $id('dp-painelCampos');
    const inputs = Array.from(campos.querySelectorAll('input,textarea,select'));
    const dados = {};
    inputs.forEach(inp => {
      if (!inp.dataset.field) return;
      let val = inp.value.trim();
      if (inp.tagName === 'SELECT' && CFG.colunasDiasTurnos.includes(inp.dataset.field)) val = val === 'true';
      dados[inp.dataset.field] = val;
    });
    if (!dados.nome || !dados.nome.trim()) { toast('O campo "Nome Completo" é obrigatório.', 'error'); return; }
    const btn = $id('dp-btnSalvarEdicao');
    if (btn) { btn.textContent = 'Salvando…'; btn.disabled = true; }
    try {
      await updateDoc(CFG.colProfessores, S.t2SelecionadoId, dados);
      const idx = S.registros.findIndex(r => r.id === S.t2SelecionadoId);
      if (idx !== -1) S.registros[idx] = { ...S.registros[idx], ...dados };
      toast('Alterações salvas com sucesso!', 'success');
      voltarParaGrid();
    } catch (e) {
      toast('Erro ao salvar: ' + e.message, 'error');
    } finally {
      if (btn) { btn.textContent = 'Salvar Alterações'; btn.disabled = false; }
    }
  }

  function voltarParaGrid() {
    $id('dp-painelView').style.display  = 'none';
    $id('dp-gridView').style.display    = 'flex';
    S.t2Selecionado = null; S.t2SelecionadoId = null;
    renderGridProfessores();
  }

  function confirmarExclusaoProfessor(prof) {
    popup({
      titulo: 'Excluir professor?',
      corpo: `O professor <strong>${prof.nome || 'sem nome'}</strong> será removido permanentemente do banco de dados.`,
      labelOk: 'Excluir', tipoOk: 'danger',
      onOk: async () => {
        try {
          await deleteDoc(CFG.colProfessores, prof.id);
          S.registros = S.registros.filter(r => r.id !== prof.id);
          if (S.t2SelecionadoId === prof.id) voltarParaGrid();
          else renderGridProfessores();
          toast('Professor excluído.', 'success');
        } catch (e) { toast('Erro ao excluir: ' + e.message, 'error'); }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3.3  TAB3 — Candidatos
  // ─────────────────────────────────────────────────────────────
  async function carregarT3() {
    const lista = $id('dp-listaCandidatos');
    if (lista) lista.innerHTML = '<p style="color:var(--dp-gray-400);font-size:.75rem;text-align:center;padding:1rem">Carregando candidatos…</p>';
    try {
      const todos = await fetchColecao(CFG.colCandidatos);
      S.candidatos = todos.filter(c => c.status !== 'Repescagem');
      popularFiltroDiscCand();
      renderListaCandidatos();
      initControlesT3();
    } catch (e) {
      if (lista) lista.innerHTML = `<p style="color:var(--dp-red);font-size:.75rem;padding:1rem">Erro: ${e.message}</p>`;
    }
  }

  function popularFiltroDiscCand() {
    const sel = $id('dp-filtroDiscCand'); if (!sel) return;
    const discs = new Set();
    S.candidatos.forEach(c => {
      const raw = getField(c,'disciplinas') || '';
      const lista = Array.isArray(raw) ? raw : String(raw).split(/[,;|/]/);
      lista.forEach(d => { const s = d.trim(); if (s) discs.add(s); });
    });
    [...discs].sort().forEach(d => {
      const op = document.createElement('option'); op.value = d; op.textContent = d; sel.appendChild(op);
    });
  }

  function filtrarCandidatos() {
    const status = $id('dp-filtroStatusCand')?.value || '';
    const disc   = normalizeStr($id('dp-filtroDiscCand')?.value || '');
    const data   = $id('dp-filtroDataCand')?.value || '';

    return S.candidatos.filter(c => {
      if (status && getField(c,'status') !== status) return false;
      if (disc) {
        const raw = getField(c,'disciplinas') || '';
        const lista = Array.isArray(raw) ? raw : String(raw).split(/[,;|/]/);
        if (!lista.some(d => normalizeStr(d).includes(disc))) return false;
      }
      if (data === 'sem-data') { const d = getField(c,'dataEntrevista'); if (d && d.trim()) return false; }
      if (data === 'mes' && S.mesSelecionado) {
        const dRaw = getField(c,'dataEntrevista') || '';
        if (!dRaw.includes(S.mesSelecionado)) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = getField(a,'dataEntrevista') || '', db = getField(b,'dataEntrevista') || '';
      if (!da && !db) return 0; if (!da) return -1; if (!db) return 1;
      return da.localeCompare(db);
    });
  }

  function renderListaCandidatos() {
    const lista = $id('dp-listaCandidatos'); if (!lista) return;
    lista.innerHTML = '';
    const filtrados = filtrarCandidatos();
    if (!filtrados.length) {
      lista.innerHTML = '<p style="color:var(--dp-gray-400);font-size:.75rem;text-align:center;padding:.75rem">Nenhum candidato encontrado.</p>';
      return;
    }
    filtrados.forEach(c => {
      const item = document.createElement('div');
      item.className = 'dp-cand-item' + (S.candidatoAtual?.id === c.id ? ' dp-cand-item--active' : '');
      item.dataset.id = c.id;
      const status = getField(c,'status') || 'Candidato';
      item.innerHTML = `
        <div style="font-weight:600;font-size:.78rem">${c.nome || 'Sem nome'}</div>
        <div style="display:flex;justify-content:space-between;margin-top:.15rem">
          <span style="font-size:.65rem;color:var(--dp-gray-400)">${getField(c,'dataEntrevista') || 'Sem data'}</span>
          <span class="dp-badge dp-badge--${status.toLowerCase()}" style="font-size:.6rem">${status}</span>
        </div>`;
      item.addEventListener('click', () => selecionarCandidato(c));
      lista.appendChild(item);
    });
  }

  function selecionarCandidato(cand) {
    S.candidatoAtual = cand;
    $qa('.dp-cand-item').forEach(el => el.classList.toggle('dp-cand-item--active', el.dataset.id === cand.id));
    preencherDadosCandidato(cand);
    preencherAvaliacaoCandidato(cand);
  }

  function preencherDadosCandidato(c) {
    $id('dp-candPlaceholder').style.display = 'none';

    // disponibilidade
    $id('dp-secDisp').style.display = 'block';
    ['Seg','Ter','Qua','Qui','Sex','Sab'].forEach(d => {
      const dk = d.toLowerCase();
      ['Manha','Tarde'].forEach(t => {
        const el = $id(`dp-${dk}${t}`);
        if (el) el.innerHTML = isTruthy(getField(c, dk+t)) ? '<span class="dp-disp-ok">✅</span>' : '<span class="dp-disp-no">❌</span>';
      });
    });

    // disciplinas
    const raw = getField(c,'disciplinas') || '';
    const discList = Array.isArray(raw) ? raw : String(raw).split(/[,;|/]/).map(s => s.trim()).filter(Boolean);
    const gridDisc = $id('dp-gridDisciplinas');
    if (discList.length && gridDisc) {
      $id('dp-secDisc').style.display = 'block';
      gridDisc.innerHTML = '';
      discList.forEach(d => {
        const found = CFG.disciplinasFixas.find(x => normalizeStr(x.label) === normalizeStr(d));
        const item = document.createElement('div'); item.className = 'dp-disc-item';
        const img = document.createElement('img');
        img.src = found ? `img-disciplinas/${found.img}` : 'img-disciplinas/humanas.png';
        img.alt = d; img.onerror = () => img.src = 'img-disciplinas/humanas.png';
        const sp = document.createElement('span'); sp.textContent = d;
        item.append(img, sp); gridDisc.appendChild(item);
      });
    } else { $id('dp-secDisc').style.display = 'none'; }

    // informações
    const infoEl = $id('dp-informacoesCandidato');
    $id('dp-secInfo').style.display = 'block';
    if (infoEl) {
      const campos = [
        ['Contato', formatTel(safe(getField(c,'contato')))],
        ['CPF',     formatCPF(safe(getField(c,'cpf')))],
        ['E-mail',  safe(getField(c,'email'))],
        ['Bairros', safe(getField(c,'bairros'))],
        ['Curso',   safe(getField(c,'curso'))],
        ['Nível',   safe(getField(c,'nivel'))],
      ];
      infoEl.innerHTML = campos.filter(([,v]) => v).map(([k,v]) =>
        `<div><strong>${k}:</strong> ${v}</div>`
      ).join('');
    }

    // experiências
    const expEl = $id('dp-experienciasConteudo');
    $id('dp-secExp').style.display = 'block';
    if (expEl) {
      const exps = [];
      if (isTruthy(getField(c,'expAulas'))) {
        const desc = safe(getField(c,'descricaoExpAulas'));
        exps.push(`<div><strong>📚 Aulas Particulares:</strong> Sim${desc ? '<br><em>'+desc+'</em>' : ''}</div>`);
      }
      if (isTruthy(getField(c,'expNeuro'))) {
        const desc = safe(getField(c,'descricaoExpNeuro'));
        exps.push(`<div><strong>🧠 Alunos Atípicos:</strong> Sim${desc ? '<br><em>'+desc+'</em>' : ''}</div>`);
      }
      if (isTruthy(getField(c,'expTdics'))) {
        const desc = safe(getField(c,'descricaoTdics'));
        exps.push(`<div><strong>💻 TDICs:</strong> Sim${desc ? '<br><em>'+desc+'</em>' : ''}</div>`);
      }
      expEl.innerHTML = exps.length ? exps.join('') : '<p style="color:var(--dp-gray-400)">Nenhuma experiência informada.</p>';
    }
  }

  function preencherAvaliacaoCandidato(c) {
    const set = (id, val) => { const el = $id(id); if (el) el.value = safe(val); };
    set('dp-dataEntrevista',   getField(c,'dataEntrevista'));
    set('dp-horaEntrevista',   getField(c,'horaEntrevista'));
    set('dp-linkEntrevista',   getField(c,'linkEntrevista'));
    set('dp-impressoesCandidato', getField(c,'impressoesCandidato'));
    const sel = $id('dp-statusCandidato');
    if (sel) sel.value = getField(c,'status') || 'Candidato';
    // resetar destaques dos botões de status
    ['dp-btnAprovado','dp-btnReprovado','dp-btnDesistente'].forEach(id => {
      const btn = $id(id);
      if (btn) { btn.classList.remove('dp-btn-active-success','dp-btn-active-danger'); }
    });
    const st = getField(c,'status');
    if (st === 'Aprovado')  { const b=$id('dp-btnAprovado');  if(b) b.classList.add('dp-btn-active-success'); }
    if (st === 'Reprovado') { const b=$id('dp-btnReprovado'); if(b) b.classList.add('dp-btn-active-danger');  }
  }

  async function salvarAvaliacaoCandidato() {
    if (!S.candidatoAtual) { toast('Selecione um candidato.', 'error'); return; }
    const dados = {
      dataEntrevista     : ($id('dp-dataEntrevista')?.value || '').trim(),
      horaEntrevista     : ($id('dp-horaEntrevista')?.value || '').trim(),
      linkEntrevista     : ($id('dp-linkEntrevista')?.value || '').trim(),
      impressoesCandidato: ($id('dp-impressoesCandidato')?.value || '').trim(),
      status             : $id('dp-statusCandidato')?.value || 'Candidato',
    };
    try {
      await updateDoc(CFG.colCandidatos, S.candidatoAtual.id, dados);
      Object.assign(S.candidatoAtual, dados);
      const idx = S.candidatos.findIndex(c => c.id === S.candidatoAtual.id);
      if (idx !== -1) Object.assign(S.candidatos[idx], dados);
      toast('Avaliação salva!', 'success');
      renderListaCandidatos();
    } catch (e) { toast('Erro ao salvar: ' + e.message, 'error'); }
  }

  async function setBotaoStatus(novoStatus, msg) {
    if (!S.candidatoAtual) { toast('Selecione um candidato.', 'error'); return; }
    const dados = { status: novoStatus };
    try {
      await updateDoc(CFG.colCandidatos, S.candidatoAtual.id, dados);
      Object.assign(S.candidatoAtual, dados);
      const idx = S.candidatos.findIndex(c => c.id === S.candidatoAtual.id);
      if (idx !== -1) Object.assign(S.candidatos[idx], dados);
      const sel = $id('dp-statusCandidato'); if (sel) sel.value = novoStatus;
      await copiar(msg);
      toast(`Status: ${novoStatus}. Mensagem copiada!`, 'success');
      renderListaCandidatos();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  }

  async function excluirCandidato() {
    if (!S.candidatoAtual) { toast('Selecione um candidato.', 'error'); return; }
    const cand = S.candidatoAtual;
    popup({
      titulo: 'Mover para Repescagem?',
      corpo: `<strong>${cand.nome || 'Candidato'}</strong> será marcado como Repescagem e removido da lista ativa.`,
      labelOk: 'Confirmar', tipoOk: 'danger',
      onOk: async () => {
        try {
          await updateDoc(CFG.colCandidatos, cand.id, { status: 'Repescagem' });
          S.candidatos = S.candidatos.filter(c => c.id !== cand.id);
          S.candidatoAtual = null;
          limparPainelCandidato();
          renderListaCandidatos();
          toast('Candidato movido para Repescagem.', 'info');
        } catch (e) { toast('Erro: ' + e.message, 'error'); }
      }
    });
  }

  async function promoverProfessor() {
    if (!S.candidatoAtual) { toast('Selecione um candidato.', 'error'); return; }
    const cand = S.candidatoAtual;
    popup({
      titulo: 'Promover a Professor?',
      corpo: `<strong>${cand.nome || 'Candidato'}</strong> será adicionado à coleção de professores e removido dos candidatos.`,
      labelOk: 'Promover', tipoOk: 'success',
      onOk: async () => {
        try {
          const { id, dataEntrevista, horaEntrevista, linkEntrevista, impressoesCandidato, ...profData } = cand;
          profData.status = 'Ativo';
          profData.dataAtivacao = Date.now();
          await addDoc(CFG.colProfessores, profData);
          await deleteDoc(CFG.colCandidatos, cand.id);
          S.candidatos = S.candidatos.filter(c => c.id !== cand.id);
          S.candidatoAtual = null;
          S.t2Loaded = false; // forçar reload na próxima abertura da Tab2
          limparPainelCandidato();
          renderListaCandidatos();
          toast(`${profData.nome || 'Professor'} promovido com sucesso!`, 'success');
        } catch (e) { toast('Erro ao promover: ' + e.message, 'error'); }
      }
    });
  }

  function limparPainelCandidato() {
    $id('dp-candPlaceholder').style.display = 'block';
    ['dp-secDisp','dp-secDisc','dp-secInfo','dp-secExp'].forEach(id => {
      const el = $id(id); if (el) el.style.display = 'none';
    });
    ['dp-dataEntrevista','dp-horaEntrevista','dp-linkEntrevista','dp-impressoesCandidato'].forEach(id => {
      const el = $id(id); if (el) el.value = '';
    });
  }

  function copiarRelatorio() {
    if (!S.candidatoAtual) { toast('Selecione um candidato.', 'error'); return; }
    const c = S.candidatoAtual;
    const raw = getField(c,'disciplinas') || '';
    const discs = Array.isArray(raw) ? raw.join(', ') : raw;
    const rel = `📋 RELATÓRIO DE AVALIAÇÃO
━━━━━━━━━━━━━━━━━━━━━━
Nome: ${c.nome || '—'}
Disciplinas: ${discs || '—'}
Data: ${getField(c,'dataEntrevista') || '—'} ${getField(c,'horaEntrevista') || ''}
Resultado: ${getField(c,'status') || '—'}
━━━━━━━━━━━━━━━━━━━━━━
Impressões:
${getField(c,'impressoesCandidato') || '—'}`;
    copiar(rel).then(ok => toast(ok ? 'Relatório copiado!' : 'Erro ao copiar.', ok ? 'success' : 'error'));
  }

  function initControlesT3() {
    $id('dp-filtroStatusCand')?.addEventListener('change', renderListaCandidatos);
    $id('dp-filtroDiscCand')?.addEventListener('change', renderListaCandidatos);
    $id('dp-filtroDataCand')?.addEventListener('change', () => {
      const v = $id('dp-filtroDataCand')?.value;
      const listaMeses = $id('dp-listaMeses');
      if (listaMeses) {
        listaMeses.style.display = v === 'mes' ? 'block' : 'none';
        if (v !== 'mes') { S.mesSelecionado = null; renderListaCandidatos(); }
        else if (v === 'mes') popularListaMeses();
      }
    });
    $id('dp-copiarLink')?.addEventListener('click', () => {
      const v = $id('dp-linkEntrevista')?.value || '';
      copiar(v).then(() => toast('Link copiado!', 'success'));
    });
    $id('dp-btnSalvarAval')?.addEventListener('click', salvarAvaliacaoCandidato);
    $id('dp-btnCopiarRelatorio')?.addEventListener('click', copiarRelatorio);
    $id('dp-btnAprovado')?.addEventListener('click', () => setBotaoStatus('Aprovado', CFG.msgAprovacao));
    $id('dp-btnReprovado')?.addEventListener('click', () => setBotaoStatus('Reprovado', CFG.msgReprovacao));
    $id('dp-btnDesistente')?.addEventListener('click', () => setBotaoStatus('Desistente', CFG.msgDesistente));
    $id('dp-btnExcluirCand')?.addEventListener('click', excluirCandidato);
    $id('dp-btnPromover')?.addEventListener('click', promoverProfessor);
    // máscara data
    $id('dp-dataEntrevista')?.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'');
      if (v.length > 2) v = v.slice(0,2)+'/'+v.slice(2);
      if (v.length > 5) v = v.slice(0,5)+'/'+v.slice(5);
      e.target.value = v.slice(0,10);
    });
    $id('dp-horaEntrevista')?.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'');
      if (v.length > 2) v = v.slice(0,2)+':'+v.slice(2);
      e.target.value = v.slice(0,5);
    });
  }

  function popularListaMeses() {
    const cnt = $id('dp-listaMeses'); if (!cnt) return;
    cnt.innerHTML = '';
    const meses = new Set();
    S.candidatos.forEach(c => {
      const d = getField(c,'dataEntrevista') || '';
      const m = d.match(/\d{2}\/(\d{2}\/\d{4})/);
      if (m) meses.add(m[1]);
    });
    if (!meses.size) { cnt.innerHTML = '<p style="padding:.4rem .6rem;font-size:.72rem;color:var(--dp-gray-400)">Nenhuma data encontrada</p>'; return; }
    [...meses].sort().forEach(mes => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:.3rem .6rem;cursor:pointer;font-size:.75rem;';
      item.onmouseenter = () => item.style.background = 'var(--dp-gray-100)';
      item.onmouseleave = () => item.style.background = '';
      const [mm, aaaa] = mes.split('/');
      item.textContent = `${mm}/${aaaa}`;
      item.addEventListener('click', () => {
        S.mesSelecionado = mes; cnt.querySelectorAll('div').forEach(d => d.style.fontWeight = '');
        item.style.fontWeight = '700';
        renderListaCandidatos();
      });
      cnt.appendChild(item);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3.4  INIT — ponto de entrada público
  // ─────────────────────────────────────────────────────────────
  function init() {
    if (!$root()) { console.warn('DashboardProfessores: #professores não encontrado.'); return; }

    loadMasks();
    loadColPrefs();
    injectStyles();
    injectHTML();

    if (!initFirebase()) { toast('Falha ao conectar com o Firebase.', 'error'); return; }

    initTabs();
    initDropdownsT1(); // ← CRÍTICO: inicializa dropdowns, filtros e resize de colunas
    initModalContrato(); // ← Inicializa modal de contrato

    // Tab2 botões (injectados acima, mas listener só disponível após injectHTML)
    $id('dp-btnVoltar')?.addEventListener('click', voltarParaGrid);
    $id('dp-btnSalvarEdicao')?.addEventListener('click', salvarEdicao);

    // Botão Gerar Contrato — abre modal
    $id('dp-btnGerarContrato')?.addEventListener('click', abrirModalContrato);

    // Carregar Tab1 imediatamente
    carregarT1();
  }

  // ─────────────────────────────────────────────────────────────
  // 3.5  API pública
  // ─────────────────────────────────────────────────────────────
  return { init };

})(); // fim do IIFE
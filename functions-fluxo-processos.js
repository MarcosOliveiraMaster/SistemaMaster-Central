// ─────────────────────────────────────────────────────────────────────────────
// functions-fluxo-processos.js  –  Demandas
// ─────────────────────────────────────────────────────────────────────────────
console.log('functions-fluxo-processos.js carregado');

// ── Constantes ────────────────────────────────────────────────────────────────
const DEMANDAS_COLORS = [
  { name: 'Azul escuro',     hex: '#1a237e' },
  { name: 'Azul claro',      hex: '#42a5f5' },
  { name: 'Vermelho escuro', hex: '#b71c1c' },
  { name: 'Vermelho claro',  hex: '#ef5350' },
  { name: 'Laranja escuro',  hex: '#e65100' },
  { name: 'Laranja claro',   hex: '#ffa726' },
  { name: 'Verde escuro',    hex: '#1b5e20' },
  { name: 'Verde claro',     hex: '#66bb6a' },
  { name: 'Rosa escuro',     hex: '#880e4f' },
  { name: 'Rosa claro',      hex: '#f48fb1' },
  { name: 'Cinza escuro',    hex: '#424242' },
  { name: 'Preto',           hex: '#000000' },
];

const DB_COLLECTION = 'demandas';

// ── Estado global ─────────────────────────────────────────────────────────────
let _savedContent     = '';
let _demandasList     = [];
let _unsubDemandas    = null;
let _activePaletteCtx = null;
let _activeLinkCtx    = null;

// ── Utilitários DOM ───────────────────────────────────────────────────────────
function escapeHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}
function saveRange() {
  const sel = window.getSelection();
  return (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
}
function restoreRange(r) {
  if (!r) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
function moveCursor(el, offset) {
  const r = document.createRange();
  r.setStart(el, offset);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
function moveCursorToEnd(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
function findBlock(node, editorEl) {
  const TAGS = ['DIV','P','H1','H2','H3','H4','BLOCKQUOTE','LI'];
  let n = node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== editorEl) {
    if (TAGS.includes(n.nodeName)) return n;
    n = n.parentNode;
  }
  return null;
}
function isInList(sel) {
  let n = sel.getRangeAt(0).startContainer;
  while (n) {
    if (['LI','UL','OL'].includes(n.nodeName)) return true;
    if (n.contentEditable === 'true') break;
    n = n.parentNode;
  }
  return false;
}
function isInBlockquote(range, editorEl) {
  let n = range.startContainer;
  while (n && n !== editorEl) {
    if (n.nodeName === 'BLOCKQUOTE') return n;
    n = n.parentNode;
  }
  return null;
}
function isCheckboxBlock(block) {
  return block && block.firstChild &&
         block.firstChild.nodeName === 'INPUT' &&
         block.firstChild.type === 'checkbox';
}
function applyHighlight(hex) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const tmp = document.createElement('div');
  tmp.appendChild(range.cloneContents());
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  document.execCommand('insertHTML', false,
    `<span style="background-color:rgba(${r},${g},${b},0.7);border-radius:8px;padding:2px 5px">${tmp.innerHTML}</span>`
  );
}
function applyIndent(dir, editor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  if (isInList(sel)) {
    document.execCommand(dir === 'in' ? 'indent' : 'outdent');
    return;
  }
  const block = findBlock(sel.getRangeAt(0).startContainer, editor);
  if (block) {
    const cur = parseInt(block.style.marginLeft || '0');
    block.style.marginLeft = Math.max(0, cur + (dir === 'in' ? 40 : -40)) + 'px';
  }
}
const _DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function _formatDateFluxo(ts) {
  if (!ts) return '—';
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const dmy = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${dmy} - ${_DIAS_SEMANA[d.getDay()]}`;
}

// ── HTML → WhatsApp ───────────────────────────────────────────────────────────
// Converte o rich-text HTML do editor em texto plano formatado para WhatsApp:
//   *negrito*  _itálico_  ~cortado~  • tópico  1. numerado  > citação
// Cores/preenchimentos são descartados (sem suporte no WA).
// Checkboxes: ◻️ desmarcado · ✅ ~_marcado_~
// Blocos com formatação inline ganham linha em branco extra após si.
function _blockHasInlineFormat(node) {
  const fmtTags = ['B','STRONG','I','EM','U','S','STRIKE','DEL'];
  if (fmtTags.some(t => node.querySelector(t.toLowerCase()))) return true;
  return Array.from(node.querySelectorAll('span')).some(s => {
    const st = s.style;
    return (st.textDecoration || '').includes('line-through') ||
           st.fontStyle === 'italic' ||
           st.fontWeight === 'bold' ||
           parseInt(st.fontWeight || 0) >= 700;
  });
}

function htmlToWhatsApp(html) {
  const root = document.createElement('div');
  root.innerHTML = html;

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();

    switch (tag) {
      // ── Quebras / separadores ──────────────────────────────
      case 'br': return '\n';
      case 'hr': return '\n──────────\n';

      // ── Checkbox ───────────────────────────────────────────
      case 'input':
        if (node.type === 'checkbox') {
          const byAttr  = node.hasAttribute('checked');
          const byStyle = (node.parentElement?.style?.textDecoration || '').includes('line-through');
          return (byAttr || byStyle) ? '✅' : '◻️';
        }
        return '';

      // ── Link ───────────────────────────────────────────────
      case 'a': {
        const t    = kids(node).trim();
        const href = node.getAttribute('href') || '';
        if (href && href !== t) return `${t} (${href})`;
        return t || href;
      }

      // ── Formatação inline ──────────────────────────────────
      case 'b': case 'strong': {
        const t = kids(node).trim();
        return t ? `*${t}*` : '';
      }
      case 'i': case 'em': {
        const t = kids(node).trim();
        return t ? `_${t}_` : '';
      }
      case 's': case 'strike': case 'del': {
        const t = kids(node).trim();
        return t ? `~${t}~` : '';
      }
      case 'u': return kids(node); // WA não tem sublinhado

      case 'span': {
        let t  = kids(node);
        const s = node.style;
        const tr = t.trim();
        if (!tr) return t;
        // Aplica do mais interno para o mais externo
        let out = tr;
        if ((s.textDecoration || '').includes('line-through')) out = `~${out}~`;
        if (s.fontStyle === 'italic') out = `_${out}_`;
        if (s.fontWeight === 'bold' || parseInt(s.fontWeight || 0) >= 700) out = `*${out}*`;
        return out;
      }

      // execCommand cria <font face/color/size> — ignora estilo, preserva texto
      case 'font': return kids(node);

      // ── Cabeçalhos ─────────────────────────────────────────
      case 'h1': {
        const t = kids(node).trim();
        return t ? `*${t.toUpperCase()}*\n` : '\n';
      }
      case 'h2': {
        const t = kids(node).trim();
        return t ? `*${t}*\n` : '\n';
      }
      case 'h3': case 'h4': {
        const t = kids(node).trim();
        return t ? `_${t}_\n` : '\n';
      }

      // ── Citação ────────────────────────────────────────────
      case 'blockquote': {
        const lines = kids(node).trim().split('\n');
        return lines.map(l => `> ${l}`).join('\n') + '\n';
      }

      // ── Listas ─────────────────────────────────────────────
      case 'ul':
        return Array.from(node.querySelectorAll(':scope > li'))
          .map(li => `• ${kids(li).trim()}\n`)
          .join('');
      case 'ol': {
        let i = 1;
        return Array.from(node.querySelectorAll(':scope > li'))
          .map(li => `${i++}. ${kids(li).trim()}\n`)
          .join('');
      }
      case 'li':
        return `• ${kids(node).trim()}\n`;

      // ── Bloco de parágrafo / div ───────────────────────────
      case 'div':
      case 'p': {
        const fc = node.firstChild;

        // Linha de checkbox
        if (fc?.nodeName === 'INPUT' && fc.type === 'checkbox') {
          const checked = fc.hasAttribute('checked') ||
                          (node.style.textDecoration || '').includes('line-through');
          const text = Array.from(node.childNodes)
            .filter(n => !(n.nodeName === 'INPUT' && n.type === 'checkbox'))
            .map(walk)
            .join('')
            .trim();
          return checked
            ? `✅  ~_${text}_~\n`
            : `◻️  ${text}\n`;
        }

        const inner = kids(node);
        if (!inner.trim()) return '\n'; // linha vazia
        // Espaço extra após blocos com formatação inline (negrito, itálico, sublinhado, cortado)
        const extra = _blockHasInlineFormat(node) ? '\n' : '';
        return `${inner.trimEnd()}\n${extra}`;
      }

      default: return kids(node);
    }
  }

  function kids(node) {
    return Array.from(node.childNodes).map(walk).join('');
  }

  let result = kids(root);

  // Garante espaço duplo em torno dos marcadores inline quando adjacentes a texto
  // Evita que *negrito*, _itálico_ e ~cortado~ colem nas palavras vizinhas
  result = result.replace(/([^\s\n])(\*[^*\n]+\*)/g, '$1  $2');
  result = result.replace(/(\*[^*\n]+\*)([^\s\n])/g, '$1  $2');
  result = result.replace(/([^\s\n])(_[^_\n]+_)/g, '$1  $2');
  result = result.replace(/(_[^_\n]+_)([^\s\n])/g, '$1  $2');
  result = result.replace(/([^\s\n])(~[^~\n]+~)/g, '$1  $2');
  result = result.replace(/(~[^~\n]+~)([^\s\n])/g, '$1  $2');

  // Nunca mais de 2 linhas em branco consecutivas
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

// ── Menu de contexto (botão direito no card) ──────────────────────────────────
function showCardContextMenu(e, demanda) {
  e.preventDefault();
  document.getElementById('demanda-ctx-menu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'demanda-ctx-menu';
  menu.className = 'demanda-ctx-menu';
  menu.innerHTML = `
    <button class="ctx-menu-item ctx-menu-delete">
      <i class="fas fa-trash-alt"></i> Excluir demanda
    </button>
    <div class="ctx-menu-sep"></div>
    <button class="ctx-menu-item ctx-menu-whatsapp">
      <i class="fab fa-whatsapp"></i> Copiar para WhatsApp
    </button>
  `;

  // Posição: mantém dentro da viewport
  const x = Math.min(e.clientX, window.innerWidth  - 224);
  const y = Math.min(e.clientY, window.innerHeight - 112);
  menu.style.top  = y + 'px';
  menu.style.left = x + 'px';
  document.body.appendChild(menu);

  const closeMenu = ev => {
    if (!menu.contains(ev.target)) {
      menu.remove();
      document.removeEventListener('mousedown', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeMenu), 10);

  menu.querySelector('.ctx-menu-delete').addEventListener('click', () => {
    menu.remove();
    document.removeEventListener('mousedown', closeMenu);
    showDeleteConfirmModal(demanda);
  });

  menu.querySelector('.ctx-menu-whatsapp').addEventListener('click', () => {
    menu.remove();
    document.removeEventListener('mousedown', closeMenu);
    copyDemandaToWhatsApp(demanda);
  });
}

function showDeleteConfirmModal(demanda) {
  document.getElementById('demanda-confirm-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'demanda-confirm-overlay';
  overlay.className = 'demanda-confirm-overlay';
  overlay.innerHTML = `
    <div class="demanda-confirm-modal">
      <div class="demanda-confirm-title">
        <i class="fas fa-exclamation-triangle"></i> Excluir demanda
      </div>
      <p class="demanda-confirm-text">
        Tem certeza que deseja excluir a demanda
        <strong>"${escapeHtml(demanda.title || 'Sem título')}"</strong>?<br>
        Esta ação não pode ser desfeita.
      </p>
      <div class="demanda-confirm-btns">
        <button class="demanda-confirm-cancel" id="btn-del-cancel">Cancelar</button>
        <button class="demanda-confirm-delete" id="btn-del-confirm">
          <i class="fas fa-trash-alt"></i> Excluir
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-del-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btn-del-confirm').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-del-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
    try {
      await deleteDemandaFromFirestore(demanda.id);
      overlay.remove();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir';
    }
  });
}

async function copyDemandaToWhatsApp(demanda) {
  const waText = htmlToWhatsApp(demanda.content || '');
  const full   = `*${demanda.title}*\n\n${waText}`;

  try {
    await navigator.clipboard.writeText(full);
    showCopyFeedback('Copiado! Cole no WhatsApp.');
  } catch (_) {
    // Fallback para contextos sem permissão de clipboard
    const ta = document.createElement('textarea');
    ta.value = full;
    Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showCopyFeedback('Copiado! Cole no WhatsApp.');
  }
}

function showCopyFeedback(msg) {
  if (typeof showToast === 'function') {
    showToast(msg, 'success', 3500);
    return;
  }
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
    background: '#25d366', color: '#fff', borderRadius: '8px',
    padding: '10px 18px', fontSize: '13px', fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Firestore ─────────────────────────────────────────────────────────────────
function extractTitle(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const first = div.firstChild;
  const text = first
    ? (first.innerText || first.textContent || '').replace(/[\s ]+/g, ' ').trim()
    : div.textContent.trim();
  return text.slice(0, 120) || 'Sem título';
}

function subscribeToDemanads() {
  if (_unsubDemandas) _unsubDemandas();
  _unsubDemandas = firebase.firestore()
    .collection(DB_COLLECTION)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      _demandasList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      applyFilters();
    }, err => console.error('Demandas listener:', err));
}

async function saveDemandaToFirestore(content) {
  const user = firebase.auth().currentUser;
  await firebase.firestore().collection(DB_COLLECTION).add({
    title:     extractTitle(content),
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: user ? user.email : '',
  });
}

async function updateDemandaInFirestore(docId, content) {
  await firebase.firestore().collection(DB_COLLECTION).doc(docId).update({
    title:     extractTitle(content),
    content,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function deleteDemandaFromFirestore(docId) {
  await firebase.firestore().collection(DB_COLLECTION).doc(docId).delete();
}

// ── Filtros e render de cards ─────────────────────────────────────────────────
function applyFilters() {
  const grid = document.getElementById('demandas-grid');
  if (!grid) return;

  const text = (document.getElementById('filter-text')?.value || '').toLowerCase().trim();
  const from = document.getElementById('filter-date-from')?.value;
  const to   = document.getElementById('filter-date-to')?.value;

  let list = _demandasList;

  if (text) {
    list = list.filter(d =>
      d.title.toLowerCase().includes(text) ||
      (d.content || '').replace(/<[^>]+>/g, '').toLowerCase().includes(text)
    );
  }
  if (from) {
    const f = new Date(from + 'T00:00:00');
    list = list.filter(d => {
      const dt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0);
      return dt >= f;
    });
  }
  if (to) {
    const t = new Date(to + 'T23:59:59');
    list = list.filter(d => {
      const dt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0);
      return dt <= t;
    });
  }

  renderCards(list);
}

function renderCards(list) {
  const grid = document.getElementById('demandas-grid');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = '<p class="demandas-empty">Nenhuma demanda encontrada.</p>';
    return;
  }

  grid.innerHTML = list.map(d => `
    <div class="demanda-card" data-id="${d.id}" title="Clique direito para opções">
      <div class="demanda-card-header">
        <h3 class="demanda-card-title">${escapeHtml(d.title || 'Sem título')}</h3>
        <button class="demanda-card-btn-expand" data-id="${d.id}" title="Editar / Expandir">
          <i class="fas fa-expand-alt"></i>
        </button>
      </div>
      <div class="demanda-card-body">${d.content || ''}</div>
      <div class="demanda-card-footer">${_formatDateFluxo(d.createdAt)}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.demanda-card-btn-expand').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const d = _demandasList.find(x => x.id === btn.dataset.id);
      if (d) openCardEditModal(d);
    });
  });

  grid.querySelectorAll('.demanda-card').forEach(card => {
    card.addEventListener('contextmenu', e => {
      const d = _demandasList.find(x => x.id === card.dataset.id);
      if (d) showCardContextMenu(e, d);
    });
  });
}

// ── Modal de edição de card ───────────────────────────────────────────────────
function openCardEditModal(demanda) {
  document.getElementById('demanda-card-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'demanda-card-modal-overlay';
  overlay.className = 'demanda-card-modal-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.innerHTML = `
    <div class="demanda-card-modal">
      <div class="demanda-card-modal-header">
        <span class="demanda-card-modal-title">${escapeHtml(demanda.title || 'Sem título')}</span>
        <button class="demanda-card-modal-close" id="btn-close-card-modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="demanda-card-modal-body">
        <div class="demandas-toolbar" id="card-edit-toolbar">
          ${buildToolbarHTML(false)}
        </div>
        <div id="card-edit-editor"
             class="demanda-editor demanda-card-modal-editor"
             contenteditable="true"
             spellcheck="true">${demanda.content || ''}</div>
      </div>
      <div class="demanda-card-modal-footer">
        <button class="btn-demanda-salvar" id="btn-save-card-changes">
          <i class="fas fa-save"></i> Salvar alterações
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cardEditor  = document.getElementById('card-edit-editor');
  const cardToolbar = document.getElementById('card-edit-toolbar');
  attachEditorBehavior(cardEditor, cardToolbar, { showFullscreen: false });

  document.getElementById('btn-close-card-modal').addEventListener('click', () => overlay.remove());

  document.getElementById('btn-save-card-changes').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-card-changes');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    try {
      await updateDemandaInFirestore(demanda.id, cardEditor.innerHTML);
      overlay.remove();
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Salvar alterações';
    }
  });

  cardEditor.focus();
}

// ── HTML da toolbar (reutilizável) ────────────────────────────────────────────
function buildToolbarHTML(showFullscreen = true) {
  return `
    <button class="tb-btn" data-cmd="formatBlock" data-val="h1" title="Título 1">H1</button>
    <button class="tb-btn" data-cmd="formatBlock" data-val="h2" title="Título 2">H2</button>
    <span class="tb-sep"></span>
    <button class="tb-btn" data-cmd="bold"          title="Negrito"><i class="fas fa-bold"></i></button>
    <button class="tb-btn" data-cmd="italic"        title="Itálico"><i class="fas fa-italic"></i></button>
    <button class="tb-btn" data-cmd="underline"     title="Sublinhado"><i class="fas fa-underline"></i></button>
    <button class="tb-btn" data-cmd="strikeThrough" title="Cortado"><i class="fas fa-strikethrough"></i></button>
    <span class="tb-sep"></span>
    <select data-role="font-select" class="tb-select" title="Estilo de fonte">
      <option value="Poppins" selected>Poppins</option>
      <option value="Barlow Semi Condensed">Barlow Semi Condensed</option>
      <option value="Open Sans">Open Sans</option>
      <option value="Comfortaa">Comfortaa</option>
    </select>
    <span class="tb-sep"></span>
    <button class="tb-btn" data-role="font-increase" title="Aumentar fonte">A<i class="fas fa-plus" style="font-size:8px;vertical-align:super"></i></button>
    <button class="tb-btn" data-role="font-decrease" title="Diminuir fonte">A<i class="fas fa-minus" style="font-size:8px;vertical-align:sub"></i></button>
    <span class="tb-sep"></span>
    <button class="tb-btn tb-color-btn" data-role="font-color" title="Cor da fonte">
      <i class="fas fa-font"></i>
      <span class="color-indicator" style="background:#000000"></span>
    </button>
    <button class="tb-btn tb-color-btn" data-role="bg-color" title="Cor de preenchimento">
      <i class="fas fa-highlighter"></i>
      <span class="color-indicator" style="background:#42a5f5"></span>
    </button>
    <span class="tb-sep"></span>
    <button class="tb-btn" data-cmd="justifyLeft"   title="Alinhar esquerda"><i class="fas fa-align-left"></i></button>
    <button class="tb-btn" data-cmd="justifyCenter" title="Alinhar centro"><i class="fas fa-align-center"></i></button>
    <button class="tb-btn" data-cmd="justifyRight"  title="Alinhar direita"><i class="fas fa-align-right"></i></button>
    <button class="tb-btn" data-cmd="justifyFull"   title="Justificar"><i class="fas fa-align-justify"></i></button>
    <span class="tb-sep"></span>
    <button class="tb-btn" data-cmd="insertUnorderedList" title="Tópicos"><i class="fas fa-list-ul"></i></button>
    <button class="tb-btn" data-cmd="insertOrderedList"   title="Enumerar"><i class="fas fa-list-ol"></i></button>
    <button class="tb-btn" data-role="indent"  title="Avançar tópico"><i class="fas fa-indent"></i></button>
    <button class="tb-btn" data-role="outdent" title="Recuar tópico"><i class="fas fa-outdent"></i></button>
    <span class="tb-sep"></span>
    <button class="tb-btn" data-role="checkbox"   title="Checkbox"><i class="fas fa-check-square"></i></button>
    <button class="tb-btn" data-role="blockquote" title="Linha lateral"><i class="fas fa-quote-left"></i></button>
    <button class="tb-btn" data-cmd="insertHorizontalRule" title="Linha horizontal"><i class="fas fa-minus"></i></button>
    <span class="tb-sep"></span>
    <button class="tb-btn" data-role="link" title="Atribuir link"><i class="fas fa-link"></i></button>
    ${showFullscreen ? `
    <button class="tb-btn" data-role="fullscreen" title="Expandir" style="margin-left:auto">
      <i class="fas fa-expand" id="icon-fullscreen"></i>
    </button>` : ''}
  `;
}

// ── Popups globais: paleta de cores + link (criados uma vez no body) ──────────
function setupGlobalPopups() {
  // ── Paleta de cores ──────────────────────────────────────
  if (!document.getElementById('demanda-color-palette')) {
    const pal = document.createElement('div');
    pal.id = 'demanda-color-palette';
    pal.className = 'color-palette-popup hidden';
    pal.innerHTML = DEMANDAS_COLORS.map(c =>
      `<div class="cp-swatch" data-color="${c.hex}" style="background:${c.hex}" title="${c.name}"></div>`
    ).join('');
    document.body.appendChild(pal);

    pal.querySelectorAll('.cp-swatch').forEach(swatch => {
      swatch.addEventListener('mousedown', e => {
        e.preventDefault();
        if (!_activePaletteCtx) return;
        const { mode, range, indicator, editor: ed } = _activePaletteCtx;
        restoreRange(range);
        const color = swatch.dataset.color;
        if (mode === 'font') {
          document.execCommand('foreColor', false, color);
        } else {
          applyHighlight(color);
        }
        if (indicator) indicator.style.background = color;
        pal.classList.add('hidden');
        ed?.focus();
        _activePaletteCtx = null;
      });
    });

    document.addEventListener('mousedown', e => {
      if (!pal.contains(e.target) &&
          !e.target.closest('[data-role="font-color"]') &&
          !e.target.closest('[data-role="bg-color"]')) {
        pal.classList.add('hidden');
      }
    });
  }

  // ── Popup de link ────────────────────────────────────────
  if (!document.getElementById('demanda-link-popup')) {
    const lp = document.createElement('div');
    lp.id = 'demanda-link-popup';
    lp.className = 'link-popup hidden';
    lp.innerHTML = `
      <div class="link-popup-header">Inserir link</div>
      <input type="text" id="link-url-input" class="link-url-field" placeholder="https://">
      <div class="link-popup-btns">
        <button id="link-apply-btn" class="link-btn-apply">Aplicar</button>
        <button id="link-cancel-btn" class="link-btn-cancel">Cancelar</button>
      </div>`;
    document.body.appendChild(lp);

    function doApplyLink() {
      const url = document.getElementById('link-url-input').value.trim();
      lp.classList.add('hidden');
      if (!url || url === 'https://') { _activeLinkCtx?.editor?.focus(); return; }
      const { range, editor: ed } = _activeLinkCtx || {};
      if (!ed) return;
      restoreRange(range);
      const sel  = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text) {
        document.execCommand('createLink', false, url);
        ed.querySelectorAll(`a[href="${url}"]`).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
      } else {
        document.execCommand('insertHTML', false,
          `<a href="${url.replace(/"/g,'&quot;')}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
        );
      }
      ed.focus();
      _activeLinkCtx = null;
    }

    document.getElementById('link-apply-btn').addEventListener('click', doApplyLink);
    document.getElementById('link-cancel-btn').addEventListener('click', () => {
      lp.classList.add('hidden');
      _activeLinkCtx?.editor?.focus();
    });
    document.getElementById('link-url-input').addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); doApplyLink(); }
      if (e.key === 'Escape') { lp.classList.add('hidden'); }
    });
  }
}

// ── Comportamento do editor (reutilizável para editor principal e modais) ─────
function attachEditorBehavior(editor, toolbar, opts = {}) {
  const palette = document.getElementById('demanda-color-palette');
  const linkPop = document.getElementById('demanda-link-popup');
  let fontSize = 3;

  // ── Botões simples via execCommand ───────────────────────
  toolbar.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
      editor.focus();
      syncActiveStates();
    });
  });

  // ── Fonte ────────────────────────────────────────────────
  toolbar.querySelector('[data-role="font-select"]')?.addEventListener('change', function () {
    document.execCommand('fontName', false, this.value);
    editor.focus();
  });

  // ── Tamanho de fonte ─────────────────────────────────────
  toolbar.querySelector('[data-role="font-increase"]')?.addEventListener('mousedown', e => {
    e.preventDefault();
    if (fontSize < 7) fontSize++;
    document.execCommand('fontSize', false, fontSize);
    editor.focus();
  });
  toolbar.querySelector('[data-role="font-decrease"]')?.addEventListener('mousedown', e => {
    e.preventDefault();
    if (fontSize > 1) fontSize--;
    document.execCommand('fontSize', false, fontSize);
    editor.focus();
  });

  // ── Cores ────────────────────────────────────────────────
  const fontColorBtn = toolbar.querySelector('[data-role="font-color"]');
  const bgColorBtn   = toolbar.querySelector('[data-role="bg-color"]');

  fontColorBtn?.addEventListener('mousedown', e => {
    e.preventDefault();
    if (palette && !palette.classList.contains('hidden') && _activePaletteCtx?.mode === 'font') {
      palette.classList.add('hidden'); return;
    }
    if (!palette) return;
    _activePaletteCtx = { mode: 'font', range: saveRange(), indicator: fontColorBtn.querySelector('.color-indicator'), editor };
    const rect = e.currentTarget.getBoundingClientRect();
    palette.style.top  = (rect.bottom + 4) + 'px';
    palette.style.left = rect.left + 'px';
    palette.classList.remove('hidden');
  });

  bgColorBtn?.addEventListener('mousedown', e => {
    e.preventDefault();
    if (palette && !palette.classList.contains('hidden') && _activePaletteCtx?.mode === 'bg') {
      palette.classList.add('hidden'); return;
    }
    if (!palette) return;
    _activePaletteCtx = { mode: 'bg', range: saveRange(), indicator: bgColorBtn.querySelector('.color-indicator'), editor };
    const rect = e.currentTarget.getBoundingClientRect();
    palette.style.top  = (rect.bottom + 4) + 'px';
    palette.style.left = rect.left + 'px';
    palette.classList.remove('hidden');
  });

  // ── Indent / Outdent ─────────────────────────────────────
  toolbar.querySelector('[data-role="indent"]')?.addEventListener('mousedown', e => {
    e.preventDefault(); applyIndent('in', editor); editor.focus();
  });
  toolbar.querySelector('[data-role="outdent"]')?.addEventListener('mousedown', e => {
    e.preventDefault(); applyIndent('out', editor); editor.focus();
  });

  // ── Blockquote (sem aninhamento) ─────────────────────────
  toolbar.querySelector('[data-role="blockquote"]')?.addEventListener('mousedown', e => {
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && isInBlockquote(sel.getRangeAt(0), editor)) return;
    document.execCommand('formatBlock', false, 'blockquote');
    editor.focus();
    syncActiveStates();
  });

  // ── Checkbox ─────────────────────────────────────────────
  function prependCheckbox(block) {
    if (!block || block === editor || isCheckboxBlock(block)) return;
    const cb    = document.createElement('input');
    cb.type     = 'checkbox';
    const space = document.createTextNode(' ');
    block.insertBefore(space, block.firstChild);
    block.insertBefore(cb, block.firstChild);
  }

  toolbar.querySelector('[data-role="checkbox"]')?.addEventListener('mousedown', e => {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range      = sel.getRangeAt(0);
    const startBlock = findBlock(range.startContainer, editor);
    const endBlock   = findBlock(range.endContainer,   editor);

    if (sel.isCollapsed || !endBlock || startBlock === endBlock) {
      if (startBlock) prependCheckbox(startBlock);
      else document.execCommand('insertHTML', false, '<div><input type="checkbox">&nbsp;</div>');
    } else {
      let collecting = false;
      for (const child of Array.from(editor.childNodes)) {
        if (child === startBlock || child.contains?.(startBlock)) collecting = true;
        if (collecting && child.nodeType === Node.ELEMENT_NODE) prependCheckbox(child);
        if (child === endBlock || child.contains?.(endBlock)) break;
      }
      sel.removeAllRanges();
    }
    editor.focus();
  });

  // Checkbox marcado → itálico + cortado + setAttribute para manter estado no innerHTML
  editor.addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return;
    const row = e.target.parentElement;
    if (!row) return;
    if (e.target.checked) {
      e.target.setAttribute('checked', '');   // persiste ao serializar innerHTML
      row.style.textDecoration = 'line-through';
      row.style.fontStyle      = 'italic';
      row.style.color          = '#9ca3af';
    } else {
      e.target.removeAttribute('checked');    // remove ao desmarcar
      row.style.textDecoration = '';
      row.style.fontStyle      = '';
      row.style.color          = '';
    }
  });

  // ── Link ─────────────────────────────────────────────────
  toolbar.querySelector('[data-role="link"]')?.addEventListener('mousedown', e => {
    e.preventDefault();
    if (!linkPop) return;
    _activeLinkCtx = { range: saveRange(), editor };
    const rect = e.currentTarget.getBoundingClientRect();
    linkPop.style.top  = (rect.bottom + 4) + 'px';
    linkPop.style.left = rect.left + 'px';
    linkPop.classList.remove('hidden');
    setTimeout(() => document.getElementById('link-url-input')?.focus(), 40);
  });

  // ── Teclado ──────────────────────────────────────────────
  editor.addEventListener('keydown', e => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (e.key === 'Tab') {
      e.preventDefault();
      applyIndent(e.shiftKey ? 'out' : 'in', editor);
      return;
    }

    if (e.key === 'Backspace' && sel.isCollapsed && range.startOffset === 0) {
      let node = range.startContainer;
      while (node && node !== editor) {
        if (node.nodeType === 1) {
          const ml = parseInt(node.style.marginLeft || '0');
          if (ml > 0) {
            e.preventDefault();
            node.style.marginLeft = Math.max(0, ml - 40) + 'px';
            return;
          }
          if (node.nodeName === 'LI' && node.parentElement?.closest('li')) {
            e.preventDefault();
            document.execCommand('outdent');
            return;
          }
        }
        node = node.parentNode;
      }
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<br>');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const block = findBlock(range.startContainer, editor);
      if (!block) return;

      if (isCheckboxBlock(block)) {
        e.preventDefault();
        const text = block.innerText.replace(/[  ]/g, '').trim();
        if (!text) {
          const newDiv = document.createElement('div');
          newDiv.appendChild(document.createElement('br'));
          block.replaceWith(newDiv);
          moveCursor(newDiv, 0);
        } else {
          const newDiv = document.createElement('div');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          newDiv.appendChild(cb);
          newDiv.appendChild(document.createTextNode(' '));
          block.after(newDiv);
          moveCursorToEnd(newDiv);
        }
        return;
      }

      if (block.nodeName === 'BLOCKQUOTE') {
        e.preventDefault();
        const newDiv = document.createElement('div');
        newDiv.appendChild(document.createElement('br'));
        block.after(newDiv);
        moveCursor(newDiv, 0);
        return;
      }
    }
  });

  // ── Sync estado ativo dos botões ─────────────────────────
  editor.addEventListener('keyup',   syncActiveStates);
  editor.addEventListener('mouseup', syncActiveStates);

  function syncActiveStates() {
    ['bold','italic','underline','strikeThrough',
     'insertUnorderedList','insertOrderedList',
     'justifyLeft','justifyCenter','justifyRight','justifyFull'].forEach(cmd => {
      const btn = toolbar.querySelector(`.tb-btn[data-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }
}

// ── Carrega a seção ───────────────────────────────────────────────────────────
function loadFluxoProcessos() {
  const section = document.getElementById('fluxo-processos');
  if (!section) return;

  section.innerHTML = `
    <div id="demandas-container">
      <div class="demandas-wrapper" id="demandas-wrapper">

        <div class="demandas-toolbar" id="demandas-toolbar">
          ${buildToolbarHTML(true)}
        </div>

        <div id="demanda-editor"
             class="demanda-editor"
             contenteditable="true"
             spellcheck="true">${_savedContent}</div>

        <div class="demanda-actions">
          <button class="btn-demanda-salvar"   id="btn-salvar-demanda">
            <i class="fas fa-save"></i> Salvar Demanda
          </button>
          <button class="btn-demanda-whatsapp" id="btn-copiar-whatsapp">
            <i class="fab fa-whatsapp"></i> Copiar para WhatsApp
          </button>
        </div>

      </div>

      <!-- Filtros -->
      <div class="demandas-filter-bar">
        <input type="text" id="filter-text" class="filter-text-input" placeholder="Filtrar por texto...">
        <span class="filter-date-sep">De</span>
        <input type="date" id="filter-date-from" class="filter-date-input">
        <span class="filter-date-sep">até</span>
        <input type="date" id="filter-date-to"   class="filter-date-input">
        <button class="btn-filter-clear" id="btn-filter-clear">Limpar filtros</button>
      </div>

      <!-- Cards -->
      <div class="demandas-grid" id="demandas-grid">
        <p class="demandas-empty">Carregando demandas...</p>
      </div>
    </div>
  `;

  setupGlobalPopups();
  initDemandasEditor();
}

function initDemandasEditor() {
  const editor  = document.getElementById('demanda-editor');
  const toolbar = document.getElementById('demandas-toolbar');
  if (!editor || !toolbar) return;

  attachEditorBehavior(editor, toolbar, { showFullscreen: true });

  // ── Fullscreen ───────────────────────────────────────────
  toolbar.querySelector('[data-role="fullscreen"]')?.addEventListener('click', () => {
    document.getElementById('demandas-modal-overlay') ? closeMainModal() : openMainModal();
  });

  // ── Salvar Demanda ───────────────────────────────────────
  document.getElementById('btn-salvar-demanda').addEventListener('click', async () => {
    const content = editor.innerHTML.trim();
    if (!content || content === '<br>') return;
    const btn = document.getElementById('btn-salvar-demanda');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    try {
      await saveDemandaToFirestore(content);
      _savedContent = '';
      editor.innerHTML = '';
    } catch (err) {
      console.error('Erro ao salvar demanda:', err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Salvar Demanda';
    }
    editor.focus();
  });

  // ── Copiar editor atual → WhatsApp ────────────────────────
  document.getElementById('btn-copiar-whatsapp').addEventListener('click', async () => {
    const content = editor.innerHTML.trim();
    if (!content || content === '<br>') return;
    const waText = htmlToWhatsApp(content);
    try {
      await navigator.clipboard.writeText(waText);
      showCopyFeedback('Copiado! Cole no WhatsApp.');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = waText;
      Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showCopyFeedback('Copiado! Cole no WhatsApp.');
    }
  });

  // ── Filtros ──────────────────────────────────────────────
  document.getElementById('filter-text')?.addEventListener('input', applyFilters);
  document.getElementById('filter-date-from')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date-to')?.addEventListener('change', applyFilters);
  document.getElementById('btn-filter-clear')?.addEventListener('click', () => {
    document.getElementById('filter-text').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    applyFilters();
  });

  // ── Preservar conteúdo entre navegações ──────────────────
  editor.addEventListener('input', () => { _savedContent = editor.innerHTML; });

  // ── Listener Firestore em tempo real ─────────────────────
  subscribeToDemanads();

  editor.focus();
}

// ── Modal fullscreen do editor principal ──────────────────────────────────────
function openMainModal() {
  if (document.getElementById('demandas-modal-overlay')) return;
  const wrapper = document.getElementById('demandas-wrapper');
  const overlay = document.createElement('div');
  overlay.id = 'demandas-modal-overlay';
  overlay.className = 'demandas-modal-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeMainModal(); });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'demandas-modal-close-btn';
  closeBtn.title = 'Fechar';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.addEventListener('click', closeMainModal);

  overlay.appendChild(closeBtn);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const icon = document.getElementById('icon-fullscreen');
  if (icon) icon.className = 'fas fa-compress';
  document.getElementById('demanda-editor')?.focus();
}

function closeMainModal() {
  const overlay   = document.getElementById('demandas-modal-overlay');
  const wrapper   = document.getElementById('demandas-wrapper');
  const container = document.getElementById('demandas-container');
  if (wrapper && container) container.insertBefore(wrapper, container.firstChild);
  overlay?.remove();
  document.body.style.overflow = '';
  const icon = document.getElementById('icon-fullscreen');
  if (icon) icon.className = 'fas fa-expand';
}

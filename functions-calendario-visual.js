console.log('✅ functions-calendario-visual.js carregado');

// Evita que um botão fique travado para sempre caso a Promise de rede nunca
// resolva/rejeite (ex.: aba em segundo plano por muito tempo, conexão suspensa).
function withTimeoutCal(promise, ms = 20000, label = 'operação') {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tempo esgotado ao aguardar ${label}. Verifique sua conexão e tente novamente.`)), ms))
  ]);
}

const MESES_CAL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// Referência global ao refresh do calendário (preenchida quando o modal está aberto)
window.refreshCalendarioVisual = null;

// Converte chave "2026-5-15" para "ter - 15/06/2026"
function calKeyToDateBr(key) {
  const parts    = key.split('-');
  const year     = parseInt(parts[0]);
  const monthIdx = parseInt(parts[1]);
  const day      = parseInt(parts[2]);
  const date     = new Date(year, monthIdx, day);
  const dias     = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const d        = String(day).padStart(2, '0');
  const m        = String(monthIdx + 1).padStart(2, '0');
  return `${dias[date.getDay()]} - ${d}/${m}/${year}`;
}

function getContrastColor(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#374151' : '#ffffff';
}

const CORES_CAL = [
  { label: 'Azul',         value: '#3B82F6' },
  { label: 'Laranja',      value: '#F97316' },
  { label: 'Verde',        value: '#22C55E' },
  { label: 'Vermelho',     value: '#EF4444' },
  { label: 'Rosa',         value: '#EC4899' },
  { label: 'Amarelo',      value: '#EAB308' },
  { label: 'Azul claro',   value: '#93C5FD' },
  { label: 'Verde claro',  value: '#86EFAC' },
  { label: 'Rosa claro',   value: '#F9A8D4' },
  { label: 'Branco',       value: '#F9FAFB' },
  { label: 'Cinza claro',  value: '#D1D5DB' },
  { label: 'Cinza escuro', value: '#6B7280' }
];

// ──────────────────────────────────────────────────────────
//  Modal principal: Calendário Visual
// ──────────────────────────────────────────────────────────
function showVisualizacaoCalendarioModal(aulasArray, options = {}) {
  const today = new Date();

  // aulasMap[key] = [{materia, duracao, professor, horario, cor, _idAula, _origIdx}]
  const aulasMap = {};
  let weekData   = [];
  let flatCells  = [];

  let dragCtrlHeld   = false;
  let isDraggingCard = false;
  let isDraggingWeek = false;

  // Lista de disciplinas (carregada pelo chamador via DisciplinasStore.getAll())
  let disciplinasCal = [...(options.disciplinas || [])];

  // Pré-popular com aulas existentes
  (aulasArray || []).forEach((a, origIdx) => {
    if (!a.data) return;
    const m = a.data.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return;
    const key = `${m[3]}-${parseInt(m[2]) - 1}-${parseInt(m[1])}`;
    if (!aulasMap[key]) aulasMap[key] = [];
    aulasMap[key].push({
      materia:   a.materia   || 'A definir',
      duracao:   a.duracao   || '--',
      professor: a.professor || 'A definir',
      horario:   a.horario   || '',
      cor:       a.cor       || null,
      _idAula:   a['id-Aula'] || a.idAula || null,
      _origIdx:  origIdx,
      _docId:    a._docId    || null
    });
  });

  // Navega para o mês da aula mais próxima ao futuro (ou a mais recente)
  let displayMonth = today.getMonth();
  let displayYear  = today.getFullYear();
  const todayTime  = today.getTime();
  {
    let nearestKey = null, nearestDiff = Infinity;
    Object.keys(aulasMap).forEach(key => {
      const p = key.split('-');
      const d = new Date(parseInt(p[0]), parseInt(p[1]), parseInt(p[2])).getTime();
      const diff = d >= todayTime ? d - todayTime : todayTime - d + 1e15;
      if (diff < nearestDiff) { nearestDiff = diff; nearestKey = key; }
    });
    if (nearestKey) {
      const p    = nearestKey.split('-');
      displayYear  = parseInt(p[0]);
      displayMonth = parseInt(p[1]);
    }
  }

  // Baseline de IDs para cálculo de diff (atualizado após cada Salvar)
  let aulasBaseIds = new Set(
    (aulasArray || []).filter(a => a['id-Aula'] || a.idAula).map(a => a['id-Aula'] || a.idAula)
  );

  // ── HTML base ────────────────────────────────────────────
  const html = `
    <div class="cal-overlay" id="visualizacaoCalendarioModal">
      <div class="cal-modal">
        <div class="cal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>Calendário de Aulas
          </h3>
          <button class="cal-close-btn text-gray-400 hover:text-gray-700 text-xl" title="Fechar">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="cal-body">
          <!-- Esquerdo 80%: calendário -->
          <div class="cal-left">
            <div class="cal-month-nav">
              <button id="calPrevMonth" class="btn-secondary btn-compact">
                <i class="fas fa-chevron-left"></i>
              </button>
              <h4 id="calMonthTitle" class="font-lexend font-bold text-base text-gray-700 cal-month-title"></h4>
              <button id="calNextMonth" class="btn-secondary btn-compact">
                <i class="fas fa-chevron-right"></i>
              </button>
              <div style="flex:1"></div>
              <button id="calInfoBtn" class="btn-secondary btn-compact" title="Como usar o calendário">
                <i class="fas fa-question-circle"></i>
              </button>
            </div>
            <div class="cal-weekdays-row" id="calWeekdaysRow">
              ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d =>
                `<div class="cal-weekday-label">${d}</div>`).join('')}
              <div class="cal-week-handle-ph"></div>
            </div>
            <div class="cal-weeks-container" id="calWeeksContainer"></div>
          </div>

          <!-- Direito 20%: disciplinas -->
          <div class="cal-right">
            <div class="cal-right-content">
              <h4 class="font-lexend font-semibold text-sm text-gray-700 mb-1">
                <i class="fas fa-book text-orange-500 mr-1"></i> Disciplinas
              </h4>
              <p class="text-xs text-gray-400 mb-2">Arraste para um dia</p>
              <div class="cal-disciplinas-list" id="disciplinasList"></div>
            </div>
            <div class="cal-right-footer">
              <button id="calBtnSalvar" class="btn-primary btn-compact">
                <i class="fas fa-save mr-1"></i>Salvar
              </button>
              <button id="calBtnSolicitacao" class="btn-secondary btn-compact">
                <i class="fas fa-paper-plane mr-1"></i>Enviar solicitação
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const overlay = document.getElementById('visualizacaoCalendarioModal');

  // ── Handlers globais ─────────────────────────────────────
  const onKeyDown = (e) => {
    if (e.key === 'Control') dragCtrlHeld = true;
    if (e.key === 'Escape')  closeModal();
  };
  const onKeyUp = (e) => { if (e.key === 'Control') dragCtrlHeld = false; };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup',   onKeyUp);
  document.addEventListener('click',   closeCtxMenu);

  // Rede de segurança: se a aba ficar em segundo plano/perder foco no meio de um
  // drag (ex.: usuário troca de janela), garante que o estado de arraste não
  // fique "preso" em true para sempre, o que bloquearia drops futuros.
  const onVisibilityReset = () => {
    if (document.hidden) {
      isDraggingCard = false;
      isDraggingWeek = false;
      dragCtrlHeld = false;
    }
  };
  document.addEventListener('visibilitychange', onVisibilityReset);

  function closeCtxMenu() {
    const m = document.getElementById('calCtxMenu');
    if (m) m.remove();
  }

  const closeModal = () => {
    overlay.remove();
    window.refreshCalendarioVisual = null;
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
    document.removeEventListener('click',   closeCtxMenu);
    document.removeEventListener('visibilitychange', onVisibilityReset);
  };

  // Recarrega aulasMap do Firebase e re-renderiza o mês atual
  let _calRefreshing = false;
  async function reloadFromFirebase(force = false) {
    if ((!force && _calRefreshing) || !options.getAulas) return;
    _calRefreshing = true;
    try {
      const freshAulas = await withTimeoutCal(options.getAulas(), 20000, 'atualização das aulas');
      // Reconstrói aulasMap
      Object.keys(aulasMap).forEach(k => delete aulasMap[k]);
      (freshAulas || []).forEach((a, origIdx) => {
        if (!a.data) return;
        const m = a.data.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) return;
        const key = `${m[3]}-${parseInt(m[2]) - 1}-${parseInt(m[1])}`;
        if (!aulasMap[key]) aulasMap[key] = [];
        aulasMap[key].push({
          materia:   a.materia   || 'A definir',
          duracao:   a.duracao   || '--',
          professor: a.professor || 'A definir',
          horario:   a.horario   || '',
          cor:       a.cor       || null,
          _idAula:   a['id-Aula'] || a.idAula || null,
          _origIdx:  origIdx,
          _docId:    a._docId    || null
        });
      });
      renderCalendar();
    } catch (err) {
      console.warn('⚠️ Falha ao sincronizar calendário:', err);
    } finally {
      _calRefreshing = false;
    }
  }

  // Expõe para sincronização a partir da tabela
  window.refreshCalendarioVisual = reloadFromFirebase;

  overlay.querySelector('.cal-close-btn').addEventListener('click', closeModal);
  overlay.querySelector('#calPrevMonth').addEventListener('click', () => {
    displayMonth--;
    if (displayMonth < 0) { displayMonth = 11; displayYear--; }
    renderCalendar();
  });
  overlay.querySelector('#calNextMonth').addEventListener('click', () => {
    displayMonth++;
    if (displayMonth > 11) { displayMonth = 0; displayYear++; }
    renderCalendar();
  });
  overlay.querySelector('#calInfoBtn').addEventListener('click', showCalInfoModal);
  overlay.querySelector('#calBtnSalvar').addEventListener('click', async () => {
    if (!options.onSave) {
      if (typeof showToast === 'function') showToast('ℹ️ Sem contexto de salvamento configurado', 'info');
      return;
    }
    const btn = overlay.querySelector('#calBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando…';

    // Tela de carregamento sobre o calendário
    const loadingEl = document.createElement('div');
    loadingEl.id = 'calSavingOverlay';
    loadingEl.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(255,255,255,0.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.9rem;';
    loadingEl.innerHTML = `
      <div style="width:56px;height:56px;border:5px solid #e5e7eb;border-top-color:#f28705;border-radius:50%;animation:calSpin 0.75s linear infinite;"></div>
      <p style="font-family:inherit;font-weight:700;color:#f28705;font-size:1rem;">Salvando calendário…</p>`;
    if (!document.getElementById('calSpinKeyframes')) {
      const style = document.createElement('style');
      style.id = 'calSpinKeyframes';
      style.textContent = '@keyframes calSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(loadingEl);

    try {
      const currentIds = new Set();
      const updates    = [];
      const creates    = [];
      const fullAulas  = [];

      Object.entries(aulasMap).forEach(([key, cards]) => {
        const dataBr = calKeyToDateBr(key);
        cards.forEach(card => {
          const item = {
            data:      dataBr,
            materia:   card.materia   || 'A definir',
            professor: card.professor || 'A definir',
            duracao:   card.duracao   || '--',
            horario:   card.horario   || '',
            cor:       card.cor       || null,
            _idAula:   card._idAula   || null,
            _origIdx:  card._origIdx  ?? null,
            _docId:    card._docId    || null
          };
          fullAulas.push(item);
          if (card._idAula) {
            currentIds.add(card._idAula);
            updates.push(item);
          } else {
            creates.push(item);
          }
        });
      });

      // Usa baseline atualizado (não o aulasArray original) para evitar double-delete
      const deletes = [...aulasBaseIds].filter(id => !currentIds.has(id));

      await withTimeoutCal(options.onSave({ updates, creates, deletes, fullAulas }), 30000, 'salvamento do calendário');

      // Força reload do calendário com dados frescos do Firebase
      // e atualiza o baseline para a próxima Salvar
      await reloadFromFirebase(true);
      aulasBaseIds = new Set(
        Object.values(aulasMap).flat().filter(c => c._idAula).map(c => c._idAula)
      );

      if (typeof showToast === 'function') showToast('✅ Calendário salvo com sucesso', 'success');
    } catch (err) {
      console.error('❌ Erro ao salvar calendário:', err);
      if (typeof showToast === 'function')
        showToast('❌ Erro ao salvar: ' + (err.message || 'verifique o console'), 'error');
    } finally {
      document.getElementById('calSavingOverlay')?.remove();
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save mr-1"></i>Salvar';
    }
  });
  overlay.querySelector('#calBtnSolicitacao').addEventListener('click', async () => {
    const btn = overlay.querySelector('#calBtnSolicitacao');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Carregando…';
    try {
      let clienteInfo = null;
      if (typeof options.getClienteInfo === 'function') {
        clienteInfo = await withTimeoutCal(options.getClienteInfo(), 20000, 'dados do cliente');
      }
      showSolicitacaoCalendarioModal(aulasMap, clienteInfo);
    } catch (err) {
      console.error('❌ Erro ao abrir solicitação:', err);
      if (typeof showToast === 'function') showToast('❌ Erro ao carregar informações', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Enviar solicitação';
    }
  });

  // ── Renderiza calendário ─────────────────────────────────
  function renderCalendar() {
    document.getElementById('calMonthTitle').textContent =
      `${MESES_CAL[displayMonth]} ${displayYear}`;

    const firstDay    = new Date(displayYear, displayMonth, 1).getDay();
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const daysInPrevM = new Date(displayYear, displayMonth, 0).getDate();
    const isCurMonth  = today.getMonth() === displayMonth && today.getFullYear() === displayYear;

    // Ano/mês corretos para células de meses adjacentes
    const prevMonth = (displayMonth - 1 + 12) % 12;
    const prevYear  = displayMonth === 0 ? displayYear - 1 : displayYear;
    const nextMonth = (displayMonth + 1) % 12;
    const nextYear  = displayMonth === 11 ? displayYear + 1 : displayYear;

    flatCells = [];

    // Células do mês anterior (chave real para replicação cross-month)
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevM - i;
      flatCells.push({ type: 'other', dayNum, key: `${prevYear}-${prevMonth}-${dayNum}` });
    }

    // Células do mês atual
    for (let d = 1; d <= daysInMonth; d++)
      flatCells.push({ type: 'current', dayNum: d, key: `${displayYear}-${displayMonth}-${d}` });

    // Células do próximo mês (chave real)
    let nextDay = 1;
    while (flatCells.length % 7 !== 0) {
      flatCells.push({ type: 'other', dayNum: nextDay, key: `${nextYear}-${nextMonth}-${nextDay}` });
      nextDay++;
    }

    // Semanas — todas as posições têm chave válida (sem nulls)
    weekData = [];
    for (let i = 0; i < flatCells.length; i += 7)
      weekData.push(flatCells.slice(i, i + 7).map(c => c.key));

    const container = document.getElementById('calWeeksContainer');
    container.innerHTML = weekData.map((week, wIdx) => {
      const daysHtml = flatCells.slice(wIdx * 7, wIdx * 7 + 7).map(cell => {
        if (cell.type === 'other')
          return `<div class="cal-day cal-day-other"><div class="cal-day-num">${cell.dayNum}</div></div>`;

        const isToday  = isCurMonth && cell.dayNum === today.getDate();
        const dayAulas = aulasMap[cell.key] || [];

        return `<div class="cal-day${isToday ? ' cal-day-today' : ''}" data-key="${cell.key}" data-day="${cell.dayNum}">
          <div class="cal-day-num">${cell.dayNum}</div>
          ${dayAulas.map((a, idx) => buildCardHtml(a, cell.key, idx)).join('')}
        </div>`;
      }).join('');

      return `
        <div class="cal-week-row" data-week-idx="${wIdx}">
          <div class="cal-days-row">${daysHtml}</div>
          <div class="cal-week-handle" draggable="true" data-week-idx="${wIdx}"
               title="Arraste para replicar esta semana em outra">
            <i class="fas fa-grip-lines-vertical"></i>
          </div>
        </div>`;
    }).join('');

    setupDragDrop();
  }

  function buildCardHtml(a, key, idx) {
    const nome1  = (a.professor && a.professor !== 'A definir')
      ? a.professor.split(' ')[0] : 'A definir';
    const horStr = a.horario ? ` &bull; ${a.horario}` : '';
    const bgStyle    = a.cor
      ? `background:${a.cor};`
      : 'background:linear-gradient(135deg,#f28705 0%,#ffb347 100%);';
    const textColor  = a.cor ? getContrastColor(a.cor) : '#fff';
    return `<div class="cal-aula-card" draggable="true"
      data-key="${key}" data-idx="${idx}"
      style="${bgStyle}color:${textColor};">
      <span class="cal-aula-materia">${a.materia} &bull; ${a.duracao}${horStr}</span>
      <span class="cal-aula-prof">${nome1}</span>
    </div>`;
  }

  // getContrastColor está em escopo de módulo

  // ── Painel lateral de disciplinas (arrastar / nova / excluir) ──
  function renderDisciplinasList() {
    const listEl = overlay.querySelector('#disciplinasList');
    if (!listEl) return;

    const cardsHtml = disciplinasCal.map(d => `
      <div class="cal-disciplina-card" draggable="true" data-disciplina="${d.nome}" data-disc-id="${d.id ?? ''}" title="${d.nome}">
        <i class="fas fa-grip-vertical text-gray-300 text-xs"></i>
        <span>${d.nome}</span>
      </div>`).join('');

    const novaHtml = `
      <div class="cal-disciplina-card cal-disciplina-nova" id="calBtnNovaDisciplina" title="Nova disciplina" style="cursor:pointer;justify-content:center;border-style:dashed;">
        <i class="fas fa-plus text-orange-400 text-xs"></i>
        <span>Nova Disciplina</span>
      </div>`;

    listEl.innerHTML = cardsHtml + novaHtml;

    listEl.querySelectorAll('.cal-disciplina-card[data-disc-id]:not(.cal-disciplina-nova)').forEach(card => {
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const discId = card.dataset.discId;
        const nome = card.dataset.disciplina;
        if (!discId) return; // disciplina temporária desta sessão, não persistida
        showExcluirDisciplinaMenu(e.clientX, e.clientY, { id: discId, nome }, () => {
          disciplinasCal = disciplinasCal.filter(d => d.id !== discId);
          renderDisciplinasList();
          setupDragDrop();
        });
      });
    });

    listEl.querySelector('#calBtnNovaDisciplina').addEventListener('click', () => {
      showNovaDisciplinaModal({
        onAdicionarNaLista: async (nome) => {
          disciplinasCal = await DisciplinasStore.getAll();
          renderDisciplinasList();
          setupDragDrop();
        },
        onApenasNestaAula: (nome) => {
          // Card temporário (id null) — só existe nesta sessão do calendário, não persiste
          disciplinasCal = [...disciplinasCal, { id: null, nome }];
          renderDisciplinasList();
          setupDragDrop();
        }
      });
    });
  }

  // ── Drag & Drop ──────────────────────────────────────────
  function setupDragDrop() {
    // --- Sidebar: arrastar disciplina = colocação silenciosa ---
    overlay.querySelectorAll('.cal-disciplina-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        isDraggingCard = false;
        isDraggingWeek = false;
        e.dataTransfer.setData('disciplina', card.dataset.disciplina);
        e.dataTransfer.effectAllowed = 'copy';
        setTimeout(() => card.classList.add('cal-dragging'), 0);
      });
      card.addEventListener('dragend', () => card.classList.remove('cal-dragging'));
    });

    // --- Cards de aula: arrastar = mover/copiar; clicar = abre modal ---
    overlay.querySelectorAll('.cal-aula-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        isDraggingCard = true;
        isDraggingWeek = false;
        e.dataTransfer.setData('card-data', JSON.stringify({
          key: card.dataset.key,
          idx: parseInt(card.dataset.idx)
        }));
        e.dataTransfer.effectAllowed = dragCtrlHeld ? 'copy' : 'move';
        setTimeout(() => card.classList.add('cal-aula-dragging'), 0);
      });
      card.addEventListener('dragend', () => card.classList.remove('cal-aula-dragging'));

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = card.dataset.key;
        const idx = parseInt(card.dataset.idx);
        const aulaAtual = aulasMap[key]?.[idx];
        if (!aulaAtual) return;
        openCardConfig(
          { ...aulaAtual },
          key, idx,
          (novaAula) => {
            if (aulasMap[key]?.[idx] !== undefined)
              aulasMap[key][idx] = { ...aulasMap[key][idx], ...novaAula };
            renderCalendar();
          },
          () => {
            if (aulasMap[key]) {
              aulasMap[key].splice(idx, 1);
              if (!aulasMap[key].length) delete aulasMap[key];
            }
            renderCalendar();
          }
        );
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showCardContextMenu(e.clientX, e.clientY, card.dataset.key, parseInt(card.dataset.idx));
      });
    });

    // --- Células de dia (drop targets) ---
    overlay.querySelectorAll('.cal-day[data-key]').forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        if (isDraggingWeek) return;
        e.preventDefault();
        slot.classList.add('cal-drag-over');
      });
      slot.addEventListener('dragleave', (e) => {
        if (!slot.contains(e.relatedTarget)) slot.classList.remove('cal-drag-over');
      });
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('cal-drag-over');
        if (isDraggingWeek) return;

        const targetKey     = slot.dataset.key;
        const cardDataStr   = e.dataTransfer.getData('card-data');
        const disciplinaStr = e.dataTransfer.getData('disciplina');

        if (cardDataStr) {
          const { key: srcKey, idx: srcIdx } = JSON.parse(cardDataStr);
          const aulaData = aulasMap[srcKey]?.[srcIdx];
          if (!aulaData) return;
          if (!aulasMap[targetKey]) aulasMap[targetKey] = [];
          aulasMap[targetKey].push({ ...aulaData });
          if (!dragCtrlHeld) aulasMap[srcKey].splice(srcIdx, 1);
          renderCalendar();
        } else if (disciplinaStr) {
          // Colocação silenciosa: sem abrir modal
          if (!aulasMap[targetKey]) aulasMap[targetKey] = [];
          aulasMap[targetKey].push({
            materia:   disciplinaStr,
            duracao:   '--',
            professor: 'A definir',
            horario:   '',
            cor:       null,
            _idAula:   null,
            _origIdx:  null,
            _docId:    null
          });
          renderCalendar();
        }
      });
    });

    // --- Handles de semana ---
    overlay.querySelectorAll('.cal-week-handle').forEach(handle => {
      handle.addEventListener('dragstart', (e) => {
        isDraggingWeek = true;
        isDraggingCard = false;
        e.dataTransfer.setData('week-handle', handle.dataset.weekIdx);
        e.dataTransfer.effectAllowed = 'copy';
        setTimeout(() => handle.classList.add('cal-handle-dragging'), 0);
      });
      handle.addEventListener('dragend', () => {
        handle.classList.remove('cal-handle-dragging');
        isDraggingWeek = false;
      });
      handle.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('week-handle')) {
          e.preventDefault();
          handle.classList.add('cal-drag-over-week');
        }
      });
      handle.addEventListener('dragleave', () => handle.classList.remove('cal-drag-over-week'));
      handle.addEventListener('drop', (e) => {
        e.preventDefault();
        handle.classList.remove('cal-drag-over-week');
        const srcWeek = parseInt(e.dataTransfer.getData('week-handle'));
        const tgtWeek = parseInt(handle.dataset.weekIdx);
        if (!isNaN(srcWeek) && srcWeek !== tgtWeek) replicateWeek(srcWeek, tgtWeek);
      });
    });
  }

  // ── Menu de contexto ─────────────────────────────────────
  function showCardContextMenu(x, y, key, idx) {
    closeCtxMenu();
    const menu = document.createElement('div');
    menu.id = 'calCtxMenu';
    menu.className = 'cal-context-menu';
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.innerHTML = `
      <div class="cal-ctx-item danger" id="ctxExcluir">
        <i class="fas fa-trash text-red-500 mr-2"></i>Excluir
      </div>
      <div class="cal-ctx-separator"></div>
      <div class="cal-ctx-item" id="ctxEscolherCor">
        <i class="fas fa-palette text-orange-500 mr-2"></i>Escolher cor
      </div>`;
    document.body.appendChild(menu);

    menu.querySelector('#ctxExcluir').addEventListener('click', (e) => {
      e.stopPropagation();
      closeCtxMenu();
      if (aulasMap[key]) {
        aulasMap[key].splice(idx, 1);
        if (!aulasMap[key].length) delete aulasMap[key];
      }
      renderCalendar();
    });

    menu.querySelector('#ctxEscolherCor').addEventListener('click', (e) => {
      e.stopPropagation();
      closeCtxMenu();
      showColorPicker(key, idx);
    });
  }

  // ── Color picker ─────────────────────────────────────────
  function showColorPicker(key, idx) {
    const cardData = aulasMap[key]?.[idx];
    if (!cardData) return;

    const coresHtml = CORES_CAL.map(c => {
      const isLight   = getContrastColor(c.value) === '#374151';
      const borderSt  = isLight ? 'border-color:#9ca3af;' : '';
      const selClass  = cardData.cor === c.value ? ' cal-color-sel' : '';
      return `<div class="cal-color-swatch${selClass}"
           data-color="${c.value}" title="${c.label}"
           style="background:${c.value};${borderSt}"></div>`;
    }).join('');

    const h = `
      <div class="modal-overlay" id="calColorPicker" style="z-index: 10002;">
        <div class="modal-container" style="max-width: 400px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-base text-gray-800">
              <i class="fas fa-palette text-orange-500 mr-2"></i>Escolher cor
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body space-y-4">
            <div>
              <p class="text-xs text-gray-500 mb-3 font-semibold">Selecione uma cor</p>
              <div class="cal-color-grid">${coresHtml}</div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-2 font-semibold">Aplicar a</p>
              <div class="flex gap-2 flex-wrap">
                <button class="cal-scope-btn cal-scope-sel" data-scope="este">Apenas este</button>
                <button class="cal-scope-btn" data-scope="professor">Professores</button>
                <button class="cal-scope-btn" data-scope="disciplina">Disciplinas</button>
                <button class="cal-scope-btn" data-scope="ambos">Ambos</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-close btn-secondary btn-compact">Cancelar</button>
            <button id="calColorConfirmar" class="btn-primary btn-compact">
              <i class="fas fa-check mr-2"></i>Aplicar
            </button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', h);
    const picker = document.getElementById('calColorPicker');

    let selectedColor = cardData.cor || null;
    let selectedScope = 'este';

    picker.querySelectorAll('.cal-color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        picker.querySelectorAll('.cal-color-swatch').forEach(s => s.classList.remove('cal-color-sel'));
        sw.classList.add('cal-color-sel');
        selectedColor = sw.dataset.color;
      });
    });

    picker.querySelectorAll('.cal-scope-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.cal-scope-btn').forEach(b => b.classList.remove('cal-scope-sel'));
        btn.classList.add('cal-scope-sel');
        selectedScope = btn.dataset.scope;
      });
    });

    picker.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => picker.remove()));
    picker.addEventListener('click', (e) => { if (e.target === picker) picker.remove(); });

    picker.querySelector('#calColorConfirmar').addEventListener('click', async () => {
      if (!selectedColor) { picker.remove(); return; }

      // Identifica quais cards recebem a cor
      const cardsToColor = [];
      Object.entries(aulasMap).forEach(([k, aulas]) => {
        aulas.forEach((a, i) => {
          let match = false;
          if (selectedScope === 'este')        match = k === key && i === idx;
          else if (selectedScope === 'professor') match = a.professor === cardData.professor;
          else if (selectedScope === 'disciplina') match = a.materia === cardData.materia;
          else if (selectedScope === 'ambos')  match = a.professor === cardData.professor && a.materia === cardData.materia;
          if (match) cardsToColor.push({ k, i, ref: a });
        });
      });

      cardsToColor.forEach(({ k, i }) => { aulasMap[k][i].cor = selectedColor; });

      if (options.onColorSave) {
        for (const { ref } of cardsToColor) {
          try { await withTimeoutCal(options.onColorSave(ref, selectedColor), 15000, 'salvamento de cor'); } catch (_) {}
        }
      }

      picker.remove();
      renderCalendar();
    });
  }

  // ── Config de card com verificação de duplicatas ─────────
  function openCardConfig(aulaData, editKey, editIdx, onConfirm, onDelete) {
    showModalAulasCalendarios(aulaData, (novaAula) => {
      const duplicates = [];
      Object.entries(aulasMap).forEach(([k, aulas]) => {
        aulas.forEach((a, i) => {
          if (a.materia === novaAula.materia && !(k === editKey && i === editIdx))
            duplicates.push({ key: k, idx: i });
        });
      });

      if (duplicates.length > 0) {
        const cHtml = `
          <div class="modal-overlay" id="calDupConfirm" style="z-index: 10001;">
            <div class="modal-container" style="max-width: 460px;">
              <div class="modal-header">
                <h3 class="font-lexend font-bold text-base text-gray-800">
                  <i class="fas fa-copy text-orange-500 mr-2"></i>Aplicar configurações?
                </h3>
              </div>
              <div class="modal-body">
                <p class="text-sm text-gray-700">Deseja aplicar estas configurações nas demais aulas de
                  <strong class="text-orange-600">${novaAula.materia}</strong>?</p>
                <p class="text-xs text-gray-400 mt-2">${duplicates.length} aula(s) encontrada(s) com esta disciplina.</p>
              </div>
              <div class="modal-footer">
                <button id="calDupNao" class="btn-secondary btn-compact">Não</button>
                <button id="calDupSim" class="btn-primary btn-compact">
                  <i class="fas fa-check mr-2"></i>Sim
                </button>
              </div>
            </div>
          </div>`;
        document.body.insertAdjacentHTML('beforeend', cHtml);
        const cModal = document.getElementById('calDupConfirm');

        cModal.querySelector('#calDupSim').addEventListener('click', () => {
          duplicates.forEach(({ key: k, idx: i }) => {
            if (aulasMap[k]?.[i]) Object.assign(aulasMap[k][i], {
              professor:    novaAula.professor,
              idProfessor:  novaAula.idProfessor,
              professorUid: novaAula.professorUid,
              duracao:      novaAula.duracao,
              horario:      novaAula.horario
            });
          });
          cModal.remove();
          onConfirm(novaAula);
        });
        cModal.querySelector('#calDupNao').addEventListener('click', () => {
          cModal.remove();
          onConfirm(novaAula);
        });
      } else {
        onConfirm(novaAula);
      }
    }, onDelete);
  }

  // ── Replica semana (funciona cross-month pois todas as chaves são reais) ──
  function replicateWeek(srcIdx, tgtIdx) {
    const srcW = weekData[srcIdx];
    const tgtW = weekData[tgtIdx];
    if (!srcW || !tgtW) return;
    let n = 0;
    srcW.forEach((srcKey, pos) => {
      const tgtKey = tgtW[pos];
      if (!srcKey || !tgtKey) return;
      const aulas = aulasMap[srcKey] || [];
      if (!aulas.length) return;
      if (!aulasMap[tgtKey]) aulasMap[tgtKey] = [];
      aulas.forEach(a => { aulasMap[tgtKey].push({ ...a }); n++; });
    });
    if (n > 0) {
      renderCalendar();
      if (typeof showToast === 'function') showToast(`✅ ${n} aula(s) replicada(s)`, 'success');
    } else {
      if (typeof showToast === 'function') showToast('ℹ️ Semana de origem sem aulas', 'info');
    }
  }

  // ── Modal de instruções ──────────────────────────────────
  function showCalInfoModal() {
    const h = `
      <div class="modal-overlay" id="calInfoModal" style="z-index: 10001;">
        <div class="modal-container" style="max-width: 540px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-base text-gray-800">
              <i class="fas fa-info-circle text-orange-500 mr-2"></i>Como usar o Calendário
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body space-y-4">
            <div class="flex gap-3 p-3 bg-orange-50 border border-orange-100 rounded-lg">
              <i class="fas fa-grip-lines-vertical text-orange-500 mt-0.5 text-xl flex-shrink-0"></i>
              <div>
                <p class="text-sm font-semibold text-gray-800">Replicar semana</p>
                <p class="text-xs text-gray-600 mt-1">Arraste a barra <strong>|</strong> à direita de uma semana e solte sobre a barra de outra. As aulas são replicadas nos dias correspondentes, mesmo em meses diferentes.</p>
              </div>
            </div>
            <div class="flex gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <i class="fas fa-arrows-alt text-blue-500 mt-0.5 text-xl flex-shrink-0"></i>
              <div>
                <p class="text-sm font-semibold text-gray-800">Mover / Copiar aula</p>
                <p class="text-xs text-gray-600 mt-1">Arraste um card de aula para movê-lo. Segure <kbd class="bg-gray-200 rounded px-1 text-xs font-mono">Ctrl</kbd> enquanto arrasta para copiá-lo.</p>
              </div>
            </div>
            <div class="flex gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <i class="fas fa-mouse-pointer text-green-500 mt-0.5 text-xl flex-shrink-0"></i>
              <div>
                <p class="text-sm font-semibold text-gray-800">Configurar aula</p>
                <p class="text-xs text-gray-600 mt-1">Clique em qualquer card para abrir as configurações (professor, horário, duração). Arraste uma disciplina do painel direito para criar um card silenciosamente.</p>
              </div>
            </div>
            <div class="flex gap-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
              <i class="fas fa-palette text-purple-500 mt-0.5 text-xl flex-shrink-0"></i>
              <div>
                <p class="text-sm font-semibold text-gray-800">Cores e exclusão</p>
                <p class="text-xs text-gray-600 mt-1">Botão direito sobre um card para excluí-lo ou escolher uma cor. A cor pode ser aplicada a todas as aulas do mesmo professor, da mesma disciplina, ou ambos.</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-close btn-primary btn-compact"><i class="fas fa-check mr-2"></i>Entendido</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    const m = document.getElementById('calInfoModal');
    m.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => m.remove()));
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  }

  renderDisciplinasList();
  renderCalendar();
}

// ──────────────────────────────────────────────────────────
//  Modal de configuração: Configurar Aula
// ──────────────────────────────────────────────────────────
async function showModalAulasCalendarios(aulaData, onSave, onDelete = null) {
  let professores = [];
  try {
    if (typeof BANCO !== 'undefined' && BANCO.fetchDataBaseProfessores) {
      const lista = await BANCO.fetchDataBaseProfessores();
      professores = lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }
  } catch (_) {}

  const opcoesDuracao = ['1h00', '1h30', '2h00', '2h30', '3h00'];

  let disciplinasMac = await DisciplinasStore.getAll();

  const duracaoHtml = opcoesDuracao.map(d => `
    <button class="mac-duracao-btn${d === aulaData.duracao ? ' mac-duracao-sel' : ''}" data-duracao="${d}">${d}</button>
  `).join('');

  // Value carrega cpf|nome|uid (mesmo padrão do modal "Selecione Professor" em
  // functions-banco-de-aulas-Cards.js) para que idProfessor/professorUid sejam
  // gravados junto com o nome ao salvar — antes só o nome era enviado, o que
  // deixava idProfessor/professorUid da aula desatualizados após uma troca de
  // professor por esta tela. Seleção continua por nome (sinal mais confiável
  // para aulas já dessincronizadas por esse bug antes desta correção).
  const profOptsHtml = `<option value="|A definir">A definir</option>` +
    professores.map(p =>
      `<option value="${p.cpf || ''}|${p.nome}|${p.uid || ''}"${p.nome === aulaData.professor ? ' selected' : ''}>${p.nome}</option>`
    ).join('');

  const excluirBtnHtml = onDelete
    ? `<button id="mac-btn-excluir" class="btn-secondary btn-compact" style="color:#ef4444;border-color:#fca5a5;">
         <i class="fas fa-trash mr-2"></i>Excluir
       </button>`
    : '';

  const modalHtml = `
    <div class="modal-overlay" id="modalAulasCalendarios" style="z-index: 10000;">
      <div class="modal-container" style="max-width: 680px;">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-calendar-plus text-orange-500 mr-2"></i>Configurar Aula
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body space-y-4">
          <!-- Disciplina -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-book text-orange-500 mr-2"></i>Escolha a disciplina
            </label>
            <div class="grid grid-cols-4 gap-2" id="mac-grid-materias"></div>
          </div>

          <!-- Horário + Duração -->
          <div class="flex items-start gap-6">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="fas fa-clock text-orange-500 mr-2"></i>Horário
              </label>
              <input
                type="text"
                id="mac-horario"
                class="mac-horario-input"
                placeholder="HH:MM"
                maxlength="5"
                value="${aulaData.horario || ''}"
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="fas fa-hourglass-half text-orange-500 mr-2"></i>Duração
              </label>
              <div class="flex gap-2">
                ${duracaoHtml}
              </div>
            </div>
          </div>

          <!-- Professor -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-chalkboard-teacher text-orange-500 mr-2"></i>Professor
            </label>
            <div class="relative mb-2">
              <input
                type="text"
                id="mac-prof-busca"
                placeholder="Buscar professor..."
                class="w-full border-2 border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            </div>
            <select
              id="mac-prof-select"
              class="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              size="3"
              style="min-height: 72px; max-height: 90px;"
            >
              ${profOptsHtml}
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button id="mac-btn-cancelar" class="btn-secondary btn-compact">Cancelar</button>
          ${excluirBtnHtml}
          <button id="mac-btn-confirmar" class="btn-primary btn-compact">
            <i class="fas fa-check mr-2"></i>Confirmar
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal        = document.getElementById('modalAulasCalendarios');
  const btnClose     = modal.querySelector('.modal-close');
  const btnCancelar  = document.getElementById('mac-btn-cancelar');
  const btnConfirmar = document.getElementById('mac-btn-confirmar');
  const inputBusca   = document.getElementById('mac-prof-busca');
  const selectProf   = document.getElementById('mac-prof-select');
  const inputHorario = document.getElementById('mac-horario');

  let materiaSelected = aulaData.materia || '';
  let duracaoSelected = aulaData.duracao || '';

  const macEscHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', macEscHandler);

  const closeModal = () => {
    modal.remove();
    document.removeEventListener('keydown', macEscHandler);
  };

  btnClose.addEventListener('click', closeModal);
  btnCancelar.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  if (onDelete) {
    document.getElementById('mac-btn-excluir').addEventListener('click', () => {
      closeModal();
      onDelete();
    });
  }

  // Máscara HH:MM
  inputHorario.addEventListener('input', () => {
    let v = inputHorario.value.replace(/\D/g, '');
    if (v.length > 4) v = v.slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2);
    inputHorario.value = v;
  });

  const gridMateriasEl = document.getElementById('mac-grid-materias');

  const renderMateriasGrid = () => {
    const materiasHtml = disciplinasMac.map(d => `
      <button class="mac-materia-btn${d.nome === materiaSelected ? ' mac-materia-sel' : ''}" data-materia="${d.nome}" data-disc-id="${d.id ?? ''}">${d.nome}</button>
    `).join('');

    const novaHtml = `
      <button type="button" id="mac-btn-nova-disciplina" class="mac-materia-btn" style="border-style:dashed;color:#9ca3af;">
        <i class="fas fa-plus mr-1"></i>Nova
      </button>`;

    gridMateriasEl.innerHTML = materiasHtml + novaHtml;

    gridMateriasEl.querySelectorAll('.mac-materia-btn[data-disc-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        gridMateriasEl.querySelectorAll('.mac-materia-btn').forEach(b => b.classList.remove('mac-materia-sel'));
        btn.classList.add('mac-materia-sel');
        materiaSelected = btn.dataset.materia;
      });

      const discId = btn.dataset.discId;
      if (discId) {
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const nome = btn.dataset.materia;
          showExcluirDisciplinaMenu(e.clientX, e.clientY, { id: discId, nome }, () => {
            disciplinasMac = disciplinasMac.filter(d => d.id !== discId);
            if (materiaSelected === nome) materiaSelected = '';
            renderMateriasGrid();
          });
        });
      }
    });

    gridMateriasEl.querySelector('#mac-btn-nova-disciplina').addEventListener('click', () => {
      showNovaDisciplinaModal({
        onAdicionarNaLista: async (nome) => {
          disciplinasMac = await DisciplinasStore.getAll();
          materiaSelected = nome;
          renderMateriasGrid();
        },
        onApenasNestaAula: (nome) => {
          materiaSelected = nome;
          disciplinasMac = [...disciplinasMac, { id: null, nome }];
          renderMateriasGrid();
        }
      });
    });
  };

  renderMateriasGrid();

  modal.querySelectorAll('.mac-duracao-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.mac-duracao-btn').forEach(b => b.classList.remove('mac-duracao-sel'));
      btn.classList.add('mac-duracao-sel');
      duracaoSelected = btn.dataset.duracao;
    });
  });

  const todasOpcoes = Array.from(selectProf.options);
  inputBusca.addEventListener('input', () => {
    const termo = inputBusca.value.toLowerCase().trim();
    while (selectProf.options.length > 0) selectProf.remove(0);
    todasOpcoes
      .filter(o => !termo || o.text.toLowerCase().includes(termo))
      .forEach(o => selectProf.add(new Option(o.text, o.value, false, o.selected)));
  });

  btnConfirmar.addEventListener('click', () => {
    const horario = inputHorario.value.trim();
    const [cpfSel, nomeSel, uidSel] = (selectProf.value || '|A definir').split('|');
    onSave({
      materia:      materiaSelected || aulaData.materia || 'A definir',
      duracao:      duracaoSelected || aulaData.duracao || '--',
      professor:    nomeSel || 'A definir',
      idProfessor:  cpfSel || '',
      professorUid: uidSel || '',
      horario
    });
    closeModal();
  });

  setTimeout(() => inputHorario.focus(), 100);
}

// ──────────────────────────────────────────────────────────────────────────────
//  Modal: Solicitação em Calendário (read-only, multi-mês)
// ──────────────────────────────────────────────────────────────────────────────
function showSolicitacaoCalendarioModal(aulasMap, clienteInfo) {
  // Meses que possuem aulas, ordenados cronologicamente
  const mesesSet = new Set();
  Object.entries(aulasMap).forEach(([key, cards]) => {
    if (cards && cards.length > 0) {
      const p = key.split('-');
      mesesSet.add(`${p[0]}-${p[1]}`);
    }
  });

  const mesesOrdenados = [...mesesSet].sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  if (mesesOrdenados.length === 0) {
    if (typeof showToast === 'function') showToast('ℹ️ Nenhuma aula para exibir na solicitação', 'info');
    return;
  }

  const totalAulas = Object.values(aulasMap).reduce((s, cards) => s + cards.length, 0);
  const ci = clienteInfo || {};

  // ── Cabeçalho do cliente ────────────────────────────────────
  const totalFmt = (ci.totalReceber !== undefined && ci.totalReceber !== null)
    ? `R$ ${Number(ci.totalReceber).toFixed(2).replace('.', ',')}`
    : null;

  const headerHtml = `
    <div class="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 rounded-lg p-4 mb-5 shadow-sm">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-medium text-gray-500 mb-1">
            <i class="fas fa-user text-orange-500 mr-2"></i>Nome do Cliente
          </p>
          <p class="text-sm font-semibold text-gray-800">${ci.nomeCliente || '--'}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-gray-500 mb-1">
            <i class="fas fa-map-marker-alt text-orange-500 mr-2"></i>Endereço
          </p>
          <p class="text-sm font-semibold text-gray-800">${ci.enderecoAulas || '--'}</p>
        </div>
        ${totalFmt ? `
        <div>
          <p class="text-xs font-medium text-gray-500 mb-1">
            <i class="fas fa-dollar-sign text-green-600 mr-2"></i>Total a Receber
          </p>
          <p class="text-lg font-bold text-green-600">${totalFmt}</p>
        </div>` : ''}
        <div>
          <p class="text-xs font-medium text-gray-500 mb-1">
            <i class="fas fa-map-signs text-orange-500 mr-2"></i>Referência
          </p>
          <p class="text-sm font-semibold text-gray-800">${ci.complementoAulas || '--'}</p>
        </div>
      </div>
      ${ci.estudantesComEscola && ci.estudantesComEscola.length > 0 ? `
      <div class="mt-4 pt-4 border-t border-orange-200">
        <p class="text-xs font-medium text-gray-500 mb-2">
          <i class="fas fa-users text-orange-500 mr-2"></i>Estudantes
        </p>
        <div class="text-sm text-gray-800 space-y-1">
          ${ci.estudantesComEscola.map(est => `
            <div class="flex items-center gap-2">
              <span class="font-medium">${est.nome}</span>
              ${est.escola && est.escola !== '--' ? `<span class="text-gray-500">• Escola: ${est.escola}</span>` : ''}
              ${est.serie && est.serie !== '--' ? `<span class="text-gray-500">• Série: ${est.serie}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

  // ── Calendários dos meses com aulas ────────────────────────
  const calendariosHtml = mesesOrdenados.map(ym => _renderMiniCalSol(ym, aulasMap)).join('');

  const modalHtml = `
    <div class="modal-overlay" id="modal-solicitacao-calendario" style="z-index:10002;">
      <div class="modal-container" style="max-width:900px;">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-xl text-gray-800">
            <i class="fas fa-calendar-check text-orange-500 mr-2"></i>
            Solicitação de Aula — Calendário
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body" id="sol-cal-body">
          ${headerHtml}
          <div id="sol-cal-meses">${calendariosHtml}</div>
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
            <p class="text-xs text-gray-600">
              <i class="fas fa-info-circle text-blue-500 mr-2"></i>
              Esta solicitação contém
              <strong class="text-orange-600">${totalAulas} aula(s)</strong>
              em
              <strong class="text-orange-600">${mesesOrdenados.length} mês/meses</strong>.
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button id="btn-fechar-sol-cal" class="btn-secondary">
            <i class="fas fa-times mr-2"></i>Fechar
          </button>
          <button id="btn-imprimir-sol-cal" class="btn-primary">
            <i class="fas fa-print mr-2"></i>Imprimir
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('modal-solicitacao-calendario');

  const closeMe = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', closeMe);
  document.getElementById('btn-fechar-sol-cal').addEventListener('click', closeMe);
  modal.addEventListener('click', e => { if (e.target === modal) closeMe(); });
  const escH = e => { if (e.key === 'Escape') { closeMe(); document.removeEventListener('keydown', escH); } };
  document.addEventListener('keydown', escH);

  document.getElementById('btn-imprimir-sol-cal').addEventListener('click', () => {
    const content  = modal.querySelector('.modal-container');
    const btnImp   = document.getElementById('btn-imprimir-sol-cal');
    const btnFech  = document.getElementById('btn-fechar-sol-cal');
    const origOv   = content.style.overflow;
    const origMaxH = content.style.maxHeight;
    content.style.overflow  = 'visible';
    content.style.maxHeight = 'none';
    btnImp.style.display  = 'none';
    btnFech.style.display = 'none';
    setTimeout(() => {
      if (typeof html2canvas !== 'function') {
        content.style.overflow = origOv; content.style.maxHeight = origMaxH;
        btnImp.style.display = ''; btnFech.style.display = '';
        if (typeof showToast === 'function') showToast('ℹ️ html2canvas não disponível', 'info');
        return;
      }
      html2canvas(content, { backgroundColor: '#ffffff', useCORS: true, scale: 2 })
        .then(canvas => {
          content.style.overflow = origOv; content.style.maxHeight = origMaxH;
          btnImp.style.display = ''; btnFech.style.display = '';
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `solicitacao-calendario-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        })
        .catch(() => {
          content.style.overflow = origOv; content.style.maxHeight = origMaxH;
          btnImp.style.display = ''; btnFech.style.display = '';
          if (typeof showToast === 'function') showToast('❌ Erro ao gerar imagem', 'error');
        });
    }, 60);
  });
}

function _renderMiniCalSol(ymStr, aulasMap) {
  const [year, monthIdx] = ymStr.split('-').map(Number);
  const firstDay    = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const daysInPrevM = new Date(year, monthIdx, 0).getDate();

  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ other: true, day: daysInPrevM - i, key: null });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ other: false, day: d, key: `${year}-${monthIdx}-${d}` });
  let nd = 1;
  while (cells.length % 7 !== 0)
    cells.push({ other: true, day: nd++, key: null });

  const weekdaysHtml = DIAS.map(d =>
    `<div class="sol-cal-weekday">${d}</div>`).join('');

  const daysHtml = cells.map(cell => {
    if (cell.other)
      return `<div class="sol-cal-day sol-cal-day-other"><span class="sol-cal-day-num">${cell.day}</span></div>`;
    const aulas = aulasMap[cell.key] || [];
    return `
      <div class="sol-cal-day${aulas.length ? ' sol-cal-day-has' : ''}">
        <span class="sol-cal-day-num">${cell.day}</span>
        ${aulas.map(a => _buildSolCard(a)).join('')}
      </div>`;
  }).join('');

  return `
    <div class="sol-cal-mes">
      <div class="sol-cal-mes-titulo">
        <i class="fas fa-calendar-alt mr-2"></i>${MESES_CAL[monthIdx]} ${year}
      </div>
      <div class="sol-cal-grid">
        ${weekdaysHtml}
        ${daysHtml}
      </div>
    </div>`;
}

function _buildSolCard(a) {
  const bg   = a.cor ? a.cor : 'linear-gradient(135deg,#f28705 0%,#ffb347 100%)';
  const col  = a.cor ? getContrastColor(a.cor) : '#fff';
  const bgSt = a.cor ? `background:${bg};` : `background:${bg};`;
  const horStr = a.horario ? ` • ${a.horario}` : '';
  const prof   = a.professor && a.professor !== 'A definir' ? a.professor.split(' ')[0] : '';
  const dur    = a.duracao && a.duracao !== '--' ? ` • ${a.duracao}` : '';
  return `<div class="sol-cal-card" style="${bgSt}color:${col};">
    <span class="sol-cal-card-mat">${a.materia}${dur}${horStr}</span>
    ${prof ? `<span class="sol-cal-card-prof">${prof}</span>` : ''}
  </div>`;
}

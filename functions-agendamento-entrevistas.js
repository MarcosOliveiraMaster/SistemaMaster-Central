// ============================================================
// functions-agendamento-entrevistas.js
// Aba "Agendamento de Entrevistas" — Dashboard > Professores
// Módulo autocontido sobre o Firestore (projeto master-ecossistemaprofessor).
// Chamado por functions-dashboardProfessor.js: AgendamentoEntrevistas.init(container)
// na 1ª abertura da aba "dp-tab-agendamento" e .recarregar() nas seguintes.
//
// Fluxo:
//  · No formulário de seleção o candidato só SUGERE um dia/horário
//    (candidatos.entrevistaPreferenciaDia / entrevistaPreferenciaHorario),
//    escolhido do catálogo entrevistaSlots.
//  · Aqui o admin lista os candidatos e ATRIBUI a data definitiva — a
//    sugerida ou qualquer outra — gravando dataEntrevista (dd/mm/aaaa),
//    horaEntrevista (HH:MM) e linkEntrevista: os MESMOS campos da aba
//    "Avaliação de Candidatos", então as duas telas ficam sincronizadas.
// ============================================================

window.AgendamentoEntrevistas = (function () {
  'use strict';

  const CFG = {
    colCandidatos: 'candidatos',
    colSlots: 'entrevistaSlots',
    diaLabel: {
      segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta',
      sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo',
    },
    diaOrdem: { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 7 },
    diaKeys: ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'],
    statusEncerrados: ['Aprovado', 'Reprovado', 'Desistente'],
  };

  const S = {
    root: null,
    db: null,
    storage: null,
    view: 'candidatos',     // 'candidatos' | 'agenda' | 'horarios'
    filtro: 'pendentes',    // 'pendentes' | 'agendados' | 'todos'
    busca: '',
    agendaPeriodo: 'proximas', // 'proximas' | 'anteriores'
    slots: [],
    candidatos: [],
    selecionadoId: null,
  };

  // ── Helpers ──────────────────────────────────────────────────
  function $q(sel) { return S.root ? S.root.querySelector(sel) : null; }
  function $qa(sel) { return S.root ? [...S.root.querySelectorAll(sel)] : []; }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Mesmo visual do toast de functions-dashboardProfessor.js (container #dp-toast).
  function toast(msg, tipo) {
    if (typeof window.showToast === 'function') { window.showToast(msg, tipo); return; }
    const cnt = document.getElementById('dp-toast');
    if (!cnt) { console.log('[Agendamento]', msg); return; }
    const t = document.createElement('div');
    t.className = 'dp-toast dp-toast--' + (tipo || 'info');
    t.style.pointerEvents = 'auto';
    const icon = document.createElement('span');
    icon.style.fontSize = '1rem';
    icon.textContent = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    const txt = document.createElement('span');
    txt.textContent = msg;
    t.append(icon, txt);
    cnt.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2800);
    setTimeout(() => t.remove(), 3200);
  }

  function confirmar({ titulo, corpo, labelOk, tipoOk, onOk }) {
    const overlay = document.createElement('div');
    overlay.className = 'dp-popup-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="dp-popup-box">' +
        '<h3>' + escapeHtml(titulo) + '</h3>' +
        '<p>' + corpo + '</p>' +
        '<div class="dp-popup-actions">' +
          '<button class="dp-btn dp-btn--ghost" data-acao="cancelar">Cancelar</button>' +
          '<button class="dp-btn dp-btn--' + (tipoOk || 'danger') + '" data-acao="ok">' + escapeHtml(labelOk || 'Confirmar') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.dataset.acao === 'cancelar') { overlay.remove(); return; }
      if (e.target.dataset.acao === 'ok') { overlay.remove(); onOk(); }
    });
  }

  function formatarCPF(cpf) {
    const v = String(cpf || '').replace(/\D/g, '');
    if (v.length !== 11) return escapeHtml(cpf);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function formatarTelefone(tel) {
    const v = String(tel || '').replace(/\D/g, '');
    if (v.length === 11) return '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    if (v.length === 10) return '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
    return escapeHtml(tel);
  }

  function formatarBytes(b) {
    if (!b) return '';
    return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }

  function parseHorarioOrdem(txt) {
    const m = /^(\d{1,2})h(\d{2})?$/.exec(txt);
    if (!m) return null;
    const hh = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
    if (hh > 23 || mm > 59) return null;
    return hh * 100 + mm;
  }

  // "10h30" -> "10:30", "9h" -> "09:00"
  function horarioParaHHMM(txt) {
    const ordem = parseHorarioOrdem(String(txt || ''));
    if (ordem === null) return '';
    return String(Math.floor(ordem / 100)).padStart(2, '0') + ':' + String(ordem % 100).padStart(2, '0');
  }

  // "dd/mm/aaaa" -> Date (meia-noite local) ou null
  function parseDataBR(str) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(str || '').trim());
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
  }

  function dateParaISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dataBRParaISO(str) {
    const d = parseDataBR(str);
    return d ? dateParaISO(d) : '';
  }

  function isoParaDataBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  function hoje() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  // Próxima ocorrência (a partir de amanhã) do dia da semana sugerido.
  function proximaDataDoDia(diaKey) {
    const iso = CFG.diaOrdem[diaKey];
    if (!iso) return null;
    const alvo = iso % 7; // Date.getDay(): 0 = domingo
    const d = hoje();
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === alvo) return new Date(d);
    }
    return null;
  }

  function dataLonga(d) {
    const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function sugestaoTexto(c) {
    if (!c.entrevistaPreferenciaDia) return '';
    return (CFG.diaLabel[c.entrevistaPreferenciaDia] || c.entrevistaPreferenciaDia) + ', ' + (c.entrevistaPreferenciaHorario || '');
  }

  function temEntrevista(c) { return !!String(c.dataEntrevista || '').trim(); }

  function agendamentoTexto(c) {
    if (!temEntrevista(c)) return '';
    return String(c.dataEntrevista).trim() + (c.horaEntrevista ? ' às ' + String(c.horaEntrevista).trim() : '');
  }

  // Momento da entrevista (para ordenar/agrupar). Sem hora válida = 00:00.
  function momentoEntrevista(c) {
    const d = parseDataBR(c.dataEntrevista);
    if (!d) return null;
    const m = /^(\d{2}):(\d{2})$/.exec(String(c.horaEntrevista || '').trim());
    if (m) d.setHours(+m[1], +m[2]);
    return d;
  }

  function dataEnvio(c) {
    if (c.timestamp?.toMillis) return c.timestamp.toMillis();
    const t = Date.parse(c.dataEnvio || '');
    return isNaN(t) ? 0 : t;
  }

  // Outros candidatos já marcados no mesmo dia e horário.
  function conflitos(id, dataBR, hora) {
    if (!dataBR || !hora) return [];
    return S.candidatos.filter((c) => c.id !== id &&
      String(c.dataEntrevista || '').trim() === dataBR &&
      String(c.horaEntrevista || '').trim() === hora);
  }

  // Mantém a aba "Avaliação de Candidatos" (functions-dashboardProfessor.js)
  // sincronizada sem recarregar a coleção inteira.
  function notificarAtualizacao(id, dados) {
    window.dispatchEvent(new CustomEvent('dp:candidato-atualizado', { detail: { id, dados } }));
  }

  // ── Estilos (namespace dpae-) ────────────────────────────────
  function injectStyles() {
    if (document.getElementById('dpae-styles')) return;
    const style = document.createElement('style');
    style.id = 'dpae-styles';
    style.textContent =
      '.dpae-wrap{display:flex;flex-direction:column;gap:1rem;}' +
      '.dpae-toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;}' +
      '.dpae-pill-toggle{display:inline-flex;background:var(--dp-gray-100,#f3f4f6);border-radius:999px;padding:3px;gap:2px;flex-wrap:wrap;}' +
      '.dpae-pill-toggle button{border:none;background:transparent;padding:.4rem .9rem;border-radius:999px;font-family:"Comfortaa",cursive;font-size:.78rem;font-weight:600;cursor:pointer;color:var(--dp-gray-600,#4b5563);}' +
      '.dpae-pill-toggle button.active{background:var(--dp-orange,#f28705);color:#fff;}' +
      '.dpae-section-tabs{display:flex;gap:.5rem;border-bottom:1px solid var(--dp-gray-200,#e5e7eb);flex-wrap:wrap;}' +
      '.dpae-section-tabs button{border:none;background:transparent;padding:.6rem 1rem;font-family:"Comfortaa",cursive;font-weight:700;font-size:.85rem;color:var(--dp-gray-600,#4b5563);cursor:pointer;border-bottom:2px solid transparent;}' +
      '.dpae-section-tabs button.active{color:var(--dp-orange,#f28705);border-color:var(--dp-orange,#f28705);}' +
      '.dpae-filtros{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:.8rem;}' +
      '.dpae-busca{flex:1;min-width:180px;}' +
      '.dpae-layout{display:grid;grid-template-columns:1fr 1.15fr;gap:1rem;}' +
      '.dpae-list{display:flex;flex-direction:column;gap:.4rem;overflow-y:auto;max-height:66vh;padding-right:.2rem;}' +
      '.dpae-item{border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.6rem;padding:.6rem .8rem;cursor:pointer;transition:border-color .15s;}' +
      '.dpae-item:hover{border-color:var(--dp-orange,#f28705);}' +
      '.dpae-item.active{border-color:var(--dp-orange,#f28705);background:var(--dp-orange-light,#fef3e2);}' +
      '.dpae-item-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem;}' +
      '.dpae-item-nome{font-weight:700;font-size:.85rem;}' +
      '.dpae-item-meta{font-size:.72rem;color:var(--dp-gray-600,#4b5563);display:flex;justify-content:space-between;margin-top:.25rem;gap:.5rem;flex-wrap:wrap;}' +
      '.dpae-badge{font-size:.65rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;white-space:nowrap;}' +
      '.dpae-badge--ok{background:#dcfce7;color:#15803d;}' +
      '.dpae-badge--pend{background:#fef3c7;color:#b45309;}' +
      '.dpae-badge--status{background:var(--dp-gray-100,#f3f4f6);color:var(--dp-gray-600,#4b5563);}' +
      '.dpae-detail{border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.6rem;padding:1rem;align-self:flex-start;display:flex;flex-direction:column;gap:1rem;}' +
      '.dpae-detail h4{font-size:.8rem;font-weight:700;margin:0 0 .4rem;color:var(--dp-gray-800,#1f2937);}' +
      '.dpae-detail-row{display:flex;justify-content:space-between;gap:.5rem;padding:.35rem 0;border-bottom:1px dashed var(--dp-gray-200,#e5e7eb);font-size:.82rem;}' +
      '.dpae-detail-row span:first-child{color:var(--dp-gray-600,#4b5563);flex-shrink:0;}' +
      '.dpae-detail-row span:last-child{text-align:right;word-break:break-word;}' +
      '.dpae-sugestao{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;background:var(--dp-gray-50,#f9fafb);border-radius:.5rem;padding:.6rem .8rem;font-size:.82rem;}' +
      '.dpae-form-row{display:flex;gap:.6rem;flex-wrap:wrap;}' +
      '.dpae-form-row .dp-field{flex:1;min-width:130px;}' +
      '.dpae-aviso{font-size:.75rem;color:#b45309;background:#fef3c7;border-radius:.4rem;padding:.45rem .6rem;}' +
      '.dpae-aviso:empty{display:none;}' +
      '.dpae-actions{display:flex;gap:.5rem;flex-wrap:wrap;}' +
      '.dpae-doc{display:flex;align-items:center;gap:.5rem;font-size:.8rem;padding:.35rem 0;border-bottom:1px dashed var(--dp-gray-200,#e5e7eb);}' +
      '.dpae-doc span.nome{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.dpae-doc span.tam{color:var(--dp-gray-600,#4b5563);font-size:.7rem;}' +
      '.dpae-empty{color:var(--dp-gray-600,#4b5563);font-size:.85rem;text-align:center;padding:2rem 0;}' +
      '.dpae-dia{margin-bottom:1rem;}' +
      '.dpae-dia-titulo{font-weight:700;font-size:.85rem;margin-bottom:.4rem;color:var(--dp-gray-800,#1f2937);}' +
      '.dpae-agenda-item{display:grid;grid-template-columns:60px 1fr auto;gap:.6rem;align-items:center;border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.5rem;padding:.5rem .7rem;margin-bottom:.35rem;cursor:pointer;font-size:.82rem;}' +
      '.dpae-agenda-item:hover{border-color:var(--dp-orange,#f28705);}' +
      '.dpae-agenda-item.conflito{border-color:#f59e0b;background:#fffbeb;}' +
      '.dpae-agenda-hora{font-weight:700;}' +
      '.dpae-grid{display:grid;border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.6rem;overflow:hidden;}' +
      '.dpae-grid-cell{border:1px solid var(--dp-gray-200,#e5e7eb);padding:.5rem;font-size:.72rem;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.3rem;}' +
      '.dpae-grid-head{background:var(--dp-gray-50,#f9fafb);font-weight:700;}' +
      '.dpae-toggle{position:relative;width:38px;height:22px;border-radius:999px;background:var(--dp-gray-200,#e5e7eb);border:none;cursor:pointer;flex-shrink:0;}' +
      '.dpae-toggle::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s;}' +
      '.dpae-toggle.on{background:var(--dp-green,#16a34a);}' +
      '.dpae-toggle.on::after{transform:translateX(16px);}' +
      '.dpae-del-slot{border:none;background:none;color:var(--dp-red,#dc2626);font-size:.68rem;cursor:pointer;}' +
      '.dpae-add-form{display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap;margin-top:1rem;}' +
      '@media (max-width: 900px){.dpae-layout{grid-template-columns:1fr;}}';
    document.head.appendChild(style);
  }

  // ── Carga de dados ───────────────────────────────────────────
  async function carregarDados() {
    const [candSnap, slotSnap] = await Promise.all([
      S.db.collection(CFG.colCandidatos).get().catch((e) => { console.error('Erro ao carregar candidatos:', e); toast('Erro ao carregar candidatos.', 'error'); return null; }),
      S.db.collection(CFG.colSlots).get().catch((e) => { console.error('Erro ao carregar horários:', e); toast('Erro ao carregar horários.', 'error'); return null; }),
    ]);
    if (candSnap) S.candidatos = candSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (slotSnap) {
      S.slots = slotSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.diaOrdem - b.diaOrdem) || (a.horarioOrdem - b.horarioOrdem));
    }
  }

  // ── Estrutura ────────────────────────────────────────────────
  // Sem tela de login própria: quem chega até aqui já passou pelo login do
  // Firebase do próprio Central (AUTH.requireAuth(), ver auth.js). As regras
  // do Firestore liberam candidatos/entrevistaSlots só para os e-mails admin.
  function renderApp() {
    const email = window.currentUser?.email || '';
    S.root.innerHTML =
      '<div class="dpae-wrap">' +
        '<div class="dpae-toolbar">' +
          '<div class="dpae-section-tabs">' +
            '<button data-secao="candidatos">👥 Candidatos</button>' +
            '<button data-secao="agenda">📅 Agenda</button>' +
            '<button data-secao="horarios">⚙️ Horários sugeridos</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:.6rem">' +
            '<span style="font-size:.72rem;color:var(--dp-gray-600,#4b5563)">' + escapeHtml(email) + '</span>' +
            '<button class="dp-btn dp-btn--ghost dp-btn--sm" id="dpae-btnRecarregar">🔄 Atualizar</button>' +
          '</div>' +
        '</div>' +
        '<div id="dpae-content"><p class="dpae-empty">Carregando…</p></div>' +
      '</div>';

    $qa('.dpae-section-tabs button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.secao === S.view);
      btn.addEventListener('click', () => {
        S.view = btn.dataset.secao;
        $qa('.dpae-section-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
        renderContent();
      });
    });
    $q('#dpae-btnRecarregar').addEventListener('click', recarregar);

    carregarDados().then(renderContent);
  }

  async function recarregar() {
    if (!S.root || !S.db) return;
    await carregarDados();
    renderContent();
  }

  function renderContent() {
    const el = $q('#dpae-content');
    if (!el) return;
    if (S.view === 'candidatos') renderCandidatos(el);
    else if (S.view === 'agenda') renderAgenda(el);
    else renderConfigHorarios(el);
  }

  // ── Bloco A: Candidatos + atribuição de entrevista ───────────
  function candidatosFiltrados() {
    const busca = S.busca.trim().toLowerCase();
    const buscaNum = busca.replace(/\D/g, '');
    return S.candidatos
      .filter((c) => {
        if (S.filtro === 'pendentes' && (temEntrevista(c) || CFG.statusEncerrados.includes(c.status))) return false;
        if (S.filtro === 'agendados' && !temEntrevista(c)) return false;
        if (!busca) return true;
        return String(c.nome || '').toLowerCase().includes(busca) ||
          String(c.email || '').toLowerCase().includes(busca) ||
          (buscaNum.length >= 3 && String(c.cpf || '').includes(buscaNum));
      })
      .sort((a, b) => {
        if (S.filtro === 'agendados') {
          const ma = momentoEntrevista(a), mb = momentoEntrevista(b);
          return (ma ? ma.getTime() : Infinity) - (mb ? mb.getTime() : Infinity);
        }
        return dataEnvio(a) - dataEnvio(b); // mais antigos primeiro: fila de atendimento
      });
  }

  function renderCandidatos(el) {
    const pendentes = S.candidatos.filter((c) => !temEntrevista(c) && !CFG.statusEncerrados.includes(c.status)).length;
    const agendados = S.candidatos.filter(temEntrevista).length;

    el.innerHTML =
      '<div class="dpae-filtros">' +
        '<div class="dpae-pill-toggle">' +
          '<button data-filtro="pendentes" class="' + (S.filtro === 'pendentes' ? 'active' : '') + '">Sem entrevista (' + pendentes + ')</button>' +
          '<button data-filtro="agendados" class="' + (S.filtro === 'agendados' ? 'active' : '') + '">Agendados (' + agendados + ')</button>' +
          '<button data-filtro="todos" class="' + (S.filtro === 'todos' ? 'active' : '') + '">Todos (' + S.candidatos.length + ')</button>' +
        '</div>' +
        '<input type="search" id="dpae-busca" class="dp-input dpae-busca" placeholder="Buscar por nome, e-mail ou CPF" value="' + escapeHtml(S.busca) + '">' +
      '</div>' +
      '<div class="dpae-layout">' +
        '<div class="dpae-list" id="dpae-lista"></div>' +
        '<div class="dpae-detail" id="dpae-detalhe"><p class="dpae-empty">Selecione um candidato para atribuir a entrevista.</p></div>' +
      '</div>';

    el.querySelectorAll('[data-filtro]').forEach((btn) => {
      btn.addEventListener('click', () => { S.filtro = btn.dataset.filtro; renderCandidatos(el); });
    });
    const busca = el.querySelector('#dpae-busca');
    busca.addEventListener('input', () => { S.busca = busca.value; renderListaCandidatos(el); });

    renderListaCandidatos(el);
    const sel = S.candidatos.find((c) => c.id === S.selecionadoId);
    if (sel) renderDetalheCandidato(el.querySelector('#dpae-detalhe'), sel);
  }

  function renderListaCandidatos(el) {
    const listaEl = el.querySelector('#dpae-lista');
    const lista = candidatosFiltrados();
    if (!lista.length) {
      listaEl.innerHTML = '<p class="dpae-empty">' + (S.filtro === 'pendentes' ? 'Nenhum candidato aguardando entrevista. 🎉' : 'Nenhum candidato encontrado.') + '</p>';
      return;
    }
    listaEl.innerHTML = '';
    lista.forEach((c) => {
      const agendado = temEntrevista(c);
      const sug = sugestaoTexto(c);
      const div = document.createElement('div');
      div.className = 'dpae-item' + (S.selecionadoId === c.id ? ' active' : '');
      div.innerHTML =
        '<div class="dpae-item-top">' +
          '<span class="dpae-item-nome">' + escapeHtml(c.nome || '(sem nome)') + '</span>' +
          (agendado
            ? '<span class="dpae-badge dpae-badge--ok">📅 ' + escapeHtml(agendamentoTexto(c)) + '</span>'
            : '<span class="dpae-badge dpae-badge--pend">Sem data</span>') +
        '</div>' +
        '<div class="dpae-item-meta">' +
          '<span>' + (sug ? 'Sugestão: ' + escapeHtml(sug) : 'Sem sugestão') + '</span>' +
          (c.status && c.status !== 'Candidato' ? '<span class="dpae-badge dpae-badge--status">' + escapeHtml(c.status) + '</span>' : '') +
        '</div>';
      div.addEventListener('click', () => {
        S.selecionadoId = c.id;
        listaEl.querySelectorAll('.dpae-item').forEach((i) => i.classList.remove('active'));
        div.classList.add('active');
        renderDetalheCandidato(el.querySelector('#dpae-detalhe'), c);
      });
      listaEl.appendChild(div);
    });
  }

  function renderDetalheCandidato(el, c) {
    const sug = sugestaoTexto(c);
    const docs = [];
    if (c.curriculo?.path) docs.push({ rotulo: 'Currículo', ...c.curriculo });
    (Array.isArray(c.documentosExtras) ? c.documentosExtras : []).forEach((d, i) => {
      if (d?.path) docs.push({ rotulo: 'Documento ' + (i + 1), ...d });
    });

    el.innerHTML =
      '<div>' +
        '<h4>' + escapeHtml(c.nome || '(sem nome)') + '</h4>' +
        '<div class="dpae-detail-row"><span>CPF</span><span>' + formatarCPF(c.cpf) + '</span></div>' +
        '<div class="dpae-detail-row"><span>E-mail</span><span>' + escapeHtml(c.email) + '</span></div>' +
        '<div class="dpae-detail-row"><span>Telefone</span><span>' + formatarTelefone(c.contato) + '</span></div>' +
        '<div class="dpae-detail-row"><span>Disciplinas</span><span>' + escapeHtml(c.disciplinas) + '</span></div>' +
        '<div class="dpae-detail-row"><span>Status</span><span>' + escapeHtml(c.status || 'Candidato') + '</span></div>' +
        '<div class="dpae-detail-row"><span>Inscrito em</span><span>' + escapeHtml(c.dataEnvioLegivel || '') + '</span></div>' +
      '</div>' +

      '<div>' +
        '<h4>Documentos</h4>' +
        (docs.length
          ? docs.map((d, i) =>
              '<div class="dpae-doc"><span>📄</span><span class="nome" title="' + escapeHtml(d.nomeOriginal) + '"><strong>' + escapeHtml(d.rotulo) + ':</strong> ' + escapeHtml(d.nomeOriginal || '') + '</span>' +
              '<span class="tam">' + formatarBytes(d.tamanho) + '</span>' +
              '<button class="dp-btn dp-btn--ghost dp-btn--sm" data-doc="' + i + '">Abrir</button></div>').join('')
          : '<p style="font-size:.78rem;color:var(--dp-gray-600,#4b5563)">Nenhum documento enviado.</p>') +
      '</div>' +

      '<div>' +
        '<h4>Entrevista</h4>' +
        '<div class="dpae-sugestao">' +
          '<span>💡 Sugestão do candidato: <strong>' + (sug ? escapeHtml(sug) : 'não informada') + '</strong></span>' +
          (sug ? '<button class="dp-btn dp-btn--ghost dp-btn--sm" id="dpae-usarSugestao">Usar sugestão</button>' : '') +
        '</div>' +
        '<div class="dpae-form-row" style="margin-top:.7rem">' +
          '<div class="dp-field"><label class="dp-field-label">Data</label><input type="date" id="dpae-data" class="dp-input" value="' + dataBRParaISO(c.dataEntrevista) + '"></div>' +
          '<div class="dp-field"><label class="dp-field-label">Hora</label><input type="time" id="dpae-hora" class="dp-input" value="' + escapeHtml(String(c.horaEntrevista || '').trim()) + '"></div>' +
        '</div>' +
        '<div class="dp-field" style="margin-top:.5rem"><label class="dp-field-label">Link da entrevista (opcional)</label><input type="text" id="dpae-link" class="dp-input" placeholder="https://meet.google.com/…" value="' + escapeHtml(c.linkEntrevista || '') + '"></div>' +
        '<p id="dpae-dataInfo" style="font-size:.75rem;color:var(--dp-gray-600,#4b5563);margin:.4rem 0"></p>' +
        '<p id="dpae-aviso" class="dpae-aviso"></p>' +
        '<div class="dpae-actions" style="margin-top:.6rem">' +
          '<button class="dp-btn dp-btn--primary dp-btn--sm" id="dpae-salvar">💾 ' + (temEntrevista(c) ? 'Salvar alterações' : 'Atribuir entrevista') + '</button>' +
          (temEntrevista(c) ? '<button class="dp-btn dp-btn--danger dp-btn--sm" id="dpae-remover">Remover agendamento</button>' : '') +
        '</div>' +
      '</div>' +

      '<div class="dpae-actions">' +
        '<button class="dp-btn dp-btn--ghost dp-btn--sm" id="dpae-copiarTel">📋 Copiar telefone</button>' +
        (temEntrevista(c) ? '<button class="dp-btn dp-btn--ghost dp-btn--sm" id="dpae-whats">💬 Enviar confirmação no WhatsApp</button>' : '') +
      '</div>';

    const inData = el.querySelector('#dpae-data');
    const inHora = el.querySelector('#dpae-hora');
    const inLink = el.querySelector('#dpae-link');

    const atualizarInfo = () => {
      const dataBR = isoParaDataBR(inData.value);
      const d = parseDataBR(dataBR);
      el.querySelector('#dpae-dataInfo').textContent = d ? dataLonga(d) + (inHora.value ? ' às ' + inHora.value : '') : '';
      const outros = conflitos(c.id, dataBR, inHora.value);
      el.querySelector('#dpae-aviso').textContent = outros.length
        ? '⚠️ Já existe entrevista neste dia e horário com: ' + outros.map((o) => o.nome || '(sem nome)').join(', ') + '.'
        : (d && d < hoje() ? '⚠️ Esta data já passou.' : '');
    };
    inData.addEventListener('input', atualizarInfo);
    inHora.addEventListener('input', atualizarInfo);
    atualizarInfo();

    el.querySelector('#dpae-usarSugestao')?.addEventListener('click', () => {
      const d = proximaDataDoDia(c.entrevistaPreferenciaDia);
      if (d) inData.value = dateParaISO(d);
      const hhmm = horarioParaHHMM(c.entrevistaPreferenciaHorario);
      if (hhmm) inHora.value = hhmm;
      atualizarInfo();
    });

    el.querySelectorAll('[data-doc]').forEach((btn) => {
      btn.addEventListener('click', () => abrirDocumento(docs[+btn.dataset.doc].path, btn));
    });

    el.querySelector('#dpae-salvar').addEventListener('click', () => {
      const dataBR = isoParaDataBR(inData.value);
      const hora = inHora.value;
      if (!dataBR || !hora) { toast('Informe a data e a hora da entrevista.', 'error'); return; }
      const dados = { dataEntrevista: dataBR, horaEntrevista: hora, linkEntrevista: inLink.value.trim() };
      const outros = conflitos(c.id, dataBR, hora);
      if (outros.length) {
        confirmar({
          titulo: 'Horário já ocupado',
          corpo: 'Já existe entrevista em ' + escapeHtml(dataBR) + ' às ' + escapeHtml(hora) + ' com <strong>' +
            outros.map((o) => escapeHtml(o.nome || '(sem nome)')).join(', ') + '</strong>. Deseja marcar mesmo assim?',
          labelOk: 'Marcar mesmo assim',
          tipoOk: 'primary',
          onOk: () => salvarEntrevista(c, dados),
        });
        return;
      }
      salvarEntrevista(c, dados);
    });

    el.querySelector('#dpae-remover')?.addEventListener('click', () => {
      confirmar({
        titulo: 'Remover agendamento?',
        corpo: 'A entrevista de <strong>' + escapeHtml(c.nome || '') + '</strong> (' + escapeHtml(agendamentoTexto(c)) +
          ') será desmarcada e o candidato volta para a lista "Sem entrevista".',
        labelOk: 'Remover',
        onOk: () => salvarEntrevista(c, { dataEntrevista: '', horaEntrevista: '', linkEntrevista: '' }),
      });
    });

    el.querySelector('#dpae-copiarTel').addEventListener('click', () => {
      navigator.clipboard.writeText(String(c.contato || '')).then(() => toast('Telefone copiado!', 'success'));
    });

    el.querySelector('#dpae-whats')?.addEventListener('click', () => {
      const tel = String(c.contato || '').replace(/\D/g, '');
      if (tel.length < 10) { toast('Telefone do candidato inválido.', 'error'); return; }
      const d = parseDataBR(c.dataEntrevista);
      const primeiroNome = String(c.nome || '').trim().split(/\s+/)[0] || '';
      const msg = 'Olá, ' + primeiroNome + '! Aqui é da Master Educação. 😊\n\n' +
        'Sua entrevista do processo seletivo para professores foi agendada para ' +
        (d ? dataLonga(d) : c.dataEntrevista) + (c.horaEntrevista ? ', às ' + c.horaEntrevista : '') + '.' +
        (c.linkEntrevista ? '\n\nLink: ' + c.linkEntrevista : '') +
        '\n\nPor favor, confirme sua presença respondendo esta mensagem.';
      window.open('https://wa.me/55' + tel + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
  }

  async function salvarEntrevista(c, dados) {
    const payload = {
      ...dados,
      entrevistaAtribuidaEm: firebase.firestore.FieldValue.serverTimestamp(),
      entrevistaAtribuidaPor: window.currentUser?.email || '',
    };
    try {
      await S.db.collection(CFG.colCandidatos).doc(c.id).update(payload);
      Object.assign(c, dados);
      notificarAtualizacao(c.id, dados);
      toast(dados.dataEntrevista ? 'Entrevista atribuída!' : 'Agendamento removido.', 'success');
      renderContent();
    } catch (e) {
      console.error('Erro ao salvar entrevista:', e);
      toast('Erro ao salvar: ' + e.message, 'error');
    }
  }

  async function abrirDocumento(path, btn) {
    // Abre a aba já no clique (evita bloqueio de pop-up) e preenche depois.
    const win = window.open('', '_blank');
    const txt = btn.textContent;
    btn.disabled = true; btn.textContent = '…';
    try {
      const url = await S.storage.ref(path).getDownloadURL();
      if (win) { win.opener = null; win.location.href = url; } else window.open(url, '_blank', 'noopener');
    } catch (e) {
      if (win) win.close();
      console.error('Erro ao abrir documento:', e);
      toast('Não foi possível abrir o documento.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = txt;
    }
  }

  // ── Bloco B: Agenda (entrevistas atribuídas, por dia) ────────
  function renderAgenda(el) {
    const agora = hoje();
    const comData = S.candidatos.filter(temEntrevista).map((c) => ({ c, m: momentoEntrevista(c) }));
    const invalidos = comData.filter((x) => !x.m);
    const validos = comData.filter((x) => x.m);
    const lista = (S.agendaPeriodo === 'proximas'
      ? validos.filter((x) => x.m >= agora).sort((a, b) => a.m - b.m)
      : validos.filter((x) => x.m < agora).sort((a, b) => b.m - a.m));

    let html =
      '<div class="dpae-pill-toggle" style="margin-bottom:.8rem">' +
        '<button data-periodo="proximas" class="' + (S.agendaPeriodo === 'proximas' ? 'active' : '') + '">Próximas</button>' +
        '<button data-periodo="anteriores" class="' + (S.agendaPeriodo === 'anteriores' ? 'active' : '') + '">Anteriores</button>' +
      '</div>';

    if (!lista.length) {
      html += '<p class="dpae-empty">' + (S.agendaPeriodo === 'proximas' ? 'Nenhuma entrevista agendada a partir de hoje.' : 'Nenhuma entrevista anterior.') + '</p>';
    } else {
      // Conflitos: mesmo dia + mesma hora
      const contagem = {};
      lista.forEach(({ c }) => { const k = c.dataEntrevista + '|' + c.horaEntrevista; contagem[k] = (contagem[k] || 0) + 1; });

      let diaAtual = '';
      lista.forEach(({ c, m }) => {
        const dia = String(c.dataEntrevista).trim();
        if (dia !== diaAtual) {
          if (diaAtual) html += '</div>';
          diaAtual = dia;
          html += '<div class="dpae-dia"><div class="dpae-dia-titulo">' + escapeHtml(dataLonga(m)) + '</div>';
        }
        const conflito = contagem[c.dataEntrevista + '|' + c.horaEntrevista] > 1;
        html +=
          '<div class="dpae-agenda-item' + (conflito ? ' conflito' : '') + '" data-id="' + escapeHtml(c.id) + '" title="' + (conflito ? 'Mais de uma entrevista neste horário' : '') + '">' +
            '<span class="dpae-agenda-hora">' + escapeHtml(c.horaEntrevista || '—') + '</span>' +
            '<span>' + escapeHtml(c.nome || '(sem nome)') + (conflito ? ' ⚠️' : '') + '</span>' +
            (c.linkEntrevista ? '<span style="font-size:.7rem;color:var(--dp-gray-600,#4b5563)">🔗 link</span>' : '<span></span>') +
          '</div>';
      });
      html += '</div>';
    }

    if (invalidos.length) {
      html += '<p style="font-size:.75rem;color:#b45309;margin-top:.8rem">⚠️ ' + invalidos.length +
        ' candidato(s) com data em formato inválido (esperado dd/mm/aaaa): ' +
        invalidos.map((x) => escapeHtml(x.c.nome || x.c.id) + ' — "' + escapeHtml(x.c.dataEntrevista) + '"').join('; ') + '</p>';
    }

    el.innerHTML = html;

    el.querySelectorAll('[data-periodo]').forEach((btn) => {
      btn.addEventListener('click', () => { S.agendaPeriodo = btn.dataset.periodo; renderAgenda(el); });
    });
    el.querySelectorAll('.dpae-agenda-item').forEach((item) => {
      item.addEventListener('click', () => {
        S.selecionadoId = item.dataset.id;
        S.filtro = 'agendados';
        S.busca = '';
        S.view = 'candidatos';
        $qa('.dpae-section-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.secao === 'candidatos'));
        renderContent();
      });
    });
  }

  // ── Bloco C: Horários que o candidato pode sugerir ───────────
  function ordenarChaves(slots, campoChave, campoOrdem) {
    const mapa = new Map();
    slots.forEach((s) => { if (!mapa.has(s[campoChave])) mapa.set(s[campoChave], s[campoOrdem]); });
    return [...mapa.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  }

  function renderConfigHorarios(el) {
    const dias = ordenarChaves(S.slots, 'diaSemana', 'diaOrdem');
    const horarios = ordenarChaves(S.slots, 'horario', 'horarioOrdem');
    const slotMap = new Map(S.slots.map((s) => [s.diaSemana + '|' + s.horario, s]));

    let html = '<p style="font-size:.8rem;color:var(--dp-gray-600,#4b5563);margin-bottom:.8rem">' +
      'Estes são os dias e horários que o candidato pode <strong>sugerir</strong> no formulário de seleção. ' +
      'Horários inativos somem do formulário. A data definitiva da entrevista é sempre atribuída na aba "Candidatos" ' +
      '— pode ser a sugerida ou qualquer outra.</p>';

    if (!dias.length) {
      html += '<p class="dpae-empty">Nenhum horário cadastrado ainda. Sem horários ativos, o candidato não consegue concluir o formulário.</p>';
    } else {
      html += '<div class="dpae-grid" style="grid-template-columns:90px repeat(' + dias.length + ',1fr)">';
      html += '<div class="dpae-grid-cell dpae-grid-head"></div>';
      dias.forEach((d) => { html += '<div class="dpae-grid-cell dpae-grid-head">' + escapeHtml(CFG.diaLabel[d] || d) + '</div>'; });
      horarios.forEach((h) => {
        html += '<div class="dpae-grid-cell dpae-grid-head">' + escapeHtml(h) + '</div>';
        dias.forEach((d) => {
          const slot = slotMap.get(d + '|' + h);
          if (!slot) { html += '<div class="dpae-grid-cell"></div>'; return; }
          html += '<div class="dpae-grid-cell">' +
            '<button class="dpae-toggle' + (slot.ativo ? ' on' : '') + '" data-id="' + escapeHtml(slot.id) + '" title="' + (slot.ativo ? 'Ativo' : 'Inativo') + '"></button>' +
            '<button class="dpae-del-slot" data-id="' + escapeHtml(slot.id) + '">Excluir</button>' +
          '</div>';
        });
      });
      html += '</div>';
    }

    html += '<div class="dpae-add-form">' +
      '<div class="dp-field"><label class="dp-field-label">Dia da semana</label>' +
        '<select id="dpae-novoDia" class="dp-select">' +
          CFG.diaKeys.map((k) => '<option value="' + k + '">' + CFG.diaLabel[k] + '</option>').join('') +
        '</select></div>' +
      '<div class="dp-field"><label class="dp-field-label">Horário</label>' +
        '<input type="text" id="dpae-novoHorario" class="dp-input" placeholder="ex: 14h ou 14h30" style="width:140px"></div>' +
      '<button id="dpae-btnAddHorario" class="dp-btn dp-btn--primary dp-btn--sm">+ Adicionar</button>' +
    '</div>' +
    '<p id="dpae-addMsg" style="font-size:.78rem;color:var(--dp-red,#dc2626);margin-top:.4rem"></p>';

    el.innerHTML = html;

    el.querySelectorAll('.dpae-toggle').forEach((btn) => {
      btn.addEventListener('click', () => toggleSlotAtivo(btn.dataset.id, el));
    });
    el.querySelectorAll('.dpae-del-slot').forEach((btn) => {
      btn.addEventListener('click', () => excluirSlot(btn.dataset.id, el));
    });
    el.querySelector('#dpae-btnAddHorario').addEventListener('click', () => adicionarHorario(el));
  }

  async function toggleSlotAtivo(id, el) {
    const slot = S.slots.find((s) => s.id === id);
    if (!slot) return;
    const novoAtivo = !slot.ativo;
    slot.ativo = novoAtivo; // otimista
    renderConfigHorarios(el);
    try {
      await S.db.collection(CFG.colSlots).doc(id).update({ ativo: novoAtivo });
      toast(novoAtivo ? 'Horário ativado.' : 'Horário desativado.', 'success');
    } catch (e) {
      slot.ativo = !novoAtivo;
      renderConfigHorarios(el);
      toast('Erro ao atualizar: ' + e.message, 'error');
    }
  }

  function excluirSlot(id, el) {
    const slot = S.slots.find((s) => s.id === id);
    if (!slot) return;
    confirmar({
      titulo: 'Excluir horário?',
      corpo: 'Remove ' + escapeHtml(CFG.diaLabel[slot.diaSemana] || slot.diaSemana) + ' ' + escapeHtml(slot.horario) +
        ' das opções do formulário. As sugestões já enviadas pelos candidatos não são afetadas.',
      labelOk: 'Excluir',
      onOk: async () => {
        try {
          await S.db.collection(CFG.colSlots).doc(id).delete();
          S.slots = S.slots.filter((s) => s.id !== id);
          toast('Horário removido.', 'success');
          renderConfigHorarios(el);
        } catch (e) {
          toast('Erro ao remover: ' + e.message, 'error');
        }
      },
    });
  }

  async function adicionarHorario(el) {
    const dia = el.querySelector('#dpae-novoDia').value;
    const horario = el.querySelector('#dpae-novoHorario').value.trim();
    const msgEl = el.querySelector('#dpae-addMsg');

    const ordem = parseHorarioOrdem(horario);
    if (ordem === null) { msgEl.textContent = 'Formato inválido. Use algo como "14h" ou "14h30".'; return; }
    const id = dia + '_' + horario;
    if (S.slots.some((s) => s.id === id)) { msgEl.textContent = 'Esse dia + horário já existe.'; return; }
    msgEl.textContent = '';

    const novoSlot = { diaSemana: dia, horario, ativo: true, diaOrdem: CFG.diaOrdem[dia], horarioOrdem: ordem };
    try {
      await S.db.collection(CFG.colSlots).doc(id).set(novoSlot);
    } catch (e) {
      msgEl.textContent = 'Erro ao adicionar: ' + e.message;
      return;
    }
    S.slots.push({ id, ...novoSlot });
    S.slots.sort((a, b) => (a.diaOrdem - b.diaOrdem) || (a.horarioOrdem - b.horarioOrdem));
    toast('Horário adicionado!', 'success');
    renderConfigHorarios(el);
  }

  // ── init ─────────────────────────────────────────────────────
  function init(container) {
    if (!container) { console.warn('AgendamentoEntrevistas: container ausente.'); return; }
    S.root = container;
    injectStyles();

    if (typeof firebase === 'undefined' || !firebase.apps.length) {
      container.innerHTML = '<p class="dpae-empty">Firebase não inicializado. Recarregue a página.</p>';
      return;
    }
    S.db = firebase.firestore();
    S.storage = firebase.storage();

    if (!window.currentUser) {
      container.innerHTML = '<p class="dpae-empty">Sessão do Firebase não encontrada. Recarregue a página.</p>';
      return;
    }
    renderApp();
  }

  return { init, recarregar };
})();

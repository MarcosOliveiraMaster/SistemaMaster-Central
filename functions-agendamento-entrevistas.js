// ============================================================
// functions-agendamento-entrevistas.js
// Aba "Agendamento de Entrevistas" — Dashboard > Professores
// Módulo autocontido: conecta DIRETO no Supabase do formulário público
// (mastereducacao.app.br/entrevista, projeto NovaSelecao.MasterEdu) — não
// depende de Firebase. Chamado por functions-dashboardProfessor.js quando a
// aba "dp-tab-agendamento" é aberta pela 1ª vez: AgendamentoEntrevistas.init(container).
// ============================================================

window.AgendamentoEntrevistas = (function () {
  'use strict';

  const CFG = {
    diaLabel: {
      segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta',
      sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo',
    },
    diaOrdem: { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 7 },
    diaKeys: ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'],
  };

  const S = {
    root: null,
    sb: null,
    view: 'agendamentos',   // 'agendamentos' | 'horarios'
    modoAgenda: 'lista',    // 'lista' | 'calendario'
    slots: [],
    inscricoes: [],
    inscricaoSelecionada: null,
  };

  // ── Helpers ──────────────────────────────────────────────────
  function $q(sel) { return S.root ? S.root.querySelector(sel) : null; }
  function $qa(sel) { return S.root ? [...S.root.querySelectorAll(sel)] : []; }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, tipo) {
    if (typeof window.showToast === 'function') window.showToast(msg, tipo);
  }

  function confirmar({ titulo, corpo, onOk }) {
    const overlay = document.createElement('div');
    overlay.className = 'dp-popup-overlay';
    overlay.innerHTML =
      '<div class="dp-popup-box">' +
        '<h3>' + escapeHtml(titulo) + '</h3>' +
        '<p>' + corpo + '</p>' +
        '<div class="dp-popup-actions">' +
          '<button class="dp-btn dp-btn--ghost" data-acao="cancelar">Cancelar</button>' +
          '<button class="dp-btn dp-btn--danger" data-acao="ok">Confirmar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.dataset.acao === 'cancelar') { overlay.remove(); return; }
      if (e.target.dataset.acao === 'ok') { overlay.remove(); onOk(); }
    });
  }

  function formatarData(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso || ''; }
  }

  function formatarCPF(cpf) {
    if (!cpf || cpf.length !== 11) return cpf || '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function formatarTelefone(tel) {
    if (!tel) return '';
    const v = String(tel).replace(/\D/g, '');
    if (v.length === 11) return '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    if (v.length === 10) return '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
    // fallback defensivo: a coluna telefone tem CHECK ~ '^\d{10,11}$' no banco,
    // então isso não deveria ser alcançável com dado legítimo — mas escapa
    // mesmo assim, por precaução, já que o valor vai direto pro innerHTML.
    return escapeHtml(tel);
  }

  function parseHorarioOrdem(txt) {
    const m = /^(\d{1,2})h(\d{2})?$/.exec(txt);
    if (!m) return null;
    const hh = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0;
    if (hh > 23 || mm > 59) return null;
    return hh * 100 + mm;
  }

  // ── Estilos (namespace dpae-) ────────────────────────────────
  function injectStyles() {
    if (document.getElementById('dpae-styles')) return;
    const style = document.createElement('style');
    style.id = 'dpae-styles';
    style.textContent =
      '.dpae-wrap{display:flex;flex-direction:column;gap:1rem;}' +
      '.dpae-toolbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;}' +
      '.dpae-pill-toggle{display:inline-flex;background:var(--dp-gray-100,#f3f4f6);border-radius:999px;padding:3px;gap:2px;}' +
      '.dpae-pill-toggle button{border:none;background:transparent;padding:.4rem .9rem;border-radius:999px;font-family:"Comfortaa",cursive;font-size:.78rem;font-weight:600;cursor:pointer;color:var(--dp-gray-600,#4b5563);}' +
      '.dpae-pill-toggle button.active{background:var(--dp-orange,#f28705);color:#fff;}' +
      '.dpae-section-tabs{display:flex;gap:.5rem;border-bottom:1px solid var(--dp-gray-200,#e5e7eb);}' +
      '.dpae-section-tabs button{border:none;background:transparent;padding:.6rem 1rem;font-family:"Comfortaa",cursive;font-weight:700;font-size:.85rem;color:var(--dp-gray-600,#4b5563);cursor:pointer;border-bottom:2px solid transparent;}' +
      '.dpae-section-tabs button.active{color:var(--dp-orange,#f28705);border-color:var(--dp-orange,#f28705);}' +
      '.dpae-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:1rem;}' +
      '.dpae-list{display:flex;flex-direction:column;gap:.4rem;overflow-y:auto;max-height:62vh;}' +
      '.dpae-item{border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.6rem;padding:.6rem .8rem;cursor:pointer;transition:border-color .15s;}' +
      '.dpae-item:hover{border-color:var(--dp-orange,#f28705);}' +
      '.dpae-item.active{border-color:var(--dp-orange,#f28705);background:var(--dp-orange-light,#fef3e2);}' +
      '.dpae-item-nome{font-weight:700;font-size:.85rem;}' +
      '.dpae-item-meta{font-size:.72rem;color:var(--dp-gray-600,#4b5563);display:flex;justify-content:space-between;margin-top:.2rem;gap:.5rem;}' +
      '.dpae-detail{border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.6rem;padding:1rem;align-self:flex-start;}' +
      '.dpae-detail-row{display:flex;justify-content:space-between;gap:.5rem;padding:.35rem 0;border-bottom:1px dashed var(--dp-gray-200,#e5e7eb);font-size:.82rem;}' +
      '.dpae-detail-row span:first-child{color:var(--dp-gray-600,#4b5563);flex-shrink:0;}' +
      '.dpae-detail-row span:last-child{text-align:right;}' +
      '.dpae-empty{color:var(--dp-gray-600,#4b5563);font-size:.85rem;text-align:center;padding:2rem 0;}' +
      '.dpae-grid{display:grid;border:1px solid var(--dp-gray-200,#e5e7eb);border-radius:.6rem;overflow:hidden;}' +
      '.dpae-grid-cell{border:1px solid var(--dp-gray-200,#e5e7eb);padding:.5rem;font-size:.72rem;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.3rem;}' +
      '.dpae-grid-head{background:var(--dp-gray-50,#f9fafb);font-weight:700;}' +
      '.dpae-grid-cell--ocupado{background:var(--dp-orange-light,#fef3e2);cursor:pointer;font-weight:600;}' +
      '.dpae-grid-cell--livre{background:#f0fdf4;color:#16a34a;}' +
      '.dpae-grid-cell--inativo{background:var(--dp-gray-50,#f9fafb);color:var(--dp-gray-400,#9ca3af);}' +
      '.dpae-toggle{position:relative;width:38px;height:22px;border-radius:999px;background:var(--dp-gray-200,#e5e7eb);border:none;cursor:pointer;flex-shrink:0;}' +
      '.dpae-toggle::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s;}' +
      '.dpae-toggle.on{background:var(--dp-green,#16a34a);}' +
      '.dpae-toggle.on::after{transform:translateX(16px);}' +
      '.dpae-del-slot{border:none;background:none;color:var(--dp-red,#dc2626);font-size:.68rem;cursor:pointer;}' +
      '.dpae-add-form{display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap;margin-top:1rem;}' +
      '@media (max-width: 900px){.dpae-layout{grid-template-columns:1fr;}}';
    document.head.appendChild(style);
  }

  // ── Renderização ─────────────────────────────────────────────
  // Sem tela de login própria: quem chega até aqui já passou pelo login do
  // Firebase do próprio Central (AUTH.requireAuth(), ver auth.js). O Supabase
  // reconhece esse MESMO token via Third-Party Auth (accessToken em init()),
  // então não existe uma "segunda conta" — é o mesmo admin, uma sessão só.
  function renderApp() {
    const email = window.currentUser?.email || '';
    S.root.innerHTML =
      '<div class="dpae-wrap">' +
        '<div class="dpae-toolbar">' +
          '<div class="dpae-section-tabs">' +
            '<button data-secao="agendamentos" class="' + (S.view === 'agendamentos' ? 'active' : '') + '">📋 Entrevistas Agendadas</button>' +
            '<button data-secao="horarios" class="' + (S.view === 'horarios' ? 'active' : '') + '">⚙️ Configurar Horários</button>' +
          '</div>' +
          '<span style="font-size:.72rem;color:var(--dp-gray-600,#4b5563)">' + escapeHtml(email) + '</span>' +
        '</div>' +
        '<div id="dpae-content"><p class="dpae-empty">Carregando…</p></div>' +
      '</div>';

    $qa('.dpae-section-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        S.view = btn.dataset.secao;
        $qa('.dpae-section-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
        renderContent();
      });
    });

    carregarDados().then(renderContent);
  }

  async function carregarDados() {
    const [{ data: slots, error: errSlots }, { data: inscr, error: errInscr }] = await Promise.all([
      S.sb.from('slots_disponiveis').select('*').order('dia_ordem').order('horario_ordem'),
      S.sb.from('inscricoes').select('*'),
    ]);
    if (errSlots) { console.error('Erro ao carregar slots_disponiveis:', errSlots); toast('Erro ao carregar horários.', 'error'); }
    if (errInscr) { console.error('Erro ao carregar inscricoes:', errInscr); toast('Erro ao carregar entrevistas.', 'error'); }
    S.slots = slots || [];
    S.inscricoes = inscr || [];
  }

  function renderContent() {
    const el = $q('#dpae-content');
    if (!el) return;
    if (S.view === 'agendamentos') renderAgendamentos(el);
    else renderConfigHorarios(el);
  }

  // ── Bloco A: Entrevistas agendadas ───────────────────────────
  function renderAgendamentos(el) {
    el.innerHTML =
      '<div class="dpae-pill-toggle" style="margin-bottom:.8rem">' +
        '<button data-modo="lista" class="' + (S.modoAgenda === 'lista' ? 'active' : '') + '">Lista</button>' +
        '<button data-modo="calendario" class="' + (S.modoAgenda === 'calendario' ? 'active' : '') + '">Calendário</button>' +
      '</div>' +
      '<div id="dpae-agendaBody"></div>';

    el.querySelectorAll('.dpae-pill-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => { S.modoAgenda = btn.dataset.modo; renderAgendamentos(el); });
    });

    const body = el.querySelector('#dpae-agendaBody');
    if (S.modoAgenda === 'lista') renderAgendaLista(body); else renderAgendaCalendario(body);
  }

  function renderAgendaLista(body) {
    if (!S.inscricoes.length) { body.innerHTML = '<p class="dpae-empty">Nenhuma entrevista marcada ainda.</p>'; return; }

    const ordemDia = {};
    S.slots.forEach((s) => { ordemDia[s.dia_semana] = s.dia_ordem; });
    const lista = [...S.inscricoes].sort((a, b) => {
      const da = ordemDia[a.dia_semana] ?? 99, db = ordemDia[b.dia_semana] ?? 99;
      if (da !== db) return da - db;
      return (a.horario || '').localeCompare(b.horario || '');
    });

    body.innerHTML =
      '<div class="dpae-layout">' +
        '<div class="dpae-list" id="dpae-lista"></div>' +
        '<div class="dpae-detail" id="dpae-detalhe"><p class="dpae-empty">Selecione uma entrevista para ver os detalhes.</p></div>' +
      '</div>';

    const listaEl = body.querySelector('#dpae-lista');
    lista.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'dpae-item' + (S.inscricaoSelecionada?.id === item.id ? ' active' : '');
      div.innerHTML =
        '<div class="dpae-item-nome">' + escapeHtml(item.nome_completo) + '</div>' +
        '<div class="dpae-item-meta"><span>' + (CFG.diaLabel[item.dia_semana] || item.dia_semana) + ', ' + escapeHtml(item.horario) + '</span><span>' + formatarData(item.created_at) + '</span></div>';
      div.addEventListener('click', () => { S.inscricaoSelecionada = item; renderAgendaLista(body); });
      listaEl.appendChild(div);
    });

    if (S.inscricaoSelecionada) renderDetalheInscricao(body.querySelector('#dpae-detalhe'), S.inscricaoSelecionada);
  }

  function renderDetalheInscricao(el, item) {
    el.innerHTML =
      '<div class="dpae-detail-row"><span>Nome</span><span>' + escapeHtml(item.nome_completo) + '</span></div>' +
      '<div class="dpae-detail-row"><span>CPF</span><span>' + formatarCPF(item.cpf) + '</span></div>' +
      '<div class="dpae-detail-row"><span>E-mail</span><span>' + escapeHtml(item.email) + '</span></div>' +
      '<div class="dpae-detail-row"><span>Telefone</span><span>' + formatarTelefone(item.telefone) + '</span></div>' +
      '<div class="dpae-detail-row"><span>Dia / Horário</span><span>' + (CFG.diaLabel[item.dia_semana] || item.dia_semana) + ', ' + escapeHtml(item.horario) + '</span></div>' +
      '<div class="dpae-detail-row"><span>Inscrito em</span><span>' + formatarData(item.created_at) + '</span></div>' +
      '<div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">' +
        '<button class="dp-btn dp-btn--ghost dp-btn--sm" id="dpae-btnCopiarTel">📋 Copiar telefone</button>' +
        '<button class="dp-btn dp-btn--danger dp-btn--sm" id="dpae-btnCancelar">Cancelar entrevista</button>' +
      '</div>';

    el.querySelector('#dpae-btnCopiarTel').addEventListener('click', () => {
      navigator.clipboard.writeText(item.telefone || '').then(() => toast('Telefone copiado!', 'success'));
    });

    el.querySelector('#dpae-btnCancelar').addEventListener('click', () => {
      confirmar({
        titulo: 'Cancelar entrevista?',
        corpo: 'Isso remove a inscrição de <strong>' + escapeHtml(item.nome_completo) + '</strong> e libera o horário ' +
          escapeHtml(item.horario) + ' de ' + (CFG.diaLabel[item.dia_semana] || item.dia_semana) + ' para outra pessoa.',
        onOk: async () => {
          const { error } = await S.sb.from('inscricoes').delete().eq('id', item.id);
          if (error) { toast('Erro ao cancelar: ' + error.message, 'error'); return; }
          S.inscricoes = S.inscricoes.filter((i) => i.id !== item.id);
          S.inscricaoSelecionada = null;
          toast('Entrevista cancelada.', 'success');
          renderContent();
        },
      });
    });
  }

  function renderAgendaCalendario(body) {
    const ativos = S.slots.filter((s) => s.ativo);
    if (!ativos.length) { body.innerHTML = '<p class="dpae-empty">Nenhum horário ativo no catálogo.</p>'; return; }

    const dias = ordenarChaves(ativos, 'dia_semana', 'dia_ordem');
    const horarios = ordenarChaves(ativos, 'horario', 'horario_ordem');
    const ocupadoMap = new Map(S.inscricoes.map((i) => [i.dia_semana + '|' + i.horario, i]));
    const ativoSet = new Set(ativos.map((s) => s.dia_semana + '|' + s.horario));

    let html = '<div class="dpae-grid" style="grid-template-columns:90px repeat(' + dias.length + ',1fr)">';
    html += '<div class="dpae-grid-cell dpae-grid-head"></div>';
    dias.forEach((d) => { html += '<div class="dpae-grid-cell dpae-grid-head">' + (CFG.diaLabel[d] || d) + '</div>'; });
    horarios.forEach((h) => {
      html += '<div class="dpae-grid-cell dpae-grid-head">' + escapeHtml(h) + '</div>';
      dias.forEach((d) => {
        const key = d + '|' + h;
        if (!ativoSet.has(key)) { html += '<div class="dpae-grid-cell dpae-grid-cell--inativo">—</div>'; return; }
        const item = ocupadoMap.get(key);
        if (item) {
          html += '<div class="dpae-grid-cell dpae-grid-cell--ocupado" data-id="' + item.id + '">' + escapeHtml(item.nome_completo) + '</div>';
        } else {
          html += '<div class="dpae-grid-cell dpae-grid-cell--livre">Livre</div>';
        }
      });
    });
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('.dpae-grid-cell--ocupado').forEach((cell) => {
      cell.addEventListener('click', () => {
        const item = S.inscricoes.find((i) => i.id === cell.dataset.id);
        if (!item) return;
        S.inscricaoSelecionada = item;
        S.modoAgenda = 'lista';
        renderAgendamentos($q('#dpae-content'));
      });
    });
  }

  function ordenarChaves(slots, campoChave, campoOrdem) {
    const mapa = new Map();
    slots.forEach((s) => { if (!mapa.has(s[campoChave])) mapa.set(s[campoChave], s[campoOrdem]); });
    return [...mapa.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  }

  // ── Bloco B: Configurar horários ─────────────────────────────
  function renderConfigHorarios(el) {
    const dias = ordenarChaves(S.slots, 'dia_semana', 'dia_ordem');
    const horarios = ordenarChaves(S.slots, 'horario', 'horario_ordem');
    const slotMap = new Map(S.slots.map((s) => [s.dia_semana + '|' + s.horario, s]));

    let html = '<p style="font-size:.8rem;color:var(--dp-gray-600,#4b5563);margin-bottom:.8rem">' +
      'Toque no interruptor pra ativar/desativar um horário no formulário público. Horários inativos ' +
      'somem do formulário, mas continuam existindo (entrevistas já marcadas neles não são afetadas).</p>';

    if (!dias.length) {
      html += '<p class="dpae-empty">Nenhum horário cadastrado ainda.</p>';
    } else {
      html += '<div class="dpae-grid" style="grid-template-columns:90px repeat(' + dias.length + ',1fr)">';
      html += '<div class="dpae-grid-cell dpae-grid-head"></div>';
      dias.forEach((d) => { html += '<div class="dpae-grid-cell dpae-grid-head">' + (CFG.diaLabel[d] || d) + '</div>'; });
      horarios.forEach((h) => {
        html += '<div class="dpae-grid-cell dpae-grid-head">' + escapeHtml(h) + '</div>';
        dias.forEach((d) => {
          const slot = slotMap.get(d + '|' + h);
          if (!slot) { html += '<div class="dpae-grid-cell"></div>'; return; }
          html += '<div class="dpae-grid-cell">' +
            '<button class="dpae-toggle' + (slot.ativo ? ' on' : '') + '" data-dia="' + d + '" data-horario="' + escapeHtml(h) + '" title="' + (slot.ativo ? 'Ativo' : 'Inativo') + '"></button>' +
            '<button class="dpae-del-slot" data-dia="' + d + '" data-horario="' + escapeHtml(h) + '">Excluir</button>' +
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
      btn.addEventListener('click', () => toggleSlotAtivo(btn.dataset.dia, btn.dataset.horario, el));
    });
    el.querySelectorAll('.dpae-del-slot').forEach((btn) => {
      btn.addEventListener('click', () => excluirSlot(btn.dataset.dia, btn.dataset.horario, el));
    });
    el.querySelector('#dpae-btnAddHorario').addEventListener('click', () => adicionarHorario(el));
  }

  async function toggleSlotAtivo(dia, horario, el) {
    const slot = S.slots.find((s) => s.dia_semana === dia && s.horario === horario);
    if (!slot) return;
    const novoAtivo = !slot.ativo;
    slot.ativo = novoAtivo; // otimista
    renderConfigHorarios(el);

    const { error } = await S.sb.from('slots_disponiveis').update({ ativo: novoAtivo }).eq('dia_semana', dia).eq('horario', horario);
    if (error) {
      slot.ativo = !novoAtivo;
      renderConfigHorarios(el);
      toast('Erro ao atualizar: ' + error.message, 'error');
    } else {
      toast(novoAtivo ? 'Horário ativado.' : 'Horário desativado.', 'success');
    }
  }

  function excluirSlot(dia, horario, el) {
    confirmar({
      titulo: 'Excluir horário?',
      corpo: 'Remove ' + (CFG.diaLabel[dia] || dia) + ' ' + escapeHtml(horario) + ' do catálogo. Se já houver ' +
        'entrevistas marcadas nesse horário, não será possível excluir — desative em vez disso.',
      onOk: async () => {
        const { error } = await S.sb.from('slots_disponiveis').delete().eq('dia_semana', dia).eq('horario', horario);
        if (error) {
          toast('Não é possível remover — já existem entrevistas nesse horário. Desative em vez de remover.', 'error');
          return;
        }
        S.slots = S.slots.filter((s) => !(s.dia_semana === dia && s.horario === horario));
        toast('Horário removido.', 'success');
        renderConfigHorarios(el);
      },
    });
  }

  async function adicionarHorario(el) {
    const dia = el.querySelector('#dpae-novoDia').value;
    const horarioRaw = el.querySelector('#dpae-novoHorario').value.trim();
    const msgEl = el.querySelector('#dpae-addMsg');

    const ordem = parseHorarioOrdem(horarioRaw);
    if (ordem === null) { msgEl.textContent = 'Formato inválido. Use algo como "14h" ou "14h30".'; return; }
    if (S.slots.some((s) => s.dia_semana === dia && s.horario === horarioRaw)) {
      msgEl.textContent = 'Esse dia + horário já existe no catálogo.';
      return;
    }
    msgEl.textContent = '';

    const novoSlot = { dia_semana: dia, horario: horarioRaw, ativo: true, dia_ordem: CFG.diaOrdem[dia], horario_ordem: ordem };
    const { error } = await S.sb.from('slots_disponiveis').insert(novoSlot);
    if (error) { msgEl.textContent = 'Erro ao adicionar: ' + error.message; return; }

    S.slots.push(novoSlot);
    toast('Horário adicionado!', 'success');
    renderConfigHorarios(el);
  }

  // ── init ─────────────────────────────────────────────────────
  // Sem login próprio: o Supabase é configurado com accessToken = o ID token
  // do Firebase já autenticado pelo Central (window.currentUser, setado por
  // auth.js/AUTH.requireAuth()). O projeto Supabase precisa ter esse Firebase
  // (project id "master-ecossistemaprofessor") cadastrado como Third-Party
  // Auth — ver Authentication > Third-Party Auth no painel do Supabase.
  function init(container) {
    if (!container) { console.warn('AgendamentoEntrevistas: container ausente.'); return; }
    S.root = container;
    injectStyles();

    if (!S.sb) {
      if (typeof supabase === 'undefined') {
        container.innerHTML = '<p class="dpae-empty">Biblioteca Supabase (supabase-js) não carregada.</p>';
        return;
      }
      if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_PUBLISHABLE_KEY === 'undefined') {
        container.innerHTML = '<p class="dpae-empty">supabase-config.js não encontrado.</p>';
        return;
      }
      S.sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        accessToken: async () => {
          const user = window.currentUser;
          if (!user) return null;
          return (await user.getIdToken()) ?? null;
        },
      });
    }

    if (!window.currentUser) {
      container.innerHTML = '<p class="dpae-empty">Sessão do Firebase não encontrada. Recarregue a página.</p>';
      return;
    }
    renderApp();
  }

  return { init };
})();

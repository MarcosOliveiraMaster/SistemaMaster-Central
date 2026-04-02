// functions-pagamento.js — Área Pagamento

function loadAreaPagamento() {
  const section = document.getElementById('area-pagamento');
  if (!section) return;

  const anoAtual = new Date().getFullYear();

  section.innerHTML = `
    <div class="filter-container p-3" style="border-radius: var(--radius); box-shadow: var(--shadow);">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="filter-group" style="min-width:auto;">
          <label class="filter-label filter-label-compact">
            <i class="fas fa-calendar-alt mr-1 text-orange-400"></i>Mês de análise de pagamento
          </label>
          <select id="pag-mes" class="filter-select filter-compact">
            <option value="1">Janeiro</option>
            <option value="2">Fevereiro</option>
            <option value="3">Março</option>
            <option value="4">Abril</option>
            <option value="5">Maio</option>
            <option value="6">Junho</option>
            <option value="7">Julho</option>
            <option value="8">Agosto</option>
            <option value="9">Setembro</option>
            <option value="10">Outubro</option>
            <option value="11">Novembro</option>
            <option value="12">Dezembro</option>
          </select>
        </div>

        <div class="filter-group" style="min-width:auto;">
          <input id="pag-ano" type="text" class="filter-input filter-compact" value="${anoAtual}" style="width:80px;">
        </div>

        <button id="btn-analisar-pagamentos" class="btn-primary btn-compact" onclick="analisarPagamentos()">
          <i class="fas fa-search mr-2"></i>Analisar pagamentos
        </button>

        <!-- Separador vertical -->
        <div style="width:1px; height:32px; background:#d1d5db; align-self:flex-end; margin-bottom:4px;"></div>

        <!-- Toggle Individual / Coleção -->
        <div class="flex items-center gap-2" style="align-self:flex-end; padding-bottom:4px;">
          <span id="pag-label-individual" class="font-comfortaa text-xs font-bold text-orange-500" style="cursor:pointer;" onclick="setPagModo(false)">Individual</span>
          <div id="pag-toggle-modo" class="switch-toggle switch-inactive" style="cursor:pointer;" onclick="togglePagModo()">
            <div class="switch-slider"></div>
          </div>
          <span id="pag-label-colecao" class="font-comfortaa text-xs text-gray-400" style="cursor:pointer;" onclick="setPagModo(true)">Coleção</span>
        </div>

        <!-- Dropdown Professor / Equipe -->
        <div id="pag-professor-container" class="filter-group" style="flex:1; min-width:150px;">
          <label class="filter-label filter-label-compact">
            <i class="fas fa-user mr-1 text-orange-400"></i><span id="pag-professor-label">Professor</span>
          </label>
          <select id="pag-professor-select" class="filter-select filter-compact w-full">
            <option value="">Carregando...</option>
          </select>
        </div>
      </div>
    </div>
  `;

  // Seleciona o mês atual no dropdown
  const selectMes = document.getElementById('pag-mes');
  if (selectMes) {
    selectMes.value = String(new Date().getMonth() + 1);
  }

  // Estado inicial: Individual
  window._pagModoColecao = false;
  carregarProfessoresPagamento();
}

// ─── Toggle Individual / Coleção ───

function togglePagModo() {
  setPagModo(!window._pagModoColecao);
}

function setPagModo(colecao) {
  window._pagModoColecao = colecao;
  const toggle = document.getElementById('pag-toggle-modo');
  const labelInd = document.getElementById('pag-label-individual');
  const labelCol = document.getElementById('pag-label-colecao');
  const profLabel = document.getElementById('pag-professor-label');

  if (colecao) {
    toggle.className = 'switch-toggle switch-active';
    labelInd.className = 'font-comfortaa text-xs text-gray-400';
    labelInd.style.cursor = 'pointer';
    labelCol.className = 'font-comfortaa text-xs font-bold text-orange-500';
    labelCol.style.cursor = 'pointer';
    profLabel.textContent = 'Equipe';
  } else {
    toggle.className = 'switch-toggle switch-inactive';
    labelInd.className = 'font-comfortaa text-xs font-bold text-orange-500';
    labelInd.style.cursor = 'pointer';
    labelCol.className = 'font-comfortaa text-xs text-gray-400';
    labelCol.style.cursor = 'pointer';
    profLabel.textContent = 'Professor';
  }

  renderProfessorSelect(window._pagProfessoresAtivos || [], colecao);
}

// ─── Carregar Professores ───

async function carregarProfessoresPagamento() {
  try {
    const professores = await fetchDataBaseProfessores();
    const ativos = professores.filter(p => (p.status || '').toLowerCase() === 'ativo');
    ativos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    window._pagProfessoresAtivos = ativos;
    renderProfessorSelect(ativos, window._pagModoColecao);
  } catch (error) {
    console.error('Erro ao carregar professores para pagamento:', error);
    const select = document.getElementById('pag-professor-select');
    if (select) {
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }
}

function renderProfessorSelect(professores, modoColecao) {
  const container = document.getElementById('pag-professor-container');
  if (!container) return;

  const label = container.querySelector('label');
  const labelHTML = modoColecao
    ? '<i class="fas fa-users mr-1 text-orange-400"></i><span id="pag-professor-label">Equipe</span>'
    : '<i class="fas fa-user mr-1 text-orange-400"></i><span id="pag-professor-label">Professor</span>';
  label.innerHTML = labelHTML;
  label.className = 'filter-label filter-label-compact';

  if (modoColecao) {
    // Multi-select com checkboxes
    const oldSelect = container.querySelector('select');
    if (oldSelect) oldSelect.remove();
    const oldDiv = container.querySelector('.pag-multiselect');
    if (oldDiv) oldDiv.remove();

    let html = '<div class="pag-multiselect" style="position:relative;">';
    html += `<button type="button" id="pag-multi-btn" class="filter-select filter-compact w-full" style="text-align:left; cursor:pointer;" onclick="togglePagMultiMenu()">
      Selecione... <i class="fas fa-chevron-down" style="float:right; margin-top:3px; font-size:10px;"></i>
    </button>`;
    html += '<div id="pag-multi-menu" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:white; border:2px solid #e5e7eb; border-radius:var(--radius-sm); max-height:200px; overflow-y:auto; box-shadow:var(--shadow-sm);">';
    html += `<label style="display:flex; align-items:center; padding:6px 10px; cursor:pointer; border-bottom:1px solid #f3f4f6; font-weight:bold;" class="text-sm font-comfortaa">
      <input type="checkbox" value="todos" class="pag-multi-check mr-2" onchange="pagMultiCheckTodos(this)"> Todos
    </label>`;
    professores.forEach(p => {
      const nome = p.nome || 'Sem nome';
      html += `<label style="display:flex; align-items:center; padding:6px 10px; cursor:pointer;" class="text-sm font-comfortaa hover:bg-gray-50">
        <input type="checkbox" value="${p.id}" class="pag-multi-check mr-2" onchange="pagMultiCheckChanged()"> ${nome}
      </label>`;
    });
    html += '</div></div>';
    container.insertAdjacentHTML('beforeend', html);
  } else {
    // Single select
    const oldDiv = container.querySelector('.pag-multiselect');
    if (oldDiv) oldDiv.remove();
    let oldSelect = container.querySelector('select');
    if (!oldSelect) {
      container.insertAdjacentHTML('beforeend', '<select id="pag-professor-select" class="filter-select filter-compact w-full"></select>');
      oldSelect = container.querySelector('select');
    }
    oldSelect.id = 'pag-professor-select';
    let opts = '<option value="">Selecione...</option>';
    professores.forEach(p => {
      opts += `<option value="${p.id}">${p.nome || 'Sem nome'}</option>`;
    });
    oldSelect.innerHTML = opts;
  }
}

// ─── Multi-select helpers ───

function togglePagMultiMenu() {
  const menu = document.getElementById('pag-multi-menu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function pagMultiCheckTodos(el) {
  const checks = document.querySelectorAll('.pag-multi-check');
  checks.forEach(c => { c.checked = el.checked; });
  atualizarBtnMultiPag();
}

function pagMultiCheckChanged() {
  const checks = Array.from(document.querySelectorAll('.pag-multi-check'));
  const todos = checks.find(c => c.value === 'todos');
  const outros = checks.filter(c => c.value !== 'todos');
  if (todos) todos.checked = outros.every(c => c.checked);
  atualizarBtnMultiPag();
}

function atualizarBtnMultiPag() {
  const btn = document.getElementById('pag-multi-btn');
  if (!btn) return;
  const checks = Array.from(document.querySelectorAll('.pag-multi-check')).filter(c => c.value !== 'todos' && c.checked);
  if (checks.length === 0) {
    btn.innerHTML = 'Selecione... <i class="fas fa-chevron-down" style="float:right; margin-top:3px; font-size:10px;"></i>';
  } else if (checks.length === 1) {
    btn.innerHTML = checks[0].parentElement.textContent.trim() + ' <i class="fas fa-chevron-down" style="float:right; margin-top:3px; font-size:10px;"></i>';
  } else {
    btn.innerHTML = checks.length + ' selecionados <i class="fas fa-chevron-down" style="float:right; margin-top:3px; font-size:10px;"></i>';
  }
}

// Fecha multi-select ao clicar fora
document.addEventListener('click', function(e) {
  const menu = document.getElementById('pag-multi-menu');
  const btn = document.getElementById('pag-multi-btn');
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
  }
});

function analisarPagamentos() {
  const mes = document.getElementById('pag-mes')?.value;
  const ano = document.getElementById('pag-ano')?.value;
  if (!mes || !ano) return;
  console.log(`Analisando pagamentos: ${mes}/${ano}`);
  // TODO: implementar lógica de análise
}

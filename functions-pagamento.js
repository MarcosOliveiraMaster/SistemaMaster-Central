// functions-pagamento.js — Área Pagamento

function loadAreaPagamento() {
  const section = document.getElementById('area-pagamento');
  if (!section) return;

  const anoAtual = new Date().getFullYear();

  section.innerHTML = `
    <div class="filter-container p-3" style="border-radius: var(--radius); box-shadow: var(--shadow);">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="filter-group" style="min-width:auto;">
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

        <!-- Separador vertical -->
        <div style="width:1px; height:32px; background:#d1d5db; align-self:flex-end; margin-bottom:4px;"></div>

        <!-- Toggle Individual / Coleção -->
        <div class="flex items-center gap-2" style="align-self:flex-end; padding-bottom:4px;">
          <span id="pag-label-individual" class="font-comfortaa text-xs font-bold text-orange-500" style="cursor:pointer;" onclick="setPagModo(false)">Individual</span>
          <div id="pag-toggle-modo" class="switch-toggle switch-inactive" style="cursor:pointer;" onclick="togglePagModo()">
            <div class="switch-slider"></div>
          </div>
          <span id="pag-label-colecao" class="font-comfortaa text-xs text-gray-400" style="cursor:pointer;" onclick="setPagModo(true)">Grupo</span>
        </div>

        <!-- Dropdown Professor / Equipe -->
        <div id="pag-professor-container" class="filter-group" style="flex:1; min-width:150px;">
          <select id="pag-professor-select" class="filter-select filter-compact w-full">
            <option value="">Carregando...</option>
          </select>
        </div>

        <!-- Separador vertical -->
        <div style="width:1px; height:32px; background:#d1d5db; align-self:flex-end; margin-bottom:4px;"></div>

        <button id="btn-analisar-pagamentos" class="btn-primary btn-compact" onclick="analisarPagamentos()">
          <i class="fas fa-search mr-2"></i>Analisar pagamentos
        </button>
      </div>
    </div>

    <!-- Seção Individual -->
    <div id="pag-secao-individual" style="opacity:1; transition: opacity 0.3s ease;">
      <h3 class="font-lexend text-lg font-bold text-gray-800 mt-5 mb-3">
        <i class="fas fa-user mr-2 text-orange-500"></i>Relatório Individual
      </h3>

      <div class="table-container-double-scroll">
        <div class="table-wrapper" style="max-height:400px; min-height:400px;">
          <table class="table-details" id="tabela-pagamento-individual" style="min-width:600px; table-layout:fixed;">
            <colgroup>
              <col style="width:150px;">
              <col style="width:150px;">
              <col>
              <col style="width:120px;">
              <col style="width:130px;">
            </colgroup>
            <thead>
              <tr>
                <th>Data da Aula</th>
                <th>Contratação</th>
                <th>Nome Cliente</th>
                <th>Duração</th>
                <th>Valor da Aula</th>
              </tr>
            </thead>
            <tbody id="tbody-pagamento-individual">
              <tr>
                <td colspan="5" class="text-center py-8 text-gray-400 font-comfortaa text-sm">
                  Selecione um professor e clique em <strong>Analisar pagamentos</strong>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex gap-4 mt-4">
        <div style="flex: 7; display:flex; flex-direction:column; gap:8px;">
          <h4 class="font-lexend text-md font-bold text-gray-800">
            <i class="fas fa-info-circle mr-2 text-orange-500"></i>Informações adicionais
          </h4>
          <div id="informacoesAdicionais" class="bg-white rounded-lg border border-gray-200 p-4" style="flex:1; display:flex; flex-direction:column;">
            <div style="display:grid; grid-template-columns:1fr 130px 130px 110px 40px; gap:8px; align-items:center; margin-bottom:8px;">
              <span class="font-lexend text-xs font-bold text-gray-600">Descrição</span>
              <span class="font-lexend text-xs font-bold text-gray-600">Data</span>
              <span class="font-lexend text-xs font-bold text-gray-600">Valor</span>
              <span class="font-lexend text-xs font-bold text-gray-600">Tipo</span>
              <span></span>
            </div>
            <div id="info-adicional-rows" style="flex:1; max-height:120px; overflow-y:auto;"></div>
            <div style="display:flex; justify-content:flex-end; margin-top:auto; padding-top:10px;">
              <button id="addInformacao" class="btn-primary btn-compact" type="button" onclick="adicionarInfoAdicional()">
                <i class="fas fa-plus mr-2"></i>Adicionar informação
              </button>
            </div>
          </div>
        </div>
        <div style="flex: 3; display:flex; flex-direction:column; gap:8px;">
          <h4 class="font-lexend text-md font-bold text-gray-800">
            <i class="fas fa-file-invoice-dollar mr-2 text-orange-500"></i>Resumo de Pagamento
          </h4>
          <div id="resumoPagamento" class="bg-white rounded-lg border border-gray-200 p-4" style="flex:1; display:flex; flex-direction:column;">
            <div id="resumo-conteudo" style="flex:1;">
              <p class="text-center text-gray-400 font-comfortaa text-sm py-4">Clique em <strong>Analisar pagamentos</strong> para ver o resumo.</p>
            </div>
            <div style="margin-top:auto; padding-top:10px; text-align:center;">
              <button id="btn-gerar-relatorio" class="btn-primary btn-compact" type="button" onclick="gerarRelatorioPagamento()" style="display:none;">
                <i class="fas fa-file-alt mr-2"></i>Gerar relatório de pagamento
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Seção Grupo -->
    <div id="pag-secao-grupo" style="opacity:0; display:none; transition: opacity 0.3s ease;">
      <h3 class="font-lexend text-lg font-bold text-gray-800 mt-5 mb-3">
        <i class="fas fa-users mr-2 text-orange-500"></i>Relatório em Grupo
      </h3>
    </div>
  `;

  // Seleciona o mês anterior no dropdown (se janeiro, volta pra dezembro do ano anterior)
  const selectMes = document.getElementById('pag-mes');
  const inputAnoEl = document.getElementById('pag-ano');
  const mesAtual = new Date().getMonth() + 1; // 1-12
  if (selectMes) {
    if (mesAtual === 1) {
      selectMes.value = '12';
      if (inputAnoEl) inputAnoEl.value = String(anoAtual - 1);
    } else {
      selectMes.value = String(mesAtual - 1);
    }
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
  if (colecao) {
    toggle.className = 'switch-toggle switch-active';
    labelInd.className = 'font-comfortaa text-xs text-gray-400';
    labelInd.style.cursor = 'pointer';
    labelCol.className = 'font-comfortaa text-xs font-bold text-orange-500';
    labelCol.style.cursor = 'pointer';
  } else {
    toggle.className = 'switch-toggle switch-inactive';
    labelInd.className = 'font-comfortaa text-xs font-bold text-orange-500';
    labelInd.style.cursor = 'pointer';
    labelCol.className = 'font-comfortaa text-xs text-gray-400';
    labelCol.style.cursor = 'pointer';
  }

  renderProfessorSelect(window._pagProfessoresFiltrados || window._pagProfessoresAtivos || [], colecao);
  alternarSecoesPagamento(colecao);
}

// ─── Carregar Professores ───

async function carregarProfessoresPagamento() {
  try {
    const [professores, todasAulas] = await Promise.all([
      fetchDataBaseProfessores(),
      fetchBancoDeAulasListaBatch()
    ]);
    const ativos = professores.filter(p => (p.status || '').toLowerCase() === 'ativo');
    ativos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    window._pagProfessoresAtivos = ativos;
    window._pagTodasAulas = todasAulas || [];
    filtrarProfessoresPorMesAno();

    // Listeners para atualizar ao trocar mês/ano
    const selectMes = document.getElementById('pag-mes');
    const inputAno = document.getElementById('pag-ano');
    if (selectMes) selectMes.addEventListener('change', filtrarProfessoresPorMesAno);
    if (inputAno) inputAno.addEventListener('input', filtrarProfessoresPorMesAno);
  } catch (error) {
    console.error('Erro ao carregar professores para pagamento:', error);
    const select = document.getElementById('pag-professor-select');
    if (select) {
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }
}

// ─── Filtrar professores que tiveram aula no mês/ano selecionado ───

function filtrarProfessoresPorMesAno() {
  const mes = parseInt(document.getElementById('pag-mes')?.value);
  const ano = parseInt(document.getElementById('pag-ano')?.value);
  const ativos = window._pagProfessoresAtivos || [];
  const todasAulas = window._pagTodasAulas || [];

  if (!mes || !ano) {
    window._pagProfessoresFiltrados = ativos;
    renderProfessorSelect(ativos, window._pagModoColecao);
    return;
  }

  // Filtrar aulas pelo mês/ano — formato do campo data: "seg - 23/02/2026"
  const idsProfessoresComAula = new Set();
  todasAulas.forEach(aula => {
    const data = aula.data || '';
    const match = data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return;
    const mesAula = parseInt(match[2], 10);
    const anoAula = parseInt(match[3], 10);
    if (mesAula === mes && anoAula === ano && aula.idProfessor) {
      idsProfessoresComAula.add(aula.idProfessor);
    }
  });

  // Manter apenas professores ativos que tiveram aula no período
  const filtrados = ativos.filter(p => idsProfessoresComAula.has(p.cpf));
  window._pagProfessoresFiltrados = filtrados;
  renderProfessorSelect(filtrados, window._pagModoColecao);
}

function renderProfessorSelect(professores, modoColecao) {
  const container = document.getElementById('pag-professor-container');
  if (!container) return;

  if (modoColecao) {
    // Multi-select com checkboxes
    const oldSelect = container.querySelector('select');
    if (oldSelect) oldSelect.remove();
    const oldDiv = container.querySelector('.pag-multiselect');
    if (oldDiv) oldDiv.remove();

    let html = '<div class="pag-multiselect" style="position:relative;">';
    html += `<button type="button" id="pag-multi-btn" class="filter-select filter-compact w-full" style="text-align:left; cursor:pointer;" onclick="togglePagMultiMenu()">
      Emitir o relatório em grupo... <i class="fas fa-chevron-down" style="float:right; margin-top:3px; font-size:10px;"></i>
    </button>`;
    html += '<div id="pag-multi-menu" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:50; background:white; border:2px solid #e5e7eb; border-radius:var(--radius-sm); max-height:200px; overflow-y:auto; box-shadow:var(--shadow-sm);">';
    html += `<label style="display:flex; align-items:center; padding:6px 10px; cursor:pointer; border-bottom:1px solid #f3f4f6; font-weight:bold;" class="text-sm font-comfortaa">
      <input type="checkbox" value="todos" class="pag-multi-check mr-2" onchange="pagMultiCheckTodos(this)"> Todos
    </label>`;
    professores.forEach(p => {
      const nome = p.nome || 'Sem nome';
      html += `<label style="display:flex; align-items:center; padding:6px 10px; cursor:pointer;" class="text-sm font-comfortaa hover:bg-gray-50">
        <input type="checkbox" value="${p.cpf}" class="pag-multi-check mr-2" onchange="pagMultiCheckChanged()"> ${nome}
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
    let opts = '<option value="">Selecione um professor...</option>';
    professores.forEach(p => {
      opts += `<option value="${p.cpf}">${p.nome || 'Sem nome'}</option>`;
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

// ─── Abrir detalhes da contratação a partir da tabela de pagamento ───

async function abrirDetalhesContratacaoPagamento(codigoContratacao) {
  if (!codigoContratacao) {
    showToast('Código de contratação não encontrado.', 'error');
    return;
  }

  try {
    showToast('Carregando detalhes...', 'info');
    const docSnap = await db.collection('BancoDeAulas').doc(codigoContratacao).get();

    if (!docSnap.exists) {
      showToast('Contratação não encontrada no banco de dados.', 'error');
      return;
    }

    const aula = { id: docSnap.id, ...docSnap.data() };

    if (window.BancoDeAulasCards && typeof window.BancoDeAulasCards.viewAulaDetails === 'function') {
      window.BancoDeAulasCards.viewAulaDetails(aula);
    } else {
      showToast('Módulo de detalhes não carregado.', 'error');
    }
  } catch (error) {
    console.error('Erro ao buscar contratação:', error);
    showToast('Erro ao carregar detalhes da contratação.', 'error');
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

// ─── Alternar seções Individual / Grupo ───

function alternarSecoesPagamento(colecao) {
  const secIndividual = document.getElementById('pag-secao-individual');
  const secGrupo = document.getElementById('pag-secao-grupo');
  if (!secIndividual || !secGrupo) return;

  const mostrar = colecao ? secGrupo : secIndividual;
  const esconder = colecao ? secIndividual : secGrupo;

  // Fade out da seção atual
  esconder.style.opacity = '0';
  setTimeout(() => {
    esconder.style.display = 'none';
    // Fade in da nova seção
    mostrar.style.display = '';
    requestAnimationFrame(() => {
      mostrar.style.opacity = '1';
    });
  }, 300);
}

// ─── Informações Adicionais: adicionar/remover/salvar linhas ───

let _infoAdicionalCounter = 0;

function adicionarInfoAdicional() {
  const professorId = document.getElementById('pag-professor-select')?.value;
  if (!professorId) {
    showToast('Selecione um professor antes de adicionar informações.', 'error');
    return;
  }

  const container = document.getElementById('info-adicional-rows');
  if (!container) return;
  _infoAdicionalCounter++;
  const id = _infoAdicionalCounter;
  const row = document.createElement('div');
  row.id = 'info-row-' + id;
  row.dataset.modo = 'novo';
  row.style.cssText = 'display:grid; grid-template-columns:1fr 130px 130px 110px 40px; gap:8px; align-items:center; margin-bottom:6px;';
  row.innerHTML = `
    <input type="text" class="filter-input filter-compact font-comfortaa" placeholder="Descrição..." style="width:100%;">
    <input type="text" class="filter-input filter-compact font-comfortaa" placeholder="dd/mm/aaaa" maxlength="10" oninput="mascaraDataInfoAdicional(this)" style="width:100%;">
    <input type="text" class="filter-input filter-compact font-comfortaa" placeholder="R$ 0,00" oninput="mascaraValorInfoAdicional(this)" style="width:100%;">
    <select class="filter-select filter-compact font-comfortaa" style="width:100%;" onchange="atualizarCorBordaInfoAdicional(this)">
      <option value="entrada">Entrada</option>
      <option value="saida">Saída</option>
    </select>
    <button type="button" onclick="salvarInfoAdicional(${id})" style="background:none; border:none; cursor:pointer; color:#22c55e; font-size:16px;" title="Salvar">
      <i class="fas fa-check-circle"></i>
    </button>
  `;
  container.appendChild(row);
  const select = row.querySelector('select');
  if (select) atualizarCorBordaInfoAdicional(select);
}

async function salvarInfoAdicional(id) {
  const row = document.getElementById('info-row-' + id);
  if (!row) return;

  const inputs = row.querySelectorAll('input');
  const select = row.querySelector('select');
  const descricao = (inputs[0]?.value || '').trim();
  const data = (inputs[1]?.value || '').trim();
  const valorStr = (inputs[2]?.value || '').replace(/[^\d,]/g, '').replace(',', '.');
  const valor = parseFloat(valorStr) || 0;
  const tipo = select?.value || 'entrada';

  if (!descricao) {
    showToast('Preencha a descrição.', 'error');
    inputs[0].focus();
    return;
  }

  const professorId = document.getElementById('pag-professor-select')?.value;
  if (!professorId) {
    showToast('Nenhum professor selecionado.', 'error');
    return;
  }

  const mes = document.getElementById('pag-mes')?.value || '';
  const ano = document.getElementById('pag-ano')?.value || '';

  // Buscar uid do professor para regras de segurança
  const professor = (window._pagProfessoresAtivos || []).find(p => p.cpf === professorId);
  const uidProfessor = professor?.uid || '';

  try {
    const docId = professorId + '_' + mes + '-' + ano + '_' + Date.now();
    await db.collection('informacoesPagamento').doc(docId).set({
      descricao,
      data,
      valor,
      tipo,
      idProfessor: professorId,
      uidProfessor,
      mes: parseInt(mes, 10),
      ano: parseInt(ano, 10)
    });

    row.dataset.modo = 'salvo';
    row.dataset.docId = docId;

    // Trocar botão para lixeira e adicionar auto-save nos campos
    const btn = row.querySelector('button');
    btn.onclick = () => confirmarRemoverInfoAdicional(id);
    btn.style.color = '#ef4444';
    btn.title = 'Remover';
    btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    registrarAutoSaveInfoAdicional(row);

    showToast('Informação salva com sucesso!', 'success');
    atualizarResumoSeNecessario();
  } catch (error) {
    console.error('Erro ao salvar informação adicional:', error);
    showToast('Erro ao salvar informação.', 'error');
  }
}

function renderInfoAdicionalSalva(doc) {
  const container = document.getElementById('info-adicional-rows');
  if (!container) return;
  _infoAdicionalCounter++;
  const id = _infoAdicionalCounter;
  const d = doc.data ? doc.data() : doc;
  const docId = doc.id || doc.docId;
  const cor = d.tipo === 'entrada' ? '#22c55e' : '#ef4444';
  const valorFmt = 'R$ ' + (d.valor || 0).toFixed(2).replace('.', ',');

  const row = document.createElement('div');
  row.id = 'info-row-' + id;
  row.dataset.modo = 'salvo';
  row.dataset.docId = docId;
  row.style.cssText = 'display:grid; grid-template-columns:1fr 130px 130px 110px 40px; gap:8px; align-items:center; margin-bottom:6px;';
  row.innerHTML = `
    <input type="text" class="filter-input filter-compact font-comfortaa" value="${d.descricao || ''}" style="width:100%; border-color:${cor};">
    <input type="text" class="filter-input filter-compact font-comfortaa" value="${d.data || ''}" maxlength="10" oninput="mascaraDataInfoAdicional(this)" style="width:100%; border-color:${cor};">
    <input type="text" class="filter-input filter-compact font-comfortaa" value="${valorFmt}" oninput="mascaraValorInfoAdicional(this)" style="width:100%; border-color:${cor};">
    <select class="filter-select filter-compact font-comfortaa" onchange="atualizarCorBordaInfoAdicional(this)" style="width:100%; border-color:${cor};">
      <option value="entrada" ${d.tipo === 'entrada' ? 'selected' : ''}>Entrada</option>
      <option value="saida" ${d.tipo !== 'entrada' ? 'selected' : ''}>Saída</option>
    </select>
    <button type="button" onclick="confirmarRemoverInfoAdicional(${id})" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:16px;" title="Remover">
      <i class="fas fa-trash-alt"></i>
    </button>
  `;
  container.appendChild(row);
  registrarAutoSaveInfoAdicional(row);
}

function registrarAutoSaveInfoAdicional(row) {
  const trocarParaCheck = () => {
    const btn = row.querySelector('button');
    if (!btn || row.dataset.editando === '1') return;
    row.dataset.editando = '1';
    const rowId = row.id.replace('info-row-', '');
    btn.style.color = '#22c55e';
    btn.title = 'Salvar alteração';
    btn.innerHTML = '<i class="fas fa-check-circle"></i>';
    btn.onclick = () => confirmarEdicaoInfoAdicional(parseInt(rowId));
  };

  row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', trocarParaCheck));
  row.querySelector('select').addEventListener('change', () => {
    atualizarCorBordaInfoAdicional(row.querySelector('select'));
    trocarParaCheck();
  });
}

async function confirmarEdicaoInfoAdicional(id) {
  const row = document.getElementById('info-row-' + id);
  if (!row) return;
  const docId = row.dataset.docId;
  if (!docId || row.dataset.modo !== 'salvo') return;

  const inputs = row.querySelectorAll('input');
  const select = row.querySelector('select');
  const descricao = (inputs[0]?.value || '').trim();
  const data = (inputs[1]?.value || '').trim();
  const valorStr = (inputs[2]?.value || '').replace(/[^\d,]/g, '').replace(',', '.');
  const valor = parseFloat(valorStr) || 0;
  const tipo = select?.value || 'entrada';

  try {
    await db.collection('informacoesPagamento').doc(docId).update({
      descricao, data, valor, tipo
    });

    // Voltar para lixeira
    row.dataset.editando = '0';
    const btn = row.querySelector('button');
    btn.style.color = '#ef4444';
    btn.title = 'Remover';
    btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    btn.onclick = () => confirmarRemoverInfoAdicional(id);

    showToast('Alteração salva com sucesso!', 'success');
    atualizarResumoSeNecessario();
  } catch (error) {
    console.error('Erro ao atualizar informação adicional:', error);
    showToast('Erro ao atualizar informação.', 'error');
  }
}

function confirmarRemoverInfoAdicional(id) {
  const row = document.getElementById('info-row-' + id);
  if (!row) return;
  const docId = row.dataset.docId;
  if (!docId) { row.remove(); return; }

  const { modal, closeModal } = createModal(
    'Certeza que gostaria de excluir?',
    `<div class="p-4">
      <p class="text-sm text-gray-600">
        <i class="fas fa-exclamation-triangle text-orange-500 mr-2"></i>
        Uma vez apagada, a informação não poderá ser restaurada.
      </p>
    </div>`,
    [
      { text: 'Cancelar', classes: 'btn-secondary btn-compact', attributes: 'id="btn-cancelar-excluir-info"' },
      { text: 'Excluir', classes: 'btn-primary btn-compact', attributes: 'id="btn-confirmar-excluir-info" style="background:#ef4444; border-color:#ef4444;"' }
    ]
  );

  modal.querySelector('#btn-cancelar-excluir-info').addEventListener('click', closeModal);
  modal.querySelector('#btn-confirmar-excluir-info').addEventListener('click', async () => {
    closeModal();
    try {
      await db.collection('informacoesPagamento').doc(docId).delete();
      row.remove();
      showToast('Informação excluída com sucesso.', 'success');
      atualizarResumoSeNecessario();
    } catch (error) {
      console.error('Erro ao excluir informação adicional:', error);
      showToast('Erro ao excluir informação.', 'error');
    }
  });
}

async function carregarInfoAdicionaisDoFirebase(professorId, mes, ano) {
  const container = document.getElementById('info-adicional-rows');
  if (!container) return;
  container.innerHTML = '';

  try {
    const snapshot = await db.collection('informacoesPagamento')
      .where('idProfessor', '==', professorId)
      .where('mes', '==', mes)
      .where('ano', '==', ano)
      .get();

    snapshot.forEach(doc => {
      renderInfoAdicionalSalva(doc);
    });
  } catch (error) {
    console.error('Erro ao carregar informações adicionais:', error);
  }
}

function atualizarResumoSeNecessario() {
  if (typeof window._pagUltimoTotalValor !== 'undefined') {
    atualizarResumoPagamento(window._pagUltimoTotalValor);
  }
}

function atualizarCorBordaInfoAdicional(select) {
  const row = select.closest('[id^="info-row-"]');
  if (!row) return;
  const cor = select.value === 'entrada' ? '#22c55e' : '#ef4444';
  row.querySelectorAll('input, select').forEach(el => {
    el.style.borderColor = cor;
  });
}

function mascaraDataInfoAdicional(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 8);
  if (v.length > 4) v = v.substring(0, 2) + '/' + v.substring(2, 4) + '/' + v.substring(4);
  else if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
  input.value = v;
}

function calcularInfoAdicionais() {
  let entradas = 0;
  let saidas = 0;
  const rows = document.querySelectorAll('[id^="info-row-"]');
  rows.forEach(row => {
    // Só contar rows já salvas
    if (row.dataset.modo !== 'salvo') return;
    const select = row.querySelector('select');
    const inputValor = row.querySelectorAll('input')[2];
    if (!select || !inputValor) return;
    const valorStr = (inputValor.value || '').replace(/[^\d,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr) || 0;
    if (select.value === 'entrada') entradas += valor;
    else saidas += valor;
  });
  return { entradas, saidas };
}

function atualizarResumoPagamento(valorReceber) {
  const conteudo = document.getElementById('resumo-conteudo');
  const btnRelatorio = document.getElementById('btn-gerar-relatorio');
  if (!conteudo) return;

  const { entradas, saidas } = calcularInfoAdicionais();
  const total = valorReceber + entradas - saidas;

  const fmt = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');

  conteudo.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="font-comfortaa text-sm text-gray-600">Valor à receber:</span>
        <span class="font-lexend text-sm font-bold text-gray-800">${fmt(valorReceber)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="font-comfortaa text-sm text-gray-600">Entradas:</span>
        <span class="font-lexend text-sm font-bold text-green-600">+ ${fmt(entradas)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="font-comfortaa text-sm text-gray-600">Saídas:</span>
        <span class="font-lexend text-sm font-bold text-red-500">- ${fmt(saidas)}</span>
      </div>
      <hr style="border-top:1px solid #e5e7eb;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="font-lexend text-sm font-bold text-gray-800">Total:</span>
        <span class="font-lexend text-md font-bold ${total >= 0 ? 'text-green-600' : 'text-red-500'}">${fmt(total)}</span>
      </div>
    </div>
  `;

  if (btnRelatorio) btnRelatorio.style.display = '';
}

function gerarRelatorioPagamento() {
  const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginLeft = 56;
  const marginRight = 56;
  const marginTop = 40;
  const marginBottom = 56;
  const usableWidth = pageWidth - marginLeft - marginRight;

  // ─── Coletar nome do professor e período ───
  const professor = (window._pagProfessoresAtivos || []).find(p => p.cpf === (document.getElementById('pag-professor-select')?.value || ''));
  const nomeProfessor = professor?.nome || 'Professor';
  const mes = parseInt(document.getElementById('pag-mes')?.value) || 1;
  const ano = parseInt(document.getElementById('pag-ano')?.value) || new Date().getFullYear();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const nomeMes = meses[mes - 1] || '';

  // ─── Coletar dados da tabela Individual ───
  const linhasIndividual = [];
  const rows = document.querySelectorAll('#tbody-pagamento-individual tr');
  rows.forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (cells.length >= 5) {
      const data = (cells[0]?.innerText || '').trim();
      const cliente = (cells[2]?.innerText || '').trim();
      const duracao = (cells[3]?.innerText || '').trim();
      const valorStr = (cells[4]?.innerText || '').replace('R$', '').trim().replace(',', '.');
      const valor = parseFloat(valorStr) || 0;
      linhasIndividual.push({ data, descricao: cliente, duracao, valor, tipo: 'entrada' });
    }
  });

  // ─── Helper: converter data para formato "ddd - dd/mm/yyyy" ───
  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const formatarDataCompleta = (d) => {
    // Já está no formato "ddd - dd/mm/yyyy"
    if (/^[a-záéíóúâêôã]{3}\s*-\s*\d{2}\/\d{2}\/\d{4}$/i.test(d)) return d;
    // Formato "dd/mm/yyyy" → converter para "ddd - dd/mm/yyyy"
    const match = (d || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const dt = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      const dia = diasSemana[dt.getDay()] || '';
      return `${dia} - ${match[1]}/${match[2]}/${match[3]}`;
    }
    return d || '—';
  };

  // ─── Coletar dados de Informações Adicionais (salvas) ───
  const linhasAdicionais = [];
  const infoRows = document.querySelectorAll('[id^="info-row-"]');
  infoRows.forEach(row => {
    if (row.dataset.modo !== 'salvo') return;
    const inputs = row.querySelectorAll('input');
    const select = row.querySelector('select');
    const descricao = (inputs[0]?.value || '').trim();
    const data = (inputs[1]?.value || '').trim();
    const valorStr = (inputs[2]?.value || '').replace(/[^\d,]/g, '').replace(',', '.');
    const valor = parseFloat(valorStr) || 0;
    const tipo = select?.value || 'entrada';
    linhasAdicionais.push({ data, descricao, duracao: '', valor, tipo });
  });

  // ─── Juntar todas as linhas e formatar datas ───
  const todasLinhas = [...linhasIndividual, ...linhasAdicionais];
  todasLinhas.forEach(l => { l.data = formatarDataCompleta(l.data); });

  // ─── Ordenar por data crescente ───
  todasLinhas.sort((a, b) => {
    const parseData = (d) => {
      const match = (d || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return 0;
      return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])).getTime();
    };
    return parseData(a.data) - parseData(b.data);
  });

  let y = marginTop;

  // ─── Logo centralizada ───
  const renderPDF = (logoImg) => {
    if (logoImg) {
      const logoWidth = 120;
      const proporcao = logoImg.naturalHeight / logoImg.naturalWidth;
      const logoHeight = logoWidth * proporcao;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(logoImg, 'PNG', logoX, y, logoWidth, logoHeight);
      y += logoHeight + 8;
    }

    // ─── "Master Educação" ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('Master Educação', pageWidth / 2, y, { align: 'center' });
    y += 20;

    // ─── Linha divisória ───
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(1);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 20;

    // ─── Título ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text('Relatório de Pagamento', pageWidth / 2, y, { align: 'center' });
    y += 14;

    // ─── Subtítulo: professor + período ───
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`${nomeProfessor} — ${nomeMes}/${ano}`, pageWidth / 2, y, { align: 'center' });
    y += 24;

    // ─── Tabela ───
    const colWidths = [80, usableWidth - 80 - 60 - 90 - 10, 60, 90];
    // Ajuste mínimo para garantir que soma bate
    const headers = ['Data', 'Cliente / Descrição', 'Duração', 'Valor'];
    const cellHeight = 20;
    const fontSize = 9;
    const headerFontSize = 9;

    // Cabeçalho da tabela
    let x = marginLeft;
    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => {
      doc.setFillColor(234, 88, 12);
      doc.setDrawColor(200, 200, 200);
      doc.rect(x, y, colWidths[i], cellHeight, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.text(h, x + 5, y + 14);
      x += colWidths[i];
    });
    y += cellHeight;

    // Linhas de dados
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    let totalGeral = 0;

    todasLinhas.forEach((linha, idx) => {
      // Quebra de página se necessário
      if (y + cellHeight > pageHeight - marginBottom - 40) {
        doc.addPage();
        y = marginTop;
        // Re-desenhar cabeçalho na nova página
        let xh = marginLeft;
        doc.setFontSize(headerFontSize);
        doc.setFont('helvetica', 'bold');
        headers.forEach((h, i) => {
          doc.setFillColor(234, 88, 12);
          doc.setDrawColor(200, 200, 200);
          doc.rect(xh, y, colWidths[i], cellHeight, 'FD');
          doc.setTextColor(255, 255, 255);
          doc.text(h, xh + 5, y + 14);
          xh += colWidths[i];
        });
        y += cellHeight;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
      }

      const isSaida = linha.tipo === 'saida';
      const valorExibido = isSaida ? -linha.valor : linha.valor;
      totalGeral += valorExibido;

      const valorFmt = (isSaida ? '- R$ ' : 'R$ ') + Math.abs(linha.valor).toFixed(2).replace('.', ',');

      // Fundo alternado
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(marginLeft, y, usableWidth, cellHeight, 'F');
      }

      x = marginLeft;
      const valores = [
        linha.data || '—',
        linha.descricao || '—',
        linha.duracao || '',
        valorFmt
      ];

      valores.forEach((val, i) => {
        doc.setDrawColor(230, 230, 230);
        doc.rect(x, y, colWidths[i], cellHeight, 'D');

        // Valor em vermelho se saída
        if (i === 3 && isSaida) {
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setTextColor(50, 50, 50);
        }

        // Truncar texto se muito longo para a coluna
        let textoFinal = val;
        const maxTextWidth = colWidths[i] - 10;
        if (doc.getTextWidth(textoFinal) > maxTextWidth) {
          while (doc.getTextWidth(textoFinal + '…') > maxTextWidth && textoFinal.length > 0) {
            textoFinal = textoFinal.slice(0, -1);
          }
          textoFinal += '…';
        }

        doc.text(textoFinal, x + 5, y + 14);
        x += colWidths[i];
      });
      y += cellHeight;
    });

    // ─── Linha de total ───
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const totalFmt = 'R$ ' + totalGeral.toFixed(2).replace('.', ',');
    // Alinha "Total:" à esquerda e o valor à direita da tabela
    doc.text('Total:', marginLeft, y + 14);
    doc.text(totalFmt, pageWidth - marginRight - 5, y + 14, { align: 'right' });
    y += 28;

    // ─── Linha horizontal final ───
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(1);
    doc.line(marginLeft, y, pageWidth - marginRight, y);

    // ─── Salvar PDF ───
    doc.save(`Relatório Pagamento - ${nomeProfessor} - ${nomeMes} ${ano}.pdf`);
  };

  // Carregar logo e então gerar PDF
  const img = new window.Image();
  img.onload = function () {
    renderPDF(img);
  };
  img.onerror = function () {
    renderPDF(null);
  };
  img.src = 'img/logo.png';
}

function mascaraValorInfoAdicional(input) {
  let v = input.value.replace(/\D/g, '');
  if (v === '') { input.value = ''; return; }
  v = (parseInt(v, 10) / 100).toFixed(2);
  input.value = 'R$ ' + v.replace('.', ',');
}

function analisarPagamentos() {
  if (window._pagModoColecao) {
    // TODO: implementar modo grupo
    return;
  }
  analisarPagamentoIndividual();
}

async function analisarPagamentoIndividual() {
  const mes = parseInt(document.getElementById('pag-mes')?.value);
  const ano = parseInt(document.getElementById('pag-ano')?.value);
  const professorId = document.getElementById('pag-professor-select')?.value;

  if (!mes || !ano) {
    showToast('Selecione mês e ano.', 'error');
    return;
  }
  if (!professorId) {
    showToast('Selecione um professor.', 'error');
    return;
  }

  const todasAulas = window._pagTodasAulas || [];

  // Filtrar aulas do professor no mês/ano selecionado
  const aulasFiltradas = todasAulas.filter(aula => {
    if (aula.idProfessor !== professorId) return false;
    const match = (aula.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return false;
    return parseInt(match[2], 10) === mes && parseInt(match[3], 10) === ano;
  });

  // Ordenar por data (dia)
  aulasFiltradas.sort((a, b) => {
    const diaA = parseInt((a.data || '').match(/(\d{2})\/\d{2}\/\d{4}/)?.[1] || '0', 10);
    const diaB = parseInt((b.data || '').match(/(\d{2})\/\d{2}\/\d{4}/)?.[1] || '0', 10);
    return diaA - diaB;
  });

  const secao = document.getElementById('pag-secao-individual');
  if (!secao) return;

  // Nome do professor selecionado
  const professor = (window._pagProfessoresAtivos || []).find(p => p.cpf === professorId);
  const nomeProfessor = professor?.nome || 'Professor';

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const nomeMes = meses[mes - 1] || '';

  if (aulasFiltradas.length === 0) {
    // Atualizar título
    const h3 = secao.querySelector('h3');
    if (h3) h3.innerHTML = `<i class="fas fa-user mr-2 text-orange-500"></i>Relatório Individual — ${nomeProfessor} <span class="text-sm font-normal text-gray-500 ml-2">${nomeMes}/${ano}</span>`;

    const tbody = document.getElementById('tbody-pagamento-individual');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-8 text-gray-400 font-comfortaa text-sm">
            Nenhuma aula encontrada para <strong>${nomeProfessor}</strong> em <strong>${nomeMes}/${ano}</strong>.
          </td>
        </tr>`;
    }
    // Limpar tfoot
    const tfoot = document.querySelector('#tabela-pagamento-individual tfoot');
    if (tfoot) tfoot.innerHTML = '';
    window._pagUltimoTotalValor = 0;
    await carregarInfoAdicionaisDoFirebase(professorId, mes, ano);
    atualizarResumoPagamento(0);
    return;
  }

  // Calcular totais
  const totalValor = aulasFiltradas.reduce((acc, a) => acc + (parseFloat(a.ValorAula) || 0), 0);

  // Montar tabela
  let linhas = '';
  aulasFiltradas.forEach(aula => {
    const valor = parseFloat(aula.ValorAula) || 0;
    const codigoContr = aula.codigoContratacao || aula.idContratacao || (aula.id ? aula.id.replace(/[A-Z]{2}_.*$/, '').replace(/[A-Z]+$/, '') : '') || '';
    const nomeExibido = aula.nomeCliente || aula.estudante || '—';
    linhas += `
      <tr>
        <td class="font-comfortaa">${aula.data || '—'}</td>
        <td class="font-comfortaa">${codigoContr ? `<a href="#" class="text-orange-500 hover:text-orange-700 underline cursor-pointer font-medium" onclick="abrirDetalhesContratacaoPagamento('${codigoContr}'); return false;">${codigoContr}</a>` : '—'}</td>
        <td class="font-comfortaa">${nomeExibido}</td>
        <td class="font-comfortaa">${aula.duracao || '—'}</td>
        <td class="font-comfortaa">R$ ${valor.toFixed(2).replace('.', ',')}</td>
      </tr>`;
  });

  // Atualizar título
  const h3 = secao.querySelector('h3');
  if (h3) h3.innerHTML = `<i class="fas fa-user mr-2 text-orange-500"></i>Relatório Individual — ${nomeProfessor} <span class="text-sm font-normal text-gray-500 ml-2">${nomeMes}/${ano}</span>`;

  // Atualizar tbody
  const tbody = document.getElementById('tbody-pagamento-individual');
  if (tbody) tbody.innerHTML = linhas;

  // Atualizar tfoot
  const table = document.getElementById('tabela-pagamento-individual');
  let tfoot = table ? table.querySelector('tfoot') : null;
  if (!tfoot && table) {
    tfoot = document.createElement('tfoot');
    table.appendChild(tfoot);
  }
  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="background:#f9fafb; font-weight:bold;">
        <td class="font-lexend" colspan="3">${aulasFiltradas.length} aula(s)</td>
        <td></td>
        <td class="font-lexend">R$ ${totalValor.toFixed(2).replace('.', ',')}</td>
      </tr>`;
  }

  window._pagUltimoTotalValor = totalValor;
  await carregarInfoAdicionaisDoFirebase(professorId, mes, ano);
  atualizarResumoPagamento(totalValor);
}

// functions-cofres-pagamento.js — Cofres e Reservas

async function loadCofresPagemento() {
  const section = document.getElementById('cofres-pagamento');
  if (!section) return;

  section.innerHTML = `
    <div class="flex items-center justify-center py-16">
      <div class="loading-spinner"></div>
    </div>
  `;

  try {
    const contratos = await fetchBancoDeAulas();
    window._cofresContratos = contratos;
    _renderCofresUI(section, contratos);
  } catch (error) {
    section.innerHTML = `
      <div class="text-center py-12 text-red-500 font-comfortaa text-sm">
        <i class="fas fa-exclamation-circle text-3xl mb-3 block"></i>
        Erro ao carregar dados: ${error.message}
      </div>
    `;
  }
}

function _renderCofresUI(section, contratos) {
  const meses = _extrairMeses(contratos);
  const now   = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  section.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
      <p class="font-comfortaa text-xs text-gray-400 mb-3 uppercase tracking-wide">Filtrar por mês de 1ª parcela</p>
      <div id="cofres-meses-container" class="flex flex-wrap gap-2">
        ${meses.length > 0
          ? meses.map(m => `
              <button
                class="cofres-mes-btn font-comfortaa text-sm px-4 py-1.5 rounded-full border transition-all"
                data-mes="${m.mes}" data-ano="${m.ano}"
              >${m.label}</button>
            `).join('')
          : `<span class="font-comfortaa text-sm text-gray-400">Nenhuma data de 1ª parcela encontrada nos contratos.</span>`
        }
      </div>
    </div>

    <div id="cofres-resumo" class="hidden grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"></div>

    <div id="cofres-busca-container" class="hidden mb-4">
      <div class="relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
        <input
          id="cofres-busca-input"
          type="text"
          placeholder="Buscar por nome do cliente ou número de contratação..."
          class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 font-comfortaa text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-all"
        >
      </div>
    </div>

    <div id="cofres-cards-container">
      <div class="text-center py-12 text-gray-400 font-comfortaa text-sm">
        <i class="fas fa-hand-pointer text-4xl mb-3 block text-gray-200"></i>
        Selecione um mês para visualizar os pagamentos
      </div>
    </div>
  `;

  document.getElementById('cofres-meses-container').addEventListener('click', e => {
    const btn = e.target.closest('.cofres-mes-btn');
    if (!btn) return;
    cofresSelectMes(parseInt(btn.dataset.mes), parseInt(btn.dataset.ano));
  });

  document.getElementById('cofres-busca-input')?.addEventListener('input', e => {
    _cofresAplicarBusca(e.target.value.trim());
  });

  const mesExiste = meses.find(m => m.mes === mesAtual && m.ano === anoAtual);
  if (mesExiste) {
    cofresSelectMes(mesAtual, anoAtual);
  } else if (meses.length > 0) {
    cofresSelectMes(meses[0].mes, meses[0].ano);
  }
}

function _extrairMeses(contratos) {
  const map = new Map();
  contratos.forEach(c => {
    if (!c.dataPrimeiraParcela) return;
    const parts = c.dataPrimeiraParcela.split('/');
    if (parts.length !== 3) return;
    const mes = parseInt(parts[1], 10);
    const ano = parseInt(parts[2], 10);
    if (isNaN(mes) || isNaN(ano)) return;
    const key = `${ano}-${String(mes).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, { mes, ano, label: _nomeMesAno(mes, ano), sortKey: ano * 100 + mes });
  });
  return Array.from(map.values()).sort((a, b) => b.sortKey - a.sortKey);
}

function _nomeMesAno(mes, ano) {
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[mes - 1]} ${ano}`;
}

function cofresSelectMes(mes, ano) {
  document.querySelectorAll('.cofres-mes-btn').forEach(btn => {
    const ativo = parseInt(btn.dataset.mes) === mes && parseInt(btn.dataset.ano) === ano;
    btn.classList.toggle('bg-orange-500',    ativo);
    btn.classList.toggle('text-white',        ativo);
    btn.classList.toggle('border-orange-500', ativo);
    btn.classList.toggle('bg-white',         !ativo);
    btn.classList.toggle('text-gray-600',    !ativo);
    btn.classList.toggle('border-gray-200',  !ativo);
  });

  const filtrados = (window._cofresContratos || []).filter(c => {
    if (!c.dataPrimeiraParcela) return false;
    const parts = c.dataPrimeiraParcela.split('/');
    if (parts.length !== 3) return false;
    return parseInt(parts[1], 10) === mes && parseInt(parts[2], 10) === ano;
  });

  window._cofresContratosMes = filtrados;

  const buscaContainer = document.getElementById('cofres-busca-container');
  if (buscaContainer) buscaContainer.classList.toggle('hidden', filtrados.length === 0);

  const buscaInput = document.getElementById('cofres-busca-input');
  if (buscaInput) buscaInput.value = '';

  _renderCofresResumo(filtrados);
  _renderCofresCards(filtrados, mes, ano);
}

function _cofresAplicarBusca(termo) {
  const base = window._cofresContratosMes || [];
  if (!termo) { _renderCofresCardsLista(base); return; }
  const lower = termo.toLowerCase();
  const filtrados = base.filter(c => {
    const nome   = (c.nome || c.nomeCliente || '').toLowerCase();
    const codigo = (c.codigoContratacao || '').toLowerCase();
    return nome.includes(lower) || codigo.includes(lower);
  });
  _renderCofresCardsLista(filtrados, termo);
}

function _renderCofresResumo(contratos) {
  const resumo = document.getElementById('cofres-resumo');
  if (!resumo) return;

  if (contratos.length === 0) { resumo.classList.add('hidden'); return; }

  const totalPacote  = contratos.reduce((s, c) => s + (Number(c.ValorPacote) || 0), 0);
  const totalEquipe  = contratos.reduce((s, c) => s + (Number(c.ValorEquipe) || 0), 0);

  const reservados       = contratos.filter(c => c.check_pagamentoReservado === true);
  const equipeReservado  = reservados.reduce((s, c) => s + (Number(c.ValorEquipe) || 0), 0);
  const pacoteReservado  = reservados.reduce((s, c) => s + (Number(c.ValorPacote) || 0), 0);
  const impostoReservado = pacoteReservado * 0.15;

  const totalLucro = totalPacote - totalEquipe - impostoReservado;

  resumo.classList.remove('hidden');
  resumo.innerHTML = `
    <div class="bg-orange-50 rounded-xl border border-orange-100 p-4">
      <p class="font-comfortaa text-xs text-orange-400 mb-1">Total dos pacotes</p>
      <p class="font-lexend font-bold text-orange-600 text-lg">${_moeda(totalPacote)}</p>
      <p class="font-comfortaa text-xs text-gray-400 mt-1">${contratos.length} contrato${contratos.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="bg-blue-50 rounded-xl border border-blue-100 p-4">
      <p class="font-comfortaa text-xs text-blue-400 mb-1">Lucro bruto total</p>
      <p class="font-lexend font-bold text-blue-600 text-lg">${_moeda(totalLucro)}</p>
      <p class="font-comfortaa text-xs text-gray-400 mt-1">− equipe − impostos reservados</p>
    </div>
    <div class="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <p class="font-comfortaa text-xs text-gray-400 mb-1">Direcionado à equipe</p>
      <p class="font-lexend font-bold text-gray-700 text-lg">${_moeda(totalEquipe)}</p>
      <p class="font-comfortaa text-xs text-gray-400 mt-1">Reservado: ${_moeda(equipeReservado)}</p>
    </div>
    <div class="bg-red-50 rounded-xl border border-red-100 p-4">
      <p class="font-comfortaa text-xs text-red-400 mb-1">Controle de impostos</p>
      <p class="font-lexend font-bold text-red-500 text-lg">${_moeda(impostoReservado)}</p>
      <p class="font-comfortaa text-xs text-gray-400 mt-1">15% de ${_moeda(pacoteReservado)}</p>
    </div>
  `;
}

function _renderCofresCards(contratos, mes, ano) {
  const container = document.getElementById('cofres-cards-container');
  if (!container) return;

  if (contratos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-400 font-comfortaa text-sm">
        <i class="fas fa-inbox text-4xl mb-3 block text-gray-200"></i>
        Nenhum pagamento encontrado para <strong>${_nomeMesAno(mes, ano)}</strong>
      </div>
    `;
    return;
  }

  _renderCofresCardsLista(contratos);
}

function _renderCofresCardsLista(contratos, termoBusca) {
  const container = document.getElementById('cofres-cards-container');
  if (!container) return;

  if (contratos.length === 0 && termoBusca) {
    container.innerHTML = `
      <div class="text-center py-10 text-gray-400 font-comfortaa text-sm">
        <i class="fas fa-search text-3xl mb-3 block text-gray-200"></i>
        Nenhum resultado para <strong>"${termoBusca}"</strong>
      </div>
    `;
    return;
  }

  container.innerHTML = contratos.map(c => _buildCard(c)).join('');
}

function _buildCard(c) {
  const nome      = c.nome || c.nomeCliente || 'Não informado';
  const horas     = Number(c.SomatorioDuracaoAulas) || 0;
  const metodo    = c.metodoPagamento || 'Não informado';
  const status    = c.statusPagamento || 'Não informado';
  const pacote    = Number(c.ValorPacote) || 0;
  const equipe    = Number(c.ValorEquipe) || 0;
  const imposto   = pacote * 0.15;
  const lucro     = pacote - equipe - imposto;
  const reservado = c.check_pagamentoReservado === true;
  const pixParc   = metodo === 'Pix parcelado';

  const statusCls = status === 'Pagamento completo'
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-yellow-100 text-yellow-700 border-yellow-200';

  const bordaCls = pixParc
    ? 'border border-orange-500'
    : 'border border-gray-100';

  const checkboxCls = reservado
    ? 'bg-orange-500 border-orange-500 text-white'
    : 'bg-white border-gray-300 text-transparent';

  return `
    <div class="bg-white rounded-xl shadow-sm ${bordaCls} mb-4 overflow-hidden hover:shadow-md transition-shadow" data-cofre-id="${c.id}">

      <div class="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onclick="cofresToggleCard(this)">
        <div class="flex-1 min-w-0">
          <h3 class="font-lexend font-bold text-gray-800 text-base leading-tight truncate">${nome}</h3>
          ${c.codigoContratacao ? `<span class="text-xs font-comfortaa text-gray-400">${c.codigoContratacao}</span>` : ''}
        </div>
        <div class="flex items-center gap-2 ml-3 flex-shrink-0">
          <span class="text-xs font-comfortaa px-3 py-1 rounded-full border ${statusCls} whitespace-nowrap hidden sm:inline-flex">${status}</span>
          <div class="cofre-arrow w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center transition-transform duration-200">
            <i class="fas fa-chevron-down text-gray-400 text-xs"></i>
          </div>
        </div>
      </div>

      <div class="cofre-card-body px-5 pb-5" style="display:none;">
        <span class="text-xs font-comfortaa px-3 py-1 rounded-full border ${statusCls} sm:hidden inline-flex mb-3">${status}</span>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs font-comfortaa text-gray-400 mb-1">Horas contratadas</p>
            <p class="font-lexend font-bold text-gray-800">${horas}h</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs font-comfortaa text-gray-400 mb-1">Método de pagamento</p>
            <p class="font-lexend font-semibold text-gray-800 text-sm">${metodo}</p>
          </div>
          <div class="bg-orange-50 rounded-lg p-3">
            <p class="text-xs font-comfortaa text-orange-400 mb-1">Valor do pacote</p>
            <p class="font-lexend font-bold text-orange-600">${_moeda(pacote)}</p>
          </div>
          <div class="bg-blue-50 rounded-lg p-3">
            <p class="text-xs font-comfortaa text-blue-400 mb-1">Lucro bruto</p>
            <p class="font-lexend font-bold text-blue-600">${_moeda(lucro)}</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs font-comfortaa text-gray-400 mb-1">Direcionado à equipe</p>
            <p class="font-lexend font-bold text-gray-700">${_moeda(equipe)}</p>
          </div>
          <div class="bg-red-50 rounded-lg p-3">
            <p class="text-xs font-comfortaa text-red-400 mb-1">Imposto (15%)</p>
            <p class="font-lexend font-bold text-red-500">${_moeda(imposto)}</p>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-gray-100">
          <button
            class="flex items-center gap-2 cursor-pointer"
            onclick="event.stopPropagation(); cofresToggleReservado('${c.id}', this)"
          >
            <div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${checkboxCls}">
              <i class="fas fa-check text-xs"></i>
            </div>
            <span class="font-comfortaa text-sm ${reservado ? 'text-orange-600 font-semibold' : 'text-gray-500'} transition-colors">Reservado</span>
          </button>
          ${c.dataPrimeiraParcela ? `<span class="text-xs font-comfortaa text-gray-300">1ª parcela: ${c.dataPrimeiraParcela}</span>` : ''}
        </div>
      </div>

    </div>
  `;
}

function cofresToggleCard(headerEl) {
  const card  = headerEl.closest('[data-cofre-id]');
  const body  = card.querySelector('.cofre-card-body');
  const arrow = card.querySelector('.cofre-arrow');
  const aberto = body.style.display !== 'none';
  body.style.display    = aberto ? 'none' : 'block';
  arrow.style.transform = aberto ? ''     : 'rotate(180deg)';
}

async function cofresToggleReservado(docId, btnEl) {
  const checkbox  = btnEl.querySelector('div');
  const label     = btnEl.querySelector('span');
  const eraReserv = checkbox.classList.contains('bg-orange-500');
  const novoValor = !eraReserv;

  if (novoValor) {
    checkbox.classList.replace('bg-white',         'bg-orange-500');
    checkbox.classList.replace('border-gray-300',  'border-orange-500');
    checkbox.classList.replace('text-transparent', 'text-white');
    label.classList.remove('text-gray-500');
    label.classList.add('text-orange-600', 'font-semibold');
  } else {
    checkbox.classList.replace('bg-orange-500',    'bg-white');
    checkbox.classList.replace('border-orange-500','border-gray-300');
    checkbox.classList.replace('text-white',       'text-transparent');
    label.classList.add('text-gray-500');
    label.classList.remove('text-orange-600', 'font-semibold');
  }

  try {
    await db.collection('BancoDeAulas').doc(docId).update({ check_pagamentoReservado: novoValor });

    [window._cofresContratos, window._cofresContratosMes].forEach(arr => {
      if (!arr) return;
      const idx = arr.findIndex(c => c.id === docId);
      if (idx !== -1) arr[idx].check_pagamentoReservado = novoValor;
    });

    if (typeof CACHE !== 'undefined' && CACHE.bancoDeAulas) {
      CACHE.bancoDeAulas.timestamp = null;
    }

    _renderCofresResumo(window._cofresContratosMes || []);

    if (typeof showToast === 'function') showToast(`Reservado ${novoValor ? 'marcado' : 'desmarcado'}`, 'success', 2000);
  } catch (error) {
    // Reverter
    if (!novoValor) {
      checkbox.classList.replace('bg-white',         'bg-orange-500');
      checkbox.classList.replace('border-gray-300',  'border-orange-500');
      checkbox.classList.replace('text-transparent', 'text-white');
      label.classList.remove('text-gray-500');
      label.classList.add('text-orange-600', 'font-semibold');
    } else {
      checkbox.classList.replace('bg-orange-500',    'bg-white');
      checkbox.classList.replace('border-orange-500','border-gray-300');
      checkbox.classList.replace('text-white',       'text-transparent');
      label.classList.add('text-gray-500');
      label.classList.remove('text-orange-600', 'font-semibold');
    }
    if (typeof showToast === 'function') showToast('Erro ao salvar: ' + error.message, 'error');
  }
}

function _moeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

// functions-mensagens-automaticas.js — Master Educação
// Correção: removido o listener DOMContentLoaded que tentava acessar
// elementos que não existem ainda (o app é SPA — seções carregam sob demanda).
// A função loadMensagensAutomaticas() é chamada pelo script.js quando necessário.

(function () {

  let abaSelecionada = 'relatorio';
  let filtroData = '';
  let filtroCliente = '';
  let listaCompletaDeAulas = [];
  let listaFiltrada = [];
  let editandoIndice = null;

  function gerarSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia!';
    if (hora >= 12 && hora < 18) return 'Boa tarde!';
    return 'Boa noite!';
  }

  async function carregarBancoDeAulas() {
    try {
      listaCompletaDeAulas = await fetchBancoDeAulas();
    } catch (_) {
      listaCompletaDeAulas = [];
    }
    aplicarFiltros();
  }

  function aplicarFiltros() {
    listaFiltrada = listaCompletaDeAulas.filter((aula) => {
      let passaData = true;
      if (filtroData === 'hoje')        passaData = ehHoje(aula.data);
      else if (filtroData === 'ontem')  passaData = ehOntem(aula.data);
      else if (filtroData)              passaData = aula.data === filtroData;

      const passaCliente = !filtroCliente ||
        (aula.nomeCliente || '').toLowerCase().includes(filtroCliente.toLowerCase());

      return passaData && passaCliente;
    });
    renderizarGrid();
  }

  function ehHoje(dataStr) {
    const hoje = new Date();
    const data = new Date(dataStr);
    return data.toDateString() === hoje.toDateString();
  }

  function ehOntem(dataStr) {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() - 1);
    return new Date(dataStr).toDateString() === hoje.toDateString();
  }

  function gerarMensagem(aula) {
    return `${gerarSaudacao()} ${aula.nomeCliente}.\nEste é o relatório da aula do dia ${aula.data} com ${aula.estudante}.\n\n${aula.RelatorioAula}`;
  }

  function copiarParaClipboard(mensagem) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mensagem).then(() => mostrarToast('Conteúdo copiado!'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = mensagem;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      mostrarToast('Conteúdo copiado!');
    }
  }

  function mostrarToast(msg) {
    if (typeof showToast === 'function') { showToast(msg, 'success'); return; }
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 24px', background: '#f28705', color: '#fff',
      borderRadius: '6px', zIndex: 9999, fontWeight: 'bold'
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = 0; setTimeout(() => toast.remove(), 400); }, 1800);
  }

  function editarCard(indice) {
    editandoIndice = indice;
    renderizarGrid();
  }

  function salvarEdicao(novoRelatorio) {
    if (editandoIndice !== null) {
      listaFiltrada[editandoIndice].RelatorioAula = novoRelatorio;
      editandoIndice = null;
      renderizarGrid();
      mostrarToast('Relatório atualizado!');
    }
  }

  function renderizarGrid() {
    const grid = document.getElementById('mensagens-automaticas-card-grid');
    if (!grid) return;
    grid.innerHTML = '';

    listaFiltrada.forEach((aula, idx) => {
      const card = document.createElement('div');
      card.className = 'card-mensagem-aula';

      if (editandoIndice === idx) {
        const textarea = document.createElement('textarea');
        textarea.value = aula.RelatorioAula;
        textarea.rows  = 5;
        textarea.style.width = '100%';
        card.appendChild(textarea);

        const btnSalvar = document.createElement('button');
        btnSalvar.innerText = 'Salvar';
        btnSalvar.onclick = () => salvarEdicao(textarea.value);
        card.appendChild(btnSalvar);

        const btnCancelar = document.createElement('button');
        btnCancelar.innerText = 'Cancelar';
        btnCancelar.style.marginLeft = '8px';
        btnCancelar.onclick = () => { editandoIndice = null; renderizarGrid(); };
        card.appendChild(btnCancelar);
      } else {
        const cliente = document.createElement('strong');
        cliente.innerText = aula.nomeCliente;
        card.appendChild(cliente);

        const data = document.createElement('div');
        data.innerText = aula.data;
        card.appendChild(data);

        const btnCopiar = document.createElement('button');
        btnCopiar.innerText = 'Copiar mensagem';
        Object.assign(btnCopiar.style, { background: '#f28705', color: '#fff', marginTop: '6px' });
        btnCopiar.onclick = (e) => { e.stopPropagation(); copiarParaClipboard(gerarMensagem(aula)); };
        card.appendChild(btnCopiar);

        card.onclick = () => editarCard(idx);
      }

      grid.appendChild(card);
    });
  }

  function renderizarFiltrosETabs() {
    const tabs    = document.getElementById('mensagens-automaticas-tabs');
    const filtros = document.getElementById('mensagens-automaticas-filtros');
    if (!tabs || !filtros) return; // Seção ainda não foi carregada no DOM

    tabs.innerHTML = '';
    const tabNomes = [
      { id: 'relatorio',        label: 'Relatório de Aula' },
      { id: 'lembretes-prof',   label: 'Lembretes Professores' },
      { id: 'lembretes-cliente',label: 'Lembretes Clientes' }
    ];

    tabNomes.forEach(tab => {
      const btn = document.createElement('button');
      btn.innerText  = tab.label;
      btn.className  = abaSelecionada === tab.id ? 'tab-btn ativo' : 'tab-btn';
      btn.onclick = () => {
        abaSelecionada = tab.id;
        if (abaSelecionada === 'relatorio') renderizarFiltrosETabs();
        else mostrarToast('Aba em construção.');
      };
      tabs.appendChild(btn);
    });

    filtros.innerHTML = '';
    ['hoje', 'ontem'].forEach(opt => {
      const btn = document.createElement('button');
      btn.innerText  = opt === 'hoje' ? 'Relatório de Hoje' : 'Relatório de Ontem';
      btn.className  = filtroData === opt ? 'filtro-btn ativo' : 'filtro-btn';
      btn.onclick = () => { filtroData = opt; aplicarFiltros(); };
      filtros.appendChild(btn);
    });

    const inputDt = document.createElement('input');
    inputDt.type = 'date';
    inputDt.onchange = e => { filtroData = e.target.value; aplicarFiltros(); };
    filtros.appendChild(inputDt);

    const inputCliente = document.createElement('input');
    inputCliente.type        = 'text';
    inputCliente.placeholder = 'Buscar por cliente';
    inputCliente.value       = filtroCliente;
    inputCliente.oninput = e => { filtroCliente = e.target.value; aplicarFiltros(); };
    filtros.appendChild(inputCliente);

    renderizarGrid();
  }

  // Expor para uso global pelo script.js
  window.loadMensagensAutomaticas = function () {
    const section = document.getElementById('mensagens');
    if (!section) return;

    // Garantir que os containers existem na seção atual
    if (!document.getElementById('mensagens-automaticas-tabs')) {
      const tabsDiv = document.createElement('div');
      tabsDiv.id = 'mensagens-automaticas-tabs';
      section.appendChild(tabsDiv);
    }
    if (!document.getElementById('mensagens-automaticas-filtros')) {
      const filtrosDiv = document.createElement('div');
      filtrosDiv.id = 'mensagens-automaticas-filtros';
      section.appendChild(filtrosDiv);
    }
    if (!document.getElementById('mensagens-automaticas-card-grid')) {
      const gridDiv = document.createElement('div');
      gridDiv.id = 'mensagens-automaticas-card-grid';
      section.appendChild(gridDiv);
    }

    renderizarFiltrosETabs();
    carregarBancoDeAulas();
  };

})();

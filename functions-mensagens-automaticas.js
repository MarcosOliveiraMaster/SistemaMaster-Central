// Estrutura para Mensagens Automáticas - Aba: Relatório de Aula
// Adaptável para novas fontes de dados (outras tabs no futuro)

// Supondo integração com um framework ou utilitário de UI já existente
// Adapte os seletores, funções de toast/edição, e integração de banco conforme sua stack

(function () {
  // Elementos de UI e variáveis de estado
  let abaSelecionada = 'relatorio';
  let filtroData = ''; // hoje, ontem, ou string data (yyyy-mm-dd)
  let filtroCliente = '';
  let listaCompletaDeAulas = []; // Preencher do banco de dados
  let listaFiltrada = [];
  let editandoIndice = null;

  // Utilitário para formatar saudação pelo horário
  function gerarSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia!';
    if (hora >= 12 && hora < 18) return 'Boa tarde!';
    return 'Boa noite!';
  }

  // Simule aqui a busca dos dados do banco de dados no seu contexto real
  async function carregarBancoDeAulas() {
    // Exemplo fictício - troque por fetch/busca real do seu banco
    listaCompletaDeAulas = await fetchBancoDeAulas();
    aplicarFiltros();
  }

  // Lógica de filtragem adaptada
  function aplicarFiltros() {
    listaFiltrada = listaCompletaDeAulas.filter((aula) => {
      // Filtro data
      let passaData = true;
      if (filtroData === 'hoje') {
        passaData = ehHoje(aula.data);
      } else if (filtroData === 'ontem') {
        passaData = ehOntem(aula.data);
      } else if (filtroData && filtroData !== '') {
        passaData = aula.data === filtroData;
      }
      // Filtro cliente
      const passaCliente = !filtroCliente ||
        aula.nomeCliente.toLowerCase().includes(filtroCliente.toLowerCase());
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
    const data = new Date(dataStr);
    return data.toDateString() === hoje.toDateString();
  }

  // Gera mensagem pronta para copiar
  function gerarMensagem(aula) {
    const saudacao = gerarSaudacao();
    // Adapte a variável do estudante se necessário
    return `${saudacao} ${aula.nomeCliente}.
Este é o relatório da aula do dia ${aula.data} com ${aula.estudante}.

${aula.RelatorioAula}`;
  }

  // Handler do botão de copiar mensagem
  function copiarParaClipboard(mensagem) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mensagem).then(() => mostrarToast('Conteúdo copiado!'));
    } else {
      // Fallback para browsers antigos
      const textarea = document.createElement('textarea');
      textarea.value = mensagem;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      mostrarToast('Conteúdo copiado!');
    }
  }

  // Toast simples - adapte para seus componentes ou framework
  function mostrarToast(msg) {
    // User experience: exibe toast por 2s
    const toast = document.createElement('div');
    toast.className = 'mensagem-toast';
    toast.innerText = msg;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 24px', background: '#ed7d31', color: '#fff', borderRadius: '6px',
      zIndex: 9999, fontWeight: 'bold', fontSize: '1rem', transition: 'opacity 0.2s'
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = 0; setTimeout(() => toast.remove(), 400); }, 1800);
  }

  // Handler para edição do card
  function editarCard(indice) {
    editandoIndice = indice;
    // Adapte: abrir modal, inline editing etc, como no banco-de-aulas
    // Exemplo básico para continuidade:
    renderizarGrid();
  }

  // Handler para salvar edição
  function salvarEdicao(novoRelatorio) {
    if (editandoIndice !== null) {
      listaFiltrada[editandoIndice].RelatorioAula = novoRelatorio;
      // Ideal: replicar alteração na lista original e salvar no banco
      editandoIndice = null;
      renderizarGrid();
      mostrarToast('Relatório atualizado!');
    }
  }

  // Renderização visual do grid/cards
  function renderizarGrid() {
    const grid = document.getElementById('mensagens-automaticas-card-grid');
    grid.innerHTML = '';
    listaFiltrada.forEach((aula, idx) => {
      const card = document.createElement('div');
      card.className = 'card-mensagem-aula';

      if (editandoIndice === idx) {
        // Modo edição
        const textarea = document.createElement('textarea');
        textarea.value = aula.RelatorioAula;
        textarea.rows = 5;
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
        // Visual padrão
        const cliente = document.createElement('strong');
        cliente.innerText = aula.nomeCliente;
        card.appendChild(cliente);

        const data = document.createElement('div');
        data.innerText = aula.data; // Adapte formato se quiser
        card.appendChild(data);

        const btnCopiar = document.createElement('button');
        btnCopiar.innerText = 'Copiar mensagem';
        btnCopiar.style.background = '#ed7d31';
        btnCopiar.style.color = '#fff';
        btnCopiar.style.marginTop = '6px';
        btnCopiar.onclick = (e) => {
          e.stopPropagation();
          copiarParaClipboard(gerarMensagem(aula));
        };
        card.appendChild(btnCopiar);

        card.onclick = () => editarCard(idx);
      }

      grid.appendChild(card);
    });
  }

  // Renderização dos filtros e tabs iniciais
  function renderizarFiltrosETabs() {
    // Simplificado para HTML direto - adapte p/ seu framework/lib

    // Tabs
    const tabs = document.getElementById('mensagens-automaticas-tabs');
    tabs.innerHTML = '';
    const tabNomes = [
      { id: 'relatorio', label: 'Relatório de Aula' },
      { id: 'lembretes-prof', label: 'Lembretes Professores' },
      { id: 'lembretes-cliente', label: 'Lembretes Clientes' }
    ];
    tabNomes.forEach(tab => {
      const btn = document.createElement('button');
      btn.innerText = tab.label;
      btn.className = abaSelecionada === tab.id ? 'tab-btn ativo' : 'tab-btn';
      btn.onclick = () => {
        abaSelecionada = tab.id;
        // Lógica para carregar/focar o conteúdo respectivo
        if (abaSelecionada === 'relatorio') {
          // só recarrega filtros/grid do relatório por enquanto
          renderizarFiltrosETabs();
        } else {
          // em breve: renderizar outras tabs
          mostrarToast('Aba em construção.');
        }
      };
      tabs.appendChild(btn);
    });

    // Filtros
    const filtros = document.getElementById('mensagens-automaticas-filtros');
    filtros.innerHTML = '';
    // Botões: Hoje, Ontem
    ['hoje', 'ontem'].forEach(opt => {
      const btn = document.createElement('button');
      btn.innerText = opt === 'hoje' ? 'Relatório de Hoje' : 'Relatório de Ontem';
      btn.className = filtroData === opt ? 'filtro-btn ativo' : 'filtro-btn';
      btn.onclick = () => { filtroData = opt; aplicarFiltros(); };
      filtros.appendChild(btn);
    });
    // Input data
    const inputDt = document.createElement('input');
    inputDt.type = 'date';
    inputDt.onchange = (e) => { filtroData = e.target.value; aplicarFiltros(); };
    filtros.appendChild(inputDt);

    // Input cliente
    const inputCliente = document.createElement('input');
    inputCliente.type = 'text';
    inputCliente.placeholder = 'Buscar por cliente';
    inputCliente.value = filtroCliente;
    inputCliente.oninput = (e) => { filtroCliente = e.target.value; aplicarFiltros(); };
    filtros.appendChild(inputCliente);

    // Grid (abaixo dos filtros)
    renderizarGrid();
  }


  // Setup inicial na DOM
  document.addEventListener('DOMContentLoaded', () => {
    renderizarFiltrosETabs();
    carregarBancoDeAulas();
  });

  // Função global para integração com SPA
  window.loadMensagensAutomaticas = function() {
    // Garante que os containers existem (caso a seção seja recarregada dinamicamente)
    if (!document.getElementById('mensagens-automaticas-tabs')) {
      const tabsDiv = document.createElement('div');
      tabsDiv.id = 'mensagens-automaticas-tabs';
      document.getElementById('mensagens').appendChild(tabsDiv);
    }
    if (!document.getElementById('mensagens-automaticas-filtros')) {
      const filtrosDiv = document.createElement('div');
      filtrosDiv.id = 'mensagens-automaticas-filtros';
      document.getElementById('mensagens').appendChild(filtrosDiv);
    }
    if (!document.getElementById('mensagens-automaticas-card-grid')) {
      const gridDiv = document.createElement('div');
      gridDiv.id = 'mensagens-automaticas-card-grid';
      document.getElementById('mensagens').appendChild(gridDiv);
    }
    renderizarFiltrosETabs();
    carregarBancoDeAulas();
  }

  // Supondo integração por container já existente no HTML:
  // <div id="mensagens-automaticas-tabs"></div>
  // <div id="mensagens-automaticas-filtros"></div>
  // <div id="mensagens-automaticas-card-grid"></div>

  // Função fictícia para simular busca do banco (remover no real)
  async function fetchBancoDeAulas() {
    // Simulação de dados (remova para buscar real)
    return [
      { nomeCliente: 'Cliente 1', data: '2026-01-13', estudante: 'José', RelatorioAula: 'Avançou no conteúdo de inglês.' },
      { nomeCliente: 'Cliente 2', data: '2026-01-12', estudante: 'Ana', RelatorioAula: 'Revisou expressões idiomáticas.' },
      // ...adicione mais exemplos...
    ];
  }

})();
console.log('✅ functions-banco-de-aulas-Cards.js carregado');

// Objeto global para expor as funções
const BancoDeAulasCards = (function() {
  // Variáveis privadas
  let aulasData = [];
  let currentFilters = {};
  
  // Função para renderizar cards de aulas
  function renderAulasCards(aulas, filters = {}) {
    console.log('🎴 Renderizando cards:', aulas.length);
    
    aulasData = aulas || [];
    currentFilters = filters || {};
    
    const container = document.getElementById('aulas-container');
    if (!container) {
      console.error('❌ Container aulas-container não encontrado');
      return;
    }
    
    if (!aulas || aulas.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <i class="fas fa-book-open text-4xl text-gray-300 mb-4"></i>
          <h3 class="font-lexend text-lg mb-2 text-gray-500">Nenhuma aula encontrada</h3>
          <p class="text-gray-400 text-sm">Nenhuma aula foi cadastrada ainda.</p>
        </div>
      `;
      return;
    }
    
    // Aplicar filtros se fornecidos
    let filteredAulas = applyAulasFilters([...aulas], filters);
    
    // Verificar se há resultados após filtragem
    if (filteredAulas.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
          <h3 class="font-lexend text-lg mb-2 text-gray-500">Nenhuma aula encontrada</h3>
          <p class="text-gray-400 text-sm mb-4">Nenhuma aula corresponde aos filtros aplicados.</p>
          <button id="btn-limpar-filtros" class="btn-secondary btn-compact">
            <i class="fas fa-times mr-2"></i>
            Limpar Filtros
          </button>
        </div>
      `;
      
      document.getElementById('btn-limpar-filtros')?.addEventListener('click', () => {
        clearFilters();
        renderAulasCards(aulas);
      });

      // Inicializar estado dos controles (contagem e botão)
      updateSelection();
      
      return;
    }
    
    // Criar grid de 4 colunas
    container.innerHTML = `
      <div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h3 class="font-lexend font-bold text-base text-gray-700 mb-1">
            <span id="aulas-count" class="text-orange-500 text-lg">${filteredAulas.length}</span> 
            aula${filteredAulas.length !== 1 ? 's' : ''} encontrada${filteredAulas.length !== 1 ? 's' : ''}
          </h3>
          <p class="text-xs text-gray-500">
            ${filters.cliente ? 'Filtrado por cliente' : ''}
            ${filters.data ? '| Filtrado por data' : ''}
            ${filters.codigo ? '| Filtrado por código' : ''}
            ${filters.professor ? '| Filtrado por professor' : ''}
          </p>
        </div>
        <div class="text-xs text-gray-500 mt-2 sm:mt-0 flex items-center">
          <i class="fas fa-clock mr-1.5"></i>
          <span>Atualizado: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      
      <div class="cards-grid-compact" id="aulas-cards-grid"></div>
      
      <!-- Resumo do grid -->
      <div class="mt-6 pt-4 border-t border-gray-200 text-center">
        <div class="inline-flex items-center space-x-6 text-sm text-gray-500">
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>Completo: ${filteredAulas.filter(a => {
              const numAulas = a.aulas?.length || 0;
              const aulasComProfessor = a.aulas?.filter(aula => aula.professor && aula.professor !== 'A definir').length || 0;
              return aulasComProfessor === numAulas && numAulas > 0;
            }).length}</span>
          </div>
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            <span>Parcial: ${filteredAulas.filter(a => {
              const numAulas = a.aulas?.length || 0;
              const aulasComProfessor = a.aulas?.filter(aula => aula.professor && aula.professor !== 'A definir').length || 0;
              return aulasComProfessor > 0 && aulasComProfessor < numAulas;
            }).length}</span>
          </div>
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>Sem professor: ${filteredAulas.filter(a => {
              const aulasComProfessor = a.aulas?.filter(aula => aula.professor && aula.professor !== 'A definir').length || 0;
              return aulasComProfessor === 0 && (a.aulas?.length || 0) > 0;
            }).length}</span>
          </div>
        </div>
      </div>
    `;
    
    const grid = document.getElementById('aulas-cards-grid');
    
    // Adicionar cards ao grid
    filteredAulas.forEach(aula => {
      const card = createAulaCardCompact(aula);
      grid.appendChild(card);
    });
    
    // Atualizar contador com animação
    animateCounter('aulas-count', filteredAulas.length);
  }
  
  // Função para aplicar filtros às aulas
  function applyAulasFilters(aulas, filters) {
    if (Object.keys(filters).length === 0) return aulas;
    
    console.log('🔍 Aplicando filtros:', filters);
    
    return aulas.filter(aula => {
      // Filtro por cliente (CPF)
      if (filters.cliente && aula.cpf !== filters.cliente) {
        return false;
      }
      
      // Filtro por código
      if (filters.codigo) {
        const codigo = aula.codigoContratacao || '';
        if (!codigo.toLowerCase().includes(filters.codigo.toLowerCase())) {
          return false;
        }
      }
      
      // Filtro por professor
      if (filters.professor) {
        const temProfessor = aula.aulas?.some(a => {
          const professorAula = a.professor || '';
          return professorAula.toLowerCase().includes(filters.professor.toLowerCase());
        });
        if (!temProfessor) return false;
      }
      
      // Filtro por data
      if (filters.data) {
        const temData = aula.aulas?.some(a => {
          const dataAula = a.data || '';
          return dataAula.includes(filters.data);
        });
        if (!temData) return false;
      }
      
      return true;
    });
  }
  
  // Função para criar card de aula compacto (ATUALIZADA)
  function createAulaCardCompact(aula) {
    const card = document.createElement('div');
    card.className = 'aula-card-compact';
    card.dataset.id = aula.id;
    
    // Nome do cliente - BUSCAR DO CAMPO "nome" DO DOCUMENTO
    const nomeCliente = aula.nome || aula.nomeCliente || 'Cliente não identificado';
    
    // Código da contratação
    const codigo = aula.codigoContratacao || 'Sem código';
    
    // Status do pagamento
    const statusPagamento = aula.statusPagamento || 'Não informado';
    
    // Status do contrato
    const statusContrato = aula.statusContrato || 'Não informado';
    
    // Contar número de aulas
    const numAulas = aula.aulas && Array.isArray(aula.aulas) ? aula.aulas.length : 0;
    
    // Contar aulas com professor definido (diferente de "A definir", vazio ou null)
    const aulasComProfessor = aula.aulas ? 
      aula.aulas.filter(a => a.professor && a.professor !== 'A definir' && a.professor.trim() !== '').length : 0;
    
    // Contar aulas "A definir"
    const aulasADefinir = aula.aulas ? 
      aula.aulas.filter(a => !a.professor || a.professor === 'A definir' || a.professor.trim() === '').length : 0;
    
    // Determinar classe CSS para status
    const getStatusClass = (status) => {
      if (status === 'Pagamento Efetuado' || status === 'Ativo') return 'success';
      if (status === 'Pendente' || status === 'Inativo') return 'error';
      if (status === 'Parcial' || status === 'Processando') return 'warning';
      return 'info';
    };
    
    // Cor para aulas A definir (verde se não tem nenhuma, vermelho se tem)
    const professorCorClass = aulasADefinir === 0 ? 'text-green-500' : 'text-red-400';
    
    card.innerHTML = `
      <div class="aula-card-header">
        <div class="aula-card-title" title="${nomeCliente}">
          <i class="fas fa-user-graduate text-orange-500 mr-1 text-sm"></i>
          <span class="text-xs">${nomeCliente}</span>
        </div>
        <div class="aula-card-codigo" title="Código: ${codigo}">${codigo}</div>
      </div>
      
      <div class="aula-card-content">
        <div class="mb-2">
          <!-- Linha 1: Status do pagamento -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-money-bill-wave"></i>
              Pagamento:
            </span>
            <span class="status-badge ${getStatusClass(statusPagamento)} text-xs px-2 py-1">
              ${statusPagamento}
            </span>
          </div>
          
          <!-- Linha 2: Status do contrato -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-file-contract"></i>
              Contrato:
            </span>
            <span class="status-badge ${getStatusClass(statusContrato)} text-xs px-2 py-1">
              ${statusContrato}
            </span>
          </div>
          
          <!-- Linha 3: Com professor (mostrando A definir na fração) -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-chalkboard-teacher"></i>
              Com professor:
            </span>
            <span class="info-value font-medium ${professorCorClass}">
              ${aulasADefinir}/${numAulas}
            </span>
          </div>
        </div>
        
        <!-- Botão de ação: apenas excluir -->
        <div class="mt-3 pt-3 border-t border-gray-100 flex justify-center">
          <button class="btn-delete-aula text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded transition-colors flex items-center">
            <i class="fas fa-trash-alt mr-1.5"></i>
            <span>Excluir</span>
          </button>
        </div>
      </div>
    `;
    
    // Adicionar evento de clique no card para abrir os detalhes
    card.addEventListener('click', (e) => {
      // Impedir que o clique no botão delete dispare o evento do card
      if (!e.target.closest('.btn-delete-aula')) {
        viewAulaDetails(aula);
      }
    });
    
    // Adicionar evento ao botão de exclusão
    const btnDelete = card.querySelector('.btn-delete-aula');
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteAula(aula.id, nomeCliente);
    });
    
    // Adicionar hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.15)';
      card.style.borderColor = 'var(--orange)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'var(--shadow-sm)';
      card.style.borderColor = 'transparent';
    });
    
    return card;
  }
  
  // Função para abrir os detalhes da aula (modal)
  function viewAulaDetails(aula) {
    console.log('🔍 Visualizando detalhes da aula:', aula.id);
    
    // Criar modal HTML
    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal-container max-w-6xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">
              <i class="fas fa-file-contract text-orange-500 mr-2"></i>
              Detalhes da Contratação - ${aula.codigoContratacao || 'Sem código'}${(typeof formatDateLong === 'function' && formatDateLong(aula.dataContratacao)) ? ' — ' + formatDateLong(aula.dataContratacao) : ''}
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body vertical-scroll-hidden">
            <!-- Informações do Cliente -->
            <div class="mb-6">
              <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
                <i class="fas fa-user-circle text-orange-500 mr-2"></i>
                Informações do Cliente
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <!-- Coluna 1: Dados básicos -->
                <div class="space-y-3">
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Nome do Cliente</div>
                    <div class="text-sm text-gray-800">${aula.nome || aula.nomeCliente || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">CPF</div>
                    <div class="text-sm text-gray-800">${aula.cpf || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Estudante</div>
                    <div class="text-sm text-gray-800" id="modal-estudantes">--</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Série</div>
                    <div class="text-sm text-gray-800" id="modal-series">--</div>
                  </div>
                </div>
                
                <!-- Coluna 2: Status do contrato -->
                <div class="space-y-3">
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Status do Contrato</div>
                    <div class="text-sm">
                      <span class="status-badge ${getStatusBadgeClass(aula.statusContrato)} text-xs px-2 py-1">
                        ${aula.statusContrato || '--'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Assinatura do Contrato</div>
                    <div class="text-sm text-gray-800">${formatDate(aula.dataAssinaturaContrato) || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Método de pagamento</div>
                    <div class="text-sm text-gray-800">${aula.modoPagamento || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Código da Contratação</div>
                    <div class="text-sm text-gray-800 font-mono">${aula.codigoContratacao || '--'}</div>
                  </div>
                </div>
                
                <!-- Coluna 3: Status do pagamento -->
                <div class="space-y-3">
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Status do Pagamento</div>
                    <div class="text-sm">
                      <span class="status-badge ${getStatusBadgeClass(aula.statusPagamento)} text-xs px-2 py-1">
                        ${aula.statusPagamento || '--'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Data da primeira parcela</div>
                    <div class="text-sm text-gray-800">${formatDate(aula.dataPrimeiraParcela) || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Data da segunda parcela</div>
                    <div class="text-sm text-gray-800">${formatDate(aula.dataSegundaParcela) || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Tipo de Equipe</div>
                    <div class="text-sm text-gray-800">${aula.equipe || '--'}</div>
                  </div>
                </div>
                
                <!-- Coluna 4: Botões de ação -->
                <div class="space-y-3">
                  <div class="text-xs font-medium text-gray-500 mb-1">Ações</div>
                  <div class="space-y-1.5">
                    <button id="btn-editar-contratacao" class="btn-secondary text-xs py-1.5 px-2 w-full">
                      <i class="fas fa-edit mr-1 text-xs"></i>
                      <span class="text-xs">Editar</span>
                    </button>
                    <button id="btn-gerar-contrato" class="btn-primary text-xs py-1.5 px-2 w-full" disabled>
                      <i class="fas fa-file-pdf mr-1 text-xs"></i>
                      <span class="text-xs">Contrato</span>
                    </button>
                    <button id="btn-gerar-solicitacao" class="btn-secondary text-xs py-1.5 px-2 w-full">
                      <i class="fas fa-calendar-plus mr-1 text-xs"></i>
                      <span class="text-xs">Solicitação</span>
                    </button>
                    <button id="btn-ver-observacoes" class="btn-secondary text-xs py-1.5 px-2 w-full">
                      <i class="fas fa-eye mr-1 text-xs"></i>
                      <span class="text-xs">Observações</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Dados da contratação -->
            <div class="mt-4 mb-4 p-4 bg-white border border-gray-100 rounded-lg">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-lexend font-bold text-sm text-gray-700">Dados da contratação</h4>
                <button id="btn-editar-valores-contrato" class="btn-secondary btn-compact text-xs py-1 px-2">
                  <i class="fas fa-coins mr-2"></i>
                  Editar valores
                </button>
              </div>
                <div class="grid grid-cols-5 gap-4">
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Total de horas</div>
                  <div id="display-total-horas-contrato" class="text-lg font-bold text-orange-600">0h 0m</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Valor do pacote</div>
                  <div id="display-valor-pacote-contrato" class="text-lg font-bold text-orange-600">R$ 0,00</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Valor para Equipe</div>
                  <div id="display-valor-equipe-contrato" class="text-lg font-bold text-gray-600">R$ 0,00</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Lucro Master</div>
                  <div id="display-lucro-master-contrato" class="text-lg font-bold text-green-600">R$ 0,00</div>
                </div>
                <div>
                  <div class="text-xs font-medium text-gray-500 mb-1">Valor Hora/Aula</div>
                  <div id="display-hora-aula-contrato" class="text-lg font-bold text-gray-700">R$ 0,00</div>
                </div>
              </div>
            </div>

            <!-- Aulas Agendadas -->
            <div>
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-lexend font-bold text-base text-gray-700">
                  <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>
                  Aulas Agendadas
                </h4>
                <div class="flex gap-2">
                  <button 
                    id="btnRemoverAula" 
                    class="btn-secondary btn-compact"
                    data-codigo-contratacao="${aula.codigoContratacao}"
                    title="Remover aulas do cronograma"
                  >
                    <i class="fas fa-trash mr-2"></i>
                    Remover aula
                  </button>
                  <button 
                    id="btnAdicionarAula" 
                    class="btn-primary btn-compact"
                    data-codigo-contratacao="${aula.codigoContratacao}"
                    title="Adicionar nova aula ao cronograma"
                  >
                    <i class="fas fa-plus mr-2"></i>
                    Adicionar aula
                  </button>
                </div>
              </div>
              
              <div class="table-container-double-scroll">
                <div class="table-wrapper vertical-scroll-hidden">
                  ${renderAulasDetalhadas(aula.aulas || [], aula.id)}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btn-fechar-modal" class="btn-secondary btn-compact">
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar modal ao body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Configurar eventos do modal
    const modal = modalContainer.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const fecharBtn = modal.querySelector('#btn-fechar-modal');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    fecharBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Fechar com ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    
    // Carregar aulas detalhadas da BancoDeAulas-Lista
    const codigoContratacao = aula.codigoContratacao;
    if (codigoContratacao) {
      loadAulasDetalhadas(codigoContratacao);

      // Preencher os valores de contrato (ValorPacote, ValorEquipe, lucroMaster)
      (async function() {
        try {
          const docRef = db.collection('BancoDeAulas').doc(codigoContratacao);
          const docSnap = await docRef.get();
          const elPacote = modal.querySelector('#display-valor-pacote-contrato');
          const elEquipe = modal.querySelector('#display-valor-equipe-contrato');
          const elLucro = modal.querySelector('#display-lucro-master-contrato');

          const formatBR = (v) => {
            if (v === undefined || v === null || v === '') return '--';
            const num = Number(v);
            if (Number.isNaN(num)) return '--';
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          };

          if (docSnap.exists) {
            const data = docSnap.data();
            elPacote.textContent = formatBR(data.ValorPacote);
            elEquipe.textContent = formatBR(data.ValorEquipe);
            elLucro.textContent = formatBR(data.lucroMaster);
          } else {
            elPacote.textContent = '--';
            elEquipe.textContent = '--';
            elLucro.textContent = '--';
          }
        } catch (err) {
          console.error('Erro ao carregar dados da contratação', err);
        }
      })();

    } else {
      console.warn('⚠️ Código de contratação não encontrado');
      const tbody = modal.querySelector('#tbody-aulas-detalhadas');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" class="text-center py-8">
              <i class="fas fa-exclamation-triangle text-3xl text-orange-500 mb-3"></i>
              <p class="text-gray-500">Código de contratação não encontrado</p>
            </td>
          </tr>
        `;
      }
    }
    
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
    
    // Configurar botão de editar contratação (abre modal de edição)
    const btnEditarContratacao = modal.querySelector('#btn-editar-contratacao');
    btnEditarContratacao.addEventListener('click', () => {
      closeModal();
      openEditModal(aula);
    });

    // Atualizar display do Valor Hora/Aula se o contrato já contém o campo
    try {
      const elHoraAulaContrato = modal.querySelector('#display-hora-aula-contrato');
      if (elHoraAulaContrato) {
        const horaVal = (aula && (aula.horaAulaProfessor || aula.horaAulaProfessor === 0)) ? aula.horaAulaProfessor : null;
        if (horaVal !== null && horaVal !== undefined && horaVal !== '') {
          elHoraAulaContrato.textContent = formatCurrencyBR(Number(horaVal));
        } else {
          elHoraAulaContrato.textContent = formatCurrencyBR(35);
        }
      }
      // Inicializar Lucro Master, Valor para Equipe e Valor do Pacote a partir do documento do contrato, se houver
      try {
        const elLucroContrato = modal.querySelector('#display-lucro-master-contrato');
        const elEquipeContrato = modal.querySelector('#display-valor-equipe-contrato');
        const elPacoteContrato = modal.querySelector('#display-valor-pacote-contrato');

        if (elLucroContrato) {
          const lucroVal = (aula && (aula.lucroMaster || aula.lucroMaster === 0)) ? aula.lucroMaster : null;
          if (lucroVal !== null && lucroVal !== undefined && lucroVal !== '') {
            elLucroContrato.textContent = formatCurrencyBR(Number(lucroVal));
          } else {
            elLucroContrato.textContent = formatCurrencyBR(0);
          }
        }

        if (elEquipeContrato) {
          const equipeVal = (aula && (aula.ValorEquipe || aula.ValorEquipe === 0)) ? aula.ValorEquipe : null;
          if (equipeVal !== null && equipeVal !== undefined && equipeVal !== '') {
            elEquipeContrato.textContent = formatCurrencyBR(Number(equipeVal));
          } else {
            elEquipeContrato.textContent = formatCurrencyBR(0);
          }
        }

        if (elPacoteContrato) {
          const pacoteVal = (aula && (aula.ValorPacote || aula.ValorPacote === 0)) ? aula.ValorPacote : null;
          if (pacoteVal !== null && pacoteVal !== undefined && pacoteVal !== '') {
            elPacoteContrato.textContent = formatCurrencyBR(Number(pacoteVal));
          } else {
            elPacoteContrato.textContent = formatCurrencyBR(0);
          }
        }
      } catch (errInit) {
        console.warn('Não foi possível preencher valores iniciais do contrato (lucro/equipe/pacote)', errInit);
      }
    } catch (err) {
      console.warn('Não foi possível preencher display-hora-aula-contrato', err);
    }
    
    // Configurar botão de gerar contrato (desabilitado por enquanto)
    const btnGerarContrato = modal.querySelector('#btn-gerar-contrato');
    // Habilita o botão
    btnGerarContrato.removeAttribute('disabled');
    btnGerarContrato.addEventListener('click', () => {
      if (typeof window.abrirContratoModal === 'function') {
        const nomeCliente = aula.nomeCliente || aula.nome || 'Cliente não identificado';
        const cpfCliente = aula.cpf || '';
        // Buscar endereço completo do cliente na coleção cadastroClientes
        if (cpfCliente) {
          db.collection('cadastroClientes').where('cpf', '==', cpfCliente).get().then(snapshot => {
            if (!snapshot.empty) {
              const data = snapshot.docs[0].data();
              const endereco = data.endereco || '';
              const cep = data.cep || '';
              const cidadeUF = data.cidadeUF || '';
              let enderecoClienteContrato = '';
              if (endereco) enderecoClienteContrato += endereco;
              if (cep) enderecoClienteContrato += (enderecoClienteContrato ? ', ' : '') + 'CEP: ' + cep;
              if (cidadeUF) enderecoClienteContrato += (enderecoClienteContrato ? '. ' : '') + cidadeUF;

              // Extrair estudantes e séries do documento cadastroClientes
              let estudantesText = '';
              let seriesText = '';
              if (Array.isArray(data.estudantes) && data.estudantes.length) {
                const nomes = data.estudantes.map(s => s && s.nome ? String(s.nome).trim() : '').filter(Boolean);
                const series = data.estudantes.map(s => s && s.serie ? String(s.serie).trim() : '').filter(Boolean);
                estudantesText = nomes.join(', ');
                seriesText = series.join(', ');
              }

              window.abrirContratoModal(nomeCliente, cpfCliente, enderecoClienteContrato, estudantesText, seriesText);
            } else {
              // fallback se não encontrar no banco
              const enderecoCliente = aula.enderecoAulas || aula.endereco || '';
              // fallback: extrair estudantes/series do objeto aula quando disponível
              let estudantesTextFallback = '';
              let seriesTextFallback = '';
              if (Array.isArray(aula.estudantes) && aula.estudantes.length) {
                const nomes = aula.estudantes.map(s => s && s.nome ? String(s.nome).trim() : '').filter(Boolean);
                const series = aula.estudantes.map(s => s && s.serie ? String(s.serie).trim() : '').filter(Boolean);
                estudantesTextFallback = nomes.join(', ');
                seriesTextFallback = series.join(', ');
              }
              window.abrirContratoModal(nomeCliente, cpfCliente, enderecoCliente, estudantesTextFallback, seriesTextFallback);
            }
          }).catch(() => {
            const enderecoCliente = aula.enderecoAulas || aula.endereco || '';
            let estudantesTextFallback = '';
            let seriesTextFallback = '';
            if (Array.isArray(aula.estudantes) && aula.estudantes.length) {
              const nomes = aula.estudantes.map(s => s && s.nome ? String(s.nome).trim() : '').filter(Boolean);
              const series = aula.estudantes.map(s => s && s.serie ? String(s.serie).trim() : '').filter(Boolean);
              estudantesTextFallback = nomes.join(', ');
              seriesTextFallback = series.join(', ');
            }
            window.abrirContratoModal(nomeCliente, cpfCliente, enderecoCliente, estudantesTextFallback, seriesTextFallback);
          });
        } else {
          const enderecoCliente = aula.enderecoAulas || aula.endereco || '';
          let estudantesTextFallback = '';
          let seriesTextFallback = '';
          if (Array.isArray(aula.estudantes) && aula.estudantes.length) {
            const nomes = aula.estudantes.map(s => s && s.nome ? String(s.nome).trim() : '').filter(Boolean);
            const series = aula.estudantes.map(s => s && s.serie ? String(s.serie).trim() : '').filter(Boolean);
            estudantesTextFallback = nomes.join(', ');
            seriesTextFallback = series.join(', ');
          }
          window.abrirContratoModal(nomeCliente, cpfCliente, enderecoCliente, estudantesTextFallback, seriesTextFallback);
        }
      } else {
        showToast('Função de contrato não carregada!', 'error');
      }
    });
    
    // Configurar botão de gerar solicitação de aula
    const btnGerarSolicitacao = modal.querySelector('#btn-gerar-solicitacao');
    btnGerarSolicitacao.addEventListener('click', () => {
      const codigoContratacao = aula.codigoContratacao;
      if (codigoContratacao) {
        showModalSolicitacao(codigoContratacao, aula);
      } else {
        showToast('❌ Código de contratação não encontrado', 'error');
      }
    });
    
    // Configurar botão de ver observações (contratação)
    const btnVerObservacoes = modal.querySelector('#btn-ver-observacoes');
    btnVerObservacoes.addEventListener('click', () => {
      showObservacoesModal(aula);
    });

    // Botão editar valores da contratação
    const btnEditarValores = modal.querySelector('#btn-editar-valores-contrato');
    if (btnEditarValores) {
      btnEditarValores.addEventListener('click', () => {
        const elPacote = modal.querySelector('#display-valor-pacote-contrato');
        const elEquipe = modal.querySelector('#display-valor-equipe-contrato');
        const elLucro = modal.querySelector('#display-lucro-master-contrato');

        const parseBR = (str) => {
          if (!str) return 0;
          try {
            const cleaned = String(str).replace(/\s/g, '').replace(/R\$|\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
            const n = Number(cleaned);
            return Number.isFinite(n) ? n : 0;
          } catch (e) { return 0; }
        };

        const initialEquipe = parseBR(elEquipe.textContent || elEquipe.innerText);
        const initialLucro = parseBR(elLucro.textContent || elLucro.innerText);

        const modalHtml = `
          <div class="modal-overlay" id="editarValoresModal" style="z-index:10010;">
            <div class="modal-container" style="max-width:520px;">
              <div class="modal-header">
                <h3 class="font-lexend font-bold text-lg">Editar valores da contratação</h3>
                <button class="modal-close text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
              </div>
              <div class="modal-body">
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Valor para Equipe</label>
                    <input type="text" id="input-valor-equipe-editar" value="${initialEquipe.toFixed(2).replace('.',',')}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Lucro Master</label>
                    <input type="text" id="input-lucro-master-editar" value="${initialLucro.toFixed(2).replace('.',',')}" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <div class="text-xs text-gray-500">Valor do pacote será calculado como soma dos dois campos</div>
                    <div class="text-lg font-bold text-orange-600 mt-2" id="preview-valor-pacote-editar">R$ 0,00</div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button id="btn-cancelar-editar-valores" class="btn-secondary btn-compact">Cancelar</button>
                <button id="btn-aplicar-editar-valores" class="btn-primary btn-compact">Aplicar alterações</button>
              </div>
            </div>
          </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = modalHtml;
        document.body.appendChild(container);

        const m = container.querySelector('#editarValoresModal');
        const closeBtn = m.querySelector('.modal-close');
        const btnCancelar = m.querySelector('#btn-cancelar-editar-valores');
        const btnAplicar = m.querySelector('#btn-aplicar-editar-valores');
        const inputEquipe = m.querySelector('#input-valor-equipe-editar');
        const inputLucro = m.querySelector('#input-lucro-master-editar');
        const previewPacote = m.querySelector('#preview-valor-pacote-editar');

        const formatBR = (v) => {
          if (v === undefined || v === null || v === '') return '--';
          const n = Number(v);
          if (!Number.isFinite(n)) return '--';
          return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        // Máscara simples de moeda (bom UX para preenchimento)
        const attachCurrencyMask = (inputEl) => {
          if (!inputEl) return;
          const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

          const toNumberFromInput = (s) => {
            if (!s) return 0;
            const cleaned = String(s).replace(/[^0-9]/g, ''); // apenas dígitos
            const cents = cleaned === '' ? 0 : parseInt(cleaned, 10);
            return cents / 100;
          };

          const formatFromDigits = (s) => {
            const n = toNumberFromInput(s);
            return formatter.format(n);
          };

          // Ao focar, deixar apenas número (opcional) — manter moeda por consistência
          inputEl.addEventListener('input', (e) => {
            const caret = inputEl.selectionStart;
            const raw = inputEl.value;
            const formatted = formatFromDigits(raw);
            inputEl.value = formatted;
            try { inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length - (formatted.length - (caret || 0)); } catch (err) { /* ignore caret issues */ }
            // disparar input para atualizar preview
            inputEl.dispatchEvent(new Event('input'));
          });

          // On blur, ensure well formatted
          inputEl.addEventListener('blur', () => {
            inputEl.value = formatFromDigits(inputEl.value);
          });
        };

        const parseInput = (s) => {
          if (!s) return 0;
          const cleaned = String(s).trim().replace(/\./g,'').replace(/,/g,'.').replace(/[^0-9.\-]/g,'');
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : 0;
        };

        const updatePreview = () => {
          const e = parseInput(inputEquipe.value);
          const l = parseInput(inputLucro.value);
          previewPacote.textContent = formatBR(e + l);
        };

        // Aplicar máscara e inicializar valores formatados
        try {
          inputEquipe.value = formatBR(initialEquipe);
          inputLucro.value = formatBR(initialLucro);
        } catch (e) { /* ignore */ }

        attachCurrencyMask(inputEquipe);
        attachCurrencyMask(inputLucro);

        inputEquipe.addEventListener('input', updatePreview);
        inputLucro.addEventListener('input', updatePreview);

        // init preview
        updatePreview();

        const closeModal = () => {
          try {
            const modalOverlay = container.querySelector('#editarValoresModal');
            if (modalOverlay && modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
          } catch (e) { /* ignore */ }
          try { container.remove(); } catch (e) { /* ignore */ }
        };
        closeBtn.addEventListener('click', closeModal);
        btnCancelar.addEventListener('click', closeModal);

        m.addEventListener('click', (ev) => { if (ev.target === m) closeModal(); });

        const escHandler = (ev) => { if (ev.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', escHandler);
        container.addEventListener('remove', () => { document.removeEventListener('keydown', escHandler); });

        btnAplicar.addEventListener('click', async () => {
          try {
            btnAplicar.disabled = true;
            btnAplicar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Aplicando...';

            const valEquipe = parseInput(inputEquipe.value);
            const valLucro = parseInput(inputLucro.value);
            const valPacote = Number((valEquipe + valLucro).toFixed(2));

            // Atualizar no banco (document id = codigoContratacao)
            await BANCO.updateAula(codigoContratacao, {
              ValorEquipe: valEquipe,
              lucroMaster: valLucro,
              ValorPacote: valPacote,
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Atualizar UI
            elEquipe.textContent = formatBR(valEquipe);
            elLucro.textContent = formatBR(valLucro);
            elPacote.textContent = formatBR(valPacote);
            // Valor Hora/Aula definido pelo input-valor-equipe-editar (conforme regra)
            try {
              const elHoraAula = document.getElementById('display-hora-aula-contrato');
              if (elHoraAula) elHoraAula.textContent = formatBR(valEquipe);
            } catch (e) { /* ignore */ }

            showToast('✅ Valores atualizados com sucesso', 'success');
            closeModal();

            // Recarregar detalhes se estiver visível
            try { await loadAulasDetalhadas(codigoContratacao); } catch (e) { /* ignore */ }
          } catch (err) {
            console.error('Erro ao aplicar valores', err);
            showToast('❌ Erro ao aplicar valores: ' + (err && err.message ? err.message : ''), 'error');
            btnAplicar.disabled = false;
            btnAplicar.innerHTML = 'Aplicar alterações';
          }
        });
      });
    }

    // Preencher Estudante e Série a partir da coleção cadastroClientes usando CPF
    (function populateEstudantesFromCPF() {
      const elEstudantes = modal.querySelector('#modal-estudantes');
      const elSeries = modal.querySelector('#modal-series');
      if (!elEstudantes && !elSeries) return;

      const cpfCliente = aula.cpf || '';
      const nomes = [];
      const series = [];

      const applyResults = () => {
        if (elEstudantes) elEstudantes.textContent = nomes.length ? nomes.join(', ') : '--';
        if (elSeries) elSeries.textContent = series.length ? series.join(', ') : '--';
      };

      if (cpfCliente) {
        db.collection('cadastroClientes').where('cpf', '==', cpfCliente).get().then(snapshot => {
          if (!snapshot.empty) {
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              if (Array.isArray(data.estudantes)) {
                data.estudantes.forEach(est => {
                  const nome = est && est.nome ? String(est.nome).trim() : '';
                  const serie = est && est.serie ? String(est.serie).trim() : '';
                  if (nome) nomes.push(nome);
                  if (serie) series.push(serie);
                  console.log('Estudante encontrado (cadastroClientes):', { docId: doc.id, nome, serie });
                });
              }
            });
            applyResults();
          } else {
            console.log('Nenhum documento cadastroClientes encontrado para CPF', cpfCliente);
            // fallback para dados presentes em `aula`
            if (Array.isArray(aula.estudantes) && aula.estudantes.length > 0) {
              aula.estudantes.forEach(est => {
                const nome = est && est.nome ? String(est.nome).trim() : '';
                const serie = est && est.serie ? String(est.serie).trim() : '';
                if (nome) nomes.push(nome);
                if (serie) series.push(serie);
                console.log('Estudante encontrado (aula):', { nome, serie });
              });
              applyResults();
            } else {
              applyResults();
            }
          }
        }).catch(err => {
          console.error('Erro ao buscar cadastroClientes por CPF', cpfCliente, err);
          // tentar fallback local
          if (Array.isArray(aula.estudantes) && aula.estudantes.length > 0) {
            aula.estudantes.forEach(est => {
              const nome = est && est.nome ? String(est.nome).trim() : '';
              const serie = est && est.serie ? String(est.serie).trim() : '';
              if (nome) nomes.push(nome);
              if (serie) series.push(serie);
              console.log('Estudante encontrado (aula - fallback):', { nome, serie });
            });
            applyResults();
          } else {
            applyResults();
          }
        });
      } else {
        // Sem CPF: usar diretamente `aula.estudantes` quando disponível
        if (Array.isArray(aula.estudantes) && aula.estudantes.length > 0) {
          aula.estudantes.forEach(est => {
            const nome = est && est.nome ? String(est.nome).trim() : '';
            const serie = est && est.serie ? String(est.serie).trim() : '';
            if (nome) nomes.push(nome);
            if (serie) series.push(serie);
            console.log('Estudante encontrado (aula - sem CPF):', { nome, serie });
          });
        }
        applyResults();
      }
    })();

    // Configurar ícones de observação das aulas (cada linha da tabela)
    const btnsObservacoesAula = modal.querySelectorAll('.btn-observacao-aula');
    btnsObservacoesAula.forEach(btn => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.observacao ? decodeURIComponent(btn.dataset.observacao) : '';
        const content = `
          <div class="p-4">
            <div class="max-h-96 overflow-y-auto bg-white p-3 rounded border border-gray-200 text-sm">
              <p class="text-gray-700 whitespace-pre-wrap">${escapeHtml(raw)}</p>
            </div>
          </div>
        `;

        const { modal: obsModal, closeModal: closeObs } = createModal('Observação da Aula', content, [
          { text: 'Fechar', classes: 'btn-secondary btn-compact' }
        ]);

        // Fechar com o botão
        const btnFecharObs = obsModal.querySelector('.btn-secondary.btn-compact');
        if (btnFecharObs) btnFecharObs.addEventListener('click', closeObs);
      });
    });

    // Configurar ícones de relatório das aulas (cada linha da tabela)
    const btnsRelatorioAula = modal.querySelectorAll('.btn-relatorio-aula');
    btnsRelatorioAula.forEach(btn => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.relatorio ? decodeURIComponent(btn.dataset.relatorio) : '';
        const index = parseInt(btn.dataset.aulaIndex, 10);
        if (Number.isNaN(index)) { showToast('Erro: índice da aula inválido', 'error'); return; }
        const contratoId = btn.dataset.contratoId && btn.dataset.contratoId !== 'undefined' ? btn.dataset.contratoId : aula.id;

        const content = `
          <div class="p-4">
            <div class="max-h-72 overflow-y-auto bg-white p-3 rounded border border-gray-200 text-sm">
              <p class="text-gray-700 whitespace-pre-wrap">${escapeHtml(raw)}</p>
            </div>
            <div id="relatorio-status-area" class="mt-4"></div>
          </div>
        `;

        const { modal: relModal, closeModal: closeRel } = createModal('Relatório da Aula', content, [
          { text: 'Fechar', classes: 'btn-secondary btn-compact', attributes: 'id="btn-fechar-relatorio"' },
          { text: 'Editar', classes: 'btn-secondary btn-compact', attributes: 'id="btn-editar-relatorio"' },
          { text: 'Disponibilizar o relatório', classes: 'btn-secondary btn-compact', attributes: 'id="btn-disponibilizar-relatorio"' }
        ]);

        const btnFechar = relModal.querySelector('#btn-fechar-relatorio');
        const btnEditar = relModal.querySelector('#btn-editar-relatorio');
        const btnDisponibilizar = relModal.querySelector('#btn-disponibilizar-relatorio');
        const statusArea = relModal.querySelector('#relatorio-status-area');

        if (btnFechar) btnFechar.addEventListener('click', closeRel);

        const renderStatus = (checked) => {
          statusArea.innerHTML = `
            <div class="flex items-center space-x-3">
              <div class="text-sm text-gray-600">Disponibilizar relatório</div>
              <button id="switch-disponibilizar" class="w-12 h-7 rounded-full p-1 focus:outline-none ${checked ? 'bg-green-500' : 'bg-gray-300'}">
                <span class="block w-5 h-5 bg-white rounded-full transform ${checked ? 'translate-x-5' : 'translate-x-0'} transition"></span>
              </button>
              <div id="label-disponibilizar" class="text-sm">${checked ? 'Sim' : 'Não'}</div>
            </div>
          `;

          const switchBtn = relModal.querySelector('#switch-disponibilizar');
          if (!switchBtn) return;

          switchBtn.addEventListener('click', async () => {
            const newChecked = !(aula.aulas && aula.aulas[index] && aula.aulas[index].disponibilizarRelatorio === 'sim');

            try {
              const newAulas = JSON.parse(JSON.stringify(aula.aulas || []));
              newAulas[index] = newAulas[index] || {};
              newAulas[index].disponibilizarRelatorio = newChecked ? 'sim' : 'nao';

              await BANCO.updateAula(contratoId, { aulas: newAulas, timestamp: firebase.firestore.FieldValue.serverTimestamp() });

              // Atualizar UI local
              aula.aulas = newAulas;

              // Atualizar label e switch visual
              renderStatus(newChecked);

              showToast('✅ Disponibilidade atualizada', 'success');
            } catch (err) {
              console.error('❌ Erro ao atualizar disponibilizarRelatorio', err);
              showToast('❌ Erro ao atualizar disponibilidade', 'error');
            }
          }, { once: true });
        };

        // Disponibilizar button shows the switch area
        if (btnDisponibilizar) {
          btnDisponibilizar.addEventListener('click', () => {
            const current = aula.aulas && aula.aulas[index] && aula.aulas[index].disponibilizarRelatorio === 'sim';
            renderStatus(current);
          });
        }

        // Editar fluxo para o relatório
        if (btnEditar) {
          btnEditar.addEventListener('click', () => {
            const currentText = aula.aulas && aula.aulas[index] && aula.aulas[index].RelatorioAula || '';
            const editArea = relModal.querySelector('.max-h-72');
            editArea.innerHTML = `
              <textarea id="textarea-relatorio" class="w-full h-40 p-3 border rounded text-sm" placeholder="Digite o relatório...">${escapeHtml(currentText)}</textarea>
            `;

            const footer = relModal.querySelector('.modal-footer');

            const btnCancelar = document.createElement('button');
            btnCancelar.id = 'btn-cancelar-editar-relatorio';
            btnCancelar.className = 'btn-secondary btn-compact ml-2';
            btnCancelar.textContent = 'Cancelar';

            const btnSalvar = document.createElement('button');
            btnSalvar.id = 'btn-salvar-relatorio';
            btnSalvar.className = 'btn-primary btn-compact ml-2';
            btnSalvar.textContent = 'Salvar';

            footer.appendChild(btnCancelar);
            footer.appendChild(btnSalvar);

            btnCancelar.addEventListener('click', () => {
              // Reverter área de edição
              editArea.innerHTML = `<p class="text-gray-700 whitespace-pre-wrap">${escapeHtml(currentText)}</p>`;
              btnSalvar.remove();
              btnCancelar.remove();
            });

            btnSalvar.addEventListener('click', async () => {
              const novoTexto = relModal.querySelector('#textarea-relatorio').value.trim();
              btnSalvar.disabled = true;
              const originalHtml = btnSalvar.innerHTML;
              btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

              try {
                const newAulas = JSON.parse(JSON.stringify(aula.aulas || []));
                newAulas[index] = newAulas[index] || {};
                newAulas[index].RelatorioAula = novoTexto;

                await BANCO.updateAula(contratoId, { aulas: newAulas, timestamp: firebase.firestore.FieldValue.serverTimestamp() });

                aula.aulas = newAulas;

                // Atualizar ícone do botão na tabela do modal principal
                const parentBtn = modal.querySelector(`.btn-relatorio-aula[data-aula-index="${index}"]`);
                if (parentBtn) {
                  parentBtn.dataset.relatorio = encodeURIComponent(novoTexto);
                  const icon = parentBtn.querySelector('i');
                  if (icon) {
                    if (novoTexto) {
                      icon.classList.remove('text-gray-300'); icon.classList.add('text-green-500');
                    } else {
                      icon.classList.remove('text-green-500'); icon.classList.add('text-gray-300');
                    }
                  }
                }

                showToast('✅ Relatório salvo com sucesso', 'success');

                // Reverter área de edição
                editArea.innerHTML = `<p class="text-gray-700 whitespace-pre-wrap">${escapeHtml(novoTexto)}</p>`;
                btnSalvar.remove();
                btnCancelar.remove();
              } catch (err) {
                console.error('❌ Erro ao salvar relatório:', err);
                showToast('❌ Erro ao salvar relatório', 'error');
                btnSalvar.disabled = false;
                btnSalvar.innerHTML = originalHtml;
              }
            });
          });
        }
      });
    });
  }
  
  // Função para mostrar modal de observações
  function showObservacoesModal(aula) {
    const observacoesOriginais = aula.ObservacaoContratacao || 'Nenhuma observação registrada.';
    
    const { modal, closeModal } = createModal(
      'Observações da Contratação',
      `
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="text-sm text-gray-600 mb-2">
            <i class="fas fa-info-circle text-orange-500 mr-2"></i>
            Observações registradas para esta contratação:
          </div>
          <div class="bg-white p-4 rounded border border-gray-200 max-h-96 overflow-y-auto">
            <p class="text-gray-700 whitespace-pre-wrap">${observacoesOriginais}</p>
          </div>
        </div>
      `,
      [
        {
          text: 'Fechar',
          classes: 'btn-secondary btn-compact',
          attributes: 'id="btn-fechar-observacoes"'
        },
        {
          text: 'Editar',
          classes: 'btn-secondary btn-compact',
          attributes: 'id="btn-editar-observacoes"'
        }
      ]
    );

    // Elementos
    const btnFechar = modal.querySelector('#btn-fechar-observacoes');
    const btnEditar = modal.querySelector('#btn-editar-observacoes');
    const contentWrapper = modal.querySelector('.modal-body > div');

    if (btnFechar) btnFechar.addEventListener('click', closeModal);

    // Função para renderizar o visual somente leitura
    const renderReadOnly = (text) => {
      contentWrapper.innerHTML = `
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="text-sm text-gray-600 mb-2">
            <i class="fas fa-info-circle text-orange-500 mr-2"></i>
            Observações registradas para esta contratação:
          </div>
          <div class="bg-white p-4 rounded border border-gray-200 max-h-96 overflow-y-auto">
            <p class="text-gray-700 whitespace-pre-wrap">${text || 'Nenhuma observação registrada.'}</p>
          </div>
        </div>
      `;
    };

    // Entrar em modo de edição
    const enterEditMode = () => {
      const currentText = aula.ObservacaoContratacao || '';

      contentWrapper.innerHTML = `
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="text-sm text-gray-600 mb-2">
            <i class="fas fa-edit text-orange-500 mr-2"></i>
            Editar observações:
          </div>
          <div class="bg-white p-4 rounded border border-gray-200 max-h-96">
            <textarea id="textarea-observacoes" class="w-full h-40 p-3 border rounded text-sm" placeholder="Digite observações...">${currentText || ''}</textarea>
          </div>
        </div>
      `;

      // Alterar botões: esconder 'Editar' e adicionar 'Salvar' e 'Cancelar'
      btnEditar.style.display = 'none';

      const footer = modal.querySelector('.modal-footer');

      const btnCancelar = document.createElement('button');
      btnCancelar.id = 'btn-cancelar-edicao-observacoes';
      btnCancelar.className = 'btn-secondary btn-compact ml-2';
      btnCancelar.textContent = 'Cancelar';

      const btnSalvar = document.createElement('button');
      btnSalvar.id = 'btn-salvar-observacoes';
      btnSalvar.className = 'btn-primary btn-compact ml-2';
      btnSalvar.innerHTML = 'Salvar';

      footer.appendChild(btnCancelar);
      footer.appendChild(btnSalvar);

      const textarea = modal.querySelector('#textarea-observacoes');
      textarea.focus();

      btnCancelar.addEventListener('click', () => {
        // Reverter para leitura
        renderReadOnly(aula.ObservacaoContratacao);
        btnSalvar.remove();
        btnCancelar.remove();
        btnEditar.style.display = '';
      });

      btnSalvar.addEventListener('click', async () => {
        const novoTexto = textarea.value.trim();
        btnSalvar.disabled = true;
        const originalHTML = btnSalvar.innerHTML;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';

        try {
          await BANCO.updateAula(aula.id, { ObservacaoContratacao: novoTexto, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
          showToast('✅ Observações atualizadas com sucesso!', 'success');

          // Atualizar o objeto local (para próxima vez que abrir)
          aula.ObservacaoContratacao = novoTexto;

          // Re-renderizar em modo leitura com novo texto
          renderReadOnly(novoTexto);

          // Remover botões temporários e mostrar 'Editar' novamente
          btnSalvar.remove();
          btnCancelar.remove();
          btnEditar.style.display = '';
        } catch (error) {
          console.error('❌ Erro ao salvar observações:', error);
          showToast('❌ Erro ao salvar observações', 'error');
          btnSalvar.disabled = false;
          btnSalvar.innerHTML = originalHTML;
        }
      });
    };

    // Evento do botão Editar
    if (btnEditar) {
      btnEditar.addEventListener('click', enterEditMode);
    }
  }
  
  // Função para abrir modal de edição
  function openEditModal(aula) {
    console.log('✏️ Abrindo modal de edição para:', aula.id);
    
    // HTML do modal de edição
    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal-container max-w-4xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg text-gray-800">
              <i class="fas fa-edit text-orange-500 mr-2"></i>
              Editar Contratação - ${aula.codigoContratacao || 'Sem código'}
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body vertical-scroll-hidden">
            <form id="form-editar-contratacao" class="space-y-4">
              <!-- Grid de informações -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Coluna 1 -->
                <div class="space-y-4">
                  <!-- Status do Contrato -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-file-contract text-orange-500 mr-1"></i>
                      Status do Contrato
                    </label>
                    <select 
                      id="status-contrato" 
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="Pendente de assinatura" ${aula.statusContrato === 'Pendente de assinatura' ? 'selected' : ''}>
                        Pendente de assinatura
                      </option>
                      <option value="Contrato assinado" ${aula.statusContrato === 'Contrato assinado' ? 'selected' : ''}>
                        Contrato assinado
                      </option>
                    </select>
                  </div>
                  
                  <!-- Assinatura do Contrato -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-calendar-check text-orange-500 mr-1"></i>
                      Assinatura do Contrato
                    </label>
                    <input 
                      type="text" 
                      id="data-assinatura-contrato" 
                      value="${formatDate(aula.dataAssinaturaContrato) || ''}" 
                      placeholder="dd/mm/aaaa"
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      maxlength="10"
                    />
                  </div>
                  
                  <!-- Método de Pagamento -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-credit-card text-orange-500 mr-1"></i>
                      Método de Pagamento
                    </label>
                    <select 
                      id="metodo-pagamento" 
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="Cartão de crédito" ${aula.modoPagamento === 'Cartão de crédito' ? 'selected' : ''}>Cartão de crédito</option>
                      <option value="Pix completo" ${aula.modoPagamento === 'Pix completo' ? 'selected' : ''}>Pix completo</option>
                      <option value="Pix dividido" ${aula.modoPagamento === 'Pix dividido' ? 'selected' : ''}>Pix dividido</option>
                    </select>
                  </div>
                </div>
                
                <!-- Coluna 2 -->
                <div class="space-y-4">
                  <!-- Status do Pagamento -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-money-bill-wave text-orange-500 mr-1"></i>
                      Status do Pagamento
                    </label>
                    <div id="container-status-pagamento">
                      ${aula.modoPagamento === 'Pix dividido' ? `
                        <select 
                          id="status-pagamento" 
                          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="Aguardando 1º Pagamento" ${aula.statusPagamento === 'Aguardando 1º Pagamento' ? 'selected' : ''}>Aguardando 1º Pagamento</option>
                          <option value="Aguardando 2º Pagamento" ${aula.statusPagamento === 'Aguardando 2º Pagamento' ? 'selected' : ''}>Aguardando 2º Pagamento</option>
                          <option value="Pagamento completo" ${aula.statusPagamento === 'Pagamento completo' ? 'selected' : ''}>Pagamento completo</option>
                        </select>
                      ` : `
                        <input 
                          type="text" 
                          id="status-pagamento" 
                          value="Pagamento completo" 
                          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          readonly
                        />
                        <p class="text-xs text-gray-500 mt-1">Para métodos não Pix dividido, o status é automaticamente "Pagamento completo"</p>
                      `}
                    </div>
                  </div>
                  
                  <!-- Data da Primeira Parcela -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-calendar-day text-orange-500 mr-1"></i>
                      Data da primeira parcela
                    </label>
                    <input 
                      type="text" 
                      id="data-primeira-parcela" 
                      value="${formatDate(aula.dataPrimeiraParcela) || ''}" 
                      placeholder="dd/mm/aaaa"
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      maxlength="10"
                    />
                  </div>
                  
                  <!-- Data da Segunda Parcela -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      <i class="fas fa-calendar-day text-orange-500 mr-1"></i>
                      Data da segunda parcela
                    </label>
                    <input 
                      type="text" 
                      id="data-segunda-parcela" 
                      value="${formatDate(aula.dataSegundaParcela) || ''}" 
                      placeholder="dd/mm/aaaa"
                      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      maxlength="10"
                    />
                  </div>
                </div>
              </div>
              
              <!-- Observações -->
              <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  <i class="fas fa-sticky-note text-orange-500 mr-1"></i>
                  Observações da Contratação
                </label>
                <textarea 
                  id="observacoes-contratacao" 
                  rows="3"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Digite observações sobre esta contratação..."
                >${aula.ObservacaoContratacao || ''}</textarea>
              </div>
              

            </form>
          </div>
          
          <div class="modal-footer">
            <button type="button" id="btn-cancelar-edicao" class="btn-secondary btn-compact">
              Cancelar
            </button>
            <button type="button" id="btn-salvar-edicao" class="btn-primary btn-compact">
              <i class="fas fa-save mr-1"></i>
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar modal ao body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Configurar eventos
    const modal = modalContainer.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const btnCancelar = modal.querySelector('#btn-cancelar-edicao');
    const btnSalvar = modal.querySelector('#btn-salvar-edicao');
    const form = modal.querySelector('#form-editar-contratacao');
    const metodoPagamentoSelect = modal.querySelector('#metodo-pagamento');
    const containerStatusPagamento = modal.querySelector('#container-status-pagamento');
    
    // Fechar modal
    const closeModal = () => {
      modalContainer.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    btnCancelar.addEventListener('click', closeModal);
    
    // Evento para mudança no método de pagamento
    metodoPagamentoSelect.addEventListener('change', function() {
      const metodoSelecionado = this.value;
      
      if (metodoSelecionado === 'Pix dividido') {
        containerStatusPagamento.innerHTML = `
          <select 
            id="status-pagamento" 
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="Aguardando 1º Pagamento" ${aula.statusPagamento === 'Aguardando 1º Pagamento' ? 'selected' : ''}>Aguardando 1º Pagamento</option>
            <option value="Aguardando 2º Pagamento" ${aula.statusPagamento === 'Aguardando 2º Pagamento' ? 'selected' : ''}>Aguardando 2º Pagamento</option>
            <option value="Pagamento completo" ${aula.statusPagamento === 'Pagamento completo' ? 'selected' : ''}>Pagamento completo</option>
          </select>
        `;
      } else {
        containerStatusPagamento.innerHTML = `
          <input 
            type="text" 
            id="status-pagamento" 
            value="Pagamento completo" 
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            readonly
          />
          <p class="text-xs text-gray-500 mt-1">Para métodos não Pix dividido, o status é automaticamente "Pagamento completo"</p>
        `;
      }
    });
    
    // Adicionar máscara de data aos campos
    const inputsData = modal.querySelectorAll('input[type="text"][placeholder="dd/mm/aaaa"]');
    inputsData.forEach(input => {
      input.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 2 && value.length <= 4) {
          value = value.replace(/(\d{2})(\d{1,2})/, '$1/$2');
        } else if (value.length > 4) {
          value = value.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
        }
        
        e.target.value = value.substring(0, 10);
      });
    });
    
    // Evento para salvar alterações
    btnSalvar.addEventListener('click', async () => {
      // Coletar dados do formulário (não bloqueamos por validações; apenas coletamos avisos)
      const dadosAtualizados = {
        statusContrato: modal.querySelector('#status-contrato').value,
        dataAssinaturaContrato: modal.querySelector('#data-assinatura-contrato').value,
        modoPagamento: metodoPagamentoSelect.value,
        statusPagamento: modal.querySelector('#status-pagamento').value || 'Pagamento completo',
        dataPrimeiraParcela: modal.querySelector('#data-primeira-parcela').value,
        dataSegundaParcela: modal.querySelector('#data-segunda-parcela').value,
        ObservacaoContratacao: modal.querySelector('#observacoes-contratacao').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Coletar possíveis erros/avisos (sem impedir o salvamento)
      const errors = [];
      const dataRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      const camposData = [
        { campo: 'dataAssinaturaContrato', nome: 'Assinatura do Contrato' },
        { campo: 'dataPrimeiraParcela', nome: 'Data da primeira parcela' },
        { campo: 'dataSegundaParcela', nome: 'Data da segunda parcela' }
      ];

      for (const { campo, nome } of camposData) {
        if (dadosAtualizados[campo] && dadosAtualizados[campo].trim() !== '') {
          if (!dataRegex.test(dadosAtualizados[campo])) {
            errors.push(`${nome} incompleta ou inválida`);
          }
        }
      }

      if (!dadosAtualizados.modoPagamento) {
        errors.push('Nenhum método de pagamento selecionado');
      }

      // Função que executa o salvamento efetivo
      const doSave = async () => {
        const originalText = btnSalvar.innerHTML;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
        btnSalvar.disabled = true;

        try {
          await BANCO.updateAula(aula.id, dadosAtualizados);
          showToast('✅ Contratação atualizada com sucesso!', 'success');
          closeModal();

          // Recarregar os dados
          if (typeof loadBancoDeAulas === 'function') {
            loadBancoDeAulas();
          }
        } catch (error) {
          console.error('❌ Erro ao atualizar contratação:', error);
          showToast('❌ Erro ao atualizar contratação', 'error');
          btnSalvar.innerHTML = originalText;
          btnSalvar.disabled = false;
        }
      };

      // Se houver erros, mostrar modal de confirmação com lista e opções
      if (errors.length > 0) {
        const errorsHtml = `<ul class="text-left list-disc ml-4">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        const { modal: confirmModal, closeModal: closeConfirm } = createModal(
          'Problemas encontrados',
          `
            <div class="p-4 text-sm text-gray-700">
              Foram encontrados os seguintes problemas no preenchimento:
              ${errorsHtml}
              <p class="mt-3">Deseja salvar mesmo assim?</p>
            </div>
          `,
          [
            { text: 'Voltar', classes: 'btn-secondary btn-compact', attributes: 'id="btn-voltar-confirm"' },
            { text: 'Salvar mesmo assim', classes: 'btn-primary btn-compact', attributes: 'id="btn-salvar-confirm"' }
          ]
        );

        const btnVoltar = confirmModal.querySelector('#btn-voltar-confirm');
        const btnSalvarConfirm = confirmModal.querySelector('#btn-salvar-confirm');

        if (btnVoltar) btnVoltar.addEventListener('click', () => closeConfirm());

        if (btnSalvarConfirm) {
          btnSalvarConfirm.addEventListener('click', async () => {
            btnSalvarConfirm.disabled = true;
            btnSalvarConfirm.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
            await doSave();
            closeConfirm();
          });
        }

        return; // Não salvar imediatamente — aguardamos a confirmação
      }

      // Sem erros, salvar diretamente
      await doSave();
    });
    
    // Fechar modal ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Fechar com ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para determinar classe do badge de status
  function getStatusBadgeClass(status) {
    if (!status) return 'info';
    
    const statusLower = status.toLowerCase();
    
    // Status específicos de aulas com cores definidas
    if (statusLower === 'pendente') return 'status-pendente';
    if (statusLower === 'reagendada') return 'status-reagendada';
    if (statusLower === 'concluída') return 'status-concluida';
    if (statusLower === 'reposição') return 'status-reposicao';
    if (statusLower === 'cancelada') return 'status-cancelada';
    
    // Status genéricos (para outras partes do sistema)
    if (statusLower.includes('ativo') || statusLower.includes('efetuado') || 
        statusLower.includes('concluído') || statusLower.includes('pago') ||
        statusLower.includes('assinado') || statusLower.includes('completo')) {
      return 'success';
    }
    
    if (statusLower.includes('inativo') || statusLower.includes('cancelado') || 
        statusLower.includes('vencido')) {
      return 'error';
    }
    
    if (statusLower.includes('parcial') || statusLower.includes('processando')) {
      return 'warning';
    }
    
    return 'info';
  }
  
  // Função para obter as cores do status
  function getStatusColors(status) {
    const statusMap = {
      'Pendente': { cor: '#9CA3AF', bgColor: '#F3F4F6', borderColor: '#D1D5DB' },
      'Reagendada': { cor: '#F59E0B', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
      'Concluída': { cor: '#10B981', bgColor: '#D1FAE5', borderColor: '#6EE7B7' },
      'Reposição': { cor: '#3B82F6', bgColor: '#DBEAFE', borderColor: '#93C5FD' },
      'Cancelada': { cor: '#EF4444', bgColor: '#FEE2E2', borderColor: '#FCA5A5' }
    };
    
    return statusMap[status] || { cor: '#6B7280', bgColor: '#F3F4F6', borderColor: '#D1D5DB' };
  }

  // Pequena função utilitária para escapar HTML em strings antes de injetar em templates
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Formatar número para moeda BR
  function formatCurrencyBR(value) {
    const num = Number(value);
    if (!isFinite(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  
  // Renderizar aulas detalhadas para o modal
  function renderAulasDetalhadas(aulas, contratoId) {
    if (!aulas || aulas.length === 0) {
      return '<p class="text-gray-500 text-center py-4 text-sm">Nenhuma aula agendada</p>';
    }
    
    let html = `
      <table class="table-details">
        <thead>
          <tr>
            <th>Data da aula</th>
            <th>Horário de Início</th>
            <th>Duração</th>
            <th>Matéria</th>
            <th>Professor</th>
            <th>Valor da Aula</th>
            <th>Estudante</th>
            <th>Status</th>
            <th class="text-center">Aula concluída</th>
            <th class="text-center">Relatório</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody id="tbody-aulas-detalhadas">
          <tr>
            <td colspan="11" class="text-center py-8">
              <div class="flex flex-col items-center justify-center">
                <div class="loading-spinner-large mb-3"></div>
                <p class="text-orange-500 font-comfortaa font-bold">Carregando aulas...</p>
                <p class="text-sm text-gray-500 mt-1">Buscando dados detalhados</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
    
    return html;
  }
  
  // Função para carregar aulas da BancoDeAulas-Lista
  async function loadAulasDetalhadas(codigoContratacao) {
    const tbody = document.getElementById('tbody-aulas-detalhadas');
    if (!tbody) {
      console.error('❌ tbody-aulas-detalhadas não encontrado');
      return;
    }
    
    try {
      console.log('📥 Carregando aulas detalhadas para código:', codigoContratacao);
      
      // Buscar aulas da BancoDeAulas-Lista
      const aulas = await BANCO.fetchBancoDeAulasLista(codigoContratacao);
      
      if (!aulas || aulas.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" class="text-center py-8">
              <i class="fas fa-inbox text-3xl text-gray-300 mb-3"></i>
              <p class="text-gray-500">Nenhuma aula encontrada para este código</p>
            </td>
          </tr>
        `;
        return;
      }
      
      // Ordenar aulas por data crescente
      aulas.sort((a, b) => {
        const dataA = a.data || '';
        const dataB = b.data || '';
        
        // Converter formato "ddd - dd/mm/yyyy" para comparação
        // Exemplo: "seg - 10/01/2026"
        const parseData = (dataStr) => {
          if (!dataStr) return new Date(0); // Data vazia vai para o início
          
          const match = dataStr.match(/\w{3} - (\d{2})\/(\d{2})\/(\d{4})/);
          if (!match) return new Date(0);
          
          const dia = parseInt(match[1]);
          const mes = parseInt(match[2]) - 1; // JavaScript mês é 0-indexed
          const ano = parseInt(match[3]);
          
          return new Date(ano, mes, dia);
        };
        
        const timestampA = parseData(dataA).getTime();
        const timestampB = parseData(dataB).getTime();
        
        return timestampA - timestampB;
      });
      
      console.log('📊 Aulas ordenadas por data crescente');
      
      // Helper: parse BRL string to Number
      const parseBR = (str) => {
        if (!str) return 0;
        try {
          const cleaned = String(str).replace(/\s/g, '').replace(/R\$|\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : 0;
        } catch (e) { return 0; }
      };

      // Renderizar as aulas
      let html = '';
      let somaValorAulas = 0;
      // valor por hora atual exibido no modal (pode mudar dinamicamente)
      const elHoraAulaContrato = document.getElementById('display-hora-aula-contrato');
      const valorHoraContratoAtual = parseBR(elHoraAulaContrato ? (elHoraAulaContrato.textContent || elHoraAulaContrato.innerText) : 'R$ 0,00');

      aulas.forEach((aula, index) => {
        const statusAula = aula.StatusAula || 'Pendente';
        const statusClass = getStatusBadgeClass(statusAula);
        const statusColors = getStatusColors(statusAula);
        const confirmada = aula.ConfirmacaoProfessorAula === true;
        
        html += `
          <tr>
            <td>
              <button type="button" class="btn-data-aula text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-id-aula="${aula['id-Aula']}" data-data="${aula.data || ''}" title="Clique para alterar a data">
                ${aula.data || '--'}
              </button>
            </td>
            <td class="text-center">
              <button type="button" class="btn-horario-aula text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-id-aula="${aula['id-Aula']}" data-horario="${aula.horario || ''}" title="Clique para alterar o horário">
                ${aula.horario || '--'}
              </button>
            </td>
            <td class="text-center">
              <button type="button" class="btn-duracao-aula text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-id-aula="${aula['id-Aula']}" data-duracao="${aula.duracao || ''}" title="Clique para alterar a duração">
                ${aula.duracao || '--'}
              </button>
            </td>
            <td class="text-center">
              <button type="button" class="btn-materia-aula text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-id-aula="${aula['id-Aula']}" data-materia="${aula.materia || ''}" title="Clique para alterar a matéria">
                ${aula.materia || '--'}
              </button>
            </td>
            <td>
              <button type="button" class="btn-professor-aula text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors ${!aula.professor || aula.professor === 'A definir' ? 'text-orange-500 font-semibold' : ''}" data-id-aula="${aula['id-Aula']}" data-professor="${aula.professor || 'A definir'}" data-id-professor="${aula.idProfessor || ''}" title="Clique para alterar o professor">
                ${aula.professor || 'A definir'}
              </button>
            </td>
            <td class="text-right font-mono text-sm">
              ${(() => {
                try {
                  const mm = (aula.duracao && typeof aula.duracao === 'string') ? aula.duracao.match(/(\d+)h(?:([0-5]\d))?/) : null;
                  const hours = mm ? parseInt(mm[1], 10) : 0;
                  const minutes = (mm && mm[2]) ? parseInt(mm[2], 10) : 0;
                  const totalHoursDecimal = (hours * 60 + minutes) / 60;
                  const computed = Number((totalHoursDecimal * valorHoraContratoAtual).toFixed(2));
                  somaValorAulas += isFinite(computed) ? computed : 0;
                  return formatCurrencyBR(computed);
                } catch (e) { return formatCurrencyBR(0); }
              })()}
            </td>
            <td>
              <button type="button" class="btn-estudante-aula text-sm px-2 py-1 cursor-pointer hover:bg-orange-50 rounded transition-colors" data-id-aula="${aula['id-Aula']}" data-estudante="${aula.estudante || ''}" title="Clique para alterar o estudante">
                ${aula.estudante || '--'}
              </button>
            </td>
            <td>
              <button type="button" class="btn-status-aula text-xs px-3 py-1.5 cursor-pointer transition-all rounded font-medium" data-id-aula="${aula['id-Aula']}" data-status="${statusAula}" title="Clique para alterar o status" style="background-color: ${statusColors.bgColor}; color: ${statusColors.cor}; border: 1px solid ${statusColors.borderColor};">
                ${statusAula}
              </button>
            </td>
            <td class="text-center">
              <div class="inline-flex items-center justify-center">
                <div class="switch-toggle ${confirmada ? 'switch-active' : 'switch-inactive'}">
                  <div class="switch-slider"></div>
                </div>
              </div>
            </td>
            <td class="text-center">
              <button type="button" class="btn-relatorio-aula inline-flex items-center justify-center w-8 h-8 rounded" data-relatorio="${encodeURIComponent(aula.RelatorioAula || '')}" data-id-aula="${aula['id-Aula']}" data-aula-index="${index}" title="${aula.RelatorioAula ? 'Ver relatório' : 'Sem relatório'}">
                <i class="fas fa-comment-dots text-lg ${aula.RelatorioAula ? 'text-green-500' : 'text-gray-300'}" aria-hidden="true"></i>
                <span class="sr-only">${aula.RelatorioAula ? 'Ver relatório' : 'Sem relatório'}</span>
              </button>
            </td>
            <td class="text-center">
              <button type="button" class="btn-observacao-aula inline-flex items-center justify-center w-8 h-8 rounded" data-observacao="${encodeURIComponent(aula.ObservacoesAula || '')}" data-id-aula="${aula['id-Aula']}" title="${aula.ObservacoesAula ? 'Ver observação' : 'Sem observação'}">
                <i class="fas fa-clipboard-list text-lg ${aula.ObservacoesAula ? 'text-green-500' : 'text-gray-300'}" aria-hidden="true"></i>
                <span class="sr-only">${aula.ObservacoesAula ? 'Ver observação' : 'Sem observação'}</span>
              </button>
            </td>
          </tr>
        `;
      });
      
      // Calcular total de horas (somatório das durações)
      const parseDurationToMinutes = (dur) => {
        if (!dur || typeof dur !== 'string') return 0;
        // Espera formatos como "1h00", "1h30", "2h" etc.
        // fallback regex: capture hours and minutes
        const mm = dur.match(/(\d+)h(?:([0-5]\d))?/);
        if (!mm) return 0;
        const hours = parseInt(mm[1], 10);
        const minutes = mm[2] ? parseInt(mm[2], 10) : 0;
        return hours * 60 + minutes;
      };

      let totalMinutes = 0;
      aulas.forEach(a => { totalMinutes += parseDurationToMinutes(a.duracao || ''); });

      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      const totalDisplay = `${totalHours}h ${String(remainingMinutes).padStart(2,'0')}`;

      // Atualizar o display no modal, se presente
      try {
        const elTotal = document.getElementById('display-total-horas-contrato');
        if (elTotal) elTotal.textContent = totalDisplay;
        // Usar soma calculada dinamicamente durante renderização
        const elValorEquipe = document.getElementById('display-valor-equipe-contrato');
        if (elValorEquipe) elValorEquipe.textContent = formatCurrencyBR(somaValorAulas);
        // Persistir valores agregados no documento do contrato
        try {
          const elHora = document.getElementById('display-hora-aula-contrato');
          const elLucro = document.getElementById('display-lucro-master-contrato');
          const horaAulaProfessor = parseBR(elHora ? (elHora.textContent || elHora.innerText) : 'R$ 0,00');
          const lucroMaster = parseBR(elLucro ? (elLucro.textContent || elLucro.innerText) : 'R$ 0,00');
          const ValorEquipe = Number(Number(somaValorAulas).toFixed(2));
          const ValorPacote = Number((ValorEquipe + lucroMaster).toFixed(2));

          if (window.BANCO && typeof window.BANCO.updateAula === 'function') {
            // SomatorioDuracaoAulas salvo como string "#h ##m"
            BANCO.updateAula(codigoContratacao, {
              horaAulaProfessor: horaAulaProfessor,
              lucroMaster: lucroMaster,
              SomatorioDuracaoAulas: totalDisplay,
              ValorEquipe: ValorEquipe,
              ValorPacote: ValorPacote,
              timestamp: firebase && firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
            }).catch(err => console.warn('Erro ao persistir valores do contrato:', err));
          }
        } catch (errPersist) {
          console.warn('⚠️ Não foi possível persistir valores do contrato:', errPersist);
        }
      } catch (e) { /* ignore */ }

      tbody.innerHTML = html;
      
      // Adicionar event listeners para os botões de relatório e observação
      setupAulaDetailsEventListeners();
      
      console.log(`✅ ${aulas.length} aulas renderizadas na tabela`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar aulas detalhadas:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-8">
            <i class="fas fa-exclamation-triangle text-3xl text-orange-500 mb-3"></i>
            <p class="text-gray-500">Erro ao carregar aulas</p>
            <p class="text-sm text-gray-400 mt-1">${error.message}</p>
          </td>
        </tr>
      `;
    }
  }
  
  // Função para configurar event listeners dos botões de relatório e observação
  function setupAulaDetailsEventListeners() {
    // Botões de estudante
    document.querySelectorAll('.btn-estudante-aula').forEach(btn => {
      btn.addEventListener('click', function() {
        const idAula = this.dataset.idAula;
        const estudanteAtual = this.dataset.estudante;
        showEstudanteModalBancoAulas(idAula, estudanteAtual);
      });
    });
    
    // Botões de relatório
    document.querySelectorAll('.btn-relatorio-aula').forEach(btn => {
      btn.addEventListener('click', function() {
        const relatorio = decodeURIComponent(this.dataset.relatorio || '');
        const idAula = this.dataset.idAula;
        showRelatorioModal(relatorio, idAula);
      });
    });
    
    // Botões de observação
    document.querySelectorAll('.btn-observacao-aula').forEach(btn => {
      btn.addEventListener('click', function() {
        const observacao = decodeURIComponent(this.dataset.observacao || '');
        const idAula = this.dataset.idAula;
        showObservacaoAulaModal(observacao, idAula);
      });
    });
    
    // Botões de status
    document.querySelectorAll('.btn-status-aula').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idAula = this.dataset.idAula;
        const statusAtual = this.dataset.status;
        showStatusModal(idAula, statusAtual);
      });
    });
    
    // Botões de data
    document.querySelectorAll('.btn-data-aula').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idAula = this.dataset.idAula;
        const dataAtual = this.dataset.data;
        showDataModal(idAula, dataAtual);
      });
    });
    
    // Botões de horário
    document.querySelectorAll('.btn-horario-aula').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idAula = this.dataset.idAula;
        const horarioAtual = this.dataset.horario;
        showHorarioModal(idAula, horarioAtual);
      });
    });
    
    // Botões de duração
    document.querySelectorAll('.btn-duracao-aula').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idAula = this.dataset.idAula;
        const duracaoAtual = this.dataset.duracao;
        showDuracaoModal(idAula, duracaoAtual);
      });
    });
    
    // Botões de matéria
    document.querySelectorAll('.btn-materia-aula').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idAula = this.dataset.idAula;
        const materiaAtual = this.dataset.materia;
        showMateriaModal(idAula, materiaAtual);
      });
    });
    
    // Botões de professor
    document.querySelectorAll('.btn-professor-aula').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const idAula = this.dataset.idAula;
        const professorAtual = this.dataset.professor;
        const idProfessorAtual = this.dataset.idProfessor;
        showProfessorModal(idAula, professorAtual, idProfessorAtual);
      });
    });
    
    // Botão de adicionar aula
    const btnAdicionarAula = document.getElementById('btnAdicionarAula');
    if (btnAdicionarAula) {
      btnAdicionarAula.addEventListener('click', function(e) {
        e.stopPropagation();
        const codigoContratacao = this.dataset.codigoContratacao;
        showAdicionarAulaModal(codigoContratacao);
      });
    }
    
    // Botão de remover aula
    const btnRemoverAula = document.getElementById('btnRemoverAula');
    if (btnRemoverAula) {
      btnRemoverAula.addEventListener('click', function(e) {
        e.stopPropagation();
        const codigoContratacao = this.dataset.codigoContratacao;
        showRemoverAulaModal(codigoContratacao);
      });
    }
  }
  
  // Variável para armazenar aula selecionada temporariamente
  let aulaSelecionada = null;
  
  // Função para mostrar modal de alteração de data da aula
  function showDataModal(idAula, dataAtual) {
    // Parsear data atual (formato: "seg - 10/01/2026")
    let dataObj = new Date();
    if (dataAtual) {
      const match = dataAtual.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        dataObj = new Date(match[3], match[2] - 1, match[1]);
      }
    }
    
    const currentMonth = dataObj.getMonth();
    const currentYear = dataObj.getFullYear();
    const selectedDay = dataObj.getDate();
    
    const modalHtml = `
      <div class="modal-overlay" id="dataModal" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>
              Data da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="calendar-container">
              <div class="calendar-header flex items-center justify-between mb-4 px-2">
                <button type="button" id="prevMonth" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <i class="fas fa-chevron-left text-gray-600"></i>
                </button>
                <div class="font-lexend font-bold text-base text-gray-700" id="monthYear"></div>
                <button type="button" id="nextMonth" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <i class="fas fa-chevron-right text-gray-600"></i>
                </button>
              </div>
              
              <div class="calendar-weekdays grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-500">
                <div>Dom</div>
                <div>Seg</div>
                <div>Ter</div>
                <div>Qua</div>
                <div>Qui</div>
                <div>Sex</div>
                <div>Sáb</div>
              </div>
              
              <div id="calendarDays" class="calendar-days grid grid-cols-7 gap-1"></div>
              
              <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="text-sm text-gray-600">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  <span>Data atual: <strong>${dataAtual || 'Não definida'}</strong></span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                  <i class="fas fa-mouse-pointer text-orange-500 mr-2"></i>
                  <span>Data selecionada: <strong id="selectedDate">${dataAtual || 'Selecione uma data'}</strong></span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarData" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#dataModal');
    const btnCancelar = modal.querySelector('#btnCancelarData');
    const btnClose = modal.querySelector('.modal-close');
    const monthYearEl = modal.querySelector('#monthYear');
    const calendarDaysEl = modal.querySelector('#calendarDays');
    const selectedDateEl = modal.querySelector('#selectedDate');
    const prevMonthBtn = modal.querySelector('#prevMonth');
    const nextMonthBtn = modal.querySelector('#nextMonth');
    
    let displayMonth = currentMonth;
    let displayYear = currentYear;
    let selectedDate = dataObj;
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    const formatDate = (date) => {
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      const diaSemana = diasSemana[date.getDay()];
      return `${diaSemana} - ${dia}/${mes}/${ano}`;
    };
    
    const renderCalendar = () => {
      monthYearEl.textContent = `${meses[displayMonth]} ${displayYear}`;
      calendarDaysEl.innerHTML = '';
      
      const firstDay = new Date(displayYear, displayMonth, 1).getDay();
      const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Dias vazios antes do primeiro dia do mês
      for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day-empty h-10';
        calendarDaysEl.appendChild(emptyDay);
      }
      
      // Dias do mês
      for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('button');
        dayEl.type = 'button';
        dayEl.className = 'calendar-day h-10 rounded-lg text-sm font-medium transition-all hover:bg-orange-100 hover:text-orange-600';
        dayEl.textContent = day;
        
        const dayDate = new Date(displayYear, displayMonth, day);
        dayDate.setHours(0, 0, 0, 0);
        
        // Verificar se é o dia selecionado
        if (selectedDate && 
            dayDate.getDate() === selectedDate.getDate() && 
            dayDate.getMonth() === selectedDate.getMonth() && 
            dayDate.getFullYear() === selectedDate.getFullYear()) {
          dayEl.classList.add('bg-orange-500', 'text-white', 'font-bold', 'shadow-md');
          dayEl.classList.remove('hover:bg-orange-100', 'hover:text-orange-600');
        }
        // Verificar se é hoje
        else if (dayDate.getTime() === today.getTime()) {
          dayEl.classList.add('border-2', 'border-orange-500', 'text-orange-500');
        } else {
          dayEl.classList.add('text-gray-700');
        }
        
        dayEl.addEventListener('click', () => {
          const newDate = new Date(displayYear, displayMonth, day);
          const newDateFormatted = formatDate(newDate);
          
          // Verificar se é diferente da data atual
          if (newDateFormatted === dataAtual) {
            showToast('ℹ️ Esta já é a data atual da aula', 'info');
            return;
          }
          
          // Popup de confirmação
          showConfirmModal(
            'Deseja mudar a data da aula?',
            `
              <div class="text-center py-4">
                <i class="fas fa-calendar-check text-4xl text-orange-500 mb-4"></i>
                <p class="text-gray-600 mb-2">Data atual:</p>
                <p class="text-lg font-bold text-gray-800 mb-4">${dataAtual || 'Não definida'}</p>
                <p class="text-gray-600 mb-2">Nova data:</p>
                <p class="text-lg font-bold text-orange-500">${newDateFormatted}</p>
              </div>
            `,
            async () => {
              // Sim - alterar data
              try {
                await BANCO.updateDataAula(idAula, newDateFormatted);
                showToast(`✅ Data alterada para ${newDateFormatted}`, 'success');
                closeModal();
                
                // Recarregar a tabela
                const tbody = document.getElementById('tbody-aulas-detalhadas');
                if (tbody) {
                  tbody.innerHTML = `
                    <tr>
                      <td colspan="9" class="text-center py-8">
                        <div class="flex flex-col items-center justify-center">
                          <div class="loading-spinner-large mb-3"></div>
                          <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                        </div>
                      </td>
                    </tr>
                  `;
                }
                
                // Buscar o código de contratação do modal aberto
                const modalOverlay = document.querySelector('.modal-overlay');
                if (modalOverlay && modalOverlay.id !== 'dataModal') {
                  const codigoElement = modalOverlay.querySelector('h3');
                  if (codigoElement) {
                    const match = codigoElement.textContent.match(/\d{4}/);
                    if (match) {
                      const codigoContratacao = match[0];
                      await loadAulasDetalhadas(codigoContratacao);
                    }
                  }
                }
              } catch (error) {
                console.error('❌ Erro ao alterar data:', error);
                showToast('❌ Erro ao alterar data', 'error');
              }
            },
            () => {
              // Não - apenas fechar
              console.log('Alteração de data cancelada');
            }
          );
        });
        
        calendarDaysEl.appendChild(dayEl);
      }
    };
    
    // Função auxiliar para criar modal de confirmação
    const showConfirmModal = (title, content, onConfirm, onCancel) => {
      const confirmHtml = `
        <div class="modal-overlay" id="confirmModal" style="z-index: 10001;">
          <div class="modal-container" style="max-width: 400px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">${title}</h3>
            </div>
            <div class="modal-body">
              ${content}
            </div>
            <div class="modal-footer">
              <button id="btnNao" class="btn-secondary btn-compact">Não</button>
              <button id="btnSim" class="btn-primary btn-compact">Sim</button>
            </div>
          </div>
        </div>
      `;
      
      const confirmContainer = document.createElement('div');
      confirmContainer.innerHTML = confirmHtml;
      document.body.appendChild(confirmContainer);
      
      const confirmModal = confirmContainer.querySelector('#confirmModal');
      const btnSim = confirmModal.querySelector('#btnSim');
      const btnNao = confirmModal.querySelector('#btnNao');
      
      const closeConfirm = () => {
        confirmContainer.remove();
      };
      
      btnSim.addEventListener('click', () => {
        closeConfirm();
        if (onConfirm) onConfirm();
      });
      
      btnNao.addEventListener('click', () => {
        closeConfirm();
        if (onCancel) onCancel();
      });
    };
    
    prevMonthBtn.addEventListener('click', () => {
      displayMonth--;
      if (displayMonth < 0) {
        displayMonth = 11;
        displayYear--;
      }
      renderCalendar();
    });
    
    nextMonthBtn.addEventListener('click', () => {
      displayMonth++;
      if (displayMonth > 11) {
        displayMonth = 0;
        displayYear++;
      }
      renderCalendar();
    });
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
    
    // Renderizar calendário inicial
    renderCalendar();
  }
  
  // Função para mostrar modal de alteração de horário da aula
  function showHorarioModal(idAula, horarioAtual) {
    const modalHtml = `
      <div class="modal-overlay" id="horarioModal" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 420px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-clock text-orange-500 mr-2"></i>
              Horário da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  Horário atual: <strong>${horarioAtual || 'Não definido'}</strong>
                </label>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-edit text-orange-500 mr-2"></i>
                  Selecione o novo horário:
                </label>
                <input 
                  type="time" 
                  id="inputHorario" 
                  value="${horarioAtual || ''}" 
                  class="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p class="text-sm text-gray-600">
                  <i class="fas fa-lightbulb text-orange-500 mr-2"></i>
                  <span>Selecione o horário desejado e clique em "Confirmar Alteração"</span>
                </p>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarHorario" class="btn-secondary btn-compact">
              Cancelar
            </button>
            <button id="btnConfirmarHorario" class="btn-primary btn-compact">
              <i class="fas fa-check mr-2"></i>
              Confirmar Alteração
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#horarioModal');
    const btnCancelar = modal.querySelector('#btnCancelarHorario');
    const btnConfirmar = modal.querySelector('#btnConfirmarHorario');
    const btnClose = modal.querySelector('.modal-close');
    const inputHorario = modal.querySelector('#inputHorario');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    btnConfirmar.addEventListener('click', () => {
      const novoHorario = inputHorario.value;
      
      if (!novoHorario) {
        showToast('⚠️ Por favor, selecione um horário', 'error');
        return;
      }
      
      if (novoHorario === horarioAtual) {
        showToast('ℹ️ Este já é o horário atual da aula', 'info');
        return;
      }
      
      // Popup de confirmação
      const confirmHtml = `
        <div class="modal-overlay" id="confirmHorarioModal" style="z-index: 10001;">
          <div class="modal-container" style="max-width: 400px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">Deseja mudar o horário da aula?</h3>
            </div>
            <div class="modal-body">
              <div class="text-center py-4">
                <i class="fas fa-clock text-4xl text-orange-500 mb-4"></i>
                <p class="text-gray-600 mb-2">Horário atual:</p>
                <p class="text-lg font-bold text-gray-800 mb-4">${horarioAtual || 'Não definido'}</p>
                <p class="text-gray-600 mb-2">Novo horário:</p>
                <p class="text-lg font-bold text-orange-500">${novoHorario}</p>
              </div>
            </div>
            <div class="modal-footer">
              <button id="btnNaoHorario" class="btn-secondary btn-compact">Não</button>
              <button id="btnSimHorario" class="btn-primary btn-compact">Sim</button>
            </div>
          </div>
        </div>
      `;
      
      const confirmContainer = document.createElement('div');
      confirmContainer.innerHTML = confirmHtml;
      document.body.appendChild(confirmContainer);
      
      const confirmModal = confirmContainer.querySelector('#confirmHorarioModal');
      const btnSim = confirmModal.querySelector('#btnSimHorario');
      const btnNao = confirmModal.querySelector('#btnNaoHorario');
      
      const closeConfirm = () => {
        confirmContainer.remove();
      };

      btnNao.addEventListener('click', closeConfirm);

      btnSim.addEventListener('click', async () => {
        closeConfirm();

        try {
          await BANCO.updateHorarioAula(idAula, novoHorario);
          showToast(`✅ Horário alterado para ${novoHorario}`, 'success');
          closeModal();

          // Recarregar a tabela
          const tbody = document.getElementById('tbody-aulas-detalhadas');
          if (tbody) {
            tbody.innerHTML = `
              <tr>
                <td colspan="9" class="text-center py-8">
                  <div class="flex flex-col items-center justify-center">
                    <div class="loading-spinner-large mb-3"></div>
                    <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                  </div>
                </td>
              </tr>
            `;
          }

          // Buscar o código de contratação do modal aberto
          const modalOverlay = document.querySelector('.modal-overlay');
          if (modalOverlay && modalOverlay.id !== 'horarioModal') {
            const codigoElement = modalOverlay.querySelector('h3');
            if (codigoElement) {
              const match = codigoElement.textContent.match(/\d{4}/);
              if (match) {
                const codigoContratacao = match[0];
                await loadAulasDetalhadas(codigoContratacao);
              }
            }
          }
        } catch (error) {
          console.error('❌ Erro ao alterar horário:', error);
          showToast('❌ Erro ao alterar horário', 'error');
        }
      });

      // Pressionar Enter ativa o botão Sim
      confirmModal.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnSim.click();
        }
      });
      // Focar no botão Sim para acessibilidade
      setTimeout(() => btnSim.focus(), 100);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
    
    // Focar no input
    setTimeout(() => inputHorario.focus(), 100);

    // Pressionar Enter ativa o botão Confirmar
    inputHorario.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnConfirmar.click();
      }
    });
  }
  
  // Função para mostrar modal de alteração de duração da aula
  function showDuracaoModal(idAula, duracaoAtual) {
    const opcoesDuracao = ['1h00', '1h30', '2h00', '2h30', '3h00'];
    
    const opcoesHtml = opcoesDuracao.map(duracao => {
      const isAtual = duracao === duracaoAtual;
      const buttonClass = isAtual 
        ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
      
      return `
        <button 
          class="duracao-option-btn ${buttonClass} border-2 rounded-lg px-6 py-3 font-medium transition-all duration-200 transform hover:scale-105"
          data-duracao="${duracao}"
        >
          ${duracao}
          ${isAtual ? '<i class="fas fa-check ml-2"></i>' : ''}
        </button>
      `;
    }).join('');
    
    const modalHtml = `
      <div class="modal-overlay" id="duracaoModal" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-hourglass-half text-orange-500 mr-2"></i>
              Duração da aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="space-y-4">
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p class="text-sm text-gray-700">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  Duração atual: <strong class="text-orange-600">${duracaoAtual || 'Não definida'}</strong>
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">
                  Selecione a nova duração:
                </label>
                <div class="flex flex-col gap-3">
                  ${opcoesHtml}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarDuracao" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#duracaoModal');
    const btnCancelar = modal.querySelector('#btnCancelarDuracao');
    const btnClose = modal.querySelector('.modal-close');
    const btnOpcoes = modal.querySelectorAll('.duracao-option-btn');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    btnOpcoes.forEach(btn => {
      btn.addEventListener('click', () => {
        const novaDuracao = btn.dataset.duracao;
        
        if (novaDuracao === duracaoAtual) {
          showToast('ℹ️ Esta já é a duração atual da aula', 'info');
          return;
        }
        
        // Popup de confirmação
        const confirmHtml = `
          <div class="modal-overlay" id="confirmDuracaoModal" style="z-index: 10001;">
            <div class="modal-container" style="max-width: 400px;">
              <div class="modal-header">
                <h3 class="font-lexend font-bold text-lg">Deseja mudar a duração da aula?</h3>
              </div>
              <div class="modal-body">
                <div class="text-center py-4">
                  <i class="fas fa-hourglass-half text-4xl text-orange-500 mb-4"></i>
                  <p class="text-gray-600 mb-2">Duração atual:</p>
                  <p class="text-lg font-bold text-gray-800 mb-4">${duracaoAtual || 'Não definida'}</p>
                  <p class="text-gray-600 mb-2">Nova duração:</p>
                  <p class="text-lg font-bold text-orange-500">${novaDuracao}</p>
                </div>
              </div>
              <div class="modal-footer">
                <button id="btnNaoDuracao" class="btn-secondary btn-compact">Não</button>
                <button id="btnSimDuracao" class="btn-primary btn-compact">Sim</button>
              </div>
            </div>
          </div>
        `;
        
        const confirmContainer = document.createElement('div');
        confirmContainer.innerHTML = confirmHtml;
        document.body.appendChild(confirmContainer);
        
        const confirmModal = confirmContainer.querySelector('#confirmDuracaoModal');
        const btnSim = confirmModal.querySelector('#btnSimDuracao');
        const btnNao = confirmModal.querySelector('#btnNaoDuracao');
        
        const closeConfirm = () => {
          confirmContainer.remove();
        };
        
        btnNao.addEventListener('click', closeConfirm);
        
        btnSim.addEventListener('click', async () => {
          closeConfirm();
          
          try {
            await BANCO.updateDuracaoAula(idAula, novaDuracao);
            showToast(`✅ Duração alterada para ${novaDuracao}`, 'success');
            closeModal();
            
            // Recarregar a tabela
            const tbody = document.getElementById('tbody-aulas-detalhadas');
            if (tbody) {
              tbody.innerHTML = `
                <tr>
                  <td colspan="9" class="text-center py-8">
                    <div class="flex flex-col items-center justify-center">
                      <div class="loading-spinner-large mb-3"></div>
                      <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                    </div>
                  </td>
                </tr>
              `;
            }
            
            // Buscar o código de contratação do modal aberto
            const modalOverlay = document.querySelector('.modal-overlay');
            if (modalOverlay && modalOverlay.id !== 'duracaoModal') {
              const codigoElement = modalOverlay.querySelector('h3');
              if (codigoElement) {
                const match = codigoElement.textContent.match(/\d{4}/);
                if (match) {
                  const codigoContratacao = match[0];
                  await loadAulasDetalhadas(codigoContratacao);
                }
              }
            }
          } catch (error) {
            console.error('❌ Erro ao alterar duração:', error);
            showToast('❌ Erro ao alterar duração', 'error');
          }
        });
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para mostrar modal de alteração de matéria da aula
  function showMateriaModal(idAula, materiaAtual) {
    const materias = [
      "Biologia", "Ciências", "Filosofia", "Física", "Geografia",
      "História", "Língua Portuguesa", "Língua Inglesa", "Matemática", 
      "Química", "Sociologia", "Pedagogia"
    ].sort();
    
    const opcoesHtml = materias.map(materia => {
      const isAtual = materia === materiaAtual;
      const buttonClass = isAtual 
        ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
      
      return `
        <button 
          class="materia-option-btn ${buttonClass} border-2 rounded-lg px-4 py-3 font-medium transition-all duration-200 transform hover:scale-105 text-sm whitespace-nowrap"
          data-materia="${materia}"
        >
          ${materia}
          ${isAtual ? '<i class="fas fa-check ml-2"></i>' : ''}
        </button>
      `;
    }).join('');
    
    const modalHtml = `
      <div class="modal-overlay" id="materiaModal" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 900px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-book text-orange-500 mr-2"></i>
              Matéria da aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
            <div class="space-y-4">
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p class="text-sm text-gray-700">
                  <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                  Matéria atual: <strong class="text-orange-600">${materiaAtual || 'Não definida'}</strong>
                </p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">
                  Selecione a nova matéria:
                </label>
                <div class="grid grid-cols-4 gap-3">
                  ${opcoesHtml}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarMateria" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#materiaModal');
    const btnCancelar = modal.querySelector('#btnCancelarMateria');
    const btnClose = modal.querySelector('.modal-close');
    const btnOpcoes = modal.querySelectorAll('.materia-option-btn');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    btnOpcoes.forEach(btn => {
      btn.addEventListener('click', () => {
        const novaMateria = btn.dataset.materia;
        
        if (novaMateria === materiaAtual) {
          showToast('ℹ️ Esta já é a matéria atual da aula', 'info');
          return;
        }
        
        // Popup de confirmação
        const confirmHtml = `
          <div class="modal-overlay" id="confirmMateriaModal" style="z-index: 10001;">
            <div class="modal-container" style="max-width: 400px;">
              <div class="modal-header">
                <h3 class="font-lexend font-bold text-lg">Deseja mudar a matéria da aula?</h3>
              </div>
              <div class="modal-body">
                <div class="text-center py-4">
                  <i class="fas fa-book text-4xl text-orange-500 mb-4"></i>
                  <p class="text-gray-600 mb-2">Matéria atual:</p>
                  <p class="text-lg font-bold text-gray-800 mb-4">${materiaAtual || 'Não definida'}</p>
                  <p class="text-gray-600 mb-2">Nova matéria:</p>
                  <p class="text-lg font-bold text-orange-500">${novaMateria}</p>
                </div>
              </div>
              <div class="modal-footer">
                <button id="btnNaoMateria" class="btn-secondary btn-compact">Não</button>
                <button id="btnSimMateria" class="btn-primary btn-compact">Sim</button>
              </div>
            </div>
          </div>
        `;
        
        const confirmContainer = document.createElement('div');
        confirmContainer.innerHTML = confirmHtml;
        document.body.appendChild(confirmContainer);
        
        const confirmModal = confirmContainer.querySelector('#confirmMateriaModal');
        const btnSim = confirmModal.querySelector('#btnSimMateria');
        const btnNao = confirmModal.querySelector('#btnNaoMateria');
        
        const closeConfirm = () => {
          confirmContainer.remove();
        };
        
        btnNao.addEventListener('click', closeConfirm);
        
        btnSim.addEventListener('click', async () => {
          closeConfirm();
          
          try {
            await BANCO.updateMateriaAula(idAula, novaMateria);
            showToast(`✅ Matéria alterada para ${novaMateria}`, 'success');
            closeModal();
            
            // Recarregar a tabela
            const tbody = document.getElementById('tbody-aulas-detalhadas');
            if (tbody) {
              tbody.innerHTML = `
                <tr>
                  <td colspan="9" class="text-center py-8">
                    <div class="flex flex-col items-center justify-center">
                      <div class="loading-spinner-large mb-3"></div>
                      <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                    </div>
                  </td>
                </tr>
              `;
            }
            
            // Buscar o código de contratação do modal aberto
            const modalOverlay = document.querySelector('.modal-overlay');
            if (modalOverlay && modalOverlay.id !== 'materiaModal') {
              const codigoElement = modalOverlay.querySelector('h3');
              if (codigoElement) {
                const match = codigoElement.textContent.match(/\d{4}/);
                if (match) {
                  const codigoContratacao = match[0];
                  await loadAulasDetalhadas(codigoContratacao);
                }
              }
            }
          } catch (error) {
            console.error('❌ Erro ao alterar matéria:', error);
            showToast('❌ Erro ao alterar matéria', 'error');
          }
        });
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para mostrar modal de seleção de professor
  async function showProfessorModal(idAula, professorAtual, idProfessorAtual) {
    try {
      // Buscar professores do banco de dados
      const professores = await BANCO.fetchDataBaseProfessores();
      
      // Ordenar alfabeticamente por nome
      const professoresOrdenados = professores.sort((a, b) => {
        const nomeA = a.nome || '';
        const nomeB = b.nome || '';
        return nomeA.localeCompare(nomeB);
      });
      
      const modalHtml = `
        <div class="modal-overlay" id="professorModal" style="z-index: 10000;">
          <div class="modal-container" style="max-width: 650px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">
                <i class="fas fa-chalkboard-teacher text-orange-500 mr-2"></i>
                Selecione Professor
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="space-y-5">
                <div class="bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                  <p class="text-sm text-gray-700 flex items-center">
                    <i class="fas fa-user-tie text-orange-500 mr-3 text-lg"></i>
                    <span>Professor atual: <strong class="text-orange-600 ml-1">${professorAtual || 'Não definido'}</strong></span>
                  </p>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-search text-orange-500 mr-2"></i>
                    Buscar professor
                  </label>
                  <div class="relative">
                    <input 
                      type="text" 
                      id="inputBuscaProfessor" 
                      placeholder="Digite o nome do professor..."
                      class="w-full border-2 border-gray-300 rounded-lg pl-11 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <i class="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-list-ul text-orange-500 mr-2"></i>
                    Lista de professores disponíveis
                  </label>
                  <select 
                    id="selectProfessor" 
                    class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-inner"
                    size="10"
                    style="min-height: 280px;"
                  >
                    <option value="|A definir" style="padding: 8px; font-weight: 500; color: #f97316;">A definir</option>
                    ${professoresOrdenados.map(prof => `
                      <option value="${prof.cpf}|${prof.nome}" ${prof.nome === professorAtual ? 'selected' : ''} style="padding: 8px;">
                        ${prof.nome}
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btnCancelarProfessor" class="btn-secondary btn-compact">
                Cancelar
              </button>
              <button id="btnConfirmarProfessor" class="btn-primary btn-compact">
                <i class="fas fa-check mr-2"></i>
                Confirmar Seleção
              </button>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer);
      
      const modal = modalContainer.querySelector('#professorModal');
      const btnCancelar = modal.querySelector('#btnCancelarProfessor');
      const btnConfirmar = modal.querySelector('#btnConfirmarProfessor');
      const btnClose = modal.querySelector('.modal-close');
      const inputBusca = modal.querySelector('#inputBuscaProfessor');
      const selectProfessor = modal.querySelector('#selectProfessor');
      
      // Array com todas as opções originais
      const todasOpcoes = Array.from(selectProfessor.options);
      
      // Função para filtrar professores
      inputBusca.addEventListener('input', function() {
        const termoBusca = this.value.toLowerCase().trim();
        
        // Limpar select
        selectProfessor.innerHTML = '';
        
        // Filtrar e adicionar opções
        const opcoesFiltradas = todasOpcoes.filter(opcao => {
          const texto = opcao.textContent.toLowerCase();
          return texto.includes(termoBusca);
        });
        
        opcoesFiltradas.forEach(opcao => {
          selectProfessor.appendChild(opcao.cloneNode(true));
        });
      });
      
      const closeModal = () => {
        modalContainer.remove();
      };
      
      btnCancelar.addEventListener('click', closeModal);
      btnClose.addEventListener('click', closeModal);
      
      btnConfirmar.addEventListener('click', () => {
        const selectedOption = selectProfessor.value;
        
        if (!selectedOption) {
          showToast('⚠️ Por favor, selecione um professor', 'error');
          return;
        }
        
        // Separar CPF e nome
        const [cpf, nome] = selectedOption.split('|');
        
        if (nome === professorAtual) {
          showToast('ℹ️ Este já é o professor atual da aula', 'info');
          return;
        }
        
        // Popup de confirmação
        const confirmHtml = `
          <div class="modal-overlay" id="confirmProfessorModal" style="z-index: 10001;">
            <div class="modal-container" style="max-width: 400px;">
              <div class="modal-header">
                <h3 class="font-lexend font-bold text-lg">Deseja mudar o professor da aula?</h3>
              </div>
              <div class="modal-body">
                <div class="text-center py-4">
                  <i class="fas fa-chalkboard-teacher text-4xl text-orange-500 mb-4"></i>
                  <p class="text-gray-600 mb-2">Professor atual:</p>
                  <p class="text-lg font-bold text-gray-800 mb-4">${professorAtual || 'Não definido'}</p>
                  <p class="text-gray-600 mb-2">Novo professor:</p>
                  <p class="text-lg font-bold text-orange-500">${nome}</p>
                </div>
              </div>
              <div class="modal-footer">
                <button id="btnNaoProfessor" class="btn-secondary btn-compact">Não</button>
                <button id="btnSimProfessor" class="btn-primary btn-compact">Sim</button>
              </div>
            </div>
          </div>
        `;
        
        const confirmContainer = document.createElement('div');
        confirmContainer.innerHTML = confirmHtml;
        document.body.appendChild(confirmContainer);
        
        const confirmModal = confirmContainer.querySelector('#confirmProfessorModal');
        const btnSim = confirmModal.querySelector('#btnSimProfessor');
        const btnNao = confirmModal.querySelector('#btnNaoProfessor');
        
        const closeConfirm = () => {
          confirmContainer.remove();
        };
        
        btnNao.addEventListener('click', closeConfirm);
        
        btnSim.addEventListener('click', async () => {
          closeConfirm();
          
          try {
            await BANCO.updateProfessorAula(idAula, nome, cpf);
            showToast(`✅ Professor alterado para ${nome}`, 'success');
            closeModal();
            
            // Recarregar a tabela
            const tbody = document.getElementById('tbody-aulas-detalhadas');
            if (tbody) {
              tbody.innerHTML = `
                <tr>
                  <td colspan="9" class="text-center py-8">
                    <div class="flex flex-col items-center justify-center">
                      <div class="loading-spinner-large mb-3"></div>
                      <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                    </div>
                  </td>
                </tr>
              `;
            }
            
            // Buscar o código de contratação do modal aberto
            const modalOverlay = document.querySelector('.modal-overlay');
            if (modalOverlay && modalOverlay.id !== 'professorModal') {
              const codigoElement = modalOverlay.querySelector('h3');
              if (codigoElement) {
                const match = codigoElement.textContent.match(/\d{4}/);
                if (match) {
                  const codigoContratacao = match[0];
                  await loadAulasDetalhadas(codigoContratacao);
                }
              }
            }
          } catch (error) {
            console.error('❌ Erro ao alterar professor:', error);
            showToast('❌ Erro ao alterar professor', 'error');
          }
        });
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      
      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);
      modalContainer.addEventListener('remove', () => {
        document.removeEventListener('keydown', escHandler);
      });
      
      // Focar no campo de busca
      setTimeout(() => inputBusca.focus(), 100);
      
    } catch (error) {
      console.error('❌ Erro ao carregar professores:', error);
      showToast('❌ Erro ao carregar lista de professores', 'error');
    }
  }
  
  // Função para mostrar modal de estudante (Banco de Aulas)
  async function showEstudanteModalBancoAulas(idAula, estudanteAtual) {
    // Buscar CPF do cliente da contratação
    const modalOverlay = document.querySelector('.modal-overlay');
    let clienteEstudantes = [];
    let cpfCliente = '';
    
    if (modalOverlay) {
      // Extrair CPF do modal de detalhes
      const cpfElement = Array.from(modalOverlay.querySelectorAll('.text-xs.font-medium.text-gray-500'))
        .find(el => el.textContent === 'CPF');
      
      if (cpfElement && cpfElement.nextElementSibling) {
        cpfCliente = cpfElement.nextElementSibling.textContent.trim();
      }
      
      // Buscar cliente por CPF
      if (cpfCliente && cpfCliente !== '--') {
        try {
          const clientesSnapshot = await db.collection('cadastroClientes')
            .where('cpf', '==', cpfCliente)
            .get();
          
          if (!clientesSnapshot.empty) {
            const clienteData = clientesSnapshot.docs[0].data();
            
            // Verificar se existe array de estudantes
            if (clienteData.estudantes && Array.isArray(clienteData.estudantes)) {
              clienteEstudantes = clienteData.estudantes
                .filter(est => est.nome && est.nome.trim() !== '')
                .map(est => est.nome)
                .sort();
            }
          }
        } catch (error) {
          console.error('❌ Erro ao buscar estudantes do cliente:', error);
        }
      }
    }
    
    // Se houver estudantes do cliente, mostrar select com busca
    if (clienteEstudantes.length > 0) {
      const modalHtml = `
        <div class="modal-overlay" id="modalEstudanteBanco" style="z-index: 10000;">
          <div class="modal-container" style="max-width: 650px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">
                <i class="fas fa-user-graduate text-orange-500 mr-2"></i>
                Selecione Estudante
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="space-y-5">
                <div class="bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                  <p class="text-sm text-gray-700 flex items-center">
                    <i class="fas fa-user-graduate text-orange-500 mr-3 text-lg"></i>
                    <span>Estudante atual: <strong class="text-orange-600 ml-1">${estudanteAtual || 'Não definido'}</strong></span>
                  </p>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-search text-orange-500 mr-2"></i>
                    Buscar estudante
                  </label>
                  <div class="relative">
                    <input 
                      type="text" 
                      id="inputBuscaEstudante" 
                      placeholder="Digite o nome do estudante..."
                      class="w-full border-2 border-gray-300 rounded-lg pl-11 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <i class="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">
                    <i class="fas fa-list-ul text-orange-500 mr-2"></i>
                    Lista de estudantes do cliente
                  </label>
                  <select 
                    id="selectEstudante" 
                    class="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-inner"
                    size="10"
                    style="min-height: 280px;"
                  >
                    ${clienteEstudantes.map(nome => {
                      const escapedNome = nome.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                      return `<option value="${escapedNome}" ${nome === estudanteAtual ? 'selected' : ''} style="padding: 8px;">
                        ${escapedNome}
                      </option>`;
                    }).join('')}
                  </select>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p class="text-sm text-gray-600">
                    <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                    <span>Ou digite um novo nome:</span>
                  </p>
                  <input 
                    type="text" 
                    id="inputNovoEstudante" 
                    placeholder="Nome de outro estudante..."
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btnCancelarEstudante" class="btn-secondary btn-compact">
                Cancelar
              </button>
              <button id="btnConfirmarEstudante" class="btn-primary btn-compact">
                <i class="fas fa-check mr-2"></i>
                Confirmar Seleção
              </button>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer);
      
      const modal = modalContainer.querySelector('#modalEstudanteBanco');
      const btnCancelar = modal.querySelector('#btnCancelarEstudante');
      const btnConfirmar = modal.querySelector('#btnConfirmarEstudante');
      const btnClose = modal.querySelector('.modal-close');
      const inputBusca = modal.querySelector('#inputBuscaEstudante');
      const selectEstudante = modal.querySelector('#selectEstudante');
      const inputNovoEstudante = modal.querySelector('#inputNovoEstudante');
      
      // Array com todas as opções originais
      const todasOpcoes = Array.from(selectEstudante.options);
      
      // Função para filtrar estudantes
      inputBusca.addEventListener('input', function() {
        const termoBusca = this.value.toLowerCase().trim();
        
        // Limpar select
        selectEstudante.innerHTML = '';
        
        // Filtrar e adicionar opções
        const opcoesFiltradas = todasOpcoes.filter(opcao => {
          const texto = opcao.textContent.toLowerCase();
          return texto.includes(termoBusca);
        });
        
        opcoesFiltradas.forEach(opcao => {
          selectEstudante.appendChild(opcao.cloneNode(true));
        });
      });
      
      const closeModal = () => {
        modalContainer.remove();
      };
      
      btnCancelar.addEventListener('click', closeModal);
      btnClose.addEventListener('click', closeModal);
      
      btnConfirmar.addEventListener('click', async () => {
        let nomeEstudante = '';
        
        // Verificar se digitou um novo nome
        const novoNome = inputNovoEstudante.value.trim();
        if (novoNome) {
          nomeEstudante = novoNome;
        } else {
          // Usar o selecionado
          const selectedOption = selectEstudante.value;
          if (!selectedOption) {
            showToast('⚠️ Por favor, selecione um estudante ou digite um novo nome', 'error');
            return;
          }
          nomeEstudante = selectedOption;
        }
        
        if (nomeEstudante === estudanteAtual) {
          showToast('ℹ️ Este já é o estudante atual da aula', 'info');
          return;
        }
        
        try {
          await BANCO.updateEstudanteAula(idAula, nomeEstudante);
          showToast(`✅ Estudante alterado para ${nomeEstudante}`, 'success');
          closeModal();
          
          // Recarregar a tabela
          const tbody = document.getElementById('tbody-aulas-detalhadas');
          if (tbody) {
            tbody.innerHTML = `
              <tr>
                <td colspan="10" class="text-center py-8">
                  <div class="flex flex-col items-center justify-center">
                    <div class="loading-spinner-large mb-3"></div>
                    <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                  </div>
                </td>
              </tr>
            `;
          }
          
          // Buscar o código de contratação do modal aberto
          const modalOverlay = document.querySelector('.modal-overlay');
          if (modalOverlay && modalOverlay.id !== 'modalEstudanteBanco') {
            const codigoElement = modalOverlay.querySelector('h3');
            if (codigoElement) {
              const match = codigoElement.textContent.match(/\d{4}/);
              if (match) {
                const codigoContratacao = match[0];
                await loadAulasDetalhadas(codigoContratacao);
              }
            }
          }
        } catch (error) {
          console.error('❌ Erro ao alterar estudante:', error);
          showToast('❌ Erro ao alterar estudante', 'error');
        }
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      
      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);
      modalContainer.addEventListener('remove', () => {
        document.removeEventListener('keydown', escHandler);
      });
      
      // Focar no campo de busca
      setTimeout(() => inputBusca.focus(), 100);
      
    } else {
      // Fallback: Sem cliente ou sem estudantes - mostrar input livre
      const modalHtml = `
        <div class="modal-overlay" id="modalEstudanteBanco" style="z-index: 10000;">
          <div class="modal-container" style="max-width: 420px;">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg">
                <i class="fas fa-user-graduate text-orange-500 mr-2"></i>
                Estudante da Aula
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                    Estudante atual: <strong>${estudanteAtual || 'Não definido'}</strong>
                  </label>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    <i class="fas fa-edit text-orange-500 mr-2"></i>
                    Digite o nome do estudante:
                  </label>
                  <input 
                    type="text" 
                    id="inputEstudante" 
                    value="${estudanteAtual || ''}"
                    placeholder="Nome do estudante"
                    class="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p class="text-sm text-gray-600">
                    <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                    <span>Nenhum cliente selecionado ou cliente sem estudantes cadastrados</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btnCancelarEstudante" class="btn-secondary btn-compact">
                Cancelar
              </button>
              <button id="btnConfirmarEstudante" class="btn-primary btn-compact">
                <i class="fas fa-check mr-2"></i>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer);
      
      const modal = modalContainer.querySelector('#modalEstudanteBanco');
      const btnCancelar = modal.querySelector('#btnCancelarEstudante');
      const btnConfirmar = modal.querySelector('#btnConfirmarEstudante');
      const btnClose = modal.querySelector('.modal-close');
      const inputEstudante = modal.querySelector('#inputEstudante');
      
      const closeModal = () => {
        modalContainer.remove();
      };
      
      btnCancelar.addEventListener('click', closeModal);
      btnClose.addEventListener('click', closeModal);
      
      btnConfirmar.addEventListener('click', async () => {
        const nomeEstudante = inputEstudante.value.trim();
        
        if (nomeEstudante === estudanteAtual) {
          showToast('ℹ️ Este já é o estudante atual da aula', 'info');
          return;
        }
        
        try {
          await BANCO.updateEstudanteAula(idAula, nomeEstudante);
          showToast(`✅ Estudante ${nomeEstudante ? 'alterado para ' + nomeEstudante : 'removido'}`, 'success');
          closeModal();
          
          // Recarregar a tabela
          const tbody = document.getElementById('tbody-aulas-detalhadas');
          if (tbody) {
            tbody.innerHTML = `
              <tr>
                <td colspan="10" class="text-center py-8">
                  <div class="flex flex-col items-center justify-center">
                    <div class="loading-spinner-large mb-3"></div>
                    <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                  </div>
                </td>
              </tr>
            `;
          }
          
          // Buscar o código de contratação do modal aberto
          const modalOverlay = document.querySelector('.modal-overlay');
          if (modalOverlay && modalOverlay.id !== 'modalEstudanteBanco') {
            const codigoElement = modalOverlay.querySelector('h3');
            if (codigoElement) {
              const match = codigoElement.textContent.match(/\d{4}/);
              if (match) {
                const codigoContratacao = match[0];
                await loadAulasDetalhadas(codigoContratacao);
              }
            }
          }
        } catch (error) {
          console.error('❌ Erro ao alterar estudante:', error);
          showToast('❌ Erro ao alterar estudante', 'error');
        }
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      
      const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', escHandler);
      modalContainer.addEventListener('remove', () => {
        document.removeEventListener('keydown', escHandler);
      });
      
      // Focar no input
      setTimeout(() => inputEstudante.focus(), 100);
    }
  }
  
  // Função para mostrar modal de confirmação de adição de aula
  function showAdicionarAulaModal(codigoContratacao) {
    const confirmHtml = `
      <div class="modal-overlay" id="confirmAdicionarAulaModal" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 450px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">Adicionar Nova Aula</h3>
          </div>
          <div class="modal-body">
            <div class="text-center py-4">
              <i class="fas fa-plus-circle text-5xl text-orange-500 mb-4"></i>
              <p class="text-lg text-gray-700 mb-2">Deseja adicionar mais uma aula a este cronograma?</p>
              <p class="text-sm text-gray-500 mt-4">
                <i class="fas fa-info-circle text-orange-500 mr-2"></i>
                Uma nova aula será criada com status "Pendente"
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button id="btnNaoAdicionarAula" class="btn-secondary btn-compact">Não</button>
            <button id="btnSimAdicionarAula" class="btn-primary btn-compact">
              <i class="fas fa-check mr-2"></i>
              Sim, adicionar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const confirmContainer = document.createElement('div');
    confirmContainer.innerHTML = confirmHtml;
    document.body.appendChild(confirmContainer);
    
    const confirmModal = confirmContainer.querySelector('#confirmAdicionarAulaModal');
    const btnSim = confirmModal.querySelector('#btnSimAdicionarAula');
    const btnNao = confirmModal.querySelector('#btnNaoAdicionarAula');
    
    const closeConfirm = () => {
      confirmContainer.remove();
    };
    
    btnNao.addEventListener('click', closeConfirm);
    
    btnSim.addEventListener('click', async () => {
      try {
        // Desabilitar botão para evitar cliques duplos
        btnSim.disabled = true;
        btnSim.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adicionando...';
        
        // Ler o valor Hora/Aula exibido no contrato e converter para número
        let valorHoraContrato = 35;
        try {
          const displayEl = document.getElementById('display-hora-aula-contrato');
          if (displayEl) {
            const raw = (displayEl.textContent || displayEl.innerText || 'R$ 0,00').trim();
            // Remover 'R$', espaços e separar milhares/decimais
            const numeric = raw.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
            const parsed = parseFloat(numeric);
            if (isFinite(parsed)) valorHoraContrato = parsed;
          }
        } catch (err) {
          console.warn('Não foi possível ler display-hora-aula-contrato, usando 35 por padrão', err);
        }

        const novoIdAula = await BANCO.addNovaAulaLista(codigoContratacao, valorHoraContrato);
        
        showToast(`✅ Nova aula criada com sucesso! ID: ${novoIdAula}`, 'success');
        closeConfirm();
        
        // Recarregar a tabela
        const tbody = document.getElementById('tbody-aulas-detalhadas');
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="9" class="text-center py-8">
                <div class="flex flex-col items-center justify-center">
                  <div class="loading-spinner-large mb-3"></div>
                  <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                </div>
              </td>
            </tr>
          `;
        }
        
        // Recarregar as aulas
        await loadAulasDetalhadas(codigoContratacao);
        
      } catch (error) {
        console.error('❌ Erro ao adicionar nova aula:', error);
        showToast('❌ Erro ao adicionar nova aula: ' + error.message, 'error');
        btnSim.disabled = false;
        btnSim.innerHTML = '<i class="fas fa-check mr-2"></i>Sim, adicionar';
      }
    });
    
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirm();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeConfirm();
    };
    document.addEventListener('keydown', escHandler);
    confirmContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para mostrar modal de observação da aula
  function showObservacaoAulaModal(observacao, idAula) {
    const modalHtml = `
      <div class="modal-overlay" id="observacaoAulaModal">
        <div class="modal-container max-w-2xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-clipboard-list text-green-500 mr-2"></i>
              Observações da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="form-group">
              <label class="block text-sm font-medium text-gray-700 mb-2">Observação</label>
              <textarea id="observacaoTexto" readonly class="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-sm resize-none" rows="8" placeholder="Nenhuma observação registrada">${escapeHtml(observacao)}</textarea>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnFecharObservacao" class="btn-secondary">Fechar</button>
            <button id="btnEditarObservacao" class="btn-primary">
              <i class="fas fa-edit mr-2"></i>
              Editar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#observacaoAulaModal');
    const btnFechar = modal.querySelector('#btnFecharObservacao');
    const btnEditar = modal.querySelector('#btnEditarObservacao');
    const btnClose = modal.querySelector('.modal-close');
    const textarea = modal.querySelector('#observacaoTexto');
    const footer = modal.querySelector('.modal-footer');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnFechar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    // Modo de edição
    btnEditar.addEventListener('click', () => {
      // Tornar textarea editável
      textarea.removeAttribute('readonly');
      textarea.classList.remove('bg-gray-50');
      textarea.classList.add('bg-white', 'border-2', 'border-orange-500');
      textarea.focus();
      
      // Esconder botão Editar
      btnEditar.style.display = 'none';
      
      // Criar botão Salvar
      const btnSalvar = document.createElement('button');
      btnSalvar.id = 'btnSalvarObservacao';
      btnSalvar.className = 'btn-primary';
      btnSalvar.innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Edição';
      footer.appendChild(btnSalvar);
      
      btnSalvar.addEventListener('click', async () => {
        const novaObservacao = textarea.value.trim();
        
        const originalHTML = btnSalvar.innerHTML;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
        btnSalvar.disabled = true;
        textarea.disabled = true;
        
        try {
          await BANCO.updateObservacoesAula(idAula, novaObservacao);
          showToast('✅ Observações atualizadas com sucesso!', 'success');
          closeModal();
          
          // Recarregar a tabela
          const tbody = document.getElementById('tbody-aulas-detalhadas');
          if (tbody) {
            tbody.innerHTML = `
              <tr>
                <td colspan="9" class="text-center py-8">
                  <div class="flex flex-col items-center justify-center">
                    <div class="loading-spinner-large mb-3"></div>
                    <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                  </div>
                </td>
              </tr>
            `;
          }
          
          // Buscar o código de contratação do modal aberto
          const modalOverlay = document.querySelector('.modal-overlay');
          if (modalOverlay && modalOverlay.id !== 'observacaoAulaModal') {
            const codigoElement = modalOverlay.querySelector('h3');
            if (codigoElement) {
              const match = codigoElement.textContent.match(/\d{4}/);
              if (match) {
                const codigoContratacao = match[0];
                await loadAulasDetalhadas(codigoContratacao);
              }
            }
          }
          
        } catch (error) {
          console.error('❌ Erro ao atualizar observações:', error);
          showToast('❌ Erro ao atualizar observações', 'error');
          btnSalvar.innerHTML = originalHTML;
          btnSalvar.disabled = false;
          textarea.disabled = false;
        }
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para mostrar modal de seleção de status
  function showStatusModal(idAula, statusAtual) {
    const statusOptions = [
      { nome: 'Pendente', cor: '#9CA3AF', bgColor: '#F3F4F6', borderColor: '#D1D5DB' },
      { nome: 'Reagendada', cor: '#F59E0B', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
      { nome: 'Concluída', cor: '#10B981', bgColor: '#D1FAE5', borderColor: '#6EE7B7' },
      { nome: 'Reposição', cor: '#3B82F6', bgColor: '#DBEAFE', borderColor: '#93C5FD' },
      { nome: 'Cancelada', cor: '#EF4444', bgColor: '#FEE2E2', borderColor: '#FCA5A5' }
    ];
    
    const modalHtml = `
      <div class="modal-overlay" id="statusModal" style="z-index: 10000;">
        <div class="modal-container" style="max-width: 400px;">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-exchange-alt text-orange-500 mr-2"></i>
              Alterar Status da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <p class="text-sm text-gray-600 mb-4">
              <i class="fas fa-info-circle text-orange-500 mr-2"></i>
              Selecione o novo status para esta aula:
            </p>
            
            <div class="space-y-2" id="status-options-container">
              ${statusOptions.map(option => `
                <button 
                  type="button" 
                  class="status-option-btn w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md"
                  style="
                    background-color: ${option.bgColor};
                    border-color: ${statusAtual === option.nome ? option.cor : option.borderColor};
                    ${statusAtual === option.nome ? 'box-shadow: 0 0 0 3px ' + option.bgColor + ';' : ''}
                  "
                  data-status="${option.nome}"
                  data-color="${option.cor}"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <div class="w-4 h-4 rounded-full mr-3" style="background-color: ${option.cor};"></div>
                      <span class="font-medium" style="color: ${option.cor};">${option.nome}</span>
                    </div>
                    ${statusAtual === option.nome ? '<i class="fas fa-check" style="color: ' + option.cor + ';"></i>' : ''}
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarStatus" class="btn-secondary btn-compact">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#statusModal');
    const btnCancelar = modal.querySelector('#btnCancelarStatus');
    const btnClose = modal.querySelector('.modal-close');
    const statusButtons = modal.querySelectorAll('.status-option-btn');
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
    // Event listeners para cada opção de status
    statusButtons.forEach(btn => {
      btn.addEventListener('click', async function() {
        const novoStatus = this.dataset.status;
        
        if (novoStatus === statusAtual) {
          showToast('ℹ️ Este já é o status atual', 'info');
          closeModal();
          return;
        }
        
        // Desabilitar todos os botões e mostrar loading
        statusButtons.forEach(b => b.disabled = true);
        this.innerHTML = '<div class="flex items-center justify-center"><i class="fas fa-spinner fa-spin mr-2"></i> Atualizando...</div>';
        
        try {
          // Atualizar no Firebase
          await BANCO.updateStatusAula(idAula, novoStatus);
          
          showToast(`✅ Status atualizado para "${novoStatus}"`, 'success');
          closeModal();
          
          // Recarregar a tabela
          const tbody = document.getElementById('tbody-aulas-detalhadas');
          if (tbody) {
            tbody.innerHTML = `
              <tr>
                <td colspan="9" class="text-center py-8">
                  <div class="flex flex-col items-center justify-center">
                    <div class="loading-spinner-large mb-3"></div>
                    <p class="text-orange-500 font-comfortaa font-bold">Atualizando dados...</p>
                  </div>
                </td>
              </tr>
            `;
          }
          
          // Buscar o código de contratação do modal aberto
          const modalOverlay = document.querySelector('.modal-overlay');
          if (modalOverlay) {
            const codigoElement = modalOverlay.querySelector('h3');
            if (codigoElement) {
              const match = codigoElement.textContent.match(/\d{4}/);
              if (match) {
                const codigoContratacao = match[0];
                await loadAulasDetalhadas(codigoContratacao);
              }
            }
          }
          
        } catch (error) {
          console.error('❌ Erro ao atualizar status:', error);
          showToast('❌ Erro ao atualizar status', 'error');
          statusButtons.forEach(b => b.disabled = false);
          this.innerHTML = `
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-4 h-4 rounded-full mr-3" style="background-color: ${this.dataset.color};"></div>
                <span class="font-medium" style="color: ${this.dataset.color};">${novoStatus}</span>
              </div>
            </div>
          `;
        }
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para fazer parse do relatório formatado
  function parseRelatorio(relatorioTexto) {
    const resultado = {
      descricao: '',
      comportamento: '',
      recomendacoes: '',
      dataEnvio: ''
    };
    
    if (!relatorioTexto) return resultado;
    
    const linhas = relatorioTexto.split('\n');
    let secaoAtual = '';
    let conteudoAtual = [];
    
    for (const linha of linhas) {
      const linhaTrim = linha.trim();
      
      if (linhaTrim === '---') {
        if (secaoAtual && conteudoAtual.length > 0) {
          const conteudo = conteudoAtual.join('\n').trim();
          if (secaoAtual === 'descricao') resultado.descricao = conteudo;
          else if (secaoAtual === 'comportamento') resultado.comportamento = conteudo;
          else if (secaoAtual === 'recomendacoes') resultado.recomendacoes = conteudo;
        }
        secaoAtual = '';
        conteudoAtual = [];
        continue;
      }
      
      if (linhaTrim.startsWith('Descrição da Aula')) {
        secaoAtual = 'descricao';
        continue;
      }
      
      if (linhaTrim.startsWith('Comportamento do estudante')) {
        secaoAtual = 'comportamento';
        continue;
      }
      
      if (linhaTrim.startsWith('Recomendações')) {
        secaoAtual = 'recomendacoes';
        continue;
      }
      
      if (linhaTrim.startsWith('Enviado em:')) {
        resultado.dataEnvio = linhaTrim.replace('Enviado em:', '').trim();
        continue;
      }
      
      if (secaoAtual && linhaTrim) {
        conteudoAtual.push(linha);
      }
    }
    
    if (secaoAtual && conteudoAtual.length > 0) {
      const conteudo = conteudoAtual.join('\n').trim();
      if (secaoAtual === 'descricao') resultado.descricao = conteudo;
      else if (secaoAtual === 'comportamento') resultado.comportamento = conteudo;
      else if (secaoAtual === 'recomendacoes') resultado.recomendacoes = conteudo;
    }
    
    return resultado;
  }
  
  // Função para abrir modal de visualização de relatório
  function openRelatorioViewModal(idAula, relatorio) {
    aulaSelecionada = { idAula, relatorio };
    
    if (!relatorio || relatorio.trim() === '') {
      openRelatorioEditModal(idAula, '');
      return;
    }
    
    const dados = parseRelatorio(relatorio);
    
    const modalHtml = `
      <div class="modal-overlay" id="relatorioViewModal">
        <div class="modal-container max-w-2xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-comment text-orange-500 mr-2"></i>
              Relatório da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="space-y-4">
              <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">Descrição da Aula</label>
                <textarea readonly class="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-sm resize-none" rows="4">${escapeHtml(dados.descricao)}</textarea>
              </div>
              
              <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">Comportamento do estudante</label>
                <textarea readonly class="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-sm resize-none" rows="3">${escapeHtml(dados.comportamento)}</textarea>
              </div>
              
              <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">Recomendações</label>
                <textarea readonly class="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-sm resize-none" rows="3">${escapeHtml(dados.recomendacoes)}</textarea>
              </div>
              
              <div class="text-sm text-gray-500">
                <i class="fas fa-clock mr-2"></i>
                <span>Enviado em: ${escapeHtml(dados.dataEnvio || 'Não informado')}</span>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnFecharView" class="btn-secondary">Fechar</button>
            <button id="btnCopiarRelatorioView" class="btn-secondary">
              <i class="fas fa-copy mr-2"></i>
              Copiar relatório
            </button>
            <button id="btnEditarView" class="btn-primary">
              <i class="fas fa-edit mr-2"></i>
              Editar
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#relatorioViewModal');
    const btnFechar = modal.querySelector('#btnFecharView');
    const btnEditar = modal.querySelector('#btnEditarView');
      const btnCopiar = modal.querySelector('#btnCopiarRelatorioView');
    const btnClose = modal.querySelector('.modal-close');
    
    const closeModal = () => {
      modalContainer.remove();
      aulaSelecionada = null;
    };
    

    btnFechar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);

    btnCopiar.addEventListener('click', () => {
      // Adicionar estado de loading ao botão
      const originalHtml = btnCopiar.innerHTML;
      btnCopiar.disabled = true;
      btnCopiar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Copiando...';

      // Buscar dados do cliente, data e professor a partir do modal de detalhes (se aberto)
      let nomeCliente = '';
      let dataAula = '';
      let nomeProfessor = '';

      try {
        // Procurar outro modal aberto (detalhes da contratação) que contenha o rótulo "Nome do Cliente"
        const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
        for (const ov of overlays) {
          if (ov.id === 'relatorioViewModal') continue;
          const labels = Array.from(ov.querySelectorAll('.text-xs, .text-sm, div'));
          const labelEl = labels.find(el => el.textContent && el.textContent.trim().startsWith('Nome do Cliente'));
          if (labelEl) {
            // valor costuma estar no mesmo bloco com classe text-sm
            const valueEl = labelEl.parentElement.querySelector('.text-sm') || labelEl.nextElementSibling;
            if (valueEl && valueEl.textContent) {
              nomeCliente = valueEl.textContent.trim();
            }
            break;
          }
        }

        // Se não encontrou no DOM, tentar variáveis globais conhecidas
        if (!nomeCliente && window.aulaSelecionada && window.aulaSelecionada.aula) {
          const aulaObj = window.aulaSelecionada.aula;
          nomeCliente = aulaObj.nomeCliente || aulaObj.nome || '';
        }

        // Buscar data e professor a partir de contexto existente
        if (window.aulaSelecionada && window.aulaSelecionada.aula) {
          const aulaObj = window.aulaSelecionada.aula;
          if (aulaObj.aulas && Array.isArray(aulaObj.aulas)) {
            const aulaEspecifica = aulaObj.aulas.find(a => a['id-Aula'] === idAula || a.id === idAula);
            if (aulaEspecifica) {
              dataAula = aulaEspecifica.data || '';
              nomeProfessor = aulaEspecifica.professor || '';
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao extrair dados do modal de detalhes:', err);
      }

      // Tentar extrair a data diretamente da linha da tabela (coluna 1) no DOM
      try {
        if (!dataAula) {
          // procura linha na tabela detalhada via atributo data-id-aula
          let row = document.querySelector(`#tbody-aulas-detalhadas tr[data-id-aula="${idAula}"]`) || document.querySelector(`tr[data-id-aula="${idAula}"]`);
          if (row) {
            const firstTd = row.querySelector('td');
            if (firstTd && firstTd.textContent && firstTd.textContent.trim()) {
              dataAula = firstTd.textContent.trim();
            }
          }

          // alternativa: procurar botão que contém atributo data-data
          if (!dataAula) {
            const dataBtn = document.querySelector(`.btn-data-aula[data-id-aula="${idAula}"]`);
            if (dataBtn) dataAula = dataBtn.getAttribute('data-data') || (dataBtn.textContent && dataBtn.textContent.trim());
          }
        }
      } catch (err) {
        console.warn('Erro ao extrair data da linha da tabela:', err);
      }

      // Tentar extrair o nome do professor diretamente da coluna 5 (índice 4) da linha da tabela
      try {
        if (!nomeProfessor) {
          const row = document.querySelector(`#tbody-aulas-detalhadas tr[data-id-aula="${idAula}"]`) || document.querySelector(`tr[data-id-aula="${idAula}"]`);
          if (row) {
            const tds = row.querySelectorAll('td');
            if (tds && tds.length >= 5) {
              const profText = tds[4].textContent && tds[4].textContent.trim();
              if (profText) nomeProfessor = profText;
            }
          }

          // fallback para botão/elemento com atributo data-professor
          if (!nomeProfessor) {
            const profBtn = document.querySelector(`.btn-professor-aula[data-id-aula="${idAula}"]`);
            if (profBtn) nomeProfessor = profBtn.getAttribute('data-professor') || (profBtn.textContent && profBtn.textContent.trim());
          }
        }
      } catch (err) {
        console.warn('Erro ao extrair professor da linha da tabela:', err);
      }

      // Reduzir nome do professor às primeiras 3 palavras
      let nomeProfessorCurto = nomeProfessor || '';
      if (nomeProfessorCurto) {
        const partsProf = nomeProfessorCurto.split(/\s+/).filter(Boolean);
        nomeProfessorCurto = partsProf.slice(0, 3).join(' ');
      }

      // Fallbacks genéricos
      if (!nomeCliente) nomeCliente = (window.aulaSelecionada && window.aulaSelecionada.nomeCliente) || '';
      if (!dataAula) dataAula = (window.aulaSelecionada && window.aulaSelecionada.data) || '';
      if (!nomeProfessor) nomeProfessor = (window.aulaSelecionada && window.aulaSelecionada.professor) || '';

      // Extrair primeiro + segundo nome do cliente (duas primeiras palavras)
      let nomeClienteCurto = nomeCliente || '';
      if (nomeClienteCurto) {
        const parts = nomeClienteCurto.split(/\s+/).filter(Boolean);
        nomeClienteCurto = parts.slice(0, 2).join(' ');
      }

      // Template com tokens entre colchetes
      const template = `Bom dia [NomeCliente] esta é o relatório da aula do dia [DataDaAula] com prof. [NomeDoProfessor]\n\n*Descrição da Aula:*\n[Descricao]\n\n*Comportamento do estudante:*\n[Comportamento]\n\n*Recomendações:*\n[Recomendacoes]`;

      // Substituir tokens
      let texto = template
        .replace(/\[NomeCliente\]/g, nomeClienteCurto || '[NomeCliente]')
        .replace(/\[DataDaAula\]/g, dataAula || '[DataDaAula]')
        .replace(/\[NomeDoProfessor\]/g, nomeProfessorCurto || '[NomeDoProfessor]')
        .replace(/\[Descricao\]/g, dados.descricao || '')
        .replace(/\[Comportamento\]/g, dados.comportamento || '')
        .replace(/\[Recomendacoes\]/g, dados.recomendacoes || '');

      const finish = (success) => {
        btnCopiar.disabled = false;
        btnCopiar.innerHTML = originalHtml;
        if (success) showToast('Relatório de Aula copiado', 'success');
      };

      if (navigator.clipboard) {
        navigator.clipboard.writeText(texto).then(() => {
          finish(true);
        }).catch(() => {
          finish(false);
          alert('Não foi possível copiar o relatório.');
        });
      } else {
        // Fallback para browsers antigos
        const temp = document.createElement('textarea');
        temp.value = texto;
        document.body.appendChild(temp);
        temp.select();
        try {
          document.execCommand('copy');
          finish(true);
        } catch (err) {
          finish(false);
          alert('Não foi possível copiar o relatório.');
        }
        document.body.removeChild(temp);
      }
    });

    btnEditar.addEventListener('click', () => {
      closeModal();
      openRelatorioEditModal(idAula, relatorio);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para abrir modal de edição de relatório
  function openRelatorioEditModal(idAula, relatorio) {
    aulaSelecionada = { idAula, relatorio };
    
    const dados = relatorio ? parseRelatorio(relatorio) : { descricao: '', comportamento: '', recomendacoes: '', dataEnvio: '' };
    
    const modalHtml = `
      <div class="modal-overlay" id="relatorioEditModal">
        <div class="modal-container max-w-2xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-lg">
              <i class="fas fa-edit text-orange-500 mr-2"></i>
              Editar Relatório da Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="space-y-4">
              <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">Descrição da Aula</label>
                <textarea id="editDescricao" class="w-full p-4 border-2 border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" rows="4" placeholder="Em um parágrafo curto, faça um breve Resumo da aula">${escapeHtml(dados.descricao)}</textarea>
              </div>
              
              <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">Comportamento do estudante</label>
                <textarea id="editComportamento" class="w-full p-4 border-2 border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" rows="3" placeholder="Comente sobre Comportamento e participação do estudante">${escapeHtml(dados.comportamento)}</textarea>
              </div>
              
              <div class="form-group">
                <label class="block text-sm font-medium text-gray-700 mb-2">Recomendações</label>
                <textarea id="editRecomendacoes" class="w-full p-4 border-2 border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" rows="3" placeholder="Quais Recomendações para os pais para as próximas aulas?">${escapeHtml(dados.recomendacoes)}</textarea>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btnCancelarEdit" class="btn-secondary">Cancelar</button>

            <button id="btnCopiarRelatorio" class="btn-secondary">
              <i class="fas fa-copy mr-2"></i>
              Copiar relatório
            </button>

            <button id="btnEnviarRelatorio" class="btn-primary">
              <i class="fa-solid fa-floppy-disk mr-2"></i>
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = modalContainer.querySelector('#relatorioEditModal');
    const editDescricao = modal.querySelector('#editDescricao');
    const editComportamento = modal.querySelector('#editComportamento');
    const editRecomendacoes = modal.querySelector('#editRecomendacoes');
    const btnCancelar = modal.querySelector('#btnCancelarEdit');
    const btnEnviar = modal.querySelector('#btnEnviarRelatorio');
      const btnCopiar = modal.querySelector('#btnCopiarRelatorio');
    const btnClose = modal.querySelector('.modal-close');
    
    const closeModal = () => {
      modalContainer.remove();
      aulaSelecionada = null;
    };
    

    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);

    btnCopiar.addEventListener('click', () => {
      const titulo1 = 'Descrição da Aula:';
      const titulo2 = 'Comportamento do estudante:';
      const titulo3 = 'Recomendações:';
      const texto = `${titulo1}\n${editDescricao.value}\n\n${titulo2}\n${editComportamento.value}\n\n${titulo3}\n${editRecomendacoes.value}`;
      // Copiar para a área de transferência
      if (navigator.clipboard) {
        navigator.clipboard.writeText(texto).then(() => {
          showToast('Relatório de Aula copiado', 'success');
        }, () => {
          alert('Não foi possível copiar o relatório.');
        });
      } else {
        // Fallback para browsers antigos
        const temp = document.createElement('textarea');
        temp.value = texto;
        document.body.appendChild(temp);
        temp.select();
        try {
          document.execCommand('copy');
          showToast('Relatório de Aula copiado', 'success');
        } catch (err) {
          alert('Não foi possível copiar o relatório.');
        }
        document.body.removeChild(temp);
      }
    });

    btnEnviar.addEventListener('click', async () => {
      await salvarRelatorioAula(idAula, editDescricao, editComportamento, editRecomendacoes, modalContainer);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const escHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
  }
  
  // Função para salvar relatório
  async function salvarRelatorioAula(idAula, descricaoEl, comportamentoEl, recomendacoesEl, modalContainer) {
    const descricao = descricaoEl.value.trim();
    const comportamento = comportamentoEl.value.trim();
    const recomendacoes = recomendacoesEl.value.trim();
    
    if (!descricao || !comportamento || !recomendacoes) {
      showToast('❌ Todos os campos devem ser preenchidos!', 'error');
      return;
    }
    
    const agora = new Date();
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const diaSemana = diasSemana[agora.getDay()];
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    const dataFormatada = `${diaSemana} - ${dia}/${mes}/${ano} às ${hora}:${minuto}`;
    
    const relatorioFormatado = `Descrição da Aula\n${descricao}\n\n---\n\nComportamento do estudante\n${comportamento}\n\n---\n\nRecomendações\n${recomendacoes}\n\n---\n\nEnviado em: ${dataFormatada}`;
    
    try {
      const btnEnviar = modalContainer.querySelector('#btnEnviarRelatorio');
      btnEnviar.disabled = true;
      btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...';
      
      await BANCO.updateRelatorioAula(idAula, relatorioFormatado);
      
      console.log('✅ Relatório salvo:', relatorioFormatado);
      
      const codigoContratacao = document.querySelector('.info-value-small.font-mono')?.textContent.trim();
      if (codigoContratacao) {
        await loadAulasDetalhadas(codigoContratacao);
      }
      
      showToast('✅ Relatório salvo com sucesso!', 'success');
      modalContainer.remove();
      aulaSelecionada = null;
      
    } catch (error) {
      console.error('❌ Erro ao salvar relatório:', error);
      showToast('❌ Erro ao salvar relatório. Tente novamente.', 'error');
      
      const btnEnviar = modalContainer.querySelector('#btnEnviarRelatorio');
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar Relatório';
    }
  }
  
  // Função principal para mostrar modal de relatório
  function showRelatorioModal(relatorio, idAula) {
    openRelatorioViewModal(idAula, relatorio);
  }
  
  // Função para mostrar modal de observação
  function showObservacaoModal(observacao) {
    const { modal, closeModal } = createModal(
      `<h3 class="font-lexend font-bold text-lg">
        <i class="fas fa-comment text-blue-500 mr-2"></i>
        Observações da Aula
      </h3>`,
      `<div class="observacoes-content">${escapeHtml(observacao)}</div>`,
      `<button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );
  }
  
  // Função para confirmar exclusão de aula
  async function confirmDeleteAula(aulaId, aulaNome) {
    const { modal, closeModal } = createModal(
      'Confirmar Exclusão',
      `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <h4 class="font-lexend font-bold text-lg mb-2">Tem certeza?</h4>
          <p class="text-gray-600 mb-6">
            Você está prestes a excluir permanentemente a aula de <strong>${aulaNome}</strong>.
            Esta ação não pode ser desfeita.
          </p>
        </div>
      `,
      [
        {
          text: 'Cancelar',
          classes: 'btn-secondary btn-compact'
        },
        {
          text: 'Excluir Permanentemente',
          classes: 'btn-danger btn-compact',
          attributes: 'id="btn-confirmar-exclusao"'
        }
      ]
    );
    
    // Configurar botão de confirmação
    const btnConfirmar = modal.querySelector('#btn-confirmar-exclusao');
    btnConfirmar.addEventListener('click', async () => {
      btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Excluindo...';
      btnConfirmar.disabled = true;
      
      try {
        // Primeiro: tentar excluir todas as aulas individuais vinculadas (BancoDeAulas-Lista)
        try {
          // Ler o documento do contrato para obter o codigoContratacao
          const contratoDoc = await db.collection('BancoDeAulas').doc(aulaId).get();
          const codigoContratacao = contratoDoc && contratoDoc.exists ? contratoDoc.data().codigoContratacao : null;
          if (codigoContratacao) {
            const aulasVinculadas = await BANCO.fetchBancoDeAulasLista(codigoContratacao);
            if (aulasVinculadas && aulasVinculadas.length) {
              const docIds = aulasVinculadas.map(a => a.id).filter(Boolean);
              if (docIds.length) {
                await BANCO.deleteAulasLista(docIds);
                console.log('✅ Aulas vinculadas excluídas:', docIds.length);
              }
            }
          }
        } catch (errLista) {
          console.warn('⚠️ Não foi possível excluir aulas vinculadas automaticamente:', errLista);
        }

        // Em seguida, excluir o documento principal do contrato
        await BANCO.deleteAula(aulaId);
        showToast('✅ Aula excluída com sucesso', 'success');
        closeModal();
        
        // Recarregar dados
        if (typeof loadBancoDeAulas === 'function') {
          loadBancoDeAulas();
        }
      } catch (error) {
        console.error('❌ Erro ao excluir aula:', error);
        showToast('❌ Erro ao excluir aula', 'error');
        btnConfirmar.innerHTML = 'Excluir Permanentemente';
        btnConfirmar.disabled = false;
      }
    });
  }
  
  // Função para mostrar modal de seleção de aulas para solicitação
  async function showModalSolicitacao(codigoContratacao, aulaContratacao) {
    console.log('📋 Abrindo modal de solicitação para código:', codigoContratacao);
    
    try {
      // Buscar aulas da contratação específica
      const aulas = await BANCO.fetchBancoDeAulasLista(codigoContratacao);
      
      if (!aulas || aulas.length === 0) {
        showToast('❌ Nenhuma aula encontrada para esta contratação', 'error');
        return;
      }
      
      // Ordenar aulas por data
      aulas.sort((a, b) => {
        const dataA = a.data || '';
        const dataB = b.data || '';
        const parseData = (dataStr) => {
          if (!dataStr) return new Date(0);
          const match = dataStr.match(/\w{3} - (\d{2})\/(\d{2})\/(\d{4})/);
          if (!match) return new Date(0);
          const dia = parseInt(match[1]);
          const mes = parseInt(match[2]) - 1;
          const ano = parseInt(match[3]);
          return new Date(ano, mes, dia);
        };
        return parseData(dataA).getTime() - parseData(dataB).getTime();
      });
      
      // Criar linhas da tabela
      let linhasHtml = '';
      aulas.forEach((aula, index) => {
        const statusClass = getStatusBadgeClass(aula.StatusAula || 'Pendente');
        linhasHtml += `
          <tr class="aula-row-solicitacao" data-id-aula="${aula['id-Aula']}" data-doc-id="${aula.id}">
            <td class="py-2 px-3 text-center">
              <input type="checkbox" class="checkbox-solicitacao-aula w-4 h-4 cursor-pointer" 
                     data-id-aula="${aula['id-Aula']}" 
                     data-doc-id="${aula.id}"
                     data-data="${aula.data || '--'}"
                     data-horario="${aula.horario || '--'}"
                     data-duracao="${aula.duracao || '--'}"
                     data-materia="${aula.materia || '--'}"
                     data-professor="${aula.professor || 'A definir'}"
                     data-estudante="${aula.estudante || '--'}">
            </td>
            <td class="py-2 px-3 text-sm">${aula.data || '--'}</td>
            <td class="py-2 px-3 text-sm text-center">${aula.horario || '--'}</td>
            <td class="py-2 px-3 text-sm text-center">${aula.duracao || '--'}</td>
            <td class="py-2 px-3 text-sm">${aula.materia || '--'}</td>
            <td class="py-2 px-3 text-sm">${aula.professor || 'A definir'}</td>
            <td class="py-2 px-3 text-sm">${aula.estudante || '--'}</td>
            <td class="py-2 px-3">
              <span class="status-badge ${statusClass} text-xs px-2 py-1">
                ${aula.StatusAula || 'Pendente'}
              </span>
            </td>
          </tr>
        `;
      });
      
      const modalHtml = `
        <div class="modal-overlay" id="modal-solicitacao" style="z-index: 10000;">
          <div class="modal-container max-w-6xl">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg text-gray-800">
                <i class="fas fa-calendar-plus text-orange-500 mr-2"></i>
                Selecione as aulas para a solicitação
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                <i class="fas fa-info-circle text-blue-600 mr-3 mt-1"></i>
                <div>
                  <p class="text-sm text-blue-800 font-medium">Informação</p>
                  <p class="text-xs text-blue-700 mt-1">Selecione as aulas que deseja incluir na solicitação de aula.</p>
                </div>
              </div>
              
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-gray-100 border-b border-gray-200">
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">
                        <input type="checkbox" id="select-all-aulas-solicitacao" class="w-4 h-4 cursor-pointer" title="Selecionar todas">
                      </th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Data da Aula</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">Horário</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">Duração</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Matéria</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Professor</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Estudante</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody id="tbody-solicitacao-aulas">
                    ${linhasHtml}
                  </tbody>
                </table>
              </div>
              
              <div class="mt-4 text-sm text-gray-600">
                <span id="count-selected-solicitacao">0</span> aula(s) selecionada(s)
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btn-cancelar-solicitacao" class="btn-secondary">
                <i class="fas fa-times mr-2"></i>
                Cancelar
              </button>
              <button id="btn-gerar-solicitacao-final" class="btn-primary" disabled>
                <i class="fas fa-file-alt mr-2"></i>
                Gerar Solicitação
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Adicionar modal ao DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      const modal = document.getElementById('modal-solicitacao');
      const btnCancelar = document.getElementById('btn-cancelar-solicitacao');
      const btnGerar = document.getElementById('btn-gerar-solicitacao-final');
      const selectAll = document.getElementById('select-all-aulas-solicitacao');
      const checkboxes = modal.querySelectorAll('.checkbox-solicitacao-aula');
      const countSelected = document.getElementById('count-selected-solicitacao');
      
      // Função para atualizar contador e estado do botão
      function updateSelection() {
        const selected = modal.querySelectorAll('.checkbox-solicitacao-aula:checked');
        countSelected.textContent = selected.length;
        btnGerar.disabled = selected.length === 0;
        
        // Atualizar checkbox "selecionar todos"
        selectAll.checked = selected.length === checkboxes.length && checkboxes.length > 0;
        selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
      }
      
      // Evento para selecionar/desselecionar todos
      selectAll.addEventListener('change', function() {
        checkboxes.forEach(cb => {
          cb.checked = this.checked;
          const row = cb.closest('tr');
          if (this.checked) {
            row.classList.add('bg-orange-50');
          } else {
            row.classList.remove('bg-orange-50');
          }
        });
        updateSelection();
      });
      
      // Evento para checkboxes individuais
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          const row = this.closest('tr');
          if (this.checked) {
            row.classList.add('bg-orange-50');
          } else {
            row.classList.remove('bg-orange-50');
          }
          updateSelection();
        });
      });
      
      // Botão cancelar
      btnCancelar.addEventListener('click', () => {
        modal.remove();
      });
      
      // Botão fechar (X)
      modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
      });
      
      // Botão gerar solicitação
      btnGerar.addEventListener('click', () => {
        const selected = modal.querySelectorAll('.checkbox-solicitacao-aula:checked');
        
        if (selected.length === 0) {
          showToast('⚠️ Selecione pelo menos uma aula para a solicitação', 'warning');
          return;
        }
        
        // Coletar dados das aulas selecionadas
        const aulasSelecionadas = Array.from(selected).map(cb => ({
          data: cb.dataset.data,
          horario: cb.dataset.horario,
          duracao: cb.dataset.duracao,
          materia: cb.dataset.materia,
          professor: cb.dataset.professor,
          estudante: cb.dataset.estudante
        }));
        
        // Fechar modal de seleção
        modal.remove();
        
        // Abrir modal final com a solicitação
        showModalSolicitacaoFinal(aulaContratacao, aulasSelecionadas);
      });
      
      // Fechar ao clicar fora
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
      // Fechar com ESC
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
      
    } catch (error) {
      console.error('❌ Erro ao carregar aulas:', error);
      showToast('❌ Erro ao carregar aulas. Tente novamente.', 'error');
    }
  }
  
  // Função para mostrar modal final com a solicitação formatada
  async function showModalSolicitacaoFinal(aulaContratacao, aulasSelecionadas) {
    console.log('📄 Gerando solicitação final');
    
    // Mostrar loading
    showToast('⏳ Carregando dados do cliente...', 'info');
    
    // Buscar dados do cliente na coleção cadastroClientes
    let enderecoAulas = aulaContratacao.endereco || '--';
    let complementoAulas = aulaContratacao.referencia || '--';
    
    try {
      const cpfCliente = aulaContratacao.cpf;
      
      if (cpfCliente && cpfCliente !== '--') {
        console.log('🔍 Buscando cliente com CPF:', cpfCliente);
        
        const clientesRef = db.collection('cadastroClientes');
        const querySnapshot = await clientesRef.where('cpf', '==', cpfCliente).get();
        
        if (!querySnapshot.empty) {
          const clienteDoc = querySnapshot.docs[0];
          const clienteData = clienteDoc.data();
          
          console.log('✅ Cliente encontrado:', clienteData);
          
          // Atualizar com os dados do cadastro do cliente
          if (clienteData.enderecoAulas) {
            enderecoAulas = clienteData.enderecoAulas;
          }
          if (clienteData.complementoAulas) {
            complementoAulas = clienteData.complementoAulas;
          }
        } else {
          console.log('⚠️ Cliente não encontrado no cadastro');
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados do cliente:', error);
    }
    
    // Calcular total a receber (Valor Equipe)
    // Somar todas as durações e multiplicar por 35
    let totalHoras = 0;
    aulasSelecionadas.forEach(aula => {
      if (aula.duracao) {
        // Converter formato "1h30", "2h", "1h15" para horas decimais
        const duracaoStr = aula.duracao.toLowerCase();
        let horas = 0;
        let minutos = 0;
        
        if (duracaoStr.includes('h')) {
          const partes = duracaoStr.split('h');
          horas = parseInt(partes[0]) || 0;
          if (partes[1]) {
            minutos = parseInt(partes[1]) || 0;
          }
        }
        
        // Converter para horas decimais (ex: 1h30 = 1.5)
        totalHoras += horas + (minutos / 60);
      }
    });
    
    const totalReceber = totalHoras * 35;
    
    // Criar linhas da tabela de aulas
    let linhasAulasHtml = '';
    aulasSelecionadas.forEach((aula, index) => {
      linhasAulasHtml += `
        <tr class="${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
          <td class="py-2 px-3 text-sm border-r border-gray-200">${aula.data}</td>
          <td class="py-2 px-3 text-sm text-center border-r border-gray-200">${aula.horario}</td>
          <td class="py-2 px-3 text-sm text-center border-r border-gray-200">${aula.duracao}</td>
          <td class="py-2 px-3 text-sm border-r border-gray-200">${aula.materia}</td>
          <td class="py-2 px-3 text-sm border-r border-gray-200">${aula.professor}</td>
          <td class="py-2 px-3 text-sm">${aula.estudante}</td>
        </tr>
      `;
    });
    
    const modalHtml = `
      <div class="modal-overlay" id="modal-solicitacao-final" style="z-index: 10001;">
        <div class="modal-container max-w-5xl">
          <div class="modal-header">
            <h3 class="font-lexend font-bold text-xl text-gray-800">
              <i class="fas fa-file-contract text-orange-500 mr-2"></i>
              Solicitação de Aula
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body">
            <!-- Informações do Cliente -->
            <div class="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 rounded-lg p-4 mb-5 shadow-sm">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">
                    <i class="fas fa-user text-orange-500 mr-2"></i>Nome do Cliente
                  </p>
                  <p class="text-sm font-semibold text-gray-800">${aulaContratacao.nome || aulaContratacao.nomeCliente || '--'}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">
                    <i class="fas fa-map-marker-alt text-orange-500 mr-2"></i>Endereço
                  </p>
                  <p class="text-sm font-semibold text-gray-800">${enderecoAulas}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">
                    <i class="fas fa-dollar-sign text-green-600 mr-2"></i>Total a Receber (Valor Equipe)
                  </p>
                  <p class="text-lg font-bold text-green-600">R$ ${totalReceber.toFixed(2)}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-1">
                    <i class="fas fa-map-signs text-orange-500 mr-2"></i>Referência
                  </p>
                  <p class="text-sm font-semibold text-gray-800">${complementoAulas}</p>
                </div>
              </div>
            </div>
            
            <!-- Tabela de Aulas -->
            <div class="mb-4">
              <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
                <i class="fas fa-list-ul text-orange-500 mr-2"></i>
                Aulas Solicitadas (${aulasSelecionadas.length})
              </h4>
              
              <div class="overflow-x-auto border border-gray-200 rounded-lg">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                      <th class="py-3 px-3 text-xs font-semibold border-r border-orange-400">Data da Aula</th>
                      <th class="py-3 px-3 text-xs font-semibold text-center border-r border-orange-400">Horário de Início</th>
                      <th class="py-3 px-3 text-xs font-semibold text-center border-r border-orange-400">Duração</th>
                      <th class="py-3 px-3 text-xs font-semibold border-r border-orange-400">Matéria</th>
                      <th class="py-3 px-3 text-xs font-semibold border-r border-orange-400">Professor</th>
                      <th class="py-3 px-3 text-xs font-semibold">Estudante</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhasAulasHtml}
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- Rodapé com informações adicionais -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
              <p class="text-xs text-gray-600 flex items-center">
                <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                <span>Esta solicitação contém <strong class="text-orange-600">${aulasSelecionadas.length} aula(s)</strong> agendada(s).</span>
              </p>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btn-fechar-solicitacao" class="btn-secondary">
              <i class="fas fa-times mr-2"></i>
              Fechar
            </button>
            <button id="btn-imprimir-solicitacao" class="btn-primary">
              <i class="fas fa-print mr-2"></i>
              Imprimir Solicitação
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar modal ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('modal-solicitacao-final');
    const btnFechar = document.getElementById('btn-fechar-solicitacao');
    const btnImprimir = document.getElementById('btn-imprimir-solicitacao');
    
    // Botão fechar
    btnFechar.addEventListener('click', () => {
      modal.remove();
    });
    
    // Botão fechar (X)
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });
    
    // Botão imprimir
    btnImprimir.addEventListener('click', () => {
      const modalContent = modal.querySelector('.modal-container');
      if (!modalContent) {
        alert('Erro ao localizar o conteúdo do modal para exportação.');
        return;
      }
      // Salva estilos originais
      const originalOverflow = modalContent.style.overflow;
      const originalMaxHeight = modalContent.style.maxHeight;
      const originalScrollTop = modalContent.scrollTop;
      // Expande o modal para mostrar todo o conteúdo
      modalContent.style.overflow = 'visible';
      modalContent.style.maxHeight = 'none';
      modalContent.scrollTop = 0;
      // Oculta o botão de imprimir para não aparecer na imagem
      btnImprimir.style.display = 'none';
      // Aguarda um frame para garantir o layout
      setTimeout(() => {
        html2canvas(modalContent, {
          backgroundColor: null,
          useCORS: true,
          scale: 2
        }).then(canvas => {
          // Restaura estilos
          modalContent.style.overflow = originalOverflow;
          modalContent.style.maxHeight = originalMaxHeight;
          modalContent.scrollTop = originalScrollTop;
          btnImprimir.style.display = '';
          // Cria o link para download
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = 'solicitacao-aula.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(() => {
          modalContent.style.overflow = originalOverflow;
          modalContent.style.maxHeight = originalMaxHeight;
          modalContent.scrollTop = originalScrollTop;
          btnImprimir.style.display = '';
          alert('Erro ao gerar a imagem.');
        });
      }, 50);
    });
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Fechar com ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
  
  // Função para abrir modal de remoção de aulas
  async function showRemoverAulaModal(codigoContratacao) {
    console.log('🗑️ Abrindo modal de remoção de aulas para código:', codigoContratacao);
    
    try {
      // Buscar aulas da contratação específica
      const aulas = await BANCO.fetchBancoDeAulasLista(codigoContratacao);
      
      if (!aulas || aulas.length === 0) {
        showToast('❌ Nenhuma aula encontrada para esta contratação', 'error');
        return;
      }
      
      // Ordenar aulas por data
      aulas.sort((a, b) => {
        const dataA = a.data || '';
        const dataB = b.data || '';
        const parseData = (dataStr) => {
          if (!dataStr) return new Date(0);
          const match = dataStr.match(/\w{3} - (\d{2})\/(\d{2})\/(\d{4})/);
          if (!match) return new Date(0);
          const dia = parseInt(match[1]);
          const mes = parseInt(match[2]) - 1;
          const ano = parseInt(match[3]);
          return new Date(ano, mes, dia);
        };
        return parseData(dataA).getTime() - parseData(dataB).getTime();
      });
      
      // Criar linhas da tabela
      let linhasHtml = '';
      aulas.forEach((aula, index) => {
        const statusClass = getStatusBadgeClass(aula.StatusAula || 'Pendente');
        linhasHtml += `
          <tr class="aula-row-remove" data-id-aula="${aula['id-Aula']}" data-doc-id="${aula.id}">
            <td class="py-2 px-3 text-center">
              <input type="checkbox" class="checkbox-remove-aula w-4 h-4 cursor-pointer" data-id-aula="${aula['id-Aula']}" data-doc-id="${aula.id}">
            </td>
            <td class="py-2 px-3 text-sm">${aula.data || '--'}</td>
            <td class="py-2 px-3 text-sm text-center">${aula.horario || '--'}</td>
            <td class="py-2 px-3 text-sm text-center">${aula.duracao || '--'}</td>
            <td class="py-2 px-3 text-sm">${aula.materia || '--'}</td>
            <td class="py-2 px-3 text-sm">${aula.professor || 'A definir'}</td>
            <td class="py-2 px-3">
              <span class="status-badge ${statusClass} text-xs px-2 py-1">
                ${aula.StatusAula || 'Pendente'}
              </span>
            </td>
          </tr>
        `;
      });
      
      const modalHtml = `
        <div class="modal-overlay" id="removerAulaModal">
          <div class="modal-container max-w-6xl">
            <div class="modal-header">
              <h3 class="font-lexend font-bold text-lg text-gray-800">
                <i class="fas fa-trash-alt text-red-500 mr-2"></i>
                Selecione as aulas que gostaria de excluir
              </h3>
              <button class="modal-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                <i class="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-1"></i>
                <div>
                  <p class="text-sm text-yellow-800 font-medium">Atenção!</p>
                  <p class="text-xs text-yellow-700 mt-1">As aulas selecionadas serão excluídas permanentemente do banco de dados.</p>
                </div>
              </div>
              
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-gray-100 border-b border-gray-200">
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">
                        <input type="checkbox" id="select-all-aulas" class="w-4 h-4 cursor-pointer" title="Selecionar todas">
                      </th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Data da Aula</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">Horário</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600 text-center">Duração</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Matéria</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Professor</th>
                      <th class="py-3 px-3 text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody id="tbody-remover-aulas">
                    ${linhasHtml}
                  </tbody>
                </table>
              </div>
              
              <div class="mt-4 text-sm text-gray-600">
                <span id="count-selected-aulas">0</span> aula(s) selecionada(s)
              </div>
            </div>
            
            <div class="modal-footer">
              <button id="btn-cancelar-remover" class="btn-secondary">
                <i class="fas fa-times mr-2"></i>
                Cancelar
              </button>
              <button id="btn-confirmar-remover" class="btn-danger" disabled>
                <i class="fas fa-trash-alt mr-2"></i>
                Excluir Aulas
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Adicionar modal ao DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      const modal = document.getElementById('removerAulaModal');
      const btnCancelar = document.getElementById('btn-cancelar-remover');
      const btnConfirmar = document.getElementById('btn-confirmar-remover');
      const selectAll = document.getElementById('select-all-aulas');
      const countSelected = document.getElementById('count-selected-aulas');

      // Helper para obter checkboxes atuais (em caso de re-render)
      const getCheckboxes = () => Array.from(modal.querySelectorAll('.checkbox-remove-aula'));
      
      // Função para atualizar contador e estado do botão
      function updateSelection() {
        const checkboxesNow = getCheckboxes();
        const selected = modal.querySelectorAll('.checkbox-remove-aula:checked');
        countSelected.textContent = selected.length;
        btnConfirmar.disabled = selected.length === 0;

        // Atualizar checkbox "selecionar todos"
        selectAll.checked = selected.length === checkboxesNow.length && checkboxesNow.length > 0;
        selectAll.indeterminate = selected.length > 0 && selected.length < checkboxesNow.length;
      }
      
      // Evento para selecionar/desselecionar todos
      selectAll.addEventListener('change', function() {
        const checkboxesNow = getCheckboxes();
        checkboxesNow.forEach(cb => {
          cb.checked = this.checked;
          const row = cb.closest('tr');
          if (this.checked) row.classList.add('bg-red-50'); else row.classList.remove('bg-red-50');
        });
        updateSelection();
      });
      
      // Usar event delegation para lidar com checkboxes individuais dinamicamente
      modal.addEventListener('change', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('checkbox-remove-aula')) {
          const cb = e.target;
          const row = cb.closest('tr');
          if (cb.checked) row.classList.add('bg-red-50'); else row.classList.remove('bg-red-50');
          updateSelection();
        }
      });
      
      // Botão cancelar
      btnCancelar.addEventListener('click', () => {
        modal.remove();
      });
      
      // Botão fechar (X)
      modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
      });
      
      // Botão confirmar exclusão
      btnConfirmar.addEventListener('click', async () => {
        const selected = modal.querySelectorAll('.checkbox-remove-aula:checked');
        
        if (selected.length === 0) {
          showToast('⚠️ Selecione pelo menos uma aula para excluir', 'warning');
          return;
        }
        
        // Confirmar exclusão
        const confirmacao = confirm(`Tem certeza que deseja excluir ${selected.length} aula(s)? Esta ação não pode ser desfeita.`);
        if (!confirmacao) return;
        
        // Mostrar loading
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Excluindo...';
        btnConfirmar.disabled = true;
        btnCancelar.disabled = true;
        
        try {
          // Coletar IDs das aulas selecionadas
          const idsAulas = Array.from(selected).map(cb => cb.dataset.idAula);
          const docIds = Array.from(selected).map(cb => cb.dataset.docId).filter(x => x);

          console.log('🗑️ Excluindo aulas (id-Aula):', idsAulas, ' docIds:', docIds);

          if (!window.BANCO || typeof window.BANCO.deleteAulasLista !== 'function') {
            throw new Error('Função BANCO.deleteAulasLista não disponível');
          }

          // Excluir aulas do banco de dados
          await BANCO.deleteAulasLista(docIds);
          
          showToast(`✅ ${selected.length} aula(s) excluída(s) com sucesso`, 'success');
          
          // Fechar modal
          modal.remove();
          
          // Recarregar lista de aulas
          if (typeof loadBancoDeAulas === 'function') {
            loadBancoDeAulas();
          }
          
          // Recarregar o modal de detalhes caso esteja aberto (atualiza tabela e displays)
          try {
            const detalhesContainer = document.querySelector('.modal-container.max-w-6xl');
            if (detalhesContainer) {
              // mantém o modal de detalhes aberto e apenas recarrega a tabela
              await loadAulasDetalhadas(codigoContratacao);
            }
          } catch (e) { console.warn('Erro ao recarregar detalhes após exclusão', e); }
          
        } catch (error) {
          console.error('❌ Erro ao excluir aulas:', error);
          showToast('❌ Erro ao excluir aulas. Tente novamente.', 'error');
          btnConfirmar.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Excluir Aulas';
          btnConfirmar.disabled = false;
          btnCancelar.disabled = false;
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao carregar aulas:', error);
      showToast('❌ Erro ao carregar aulas. Tente novamente.', 'error');
    }
  }
  
  // Função para animar contador
  function animateCounter(elementId, finalValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let current = 0;
    const increment = finalValue / 30;
    const interval = setInterval(() => {
      current += increment;
      if (current >= finalValue) {
        current = finalValue;
        clearInterval(interval);
      }
      element.textContent = Math.round(current);
    }, 30);
  }
  
  // Função para limpar filtros
  function clearFilters() {
    document.getElementById('filter-cliente').value = '';
    document.getElementById('filter-data').value = '';
    document.getElementById('filter-codigo').value = '';
    document.getElementById('filter-professor').value = '';
    document.getElementById('filter-data-custom').classList.add('hidden');
    document.getElementById('filter-data-custom').value = '';
    
    // Re-renderizar com todos os dados
    renderAulasCards(aulasData);
  }
  
  // Retornar API pública
  return {
    renderAulasCards,
    createAulaCardCompact,
    viewAulaDetails,
    confirmDeleteAula,
    openEditModal,
    clearFilters,
    loadAulasDetalhadas
  };
})();

// Exportar objeto para uso global
if (typeof window !== 'undefined') {
  window.BancoDeAulasCards = BancoDeAulasCards;
  console.log('✅ BancoDeAulasCards exportado para escopo global');
}
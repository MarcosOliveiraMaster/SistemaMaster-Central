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
    
    // Verificar se há aulas sem professor
    const aulasSemProfessor = aula.aulas ? 
      aula.aulas.filter(a => !a.professor || a.professor === 'A definir' || a.professor === '').length : 0;
    
    // Verificar se há aulas com professor atribuído
    const aulasComProfessor = numAulas - aulasSemProfessor;
    
    // Determinar classe CSS para status
    const getStatusClass = (status) => {
      if (status === 'Pagamento Efetuado' || status === 'Ativo') return 'success';
      if (status === 'Pendente' || status === 'Inativo') return 'error';
      if (status === 'Parcial' || status === 'Processando') return 'warning';
      return 'info';
    };
    
    // Cor para professores incompletos (vermelho suave)
    const professorCorClass = aulasComProfessor === numAulas ? 'text-green-500' : 'text-red-400';
    
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
          
          <!-- Linha 3: Total de aulas -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-book"></i>
              Total aulas:
            </span>
            <span class="info-value">${numAulas}</span>
          </div>
          
          <!-- Linha 4: Com professor -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-chalkboard-teacher"></i>
              Com professor:
            </span>
            <span class="info-value font-medium ${professorCorClass}">
              ${aulasComProfessor}/${numAulas}
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
                    <div class="text-xs font-medium text-gray-500 mb-1">Aluno(s)</div>
                    <div class="text-sm text-gray-800">${aula.nomeAluno || '--'}</div>
                  </div>
                  <div>
                    <div class="text-xs font-medium text-gray-500 mb-1">Aula Emergencial</div>
                    <div class="text-sm text-gray-800">${(aula.AulaEmergencial !== undefined && aula.AulaEmergencial !== null) ? aula.AulaEmergencial : '--'}</div>
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
            
            <!-- Aulas Agendadas -->
            <div>
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-lexend font-bold text-base text-gray-700">
                  <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>
                  Aulas Agendadas
                </h4>
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
    } else {
      console.warn('⚠️ Código de contratação não encontrado');
      const tbody = modal.querySelector('#tbody-aulas-detalhadas');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center py-8">
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
    
    // Configurar botão de gerar contrato (desabilitado por enquanto)
    const btnGerarContrato = modal.querySelector('#btn-gerar-contrato');
    btnGerarContrato.addEventListener('click', () => {
      showToast('Funcionalidade "Gerar Contrato" será implementada em breve', 'info');
    });
    
    // Configurar botão de gerar solicitação de aula
    const btnGerarSolicitacao = modal.querySelector('#btn-gerar-solicitacao');
    btnGerarSolicitacao.addEventListener('click', () => {
      showToast('Gerando solicitação de aula...', 'info');
      // TODO: Implementar funcionalidade de gerar solicitação
    });
    
    // Configurar botão de ver observações (contratação)
    const btnVerObservacoes = modal.querySelector('#btn-ver-observacoes');
    btnVerObservacoes.addEventListener('click', () => {
      showObservacoesModal(aula);
    });

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
            <th>Status</th>
            <th class="text-center">Aula concluída</th>
            <th class="text-center">Relatório</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody id="tbody-aulas-detalhadas">
          <tr>
            <td colspan="9" class="text-center py-8">
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
            <td colspan="9" class="text-center py-8">
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
      
      // Renderizar as aulas
      let html = '';
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
      
      tbody.innerHTML = html;
      
      // Adicionar event listeners para os botões de relatório e observação
      setupAulaDetailsEventListeners();
      
      console.log(`✅ ${aulas.length} aulas renderizadas na tabela`);
      
    } catch (error) {
      console.error('❌ Erro ao carregar aulas detalhadas:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8">
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
        
        const novoIdAula = await BANCO.addNovaAulaLista(codigoContratacao);
        
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
    const btnClose = modal.querySelector('.modal-close');
    
    const closeModal = () => {
      modalContainer.remove();
      aulaSelecionada = null;
    };
    
    btnFechar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
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
            <button id="btnEnviarRelatorio" class="btn-primary">
              <i class="fas fa-paper-plane mr-2"></i>
              Enviar Relatório
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
    const btnClose = modal.querySelector('.modal-close');
    
    const closeModal = () => {
      modalContainer.remove();
      aulaSelecionada = null;
    };
    
    btnCancelar.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
    
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
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
  
  // Função para criar card de aula compacto
  function createAulaCardCompact(aula) {
    const card = document.createElement('div');
    card.className = 'aula-card-compact';
    card.dataset.id = aula.id;
    
    // Nome do cliente - BUSCAR DO CAMPO "nome" DO DOCUMENTO
    const nomeCliente = aula.nome || aula.nomeCliente || 'Cliente não identificado';
    
    // Data da contratação
    const dataContratacao = formatDate(aula.dataContratacao) || '--/--/----';
    
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
      if (status === 'Parcial') return 'warning';
      return 'info';
    };
    
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
            <span class="status-badge ${getStatusClass(statusPagamento)}">
              ${statusPagamento}
            </span>
          </div>
          
          <!-- Linha 2: Status do contrato -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-file-contract"></i>
              Contrato:
            </span>
            <span class="status-badge ${getStatusClass(statusContrato)}">
              ${statusContrato}
            </span>
          </div>
          
          <!-- Linha 3: Data de contratação -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-calendar-day"></i>
              Contratação:
            </span>
            <span class="info-value">${dataContratacao}</span>
          </div>
          
          <!-- Linha 4: Total de aulas -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-book"></i>
              Total aulas:
            </span>
            <span class="info-value">${numAulas}</span>
          </div>
          
          <!-- Linha 5: Com professor -->
          <div class="info-row">
            <span class="info-label">
              <i class="fas fa-chalkboard-teacher"></i>
              Com professor:
            </span>
            <span class="info-value ${aulasComProfessor === numAulas ? 'text-green-500' : 'text-orange-500'}">
              ${aulasComProfessor}/${numAulas}
            </span>
          </div>
        </div>
        
        <!-- Botões de ação -->
        <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between">
          <button class="btn-delete-aula text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded transition-colors flex items-center">
            <i class="fas fa-trash-alt mr-1.5"></i>
            <span>Excluir</span>
          </button>
          <button class="btn-edit-aula text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded transition-colors flex items-center">
            <i class="fas fa-edit mr-1.5"></i>
            <span>Editar</span>
          </button>
        </div>
      </div>
    `;
    
    // Adicionar evento de clique no card para abrir os detalhes
    card.addEventListener('click', (e) => {
      // Impedir que o clique nos botões dispare o evento do card
      if (!e.target.closest('button')) {
        viewAulaDetails(aula);
      }
    });
    
    // Adicionar eventos aos botões
    const btnDelete = card.querySelector('.btn-delete-aula');
    const btnEdit = card.querySelector('.btn-edit-aula');
    
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteAula(aula.id, nomeCliente);
    });
    
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      editAula(aula);
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
              Detalhes da Contratação - ${aula.codigoContratacao || 'Sem código'}
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body vertical-scroll-hidden">
            <!-- Informações do Cliente com scroll horizontal -->
            <div class="mb-6">
              <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
                <i class="fas fa-user-circle text-orange-500 mr-2"></i>
                Informações do Cliente
              </h4>
              
              <div class="horizontal-scroll">
                <div class="info-grid" style="min-width: 1000px;">
                  <!-- Coluna 1: Dados básicos -->
                  <div class="info-column">
                    <div class="info-item">
                      <div class="info-label-small">Nome do Cliente</div>
                      <div class="info-value-small">${aula.nome || aula.nomeCliente || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">CPF</div>
                      <div class="info-value-small">${aula.cpf || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Aluno(s)</div>
                      <div class="info-value-small">${aula.nomeAluno || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Data da Contratação</div>
                      <div class="info-value-small">${formatDate(aula.dataContratacao) || '--'}</div>
                    </div>
                  </div>
                  
                  <!-- Coluna 2: Status do contrato -->
                  <div class="info-column">
                    <div class="info-item">
                      <div class="info-label-small">Status do Contrato</div>
                      <div class="info-value-small">
                        <span class="status-badge ${getStatusBadgeClass(aula.statusContrato)}">
                          ${aula.statusContrato || '--'}
                        </span>
                      </div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Assinatura do Contrato</div>
                      <div class="info-value-small">${formatDate(aula.dataAssinaturaContrato) || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Método de pagamento</div>
                      <div class="info-value-small">${aula.modoPagamento || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Código da Contratação</div>
                      <div class="info-value-small font-mono">${aula.codigoContratacao || '--'}</div>
                    </div>
                  </div>
                  
                  <!-- Coluna 3: Status do pagamento -->
                  <div class="info-column">
                    <div class="info-item">
                      <div class="info-label-small">Status do Pagamento</div>
                      <div class="info-value-small">
                        <span class="status-badge ${getStatusBadgeClass(aula.statusPagamento)}">
                          ${aula.statusPagamento || '--'}
                        </span>
                      </div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Data da primeira parcela</div>
                      <div class="info-value-small">${formatDate(aula.dataPrimeiraParcela) || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Data da segunda parcela</div>
                      <div class="info-value-small">${formatDate(aula.dataSegundaParcela) || '--'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label-small">Tipo de Equipe</div>
                      <div class="info-value-small">${aula.equipe || '--'}</div>
                    </div>
                  </div>
                  
                  <!-- Coluna 4: Botões de ação -->
                  <div class="info-column">
                    <div class="info-item">
                      <div class="info-label-small">Ações</div>
                      <div class="space-y-2 mt-2">
                        <button id="btn-gerar-contrato" class="btn-primary w-full" disabled>
                          <i class="fas fa-file-pdf mr-2"></i>
                          Gerar Contrato
                        </button>
                        <button id="btn-editar-contrato" class="btn-secondary w-full">
                          <i class="fas fa-edit mr-2"></i>
                          Editar Contrato
                        </button>
                        <button id="btn-enviar-notificacao" class="btn-secondary w-full">
                          <i class="fas fa-bell mr-2"></i>
                          Enviar Notificação
                        </button>
                      </div>
                    </div>
                    <div class="info-item mt-4">
                      <div class="info-label-small">Observações</div>
                      <div class="info-value-small text-sm">${aula.observacoes || 'Nenhuma observação registrada.'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Aulas Agendadas -->
            <div>
              <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
                <i class="fas fa-calendar-alt text-orange-500 mr-2"></i>
                Aulas Agendadas
              </h4>
              
              <div class="table-container-double-scroll">
                <div class="table-wrapper vertical-scroll-hidden">
                  ${renderAulasDetalhadas(aula.aulas || [])}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button id="btn-fechar-modal" class="btn-secondary">
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
    
    modalContainer.addEventListener('remove', () => {
      document.removeEventListener('keydown', escHandler);
    });
    
    // Configurar botão de gerar contrato (desabilitado por enquanto)
    const btnGerarContrato = modal.querySelector('#btn-gerar-contrato');
    btnGerarContrato.addEventListener('click', () => {
      showToast('Funcionalidade "Gerar Contrato" será implementada em breve', 'info');
    });
    
    // Configurar botão de editar contrato
    const btnEditarContrato = modal.querySelector('#btn-editar-contrato');
    btnEditarContrato.addEventListener('click', () => {
      editAula(aula);
      closeModal();
    });
    
    // Configurar botão de enviar notificação
    const btnEnviarNotificacao = modal.querySelector('#btn-enviar-notificacao');
    btnEnviarNotificacao.addEventListener('click', () => {
      showToast('Funcionalidade de notificação será implementada em breve', 'info');
    });
  }
  
  // Função para determinar classe do badge de status
  function getStatusBadgeClass(status) {
    if (!status) return 'info';
    
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('ativo') || statusLower.includes('efetuado') || statusLower.includes('concluído') || statusLower.includes('pago')) {
      return 'success';
    }
    
    if (statusLower.includes('inativo') || statusLower.includes('cancelado') || statusLower.includes('vencido')) {
      return 'error';
    }
    
    if (statusLower.includes('pendente') || statusLower.includes('parcial') || statusLower.includes('processando')) {
      return 'warning';
    }
    
    return 'info';
  }
  
  // Renderizar aulas detalhadas para o modal
  function renderAulasDetalhadas(aulas) {
    if (!aulas || aulas.length === 0) {
      return '<p class="text-gray-500 text-center py-4 text-sm">Nenhuma aula agendada</p>';
    }
    
    let html = `
      <table class="table-details">
        <thead>
          <tr>
            <th>Data</th>
            <th>Horário de Início</th>
            <th>Duração</th>
            <th>Matéria</th>
            <th>Professor</th>
            <th>Status</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    aulas.forEach((aula, index) => {
      const statusAula = aula.status || 'Agendada';
      const statusClass = getStatusBadgeClass(statusAula);
      
      html += `
        <tr>
          <td>${aula.data || '--'}</td>
          <td>${formatTime(aula.horario)}</td>
          <td>${aula.duracao || '--'}</td>
          <td>${aula.materia || '--'}</td>
          <td>
            <span class="${!aula.professor || aula.professor === 'A definir' ? 'text-orange-500 font-semibold' : ''}">
              ${aula.professor || 'A definir'}
            </span>
          </td>
          <td>
            <span class="status-badge ${statusClass}">
              ${statusAula}
            </span>
          </td>
          <td class="max-w-xs truncate">${aula.observacoes || '--'}</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    return html;
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
          classes: 'btn-secondary'
        },
        {
          text: 'Excluir Permanentemente',
          classes: 'btn-danger',
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
  
  // Função para editar aula
  function editAula(aula) {
    console.log('✏️ Editando aula:', aula.id);
    showToast(`✏️ Funcionalidade de edição será implementada em breve para: ${aula.codigoContratacao || aula.id}`, 'info');
    
    // TODO: Implementar modal de edição
    // Por enquanto, apenas mostra um toast
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
    editAula,
    clearFilters
  };
})();

// Exportar objeto para uso global
if (typeof window !== 'undefined') {
  window.BancoDeAulasCards = BancoDeAulasCards;
  console.log('✅ BancoDeAulasCards exportado para escopo global');
}
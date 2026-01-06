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
            <!-- Informações do Cliente com scroll horizontal -->
            <div class="mb-6">
              <h4 class="font-lexend font-bold text-base mb-3 text-gray-700">
                <i class="fas fa-user-circle text-orange-500 mr-2"></i>
                Informações do Cliente
              </h4>
              
              <div class="horizontal-scroll">
                <div class="info-grid" style="min-width: 1200px;">
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
                      <div class="info-label-small">Aula Emergencial</div>
                      <div class="info-value-small">${(aula.AulaEmergencial !== undefined && aula.AulaEmergencial !== null) ? aula.AulaEmergencial : '--'}</div>
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
                  
                  <!-- Coluna 4: Botões de ação (TAMANHO REDUZIDO) -->
                  <div class="info-column">
                    <div class="info-item">
                      <div class="info-label-small mb-2">Ações</div>
                      <div class="space-y-2">
                        <button id="btn-editar-contratacao" class="btn-secondary btn-compact w-full">
                          <i class="fas fa-edit mr-2 text-xs"></i>
                          Editar Contratação
                        </button>
                        <button id="btn-gerar-contrato" class="btn-primary btn-compact w-full" disabled>
                          <i class="fas fa-file-pdf mr-2 text-xs"></i>
                          Gerar Contrato
                          <span class="text-xs text-orange-200 ml-1">(em breve)</span>
                        </button>
                        <button id="btn-gerar-solicitacao" class="btn-secondary btn-compact w-full">
                          <i class="fas fa-calendar-plus mr-2 text-xs"></i>
                          Gerar Solicitação de Aula
                        </button>
                        <button id="btn-ver-observacoes" class="btn-secondary btn-compact w-full">
                          <i class="fas fa-eye mr-2 text-xs"></i>
                          Ver Observações
                        </button>
                      </div>
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
    
    if (statusLower.includes('ativo') || statusLower.includes('efetuado') || 
        statusLower.includes('concluído') || statusLower.includes('pago') ||
        statusLower.includes('assinado') || statusLower.includes('completo')) {
      return 'success';
    }
    
    if (statusLower.includes('inativo') || statusLower.includes('cancelado') || 
        statusLower.includes('vencido') || statusLower.includes('pendente')) {
      return 'error';
    }
    
    if (statusLower.includes('parcial') || statusLower.includes('processando')) {
      return 'warning';
    }
    
    return 'info';
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
            <th>Data</th>
            <th>Horário de Início</th>
            <th>Duração</th>
            <th>Matéria</th>
            <th>Professor</th>
            <th>Status</th>
            <th class="text-center">Chek Prof.</th>
            <th class="text-center">Relatório</th>
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
          <td class="text-center align-middle">${formatTime(aula.horario)}</td>
          <td>${aula.duracao || '--'}</td>
          <td>${aula.materia || '--'}</td>
          <td>
            <span class="${!aula.professor || aula.professor === 'A definir' ? 'text-orange-500 font-semibold' : ''}">
              ${aula.professor || 'A definir'}
            </span>
          </td>
          <td>
            <span class="status-badge ${statusClass} text-xs px-2 py-1">
              ${statusAula}
            </span>
          </td>
          <td class="flex items-center justify-center">
            <div class="text-sm font-medium text-center">${aula.ConfirmacaoProfessorAula !== undefined && aula.ConfirmacaoProfessorAula !== null ? escapeHtml(aula.ConfirmacaoProfessorAula) : '--'}</div>
          </td>
          <td class="text-center">
            <button type="button" class="btn-relatorio-aula inline-flex items-center justify-center w-8 h-8 rounded" data-relatorio="${encodeURIComponent(aula.RelatorioAula || '')}" data-aula-index="${index}" data-contrato-id="${contratoId || ''}" title="${aula.RelatorioAula ? 'Ver relatório' : 'Sem relatório'}">
              <i class="fas fa-file-alt ${aula.RelatorioAula ? 'text-green-500' : 'text-gray-300'}" aria-hidden="true"></i>
              <span class="sr-only">${aula.RelatorioAula ? 'Ver relatório' : 'Sem relatório'}</span>
            </button>
          </td>
          <td class="text-center">
            <button type="button" class="btn-observacao-aula inline-flex items-center justify-center w-8 h-8 rounded" data-observacao="${encodeURIComponent(aula.ObservacoesAula || '')}" title="${aula.ObservacoesAula ? 'Ver observação' : 'Sem observação'}">
              <i class="fas fa-comment ${aula.ObservacoesAula ? 'text-green-500' : 'text-gray-300'}" aria-hidden="true"></i>
              <span class="sr-only">${aula.ObservacoesAula ? 'Ver observação' : 'Sem observação'}</span>
            </button>
          </td>
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
    clearFilters
  };
})();

// Exportar objeto para uso global
if (typeof window !== 'undefined') {
  window.BancoDeAulasCards = BancoDeAulasCards;
  console.log('✅ BancoDeAulasCards exportado para escopo global');
}
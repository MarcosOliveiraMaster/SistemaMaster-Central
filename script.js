// Configurações globais
const CONFIG = {
  cacheDuration: 5 * 60 * 1000, // 5 minutos
  animationDuration: 300,
  sections: [
    'banco-aulas',
    'aulas-dia',
    'mensagens',
    'simulacoes',
    'fluxo-processos',
    'dashboard',
    'exportar-dados'
  ]
};

// Estado da aplicação
const APP_STATE = {
  currentSection: 'banco-aulas',
  cache: {
    bancoDeAulas: null,
    cadastroClientes: null,
    dataBaseProfessores: null,
    lastUpdated: {}
  },
  filters: {},
  isLoading: false
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando Painel Administrativo Master Educação');
  
  // Esconder loading após inicialização
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    initializeApp();
  }, 1000);
});

// Função para inicializar a aplicação
function initializeApp() {
  setupMenuNavigation();
  setupGlobalListeners();
  loadSection('banco-aulas');
  
  // Verificar conexão com Firebase
  checkFirebaseConnection();
}

// Configurar navegação do menu
function setupMenuNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  
  menuItems.forEach(item => {
    item.addEventListener('click', function() {
      const sectionId = this.getAttribute('data-section');
      
      if (sectionId && sectionId !== APP_STATE.currentSection) {
        // Remover classe active de todos os itens
        menuItems.forEach(i => i.classList.remove('active'));
        
        // Adicionar classe active ao item clicado
        this.classList.add('active');
        
        // Atualizar título da seção
        updateSectionTitle(this.querySelector('span').textContent);
        
        // Carregar a seção
        loadSection(sectionId);
      }
    });
  });
}

// Atualizar título da seção
function updateSectionTitle(title) {
  document.getElementById('section-title').textContent = title;
}

// Carregar seção com animação
async function loadSection(sectionId) {
  if (!CONFIG.sections.includes(sectionId)) {
    console.error(`Seção ${sectionId} não encontrada`);
    return;
  }
  
  // Animação de saída da seção atual
  const currentSection = document.querySelector('.section-content.active');
  if (currentSection) {
    currentSection.classList.add('fade-out');
    
    setTimeout(() => {
      currentSection.classList.remove('active', 'fade-out');
      currentSection.innerHTML = '';
      
      // Carregar nova seção
      showSection(sectionId);
    }, CONFIG.animationDuration);
  } else {
    showSection(sectionId);
  }
  
  APP_STATE.currentSection = sectionId;
}

// Mostrar seção
function showSection(sectionId) {
  const section = document.getElementById(sectionId);
  
  if (!section) {
    console.error(`Elemento da seção ${sectionId} não encontrado`);
    return;
  }
  
  // Limpar conteúdo anterior
  section.innerHTML = '';
  
  // Adicionar classe de loading
  section.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12">
      <div class="loading-spinner-large mb-4"></div>
      <p class="text-orange-500 font-comfortaa font-bold text-center">
        Carregando ${sectionId.replace('-', ' ')}<br>
        <span class="text-sm font-normal text-gray-500 mt-1 block">
          Buscando dados do Firebase...
        </span>
      </p>
    </div>
  `;
  
  // Mostrar seção
  section.classList.add('active');
  
  // Carregar conteúdo específico da seção
  setTimeout(() => {
    loadSectionContent(sectionId);
  }, 500);
}

// Carregar conteúdo específico da seção
function loadSectionContent(sectionId) {
  console.log(`Carregando conteúdo da seção: ${sectionId}`);
  
  // Chamar a função específica de cada seção
  switch(sectionId) {
    case 'banco-aulas':
      if (typeof loadBancoDeAulas === 'function') {
        loadBancoDeAulas();
      } else {
        console.error('Função loadBancoDeAulas não encontrada');
      }
      break;
    case 'aulas-dia':
      if (typeof loadAulasDoDia === 'function') {
        loadAulasDoDia();
      }
      break;
    case 'mensagens':
      if (typeof loadMensagensAutomaticas === 'function') {
        loadMensagensAutomaticas();
      }
      break;
    case 'simulacoes':
      if (typeof loadSimulacoes === 'function') {
        loadSimulacoes();
      }
      break;
    case 'fluxo-processos':
      if (typeof loadFluxoProcessos === 'function') {
        loadFluxoProcessos();
      }
      break;
    case 'dashboard':
      if (typeof loadDashboard === 'function') {
        loadDashboard();
      }
      break;
    case 'exportar-dados':
      if (typeof loadExportarDados === 'function') {
        loadExportarDados();
      }
      break;
  }
}

// Configurar listeners globais
function setupGlobalListeners() {
  // Listener para pesquisa
  const searchInput = document.querySelector('input[placeholder="Pesquisar..."]');
  if (searchInput) {
    searchInput.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') {
        performSearch(this.value);
      }
    });
  }
  
  // Listener para redimensionamento da tela
  window.addEventListener('resize', handleResize);
  
  // Inicializar handler de resize
  handleResize();
}

// Handler de redimensionamento
function handleResize() {
  if (window.innerWidth <= 768) {
    addMobileMenuToggle();
  } else {
    removeMobileMenuToggle();
  }
}

// Adicionar toggle de menu para mobile
function addMobileMenuToggle() {
  if (!document.getElementById('menu-toggle')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'menu-toggle';
    toggleBtn.className = 'menu-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    
    toggleBtn.addEventListener('click', () => {
      document.getElementById('menu-lateral').classList.toggle('menu-open');
    });
    
    document.body.appendChild(toggleBtn);
  }
}

// Remover toggle de menu para mobile
function removeMobileMenuToggle() {
  const toggleBtn = document.getElementById('menu-toggle');
  if (toggleBtn) {
    toggleBtn.remove();
  }
  document.getElementById('menu-lateral').classList.remove('menu-open');
}

// Função de pesquisa
function performSearch(query) {
  if (!query.trim()) {
    showToast('Digite algo para pesquisar', 'warning');
    return;
  }
  
  showToast(`Buscando por: "${query}"`, 'info');
}

// Sistema de Toast
function showToast(message, type = 'info', duration = 5000) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const toastId = 'toast-' + Date.now();
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };
  
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="${icons[type] || icons.info}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${getToastTitle(type)}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="removeToast('${toastId}')">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  toastContainer.appendChild(toast);
  
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toastId);
    }, duration);
  }
}

function getToastTitle(type) {
  const titles = {
    success: 'Sucesso!',
    error: 'Erro!',
    warning: 'Atenção!',
    info: 'Informação'
  };
  return titles[type] || 'Informação';
}

function removeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

// Verificar conexão com Firebase
function checkFirebaseConnection() {
  if (typeof db !== 'undefined') {
    db.collection("cadastroClientes").limit(1).get()
      .then(snapshot => {
        if (!snapshot.empty) {
          showToast('Conectado ao banco de dados', 'success', 3000);
        }
      })
      .catch(error => {
        console.error('Erro na conexão com Firebase:', error);
        showToast('Erro na conexão com o banco de dados', 'error');
      });
  } else {
    console.warn('Firebase não inicializado');
  }
}

// Função para formatar data
function formatDate(dateString) {
  if (!dateString) return '--/--/----';
  
  try {
    // Verificar se já está no formato dd/mm/yyyy
    if (typeof dateString === 'string' && dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        return dateString;
      }
    }
    
    // Tentar converter de timestamp ou string ISO
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '--/--/----';
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return '--/--/----';
  }
}

// Função para formatar hora
function formatTime(timeString) {
  if (!timeString) return '--:--';
  
  if (timeString.includes(':')) {
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  }
  
  return '--:--';
}

// Função para obter data de hoje formatada
function getTodayFormatted() {
  const hoje = new Date();
  const dia = hoje.getDate().toString().padStart(2, '0');
  const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Função para verificar se uma data é hoje
function isToday(dateString) {
  if (!dateString) return false;
  
  const hoje = getTodayFormatted();
  return dateString === hoje;
}

// Função para criar modal genérico
function createModal(title, content, buttons = []) {
  const modalId = 'modal-' + Date.now();
  
  const modalHTML = `
    <div id="${modalId}" class="modal-overlay">
      <div class="modal-container max-w-2xl">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">${title}</h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
          ${buttons.map(btn => `
            <button class="${btn.classes}" ${btn.attributes || ''}>
              ${btn.text}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);
  
  const modal = document.getElementById(modalId);
  const closeBtn = modal.querySelector('.modal-close');
  
  const closeModal = () => {
    modal.remove();
  };
  
  closeBtn.addEventListener('click', closeModal);
  
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
  
  modal.addEventListener('remove', () => {
    document.removeEventListener('keydown', escHandler);
  });
  
  return {
    modal,
    closeModal
  };
}

// Exportar funções para uso global
window.showToast = showToast;
window.removeToast = removeToast;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.getTodayFormatted = getTodayFormatted;
window.isToday = isToday;
window.createModal = createModal;
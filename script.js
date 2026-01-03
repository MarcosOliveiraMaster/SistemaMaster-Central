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
    <div class="flex items-center justify-center py-12">
      <div class="loading-spinner-large"></div>
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
  // Esta função será complementada por cada arquivo de functions específico
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
  // Adicionar toggle de menu para mobile se necessário
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
  
  // Implementar lógica de pesquisa específica para cada seção
  // Será complementada por cada functions-*.js
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
  
  // Remover toast automaticamente após a duração
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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Tentar parse de formato dd/mm/yyyy
      const parts = dateString.split('/');
      if (parts.length === 3) {
        return dateString;
      }
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

// Função para obter data formatada para filtros
function getFilterDate(type) {
  const hoje = new Date();
  let data = new Date(hoje);
  
  switch(type) {
    case 'hoje':
      return hoje.toLocaleDateString('pt-BR');
    case 'amanha':
      data.setDate(hoje.getDate() + 1);
      return data.toLocaleDateString('pt-BR');
    case 'ontem':
      data.setDate(hoje.getDate() - 1);
      return data.toLocaleDateString('pt-BR');
    default:
      return '';
  }
}

// Exportar funções para uso global
window.showToast = showToast;
window.removeToast = removeToast;
window.formatDate = formatDate;
window.formatTime = formatTime;
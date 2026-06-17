// script.js — Master Educação
// Correção: aguarda window.currentUser (definido por auth.js) antes de iniciar

const CONFIG = {
  cacheDuration: 5 * 60 * 1000,
  animationDuration: 300,
  sections: [
    'painel-central', 'banco-aulas', 'simulacoes', 'mensagens',
    'calendario', 'fluxo-processos', 'clientes', 'professores',
    'area-pagamento', 'exportar-dados', 'previsao-financeira'
  ]
};

const APP_STATE = {
  currentSection: 'painel-central',
  cache: { bancoDeAulas: null, cadastroClientes: null, dataBaseProfessores: null, lastUpdated: {} },
  filters: {},
  isLoading: false
};

document.addEventListener('DOMContentLoaded', () => {
  // Aguarda auth.js definir window.currentUser antes de inicializar o app
  // (requireAuth() seta window.currentUser após confirmar autenticação)
  const MAX_WAIT_MS   = 10000; // 10s timeout
  const CHECK_INTERVAL = 100;
  let waited = 0;

  const waitForAuth = setInterval(() => {
    waited += CHECK_INTERVAL;

    if (window.currentUser) {
      clearInterval(waitForAuth);
      setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
        initializeApp();
      }, 500);
      return;
    }

    if (waited >= MAX_WAIT_MS) {
      clearInterval(waitForAuth);
      // Se chegou aqui, requireAuth() deve ter redirecionado para login
      // Mas por segurança, redirecionar manualmente
      console.warn('[script] Timeout aguardando auth — redirecionando para login');
      window.location.replace('login.html');
    }
  }, CHECK_INTERVAL);
});

let _pendingProfessorTab = null;

function initializeApp() {
  setupMenuNavigation();
  setupDashboardSubmenu();
  setupSubgroupSubmenus();
  setupSidebarToggle();
  setupGlobalListeners();
  loadSection('painel-central');
  checkFirebaseConnection();
}

function setupSidebarToggle() {
  const logoBtn = document.getElementById('sidebar-logo-btn');
  const sidebar = document.getElementById('menu-lateral');
  if (!logoBtn || !sidebar) return;

  logoBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');

    if (sidebar.classList.contains('collapsed')) {
      const submenu = document.getElementById('submenu-dashboard');
      const chevron = document.getElementById('icon-dashboard-expand');
      if (submenu) submenu.classList.add('hidden');
      if (chevron) chevron.classList.remove('rotate');
      ['submenu-clientes', 'submenu-professores'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
      });
      ['icon-clientes-expand', 'icon-professores-expand'].forEach(id => {
        document.getElementById(id)?.classList.remove('rotate-90');
      });
    }
  });
}

function setupMenuNavigation() {
  const menuItems    = document.querySelectorAll('.menu-item:not(.menu-item-expandable)');
  const submenuItems = document.querySelectorAll('.menu-item-submenu:not(.menu-item-submenu-expandable)');
  const leafItems    = document.querySelectorAll('.menu-item-submenu-leaf');

  function clearActive() {
    menuItems.forEach(i => i.classList.remove('active'));
    submenuItems.forEach(i => i.classList.remove('active'));
    leafItems.forEach(i => i.classList.remove('active'));
  }

  menuItems.forEach(item => {
    item.addEventListener('click', function () {
      const sectionId = this.getAttribute('data-section');
      if (sectionId && sectionId !== APP_STATE.currentSection) {
        clearActive();
        this.classList.add('active');
        const title = this.getAttribute('data-title') || this.querySelector('span').textContent;
        updateSectionTitle(title);
        loadSection(sectionId);
      }
    });
  });

  submenuItems.forEach(item => {
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      const sectionId = this.getAttribute('data-section');
      if (sectionId && sectionId !== APP_STATE.currentSection) {
        clearActive();
        this.classList.add('active');
        const title = this.getAttribute('data-title') || this.querySelector('span').textContent;
        updateSectionTitle(title);
        loadSection(sectionId);
      }
    });
  });

  leafItems.forEach(item => {
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      const sectionId = this.getAttribute('data-section');
      const tabId     = this.getAttribute('data-tab');
      if (!sectionId) return;

      clearActive();
      this.classList.add('active');
      const title = this.getAttribute('data-title') || this.querySelector('span').textContent;
      updateSectionTitle(title);

      if (sectionId === APP_STATE.currentSection) {
        if (tabId) {
          const tabBtn = document.querySelector(`[data-dptab="${tabId}"]`);
          if (tabBtn) tabBtn.click();
        }
      } else {
        if (tabId) _pendingProfessorTab = tabId;
        loadSection(sectionId);
      }
    });
  });
}

function updateSectionTitle(title) {
  const el = document.getElementById('section-title');
  if (el) el.textContent = title;
}

function setupSubgroupSubmenus() {
  [
    { btnId: 'btn-clientes-menu',   subId: 'submenu-clientes',   iconId: 'icon-clientes-expand'   },
    { btnId: 'btn-professores-menu', subId: 'submenu-professores', iconId: 'icon-professores-expand' },
  ].forEach(({ btnId, subId, iconId }) => {
    const btn  = document.getElementById(btnId);
    const sub  = document.getElementById(subId);
    const icon = document.getElementById(iconId);
    if (!btn || !sub) return;
    let expanded = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      expanded = !expanded;
      sub.classList.toggle('hidden', !expanded);
      if (icon) icon.classList.toggle('rotate-90', expanded);
    });
  });
}

function setupDashboardSubmenu() {
  const btn    = document.getElementById('btn-dashboard-menu');
  const sub    = document.getElementById('submenu-dashboard');
  const icon   = document.getElementById('icon-dashboard-expand');
  let expanded = false;
  if (!btn || !sub) return;
  btn.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    expanded = !expanded;
    sub.classList.toggle('hidden', !expanded);
    if (icon) icon.classList.toggle('rotate', expanded);
  });
}

async function loadSection(sectionId) {
  if (!CONFIG.sections.includes(sectionId)) return;

  const currentSection = document.querySelector('.section-content.active');
  if (currentSection) {
    currentSection.classList.add('fade-out');
    setTimeout(() => {
      currentSection.classList.remove('active', 'fade-out');
      currentSection.innerHTML = '';
      showSection(sectionId);
    }, CONFIG.animationDuration);
  } else {
    showSection(sectionId);
  }
  APP_STATE.currentSection = sectionId;
}

function showSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.innerHTML = '';
  section.classList.add('active');

  if (sectionId === 'mensagens' || sectionId === 'previsao-financeira') {
    loadSectionContent(sectionId);
  } else {
    setTimeout(() => loadSectionContent(sectionId), 500);
  }
}

function loadSectionContent(sectionId) {
  switch (sectionId) {
    case 'painel-central':
      if (typeof loadPainelCentral === 'function') loadPainelCentral();
      break;
    case 'banco-aulas':
      if (typeof loadBancoDeAulas === 'function') loadBancoDeAulas();
      break;
    case 'mensagens':
      if (typeof loadPainelFinanceiro === 'function') loadPainelFinanceiro();
      break;
    case 'simulacoes':
      if (typeof Simulacoes !== 'undefined' && Simulacoes.loadSimulacoes) Simulacoes.loadSimulacoes();
      break;
    case 'fluxo-processos':
      if (typeof loadFluxoProcessos === 'function') loadFluxoProcessos();
      break;
    case 'clientes':
      if (typeof loadDashboardCliente === 'function') loadDashboardCliente();
      break;
    case 'professores':
      if (typeof DashboardProfessores !== 'undefined' && DashboardProfessores.init) {
        DashboardProfessores.init();
        if (_pendingProfessorTab) {
          const tabBtn = document.querySelector(`[data-dptab="${_pendingProfessorTab}"]`);
          if (tabBtn) tabBtn.click();
          _pendingProfessorTab = null;
        }
      }
      break;
    case 'exportar-dados':
      if (typeof loadExportarDados === 'function') loadExportarDados();
      break;
    case 'area-pagamento':
      if (typeof loadAreaPagamento === 'function') loadAreaPagamento();
      break;
    case 'previsao-financeira':
      if (typeof loadPrevisaoFinanceira === 'function') loadPrevisaoFinanceira();
      break;
  }
}

function setupGlobalListeners() {
  window.addEventListener('resize', handleResize);
  handleResize();
}

function handleResize() {
  if (window.innerWidth <= 768) addMobileMenuToggle();
  else removeMobileMenuToggle();
}

function addMobileMenuToggle() {
  if (document.getElementById('menu-toggle')) return;
  const btn = document.createElement('button');
  btn.id = 'menu-toggle';
  btn.className = 'menu-toggle';
  btn.innerHTML = '<i class="fas fa-bars"></i>';
  btn.addEventListener('click', () => {
    document.getElementById('menu-lateral').classList.toggle('menu-open');
  });
  document.body.appendChild(btn);
}

function removeMobileMenuToggle() {
  const btn = document.getElementById('menu-toggle');
  if (btn) btn.remove();
  const menu = document.getElementById('menu-lateral');
  if (menu) menu.classList.remove('menu-open');
}

/* ── Toast ── */
function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
  const toastId = 'toast-' + Date.now();
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="${icons[type] || icons.info}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${getToastTitle(type)}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="removeToast('${toastId}')"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => removeToast(toastId), duration);
}

function getToastTitle(type) {
  return { success: 'Sucesso!', error: 'Erro!', warning: 'Atenção!', info: 'Informação' }[type] || 'Informação';
}

function removeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;
  toast.classList.add('fade-out');
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
}

function checkFirebaseConnection() {
  if (typeof db !== 'undefined') {
    db.collection("cadastroClientes").limit(1).get()
      .then(() => showToast('Conectado ao banco de dados', 'success', 3000))
      .catch(() => {}); // silencioso — erros de permissão já tratados individualmente
  }
}

/* ── Utilitários ── */
function formatDate(dateString) {
  if (!dateString) return '--/--/----';
  try {
    if (typeof dateString === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--/--/----';
    return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
  } catch (_) { return '--/--/----'; }
}

function formatDateLong(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) { return ''; }
}

function formatTime(timeString) {
  if (!timeString || !timeString.includes(':')) return '--:--';
  const [h, m] = timeString.split(':');
  return `${h.padStart(2,'0')}:${m.padStart(2,'0')}`;
}

function getTodayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function isToday(dateString) { return dateString === getTodayFormatted(); }

function isValidDate(dateString) {
  if (!dateString) return false;
  const match = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const date = new Date(match[3], match[2]-1, match[1]);
  return date.getDate() === +match[1] && date.getMonth() === match[2]-1 && date.getFullYear() === +match[3];
}

function createModal(title, content, buttons = []) {
  const modalId = 'modal-' + Date.now();
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = `
    <div id="${modalId}" class="modal-overlay">
      <div class="modal-container max-w-2xl">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">${title}</h3>
          <button class="modal-close text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          ${buttons.map(btn => `<button class="${btn.classes}" ${btn.attributes || ''}>${btn.text}</button>`).join('')}
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalContainer);

  const modal    = document.getElementById(modalId);
  const closeBtn = modal.querySelector('.modal-close');
  const closeModal = () => modal.remove();
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  const escHandler = e => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escHandler);
  return { modal, closeModal };
}

// Exportações globais
window.showToast    = showToast;
window.removeToast  = removeToast;
window.formatDate   = formatDate;
window.formatDateLong = formatDateLong;
window.formatTime   = formatTime;
window.getTodayFormatted = getTodayFormatted;
window.isToday      = isToday;
window.isValidDate  = isValidDate;
window.createModal  = createModal;
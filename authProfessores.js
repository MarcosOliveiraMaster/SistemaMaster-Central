/**
 * authProfessores.js — Master Educação
 * ─────────────────────────────────────────────────────────────────────
 * Módulo de Autenticação e Permissões de Professores
 *
 * Funcionalidades:
 *  - Botão ⚙ (id="configuracao") ao lado de #dp-btnGerarContrato
 *  - Modal de configurações com 3 opções
 *  - Atualizar Permissões: concede/revoga acesso à plataforma do professor
 *
 * Como incluir em index.html — adicionar APÓS functions-dashboardProfessor.js:
 *  <script src="authProfessores.js"></script>
 *
 * ⚠️  ARQUIVO PARA USO LOCAL — NÃO COMMITAR / NÃO ENVIAR AO REPOSITÓRIO
 * ─────────────────────────────────────────────────────────────────────
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  FIRESTORE SECURITY RULES — APLICAR NO FIREBASE CONSOLE            ║
 * ║  Caminho: Firebase Console → Firestore Database → Regras           ║
 * ║                                                                      ║
 * ║  Dentro do bloco match /dataBaseProfessores/{professorId} { ... }   ║
 * ║                                                                      ║
 * ║  // Admin: acesso total de escrita (mantém regra atual)             ║
 * ║  allow write: if request.auth != null &&                            ║
 * ║    request.auth.token.email in [                                    ║
 * ║      'mastereducacaoadm@gmail.com',                                 ║
 * ║      'marcos.lucas.ti@gmail.com'                                    ║
 * ║    ];                                                                ║
 * ║                                                                      ║
 * ║  // Professor: pode atualizar o próprio documento,                  ║
 * ║  // MAS não pode alterar campos protegidos                          ║
 * ║  allow update: if request.auth != null                              ║
 * ║    && request.auth.uid == resource.data.uid                         ║
 * ║    && !request.resource.data.diff(resource.data)                    ║
 * ║        .affectedKeys()                                               ║
 * ║        .hasAny(['acessoPlataforma', 'cpf', 'uid']);                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

window.AuthProfessores = (function () {
  'use strict';

  const COL_PROFESSORES = 'dataBaseProfessores';
  const APP_SECUNDARIA  = 'ap-professor-auth';

  // ──────────────────────────────────────────────────────────────────
  // PARTE 1 — ESTILOS
  // ──────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ap-styles')) return;
    const style = document.createElement('style');
    style.id = 'ap-styles';
    style.textContent = `

/* ── Botão configuração ────────────────────────────────────── */
#configuracao {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: #f28705;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: .5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: background .2s ease, box-shadow .2s ease;
  flex-shrink: 0;
  margin-left: .35rem;
}
#configuracao:hover {
  background: #fff8f0;
  box-shadow: 0 0 0 2px rgba(242,135,5,.35);
}
#configuracao i { pointer-events: none; }

/* ── Overlay ───────────────────────────────────────────────── */
.ap-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.52);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9500;
  animation: apFadeIn .18s ease;
}
@keyframes apFadeIn { from{opacity:0} to{opacity:1} }

/* ── Modal ─────────────────────────────────────────────────── */
.ap-modal {
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 24px 48px rgba(0,0,0,.22);
  width: 94%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: apSlideUp .2s ease;
}
@keyframes apSlideUp {
  from{opacity:0;transform:translateY(22px)}
  to{opacity:1;transform:none}
}
.ap-modal-sm { max-width: 420px; }
.ap-modal-md { max-width: 560px; }
.ap-modal-lg { max-width: 760px; }

.ap-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .9rem 1.2rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.ap-modal-header h2 {
  font-family: 'Comfortaa', cursive;
  font-size: .95rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: .45rem;
}
.ap-modal-close {
  background: none;
  border: none;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  color: #9ca3af;
  transition: color .18s;
  padding: .2rem;
}
.ap-modal-close:hover { color: #dc2626; }

.ap-modal-body {
  padding: 1.1rem 1.2rem;
  overflow-y: auto;
  max-height: 65vh;
  flex: 1;
}
.ap-modal-footer {
  padding: .8rem 1.2rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: .5rem;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* ── Botões ────────────────────────────────────────────────── */
.ap-btn {
  font-family: 'Comfortaa', cursive;
  font-size: .8rem;
  padding: .45rem .95rem;
  border-radius: .5rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all .18s;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
}
.ap-btn--primary { background:#f28705; color:#fff; border-color:#f28705; }
.ap-btn--primary:hover { background:#c96e04; border-color:#c96e04; }
.ap-btn--ghost   { background:#f3f4f6; color:#1f2937; border-color:#e5e7eb; }
.ap-btn--ghost:hover { background:#e5e7eb; }
.ap-btn:disabled { opacity:.45; cursor:not-allowed; }

/* ── Menu de configurações ─────────────────────────────────── */
.ap-config-list { display:flex; flex-direction:column; gap:.45rem; }
.ap-config-item {
  display: flex;
  align-items: center;
  gap: .7rem;
  padding: .7rem .9rem;
  border-radius: .6rem;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background .18s, border-color .18s;
  background: #f9fafb;
  width: 100%;
  font-family: 'Lexend', sans-serif;
}
.ap-config-item:hover { background:#fff8f0; border-color:#f28705; }
.ap-config-item--disabled { opacity:.48; cursor:not-allowed; pointer-events:none; }
.ap-config-icon {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: .45rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}
.ap-config-icon--orange { background:#fef3e2; }
.ap-config-icon--blue   { background:#dbeafe; }
.ap-config-icon--green  { background:#dcfce7; }
.ap-config-text { flex:1; min-width:0; }
.ap-config-text strong { display:block; font-size:.82rem; font-weight:600; color:#1f2937; }
.ap-config-text span   { font-size:.71rem; color:#6b7280; }
.ap-em-breve {
  font-size:.62rem; background:#f3f4f6; color:#9ca3af;
  border-radius:999px; padding:.1rem .5rem;
  font-family:'Comfortaa',cursive; white-space:nowrap; flex-shrink:0;
}

/* ── Grupos de permissão ───────────────────────────────────── */
.ap-perm-group { margin-bottom:1.1rem; }
.ap-perm-group:last-child { margin-bottom:0; }
.ap-perm-group-title {
  font-family:'Comfortaa',cursive;
  font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
  padding:.28rem .6rem; border-radius:.4rem; margin-bottom:.5rem;
  display:flex; align-items:center; gap:.4rem;
}
.ap-perm-group-title--grant  { background:#dcfce7; color:#16a34a; }
.ap-perm-group-title--revoke { background:#fee2e2; color:#dc2626; }

.ap-select-all {
  display:flex; align-items:center; gap:.45rem;
  padding:.25rem .4rem; margin-bottom:.35rem;
  font-size:.74rem; color:#4b5563; cursor:pointer;
  font-family:'Lexend',sans-serif; width:fit-content;
}
.ap-select-all input { accent-color:#f28705; cursor:pointer; }

.ap-perm-list { display:flex; flex-direction:column; gap:.28rem; }
.ap-perm-item {
  display:flex; align-items:center; gap:.6rem;
  padding:.5rem .7rem; border-radius:.5rem;
  border:1px solid #e5e7eb; cursor:pointer;
  transition:background .15s, border-color .15s;
  background:#fff; width:100%; text-align:left;
}
.ap-perm-item:hover { background:#f9fafb; border-color:#d1d5db; }
.ap-perm-item input[type="checkbox"] {
  width:1rem; height:1rem; accent-color:#f28705;
  flex-shrink:0; cursor:pointer;
}
.ap-perm-info { flex:1; min-width:0; }
.ap-perm-nome { font-size:.8rem; font-weight:600; color:#1f2937; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ap-perm-sub  { font-size:.69rem; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ap-perm-badges { display:flex; gap:.3rem; flex-shrink:0; }

.ap-badge {
  display:inline-block; font-size:.6rem; font-weight:700;
  padding:.1rem .45rem; border-radius:999px;
  font-family:'Comfortaa',cursive; white-space:nowrap;
}
.ap-badge--ativo     { background:#dcfce7; color:#16a34a; }
.ap-badge--suspenso  { background:#fef9c3; color:#ca8a04; }
.ap-badge--desligado { background:#fee2e2; color:#dc2626; }
.ap-badge--candidato { background:#dbeafe; color:#2563eb; }
.ap-badge--acesso    { background:#dbeafe; color:#2563eb; }
.ap-badge--semacesso { background:#f3f4f6; color:#9ca3af; }

/* ── Loading / Vazio ───────────────────────────────────────── */
.ap-loading {
  display:flex; align-items:center; justify-content:center;
  gap:.6rem; padding:2rem 1rem; color:#6b7280;
  font-size:.82rem; font-family:'Lexend',sans-serif;
}
.ap-spinner {
  width:1.1rem; height:1.1rem;
  border:2px solid #e5e7eb; border-top-color:#f28705;
  border-radius:50%; animation:apSpin .65s linear infinite; flex-shrink:0;
}
@keyframes apSpin { to{transform:rotate(360deg)} }

.ap-empty { text-align:center; padding:2rem 1rem; font-family:'Lexend',sans-serif; }
.ap-empty-icon { font-size:2rem; display:block; margin-bottom:.4rem; }
.ap-empty strong { display:block; font-size:.88rem; color:#374151; margin-bottom:.3rem; }
.ap-empty p { font-size:.76rem; color:#9ca3af; margin:0; line-height:1.5; }

/* ── Filtro de busca ───────────────────────────────────────── */
.ap-search-wrap {
  margin-bottom:.85rem;
  position:relative;
}
.ap-search-wrap i {
  position:absolute;
  left:.65rem;
  top:50%;
  transform:translateY(-50%);
  color:#9ca3af;
  font-size:.8rem;
  pointer-events:none;
}
.ap-search-input {
  width:100%;
  padding:.5rem .75rem .5rem 2rem;
  border:1px solid #e5e7eb;
  border-radius:.5rem;
  font-family:'Lexend',sans-serif;
  font-size:.8rem;
  color:#1f2937;
  background:#f9fafb;
  transition:border-color .18s, box-shadow .18s;
  box-sizing:border-box;
  outline:none;
}
.ap-search-input:focus {
  border-color:#f28705;
  box-shadow:0 0 0 2px rgba(242,135,5,.18);
  background:#fff;
}
.ap-search-input::placeholder { color:#9ca3af; }

/* ── Resultado ─────────────────────────────────────────────── */
.ap-summary { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.75rem; }
.ap-summary-chip { font-size:.72rem; font-family:'Comfortaa',cursive; padding:.22rem .65rem; border-radius:999px; }
.ap-summary-chip--ok    { background:#f0fdf4; color:#166534; }
.ap-summary-chip--warn  { background:#fffbeb; color:#92400e; }
.ap-summary-chip--error { background:#fef2f2; color:#991b1b; }

.ap-result-list { display:flex; flex-direction:column; gap:.3rem; max-height:48vh; overflow-y:auto; }
.ap-result-item {
  display:flex; align-items:flex-start; gap:.55rem;
  padding:.45rem .7rem; border-radius:.45rem;
  border:1px solid transparent; font-size:.78rem; font-family:'Lexend',sans-serif;
}
.ap-result-item--ok    { background:#f0fdf4; border-color:#bbf7d0; color:#166534; }
.ap-result-item--warn  { background:#fffbeb; border-color:#fde68a; color:#92400e; }
.ap-result-item--error { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
.ap-result-nome { font-weight:600; }
.ap-result-msg  { font-size:.7rem; opacity:.85; }

/* ── Aviso de uid pendente de sincronização ───────────────────── */
.ap-perm-alert-uid {
  display:flex; gap:.6rem; align-items:flex-start;
  background:#fffbeb; border:1px solid #fde68a; border-radius:.5rem;
  padding:.65rem .8rem; margin-bottom:.75rem; color:#92400e;
  font-family:'Lexend',sans-serif; font-size:.78rem;
}
.ap-perm-alert-uid i { margin-top:.15rem; flex-shrink:0; }
.ap-perm-alert-uid strong { display:block; margin-bottom:.15rem; }
.ap-perm-alert-uid span { display:block; opacity:.9; }
.ap-perm-alert-uid p { margin:.35rem 0 0; font-size:.72rem; opacity:.85; }
.ap-perm-alert-uid code {
  background:#fef3c7; padding:.05rem .3rem; border-radius:.25rem; font-size:.7rem;
}

    `;
    document.head.appendChild(style);
  }
  // ──────────────────────────────────────────────────────────────────
  // PARTE 2 — FIREBASE HELPERS
  // ──────────────────────────────────────────────────────────────────

  /** Retorna instância do Firestore (app principal já inicializada) */
  function getDb() {
    return firebase.app().firestore();
  }

  // NOTA (revertido temporariamente — manageProfessorAuth exige Firebase Cloud
  // Functions, que exige plano Blaze; o projeto está no Spark, então a Cloud
  // Function não pode ser deployada por enquanto). Isso restaura o comportamento
  // client-side antigo: se o e-mail já tiver conta no Firebase Auth (ex.: professor
  // revogado e depois readicionado — isso SEMPRE cai nesse caso, já que a conta
  // nunca é deletada), o campo "uid" não é gravado automaticamente aqui.
  //
  // Contorno enquanto isso: depois de conceder acesso a alguém que já tinha conta
  // ("Acesso reativado..."), rodar SistemMaster-Login/corrigir-uid-aulas.js
  // (Admin SDK, não depende de Cloud Functions/Blaze) para sincronizar o "uid".

  /**
   * Retorna Auth da instância SECUNDÁRIA do Firebase.
   * Garante que criar conta de professor NÃO faz logout do admin.
   */
  function getSecondaryAuth() {
    try {
      return firebase.app(APP_SECUNDARIA).auth();
    } catch {
      const cfg = (typeof FIREBASE_CONFIG !== 'undefined')
        ? FIREBASE_CONFIG
        : firebase.app().options;
      return firebase.initializeApp(cfg, APP_SECUNDARIA).auth();
    }
  }

  /**
   * Cria conta de professor no Firebase Auth via instância secundária.
   * Senha = CPF com apenas os dígitos (sem pontos e traço).
   *
   * @returns {{ sucesso, uid, jaExistia, erro }}
   */
  async function criarContaProfessor(email, cpf) {
    const senha = (cpf || '').replace(/\D/g, ''); // apenas os 11 dígitos

    if (!email || !email.includes('@')) {
      return { sucesso: false, erro: 'E-mail inválido.' };
    }
    if (senha.length < 6) {
      return { sucesso: false, erro: 'CPF inválido (mínimo 6 dígitos).' };
    }

    const auth = getSecondaryAuth();
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, senha);
      const uid  = cred.user.uid;
      await auth.signOut();
      return { sucesso: true, uid, jaExistia: false };
    } catch (e) {
      try { await auth.signOut(); } catch { /* ignora */ }

      if (e.code === 'auth/email-already-in-use') {
        // Conta já existe — acesso será reativado apenas no Firestore.
        // "uid" NÃO é resolvido aqui (limitação do SDK client-side) — rodar
        // corrigir-uid-aulas.js depois pra sincronizar.
        return { sucesso: true, uid: null, jaExistia: true };
      }
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * Atualiza campo acessoPlataforma (e opcionalmente uid) no Firestore.
   * NUNCA deleta documentos — apenas altera o campo.
   *
   * @param {string}  docId  - ID do documento em dataBaseProfessores
   * @param {boolean} acesso - true = concede | false = revoga
   * @param {string|null} uid - Firebase Auth UID (salvo apenas na criação)
   * @param {boolean} precisaVerificarUid - marca o doc como pendente de sincronização
   *   de uid (caso "conta já existia") — corrigir-uid-aulas.js limpa essa flag
   *   quando resolve. Persiste o aviso além do toast, pra sobreviver caso o
   *   admin não rode o script na hora.
   */
  async function atualizarAcessoFirestore(docId, acesso, uid = null, precisaVerificarUid = false) {
    const dados = { acessoPlataforma: acesso };
    if (uid) dados.uid = uid;
    if (precisaVerificarUid) dados.precisaVerificarUid = true;
    return getDb().collection(COL_PROFESSORES).doc(docId).update(dados);
  }

  /**
   * Busca todos os professores do Firestore com dados atuais de acesso.
   */
  async function buscarTodosProfessores() {
    const snap = await getDb().collection(COL_PROFESSORES).get();
    return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  }

  // ──────────────────────────────────────────────────────────────────
  // INJEÇÃO DO BOTÃO ⚙ AO LADO DE #dp-btnGerarContrato
  // ──────────────────────────────────────────────────────────────────

  function injectConfigButton() {
    // Evita duplicata caso o dashboard seja reinicializado
    if (document.getElementById('configuracao')) return;

    const btnGerar = document.getElementById('dp-btnGerarContrato');
    if (!btnGerar) return;

    const btn = document.createElement('button');
    btn.id    = 'configuracao';
    btn.setAttribute('aria-label', 'Configurações do painel de professores');
    btn.title = 'Configurações';
    btn.innerHTML = '<i class="fas fa-cog"></i>';

    // Insere imediatamente após o botão "Gerar Contrato"
    btnGerar.insertAdjacentElement('afterend', btn);

    btn.addEventListener('click', openConfigModal);
  }

  /**
   * Observa o DOM e injeta o botão assim que #dp-btnGerarContrato aparecer.
   * Necessário porque o DashboardProfessores injeta o HTML de forma assíncrona.
   */
  function observarInjecao() {
    const observer = new MutationObserver(() => {
      const btnGerar = document.getElementById('dp-btnGerarContrato');
      const btnConf  = document.getElementById('configuracao');
      if (btnGerar && !btnConf) {
        injectConfigButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  // ──────────────────────────────────────────────────────────────────
  // PARTE 3 — MODAIS
  // ──────────────────────────────────────────────────────────────────

  function fecharTodosModais() {
    ['ap-overlayConfig', 'ap-overlayPerm', 'ap-overlayConfirm']
      .forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  }

  function escHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Modal de Configurações ────────────────────────────────────────
  function openConfigModal() {
    fecharTodosModais();

    const overlay = document.createElement('div');
    overlay.id = 'ap-overlayConfig';
    overlay.className = 'ap-overlay';
    overlay.innerHTML = `
      <div class="ap-modal ap-modal-sm" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2>
            <i class="fas fa-cog" style="color:#f28705"></i>
            Configurações
          </h2>
          <button class="ap-modal-close" id="ap-cfgClose" aria-label="Fechar">&times;</button>
        </div>
        <div class="ap-modal-body">
          <div class="ap-config-list">

            <!-- Exibir Todos os Professores — sem função por ora -->
            <button class="ap-config-item ap-config-item--disabled" disabled>
              <div class="ap-config-icon ap-config-icon--orange">
                <i class="fas fa-users" style="color:#f28705"></i>
              </div>
              <div class="ap-config-text">
                <strong>Exibir Todos os Professores</strong>
                <span>Listagem completa com filtros avançados</span>
              </div>
              <span class="ap-em-breve">Em breve</span>
            </button>

            <!-- Visualização de Desenvolvedor — sem função por ora -->
            <button class="ap-config-item ap-config-item--disabled" disabled>
              <div class="ap-config-icon ap-config-icon--blue">
                <i class="fas fa-code" style="color:#2563eb"></i>
              </div>
              <div class="ap-config-text">
                <strong>Visualização de Desenvolvedor</strong>
                <span>Dados brutos, IDs e logs do sistema</span>
              </div>
              <span class="ap-em-breve">Em breve</span>
            </button>

            <!-- Atualizar Permissões — funcional -->
            <button class="ap-config-item" id="ap-cfgPermissoes">
              <div class="ap-config-icon ap-config-icon--green">
                <i class="fas fa-shield-alt" style="color:#16a34a"></i>
              </div>
              <div class="ap-config-text">
                <strong>Atualizar Permissões</strong>
                <span>Sincronizar acessos com os status atuais</span>
              </div>
              <i class="fas fa-chevron-right" style="color:#9ca3af;margin-left:auto;font-size:.72rem"></i>
            </button>

          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById('ap-cfgClose')
      .addEventListener('click', fecharTodosModais);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) fecharTodosModais();
    });
    document.getElementById('ap-cfgPermissoes')
      .addEventListener('click', () => { fecharTodosModais(); openPermModal(); });
  }

  // ── Modal de Permissões ───────────────────────────────────────────
  function openPermModal() {
    fecharTodosModais();

    const overlay = document.createElement('div');
    overlay.id = 'ap-overlayPerm';
    overlay.className = 'ap-overlay';
    overlay.innerHTML = `
      <div class="ap-modal ap-modal-lg" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2>
            <i class="fas fa-shield-alt" style="color:#16a34a"></i>
            Atualizar Permissões
          </h2>
          <button class="ap-modal-close" id="ap-permClose" aria-label="Fechar">&times;</button>
        </div>
        <div class="ap-modal-body" id="ap-permBody">
          <div class="ap-loading">
            <div class="ap-spinner"></div>
            Carregando professores…
          </div>
        </div>
        <div class="ap-modal-footer" id="ap-permFooter" style="display:none">
          <button class="ap-btn ap-btn--ghost" id="ap-permCancelar">Cancelar</button>
          <button class="ap-btn ap-btn--primary" id="ap-permAplicar" disabled>
            <i class="fas fa-check"></i> Aplicar Selecionados
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById('ap-permClose')
      .addEventListener('click', fecharTodosModais);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) fecharTodosModais();
    });
    document.getElementById('ap-permCancelar')
      .addEventListener('click', fecharTodosModais);

    // Carrega dados e renderiza
    carregarPermissoes();
  }

  // ── Renderização das listas ───────────────────────────────────────
  async function carregarPermissoes() {
    const body   = document.getElementById('ap-permBody');
    const footer = document.getElementById('ap-permFooter');
    if (!body) return;

    try {
      const professores = await buscarTodosProfessores();

      const receberao = []; // status=Ativo + sem acesso → ganharão acesso
      const perderao  = []; // status≠Ativo + tem acesso → perderão acesso

      professores.forEach(p => {
        const ativo     = (p.status || '').trim().toLowerCase() === 'ativo';
        const temAcesso = p.acessoPlataforma === true;
        if (ativo && !temAcesso)  receberao.push(p);
        if (!ativo && temAcesso)  perderao.push(p);
      });

      // Professores com acesso concedido mas cujo uid não foi sincronizado
      // (caso "conta já existia" — ver criarContaProfessor). Ficam de fora de
      // receberao/perderao (já têm acessoPlataforma:true), então precisam de
      // um aviso à parte pra não passar despercebido.
      const pendentesUid = professores.filter(p => p.precisaVerificarUid === true);

      // Ordenação alfabética por nome
      const sortByName = arr => arr.sort((a, b) => {
        const na = (a.nome || a.Nome || '').toLowerCase();
        const nb = (b.nome || b.Nome || '').toLowerCase();
        return na.localeCompare(nb, 'pt-BR');
      });
      sortByName(receberao);
      sortByName(perderao);
      sortByName(pendentesUid);

      const bannerPendentesUidHtml = pendentesUid.length ? `
        <div class="ap-perm-alert-uid">
          <i class="fas fa-triangle-exclamation"></i>
          <div>
            <strong>${pendentesUid.length} professor(es) com acesso concedido, mas uid não sincronizado:</strong>
            <span>${pendentesUid.map(p => escHtml(p.nome || p.Nome || p._docId)).join(', ')}</span>
            <p>Rode <code>corrigir-uid-aulas.js</code> (repositório Login) para sincronizar — aulas
               dessas pessoas podem não aparecer corretamente até lá.</p>
          </div>
        </div>` : '';

      if (!receberao.length && !perderao.length) {
        body.innerHTML = bannerPendentesUidHtml + `
          <div class="ap-empty">
            <span class="ap-empty-icon">✅</span>
            <strong>Tudo sincronizado!</strong>
            <p>Todos os acessos já estão de acordo com os status atuais.<br>
               Nenhuma ação necessária${pendentesUid.length ? ' aqui — só a sincronização de uid acima' : ''}.</p>
          </div>`;
        return;
      }

      let html = bannerPendentesUidHtml + `
        <div class="ap-search-wrap">
          <i class="fas fa-search"></i>
          <input type="text" class="ap-search-input" id="ap-searchInput"
            placeholder="Filtrar professor pelo nome…" autocomplete="off">
        </div>`;

      if (receberao.length) {
        html += `
          <div class="ap-perm-group">
            <div class="ap-perm-group-title ap-perm-group-title--grant">
              <i class="fas fa-user-check"></i>
              Receberão acesso (${receberao.length})
            </div>
            <label class="ap-select-all">
              <input type="checkbox" id="ap-saGrant" checked> Selecionar todos
            </label>
            <div class="ap-perm-list">
              ${receberao.map(p => itemHtml(p, 'grant')).join('')}
            </div>
          </div>`;
      }

      if (perderao.length) {
        html += `
          <div class="ap-perm-group">
            <div class="ap-perm-group-title ap-perm-group-title--revoke">
              <i class="fas fa-user-times"></i>
              Terão acesso removido (${perderao.length})
            </div>
            <label class="ap-select-all">
              <input type="checkbox" id="ap-saRevoke" checked> Selecionar todos
            </label>
            <div class="ap-perm-list">
              ${perderao.map(p => itemHtml(p, 'revoke')).join('')}
            </div>
          </div>`;
      }

      body.innerHTML = html;

      // Filtro de busca por nome (todos os grupos ao mesmo tempo)
      const searchInput = document.getElementById('ap-searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const termo = searchInput.value.toLowerCase();
          document.querySelectorAll('.ap-perm-item').forEach(item => {
            const nome = (item.querySelector('.ap-perm-nome')?.textContent || '').toLowerCase();
            item.style.display = nome.includes(termo) ? '' : 'none';
          });
        });
      }

      // "Selecionar todos" — grant
      const saGrant = document.getElementById('ap-saGrant');
      if (saGrant) {
        saGrant.addEventListener('change', () => {
          document.querySelectorAll('.ap-cb[data-tipo="grant"]')
            .forEach(cb => { cb.checked = saGrant.checked; });
          atualizarBtnAplicar();
        });
      }

      // "Selecionar todos" — revoke
      const saRevoke = document.getElementById('ap-saRevoke');
      if (saRevoke) {
        saRevoke.addEventListener('change', () => {
          document.querySelectorAll('.ap-cb[data-tipo="revoke"]')
            .forEach(cb => { cb.checked = saRevoke.checked; });
          atualizarBtnAplicar();
        });
      }

      // Checkboxes individuais
      body.querySelectorAll('.ap-cb').forEach(cb => {
        cb.addEventListener('change', atualizarBtnAplicar);
      });

      // Exibe footer e habilita botão
      if (footer) footer.style.display = 'flex';
      atualizarBtnAplicar();

      // Botão Aplicar
      document.getElementById('ap-permAplicar')
        .addEventListener('click', () => {
          const idsGrant  = [...document.querySelectorAll('.ap-cb[data-tipo="grant"]:checked')]
            .map(cb => cb.dataset.id);
          const idsRevoke = [...document.querySelectorAll('.ap-cb[data-tipo="revoke"]:checked')]
            .map(cb => cb.dataset.id);

          const paraGrant  = receberao.filter(p => idsGrant.includes(p._docId));
          const paraRevoke = perderao.filter(p => idsRevoke.includes(p._docId));

          if (!paraGrant.length && !paraRevoke.length) {
            dispararToast('Nenhum professor selecionado.', 'info');
            return;
          }
          abrirConfirmacao(paraGrant, paraRevoke);
        });

    } catch (e) {
      console.error('[AuthProfessores] Erro ao carregar professores:', e);
      body.innerHTML = `
        <div class="ap-empty">
          <span class="ap-empty-icon">❌</span>
          <strong>Erro ao carregar dados</strong>
          <p>Verifique sua conexão e tente novamente.<br>
             <small>${escHtml(e.message)}</small></p>
        </div>`;
    }
  }

  function itemHtml(p, tipo) {
    const nome   = escHtml(p.nome || p.Nome || '(sem nome)');
    const email  = escHtml(p.email || p.Email || '—');
    const status = p.status || '—';
    const sKey   = status.toLowerCase().replace(/[^a-z]/g, '');
    const badgeAcesso = tipo === 'grant'
      ? `<span class="ap-badge ap-badge--semacesso">Sem acesso</span>`
      : `<span class="ap-badge ap-badge--acesso">Com acesso</span>`;

    return `
      <label class="ap-perm-item">
        <input type="checkbox" class="ap-cb" data-tipo="${tipo}" data-id="${p._docId}" checked>
        <div class="ap-perm-info">
          <div class="ap-perm-nome">${nome}</div>
          <div class="ap-perm-sub">${email}</div>
        </div>
        <div class="ap-perm-badges">
          <span class="ap-badge ap-badge--${sKey}">${escHtml(status)}</span>
          ${badgeAcesso}
        </div>
      </label>`;
  }

  function atualizarBtnAplicar() {
    const btn = document.getElementById('ap-permAplicar');
    if (!btn) return;
    const algumSelecionado = document.querySelectorAll('.ap-cb:checked').length > 0;
    btn.disabled = !algumSelecionado;
  }

  // ── Modal de Confirmação ──────────────────────────────────────────
  function abrirConfirmacao(paraGrant, paraRevoke) {
    const overlay = document.createElement('div');
    overlay.id = 'ap-overlayConfirm';
    overlay.className = 'ap-overlay';
    overlay.style.zIndex = '9600';
    overlay.innerHTML = `
      <div class="ap-modal ap-modal-sm" role="dialog" aria-modal="true">
        <div class="ap-modal-header">
          <h2>
            <i class="fas fa-exclamation-triangle" style="color:#f28705"></i>
            Confirmar Operação
          </h2>
          <button class="ap-modal-close" id="ap-confClose">&times;</button>
        </div>
        <div class="ap-modal-body">
          <p style="font-size:.84rem;color:#374151;margin-bottom:.75rem;line-height:1.5">
            As seguintes alterações serão realizadas:
          </p>
          ${paraGrant.length ? `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
                        background:#f0fdf4;border-radius:.5rem;margin-bottom:.4rem;
                        font-size:.82rem;color:#166534">
              <i class="fas fa-user-check"></i>
              <strong>${paraGrant.length}</strong>&nbsp;professor(es) receberão acesso
            </div>` : ''}
          ${paraRevoke.length ? `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;
                        background:#fef2f2;border-radius:.5rem;margin-bottom:.4rem;
                        font-size:.82rem;color:#991b1b">
              <i class="fas fa-user-times"></i>
              <strong>${paraRevoke.length}</strong>&nbsp;professor(es) terão acesso removido
            </div>` : ''}
          <p style="font-size:.73rem;color:#6b7280;margin-top:.75rem">
            <i class="fas fa-info-circle"></i>
            Nenhuma conta será deletada. Todos os acessos são reversíveis.
          </p>
        </div>
        <div class="ap-modal-footer">
          <button class="ap-btn ap-btn--ghost" id="ap-confCancelar">Cancelar</button>
          <button class="ap-btn ap-btn--primary" id="ap-confOk">
            <i class="fas fa-check"></i> Confirmar
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const fecharConf = () => overlay.remove();
    document.getElementById('ap-confClose').addEventListener('click', fecharConf);
    document.getElementById('ap-confCancelar').addEventListener('click', fecharConf);
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharConf(); });

    document.getElementById('ap-confOk').addEventListener('click', async () => {
      fecharConf();
      await executarAtualizacoes(paraGrant, paraRevoke);
    });
  }
  // ──────────────────────────────────────────────────────────────────
  // PARTE 4 — EXECUÇÃO DAS ATUALIZAÇÕES + UTILITÁRIOS + INIT
  // ──────────────────────────────────────────────────────────────────

  async function executarAtualizacoes(paraGrant, paraRevoke) {
    const body   = document.getElementById('ap-permBody');
    const footer = document.getElementById('ap-permFooter');
    if (!body) return;

    // Tela de progresso
    body.innerHTML = `
      <div class="ap-loading">
        <div class="ap-spinner"></div>
        Processando permissões, aguarde…
      </div>`;
    if (footer) footer.style.display = 'none';

    const resultados = [];

    // ── Conceder acesso ─────────────────────────────────────────────
    for (const p of paraGrant) {
      const nome  = p.nome || p.Nome || p._docId;
      const email = p.email || p.Email || '';
      const cpf   = p.cpf   || p.CPF   || '';

      if (!email) {
        resultados.push({ nome, tipo: 'warn', msg: 'E-mail não encontrado — pulado.' });
        continue;
      }

      try {
        const res = await criarContaProfessor(email, cpf);

        if (res.sucesso) {
          // Atualiza Firestore: acessoPlataforma=true
          // Se conta nova: salva também o uid do Firebase Auth
          // Se conta já existia: marca precisaVerificarUid pra ficar visível no
          // painel até corrigir-uid-aulas.js rodar e limpar essa flag.
          await atualizarAcessoFirestore(
            p._docId,
            true,
            res.jaExistia ? null : res.uid,
            res.jaExistia
          );

          resultados.push({
            nome,
            tipo: res.jaExistia ? 'warn' : 'ok',
            msg: res.jaExistia
              // Lembrete explícito: nesse caso o "uid" não é sincronizado aqui
              // (limitação do SDK client-side / Cloud Function indisponível no
              // plano Spark) — rodar corrigir-uid-aulas.js em seguida.
              ? '⚠️ Acesso reativado (conta já existia no sistema). Rode corrigir-uid-aulas.js (repo Login) para sincronizar o uid.'
              : 'Conta criada e acesso concedido com sucesso.'
          });
        } else {
          resultados.push({ nome, tipo: 'error', msg: `Erro ao criar conta: ${res.erro}` });
        }
      } catch (e) {
        resultados.push({ nome, tipo: 'error', msg: `Falha inesperada: ${e.message}` });
      }
    }

    // ── Revogar acesso ──────────────────────────────────────────────
    for (const p of paraRevoke) {
      const nome = p.nome || p.Nome || p._docId;
      try {
        // Apenas seta acessoPlataforma: false — NUNCA deleta a conta.
        // (Não desativa a conta no Firebase Auth: isso exigiria a Cloud Function
        // manageProfessorAuth, indisponível no plano Spark. O login do professor
        // já checa acessoPlataforma, então continua bloqueado na prática — ver
        // SistemMaster-Login/auth.js.)
        await getDb().collection(COL_PROFESSORES).doc(p._docId).update({ acessoPlataforma: false });
        resultados.push({ nome, tipo: 'ok', msg: 'Acesso removido. Conta mantida no sistema.' });
      } catch (e) {
        resultados.push({ nome, tipo: 'error', msg: `Erro ao remover acesso: ${e.message}` });
      }
    }

    // ── Exibir resultado ────────────────────────────────────────────
    const qtdOk    = resultados.filter(r => r.tipo === 'ok').length;
    const qtdWarn  = resultados.filter(r => r.tipo === 'warn').length;
    const qtdError = resultados.filter(r => r.tipo === 'error').length;
    const icone    = { ok: '✅', warn: '⚠️', error: '❌' };

    body.innerHTML = `
      <div class="ap-summary">
        ${qtdOk    ? `<span class="ap-summary-chip ap-summary-chip--ok">✅ ${qtdOk} concluído${qtdOk > 1 ? 's' : ''}</span>` : ''}
        ${qtdWarn  ? `<span class="ap-summary-chip ap-summary-chip--warn">⚠️ ${qtdWarn} aviso${qtdWarn > 1 ? 's' : ''}</span>` : ''}
        ${qtdError ? `<span class="ap-summary-chip ap-summary-chip--error">❌ ${qtdError} erro${qtdError > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="ap-result-list">
        ${resultados.map(r => `
          <div class="ap-result-item ap-result-item--${r.tipo}">
            <span style="flex-shrink:0">${icone[r.tipo]}</span>
            <div>
              <div class="ap-result-nome">${escHtml(r.nome)}</div>
              <div class="ap-result-msg">${escHtml(r.msg)}</div>
            </div>
          </div>`).join('')}
      </div>`;

    if (footer) {
      footer.style.display = 'flex';
      footer.innerHTML = `
        <button class="ap-btn ap-btn--ghost" id="ap-permFechar">Fechar</button>`;
      document.getElementById('ap-permFechar')
        .addEventListener('click', fecharTodosModais);
    }

    // Notificação rápida no toast do DashboardProfessores
    if (qtdError === 0) {
      dispararToast('Permissões atualizadas com sucesso!', 'success');
    } else if (qtdOk > 0) {
      dispararToast(`${qtdOk} atualizado(s) com ${qtdError} erro(s). Verifique o relatório.`, 'info');
    } else {
      dispararToast('Não foi possível atualizar as permissões.', 'error');
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // UTILITÁRIOS
  // ──────────────────────────────────────────────────────────────────

  /** Usa o sistema de toast do DashboardProfessores quando disponível */
  function dispararToast(msg, tipo = 'info') {
    const cnt = document.getElementById('dp-toast');
    if (!cnt) return;
    const t = document.createElement('div');
    t.className = `dp-toast dp-toast--${tipo}`;
    t.style.pointerEvents = 'auto';
    const icone = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    t.innerHTML = `<span style="font-size:1rem">${icone}</span><span>${msg}</span>`;
    cnt.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2800);
    setTimeout(() => t.remove(), 3200);
  }

  // ──────────────────────────────────────────────────────────────────
  // INIT — ponto de entrada público
  // ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    observarInjecao();
    // Tenta injetar imediatamente caso o botão já exista no DOM
    injectConfigButton();
  }

  return { init };

})();

// ── Auto-inicialização ────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuthProfessores.init());
} else {
  AuthProfessores.init();
}

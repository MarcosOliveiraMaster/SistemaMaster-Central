/**
 * auth.js  — Master Educação
 * ─────────────────────────────────────────────────────────────
 * Correção: App Check usa `.activate()` no SDK compat, não `.initializeAppCheck()`
 */

'use strict';

/* ============================================================
   RATE LIMITING
   ============================================================ */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS   = 15 * 60 * 1000;
const RL_KEY_COUNT       = 'auth_attempts';
const RL_KEY_TIMESTAMP   = 'auth_first_attempt';

function rl_getCount()     { return parseInt(sessionStorage.getItem(RL_KEY_COUNT)     || '0', 10); }
function rl_getTimestamp() { return parseInt(sessionStorage.getItem(RL_KEY_TIMESTAMP) || '0', 10); }

function rl_isLocked() {
  const count = rl_getCount();
  if (count < LOGIN_MAX_ATTEMPTS) return false;
  const elapsed = Date.now() - rl_getTimestamp();
  if (elapsed > LOGIN_LOCKOUT_MS) {
    sessionStorage.removeItem(RL_KEY_COUNT);
    sessionStorage.removeItem(RL_KEY_TIMESTAMP);
    return false;
  }
  return true;
}

function rl_remainingMs() {
  return Math.max(0, LOGIN_LOCKOUT_MS - (Date.now() - rl_getTimestamp()));
}

function rl_recordFailure() {
  const count = rl_getCount();
  if (count === 0) sessionStorage.setItem(RL_KEY_TIMESTAMP, String(Date.now()));
  sessionStorage.setItem(RL_KEY_COUNT, String(count + 1));
}

function rl_reset() {
  sessionStorage.removeItem(RL_KEY_COUNT);
  sessionStorage.removeItem(RL_KEY_TIMESTAMP);
}

/* ============================================================
   SANITIZAÇÃO
   ============================================================ */
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;').trim();
}

function isValidEmailFormat(email) {
  return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(email);
}

/* ============================================================
   FIREBASE — única instância global
   ============================================================ */
let _firebaseApp = null;
let _auth        = null;
let _db          = null;

function initFirebase() {
  if (_firebaseApp) return;

  if (typeof FIREBASE_CONFIG === 'undefined') {
    console.error('[auth] firebase-config.js não carregado.');
    return;
  }

  try {
    _firebaseApp = firebase.apps.length
      ? firebase.apps[0]
      : firebase.initializeApp(FIREBASE_CONFIG);

    _auth = _firebaseApp.auth();
    _db   = _firebaseApp.firestore();

    // Sessão apenas na aba atual
    _auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

    // ── App Check ────────────────────────────────────────────────
    const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

    if (typeof firebase.appCheck === 'function') {
      try {
        if (isLocalhost) {
          // Em localhost: ativa o debug provider para gerar um token de debug.
          // Na primeira execução, o token será exibido no console — registre-o
          // em Firebase Console → App Check → Debug tokens.
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          const appCheck = firebase.appCheck(_firebaseApp);
          appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
            true
          );
          console.info('[auth] App Check em modo DEBUG (localhost). Registre o token do console no Firebase Console.');
        } else if (
          typeof RECAPTCHA_SITE_KEY !== 'undefined' &&
          typeof firebase.appCheck.ReCaptchaV3Provider !== 'undefined'
        ) {
          const appCheck = firebase.appCheck(_firebaseApp);
          appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
            true
          );
        }
      } catch (acErr) {
        console.warn('[auth] App Check não ativado:', acErr.message);
      }
    }

    // Expor db globalmente para banco.js existente
    window.db = _db;

  } catch (err) {
    console.error('[auth] Erro ao inicializar Firebase:', err.code || err.message);
  }
}

/* ============================================================
   AUTORIZAÇÃO
   ============================================================ */
function isAuthorizedUser(user) {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase().trim();
  return (typeof AUTHORIZED_EMAILS !== 'undefined' ? AUTHORIZED_EMAILS : [])
    .some(e => e.toLowerCase() === email);
}

/* ============================================================
   GUARD DE ROTA
   ============================================================ */
function requireAuth() {
  initFirebase();
  document.body.style.visibility = 'hidden';

  return new Promise((resolve) => {
    const unsub = _auth.onAuthStateChanged((user) => {
      unsub();

      if (!user) {
        window.location.replace('login.html');
        return;
      }

      if (!isAuthorizedUser(user)) {
        _auth.signOut().finally(() => {
          window.location.replace('login.html?erro=nao_autorizado');
        });
        return;
      }

      window.currentUser = user;
      document.body.style.visibility = '';
      resolve(user);
    });
  });
}

/* ============================================================
   LOGIN / LOGOUT / RESET
   ============================================================ */
async function loginWithEmail(email, password) {
  initFirebase();

  email    = sanitizeText(email).toLowerCase();
  password = password ? password.trim() : '';

  if (!isValidEmailFormat(email))
    return { success: false, error: 'E-mail inválido.' };
  if (!password || password.length < 6)
    return { success: false, error: 'Senha deve ter pelo menos 6 caracteres.' };

  if (rl_isLocked()) {
    const mins = Math.ceil(rl_remainingMs() / 60000);
    return { success: false, error: `Muitas tentativas incorretas. Aguarde ${mins} minuto(s).` };
  }

  const authorized = (typeof AUTHORIZED_EMAILS !== 'undefined' ? AUTHORIZED_EMAILS : []);
  if (!authorized.some(e => e.toLowerCase() === email)) {
    rl_recordFailure();
    return { success: false, error: 'Acesso não autorizado para este e-mail.' };
  }

  try {
    const credential = await _auth.signInWithEmailAndPassword(email, password);
    rl_reset();
    return { success: true, user: credential.user };
  } catch (err) {
    rl_recordFailure();
    const msgMap = {
      'auth/user-not-found':          'E-mail ou senha incorretos.',
      'auth/wrong-password':          'E-mail ou senha incorretos.',
      'auth/invalid-email':           'E-mail inválido.',
      'auth/user-disabled':           'Esta conta foi desativada.',
      'auth/too-many-requests':       'Muitas tentativas. Tente mais tarde.',
      'auth/network-request-failed':  'Sem conexão com a internet.',
      'auth/invalid-credential':      'E-mail ou senha incorretos.',
    };
    return { success: false, error: msgMap[err.code] || 'Erro ao fazer login. Tente novamente.' };
  }
}

async function sendPasswordReset(email) {
  initFirebase();
  email = sanitizeText(email).toLowerCase();

  if (!isValidEmailFormat(email))
    return { success: false, error: 'E-mail inválido.' };

  const authorized = (typeof AUTHORIZED_EMAILS !== 'undefined' ? AUTHORIZED_EMAILS : []);
  if (!authorized.some(e => e.toLowerCase() === email))
    return { success: true }; // silencioso — não enumerar e-mails

  try {
    await _auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Erro ao enviar e-mail. Tente novamente.' };
  }
}

async function logout() {
  try { if (_auth) await _auth.signOut(); } catch (_) {}
  window.currentUser = null;
  window.location.replace('login.html');
}

/* ============================================================
   EXPORTAÇÕES GLOBAIS
   ============================================================ */
window.AUTH = {
  initFirebase,
  requireAuth,
  loginWithEmail,
  sendPasswordReset,
  logout,
  isAuthorizedUser,
  sanitizeText,
  getDb:   () => _db,
  getAuth: () => _auth
};
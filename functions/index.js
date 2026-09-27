/**
 * functions/index.js — Master Educação
 * Firebase Cloud Functions — Gerenciamento de autenticação de clientes.
 *
 * DEPLOY:
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();

const AUTHORIZED_EMAILS = [
  'mastereducacaoadm@gmail.com',
  'marcos.lucas.ti@gmail.com'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * manageClientAuth — onRequest com CORS explícito
 *
 * POST https://us-central1-master-ecossistemaprofessor.cloudfunctions.net/manageClientAuth
 * Authorization: Bearer <firebase-id-token>
 * Content-Type: application/json
 *
 * Body: { action: 'enable'|'disable', email, cpf?, docId }
 */
exports.manageClientAuth = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {

  // ── CORS preflight ────────────────────────────────────────────
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') return res.status(204).send('');

  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, erro: 'Método não permitido.' });
  }

  // ── Autenticação via Firebase ID Token ─────────────────────────
  const authHeader = (req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ sucesso: false, erro: 'Token não fornecido.' });
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(authHeader.slice(7));
  } catch (e) {
    return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
  }

  if (!AUTHORIZED_EMAILS.includes(decodedToken.email)) {
    return res.status(403).json({ sucesso: false, erro: 'Acesso negado.' });
  }

  const { action, email, cpf, docId } = req.body || {};
  const db = admin.firestore();

  // ── ENABLE: cria ou reativa conta ─────────────────────────────
  if (action === 'enable') {
    const senha = (cpf || '').replace(/\D/g, '');

    if (!email || !email.includes('@'))
      return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (!docId)
      return res.status(400).json({ sucesso: false, erro: 'docId obrigatório.' });
    if (senha.length < 6)
      return res.status(400).json({ sucesso: false, erro: 'CPF inválido (mínimo 6 dígitos).' });

    try {
      let userRecord;
      let jaExistia = false;

      try {
        userRecord = await admin.auth().getUserByEmail(email);
        jaExistia  = true;
        await admin.auth().updateUser(userRecord.uid, { disabled: false, password: senha });
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          try {
            userRecord = await admin.auth().createUser({
              email, password: senha, emailVerified: false, disabled: false
            });
          } catch (createErr) {
            // Corrida: outra chamada criou a conta entre nosso getUserByEmail e createUser.
            if (createErr.code === 'auth/email-already-exists') {
              userRecord = await admin.auth().getUserByEmail(email);
              jaExistia  = true;
            } else throw createErr;
          }
        } else throw e;
      }

      await db.collection('cadastroClientes').doc(docId).update({
        acessoPlataforma: true,
        uid: userRecord.uid
      });

      return res.status(200).json({ sucesso: true, jaExistia, uid: userRecord.uid });

    } catch (e) {
      console.error('[manageClientAuth] enable error:', e.message);
      return res.status(500).json({ sucesso: false, erro: e.message });
    }
  }

  // ── DISABLE: desativa conta no Firebase Auth ──────────────────
  if (action === 'disable') {
    if (!email || !email.includes('@'))
      return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (!docId)
      return res.status(400).json({ sucesso: false, erro: 'docId obrigatório.' });

    try {
      let uid       = null;
      let naExistia = false;

      const docSnap = await db.collection('cadastroClientes').doc(docId).get();
      uid = docSnap.exists ? (docSnap.data().uid || null) : null;

      if (!uid) {
        try {
          const userRecord = await admin.auth().getUserByEmail(email);
          uid = userRecord.uid;
        } catch (e) {
          if (e.code === 'auth/user-not-found') naExistia = true;
          else throw e;
        }
      }

      if (uid) {
        await admin.auth().updateUser(uid, { disabled: true });
      }

      await db.collection('cadastroClientes').doc(docId).update({
        acessoPlataforma: false
      });

      return res.status(200).json({ sucesso: true, naExistia, uid });

    } catch (e) {
      console.error('[manageClientAuth] disable error:', e.message);
      return res.status(500).json({ sucesso: false, erro: e.message });
    }
  }

  return res.status(400).json({ sucesso: false, erro: 'Ação inválida. Use "enable" ou "disable".' });
});

/**
 * manageProfessorAuth — mesmo padrão de manageClientAuth, para dataBaseProfessores.
 *
 * Resolve o bug em que conceder acesso a um professor cujo e-mail JÁ TEM conta no
 * Firebase Auth deixava o campo "uid" sem ser gravado (o SDK client-side não
 * consegue descobrir o uid de uma conta existente — só o Admin SDK, aqui, consegue
 * via getUserByEmail). Sem "uid" correto em dataBaseProfessores, as aulas desse
 * professor nunca recebem um "professorUid" válido.
 *
 * POST https://us-central1-master-ecossistemaprofessor.cloudfunctions.net/manageProfessorAuth
 * Authorization: Bearer <firebase-id-token>
 * Content-Type: application/json
 *
 * Body: { action: 'enable'|'disable', email, cpf?, docId }
 */
exports.manageProfessorAuth = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {

  // ── CORS preflight ────────────────────────────────────────────
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') return res.status(204).send('');

  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, erro: 'Método não permitido.' });
  }

  // ── Autenticação via Firebase ID Token ─────────────────────────
  const authHeader = (req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ sucesso: false, erro: 'Token não fornecido.' });
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(authHeader.slice(7));
  } catch (e) {
    return res.status(401).json({ sucesso: false, erro: 'Token inválido ou expirado.' });
  }

  if (!AUTHORIZED_EMAILS.includes(decodedToken.email)) {
    return res.status(403).json({ sucesso: false, erro: 'Acesso negado.' });
  }

  const { action, email, cpf, docId } = req.body || {};
  const db = admin.firestore();

  // ── ENABLE: cria ou reativa conta ─────────────────────────────
  if (action === 'enable') {
    const senha = (cpf || '').replace(/\D/g, '');

    if (!email || !email.includes('@'))
      return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (!docId)
      return res.status(400).json({ sucesso: false, erro: 'docId obrigatório.' });
    if (senha.length < 6)
      return res.status(400).json({ sucesso: false, erro: 'CPF inválido (mínimo 6 dígitos).' });

    try {
      let userRecord;
      let jaExistia = false;

      try {
        userRecord = await admin.auth().getUserByEmail(email);
        jaExistia  = true;
        await admin.auth().updateUser(userRecord.uid, { disabled: false, password: senha });
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          try {
            userRecord = await admin.auth().createUser({
              email, password: senha, emailVerified: false, disabled: false
            });
          } catch (createErr) {
            // Corrida: outra chamada criou a conta entre nosso getUserByEmail e createUser
            // (ex.: dois admins clicando "Atualizar Permissões" pro mesmo professor ao mesmo tempo).
            if (createErr.code === 'auth/email-already-exists') {
              userRecord = await admin.auth().getUserByEmail(email);
              jaExistia  = true;
            } else throw createErr;
          }
        } else throw e;
      }

      // Sempre grava uid, mesmo quando a conta já existia — essa é a correção
      // em relação ao fluxo antigo (authProfessores.js / promoverProfessor()).
      await db.collection('dataBaseProfessores').doc(docId).update({
        acessoPlataforma: true,
        uid: userRecord.uid
      });

      return res.status(200).json({ sucesso: true, jaExistia, uid: userRecord.uid });

    } catch (e) {
      console.error('[manageProfessorAuth] enable error:', e.message);
      return res.status(500).json({ sucesso: false, erro: e.message });
    }
  }

  // ── DISABLE: desativa conta no Firebase Auth ──────────────────
  if (action === 'disable') {
    if (!email || !email.includes('@'))
      return res.status(400).json({ sucesso: false, erro: 'E-mail inválido.' });
    if (!docId)
      return res.status(400).json({ sucesso: false, erro: 'docId obrigatório.' });

    try {
      let uid       = null;
      let naExistia = false;

      const docSnap = await db.collection('dataBaseProfessores').doc(docId).get();
      uid = docSnap.exists ? (docSnap.data().uid || null) : null;

      if (!uid) {
        try {
          const userRecord = await admin.auth().getUserByEmail(email);
          uid = userRecord.uid;
        } catch (e) {
          if (e.code === 'auth/user-not-found') naExistia = true;
          else throw e;
        }
      }

      if (uid) {
        await admin.auth().updateUser(uid, { disabled: true });
      }

      await db.collection('dataBaseProfessores').doc(docId).update({
        acessoPlataforma: false
      });

      return res.status(200).json({ sucesso: true, naExistia, uid });

    } catch (e) {
      console.error('[manageProfessorAuth] disable error:', e.message);
      return res.status(500).json({ sucesso: false, erro: e.message });
    }
  }

  return res.status(400).json({ sucesso: false, erro: 'Ação inválida. Use "enable" ou "disable".' });
});

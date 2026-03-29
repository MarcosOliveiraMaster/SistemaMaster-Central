/**
 * firebase-config.js  — Master Educação
 * ─────────────────────────────────────────────────────────────
 * Configuração CENTRALIZADA do Firebase.
 * Inclua este arquivo ANTES de banco.js, auth.js e index.html.
 *
 * NOTA DE SEGURANÇA: API keys do Firebase são intencionalmente públicas.
 * A proteção real vem das Firestore Security Rules + App Check.
 */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDPPbSA8SB-L_giAhWIqGbPGSMRBDTPi40",
  authDomain:        "master-ecossistemaprofessor.firebaseapp.com",
  databaseURL:       "https://master-ecossistemaprofessor-default-rtdb.firebaseio.com",
  projectId:         "master-ecossistemaprofessor",
  storageBucket:     "master-ecossistemaprofessor.firebasestorage.app",
  messagingSenderId: "532224860209",
  appId:             "1:532224860209:web:686657b6fae13b937cf510",
  measurementId:     "G-B0KMX4E67D"
};

/** Whitelist de e-mails autorizados ao painel administrativo */
const AUTHORIZED_EMAILS = Object.freeze([
  "mastereducacaoadm@gmail.com",
  "marcos.lucas.ti@gmail.com"
]);

/** Chave pública do reCAPTCHA v3 para Firebase App Check */
const RECAPTCHA_SITE_KEY = "6LdOBZssAAAAAHvUBWf0JpJZEntddWNmGq3H4Awx";

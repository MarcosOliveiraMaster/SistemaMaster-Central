/**
 * firebase-query.js — Master Educação
 * ─────────────────────────────────────────────────────────────
 * Script Node.js para consultar o Firestore via Firebase Admin SDK.
 *
 * PRÉ-REQUISITO: Coloque o arquivo "serviceAccountKey.json" nesta pasta.
 * Como obter: Firebase Console → Configurações do projeto
 *             → Contas de serviço → Gerar nova chave privada
 *
 * USO:
 *   node firebase-query.js               → resumo de todas as coleções
 *   node firebase-query.js clientes      → lista cadastroClientes
 *   node firebase-query.js professores   → lista dataBaseProfessores
 *   node firebase-query.js aulas         → lista BancoDeAulas
 *   node firebase-query.js lista         → lista BancoDeAulas-Lista
 *   node firebase-query.js candidatos    → lista candidatos
 *   node firebase-query.js investimentos → lista investimentos
 *   node firebase-query.js financeiro    → lista relatorioFinanceiro
 *   node firebase-query.js simulacoes    → lista simulacoes
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Inicialização ──────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('\n❌  Arquivo "serviceAccountKey.json" não encontrado.\n');
  console.error('Como obter:');
  console.error('  1. Acesse https://console.firebase.google.com');
  console.error('  2. Projeto "master-ecossistemaprofessor"');
  console.error('  3. Configurações do projeto (engrenagem) → Contas de serviço');
  console.error('  4. Clique em "Gerar nova chave privada" e salve como serviceAccountKey.json nesta pasta\n');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'master-ecossistemaprofessor',
});

const db = admin.firestore();

// ── Helpers ────────────────────────────────────────────────────
function fmt(label, count) {
  return `  ${label.padEnd(22)} ${String(count).padStart(5)} documento(s)`;
}

async function getCollection(name, limit = 0) {
  let ref = db.collection(name);
  if (limit > 0) ref = ref.limit(limit);
  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function printDocs(docs, nome) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Coleção: ${nome}  (${docs.length} doc(s))`);
  console.log('─'.repeat(60));
  if (docs.length === 0) {
    console.log('  (vazia)');
    return;
  }
  docs.forEach((doc, i) => {
    const preview = JSON.stringify(doc, null, 2)
      .split('\n')
      .map(l => '  ' + l)
      .join('\n');
    console.log(`\n[${i + 1}] ID: ${doc.id}`);
    console.log(preview);
    if (i < docs.length - 1) console.log('  · · ·');
  });
}

// ── Modo Resumo ────────────────────────────────────────────────
async function modoResumo() {
  console.log('\n====================================================');
  console.log('  Firebase Firestore — Master Educação (resumo)');
  console.log('====================================================');

  const colecoes = [
    'BancoDeAulas',
    'BancoDeAulas-Lista',
    'cadastroClientes',
    'candidatos',
    'dataBaseProfessores',
    'investimentos',
    'relatorioFinanceiro',
    'simulacoes',
  ];

  const resultados = await Promise.all(
    colecoes.map(async nome => {
      try {
        const snap = await db.collection(nome).count().get();
        return { nome, total: snap.data().count };
      } catch {
        // count() pode não estar disponível em planos Spark; fallback
        try {
          const snap = await db.collection(nome).get();
          return { nome, total: snap.size };
        } catch (e) {
          return { nome, total: `ERRO: ${e.message}` };
        }
      }
    })
  );

  console.log('');
  resultados.forEach(r => console.log(fmt(r.nome, r.total)));
  console.log('');
  console.log('  Dica: node firebase-query.js <colecao>');
  console.log('  Ex:   node firebase-query.js clientes\n');
}

// ── Modos específicos ──────────────────────────────────────────
async function modoColecao(arg) {
  const mapa = {
    aulas:        'BancoDeAulas',
    lista:        'BancoDeAulas-Lista',
    clientes:     'cadastroClientes',
    candidatos:   'candidatos',
    professores:  'dataBaseProfessores',
    investimentos:'investimentos',
    financeiro:   'relatorioFinanceiro',
    simulacoes:   'simulacoes',
  };
  const nome = mapa[arg] || arg;
  const docs = await getCollection(nome, 50);
  printDocs(docs, nome);
  if (docs.length === 50) {
    console.log('\n  ⚠  Exibindo os primeiros 50 documentos.\n');
  }
}

// ── Entry point ────────────────────────────────────────────────
(async () => {
  try {
    const arg = process.argv[2];
    if (!arg) {
      await modoResumo();
    } else {
      await modoColecao(arg);
    }
  } catch (err) {
    console.error('\n❌  Erro ao consultar Firestore:', err.message, '\n');
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();

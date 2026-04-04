/**
 * Firebase Admin Query Tool
 *
 * USO:
 *   node firebase-query.js
 *
 * SETUP (primeira vez):
 *   npm install firebase-admin
 *   Coloque o arquivo da chave de serviço como: serviceAccountKey.json
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const PROJECT_ID = 'master-ecossistemaprofessor';

// Coleções para inspecionar
const COLECOES = [
  'BancoDeAulas',
  'BancoDeAulas-Lista',
  'cadastroClientes',
  'dataBaseProfessores',
  'simulacoes',
  'investimentos',
  'relatorioFinanceiro',
];

// Quantos documentos mostrar por coleção (0 = apenas contagem)
const DOCS_PREVIEW = 2;

// ── Init ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('\n❌ Arquivo serviceAccountKey.json não encontrado!');
  console.error('   Coloque o arquivo na pasta:', __dirname);
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${PROJECT_ID}-default-rtdb.firebaseio.com`,
});

const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────
function printSeparator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printDoc(doc, index) {
  const data = doc.data();
  console.log(`\n  [Doc ${index + 1}] ID: ${doc.id}`);

  // Mostra campos e tipos (truncado para não poluir)
  Object.entries(data).forEach(([key, value]) => {
    let display = value;
    if (value && typeof value === 'object' && value._seconds !== undefined) {
      display = `[Timestamp: ${new Date(value._seconds * 1000).toLocaleDateString('pt-BR')}]`;
    } else if (typeof value === 'string' && value.length > 80) {
      display = value.substring(0, 80) + '...';
    } else if (typeof value === 'object' && value !== null) {
      display = JSON.stringify(value).substring(0, 80);
    }
    console.log(`    ${key}: ${display}`);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function inspecionarColecao(nome) {
  try {
    const snapshot = await db.collection(nome).limit(DOCS_PREVIEW + 1).get();

    if (snapshot.empty) {
      console.log(`\n  ⚠️  Coleção "${nome}" está vazia ou não existe.`);
      return;
    }

    // Conta total (separado para não pesar)
    const totalSnapshot = await db.collection(nome).count().get();
    const total = totalSnapshot.data().count;

    console.log(`\n  📦 Total de documentos: ${total}`);

    if (DOCS_PREVIEW > 0) {
      console.log(`  📄 Prévia dos primeiros ${Math.min(DOCS_PREVIEW, total)} documento(s):`);
      snapshot.docs.slice(0, DOCS_PREVIEW).forEach((doc, i) => printDoc(doc, i));
    }

    // Mostra campos disponíveis (schema)
    if (!snapshot.empty) {
      const campos = Object.keys(snapshot.docs[0].data());
      console.log(`\n  🗂️  Campos encontrados: [${campos.join(', ')}]`);
    }

  } catch (err) {
    console.log(`\n  ❌ Erro ao acessar "${nome}": ${err.message}`);
  }
}

async function main() {
  console.log('\n🔥 Firebase Admin Query Tool');
  console.log(`   Projeto: ${PROJECT_ID}`);
  console.log(`   Conectando...`);

  for (const colecao of COLECOES) {
    printSeparator(`Coleção: ${colecao}`);
    await inspecionarColecao(colecao);
  }

  printSeparator('Concluído');
  console.log('  ✅ Inspeção finalizada!\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});

/**
 * Query: aulas com campos vazios (idContratacao ou nomeCliente ausentes)
 * Uso: node firebase-query-vazios.js
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('BancoDeAulas-Lista').get();

  const vazios = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const semContratacao = !d.idContratacao && !d.codigoContratacao;
    const semCliente     = !d.nomeCliente;
    if (semContratacao || semCliente) {
      vazios.push({ docId: doc.id, ...d });
    }
  });

  console.log(`\n🔍 Aulas com campos vazios: ${vazios.length} de ${snapshot.size} total\n`);

  vazios.forEach((a, i) => {
    console.log(`[${i + 1}] ID doc: ${a.docId}`);
    console.log(`    id-Aula:          ${a['id-Aula'] || '—'}`);
    console.log(`    idContratacao:    ${a.idContratacao || '—'}`);
    console.log(`    codigoContratacao:${a.codigoContratacao || '—'}`);
    console.log(`    nomeCliente:      ${a.nomeCliente || '—'}`);
    console.log(`    professor:        ${a.professor || '—'}`);
    console.log(`    data:             ${a.data || '—'}`);
    console.log(`    ValorAula:        ${a.ValorAula}`);
    console.log(`    StatusAula:       ${a.StatusAula || '—'}`);
    console.log('');
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

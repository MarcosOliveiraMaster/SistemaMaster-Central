/**
 * Deleta aulas sem idContratacao/nomeCliente da BancoDeAulas-Lista
 * Uso: node firebase-delete-vazios.js
 * Parâmetro opcional: node firebase-delete-vazios.js 10  (limita quantos deletar)
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const limite = parseInt(process.argv[2]) || 10;

  const snapshot = await db.collection('BancoDeAulas-Lista').get();

  const vazios = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    if (!d.idContratacao && !d.codigoContratacao && !d.nomeCliente) {
      vazios.push({ docId: doc.id, idAula: d['id-Aula'], professor: d.professor });
    }
  });

  const alvo = vazios.slice(0, limite);

  console.log(`\n🗑️  Deletando ${alvo.length} de ${vazios.length} documentos vazios...\n`);

  for (const doc of alvo) {
    await db.collection('BancoDeAulas-Lista').doc(doc.docId).delete();
    console.log(`  ✅ Deletado: ${doc.docId} (id-Aula: ${doc.idAula || '—'})`);
  }

  console.log(`\n✅ Concluído. ${alvo.length} documentos removidos.\n`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

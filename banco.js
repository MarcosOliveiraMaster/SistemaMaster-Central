// banco.js — Master Educação
// ─────────────────────────────────────────────────────────────
// CORREÇÃO: Reutiliza instância do Firebase criada por auth.js
// (removida a const firebaseConfig duplicada e o initializeApp)

// Reutiliza app já inicializado por auth.js
// Se por algum motivo auth.js não rodou ainda (ex: acesso direto),
// usa FIREBASE_CONFIG do firebase-config.js como fallback
let app, db;

try {
  if (firebase.apps.length) {
    app = firebase.apps[0];
  } else {
    // fallback — não deveria acontecer com a ordem correta de scripts
    app = firebase.initializeApp(typeof FIREBASE_CONFIG !== 'undefined'
      ? FIREBASE_CONFIG
      : { projectId: 'master-ecossistemaprofessor' });
  }
  db = app.firestore();
  // Garantir que window.db também aponta para esta instância
  window.db = db;
} catch (error) {
  console.error('❌ Erro ao obter instância Firebase em banco.js:', error.message);
}

// Cache para otimização
const CACHE = {
  bancoDeAulas: {
    data: null,
    timestamp: null,
    maxAge: 5 * 60 * 1000
  },
  cadastroClientes: {
    data: null,
    timestamp: null,
    maxAge: 10 * 60 * 1000
  },
  dataBaseProfessores: {
    data: null,
    timestamp: null,
    maxAge: 30 * 60 * 1000
  },
  bancoDeAulasListaBatch: {
    data: null,
    timestamp: null,
    maxAge: 5 * 60 * 1000
  }
};

// Função para verificar validade do cache
function isCacheValid(cacheKey) {
  const cache = CACHE[cacheKey];
  if (!cache || !cache.data || !cache.timestamp) return false;
  return (Date.now() - cache.timestamp) < cache.maxAge;
}

// Função para buscar dados do BancoDeAulas
async function fetchBancoDeAulas(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('bancoDeAulas')) {
    return CACHE.bancoDeAulas.data;
  }
  try {
    const querySnapshot = await db.collection("BancoDeAulas")
      .orderBy("timestamp", "desc")
      .get();
    const aulas = [];
    querySnapshot.forEach(doc => { aulas.push({ id: doc.id, ...doc.data() }); });
    CACHE.bancoDeAulas.data = aulas;
    CACHE.bancoDeAulas.timestamp = Date.now();
    return aulas;
  } catch (error) {
    console.error('❌ Erro ao buscar BancoDeAulas:', error.message);
    throw error;
  }
}

// Função para buscar dados de cadastroClientes
async function fetchCadastroClientes(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('cadastroClientes')) {
    return CACHE.cadastroClientes.data;
  }
  try {
    const querySnapshot = await db.collection("cadastroClientes").get();
    const clientes = [];
    querySnapshot.forEach(doc => { clientes.push({ id: doc.id, ...doc.data() }); });
    CACHE.cadastroClientes.data = clientes;
    CACHE.cadastroClientes.timestamp = Date.now();
    return clientes;
  } catch (error) {
    console.error('❌ Erro ao buscar cadastroClientes:', error.message);
    throw error;
  }
}

// Função para buscar dados de dataBaseProfessores
async function fetchDataBaseProfessores(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('dataBaseProfessores')) {
    return CACHE.dataBaseProfessores.data;
  }
  try {
    const querySnapshot = await db.collection("dataBaseProfessores")
      .orderBy("nome")
      .get();
    const professores = [];
    querySnapshot.forEach(doc => { professores.push({ id: doc.id, ...doc.data() }); });
    CACHE.dataBaseProfessores.data = professores;
    CACHE.dataBaseProfessores.timestamp = Date.now();
    return professores;
  } catch (error) {
    console.error('❌ Erro ao buscar dataBaseProfessores:', error.message);
    throw error;
  }
}

// Função para buscar cliente por CPF
async function fetchClienteByCPF(cpf) {
  try {
    const querySnapshot = await db.collection("cadastroClientes")
      .where("cpf", "==", cpf)
      .get();
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar cliente por CPF:', error.message);
    throw error;
  }
}

// Função para buscar aulas por data
async function fetchAulasByDate(dateString) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas").get();
    const aulasDoDia = [];
    querySnapshot.forEach(doc => {
      const aulaData = doc.data();
      if (aulaData.aulas && Array.isArray(aulaData.aulas)) {
        aulaData.aulas.forEach(aula => {
          if (aula.data && aula.data.includes(dateString)) {
            aulasDoDia.push({ contratoId: doc.id, ...aulaData, aulaDetalhe: aula });
          }
        });
      }
    });
    return aulasDoDia;
  } catch (error) {
    console.error('❌ Erro ao buscar aulas por data:', error.message);
    throw error;
  }
}

// Função para atualizar uma aula
async function updateAula(aulaId, updatedData) {
  try {
    await db.collection("BancoDeAulas").doc(aulaId).set(updatedData, { merge: true });
    CACHE.bancoDeAulas.timestamp = null;
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar aula:', error.message);
    throw error;
  }
}

// Função para excluir uma aula
async function deleteAula(aulaId) {
  try {
    await db.collection("BancoDeAulas").doc(aulaId).delete();
    CACHE.bancoDeAulas.timestamp = null;
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir aula:', error.message);
    throw error;
  }
}

// Função para adicionar nova aula
async function addNovaAula(aulaData) {
  try {
    const docRef = await db.collection("BancoDeAulas").add({
      ...aulaData,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    CACHE.bancoDeAulas.timestamp = null;
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao adicionar nova aula:', error.message);
    throw error;
  }
}

// Função para carregar TODAS as aulas de BancoDeAulas-Lista em batch
async function fetchBancoDeAulasListaBatch(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('bancoDeAulasListaBatch')) {
    return CACHE.bancoDeAulasListaBatch.data;
  }
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista").get();
    const todasAulas = [];
    querySnapshot.forEach(doc => {
      todasAulas.push({ id: doc.id, statusAula: doc.data().statusAula || 'Não informado', ...doc.data() });
    });
    CACHE.bancoDeAulasListaBatch.data = todasAulas;
    CACHE.bancoDeAulasListaBatch.timestamp = Date.now();
    return todasAulas;
  } catch (error) {
    console.error('❌ Erro ao carregar aulas em batch:', error.message);
    return [];
  }
}

// Função para buscar aulas individuais da coleção BancoDeAulas-Lista
async function fetchBancoDeAulasLista(codigoContratacao) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .orderBy("data", "asc")
      .get();
    const todasAulas = [];
    querySnapshot.forEach(doc => { todasAulas.push({ id: doc.id, ...doc.data() }); });
    const aulasFiltradas = todasAulas.filter(aula => {
      const idAula = aula['id-Aula'] || '';
      return idAula.substring(0, 4) === codigoContratacao;
    });
    return aulasFiltradas;
  } catch (error) {
    console.error('❌ Erro ao buscar BancoDeAulas-Lista:', error.message);
    throw error;
  }
}

// Função para atualizar RelatorioAula
async function updateRelatorioAula(idAula, novoRelatorio) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      RelatorioAula: novoRelatorio,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar relatório:', error.message);
    throw error;
  }
}

// Função para atualizar StatusAula
async function updateStatusAula(idAula, novoStatus) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      StatusAula: novoStatus,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error.message);
    throw error;
  }
}

// Função para atualizar ObservacoesAula
async function updateObservacoesAula(idAula, novasObservacoes) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      ObservacoesAula: novasObservacoes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar observações:', error.message);
    throw error;
  }
}

// Função para atualizar data de uma aula
async function updateDataAula(idAula, novaData) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      data: novaData,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar data:', error.message);
    throw error;
  }
}

// Função para atualizar horário de uma aula
async function updateHorarioAula(idAula, novoHorario) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      horario: novoHorario,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar horário:', error.message);
    throw error;
  }
}

// Função para atualizar duração de uma aula
async function updateDuracaoAula(idAula, novaDuracao) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);

    let horasDecimais = 0;
    if (novaDuracao) {
      const match = novaDuracao.match(/(\d+)h(?:(\d+))?/);
      if (match) horasDecimais = parseInt(match[1]) + (match[2] ? parseInt(match[2]) / 60 : 0);
    }
    const docData = querySnapshot.docs[0].data();
    const valorHora = docData.horaAulaProfessor || 35;
    const valorAula = Number((horasDecimais * valorHora).toFixed(2));

    await querySnapshot.docs[0].ref.update({
      duracao: novaDuracao,
      ValorAula: valorAula,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar duração:', error.message);
    throw error;
  }
}

// Função para atualizar matéria de uma aula
async function updateMateriaAula(idAula, novaMateria) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      materia: novaMateria,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar matéria:', error.message);
    throw error;
  }
}

// Função para atualizar professor de uma aula
// FIX: se uidProfessor não for fornecido, busca por CPF em dataBaseProfessores
async function updateProfessorAula(idAula, nomeProfessor, cpfProfessor, uidProfessor) {
  try {
    // Fallback: se o UID não chegou (dataset vazio), busca por CPF no banco
    if (!uidProfessor && cpfProfessor) {
      const profSnap = await db.collection('dataBaseProfessores')
        .where('cpf', '==', cpfProfessor).limit(1).get();
      if (!profSnap.empty) {
        uidProfessor = profSnap.docs[0].data().uid || '';
      }
    }
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      professor: nomeProfessor,
      idProfessor: cpfProfessor,
      professorUid: uidProfessor || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar professor:', error.message);
    throw error;
  }
}

// Função para atualizar estudante de uma aula
async function updateEstudanteAula(idAula, nomeEstudante) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      estudante: nomeEstudante || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar estudante:', error.message);
    throw error;
  }
}

async function updateConfirmacaoProfessorAula(idAula, novoValor) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      ConfirmacaoProfessorAula: novoValor,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar ConfirmacaoProfessorAula:', error.message);
    throw error;
  }
}

// Incrementar id-Aula alfabeticamente
function incrementarIdAula(idAulaAtual) {
  const match = idAulaAtual.match(/^(\d{4})([A-Z]+)$/);
  if (!match) throw new Error(`Formato de id-Aula inválido: ${idAulaAtual}`);
  const prefixo = match[1];
  let letrasArray = match[2].split('');
  let i = letrasArray.length - 1;
  let carry = true;
  while (carry && i >= 0) {
    if (letrasArray[i] === 'Z') { letrasArray[i] = 'A'; i--; }
    else { letrasArray[i] = String.fromCharCode(letrasArray[i].charCodeAt(0) + 1); carry = false; }
  }
  if (carry) letrasArray.unshift('A');
  return prefixo + letrasArray.join('');
}

// Função para adicionar nova aula a um cronograma
// FIX: herda professor/professorUid/idProfessor da última aula e
//      inclui clienteUid/clientUid para as Firestore Security Rules
async function addNovaAulaLista(codigoContratacao, valorHoraContrato = 35) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", ">=", codigoContratacao)
      .where("id-Aula", "<", codigoContratacao + "\uf8ff")
      .get();

    if (querySnapshot.empty) throw new Error(`Nenhuma aula encontrada para: ${codigoContratacao}`);

    const aulas = [];
    querySnapshot.forEach(doc => { aulas.push({ id: doc.id, ...doc.data() }); });
    aulas.sort((a, b) => (a['id-Aula'] || '').localeCompare(b['id-Aula'] || ''));
    const ultimaAula = aulas[aulas.length - 1];
    const novoIdAula = incrementarIdAula(ultimaAula['id-Aula']);

    const hoje = new Date();
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dataAtual = `${diasSemana[hoje.getDay()]} - ${dia}/${mes}/${hoje.getFullYear()}`;

    let duracaoPadrao = ultimaAula.duracao || '';
    let horasDecimais = 0;
    if (duracaoPadrao) {
      const matchDur = duracaoPadrao.match(/(\d+)h(\d+)/);
      if (matchDur) horasDecimais = parseInt(matchDur[1]) + parseInt(matchDur[2]) / 60;
    }
    const valorAulaCalculado = horasDecimais > 0 ? horasDecimais * Number(valorHoraContrato) : 0;

    const novaAula = {
      ConfirmacaoProfessorAula: false,
      ObservacoesAula: "",
      RelatorioAula: "",
      StatusAula: "Pendente",
      ValorAula: valorAulaCalculado,
      // FIX: clienteUid e clientUid herdados da última aula para
      // que as Firestore Rules permitam leitura pelo cliente no login
      clienteUid:   ultimaAula.clienteUid   || "",
      clientUid:    ultimaAula.clientUid    || "",
      codigoContratacao: ultimaAula.codigoContratacao || "",
      idContratacao: codigoContratacao,
      cpf: ultimaAula.cpf || "",
      data: dataAtual,
      duracao: duracaoPadrao,
      estudante: ultimaAula.estudante || "",
      horario: "",
      "id-Aula": novoIdAula,
      // FIX: professor, idProfessor e professorUid herdados da última aula
      // para que o professor visualize a nova aula no sistema de login
      idProfessor:  ultimaAula.idProfessor  || "",
      professorUid: ultimaAula.professorUid || "",
      materia: "",
      metodoPagamento: ultimaAula.metodoPagamento || "",
      nomeCliente: ultimaAula.nomeCliente || "",
      professor:    ultimaAula.professor    || "",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("BancoDeAulas-Lista").add(novaAula);
    forceCacheRefresh();
    return novoIdAula;
  } catch (error) {
    console.error('❌ Erro ao adicionar nova aula:', error.message);
    throw error;
  }
}

// Atualizar ValorAula em múltiplas aulas da BancoDeAulas-Lista (batch)
async function updateValorAulaLista(codigoContratacao, valorHoraAula) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", ">=", codigoContratacao)
      .where("id-Aula", "<", codigoContratacao + "\uf8ff")
      .get();

    if (querySnapshot.empty) return 0;

    const batch = db.batch();
    let count = 0;

    querySnapshot.forEach(doc => {
      const data = doc.data();
      const duracao = data.duracao || '';
      const mm = duracao.match(/(\d+)h(?:([0-5]\d))?/);
      const hours = mm ? parseInt(mm[1], 10) : 0;
      const minutes = (mm && mm[2]) ? parseInt(mm[2], 10) : 0;
      const totalHoursDecimal = (hours * 60 + minutes) / 60;
      const novoValor = Number((totalHoursDecimal * valorHoraAula).toFixed(2));

      batch.update(doc.ref, {
        ValorAula: novoValor,
        horaAulaProfessor: valorHoraAula,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });

    await batch.commit();
    forceCacheRefresh();
    console.log(`✅ ValorAula atualizado em ${count} aulas de ${codigoContratacao}`);
    return count;
  } catch (error) {
    console.error('❌ Erro ao atualizar ValorAula em lote:', error.message);
    throw error;
  }
}

// Excluir múltiplas aulas da BancoDeAulas-Lista
async function deleteAulasLista(docIds) {
  try {
    if (!docIds || docIds.length === 0) throw new Error('Nenhum ID fornecido');
    const batch = db.batch();
    docIds.forEach(docId => {
      batch.delete(db.collection("BancoDeAulas-Lista").doc(docId));
    });
    await batch.commit();
    forceCacheRefresh();
  } catch (error) {
    console.error('❌ Erro ao excluir aulas:', error.message);
    throw error;
  }
}

// Função para atualizar cor de uma aula no calendário
async function updateCorAulaLista(idAula, cor) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({ cor });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar cor:', error.message);
    throw error;
  }
}

// Atualizar campos do calendário em uma aula (data, materia, professor, duracao, horario, cor)
async function updateCamposCalendario(idAula, campos) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update(campos);
    forceCacheRefresh();
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar campos calendário:', error.message);
    throw error;
  }
}

// Excluir uma aula de BancoDeAulas-Lista por id-Aula
async function deleteAulaByIdAula(idAula) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.delete();
    forceCacheRefresh();
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir aula por id-Aula:', error.message);
    throw error;
  }
}

// Criar nova aula via calendário com campos personalizados, herdando metadados da última aula do contrato
async function addAulaCalendario(codigoContratacao, campos) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", ">=", codigoContratacao)
      .where("id-Aula", "<", codigoContratacao + "")
      .get();

    if (querySnapshot.empty) throw new Error(`Nenhuma aula base encontrada para: ${codigoContratacao}`);

    const aulas = [];
    querySnapshot.forEach(doc => { aulas.push({ id: doc.id, ...doc.data() }); });
    aulas.sort((a, b) => (a['id-Aula'] || '').localeCompare(b['id-Aula'] || ''));
    const ultima = aulas[aulas.length - 1];
    const novoId = incrementarIdAula(ultima['id-Aula']);

    let horasDecimais = 0;
    const dur = campos.duracao || ultima.duracao || '';
    const matchDur = dur.match(/(\d+)h(\d+)/);
    if (matchDur) horasDecimais = parseInt(matchDur[1]) + parseInt(matchDur[2]) / 60;
    const valorHora = Number(ultima.ValorAula && ultima.duracao
      ? (ultima.ValorAula / ((() => {
          const m = ultima.duracao.match(/(\d+)h(\d+)/);
          return m ? parseInt(m[1]) + parseInt(m[2]) / 60 : 1;
        })())) : 35);
    const valorAula = horasDecimais > 0 ? horasDecimais * valorHora : 0;

    const novaAula = {
      ConfirmacaoProfessorAula: false,
      ObservacoesAula: "",
      RelatorioAula: "",
      StatusAula: "Pendente",
      ValorAula: valorAula,
      clienteUid:   ultima.clienteUid   || "",
      clientUid:    ultima.clientUid    || "",
      codigoContratacao: ultima.codigoContratacao || codigoContratacao,
      idContratacao: codigoContratacao,
      cpf:          ultima.cpf          || "",
      estudante:    ultima.estudante    || "",
      idProfessor:  ultima.idProfessor  || "",
      professorUid: ultima.professorUid || "",
      metodoPagamento: ultima.metodoPagamento || "",
      nomeCliente:  ultima.nomeCliente  || "",
      "id-Aula": novoId,
      data:      campos.data      || "",
      materia:   campos.materia   || "",
      professor: campos.professor || ultima.professor || "",
      duracao:   campos.duracao   || ultima.duracao   || "",
      horario:   campos.horario   || "",
      cor:       campos.cor       || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("BancoDeAulas-Lista").add(novaAula);
    forceCacheRefresh();
    return novoId;
  } catch (error) {
    console.error('❌ Erro ao criar aula via calendário:', error.message);
    throw error;
  }
}

// Duplica uma aula existente (por id-Aula) como uma nova aula "limpa": mesma data,
// horário, duração, matéria, professor e estudante, mas com status "Pendente" e
// sem relatório/observação/confirmação (equivalente a uma aula recém-criada).
async function copiarAulaLista(idAulaOrigem) {
  try {
    const origemSnap = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAulaOrigem).get();
    if (origemSnap.empty) throw new Error(`Aula ${idAulaOrigem} não encontrada`);

    const origem = origemSnap.docs[0].data();
    const codigoContratacao = origem.idContratacao || origem.codigoContratacao;
    if (!codigoContratacao) throw new Error(`Aula ${idAulaOrigem} sem código de contratação`);

    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", ">=", codigoContratacao)
      .where("id-Aula", "<", codigoContratacao + "")
      .get();

    const aulas = [];
    querySnapshot.forEach(doc => { aulas.push({ id: doc.id, ...doc.data() }); });
    aulas.sort((a, b) => (a['id-Aula'] || '').localeCompare(b['id-Aula'] || ''));
    const ultimaAula = aulas[aulas.length - 1];
    const novoIdAula = incrementarIdAula(ultimaAula['id-Aula']);

    const novaAula = {
      ...origem,
      ConfirmacaoProfessorAula: false,
      ObservacoesAula: "",
      RelatorioAula: "",
      StatusAula: "Pendente",
      "id-Aula": novoIdAula,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("BancoDeAulas-Lista").add(novaAula);
    forceCacheRefresh();
    return novoIdAula;
  } catch (error) {
    console.error('❌ Erro ao copiar aula:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Coleção "calendario" — eventos customizados do Calendário Master
// (data, hora, nome, responsavel). Não armazena aulas nem pagamentos,
// que continuam vindo de BancoDeAulas-Lista e BancoDeAulas.
// ─────────────────────────────────────────────────────────────

// Função para adicionar um evento customizado ao calendário
async function addEventoCalendario(eventoData) {
  try {
    const docRef = await db.collection("calendario").add({
      ...eventoData,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao adicionar evento do calendário:', error.message);
    throw error;
  }
}

// Função para buscar todos os eventos customizados do calendário
async function fetchEventosCalendario() {
  try {
    const querySnapshot = await db.collection("calendario").get();
    const eventos = [];
    querySnapshot.forEach(doc => { eventos.push({ id: doc.id, ...doc.data() }); });
    return eventos;
  } catch (error) {
    console.error('❌ Erro ao buscar eventos do calendário:', error.message);
    return [];
  }
}

// Função para atualizar um evento customizado do calendário
async function updateEventoCalendario(eventoId, updatedData) {
  try {
    await db.collection("calendario").doc(eventoId).update(updatedData);
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar evento do calendário:', error.message);
    throw error;
  }
}

// Função para excluir um evento customizado do calendário
async function deleteEventoCalendario(eventoId) {
  try {
    await db.collection("calendario").doc(eventoId).delete();
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir evento do calendário:', error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Coleção "listasTarefas" — checklists de tarefas por data, criados
// pela função "Criar tarefas" do Calendário Master. Cada lista tem uma
// subcoleção "itens" (até 3 níveis: tarefa > subitem > sub-subitem),
// identificados por nivel (1/2/3) e parentId (null no nível 1). Contadores
// agregados (totalItens/itensConcluidos) ficam no doc da lista para o grid
// não precisar ler a subcoleção inteira a cada render.
// ─────────────────────────────────────────────────────────────

// Função para criar uma nova lista de tarefas (checklist) para uma data
async function addListaTarefas(data) {
  try {
    const docRef = await db.collection("listasTarefas").add({
      data,
      totalItens: 0,
      itensConcluidos: 0,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao criar lista de tarefas:', error.message);
    throw error;
  }
}

// Função para buscar todas as listas de tarefas (usado no grid do Calendário Master)
async function fetchListasTarefas() {
  try {
    const querySnapshot = await db.collection("listasTarefas").get();
    const listas = [];
    querySnapshot.forEach(doc => { listas.push({ id: doc.id, ...doc.data() }); });
    return listas;
  } catch (error) {
    console.error('❌ Erro ao buscar listas de tarefas:', error.message);
    return [];
  }
}

// Função para atualizar a data de uma lista de tarefas
async function updateListaTarefasData(listaId, novaData) {
  try {
    await db.collection("listasTarefas").doc(listaId).update({ data: novaData });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar data da lista de tarefas:', error.message);
    throw error;
  }
}

// Função para atualizar os contadores agregados (total/concluídos) da lista de tarefas
async function atualizarAgregadosListaTarefas(listaId, totalItens, itensConcluidos) {
  try {
    await db.collection("listasTarefas").doc(listaId).update({
      totalItens,
      itensConcluidos,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar agregados da lista de tarefas:', error.message);
    throw error;
  }
}

// Função para excluir uma lista de tarefas inteira (doc + subcoleção "itens")
async function deleteListaTarefas(listaId) {
  try {
    const itensSnap = await db.collection("listasTarefas").doc(listaId).collection("itens").get();
    const batch = db.batch();
    itensSnap.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection("listasTarefas").doc(listaId));
    await batch.commit();
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir lista de tarefas:', error.message);
    throw error;
  }
}

// Função para buscar todos os itens (tarefas/subitens/sub-subitens) de uma lista
// "status" substitui o antigo booleano "concluido" (pendente/andamento/concluido/cancelado).
// Itens antigos só têm "concluido" gravado — normaliza pra "status" aqui, num único lugar.
async function fetchItensTarefa(listaId) {
  try {
    const querySnapshot = await db.collection("listasTarefas").doc(listaId).collection("itens").get();
    const itens = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const status = data.status || (data.concluido ? 'concluido' : 'pendente');
      itens.push({ id: doc.id, ...data, status });
    });
    return itens;
  } catch (error) {
    console.error('❌ Erro ao buscar itens da lista de tarefas:', error.message);
    return [];
  }
}

// Função para adicionar um item (tarefa/subitem/sub-subitem) a uma lista de tarefas
async function addItemTarefa(listaId, itemData) {
  try {
    const docRef = await db.collection("listasTarefas").doc(listaId).collection("itens").add({
      ...itemData,
      status: 'pendente',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      ultimaEdicao: firebase.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao adicionar item da lista de tarefas:', error.message);
    throw error;
  }
}

// Função para atualizar um item (texto e/ou concluido) de uma lista de tarefas
async function updateItemTarefa(listaId, itemId, updatedData) {
  try {
    await db.collection("listasTarefas").doc(listaId).collection("itens").doc(itemId).update({
      ...updatedData,
      ultimaEdicao: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar item da lista de tarefas:', error.message);
    throw error;
  }
}

// Função para persistir a nova ordem dos itens depois de um arrastar-e-soltar
// (recebe [{id, ordem}, ...] e grava o campo "ordem" de cada um em lote)
async function reordenarItensTarefa(listaId, itensComOrdem) {
  try {
    const batch = db.batch();
    itensComOrdem.forEach(({ id, ordem }) => {
      batch.update(db.collection("listasTarefas").doc(listaId).collection("itens").doc(id), { ordem });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error('❌ Erro ao reordenar itens da lista de tarefas:', error.message);
    throw error;
  }
}

// Função para excluir um ou mais itens (usado para excluir um item + seus descendentes de uma vez)
async function deleteItensTarefa(listaId, itemIds) {
  try {
    const batch = db.batch();
    itemIds.forEach(id => batch.delete(db.collection("listasTarefas").doc(listaId).collection("itens").doc(id)));
    await batch.commit();
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir itens da lista de tarefas:', error.message);
    throw error;
  }
}

// Forçar atualização do cache
function forceCacheRefresh() {
  CACHE.bancoDeAulas.timestamp      = null;
  CACHE.cadastroClientes.timestamp  = null;
  CACHE.dataBaseProfessores.timestamp = null;
  CACHE.bancoDeAulasListaBatch.timestamp = null;
}

// Exportar funções para uso global
if (typeof window !== 'undefined') {
  window.BANCO = {
    db,
    fetchBancoDeAulas,
    fetchCadastroClientes,
    fetchDataBaseProfessores,
    fetchClienteByCPF,
    fetchAulasByDate,
    updateAula,
    deleteAula,
    addNovaAula,
    fetchBancoDeAulasLista,
    fetchBancoDeAulasListaBatch,
    updateRelatorioAula,
    updateStatusAula,
    updateObservacoesAula,
    updateDataAula,
    updateHorarioAula,
    updateDuracaoAula,
    updateMateriaAula,
    updateProfessorAula,
    updateEstudanteAula,
    updateConfirmacaoProfessorAula,
    updateValorAulaLista,
    addNovaAulaLista,
    deleteAulasLista,
    updateCorAulaLista,
    updateCamposCalendario,
    deleteAulaByIdAula,
    addAulaCalendario,
    copiarAulaLista,
    addEventoCalendario,
    fetchEventosCalendario,
    updateEventoCalendario,
    deleteEventoCalendario,
    addListaTarefas,
    fetchListasTarefas,
    updateListaTarefasData,
    atualizarAgregadosListaTarefas,
    deleteListaTarefas,
    fetchItensTarefa,
    addItemTarefa,
    updateItemTarefa,
    reordenarItensTarefa,
    deleteItensTarefa,
    forceCacheRefresh,
    isCacheValid
  };
}

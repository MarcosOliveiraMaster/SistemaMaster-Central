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
    await db.collection("BancoDeAulas").doc(aulaId).update(updatedData);
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
async function fetchBancoDeAulasListaBatch() {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista").get();
    const todasAulas = [];
    querySnapshot.forEach(doc => {
      todasAulas.push({ id: doc.id, statusAula: doc.data().statusAula || 'Não informado', ...doc.data() });
    });
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
async function updateProfessorAula(idAula, nomeProfessor, cpfProfessor) {
  try {
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula).get();
    if (querySnapshot.empty) throw new Error(`Aula ${idAula} não encontrada`);
    await querySnapshot.docs[0].ref.update({
      professor: nomeProfessor,
      idProfessor: cpfProfessor,
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
      data: dataAtual,
      duracao: duracaoPadrao,
      estudante: ultimaAula.estudante || "",
      horario: "",
      "id-Aula": novoIdAula,
      idProfessor: "",
      materia: "",
      nomeCliente: ultimaAula.nomeCliente || "",
      professor: "",
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

// Forçar atualização do cache
function forceCacheRefresh() {
  CACHE.bancoDeAulas.timestamp      = null;
  CACHE.cadastroClientes.timestamp  = null;
  CACHE.dataBaseProfessores.timestamp = null;
}

// ── Informações de Pagamento ──────────────────────────────────────────────────

async function fetchInformacoesPagamento(cpfProfessor, mes, ano) {
  try {
    const docId = `${cpfProfessor}_${ano}_${mes}`;
    const docSnap = await db.collection('informacoesPagamento').doc(docId).get();
    return docSnap.exists ? docSnap.data() : null;
  } catch (error) {
    console.error('❌ Erro ao buscar informacoesPagamento:', error.message);
    throw error;
  }
}

async function saveInformacoesPagamento(cpfProfessor, mes, ano, infos, uidProfessor = '') {
  try {
    const docId = `${cpfProfessor}_${ano}_${mes}`;
    await db.collection('informacoesPagamento').doc(docId).set({
      uidProfessor,
      cpfProfessor,
      mes,
      ano,
      infos
    });
  } catch (error) {
    console.error('❌ Erro ao salvar informacoesPagamento:', error.message);
    throw error;
  }
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
    updateValorAulaLista,
    addNovaAulaLista,
    deleteAulasLista,
    forceCacheRefresh,
    isCacheValid,
    fetchInformacoesPagamento,
    saveInformacoesPagamento
  };
}
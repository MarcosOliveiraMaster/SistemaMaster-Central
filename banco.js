// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDPPbSA8SB-L_giAhWIqGbPGSMRBDTPi40",
  authDomain: "master-ecossistemaprofessor.firebaseapp.com",
  databaseURL: "https://master-ecossistemaprofessor-default-rtdb.firebaseio.com",
  projectId: "master-ecossistemaprofessor",
  storageBucket: "master-ecossistemaprofessor.firebasestorage.app",
  messagingSenderId: "532224860209",
  appId: "1:532224860209:web:686657b6fae13b937cf510",
  measurementId: "G-B0KMX4E67D"
};

// Inicializar Firebase
let app, db;

try {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log('✅ Firebase inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error);
}

// Cache para otimização
const CACHE = {
  bancoDeAulas: {
    data: null,
    timestamp: null,
    maxAge: 5 * 60 * 1000 // 5 minutos
  },
  cadastroClientes: {
    data: null,
    timestamp: null,
    maxAge: 10 * 60 * 1000 // 10 minutos
  },
  dataBaseProfessores: {
    data: null,
    timestamp: null,
    maxAge: 30 * 60 * 1000 // 30 minutos
  }
};

// Função para verificar validade do cache
function isCacheValid(cacheKey) {
  const cache = CACHE[cacheKey];
  if (!cache || !cache.data || !cache.timestamp) {
    return false;
  }
  
  const age = Date.now() - cache.timestamp;
  return age < cache.maxAge;
}

// Função para buscar dados do BancoDeAulas
async function fetchBancoDeAulas(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('bancoDeAulas')) {
    console.log('📦 Retornando BancoDeAulas do cache');
    return CACHE.bancoDeAulas.data;
  }
  
  try {
    console.log('🔍 Buscando BancoDeAulas do Firebase...');
    
    const querySnapshot = await db.collection("BancoDeAulas")
      .orderBy("timestamp", "desc")
      .get();
    
    const aulas = [];
    querySnapshot.forEach(doc => {
      aulas.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Atualizar cache
    CACHE.bancoDeAulas.data = aulas;
    CACHE.bancoDeAulas.timestamp = Date.now();
    
    console.log(`✅ ${aulas.length} aulas carregadas do BancoDeAulas`);
    return aulas;
  } catch (error) {
    console.error('❌ Erro ao buscar BancoDeAulas:', error);
    throw error;
  }
}

// Função para buscar dados de cadastroClientes
async function fetchCadastroClientes(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('cadastroClientes')) {
    console.log('📦 Retornando cadastroClientes do cache');
    return CACHE.cadastroClientes.data;
  }
  
  try {
    console.log('🔍 Buscando cadastroClientes do Firebase...');
    
    const querySnapshot = await db.collection("cadastroClientes").get();
    
    const clientes = [];
    querySnapshot.forEach(doc => {
      clientes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Atualizar cache
    CACHE.cadastroClientes.data = clientes;
    CACHE.cadastroClientes.timestamp = Date.now();
    
    console.log(`✅ ${clientes.length} clientes carregados`);
    return clientes;
  } catch (error) {
    console.error('❌ Erro ao buscar cadastroClientes:', error);
    throw error;
  }
}

// Função para buscar dados de dataBaseProfessores
async function fetchDataBaseProfessores(forceRefresh = false) {
  if (!forceRefresh && isCacheValid('dataBaseProfessores')) {
    console.log('📦 Retornando dataBaseProfessores do cache');
    return CACHE.dataBaseProfessores.data;
  }
  
  try {
    console.log('🔍 Buscando dataBaseProfessores do Firebase...');
    
    const querySnapshot = await db.collection("dataBaseProfessores")
      .orderBy("nome")
      .get();
    
    const professores = [];
    querySnapshot.forEach(doc => {
      professores.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Atualizar cache
    CACHE.dataBaseProfessores.data = professores;
    CACHE.dataBaseProfessores.timestamp = Date.now();
    
    console.log(`✅ ${professores.length} professores carregados`);
    return professores;
  } catch (error) {
    console.error('❌ Erro ao buscar dataBaseProfessores:', error);
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
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar cliente por CPF:', error);
    throw error;
  }
}

// Função para buscar aulas por data
async function fetchAulasByDate(dateString) {
  try {
    // Converter data para formato Firebase
    const date = new Date(dateString.split('/').reverse().join('-'));
    
    // Buscar aulas que contenham a data especificada
    const querySnapshot = await db.collection("BancoDeAulas").get();
    
    const aulasDoDia = [];
    
    querySnapshot.forEach(doc => {
      const aulaData = doc.data();
      
      if (aulaData.aulas && Array.isArray(aulaData.aulas)) {
        aulaData.aulas.forEach(aula => {
          if (aula.data && aula.data.includes(dateString)) {
            aulasDoDia.push({
              contratoId: doc.id,
              ...aulaData,
              aulaDetalhe: aula
            });
          }
        });
      }
    });
    
    return aulasDoDia;
  } catch (error) {
    console.error('❌ Erro ao buscar aulas por data:', error);
    throw error;
  }
}

// Função para atualizar uma aula
async function updateAula(aulaId, updatedData) {
  try {
    await db.collection("BancoDeAulas").doc(aulaId).update(updatedData);
    
    // Invalidar cache
    CACHE.bancoDeAulas.timestamp = null;
    
    console.log('✅ Aula atualizada com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar aula:', error);
    throw error;
  }
}

// Função para excluir uma aula
async function deleteAula(aulaId) {
  try {
    await db.collection("BancoDeAulas").doc(aulaId).delete();
    
    // Invalidar cache
    CACHE.bancoDeAulas.timestamp = null;
    
    console.log('✅ Aula excluída com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao excluir aula:', error);
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
    
    // Invalidar cache
    CACHE.bancoDeAulas.timestamp = null;
    
    console.log('✅ Nova aula adicionada com ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao adicionar nova aula:', error);
    throw error;
  }
}

// Função para buscar aulas individuais da coleção BancoDeAulas-Lista
async function fetchBancoDeAulasLista(codigoContratacao) {
  try {
    console.log(`🔍 Buscando aulas individuais para código: ${codigoContratacao}`);
    
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .orderBy("data", "asc")
      .get();
    
    const todasAulas = [];
    querySnapshot.forEach(doc => {
      todasAulas.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Filtrar aulas onde os 4 primeiros dígitos do id-Aula correspondem ao codigoContratacao
    const aulasFiltradas = todasAulas.filter(aula => {
      const idAula = aula['id-Aula'] || '';
      const primeiros4Digitos = idAula.substring(0, 4);
      return primeiros4Digitos === codigoContratacao;
    });
    
    console.log(`✅ ${aulasFiltradas.length} aulas encontradas para código ${codigoContratacao}`);
    return aulasFiltradas;
  } catch (error) {
    console.error('❌ Erro ao buscar BancoDeAulas-Lista:', error);
    throw error;
  }
}

// Função para atualizar RelatorioAula de uma aula individual
async function updateRelatorioAula(idAula, novoRelatorio) {
  try {
    console.log(`📝 Atualizando relatório para aula: ${idAula}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      RelatorioAula: novoRelatorio,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Relatório atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar relatório:', error);
    throw error;
  }
}

// Função para atualizar StatusAula de uma aula individual
async function updateStatusAula(idAula, novoStatus) {
  try {
    console.log(`🔄 Atualizando status para aula: ${idAula} -> ${novoStatus}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      StatusAula: novoStatus,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Status atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error);
    throw error;
  }
}

// Função para atualizar ObservacoesAula de uma aula individual
async function updateObservacoesAula(idAula, novasObservacoes) {
  try {
    console.log(`📝 Atualizando observações para aula: ${idAula}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      ObservacoesAula: novasObservacoes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Observações atualizadas com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar observações:', error);
    throw error;
  }
}

// Função para atualizar data de uma aula individual
async function updateDataAula(idAula, novaData) {
  try {
    console.log(`📅 Atualizando data para aula: ${idAula} -> ${novaData}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      data: novaData,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Data atualizada com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar data:', error);
    throw error;
  }
}

// Função para atualizar horário de uma aula individual
async function updateHorarioAula(idAula, novoHorario) {
  try {
    console.log(`🕐 Atualizando horário para aula: ${idAula} -> ${novoHorario}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      horario: novoHorario,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Horário atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar horário:', error);
    throw error;
  }
}

// Função para atualizar duração de uma aula individual
async function updateDuracaoAula(idAula, novaDuracao) {
  try {
    console.log(`⏱️ Atualizando duração para aula: ${idAula} -> ${novaDuracao}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Converter duração para horas decimais (ex: "1h30" -> 1.5)
    let horasDecimais = 0;
    if (novaDuracao) {
      const match = novaDuracao.match(/(\d+)h(\d+)/);
      if (match) {
        const horas = parseInt(match[1]);
        const minutos = parseInt(match[2]);
        horasDecimais = horas + (minutos / 60);
      }
    }
    
    // Calcular ValorAula (duração em horas * 35)
    const valorAula = horasDecimais * 35;
    
    console.log(`💰 Calculando ValorAula: ${horasDecimais} horas * 35 = R$ ${valorAula.toFixed(2)}`);
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      duracao: novaDuracao,
      ValorAula: valorAula,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Duração atualizada com sucesso: ${novaDuracao}`);
    console.log(`✅ ValorAula atualizado com sucesso: R$ ${valorAula.toFixed(2)}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar duração:', error);
    throw error;
  }
}

// Função para atualizar matéria de uma aula individual
async function updateMateriaAula(idAula, novaMateria) {
  try {
    console.log(`📚 Atualizando matéria para aula: ${idAula} -> ${novaMateria}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      materia: novaMateria,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Matéria atualizada com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar matéria:', error);
    throw error;
  }
}

// Função para atualizar professor de uma aula individual
async function updateProfessorAula(idAula, nomeProfessor, cpfProfessor) {
  try {
    console.log(`👨‍🏫 Atualizando professor para aula: ${idAula}`);
    console.log(`   Nome: ${nomeProfessor}`);
    console.log(`   CPF: ${cpfProfessor}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      professor: nomeProfessor,
      idProfessor: cpfProfessor,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Professor atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar professor:', error);
    throw error;
  }
}

// Função para atualizar estudante de uma aula individual
async function updateEstudanteAula(idAula, nomeEstudante) {
  try {
    console.log(`👨‍🎓 Atualizando estudante para aula: ${idAula}`);
    console.log(`   Nome: ${nomeEstudante || '(removendo estudante)'}`);
    
    // Buscar documento pelo campo id-Aula
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", "==", idAula)
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Aula com id-Aula ${idAula} não encontrada`);
    }
    
    // Atualizar o primeiro documento encontrado
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      estudante: nomeEstudante || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Estudante atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar estudante:', error);
    throw error;
  }
}

// Função auxiliar para incrementar id-Aula alfabeticamente
function incrementarIdAula(idAulaAtual) {
  // Exemplo: "0213BX" -> "0213BY" ou "0054AZ" -> "0054BA"
  const match = idAulaAtual.match(/^(\d{4})([A-Z]+)$/);
  if (!match) {
    throw new Error(`Formato de id-Aula inválido: ${idAulaAtual}`);
  }
  
  const prefixo = match[1]; // "0213"
  let letras = match[2]; // "BX"
  
  // Converter letras para array
  let letrasArray = letras.split('');
  
  // Incrementar da direita para esquerda (como números)
  let i = letrasArray.length - 1;
  let carry = true;
  
  while (carry && i >= 0) {
    if (letrasArray[i] === 'Z') {
      letrasArray[i] = 'A';
      i--;
    } else {
      letrasArray[i] = String.fromCharCode(letrasArray[i].charCodeAt(0) + 1);
      carry = false;
    }
  }
  
  // Se ainda tem carry, adiciona uma nova letra no início
  if (carry) {
    letrasArray.unshift('A');
  }
  
  const novoId = prefixo + letrasArray.join('');
  console.log(`🔢 ID incrementado: ${idAulaAtual} -> ${novoId}`);
  return novoId;
}

// Função para adicionar nova aula a um cronograma
async function addNovaAulaLista(codigoContratacao, valorHoraContrato = 35) {
  try {
    console.log(`➕ Adicionando nova aula ao cronograma: ${codigoContratacao}`);
    
    // Buscar todas as aulas deste código de contratação
    const querySnapshot = await db.collection("BancoDeAulas-Lista")
      .where("id-Aula", ">=", codigoContratacao)
      .where("id-Aula", "<", codigoContratacao + "\uf8ff")
      .get();
    
    if (querySnapshot.empty) {
      throw new Error(`Nenhuma aula encontrada para o código: ${codigoContratacao}`);
    }
    
    // Pegar todas as aulas e ordenar por id-Aula
    const aulas = [];
    querySnapshot.forEach(doc => {
      aulas.push({ id: doc.id, ...doc.data() });
    });
    
    // Ordenar alfabeticamente por id-Aula
    aulas.sort((a, b) => (a['id-Aula'] || '').localeCompare(b['id-Aula'] || ''));
    
    // Pegar a última aula
    const ultimaAula = aulas[aulas.length - 1];
    console.log(`📄 Última aula encontrada: ${ultimaAula['id-Aula']}`);
    
    // Incrementar id-Aula
    const novoIdAula = incrementarIdAula(ultimaAula['id-Aula']);
    
    // Obter data atual no formato "ddd - dd/mm/yyyy"
    const hoje = new Date();
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const diaSemana = diasSemana[hoje.getDay()];
    const dataAtual = `${diaSemana} - ${dia}/${mes}/${ano}`;
    
    // Determinar duração padrão a partir da última aula (se existir)
    let duracaoPadrao = ultimaAula.duracao || '';

    // Converter duração padrão para horas decimais
    let horasDecimais = 0;
    if (duracaoPadrao) {
      const matchDur = duracaoPadrao.match(/(\d+)h(\d+)/);
      if (matchDur) {
        const horas = parseInt(matchDur[1], 10);
        const minutos = parseInt(matchDur[2], 10);
        horasDecimais = horas + (minutos / 60);
      }
    }

    // Calcular ValorAula usando o valorHoraContrato recebido
    const valorAulaCalculado = horasDecimais > 0 ? (horasDecimais * Number(valorHoraContrato)) : 0;

    // Criar novo documento
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
    
    // Adicionar documento ao Firestore
    await db.collection("BancoDeAulas-Lista").add(novaAula);
    
    console.log('✅ Nova aula adicionada com sucesso!');
    console.log(`   ID: ${novoIdAula}`);
    console.log(`   Data: ${dataAtual}`);
    console.log(`   Cliente: ${novaAula.nomeCliente}`);
    
    return novoIdAula;
  } catch (error) {
    console.error('❌ Erro ao adicionar nova aula:', error);
    throw error;
  }
}

// Função para excluir múltiplas aulas da BancoDeAulas-Lista
async function deleteAulasLista(docIds) {
  try {
    console.log('🗑️ Iniciando exclusão de aulas:', docIds);
    
    if (!docIds || docIds.length === 0) {
      throw new Error('Nenhum ID de documento fornecido');
    }
    
    // Usar batch para excluir múltiplos documentos de forma eficiente
    const batch = db.batch();
    
    docIds.forEach(docId => {
      const docRef = db.collection("BancoDeAulas-Lista").doc(docId);
      batch.delete(docRef);
    });
    
    // Executar todas as exclusões
    await batch.commit();
    
    console.log(`✅ ${docIds.length} aula(s) excluída(s) com sucesso!`);
    
    // Forçar atualização do cache
    forceCacheRefresh();
    
  } catch (error) {
    console.error('❌ Erro ao excluir aulas:', error);
    throw error;
  }
}

// Função para forçar atualização do cache
function forceCacheRefresh() {
  CACHE.bancoDeAulas.timestamp = null;
  CACHE.cadastroClientes.timestamp = null;
  CACHE.dataBaseProfessores.timestamp = null;
  console.log('🔄 Cache forçado a atualizar');
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
    updateRelatorioAula,
    updateStatusAula,
    updateObservacoesAula,
    updateDataAula,
    updateHorarioAula,
    updateDuracaoAula,
    updateMateriaAula,
    updateProfessorAula,
    updateEstudanteAula,
    addNovaAulaLista,
    deleteAulasLista,
    forceCacheRefresh,
    isCacheValid
  };
}
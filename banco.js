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
    forceCacheRefresh,
    isCacheValid
  };
}
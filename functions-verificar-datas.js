// ============================================================
// functions-verificar-datas.js
// Motor de verificação de datas: feriados + conflitos de agenda do professor
// Usado pelo botão "Verificar Datas" em Detalhes da Contratação e Simulações
// ============================================================

// Feriados estaduais (Alagoas) e municipais (Maceió) — lista mantida manualmente,
// pois não existe API pública confiável para esses níveis. Repete todo ano (sem campo "ano").
window.FERIADOS_AL_MACEIO = [
  { mes: 9, dia: 16, nome: 'Emancipação Política de Alagoas' },
  { mes: 12, dia: 5, nome: 'Aniversário de Maceió' }
];

// Status de aula que NÃO contam como conflito real de agenda
const _STATUS_IGNORADOS_CONFLITO = ['Cancelada', 'Reagendada'];

const _cacheFeriadosNacionais = {}; // { [ano]: [{date, name, type}] }

async function _buscarFeriadosNacionais(ano) {
  if (_cacheFeriadosNacionais[ano]) return _cacheFeriadosNacionais[ano];
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
    if (!resp.ok) throw new Error('Resposta não OK da BrasilAPI');
    const data = await resp.json();
    _cacheFeriadosNacionais[ano] = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('⚠️ Não foi possível buscar feriados nacionais (BrasilAPI):', err);
    _cacheFeriadosNacionais[ano] = [];
  }
  return _cacheFeriadosNacionais[ano];
}

// Converte "seg - 10/01/2026" ou "10/01/2026" em Date local
function _parseDataAula(dataStr) {
  if (!dataStr) return null;
  const match = String(dataStr).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const ano = parseInt(match[3], 10);
  return new Date(ano, mes - 1, dia);
}

function _fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _primeiroNome(nome) {
  if (!nome) return '';
  return String(nome).trim().split(/\s+/)[0];
}

// Retorna { feriado: {nome}|null, vesperaFeriado: {nome}|null } para a data da aula
async function _verificarFeriadoData(dataStr) {
  const dataObj = _parseDataAula(dataStr);
  if (!dataObj) return { feriado: null, vesperaFeriado: null };

  const amanha = new Date(dataObj);
  amanha.setDate(amanha.getDate() + 1);

  const anoHoje = dataObj.getFullYear();
  const anoAmanha = amanha.getFullYear();

  const [feriadosHoje, feriadosAmanha] = await Promise.all([
    _buscarFeriadosNacionais(anoHoje),
    anoAmanha !== anoHoje ? _buscarFeriadosNacionais(anoAmanha) : Promise.resolve(null)
  ]);
  const listaAmanha = feriadosAmanha || feriadosHoje;

  const isoHoje = _fmtISO(dataObj);
  const isoAmanha = _fmtISO(amanha);

  let feriadoHoje = feriadosHoje.find(f => f.date === isoHoje);
  let feriadoAmanha = listaAmanha.find(f => f.date === isoAmanha);

  if (!feriadoHoje) {
    const fixo = window.FERIADOS_AL_MACEIO.find(f => f.mes === dataObj.getMonth() + 1 && f.dia === dataObj.getDate());
    if (fixo) feriadoHoje = { name: fixo.nome };
  }
  if (!feriadoAmanha) {
    const fixo = window.FERIADOS_AL_MACEIO.find(f => f.mes === amanha.getMonth() + 1 && f.dia === amanha.getDate());
    if (fixo) feriadoAmanha = { name: fixo.nome };
  }

  return {
    feriado: feriadoHoje ? { nome: feriadoHoje.name } : null,
    vesperaFeriado: feriadoAmanha ? { nome: feriadoAmanha.name } : null
  };
}

// Busca no Firestore outras aulas do mesmo professor na mesma data.
// Retorna { mesmoHorario: {nomeCliente, codigoContratacao}|null, mesmoDia: {...}|null }
async function _verificarConflitoAgenda(idProfessor, dataStr, horario, excluirId) {
  if (!idProfessor || idProfessor === 'A definir' || !dataStr) {
    return { mesmoHorario: null, mesmoDia: null };
  }

  const snap = await BANCO.db.collection('BancoDeAulas-Lista')
    .where('idProfessor', '==', idProfessor)
    .where('data', '==', dataStr)
    .get();

  let mesmoHorario = null;
  let mesmoDia = null;

  snap.forEach(doc => {
    const a = doc.data();
    const idAtual = a['id-Aula'] || doc.id;
    if (idAtual === excluirId || doc.id === excluirId) return;
    if (_STATUS_IGNORADOS_CONFLITO.includes(a.StatusAula)) return;

    const info = { nomeCliente: a.nomeCliente || a.nome || '', codigoContratacao: a.codigoContratacao || '', horario: a.horario || '' };
    if (a.horario === horario) {
      mesmoHorario = info;
    } else if (!mesmoDia) {
      mesmoDia = info;
    }
  });

  return { mesmoHorario, mesmoDia };
}

// Função principal: recebe uma aula (com data, horario, idProfessor, e opcionalmente id-Aula)
// e retorna { cor: 'verde'|'amarelo'|'vermelho', tooltip: string }
window.verificarStatusAula = async function (aula) {
  const dataStr = aula.data;
  const horario = aula.horario;
  const idProfessor = aula.idProfessor;
  const excluirId = aula['id-Aula'] || aula.id;

  const [{ feriado, vesperaFeriado }, { mesmoHorario, mesmoDia }] = await Promise.all([
    _verificarFeriadoData(dataStr),
    _verificarConflitoAgenda(idProfessor, dataStr, horario, excluirId)
  ]);

  // Prioridade: vermelho > amarelo > verde
  if (mesmoHorario) {
    return {
      cor: 'vermelho',
      tooltip: `Existe uma aula com ${_primeiroNome(mesmoHorario.nomeCliente)} no pacote ${mesmoHorario.codigoContratacao} para este mesmo dia e horário`
    };
  }
  if (feriado) {
    return { cor: 'vermelho', tooltip: `Este dia é feriado de ${feriado.nome}` };
  }
  if (mesmoDia) {
    return {
      cor: 'amarelo',
      tooltip: `Existe uma aula com ${_primeiroNome(mesmoDia.nomeCliente)} no pacote ${mesmoDia.codigoContratacao} neste mesmo dia, às ${mesmoDia.horario || '--'}`
    };
  }
  if (vesperaFeriado) {
    return { cor: 'amarelo', tooltip: `Amanhã é feriado de ${vesperaFeriado.nome} — véspera de feriado` };
  }
  return { cor: 'verde', tooltip: 'Nenhum conflito de agenda ou feriado encontrado' };
};

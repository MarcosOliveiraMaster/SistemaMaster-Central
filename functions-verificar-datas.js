// ============================================================
// functions-verificar-datas.js
// Motor de verificação de datas: feriados + conflitos de agenda do professor
// Usado pelo botão "Verificar Datas" em Detalhes da Contratação e Simulações
// ============================================================

// Feriados estaduais (Alagoas) e municipais (Maceió).
//
// Esta lista era mantida à mão aqui e tinha só duas datas, uma delas incorreta
// ("Aniversário de Maceió" em 05/12, que não é feriado). Passou a ser derivada de
// feriados.js, que é a fonte única do sistema e cobre também São João, São Pedro,
// Dia Estadual do Evangélico, Nossa Senhora dos Prazeres, Nossa Senhora da
// Conceição, Corpus Christi e Marechal Floriano Peixoto.
//
// Continua exposta em window com o mesmo formato de antes ({ mes: 1-12, dia, nome })
// para não quebrar quem já dependia dela. É montada sob demanda porque feriados.js
// carrega depois deste arquivo no index.html.
function _feriadosRegionaisDoAno(ano) {
  if (typeof Feriados === 'undefined' || !Feriados.listar) return [];
  return Feriados.listar(ano)
    .filter(f => f.esfera !== Feriados.NACIONAL)
    .map(f => ({ mes: f.mes + 1, dia: f.dia, nome: f.nome }));
}

Object.defineProperty(window, 'FERIADOS_AL_MACEIO', {
  get() { return _feriadosRegionaisDoAno(new Date().getFullYear()); },
  configurable: true
});

// Status de aula que NÃO contam como conflito real de agenda
const _STATUS_IGNORADOS_CONFLITO = ['Cancelada', 'Reagendada'];

const _cacheFeriadosNacionais = {}; // { [ano]: [{date, name, type}] }

// Nacionais do feriados.js, no formato da BrasilAPI ({ date, name, type }).
// Servem de base offline: antes, uma falha de rede deixava a verificação sem
// nenhum feriado nacional.
function _nacionaisLocais(ano) {
  if (typeof Feriados === 'undefined' || !Feriados.listar) return [];
  return Feriados.listar(ano)
    .filter(f => f.esfera === Feriados.NACIONAL)
    .map(f => ({
      date: `${ano}-${String(f.mes + 1).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`,
      name: f.nome,
      type: 'national'
    }));
}

// União da base local com a BrasilAPI: a rede só acrescenta o que faltar
// (feriados nacionais novos), e a ausência dela não zera mais o resultado.
async function _buscarFeriadosNacionais(ano) {
  if (_cacheFeriadosNacionais[ano]) return _cacheFeriadosNacionais[ano];

  const locais = _nacionaisLocais(ano);
  let daApi = [];
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
    if (!resp.ok) throw new Error('Resposta não OK da BrasilAPI');
    const data = await resp.json();
    daApi = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('⚠️ BrasilAPI indisponível; usando apenas a lista local de feriados:', err);
  }

  const porData = new Map();
  locais.forEach(f => porData.set(f.date, f));
  daApi.forEach(f => { if (f && f.date && !porData.has(f.date)) porData.set(f.date, f); });

  _cacheFeriadosNacionais[ano] = [...porData.values()];
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

  // Regionais pelo ano da própria data, e não pelo ano corrente: os móveis
  // (Corpus Christi) mudam de dia a cada ano.
  if (!feriadoHoje) {
    const fixo = _feriadosRegionaisDoAno(anoHoje)
      .find(f => f.mes === dataObj.getMonth() + 1 && f.dia === dataObj.getDate());
    if (fixo) feriadoHoje = { name: fixo.nome };
  }
  if (!feriadoAmanha) {
    const fixo = _feriadosRegionaisDoAno(anoAmanha)
      .find(f => f.mes === amanha.getMonth() + 1 && f.dia === amanha.getDate());
    if (fixo) feriadoAmanha = { name: fixo.nome };
  }

  return {
    feriado: feriadoHoje ? { nome: feriadoHoje.name } : null,
    vesperaFeriado: feriadoAmanha ? { nome: feriadoAmanha.name } : null
  };
}

// Busca no Firestore outras aulas do mesmo professor na mesma data.
// Retorna { mesmoHorario: [{nomeCliente, codigoContratacao, horario}], mesmoDia: [...] } — arrays,
// pois pode haver mais de uma aula conflitante no mesmo dia.
async function _verificarConflitoAgenda(idProfessor, dataStr, horario, excluirId, codigoContratacaoAtual) {
  if (!idProfessor || idProfessor === 'A definir' || !dataStr) {
    return { mesmoHorario: [], mesmoDia: [] };
  }

  const snap = await BANCO.db.collection('BancoDeAulas-Lista')
    .where('idProfessor', '==', idProfessor)
    .where('data', '==', dataStr)
    .get();

  const mesmoHorario = [];
  const mesmoDia = [];

  snap.forEach(doc => {
    const a = doc.data();
    const idAtual = a['id-Aula'] || doc.id;
    if (idAtual === excluirId || doc.id === excluirId) return;
    if (_STATUS_IGNORADOS_CONFLITO.includes(a.StatusAula)) return;
    // Aulas do mesmo pacote/contratação sendo consultado não são conflito — é esperado
    // que o mesmo professor dê mais de uma aula dentro do mesmo contrato.
    if (codigoContratacaoAtual && a.codigoContratacao === codigoContratacaoAtual) return;

    const info = { nomeCliente: a.nomeCliente || a.nome || '', codigoContratacao: a.codigoContratacao || '', horario: a.horario || '' };
    if (a.horario === horario) {
      mesmoHorario.push(info);
    } else {
      mesmoDia.push(info);
    }
  });

  return { mesmoHorario, mesmoDia };
}

// Monta a lista de conflitos em tópicos (usado quando há mais de uma aula conflitante)
function _listarConflitos(lista, incluirHorario) {
  return lista
    .map(c => `• ${_primeiroNome(c.nomeCliente)} (pacote ${c.codigoContratacao}${incluirHorario ? `, às ${c.horario || '--'}` : ''})`)
    .join('\n');
}

// Função principal: recebe uma aula (com data, horario, idProfessor, e opcionalmente id-Aula)
// e retorna { cor: 'verde'|'amarelo'|'vermelho', tooltip: string }
window.verificarStatusAula = async function (aula) {
  const dataStr = aula.data;
  const horario = aula.horario;
  const idProfessor = aula.idProfessor;
  const excluirId = aula['id-Aula'] || aula.id;
  const codigoContratacaoAtual = aula.codigoContratacao;

  // Aula sem data definida: não há o que checar (nem feriado, nem conflito de agenda).
  if (!dataStr) {
    return { cor: 'cinza', tooltip: 'Aula sem data definida — nada para verificar' };
  }

  const [{ feriado, vesperaFeriado }, { mesmoHorario, mesmoDia }] = await Promise.all([
    _verificarFeriadoData(dataStr),
    _verificarConflitoAgenda(idProfessor, dataStr, horario, excluirId, codigoContratacaoAtual)
  ]);

  // Prioridade: vermelho > amarelo > verde
  if (mesmoHorario.length > 0) {
    const tooltip = mesmoHorario.length === 1
      ? `Existe uma aula com ${_primeiroNome(mesmoHorario[0].nomeCliente)} no pacote ${mesmoHorario[0].codigoContratacao} para este mesmo dia e horário`
      : `Existem ${mesmoHorario.length} aulas para este mesmo dia e horário:\n${_listarConflitos(mesmoHorario, false)}`;
    return { cor: 'vermelho', tooltip };
  }
  if (feriado) {
    return { cor: 'vermelho', tooltip: `Este dia é feriado de ${feriado.nome}` };
  }
  if (mesmoDia.length > 0) {
    const tooltip = mesmoDia.length === 1
      ? `Existe uma aula com ${_primeiroNome(mesmoDia[0].nomeCliente)} no pacote ${mesmoDia[0].codigoContratacao} neste mesmo dia, às ${mesmoDia[0].horario || '--'}`
      : `Existem ${mesmoDia.length} aulas neste mesmo dia:\n${_listarConflitos(mesmoDia, true)}`;
    return { cor: 'amarelo', tooltip };
  }
  if (vesperaFeriado) {
    return { cor: 'amarelo', tooltip: `Amanhã é feriado de ${vesperaFeriado.nome} — véspera de feriado` };
  }
  return { cor: 'verde', tooltip: 'Nenhum conflito de agenda ou feriado encontrado' };
};

// ============================================================
// CALENDÁRIO MASTER — "Criar tarefas" (checklist por data)
// Arquivo isolado do resto do Painel Central pra facilitar manutenção sem
// impactar functions-PainelCentral.js. Depende apenas de utilitários globais
// já carregados na página: BANCO (banco.js), escapeHtml/showToast (functions-
// PainelCentral.js), showConfirmDialog (functions-disciplinas.js),
// _parseDataAula (functions-verificar-datas.js), Feriados (feriados.js) e
// window.currentUser (auth.js). Expõe window.CalMasterTarefas.
//
// Modelo de dados (Firestore):
//   listasTarefas/{listaId}            { data, totalItens, itensConcluidos, timestamp }
//   listasTarefas/{listaId}/itens/{id} { texto, status('pendente'|'andamento'|'concluido'|'cancelado'),
//                                        nivel(1-3), parentId,
//                                        responsavel('Marcos'|'Ester'|''), prazo('HH:MM'|''),
//                                        comentario, tags(string[], só nível 1), ordem,
//                                        ultimaEdicao, ultimaEdicaoPor, criadoEm }
// "totalItens"/"itensConcluidos" contam só os itens de nível 1 (são o que vira
// fatia na barra de progresso do dia); "itensConcluidos" só soma status==='concluido'.
//
// Checkbox de status: cada clique avança um ciclo independente por item (pai e
// subtarefas não se propagam mais entre si) — vazio(pendente) → amarelo(andamento,
// ampulheta) → verde(concluido, check) → vermelho(cancelado, x) → volta pro vazio.
// ============================================================

const CM_TAREFAS_STATUS_CICLO = ['pendente', 'andamento', 'concluido', 'cancelado'];
function _cmProximoStatusTarefa(status) {
  const idx = CM_TAREFAS_STATUS_CICLO.indexOf(status);
  return CM_TAREFAS_STATUS_CICLO[(idx + 1) % CM_TAREFAS_STATUS_CICLO.length];
}

const CM_TAREFAS_PESSOAS = ['Marcos', 'Ester'];
const CM_TAREFAS_MAX_FATIAS = 20;
const CM_TAREFAS_FATIAS_POR_LINHA = 10;
const CM_TAREFAS_URGENCIA_MS = 2 * 60 * 60 * 1000; // 2h antes do prazo já fica "vermelho"
const CM_TAREFAS_EDITOR_STORAGE_KEY = 'cmTarefasEditorAtual';
const CM_TAREFAS_META_VISIVEL_STORAGE_KEY = 'cmTarefasMetaVisivel';
const CM_TAREFAS_TAGS = [
  'Renovação', 'Contratação', 'Criação de cronograma', 'Reagendamento e reposição',
  'Alocar professor', 'Estratégico', 'Marketing', 'Pesquisa e desenvolvimento'
];
const CM_TAREFAS_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CM_TAREFAS_DIAS_SEMANA_COMPLETO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

let cmTarefasCacheDia = {};    // dia (1-31) -> { listaId, dataBR, itens: [nivel1...] }
let cmTarefasIntervaloCores = null;

// ---- Editor atual ("Editando como") ----
function _cmEditorPadraoPorConta() {
  const email = ((window.currentUser && window.currentUser.email) || '').toLowerCase();
  if (email.indexOf('marcos.lucas.ti') !== -1) return 'Marcos';
  if (email.indexOf('mastereducacaoadm') !== -1) return 'Ester';
  return 'Marcos';
}

function _cmEditorAtual() {
  try {
    const salvo = localStorage.getItem(CM_TAREFAS_EDITOR_STORAGE_KEY);
    if (salvo) return salvo;
  } catch (e) { /* localStorage indisponível */ }
  return _cmEditorPadraoPorConta();
}

function _cmSalvarEditorAtual(nome) {
  try { localStorage.setItem(CM_TAREFAS_EDITOR_STORAGE_KEY, nome); } catch (e) { /* localStorage indisponível */ }
}

// ---- Preferência de exibição do "Editado em ..." (ícone de olho) ----
function _cmMetaVisivelPadrao() {
  try {
    const salvo = localStorage.getItem(CM_TAREFAS_META_VISIVEL_STORAGE_KEY);
    if (salvo !== null) return salvo === '1';
  } catch (e) { /* localStorage indisponível */ }
  return false; // ao iniciar o modal, sem preferência salva ainda, o "Editado em..." começa oculto
}

function _cmSalvarMetaVisivel(visivel) {
  try { localStorage.setItem(CM_TAREFAS_META_VISIVEL_STORAGE_KEY, visivel ? '1' : '0'); } catch (e) { /* localStorage indisponível */ }
}

// ---- Conversões de data ----
function _cmDataISOparaBR(iso) {
  if (!iso) return '';
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Soma (ou subtrai, com dias negativo) dias a uma data "dd/mm/yyyy", devolvendo "dd/mm/yyyy"
function _cmAdicionarDias(dataBR, dias) {
  const d = _parseDataAula(dataBR);
  if (!d) return '';
  d.setDate(d.getDate() + dias);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Gera o miolo (dias) de um mini-calendário — reaproveitado pelo popover "copiar
// para um dia específico" de cada tarefa. Marca feriados como o seletor de data
// principal; não marca "selecionado" (aqui é só um destino de cópia, não um valor).
function _cmGerarDiasCalendarioHtml(mes, ano) {
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let html = '';
  for (let i = 0; i < primeiroDia; i++) html += '<div class="calendar-day-empty"></div>';
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const classes = ['calendar-day', 'cm-data-picker-day'];
    let title = '';
    if (typeof Feriados !== 'undefined' && Feriados.doDia) {
      const feriadosDoDia = Feriados.doDia(dia, mes, ano);
      if (feriadosDoDia.length > 0) { classes.push('calendar-day-feriado'); title = feriadosDoDia.map(f => f.nome).join(', '); }
    }
    if (new Date(ano, mes, dia).getTime() === hoje.getTime()) classes.push('cm-data-picker-day-hoje');
    html += `<button type="button" class="${classes.join(' ')}" data-dia="${dia}" title="${escapeHtml(title)}">${dia}</button>`;
  }
  return html;
}

function _cmFormatarMeta(item) {
  const valor = item.ultimaEdicao;
  let d = null;
  if (valor instanceof Date) d = valor;
  else if (valor && typeof valor.toDate === 'function') d = valor.toDate();
  if (!d) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const autor = item.ultimaEdicaoPor ? ` por ${item.ultimaEdicaoPor}` : '';
  return `Editado em ${dia}/${mes}/${ano} às ${hh}:${mm}${autor}`;
}

// Verdadeiro quando falta <= 2h pro prazo ou o prazo já passou (e o item ainda está
// ativo — pendente ou em andamento; concluído/cancelado nunca fica urgente)
function _cmEhUrgente(item, dataBR) {
  if (!item || item.status === 'concluido' || item.status === 'cancelado' || !item.prazo || !dataBR) return false;
  const m = String(dataBR).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return false;
  const partesHora = String(item.prazo).match(/(\d{1,2}):(\d{2})/);
  if (!partesHora) return false;
  const prazoDate = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(partesHora[1]), Number(partesHora[2]));
  return Date.now() >= (prazoDate.getTime() - CM_TAREFAS_URGENCIA_MS);
}

// ============================================================
// SELETOR DE HORA — mostrador circular (estilo relógio), modal próprio.
// Recebe o valor atual em "HH:MM" (24h, pode ser '') e um callback que é
// chamado com o novo valor em "HH:MM" só quando o usuário confirma no "OK".
// ============================================================

function _cm24para12(hhmm) {
  const agora = new Date();
  if (!hhmm) {
    const h = agora.getHours();
    let hora12 = h % 12;
    if (hora12 === 0) hora12 = 12;
    return { hora12, minuto: agora.getMinutes(), periodo: h >= 12 ? 'PM' : 'AM' };
  }
  const [h, m] = hhmm.split(':').map(Number);
  const periodo = h >= 12 ? 'PM' : 'AM';
  let hora12 = h % 12;
  if (hora12 === 0) hora12 = 12;
  return { hora12, minuto: m, periodo };
}

function _cm12para24(hora12, minuto, periodo) {
  let h = hora12 % 12;
  if (periodo === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

function _cmAbrirSeletorHora(valorAtual, onConfirmar) {
  let { hora12, minuto, periodo } = _cm24para12(valorAtual);
  let modoAtual = 'hora'; // 'hora' | 'minuto'
  let arrastando = false;

  const RAIO = 88;
  const CENTRO = 110;
  const posicaoNaRoda = (indice) => {
    const angulo = indice * 30 - 90;
    const rad = angulo * Math.PI / 180;
    return { x: CENTRO + RAIO * Math.cos(rad), y: CENTRO + RAIO * Math.sin(rad) };
  };

  const modalHtml = `
    <div class="modal-overlay cm-hora-overlay" id="cmHoraModal">
      <div class="cm-hora-container">
        <div class="cm-hora-header">
          <span>Selecionar horário</span>
          <button type="button" class="cm-hora-fechar" id="cmHoraBtnX"><i class="fas fa-times"></i></button>
        </div>
        <div class="cm-hora-corpo">
          <div class="cm-hora-lado-esquerdo">
            <div class="cm-hora-digital">
              <button type="button" class="cm-hora-digito" data-campo="hora" id="cmHoraDigitoHH"></button>
              <span class="cm-hora-dois-pontos">:</span>
              <button type="button" class="cm-hora-digito" data-campo="minuto" id="cmHoraDigitoMM"></button>
            </div>
            <div class="cm-hora-ampm" id="cmHoraAmPm">
              <span class="cm-hora-ampm-slider" id="cmHoraAmPmSlider"></span>
              <button type="button" class="cm-hora-ampm-btn" data-periodo="AM"><i class="fas fa-cloud-sun"></i> Manhã</button>
              <button type="button" class="cm-hora-ampm-btn" data-periodo="PM"><i class="fas fa-sun"></i> Tarde</button>
            </div>
          </div>
          <div class="cm-hora-lado-direito">
            <div class="cm-hora-relogio" id="cmHoraRelogio">
              <div class="cm-hora-ponteiro" id="cmHoraPonteiro"></div>
              <div class="cm-hora-centro"></div>
              <div class="cm-hora-numeros" id="cmHoraNumeros"></div>
            </div>
          </div>
        </div>
        <div class="cm-hora-footer">
          <button type="button" class="btn-secondary btn-compact cm-hora-btn-limpar" id="cmHoraBtnLimpar"><i class="fas fa-eraser mr-2"></i>Limpar</button>
          <button type="button" class="btn-secondary btn-compact" id="cmHoraBtnCancelar">Cancelar</button>
          <button type="button" class="btn-primary btn-compact" id="cmHoraBtnOk">OK</button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);

  const modal = container.querySelector('#cmHoraModal');
  const digitoHH = modal.querySelector('#cmHoraDigitoHH');
  const digitoMM = modal.querySelector('#cmHoraDigitoMM');
  const ampmWrap = modal.querySelector('#cmHoraAmPm');
  const ampmSlider = modal.querySelector('#cmHoraAmPmSlider');
  const relogioEl = modal.querySelector('#cmHoraRelogio');
  const numerosEl = modal.querySelector('#cmHoraNumeros');
  const ponteiroEl = modal.querySelector('#cmHoraPonteiro');

  const fechar = () => container.remove();
  modal.querySelector('#cmHoraBtnX').addEventListener('click', fechar);
  modal.querySelector('#cmHoraBtnCancelar').addEventListener('click', fechar);
  // Só fecha pelo fundo se o clique começou no fundo (arrastar o ponteiro do
  // relógio e soltar fora gerava um "click" no fundo e descartava a escolha)
  let pressionouNoFundo = false;
  modal.addEventListener('pointerdown', (e) => { pressionouNoFundo = e.target === modal; });
  modal.addEventListener('click', (e) => { if (e.target === modal && pressionouNoFundo) fechar(); });
  modal.querySelector('#cmHoraBtnOk').addEventListener('click', () => {
    const valor = _cm12para24(hora12, minuto, periodo);
    fechar();
    onConfirmar(valor);
  });
  modal.querySelector('#cmHoraBtnLimpar').addEventListener('click', () => {
    fechar();
    onConfirmar('');
  });

  const atualizarDigital = () => {
    // Mostra a hora em 24h (13, 14...23) quando o período é PM — igual ao rótulo
    // que o próprio número já exibe na roda do relógio — em vez do valor cru de
    // 12h (hora12), que fazia o mostrador digital exibir "01" pra 1PM/13h.
    let h24 = hora12 % 12;
    if (periodo === 'PM') h24 += 12;
    digitoHH.textContent = String(h24).padStart(2, '0');
    digitoMM.textContent = String(minuto).padStart(2, '0');
    digitoHH.classList.toggle('ativo', modoAtual === 'hora');
    digitoMM.classList.toggle('ativo', modoAtual === 'minuto');
  };

  const atualizarAmPm = () => {
    ampmWrap.querySelectorAll('.cm-hora-ampm-btn').forEach(btn => btn.classList.toggle('ativo', btn.dataset.periodo === periodo));
    ampmSlider.style.transform = periodo === 'AM' ? 'translateX(0)' : 'translateX(100%)';
  };

  // Números do mostrador de hora: em AM mostra 12,1,2...11; em PM mostra 12,13,14...23
  // (só a posição do "12" fica igual nos dois períodos). Os "tick" de minuto (todo
  // valor que não é múltiplo de 5) continuam calculáveis via ângulo — só não são
  // desenhados na tela — por isso o arraste continua funcionando em qualquer posição.
  const renderNumeros = () => {
    let html = '';
    if (modoAtual === 'hora') {
      for (let i = 0; i < 12; i++) {
        const valor = i === 0 ? 12 : i;
        // A posição das 12h mostra "00" de manhã (12AM = 00:00) e "12" à tarde
        // (12PM = 12:00) — o valor selecionável (hora12) continua sendo 12 nos dois casos.
        const rotulo = i === 0 ? (periodo === 'AM' ? '00' : '12') : (periodo === 'PM' ? valor + 12 : valor);
        const { x, y } = posicaoNaRoda(i);
        html += `<button type="button" class="cm-hora-num${valor === hora12 ? ' ativo' : ''}" style="left:${x}px;top:${y}px" data-valor="${valor}">${rotulo}</button>`;
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const valorMin = i * 5;
        const { x, y } = posicaoNaRoda(i);
        html += `<button type="button" class="cm-hora-num cm-hora-num-minuto${valorMin === minuto ? ' ativo' : ''}" style="left:${x}px;top:${y}px" data-valor="${valorMin}">${String(valorMin).padStart(2, '0')}</button>`;
      }
    }
    numerosEl.innerHTML = html;
  };

  // Reinicia a animação de fade/escala dos números (troca de modo ou de período)
  const renderNumerosAnimado = () => {
    renderNumeros();
    numerosEl.classList.remove('cm-hora-anim');
    void numerosEl.offsetWidth; // força reflow pra poder reiniciar a animação
    numerosEl.classList.add('cm-hora-anim');
  };

  const atualizarPonteiro = () => {
    const deg = modoAtual === 'hora' ? (hora12 % 12) * 30 : minuto * 6;
    ponteiroEl.style.transform = `translate(-50%, -100%) rotate(${deg}deg)`;
    ponteiroEl.classList.toggle('cm-hora-ponteiro-minuto', modoAtual === 'minuto');
  };

  const renderTudo = (animarNumeros) => {
    if (animarNumeros) renderNumerosAnimado(); else renderNumeros();
    atualizarPonteiro();
    atualizarDigital();
    atualizarAmPm();
  };

  renderTudo(false);

  digitoHH.addEventListener('click', () => { modoAtual = 'hora'; renderTudo(true); });
  digitoMM.addEventListener('click', () => { modoAtual = 'minuto'; renderTudo(true); });

  ampmWrap.querySelectorAll('.cm-hora-ampm-btn').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.periodo === periodo) return;
    periodo = btn.dataset.periodo;
    renderTudo(modoAtual === 'hora'); // só os números de hora mudam de rótulo com o período
  }));

  const calcularAngulo = (clientX, clientY) => {
    const rect = relogioEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  };

  const aplicarAngulo = (deg, finalizando) => {
    if (modoAtual === 'hora') {
      let idx = Math.round(deg / 30) % 12;
      hora12 = idx === 0 ? 12 : idx;
      if (finalizando) {
        modoAtual = 'minuto';
        renderTudo(true); // avança pra minutos com animação
      } else {
        renderTudo(false); // atualização ao vivo durante o arraste, sem animação
      }
    } else {
      minuto = Math.round(deg / 6) % 60;
      renderTudo(false);
    }
  };

  relogioEl.addEventListener('pointerdown', (e) => {
    arrastando = true;
    try { relogioEl.setPointerCapture(e.pointerId); } catch (err) { /* alguns navegadores não exigem */ }
    aplicarAngulo(calcularAngulo(e.clientX, e.clientY), false);
  });
  relogioEl.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    aplicarAngulo(calcularAngulo(e.clientX, e.clientY), false);
  });
  const finalizarArraste = (e) => {
    if (!arrastando) return;
    arrastando = false;
    aplicarAngulo(calcularAngulo(e.clientX, e.clientY), true);
  };
  relogioEl.addEventListener('pointerup', finalizarArraste);
  relogioEl.addEventListener('pointercancel', () => { arrastando = false; });
}

// ============================================================
// MENÇÃO A CLIENTES (@) — autocomplete de clientes ativos nos campos de
// texto da tarefa e de comentário. O texto salvo no Firestore continua sendo
// uma string simples; a menção vira um token embutido "@[Nome](clienteId)"
// nela, convertido pra um <span> não-editável (chip) só na hora de exibir, e
// reconvertido de volta pro token ao salvar. Os campos em si viram <div
// contenteditable> (uma textarea não pode conter um elemento embutido).
// ============================================================

const CM_MENCAO_REGEX = /@\[([^\]\n]+)\]\(([^)\n]+)\)/g;
const CM_MENCAO_MAX_SUGESTOES = 8;

let cmClientesAtivosCache = null;
let cmClientesAtivosCacheTimestamp = 0;
const CM_CLIENTES_ATIVOS_TTL = 5 * 60 * 1000;

function _cmNormalizarStatusCliente(raw) {
  const map = {
    'cliente ativo': 'Ativo', 'ativo': 'Ativo',
    'cliente potencial': 'Potencial', 'potencial': 'Potencial',
    'cliente inativo': 'Inativo', 'inativo': 'Inativo'
  };
  return map[String(raw || '').toLowerCase().trim()] || raw || '';
}

// Sem acento e minúsculo, pra comparar nomes ignorando acentuação/caixa
function _cmNormalizarBusca(s) {
  // Remove os diacríticos (marcas de acento, U+0300-U+036F) que sobram depois do
  // normalize('NFD') separar "á" em "a" + acento — comparado por código numérico
  // em vez de um intervalo unicode literal na regex, pra não depender de como o
  // editor/arquivo grava esses caracteres de combinação.
  const semAcento = String(s || '').normalize('NFD').split('').filter(ch => {
    const code = ch.charCodeAt(0);
    return code < 0x0300 || code > 0x036f;
  }).join('');
  return semAcento.toLowerCase();
}

async function _cmBuscarClientesAtivos() {
  const agora = Date.now();
  if (cmClientesAtivosCache && (agora - cmClientesAtivosCacheTimestamp) < CM_CLIENTES_ATIVOS_TTL) {
    return cmClientesAtivosCache;
  }
  try {
    const clientes = await BANCO.fetchCadastroClientes();
    cmClientesAtivosCache = clientes.filter(c => _cmNormalizarStatusCliente(c.status) === 'Ativo');
    cmClientesAtivosCacheTimestamp = agora;
  } catch (error) {
    console.error('❌ Erro ao carregar clientes ativos para menção:', error);
    cmClientesAtivosCache = cmClientesAtivosCache || [];
  }
  return cmClientesAtivosCache;
}

let cmProfessoresAtivosCache = null;
let cmProfessoresAtivosCacheTimestamp = 0;
const CM_PROFESSORES_ATIVOS_TTL = 5 * 60 * 1000;

// Mesmo critério do Match e do "Enviar proposta": sem status definido conta
// como ativo; Desligado, Suspenso, Inativo, Férias etc. ficam de fora.
function _cmProfessorEstaAtivo(p) {
  return _cmNormalizarBusca(p.status || 'Ativo') === 'ativo';
}

async function _cmBuscarProfessoresAtivos() {
  const agora = Date.now();
  if (cmProfessoresAtivosCache && (agora - cmProfessoresAtivosCacheTimestamp) < CM_PROFESSORES_ATIVOS_TTL) {
    return cmProfessoresAtivosCache;
  }
  try {
    const professores = await BANCO.fetchDataBaseProfessores();
    cmProfessoresAtivosCache = professores.filter(_cmProfessorEstaAtivo);
    cmProfessoresAtivosCacheTimestamp = agora;
  } catch (error) {
    console.error('❌ Erro ao carregar professores ativos para menção:', error);
    cmProfessoresAtivosCache = cmProfessoresAtivosCache || [];
  }
  return cmProfessoresAtivosCache;
}

// Lista unificada pra sugestão do "@" — clientes ativos + professores ativos,
// cada um marcado com "tipo" pra saber qual chip/modal usar depois.
async function _cmBuscarEntidadesMencionaveis() {
  const [clientes, professores] = await Promise.all([_cmBuscarClientesAtivos(), _cmBuscarProfessoresAtivos()]);
  return [
    ...clientes.map(c => ({ tipo: 'cliente', id: c.id, nome: c.nome, apelido: c.apelido })),
    ...professores.map(p => ({ tipo: 'professor', id: p.id, nome: p.nome, apelido: p.apelido }))
  ];
}

// "Qualquer palavra do nome COMPLETO ou do APELIDO começa com o texto digitado"
// — ex.: "sil" acha "Maria Silva" (nome) e também quem tem apelido "Silvinha"
// (funciona tanto pra clientes quanto professores — a lista já vem misturada)
function _cmFiltrarMencoesPorNome(entidades, query) {
  const ordenados = [...entidades].sort((a, b) =>
    String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' })
  );
  const termo = _cmNormalizarBusca(query);
  if (!termo) return ordenados.slice(0, CM_MENCAO_MAX_SUGESTOES);
  const bateNaPalavra = (texto) => _cmNormalizarBusca(texto).split(/\s+/).some(palavra => palavra.startsWith(termo));
  return ordenados
    .filter(c => bateNaPalavra(c.nome) || (c.apelido && bateNaPalavra(c.apelido)))
    .slice(0, CM_MENCAO_MAX_SUGESTOES);
}

// Prefixo gravado dentro do "(id)" do token só pra menções de professor — sem
// prefixo continua sendo cliente (formato antigo, já salvo, continua funcionando)
const CM_MENCAO_PREFIXO_PROFESSOR = 'professor:';

// String salva -> HTML pra exibir (token "@[Nome](id)" ou "@[Nome](professor:id)" vira chip não-editável)
function _cmRenderConteudoComMencoes(texto) {
  const str = String(texto || '');
  let html = '';
  let ultimoIndex = 0;
  CM_MENCAO_REGEX.lastIndex = 0;
  let m;
  while ((m = CM_MENCAO_REGEX.exec(str))) {
    html += escapeHtml(str.slice(ultimoIndex, m.index));
    const nome = m[1];
    const idBruto = m[2];
    const ehProfessor = idBruto.startsWith(CM_MENCAO_PREFIXO_PROFESSOR);
    const id = ehProfessor ? idBruto.slice(CM_MENCAO_PREFIXO_PROFESSOR.length) : idBruto;
    const classeTipo = ehProfessor ? ' cm-mention-chip-professor' : '';
    html += `<span class="cm-mention-chip${classeTipo}" contenteditable="false" data-cliente-id="${escapeHtml(id)}" data-mencao-tipo="${ehProfessor ? 'professor' : 'cliente'}" data-nome-cliente="${escapeHtml(nome)}">@${escapeHtml(nome)}</span>`;
    ultimoIndex = CM_MENCAO_REGEX.lastIndex;
  }
  html += escapeHtml(str.slice(ultimoIndex));
  return html;
}

// String salva -> texto plano (pra tooltip/confirm/toast — nunca deve exibir o token cru)
function _cmTextoPlano(texto) {
  CM_MENCAO_REGEX.lastIndex = 0;
  return String(texto || '').replace(CM_MENCAO_REGEX, (_, nome) => `@${nome}`);
}

// Reconstrói o "(id)" do token a partir do chip, incluindo o prefixo de professor
function _cmIdComTipoDoChip(node) {
  const id = node.dataset.clienteId || '';
  return node.dataset.mencaoTipo === 'professor' ? `${CM_MENCAO_PREFIXO_PROFESSOR}${id}` : id;
}

// DOM do campo editável -> string pra salvar (chip vira token "@[Nome](id)" de novo)
function _cmSerializarConteudoEditavel(el) {
  let out = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList && node.classList.contains('cm-mention-chip')) {
        out += `@[${node.dataset.nomeCliente || ''}](${_cmIdComTipoDoChip(node)})`;
      } else if (node.tagName === 'BR') {
        out += '\n';
      } else {
        out += node.textContent;
      }
    }
  });
  return out;
}

// Tamanho (em "caracteres salvos") que um nó ocupa na string serializada — usado
// pra converter offset de cursor entre DOM e string nos dois sentidos.
function _cmTamanhoSerializado(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.length;
  if (node.classList && node.classList.contains('cm-mention-chip')) {
    return `@[${node.dataset.nomeCliente || ''}](${_cmIdComTipoDoChip(node)})`.length;
  }
  if (node.tagName === 'BR') return 1;
  return node.textContent.length;
}

// Posição do cursor contada na "string salva" (não em nós do DOM) — pra poder
// recolocar o cursor no lugar certo depois de o campo ser reconstruído do zero
// (ex.: quando o render() do resto da lista dispara enquanto o usuário ainda
// está digitando neste campo — ver comentário grande perto da função render()).
function _cmOffsetTextoAntesDoCursor(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  let offset = 0;
  for (const filho of Array.from(el.childNodes)) {
    if (filho === range.startContainer) {
      if (filho.nodeType === Node.TEXT_NODE) offset += range.startOffset;
      return offset;
    }
    offset += _cmTamanhoSerializado(filho);
  }
  return offset;
}

function _cmRestaurarCursorNoOffset(el, offsetAlvo) {
  let restante = offsetAlvo;
  const range = document.createRange();
  let posicionado = false;
  for (const filho of Array.from(el.childNodes)) {
    const tamanho = _cmTamanhoSerializado(filho);
    if (filho.nodeType === Node.TEXT_NODE && restante <= tamanho) {
      range.setStart(filho, restante);
      posicionado = true;
      break;
    }
    if (filho.nodeType !== Node.TEXT_NODE && restante <= tamanho) {
      range.setStartAfter(filho); // chip/BR não-editável: cursor logo depois
      posicionado = true;
      break;
    }
    restante -= tamanho;
  }
  if (posicionado) {
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function _cmFocarFimDoCampo(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Insere uma quebra de linha manual (Ctrl+Enter na tarefa, Enter no comentário)
// via <br> — não deixa o navegador decidir sozinho (contenteditable costuma criar
// <div>/<p> imprevisíveis, de um jeito diferente em cada navegador).
function _cmInserirQuebraLinha() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const br = document.createElement('br');
  range.insertNode(br);
  range.setStartAfter(br);
  range.setEndAfter(br);
  sel.removeAllRanges();
  sel.addRange(range);
}

// A partir do cursor atual dentro de "el", acha um "@consulta" em digitação (sem
// espaço entre o @ e o cursor) — só olha o nó de texto onde o cursor está, que é
// sempre onde a digitação ao vivo acontece.
function _cmDetectarConsultaMencao(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return null;
  const antes = node.textContent.slice(0, range.startOffset);
  const m = antes.match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { node, offsetArroba: range.startOffset - m[1].length - 1, query: m[1] };
}

// Clique no chip de menção (@) — acha a contratação mais recente do cliente
// (BancoDeAulas, cruzado por CPF, já vem ordenado por timestamp desc) e abre o
// modal "Detalhes da contratação" padrão do sistema (o mesmo do Painel Central/
// Banco de Aulas, sem nenhuma alteração visual).
async function _cmAbrirContratacaoDoCliente(clienteId) {
  if (!clienteId) return;
  try {
    let cliente = (cmClientesAtivosCache || []).find(c => c.id === clienteId);
    if (!cliente) {
      const todos = await BANCO.fetchCadastroClientes();
      cliente = todos.find(c => c.id === clienteId);
    }
    if (!cliente || !cliente.cpf) {
      showToast('Cliente sem CPF cadastrado — não foi possível localizar a contratação', 'error');
      return;
    }
    const aulas = await BANCO.fetchBancoDeAulas();
    const contratacao = aulas.find(a => a.cpf === cliente.cpf);
    if (!contratacao) {
      showToast('Nenhuma contratação encontrada para este cliente', 'error');
      return;
    }
    if (typeof abrirDetalhesContratacaoPainelCentral === 'function') {
      abrirDetalhesContratacaoPainelCentral(contratacao.id);
    } else {
      showToast('Módulo de contratações não carregado', 'error');
    }
  } catch (error) {
    console.error('❌ Erro ao abrir contratação do cliente mencionado:', error);
    showToast('❌ Erro ao abrir contratação do cliente', 'error');
  }
}

// Clique no chip de menção (@) a um PROFESSOR — abre o modal "Detalhes do
// professor", o mesmo de "BD professores" (GaleriaProfessores.abrirDetalhes).
// Esse modal vive dentro de #galeria-professores (display:none quando a aba não
// está ativa), então precisa do mesmo truque de reparentar pro body usado pro
// modal de contratação/cliente em outras áreas do sistema.
async function _cmAbrirDetalhesProfessor(professorId) {
  if (!professorId) return;
  try {
    if (typeof GaleriaProfessores === 'undefined' || typeof GaleriaProfessores.abrirDetalhes !== 'function') {
      showToast('Módulo de professores não carregado', 'error');
      return;
    }
    let professor = (cmProfessoresAtivosCache || []).find(p => p.id === professorId);
    if (!professor) {
      const todos = await BANCO.fetchDataBaseProfessores();
      professor = todos.find(p => p.id === professorId);
    }
    if (!professor) {
      showToast('Professor não encontrado', 'error');
      return;
    }
    if (!document.getElementById('gp-detOverlay') && typeof GaleriaProfessores.init === 'function') {
      await GaleriaProfessores.init();
    }
    const overlay = document.getElementById('gp-detOverlay');
    if (overlay && overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }
    GaleriaProfessores.abrirDetalhes(professor);
  } catch (error) {
    console.error('❌ Erro ao abrir detalhes do professor mencionado:', error);
    showToast('❌ Erro ao abrir detalhes do professor', 'error');
  }
}

// ============================================================
// GRID DO CALENDÁRIO — barra de progresso acima do quadrado do dia
// ============================================================

// Cada carregamento ganha um número: trocar de mês rápido dispara vários em
// paralelo, e só o mais recente pode gravar no cache (que é indexado só pelo dia
// — uma resposta atrasada de outubro pintaria as barras de novembro).
let cmTarefasGeracaoCache = 0;

async function carregarCacheDoMes(mes, ano) {
  const geracao = ++cmTarefasGeracaoCache;
  let listas = [];
  try {
    listas = await BANCO.fetchListasTarefasDoMes(mes, ano);
  } catch (error) {
    console.error('❌ Erro ao carregar listas de tarefas do mês:', error);
    if (geracao === cmTarefasGeracaoCache) cmTarefasCacheDia = {};
    return;
  }

  const novoCache = {};
  await Promise.all(listas.map(async (lista) => {
    let itens = [];
    try {
      itens = await BANCO.fetchItensTarefa(lista.id);
    } catch (error) {
      console.error('❌ Erro ao carregar itens da lista de tarefas:', error);
    }
    const d = _parseDataAula(lista.data);
    if (!d) return;
    // Duas listas no mesmo dia (duplicata antiga) somam as tarefas em vez de uma
    // esconder a outra; o modal junta as duas de vez ao abrir esse dia.
    const atual = novoCache[d.getDate()];
    novoCache[d.getDate()] = {
      listaId: atual ? atual.listaId : lista.id,
      dataBR: lista.data,
      itens: (atual ? atual.itens : []).concat(itens.filter(i => i.nivel === 1))
    };
  }));

  if (geracao !== cmTarefasGeracaoCache) return;
  Object.values(novoCache).forEach(info => {
    info.itens = info.itens.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).slice(0, CM_TAREFAS_MAX_FATIAS);
  });
  cmTarefasCacheDia = novoCache;
  iniciarAtualizacaoCores();
}

// Lista de uma data, já sem duplicatas: se houver mais de uma (bug antigo),
// junta todas na mais antiga antes de devolver. null = o dia não tem lista.
async function _cmResolverListaDoDia(dataBR) {
  const listas = await BANCO.fetchListasTarefasPorData(dataBR);
  if (!listas.length) return null;
  if (listas.length === 1) return listas[0];
  const ms = (l) => (l.timestamp && typeof l.timestamp.toMillis === 'function') ? l.timestamp.toMillis() : 0;
  listas.sort((a, b) => ms(a) - ms(b));
  const [principal, ...outras] = listas;
  await BANCO.mesclarListasTarefas(principal.id, outras.map(l => l.id));
  console.log(`🔀 ${outras.length} lista(s) de tarefas duplicada(s) de ${dataBR} juntada(s) em ${principal.id}`);
  return principal;
}

// Criação da lista de um dia passa por aqui: uma só por data, mesmo com várias
// chamadas ao mesmo tempo (tarefas salvando juntas, "copiar" com clique duplo).
const cmCriandoListaPorData = {};
function _cmGarantirListaDaData(dataBR) {
  if (!cmCriandoListaPorData[dataBR]) {
    cmCriandoListaPorData[dataBR] = (async () => {
      const existente = await _cmResolverListaDoDia(dataBR);
      return existente ? existente.id : await BANCO.addListaTarefas(dataBR);
    })().finally(() => { delete cmCriandoListaPorData[dataBR]; });
  }
  return cmCriandoListaPorData[dataBR];
}

// Classe de cor da fatia da barra de progresso: concluído(verde) > cancelado(vermelho)
// > vencido/urgente(vermelho, tem prioridade sobre "em andamento") > andamento(amarelo) > pendente(cinza)
function _cmClasseFatia(item, dataBR) {
  if (item.status === 'concluido') return 'cm-fatia-concluida';
  if (item.status === 'cancelado') return 'cm-fatia-cancelada';
  if (_cmEhUrgente(item, dataBR)) return 'cm-fatia-urgente';
  if (item.status === 'andamento') return 'cm-fatia-andamento';
  return '';
}

function renderizarBarraDia(dia) {
  const info = cmTarefasCacheDia[dia];
  if (!info || !info.itens.length) return '<div class="cm-barra-slot"></div>';

  const linhas = [];
  for (let i = 0; i < info.itens.length; i += CM_TAREFAS_FATIAS_POR_LINHA) {
    linhas.push(info.itens.slice(i, i + CM_TAREFAS_FATIAS_POR_LINHA));
  }

  const linhasHtml = linhas.map(linha => `
    <div class="cm-barra-linha">
      ${linha.map(item => {
        const classe = _cmClasseFatia(item, info.dataBR);
        return `<span class="cm-fatia ${classe}" data-item-id="${item.id}" data-dia="${dia}" title="${escapeHtml(_cmTextoPlano(item.texto))}"></span>`;
      }).join('')}
    </div>
  `).join('');

  return `<div class="cm-barra-slot cm-barra-clicavel" onclick="CalMasterTarefas.abrirListaTarefas('${info.listaId}')">${linhasHtml}</div>`;
}

function iniciarAtualizacaoCores() {
  if (cmTarefasIntervaloCores) return;
  cmTarefasIntervaloCores = setInterval(() => {
    document.querySelectorAll('#calMaster-grid .cm-fatia').forEach(el => {
      const dia = Number(el.dataset.dia);
      const info = cmTarefasCacheDia[dia];
      if (!info) return;
      const item = info.itens.find(i => i.id === el.dataset.itemId);
      if (!item) return;
      const ehUrgente = _cmEhUrgente(item, info.dataBR);
      el.classList.toggle('cm-fatia-urgente', ehUrgente);
      el.classList.toggle('cm-fatia-andamento', item.status === 'andamento' && !ehUrgente);
    });
  }, 60000);
}

// ============================================================
// MODAL "Criar tarefas" / edição de uma lista existente
// ============================================================

function abrirModalCriarTarefas() {
  abrirListaTarefas(null);
}

// Só um modal de tarefas por vez — clique duplo na barra do dia ou em "Criar
// tarefas" abria dois modais empilhados, com ids repetidos.
let cmTarefasModalAberto = false;

async function abrirListaTarefas(listaIdExistente, dataPresetBR) {
  if (cmTarefasModalAberto) return;
  cmTarefasModalAberto = true;

  // O modal fica aberto ao trocar de dia. "dia" é o contexto do dia exibido e é
  // substituído inteiro a cada troca; cada item guarda o contexto em que nasceu
  // (item._dia), então um salvamento que termina depois da troca grava na lista
  // certa e não mexe na tela do dia novo.
  const novoContextoDia = (dataBR, listaId, itensDoDia) => ({ dataBR, listaId, itens: itensDoDia || [], fila: Promise.resolve(), erroCarregamento: false });
  let dia = novoContextoDia(dataPresetBR || '', null, []);
  let geracaoDia = 0;              // cresce a cada troca de dia; respostas atrasadas são descartadas
  let dataSolicitada = dia.dataBR; // destino da última navegação (setas clicadas rápido somam dias)
  let carregando = false;
  let fechando = false;
  let intervaloUrgencia = null;

  let editorAtual = _cmEditorAtual();
  const filtroPessoas = new Set();       // vazio = mostra todo mundo
  const filtroTags = new Set();          // vazio = mostra todas as tags
  // ids com subárvore recolhida (por dia) — ao abrir um dia, todo item que tem
  // filhos já começa recolhido
  const recolhidos = new Set();
  const comentariosAbertos = new Set();  // ids com o campo de comentário expandido
  let tagPopoverAbertoId = null;         // id do item com o popover de tags aberto (só 1 por vez)
  let funcoesAbertoId = null;            // id do item com a barra de ícones (tag/hora/comentário/etc.) aberta (só 1 por vez)
  let copiarPopoverAbertoId = null;      // id do item nível 1 com o popover "copiar para um dia" aberto (só 1 por vez)
  let copiarMes = 0;                     // mês/ano exibidos nesse popover (resetado toda vez que é aberto)
  let copiarAno = 0;
  let dataPickerMes = 0;
  let dataPickerAno = 0;
  // Consulta "@..." em digitação num campo de texto/comentário — null quando o
  // popover de sugestão de clientes não está aberto
  let mencaoState = null;

  const reduzirMovimento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const telaDeToque = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  const modalHtml = `
    <div class="modal-overlay cm-tarefas-overlay" id="modalTarefasCalendario">
      <div class="modal-container cm-tarefas-modal">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-list-check text-pink-500 mr-2"></i>
            Tarefas
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="cm-dia-navegador" id="cmDiaNavegador">
            <button type="button" id="cmDiaBtnAnterior" class="cm-dia-navegador-btn" title="Dia anterior"><i class="fas fa-chevron-left"></i></button>
            <div class="cm-dia-navegador-label" id="cmDiaNavegadorLabel">Selecione uma data</div>
            <button type="button" id="cmDiaBtnProximo" class="cm-dia-navegador-btn" title="Próximo dia"><i class="fas fa-chevron-right"></i></button>
          </div>
          <div class="cm-tarefas-carregando" id="cmTarefasCarregando" aria-hidden="true"><span></span></div>
          <div class="cm-toolbar">
            <div class="cm-data-picker-wrap" id="cmDataPickerWrap">
              <button type="button" id="cmTarefasDataBtn" class="cm-data-picker-btn">
                <i class="fas fa-calendar-alt"></i>
                <span id="cmTarefasDataLabel">Selecionar data</span>
              </button>
              <div class="cm-popover cm-data-picker-popover" id="cmTarefasDataPopover">
                <div class="calendar-container">
                  <div class="calendar-header flex items-center justify-between mb-2 px-1">
                    <button type="button" id="cmDataPrevMonth" class="p-1 hover:bg-gray-100 rounded-full"><i class="fas fa-chevron-left text-gray-600 text-xs"></i></button>
                    <div class="font-lexend font-bold text-sm text-gray-700" id="cmDataMonthYear"></div>
                    <button type="button" id="cmDataNextMonth" class="p-1 hover:bg-gray-100 rounded-full"><i class="fas fa-chevron-right text-gray-600 text-xs"></i></button>
                  </div>
                  <div class="calendar-weekdays grid grid-cols-7 gap-1 mb-1 text-center cm-data-picker-weekday">
                    <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                  </div>
                  <div id="cmDataDays" class="calendar-days grid grid-cols-7 gap-1"></div>
                </div>
              </div>
            </div>

            <div class="cm-toolbar-par">
              <div class="cm-toolbar-secao">
                <span class="cm-toolbar-secao-label">Responsável</span>
                <button type="button" class="cm-filtro-pessoa-btn" id="cmFiltroMarcos" data-pessoa="Marcos">
                  <i class="fas fa-user"></i> Marcos
                </button>
                <button type="button" class="cm-filtro-pessoa-btn" id="cmFiltroEster" data-pessoa="Ester">
                  <i class="fas fa-user"></i> Ester
                </button>
              </div>

              <div class="cm-toolbar-secao cm-toolbar-secao-tags">
                <div class="cm-buscar-tags-wrap" id="cmBuscarTagsWrap">
                  <button type="button" id="cmBtnBuscarTags" class="cm-toolbar-btn">
                    <i class="fas fa-search"></i> Buscar Tags<span id="cmBuscarTagsContador"></span>
                  </button>
                  <div class="cm-popover cm-tag-filtro-popover" id="cmBuscarTagsPopover">
                    <input type="text" id="cmBuscarTagsInput" class="cm-tag-filtro-busca" placeholder="Buscar tag...">
                    <div id="cmBuscarTagsLista" class="cm-tag-filtro-lista"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="cm-toolbar-secao">
              <span class="cm-toolbar-secao-label">Editando como</span>
              <button type="button" class="cm-editor-btn" data-pessoa="Marcos">Marcos</button>
              <button type="button" class="cm-editor-btn" data-pessoa="Ester">Ester</button>
            </div>

            <div class="cm-toolbar-secao cm-toolbar-secao-olho">
              <button type="button" id="cmTarefasBtnToggleMeta" class="cm-eye-btn" title="Mostrar/ocultar &quot;editado em&quot;">
                <i class="fas fa-eye"></i>
              </button>
            </div>

            <button type="button" id="cmTarefasBtnNova" class="btn-primary btn-compact" disabled>
              <i class="fas fa-plus mr-2"></i>
              Nova Tarefa
            </button>
          </div>
          <div id="cmTarefasLista" class="cm-tarefas-lista space-y-2"></div>
        </div>
        <div class="modal-footer">
          <button id="cmTarefasBtnExcluirLista" class="btn-secondary btn-compact text-red-600 hover:bg-red-50" style="display:none"><i class="fas fa-trash mr-2"></i>Excluir lista</button>
          <button id="cmTarefasBtnFechar" class="btn-secondary btn-compact">Fechar</button>
          <button id="cmTarefasBtnSalvarTudo" class="btn-primary btn-compact">
            <i class="fas fa-save mr-2"></i>
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);

  const modal = container.querySelector('#modalTarefasCalendario');
  const btnNova = modal.querySelector('#cmTarefasBtnNova');
  const listaEl = modal.querySelector('#cmTarefasLista');
  const btnFechar = modal.querySelector('#cmTarefasBtnFechar');
  const btnSalvarTudo = modal.querySelector('#cmTarefasBtnSalvarTudo');
  const btnExcluirLista = modal.querySelector('#cmTarefasBtnExcluirLista');
  const btnFiltroMarcos = modal.querySelector('#cmFiltroMarcos');
  const btnFiltroEster = modal.querySelector('#cmFiltroEster');
  const botoesEditor = modal.querySelectorAll('.cm-editor-btn');
  const barraCarregando = modal.querySelector('#cmTarefasCarregando');

  // ---- Popover genérico: só um aberto por vez, fecha ao clicar fora ----
  let popoverAberto = null; // { wrap, fechar }
  const fecharPopoverAberto = () => {
    if (!popoverAberto) return;
    popoverAberto.fechar();
    popoverAberto = null;
  };
  const onClickForaDoPopover = (e) => {
    if (popoverAberto && !popoverAberto.wrap.contains(e.target)) fecharPopoverAberto();
  };
  document.addEventListener('click', onClickForaDoPopover, true);

  // Popover de sugestão de menção (@) — fica fora do listaEl (position:fixed
  // no body, seguindo o cursor), então precisa da própria remoção explícita.
  const fecharMencaoPopover = () => {
    if (!mencaoState) return;
    if (mencaoState.popoverEl) mencaoState.popoverEl.remove();
    if (popoverAberto && popoverAberto.wrap === mencaoState.popoverEl) popoverAberto = null;
    mencaoState = null;
  };

  // ---- Filas de gravação ----
  // Toda gravação de um item passa pela fila dele (item._fila), uma por vez: um
  // item novo era criado DUAS vezes quando um segundo salvamento (sair do campo,
  // Enter, autosave) começava antes do primeiro voltar do Firestore. Na fila, o
  // segundo espera e vira uma atualização. Criar/apagar a lista do dia usa a
  // fila do contexto do dia (dia.fila), pelo mesmo motivo.
  const filasEmAndamento = new Set();
  const rastrear = (p) => {
    filasEmAndamento.add(p);
    const remover = () => filasEmAndamento.delete(p);
    p.then(remover, remover);
    return p;
  };
  const enfileirarItem = (item, tarefa) => {
    item._fila = (item._fila || Promise.resolve()).catch(() => {}).then(tarefa);
    return rastrear(item._fila);
  };
  const enfileirarDia = (ctx, tarefa) => {
    ctx.fila = ctx.fila.catch(() => {}).then(tarefa);
    return rastrear(ctx.fila);
  };
  const aguardarFilas = async () => {
    while (filasEmAndamento.size) await Promise.allSettled(Array.from(filasEmAndamento));
  };

  // Lista do dia no Firestore — criada só quando a 1ª tarefa é salva, uma única
  // vez por data (_cmGarantirListaDaData também confere se já existe no servidor).
  const garantirLista = (ctx) => enfileirarDia(ctx, async () => {
    if (!ctx.listaId) ctx.listaId = await _cmGarantirListaDaData(ctx.dataBR);
    if (ctx === dia) atualizarLabelData();
    return ctx.listaId;
  });

  // ---- Fechar ----
  const closeModal = async () => {
    if (fechando) return;
    fechando = true;
    document.removeEventListener('click', onClickForaDoPopover, true);
    fecharMencaoPopover();
    if (intervaloUrgencia) clearInterval(intervaloUrgencia);
    modal.classList.add('cm-tarefas-saindo');
    // Antes o modal sumia sem esperar o autosave (700ms) — o grid redesenhava
    // com os dados antigos. Agora some na tela e só sai de vez depois de gravar.
    try {
      await flushPendentes();
      await aguardarFilas();
    } catch (error) {
      console.error('❌ Erro ao salvar tarefas ao fechar:', error);
    }
    container.remove();
    cmTarefasModalAberto = false;
    if (typeof renderGradeCalendarioMaster === 'function') renderGradeCalendarioMaster();
  };
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  btnFechar.addEventListener('click', closeModal);
  // Clique no fundo escuro só fecha se o toque/clique COMEÇOU no fundo: selecionar
  // texto arrastando até fora do quadro gerava um "click" no fundo e fechava o
  // modal. Em tela de toque o fundo não fecha (o teclado virtual reorganiza a
  // tela e o toque seguinte caía no fundo) — só o X e o "Fechar".
  let pressionouNoFundo = false;
  modal.addEventListener('pointerdown', (e) => { pressionouNoFundo = e.target === modal; });
  modal.addEventListener('click', (e) => {
    if (e.target !== modal || !pressionouNoFundo || telaDeToque) return;
    closeModal();
  });

  // ---- Editando como ----
  const atualizarBotoesEditor = () => {
    botoesEditor.forEach(btn => btn.classList.toggle('ativo', btn.dataset.pessoa === editorAtual));
  };
  atualizarBotoesEditor();
  botoesEditor.forEach(btn => btn.addEventListener('click', () => {
    editorAtual = btn.dataset.pessoa;
    _cmSalvarEditorAtual(editorAtual);
    atualizarBotoesEditor();
  }));

  // ---- Mostrar/ocultar "Editado em ..." (ícone de olho, preferência salva) ----
  const btnToggleMeta = modal.querySelector('#cmTarefasBtnToggleMeta');
  let metaVisivel = _cmMetaVisivelPadrao();
  const atualizarIconeMeta = () => {
    btnToggleMeta.innerHTML = metaVisivel ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    btnToggleMeta.classList.toggle('ativo', !metaVisivel);
    listaEl.classList.toggle('cm-ocultar-meta', !metaVisivel);
  };
  atualizarIconeMeta();
  btnToggleMeta.addEventListener('click', () => {
    metaVisivel = !metaVisivel;
    _cmSalvarMetaVisivel(metaVisivel);
    atualizarIconeMeta();
  });

  // ---- Filtro por responsável ----
  const atualizarBotoesFiltro = () => {
    btnFiltroMarcos.classList.toggle('ativo-marcos', filtroPessoas.has('Marcos'));
    btnFiltroEster.classList.toggle('ativo-ester', filtroPessoas.has('Ester'));
  };
  btnFiltroMarcos.addEventListener('click', () => {
    filtroPessoas.has('Marcos') ? filtroPessoas.delete('Marcos') : filtroPessoas.add('Marcos');
    atualizarBotoesFiltro();
    render();
  });
  btnFiltroEster.addEventListener('click', () => {
    filtroPessoas.has('Ester') ? filtroPessoas.delete('Ester') : filtroPessoas.add('Ester');
    atualizarBotoesFiltro();
    render();
  });

  // ---- Buscar Tags (filtro do topo) ----
  const buscarTagsWrap = modal.querySelector('#cmBuscarTagsWrap');
  const btnBuscarTags = modal.querySelector('#cmBtnBuscarTags');
  const buscarTagsPopover = modal.querySelector('#cmBuscarTagsPopover');
  const buscarTagsInput = modal.querySelector('#cmBuscarTagsInput');
  const buscarTagsLista = modal.querySelector('#cmBuscarTagsLista');
  const buscarTagsContador = modal.querySelector('#cmBuscarTagsContador');

  const atualizarContadorBuscarTags = () => {
    buscarTagsContador.textContent = filtroTags.size ? ` (${filtroTags.size})` : '';
    btnBuscarTags.classList.toggle('ativo', filtroTags.size > 0);
  };

  const renderBuscarTagsLista = () => {
    const termo = buscarTagsInput.value.trim().toLowerCase();
    const visiveis = CM_TAREFAS_TAGS.filter(t => t.toLowerCase().includes(termo));
    buscarTagsLista.innerHTML = visiveis.length
      ? visiveis.map(tag => `
          <label class="cm-tag-opcao">
            <input type="checkbox" class="cm-buscar-tags-checkbox" value="${escapeHtml(tag)}" ${filtroTags.has(tag) ? 'checked' : ''}>
            ${escapeHtml(tag)}
          </label>
        `).join('')
      : '<p class="cm-tag-filtro-vazio">Nenhuma tag encontrada.</p>';
  };

  btnBuscarTags.addEventListener('click', () => {
    if (buscarTagsPopover.classList.contains('aberto')) { fecharPopoverAberto(); return; }
    renderBuscarTagsLista();
    buscarTagsPopover.classList.add('aberto');
    popoverAberto = { wrap: buscarTagsWrap, fechar: () => buscarTagsPopover.classList.remove('aberto') };
    buscarTagsInput.focus();
  });
  buscarTagsInput.addEventListener('input', renderBuscarTagsLista);
  buscarTagsLista.addEventListener('change', (e) => {
    const chk = e.target.closest('.cm-buscar-tags-checkbox');
    if (!chk) return;
    chk.checked ? filtroTags.add(chk.value) : filtroTags.delete(chk.value);
    atualizarContadorBuscarTags();
    render();
  });

  // ---- Rótulos de data (navegador, botão do seletor) e estado dos botões ----
  const labelDiaNavegador = modal.querySelector('#cmDiaNavegadorLabel');
  const btnDiaAnterior = modal.querySelector('#cmDiaBtnAnterior');
  const btnDiaProximo = modal.querySelector('#cmDiaBtnProximo');
  const dataLabel = modal.querySelector('#cmTarefasDataLabel');

  const atualizarLabelData = (dataBR = dia.dataBR) => {
    dataLabel.textContent = dataBR || 'Selecionar data';
    btnNova.disabled = !dia.dataBR || carregando || dia.erroCarregamento;
    btnExcluirLista.style.display = (!dia.listaId || carregando) ? "none" : "";
    if (!dataBR) {
      labelDiaNavegador.textContent = carregando ? 'Carregando...' : 'Selecione uma data';
      return;
    }
    const d = _parseDataAula(dataBR);
    labelDiaNavegador.textContent = d ? `${CM_TAREFAS_DIAS_SEMANA_COMPLETO[d.getDay()]}, ${dataBR}` : dataBR;
  };

  // ---- Transição entre dias: a lista sai deslizando pra cima com fade, a barra
  // de carregamento aparece enquanto busca, e o dia novo entra de baixo pra cima ----
  const DURACAO_SAIDA_MS = 180;
  const animarSaidaLista = () => new Promise(resolve => {
    if (reduzirMovimento) { resolve(); return; }
    listaEl.classList.remove('cm-lista-entrando');
    listaEl.classList.add('cm-lista-saindo');
    setTimeout(resolve, DURACAO_SAIDA_MS);
  });
  const animarEntradaLista = () => {
    listaEl.classList.remove('cm-lista-saindo');
    if (reduzirMovimento) return;
    listaEl.classList.add('cm-lista-entrando');
    void listaEl.offsetWidth; // força reflow pra transição partir do estado "entrando"
    listaEl.classList.remove('cm-lista-entrando');
  };
  const mostrarCarregando = (ativo) => {
    carregando = ativo;
    barraCarregando.classList.toggle('ativo', ativo);
    atualizarLabelData(ativo ? dataSolicitada : dia.dataBR);
  };

  // Troca o dia exibido sem fechar o modal. O que estava em digitação no dia que
  // sai é gravado em segundo plano (cada item grava na lista do próprio contexto).
  const carregarDia = async (dataBR, opcoes = {}) => {
    const geracao = ++geracaoDia;
    dataSolicitada = dataBR;
    fecharPopoverAberto();
    fecharMencaoPopover();
    if (document.activeElement && listaEl.contains(document.activeElement)) document.activeElement.blur();
    flushPendentes();
    mostrarCarregando(true);
    const saida = animarSaidaLista();

    let listaId = null;
    let itensDoDia = [];
    let erro = null;
    try {
      if (!dataBR && opcoes.listaId) {
        const lista = await BANCO.fetchListaTarefas(opcoes.listaId);
        dataBR = lista ? (lista.data || '') : '';
        if (geracao === geracaoDia) dataSolicitada = dataBR;
      }
      if (dataBR) {
        const lista = await _cmResolverListaDoDia(dataBR);
        if (lista) {
          listaId = lista.id;
          itensDoDia = await BANCO.fetchItensTarefa(lista.id);
        }
      }
    } catch (error) {
      erro = error;
    }
    await saida;
    if (geracao !== geracaoDia || fechando) return;

    const ctx = novoContextoDia(dataBR, listaId, []);
    if (erro) {
      console.error('❌ Erro ao carregar tarefas do dia:', erro);
      ctx.erroCarregamento = true;
    }
    ctx.itens = itensDoDia.map(i => ({ ...i, _persisted: true, _textoSalvo: i.texto, _dia: ctx }));
    dia = ctx;
    recolhidos.clear();
    ctx.itens.forEach(i => { if (i.parentId) recolhidos.add(i.parentId); });
    comentariosAbertos.clear();
    funcoesAbertoId = null;
    tagPopoverAbertoId = null;
    copiarPopoverAbertoId = null;
    if (dataBR) {
      const base = _parseDataAula(dataBR);
      if (base) { dataPickerMes = base.getMonth(); dataPickerAno = base.getFullYear(); }
    }
    mostrarCarregando(false);
    render();
    animarEntradaLista();
  };

  // ---- Navegador de dia (setas e deslizar o dedo) ----
  const navegarParaDia = (delta) => {
    const base = dataSolicitada || dia.dataBR;
    if (!base) {
      showToast('Selecione uma data primeiro', 'error');
      return;
    }
    carregarDia(_cmAdicionarDias(base, delta));
  };
  btnDiaAnterior.addEventListener('click', () => navegarParaDia(-1));
  btnDiaProximo.addEventListener('click', () => navegarParaDia(1));

  // Deslizar na horizontal troca de dia (celular). Não vale começando num campo
  // de texto, popover ou alça de arraste — ali o gesto é seleção/rolagem.
  const corpoModal = modal.querySelector('.modal-body');
  let toqueInicio = null;
  corpoModal.addEventListener('touchstart', (e) => {
    const alvo = e.target;
    if (e.touches.length !== 1 || alvo.closest('[contenteditable="true"], .cm-popover, .cm-tarefa-handle, input')) { toqueInicio = null; return; }
    toqueInicio = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  corpoModal.addEventListener('touchend', (e) => {
    if (!toqueInicio) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toqueInicio.x;
    const dy = t.clientY - toqueInicio.y;
    const rapido = (Date.now() - toqueInicio.t) < 600;
    toqueInicio = null;
    if (rapido && Math.abs(dx) > 70 && Math.abs(dy) < 50) navegarParaDia(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ---- Seletor de data (mini-calendário com feriados, igual ao de "Detalhes da contratação") ----
  // Escolher uma data abre aquele dia no próprio modal (com a lista dele, se houver).
  const dataWrap = modal.querySelector('#cmDataPickerWrap');
  const dataBtn = modal.querySelector('#cmTarefasDataBtn');
  const dataPopover = modal.querySelector('#cmTarefasDataPopover');
  const dataMonthYearEl = modal.querySelector('#cmDataMonthYear');
  const dataDaysEl = modal.querySelector('#cmDataDays');
  const dataPrevBtn = modal.querySelector('#cmDataPrevMonth');
  const dataNextBtn = modal.querySelector('#cmDataNextMonth');

  const renderDataPicker = () => {
    dataMonthYearEl.textContent = `${CM_TAREFAS_MESES[dataPickerMes]} ${dataPickerAno}`;
    const primeiroDia = new Date(dataPickerAno, dataPickerMes, 1).getDay();
    const diasNoMes = new Date(dataPickerAno, dataPickerMes + 1, 0).getDate();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dataSel = dataSolicitada || dia.dataBR;
    const selecionado = dataSel ? _parseDataAula(dataSel) : null;

    let html = '';
    for (let i = 0; i < primeiroDia; i++) html += '<div class="calendar-day-empty"></div>';
    for (let d = 1; d <= diasNoMes; d++) {
      const classes = ['calendar-day', 'cm-data-picker-day'];
      let title = '';
      if (typeof Feriados !== 'undefined' && Feriados.doDia) {
        const feriadosDoDia = Feriados.doDia(d, dataPickerMes, dataPickerAno);
        if (feriadosDoDia.length > 0) {
          classes.push('calendar-day-feriado');
          title = feriadosDoDia.map(f => f.nome).join(', ');
        }
      }
      const dataDoDia = new Date(dataPickerAno, dataPickerMes, d);
      const ehSelecionado = selecionado && dataDoDia.getTime() === new Date(selecionado.getFullYear(), selecionado.getMonth(), selecionado.getDate()).getTime();
      const ehHoje = dataDoDia.getTime() === hoje.getTime();
      if (ehSelecionado) classes.push('bg-orange-500', 'text-white', 'font-bold');
      else if (ehHoje) classes.push('cm-data-picker-day-hoje');
      html += `<button type="button" class="${classes.join(' ')}" data-dia="${d}" title="${escapeHtml(title)}">${d}</button>`;
    }
    dataDaysEl.innerHTML = html;
  };

  dataBtn.addEventListener('click', () => {
    if (dataPopover.classList.contains('aberto')) { fecharPopoverAberto(); return; }
    const dataSel = dataSolicitada || dia.dataBR;
    const base = (dataSel && _parseDataAula(dataSel)) || new Date();
    dataPickerMes = base.getMonth();
    dataPickerAno = base.getFullYear();
    renderDataPicker();
    dataPopover.classList.add('aberto');
    popoverAberto = { wrap: dataWrap, fechar: () => dataPopover.classList.remove('aberto') };
  });
  dataPrevBtn.addEventListener('click', () => {
    dataPickerMes--;
    if (dataPickerMes < 0) { dataPickerMes = 11; dataPickerAno--; }
    renderDataPicker();
  });
  dataNextBtn.addEventListener('click', () => {
    dataPickerMes++;
    if (dataPickerMes > 11) { dataPickerMes = 0; dataPickerAno++; }
    renderDataPicker();
  });
  dataDaysEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cm-data-picker-day');
    if (!btn) return;
    const d = Number(btn.dataset.dia);
    const novaData = `${String(d).padStart(2, '0')}/${String(dataPickerMes + 1).padStart(2, '0')}/${dataPickerAno}`;
    fecharPopoverAberto();
    if (novaData === (dataSolicitada || dia.dataBR) && !carregando) return;
    carregarDia(novaData);
  });

  const hojeInicial = new Date();
  dataPickerMes = hojeInicial.getMonth();
  dataPickerAno = hojeInicial.getFullYear();
  atualizarLabelData();

  // ---- Helpers de árvore ----
  const visivel = (i) => !i._removido;
  const filhosOrdenados = (parentId) => dia.itens
    .filter(i => i.parentId === parentId && visivel(i))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const proximaOrdem = (parentId) => {
    const irmaos = dia.itens.filter(i => i.parentId === parentId);
    if (!irmaos.length) return 0;
    return Math.max(...irmaos.map(i => i.ordem ?? 0)) + 1;
  };

  // Todos os descendentes (objetos completos) de um item, em qualquer profundidade
  const coletarSubarvoreObjetos = (itemId) => {
    const diretos = dia.itens.filter(i => i.parentId === itemId);
    return diretos.reduce((acc, filho) => acc.concat(filho, coletarSubarvoreObjetos(filho.id)), []);
  };

  // Chave estável do item pras pendências de autosave — o id muda (temp -> id do
  // Firestore) na 1ª gravação, a chave não.
  const chaveItem = (item) => {
    if (!item._chave) item._chave = item.id;
    return item._chave;
  };

  // ---- Copiar tarefa (nível 1) + toda a subárvore pra outro dia ----
  // Sempre copia (não move): o item original continua no dia atual. A cópia nasce
  // sempre desmarcada e entra no fim da lista de nível 1 do dia de destino. Vai
  // num batch só (tudo ou nada) e um 2º clique durante a cópia é ignorado.
  const copiarItemParaData = async (itemOrigem, dataDestinoBR) => {
    if (itemOrigem._copiando) return;
    itemOrigem._copiando = true;
    try {
      const ctxDestino = dataDestinoBR === dia.dataBR ? dia : null;
      const listaDestinoId = ctxDestino ? await garantirLista(ctxDestino) : await _cmGarantirListaDaData(dataDestinoBR);

      const itensExistentesDestino = await BANCO.fetchItensTarefa(listaDestinoId);
      const nivel1Existentes = itensExistentesDestino.filter(i => i.nivel === 1);
      const ordemInicial = nivel1Existentes.length ? Math.max(...nivel1Existentes.map(i => i.ordem ?? 0)) + 1 : 0;

      const subarvore = coletarSubarvoreObjetos(itemOrigem.id)
        .filter(i => i._persisted && !i._removido)
        .sort((a, b) => a.nivel - b.nivel);
      const mapaIds = new Map(); // id no dia de origem -> id novo no dia de destino
      const novos = [itemOrigem, ...subarvore].map(orig => {
        const id = BANCO.novoIdItemTarefa(listaDestinoId);
        mapaIds.set(orig.id, id);
        const principal = orig === itemOrigem;
        return {
          id,
          texto: (orig.texto || '').trim(), nivel: orig.nivel,
          parentId: principal ? null : (mapaIds.get(orig.parentId) || null),
          responsavel: orig.responsavel || '', prazo: orig.prazo || '',
          comentario: orig.comentario || '', tags: orig.tags || [],
          ordem: principal ? ordemInicial : (orig.ordem ?? 0), ultimaEdicaoPor: editorAtual
        };
      });
      await BANCO.addItensTarefaEmLote(listaDestinoId, novos);

      const concluidosDestino = nivel1Existentes.filter(i => i.status === 'concluido').length;
      BANCO.atualizarAgregadosListaTarefas(listaDestinoId, nivel1Existentes.length + 1, concluidosDestino)
        .catch(err => console.error('❌ Erro ao atualizar agregados da lista de destino:', err));

      showToast(`✅ "${_cmTextoPlano(itemOrigem.texto)}" copiada para ${dataDestinoBR}!`, 'success');

      // Destino é o próprio dia aberto: acrescenta as cópias na tela sem recarregar
      // (antes a lista era substituída e as tarefas ainda não salvas sumiam)
      if (ctxDestino && ctxDestino === dia) {
        novos.forEach(n => dia.itens.push({
          ...n, status: 'pendente', ultimaEdicao: new Date(),
          _persisted: true, _textoSalvo: n.texto, _dia: dia
        }));
        render();
      }
    } catch (error) {
      console.error('❌ Erro ao copiar tarefa:', error);
      showToast('❌ Erro ao copiar tarefa', 'error');
    } finally {
      itemOrigem._copiando = false;
    }
  };

  // ---- Renderização da árvore (até 3 níveis) ----
  const renderNode = (item) => {
    const filhos = filhosOrdenados(item.id);
    const temFilhos = filhos.length > 0;
    const podeVirarSubtarefa = item.nivel < 3;
    const desabilitarCheckbox = !item._persisted;
    const meta = item._persisted ? _cmFormatarMeta(item) : '';
    const responsavelAtual = item.responsavel || '';
    const recolhido = recolhidos.has(item.id);
    const comentarioAberto = comentariosAbertos.has(item.id);
    const urgente = _cmEhUrgente(item, dia.dataBR);
    const tags = item.tags || [];

    const tagIconHtml = item.nivel === 1 ? `
      <span class="cm-tarefa-tag-wrap" data-item-id="${item.id}">
        <button type="button" class="cm-tarefa-btn-tag" data-item-id="${item.id}" title="Tags"><i class="fas fa-tag"></i></button>
        <div class="cm-popover cm-tag-popover${tagPopoverAbertoId === item.id ? ' aberto' : ''}" data-item-id="${item.id}">
          ${CM_TAREFAS_TAGS.map(tag => `
            <label class="cm-tag-opcao">
              <input type="checkbox" class="cm-tag-checkbox" data-item-id="${item.id}" value="${escapeHtml(tag)}" ${tags.includes(tag) ? 'checked' : ''}>
              ${escapeHtml(tag)}
            </label>
          `).join('')}
        </div>
      </span>
    ` : '';

    const funcoesAberto = funcoesAbertoId === item.id;
    const funcoesHtml = [
      `<span class="cm-tarefa-area-prazo">
        ${tagIconHtml}
        ${item.nivel === 1 ? '<span class="cm-tarefa-divisor"></span>' : ''}
        <button type="button" class="cm-tarefa-btn-hora${urgente ? ' cm-tarefa-btn-hora-urgente' : ''}" data-item-id="${item.id}" title="Prazo">${escapeHtml(item.prazo || '--:--')}</button>
      </span>`,
      `<button type="button" class="cm-tarefa-btn-comentario${item.comentario ? ' cm-tarefa-btn-comentario-ativo' : ''}" data-item-id="${item.id}" title="Comentário">
        <i class="fas fa-comment-alt"></i>
      </button>`,
      `<span class="cm-tarefa-pessoas">
        <button type="button" class="cm-tarefa-pessoa cm-tarefa-pessoa-marcos${responsavelAtual === 'Marcos' ? ' ativo' : ''}" data-item-id="${item.id}" data-pessoa="Marcos" title="Marcos"><i class="fas fa-user"></i></button>
        <button type="button" class="cm-tarefa-pessoa cm-tarefa-pessoa-ester${responsavelAtual === 'Ester' ? ' ativo' : ''}" data-item-id="${item.id}" data-pessoa="Ester" title="Ester"><i class="fas fa-user"></i></button>
      </span>`,
      ...(podeVirarSubtarefa ? [`<button type="button" class="cm-tarefa-btn-subtarefa" data-item-id="${item.id}" title="Adicionar subtarefa"><i class="fas fa-code-branch"></i></button>`] : []),
      ...(item.nivel === 1 ? [
        `<button type="button" class="cm-tarefa-btn-copiar-amanha" data-item-id="${item.id}" title="Copiar para amanhã"><i class="fas fa-arrow-right"></i></button>`,
        `<span class="cm-tarefa-copiar-data-wrap" data-item-id="${item.id}">
          <button type="button" class="cm-tarefa-btn-copiar-data" data-item-id="${item.id}" title="Copiar para um dia específico"><i class="fas fa-calendar-plus"></i></button>
          <div class="cm-popover cm-data-picker-popover${copiarPopoverAbertoId === item.id ? ' aberto' : ''}" data-item-id="${item.id}">
            <div class="calendar-container">
              <div class="calendar-header flex items-center justify-between mb-2 px-1">
                <button type="button" class="cm-copiar-prev-mes" data-item-id="${item.id}"><i class="fas fa-chevron-left text-gray-600 text-xs"></i></button>
                <div class="font-lexend font-bold text-sm text-gray-700">${CM_TAREFAS_MESES[copiarMes]} ${copiarAno}</div>
                <button type="button" class="cm-copiar-next-mes" data-item-id="${item.id}"><i class="fas fa-chevron-right text-gray-600 text-xs"></i></button>
              </div>
              <div class="calendar-weekdays grid grid-cols-7 gap-1 mb-1 text-center cm-data-picker-weekday">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              <div class="calendar-days grid grid-cols-7 gap-1">${copiarPopoverAbertoId === item.id ? _cmGerarDiasCalendarioHtml(copiarMes, copiarAno) : ''}</div>
            </div>
          </div>
        </span>`
      ] : []),
      `<button type="button" class="cm-tarefa-btn-excluir" data-item-id="${item.id}" title="Excluir"><i class="fas fa-trash"></i></button>`
    ].join('<span class="cm-tarefa-divisor"></span>');

    // Com a barra de ações fechada, horário e comentário continuam visíveis (sozinhos,
    // na mesma ordem em que apareceriam dentro da barra) se o item tiver algum valor
    // definido — lembra o usuário que existe prazo/comentário sem precisar abrir a
    // barra inteira. Mesmos botões/classes dos de dentro da barra, então o clique já
    // funciona igual (abre o seletor de hora / abre-fecha o campo de comentário).
    const horaFixoHtml = (!funcoesAberto && item.prazo) ? `
      <button type="button" class="cm-tarefa-btn-hora${urgente ? ' cm-tarefa-btn-hora-urgente' : ''}" data-item-id="${item.id}" title="Prazo">${escapeHtml(item.prazo)}</button>` : '';
    const comentarioFixoHtml = (!funcoesAberto && item.comentario) ? `
      <button type="button" class="cm-tarefa-btn-comentario cm-tarefa-btn-comentario-ativo" data-item-id="${item.id}" title="Comentário">
        <i class="fas fa-comment-alt"></i>
      </button>` : '';
    const fixosHtml = [horaFixoHtml, comentarioFixoHtml].filter(Boolean).join('<span class="cm-tarefa-divisor"></span>');

    const statusIconHtml = {
      andamento: '<i class="fas fa-hourglass-half"></i>',
      concluido: '<i class="fas fa-check"></i>',
      cancelado: '<i class="fas fa-times"></i>'
    }[item.status] || '';
    const statusTitle = {
      pendente: 'Marcar como em andamento',
      andamento: 'Marcar como concluída',
      concluido: 'Marcar como cancelada',
      cancelado: 'Voltar para pendente'
    }[item.status] || '';

    return `
      <div class="cm-tarefa-item cm-tarefa-nivel-${item.nivel}" data-item-id="${item.id}">
        <div class="cm-tarefa-row">
          <span class="cm-tarefa-handle" draggable="true" title="Arrastar para reordenar"><i class="fas fa-grip-vertical"></i></span>
          ${temFilhos
            ? `<button type="button" class="cm-tarefa-btn-colapsar" data-item-id="${item.id}" title="${recolhido ? 'Expandir' : 'Recolher'}"><i class="fas fa-chevron-${recolhido ? 'right' : 'down'}"></i></button>`
            : '<span class="cm-tarefa-colapsar-espaco"></span>'}
          <button type="button" class="cm-tarefa-checkbox cm-tarefa-checkbox-${item.status}" data-item-id="${item.id}" ${desabilitarCheckbox ? 'disabled' : ''} title="${statusTitle}">${statusIconHtml}</button>
          <div class="cm-tarefa-texto" contenteditable="true" data-item-id="${item.id}" data-placeholder="Descreva a tarefa...">${_cmRenderConteudoComMencoes(item.texto)}</div>
          ${funcoesAberto ? `<span class="cm-tarefa-divisor"></span><div class="cm-tarefa-funcoes">${funcoesHtml}</div>` : fixosHtml}
          <button type="button" class="cm-tarefa-btn-funcoes-toggle${funcoesAberto ? ' ativo' : ''}" data-item-id="${item.id}" title="${funcoesAberto ? 'Esconder ações' : 'Mostrar ações'}">
            <i class="fas fa-grip-lines-vertical"></i>
          </button>
        </div>
        ${(item.nivel === 1 && tags.length) ? `<div class="cm-tarefa-tags">${tags.map(t => `<span class="cm-tag-chip">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${meta ? `<div class="cm-tarefa-meta">${escapeHtml(meta)}</div>` : ''}
        <div class="cm-tarefa-comentario-wrap${comentarioAberto ? ' aberto' : ''}" data-item-id="${item.id}">
          <div class="cm-tarefa-comentario-texto" contenteditable="true" data-item-id="${item.id}" data-placeholder="Escreva um comentário...">${_cmRenderConteudoComMencoes(item.comentario)}</div>
        </div>
        ${(temFilhos && !recolhido) ? `<div class="cm-tarefa-filhos">${filhos.map(renderNode).join('')}</div>` : ''}
      </div>
    `;
  };

  // render() reconstrói o innerHTML da lista inteira — por isso NÃO é chamado
  // pelo autosave do texto (no celular, destruir o campo em foco derrubava o
  // teclado e a tela "pulava", parecendo que o modal tinha fechado). O autosave
  // só atualiza o próprio item no DOM (atualizarItemNoDom). Para as ações que
  // ainda redesenham tudo, render() guarda e restaura foco+cursor do campo ativo.
  const render = () => {
    // Um popover de menção aberto referencia nós de texto de um campo que está
    // prestes a ser destruído — sem isso ficaria um popover "fantasma". Se o
    // campo com a menção ainda está em foco, reabre a sugestão no campo novo.
    const mencaoAtivaAntes = (mencaoState && mencaoState.el === document.activeElement)
      ? { item: mencaoState.item, campo: mencaoState.campo, entidadeSelecionada: mencaoState.sugestoes[mencaoState.indiceAtivo] || null }
      : null;
    fecharMencaoPopover();

    const ativo = document.activeElement;
    const classeAtiva = ativo && ativo.classList && listaEl.contains(ativo)
      ? (ativo.classList.contains('cm-tarefa-texto') ? 'cm-tarefa-texto'
        : ativo.classList.contains('cm-tarefa-comentario-texto') ? 'cm-tarefa-comentario-texto' : null)
      : null;
    const focoAtivo = classeAtiva
      ? { id: ativo.dataset.itemId, classe: classeAtiva, offset: _cmOffsetTextoAntesDoCursor(ativo) }
      : null;

    if (dia.erroCarregamento) {
      listaEl.innerHTML = `
        <div class="cm-tarefas-erro">
          <i class="fas fa-triangle-exclamation"></i>
          <p>Não foi possível carregar as tarefas deste dia.</p>
          <button type="button" class="btn-secondary btn-compact" id="cmTarefasBtnTentarDeNovo"><i class="fas fa-rotate-right mr-2"></i>Tentar de novo</button>
        </div>`;
      return;
    }

    let raiz = filhosOrdenados(null);
    if (filtroPessoas.size > 0) raiz = raiz.filter(i => filtroPessoas.has(i.responsavel));
    if (filtroTags.size > 0) raiz = raiz.filter(i => (i.tags || []).some(t => filtroTags.has(t)));
    const vazio = !dia.dataBR
      ? 'Selecione uma data para ver ou criar tarefas.'
      : (filtroPessoas.size || filtroTags.size) ? 'Nenhuma tarefa encontrada para esse filtro.' : 'Nenhuma tarefa ainda.';
    listaEl.innerHTML = raiz.length
      ? raiz.map(renderNode).join('')
      : `<p class="text-sm text-gray-400 text-center py-4">${vazio}</p>`;
    ajustarAlturasComentarios();
    ajustarAlturasTextos();
    posicionarMetas();

    if (focoAtivo) {
      const el = listaEl.querySelector(`.${focoAtivo.classe}[data-item-id="${focoAtivo.id}"]`);
      if (el) {
        el.focus();
        if (focoAtivo.offset != null) _cmRestaurarCursorNoOffset(el, focoAtivo.offset);
        if (mencaoAtivaAntes) atualizarMencao(el, mencaoAtivaAntes.item, mencaoAtivaAntes.campo, mencaoAtivaAntes.entidadeSelecionada);
      }
    }
  };

  // Auto-altura compartilhada por ".cm-tarefa-texto" (textarea de 1 linha que cresce
  // se ganhar uma quebra via Ctrl+Enter) e ".cm-tarefa-comentario-texto" — cresce até
  // 100px e só depois disso ganha barra de rolagem.
  const ajustarAlturaAuto = (el, classeScroll) => {
    el.classList.remove(classeScroll);
    el.style.height = 'auto';
    const ultrapassou = el.scrollHeight > 100;
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    if (ultrapassou) el.classList.add(classeScroll);
  };
  const ajustarAlturaComentario = (txt) => ajustarAlturaAuto(txt, 'cm-tarefa-comentario-scroll');
  const ajustarAlturaTexto = (txt) => ajustarAlturaAuto(txt, 'cm-tarefa-texto-scroll');

  const ajustarAlturasComentarios = () => {
    listaEl.querySelectorAll('.cm-tarefa-comentario-texto').forEach(ajustarAlturaComentario);
  };
  const ajustarAlturasTextos = () => {
    listaEl.querySelectorAll('.cm-tarefa-texto').forEach(ajustarAlturaTexto);
  };

  // A largura do campo de texto muda conforme cm-tarefa-funcoes está aberto ou
  // fechado (o texto estica pra ocupar o espaço livre) — por isso a margem da
  // meta é recalculada a cada render(), pra continuar alinhada com a borda
  // direita do campo de texto daquele item específico.
  const posicionarMeta = (itemEl) => {
    const meta = itemEl.querySelector(':scope > .cm-tarefa-meta');
    const texto = itemEl.querySelector(':scope > .cm-tarefa-row > .cm-tarefa-texto');
    if (!meta || !texto) return;
    const distancia = itemEl.getBoundingClientRect().right - texto.getBoundingClientRect().right;
    meta.style.marginRight = `${Math.max(distancia, 0)}px`;
  };
  const posicionarMetas = () => {
    listaEl.querySelectorAll('.cm-tarefa-item').forEach(posicionarMeta);
  };

  // Atualiza só o item salvo no DOM (checkbox habilitado + "Editado em..."), sem
  // reconstruir a lista — mantém o foco e o teclado do celular onde estão.
  const atualizarItemNoDom = (item) => {
    const itemEl = listaEl.querySelector(`.cm-tarefa-item[data-item-id="${item.id}"]`);
    if (!itemEl) return;
    const chk = itemEl.querySelector(':scope > .cm-tarefa-row > .cm-tarefa-checkbox');
    if (chk) chk.disabled = !item._persisted;
    const metaTexto = item._persisted ? _cmFormatarMeta(item) : '';
    let metaEl = itemEl.querySelector(':scope > .cm-tarefa-meta');
    if (metaTexto) {
      if (!metaEl) {
        metaEl = document.createElement('div');
        metaEl.className = 'cm-tarefa-meta';
        const comentarioWrap = itemEl.querySelector(':scope > .cm-tarefa-comentario-wrap');
        if (comentarioWrap) comentarioWrap.before(metaEl); else itemEl.appendChild(metaEl);
      }
      metaEl.textContent = metaTexto;
      posicionarMeta(itemEl);
    } else if (metaEl) {
      metaEl.remove();
    }
  };

  // ---- Agregados (total/concluídos de nível 1) gravados no doc da lista ----
  // Lista sem nenhuma tarefa é apagada — mas só se o SERVIDOR confirmar que está
  // vazia: a cópia local pode estar velha (Marcos e Ester com o mesmo dia aberto)
  // e antes isso apagava as tarefas da outra pessoa junto.
  const salvarAgregados = (ctx) => enfileirarDia(ctx, async () => {
    if (!ctx.listaId) return;
    const persistidos = ctx.itens.filter(i => i._persisted && !i._removido);
    if (!persistidos.length) {
      if (ctx.itens.some(i => i._criando && !i._removido)) return;
      try {
        if (await BANCO.deleteListaTarefasSeVazia(ctx.listaId)) ctx.listaId = null;
      } catch (error) {
        console.error('❌ Erro ao excluir lista vazia de tarefas:', error);
      }
      if (ctx === dia) atualizarLabelData();
      return;
    }
    const nivel1 = persistidos.filter(i => i.nivel === 1);
    try {
      await BANCO.atualizarAgregadosListaTarefas(ctx.listaId, nivel1.length, nivel1.filter(i => i.status === 'concluido').length);
    } catch (error) {
      console.error('❌ Erro ao atualizar agregados da lista de tarefas:', error);
    }
  });

  // Avança o status de um item (ciclo vazio → andamento → concluido → cancelado → vazio).
  // Independente por item: tarefa principal e subtarefas não se propagam entre si.
  // Otimista: muda local na hora, desfaz e re-renderiza só se a gravação falhar.
  const avancarStatusTarefa = (item) => {
    const statusAnterior = item.status;
    const novoStatus = _cmProximoStatusTarefa(item.status);
    item.status = novoStatus;
    item.ultimaEdicao = new Date();
    item.ultimaEdicaoPor = editorAtual;
    return enfileirarItem(item, async () => {
      if (!item._persisted || item._removido) return;
      const ctx = item._dia;
      try {
        await BANCO.updateItemTarefa(ctx.listaId, item.id, { status: novoStatus, ultimaEdicaoPor: editorAtual });
        salvarAgregados(ctx);
      } catch (error) {
        console.error('❌ Erro ao atualizar status da tarefa:', error);
        showToast('❌ Erro ao atualizar tarefa', 'error');
        item.status = statusAnterior;
        if (ctx === dia) render();
      }
    });
  };

  // Foca (e posiciona o cursor no fim de) o campo de texto do item recém-criado.
  // Chama .focus() direto, de forma síncrona — o item já existe no DOM assim que
  // render() (innerHTML) retorna, não precisa esperar nada. requestAnimationFrame
  // NÃO é seguro aqui: o navegador pausa rAF em abas fora de foco/minimizadas, e
  // nessas condições o foco nunca era aplicado (bug real, confirmado em teste).
  const focarItem = (id) => {
    const inputNovo = listaEl.querySelector(`.cm-tarefa-texto[data-item-id="${id}"]`);
    if (!inputNovo) return;
    _cmFocarFimDoCampo(inputNovo);
  };

  const novoItemLocal = (nivel, parentId, ordem) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      id: tempId, _chave: tempId, texto: '', status: 'pendente', nivel, parentId,
      responsavel: '', prazo: '', comentario: '', tags: [], ordem,
      ultimaEdicao: null, ultimaEdicaoPor: '', _persisted: false, _dia: dia
    };
  };

  // ---- Criação de item local ----
  const criarItemLocal = (nivel, parentId) => {
    const novo = novoItemLocal(nivel, parentId, proximaOrdem(parentId));
    dia.itens.push(novo);
    render();
    focarItem(novo.id);
  };

  // Cria um item novo logo ABAIXO de "itemAtual" (mesmo pai/nível) — usado ao apertar
  // Enter no campo de texto. Renumera a ordem dos irmãos e persiste, igual ao
  // arrastar-e-soltar, pra o item entrar na posição certa (não no fim da lista).
  const criarItemAposIrmao = (itemAtual) => {
    const novoItem = novoItemLocal(itemAtual.nivel, itemAtual.parentId, 0);
    const irmaos = filhosOrdenados(itemAtual.parentId);
    const indiceAtual = irmaos.findIndex(i => i.id === itemAtual.id);
    irmaos.splice(indiceAtual + 1, 0, novoItem);
    irmaos.forEach((it, idx) => { it.ordem = idx; });
    dia.itens.push(novoItem);

    const persistidos = irmaos.filter(i => i._persisted && i.id !== novoItem.id).map(i => ({ id: i.id, ordem: i.ordem }));
    if (persistidos.length && dia.listaId) {
      BANCO.reordenarItensTarefa(dia.listaId, persistidos).catch(err => console.error('❌ Erro ao reordenar tarefas:', err));
    }

    render();
    focarItem(novoItem.id);
  };

  btnNova.addEventListener('click', () => {
    if (!dia.dataBR) {
      showToast('Selecione a data antes de adicionar uma tarefa', 'error');
      return;
    }
    criarItemLocal(1, null);
  });

  // ---- Fila de "pendências" (debounce) + botão "Salvar alterações" flush ----
  const pendentes = {}; // chave -> { timeoutId, flush }
  const debounce = (chave, fn, ms) => {
    if (pendentes[chave]) clearTimeout(pendentes[chave].timeoutId);
    const timeoutId = setTimeout(() => { delete pendentes[chave]; fn(); }, ms);
    pendentes[chave] = { timeoutId, flush: fn };
  };
  const cancelarPendente = (chave) => {
    if (!pendentes[chave]) return;
    clearTimeout(pendentes[chave].timeoutId);
    delete pendentes[chave];
  };

  const flushPendentes = async () => {
    const chaves = Object.keys(pendentes);
    const proms = chaves.map(chave => {
      const { timeoutId, flush } = pendentes[chave];
      clearTimeout(timeoutId);
      delete pendentes[chave];
      return flush();
    });
    await Promise.all(proms);
  };

  btnSalvarTudo.addEventListener('click', async () => {
    await flushPendentes();
    await aguardarFilas();
    showToast('✅ Alterações salvas!', 'success');
  });

  // Item recém-criado troca de id temporário (client-side) pelo id real do
  // Firestore ao ser persistido pela 1ª vez — atualiza o DOM e os estados de
  // tela (comentário aberto, barra de ações...) que estavam no id antigo.
  const sincronizarIdNoDom = (idAntigo, idNovo) => {
    if (comentariosAbertos.delete(idAntigo)) comentariosAbertos.add(idNovo);
    if (recolhidos.delete(idAntigo)) recolhidos.add(idNovo);
    if (funcoesAbertoId === idAntigo) funcoesAbertoId = idNovo;
    if (tagPopoverAbertoId === idAntigo) tagPopoverAbertoId = idNovo;
    if (copiarPopoverAbertoId === idAntigo) copiarPopoverAbertoId = idNovo;
    const itemEl = listaEl.querySelector(`.cm-tarefa-item[data-item-id="${idAntigo}"]`);
    if (!itemEl) return;
    itemEl.dataset.itemId = idNovo;
    itemEl.querySelectorAll(`[data-item-id="${idAntigo}"]`).forEach(el => { el.dataset.itemId = idNovo; });
  };

  // ---- Persistência do texto (cria o item — e a lista, se ainda não existir) ----
  const persistirTexto = (item) => enfileirarItem(item, async () => {
    const ctx = item._dia;
    const textoLimpo = (item.texto || '').trim();
    if (!textoLimpo || item._removido) return; // itens sem texto não são salvos
    try {
      if (!item._persisted) {
        if (!ctx.dataBR) {
          showToast('Selecione a data antes de adicionar uma tarefa', 'error');
          return;
        }
        item._criando = true;
        const listaId = await garantirLista(ctx);
        const novoId = await BANCO.addItemTarefa(listaId, {
          texto: textoLimpo,
          nivel: item.nivel,
          parentId: item.parentId,
          responsavel: item.responsavel || '',
          prazo: item.prazo || '',
          comentario: item.comentario || '',
          tags: item.tags || [],
          ordem: item.ordem ?? 0,
          ultimaEdicaoPor: editorAtual
        });
        const idAntigo = item.id;
        item.id = novoId;
        item._persisted = true;
        item._criando = false;
        item._textoSalvo = textoLimpo;
        item.ultimaEdicao = new Date();
        item.ultimaEdicaoPor = editorAtual;
        ctx.itens.forEach(i => { if (i.parentId === idAntigo) i.parentId = novoId; });
        // Excluído enquanto a criação estava a caminho: apaga já, senão "voltava" ao reabrir
        if (item._removido) {
          await BANCO.deleteItensTarefa(listaId, [novoId]);
          item._persisted = false;
          salvarAgregados(ctx);
          return;
        }
        if (ctx === dia) {
          sincronizarIdNoDom(idAntigo, novoId);
          atualizarItemNoDom(item);
        }
      } else {
        if (textoLimpo === item._textoSalvo) return; // nada mudou desde a última gravação
        await BANCO.updateItemTarefa(ctx.listaId, item.id, { texto: textoLimpo, ultimaEdicaoPor: editorAtual });
        item._textoSalvo = textoLimpo;
        item.ultimaEdicao = new Date();
        item.ultimaEdicaoPor = editorAtual;
        if (ctx === dia) atualizarItemNoDom(item);
      }
      salvarAgregados(ctx);
    } catch (error) {
      item._criando = false;
      console.error('❌ Erro ao salvar tarefa:', error);
      showToast('❌ Erro ao salvar tarefa', 'error');
    }
  });

  // Atualização otimista: muda o valor local na hora (a tela já reflete) e grava
  // pela fila do item — se o item ainda está sendo criado, a gravação espera a
  // criação terminar em vez de se perder. Se falhar, desfaz e re-renderiza.
  const persistirCampoSimples = (item, campo, valor) => {
    const valorAnterior = item[campo];
    item[campo] = valor;
    item.ultimaEdicao = new Date();
    item.ultimaEdicaoPor = editorAtual;
    return enfileirarItem(item, async () => {
      // item ainda não existe no Firestore: o valor vai junto quando o texto for salvo
      if (!item._persisted || item._removido) return;
      const ctx = item._dia;
      try {
        await BANCO.updateItemTarefa(ctx.listaId, item.id, { [campo]: valor, ultimaEdicaoPor: editorAtual });
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${campo} da tarefa:`, error);
        showToast(`❌ Erro ao atualizar ${campo}`, 'error');
        item[campo] = valorAnterior;
        if (ctx === dia) render();
      }
    });
  };

  const persistirComentario = (item) => {
    const campoTexto = listaEl.querySelector(`.cm-tarefa-comentario-texto[data-item-id="${item.id}"]`);
    const valor = campoTexto ? _cmSerializarConteudoEditavel(campoTexto) : (item.comentario || '');
    return persistirCampoSimples(item, 'comentario', valor);
  };

  // ---- Popover de sugestão de menção (@) ----
  const renderizarPopoverMencao = () => {
    if (!mencaoState) return;
    // Fecha qualquer OUTRO popover do modal (tag, data, copiar-para-dia etc.) —
    // mas não passa pelo fecharPopoverAberto genérico quando o que já está aberto
    // é a própria sessão de menção atual, senão o callback (fecharMencaoPopover)
    // anularia o mencaoState que acabamos de montar pra este re-render.
    if (popoverAberto && popoverAberto.fechar !== fecharMencaoPopover) {
      fecharPopoverAberto();
    }

    if (mencaoState.popoverEl) mencaoState.popoverEl.remove();

    const sel = window.getSelection();
    const rect = (sel && sel.rangeCount) ? sel.getRangeAt(0).getClientRects()[0] : null;
    const ancora = rect || mencaoState.el.getBoundingClientRect();

    const popoverEl = document.createElement('div');
    popoverEl.className = 'cm-mencao-popover';
    popoverEl.style.left = `${ancora.left}px`;
    popoverEl.style.top = `${ancora.bottom + 4}px`;
    // Ícone à esquerda indica se é cliente ou professor (a lista vem misturada).
    // Linha de cima: apelido (ou nome completo, se não tiver apelido cadastrado).
    // Linha de baixo: nome completo, só exibida quando já apareceu o apelido em cima
    // (senão ficaria repetido — o nome completo já está sendo mostrado como título).
    popoverEl.innerHTML = mencaoState.sugestoes.length
      ? mencaoState.sugestoes.map((c, i) => `
          <button type="button" class="cm-mencao-opcao${i === mencaoState.indiceAtivo ? ' ativo' : ''}" data-indice="${i}">
            <span class="cm-mencao-opcao-icone" title="${c.tipo === 'professor' ? 'Professor' : 'Cliente'}">
              <i class="fas ${c.tipo === 'professor' ? 'fa-chalkboard-teacher' : 'fa-user'}"></i>
            </span>
            <span class="cm-mencao-opcao-textos">
              <span class="cm-mencao-opcao-apelido">${escapeHtml(c.apelido || c.nome || '')}</span>
              ${c.apelido ? `<span class="cm-mencao-opcao-completo">${escapeHtml(c.nome || '')}</span>` : ''}
            </span>
          </button>
        `).join('')
      : '<p class="cm-mencao-vazio">Nenhum cliente ou professor encontrado.</p>';

    // mousedown (não click) + preventDefault: escolher uma sugestão não pode tirar
    // o foco/seleção do campo de texto, senão perdemos a referência de onde o "@"
    // está pra substituir pelo chip.
    popoverEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const opcao = e.target.closest('.cm-mencao-opcao');
      if (!opcao || !mencaoState) return;
      const entidade = mencaoState.sugestoes[Number(opcao.dataset.indice)];
      if (entidade) confirmarMencao(entidade);
    });

    document.body.appendChild(popoverEl);
    mencaoState.popoverEl = popoverEl;
    popoverAberto = { wrap: popoverEl, fechar: fecharMencaoPopover };
  };

  const confirmarMencao = (entidade) => {
    if (!mencaoState) return;
    const { node, offsetArroba, query, el, item, campo } = mencaoState;
    const fimQuery = Math.min(offsetArroba + 1 + query.length, node.textContent.length);
    const range = document.createRange();
    range.setStart(node, offsetArroba);
    range.setEnd(node, fimQuery);
    range.deleteContents();

    const ehProfessor = entidade.tipo === 'professor';
    const nomeExibicaoChip = entidade.apelido || entidade.nome || '';
    const chip = document.createElement('span');
    chip.className = 'cm-mention-chip' + (ehProfessor ? ' cm-mention-chip-professor' : '');
    chip.contentEditable = 'false';
    chip.dataset.clienteId = entidade.id;
    chip.dataset.mencaoTipo = ehProfessor ? 'professor' : 'cliente';
    chip.dataset.nomeCliente = nomeExibicaoChip;
    chip.textContent = `@${nomeExibicaoChip}`;
    range.insertNode(chip);

    const espaco = document.createTextNode(' ');
    chip.after(espaco);

    const novoRange = document.createRange();
    novoRange.setStartAfter(espaco);
    novoRange.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(novoRange);

    fecharMencaoPopover();
    el.focus();

    item[campo] = _cmSerializarConteudoEditavel(el);
    if (campo === 'texto') {
      ajustarAlturaTexto(el);
      debounce(`texto-${chaveItem(item)}`, () => persistirTexto(item), 700);
    } else {
      ajustarAlturaComentario(el);
      debounce(`comentario-${chaveItem(item)}`, () => persistirComentario(item), 700);
    }
  };

  // Chamado a cada "input" nos campos de texto/comentário — detecta um "@consulta"
  // sendo digitado perto do cursor e abre/atualiza/fecha o popover de sugestão.
  // "entidadeParaManterSelecionada" é usado só no reabrimento silencioso feito por
  // render() (ver mencaoAtivaAntes): sem isso, a navegação por seta feita antes
  // (indiceAtivo) seria perdida e a seleção voltaria pro primeiro item da lista.
  const atualizarMencao = async (el, item, campo, entidadeParaManterSelecionada) => {
    const consulta = _cmDetectarConsultaMencao(el);
    if (!consulta) { fecharMencaoPopover(); return; }
    const entidades = await _cmBuscarEntidadesMencionaveis();
    // O usuário pode ter fechado o campo ou apagado o "@" enquanto a busca rodava
    if (!el.isConnected || document.activeElement !== el) return;
    const consultaAtual = _cmDetectarConsultaMencao(el);
    if (!consultaAtual) { fecharMencaoPopover(); return; }
    const sugestoes = _cmFiltrarMencoesPorNome(entidades, consultaAtual.query);
    const indicePreservado = entidadeParaManterSelecionada
      ? sugestoes.findIndex(s => s.tipo === entidadeParaManterSelecionada.tipo && s.id === entidadeParaManterSelecionada.id)
      : -1;
    mencaoState = {
      el, item, campo,
      node: consultaAtual.node, offsetArroba: consultaAtual.offsetArroba, query: consultaAtual.query,
      sugestoes, indiceAtivo: indicePreservado >= 0 ? indicePreservado : 0, popoverEl: mencaoState ? mencaoState.popoverEl : null
    };
    renderizarPopoverMencao();
  };

  const itemDoCampo = (el) => dia.itens.find(i => i.id === el.dataset.itemId);

  listaEl.addEventListener('input', (e) => {
    const txt = e.target.closest('.cm-tarefa-texto');
    if (txt) {
      ajustarAlturaTexto(txt);
      const item = itemDoCampo(txt);
      if (!item) return;
      item.texto = _cmSerializarConteudoEditavel(txt);
      debounce(`texto-${chaveItem(item)}`, () => persistirTexto(item), 700);
      atualizarMencao(txt, item, 'texto');
      return;
    }
    const comentario = e.target.closest('.cm-tarefa-comentario-texto');
    if (comentario) {
      ajustarAlturaComentario(comentario);
      const item = itemDoCampo(comentario);
      if (!item) return;
      item.comentario = _cmSerializarConteudoEditavel(comentario);
      debounce(`comentario-${chaveItem(item)}`, () => persistirComentario(item), 700);
      atualizarMencao(comentario, item, 'comentario');
    }
  });

  listaEl.addEventListener('focusout', (e) => {
    const txt = e.target.closest('.cm-tarefa-texto');
    if (txt) {
      // Um render() no meio da digitação troca o innerHTML da lista e remove esse
      // campo do DOM — isso dispara um "focusout fantasma" nele já desconectado.
      // Só processa focusout de campo que realmente perdeu o foco na tela.
      if (!txt.isConnected) return;
      const item = itemDoCampo(txt);
      if (!item) return;
      cancelarPendente(`texto-${chaveItem(item)}`);
      // Tarefa já salva com o texto apagado: o Firestore guardava o texto antigo e
      // ele "voltava" ao reabrir. Restaura e orienta a usar a lixeira.
      if (item._persisted && !(item.texto || '').trim()) {
        item.texto = item._textoSalvo || '';
        txt.innerHTML = _cmRenderConteudoComMencoes(item.texto);
        ajustarAlturaTexto(txt);
        showToast('Para excluir a tarefa, use a lixeira', 'info');
        return;
      }
      persistirTexto(item);
      return;
    }
    const comentario = e.target.closest('.cm-tarefa-comentario-texto');
    if (comentario) {
      if (!comentario.isConnected) return;
      const item = itemDoCampo(comentario);
      if (!item) return;
      cancelarPendente(`comentario-${chaveItem(item)}`);
      persistirComentario(item);
    }
  });

  // Enter no campo de texto cria uma nova tarefa/subitem logo abaixo, no mesmo
  // nível — Ctrl+Enter (ou Cmd+Enter no Mac) insere uma quebra de linha manual, e
  // Enter simples no campo de comentário também insere quebra de linha (não tem
  // "criar próximo" no comentário). Quando o popover de menção (@) está aberto no
  // campo, essas teclas pertencem a ele (navegar/confirmar/cancelar a sugestão).
  listaEl.addEventListener('keydown', async (e) => {
    const alvo = e.target.closest('.cm-tarefa-texto, .cm-tarefa-comentario-texto');
    if (!alvo) return;

    if (mencaoState && mencaoState.el === alvo) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const total = mencaoState.sugestoes.length;
        if (total) {
          mencaoState.indiceAtivo = (mencaoState.indiceAtivo + (e.key === 'ArrowDown' ? 1 : -1) + total) % total;
          renderizarPopoverMencao();
        }
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const entidade = mencaoState.sugestoes[mencaoState.indiceAtivo];
        if (entidade) confirmarMencao(entidade); else fecharMencaoPopover();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        fecharMencaoPopover();
        return;
      }
      // qualquer outra tecla (letras, backspace...) segue o fluxo normal — o
      // próprio "input" que vem em seguida recalcula a consulta de menção
    }

    if (e.key !== 'Enter') return;

    const éCampoTexto = alvo.classList.contains('cm-tarefa-texto');
    if (éCampoTexto && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const item = itemDoCampo(alvo);
      if (!item) return;
      item.texto = _cmSerializarConteudoEditavel(alvo);
      if (!item.texto.trim()) return;

      cancelarPendente(`texto-${chaveItem(item)}`);
      await persistirTexto(item);
      if (!item._persisted || item._removido || item._dia !== dia) return; // sem data, falha ao salvar ou já trocou de dia

      criarItemAposIrmao(item);
      return;
    }

    // Ctrl+Enter no campo de tarefa, ou Enter puro no campo de comentário
    e.preventDefault();
    _cmInserirQuebraLinha();
    const item = itemDoCampo(alvo);
    if (!item) return;
    const campo = éCampoTexto ? 'texto' : 'comentario';
    item[campo] = _cmSerializarConteudoEditavel(alvo);
    if (campo === 'texto') {
      ajustarAlturaTexto(alvo);
      debounce(`texto-${chaveItem(item)}`, () => persistirTexto(item), 700);
    } else {
      ajustarAlturaComentario(alvo);
      debounce(`comentario-${chaveItem(item)}`, () => persistirComentario(item), 700);
    }
  });

  // Popover de tags/copiar fecha só escondendo o próprio popover — antes fechava
  // com render(), que reconstruía a lista no meio do clique e o clique no texto
  // de outra tarefa "se perdia" (precisava clicar duas vezes).
  const esconderPopoverDaLista = (seletor) => {
    listaEl.querySelectorAll(`${seletor}.aberto`).forEach(p => p.classList.remove('aberto'));
  };

  listaEl.addEventListener('change', (e) => {
    const tagChk = e.target.closest('.cm-tag-checkbox');
    if (tagChk) {
      const item = itemDoCampo(tagChk);
      if (!item) return;
      const tags = new Set(item.tags || []);
      tagChk.checked ? tags.add(tagChk.value) : tags.delete(tagChk.value);
      persistirCampoSimples(item, 'tags', Array.from(tags));
      render();
      // render() recria o DOM do popover de tags — se ele continuar aberto, a
      // referência guardada em popoverAberto.wrap precisa apontar pro nó novo,
      // senão o próximo clique dentro dele seria lido como "clique fora".
      if (tagPopoverAbertoId && popoverAberto) {
        const wrapAtualizado = listaEl.querySelector(`.cm-tarefa-tag-wrap[data-item-id="${tagPopoverAbertoId}"]`);
        if (wrapAtualizado) popoverAberto.wrap = wrapAtualizado;
      }
    }
  });

  listaEl.addEventListener('click', async (e) => {
    if (e.target.closest('#cmTarefasBtnTentarDeNovo')) {
      carregarDia(dia.dataBR);
      return;
    }

    const chk = e.target.closest('.cm-tarefa-checkbox');
    if (chk) {
      const item = itemDoCampo(chk);
      if (!item || !item._persisted) return;
      avancarStatusTarefa(item);
      render();
      return;
    }

    const chipMencao = e.target.closest('.cm-mention-chip');
    if (chipMencao) {
      e.preventDefault();
      if (chipMencao.dataset.mencaoTipo === 'professor') {
        _cmAbrirDetalhesProfessor(chipMencao.dataset.clienteId);
      } else {
        _cmAbrirContratacaoDoCliente(chipMencao.dataset.clienteId);
      }
      return;
    }

    const handlePessoa = e.target.closest('.cm-tarefa-pessoa');
    if (handlePessoa) {
      const item = itemDoCampo(handlePessoa);
      if (!item) return;
      const pessoa = handlePessoa.dataset.pessoa;
      const novoValor = item.responsavel === pessoa ? '' : pessoa;
      persistirCampoSimples(item, 'responsavel', novoValor);
      render();
      return;
    }

    const btnColapsar = e.target.closest('.cm-tarefa-btn-colapsar');
    if (btnColapsar) {
      const id = btnColapsar.dataset.itemId;
      recolhidos.has(id) ? recolhidos.delete(id) : recolhidos.add(id);
      render();
      return;
    }

    const btnComentario = e.target.closest('.cm-tarefa-btn-comentario');
    if (btnComentario) {
      const id = btnComentario.dataset.itemId;
      comentariosAbertos.has(id) ? comentariosAbertos.delete(id) : comentariosAbertos.add(id);
      render();
      if (comentariosAbertos.has(id)) {
        const campo = listaEl.querySelector(`.cm-tarefa-comentario-texto[data-item-id="${id}"]`);
        if (campo) campo.focus();
      }
      return;
    }

    const btnFuncoesToggle = e.target.closest('.cm-tarefa-btn-funcoes-toggle');
    if (btnFuncoesToggle) {
      const id = btnFuncoesToggle.dataset.itemId;
      funcoesAbertoId = (funcoesAbertoId === id) ? null : id; // só 1 aberto por vez
      render();
      return;
    }

    const btnTag = e.target.closest('.cm-tarefa-btn-tag');
    if (btnTag) {
      const id = btnTag.dataset.itemId;
      tagPopoverAbertoId = (tagPopoverAbertoId === id) ? null : id;
      render();
      if (tagPopoverAbertoId) {
        const wrap = listaEl.querySelector(`.cm-tarefa-tag-wrap[data-item-id="${id}"]`);
        if (wrap) popoverAberto = { wrap, fechar: () => { tagPopoverAbertoId = null; esconderPopoverDaLista('.cm-tag-popover'); } };
      }
      return;
    }

    const btnHora = e.target.closest('.cm-tarefa-btn-hora');
    if (btnHora) {
      const item = itemDoCampo(btnHora);
      if (!item) return;
      _cmAbrirSeletorHora(item.prazo, (novoValor) => {
        persistirCampoSimples(item, 'prazo', novoValor);
        if (item._dia === dia) render();
      });
      return;
    }

    const btnCopiarAmanha = e.target.closest('.cm-tarefa-btn-copiar-amanha');
    if (btnCopiarAmanha) {
      const item = itemDoCampo(btnCopiarAmanha);
      if (!item) return;
      if (!item._persisted) {
        showToast('Digite o texto da tarefa antes de copiar', 'error');
        return;
      }
      copiarItemParaData(item, _cmAdicionarDias(dia.dataBR, 1));
      return;
    }

    const btnCopiarData = e.target.closest('.cm-tarefa-btn-copiar-data');
    if (btnCopiarData) {
      const id = btnCopiarData.dataset.itemId;
      const item = dia.itens.find(i => i.id === id);
      if (!item) return;
      if (!item._persisted) {
        showToast('Digite o texto da tarefa antes de copiar', 'error');
        return;
      }
      if (copiarPopoverAbertoId === id) { fecharPopoverAberto(); return; }
      const base = (dia.dataBR && _parseDataAula(dia.dataBR)) || new Date();
      copiarMes = base.getMonth();
      copiarAno = base.getFullYear();
      copiarPopoverAbertoId = id;
      render();
      const wrap = listaEl.querySelector(`.cm-tarefa-copiar-data-wrap[data-item-id="${id}"]`);
      if (wrap) popoverAberto = { wrap, fechar: () => { copiarPopoverAbertoId = null; esconderPopoverDaLista('.cm-data-picker-popover'); } };
      return;
    }

    const btnCopiarPrevMes = e.target.closest('.cm-copiar-prev-mes');
    if (btnCopiarPrevMes) {
      copiarMes--;
      if (copiarMes < 0) { copiarMes = 11; copiarAno--; }
      render();
      const wrap = listaEl.querySelector(`.cm-tarefa-copiar-data-wrap[data-item-id="${copiarPopoverAbertoId}"]`);
      if (wrap && popoverAberto) popoverAberto.wrap = wrap;
      return;
    }
    const btnCopiarNextMes = e.target.closest('.cm-copiar-next-mes');
    if (btnCopiarNextMes) {
      copiarMes++;
      if (copiarMes > 11) { copiarMes = 0; copiarAno++; }
      render();
      const wrap = listaEl.querySelector(`.cm-tarefa-copiar-data-wrap[data-item-id="${copiarPopoverAbertoId}"]`);
      if (wrap && popoverAberto) popoverAberto.wrap = wrap;
      return;
    }

    const diaCopiar = e.target.closest('.cm-tarefa-copiar-data-wrap .calendar-day');
    if (diaCopiar) {
      const item = dia.itens.find(i => i.id === copiarPopoverAbertoId);
      copiarPopoverAbertoId = null;
      popoverAberto = null;
      if (item) {
        const d = Number(diaCopiar.dataset.dia);
        const dataEscolhida = `${String(d).padStart(2, '0')}/${String(copiarMes + 1).padStart(2, '0')}/${copiarAno}`;
        copiarItemParaData(item, dataEscolhida);
      }
      render();
      return;
    }

    const btnSubtarefa = e.target.closest('.cm-tarefa-btn-subtarefa');
    if (btnSubtarefa) {
      const item = itemDoCampo(btnSubtarefa);
      if (!item) return;
      if (!item._persisted) {
        showToast('Digite o texto da tarefa antes de adicionar uma subtarefa', 'error');
        return;
      }
      recolhidos.delete(item.id);
      criarItemLocal(item.nivel + 1, item.id);
      return;
    }

    const btnExcluir = e.target.closest('.cm-tarefa-btn-excluir');
    if (btnExcluir) {
      const item = itemDoCampo(btnExcluir);
      if (!item) return;
      const ctx = dia;
      const objetosRemover = [item, ...coletarSubarvoreObjetos(item.id)];

      if (objetosRemover.some(i => i._persisted || i._criando)) {
        const confirmou = await showConfirmDialog(
          'Excluir tarefa',
          `Tem certeza que deseja excluir "${escapeHtml(_cmTextoPlano(item.texto))}"${objetosRemover.length > 1 ? ' e suas subtarefas' : ''}?`
        );
        if (!confirmou) return;
      }
      objetosRemover.forEach(i => { i._removido = true; cancelarPendente(`texto-${chaveItem(i)}`); cancelarPendente(`comentario-${chaveItem(i)}`); });
      // Os que ainda estão sendo criados se apagam sozinhos ao terminar (persistirTexto)
      const idsPersistidos = objetosRemover.filter(i => i._persisted).map(i => i.id);
      try {
        if (idsPersistidos.length) await BANCO.deleteItensTarefa(ctx.listaId, idsPersistidos);
      } catch (error) {
        console.error('❌ Erro ao excluir tarefa:', error);
        showToast('❌ Erro ao excluir tarefa', 'error');
        objetosRemover.forEach(i => { i._removido = false; });
        return;
      }

      ctx.itens = ctx.itens.filter(i => !i._removido || i._criando);
      salvarAgregados(ctx);
      if (ctx === dia) render();
    }
  });

  // ---- Arrastar e soltar (só reordena entre irmãos do mesmo pai/nível) ----
  let arrastando = null;

  listaEl.addEventListener('dragstart', (e) => {
    const handle = e.target.closest('.cm-tarefa-handle');
    if (!handle) return;
    const itemEl = handle.closest('.cm-tarefa-item');
    const item = dia.itens.find(i => i.id === itemEl?.dataset.itemId);
    if (!item) return;
    arrastando = { id: item.id, parentId: item.parentId };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', item.id); } catch (err) { /* alguns navegadores exigem, mas sem impacto se falhar */ }

    // Sem isso, o navegador usa só o iconezinho do "grip" como imagem do arraste —
    // dá a impressão de que a tarefa some da tela. Um clone da linha inteira (fora
    // da tela, removido logo em seguida) faz a linha real acompanhar o cursor.
    const rowEl = itemEl.querySelector(':scope > .cm-tarefa-row');
    if (rowEl) {
      const clone = rowEl.cloneNode(true);
      clone.classList.add('cm-tarefa-drag-preview');
      clone.style.width = `${rowEl.offsetWidth}px`;
      clone.style.position = 'absolute';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      document.body.appendChild(clone);
      try { e.dataTransfer.setDragImage(clone, 24, clone.offsetHeight / 2); } catch (err) { /* segue sem imagem customizada se falhar */ }
      setTimeout(() => clone.remove(), 0);
    }

    itemEl.classList.add('cm-tarefa-arrastando');
  });

  listaEl.addEventListener('dragend', () => {
    listaEl.querySelectorAll('.cm-tarefa-arrastando').forEach(el => el.classList.remove('cm-tarefa-arrastando'));
    listaEl.querySelectorAll('.cm-tarefa-drop-antes, .cm-tarefa-drop-depois').forEach(el => el.classList.remove('cm-tarefa-drop-antes', 'cm-tarefa-drop-depois'));
    arrastando = null;
  });

  listaEl.addEventListener('dragover', (e) => {
    if (!arrastando) return;
    const alvoEl = e.target.closest('.cm-tarefa-item');
    if (!alvoEl) return;
    const alvo = dia.itens.find(i => i.id === alvoEl.dataset.itemId);
    if (!alvo || alvo.parentId !== arrastando.parentId || alvo.id === arrastando.id) return;
    e.preventDefault();
    const rect = alvoEl.getBoundingClientRect();
    const antes = (e.clientY - rect.top) < rect.height / 2;
    listaEl.querySelectorAll('.cm-tarefa-drop-antes, .cm-tarefa-drop-depois').forEach(el => el.classList.remove('cm-tarefa-drop-antes', 'cm-tarefa-drop-depois'));
    alvoEl.classList.add(antes ? 'cm-tarefa-drop-antes' : 'cm-tarefa-drop-depois');
  });

  listaEl.addEventListener('drop', async (e) => {
    if (!arrastando) return;
    const alvoEl = e.target.closest('.cm-tarefa-item');
    const arrastandoId = arrastando.id;
    const parentIdArrastado = arrastando.parentId;
    arrastando = null;
    if (!alvoEl) return;
    const alvo = dia.itens.find(i => i.id === alvoEl.dataset.itemId);
    const item = dia.itens.find(i => i.id === arrastandoId);
    if (!alvo || !item || alvo.parentId !== parentIdArrastado || alvo.id === item.id) return;
    e.preventDefault();

    const rect = alvoEl.getBoundingClientRect();
    const antes = (e.clientY - rect.top) < rect.height / 2;

    const irmaos = filhosOrdenados(parentIdArrastado).filter(i => i.id !== item.id);
    const indiceAlvo = irmaos.findIndex(i => i.id === alvo.id);
    irmaos.splice(antes ? indiceAlvo : indiceAlvo + 1, 0, item);
    irmaos.forEach((it, idx) => { it.ordem = idx; });

    render();

    const ctx = dia;
    const persistidos = irmaos.filter(i => i._persisted).map(i => ({ id: i.id, ordem: i.ordem }));
    if (persistidos.length && ctx.listaId) {
      try {
        await BANCO.reordenarItensTarefa(ctx.listaId, persistidos);
      } catch (error) {
        console.error('❌ Erro ao reordenar tarefas:', error);
        showToast('❌ Erro ao reordenar tarefas', 'error');
      }
    }
  });

  // Excluir a lista inteira mantém o modal aberto no mesmo dia, agora vazio
  btnExcluirLista.addEventListener('click', async () => {
    const ctx = dia;
    if (!ctx.listaId) return;
    const confirmou = await showConfirmDialog('Excluir lista de tarefas', 'Tem certeza que deseja excluir esta lista de tarefas inteira?');
    if (!confirmou) return;
    btnExcluirLista.disabled = true;
    try {
      await flushPendentes();
      await aguardarFilas();
      if (ctx.listaId) await BANCO.deleteListaTarefas(ctx.listaId);
      ctx.itens.forEach(i => { i._removido = true; });
      ctx.itens = [];
      ctx.listaId = null;
      showToast('✅ Lista de tarefas excluída!', 'success');
      if (ctx === dia) {
        atualizarLabelData();
        render();
      }
    } catch (error) {
      console.error('❌ Erro ao excluir lista de tarefas:', error);
      showToast('❌ Erro ao excluir lista de tarefas', 'error');
    } finally {
      btnExcluirLista.disabled = false;
    }
  });

  // ---- Atualiza o destaque "urgente" da área de prazo a cada minuto, sem refetch ----
  intervaloUrgencia = setInterval(() => {
    listaEl.querySelectorAll('.cm-tarefa-item').forEach(el => {
      const item = dia.itens.find(i => i.id === el.dataset.itemId);
      if (!item) return;
      const btnHoraEl = el.querySelector(':scope > .cm-tarefa-row .cm-tarefa-btn-hora');
      if (btnHoraEl) btnHoraEl.classList.toggle('cm-tarefa-btn-hora-urgente', _cmEhUrgente(item, dia.dataBR));
    });
  }, 60000);

  // ---- Carga inicial ----
  render();
  if (listaIdExistente || dataPresetBR) {
    carregarDia(dataPresetBR || '', { listaId: listaIdExistente });
  }
}

window.CalMasterTarefas = {
  carregarCacheDoMes,
  renderizarBarraDia,
  iniciarAtualizacaoCores,
  abrirModalCriarTarefas,
  abrirListaTarefas
};

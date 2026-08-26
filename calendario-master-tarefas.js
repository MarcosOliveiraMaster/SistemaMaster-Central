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
//   listasTarefas/{listaId}/itens/{id} { texto, concluido, nivel(1-3), parentId,
//                                        responsavel('Marcos'|'Ester'|''), prazo('HH:MM'|''),
//                                        comentario, tags(string[], só nível 1), ordem,
//                                        ultimaEdicao, ultimaEdicaoPor, criadoEm }
// "totalItens"/"itensConcluidos" contam só os itens de nível 1 (são o que vira
// fatia na barra de progresso do dia).
// ============================================================

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

// Verdadeiro quando falta <= 2h pro prazo ou o prazo já passou (e o item não está concluído)
function _cmEhUrgente(item, dataBR) {
  if (!item || item.concluido || !item.prazo || !dataBR) return false;
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
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
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
    digitoHH.textContent = String(hora12).padStart(2, '0');
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
// GRID DO CALENDÁRIO — barra de progresso acima do quadrado do dia
// ============================================================

async function carregarCacheDoMes(mes, ano) {
  cmTarefasCacheDia = {};
  let listas = [];
  try {
    listas = await BANCO.fetchListasTarefas();
  } catch (error) {
    console.error('❌ Erro ao carregar listas de tarefas do mês:', error);
    return;
  }

  const listasDoMes = listas.filter(l => {
    const d = _parseDataAula(l.data);
    return d && d.getMonth() === mes && d.getFullYear() === ano;
  });

  await Promise.all(listasDoMes.map(async (lista) => {
    let itens = [];
    try {
      itens = await BANCO.fetchItensTarefa(lista.id);
    } catch (error) {
      console.error('❌ Erro ao carregar itens da lista de tarefas:', error);
    }
    const nivel1 = itens
      .filter(i => i.nivel === 1)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .slice(0, CM_TAREFAS_MAX_FATIAS);
    const d = _parseDataAula(lista.data);
    if (!d) return;
    cmTarefasCacheDia[d.getDate()] = { listaId: lista.id, dataBR: lista.data, itens: nivel1 };
  }));

  iniciarAtualizacaoCores();
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
        const urgente = _cmEhUrgente(item, info.dataBR);
        const classe = item.concluido ? 'cm-fatia-concluida' : (urgente ? 'cm-fatia-urgente' : '');
        return `<span class="cm-fatia ${classe}" data-item-id="${item.id}" data-dia="${dia}" title="${escapeHtml(item.texto || '')}"></span>`;
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
      el.classList.toggle('cm-fatia-urgente', !item.concluido && _cmEhUrgente(item, info.dataBR));
    });
  }, 60000);
}

// ============================================================
// MODAL "Criar tarefas" / edição de uma lista existente
// ============================================================

function abrirModalCriarTarefas() {
  abrirListaTarefas(null);
}

async function abrirListaTarefas(listaIdExistente, dataPresetBR) {
  const modoEdicao = !!listaIdExistente;
  let listaIdAtual = listaIdExistente || null;
  let dataAtualBR = dataPresetBR || '';
  let itens = [];

  if (modoEdicao) {
    try {
      const [listas, itensCarregados] = await Promise.all([
        BANCO.fetchListasTarefas(),
        BANCO.fetchItensTarefa(listaIdExistente)
      ]);
      const listaAtual = listas.find(l => l.id === listaIdExistente);
      dataAtualBR = listaAtual ? (listaAtual.data || '') : '';
      itens = itensCarregados;
      itens.forEach(i => { i._persisted = true; });
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
      showToast('❌ Erro ao carregar tarefas', 'error');
      return;
    }
  }

  let editorAtual = _cmEditorAtual();
  const filtroPessoas = new Set();       // vazio = mostra todo mundo
  const filtroTags = new Set();          // vazio = mostra todas as tags
  // ids com subárvore recolhida (só nesta sessão do modal) — ao abrir uma lista
  // existente, todo item que tem filhos já começa recolhido
  const recolhidos = new Set(
    modoEdicao ? itens.filter(i => i.parentId).map(i => i.parentId) : []
  );
  const comentariosAbertos = new Set();  // ids com o campo de comentário expandido
  let tagPopoverAbertoId = null;         // id do item com o popover de tags aberto (só 1 por vez)
  let funcoesAbertoId = null;            // id do item com a barra de ícones (tag/hora/comentário/etc.) aberta (só 1 por vez)
  let copiarPopoverAbertoId = null;      // id do item nível 1 com o popover "copiar para um dia" aberto (só 1 por vez)
  let copiarMes = 0;                     // mês/ano exibidos nesse popover (resetado toda vez que é aberto)
  let copiarAno = 0;
  let dataPickerMes = 0;
  let dataPickerAno = 0;

  const modalHtml = `
    <div class="modal-overlay" id="modalTarefasCalendario">
      <div class="modal-container cm-tarefas-modal">
        <div class="modal-header">
          <h3 class="font-lexend font-bold text-lg text-gray-800">
            <i class="fas fa-list-check text-pink-500 mr-2"></i>
            ${modoEdicao ? 'Tarefas' : 'Criar tarefas'}
          </h3>
          <button class="modal-close text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="cm-dia-navegador">
            <button type="button" id="cmDiaBtnAnterior" class="cm-dia-navegador-btn" title="Dia anterior"><i class="fas fa-chevron-left"></i></button>
            <div class="cm-dia-navegador-label" id="cmDiaNavegadorLabel">Selecione uma data</div>
            <button type="button" id="cmDiaBtnProximo" class="cm-dia-navegador-btn" title="Próximo dia"><i class="fas fa-chevron-right"></i></button>
          </div>
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
          <div id="cmTarefasLista" class="space-y-2"></div>
        </div>
        <div class="modal-footer">
          ${modoEdicao ? '<button id="cmTarefasBtnExcluirLista" class="btn-secondary btn-compact text-red-600 hover:bg-red-50"><i class="fas fa-trash mr-2"></i>Excluir lista</button>' : ''}
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

  const closeModal = () => {
    document.removeEventListener('click', onClickForaDoPopover, true);
    if (cmModalIntervaloUrgencia) clearInterval(cmModalIntervaloUrgencia);
    container.remove();
    if (typeof renderGradeCalendarioMaster === 'function') renderGradeCalendarioMaster();
  };
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  btnFechar.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

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

  // ---- Navegador de dia (seta anterior/próximo, acima da toolbar) ----
  const labelDiaNavegador = modal.querySelector('#cmDiaNavegadorLabel');
  const btnDiaAnterior = modal.querySelector('#cmDiaBtnAnterior');
  const btnDiaProximo = modal.querySelector('#cmDiaBtnProximo');

  // Fecha a lista atual (salvando qualquer edição pendente) e reabre já no dia
  // vizinho — usa a lista existente daquele dia se houver, ou entra em modo
  // "criar" com a data já preenchida, sem precisar abrir o seletor de novo.
  const navegarParaDia = async (delta) => {
    if (!dataAtualBR) {
      showToast('Selecione uma data primeiro', 'error');
      return;
    }
    await flushPendentes();
    const novaData = _cmAdicionarDias(dataAtualBR, delta);
    let listaAlvo = null;
    try {
      const listas = await BANCO.fetchListasTarefas();
      listaAlvo = listas.find(l => l.data === novaData) || null;
    } catch (error) {
      console.error('❌ Erro ao buscar lista do dia:', error);
    }
    closeModal();
    abrirListaTarefas(listaAlvo ? listaAlvo.id : null, listaAlvo ? undefined : novaData);
  };
  btnDiaAnterior.addEventListener('click', () => navegarParaDia(-1));
  btnDiaProximo.addEventListener('click', () => navegarParaDia(1));

  // ---- Seletor de data (mini-calendário com feriados, igual ao de "Detalhes da contratação") ----
  const dataWrap = modal.querySelector('#cmDataPickerWrap');
  const dataBtn = modal.querySelector('#cmTarefasDataBtn');
  const dataLabel = modal.querySelector('#cmTarefasDataLabel');
  const dataPopover = modal.querySelector('#cmTarefasDataPopover');
  const dataMonthYearEl = modal.querySelector('#cmDataMonthYear');
  const dataDaysEl = modal.querySelector('#cmDataDays');
  const dataPrevBtn = modal.querySelector('#cmDataPrevMonth');
  const dataNextBtn = modal.querySelector('#cmDataNextMonth');

  const atualizarLabelData = () => {
    dataLabel.textContent = dataAtualBR || 'Selecionar data';
    btnNova.disabled = !dataAtualBR;
    if (!dataAtualBR) {
      labelDiaNavegador.textContent = 'Selecione uma data';
      return;
    }
    const d = _parseDataAula(dataAtualBR);
    labelDiaNavegador.textContent = d ? `${CM_TAREFAS_DIAS_SEMANA_COMPLETO[d.getDay()]}, ${dataAtualBR}` : dataAtualBR;
  };

  const renderDataPicker = () => {
    dataMonthYearEl.textContent = `${CM_TAREFAS_MESES[dataPickerMes]} ${dataPickerAno}`;
    const primeiroDia = new Date(dataPickerAno, dataPickerMes, 1).getDay();
    const diasNoMes = new Date(dataPickerAno, dataPickerMes + 1, 0).getDate();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const selecionado = dataAtualBR ? _parseDataAula(dataAtualBR) : null;

    let html = '';
    for (let i = 0; i < primeiroDia; i++) html += '<div class="calendar-day-empty"></div>';
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const classes = ['calendar-day', 'cm-data-picker-day'];
      let title = '';
      if (typeof Feriados !== 'undefined' && Feriados.doDia) {
        const feriadosDoDia = Feriados.doDia(dia, dataPickerMes, dataPickerAno);
        if (feriadosDoDia.length > 0) {
          classes.push('calendar-day-feriado');
          title = feriadosDoDia.map(f => f.nome).join(', ');
        }
      }
      const dataDoDia = new Date(dataPickerAno, dataPickerMes, dia);
      const ehSelecionado = selecionado && dataDoDia.getTime() === new Date(selecionado.getFullYear(), selecionado.getMonth(), selecionado.getDate()).getTime();
      const ehHoje = dataDoDia.getTime() === hoje.getTime();
      if (ehSelecionado) classes.push('bg-orange-500', 'text-white', 'font-bold');
      else if (ehHoje) classes.push('cm-data-picker-day-hoje');
      html += `<button type="button" class="${classes.join(' ')}" data-dia="${dia}" title="${escapeHtml(title)}">${dia}</button>`;
    }
    dataDaysEl.innerHTML = html;
  };

  dataBtn.addEventListener('click', () => {
    if (dataPopover.classList.contains('aberto')) { fecharPopoverAberto(); return; }
    const base = dataAtualBR ? _parseDataAula(dataAtualBR) : new Date();
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
  dataDaysEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.cm-data-picker-day');
    if (!btn) return;
    const dia = Number(btn.dataset.dia);
    dataAtualBR = `${String(dia).padStart(2, '0')}/${String(dataPickerMes + 1).padStart(2, '0')}/${dataPickerAno}`;
    atualizarLabelData();
    fecharPopoverAberto();
    if (listaIdAtual) {
      try {
        await BANCO.updateListaTarefasData(listaIdAtual, dataAtualBR);
      } catch (error) {
        console.error('❌ Erro ao atualizar data da lista de tarefas:', error);
        showToast('❌ Erro ao atualizar data', 'error');
      }
    }
    render();
  });

  if (dataAtualBR) {
    const base = _parseDataAula(dataAtualBR);
    dataPickerMes = base.getMonth();
    dataPickerAno = base.getFullYear();
  } else {
    const hoje = new Date();
    dataPickerMes = hoje.getMonth();
    dataPickerAno = hoje.getFullYear();
  }
  atualizarLabelData();

  // ---- Helpers de árvore ----
  const filhosOrdenados = (parentId) => itens
    .filter(i => i.parentId === parentId)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const proximaOrdem = (parentId) => {
    const irmaos = itens.filter(i => i.parentId === parentId);
    if (!irmaos.length) return 0;
    return Math.max(...irmaos.map(i => i.ordem ?? 0)) + 1;
  };

  // Todos os descendentes (objetos completos) de um item, em qualquer profundidade
  const coletarSubarvoreObjetos = (itemId) => {
    const diretos = itens.filter(i => i.parentId === itemId);
    return diretos.reduce((acc, filho) => acc.concat(filho, coletarSubarvoreObjetos(filho.id)), []);
  };

  // ---- Copiar tarefa (nível 1) + toda a subárvore pra outro dia ----
  // Sempre copia (não move): o item original continua no dia atual. A cópia nasce
  // sempre desmarcada (BANCO.addItemTarefa já força concluido:false) e entra no fim
  // da lista de nível 1 do dia de destino, seja ele um dia com lista existente ou não.
  const copiarItemParaData = async (itemOrigem, dataDestinoBR) => {
    try {
      const listas = await BANCO.fetchListasTarefas();
      const listaDestino = listas.find(l => l.data === dataDestinoBR);
      const listaDestinoId = listaDestino ? listaDestino.id : await BANCO.addListaTarefas(dataDestinoBR);

      const itensExistentesDestino = await BANCO.fetchItensTarefa(listaDestinoId);
      const nivel1Existentes = itensExistentesDestino.filter(i => i.nivel === 1);
      const ordemInicial = nivel1Existentes.length ? Math.max(...nivel1Existentes.map(i => i.ordem ?? 0)) + 1 : 0;

      const mapaIds = new Map(); // id no dia de origem -> id novo no dia de destino
      const novoIdPrincipal = await BANCO.addItemTarefa(listaDestinoId, {
        texto: itemOrigem.texto, nivel: 1, parentId: null,
        responsavel: itemOrigem.responsavel || '', prazo: itemOrigem.prazo || '',
        comentario: itemOrigem.comentario || '', tags: itemOrigem.tags || [],
        ordem: ordemInicial, ultimaEdicaoPor: editorAtual
      });
      mapaIds.set(itemOrigem.id, novoIdPrincipal);

      const subarvore = coletarSubarvoreObjetos(itemOrigem.id).sort((a, b) => a.nivel - b.nivel);
      for (const filho of subarvore) {
        const novoId = await BANCO.addItemTarefa(listaDestinoId, {
          texto: filho.texto, nivel: filho.nivel, parentId: mapaIds.get(filho.parentId),
          responsavel: filho.responsavel || '', prazo: filho.prazo || '',
          comentario: filho.comentario || '', tags: filho.tags || [],
          ordem: filho.ordem ?? 0, ultimaEdicaoPor: editorAtual
        });
        mapaIds.set(filho.id, novoId);
      }

      const itensFinaisDestino = await BANCO.fetchItensTarefa(listaDestinoId);
      const nivel1Finais = itensFinaisDestino.filter(i => i.nivel === 1);
      await BANCO.atualizarAgregadosListaTarefas(listaDestinoId, nivel1Finais.length, nivel1Finais.filter(i => i.concluido).length);

      showToast(`✅ "${itemOrigem.texto}" copiada para ${dataDestinoBR}!`, 'success');

      // se o destino é o próprio dia aberto no modal agora, reflete os itens novos na tela
      if (listaDestinoId === listaIdAtual) {
        itens = itensFinaisDestino.map(i => ({ ...i, _persisted: true }));
        render();
      }
    } catch (error) {
      console.error('❌ Erro ao copiar tarefa:', error);
      showToast('❌ Erro ao copiar tarefa', 'error');
    }
  };

  // ---- Renderização da árvore (até 3 níveis) ----
  const renderNode = (item) => {
    const filhos = filhosOrdenados(item.id);
    const temFilhos = filhos.length > 0;
    const podeVirarSubtarefa = item.nivel < 3;
    const desabilitarCheckbox = temFilhos || !item._persisted;
    const meta = item._persisted ? _cmFormatarMeta(item) : '';
    const responsavelAtual = item.responsavel || '';
    const recolhido = recolhidos.has(item.id);
    const comentarioAberto = comentariosAbertos.has(item.id);
    const urgente = _cmEhUrgente(item, dataAtualBR);
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

    return `
      <div class="cm-tarefa-item cm-tarefa-nivel-${item.nivel}" data-item-id="${item.id}">
        <div class="cm-tarefa-row">
          <span class="cm-tarefa-handle" draggable="true" title="Arrastar para reordenar"><i class="fas fa-grip-vertical"></i></span>
          ${temFilhos
            ? `<button type="button" class="cm-tarefa-btn-colapsar" data-item-id="${item.id}" title="${recolhido ? 'Expandir' : 'Recolher'}"><i class="fas fa-chevron-${recolhido ? 'right' : 'down'}"></i></button>`
            : '<span class="cm-tarefa-colapsar-espaco"></span>'}
          <input type="checkbox" class="cm-tarefa-checkbox" data-item-id="${item.id}" ${item.concluido ? 'checked' : ''} ${desabilitarCheckbox ? 'disabled' : ''}>
          <textarea class="cm-tarefa-texto" data-item-id="${item.id}" placeholder="Descreva a tarefa..." rows="1">${escapeHtml(item.texto || '')}</textarea>
          ${funcoesAberto ? `<span class="cm-tarefa-divisor"></span><div class="cm-tarefa-funcoes">${funcoesHtml}</div>` : ''}
          <button type="button" class="cm-tarefa-btn-funcoes-toggle${funcoesAberto ? ' ativo' : ''}" data-item-id="${item.id}" title="${funcoesAberto ? 'Esconder ações' : 'Mostrar ações'}">
            <i class="fas fa-grip-lines-vertical"></i>
          </button>
        </div>
        ${(item.nivel === 1 && tags.length) ? `<div class="cm-tarefa-tags">${tags.map(t => `<span class="cm-tag-chip">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${meta ? `<div class="cm-tarefa-meta">${escapeHtml(meta)}</div>` : ''}
        <div class="cm-tarefa-comentario-wrap${comentarioAberto ? ' aberto' : ''}" data-item-id="${item.id}">
          <textarea class="cm-tarefa-comentario-texto" data-item-id="${item.id}" placeholder="Escreva um comentário...">${escapeHtml(item.comentario || '')}</textarea>
        </div>
        ${(temFilhos && !recolhido) ? `<div class="cm-tarefa-filhos">${filhos.map(renderNode).join('')}</div>` : ''}
      </div>
    `;
  };

  // render() é chamado várias vezes em sequência pra uma mesma ação (ex.: Enter
  // cria+foca o item novo, e o persistirTexto do item ANTERIOR — que roda em
  // paralelo, sem bloquear — termina um instante depois e chama render() de novo,
  // já que ele reconstrói o innerHTML da lista inteira). Sem isso, esse segundo
  // render() trocaria o nó do campo recém-focado por um novo e derrubaria o foco
  // — daí o "seleciona e desseleciona". Por isso o próprio render() sempre guarda
  // e restaura foco+cursor do campo de texto ativo, não importa quem o chamou.
  const render = () => {
    const ativo = document.activeElement;
    const focoAtivo = (ativo && ativo.classList && ativo.classList.contains('cm-tarefa-texto') && listaEl.contains(ativo))
      ? { id: ativo.dataset.itemId, cursor: ativo.selectionStart }
      : null;

    let raiz = filhosOrdenados(null);
    if (filtroPessoas.size > 0) raiz = raiz.filter(i => filtroPessoas.has(i.responsavel));
    if (filtroTags.size > 0) raiz = raiz.filter(i => (i.tags || []).some(t => filtroTags.has(t)));
    listaEl.innerHTML = raiz.length
      ? raiz.map(renderNode).join('')
      : `<p class="text-sm text-gray-400 text-center py-4">${(filtroPessoas.size || filtroTags.size) ? 'Nenhuma tarefa encontrada para esse filtro.' : 'Nenhuma tarefa ainda.'}</p>`;
    ajustarAlturasComentarios();
    ajustarAlturasTextos();
    posicionarMetas();

    if (focoAtivo) {
      const el = listaEl.querySelector(`.cm-tarefa-texto[data-item-id="${focoAtivo.id}"]`);
      if (el) {
        el.focus();
        const pos = focoAtivo.cursor != null ? Math.min(focoAtivo.cursor, el.value.length) : el.value.length;
        el.setSelectionRange(pos, pos);
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
  const posicionarMetas = () => {
    listaEl.querySelectorAll('.cm-tarefa-item').forEach(itemEl => {
      const meta = itemEl.querySelector(':scope > .cm-tarefa-meta');
      const texto = itemEl.querySelector(':scope > .cm-tarefa-row > .cm-tarefa-texto');
      if (!meta || !texto) return;
      const distancia = itemEl.getBoundingClientRect().right - texto.getBoundingClientRect().right;
      meta.style.marginRight = `${Math.max(distancia, 0)}px`;
    });
  };

  render();

  // ---- Agregados (total/concluídos de nível 1) exibidos na barra do grid ----
  const salvarAgregados = async () => {
    if (!listaIdAtual) return;
    const persistidosNivel1 = itens.filter(i => i._persisted && i.nivel === 1);
    const total = persistidosNivel1.length;
    const concluidos = persistidosNivel1.filter(i => i.concluido).length;
    if (total === 0 && itens.filter(i => i._persisted).length === 0) {
      try {
        await BANCO.deleteListaTarefas(listaIdAtual);
      } catch (error) {
        console.error('❌ Erro ao excluir lista vazia de tarefas:', error);
      }
      listaIdAtual = null;
      // Sem isso, o botão de Data continuava mostrando a data da lista excluída
      // e "Nova Tarefa" seguia habilitado — dando a impressão de que o
      // preenchimento anterior "voltava" mesmo com a lista já apagada.
      dataAtualBR = '';
      atualizarLabelData();
      return;
    }
    try {
      await BANCO.atualizarAgregadosListaTarefas(listaIdAtual, total, concluidos);
    } catch (error) {
      console.error('❌ Erro ao atualizar agregados da lista de tarefas:', error);
    }
  };

  // ---- Cascata de auto-conclusão bidirecional ----
  const recalcularCascata = (node) => {
    if (!node) return;
    const filhos = itens.filter(i => i.parentId === node.id);
    if (filhos.length > 0) {
      const todosConcluidos = filhos.every(f => f.concluido);
      if (node.concluido !== todosConcluidos) {
        node.concluido = todosConcluidos;
        node.ultimaEdicao = new Date();
        node.ultimaEdicaoPor = editorAtual;
        if (node._persisted) {
          BANCO.updateItemTarefa(listaIdAtual, node.id, { concluido: node.concluido, ultimaEdicaoPor: editorAtual })
            .catch(err => console.error('❌ Erro ao atualizar tarefa:', err));
        }
      }
    }
    if (node.parentId) recalcularCascata(itens.find(i => i.id === node.parentId));
  };

  // Foca (e posiciona o cursor no fim de) o campo de texto do item recém-criado.
  // Chama .focus() direto, de forma síncrona — o item já existe no DOM assim que
  // render() (innerHTML) retorna, não precisa esperar nada. requestAnimationFrame
  // NÃO é seguro aqui: o navegador pausa rAF em abas fora de foco/minimizadas, e
  // nessas condições o foco nunca era aplicado (bug real, confirmado em teste).
  const focarItem = (id) => {
    const inputNovo = listaEl.querySelector(`.cm-tarefa-texto[data-item-id="${id}"]`);
    if (!inputNovo) return;
    inputNovo.focus();
    const posicao = inputNovo.value.length;
    inputNovo.setSelectionRange(posicao, posicao);
  };

  // ---- Criação de item local ----
  const criarItemLocal = (nivel, parentId) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    itens.push({
      id: tempId, texto: '', concluido: false, nivel, parentId,
      responsavel: '', prazo: '', comentario: '', tags: [], ordem: proximaOrdem(parentId),
      ultimaEdicao: null, ultimaEdicaoPor: '', _persisted: false
    });
    render();
    focarItem(tempId);
  };

  // Cria um item novo logo ABAIXO de "itemAtual" (mesmo pai/nível) — usado ao apertar
  // Enter no campo de texto. Renumera a ordem dos irmãos e persiste, igual ao
  // arrastar-e-soltar, pra o item entrar na posição certa (não no fim da lista).
  const criarItemAposIrmao = (itemAtual) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const novoItem = {
      id: tempId, texto: '', concluido: false, nivel: itemAtual.nivel, parentId: itemAtual.parentId,
      responsavel: '', prazo: '', comentario: '', tags: [], ordem: 0,
      ultimaEdicao: null, ultimaEdicaoPor: '', _persisted: false
    };
    const irmaos = filhosOrdenados(itemAtual.parentId);
    const indiceAtual = irmaos.findIndex(i => i.id === itemAtual.id);
    irmaos.splice(indiceAtual + 1, 0, novoItem);
    irmaos.forEach((it, idx) => { it.ordem = idx; });
    itens.push(novoItem);

    const persistidos = irmaos.filter(i => i._persisted && i.id !== novoItem.id).map(i => ({ id: i.id, ordem: i.ordem }));
    if (persistidos.length && listaIdAtual) {
      BANCO.reordenarItensTarefa(listaIdAtual, persistidos).catch(err => console.error('❌ Erro ao reordenar tarefas:', err));
    }

    render();
    focarItem(tempId);
  };

  btnNova.addEventListener('click', () => {
    if (!dataAtualBR) {
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
    showToast('✅ Alterações salvas!', 'success');
  });

  // ---- Persistência do texto (cria o item — e a lista, se ainda não existir — ao sair do campo) ----
  const persistirTexto = async (item) => {
    const textoLimpo = (item.texto || '').trim();
    if (!textoLimpo) return; // itens sem texto não são salvos
    try {
      if (!item._persisted) {
        if (!listaIdAtual) {
          if (!dataAtualBR) {
            showToast('Selecione a data antes de adicionar uma tarefa', 'error');
            return;
          }
          listaIdAtual = await BANCO.addListaTarefas(dataAtualBR);
        }
        const novoId = await BANCO.addItemTarefa(listaIdAtual, {
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
        item.ultimaEdicao = new Date();
        item.ultimaEdicaoPor = editorAtual;
        itens.forEach(i => { if (i.parentId === idAntigo) i.parentId = novoId; });
      } else {
        await BANCO.updateItemTarefa(listaIdAtual, item.id, { texto: textoLimpo, ultimaEdicaoPor: editorAtual });
        item.ultimaEdicao = new Date();
        item.ultimaEdicaoPor = editorAtual;
      }
      await salvarAgregados();
      render();
    } catch (error) {
      console.error('❌ Erro ao salvar tarefa:', error);
      showToast('❌ Erro ao salvar tarefa', 'error');
    }
  };

  const persistirComentario = async (item) => {
    if (!item._persisted) return;
    const campoTexto = listaEl.querySelector(`.cm-tarefa-comentario-texto[data-item-id="${item.id}"]`);
    const valor = campoTexto ? campoTexto.value : (item.comentario || '');
    await persistirCampoSimples(item, 'comentario', valor);
  };

  listaEl.addEventListener('input', (e) => {
    const txt = e.target.closest('.cm-tarefa-texto');
    if (txt) {
      ajustarAlturaTexto(txt);
      const item = itens.find(i => i.id === txt.dataset.itemId);
      if (!item) return;
      item.texto = txt.value;
      debounce(`texto-${item.id}`, () => persistirTexto(item), 700);
      return;
    }
    const comentario = e.target.closest('.cm-tarefa-comentario-texto');
    if (comentario) {
      ajustarAlturaComentario(comentario);
      const item = itens.find(i => i.id === comentario.dataset.itemId);
      if (!item) return;
      item.comentario = comentario.value;
      debounce(`comentario-${item.id}`, () => persistirComentario(item), 700);
    }
  });

  listaEl.addEventListener('focusout', (e) => {
    const txt = e.target.closest('.cm-tarefa-texto');
    if (txt) {
      // Um render() no meio da digitação (ex.: criar o próximo item com Enter)
      // troca o innerHTML da lista e remove esse campo do DOM — isso dispara um
      // "focusout fantasma" nele mesmo já desconectado. Reagir a esse evento
      // chamaria persistirTexto()+render() de novo bem depois do foco já ter
      // sido movido pro item novo, derrubando esse foco. Só processa focusout
      // de campo que realmente perdeu o foco enquanto ainda estava na tela.
      if (!txt.isConnected) return;
      const item = itens.find(i => i.id === txt.dataset.itemId);
      if (!item) return;
      if (pendentes[`texto-${item.id}`]) {
        clearTimeout(pendentes[`texto-${item.id}`].timeoutId);
        delete pendentes[`texto-${item.id}`];
      }
      persistirTexto(item);
      return;
    }
    const comentario = e.target.closest('.cm-tarefa-comentario-texto');
    if (comentario) {
      if (!comentario.isConnected) return;
      const item = itens.find(i => i.id === comentario.dataset.itemId);
      if (!item) return;
      if (pendentes[`comentario-${item.id}`]) {
        clearTimeout(pendentes[`comentario-${item.id}`].timeoutId);
        delete pendentes[`comentario-${item.id}`];
      }
      persistirComentario(item);
    }
  });

  // Enter no campo de texto cria uma nova tarefa/subitem logo abaixo, no mesmo
  // nível — Ctrl+Enter (ou Cmd+Enter no Mac) insere uma quebra de linha normalmente.
  listaEl.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const txt = e.target.closest('.cm-tarefa-texto');
    if (!txt) return;
    if (e.ctrlKey || e.metaKey) return; // deixa o textarea quebrar a linha normalmente

    e.preventDefault();
    const item = itens.find(i => i.id === txt.dataset.itemId);
    if (!item || !txt.value.trim()) return;

    if (pendentes[`texto-${item.id}`]) {
      clearTimeout(pendentes[`texto-${item.id}`].timeoutId);
      delete pendentes[`texto-${item.id}`];
    }
    await persistirTexto(item);
    if (!item._persisted) return; // sem data selecionada ou falha ao salvar — não cria o próximo

    criarItemAposIrmao(item);
  });

  const persistirCampoSimples = async (item, campo, valor) => {
    item[campo] = valor;
    item.ultimaEdicao = new Date();
    item.ultimaEdicaoPor = editorAtual;
    if (!item._persisted) return; // só grava quando o item já existe no Firestore
    try {
      await BANCO.updateItemTarefa(listaIdAtual, item.id, { [campo]: valor, ultimaEdicaoPor: editorAtual });
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${campo} da tarefa:`, error);
      showToast(`❌ Erro ao atualizar ${campo}`, 'error');
    }
  };

  listaEl.addEventListener('change', async (e) => {
    const chk = e.target.closest('.cm-tarefa-checkbox');
    if (chk) {
      const item = itens.find(i => i.id === chk.dataset.itemId);
      if (!item || !item._persisted) return;
      item.concluido = chk.checked;
      item.ultimaEdicao = new Date();
      item.ultimaEdicaoPor = editorAtual;
      try {
        await BANCO.updateItemTarefa(listaIdAtual, item.id, { concluido: item.concluido, ultimaEdicaoPor: editorAtual });
      } catch (error) {
        console.error('❌ Erro ao atualizar tarefa:', error);
        showToast('❌ Erro ao atualizar tarefa', 'error');
      }
      if (item.parentId) recalcularCascata(itens.find(i => i.id === item.parentId));
      await salvarAgregados();
      render();
      return;
    }

    const tagChk = e.target.closest('.cm-tag-checkbox');
    if (tagChk) {
      const item = itens.find(i => i.id === tagChk.dataset.itemId);
      if (!item) return;
      const tags = new Set(item.tags || []);
      tagChk.checked ? tags.add(tagChk.value) : tags.delete(tagChk.value);
      await persistirCampoSimples(item, 'tags', Array.from(tags));
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
    const handlePessoa = e.target.closest('.cm-tarefa-pessoa');
    if (handlePessoa) {
      const item = itens.find(i => i.id === handlePessoa.dataset.itemId);
      if (!item) return;
      const pessoa = handlePessoa.dataset.pessoa;
      const novoValor = item.responsavel === pessoa ? '' : pessoa;
      await persistirCampoSimples(item, 'responsavel', novoValor);
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
        if (wrap) popoverAberto = { wrap, fechar: () => { tagPopoverAbertoId = null; render(); } };
      }
      return;
    }

    const btnHora = e.target.closest('.cm-tarefa-btn-hora');
    if (btnHora) {
      const item = itens.find(i => i.id === btnHora.dataset.itemId);
      if (!item) return;
      _cmAbrirSeletorHora(item.prazo, async (novoValor) => {
        await persistirCampoSimples(item, 'prazo', novoValor);
        render();
      });
      return;
    }

    const btnCopiarAmanha = e.target.closest('.cm-tarefa-btn-copiar-amanha');
    if (btnCopiarAmanha) {
      const item = itens.find(i => i.id === btnCopiarAmanha.dataset.itemId);
      if (!item) return;
      if (!item._persisted) {
        showToast('Digite o texto da tarefa antes de copiar', 'error');
        return;
      }
      copiarItemParaData(item, _cmAdicionarDias(dataAtualBR, 1));
      return;
    }

    const btnCopiarData = e.target.closest('.cm-tarefa-btn-copiar-data');
    if (btnCopiarData) {
      const id = btnCopiarData.dataset.itemId;
      const item = itens.find(i => i.id === id);
      if (!item) return;
      if (!item._persisted) {
        showToast('Digite o texto da tarefa antes de copiar', 'error');
        return;
      }
      if (copiarPopoverAbertoId === id) { copiarPopoverAbertoId = null; render(); return; }
      const base = dataAtualBR ? _parseDataAula(dataAtualBR) : new Date();
      copiarMes = base.getMonth();
      copiarAno = base.getFullYear();
      copiarPopoverAbertoId = id;
      render();
      const wrap = listaEl.querySelector(`.cm-tarefa-copiar-data-wrap[data-item-id="${id}"]`);
      if (wrap) popoverAberto = { wrap, fechar: () => { copiarPopoverAbertoId = null; render(); } };
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
      const item = itens.find(i => i.id === copiarPopoverAbertoId);
      copiarPopoverAbertoId = null;
      if (item) {
        const dia = Number(diaCopiar.dataset.dia);
        const dataEscolhida = `${String(dia).padStart(2, '0')}/${String(copiarMes + 1).padStart(2, '0')}/${copiarAno}`;
        copiarItemParaData(item, dataEscolhida);
      }
      render();
      return;
    }

    const btnSubtarefa = e.target.closest('.cm-tarefa-btn-subtarefa');
    if (btnSubtarefa) {
      const item = itens.find(i => i.id === btnSubtarefa.dataset.itemId);
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
      const item = itens.find(i => i.id === btnExcluir.dataset.itemId);
      if (!item) return;

      const coletarDescendentes = (itemId) => {
        const diretos = itens.filter(i => i.parentId === itemId);
        return diretos.reduce((acc, filho) => acc.concat(filho.id, coletarDescendentes(filho.id)), []);
      };
      const idsRemover = [item.id, ...coletarDescendentes(item.id)];

      if (item._persisted) {
        const confirmou = await showConfirmDialog(
          'Excluir tarefa',
          `Tem certeza que deseja excluir "${escapeHtml(item.texto || '')}"${idsRemover.length > 1 ? ' e suas subtarefas' : ''}?`
        );
        if (!confirmou) return;
        const idsPersistidos = itens.filter(i => idsRemover.includes(i.id) && i._persisted).map(i => i.id);
        try {
          if (idsPersistidos.length) await BANCO.deleteItensTarefa(listaIdAtual, idsPersistidos);
        } catch (error) {
          console.error('❌ Erro ao excluir tarefa:', error);
          showToast('❌ Erro ao excluir tarefa', 'error');
          return;
        }
      }

      const paiId = item.parentId;
      itens = itens.filter(i => !idsRemover.includes(i.id));
      if (paiId) recalcularCascata(itens.find(i => i.id === paiId));
      await salvarAgregados();
      render();
    }
  });

  // ---- Arrastar e soltar (só reordena entre irmãos do mesmo pai/nível) ----
  let arrastando = null;

  listaEl.addEventListener('dragstart', (e) => {
    const handle = e.target.closest('.cm-tarefa-handle');
    if (!handle) return;
    const itemEl = handle.closest('.cm-tarefa-item');
    const item = itens.find(i => i.id === itemEl?.dataset.itemId);
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
    const alvo = itens.find(i => i.id === alvoEl.dataset.itemId);
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
    const alvo = itens.find(i => i.id === alvoEl.dataset.itemId);
    const item = itens.find(i => i.id === arrastandoId);
    if (!alvo || !item || alvo.parentId !== parentIdArrastado || alvo.id === item.id) return;
    e.preventDefault();

    const rect = alvoEl.getBoundingClientRect();
    const antes = (e.clientY - rect.top) < rect.height / 2;

    const irmaos = filhosOrdenados(parentIdArrastado).filter(i => i.id !== item.id);
    const indiceAlvo = irmaos.findIndex(i => i.id === alvo.id);
    irmaos.splice(antes ? indiceAlvo : indiceAlvo + 1, 0, item);
    irmaos.forEach((it, idx) => { it.ordem = idx; });

    render();

    const persistidos = irmaos.filter(i => i._persisted).map(i => ({ id: i.id, ordem: i.ordem }));
    if (persistidos.length && listaIdAtual) {
      try {
        await BANCO.reordenarItensTarefa(listaIdAtual, persistidos);
      } catch (error) {
        console.error('❌ Erro ao reordenar tarefas:', error);
        showToast('❌ Erro ao reordenar tarefas', 'error');
      }
    }
  });

  if (btnExcluirLista) {
    btnExcluirLista.addEventListener('click', async () => {
      if (!listaIdAtual) { closeModal(); return; }
      const confirmou = await showConfirmDialog('Excluir lista de tarefas', 'Tem certeza que deseja excluir esta lista de tarefas inteira?');
      if (!confirmou) return;
      btnExcluirLista.disabled = true;
      try {
        await BANCO.deleteListaTarefas(listaIdAtual);
        showToast('✅ Lista de tarefas excluída!', 'success');
        closeModal();
      } catch (error) {
        console.error('❌ Erro ao excluir lista de tarefas:', error);
        showToast('❌ Erro ao excluir lista de tarefas', 'error');
        btnExcluirLista.disabled = false;
      }
    });
  }

  // ---- Atualiza o destaque "urgente" da área de prazo a cada minuto, sem refetch ----
  var cmModalIntervaloUrgencia = setInterval(() => {
    listaEl.querySelectorAll('.cm-tarefa-item').forEach(el => {
      const item = itens.find(i => i.id === el.dataset.itemId);
      if (!item) return;
      const btnHoraEl = el.querySelector(':scope > .cm-tarefa-row .cm-tarefa-btn-hora');
      if (btnHoraEl) btnHoraEl.classList.toggle('cm-tarefa-btn-hora-urgente', _cmEhUrgente(item, dataAtualBR));
    });
  }, 60000);
}

window.CalMasterTarefas = {
  carregarCacheDoMes,
  renderizarBarraDia,
  iniciarAtualizacaoCores,
  abrirModalCriarTarefas,
  abrirListaTarefas
};

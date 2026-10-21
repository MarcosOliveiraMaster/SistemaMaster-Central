console.log('✅ detalhes-contratacao-v2.js carregado');

// Versão principal do modal Detalhes da Contratação (functions-banco-de-aulas-Cards.js).
// viewAulaDetails monta a versão antiga e chama abrir() logo em seguida: esta camada
// cobre a tela com outro layout — cabeçalho, menu lateral, tabela de Aulas Agendadas e
// cartões à direita —, mas NÃO duplica nenhuma função: os elementos da versão antiga
// (botões, tabela, valores) são movidos para cá com os listeners intactos e voltam ao
// lugar original em "Visualizar versão antiga".
//
// A camada é anexada DENTRO do .modal-overlay da versão antiga porque vários handlers
// de lá usam modal.querySelector(...) (Salvar Alterações, Editar valores, NF-e). Como
// os submodais são anexados depois ao body, com o mesmo z-index, continuam aparecendo
// por cima desta camada. O ESC continua com o handler da versão antiga (fecha o modal).
window.DetalhesContratacaoV2 = (function () {
  'use strict';

  let ativo = null; // { el, overlayV1, movidos, rotulos, observer, info, infoEstavaOculta }

  // Menus laterais recolhidos (só ícones): preferência salva no navegador, uma por lado.
  // Só tem efeito em telas largas (> 1180px) — abaixo disso o CSS ignora as classes.
  const LADOS = {
    nav: { chave: 'mdc2_navRecolhido', classe: 'mdc2-nav-recolhida', botao: 'recolher-nav', rotulo: 'menu de ações' },
    lateral: { chave: 'mdc2_lateralRecolhida', classe: 'mdc2-lateral-recolhida', botao: 'recolher-lateral', rotulo: 'painel de valores' }
  };
  function lerRecolhido(lado) {
    try { return localStorage.getItem(LADOS[lado].chave) === '1'; } catch (e) { return false; }
  }
  function salvarRecolhido(lado, recolhido) {
    try { localStorage.setItem(LADOS[lado].chave, recolhido ? '1' : '0'); } catch (e) { /* sem armazenamento local */ }
  }
  function aplicarRecolhido(el, lado, recolhido) {
    const { classe, botao, rotulo } = LADOS[lado];
    el.classList.toggle(classe, recolhido);
    const btn = el.querySelector(`[data-v2="${botao}"]`);
    btn.setAttribute('aria-expanded', String(!recolhido));
    btn.setAttribute('aria-label', (recolhido ? 'Expandir ' : 'Recolher ') + rotulo);
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Rótulos que mudam só nesta versão (voltam ao original na versão antiga).
  const ROTULOS_ACOES = {
    '#btn-editar-contratacao': 'Editar dados da contratação',
    '#btn-gerar-contrato': 'Imprimir contrato',
    '#btn-ver-observacoes': 'Observações da contratação'
  };

  // Tom do chip a partir do texto do status (o sistema não tem uma lista fechada).
  function tomStatus(texto) {
    const t = String(texto || '').toLowerCase();
    if (!t) return 'neutro';
    if (/cancel|atras|inadimpl|vencid|suspens/.test(t)) return 'perigo';
    if (/conclu|finaliz|pago|quitad|assinad|complet|em dia/.test(t)) return 'ok';
    return 'atencao';
  }

  function chip(texto, tom) {
    return `<span class="mdc2-chip" data-tom="${tom}"><span class="mdc2-chip-ponto"></span><span class="mdc2-chip-texto">${esc(texto)}</span></span>`;
  }

  function mover(node, destino) {
    if (!node || !destino) return;
    ativo.movidos.push({ node, parent: node.parentNode, next: node.nextSibling });
    destino.appendChild(node);
  }

  // Ordem inversa: o "next" de cada nó já está de volta quando ele é reinserido.
  function restaurarMovidos() {
    for (let i = ativo.movidos.length - 1; i >= 0; i--) {
      const { node, parent, next } = ativo.movidos[i];
      if (!parent) continue;
      parent.insertBefore(node, next && next.parentNode === parent ? next : null);
    }
    ativo.movidos = [];
  }

  // O texto dos botões de Ações fica no último <span> (o primeiro guarda o ícone).
  function renomear(btn, novo) {
    const alvo = btn && btn.querySelector('span:last-of-type');
    if (!alvo) return;
    ativo.rotulos.push({ alvo, original: alvo.textContent });
    alvo.textContent = novo;
  }

  const parseBR = (txt) => {
    const n = Number(String(txt || '').replace(/[^\d,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const moeda = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const horasDecimais = (txt) => {
    const m = String(txt || '').match(/(\d+)\s*h\s*(\d{1,2})?/);
    return m ? (parseInt(m[1], 10) || 0) + (m[2] ? parseInt(m[2], 10) / 60 : 0) : 0;
  };

  // Lucro por aula = Lucro Master por hora (o mesmo valor editado em "Editar valores");
  // contratos antigos sem a taxa salva: lucro total ÷ total de horas.
  // Total por aula = hora/aula do professor + lucro por hora.
  function atualizarValoresPorAula() {
    if (!ativo) return;
    const el = ativo.el;
    const elLucro = document.getElementById('display-lucro-master-contrato');
    const elHora = document.getElementById('display-hora-aula-contrato');
    const elTotalHoras = document.getElementById('display-total-horas-contrato');
    if (!elLucro || !elHora) return;

    let lucroHora;
    if (elLucro.dataset.porHora !== undefined && elLucro.dataset.porHora !== '') {
      lucroHora = Number(elLucro.dataset.porHora) || 0;
    } else {
      const horas = horasDecimais(elTotalHoras && elTotalHoras.textContent);
      lucroHora = horas > 0 ? parseBR(elLucro.textContent) / horas : 0;
    }
    const horaProf = parseBR(elHora.textContent);

    const set = (chave, valor) => {
      const n = el.querySelector(`[data-v2="${chave}"]`);
      if (n && n.textContent !== valor) n.textContent = valor;
    };
    set('lucro-aula', moeda(lucroHora));
    set('total-aula', moeda(horaProf + lucroHora));
  }

  // "Horas contratadas": total do pacote fixado quando a simulação foi aprovada
  // (BancoDeAulas.horasContratadas, texto "12h30"). Diferente de "Total de horas",
  // não acompanha as aulas adicionadas/removidas depois — só muda pelo lápis.
  // Contratações antigas ficam vazias até alguém preencher.
  function mascaraHoras(txt) {
    const bruto = String(txt || '');
    const iH = bruto.toLowerCase().indexOf('h');
    const depois = iH >= 0 ? bruto.slice(iH + 1).replace(/\D/g, '') : '';
    if (iH >= 0 && depois.length <= 2) {
      // Com "h": horas antes dele, até 2 dígitos de minutos depois.
      const h = bruto.slice(0, iH).replace(/\D/g, '').slice(0, 3);
      return h ? `${h}h${depois}` : '';
    }
    // Só números (ou um 3º dígito depois do "h" automático): os 2 últimos são os
    // minutos e o "h" anda junto ("1" → "12" → "1h23" → "12h30").
    const d = bruto.replace(/\D/g, '').slice(0, 5);
    return d.length <= 2 ? d : `${d.slice(0, -2)}h${d.slice(-2)}`;
  }

  // Valor final a gravar: "" (vazio), "12h30"; só horas vira "12h00".
  // null = inválido (minutos acima de 59).
  function normalizarHoras(txt) {
    const v = mascaraHoras(txt);
    if (!v) return '';
    const [h, m = ''] = v.split('h');
    const min = m.padStart(2, '0');
    if (Number(min) > 59) return null;
    return `${Number(h)}h${min}`;
  }

  function montarHorasContratadas(slotEl, aula) {
    const codigo = aula.codigoContratacao;
    let valor = aula.horasContratadas || '';

    const exibir = () => {
      slotEl.innerHTML = `
        <span class="mdc2-horas-texto">${valor ? esc(valor) : '—'}</span>
        ${codigo ? '<button type="button" class="mdc2-horas-editar" title="Editar horas contratadas" aria-label="Editar horas contratadas"><i class="fas fa-pencil-alt"></i></button>' : ''}`;
      const btn = slotEl.querySelector('.mdc2-horas-editar');
      if (btn) btn.addEventListener('click', editar);
    };

    const editar = () => {
      slotEl.innerHTML = `<input type="text" class="mdc2-horas-input" inputmode="numeric" placeholder="00h00" maxlength="6" aria-label="Horas contratadas" value="${esc(valor)}">`;
      const input = slotEl.querySelector('input');
      let encerrado = false;
      input.addEventListener('input', () => {
        const novo = mascaraHoras(input.value);
        if (input.value !== novo) input.value = novo;
      });
      const salvar = async () => {
        if (encerrado) return;
        const novo = normalizarHoras(input.value);
        if (novo === null) {
          showToast('Minutos vão de 00 a 59', 'error');
          input.focus();
          return;
        }
        encerrado = true;
        if (novo === valor) return exibir();
        input.disabled = true;
        try {
          await db.collection('BancoDeAulas').doc(codigo).update({ horasContratadas: novo });
          valor = novo;
          aula.horasContratadas = novo;
          showToast('Horas contratadas atualizadas', 'success');
        } catch (err) {
          console.error('❌ Erro ao salvar horas contratadas:', err);
          showToast('Erro ao salvar horas contratadas', 'error');
        }
        exibir();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); salvar(); }
        // ESC só cancela a edição — não deixa o handler da versão antiga fechar o modal
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); encerrado = true; exibir(); }
      });
      input.addEventListener('blur', salvar);
      input.focus();
      input.select();
    };

    exibir();
    // O objeto "aula" pode vir de um cache antigo: confere o valor salvo no banco.
    if (codigo) {
      db.collection('BancoDeAulas').doc(codigo).get().then(snap => {
        const salvo = snap.exists ? (snap.data().horasContratadas || '') : '';
        if (salvo !== valor && !slotEl.querySelector('input')) {
          valor = salvo;
          aula.horasContratadas = salvo;
          exibir();
        }
      }).catch(err => console.error('❌ Erro ao ler horas contratadas:', err));
    }
  }

  function linhaResumo(rotulo, slot, extra = '') {
    return `<div class="mdc2-linha"><span class="mdc2-linha-rotulo">${rotulo}</span><span class="mdc2-linha-valor${extra}" data-v2="${slot}"></span></div>`;
  }

  function montarHTML(aula) {
    const nome = aula.nome || aula.nomeCliente || 'Cliente não identificado';
    const codigo = aula.codigoContratacao || 'Sem código';
    return `
      <div class="mdc2-overlay" role="dialog" aria-modal="true" aria-label="Detalhes da Contratação">
        <div class="mdc2-shell">
          <header class="mdc2-header mdc2-glass">
            <div class="mdc2-header-topo">
              <div class="mdc2-header-id">
                <h2 class="mdc2-nome">${esc(nome)}</h2>
                <span class="mdc2-contrato">Contrato nº ${esc(codigo)}</span>
                <div class="mdc2-chips">
                  ${chip(aula.statusContrato || 'Contrato sem status', tomStatus(aula.statusContrato))}
                  ${chip(aula.statusPagamento || 'Pagamento sem status', tomStatus(aula.statusPagamento))}
                </div>
              </div>
              <div class="mdc2-header-acoes">
                <button type="button" class="mdc2-btn-perfil" data-v2="perfil" title="Abrir o perfil completo do cliente">
                  <i class="fas fa-user"></i><span>Perfil do cliente</span>
                </button>
                <button type="button" class="mdc2-btn-icone" data-v2="expandir" aria-expanded="false" title="Mostrar informações do cliente">
                  <i class="fas fa-chevron-down"></i>
                </button>
                <button type="button" class="mdc2-btn-perfil mdc2-btn-versao" data-v2="versao-antiga" aria-label="Visualizar versão antiga">
                  <i class="fas fa-clock-rotate-left"></i><span>Visualizar versão antiga</span>
                </button>
                <span class="mdc2-slot-fechar" data-v2="fechar"></span>
              </div>
            </div>
            <div class="mdc2-header-info" data-v2="info"></div>
          </header>

          <div class="mdc2-main">
            <nav class="mdc2-nav mdc2-glass" aria-label="Ações da contratação">
              <button type="button" class="mdc2-recolher" data-v2="recolher-nav">
                <i class="fas fa-angles-left"></i><span>Recolher menu</span>
              </button>
              <div class="mdc2-nav-grupo">
                <span class="mdc2-nav-titulo">Aulas</span>
                <div class="mdc2-nav-itens" data-v2="nav-aulas"></div>
              </div>
              <div class="mdc2-nav-grupo">
                <span class="mdc2-nav-titulo">Ações</span>
                <div class="mdc2-nav-itens" data-v2="nav-acoes"></div>
              </div>
            </nav>

            <section class="mdc2-centro mdc2-glass">
              <h3 class="mdc2-secao-titulo"><i class="fas fa-calendar-alt"></i> Aulas Agendadas</h3>
              <div class="mdc2-tabela" data-v2="tabela"></div>
            </section>

            <aside class="mdc2-lateral">
              <button type="button" class="mdc2-recolher mdc2-glass" data-v2="recolher-lateral">
                <i class="fas fa-angles-right"></i><span>Recolher</span>
              </button>
              <div class="mdc2-card mdc2-glass">
                <div class="mdc2-card-titulo"><span class="mdc2-card-icone"><i class="fas fa-wallet"></i></span><span class="mdc2-card-titulo-texto">Resumo financeiro</span></div>
                ${linhaResumo('Valor do pacote', 'pacote')}
                ${linhaResumo('Valor para Equipe', 'equipe')}
                ${linhaResumo('Lucro Master', 'lucro')}
                <div class="mdc2-card-acao" data-v2="editar-valores"></div>
              </div>
              <div class="mdc2-card mdc2-glass">
                <div class="mdc2-card-titulo"><span class="mdc2-card-icone"><i class="fas fa-clock"></i></span><span class="mdc2-card-titulo-texto">Valores por aula</span></div>
                <div class="mdc2-linha">
                  <span class="mdc2-linha-rotulo">Horas contratadas</span>
                  <span class="mdc2-linha-valor mdc2-horas-contratadas" data-v2="horas-contratadas"></span>
                </div>
                ${linhaResumo('Total de horas', 'total-horas')}
                ${linhaResumo('Hora/aula professor', 'hora-aula')}
                ${linhaResumo('Lucro por aula', 'lucro-aula', ' mdc2-valor-lucro')}
                ${linhaResumo('Total por aula', 'total-aula')}
              </div>
              <div class="mdc2-card mdc2-glass">
                <div class="mdc2-card-titulo"><span class="mdc2-card-icone"><i class="fas fa-file-signature"></i></span><span class="mdc2-card-titulo-texto">Contratação</span></div>
                <div class="mdc2-card-botoes" data-v2="contratacao"></div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    `;
  }

  // A versão antiga foi fechada com esta camada aberta (Fechar, Editar, outra
  // contratação): a camada saiu do DOM junto, só falta soltar o observer.
  function limparSeOrfao() {
    if (ativo && !document.body.contains(ativo.el)) {
      if (ativo.observer) ativo.observer.disconnect();
      ativo = null;
    }
  }

  // "Visualizar versão antiga": devolve tudo ao layout anterior e o exibe.
  function fechar() {
    limparSeOrfao();
    if (!ativo) return;
    if (ativo.observer) ativo.observer.disconnect();
    ativo.rotulos.forEach(({ alvo, original }) => { alvo.textContent = original; });
    const btnFechar = ativo.overlayV1.querySelector('#btn-fechar-modal');
    if (btnFechar) {
      btnFechar.removeAttribute('aria-label');
      if (ativo.tituloFechar === null) btnFechar.removeAttribute('title');
      else btnFechar.setAttribute('title', ativo.tituloFechar);
    }
    restaurarMovidos();
    if (ativo.info && ativo.infoEstavaOculta) ativo.info.classList.add('hidden');
    ativo.overlayV1.classList.remove('mdc2-v1-oculta');
    ativo.el.remove();
    ativo = null;
  }

  /**
   * @param {HTMLElement} overlayV1  .modal-overlay da versão antiga (o "modal" de viewAulaDetails)
   * @param {Object} aula            mesmo objeto da contratação recebido por viewAulaDetails
   */
  function abrir(overlayV1, aula) {
    limparSeOrfao();
    if (ativo) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = montarHTML(aula);
    const el = wrap.firstElementChild;
    // Estado do último acesso aplicado antes de entrar no DOM: abre sem animação.
    Object.keys(LADOS).forEach(lado => aplicarRecolhido(el, lado, lerRecolhido(lado)));
    overlayV1.appendChild(el);
    overlayV1.classList.add('mdc2-v1-oculta');
    ativo = { el, overlayV1, movidos: [], rotulos: [], observer: null, info: null, infoEstavaOculta: false };

    const slot = (chave) => el.querySelector(`[data-v2="${chave}"]`);
    const daV1 = (sel) => overlayV1.querySelector(sel);

    // Menu lateral — Aulas: Adicionar, Vista Calendário, Verificar Datas, Match, Colunas.
    const navAulas = slot('nav-aulas');
    mover(daV1('#btnAdicionarAula'), navAulas);
    mover(daV1('#btnVisualizacaoCalendario'), navAulas);
    mover(daV1('#btnVerificarDatas'), navAulas);
    mover(daV1('#btnMatchProfessor'), navAulas);
    const colunas = daV1('#btnColunasAula');
    mover(colunas && colunas.parentElement, navAulas); // wrapper .relative com o menu

    // Menu lateral — Ações, na ordem da versão antiga.
    const navAcoes = slot('nav-acoes');
    ['#btn-editar-contratacao', '#btn-gerar-contrato', '#btn-gerar-solicitacao',
      '#btn-gerar-solicitacao-professor', '#btn-ver-observacoes', '#btn-ver-conteudos',
      '#btn-ver-dados-cliente', '#btn-gerar-nfe'].forEach(sel => {
      const btn = daV1(sel);
      mover(btn, navAcoes);
      if (ROTULOS_ACOES[sel]) renomear(btn, ROTULOS_ACOES[sel]);
    });

    // Centro: a mesma tabela de Aulas Agendadas.
    mover(daV1('.table-container-double-scroll'), slot('tabela'));

    // Lateral direita: valores de "Dados da contratação" e os botões do rodapé.
    mover(daV1('#display-valor-pacote-contrato'), slot('pacote'));
    mover(daV1('#display-valor-equipe-contrato'), slot('equipe'));
    mover(daV1('#display-lucro-master-contrato'), slot('lucro'));
    mover(daV1('#btn-editar-valores-contrato'), slot('editar-valores'));
    montarHorasContratadas(slot('horas-contratadas'), aula);
    mover(daV1('#display-total-horas-contrato'), slot('total-horas'));
    mover(daV1('#display-hora-aula-contrato'), slot('hora-aula'));
    ['#btn-proposta-professores-contratacao', '#btn-salvar-alteracoes']
      .forEach(sel => mover(daV1(sel), slot('contratacao')));

    // "Fechar" vira o X, último item do cabeçalho (o texto fica oculto pelo CSS).
    const btnFechar = daV1('#btn-fechar-modal');
    if (btnFechar) {
      mover(btnFechar, slot('fechar'));
      ativo.tituloFechar = btnFechar.getAttribute('title');
      btnFechar.setAttribute('title', 'Fechar');
      btnFechar.setAttribute('aria-label', 'Fechar');
    }

    // Peso de cada grupo/cartão das laterais = nº de itens (+1 do título): com o CSS,
    // ocupam toda a altura com os itens equidistantes.
    el.querySelectorAll('.mdc2-nav-grupo').forEach(g => {
      g.style.setProperty('--mdc2-peso', g.querySelector('.mdc2-nav-itens').children.length + 1);
    });
    el.querySelectorAll('.mdc2-lateral > .mdc2-card').forEach(c => {
      c.style.setProperty('--mdc2-peso', c.querySelectorAll('.mdc2-linha, .mdc2-card-acao, .mdc2-card-botoes > *').length + 1);
    });

    // Cabeçalho expansível: Informações do Cliente.
    const info = daV1('#body-info-cliente');
    if (info) {
      ativo.info = info;
      ativo.infoEstavaOculta = info.classList.contains('hidden');
      info.classList.remove('hidden');
      mover(info, slot('info'));
    }

    const btnExpandir = slot('expandir');
    btnExpandir.addEventListener('click', () => {
      const aberto = el.querySelector('.mdc2-header').classList.toggle('mdc2-header-aberto');
      btnExpandir.setAttribute('aria-expanded', String(aberto));
      btnExpandir.title = aberto ? 'Ocultar informações do cliente' : 'Mostrar informações do cliente';
    });
    Object.keys(LADOS).forEach(lado => {
      slot(LADOS[lado].botao).addEventListener('click', () => {
        const recolhido = !el.classList.contains(LADOS[lado].classe);
        aplicarRecolhido(el, lado, recolhido);
        salvarRecolhido(lado, recolhido);
      });
    });
    // Lateral direita recolhida: clicar em qualquer cartão (o ícone) expande de volta.
    el.querySelector('.mdc2-lateral').addEventListener('click', (e) => {
      if (!el.classList.contains(LADOS.lateral.classe) || !e.target.closest('.mdc2-card')) return;
      aplicarRecolhido(el, 'lateral', false);
      salvarRecolhido('lateral', false);
    });
    slot('perfil').addEventListener('click', () => abrirPerfilClientePorCpf(aula.cpf || ''));
    slot('versao-antiga').addEventListener('click', fechar);

    // Lucro/Total por aula acompanham os valores, que a versão antiga atualiza ao
    // carregar o contrato, ao recarregar a tabela e em "Editar valores". O observer já
    // agrupa as mudanças; a escrita só acontece se o valor mudou, então não entra em laço.
    ativo.observer = new MutationObserver(atualizarValoresPorAula);
    ativo.observer.observe(el.querySelector('.mdc2-lateral'), {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-por-hora']
    });
    atualizarValoresPorAula();
  }

  return { abrir, fechar };
})();

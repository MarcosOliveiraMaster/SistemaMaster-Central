// gerenciamento-midias.js
// Área "Gerenciamento de mídias" (menu Ferramentas e Administrativo): ver,
// baixar e apagar as mídias guardadas no Firestore.
//
// Dropdown no topo (sempre abre em "Mídias de aulas"):
//   Mídias de aulas      fotos do registro da aula enviadas pelo professor
//   Fotos de professores abas Ativos / Desligados
//   Quadros de aulas     quadros do Quadro Master (baixados em PDF)
//
// Grid de 5 colunas, 20 por página: cada página lê só as 20 mídias que mostra.
// "Baixar todas" gera um ZIP (gerenciamento-midias-zip.js) e "Apagar todas"
// age só sobre o que está aberto (tipo + aba). A leitura, os nomes e a
// exclusão de cada tipo ficam em gerenciamento-midias-fontes.js.
//
// A barra de memória compara o espaço das mídias com o limite de 1 GB do
// plano gratuito do Firestore. É um cálculo do próprio sistema (o Google não
// informa o uso do banco para o navegador): ver configuracoes/usoMidias.

import { criarFontes, lerResumo, recalcularResumo, usoProfessores, LIMITE_BYTES, POR_PAGINA } from './gerenciamento-midias-fontes.js';
import { baixarItem, baixarZip } from './gerenciamento-midias-zip.js';

(function () {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const aviso = (msg, tipo) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', 4000) : alert(msg));
  const pad = (n) => String(n).padStart(2, '0');
  const num = (n) => Number(n || 0).toLocaleString('pt-BR');
  const mb = (bytes) => {
    const v = (bytes || 0) / (1024 * 1024);
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} MB`;
  };
  const hoje = () => { const d = new Date(); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; };
  const PALAVRA_CONFIRMA = 'APAGAR';

  const TIPOS = {
    aulas: {
      rotulo: 'Mídias de aulas', unidade: ['foto', 'fotos'], zip: 'midias-aulas',
      baixar: 'Baixar todas (ZIP)', apagar: 'Apagar todas as fotos de aulas',
      confirma: 'Apagar todas as fotos de aulas?',
      efeito: 'As aulas, relatórios e avaliações continuam; só a foto sai.'
    },
    'prof-ativos': {
      rotulo: 'Fotos de professores', unidade: ['foto', 'fotos'], zip: 'fotos-professores-ativos',
      baixar: 'Baixar fotos dos ativos (ZIP)', apagar: 'Apagar fotos dos ativos',
      confirma: 'Apagar as fotos de todos os professores ativos?',
      efeito: 'Os professores voltam para o ícone padrão; o cadastro continua.'
    },
    'prof-desligados': {
      rotulo: 'Fotos de professores', unidade: ['foto', 'fotos'], zip: 'fotos-professores-desligados',
      baixar: 'Baixar fotos dos desligados (ZIP)', apagar: 'Apagar fotos dos desligados',
      confirma: 'Apagar as fotos de todos os professores desligados?',
      efeito: 'Os professores voltam para o ícone padrão; o cadastro continua.'
    },
    quadros: {
      rotulo: 'Quadros de aulas', unidade: ['quadro', 'quadros'], zip: 'quadros-aulas',
      baixar: 'Baixar todos os quadros (ZIP)', apagar: 'Apagar todos os quadros',
      confirma: 'Apagar todos os quadros?',
      efeito: 'O quadro inteiro é apagado e some também para o professor e para o cliente no portal.'
    }
  };

  const estado = {
    tipo: 'aulas',          // 'aulas' | 'professores' | 'quadros'
    aba: 'ativos',          // aba de Fotos de professores
    pagina: 0,
    itens: [],
    temProxima: false,
    fontes: null,
    uso: null,
    ocupado: false,
    token: 0
  };

  const sec = () => document.getElementById('gerenciamento-midias');
  const $ = (sel) => sec()?.querySelector(sel);

  function fonteAtual() {
    if (estado.tipo === 'professores') return estado.aba === 'desligados' ? estado.fontes.profDesligados : estado.fontes.profAtivos;
    return estado.fontes[estado.tipo];
  }
  const tipoAtual = () => TIPOS[fonteAtual().chave];
  const contar = (n, t) => `${num(n)} ${n === 1 ? t.unidade[0] : t.unidade[1]}`;

  // ── Tela ───────────────────────────────────────────────────────────────
  function loadGerenciamentoMidias() {
    const s = sec();
    if (!s || !window.firebase) return;
    estado.fontes = criarFontes();
    estado.tipo = 'aulas';
    estado.aba = 'ativos';
    estado.uso = null;
    s.innerHTML = `<div class="gm-wrap">
      <div class="gm-topo">
        <div class="gm-titulo">
          <h2>Gerenciamento de mídias</h2>
          <label class="gm-seletor">Visualizar
            <select id="gm-tipo">
              <option value="aulas">Mídias de aulas</option>
              <option value="professores">Fotos de professores</option>
              <option value="quadros">Quadros de aulas</option>
            </select>
          </label>
        </div>
        <div class="gm-acoes">
          <button type="button" class="gm-btn pri" id="gm-baixar-todos"><i class="fas fa-download" aria-hidden="true"></i><span></span></button>
          <button type="button" class="gm-btn perigo" id="gm-apagar-todos"><i class="fas fa-trash-can" aria-hidden="true"></i><span></span></button>
        </div>
      </div>
      <section class="gm-memoria" aria-label="Memória ocupada pelas mídias" id="gm-memoria">
        <div class="gm-memoria-topo"><strong>Memória ocupada pelas mídias</strong><span>Calculando…</span></div>
      </section>
      <div class="gm-abas" role="tablist" aria-label="Situação do professor" id="gm-abas" hidden>
        <button type="button" class="gm-aba" role="tab" data-aba="ativos" aria-selected="true">Professores ativos</button>
        <button type="button" class="gm-aba" role="tab" data-aba="desligados" aria-selected="false">Professores desligados</button>
      </div>
      <p class="gm-dica" id="gm-dica" hidden>Os botões do topo agem só sobre a aba aberta. Apagar a foto deixa o professor com o ícone padrão; o cadastro continua.</p>
      <div class="gm-info"><span id="gm-contagem">Carregando…</span><span>${POR_PAGINA} por página</span></div>
      <div class="gm-grid" id="gm-grid" aria-live="polite"></div>
      <nav class="gm-paginacao" aria-label="Paginação">
        <button type="button" class="gm-btn" id="gm-anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i> Anterior</button>
        <span id="gm-pagina"></span>
        <button type="button" class="gm-btn" id="gm-proxima">Próxima <i class="fas fa-chevron-right" aria-hidden="true"></i></button>
      </nav>
    </div>`;

    $('#gm-tipo').onchange = (e) => { estado.tipo = e.target.value; trocarVisao(); };
    s.querySelectorAll('.gm-aba').forEach((b) => {
      b.onclick = () => { estado.aba = b.dataset.aba; trocarVisao(); };
    });
    $('#gm-anterior').onclick = () => carregarPagina(estado.pagina - 1);
    $('#gm-proxima').onclick = () => carregarPagina(estado.pagina + 1);
    $('#gm-baixar-todos').onclick = () => baixarTodos();
    $('#gm-apagar-todos').onclick = () => apagarTodos();

    trocarVisao();
    atualizarMemoria();
  }

  function trocarVisao() {
    const prof = estado.tipo === 'professores';
    $('#gm-abas').hidden = !prof;
    $('#gm-dica').hidden = !prof;
    sec().querySelectorAll('.gm-aba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba)));
    const t = tipoAtual();
    $('#gm-baixar-todos span').textContent = t.baixar;
    $('#gm-apagar-todos span').textContent = t.apagar;
    carregarPagina(0);
  }

  async function carregarPagina(n) {
    if (n < 0) return;
    const fonte = fonteAtual();
    const token = ++estado.token;
    const grid = $('#gm-grid');
    grid.innerHTML = '<div class="gm-vazio"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Carregando…</div>';
    $('#gm-anterior').disabled = true;
    $('#gm-proxima').disabled = true;
    try {
      const r = await fonte.pagina(n);
      if (token !== estado.token) return;
      if (n > 0 && r.itens.length === 0) { carregarPagina(n - 1); return; }
      estado.pagina = n;
      estado.itens = r.itens;
      estado.temProxima = r.temProxima;
      desenharGrid();
    } catch (err) {
      if (token !== estado.token) return;
      console.error('[Mídias] Erro ao carregar página:', err);
      grid.innerHTML = '<div class="gm-vazio">Não foi possível carregar as mídias. Tente de novo.</div>';
      $('#gm-contagem').textContent = '';
    }
  }

  function desenharGrid() {
    const fonte = fonteAtual();
    const t = tipoAtual();
    const grid = $('#gm-grid');
    const total = fonte.total();
    const ini = estado.pagina * POR_PAGINA;
    const paginas = total != null ? Math.max(1, Math.ceil(total / POR_PAGINA)) : null;

    if (estado.itens.length === 0) {
      grid.innerHTML = `<div class="gm-vazio">${esc(fonte.vazio)}</div>`;
      $('#gm-contagem').textContent = '';
    } else {
      grid.innerHTML = '';
      estado.itens.forEach((item) => grid.appendChild(card(item)));
      $('#gm-contagem').textContent = `Mostrando ${num(ini + 1)}–${num(ini + estado.itens.length)}`
        + (total != null ? ` de ${contar(total, t)}` : '')
        + (fonte.chave === 'aulas' ? ' · mais recentes primeiro' : '');
    }
    $('#gm-pagina').textContent = paginas ? `Página ${estado.pagina + 1} de ${paginas}` : `Página ${estado.pagina + 1}`;
    $('#gm-anterior').disabled = estado.pagina === 0;
    $('#gm-proxima').disabled = !estado.temProxima;
  }

  function card(item) {
    const fonte = fonteAtual();
    const el = document.createElement('article');
    el.className = 'gm-card';

    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'gm-thumb' + (fonte.chave.startsWith('prof') ? ' perfil' : fonte.chave === 'quadros' ? ' quadro' : '');
    thumb.setAttribute('aria-label', `Ver ${item.nome}`);
    if (item.miniatura) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = item.miniatura;
      thumb.appendChild(img);
    } else if (fonte.chave === 'quadros') {
      thumb.innerHTML = '<i class="fas fa-chalkboard fa-2x" aria-hidden="true"></i><small></small>';
      thumb.querySelector('small').textContent = item.titulo || 'Quadro sem título';
    } else {
      thumb.innerHTML = '<i class="fas fa-image fa-2x" aria-hidden="true"></i>';
    }
    if (item.detalhe) {
      const selo = document.createElement('span');
      selo.className = 'gm-selo' + (item.detalhe === 'Desligado' ? ' desligado' : '');
      selo.textContent = item.detalhe;
      thumb.appendChild(selo);
    }
    thumb.onclick = () => (fonte.visualizar ? fonte.visualizar(item) : visualizar(item));

    const rodape = document.createElement('div');
    rodape.className = 'gm-rodape';
    const nome = document.createElement('span');
    nome.className = 'gm-nome';
    nome.textContent = item.rotulo || item.nome;
    nome.title = `${item.nome}.${item.ext}`;
    const baixar = botaoIcone('fa-download', `Baixar ${item.nome}`);
    baixar.onclick = async () => {
      baixar.disabled = true;
      try { await baixarItem(item); } catch (err) { console.error('[Mídias] Download:', err); aviso(err.message || 'Não foi possível baixar.', 'error'); }
      baixar.disabled = false;
    };
    const apagar = botaoIcone('fa-trash-can', `Apagar ${item.nome}`, true);
    apagar.onclick = () => apagarUm(item);
    rodape.append(nome, baixar, apagar);

    el.append(thumb, rodape);
    return el;
  }

  function botaoIcone(icone, rotulo, perigo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gm-icone' + (perigo ? ' perigo' : '');
    b.setAttribute('aria-label', rotulo);
    b.title = rotulo;
    b.innerHTML = `<i class="fas ${icone}" aria-hidden="true"></i>`;
    return b;
  }

  // ── Memória ────────────────────────────────────────────────────────────
  async function atualizarMemoria(forcarResumo = false) {
    const box = $('#gm-memoria');
    if (!box) return;
    try {
      const [res, prof] = await Promise.all([lerResumo(forcarResumo), usoProfessores()]);
      estado.uso = { aulas: res?.aulas || null, quadros: res?.quadros || null, professores: prof, calculadoEm: res?.calculadoEm || null };
    } catch (err) {
      console.error('[Mídias] Erro ao ler uso:', err);
      box.innerHTML = '<div class="gm-memoria-topo"><strong>Memória ocupada pelas mídias</strong><span>Não foi possível calcular.</span></div>';
      return;
    }
    desenharMemoria();
  }

  function desenharMemoria() {
    const box = $('#gm-memoria');
    const u = estado.uso;
    if (!box || !u) return;
    const aulas = u.aulas?.bytes || 0;
    const prof = u.professores.bytes;
    const quadros = u.quadros?.bytes || 0;
    const total = aulas + prof + quadros;
    const pct = (b) => `${Math.min(100, (b / LIMITE_BYTES) * 100).toFixed(2)}%`;
    const d = u.calculadoEm && u.calculadoEm.toDate ? u.calculadoEm.toDate() : u.calculadoEm;
    const quando = d instanceof Date ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : null;
    const semResumo = !u.aulas || !u.quadros;

    box.innerHTML = `
      <div class="gm-memoria-topo">
        <strong>Memória ocupada pelas mídias</strong>
        <span><b>${mb(total)}</b> de 1 GB (limite do plano gratuito do Firestore) · ${(total / LIMITE_BYTES * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
      </div>
      <div class="gm-barra" role="img" aria-label="${esc(`${mb(total)} de 1 GB ocupados`)}">
        <span class="gm-c-aulas" style="width:${pct(aulas)}"></span>
        <span class="gm-c-prof" style="width:${pct(prof)}"></span>
        <span class="gm-c-quadros" style="width:${pct(quadros)}"></span>
      </div>
      <div class="gm-legenda">
        <span><i class="gm-c-aulas"></i>Mídias de aulas: ${u.aulas ? `${mb(aulas)} · ${contar(u.aulas.qtd, TIPOS.aulas)}` : 'não calculado'}</span>
        <span><i class="gm-c-prof"></i>Fotos de professores: ${mb(prof)} · ${contar(u.professores.qtd, TIPOS['prof-ativos'])} (desligados: ${mb(u.professores.desligadosBytes)})</span>
        <span><i class="gm-c-quadros"></i>Quadros de aulas: ${u.quadros ? `${mb(quadros)} · ${contar(u.quadros.qtd, TIPOS.quadros)}` : 'não calculado'}</span>
      </div>
      <div class="gm-memoria-topo">
        <p class="gm-aviso-resumo">${semResumo
          ? 'Fotos de aulas e quadros ainda não foram calculados. Clique em "Recalcular" (lê todas as mídias uma vez).'
          : `Aulas e quadros calculados em ${esc(quando || '—')}; fotos enviadas depois disso só entram ao recalcular. Fotos de professores contam na hora.`}</p>
        <button type="button" class="gm-link" id="gm-recalcular"><i class="fas fa-rotate" aria-hidden="true"></i> Recalcular</button>
      </div>`;
    $('#gm-recalcular').onclick = () => recalcular();
  }

  async function recalcular() {
    if (estado.ocupado) return;
    estado.ocupado = true;
    const prog = abrirProgresso('Recalculando a memória', 'Lendo todas as fotos de aulas e quadros uma vez. Não feche esta janela.', false);
    try {
      await recalcularResumo((feitos, fase) => prog.texto(fase === 'aulas' ? `${num(feitos)} fotos de aulas lidas` : `${num(feitos)} quadros lidos`));
      prog.fechar();
      aviso('Memória recalculada.', 'success');
      await atualizarMemoria();
      if (estado.tipo === 'aulas') desenharGrid();
    } catch (err) {
      prog.fechar();
      console.error('[Mídias] Recalcular:', err);
      aviso('Não foi possível recalcular a memória.', 'error');
    }
    estado.ocupado = false;
  }

  // ── Download de todas ──────────────────────────────────────────────────
  // Devolve true quando o ZIP foi baixado (ou não havia nada a baixar).
  async function baixarTodos() {
    if (estado.ocupado) return false;
    estado.ocupado = true;
    const fonte = fonteAtual();
    const t = tipoAtual();
    const total = fonte.total();
    const prog = abrirProgresso('Preparando o download', `Juntando ${t.unidade[1]} em um arquivo ZIP. Não feche esta janela.`, true);
    let ok = false;
    try {
      const r = await baixarZip(fonte, {
        nomeZip: `${t.zip}-${hoje()}.zip`,
        cancelado: () => prog.cancelado,
        aoProgresso: (feitos, fase, percent) => {
          if (fase === 'compactando') { prog.atualizar(percent, 100, `Gerando o ZIP… ${Math.round(percent)}%`); return; }
          prog.atualizar(feitos, total, total ? `${num(feitos)} de ${contar(total, t)}` : `${contar(feitos, t)}`);
        }
      });
      prog.fechar();
      if (r.arquivos === 0) aviso(`Não há ${t.unidade[1]} para baixar.`, 'info');
      else aviso(`ZIP com ${contar(r.arquivos, t)} baixado.` + (r.falhas ? ` ${num(r.falhas)} com problema ficaram de fora.` : ''), r.falhas ? 'warning' : 'success');
      ok = r.falhas === 0;
    } catch (err) {
      prog.fechar();
      if (err.cancelado) aviso('Download cancelado.', 'info');
      else { console.error('[Mídias] ZIP:', err); aviso(err.message || 'Não foi possível gerar o ZIP.', 'error'); }
    }
    estado.ocupado = false;
    return ok;
  }

  // ── Exclusão ───────────────────────────────────────────────────────────
  async function apagarTodos() {
    if (estado.ocupado) return;
    const fonte = fonteAtual();
    const t = tipoAtual();
    const total = fonte.total();
    const u = estado.uso;
    const bytes = fonte.chave === 'aulas' ? u?.aulas?.bytes
      : fonte.chave === 'quadros' ? u?.quadros?.bytes
      : fonte.chave === 'prof-desligados' ? u?.professores.desligadosBytes
      : u ? u.professores.bytes - u.professores.desligadosBytes : null;
    const qtd = total != null ? `<strong>${esc(contar(total, t))}</strong>` : `<strong>todas as ${esc(t.unidade[1])}</strong>`;
    const espaco = bytes ? ` e liberar cerca de <strong>${esc(mb(bytes))}</strong>` : '';

    const r = await confirmar({
      titulo: t.confirma,
      html: `<p>Vai apagar ${qtd}${espaco}. ${esc(t.efeito)} <strong>Não dá para desfazer.</strong></p>`,
      exigirPalavra: true,
      oferecerDownload: true,
      botao: 'Apagar definitivamente'
    });
    if (!r) return;
    if (r.baixarAntes && !(await baixarTodos())) {
      aviso('Nada foi apagado: o download não terminou completo.', 'warning');
      return;
    }

    estado.ocupado = true;
    const prog = abrirProgresso('Apagando', `Apagando ${t.unidade[1]}. Não feche esta janela.`, false);
    try {
      const feitos = await fonte.apagarTodos((n) => prog.atualizar(n, total, total ? `${num(n)} de ${contar(total, t)}` : contar(n, t)));
      prog.fechar();
      const apagadas = t.unidade[0] === 'quadro' ? ['apagado', 'apagados'] : ['apagada', 'apagadas'];
      aviso(`${contar(feitos, t)} ${feitos === 1 ? apagadas[0] : apagadas[1]}.`, 'success');
    } catch (err) {
      prog.fechar();
      console.error('[Mídias] Apagar todas:', err);
      aviso('A exclusão parou no meio. Abra a área de novo para ver o que restou.', 'error');
    }
    estado.ocupado = false;
    await atualizarMemoria();
    carregarPagina(0);
  }

  async function apagarUm(item) {
    if (estado.ocupado) return;
    const fonte = fonteAtual();
    const t = tipoAtual();
    const r = await confirmar({
      titulo: `Apagar ${t.unidade[0] === 'quadro' ? 'este quadro' : 'esta foto'}?`,
      html: `<p><strong>${esc(item.nome)}</strong></p><p>${esc(t.efeito)} Não dá para desfazer.</p>`,
      exigirPalavra: false,
      oferecerDownload: false,
      botao: 'Apagar'
    });
    if (!r) return;
    estado.ocupado = true;
    try {
      await fonte.apagar(item);
      aviso(t.unidade[0] === 'quadro' ? 'Quadro apagado.' : 'Foto apagada.', 'success');
    } catch (err) {
      console.error('[Mídias] Apagar:', err);
      aviso('Não foi possível apagar.', 'error');
    }
    estado.ocupado = false;
    await atualizarMemoria();
    carregarPagina(estado.pagina);
  }

  // ── Janelas ────────────────────────────────────────────────────────────
  function overlay(html) {
    const ov = document.createElement('div');
    ov.className = 'gm-overlay';
    ov.innerHTML = html;
    document.body.appendChild(ov);
    return ov;
  }

  function abrirProgresso(titulo, textoInicial, cancelavel) {
    const ov = overlay(`<section class="gm-modal" role="dialog" aria-modal="true" aria-labelledby="gm-prog-t">
      <div class="gm-modal-topo"><i class="fas fa-spinner fa-spin" style="color:#f28705" aria-hidden="true"></i><h3 id="gm-prog-t"></h3></div>
      <div class="gm-modal-corpo">
        <p data-texto></p>
        <div class="gm-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        <div class="gm-progresso-info"><span data-conta></span><strong data-pct></strong></div>
        ${cancelavel ? '<div class="gm-modal-botoes"><button type="button" class="gm-btn" data-cancelar>Cancelar</button></div>' : ''}
      </div></section>`);
    ov.querySelector('#gm-prog-t').textContent = titulo;
    ov.querySelector('[data-texto]').textContent = textoInicial;
    const barra = ov.querySelector('.gm-progresso');
    const ctl = {
      cancelado: false,
      atualizar(feitos, total, rotulo) {
        const pct = total ? Math.min(100, Math.round((feitos / total) * 100)) : null;
        barra.firstElementChild.style.width = pct != null ? `${pct}%` : '100%';
        barra.setAttribute('aria-valuenow', String(pct ?? 0));
        ov.querySelector('[data-pct]').textContent = pct != null ? `${pct}%` : '';
        ov.querySelector('[data-conta]').textContent = rotulo || '';
      },
      texto(t) { ov.querySelector('[data-conta]').textContent = t; },
      fechar() { ov.remove(); }
    };
    const cancelar = ov.querySelector('[data-cancelar]');
    if (cancelar) cancelar.onclick = () => { ctl.cancelado = true; cancelar.disabled = true; cancelar.textContent = 'Cancelando…'; };
    return ctl;
  }

  function confirmar({ titulo, html, exigirPalavra, oferecerDownload, botao }) {
    return new Promise((resolve) => {
      const ov = overlay(`<section class="gm-modal" role="dialog" aria-modal="true" aria-labelledby="gm-conf-t">
        <div class="gm-modal-topo perigo"><i class="fas fa-triangle-exclamation" style="color:#b91c1c" aria-hidden="true"></i><h3 id="gm-conf-t"></h3></div>
        <div class="gm-modal-corpo">
          ${html}
          ${oferecerDownload ? '<label class="gm-check"><input type="checkbox" data-baixar checked> Baixar o ZIP antes de apagar (recomendado)</label>' : ''}
          ${exigirPalavra ? `<label class="gm-campo">Para confirmar, digite ${PALAVRA_CONFIRMA}<input type="text" data-palavra autocomplete="off" spellcheck="false"></label>` : ''}
          <div class="gm-modal-botoes">
            <button type="button" class="gm-btn" data-nao>Cancelar</button>
            <button type="button" class="gm-btn perigo-cheio" data-sim></button>
          </div>
        </div></section>`);
      ov.querySelector('#gm-conf-t').textContent = titulo;
      const sim = ov.querySelector('[data-sim]');
      sim.textContent = botao;
      const palavra = ov.querySelector('[data-palavra]');
      if (palavra) {
        sim.disabled = true;
        palavra.oninput = () => { sim.disabled = palavra.value.trim().toUpperCase() !== PALAVRA_CONFIRMA; };
        setTimeout(() => palavra.focus(), 0);
      } else setTimeout(() => sim.focus(), 0);
      const fim = (valor) => { document.removeEventListener('keydown', esc_, true); ov.remove(); resolve(valor); };
      const esc_ = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fim(null); } };
      document.addEventListener('keydown', esc_, true);
      ov.addEventListener('click', (e) => { if (e.target === ov) fim(null); });
      ov.querySelector('[data-nao]').onclick = () => fim(null);
      sim.onclick = () => fim({ baixarAntes: !!ov.querySelector('[data-baixar]')?.checked });
    });
  }

  function visualizar(item) {
    if (!item.miniatura) { aviso('Esta mídia está vazia ou corrompida.', 'warning'); return; }
    const ov = overlay(`<div class="gm-visor" role="dialog" aria-modal="true" aria-labelledby="gm-visor-t">
      <div class="gm-visor-topo"><h3 id="gm-visor-t"></h3>
        <button type="button" class="gm-icone" data-baixar aria-label="Baixar"><i class="fas fa-download" aria-hidden="true"></i></button>
        <button type="button" class="gm-icone" data-fechar aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button>
      </div>
      <img alt="">
    </div>`);
    ov.querySelector('#gm-visor-t').textContent = item.nome;
    const img = ov.querySelector('img');
    img.alt = item.nome;
    img.src = item.miniatura;
    const fechar = () => { document.removeEventListener('keydown', tecla, true); ov.remove(); };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    document.addEventListener('keydown', tecla, true);
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-fechar]')) fechar(); });
    ov.querySelector('[data-baixar]').onclick = () => baixarItem(item).catch((err) => aviso(err.message, 'error'));
  }

  window.loadGerenciamentoMidias = loadGerenciamentoMidias;
})();

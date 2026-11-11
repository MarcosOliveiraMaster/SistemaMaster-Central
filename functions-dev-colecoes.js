// functions-dev-colecoes.js — Área Dev → Editor de Coleções
//
// Uma tela só para editar direto qualquer coleção do catálogo
// (functions-backup-formato.js): planilha com todos os campos, edição livre,
// seleção múltipla e copiar/colar em massa — a mesma ideia de "Detalhes Banco
// de Aulas", sem o agrupamento por contrato.
//
// - Lê em páginas (PAGINA documentos por vez) para não baixar a coleção inteira.
// - Campos com objeto/lista são editados como JSON (com os marcadores de tipo do
//   backup, então Timestamp/GeoPoint dentro de mapas não se perdem).
// - Só os campos alterados são gravados (batch.update), nunca o documento inteiro.
// - Subcoleções (listasTarefas → itens, quadros → paginas) abrem pelo botão da linha.

window.DevColecoes = (function () {
  'use strict';

  const B = window.BackupFormato;
  const PAGINA = 100;
  const MAX_LOTE = 400;
  const esc = B.esc;
  const toast = (msg, tipo) => { if (typeof showToast === 'function') showToast(msg, tipo || 'info'); };

  let raiz = null;
  let caminho = '';        // caminho da coleção aberta (ex.: "quadros" ou "quadros/abc/paginas")
  let linhas = [];         // [{ id, dados }]
  let colunas = [];
  let visiveis = [];       // índices de `linhas` que passam no filtro
  let pendencias = {};     // { docId: { campo: valor } }
  let selecao = new Set(); // 'r_c' (r = índice em linhas)
  let ancora = null;
  let editando = null;
  let clipboard = null;
  let ultimoDoc = null;
  let acabou = false;
  let filtro = '';
  let carregando = false;
  let token = 0;           // descarta respostas de uma coleção que já foi trocada

  const defRaiz = () => B.porNome[caminho.split('/')[0]] || {};
  const ehSub = () => caminho.split('/').length > 1;
  const colRef = () => B.fdb().collection(caminho);
  const temPendencias = () => Object.keys(pendencias).length > 0;

  function estilos() {
    if (document.getElementById('dc-estilos')) return;
    const s = document.createElement('style');
    s.id = 'dc-estilos';
    s.textContent = `
      .dc-barra{display:flex;flex-wrap:wrap;gap:.6rem;align-items:flex-end;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:.8rem 1rem;margin-bottom:.8rem;}
      .dc-barra label{display:block;font-size:.72rem;font-weight:600;color:#6b7280;margin-bottom:.2rem;}
      .dc-campo{border:2px solid #d1d5db;border-radius:8px;padding:.4rem .6rem;font-size:.85rem;background:#fff;min-width:0;}
      .dc-campo:focus{outline:none;border-color:#f28705;}
      .dc-caixa{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;}
      .dc-rolagem{overflow:auto;max-height:62vh;}
      .dc-tabela{border-collapse:separate;border-spacing:0;font-size:12.5px;font-family:ui-monospace,'SF Mono',Consolas,monospace;}
      .dc-th{position:sticky;top:0;z-index:2;background:#f3f4f6;border:1px solid #e5e7eb;padding:6px 10px;text-align:left;font-weight:700;color:#374151;white-space:nowrap;}
      .dc-td{border:1px solid #e5e7eb;padding:5px 10px;white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;cursor:cell;background:#fff;}
      .dc-cel{user-select:none;-webkit-user-select:none;}
      .dc-fixa{position:sticky;left:0;z-index:1;cursor:default;color:#6b7280;background:#fafafa;max-width:220px;}
      .dc-th.dc-fixa{z-index:3;background:#f3f4f6;}
      .dc-td.dc-sel{outline:2px solid #f28705;outline-offset:-2px;background:#fff7ed;}
      .dc-td.dc-suja{background:#fef3c7;}
      .dc-td.dc-suja.dc-sel{background:#fde68a;}
      .dc-entrada{width:100%;min-width:160px;border:none;outline:none;font:inherit;padding:0;background:transparent;}
      .dc-rodape{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-top:1px solid #e5e7eb;}
      .dc-link{background:none;border:none;color:#d97804;font-size:.78rem;font-weight:600;cursor:pointer;padding:0;white-space:nowrap;}
      .dc-link:hover{text-decoration:underline;}
      .dc-vazio{padding:2.5rem 1rem;text-align:center;color:#6b7280;font-size:.85rem;}
    `;
    document.head.appendChild(s);
  }

  // ── Valores ──────────────────────────────────────────────────────────────
  const ehTimestamp = (v) => v && typeof v === 'object' && typeof v.toDate === 'function';

  function exibir(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (typeof v !== 'object') return String(v);
    if (ehTimestamp(v)) { try { return v.toDate().toISOString(); } catch (_) { return ''; } }
    return JSON.stringify(B.serializar(v));
  }

  // Converte o texto digitado para o tipo que o campo já tinha.
  // Devolve { valor } ou { erro }.
  function converter(original, texto) {
    if (typeof original === 'boolean') {
      const s = texto.trim().toLowerCase();
      return { valor: s === 'true' ? true : s === 'false' ? false : texto };
    }
    if (typeof original === 'number') {
      return { valor: texto.trim() !== '' && !isNaN(Number(texto)) ? Number(texto) : texto };
    }
    if (ehTimestamp(original)) {
      const d = new Date(texto);
      if (isNaN(d.getTime())) return { erro: 'Data inválida. Use o formato 2026-01-31T14:30:00.000Z.' };
      return { valor: firebase.firestore.Timestamp.fromDate(d) };
    }
    if (original && typeof original === 'object') {
      // Objeto/lista: precisa continuar sendo JSON válido para não destruir a estrutura
      try { return { valor: B.desserializar(JSON.parse(texto)) }; }
      catch (e) { return { erro: 'JSON inválido — o campo é um objeto/lista.' }; }
    }
    return { valor: texto };
  }

  function valorAtual(r, c) {
    const linha = linhas[r];
    const campo = colunas[c];
    const p = pendencias[linha.id];
    return p && Object.prototype.hasOwnProperty.call(p, campo) ? p[campo] : linha.dados[campo];
  }
  const textoAtual = (r, c) => exibir(valorAtual(r, c));

  // ── Tela ─────────────────────────────────────────────────────────────────
  function montar() {
    const opcoes = B.grupos().map((g) => `<optgroup label="${esc(g.nome)}">${g.colecoes.map((c) =>
      `<option value="${esc(c.nome)}">${esc(c.nome)}${c.sub ? ' (+ ' + esc(c.sub.join(', ')) + ')' : ''}</option>`).join('')}</optgroup>`).join('');
    raiz.innerHTML = `
      <div class="dc-barra">
        <div>
          <label for="dc-colecao">Coleção</label>
          <select id="dc-colecao" class="dc-campo"><option value="">Escolha...</option>${opcoes}</select>
        </div>
        <div style="flex:1;min-width:170px;">
          <label for="dc-filtro">Filtrar nos documentos carregados</label>
          <input id="dc-filtro" type="text" class="dc-campo" style="width:100%;" placeholder="Qualquer texto de qualquer campo...">
        </div>
        <div>
          <label for="dc-id">Abrir por ID do documento</label>
          <div style="display:flex;gap:.3rem;">
            <input id="dc-id" type="text" class="dc-campo" style="width:170px;" placeholder="ID exato">
            <button type="button" class="btn-secondary btn-compact" id="dc-abrir-id" title="Abrir este documento"><i class="fas fa-arrow-right"></i></button>
          </div>
        </div>
        <button type="button" class="btn-secondary btn-compact" id="dc-recarregar" title="Recarregar a coleção"><i class="fas fa-rotate-right"></i></button>
      </div>
      <div id="dc-trilha" class="text-sm text-gray-600 mb-2"></div>
      <div class="dc-caixa">
        <div class="dc-rolagem" id="dc-rolagem"><div class="dc-vazio">Escolha uma coleção para editar.</div></div>
        <div class="dc-rodape">
          <div class="text-xs text-gray-500"><span id="dc-contagem"></span> <button type="button" class="dc-link" id="dc-mais" hidden>Carregar mais ${PAGINA}</button></div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            <span class="text-xs" id="dc-status" style="color:#b45309;font-weight:600;"></span>
            <button type="button" class="btn-secondary btn-compact" id="dc-descartar" disabled>Descartar</button>
            <button type="button" class="btn-primary btn-compact" id="dc-salvar" disabled><i class="fas fa-check mr-2"></i>Salvar alterações</button>
          </div>
        </div>
      </div>
      <p class="text-xs text-gray-400 mt-2 px-1">
        Clique: seleciona · Ctrl+clique: seleção múltipla · Shift+clique: intervalo · Duplo clique: edita ·
        Ctrl+C / Ctrl+V: copia a célula e cola em todas as selecionadas. Objetos e listas são editados como JSON.
        Só os campos alterados são gravados.
      </p>`;

    const $ = (id) => raiz.querySelector('#' + id);
    $('dc-colecao').addEventListener('change', (e) => {
      const sel = e.target;
      if (!podeSair()) { sel.value = caminho.split('/')[0] || ''; return; }
      abrirColecao(sel.value);
    });
    $('dc-filtro').addEventListener('input', (e) => { filtro = e.target.value.trim().toLowerCase(); desenhar(); });
    $('dc-recarregar').addEventListener('click', () => { if (caminho && podeSair()) abrirColecao(caminho); });
    $('dc-abrir-id').addEventListener('click', abrirPorId);
    $('dc-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirPorId(); });
    $('dc-mais').addEventListener('click', () => carregarPagina());
    $('dc-descartar').addEventListener('click', () => { pendencias = {}; desenhar(); });
    $('dc-salvar').addEventListener('click', salvar);
  }

  function podeSair() {
    return !temPendencias() || window.confirm('Há alterações não salvas nesta coleção. Descartar?');
  }

  function zerar() {
    linhas = []; colunas = []; visiveis = []; pendencias = {};
    selecao = new Set(); ancora = null; editando = null;
    ultimoDoc = null; acabou = false;
  }

  function abrirColecao(novoCaminho) {
    token++;
    carregando = false;
    caminho = novoCaminho || '';
    zerar();
    desenharTrilha();
    if (!caminho) { desenhar(); return; }
    carregarPagina();
  }

  function desenharTrilha() {
    const trilha = raiz.querySelector('#dc-trilha');
    const seg = caminho.split('/');
    let html = '';
    if (ehSub()) {
      html = `<button type="button" class="dc-link" id="dc-voltar"><i class="fas fa-arrow-left mr-1"></i>Voltar para ${esc(seg[0])}</button>
        <span class="ml-2">${esc(seg[0])} / <strong>${esc(seg[1])}</strong> / ${esc(seg[2])}</span>`;
    } else if (caminho === 'BancoDeAulas-Lista') {
      html = `<button type="button" class="dc-link" id="dc-por-contrato"><i class="fas fa-table-cells mr-1"></i>Ver as aulas agrupadas por contrato (Detalhes Banco de Aulas)</button>`;
    }
    trilha.innerHTML = html;
    const voltar = trilha.querySelector('#dc-voltar');
    if (voltar) voltar.addEventListener('click', () => { if (podeSair()) abrirColecao(seg[0]); });
    const contrato = trilha.querySelector('#dc-por-contrato');
    if (contrato) contrato.addEventListener('click', () => {
      if (!podeSair()) return;
      pendencias = {};
      const btn = document.querySelector('#div-menuLateral button[data-section="detalhes-banco-de-aulas"]');
      if (btn) btn.click();
    });
  }

  function erroLeitura(e) {
    console.error('[DevColecoes] Erro ao ler', caminho, e);
    const msg = e && e.code === 'permission-denied' ? 'Sem permissão para ler esta coleção (confira o firestore.rules).'
      : e && e.code === 'resource-exhausted' ? 'Cota do Firestore esgotada — tente mais tarde.'
      : 'Erro ao carregar: ' + ((e && e.message) || e);
    raiz.querySelector('#dc-rolagem').innerHTML = `<div class="dc-vazio" style="color:#b91c1c;">${esc(msg)}</div>`;
  }

  async function carregarPagina() {
    if (carregando || acabou || !caminho) return;
    carregando = true;
    const meu = token;
    if (!linhas.length) raiz.querySelector('#dc-rolagem').innerHTML = '<div class="dc-vazio"><span class="loading-spinner-large"></span> Carregando...</div>';
    try {
      let q = colRef().orderBy(firebase.firestore.FieldPath.documentId()).limit(PAGINA);
      if (ultimoDoc) q = q.startAfter(ultimoDoc);
      const snap = await q.get();
      if (meu !== token || !raiz.isConnected) return;
      const jaTem = new Set(linhas.map((l) => l.id));
      snap.forEach((d) => { if (!jaTem.has(d.id)) linhas.push({ id: d.id, dados: d.data() }); });
      if (snap.size) ultimoDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGINA) acabou = true;
      carregando = false;
      desenhar();
    } catch (e) {
      if (meu !== token) return;
      carregando = false;
      erroLeitura(e);
    }
  }

  async function abrirPorId() {
    const id = raiz.querySelector('#dc-id').value.trim();
    if (!caminho) { toast('Escolha a coleção primeiro.', 'warning'); return; }
    if (!id || id.includes('/')) return;
    if (!podeSair()) return;
    const meu = ++token;
    carregando = false;
    try {
      const d = await colRef().doc(id).get();
      if (meu !== token || !raiz.isConnected) return;
      if (!d.exists) { toast(`Não existe documento "${id}" em ${caminho}.`, 'warning'); return; }
      zerar();
      linhas = [{ id: d.id, dados: d.data() }];
      acabou = true; // só este documento; "Recarregar" volta à lista
      desenhar();
    } catch (e) {
      if (meu === token) erroLeitura(e);
    }
  }

  function calcularColunas() {
    const chaves = new Set();
    linhas.forEach((l) => Object.keys(l.dados).forEach((k) => chaves.add(k)));
    colunas = [...chaves].sort((a, b) => a.localeCompare(b));
  }

  function calcularVisiveis() {
    visiveis = [];
    linhas.forEach((l, r) => {
      if (!filtro) { visiveis.push(r); return; }
      if (l.id.toLowerCase().includes(filtro) || colunas.some((_, c) => textoAtual(r, c).toLowerCase().includes(filtro))) visiveis.push(r);
    });
  }

  function desenhar() {
    if (!raiz || !raiz.isConnected) return;
    editando = null;
    selecao = new Set(); ancora = null;
    const area = raiz.querySelector('#dc-rolagem');
    calcularColunas();
    calcularVisiveis();

    if (!caminho) area.innerHTML = '<div class="dc-vazio">Escolha uma coleção para editar.</div>';
    else if (!linhas.length) area.innerHTML = '<div class="dc-vazio">Nenhum documento nesta coleção.</div>';
    else if (!visiveis.length) area.innerHTML = '<div class="dc-vazio">Nenhum documento carregado combina com o filtro.</div>';
    else {
      const subs = ehSub() ? [] : (defRaiz().sub || []);
      const cab = `<tr><th class="dc-th dc-fixa">ID do documento</th>${subs.length ? '<th class="dc-th">Subcoleções</th>' : ''}${
        colunas.map((c) => `<th class="dc-th">${esc(c)}</th>`).join('')}</tr>`;
      const corpo = visiveis.map((r) => {
        const l = linhas[r];
        const sujas = pendencias[l.id] || {};
        return `<tr><td class="dc-td dc-fixa" title="${esc(l.id)}">${esc(l.id)}</td>${
          subs.length ? `<td class="dc-td" style="cursor:default;">${subs.map((s) =>
            `<button type="button" class="dc-link" data-sub="${esc(s)}" data-pai="${r}">${esc(s)} ›</button>`).join(' ')}</td>` : ''}${
          colunas.map((campo, c) => `<td class="dc-td dc-cel${Object.prototype.hasOwnProperty.call(sujas, campo) ? ' dc-suja' : ''}" data-r="${r}" data-c="${c}">${esc(textoAtual(r, c))}</td>`).join('')}</tr>`;
      }).join('');
      // sem-cartao: no celular o layout-responsivo.js não transforma esta planilha em cartões
      area.innerHTML = `<table class="dc-tabela sem-cartao"><thead>${cab}</thead><tbody id="dc-corpo">${corpo}</tbody></table>`;
    }
    atualizarRodape();
  }

  function atualizarRodape() {
    const cont = raiz.querySelector('#dc-contagem');
    cont.textContent = !caminho ? '' : `${linhas.length} documento(s) carregado(s)${filtro ? ` · ${visiveis.length} no filtro` : ''}${acabou ? '' : ' · há mais'}`;
    raiz.querySelector('#dc-mais').hidden = !caminho || acabou;
    const docs = Object.keys(pendencias).length;
    const campos = Object.values(pendencias).reduce((a, o) => a + Object.keys(o).length, 0);
    raiz.querySelector('#dc-status').textContent = docs ? `${campos} campo(s) alterado(s) em ${docs} documento(s) — não salvo` : '';
    raiz.querySelector('#dc-salvar').disabled = !docs;
    raiz.querySelector('#dc-descartar').disabled = !docs;
  }

  // ── Seleção e edição ─────────────────────────────────────────────────────
  const celula = (r, c) => raiz.querySelector(`#dc-corpo td[data-r="${r}"][data-c="${c}"]`);

  function pintarSelecao() {
    raiz.querySelectorAll('#dc-corpo td.dc-sel').forEach((td) => td.classList.remove('dc-sel'));
    selecao.forEach((k) => {
      const [r, c] = k.split('_');
      const td = celula(r, c);
      if (td) td.classList.add('dc-sel');
    });
  }

  function aoClicar(e) {
    const sub = e.target.closest('button[data-sub]');
    if (sub) {
      if (!podeSair()) return;
      const pai = linhas[Number(sub.getAttribute('data-pai'))];
      abrirColecao(`${caminho}/${pai.id}/${sub.getAttribute('data-sub')}`);
      return;
    }
    const td = e.target.closest('td.dc-cel');
    if (!td || editando) return;
    const r = Number(td.getAttribute('data-r'));
    const c = Number(td.getAttribute('data-c'));
    if (e.ctrlKey || e.metaKey) {
      const k = `${r}_${c}`;
      if (selecao.has(k)) selecao.delete(k); else selecao.add(k);
      ancora = { r, c };
    } else if (e.shiftKey && ancora) {
      // Intervalo só sobre as linhas visíveis (as escondidas pelo filtro ficam de fora)
      const p1 = visiveis.indexOf(ancora.r), p2 = visiveis.indexOf(r);
      selecao = new Set();
      for (let p = Math.min(p1, p2); p <= Math.max(p1, p2); p++) {
        for (let cc = Math.min(ancora.c, c); cc <= Math.max(ancora.c, c); cc++) selecao.add(`${visiveis[p]}_${cc}`);
      }
    } else {
      selecao = new Set([`${r}_${c}`]);
      ancora = { r, c };
    }
    pintarSelecao();
  }

  function aoDuploClique(e) {
    const td = e.target.closest('td.dc-cel');
    if (!td) return;
    editar(Number(td.getAttribute('data-r')), Number(td.getAttribute('data-c')));
  }

  function editar(r, c) {
    if (editando) fecharEdicao(false);
    const td = celula(r, c);
    if (!td) return;
    editando = { r, c };
    td.innerHTML = '<input type="text" class="dc-entrada">';
    const input = td.querySelector('input');
    input.value = textoAtual(r, c);
    input.focus();
    input.select();
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); fecharEdicao(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); fecharEdicao(false); }
    });
    input.addEventListener('blur', () => fecharEdicao(true));
  }

  function fecharEdicao(confirmar) {
    if (!editando) return;
    const { r, c } = editando;
    editando = null; // antes de mexer no DOM: remover o input dispara "blur" de novo
    const td = celula(r, c);
    const input = td && td.querySelector('input');
    if (confirmar && input) aplicar(r, c, input.value);
    if (td) repintar(r, c);
    atualizarRodape();
  }

  function repintar(r, c) {
    const td = celula(r, c);
    if (!td) return;
    td.textContent = textoAtual(r, c);
    const p = pendencias[linhas[r].id];
    td.classList.toggle('dc-suja', !!p && Object.prototype.hasOwnProperty.call(p, colunas[c]));
  }

  // Devolve false quando o texto não serve para o tipo do campo
  function aplicar(r, c, texto) {
    const linha = linhas[r];
    const campo = colunas[c];
    const original = linha.dados[campo];
    const p = pendencias[linha.id];
    if (texto === exibir(original)) {
      // Voltou ao valor que está no banco: deixa de ser alteração
      if (p) { delete p[campo]; if (!Object.keys(p).length) delete pendencias[linha.id]; }
      return true;
    }
    const res = converter(original, texto);
    if (res.erro) { toast(`${campo}: ${res.erro}`, 'error'); return false; }
    if (!pendencias[linha.id]) pendencias[linha.id] = {};
    pendencias[linha.id][campo] = res.valor;
    return true;
  }

  function aoTeclar(e) {
    if (!raiz || !raiz.isConnected) { document.removeEventListener('keydown', aoTeclar); return; }
    if (editando || !(e.ctrlKey || e.metaKey)) return;
    const alvo = e.target;
    if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return; // campos da barra usam o copiar/colar normal
    const tecla = e.key.toLowerCase();
    if (tecla === 'c') {
      if (!ancora) return;
      e.preventDefault();
      clipboard = textoAtual(ancora.r, ancora.c);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(clipboard).catch(() => {});
    } else if (tecla === 'v') {
      if (clipboard === null || !selecao.size) return;
      e.preventDefault();
      let recusadas = 0;
      selecao.forEach((k) => {
        const [r, c] = k.split('_').map(Number);
        if (!aplicar(r, c, clipboard)) recusadas++;
        repintar(r, c);
      });
      if (recusadas) toast(`${recusadas} célula(s) não aceitaram o valor colado.`, 'warning');
      atualizarRodape();
    }
  }

  // ── Salvar ───────────────────────────────────────────────────────────────
  async function salvar() {
    const ids = Object.keys(pendencias);
    if (!ids.length) return;
    const btn = raiz.querySelector('#dc-salvar');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner-large" style="width:14px;height:14px;"></span> Salvando...';
    const db = B.fdb();
    const col = colRef();
    let salvos = 0;
    try {
      for (let i = 0; i < ids.length; i += MAX_LOTE) {
        const parte = ids.slice(i, i + MAX_LOTE);
        const batch = db.batch();
        parte.forEach((id) => {
          // FieldPath: nomes de campo com ponto ou caracteres especiais não são lidos como caminho
          const args = [];
          Object.keys(pendencias[id]).forEach((campo) => args.push(new firebase.firestore.FieldPath(campo), pendencias[id][campo]));
          batch.update(col.doc(id), ...args);
        });
        await batch.commit();
        parte.forEach((id) => {
          const linha = linhas.find((l) => l.id === id);
          if (linha) Object.assign(linha.dados, pendencias[id]);
          delete pendencias[id];
        });
        salvos += parte.length;
      }
      if (window.BANCO && typeof BANCO.forceCacheRefresh === 'function') BANCO.forceCacheRefresh();
      toast(`${salvos} documento(s) atualizado(s) em ${caminho}.`, 'success');
    } catch (e) {
      console.error('[DevColecoes] Erro ao salvar:', e);
      const motivo = e && e.code === 'not-found' ? 'um dos documentos não existe mais — recarregue a coleção'
        : e && e.code === 'permission-denied' ? 'sem permissão para gravar nesta coleção'
        : (e && e.message) || e;
      toast(`Erro ao salvar${salvos ? ` (${salvos} documento(s) já gravados)` : ''}: ${motivo}`, 'error');
    }
    btn.innerHTML = '<i class="fas fa-check mr-2"></i>Salvar alterações';
    desenhar();
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    const secao = document.getElementById('dev-colecoes');
    if (!secao) return;
    estilos();
    token++;
    caminho = ''; filtro = ''; clipboard = null; carregando = false;
    zerar();
    secao.innerHTML = '';
    raiz = document.createElement('div');
    secao.appendChild(raiz);
    montar();
    const area = raiz.querySelector('#dc-rolagem');
    area.addEventListener('click', aoClicar);
    area.addEventListener('dblclick', aoDuploClique);
    document.removeEventListener('keydown', aoTeclar);
    document.addEventListener('keydown', aoTeclar);
    atualizarRodape();
  }

  // Alterações não salvas (script.js pergunta antes de sair da tela)
  function temAlteracoes() { return !!(raiz && raiz.isConnected && temPendencias()); }

  return { init, temAlteracoes };
})();

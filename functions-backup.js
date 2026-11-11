// functions-backup.js — telas "Download Backup" e "Envio de Backup"
//
// Download: escolhe coleções → lê tudo → baixa um .json (formato em
// functions-backup-formato.js).
//
// Envio, em etapas — nada é gravado antes da confirmação digitada:
//   1. arquivo validado por inteiro (formato, caminhos, tipos);
//   2. análise: lê o estado atual das coleções escolhidas e mostra, por coleção,
//      quantos documentos serão criados, alterados e (modo espelho) apagados;
//   3. o estado atual lido na análise é baixado como backup de segurança;
//   4. gravação em lotes (set sem merge = documento substituído por inteiro).
//      Documentos idênticos ao arquivo são pulados. Se um lote falhar, dá para
//      continuar de onde parou.
//
// Modos: "sobrescrever" (só grava o que está no arquivo) e "espelho" (além
// disso apaga do banco o que não está no arquivo, nas coleções escolhidas).

window.BackupMaster = (function () {
  'use strict';

  const B = window.BackupFormato;
  const MAX_OPS_LOTE = 400;              // limite do Firestore: 500
  const MAX_BYTES_LOTE = 4 * 1024 * 1024; // limite do Firestore: ~10 MB por requisição
  const PALAVRA = 'RESTAURAR';

  const esc = B.esc;
  const toast = (msg, tipo) => { if (typeof showToast === 'function') showToast(msg, tipo || 'info'); };
  const msgErro = (e) => {
    if (e && e.code === 'permission-denied') return 'sem permissão (confira o firestore.rules)';
    if (e && e.code === 'resource-exhausted') return 'cota do Firestore esgotada — tente mais tarde';
    return (e && (e.message || e.code)) || 'erro desconhecido';
  };

  function estilos() {
    if (document.getElementById('bk-estilos')) return;
    const s = document.createElement('style');
    s.id = 'bk-estilos';
    s.textContent = `
      .bk-wrap{max-width:920px;margin:0 auto;font-family:'Open Sans',sans-serif;color:#374151;}
      .bk-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;}
      .bk-card h2{font:700 1.1rem 'Lexend',sans-serif;color:#1f2937;margin:0 0 .25rem;}
      .bk-card h3{font:700 .8rem 'Lexend',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#b45309;margin:0 0 .5rem;}
      .bk-card p{font-size:.82rem;color:#6b7280;margin:.2rem 0;line-height:1.5;}
      .bk-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.25rem .75rem;}
      .bk-item{display:flex;align-items:center;gap:.5rem;font-size:.84rem;padding:.25rem .3rem;border-radius:6px;cursor:pointer;}
      .bk-item:hover{background:#fff7eb;}
      .bk-item small{color:#9ca3af;font-size:.72rem;}
      .bk-item .bk-st{margin-left:auto;font-size:.72rem;color:#6b7280;white-space:nowrap;}
      .bk-acoes{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;}
      .bk-link{background:none;border:none;color:#d97804;font-size:.8rem;font-weight:600;cursor:pointer;padding:0;}
      .bk-link:hover{text-decoration:underline;}
      .bk-aviso{font-size:.8rem;border-radius:8px;padding:.6rem .8rem;margin:.6rem 0;line-height:1.5;}
      .bk-aviso-amarelo{background:#fffbeb;border:1px solid #fde68a;color:#92400e;}
      .bk-aviso-vermelho{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;}
      .bk-aviso-verde{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;}
      .bk-tab{width:100%;border-collapse:collapse;font-size:.82rem;}
      .bk-tab th,.bk-tab td{border-bottom:1px solid #f3f4f6;padding:.4rem .5rem;text-align:right;}
      .bk-tab th:first-child,.bk-tab td:first-child{text-align:left;}
      .bk-tab th{font-weight:700;color:#6b7280;font-size:.72rem;text-transform:uppercase;}
      .bk-apagar{color:#b91c1c;font-weight:700;}
      .bk-modo{display:flex;gap:.6rem;align-items:flex-start;border:2px solid #e5e7eb;border-radius:10px;padding:.6rem .8rem;margin:.4rem 0;cursor:pointer;}
      .bk-modo.ativo{border-color:#f28705;background:#fff7eb;}
      .bk-modo strong{font-size:.86rem;color:#1f2937;}
      .bk-modo span{display:block;font-size:.78rem;color:#6b7280;}
      .bk-barra{height:8px;background:#f3f4f6;border-radius:999px;overflow:hidden;margin:.5rem 0;}
      .bk-barra div{height:100%;background:#f28705;width:0;transition:width .2s;}
      .bk-input{border:2px solid #d1d5db;border-radius:8px;padding:.4rem .6rem;font-size:.85rem;}
      .bk-input:focus{outline:none;border-color:#f28705;}
    `;
    document.head.appendChild(s);
  }

  function listaColecoesHtml(nomesDisponiveis, contagens) {
    return B.grupos().map((g) => {
      const itens = g.colecoes.filter((c) => !nomesDisponiveis || nomesDisponiveis.includes(c.nome));
      if (!itens.length) return '';
      return `<div class="bk-card"><h3>${esc(g.nome)}</h3><div class="bk-grade">${itens.map((c) => `
        <label class="bk-item">
          <input type="checkbox" class="bk-check" value="${esc(c.nome)}">
          <span>${esc(c.nome)}${c.sub ? ` <small>+ ${esc(c.sub.join(', '))}</small>` : ''}</span>
          <span class="bk-st" data-st="${esc(c.nome)}">${contagens ? contagens[c.nome] + ' doc(s)' : ''}</span>
        </label>`).join('')}</div></div>`;
    }).join('');
  }

  const marcadas = (raiz) => Array.from(raiz.querySelectorAll('.bk-check:checked')).map((c) => c.value);

  function avisoRelacionadas(raiz, alvo) {
    const faltas = B.relacionadasFaltando(marcadas(raiz));
    alvo.innerHTML = faltas.length
      ? `<div class="bk-aviso bk-aviso-amarelo"><i class="fas fa-triangle-exclamation mr-1"></i>
          Coleções que dependem uma da outra ficaram de fora:<br>${faltas.map((f) =>
            `<strong>${esc(f.nome)}</strong> → falta ${f.falta.map(esc).join(', ')}`).join('<br>')}
          <br><button type="button" class="bk-link" data-acao="incluir-relacionadas">Marcar as que faltam</button></div>`
      : '';
    const btn = alvo.querySelector('[data-acao="incluir-relacionadas"]');
    if (btn) btn.addEventListener('click', () => {
      faltas.forEach((f) => f.falta.forEach((n) => {
        const c = raiz.querySelector(`.bk-check[value="${n}"]`);
        if (c) c.checked = true;
      }));
      raiz.dispatchEvent(new Event('change'));
    });
  }

  // Avisa antes de fechar a aba enquanto lê/grava
  let ocupado = false;
  window.addEventListener('beforeunload', (e) => { if (ocupado) { e.preventDefault(); e.returnValue = ''; } });

  // ═════════════════════════ DOWNLOAD ═════════════════════════
  function abrirDownload() {
    const secao = document.getElementById('backup-download');
    if (!secao) return;
    estilos();
    secao.innerHTML = `
      <div class="bk-wrap">
        <div class="bk-card">
          <h2><i class="fas fa-download mr-2 text-orange-500"></i>Download Backup</h2>
          <p>Baixa as coleções escolhidas em um arquivo <strong>.json</strong> que pode ser devolvido ao Firestore em
             <strong>Envio de Backup</strong>, com todos os documentos nos mesmos lugares e com os mesmos tipos de dado.</p>
          <p>Cada documento baixado conta como uma leitura na cota do Firestore. Não entram no backup: contas de login
             (Firebase Auth), arquivos do Storage e a colaboração ao vivo (Realtime Database).</p>
          <div class="bk-acoes" style="margin-top:.6rem;">
            <button type="button" class="bk-link" data-acao="todas">Marcar todas</button>
            <button type="button" class="bk-link" data-acao="nenhuma">Desmarcar todas</button>
          </div>
        </div>
        ${listaColecoesHtml(null, null)}
        <div data-area="relacionadas"></div>
        <div class="bk-card">
          <div class="bk-acoes">
            <button type="button" class="btn-primary btn-compact" data-acao="baixar" disabled><i class="fas fa-download mr-2"></i>Baixar backup</button>
            <span class="text-xs text-gray-500" data-area="status">Nenhuma coleção marcada.</span>
          </div>
          <div class="bk-barra"><div data-area="barra"></div></div>
        </div>
      </div>`;
    const raiz = secao.querySelector('.bk-wrap');
    const btn = raiz.querySelector('[data-acao="baixar"]');
    const status = raiz.querySelector('[data-area="status"]');
    const barra = raiz.querySelector('[data-area="barra"]');
    const rel = raiz.querySelector('[data-area="relacionadas"]');

    const atualizar = () => {
      const n = marcadas(raiz).length;
      btn.disabled = !n || ocupado;
      if (!ocupado) status.textContent = n ? `${n} coleção(ões) marcada(s).` : 'Nenhuma coleção marcada.';
      avisoRelacionadas(raiz, rel);
    };
    raiz.addEventListener('change', atualizar);
    raiz.querySelector('[data-acao="todas"]').addEventListener('click', () => { raiz.querySelectorAll('.bk-check').forEach((c) => { c.checked = true; }); atualizar(); });
    raiz.querySelector('[data-acao="nenhuma"]').addEventListener('click', () => { raiz.querySelectorAll('.bk-check').forEach((c) => { c.checked = false; }); atualizar(); });

    btn.addEventListener('click', async () => {
      const nomes = marcadas(raiz);
      if (!nomes.length || ocupado) return;
      ocupado = true;
      btn.disabled = true;
      raiz.querySelectorAll('.bk-check').forEach((c) => { c.disabled = true; });
      raiz.querySelectorAll('.bk-st').forEach((s) => { s.textContent = ''; });
      const colecoes = {};
      let total = 0;
      try {
        for (let i = 0; i < nomes.length; i++) {
          const nome = nomes[i];
          const st = raiz.querySelector(`.bk-st[data-st="${nome}"]`);
          status.textContent = `Lendo ${nome} (${i + 1}/${nomes.length})...`;
          try {
            colecoes[nome] = await B.lerColecao(nome, (n) => { if (st) st.textContent = n + ' lidos...'; });
          } catch (e) {
            if (st) st.textContent = 'erro';
            throw new Error(`${nome}: ${msgErro(e)}`);
          }
          total += colecoes[nome].length;
          if (st) st.textContent = colecoes[nome].length + ' doc(s) ✓';
          barra.style.width = Math.round(((i + 1) / nomes.length) * 100) + '%';
        }
        const nomeArq = `backup-master_${nomes.length === 1 ? nomes[0] : nomes.length + '-colecoes'}_${B.carimbo()}.json`;
        B.baixar(B.montarArquivo(colecoes), nomeArq);
        status.textContent = `Pronto: ${total} documento(s) em ${nomes.length} coleção(ões) → ${nomeArq}`;
        toast('Backup baixado.', 'success');
      } catch (e) {
        console.error('[Backup] Erro no download:', e);
        // Backup pela metade enganaria: nada é baixado se uma coleção falhar
        status.textContent = 'Backup NÃO baixado — ' + e.message;
        toast('Backup não baixado: ' + e.message, 'error');
      } finally {
        ocupado = false;
        raiz.querySelectorAll('.bk-check').forEach((c) => { c.disabled = false; });
        btn.disabled = !marcadas(raiz).length;
      }
    });
  }

  // ═════════════════════════ ENVIO ═════════════════════════
  let envio = null; // estado da tela de envio

  function abrirEnvio() {
    const secao = document.getElementById('backup-envio');
    if (!secao) return;
    estilos();
    envio = { secao, arquivo: null, nomeArquivo: '', modo: 'sobrescrever', plano: null };
    etapaArquivo();
  }

  function cabecalhoEnvio(extra) {
    return `<div class="bk-card">
      <h2><i class="fas fa-upload mr-2 text-orange-500"></i>Envio de Backup</h2>
      <p>Devolve ao Firestore um arquivo gerado em <strong>Download Backup</strong>. Cada documento do arquivo
         <strong>substitui por inteiro</strong> o documento de mesmo caminho no banco.</p>
      ${extra || ''}
    </div>`;
  }

  // ── Etapa 1: escolher arquivo ──
  function etapaArquivo() {
    envio.secao.innerHTML = `<div class="bk-wrap">
      ${cabecalhoEnvio(`<p>Faça o envio com os outros administradores fora do sistema: as telas abertas reagem
         ao vivo às mudanças.</p>`)}
      <div class="bk-card">
        <h3>1. Arquivo de backup</h3>
        <input type="file" accept=".json,application/json" data-area="arquivo" class="text-sm">
        <div data-area="erro"></div>
      </div>
    </div>`;
    const input = envio.secao.querySelector('[data-area="arquivo"]');
    const erro = envio.secao.querySelector('[data-area="erro"]');
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      erro.innerHTML = '<p>Lendo e conferindo o arquivo...</p>';
      let res;
      try {
        res = B.validar(JSON.parse(await f.text()));
      } catch (e) {
        res = { erro: 'Arquivo ilegível (não é um JSON válido).' };
      }
      if (res.erro) {
        erro.innerHTML = `<div class="bk-aviso bk-aviso-vermelho"><i class="fas fa-circle-xmark mr-1"></i>${esc(res.erro)}</div>`;
        return;
      }
      if (!Object.keys(res.colecoes).length) {
        erro.innerHTML = `<div class="bk-aviso bk-aviso-vermelho">O arquivo não tem nenhuma coleção conhecida deste sistema.</div>`;
        return;
      }
      envio.arquivo = res;
      envio.nomeArquivo = f.name;
      etapaEscolha();
    });
  }

  // ── Etapa 2: coleções + modo ──
  function etapaEscolha() {
    const { cab, colecoes, desconhecidas } = envio.arquivo;
    const nomes = Object.keys(colecoes);
    const contagens = {};
    nomes.forEach((n) => { contagens[n] = colecoes[n].length; });
    const outroProjeto = cab.projectId && cab.projectId !== B.projetoAtual();
    const quando = cab.exportadoEm ? new Date(cab.exportadoEm).toLocaleString('pt-BR') : '—';

    envio.secao.innerHTML = `<div class="bk-wrap">
      ${cabecalhoEnvio(`
        <p><strong>${esc(envio.nomeArquivo)}</strong> — exportado em ${esc(quando)}${cab.exportadoPor ? ' por ' + esc(cab.exportadoPor) : ''}
           · projeto <code>${esc(cab.projectId || '?')}</code></p>
        ${outroProjeto ? `<div class="bk-aviso bk-aviso-vermelho"><i class="fas fa-triangle-exclamation mr-1"></i>
          Este backup veio de <strong>outro projeto</strong> (${esc(cab.projectId)}); o projeto aberto é ${esc(B.projetoAtual())}.
          <label class="bk-item" style="margin-top:.3rem;"><input type="checkbox" data-area="aceito-projeto"> Sei disso e quero enviar mesmo assim</label></div>` : ''}
        ${desconhecidas.length ? `<div class="bk-aviso bk-aviso-amarelo">Coleções do arquivo que este sistema não conhece e serão ignoradas:
          ${desconhecidas.map(esc).join(', ')}</div>` : ''}
        <div class="bk-acoes"><button type="button" class="bk-link" data-acao="trocar"><i class="fas fa-arrow-left mr-1"></i>Trocar arquivo</button></div>`)}
      <div class="bk-card" style="padding-bottom:.4rem;">
        <h3>2. Coleções a enviar</h3>
        <div class="bk-acoes">
          <button type="button" class="bk-link" data-acao="todas">Marcar todas</button>
          <button type="button" class="bk-link" data-acao="nenhuma">Desmarcar todas</button>
        </div>
      </div>
      ${listaColecoesHtml(nomes, contagens)}
      <div data-area="relacionadas"></div>
      <div class="bk-card">
        <h3>3. Modo</h3>
        <label class="bk-modo ativo" data-modo="sobrescrever">
          <input type="radio" name="bk-modo" value="sobrescrever" checked>
          <div><strong>Sobrescrever</strong>
            <span>Grava só o que está no arquivo. Documentos que existem no banco e não estão no arquivo ficam como estão. Nada é apagado.</span></div>
        </label>
        <label class="bk-modo" data-modo="espelho">
          <input type="radio" name="bk-modo" value="espelho">
          <div><strong>Espelho</strong>
            <span>O banco fica igual ao arquivo: além de gravar, <strong>apaga</strong> das coleções escolhidas todo documento que não está no arquivo.</span></div>
        </label>
        <div class="bk-acoes" style="margin-top:.7rem;">
          <button type="button" class="btn-primary btn-compact" data-acao="analisar" disabled><i class="fas fa-magnifying-glass mr-2"></i>Analisar (não grava nada)</button>
          <span class="text-xs text-gray-500" data-area="status"></span>
        </div>
      </div>
    </div>`;

    const raiz = envio.secao.querySelector('.bk-wrap');
    const btn = raiz.querySelector('[data-acao="analisar"]');
    const status = raiz.querySelector('[data-area="status"]');
    const rel = raiz.querySelector('[data-area="relacionadas"]');
    const aceito = raiz.querySelector('[data-area="aceito-projeto"]');

    const atualizar = () => {
      const modo = raiz.querySelector('input[name="bk-modo"]:checked').value;
      envio.modo = modo;
      raiz.querySelectorAll('.bk-modo').forEach((m) => m.classList.toggle('ativo', m.getAttribute('data-modo') === modo));
      btn.disabled = ocupado || !marcadas(raiz).length || (aceito && !aceito.checked);
      avisoRelacionadas(raiz, rel);
    };
    raiz.addEventListener('change', atualizar);
    raiz.querySelector('[data-acao="trocar"]').addEventListener('click', () => { if (!ocupado) etapaArquivo(); });
    raiz.querySelector('[data-acao="todas"]').addEventListener('click', () => { raiz.querySelectorAll('.bk-check').forEach((c) => { c.checked = true; }); atualizar(); });
    raiz.querySelector('[data-acao="nenhuma"]').addEventListener('click', () => { raiz.querySelectorAll('.bk-check').forEach((c) => { c.checked = false; }); atualizar(); });
    atualizar();

    btn.addEventListener('click', async () => {
      const escolhidas = marcadas(raiz);
      if (!escolhidas.length || ocupado) return;
      ocupado = true;
      btn.disabled = true;
      try {
        const plano = await analisar(escolhidas, envio.modo, (txt) => { status.textContent = txt; });
        ocupado = false;
        envio.plano = plano;
        etapaConfirmar();
      } catch (e) {
        ocupado = false;
        console.error('[Backup] Erro na análise:', e);
        status.textContent = 'Análise interrompida — ' + e.message;
        toast('Análise interrompida: ' + e.message, 'error');
        atualizar();
      }
    });
  }

  // Lê o estado atual e monta o plano de gravação. Não grava nada.
  async function analisar(escolhidas, modo, dizer) {
    const atual = {};     // nome → [{path,data}] (vira o backup de segurança)
    const resumo = [];
    const gravar = [];    // { path, data, bytes }
    const apagar = [];    // paths
    for (let i = 0; i < escolhidas.length; i++) {
      const nome = escolhidas[i];
      dizer(`Lendo o estado atual de ${nome} (${i + 1}/${escolhidas.length})...`);
      try {
        atual[nome] = await B.lerColecao(nome, (n) => dizer(`Lendo o estado atual de ${nome} (${i + 1}/${escolhidas.length}): ${n}...`));
      } catch (e) {
        throw new Error(`${nome}: ${msgErro(e)}`);
      }
      const noBanco = new Map(atual[nome].map((d) => [d.path, B.estavel(d.data)]));
      const noArquivo = new Set();
      const r = { nome, arquivo: envio.arquivo.colecoes[nome].length, criar: 0, alterar: 0, iguais: 0, apagar: 0, ficam: 0 };
      envio.arquivo.colecoes[nome].forEach((d) => {
        noArquivo.add(d.path);
        const texto = B.estavel(d.data);
        if (!noBanco.has(d.path)) r.criar++;
        else if (noBanco.get(d.path) === texto) { r.iguais++; return; }
        else r.alterar++;
        gravar.push({ path: d.path, data: d.data, bytes: texto.length });
      });
      noBanco.forEach((_, path) => {
        if (noArquivo.has(path)) return;
        if (modo === 'espelho') { r.apagar++; apagar.push(path); } else r.ficam++;
      });
      resumo.push(r);
    }
    // Lotes: gravações primeiro, exclusões por último
    const lotes = [];
    let lote = [], bytes = 0;
    const fechar = () => { if (lote.length) { lotes.push(lote); lote = []; bytes = 0; } };
    gravar.forEach((g) => {
      if (lote.length >= MAX_OPS_LOTE || (lote.length && bytes + g.bytes > MAX_BYTES_LOTE)) fechar();
      lote.push({ tipo: 'set', path: g.path, data: g.data });
      bytes += g.bytes;
    });
    fechar();
    apagar.forEach((path) => {
      if (lote.length >= MAX_OPS_LOTE) fechar();
      lote.push({ tipo: 'delete', path });
    });
    fechar();
    return { modo, escolhidas, atual, resumo, lotes, feitos: 0, totalOps: gravar.length + apagar.length, segurancaBaixada: false };
  }

  // ── Etapa 3: prévia + confirmação ──
  function etapaConfirmar() {
    const p = envio.plano;
    const espelho = p.modo === 'espelho';
    const tot = p.resumo.reduce((a, r) => ({ criar: a.criar + r.criar, alterar: a.alterar + r.alterar, iguais: a.iguais + r.iguais, apagar: a.apagar + r.apagar, ficam: a.ficam + r.ficam }),
      { criar: 0, alterar: 0, iguais: 0, apagar: 0, ficam: 0 });
    const linha = (r, forte) => `<tr${forte ? ' style="font-weight:700;"' : ''}>
      <td>${esc(r.nome)}</td><td>${r.criar}</td><td>${r.alterar}</td><td>${r.iguais}</td>
      <td class="${espelho && r.apagar ? 'bk-apagar' : ''}">${espelho ? r.apagar : '—'}</td><td>${espelho ? '—' : r.ficam}</td></tr>`;

    envio.secao.innerHTML = `<div class="bk-wrap">
      ${cabecalhoEnvio(`<p><strong>${esc(envio.nomeArquivo)}</strong> · modo <strong>${espelho ? 'Espelho' : 'Sobrescrever'}</strong></p>`)}
      <div class="bk-card">
        <h3>4. O que vai acontecer</h3>
        <div style="overflow-x:auto;"><table class="bk-tab sem-cartao">
          <thead><tr><th>Coleção</th><th>Criar</th><th>Alterar</th><th>Já iguais</th><th>Apagar</th><th>Ficam no banco</th></tr></thead>
          <tbody>${p.resumo.map((r) => linha(r)).join('')}${linha(Object.assign({ nome: 'Total' }, tot), true)}</tbody>
        </table></div>
        <p style="margin-top:.5rem;">"Ficam no banco": documentos que não estão no arquivo e não serão tocados (modo Sobrescrever).
           Subcoleções entram na contagem da coleção pai.</p>
        ${espelho && tot.apagar ? `<div class="bk-aviso bk-aviso-vermelho"><i class="fas fa-triangle-exclamation mr-1"></i>
          <strong>${tot.apagar} documento(s) serão apagados</strong> por não estarem no arquivo.</div>` : ''}
        ${p.totalOps === 0 ? `<div class="bk-aviso bk-aviso-verde"><i class="fas fa-circle-check mr-1"></i>O banco já está igual ao arquivo nas coleções escolhidas. Não há nada a gravar.</div>` : `
        <div class="bk-aviso bk-aviso-amarelo">
          Ao enviar, o estado atual destas coleções é baixado antes como <strong>backup de segurança</strong> (guarde o arquivo: é ele que desfaz este envio).
          Serão ${p.totalOps} gravação(ões) em ${p.lotes.length} lote(s). O envio não é atômico entre lotes: se parar no meio, dá para continuar.
        </div>
        <div class="bk-acoes">
          <label class="text-sm">Digite <strong>${PALAVRA}</strong>:
            <input type="text" class="bk-input" data-area="palavra" autocomplete="off" style="width:150px;margin-left:.3rem;"></label>
          <button type="button" class="btn-primary btn-compact" data-acao="enviar" disabled><i class="fas fa-upload mr-2"></i>Enviar backup</button>
        </div>`}
        <div class="bk-barra"><div data-area="barra"></div></div>
        <p data-area="status"></p>
        <div class="bk-acoes"><button type="button" class="bk-link" data-acao="voltar"><i class="fas fa-arrow-left mr-1"></i>Voltar</button></div>
      </div>
    </div>`;

    const raiz = envio.secao.querySelector('.bk-wrap');
    raiz.querySelector('[data-acao="voltar"]').addEventListener('click', () => { if (!ocupado) etapaEscolha(); });
    const btn = raiz.querySelector('[data-acao="enviar"]');
    if (!btn) return;
    const palavra = raiz.querySelector('[data-area="palavra"]');
    palavra.addEventListener('input', () => { btn.disabled = ocupado || palavra.value.trim() !== PALAVRA; });
    btn.addEventListener('click', () => {
      if (ocupado || palavra.value.trim() !== PALAVRA) return;
      palavra.disabled = true;
      executar(raiz, btn);
    });
  }

  // ── Etapa 4: gravação ──
  async function executar(raiz, btn) {
    const p = envio.plano;
    const status = raiz.querySelector('[data-area="status"]');
    const barra = raiz.querySelector('[data-area="barra"]');
    ocupado = true;
    btn.disabled = true;

    if (!p.segurancaBaixada) {
      B.baixar(B.montarArquivo(p.atual, { tipo: 'seguranca-pre-envio' }), `backup-seguranca-antes-do-envio_${B.carimbo()}.json`);
      p.segurancaBaixada = true;
    }

    const db = B.fdb();
    let opsFeitas = p.lotes.slice(0, p.feitos).reduce((a, l) => a + l.length, 0);
    try {
      while (p.feitos < p.lotes.length) {
        const lote = p.lotes[p.feitos];
        status.textContent = `Gravando lote ${p.feitos + 1} de ${p.lotes.length}...`;
        const batch = db.batch();
        lote.forEach((op) => {
          const ref = db.doc(op.path);
          if (op.tipo === 'set') batch.set(ref, B.desserializar(op.data));
          else batch.delete(ref);
        });
        await batch.commit();
        p.feitos++;
        opsFeitas += lote.length;
        barra.style.width = Math.round((opsFeitas / p.totalOps) * 100) + '%';
      }
      ocupado = false;
      if (window.BANCO && typeof BANCO.forceCacheRefresh === 'function') BANCO.forceCacheRefresh();
      status.innerHTML = `<span class="bk-aviso bk-aviso-verde" style="display:block;"><i class="fas fa-circle-check mr-1"></i>
        Envio concluído: ${p.totalOps} gravação(ões) em ${p.escolhidas.length} coleção(ões). Recarregue a página para as telas abertas lerem os dados novos.</span>`;
      toast('Backup enviado com sucesso.', 'success');
    } catch (e) {
      ocupado = false;
      console.error('[Backup] Erro no envio:', e);
      status.innerHTML = `<span class="bk-aviso bk-aviso-vermelho" style="display:block;"><i class="fas fa-circle-xmark mr-1"></i>
        Parou no lote ${p.feitos + 1} de ${p.lotes.length} — ${esc(msgErro(e))}.
        ${opsFeitas} de ${p.totalOps} gravação(ões) já foram aplicadas; o lote que falhou não gravou nada.</span>`;
      btn.innerHTML = '<i class="fas fa-rotate-right mr-2"></i>Continuar de onde parou';
      btn.disabled = false;
      toast('Envio interrompido: ' + msgErro(e), 'error');
    }
  }

  return { abrirDownload, abrirEnvio, emAndamento: () => ocupado };
})();

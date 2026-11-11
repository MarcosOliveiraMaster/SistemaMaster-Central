// functions-backup-formato.js — Catálogo de coleções + formato do backup
//
// Usado por: Editor de Coleções (functions-dev-colecoes.js) e pelas telas
// Download/Envio de Backup (functions-backup.js).
//
// Arquivo de backup (JSON):
//   { formato: 'master-backup', versao: 1, projectId, exportadoEm, exportadoPor,
//     colecoes: { <nome>: { total, docs: [ { path, data } ] } } }
//
// `path` é o caminho completo do documento (ex.: "quadros/abc/paginas/p1"), então
// documentos de subcoleção voltam exatamente para o mesmo lugar.
//
// JSON não guarda os tipos do Firestore. Cada valor especial vai com um marcador
// e é reconstruído no envio:
//   Timestamp          → { __tipo: 'timestamp', s, ns }
//   GeoPoint           → { __tipo: 'geopoint', lat, lng }
//   DocumentReference  → { __tipo: 'ref', path }
//   Bytes              → { __tipo: 'bytes', b64 }
//   NaN / ±Infinity    → { __tipo: 'numero', v }
//   mapa que já tem a chave "__tipo" → { __tipo: 'mapa', v: {...} }
//
// O SDK web não lista coleções: coleção nova no sistema precisa entrar em COLECOES.

window.BackupFormato = (function () {
  'use strict';

  const FORMATO = 'master-backup';
  const VERSAO = 1;
  const PAGINA = 300;          // documentos por leitura
  const PARALELO_SUB = 6;      // subcoleções lidas ao mesmo tempo

  // nome, grupo (só visual), sub (subcoleções de cada documento),
  // junto (coleções que dependem uma da outra e devem ir no mesmo backup/envio)
  const COLECOES = [
    { nome: 'BancoDeAulas',          grupo: 'Aulas e contratos', junto: ['BancoDeAulas-Lista', 'contadores'] },
    { nome: 'BancoDeAulas-Lista',    grupo: 'Aulas e contratos', junto: ['BancoDeAulas'] },
    { nome: 'contadores',            grupo: 'Aulas e contratos', junto: ['BancoDeAulas'] },
    { nome: 'simulacoes',            grupo: 'Aulas e contratos' },
    { nome: 'conteudosContratacoes', grupo: 'Aulas e contratos' },
    { nome: 'registrosAula',         grupo: 'Aulas e contratos' },
    { nome: 'avaliacoesAula',        grupo: 'Aulas e contratos' },
    { nome: 'quadros',               grupo: 'Aulas e contratos', sub: ['paginas'] },

    { nome: 'cadastroClientes',      grupo: 'Pessoas' },
    { nome: 'locaisClientes',        grupo: 'Pessoas' },
    { nome: 'orientacoesAlunos',     grupo: 'Pessoas' },
    { nome: 'configOrientacoes',     grupo: 'Pessoas' },
    { nome: 'dataBaseProfessores',   grupo: 'Pessoas' },
    { nome: 'candidatos',            grupo: 'Pessoas', junto: ['entrevistaSlots'] },
    { nome: 'entrevistaSlots',       grupo: 'Pessoas', junto: ['candidatos'] },
    { nome: 'atendentes',            grupo: 'Pessoas' },
    { nome: 'logsAtendimento',       grupo: 'Pessoas' },

    { nome: 'propostasProfessores',  grupo: 'Propostas e avaliações', junto: ['respostasPropostas'] },
    { nome: 'respostasPropostas',    grupo: 'Propostas e avaliações', junto: ['propostasProfessores'] },
    { nome: 'solicitacoesCliente',   grupo: 'Propostas e avaliações' },
    { nome: 'avaliacoesEquipe',      grupo: 'Propostas e avaliações' },

    { nome: 'investimentos',         grupo: 'Financeiro' },
    { nome: 'informacoesPagamento',  grupo: 'Financeiro' },
    { nome: 'relatorioFinanceiro',   grupo: 'Financeiro' },
    { nome: 'organizacaoRecursos',   grupo: 'Financeiro' },

    { nome: 'Disciplinas',           grupo: 'Operação e configuração' },
    { nome: 'calendario',            grupo: 'Operação e configuração' },
    { nome: 'listasTarefas',         grupo: 'Operação e configuração', sub: ['itens'] },
    { nome: 'processos',             grupo: 'Operação e configuração' },
    { nome: 'configuracoes',         grupo: 'Operação e configuração' }
  ];

  const porNome = {};
  COLECOES.forEach((c) => { porNome[c.nome] = c; });

  function fdb() { return firebase.firestore(); }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Tipos ────────────────────────────────────────────────────────────────
  const ehTimestamp = (v) => typeof v.toDate === 'function' && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number';
  const ehGeoPoint  = (v) => typeof v.latitude === 'number' && typeof v.longitude === 'number' && typeof v.isEqual === 'function';
  const ehRef       = (v) => typeof v.path === 'string' && typeof v.get === 'function' && typeof v.collection === 'function';
  const ehBytes     = (v) => typeof v.toBase64 === 'function';

  function serializar(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : { __tipo: 'numero', v: String(v) };
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(serializar);
    if (ehTimestamp(v)) return { __tipo: 'timestamp', s: v.seconds, ns: v.nanoseconds };
    if (ehGeoPoint(v))  return { __tipo: 'geopoint', lat: v.latitude, lng: v.longitude };
    if (ehRef(v))       return { __tipo: 'ref', path: v.path };
    if (ehBytes(v))     return { __tipo: 'bytes', b64: v.toBase64() };
    const o = {};
    Object.keys(v).forEach((k) => { o[k] = serializar(v[k]); });
    return Object.prototype.hasOwnProperty.call(v, '__tipo') ? { __tipo: 'mapa', v: o } : o;
  }

  function mapaSimples(v) {
    const o = {};
    Object.keys(v).forEach((k) => { o[k] = desserializar(v[k]); });
    return o;
  }

  function desserializar(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(desserializar);
    if (Object.prototype.hasOwnProperty.call(v, '__tipo')) {
      const F = firebase.firestore;
      switch (v.__tipo) {
        case 'timestamp': return new F.Timestamp(Number(v.s), Number(v.ns) || 0);
        case 'geopoint':  return new F.GeoPoint(Number(v.lat), Number(v.lng));
        case 'ref':       return fdb().doc(String(v.path));
        case 'bytes':     return F.Blob.fromBase64String(String(v.b64));
        case 'numero':    return Number(v.v);
        case 'mapa':      return mapaSimples(v.v || {});
        default: throw new Error('Tipo desconhecido no backup: ' + v.__tipo);
      }
    }
    return mapaSimples(v);
  }

  // JSON com chaves ordenadas: compara dois documentos sem depender da ordem dos campos
  function estavel(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}';
  }

  // ── Leitura ──────────────────────────────────────────────────────────────
  // Lê todos os documentos de uma referência de coleção, em páginas.
  async function lerRef(colRef, saida, aoProgredir) {
    const idCampo = firebase.firestore.FieldPath.documentId();
    const ids = [];
    let ultimo = null;
    for (;;) {
      let q = colRef.orderBy(idCampo).limit(PAGINA);
      if (ultimo) q = q.startAfter(ultimo);
      const snap = await q.get();
      snap.forEach((d) => {
        saida.push({ path: d.ref.path, data: serializar(d.data()) });
        ids.push(d.id);
      });
      if (aoProgredir) aoProgredir(saida.length);
      if (snap.size < PAGINA) break;
      ultimo = snap.docs[snap.docs.length - 1];
    }
    return ids;
  }

  // Lê a coleção inteira + as subcoleções do catálogo. Devolve [{ path, data }].
  async function lerColecao(nome, aoProgredir) {
    const def = porNome[nome] || { nome };
    const saida = [];
    const colRef = fdb().collection(nome);
    const ids = await lerRef(colRef, saida, aoProgredir);
    const subs = def.sub || [];
    if (subs.length && ids.length) {
      const fila = [];
      ids.forEach((id) => subs.forEach((s) => fila.push(colRef.doc(id).collection(s))));
      let proximo = 0;
      const operario = async () => {
        while (proximo < fila.length) {
          const ref = fila[proximo++];
          await lerRef(ref, saida, null);
          if (aoProgredir) aoProgredir(saida.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALELO_SUB, fila.length) }, operario));
    }
    return saida;
  }

  // ── Arquivo ──────────────────────────────────────────────────────────────
  function projetoAtual() {
    try { return firebase.app().options.projectId || ''; } catch (e) { return ''; }
  }

  function usuarioAtual() {
    return (window.currentUser && window.currentUser.email) || ((firebase.auth().currentUser || {}).email) || '';
  }

  // colecoes: { nome: [ { path, data } ] } → Blob (montado em partes para não
  // criar uma única string gigante)
  function montarArquivo(colecoes, extra) {
    const cab = Object.assign({
      formato: FORMATO, versao: VERSAO, projectId: projetoAtual(),
      exportadoEm: new Date().toISOString(), exportadoPor: usuarioAtual()
    }, extra || {});
    const partes = [JSON.stringify(cab).slice(0, -1), ',"colecoes":{'];
    Object.keys(colecoes).forEach((nome, i) => {
      const docs = colecoes[nome];
      partes.push((i ? ',' : '') + JSON.stringify(nome) + ':{"total":' + docs.length + ',"docs":[');
      docs.forEach((d, j) => partes.push((j ? ',\n' : '\n') + JSON.stringify(d)));
      partes.push('\n]}');
    });
    partes.push('}}');
    return new Blob(partes, { type: 'application/json' });
  }

  function baixar(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function carimbo() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
  }

  // Caminho de documento válido dentro da coleção `nome` (e só nas subcoleções do catálogo)
  function caminhoValido(nome, path) {
    if (typeof path !== 'string') return false;
    const seg = path.split('/');
    if (seg.some((s) => !s) || seg[0] !== nome) return false;
    if (seg.length === 2) return true;
    const def = porNome[nome];
    return seg.length === 4 && !!def && (def.sub || []).includes(seg[2]);
  }

  // Confere o arquivo inteiro antes de qualquer gravação. Devolve { erro } ou
  // { cab, colecoes: { nome: [docs] }, desconhecidas: [nomes fora do catálogo] }
  function validar(obj) {
    if (!obj || typeof obj !== 'object' || obj.formato !== FORMATO) return { erro: 'Este arquivo não é um backup do Sistema Master.' };
    if (obj.versao !== VERSAO) return { erro: `Versão de backup não suportada (${obj.versao}).` };
    if (!obj.colecoes || typeof obj.colecoes !== 'object') return { erro: 'Backup sem coleções.' };
    const colecoes = {};
    const desconhecidas = [];
    for (const nome of Object.keys(obj.colecoes)) {
      if (!porNome[nome]) { desconhecidas.push(nome); continue; }
      const docs = obj.colecoes[nome] && obj.colecoes[nome].docs;
      if (!Array.isArray(docs)) return { erro: `Coleção "${nome}" sem lista de documentos.` };
      const vistos = new Set();
      for (const d of docs) {
        if (!d || !caminhoValido(nome, d.path)) return { erro: `Caminho inválido em "${nome}": ${d && d.path}` };
        if (!d.data || typeof d.data !== 'object' || Array.isArray(d.data)) return { erro: `Documento sem dados: ${d.path}` };
        if (vistos.has(d.path)) return { erro: `Documento repetido no arquivo: ${d.path}` };
        vistos.add(d.path);
        try { desserializar(d.data); } catch (e) { return { erro: `${d.path}: ${e.message}` }; }
      }
      colecoes[nome] = docs;
    }
    const cab = { projectId: obj.projectId || '', exportadoEm: obj.exportadoEm || '', exportadoPor: obj.exportadoPor || '', tipo: obj.tipo || '' };
    return { cab, colecoes, desconhecidas };
  }

  // Coleções relacionadas às escolhidas que ficaram de fora: [{ nome, falta: [..] }]
  function relacionadasFaltando(nomes) {
    const escolhidas = new Set(nomes);
    return nomes.map((n) => ({ nome: n, falta: ((porNome[n] || {}).junto || []).filter((j) => !escolhidas.has(j)) }))
      .filter((x) => x.falta.length);
  }

  function grupos() {
    const g = [];
    COLECOES.forEach((c) => {
      let item = g.find((x) => x.nome === c.grupo);
      if (!item) { item = { nome: c.grupo, colecoes: [] }; g.push(item); }
      item.colecoes.push(c);
    });
    return g;
  }

  return {
    COLECOES, porNome, grupos, fdb, esc,
    serializar, desserializar, estavel,
    lerColecao, montarArquivo, baixar, carimbo, validar,
    relacionadasFaltando, projetoAtual
  };
})();

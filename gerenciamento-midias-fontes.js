// gerenciamento-midias-fontes.js
// De onde vem cada tipo de mídia da área "Gerenciamento de mídias" e como
// ela é nomeada, lida e apagada. Tudo fica no Firestore (plano Spark, sem
// Storage):
//
//   Mídias de aulas      registrosAula/{id}.foto — data URL JPEG; mesmo id da
//                        aula em BancoDeAulas-Lista (que tem temRegistroFoto)
//   Fotos de professores dataBaseProfessores/{id}.fotoUpload (+ fotoUploadEm)
//   Quadros de aulas     quadros/{id} + quadros/{id}/paginas/{0..9}.dados
//
// Nome dos arquivos: "dd-mm-aaaa - Apelido professor - Apelido cliente".
//
// Uso de memória: configuracoes/usoMidias guarda quantidade e tamanho das
// fotos de aulas e dos quadros (somar exige ler tudo, então só o botão
// "Recalcular" faz isso; as exclusões feitas aqui descontam do resumo).
// As fotos de professores são poucas e já vêm carregadas: contam na hora.
//
// Toda fonte expõe a mesma interface para gerenciamento-midias.js:
//   total(), pagina(n), todos() (async generator), apagar(item),
//   apagarTodos(aoProgresso), visualizar(item)
// e cada item: { id, nome, ext, miniatura, detalhe, bytes, conteudo() → Blob }

import { sanitizarPagina, gerarPdf, MAX_PAGINAS, abrirVisualizadorQuadro } from './quadro-render.js';
import { dataUrlParaBlob } from './gerenciamento-midias-zip.js';

export const LIMITE_BYTES = 1024 * 1024 * 1024; // 1 GB do plano gratuito do Firestore
export const POR_PAGINA = 20;
const LOTE = 100;          // documentos por leitura/gravação em massa (batch aceita até 500)
const PREFIXO_JPEG = 'data:image/jpeg;base64,';

const fdb = () => firebase.firestore();
const resumoRef = () => fdb().collection('configuracoes').doc('usoMidias');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const primeiroNome = (s) => texto(s).split(/\s+/)[0] || '';
const pad = (n) => String(n).padStart(2, '0');

// Campos de dataBaseProfessores aparecem com maiúscula em alguns cadastros antigos.
function campo(obj, chave) {
  if (!obj) return undefined;
  for (const k of [chave, chave.charAt(0).toUpperCase() + chave.slice(1), chave.toLowerCase(), chave.toUpperCase()]) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

export function fotoAulaValida(v) {
  return typeof v === 'string' && v.startsWith(PREFIXO_JPEG)
    && /^[A-Za-z0-9+/]+={0,2}$/.test(v.slice(PREFIXO_JPEG.length));
}

const FOTO_PERFIL = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
export const fotoPerfilValida = (v) => typeof v === 'string' && FOTO_PERFIL.test(v);
const extensaoFoto = (v) => ({ jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' }[FOTO_PERFIL.exec(v)?.[1]] || 'jpg');

/** Tira do nome o que Windows/macOS não aceitam em arquivo. */
export function limparNome(s) {
  return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'midia';
}

/** "dd/mm/aaaa", "aaaa-mm-dd", "dd-mm-aaaa", Timestamp ou Date → "dd-mm-aaaa". */
export function dataArquivo(v) {
  let d = null;
  if (v && typeof v.toDate === 'function') d = v.toDate();
  else if (v instanceof Date) d = v;
  else if (typeof v === 'string') {
    let m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = v.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return d && !isNaN(d) ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : 'sem data';
}

// ── Cadastros (apelidos + fotos de professores) ─────────────────────────────
// Lidos uma vez por abertura da área.
let cadastros = null;

export function carregarCadastros(forcar = false) {
  if (!cadastros || forcar) {
    cadastros = Promise.all([
      fdb().collection('dataBaseProfessores').get(),
      fdb().collection('cadastroClientes').get()
    ]).then(([ps, cs]) => {
      const professores = [];
      const profPorEmail = new Map();
      const profPorNome = new Map();
      const cliPorNome = new Map();
      ps.forEach((d) => {
        const p = { id: d.id, ...d.data() };
        professores.push(p);
        const nome = texto(campo(p, 'nome'));
        const apelido = texto(campo(p, 'apelido')) || primeiroNome(nome);
        const email = norm(campo(p, 'email'));
        if (email && apelido) profPorEmail.set(email, apelido);
        if (nome && apelido) profPorNome.set(norm(nome), apelido);
      });
      cs.forEach((d) => {
        const c = d.data();
        const nome = texto(c.nome);
        if (nome) cliPorNome.set(norm(nome), texto(c.apelido) || primeiroNome(nome));
      });
      return { professores, profPorEmail, profPorNome, cliPorNome };
    });
    cadastros.catch(() => { cadastros = null; });
  }
  return cadastros;
}

const apelidoProfessor = (cad, email, nome) =>
  cad.profPorEmail.get(norm(email)) || cad.profPorNome.get(norm(nome)) || primeiroNome(nome) || texto(email).split('@')[0] || 'Professor';
const apelidoCliente = (cad, nome) => cad.cliPorNome.get(norm(nome)) || primeiroNome(nome) || 'Cliente';

// ── Resumo de uso (configuracoes/usoMidias) ─────────────────────────────────
let resumo; // undefined = não lido; null = não existe ainda

export async function lerResumo(forcar = false) {
  if (resumo === undefined || forcar) {
    const snap = await resumoRef().get();
    resumo = snap.exists ? snap.data() : null;
  }
  return resumo;
}

// Desconta uma exclusão do resumo (só se ele já existir: sem resumo, o
// próximo "Recalcular" acerta tudo).
async function descontar(tipo, qtd, bytes) {
  if (!resumo || !resumo[tipo]) return;
  const inc = firebase.firestore.FieldValue.increment;
  await resumoRef().set({ [tipo]: { qtd: inc(-qtd), bytes: inc(-bytes) } }, { merge: true });
  resumo[tipo].qtd = Math.max(0, (resumo[tipo].qtd || 0) - qtd);
  resumo[tipo].bytes = Math.max(0, (resumo[tipo].bytes || 0) - bytes);
}

async function zerar(tipo) {
  await resumoRef().set({ [tipo]: { qtd: 0, bytes: 0 } }, { merge: true });
  if (resumo) resumo[tipo] = { qtd: 0, bytes: 0 };
}

/** Lê tudo uma vez e grava o resumo. aoProgresso(feitos, fase). */
export async function recalcularResumo(aoProgresso = () => {}) {
  const col = fdb().collection('registrosAula');
  const porId = firebase.firestore.FieldPath.documentId();
  const aulas = { qtd: 0, bytes: 0 };
  let ultimo = null;
  for (;;) {
    let q = col.orderBy(porId).limit(LOTE);
    if (ultimo) q = q.startAfter(ultimo);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach((d) => {
      const foto = d.data().foto;
      if (typeof foto === 'string' && foto) { aulas.qtd++; aulas.bytes += foto.length; }
    });
    ultimo = snap.docs[snap.docs.length - 1];
    aoProgresso(aulas.qtd, 'aulas');
    if (snap.size < LOTE) break;
  }

  const quadros = { qtd: 0, bytes: 0 };
  const qs = await fdb().collection('quadros').get();
  for (const d of qs.docs) {
    quadros.qtd++;
    quadros.bytes += await tamanhoQuadro(d.ref);
    aoProgresso(quadros.qtd, 'quadros');
  }

  const novo = { aulas, quadros, calculadoEm: firebase.firestore.FieldValue.serverTimestamp() };
  await resumoRef().set(novo);
  resumo = { aulas, quadros, calculadoEm: new Date() };
  return resumo;
}

async function tamanhoQuadro(ref) {
  const pgs = await ref.collection('paginas').get();
  let bytes = 0;
  pgs.forEach((p) => { const dados = p.data().dados; if (typeof dados === 'string') bytes += dados.length; });
  return bytes;
}

// ── Mídias de aulas ─────────────────────────────────────────────────────────
function fonteAulas() {
  const col = () => fdb().collection('registrosAula');
  // cursores[n] = último documento da página n-1 (startAfter da página n).
  const cursores = [null];

  async function montar(docs) {
    const cad = await carregarCadastros();
    const aulas = await Promise.all(docs.map((d) =>
      fdb().collection('BancoDeAulas-Lista').doc(d.id).get().catch(() => null)));
    return docs.map((d, i) => {
      const r = d.data();
      const a = aulas[i] && aulas[i].exists ? aulas[i].data() : {};
      const foto = fotoAulaValida(r.foto) ? r.foto : null;
      const nome = limparNome([
        dataArquivo(a.data),
        apelidoProfessor(cad, a.professorEmail, a.professor),
        apelidoCliente(cad, a.nomeCliente)
      ].join(' - '));
      return {
        id: d.id, nome, ext: 'jpg', miniatura: foto, detalhe: '',
        bytes: typeof r.foto === 'string' ? r.foto.length : 0,
        conteudo: async () => (foto ? dataUrlParaBlob(foto) : null)
      };
    });
  }

  async function lerPagina(cursor, limite) {
    let q = col().orderBy('enviadoEm', 'desc').limit(limite);
    if (cursor) q = q.startAfter(cursor);
    return q.get();
  }

  return {
    chave: 'aulas',
    vazio: 'Nenhuma foto de aula no sistema.',
    total: () => (resumo && resumo.aulas ? resumo.aulas.qtd : null),
    async pagina(n) {
      if (n > 0 && cursores[n] === undefined) throw new Error('Abra as páginas em ordem.');
      const snap = await lerPagina(cursores[n], POR_PAGINA);
      cursores.length = n + 1;
      if (snap.size === POR_PAGINA) cursores[n + 1] = snap.docs[snap.size - 1];
      return { itens: await montar(snap.docs), temProxima: snap.size === POR_PAGINA };
    },
    async *todos() {
      let cursor = null;
      for (;;) {
        const snap = await lerPagina(cursor, POR_PAGINA);
        if (snap.empty) return;
        yield* await montar(snap.docs);
        if (snap.size < POR_PAGINA) return;
        cursor = snap.docs[snap.size - 1];
      }
    },
    async apagar(item) {
      await col().doc(item.id).delete();
      await fdb().collection('BancoDeAulas-Lista').doc(item.id).update({ temRegistroFoto: false })
        .catch((err) => console.warn('[Mídias] Aula sem documento na lista:', item.id, err));
      await descontar('aulas', 1, item.bytes);
    },
    async apagarTodos(aoProgresso = () => {}) {
      let feitos = 0;
      for (;;) {
        const snap = await col().limit(LOTE).get();
        if (snap.empty) break;
        const lote = fdb().batch();
        snap.forEach((d) => lote.delete(d.ref));
        await lote.commit();
        // A aula pode já ter sido apagada: atualização individual, sem derrubar o lote.
        await Promise.allSettled(snap.docs.map((d) =>
          fdb().collection('BancoDeAulas-Lista').doc(d.id).update({ temRegistroFoto: false })));
        feitos += snap.size;
        aoProgresso(feitos);
      }
      cursores.length = 1;
      await zerar('aulas');
      return feitos;
    },
    visualizar: null
  };
}

// ── Fotos de professores ────────────────────────────────────────────────────
const desligado = (p) => norm(campo(p, 'status')) === 'desligado';

function fonteProfessores(desligados) {
  async function lista() {
    const cad = await carregarCadastros();
    return cad.professores
      .filter((p) => desligado(p) === desligados && fotoPerfilValida(p.fotoUpload))
      .sort((a, b) => texto(campo(a, 'nome')).localeCompare(texto(campo(b, 'nome')), 'pt-BR'));
  }

  function item(p) {
    const nome = texto(campo(p, 'nome'));
    const apelido = texto(campo(p, 'apelido')) || primeiroNome(nome) || 'Professor';
    return {
      id: p.id,
      nome: limparNome(nome && nome !== apelido ? `${apelido} - ${nome}` : apelido),
      rotulo: apelido,
      ext: extensaoFoto(p.fotoUpload),
      miniatura: p.fotoUpload,
      detalhe: desligados ? 'Desligado' : '',
      bytes: p.fotoUpload.length,
      conteudo: async () => dataUrlParaBlob(p.fotoUpload),
      _prof: p
    };
  }

  const semFoto = () => ({
    fotoUpload: firebase.firestore.FieldValue.delete(),
    fotoUploadEm: firebase.firestore.FieldValue.delete()
  });

  let quantidade = null;

  return {
    chave: desligados ? 'prof-desligados' : 'prof-ativos',
    vazio: desligados ? 'Nenhum professor desligado com foto.' : 'Nenhum professor ativo com foto.',
    total: () => quantidade,
    async pagina(n) {
      const ps = await lista();
      quantidade = ps.length;
      const fatia = ps.slice(n * POR_PAGINA, (n + 1) * POR_PAGINA);
      return { itens: fatia.map(item), temProxima: (n + 1) * POR_PAGINA < ps.length };
    },
    async *todos() {
      for (const p of await lista()) yield item(p);
    },
    async apagar(it) {
      await fdb().collection('dataBaseProfessores').doc(it.id).update(semFoto());
      delete it._prof.fotoUpload;
      delete it._prof.fotoUploadEm;
    },
    async apagarTodos(aoProgresso = () => {}) {
      const ps = await lista();
      let feitos = 0;
      for (let i = 0; i < ps.length; i += LOTE) {
        const parte = ps.slice(i, i + LOTE);
        const lote = fdb().batch();
        parte.forEach((p) => lote.update(fdb().collection('dataBaseProfessores').doc(p.id), semFoto()));
        await lote.commit();
        parte.forEach((p) => { delete p.fotoUpload; delete p.fotoUploadEm; });
        feitos += parte.length;
        aoProgresso(feitos);
      }
      return feitos;
    },
    visualizar: null
  };
}

/** Uso das fotos de professores, contado na hora (os cadastros já estão carregados). */
export async function usoProfessores() {
  const cad = await carregarCadastros();
  const uso = { qtd: 0, bytes: 0, desligadosQtd: 0, desligadosBytes: 0 };
  cad.professores.forEach((p) => {
    if (!fotoPerfilValida(p.fotoUpload)) return;
    uso.qtd++;
    uso.bytes += p.fotoUpload.length;
    if (desligado(p)) { uso.desligadosQtd++; uso.desligadosBytes += p.fotoUpload.length; }
  });
  return uso;
}

// ── Quadros de aulas ────────────────────────────────────────────────────────
function fonteQuadros() {
  let quadros = null;
  const dataDe = (q) => q.atualizadoEm || q.criadoEm;
  const ms = (ts) => (ts && ts.toDate ? ts.toDate().getTime() : 0);

  async function lista() {
    if (!quadros) {
      const snap = await fdb().collection('quadros').get();
      quadros = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => ms(dataDe(b)) - ms(dataDe(a)));
    }
    return quadros;
  }

  async function lerPaginas(q) {
    const snap = await fdb().collection('quadros').doc(q.id).collection('paginas').get();
    const porIndice = new Map();
    snap.forEach((d) => porIndice.set(d.id, d.data().dados));
    const n = Math.max(1, Math.min(MAX_PAGINAS, Number(q.paginas) || porIndice.size || 1));
    return Array.from({ length: n }, (_, i) => porIndice.get(String(i)) || '');
  }

  function item(cad, q) {
    const paginas = Math.max(1, Number(q.paginas) || 1);
    return {
      id: q.id,
      nome: limparNome([
        dataArquivo(q.criadoEm || q.atualizadoEm),
        apelidoProfessor(cad, q.professorEmail, q.professorNome),
        apelidoCliente(cad, q.clienteNome || q.alunoNome)
      ].join(' - ')),
      ext: 'pdf',
      miniatura: null,
      titulo: texto(q.titulo),
      detalhe: `${paginas} pág.`,
      bytes: 0,
      conteudo: async () => gerarPdf((await lerPaginas(q)).map(sanitizarPagina), { titulo: texto(q.titulo) || 'Quadro Master' }),
      _quadro: q
    };
  }

  async function apagarQuadro(q) {
    const ref = fdb().collection('quadros').doc(q.id);
    const pgs = await ref.collection('paginas').get();
    let bytes = 0;
    const lote = fdb().batch();
    pgs.forEach((p) => {
      const dados = p.data().dados;
      if (typeof dados === 'string') bytes += dados.length;
      lote.delete(p.ref);
    });
    lote.delete(ref);
    await lote.commit();
    quadros = quadros && quadros.filter((x) => x.id !== q.id);
    return bytes;
  }

  return {
    chave: 'quadros',
    vazio: 'Nenhum quadro no sistema.',
    total: () => (quadros ? quadros.length : null),
    async pagina(n) {
      const [qs, cad] = await Promise.all([lista(), carregarCadastros()]);
      const fatia = qs.slice(n * POR_PAGINA, (n + 1) * POR_PAGINA);
      return { itens: fatia.map((q) => item(cad, q)), temProxima: (n + 1) * POR_PAGINA < qs.length };
    },
    async *todos() {
      const [qs, cad] = await Promise.all([lista(), carregarCadastros()]);
      for (const q of qs.slice()) yield item(cad, q);
    },
    async apagar(it) {
      const bytes = await apagarQuadro(it._quadro);
      await descontar('quadros', 1, bytes);
    },
    async apagarTodos(aoProgresso = () => {}) {
      const qs = (await lista()).slice();
      let feitos = 0;
      for (const q of qs) {
        await apagarQuadro(q);
        feitos++;
        aoProgresso(feitos);
      }
      await zerar('quadros');
      return feitos;
    },
    visualizar(it) {
      const q = it._quadro;
      abrirVisualizadorQuadro({
        titulo: q.titulo, descricao: q.descricao,
        professorNome: q.professorNome || q.professorEmail,
        alunoNome: q.alunoNome, clienteNome: q.clienteNome, atualizadoEm: q.atualizadoEm
      }, () => lerPaginas(q));
    }
  };
}

/** Fontes novas a cada abertura da área (zera cursores e listas em memória). */
export function criarFontes() {
  cadastros = null;
  resumo = undefined;
  return {
    aulas: fonteAulas(),
    profAtivos: fonteProfessores(false),
    profDesligados: fonteProfessores(true),
    quadros: fonteQuadros()
  };
}

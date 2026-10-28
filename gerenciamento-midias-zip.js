// gerenciamento-midias-zip.js
// Downloads da área "Gerenciamento de mídias": uma mídia por vez (link direto,
// sem biblioteca) ou todas de uma vez num ZIP.
//
// O ZIP usa a JSZip, carregada do cdnjs só quando alguém pede o primeiro ZIP
// (a CSP em _headers já libera cdnjs.cloudflare.com). As fotos já são JPEG e
// os quadros já são PDF, então o ZIP só guarda (STORE), sem comprimir de novo.

const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const JSZIP_SRI = 'sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==';

let carregandoJSZip = null;

export function carregarJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!carregandoJSZip) {
    carregandoJSZip = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = JSZIP_URL;
      s.integrity = JSZIP_SRI;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = () => (window.JSZip ? ok(window.JSZip) : erro(new Error('JSZip não carregou.')));
      s.onerror = () => erro(new Error('Não foi possível carregar a ferramenta de ZIP. Verifique a internet e tente de novo.'));
      document.head.appendChild(s);
    });
    carregandoJSZip.catch(() => { carregandoJSZip = null; });
  }
  return carregandoJSZip;
}

/** data URL (base64) → Blob, sem passar por fetch(). */
export function dataUrlParaBlob(dataUrl) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Nomes repetidos ganham " (2)", " (3)"... antes da extensão. */
export function nomesUnicos() {
  const usados = new Map();
  return (nome, ext) => {
    const chave = `${nome}.${ext}`.toLowerCase();
    const n = (usados.get(chave) || 0) + 1;
    usados.set(chave, n);
    return n === 1 ? `${nome}.${ext}` : `${nome} (${n}).${ext}`;
  };
}

export async function baixarItem(item) {
  const blob = await item.conteudo();
  if (!blob) throw new Error('Esta mídia está vazia ou corrompida.');
  baixarBlob(blob, `${item.nome}.${item.ext}`);
}

export class Cancelado extends Error {
  constructor() { super('Cancelado.'); this.cancelado = true; }
}

/**
 * Junta todas as mídias de uma fonte num ZIP e baixa.
 * @param fonte   fonte de gerenciamento-midias-fontes.js (usa fonte.todos())
 * @param opcoes  { nomeZip, aoProgresso(feitos, fase, percent), cancelado() }
 * @returns {Promise<{ arquivos: number, falhas: number }>}
 */
export async function baixarZip(fonte, { nomeZip, aoProgresso = () => {}, cancelado = () => false } = {}) {
  const JSZip = await carregarJSZip();
  const zip = new JSZip();
  const unico = nomesUnicos();
  let arquivos = 0;
  let falhas = 0;

  for await (const item of fonte.todos()) {
    if (cancelado()) throw new Cancelado();
    try {
      const blob = await item.conteudo();
      if (blob) { zip.file(unico(item.nome, item.ext), blob); arquivos++; } else falhas++;
    } catch (err) {
      console.warn('[Mídias] Item ignorado no ZIP:', item.id, err);
      falhas++;
    }
    aoProgresso(arquivos + falhas, 'lendo');
  }
  if (cancelado()) throw new Cancelado();
  if (arquivos === 0) return { arquivos, falhas };

  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' },
    (meta) => aoProgresso(arquivos + falhas, 'compactando', meta.percent));
  if (cancelado()) throw new Cancelado();
  baixarBlob(blob, nomeZip);
  return { arquivos, falhas };
}

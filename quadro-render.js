// quadro-render.js
// Quadro Master — formato das páginas, desenho em <canvas>, PDF e visualizador
// somente leitura (cliente e Central).
//
// Arquivo AUTOCONTIDO (sem imports): o SistemaMaster-Central usa uma cópia dele
// na área "Quadros de aula". Ao mudar aqui, copie para o Central.
//
// Segurança: o conteúdo de uma página vem do banco e pode ter sido adulterado.
// Tudo passa por sanitizarPagina() e é desenhado SÓ no canvas (nunca vira HTML).
// Imagens: apenas data URL JPEG. Vídeos: apenas links https, abertos em nova aba.

export const LARGURA = 1600;
export const ALTURA  = 1131;           // proporção A4 deitado (folha "paisagem")
export const ORIENTACOES = [
    { id: 'paisagem', rotulo: 'Deitada (paisagem)' },
    { id: 'retrato',  rotulo: 'Em pé (retrato)' }
];
/** Largura e altura lógicas da página conforme a orientação. */
export const dimensoes = (p) => (p && p.orient === 'retrato') ? { w: ALTURA, h: LARGURA } : { w: LARGURA, h: ALTURA };
export const MAX_PAGINAS = 10;
export const LIMITE_PAGINA = 900000;   // caracteres por página (a regra aceita até 900.000)
export const FUNDOS = [
    { id: 'quad-p',  rotulo: 'Quadriculado pequeno' },
    { id: 'quad-g',  rotulo: 'Quadriculado grande' },
    { id: 'pautado', rotulo: 'Pautado' },
    { id: 'liso',    rotulo: 'Liso' }
];
export const FONTE = "'Comfortaa', 'Lexend', system-ui, sans-serif";

const PREFIXO_JPEG = 'data:image/jpeg;base64,';
const MAX_OBJETOS = 4000;
const MAX_PONTOS  = 12000;             // números (x,y) por traço

// ── Validação ──────────────────────────────────────────────────────────────
const num = (v, min, max, pad = 0) => (typeof v === 'number' && Number.isFinite(v)) ? Math.min(max, Math.max(min, v)) : pad;
const cor = (v, pad = '#1f2937') => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v.toLowerCase() : pad;
const txt = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);

/** Link de vídeo: só https, sem espaços/aspas. Reconhece YouTube e Vimeo. */
export function validarLinkVideo(texto) {
    const valor = String(texto || '').trim();
    if (!valor) return { ok: false, erro: 'Cole o link do vídeo.' };
    if (valor.length > 500 || /[\s<>"'`\\]/.test(valor)) return { ok: false, erro: 'O link tem caracteres inválidos.' };
    let u;
    try { u = new URL(valor); } catch { return { ok: false, erro: 'Isso não parece um link.' }; }
    if (u.protocol !== 'https:') return { ok: false, erro: 'Use um link seguro (https://).' };
    if (u.username || u.password) return { ok: false, erro: 'Link não aceito.' };
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    let tipo = 'outro';
    if (['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'].includes(host)) tipo = 'youtube';
    else if (host === 'vimeo.com' || host === 'player.vimeo.com') tipo = 'vimeo';
    return { ok: true, url: u.href, tipo, dominio: host };
}

function sanitizarObjeto(o) {
    if (!o || typeof o !== 'object') return null;
    const base = { x: num(o.x, -LARGURA, LARGURA * 2), y: num(o.y, -ALTURA, ALTURA * 2) };
    const caixa = { ...base, w: num(o.w, 10, LARGURA * 2, 200), h: num(o.h, 10, ALTURA * 2, 120) };
    switch (o.t) {
        case 'traco': {
            if (!Array.isArray(o.pts)) return null;
            const pts = o.pts.slice(0, MAX_PONTOS).map(v => Math.round(num(v, -LARGURA, LARGURA * 2)));
            if (pts.length < 2) return null;
            if (pts.length % 2) pts.pop();
            return { t: 'traco', cor: cor(o.cor), esp: num(o.esp, 1, 80, 4), alfa: num(o.alfa, 0.1, 1, 1), pts };
        }
        case 'linha':
            return { t: 'linha', cor: cor(o.cor), esp: num(o.esp, 1, 80, 4), alfa: num(o.alfa, 0.1, 1, 1),
                     x1: num(o.x1, -LARGURA, LARGURA * 2), y1: num(o.y1, -ALTURA, ALTURA * 2),
                     x2: num(o.x2, -LARGURA, LARGURA * 2), y2: num(o.y2, -ALTURA, ALTURA * 2), seta: o.seta === true };
        case 'forma':
            if (!['ret', 'elipse', 'tri'].includes(o.f)) return null;
            return { t: 'forma', f: o.f, ...caixa, cor: cor(o.cor), esp: num(o.esp, 1, 40, 4), preench: o.preench === true };
        case 'balao':
            if (!['fala', 'pensa'].includes(o.f)) return null;
            return { t: 'balao', f: o.f, ...caixa, cor: cor(o.cor), esp: num(o.esp, 1, 20, 4),
                     texto: txt(o.texto, 600), tam: num(o.tam, 14, 96, 30) };
        case 'texto':
            return { t: 'texto', ...base, w: num(o.w, 40, LARGURA * 2, 500), texto: txt(o.texto, 2000),
                     cor: cor(o.cor), tam: num(o.tam, 14, 120, 32) };
        case 'imagem':
            if (typeof o.src !== 'string' || !o.src.startsWith(PREFIXO_JPEG) || o.src.length > 400000
                || !/^[A-Za-z0-9+/]+={0,2}$/.test(o.src.slice(PREFIXO_JPEG.length))) return null;
            return { t: 'imagem', ...caixa, src: o.src };
        case 'video': {
            const v = validarLinkVideo(o.url);
            if (!v.ok) return null;
            return { t: 'video', ...caixa, url: v.url, titulo: txt(o.titulo, 120) };
        }
        default: return null;
    }
}

/** Página a partir do texto salvo (ou de um objeto). Nunca lança erro. */
export function sanitizarPagina(entrada) {
    let p = entrada;
    if (typeof entrada === 'string') { try { p = JSON.parse(entrada); } catch { p = null; } }
    if (!p || typeof p !== 'object') p = {};
    const fundo = FUNDOS.some(f => f.id === p.fundo) ? p.fundo : 'quad-p';
    const orient = p.orient === 'retrato' ? 'retrato' : 'paisagem';
    const objetos = (Array.isArray(p.objetos) ? p.objetos : []).slice(0, MAX_OBJETOS).map(sanitizarObjeto).filter(Boolean);
    return { fundo, orient, objetos };
}

export const paginaVazia = (fundo = 'quad-p', orient = 'paisagem') => ({ fundo, orient, objetos: [] });
export const serializarPagina = (p) => JSON.stringify({ fundo: p.fundo, orient: p.orient || 'paisagem', objetos: p.objetos });

// ── Geometria ──────────────────────────────────────────────────────────────
export function caixaDoObjeto(o) {
    if (o.t === 'traco') {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (let i = 0; i < o.pts.length; i += 2) {
            x1 = Math.min(x1, o.pts[i]); x2 = Math.max(x2, o.pts[i]);
            y1 = Math.min(y1, o.pts[i + 1]); y2 = Math.max(y2, o.pts[i + 1]);
        }
        const m = o.esp / 2;
        return { x: x1 - m, y: y1 - m, w: x2 - x1 + o.esp, h: y2 - y1 + o.esp };
    }
    if (o.t === 'linha') {
        const m = o.esp / 2 + (o.seta ? o.esp * 3 : 0);
        return { x: Math.min(o.x1, o.x2) - m, y: Math.min(o.y1, o.y2) - m,
                 w: Math.abs(o.x2 - o.x1) + 2 * m, h: Math.abs(o.y2 - o.y1) + 2 * m };
    }
    if (o.t === 'texto') return { x: o.x, y: o.y, w: o.w, h: alturaTexto(o) };
    return { x: o.x, y: o.y, w: o.w, h: o.h };
}

function distSegmento(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** true se o ponto (x,y) toca o objeto, com tolerância r. */
export function tocaObjeto(o, x, y, r = 10) {
    if (o.t === 'traco') {
        const tol = r + o.esp / 2;
        const p = o.pts;
        if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= tol;
        for (let i = 0; i + 3 < p.length; i += 2) {
            if (distSegmento(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= tol) return true;
        }
        return false;
    }
    if (o.t === 'linha') return distSegmento(x, y, o.x1, o.y1, o.x2, o.y2) <= r + o.esp / 2;
    const c = caixaDoObjeto(o);
    return x >= c.x - r && x <= c.x + c.w + r && y >= c.y - r && y <= c.y + c.h + r;
}

// ── Desenho ────────────────────────────────────────────────────────────────
export function desenharFundo(ctx, fundo, { w: LARGURA, h: ALTURA } = dimensoes(null)) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    ctx.lineWidth = 1.2;
    if (fundo === 'quad-p' || fundo === 'quad-g') {
        const passo = fundo === 'quad-p' ? 40 : 80;
        ctx.strokeStyle = '#dbe7f3';
        ctx.beginPath();
        for (let x = passo; x < LARGURA; x += passo) { ctx.moveTo(x, 0); ctx.lineTo(x, ALTURA); }
        for (let y = passo; y < ALTURA; y += passo) { ctx.moveTo(0, y); ctx.lineTo(LARGURA, y); }
        ctx.stroke();
    } else if (fundo === 'pautado') {
        ctx.strokeStyle = '#c7dcef';
        ctx.beginPath();
        for (let y = 110; y < ALTURA - 20; y += 52) { ctx.moveTo(0, y); ctx.lineTo(LARGURA, y); }
        ctx.stroke();
        ctx.strokeStyle = '#f4a3a3';
        ctx.beginPath(); ctx.moveTo(130, 0); ctx.lineTo(130, ALTURA); ctx.stroke();
    }
    ctx.restore();
}

function quebrarLinhas(ctx, texto, largura) {
    const linhas = [];
    String(texto || '').split('\n').forEach(par => {
        const palavras = par.split(/(\s+)/);
        let linha = '';
        palavras.forEach(p => {
            const teste = linha + p;
            if (ctx.measureText(teste).width > largura && linha.trim()) {
                linhas.push(linha.trimEnd());
                linha = p.trimStart();
                // palavra maior que a largura: quebra por caractere
                while (ctx.measureText(linha).width > largura && linha.length > 1) {
                    let i = linha.length - 1;
                    while (i > 1 && ctx.measureText(linha.slice(0, i)).width > largura) i--;
                    linhas.push(linha.slice(0, i));
                    linha = linha.slice(i);
                }
            } else linha = teste;
        });
        linhas.push(linha.trimEnd());
    });
    return linhas;
}

let ctxMedida = null;
function alturaTexto(o) {
    if (!ctxMedida) ctxMedida = document.createElement('canvas').getContext('2d');
    ctxMedida.font = `${o.tam}px ${FONTE}`;
    const n = Math.max(1, quebrarLinhas(ctxMedida, o.texto || ' ', o.w).length);
    return n * o.tam * 1.3 + 8;
}

function escreverTexto(ctx, texto, x, y, largura, tam, corTexto, alinhar = 'left', alturaMax = Infinity) {
    ctx.font = `${tam}px ${FONTE}`;
    ctx.fillStyle = corTexto;
    ctx.textBaseline = 'top';
    ctx.textAlign = alinhar;
    const linhas = quebrarLinhas(ctx, texto, largura);
    const alt = tam * 1.3;
    const tx = alinhar === 'center' ? x + largura / 2 : x;
    linhas.forEach((l, i) => { if ((i + 1) * alt <= alturaMax + 2) ctx.fillText(l, tx, y + i * alt); });
    return linhas.length * alt;
}

function caminhoTraco(ctx, p) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (p.length === 2) { ctx.lineTo(p[0] + 0.1, p[1]); return; }
    for (let i = 2; i + 2 < p.length; i += 2) {
        const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
        ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
}

function caminhoBalao(ctx, o) {
    const { x, y, w, h } = o;
    ctx.beginPath();
    if (o.f === 'fala') {
        const r = Math.min(28, w / 4, h / 4);
        const hb = h * 0.78;                     // corpo; o resto é a ponta
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + hb - r); ctx.quadraticCurveTo(x + w, y + hb, x + w - r, y + hb);
        ctx.lineTo(x + w * 0.42, y + hb);
        ctx.lineTo(x + w * 0.2, y + h);
        ctx.lineTo(x + w * 0.26, y + hb);
        ctx.lineTo(x + r, y + hb); ctx.quadraticCurveTo(x, y + hb, x, y + hb - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    } else {
        ctx.ellipse(x + w / 2, y + h * 0.4, w / 2, h * 0.4, 0, 0, Math.PI * 2);
    }
}

export function desenharObjeto(ctx, o, imagens, aoCarregar) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (o.t) {
        case 'traco':
            ctx.globalAlpha = o.alfa;
            ctx.strokeStyle = o.cor;
            ctx.lineWidth = o.esp;
            if (o.alfa < 1) ctx.lineCap = 'butt';
            caminhoTraco(ctx, o.pts);
            ctx.stroke();
            break;
        case 'linha': {
            ctx.globalAlpha = o.alfa;
            ctx.strokeStyle = o.cor; ctx.fillStyle = o.cor;
            ctx.lineWidth = o.esp;
            ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
            if (o.seta) {
                const ang = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), t = Math.max(14, o.esp * 3.5);
                ctx.beginPath();
                ctx.moveTo(o.x2, o.y2);
                ctx.lineTo(o.x2 - t * Math.cos(ang - 0.45), o.y2 - t * Math.sin(ang - 0.45));
                ctx.lineTo(o.x2 - t * Math.cos(ang + 0.45), o.y2 - t * Math.sin(ang + 0.45));
                ctx.closePath(); ctx.fill();
            }
            break;
        }
        case 'forma': {
            ctx.strokeStyle = o.cor; ctx.lineWidth = o.esp;
            ctx.beginPath();
            if (o.f === 'ret') ctx.rect(o.x, o.y, o.w, o.h);
            else if (o.f === 'elipse') ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
            else { ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.closePath(); }
            if (o.preench) { ctx.globalAlpha = 0.18; ctx.fillStyle = o.cor; ctx.fill(); ctx.globalAlpha = 1; }
            ctx.stroke();
            break;
        }
        case 'balao': {
            caminhoBalao(ctx, o);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = o.cor; ctx.lineWidth = o.esp; ctx.stroke();
            if (o.f === 'pensa') {
                ctx.fillStyle = '#ffffff';
                [[0.3, 0.86, 0.06], [0.2, 0.96, 0.035]].forEach(([fx, fy, fr]) => {
                    const r = Math.max(6, Math.min(o.w, o.h) * fr);
                    ctx.beginPath(); ctx.arc(o.x + o.w * fx, o.y + o.h * fy, r, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                });
            }
            const hCorpo = o.f === 'fala' ? o.h * 0.78 : o.h * 0.8;
            const pad = o.f === 'fala' ? 18 : o.w * 0.16;
            ctx.save();
            caminhoBalao(ctx, o); ctx.clip();
            const altTexto = Math.min(hCorpo - 16, quebrarLinhasAltura(ctx, o.texto, o.w - pad * 2, o.tam));
            escreverTexto(ctx, o.texto, o.x + pad, o.y + Math.max(10, (hCorpo - altTexto) / 2), o.w - pad * 2,
                          o.tam, '#1f2937', 'center', hCorpo - 16);
            ctx.restore();
            break;
        }
        case 'texto':
            escreverTexto(ctx, o.texto, o.x, o.y + 4, o.w, o.tam, o.cor);
            break;
        case 'imagem': {
            let img = imagens.get(o.src);
            if (!img) {
                img = new Image();
                img.onload = () => aoCarregar && aoCarregar();
                img.src = o.src;
                imagens.set(o.src, img);
            }
            if (img.complete && img.naturalWidth) ctx.drawImage(img, o.x, o.y, o.w, o.h);
            else { ctx.fillStyle = '#f3f4f6'; ctx.fillRect(o.x, o.y, o.w, o.h); }
            break;
        }
        case 'video': {
            const r = 18;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(o.x, o.y, o.w, o.h, r) : ctx.rect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = '#111827'; ctx.fill();
            const cx = o.x + o.w / 2, cy = o.y + o.h / 2 - Math.min(20, o.h * 0.08);
            const raio = Math.max(18, Math.min(o.w, o.h) * 0.16);
            const v = validarLinkVideo(o.url);
            ctx.fillStyle = v.tipo === 'youtube' ? '#ef4444' : '#f28705';
            ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cx - raio * 0.35, cy - raio * 0.5); ctx.lineTo(cx + raio * 0.55, cy); ctx.lineTo(cx - raio * 0.35, cy + raio * 0.5);
            ctx.closePath(); ctx.fill();
            const tam = Math.max(14, Math.min(28, o.w / 16));
            const titulo = o.titulo || (v.tipo === 'youtube' ? 'Vídeo do YouTube' : v.tipo === 'vimeo' ? 'Vídeo do Vimeo' : 'Vídeo');
            ctx.save();
            ctx.beginPath(); ctx.rect(o.x + 12, o.y, o.w - 24, o.h); ctx.clip();
            escreverTexto(ctx, titulo, o.x + 16, cy + raio + 12, o.w - 32, tam, '#ffffff', 'center', tam * 2.6);
            ctx.font = `${Math.round(tam * 0.7)}px ${FONTE}`;
            ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center';
            ctx.fillText(v.dominio || '', cx, o.y + o.h - tam * 0.7 - 12);
            ctx.restore();
            break;
        }
    }
    ctx.restore();
}

function quebrarLinhasAltura(ctx, texto, largura, tam) {
    ctx.font = `${tam}px ${FONTE}`;
    return quebrarLinhas(ctx, texto, largura).length * tam * 1.3;
}

/** Desenha a página inteira em coordenadas lógicas (dimensoes(pagina)). */
export function desenharPagina(ctx, pagina, imagens, aoCarregar) {
    desenharFundo(ctx, pagina.fundo, dimensoes(pagina));
    pagina.objetos.forEach(o => desenharObjeto(ctx, o, imagens, aoCarregar));
}

/** Espera as imagens da página carregarem (para PDF). */
export function carregarImagens(paginas, imagens) {
    const pendentes = [];
    paginas.forEach(p => p.objetos.forEach(o => {
        if (o.t !== 'imagem') return;
        let img = imagens.get(o.src);
        if (!img) { img = new Image(); img.src = o.src; imagens.set(o.src, img); }
        if (!img.complete) pendentes.push(new Promise(r => { img.onload = r; img.onerror = r; }));
    }));
    return Promise.all(pendentes);
}

// ── PDF (sem biblioteca externa) ───────────────────────────────────────────
// Cada página vira um JPEG em tela cheia numa página A4 (deitada ou em pé).
function base64ParaBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function textoPdf(s) {
    // UTF-16BE em hexadecimal: aceita acentos sem escapes.
    let hex = 'FEFF';
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        if (c > 0xffff) { const v = c - 0x10000; hex += ((0xd800 + (v >> 10)).toString(16) + (0xdc00 + (v & 0x3ff)).toString(16)).toUpperCase().padStart(8, '0'); }
        else hex += c.toString(16).toUpperCase().padStart(4, '0');
    }
    return `<${hex}>`;
}

export async function gerarPdf(paginas, { titulo = 'Quadro Master', autor = 'Master Educação' } = {}) {
    const imagens = new Map();
    await carregarImagens(paginas, imagens);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const enc = new TextEncoder();
    const partes = [];
    let tamanho = 0;
    const offsets = [];
    const escrever = (p) => { const b = typeof p === 'string' ? enc.encode(p) : p; partes.push(b); tamanho += b.length; };
    const objeto = (n, corpo) => { offsets[n] = tamanho; escrever(`${n} 0 obj\n`); corpo(); escrever('\nendobj\n'); };

    const n = paginas.length;
    // 1 catálogo, 2 páginas, 3 info; cada página: página, conteúdo, imagem
    escrever('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    objeto(1, () => escrever('<< /Type /Catalog /Pages 2 0 R >>'));
    const kids = paginas.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
    objeto(2, () => escrever(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
    objeto(3, () => escrever(`<< /Title ${textoPdf(titulo)} /Author ${textoPdf(autor)} /Producer ${textoPdf('Quadro Master')} >>`));

    for (let i = 0; i < n; i++) {
        const { w: LW, h: LH } = dimensoes(paginas[i]);
        canvas.width = LW; canvas.height = LH;
        const [W, H] = paginas[i].orient === 'retrato' ? [595, 842] : [842, 595];
        desenharPagina(ctx, paginas[i], imagens);
        const jpeg = base64ParaBytes(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
        const pg = 4 + i * 3, cont = pg + 1, img = pg + 2;
        objeto(pg, () => escrever(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${cont} 0 R >>`));
        const fluxo = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
        objeto(cont, () => escrever(`<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`));
        objeto(img, () => {
            escrever(`<< /Type /XObject /Subtype /Image /Width ${LW} /Height ${LH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
            escrever(jpeg);
            escrever('\nendstream');
        });
    }

    const totalObjs = 3 + n * 3;
    const xref = tamanho;
    let tabela = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= totalObjs; i++) tabela += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    escrever(tabela);
    escrever(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(partes, { type: 'application/pdf' });
}

export function nomeArquivo(titulo) {
    const base = String(titulo || 'quadro').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'quadro';
    return `${base}.pdf`;
}

export async function baixarPdf(paginas, titulo) {
    const blob = await gerarPdf(paginas, { titulo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo(titulo);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── Visualizador somente leitura ───────────────────────────────────────────
function escHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let estiloInjetado = false;
function injetarEstilo() {
    if (estiloInjetado) return;
    estiloInjetado = true;
    const s = document.createElement('style');
    s.textContent = `
    .qmv-overlay{position:fixed;inset:0;z-index:10050;background:rgba(17,24,39,.72);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}
    .qmv-box{background:#fff;border-radius:18px;width:100%;max-width:1100px;max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:'Comfortaa',system-ui,sans-serif;}
    .qmv-topo{background:#f28705;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;}
    .qmv-topo h2{font-family:'Lexend',system-ui,sans-serif;font-size:1.02rem;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .qmv-x{background:rgba(255,255,255,.2);border:0;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1.2rem;cursor:pointer;}
    .qmv-corpo{padding:14px 16px;overflow:auto;display:flex;flex-direction:column;gap:10px;}
    .qmv-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.8rem;color:#6b7280;}
    .qmv-desc{font-size:.88rem;color:#374151;line-height:1.55;margin:0;white-space:pre-wrap;background:#fff7ed;border-left:4px solid #f28705;border-radius:8px;padding:8px 10px;}
    .qmv-folha{position:relative;width:100%;border-radius:12px;overflow:hidden;border:1.5px solid #e5e7eb;background:#f3f4f6;display:flex;justify-content:center;}
    .qmv-folha canvas{display:block;max-width:100%;height:auto;max-height:70vh;background:#fff;touch-action:pan-y;}
    .qmv-barra{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
    .qmv-nav{display:flex;align-items:center;gap:8px;font-size:.88rem;color:#374151;font-weight:700;}
    .qmv-btn{border:2px solid #e5e7eb;background:#fff;color:#374151;border-radius:10px;padding:8px 12px;font:700 .85rem 'Comfortaa',system-ui,sans-serif;cursor:pointer;display:inline-flex;gap:6px;align-items:center;}
    .qmv-btn:disabled{opacity:.45;cursor:default;}
    .qmv-btn.pri{background:#f28705;border-color:#f28705;color:#fff;}
    .qmv-dica{font-size:.75rem;color:#9ca3af;margin:0;}
    `;
    document.head.appendChild(s);
}

/**
 * Abre o quadro para leitura.
 * @param quadro   { titulo, descricao, professorNome, clienteNome, alunoNome, atualizadoEm }
 * @param carregar async () => [texto salvo da página 0, 1, ...]
 */
export async function abrirVisualizadorQuadro(quadro, carregar) {
    injetarEstilo();
    const overlay = document.createElement('div');
    overlay.className = 'qmv-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const data = quadro.atualizadoEm && quadro.atualizadoEm.toDate ? quadro.atualizadoEm.toDate().toLocaleDateString('pt-BR') : '';
    overlay.innerHTML = `
      <div class="qmv-box">
        <div class="qmv-topo"><h2>${escHtml(quadro.titulo || 'Quadro')}</h2><button class="qmv-x" aria-label="Fechar">&times;</button></div>
        <div class="qmv-corpo">
          <div class="qmv-meta">
            ${quadro.professorNome ? `<span>Professor(a): <b>${escHtml(quadro.professorNome)}</b></span>` : ''}
            ${quadro.alunoNome ? `<span>Aluno(a): <b>${escHtml(quadro.alunoNome)}</b></span>` : ''}
            ${quadro.clienteNome ? `<span>Cliente: <b>${escHtml(quadro.clienteNome)}</b></span>` : ''}
            ${data ? `<span>Atualizado em ${escHtml(data)}</span>` : ''}
          </div>
          ${quadro.descricao ? `<p class="qmv-desc">${escHtml(quadro.descricao)}</p>` : ''}
          <div class="qmv-folha"><canvas width="${LARGURA}" height="${ALTURA}" aria-label="Página do quadro"></canvas></div>
          <p class="qmv-dica" hidden>Toque no vídeo para abrir o link em nova aba.</p>
          <div class="qmv-barra">
            <div class="qmv-nav">
              <button class="qmv-btn qmv-ant" aria-label="Página anterior">&#8249;</button>
              <span class="qmv-pag">Carregando…</span>
              <button class="qmv-btn qmv-prox" aria-label="Próxima página">&#8250;</button>
            </div>
            <button class="qmv-btn pri qmv-pdf" disabled>Baixar PDF</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const imagens = new Map();
    let paginas = [], atual = 0;

    const fechar = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => {
        if (e.key === 'Escape') fechar();
        if (e.key === 'ArrowRight') ir(atual + 1);
        if (e.key === 'ArrowLeft') ir(atual - 1);
    };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.qmv-x').onclick = fechar;
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) fechar(); });

    const desenhar = () => {
        const p = paginas[atual];
        if (!p) return;
        const { w, h } = dimensoes(p);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        desenharPagina(ctx, p, imagens, desenhar);
    };
    function ir(i) {
        if (!paginas.length) return;
        atual = Math.max(0, Math.min(paginas.length - 1, i));
        overlay.querySelector('.qmv-pag').textContent = `Página ${atual + 1} de ${paginas.length}`;
        overlay.querySelector('.qmv-ant').disabled = atual === 0;
        overlay.querySelector('.qmv-prox').disabled = atual === paginas.length - 1;
        overlay.querySelector('.qmv-dica').hidden = !paginas[atual].objetos.some(o => o.t === 'video');
        desenhar();
    }
    overlay.querySelector('.qmv-ant').onclick = () => ir(atual - 1);
    overlay.querySelector('.qmv-prox').onclick = () => ir(atual + 1);

    // Vídeo: abre o link (já validado) em nova aba.
    canvas.addEventListener('click', (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * canvas.width / r.width, y = (e.clientY - r.top) * canvas.height / r.height;
        const v = [...(paginas[atual]?.objetos || [])].reverse().find(o => o.t === 'video' && tocaObjeto(o, x, y, 0));
        if (v) window.open(v.url, '_blank', 'noopener,noreferrer');
    });

    try {
        const textos = await carregar();
        paginas = (textos.length ? textos : ['']).map(sanitizarPagina);
        ir(0);
        const btn = overlay.querySelector('.qmv-pdf');
        btn.disabled = false;
        btn.onclick = async () => {
            btn.disabled = true; btn.textContent = 'Gerando PDF…';
            try { await baixarPdf(paginas, quadro.titulo); }
            finally { btn.disabled = false; btn.textContent = 'Baixar PDF'; }
        };
    } catch (err) {
        console.error('[Quadro] Erro ao abrir:', err?.code || err);
        overlay.querySelector('.qmv-pag').textContent = 'Não foi possível abrir o quadro.';
    }
    return { fechar };
}

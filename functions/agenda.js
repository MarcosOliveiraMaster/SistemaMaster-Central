/**
 * functions/agenda.js — Google Agenda (aulas fechadas → eventos com convite)
 *
 * Como funciona
 *  1. Na Central (Integrações → Google Agenda) o admin clica em "Conectar" e
 *     autoriza UMA vez com a conta Google da Master (Gmail comum ou Workspace).
 *     Guardamos só o refresh token (em _privado/, que nenhum navegador lê) e
 *     criamos a agenda "Aulas Master" nessa conta.
 *  2. Toda vez que uma aula de BancoDeAulas-Lista é criada/alterada/excluída,
 *     agendaSincronizarAula cria/atualiza/remove o evento. Entra na agenda a
 *     aula FUTURA com data, horário e professor definidos e que não esteja
 *     cancelada. Professor e cliente são convidados (recebem o convite por
 *     e-mail — funciona em Gmail, iPhone/Apple e Outlook).
 *  3. "Sincronizar aulas futuras" (agendaSincronizarTudo) faz a carga inicial.
 *
 * Escopo pedido ao Google: calendar.app.created — só enxerga/edita agendas que
 * o próprio sistema criou; as agendas pessoais da conta ficam de fora.
 *
 * Segredos (Google Cloud → Secret Manager, mesmo projeto):
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { defineSecret } = require('firebase-functions/params');

const CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');

const REGIAO = 'us-central1';
const FUSO = 'America/Sao_Paulo';
const NOME_AGENDA = 'Aulas Master';
const ESCOPOS = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.app.created'];
const ADMINS = ['mastereducacaoadm@gmail.com', 'marcos.lucas.ti@gmail.com'];

const db = () => admin.firestore();
const docPrivado = () => db().doc('_privado/agendaGoogle');
const docStatus = () => db().doc('_sistema/agendaGoogle');
const projeto = () => process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
const urlCallback = () => `https://${REGIAO}-${projeto()}.cloudfunctions.net/agendaCallback`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// ── Utilidades ───────────────────────────────────────────────────────────────

async function exigirAdmin(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') { res.status(204).send(''); return null; }
  if (req.method !== 'POST') { res.status(405).json({ erro: 'Use POST.' }); return null; }
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) { res.status(401).json({ erro: 'Sem token.' }); return null; }
  try {
    const t = await admin.auth().verifyIdToken(h.slice(7));
    if (!ADMINS.includes(t.email) || t.email_verified === false) { res.status(403).json({ erro: 'Sem permissão.' }); return null; }
    return t;
  } catch (e) {
    res.status(401).json({ erro: 'Token inválido.' }); return null;
  }
}

async function trocarToken(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID.value(), client_secret: CLIENT_SECRET.value(), ...params })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${j.error || ''} ${j.error_description || ''}`.trim());
  return j;
}

let cacheAcesso = null; // { token, expira }
async function tokenAcesso() {
  if (cacheAcesso && cacheAcesso.expira > Date.now() + 60000) return cacheAcesso.token;
  const priv = (await docPrivado().get()).data();
  if (!priv || !priv.refreshToken) return null;
  const j = await trocarToken({ grant_type: 'refresh_token', refresh_token: priv.refreshToken });
  cacheAcesso = { token: j.access_token, expira: Date.now() + (j.expires_in || 3600) * 1000 };
  return cacheAcesso.token;
}

async function google(metodo, caminho, corpo, query) {
  const token = await tokenAcesso();
  if (!token) throw new Error('Google Agenda não conectado.');
  const qs = query ? '?' + new URLSearchParams(query) : '';
  const r = await fetch(`https://www.googleapis.com/calendar/v3${caminho}${qs}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  if (r.status === 204) return { status: 204 };
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

// ── Aula → evento ────────────────────────────────────────────────────────────

const minusculo = (s) => String(s || '').trim().toLowerCase();
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

function lerData(s) {
  const t = String(s || '');
  let m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { a: +m[3], m: +m[2], d: +m[1] };
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { a: +m[1], m: +m[2], d: +m[3] };
  return null;
}
function lerHorario(s) {
  const m = String(s || '').match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return null;
  const h = +m[1], min = +(m[2] || 0);
  return h < 24 && min < 60 ? { h, min } : null;
}
function lerDuracaoMin(s) {
  const t = String(s || '');
  let m = t.match(/(\d+)\s*h\s*(\d+)?/i);
  if (m) return (+m[1]) * 60 + (+(m[2] || 0));
  m = t.match(/(\d+)\s*min/i);
  return m ? +m[1] : 60;
}
// Data/hora "de parede" (sem fuso) — o Google aplica o FUSO informado.
function paraLocal(d, h, somaMin) {
  const u = new Date(Date.UTC(d.a, d.m - 1, d.d, h.h, h.min + (somaMin || 0)));
  const p = (n) => String(n).padStart(2, '0');
  return `${u.getUTCFullYear()}-${p(u.getUTCMonth() + 1)}-${p(u.getUTCDate())}T${p(u.getUTCHours())}:${p(u.getUTCMinutes())}:00`;
}
function hojeNoFuso() {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [a, m, d] = s.split('-').map(Number);
  return { a, m, d };
}
const chaveData = (d) => d.a * 10000 + d.m * 100 + d.d;
// Id fixo por aula (base32hex: 0-9 a-v) — evita evento duplicado se dois
// gatilhos rodarem ao mesmo tempo.
const idEvento = (aulaId) => 'master' + Buffer.from(String(aulaId)).toString('hex');
const professorDefinido = (p) => { const n = minusculo(p); return !!n && n !== 'a definir' && n !== '-'; };

async function emailProfessor(a) {
  if (a.professorEmail) return minusculo(a.professorEmail);
  const col = db().collection('dataBaseProfessores');
  if (soDigitos(a.idProfessor)) {
    for (const v of [a.idProfessor, soDigitos(a.idProfessor)]) {
      const s = await col.where('cpf', '==', v).limit(1).get();
      if (!s.empty && s.docs[0].data().email) return minusculo(s.docs[0].data().email);
    }
  }
  if (a.professor) {
    const s = await col.where('nome', '==', a.professor).limit(1).get();
    if (!s.empty && s.docs[0].data().email) return minusculo(s.docs[0].data().email);
  }
  return '';
}
async function dadosCliente(a) {
  const r = { email: '', local: '' };
  if (!a.cpf) return r;
  for (const v of [...new Set([a.cpf, soDigitos(a.cpf)])]) {
    const s = await db().collection('cadastroClientes').where('cpf', '==', v).limit(1).get();
    if (!s.empty) { r.email = minusculo(s.docs[0].data().email); break; }
  }
  for (const v of [...new Set([a.cpf, soDigitos(a.cpf)])]) {
    const s = await db().collection('locaisClientes').where('cpf', '==', v).limit(1).get();
    if (!s.empty) { const l = s.docs[0].data(); r.local = l.endereco || l.linkMaps || ''; break; }
  }
  return r;
}

// Evento desejado para a aula, ou null (não deve estar na agenda).
async function montarEvento(aulaId, a) {
  if (!a) return null;
  if (/cancel/i.test(a.StatusAula || '')) return null;
  if (!professorDefinido(a.professor)) return null;
  const d = lerData(a.data), h = lerHorario(a.horario);
  if (!d || !h) return null;
  if (chaveData(d) < chaveData(hojeNoFuso())) return null;

  const [profEmail, cli] = await Promise.all([emailProfessor(a), dadosCliente(a)]);
  const convidados = [...new Set([profEmail, cli.email].filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].map(email => ({ email }));
  const titulo = ['Aula', a.materia && `de ${a.materia}`, a.estudante && `· ${a.estudante}`].filter(Boolean).join(' ');
  const descricao = [
    `Professor(a): ${a.professor}`,
    a.estudante && `Estudante: ${a.estudante}`,
    a.nomeCliente && `Responsável: ${a.nomeCliente}`,
    a.duracao && `Duração: ${a.duracao}`,
    (a.codigoContratacao || a.idContratacao) && `Contratação: ${a.codigoContratacao || a.idContratacao}`,
    '',
    'Evento criado automaticamente pela Master Educação. Dúvidas ou remarcações: fale com a Master.'
  ].filter(v => v !== undefined && v !== false && v !== null).join('\n');
  return {
    summary: titulo,
    description: descricao,
    location: cli.local || undefined,
    start: { dateTime: paraLocal(d, h), timeZone: FUSO },
    end: { dateTime: paraLocal(d, h, lerDuracaoMin(a.duracao)), timeZone: FUSO },
    attendees: convidados,
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 24 * 60 }] },
    status: 'confirmed',
    extendedProperties: { private: { aulaId: String(aulaId) } }
  };
}

async function sincronizar(aulaId, aula) {
  const priv = (await docPrivado().get()).data();
  if (!priv || !priv.refreshToken || !priv.calendarId) return 'desconectado';
  const cal = encodeURIComponent(priv.calendarId);
  const id = idEvento(aulaId);
  const reg = db().doc(`agendaEventos/${aulaId}`);
  const antes = (await reg.get()).data();
  const evento = await montarEvento(aulaId, aula);

  if (!evento) {
    if (antes && antes.ativo) {
      const r = await google('DELETE', `/calendars/${cal}/events/${id}`, null, { sendUpdates: 'all' });
      if (r.status >= 300 && r.status !== 404 && r.status !== 410) throw new Error(`Excluir evento: ${r.status} ${r.error && r.error.message}`);
      await reg.set({ ativo: false, hash: '', atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return 'removido';
    }
    return 'ignorado';
  }

  const hash = crypto.createHash('sha1').update(JSON.stringify(evento)).digest('hex');
  if (antes && antes.ativo && antes.hash === hash) return 'sem mudança';

  // Já existe (mesmo id fixo): PUT. Novo: POST; se o id já existir no Google
  // (evento removido antes, ou gatilhos simultâneos), cai no PUT.
  let r = antes && antes.eventoId
    ? await google('PUT', `/calendars/${cal}/events/${id}`, evento, { sendUpdates: 'all' })
    : { status: 404 };
  if (r.status === 404) r = await google('POST', `/calendars/${cal}/events`, { id, ...evento }, { sendUpdates: 'all' });
  if (r.status === 409) r = await google('PUT', `/calendars/${cal}/events/${id}`, evento, { sendUpdates: 'all' });
  if (r.status >= 300) throw new Error(`Salvar evento: ${r.status} ${r.error && r.error.message}`);
  await reg.set({ ativo: true, hash, eventoId: id, link: r.htmlLink || '', atualizadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return antes && antes.ativo ? 'atualizado' : 'criado';
}

async function registrarErro(msg) {
  await docStatus().set({ ultimoErro: String(msg).slice(0, 500), ultimoErroEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
}

// ── Endpoints ────────────────────────────────────────────────────────────────

const comSegredos = functions.region(REGIAO).runWith({ secrets: [CLIENT_ID, CLIENT_SECRET] });

// POST (admin) → { url } para autorizar no Google.
exports.agendaAutorizar = comSegredos.https.onRequest(async (req, res) => {
  const quem = await exigirAdmin(req, res);
  if (!quem) return;
  const estado = crypto.randomBytes(24).toString('hex');
  await db().doc('_privado/agendaOAuthEstado').set({ estado, por: quem.email, expira: Date.now() + 10 * 60 * 1000 });
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: CLIENT_ID.value(),
    redirect_uri: urlCallback(),
    response_type: 'code',
    scope: ESCOPOS.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state: estado
  });
  res.json({ url });
});

function pagina(titulo, texto, ok) {
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><body style="font-family:system-ui,sans-serif;background:#fff7eb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px">
<div style="background:#fff;border-radius:16px;padding:28px;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center">
<div style="font-size:42px">${ok ? '✅' : '⚠️'}</div><h1 style="font-size:20px;color:#111827">${esc(titulo)}</h1>
<p style="color:#4b5563;line-height:1.5">${esc(texto)}</p><p style="color:#9ca3af;font-size:13px">Pode fechar esta aba e voltar à Central.</p></div></body></html>`;
}

// GET — o Google redireciona para cá depois da autorização.
exports.agendaCallback = comSegredos.https.onRequest(async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  try {
    if (req.query.error) { res.status(400).send(pagina('Autorização cancelada', 'A conexão com o Google Agenda não foi feita.', false)); return; }
    const refEstado = db().doc('_privado/agendaOAuthEstado');
    const est = (await refEstado.get()).data();
    await refEstado.delete().catch(() => {});
    if (!est || !req.query.state || est.estado !== req.query.state || est.expira < Date.now()) {
      res.status(400).send(pagina('Link expirado', 'Volte à Central e clique em "Conectar" de novo.', false)); return;
    }
    const tok = await trocarToken({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: urlCallback() });
    if (!tok.refresh_token) throw new Error('O Google não devolveu o refresh token.');
    if (!String(tok.scope || '').includes('calendar.app.created')) {
      res.status(400).send(pagina('Permissão não concedida', 'Marque a permissão de agenda na tela do Google e tente de novo.', false)); return;
    }
    // id_token veio direto do Google (TLS), então basta ler o e-mail do payload.
    const conta = JSON.parse(Buffer.from(String(tok.id_token || '').split('.')[1] || '', 'base64url').toString() || '{}').email || '';

    const anterior = (await docPrivado().get()).data() || {};
    await docPrivado().set({ refreshToken: tok.refresh_token, conta, calendarId: anterior.conta === conta ? anterior.calendarId || '' : '' }, { merge: true });
    cacheAcesso = { token: tok.access_token, expira: Date.now() + (tok.expires_in || 3600) * 1000 };

    let calendarId = anterior.conta === conta ? anterior.calendarId : '';
    if (calendarId) {
      const r = await google('GET', `/calendars/${encodeURIComponent(calendarId)}`);
      if (r.status !== 200) calendarId = '';
    }
    if (!calendarId) {
      const r = await google('POST', '/calendars', { summary: NOME_AGENDA, timeZone: FUSO, description: 'Aulas da Master Educação (criada automaticamente pela Central).' });
      if (r.status >= 300) throw new Error(`Criar agenda: ${r.status} ${r.error && r.error.message}`);
      calendarId = r.id;
    }
    await docPrivado().set({ calendarId }, { merge: true });
    await docStatus().set({ conectado: true, conta, agenda: NOME_AGENDA, conectadoPor: est.por, conectadoEm: admin.firestore.FieldValue.serverTimestamp(), ultimoErro: '' }, { merge: true });
    res.send(pagina('Google Agenda conectado', `Conta ${conta}. As aulas vão aparecer na agenda "${NOME_AGENDA}" e os convites serão enviados a professores e clientes.`, true));
  } catch (e) {
    console.error('[agenda] callback', e);
    await registrarErro(e.message);
    res.status(500).send(pagina('Não foi possível conectar', 'Tente de novo em alguns minutos. Se persistir, avise o suporte.', false));
  }
});

// POST (admin) → sincroniza todas as aulas (futuras entram; passadas são ignoradas).
exports.agendaSincronizarTudo = functions.region(REGIAO).runWith({ secrets: [CLIENT_ID, CLIENT_SECRET], timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const quem = await exigirAdmin(req, res);
    if (!quem) return;
    const cont = { criado: 0, atualizado: 0, removido: 0, 'sem mudança': 0, ignorado: 0, desconectado: 0, erro: 0 };
    try {
      const snap = await db().collection('BancoDeAulas-Lista').get();
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 5) {
        await Promise.all(docs.slice(i, i + 5).map(async (d) => {
          try { cont[await sincronizar(d.id, d.data())]++; }
          catch (e) { cont.erro++; console.error('[agenda] aula', d.id, e.message); }
        }));
      }
      await docStatus().set({ ultimaSincronizacao: admin.firestore.FieldValue.serverTimestamp(), resumoSincronizacao: cont }, { merge: true });
      res.json({ ok: true, ...cont });
    } catch (e) {
      console.error('[agenda] sincronizar tudo', e);
      await registrarErro(e.message);
      res.status(500).json({ erro: e.message });
    }
  });

// POST (admin) → desconecta (revoga o acesso). Os eventos já criados continuam.
exports.agendaDesconectar = comSegredos.https.onRequest(async (req, res) => {
  const quem = await exigirAdmin(req, res);
  if (!quem) return;
  const priv = (await docPrivado().get()).data() || {};
  if (priv.refreshToken) {
    await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: priv.refreshToken }) }).catch(() => {});
  }
  await docPrivado().set({ refreshToken: admin.firestore.FieldValue.delete() }, { merge: true });
  cacheAcesso = null;
  await docStatus().set({ conectado: false, desconectadoPor: quem.email, desconectadoEm: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  res.json({ ok: true });
});

// Gatilho: qualquer mudança numa aula mantém o evento em dia.
exports.agendaSincronizarAula = comSegredos.firestore
  .document('BancoDeAulas-Lista/{aulaId}')
  .onWrite(async (mudanca, ctx) => {
    const depois = mudanca.after.exists ? mudanca.after.data() : null;
    try {
      const r = await sincronizar(ctx.params.aulaId, depois);
      if (r !== 'ignorado' && r !== 'sem mudança' && r !== 'desconectado') console.log('[agenda]', ctx.params.aulaId, r);
    } catch (e) {
      console.error('[agenda] aula', ctx.params.aulaId, e);
      await registrarErro(`Aula ${ctx.params.aulaId}: ${e.message}`);
    }
  });

// Exportado para testes.
exports._interno = { montarEvento, lerData, lerHorario, lerDuracaoMin, paraLocal, idEvento };

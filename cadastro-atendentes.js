// cadastro-atendentes.js
// Área "Cadastro de Atendentes" (menu Atendimento).
//
// Quem está na lista `atendentes` entra no portal de atendimento
// (atendimento.mastereducacao.app.br) e trabalha nas mesmas áreas da Central:
// Painel Central, Banco de Aulas, Calendário Master, Processos, Simulações,
// Propostas, BD Clientes e BD Professores. Financeiro, Configurações e o resto
// continuam só para os 2 e-mails admin (regras: SistemMaster-Login/firestore.rules
// → isAtendente / isEquipe).
//
// Documento: atendentes/{email em minúsculas}
//   { email, nome, uid, ativo, senhaDefinida, criadoEm, criadoPor,
//     atualizadoEm, ultimoAcesso }
// As regras só reconhecem o atendente quando o uid do documento é o uid de
// quem está logado — por isso a conta é SEMPRE criada aqui (o uid vem da
// criação). Um e-mail que já tem conta no Firebase Auth (professor, cliente,
// ex-atendente) não pode ser cadastrado: o SDK do navegador não devolve o uid
// de uma conta existente, e cada e-mail só pode ter uma conta.
//
// Senha provisória: mesmo fluxo dos professores (senha-inicial.js). A conta
// nasce com uma senha aleatória que ninguém vê e a pessoa recebe o e-mail
// "defina sua senha". O link abre confirmar-email.html do portal, que, para
// area=atendente, marca senhaDefinida e manda para o login do atendimento.

(function () {
  'use strict';

  const COLECAO = 'atendentes';
  const APP_SECUNDARIA = 'ap-atendente-auth';
  const URL_ATENDIMENTO = 'https://atendimento.mastereducacao.app.br';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fdb = () => firebase.firestore();
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const aviso = (msg, tipo, ms) => (typeof showToast === 'function' ? showToast(msg, tipo || 'info', ms || 5000) : alert(msg));
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (t) => {
    const d = t && t.toDate ? t.toDate() : null;
    return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
  };
  const emailValido = (e) => /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(e);
  const quem = () => (window.currentUser && window.currentUser.email) || '';

  let lista = [];
  let cancelar = null;

  // ── Estilos ──────────────────────────────────────────────────────────────
  let estilo = false;
  function injetarEstilo() {
    if (estilo) return;
    estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .ca-wrap{padding:1.2rem 1.4rem 2.5rem;font-family:'Comfortaa',sans-serif;color:#374151;display:flex;flex-direction:column;gap:1.2rem;}
    .ca-topo{display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-end;justify-content:space-between;}
    .ca-topo h2{margin:0;font:700 1.3rem 'Lexend',sans-serif;color:#111827;}
    .ca-topo p{margin:.2rem 0 0;font-size:.84rem;color:#6b7280;max-width:75ch;}
    .ca-btn{border:2px solid #e5e7eb;background:#fff;border-radius:10px;padding:.5rem .9rem;font:700 .82rem 'Comfortaa',sans-serif;color:#374151;cursor:pointer;display:inline-flex;gap:.45rem;align-items:center;}
    .ca-btn:hover{border-color:#fdba74;color:#d97804;}
    .ca-btn.pri{background:#f28705;border-color:#f28705;color:#fff;}
    .ca-btn.pri:hover{background:#d97804;color:#fff;}
    .ca-btn.perigo{color:#b91c1c;}
    .ca-btn.perigo:hover{border-color:#fca5a5;color:#991b1b;}
    .ca-btn:disabled{opacity:.5;cursor:not-allowed;}
    .ca-caixa{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:1rem;min-width:0;}
    .ca-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) auto;gap:.7rem;align-items:end;}
    .ca-form label{display:flex;flex-direction:column;gap:.25rem;font:700 .74rem 'Lexend',sans-serif;color:#111827;}
    .ca-form input{border:2px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;font:.88rem 'Comfortaa',sans-serif;min-height:40px;}
    .ca-form input:focus{outline:none;border-color:#f28705;}
    .ca-nota{font-size:.78rem;color:#6b7280;margin:.6rem 0 0;}
    .ca-tabela{overflow-x:auto;}
    .ca-tabela table{width:100%;border-collapse:collapse;font-size:.84rem;min-width:760px;}
    .ca-tabela th{text-align:left;font:700 .7rem 'Comfortaa',sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;padding:.5rem .6rem;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
    .ca-tabela td{padding:.6rem;border-bottom:1px solid #f1f2f4;vertical-align:middle;}
    .ca-tabela td.acoes{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end;}
    .ca-pill{display:inline-block;font:700 .7rem 'Comfortaa',sans-serif;border-radius:999px;padding:.15rem .55rem;border:1px solid;white-space:nowrap;}
    .ca-pill.g{background:#f0fdf4;color:#15803d;border-color:#bbf7d0;}
    .ca-pill.y{background:#fffbeb;color:#a16207;border-color:#fde68a;}
    .ca-pill.r{background:#fef2f2;color:#b91c1c;border-color:#fecaca;}
    .ca-vazio{text-align:center;color:#6b7280;padding:2rem 1rem;font-size:.9rem;}
    @media (max-width:900px){ .ca-form{grid-template-columns:1fr;} .ca-wrap{padding:1rem;} }`;
    document.head.appendChild(s);
  }

  // ── Firebase Auth secundário (criar conta sem deslogar o admin) ───────────
  function authSecundario() {
    try {
      return firebase.app(APP_SECUNDARIA).auth();
    } catch (e) {
      const cfg = (typeof FIREBASE_CONFIG !== 'undefined') ? FIREBASE_CONFIG : firebase.app().options;
      return firebase.initializeApp(cfg, APP_SECUNDARIA).auth();
    }
  }

  function senhaAleatoria() {
    if (window.SENHA_INICIAL && typeof SENHA_INICIAL.gerar === 'function') return SENHA_INICIAL.gerar();
    const b = new Uint32Array(32);
    crypto.getRandomValues(b);
    return 'Aa1!' + Array.from(b, n => n.toString(36)).join('').slice(0, 32);
  }

  // E-mail "defina sua senha". O continueUrl leva area=atendente para a página
  // de ação do portal mandar a pessoa para o login do atendimento. Se o domínio
  // do atendimento ainda não estiver autorizado no Firebase Auth, envia sem
  // continueUrl (o link funciona igual; só o redirecionamento final vai para o
  // login do portal).
  async function enviarDefinicaoSenha(email) {
    const auth = firebase.auth();
    auth.languageCode = 'pt-BR';
    try {
      await auth.sendPasswordResetEmail(email, { url: `${URL_ATENDIMENTO}/login.html?area=atendente` });
      return { ok: true, completo: true };
    } catch (e) {
      if (e && (e.code === 'auth/unauthorized-continue-uri' || e.code === 'auth/invalid-continue-uri')) {
        try {
          await auth.sendPasswordResetEmail(email);
          return { ok: true, completo: false };
        } catch (e2) {
          console.warn('[Atendentes] Falha ao enviar e-mail de senha:', e2 && e2.code);
          return { ok: false };
        }
      }
      console.warn('[Atendentes] Falha ao enviar e-mail de senha:', e && e.code);
      return { ok: false };
    }
  }

  async function emailJaUsadoNoSistema(email) {
    const db = fdb();
    const [cli, prof] = await Promise.all([
      db.collection('cadastroClientes').where('email', '==', email).limit(1).get(),
      db.collection('dataBaseProfessores').where('email', '==', email).limit(1).get()
    ]);
    if (!cli.empty) return 'cliente';
    if (!prof.empty) return 'professor';
    return '';
  }

  // ── Ações ────────────────────────────────────────────────────────────────
  async function cadastrar(nome, email) {
    nome = String(nome || '').trim().slice(0, 80);
    email = String(email || '').trim().toLowerCase();
    if (!nome) return aviso('Informe o nome do atendente.', 'warning');
    if (!emailValido(email)) return aviso('E-mail inválido.', 'warning');
    const admins = (typeof AUTHORIZED_EMAILS !== 'undefined' ? AUTHORIZED_EMAILS : []).map(e => e.toLowerCase());
    if (admins.includes(email)) return aviso('Este e-mail já é administrador da Central.', 'warning');

    const ref = fdb().collection(COLECAO).doc(email);
    if ((await ref.get()).exists) return aviso('Este e-mail já está na lista de atendentes.', 'warning');
    const usado = await emailJaUsadoNoSistema(email);
    if (usado) {
      return aviso(`Este e-mail já é de um ${usado} cadastrado. Cada e-mail só pode ter uma conta: use outro e-mail para o atendente.`, 'warning', 9000);
    }

    const auth = authSecundario();
    let uid = '';
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, senhaAleatoria());
      uid = cred.user.uid;
    } catch (e) {
      try { await auth.signOut(); } catch (_) { /* ignora */ }
      if (e && e.code === 'auth/email-already-in-use') {
        return aviso('Já existe uma conta de login com este e-mail (por exemplo, de um ex-atendente). '
          + 'Apague essa conta no Firebase Console → Authentication → Users e cadastre de novo, ou use outro e-mail.', 'error', 12000);
      }
      console.error('[Atendentes] Erro ao criar conta:', e);
      return aviso('Não foi possível criar a conta: ' + esc((e && e.message) || e), 'error');
    }
    try { await auth.signOut(); } catch (_) { /* ignora */ }

    await ref.set({
      email, nome, uid,
      ativo: true,
      senhaDefinida: false,
      criadoEm: ts(),
      criadoPor: quem(),
      atualizadoEm: ts()
    });

    const envio = await enviarDefinicaoSenha(email);
    if (!envio.ok) {
      aviso(`Atendente ${esc(nome)} cadastrado, mas o e-mail de senha não foi enviado. Use "Reenviar e-mail de senha".`, 'warning', 9000);
    } else if (!envio.completo) {
      aviso(`Atendente ${esc(nome)} cadastrado e e-mail enviado. Inclua ${esc(URL_ATENDIMENTO.replace('https://', ''))} nos domínios autorizados do Firebase Auth para o link levar direto ao login do atendimento.`, 'success', 10000);
    } else {
      aviso(`Atendente ${esc(nome)} cadastrado. Enviamos o e-mail para ${esc(email)} definir a senha.`, 'success', 6000);
    }
    await carregar();
  }

  async function reenviar(a) {
    const envio = await enviarDefinicaoSenha(a.email);
    aviso(envio.ok ? `E-mail de senha reenviado para ${esc(a.email)}.` : 'Não foi possível enviar o e-mail. Tente de novo em alguns minutos.', envio.ok ? 'success' : 'error');
  }

  async function alternarAtivo(a) {
    const novo = a.ativo !== true;
    const msg = novo
      ? `Reativar o acesso de ${a.nome || a.email}?`
      : `Desativar o acesso de ${a.nome || a.email}? Ele(a) perde o acesso na hora, inclusive com a sessão aberta.`;
    if (!window.confirm(msg)) return;
    await fdb().collection(COLECAO).doc(a.email).update({ ativo: novo, atualizadoEm: ts(), atualizadoPor: quem() });
    aviso(novo ? 'Acesso reativado.' : 'Acesso desativado.', 'success');
    await carregar();
  }

  async function excluir(a) {
    if (!window.confirm(`Excluir ${a.nome || a.email} da lista de atendentes?\n\n`
      + 'O acesso é removido na hora e os logs dele(a) continuam guardados. '
      + 'A conta de login continua existindo no Firebase: para cadastrar este mesmo e-mail de novo, '
      + 'apague-a antes em Firebase Console → Authentication → Users. Para só bloquear, prefira "Desativar".')) return;
    await fdb().collection(COLECAO).doc(a.email).delete();
    aviso('Atendente excluído da lista.', 'success');
    await carregar();
  }

  // ── Tela ─────────────────────────────────────────────────────────────────
  async function carregar() {
    const snap = await fdb().collection(COLECAO).get();
    lista = snap.docs.map(d => ({ ...d.data(), email: d.id }))
      .sort((x, y) => String(x.nome || x.email).localeCompare(String(y.nome || y.email), 'pt-BR'));
    desenhar();
  }

  function situacao(a) {
    if (a.ativo !== true) return '<span class="ca-pill r">Desativado</span>';
    if (a.senhaDefinida !== true) return '<span class="ca-pill y">Aguardando senha</span>';
    return '<span class="ca-pill g">Ativo</span>';
  }

  function desenhar() {
    const sec = document.getElementById('cadastro-atendentes');
    const alvo = sec && sec.querySelector('.ca-lista');
    if (!alvo) return;
    if (!lista.length) {
      alvo.innerHTML = '<div class="ca-vazio">Nenhum atendente cadastrado ainda.</div>';
      return;
    }
    alvo.innerHTML = `<div class="ca-tabela"><table>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Situação</th><th>Cadastrado em</th><th>Último acesso</th><th></th></tr></thead>
      <tbody>${lista.map((a, i) => `<tr>
        <td><b>${esc(a.nome || '—')}</b></td>
        <td>${esc(a.email)}</td>
        <td>${situacao(a)}</td>
        <td>${fmt(a.criadoEm)}</td>
        <td>${fmt(a.ultimoAcesso)}</td>
        <td class="acoes">
          <button type="button" class="ca-btn" data-acao="reenviar" data-i="${i}" title="Envia de novo o e-mail para definir a senha"><i class="fas fa-envelope"></i> Reenviar e-mail de senha</button>
          <button type="button" class="ca-btn" data-acao="ativo" data-i="${i}">${a.ativo === true ? '<i class="fas fa-user-slash"></i> Desativar' : '<i class="fas fa-user-check"></i> Reativar'}</button>
          <button type="button" class="ca-btn perigo" data-acao="excluir" data-i="${i}"><i class="fas fa-trash"></i> Excluir</button>
        </td></tr>`).join('')}</tbody></table></div>`;
  }

  function abrir() {
    injetarEstilo();
    const sec = document.getElementById('cadastro-atendentes');
    if (!sec) return;
    if (cancelar) { cancelar(); cancelar = null; }
    sec.innerHTML = `<div class="ca-wrap">
      <div class="ca-topo"><div>
        <h2>Cadastro de Atendentes</h2>
        <p>Quem está nesta lista entra em <b>${esc(URL_ATENDIMENTO.replace('https://', ''))}</b> e trabalha no Painel Central, Banco de Aulas, Calendário Master, Processos, Simulações, Propostas, BD Clientes e BD Professores. Tudo o que fizer fica registrado em <b>Logs</b>.</p>
      </div></div>
      <div class="ca-caixa">
        <form class="ca-form" autocomplete="off">
          <label>Nome<input name="nome" maxlength="80" required placeholder="Nome do atendente"></label>
          <label>E-mail<input name="email" type="email" maxlength="200" required placeholder="email@exemplo.com"></label>
          <button type="submit" class="ca-btn pri"><i class="fas fa-user-plus"></i> Cadastrar atendente</button>
        </form>
        <p class="ca-nota">A senha provisória é criada automaticamente e ninguém a vê: o atendente recebe um e-mail para definir a própria senha (mesmo fluxo dos professores). O e-mail não pode ser de um professor ou cliente já cadastrado.</p>
      </div>
      <div class="ca-caixa ca-lista"><div class="ca-vazio">Carregando…</div></div>
    </div>`;

    const form = sec.querySelector('.ca-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await cadastrar(form.nome.value, form.email.value);
        if (lista.some(a => a.email === String(form.email.value).trim().toLowerCase())) form.reset();
      } catch (err) {
        console.error('[Atendentes] Erro ao cadastrar:', err);
        aviso('Erro ao cadastrar atendente: ' + esc(err.message || err), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    sec.querySelector('.ca-lista').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-acao]');
      if (!btn) return;
      const a = lista[Number(btn.getAttribute('data-i'))];
      if (!a) return;
      btn.disabled = true;
      try {
        const acao = btn.getAttribute('data-acao');
        if (acao === 'reenviar') await reenviar(a);
        else if (acao === 'ativo') await alternarAtivo(a);
        else if (acao === 'excluir') await excluir(a);
      } catch (err) {
        console.error('[Atendentes] Erro:', err);
        aviso('Não foi possível concluir: ' + esc(err.message || err), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    carregar().catch((err) => {
      console.error('[Atendentes] Erro ao carregar:', err);
      const alvo = sec.querySelector('.ca-lista');
      if (alvo) alvo.innerHTML = `<div class="ca-vazio">Não foi possível carregar a lista (${esc(err.code || err.message)}). Confira se as regras novas do Firestore já foram publicadas.</div>`;
    });
  }

  window.CadastroAtendentes = { abrir };
})();

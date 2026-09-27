// functions-integracoes.js — Integrações (Google Agenda; depois, e-mails Resend)
// Conecta a conta Google da Master uma vez e sincroniza as aulas com a agenda
// "Aulas Master" (Cloud Functions em functions/agenda.js). O estado aparece em
// tempo real a partir de _sistema/agendaGoogle.

(function () {
  'use strict';

  const BASE = 'https://us-central1-master-ecossistemaprofessor.cloudfunctions.net';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const aviso = (m, t) => (typeof showToast === 'function' ? showToast(m, t || 'info', 5000) : alert(m));
  const fmt = (ts) => { const d = ts && ts.toDate ? ts.toDate() : null; return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''; };
  let cancelar = null;
  let status = null;

  async function chamar(nome) {
    const u = firebase.auth().currentUser;
    if (!u) throw new Error('Sessão expirada. Entre de novo.');
    const token = await u.getIdToken();
    const r = await fetch(`${BASE}/${nome}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
    return j;
  }

  let estilo = false;
  function injetarEstilo() {
    if (estilo) return; estilo = true;
    const s = document.createElement('style');
    s.textContent = `
    .ig-wrap{padding:1rem 1.2rem 2rem;font-family:'Comfortaa',sans-serif;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem;align-items:start;}
    .ig-card{background:#fff;border:1.5px solid #eef0f3;border-radius:16px;padding:1.2rem;box-shadow:0 2px 10px rgba(0,0,0,.04);}
    .ig-cab{display:flex;gap:.8rem;align-items:center;margin-bottom:.8rem;}
    .ig-ic{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;background:#eef4ff;color:#1a73e8;flex-shrink:0;}
    .ig-ic.mail{background:#fff7eb;color:#d97804;}
    .ig-cab h3{font:700 1.05rem 'Lexend',sans-serif;margin:0;color:#111827;}
    .ig-cab p{margin:.1rem 0 0;font-size:.8rem;color:#6b7280;}
    .ig-status{display:inline-flex;gap:.4rem;align-items:center;font:700 .78rem 'Comfortaa',sans-serif;border-radius:999px;padding:.25rem .7rem;margin-bottom:.7rem;}
    .ig-status.on{background:#dcfce7;color:#15803d;} .ig-status.off{background:#f3f4f6;color:#6b7280;} .ig-status.err{background:#fef2f2;color:#dc2626;}
    .ig-txt{font-size:.85rem;color:#374151;line-height:1.55;margin:.2rem 0 .8rem;}
    .ig-txt small{color:#6b7280;}
    .ig-acoes{display:flex;gap:.5rem;flex-wrap:wrap;}
    .ig-btn{border-radius:10px;padding:.55rem 1rem;font:700 .84rem 'Comfortaa',sans-serif;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#374151;display:inline-flex;gap:.45rem;align-items:center;min-height:42px;}
    .ig-btn.pri{background:#f28705;border-color:#f28705;color:#fff;}
    .ig-btn.perigo{color:#dc2626;}
    .ig-btn:disabled{opacity:.55;cursor:not-allowed;}
    .ig-erro{background:#fef2f2;border-radius:10px;padding:.6rem .8rem;font-size:.78rem;color:#991b1b;margin-bottom:.8rem;word-break:break-word;}
    .ig-lista{margin:.2rem 0 .9rem;padding-left:1.1rem;font-size:.82rem;color:#4b5563;line-height:1.6;}
    @media (max-width:640px){ .ig-wrap{padding:.8rem;grid-template-columns:1fr;} }`;
    document.head.appendChild(s);
  }

  function htmlAgenda() {
    const st = status || {};
    const con = st.conectado === true;
    const res = st.resumoSincronizacao;
    return `<div class="ig-card" id="ig-agenda">
      <div class="ig-cab"><span class="ig-ic"><i class="fas fa-calendar-days"></i></span>
        <div><h3>Google Agenda</h3><p>Aulas fechadas viram eventos com convite para professor e cliente.</p></div></div>
      <span class="ig-status ${con ? 'on' : 'off'}"><i class="fas ${con ? 'fa-circle-check' : 'fa-circle-minus'}"></i>${con ? 'Conectado' : 'Não conectado'}</span>
      ${con ? `<p class="ig-txt">Conta <b>${esc(st.conta)}</b> · agenda <b>${esc(st.agenda || 'Aulas Master')}</b><br>
        <small>Conectado em ${esc(fmt(st.conectadoEm))}${st.conectadoPor ? ' por ' + esc(st.conectadoPor) : ''}${st.ultimaSincronizacao ? ` · última sincronização completa: ${esc(fmt(st.ultimaSincronizacao))}` : ''}</small></p>
        ${res ? `<p class="ig-txt"><small>Resultado: ${res['criado'] || 0} criadas · ${res['atualizado'] || 0} atualizadas · ${res['removido'] || 0} removidas · ${res['sem mudança'] || 0} sem mudança${res.erro ? ` · <b style="color:#dc2626">${res.erro} com erro</b>` : ''}</small></p>` : ''}`
      : `<ul class="ig-lista">
          <li>Entra na agenda: aula <b>futura</b>, com <b>data, horário e professor</b> definidos e não cancelada.</li>
          <li>Remarcou ou trocou professor? O evento é atualizado. Cancelou? O evento sai.</li>
          <li>Professor e cliente recebem o convite por e-mail (funciona no Gmail e no iPhone).</li>
        </ul>`}
      ${st.ultimoErro ? `<div class="ig-erro"><b>Último erro${st.ultimoErroEm ? ' (' + esc(fmt(st.ultimoErroEm)) + ')' : ''}:</b> ${esc(st.ultimoErro)}</div>` : ''}
      <div class="ig-acoes">
        ${con ? `<button class="ig-btn pri" data-acao="sincronizar"><i class="fas fa-rotate"></i> Sincronizar aulas futuras</button>
                 <button class="ig-btn" data-acao="conectar"><i class="fab fa-google"></i> Reconectar</button>
                 <button class="ig-btn perigo" data-acao="desconectar"><i class="fas fa-link-slash"></i> Desconectar</button>`
              : `<button class="ig-btn pri" data-acao="conectar"><i class="fab fa-google"></i> Conectar conta Google da Master</button>`}
      </div></div>`;
  }

  function htmlEmails() {
    return `<div class="ig-card">
      <div class="ig-cab"><span class="ig-ic mail"><i class="fas fa-envelope"></i></span>
        <div><h3>E-mails (Resend)</h3><p>Lembretes de aula, de relatório e avisos de contratação.</p></div></div>
      <span class="ig-status off"><i class="fas fa-clock"></i>Em breve</span>
      <p class="ig-txt">Os botões de envio aparecem aqui assim que o domínio estiver verificado no Resend.</p></div>`;
  }

  function desenhar() {
    const sec = document.getElementById('integracoes');
    const w = sec && sec.querySelector('.ig-wrap');
    if (w) w.innerHTML = htmlAgenda() + htmlEmails();
  }

  async function acao(nome, btn) {
    const original = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde…';
    // A aba precisa abrir no mesmo clique (senão o navegador bloqueia o pop-up).
    const aba = nome === 'conectar' ? window.open('about:blank', '_blank') : null;
    try {
      if (nome === 'conectar') {
        const { url } = await chamar('agendaAutorizar');
        if (aba) aba.location.href = url; else window.location.href = url;
        aviso('Autorize na aba do Google com a conta da Master. Esta tela atualiza sozinha.', 'info');
      } else if (nome === 'sincronizar') {
        const r = await chamar('agendaSincronizarTudo');
        aviso(`Agenda sincronizada: ${r['criado'] || 0} criadas, ${r['atualizado'] || 0} atualizadas, ${r['removido'] || 0} removidas${r.erro ? `, ${r.erro} com erro` : ''}.`, r.erro ? 'warning' : 'success');
      } else if (nome === 'desconectar') {
        if (!confirm('Desconectar o Google Agenda? Novas aulas deixam de ir para a agenda (os eventos já criados continuam lá).')) return;
        await chamar('agendaDesconectar');
        aviso('Google Agenda desconectado.', 'success');
      }
    } catch (e) {
      if (aba) aba.close();
      console.error('[Integrações]', e);
      aviso(`Não foi possível concluir: ${e.message}`, 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = original;
    }
  }

  function loadIntegracoes() {
    injetarEstilo();
    const sec = document.getElementById('integracoes');
    if (!sec) return;
    sec.innerHTML = '<div class="ig-wrap"></div>';
    desenhar();
    sec.querySelector('.ig-wrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]');
      if (b) acao(b.dataset.acao, b);
    });
    if (!cancelar) {
      cancelar = firebase.firestore().doc('_sistema/agendaGoogle').onSnapshot(
        (d) => { status = d.exists ? d.data() : null; desenhar(); },
        (err) => console.warn('[Integrações] status indisponível:', err && err.code));
    }
  }

  window.loadIntegracoes = loadIntegracoes;
})();

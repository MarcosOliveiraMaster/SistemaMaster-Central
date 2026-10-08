// senha-inicial.js
// Contas novas de professores e clientes (C3 do plano de ação em
// SistemMaster-Login/docs/PLANO-ACAO-PENDENCIAS.md).
//
// Antes a senha inicial era o CPF: quem soubesse o e-mail e o CPF de alguém
// entrava na conta. Agora a conta nasce com uma senha aleatória que ninguém vê
// e a pessoa recebe o e-mail do Firebase para DEFINIR a própria senha. O link
// abre a página de ação configurada no Firebase (confirmar-email.html do
// portal), que marca senhaDefinida no cadastro. Contas antigas: o portal exige
// a troca no primeiro login (SistemMaster-Login/auth.js → trocaSenha).
//
// O envio usa a instância PRINCIPAL do Auth: mandar o e-mail não faz login
// nem muda a sessão do admin.

(function () {
  'use strict';

  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';

  /** Senha aleatória forte (32 caracteres, crypto.getRandomValues). Nunca é exibida. */
  function gerar(tamanho = 32) {
    const bytes = new Uint32Array(tamanho);
    crypto.getRandomValues(bytes);
    let s = '';
    for (let i = 0; i < tamanho; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
    // Garante letra, número e símbolo (mesma exigência do portal).
    return 'Aa1!' + s;
  }

  /** Envia o e-mail "defina sua senha". Retorna true/false (nunca lança). */
  async function enviarDefinicao(email) {
    try {
      const auth = firebase.auth();
      auth.languageCode = 'pt-BR';
      await auth.sendPasswordResetEmail(String(email || '').trim().toLowerCase());
      return true;
    } catch (e) {
      console.warn('[Senha inicial] Não foi possível enviar o e-mail de definição de senha:', e && e.code);
      return false;
    }
  }

  window.SENHA_INICIAL = { gerar, enviarDefinicao };
})();

// Funções puras de validação — sem efeitos colaterais, sem acesso a chrome.* ou DOM.
// Usadas por background.js (validar payload recebido) e por tests/validation.test.js.

(function (root) {
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./constants.js')
    : root.MASTER_WPP_CONSTANTS;

  function validarTelefone(telefone) {
    if (typeof telefone !== 'string') return false;
    const digitos = telefone.replace(/\D/g, '');
    return C.REGEX_TELEFONE.test(digitos);
  }

  function validarTexto(texto) {
    if (typeof texto !== 'string') return false;
    if (texto.length === 0) return false;
    if (texto.length > C.TEXTO_MAX_LEN) return false;
    return true;
  }

  function validarContato(contato) {
    if (!contato || typeof contato !== 'object') return false;
    if (typeof contato.nome !== 'string' || !contato.nome.trim()) return false;
    if (!validarTelefone(contato.telefone)) return false;
    return true;
  }

  // Valida o payload completo recebido via chrome.runtime.onMessageExternal.
  // Retorna { valido: boolean, erro?: string }
  function validarPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valido: false, erro: 'Payload ausente ou inválido.' };
    }
    if (!Array.isArray(payload.contatos) || payload.contatos.length === 0) {
      return { valido: false, erro: 'Lista de contatos ausente ou vazia.' };
    }
    if (payload.contatos.length > C.CONTATOS_MAX) {
      return { valido: false, erro: `Lista de contatos excede o limite de ${C.CONTATOS_MAX}.` };
    }
    if (!payload.contatos.every(validarContato)) {
      return { valido: false, erro: 'Um ou mais contatos têm nome/telefone inválido.' };
    }
    if (!validarTexto(payload.texto1)) {
      return { valido: false, erro: 'Texto 1 ausente ou inválido.' };
    }
    if (payload.texto2 !== undefined && payload.texto2 !== null && !validarTexto(payload.texto2)) {
      return { valido: false, erro: 'Texto 2 inválido.' };
    }
    if (payload.imagem !== undefined && typeof payload.imagem !== 'boolean') {
      return { valido: false, erro: 'Campo "imagem" deve ser boolean.' };
    }
    return { valido: true };
  }

  const api = { validarTelefone, validarTexto, validarContato, validarPayload };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MasterWppValidation = api;
  }
})(typeof self !== 'undefined' ? self : this);

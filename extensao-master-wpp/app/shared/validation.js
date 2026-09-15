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

  // "imagem" é opcional; quando presente, precisa ser uma data URL de imagem (base64)
  // dentro do limite de tamanho — não um simples boolean (a extensão não lê mais o
  // clipboard, o Central manda os bytes da imagem já codificados no payload).
  function validarImagem(imagem) {
    if (typeof imagem !== 'string') return false;
    if (imagem.length > C.IMAGEM_MAX_LEN) return false;
    return C.REGEX_IMAGEM_DATA_URL.test(imagem);
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
    if (payload.imagem !== undefined && payload.imagem !== null && payload.imagem !== false && !validarImagem(payload.imagem)) {
      return { valido: false, erro: 'Campo "imagem" deve ser uma data URL de imagem válida (base64), dentro do limite de tamanho.' };
    }
    return { valido: true };
  }

  const api = { validarTelefone, validarTexto, validarContato, validarImagem, validarPayload };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MasterWppValidation = api;
  }
})(typeof self !== 'undefined' ? self : this);

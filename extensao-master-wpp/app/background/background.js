// Service worker (Manifest V3) — recebe o payload do Central via externally_connectable,
// valida, e orquestra a fila de envio: abre/navega a aba do WhatsApp Web por contato,
// aguarda o content script confirmar cada etapa, com delay aleatório entre ações.

importScripts('../shared/constants.js', '../shared/validation.js');

const C = self.MASTER_WPP_CONSTANTS;
const { validarPayload } = self.MasterWppValidation;

function delayAleatorio() {
  const ms = C.DELAY_MIN_MS + Math.random() * (C.DELAY_MAX_MS - C.DELAY_MIN_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function personalizarTexto(template, nome) {
  return (template || '').replace(/\[nome\]/gi, nome);
}

// Envia uma mensagem para o content script da aba do WhatsApp Web e aguarda resposta,
// com timeout — o content script pode não estar pronto (chat não carregou, não logado etc).
function enviarParaContentScript(tabId, mensagem, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout aguardando resposta do WhatsApp Web.')), timeoutMs);
    chrome.tabs.sendMessage(tabId, mensagem, resposta => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resposta);
    });
  });
}

async function abrirAbaWhatsApp(telefone) {
  const url = `https://web.whatsapp.com/send?phone=${telefone}`;
  const tab = await chrome.tabs.create({ url, active: false });
  return tab.id;
}

async function aguardarAbaCarregada(tabId, timeoutMs = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function processarContato(contato, payload) {
  const resultado = { nome: contato.nome, telefone: contato.telefone, status: 'erro', detalhe: '' };
  let tabId;
  try {
    tabId = await abrirAbaWhatsApp(contato.telefone);
    const carregou = await aguardarAbaCarregada(tabId);
    if (!carregou) throw new Error('WhatsApp Web não carregou a tempo.');

    await delayAleatorio();
    const statusChat = await enviarParaContentScript(tabId, { tipo: 'VERIFICAR_CHAT' });
    if (!statusChat || statusChat.status === 'nao_logado') {
      throw new Error('WhatsApp Web não está logado.');
    }
    if (statusChat.status === 'numero_inexistente') {
      resultado.status = 'pulado';
      resultado.detalhe = 'Número não existe no WhatsApp.';
      return resultado;
    }

    if (payload.texto1) {
      await delayAleatorio();
      await enviarParaContentScript(tabId, { tipo: 'ENVIAR_TEXTO', texto: personalizarTexto(payload.texto1, contato.nome) });
    }

    if (payload.imagem) {
      await delayAleatorio();
      await enviarParaContentScript(tabId, { tipo: 'ENVIAR_IMAGEM' });
    }

    if (payload.texto2) {
      await delayAleatorio();
      await enviarParaContentScript(tabId, { tipo: 'ENVIAR_TEXTO', texto: personalizarTexto(payload.texto2, contato.nome) });
    }

    resultado.status = 'enviado';
  } catch (err) {
    resultado.status = 'erro';
    resultado.detalhe = err.message || String(err);
  } finally {
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch (_) { /* aba já pode ter sido fechada */ } }
  }
  return resultado;
}

async function processarFila(payload, portaProgresso) {
  const resumo = [];
  for (const contato of payload.contatos) {
    const resultado = await processarContato(contato, payload);
    resumo.push(resultado);
    if (portaProgresso) {
      try { portaProgresso.postMessage({ tipo: 'PROGRESSO', resultado }); } catch (_) { /* porta pode ter fechado */ }
    }
    await delayAleatorio();
  }
  return resumo;
}

chrome.runtime.onMessageExternal.addListener((payload, sender, sendResponse) => {
  if (!sender.origin || sender.origin !== C.ORIGEM_PERMITIDA) {
    sendResponse({ ok: false, erro: 'Origem não autorizada.' });
    return false;
  }

  // Checagem leve de disponibilidade — usada pelo Central para saber se a extensão
  // está instalada antes de tentar montar/enviar um payload de verdade.
  if (payload && payload.ping === true) {
    sendResponse({ ok: true });
    return false;
  }

  const validacao = validarPayload(payload);
  if (!validacao.valido) {
    sendResponse({ ok: false, erro: validacao.erro });
    return false;
  }

  processarFila(payload, null)
    .then(resumo => sendResponse({ ok: true, resumo }))
    .catch(err => sendResponse({ ok: false, erro: err.message || String(err) }));

  return true; // mantém o canal aberto para a resposta assíncrona
});

// Canal de porta (chrome.runtime.connectExternal) — usado quando o Central quer
// progresso em tempo real por contato, em vez de só o resumo final.
chrome.runtime.onConnectExternal.addListener(port => {
  if (!port.sender || !port.sender.origin || port.sender.origin !== C.ORIGEM_PERMITIDA) {
    port.disconnect();
    return;
  }
  port.onMessage.addListener(payload => {
    const validacao = validarPayload(payload);
    if (!validacao.valido) {
      port.postMessage({ tipo: 'ERRO', erro: validacao.erro });
      port.disconnect();
      return;
    }
    processarFila(payload, port)
      .then(resumo => { port.postMessage({ tipo: 'CONCLUIDO', resumo }); port.disconnect(); })
      .catch(err => { port.postMessage({ tipo: 'ERRO', erro: err.message || String(err) }); port.disconnect(); });
  });
});

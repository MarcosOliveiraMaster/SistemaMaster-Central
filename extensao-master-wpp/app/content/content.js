// Content script injetado em web.whatsapp.com — executa as ações dentro da página:
// checar se o chat carregou (logado / número existe), simular digitação com evento
// "input" real (para acionar o indicador "digitando..."), colar a imagem do clipboard,
// e clicar em enviar.
//
// AVISO DE MANUTENÇÃO: os seletores abaixo dependem da estrutura DOM do WhatsApp Web,
// que muda sem aviso. Se o fluxo parar de funcionar, o primeiro passo é reabrir
// web.whatsapp.com, inspecionar o DOM atual e atualizar os seletores desta seção.

const SELETORES = {
  caixaTexto: 'footer [contenteditable="true"][data-tab]',
  botaoEnviar: 'footer button[data-tab][aria-label], footer span[data-icon="send"]',
  telaInvalida: '[data-testid="invalid-number-popup"], div[role="alertdialog"]',
  telaQrCode: 'canvas[aria-label], [data-testid="qrcode"]',
};

function aguardarElemento(seletor, timeoutMs = 15000) {
  return new Promise(resolve => {
    const existente = document.querySelector(seletor);
    if (existente) { resolve(existente); return; }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(seletor);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
  });
}

async function verificarChat() {
  const qrCode = document.querySelector(SELETORES.telaQrCode);
  if (qrCode) return { status: 'nao_logado' };

  const invalido = await aguardarElemento(SELETORES.telaInvalida, 4000);
  if (invalido) return { status: 'numero_inexistente' };

  const caixa = await aguardarElemento(SELETORES.caixaTexto, 15000);
  if (!caixa) return { status: 'erro', detalhe: 'Caixa de texto do chat não encontrada.' };

  return { status: 'ok' };
}

// Simula digitação real: foca, insere o texto caractere a caractere via execCommand/input
// (necessário para o WhatsApp Web reconhecer o conteúdo — setar textContent direto não dispara os listeners internos).
async function simularDigitacao(texto) {
  const caixa = document.querySelector(SELETORES.caixaTexto);
  if (!caixa) throw new Error('Caixa de texto não encontrada.');
  caixa.focus();

  document.execCommand('insertText', false, texto);
  caixa.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: texto, inputType: 'insertText' }));

  await new Promise(r => setTimeout(r, 300));
}

async function clicarEnviar() {
  const botao = document.querySelector(SELETORES.botaoEnviar);
  if (!botao) throw new Error('Botão de enviar não encontrado.');
  const alvo = botao.closest('button') || botao;
  alvo.click();
}

async function enviarTexto(texto) {
  await simularDigitacao(texto);
  await clicarEnviar();
}

async function enviarImagem() {
  const permissao = await navigator.permissions.query({ name: 'clipboard-read' }).catch(() => null);
  if (permissao && permissao.state === 'denied') {
    throw new Error('Permissão de leitura do clipboard negada.');
  }

  const itens = await navigator.clipboard.read();
  const itemImagem = itens.find(item => item.types.some(t => t.startsWith('image/')));
  if (!itemImagem) throw new Error('Nenhuma imagem encontrada no clipboard.');

  const tipo = itemImagem.types.find(t => t.startsWith('image/'));
  const blob = await itemImagem.getType(tipo);

  const caixa = document.querySelector(SELETORES.caixaTexto);
  if (!caixa) throw new Error('Caixa de texto não encontrada para colar a imagem.');
  caixa.focus();

  const dataTransfer = new DataTransfer();
  const arquivo = new File([blob], 'imagem.png', { type: tipo });
  dataTransfer.items.add(arquivo);

  const eventoPaste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer });
  caixa.dispatchEvent(eventoPaste);

  // WhatsApp Web abre um preview de imagem antes de enviar — aguarda o botão de enviar do preview.
  await new Promise(r => setTimeout(r, 1500));
  await clicarEnviar();
}

chrome.runtime.onMessage.addListener((mensagem, sender, sendResponse) => {
  (async () => {
    try {
      switch (mensagem.tipo) {
        case 'VERIFICAR_CHAT':
          sendResponse(await verificarChat());
          break;
        case 'ENVIAR_TEXTO':
          await enviarTexto(mensagem.texto);
          sendResponse({ status: 'ok' });
          break;
        case 'ENVIAR_IMAGEM':
          await enviarImagem();
          sendResponse({ status: 'ok' });
          break;
        default:
          sendResponse({ status: 'erro', detalhe: 'Tipo de mensagem desconhecido.' });
      }
    } catch (err) {
      sendResponse({ status: 'erro', detalhe: err.message || String(err) });
    }
  })();
  return true; // resposta assíncrona
});

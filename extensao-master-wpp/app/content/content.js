// Content script injetado em web.whatsapp.com — executa as ações dentro da página:
// checar se o chat carregou (logado / número existe), simular digitação com evento
// "input" real (para acionar o indicador "digitando..."), colar a imagem recebida no
// payload (data URL) e clicar em enviar.
//
// AVISO DE MANUTENÇÃO: os seletores abaixo dependem da estrutura DOM do WhatsApp Web,
// que muda sem aviso. Se o fluxo parar de funcionar, o primeiro passo é reabrir
// web.whatsapp.com, inspecionar o DOM atual e atualizar os seletores desta seção.

const SELETORES = {
  caixaTexto: 'footer [contenteditable="true"][data-tab]',
  // Lista em ordem de prioridade — tentados um a um (não união), porque o botão de
  // anexar ("+") também casa com seletores genéricos de botão do rodapé e aparece
  // antes do botão de enviar na árvore DOM.
  botoesEnviar: [
    'footer span[data-icon="send"]',
    'footer span[data-icon="wds-ic-send-filled"]',
    'footer button[aria-label="Enviar"]',
    'footer button[aria-label="Send"]',
  ],
  // O WhatsApp reusa esse mesmo popup ("confirm-popup"/role="dialog") tanto para número
  // inexistente quanto para "confirmar envio a contato não salvo" — o texto é conferido
  // à parte em verificarChat() para não confundir os dois casos.
  telaInvalida: '[data-testid="confirm-popup"], div[role="dialog"]',
  telaQrCode: 'canvas[aria-label], [data-testid="qrcode"]',
};

const TEXTO_NUMERO_INEXISTENTE = /não está no whatsapp|isn.t on whatsapp/i;

// Observa vários estados possíveis AO MESMO TEMPO (não em sequência) e resolve assim que
// qualquer um deles aparecer, com uma única janela de tempo total compartilhada. Checar em
// sequência (QR, depois popup, depois caixa) falha quando a aba está lenta (segundo plano,
// throttling do Chrome): se um estado demora mais que a soma das janelas anteriores para
// aparecer, a checagem já passou para a etapa seguinte e nunca mais olha para ele.
// candidatos: [{ chave, seletor, predicado? }]
function aguardarPrimeiroEstado(candidatos, timeoutMs) {
  return new Promise(resolve => {
    function tentar() {
      for (const c of candidatos) {
        for (const el of document.querySelectorAll(c.seletor)) {
          if (!c.predicado || c.predicado(el)) return { chave: c.chave, el };
        }
      }
      return null;
    }
    const inicial = tentar();
    if (inicial) { resolve(inicial); return; }
    const observer = new MutationObserver(() => {
      const achado = tentar();
      if (achado) { observer.disconnect(); resolve(achado); }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
  });
}

async function verificarChat() {
  // A aba do WhatsApp é aberta em segundo plano (active: false, ver background.js) para não
  // atrapalhar o usuário — o Chrome reduz a prioridade de renderização/timers de abas em
  // segundo plano, então essa janela é generosa para absorver esse atraso.
  const achado = await aguardarPrimeiroEstado([
    { chave: 'qr', seletor: SELETORES.telaQrCode },
    { chave: 'invalido', seletor: SELETORES.telaInvalida, predicado: el => TEXTO_NUMERO_INEXISTENTE.test(el.textContent) },
    { chave: 'chat', seletor: SELETORES.caixaTexto },
  ], 30000);

  if (!achado) return { status: 'erro', detalhe: 'Nenhum estado reconhecível do chat apareceu a tempo.' };
  if (achado.chave === 'qr') return { status: 'nao_logado' };
  if (achado.chave === 'invalido') return { status: 'numero_inexistente' };

  return { status: 'ok' };
}

// Simula digitação real via execCommand (necessário para o WhatsApp Web reconhecer o
// conteúdo — setar textContent direto não dispara os listeners internos). execCommand já
// dispara o evento "input" nativamente; NÃO redispare manualmente — o editor do WhatsApp
// trata cada evento "input" como uma inserção nova, e um segundo disparo duplica o texto.
async function simularDigitacao(texto) {
  const caixa = document.querySelector(SELETORES.caixaTexto);
  if (!caixa) throw new Error('Caixa de texto não encontrada.');
  caixa.focus();
  if (document.activeElement !== caixa) {
    // Logo após um envio anterior, o editor do WhatsApp pode estar se reconstruindo —
    // dá mais uma chance de foco antes de desistir.
    await new Promise(r => setTimeout(r, 250));
    caixa.focus();
  }

  document.execCommand('insertText', false, texto);

  await new Promise(r => setTimeout(r, 300));

  if (!caixa.textContent.trim()) {
    throw new Error('Texto não foi inserido na caixa de digitação (editor pode não estar pronto).');
  }
}

async function clicarEnviar() {
  let botao = null;
  for (const seletor of SELETORES.botoesEnviar) {
    botao = document.querySelector(seletor);
    if (botao) break;
  }
  if (!botao) throw new Error('Botão de enviar não encontrado.');
  const alvo = botao.closest('button') || botao;
  alvo.click();
}

// Clicar em enviar não garante que a mensagem realmente saiu — se a caixa continuar com
// conteúdo depois do clique, o envio não foi confirmado (ex.: clique perdido, editor não
// processou a tempo) e vale tentar mais uma vez antes de reportar erro.
async function confirmarEnvio() {
  await new Promise(r => setTimeout(r, 500));
  let caixa = document.querySelector(SELETORES.caixaTexto);
  if (!caixa || !caixa.textContent.trim()) return;

  await clicarEnviar();
  await new Promise(r => setTimeout(r, 500));
  caixa = document.querySelector(SELETORES.caixaTexto);
  if (caixa && caixa.textContent.trim()) {
    throw new Error('Envio não confirmado — a caixa de texto ainda contém conteúdo após tentativa de envio.');
  }
}

async function enviarTexto(texto) {
  await simularDigitacao(texto);
  await clicarEnviar();
  await confirmarEnvio();
}

// "imagemDataUrl" chega pronta no payload (o Central já lê e codifica a imagem antes de
// chamar a extensão) — não lemos mais o clipboard aqui, porque isso exigiria a aba estar
// em foco, o que conflita com ela rodar em segundo plano.
async function enviarImagem(imagemDataUrl) {
  const blob = await fetch(imagemDataUrl).then(r => r.blob());

  const caixa = document.querySelector(SELETORES.caixaTexto);
  if (!caixa) throw new Error('Caixa de texto não encontrada para colar a imagem.');
  caixa.focus();

  const tipo = blob.type || 'image/png';
  const extensao = tipo.split('/')[1] || 'png';
  const dataTransfer = new DataTransfer();
  const arquivo = new File([blob], `imagem.${extensao}`, { type: tipo });
  dataTransfer.items.add(arquivo);

  const eventoPaste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer });
  caixa.dispatchEvent(eventoPaste);

  // WhatsApp Web abre um preview de imagem antes de enviar — aguarda o botão de enviar do preview.
  await new Promise(r => setTimeout(r, 1500));

  // TEMP — DEBUG Parte 8: dump do estado da tela no instante exato em que tentaríamos
  // clicar em enviar, pra achar o seletor certo do botão de enviar do preview de imagem.
  console.log('[MasterWpp][DEBUG] estado no envio de imagem:', JSON.stringify({
    candidatos: Array.from(document.querySelectorAll('[data-icon], [aria-label], button'))
      .slice(0, 50)
      .map(el => ({ tag: el.tagName, icon: el.getAttribute('data-icon'), aria: el.getAttribute('aria-label') })),
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    imgsBlob: document.querySelectorAll('img[src^="blob:"]').length,
  }, null, 2));

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
          await enviarImagem(mensagem.imagem);
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

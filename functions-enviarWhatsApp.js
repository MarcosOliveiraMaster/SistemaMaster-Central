// ============================================================
// functions-enviarWhatsApp.js
// Componente genérico "Enviar mensagem para WhatsApp" — reutilizável em vários
// modais do sistema. Captura uma imagem de um elemento do DOM (html2canvas),
// monta Texto 1 / Texto 2 personalizados por contato, mostra uma prévia editável
// e dispara o envio pela extensão Chrome "Master WhatsApp App" (chrome.runtime.sendMessage).
//
// Contrato do payload / API de resposta: ver extensao-master-wpp/README.md.
// ============================================================

const WPP_EXTENSION_ID = 'cfkopcmokdidmcpnkhhemgfekgkkafco';
const WPP_INSTALL_HELP_URL = 'https://github.com/MarcosOliveiraMaster/SistemaMaster-Central/tree/main/extensao-master-wpp';

const WppEnviar = (function () {

  function limparDoisNomes(nome) {
    if (!nome) return '';
    const partes = String(nome).trim().split(/\s+/);
    return partes.length <= 2 ? nome.trim() : `${partes[0]} ${partes[1]}`;
  }

  function personalizarTexto(template, nome) {
    return (template || '').replace(/\[nome\]/gi, limparDoisNomes(nome));
  }

  function chromeDisponivel() {
    return typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function';
  }

  function extensaoDisponivel(timeoutMs = 2500) {
    return new Promise(resolve => {
      if (!chromeDisponivel()) { resolve(false); return; }
      const timer = setTimeout(() => resolve(false), timeoutMs);
      try {
        chrome.runtime.sendMessage(WPP_EXTENSION_ID, { ping: true }, () => {
          clearTimeout(timer);
          resolve(!chrome.runtime.lastError);
        });
      } catch (e) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  async function capturarImagemBlob(elemento) {
    if (typeof html2canvas === 'undefined') throw new Error('html2canvas não está carregado.');
    const canvas = await html2canvas(elemento, { backgroundColor: null, useCORS: true, scale: 2 });
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png');
    });
  }

  function copiarImagemParaClipboard(blob) {
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  // Envia o payload pela extensão e reporta progresso por contato via connectExternal.
  // Retorna o resumo final: [{ nome, telefone, status, detalhe }]
  function enviarViaExtensao(payload, onProgresso) {
    return new Promise((resolve, reject) => {
      let port;
      try {
        port = chrome.runtime.connectExternal(WPP_EXTENSION_ID);
      } catch (e) {
        reject(new Error('Não foi possível conectar à extensão.'));
        return;
      }
      port.onMessage.addListener(msg => {
        if (msg.tipo === 'PROGRESSO' && onProgresso) onProgresso(msg.resultado);
        else if (msg.tipo === 'CONCLUIDO') resolve(msg.resumo);
        else if (msg.tipo === 'ERRO') reject(new Error(msg.erro || 'Erro desconhecido da extensão.'));
      });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      });
      port.postMessage(payload);
    });
  }

  function fecharModal() {
    const overlay = document.getElementById('wpp-modal-overlay');
    if (overlay) overlay.remove();
  }

  function renderListaContatos(contatos, selecionados) {
    return contatos.map((c, i) => `
      <label class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 text-sm">
        <input type="checkbox" class="wpp-contato-chk w-4 h-4" data-idx="${i}" ${selecionados.has(i) ? 'checked' : ''}>
        <span class="flex-1 text-gray-800">${escapeHtmlWpp(c.nome)}</span>
        <span class="text-gray-400 text-xs">${escapeHtmlWpp(c.telefone)}</span>
      </label>
    `).join('');
  }

  function escapeHtmlWpp(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ─────────────────────────────────────────────────────────────
  // API pública
  // ─────────────────────────────────────────────────────────────
  // opts = { contatos: [{nome, telefone}], texto1Template, texto2Template, elementoParaCaptura }
  async function abrirEnvioWhatsApp(opts) {
    const { contatos, texto1Template = '', texto2Template = '', elementoParaCaptura } = opts || {};

    if (!contatos || !contatos.length) {
      if (typeof showToast === 'function') showToast('Nenhum contato elegível para envio.', 'error');
      return;
    }

    const disponivel = await extensaoDisponivel();
    if (!disponivel) {
      if (typeof showToast === 'function') {
        showToast('Extensão "Master WhatsApp App" não instalada ou não respondeu. Veja o README para instalar.', 'error', 8000);
      }
      window.open(WPP_INSTALL_HELP_URL, '_blank');
      return;
    }

    let imagemBlob = null;
    if (elementoParaCaptura) {
      try {
        imagemBlob = await capturarImagemBlob(elementoParaCaptura);
      } catch (err) {
        if (typeof showToast === 'function') showToast('Erro ao capturar imagem: ' + err.message, 'error');
        return;
      }
    }

    const selecionados = new Set(contatos.map((_, i) => i));
    const imagemUrl = imagemBlob ? URL.createObjectURL(imagemBlob) : null;

    const overlay = document.createElement('div');
    overlay.id = 'wpp-modal-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';
    overlay.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 class="text-lg font-lexend font-bold text-gray-800"><i class="fab fa-whatsapp text-green-500 mr-2"></i>Enviar mensagem para WhatsApp</h3>
          <button type="button" id="wpp-btn-fechar" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-lg"></i></button>
        </div>
        <div class="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          ${imagemUrl ? `
          <div>
            <label class="text-xs font-semibold text-gray-600 uppercase">Imagem</label>
            <img src="${imagemUrl}" class="mt-1 max-h-52 rounded-lg border border-gray-200 mx-auto">
          </div>` : ''}
          <div>
            <label class="text-xs font-semibold text-gray-600 uppercase">Texto 1</label>
            <textarea id="wpp-texto1" rows="3" class="w-full mt-1 border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">${escapeHtmlWpp(texto1Template)}</textarea>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-600 uppercase">Texto 2</label>
            <textarea id="wpp-texto2" rows="2" class="w-full mt-1 border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">${escapeHtmlWpp(texto2Template)}</textarea>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-600 uppercase">Contatos (${contatos.length})</label>
            <div id="wpp-lista-contatos" class="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              ${renderListaContatos(contatos, selecionados)}
            </div>
          </div>
          <div id="wpp-progresso" class="hidden space-y-1 text-sm"></div>
        </div>
        <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button type="button" id="wpp-btn-cancelar" class="btn-secondary px-4 py-2 text-sm">Cancelar</button>
          <button type="button" id="wpp-btn-enviar" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
            <i class="fab fa-whatsapp"></i>Enviar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fechar = () => { if (imagemUrl) URL.revokeObjectURL(imagemUrl); fecharModal(); };
    document.getElementById('wpp-btn-fechar').addEventListener('click', fechar);
    document.getElementById('wpp-btn-cancelar').addEventListener('click', fechar);

    overlay.querySelectorAll('.wpp-contato-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const idx = Number(chk.dataset.idx);
        if (chk.checked) selecionados.add(idx); else selecionados.delete(idx);
      });
    });

    document.getElementById('wpp-btn-enviar').addEventListener('click', async () => {
      const contatosSelecionados = contatos.filter((_, i) => selecionados.has(i));
      if (!contatosSelecionados.length) {
        if (typeof showToast === 'function') showToast('Selecione ao menos um contato.', 'error');
        return;
      }

      const texto1 = document.getElementById('wpp-texto1').value.trim();
      const texto2 = document.getElementById('wpp-texto2').value.trim();
      if (!texto1) {
        if (typeof showToast === 'function') showToast('Texto 1 não pode ficar vazio.', 'error');
        return;
      }

      const btnEnviar = document.getElementById('wpp-btn-enviar');
      const btnCancelar = document.getElementById('wpp-btn-cancelar');
      btnEnviar.disabled = true;
      btnCancelar.disabled = true;
      btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

      const progresso = document.getElementById('wpp-progresso');
      progresso.classList.remove('hidden');

      try {
        if (imagemBlob) await copiarImagemParaClipboard(imagemBlob);

        const payload = {
          contatos: contatosSelecionados,
          texto1,
          imagem: !!imagemBlob,
          texto2: texto2 || undefined,
        };

        const resumo = await enviarViaExtensao(payload, resultado => {
          const linha = document.createElement('div');
          const cor = resultado.status === 'enviado' ? 'text-green-600' : resultado.status === 'pulado' ? 'text-yellow-600' : 'text-red-600';
          const icone = resultado.status === 'enviado' ? 'fa-check-circle' : resultado.status === 'pulado' ? 'fa-forward' : 'fa-times-circle';
          linha.className = cor;
          linha.innerHTML = `<i class="fas ${icone} mr-1"></i>${escapeHtmlWpp(resultado.nome)} — ${resultado.status}${resultado.detalhe ? ' (' + escapeHtmlWpp(resultado.detalhe) + ')' : ''}`;
          progresso.appendChild(linha);
        });

        const enviados = resumo.filter(r => r.status === 'enviado').length;
        if (typeof showToast === 'function') {
          showToast(`Envio concluído: ${enviados}/${resumo.length} enviado(s).`, enviados === resumo.length ? 'success' : 'info', 8000);
        }
        btnEnviar.innerHTML = 'Concluído';
      } catch (err) {
        if (typeof showToast === 'function') showToast('Erro no envio: ' + err.message, 'error');
        btnEnviar.disabled = false;
        btnCancelar.disabled = false;
        btnEnviar.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar';
      }
    });
  }

  return { abrirEnvioWhatsApp, personalizarTexto, limparDoisNomes };
})();

window.abrirEnvioWhatsApp = WppEnviar.abrirEnvioWhatsApp;

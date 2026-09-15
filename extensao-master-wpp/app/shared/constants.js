// Constantes compartilhadas entre background.js e content.js — carregadas via
// importScripts (background, contexto de service worker) e <script> (content script).

const MASTER_WPP_CONSTANTS = {
  // Origem única autorizada a chamar a extensão (deve bater com externally_connectable no manifest.json)
  
  //restaurar após os testes:
  // ORIGEM_PERMITIDA: 'https://master-ecossistemaprofessor.web.app',

  // Versão apenas para testes
  ORIGEM_PERMITIDA: 'http://localhost:8123',

  // Delay aleatório entre ações (digitar, enviar, trocar de contato) — evita padrão robótico
  DELAY_MIN_MS: 1000,
  DELAY_MAX_MS: 3000,

  // Telefone BR: DDI (55, opcional) + DDD (2) + número (8 ou 9 dígitos) => 10 a 13 dígitos
  REGEX_TELEFONE: /^\d{10,13}$/,

  // Limites de tamanho de texto por mensagem
  TEXTO_MAX_LEN: 4096,

  // Limite de contatos por payload (proteção contra payload malformado/abusivo; sem limite de negócio fixo)
  CONTATOS_MAX: 200,

  // Imagem enviada como data URL base64 dentro do próprio payload (o Central já a lê e
  // codifica antes de chamar a extensão — evita a extensão precisar ler o clipboard, que
  // exige a aba em foco e conflita com ela rodar em segundo plano).
  REGEX_IMAGEM_DATA_URL: /^data:image\/(png|jpe?g|gif|webp);base64,/i,
  IMAGEM_MAX_LEN: 8 * 1024 * 1024, // ~8M caracteres de data URL (~6MB de imagem)
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MASTER_WPP_CONSTANTS;
} else if (typeof self !== 'undefined') {
  self.MASTER_WPP_CONSTANTS = MASTER_WPP_CONSTANTS;
}

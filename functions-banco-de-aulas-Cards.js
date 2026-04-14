console.log('✅ functions-banco-de-aulas-Cards.js carregado');

// Objeto global para expor as funções
const BancoDeAulasCards = (function() {
  // Variáveis privadas
  let aulasData = [];
  let currentFilters = {};
  
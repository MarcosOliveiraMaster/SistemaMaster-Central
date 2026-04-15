console.log('✅ functions-banco-de-aulas-Cards.js carregado');

// Objeto global para expor as funções
const BancoDeAulasCards = (function() {
  // Variáveis privadas
  let aulasData = [];
  let currentFilters = {};
  
  // Função para renderizar cards de aulas
  function renderAulasCards(aulas, filters = {}) {
    console.log('🎴 Renderizando cards:', aulas.length);
// functions-pagamento.js — Área Pagamento

function loadAreaPagamento() {
  const section = document.getElementById('area-pagamento');
  if (!section) return;

  section.innerHTML = `
    <div class="text-center py-8">
      <i class="fas fa-credit-card text-3xl text-gray-300 mb-3"></i>
      <h3 class="font-lexend text-lg mb-2">Área Pagamento</h3>
      <p class="text-gray-600 text-sm">Esta seção está em desenvolvimento.</p>
    </div>
  `;
}

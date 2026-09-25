// registro-aula.js
// "Ver registro da aula": mostra a foto que o professor enviou junto com o
// relatório, pelo portal (SistemMaster-Login).
//
// A foto fica em registrosAula/{id}, com o MESMO id do documento da aula em
// BancoDeAulas-Lista, como um data URL JPEG que o navegador do professor gerou
// redesenhando a imagem (sem metadados nem conteúdo que não seja pixel). Aqui
// ela só é exibida como <img>: nada do conteúdo é interpretado como HTML.

(function () {
  const PREFIXO_JPEG = 'data:image/jpeg;base64,';

  function fotoValida(valor) {
    return typeof valor === 'string'
      && valor.startsWith(PREFIXO_JPEG)
      && /^[A-Za-z0-9+/]+={0,2}$/.test(valor.slice(PREFIXO_JPEG.length));
  }

  // Aceita o id do documento em BancoDeAulas-Lista (Painel Central) ou o
  // "id-Aula" (modal Detalhes da contratação, que lê o array aulas[]).
  async function resolverIdLista({ listaDocId, idAula }) {
    if (listaDocId) return listaDocId;
    if (!idAula) return null;
    const snap = await firebase.firestore().collection('BancoDeAulas-Lista')
      .where('id-Aula', '==', idAula).limit(1).get();
    return snap.empty ? null : snap.docs[0].id;
  }

  function abrirVisualizador() {
    document.getElementById('registro-aula-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'registro-aula-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.75);display:flex;'
      + 'align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:900px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;border-bottom:1px solid #e5e7eb;">
          <h3 class="font-lexend font-bold text-lg text-gray-800"><i class="fas fa-camera text-orange-500 mr-2"></i>Registro da aula</h3>
          <button type="button" data-fechar class="text-gray-400 hover:text-gray-600" aria-label="Fechar"><i class="fas fa-times"></i></button>
        </div>
        <div data-corpo style="padding:1rem;overflow:auto;display:flex;align-items:center;justify-content:center;min-height:200px;">
          <div class="text-center text-gray-500"><i class="fas fa-spinner fa-spin text-orange-500 text-2xl mb-2"></i><p>Carregando foto...</p></div>
        </div>
      </div>`;
    const fechar = () => { ov.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-fechar]')) fechar(); });
    document.addEventListener('keydown', esc, true);
    document.body.appendChild(ov);
    return ov.querySelector('[data-corpo]');
  }

  function mensagem(corpo, icone, texto) {
    corpo.innerHTML = `<div class="text-center text-gray-500"><i class="fas ${icone} text-3xl mb-2"></i><p></p></div>`;
    corpo.querySelector('p').textContent = texto;
  }

  window.verRegistroAula = async function ({ listaDocId, idAula } = {}) {
    const corpo = abrirVisualizador();
    try {
      const id = await resolverIdLista({ listaDocId, idAula });
      if (!id) { mensagem(corpo, 'fa-circle-question', 'Aula não encontrada.'); return; }

      const doc = await firebase.firestore().collection('registrosAula').doc(id).get();
      const foto = doc.exists ? doc.data().foto : null;
      if (!fotoValida(foto)) {
        mensagem(corpo, 'fa-image', 'O professor ainda não enviou foto para esta aula.');
        return;
      }

      const img = document.createElement('img');
      img.alt = 'Registro da aula';
      img.src = foto;
      img.style.cssText = 'display:block;max-width:100%;max-height:78vh;object-fit:contain;border-radius:10px;';
      corpo.innerHTML = '';
      corpo.appendChild(img);
    } catch (err) {
      console.error('[Registro da aula] Erro ao carregar foto:', err);
      mensagem(corpo, 'fa-exclamation-triangle', 'Não foi possível carregar a foto. Tente novamente.');
    }
  };
})();

/**
 * PROJETO: Gerador de Contratos PDF para Professores
 * Versão: 1.0 - Baseado em functions-contrato.js
 * Template: baseContratoProfessorContratacao.txt
 */

// 1. Configurações de Estilo (mesmo padrão do contrato de cliente)
const CONFIG_ABNT_PROFESSOR = {
  fonte: {
    nome: 'times',
    tamanhoBase: 12,
    linhaAltura: 14, 
  },
  margens: {
    esquerda: 70.87, // 2.5cm
    direita: 56.70,  // 2.0cm
    topo: 56.70,     // 2.0cm
    base: 56.70,     // 2.0cm
  },
  estilos: {
    h1: { tamanho: 24, negrito: true, espacamentoAntes: 20, espacamentoDepois: 10 },
    h2: { tamanho: 18, negrito: true, espacamentoAntes: 15, espacamentoDepois: 8 },
    h3: { tamanho: 14, negrito: true, espacamentoAntes: 12, espacamentoDepois: 6 },
  }
};

/**
 * 2. Processamento de Texto e Markdown Customizado
 */
function processarContratoParaPDFProfessor(contratoTexto) {
  const linhas = contratoTexto.split(/\r?\n/);
  const elementos = [];
  
  const padroes = {
    titulo1: /^#\s+(.+)/,
    titulo2: /^##\s+(.+)/,
    titulo3: /^###\s+(.+)/,
    linhaVazia: /^\s*$/
  };
  
  linhas.forEach(linhaRaw => {
    const linha = linhaRaw.trim();
    if (padroes.linhaVazia.test(linha)) {
      elementos.push({ tipo: 'espaco' });
    } else if (padroes.titulo1.test(linha)) {
      elementos.push({ tipo: 'titulo1', conteudo: linha.match(padroes.titulo1)[1], estilo: CONFIG_ABNT_PROFESSOR.estilos.h1 });
    } else if (padroes.titulo2.test(linha)) {
      elementos.push({ tipo: 'titulo2', conteudo: linha.match(padroes.titulo2)[1], estilo: CONFIG_ABNT_PROFESSOR.estilos.h2 });
    } else if (padroes.titulo3.test(linha)) {
      elementos.push({ tipo: 'titulo3', conteudo: linha.match(padroes.titulo3)[1], estilo: CONFIG_ABNT_PROFESSOR.estilos.h3 });
    } else if (linha.includes('[imagemAssinatura]')) {
      // Verificar imagem ANTES do padrão centralizado
      elementos.push({ tipo: 'imagemAssinatura' });
    } else if (/^-.*-$/.test(linha) && linha.length > 2) {
      elementos.push({ tipo: 'centralizado', conteudo: linha.slice(1, -1).trim() });
    } else {
      elementos.push({
        tipo: 'paragrafo',
        conteudo: aplicarTagsNegritoProfessor(linha)
      });
    }
  });
  return elementos;
}

/**
 * Transforma *texto* e -texto- em marcações internas
 */
function aplicarTagsNegritoProfessor(texto) {
  let resultado = texto;
  // a) Negrito com asteriscos *exemplo*
  resultado = resultado.replace(/\*([^*]+)\*/g, '{{B}}$1{{/B}}');
  // b) Negrito com hífens -exemplo-
  resultado = resultado.replace(/-([^-]+)-/g, '{{B}}$1{{/B}}');
  // Itálico opcional _exemplo_
  resultado = resultado.replace(/_([^_]+)_/g, '{{I}}$1{{/I}}');
  return resultado;
}

/**
 * 3. Renderização Especial de Parágrafos (Suporta estilos mistos)
 */
function renderizarParagrafoFormatadoProfessor(doc, elemento, x, y, larguraMax) {
  const partes = elemento.conteudo.split(/({{.*?}})/g);
  let xAtual = x;
  let yAtual = y;
  const { fonte } = CONFIG_ABNT_PROFESSOR;

  doc.setFont(fonte.nome, 'normal');
  doc.setFontSize(fonte.tamanhoBase);

  // Junta todas as partes em uma string sem tags para justificar corretamente
  let textoPlano = '';
  let tags = [];
  partes.forEach(parte => {
    if (parte.startsWith('{{') && parte.endsWith('}}')) {
      tags.push({ pos: textoPlano.length, tag: parte });
    } else {
      textoPlano += parte;
    }
  });

  // Divide o texto em linhas para justificar
  const linhas = [];
  let linhaAtual = '';
  textoPlano.split(' ').forEach(palavra => {
    const testeLinha = linhaAtual ? linhaAtual + ' ' + palavra : palavra;
    if (doc.getTextWidth(testeLinha) > larguraMax && linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = testeLinha;
    }
  });
  if (linhaAtual) linhas.push(linhaAtual);

  // Renderiza cada linha justificada
  linhas.forEach((linha, idx) => {
    let palavras = linha.split(' ');
    let numEspacos = palavras.length - 1;
    let larguraLinha = doc.getTextWidth(linha);
    let espacoExtra = numEspacos > 0 && idx !== linhas.length - 1 ? (larguraMax - larguraLinha) / numEspacos : 0;
    let xLinha = x;
    for (let i = 0; i < palavras.length; i++) {
      let palavra = palavras[i];
      doc.text(palavra, xLinha, yAtual);
      xLinha += doc.getTextWidth(palavra + ' ');
      if (espacoExtra && i < palavras.length - 1) xLinha += espacoExtra;
    }
    yAtual += fonte.linhaAltura;
  });

  return yAtual;
}

/**
 * 4. Função para inserir a imagem da assinatura centralizada
 */
async function inserirImagemAssinaturaProfessor(doc, yAtual, margens, fonte) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = function() {
      const larguraPagina = doc.internal.pageSize.width;
      const larguraImg = 180;
      const proporcao = img.naturalHeight / img.naturalWidth;
      const alturaImg = larguraImg * proporcao;
      const x = (larguraPagina - larguraImg) / 2;
      doc.addImage(img, 'PNG', x, yAtual, larguraImg, alturaImg);
      resolve(yAtual + alturaImg + 5);
    };
    img.onerror = function() {
      resolve(yAtual + fonte.linhaAltura);
    };
    img.src = 'img/assinatura.png';
  });
}

/**
 * 5. Função Principal de Geração de um único PDF de professor
 */
async function gerarPDFContratoProfessor(contratoTexto, professor) {
  // Substituir [DataHoje] pela data atual no formato dd/mm/yyyy
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  const dataFormatada = `${dia}/${mes}/${ano}`;
  
  let contratoProcessado = contratoTexto.replace(/\[DataHoje\]/g, dataFormatada);
  
  // Substituir variáveis do professor (case insensitive para cpf)
  if (professor.nome) {
    contratoProcessado = contratoProcessado.replace(/\[NomeProfessor\]/gi, professor.nome);
  }
  if (professor.cpf) {
    contratoProcessado = contratoProcessado.replace(/\[\s*cpfProfessor\s*\]/gi, professor.cpf);
    contratoProcessado = contratoProcessado.replace(/\[\s*CPFProfessor\s*\]/gi, professor.cpf);
  }
  if (professor.endereco) {
    contratoProcessado = contratoProcessado.replace(/\[\s*enderecoProfessor\s*\]/gi, professor.endereco);
  }

  const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const { margens, fonte } = CONFIG_ABNT_PROFESSOR;
  const larguraUtil = doc.internal.pageSize.width - margens.esquerda - margens.direita;
  let yAtual = margens.topo;

  const elementos = processarContratoParaPDFProfessor(contratoProcessado);

  for (const elemento of elementos) {
    // Verificação de quebra de página
    if (yAtual > doc.internal.pageSize.height - margens.base) {
      doc.addPage();
      yAtual = margens.topo;
    }

    if (elemento.tipo === 'espaco') {
      yAtual += fonte.linhaAltura;
    } else if (elemento.tipo.startsWith('titulo')) {
      doc.setFont(fonte.nome, 'bold');
      doc.setFontSize(elemento.estilo.tamanho);
      yAtual += elemento.estilo.espacamentoAntes;

      const linhasTitulo = doc.splitTextToSize(elemento.conteudo, larguraUtil);
      doc.text(linhasTitulo, margens.esquerda, yAtual);
      yAtual += (linhasTitulo.length * (elemento.estilo.tamanho * 1.2)) + elemento.estilo.espacamentoDepois;
    } else if (elemento.tipo === 'centralizado') {
      doc.setFont(CONFIG_ABNT_PROFESSOR.fonte.nome, 'normal');
      doc.setFontSize(CONFIG_ABNT_PROFESSOR.fonte.tamanhoBase);
      doc.text(elemento.conteudo, doc.internal.pageSize.width / 2, yAtual, { align: 'center' });
      yAtual += CONFIG_ABNT_PROFESSOR.fonte.linhaAltura;
    } else if (elemento.tipo === 'imagemAssinatura') {
      yAtual = await inserirImagemAssinaturaProfessor(doc, yAtual, margens, fonte);
    } else if (elemento.tipo === 'paragrafo') {
      yAtual = renderizarParagrafoFormatadoProfessor(doc, elemento, margens.esquerda, yAtual, larguraUtil);
      yAtual += 5;
    }
  }

  // Retorna o doc para salvar depois
  return doc;
}

/**
 * 6. Função para gerar contratos em lote para professores selecionados
 * @param {Array} professoresSelecionados - Array de objetos {id, nome, cpf, endereco}
 */
window.gerarContratosVinculoProfessores = async function(professoresSelecionados) {
  if (!professoresSelecionados || professoresSelecionados.length === 0) {
    alert('Nenhum professor selecionado.');
    return;
  }

  // Criar overlay de loading
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loading-contratos-professor';
  loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  `;
  loadingOverlay.innerHTML = `
    <div style="
      background: white;
      padding: 40px 60px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      text-align: center;
      font-family: 'Lexend', sans-serif;
    ">
      <div style="font-size: 3rem; margin-bottom: 20px;">📄</div>
      <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 1.3rem;">Gerando Contratos</h2>
      <p id="loading-progress-text" style="margin: 0; color: #4b5563; font-size: 1rem;">
        Preparando...
      </p>
      <div style="
        margin-top: 20px;
        width: 300px;
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
      ">
        <div id="loading-progress-bar" style="
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #f28705, #16a34a);
          border-radius: 4px;
          transition: width 0.3s ease;
        "></div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingOverlay);

  const progressText = document.getElementById('loading-progress-text');
  const progressBar = document.getElementById('loading-progress-bar');

  try {
    // Carregar o template do contrato
    const response = await fetch('baseContratoProfessorContratacao.txt');
    if (!response.ok) throw new Error('Arquivo baseContratoProfessorContratacao.txt não encontrado.');
    const templateContrato = await response.text();

    const total = professoresSelecionados.length;

    for (let i = 0; i < total; i++) {
      const professor = professoresSelecionados[i];
      const numeroAtual = i + 1;
      
      // Atualizar progresso - Gerando
      progressText.textContent = `Gerando contrato ${numeroAtual} de ${total}...`;
      progressBar.style.width = `${((numeroAtual - 0.5) / total) * 100}%`;

      // Pequeno delay para UI atualizar
      await new Promise(resolve => setTimeout(resolve, 100));

      // Gerar PDF
      const doc = await gerarPDFContratoProfessor(templateContrato, professor);
      
      // Atualizar progresso - Baixando
      progressText.textContent = `Baixando contrato ${numeroAtual} de ${total}...`;
      progressBar.style.width = `${(numeroAtual / total) * 100}%`;
      
      // Salvar PDF
      const nomeArquivo = `Contrato Professor Master - ${professor.nome || 'Professor'}.pdf`;
      doc.save(nomeArquivo);

      // Aguardar download ser iniciado antes de passar para o próximo
      // Delay maior para garantir que o navegador processou o download
      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Sucesso
    progressText.textContent = `✅ ${total} contrato(s) gerado(s) com sucesso!`;
    progressBar.style.width = '100%';
    progressBar.style.background = '#16a34a';

    // Fechar após 2 segundos
    setTimeout(() => {
      document.body.removeChild(loadingOverlay);
    }, 2000);

  } catch (error) {
    console.error('Erro ao gerar contratos:', error);
    progressText.innerHTML = `<span style="color: #dc2626;">❌ Erro: ${error.message}</span>`;
    
    // Botão para fechar em caso de erro
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.style.cssText = `
      margin-top: 20px;
      padding: 10px 30px;
      border: none;
      background: #dc2626;
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.9rem;
    `;
    closeBtn.onclick = () => document.body.removeChild(loadingOverlay);
    loadingOverlay.querySelector('div').appendChild(closeBtn);
  }
};

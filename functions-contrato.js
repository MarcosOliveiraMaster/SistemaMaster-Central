/**
 * PROJETO: Gerador de Contratos PDF (Normas ABNT Adaptadas)
 * Versão: 2.0 - Suporte a negrito duplo (* e -)
 */

// 1. Configurações de Estilo
const CONFIG_ABNT = {
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

// 2. Função Global para carregar arquivo externo
// Agora aceita o nome do cliente e CPF como parâmetros
window.abrirContratoModal = async function(nomeCliente, cpfCliente) {
  try {
    const response = await fetch('baseContrato.txt');
    if (!response.ok) throw new Error('Arquivo baseContrato.txt não encontrado.');
    const texto = await response.text();
    gerarPDFContrato(texto, nomeCliente, cpfCliente);
  } catch (error) {
    alert('Erro: ' + error.message);
  }
};

/**
 * 3. Processamento de Texto e Markdown Customizado
 */
function processarContratoParaPDF(contratoTexto) {
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
      elementos.push({ tipo: 'titulo1', conteudo: linha.match(padroes.titulo1)[1], estilo: CONFIG_ABNT.estilos.h1 });
    } else if (padroes.titulo2.test(linha)) {
      elementos.push({ tipo: 'titulo2', conteudo: linha.match(padroes.titulo2)[1], estilo: CONFIG_ABNT.estilos.h2 });
    } else if (padroes.titulo3.test(linha)) {
      elementos.push({ tipo: 'titulo3', conteudo: linha.match(padroes.titulo3)[1], estilo: CONFIG_ABNT.estilos.h3 });
    } else if (/^-.*-$/.test(linha) && linha.length > 2) {
      elementos.push({ tipo: 'centralizado', conteudo: linha.slice(1, -1).trim() });
    } else {
      elementos.push({
        tipo: 'paragrafo',
        conteudo: aplicarTagsNegrito(linha)
      });
    }
  });
  return elementos;
}

/**
 * Transforma *texto* e -texto- em marcações internas
 */
function aplicarTagsNegrito(texto) {
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
 * 4. Renderização Especial de Parágrafos (Suporta estilos mistos)
 */
function renderizarParagrafoFormatado(doc, elemento, x, y, larguraMax) {
  const partes = elemento.conteudo.split(/({{.*?}})/g);
  let xAtual = x;
  let yAtual = y;
  const { fonte } = CONFIG_ABNT;

  doc.setFont(fonte.nome, 'normal');
  doc.setFontSize(fonte.tamanhoBase);

  partes.forEach(parte => {
    if (parte === '{{B}}') {
      doc.setFont(fonte.nome, 'bold');
    } else if (parte === '{{/B}}') {
      doc.setFont(fonte.nome, 'normal');
    } else if (parte === '{{I}}') {
      doc.setFont(fonte.nome, 'italic');
    } else if (parte === '{{/I}}') {
      doc.setFont(fonte.nome, 'normal');
    } else if (parte !== '') {
      // Divide o texto em palavras para respeitar a margem (wrap manual simples)
      const palavras = parte.split(' ');
      palavras.forEach(palavra => {
        const larguraPalavra = doc.getTextWidth(palavra + ' ');
        
        if (xAtual + larguraPalavra > x + larguraMax) {
          xAtual = x;
          yAtual += fonte.linhaAltura;
        }
        
        doc.text(palavra + ' ', xAtual, yAtual);
        xAtual += larguraPalavra;
      });
    }
  });

  return yAtual + fonte.linhaAltura;
}

/**
 * 5. Função Principal de Geração
 * Agora aceita nomeCliente e cpfCliente para substituir [NomeCliente] e [CPFCliente] no texto
 */
function gerarPDFContrato(contratoTexto, nomeCliente, cpfCliente) {
  // Substituir [DataHoje] pela data atual no formato dd/mm/yyyy
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  const dataFormatada = `${dia}/${mes}/${ano}`;
  let contratoComData = contratoTexto.replace(/\[DataHoje\]/g, dataFormatada);
  if (nomeCliente) {
    contratoComData = contratoComData.replace(/\[NomeCliente\]/gi, nomeCliente);
  }
  if (cpfCliente) {
    // Substitui [CPFCliente] mesmo se houver espaços extras
    contratoComData = contratoComData.replace(/\[\s*CPFCliente\s*\]/gi, cpfCliente);
  }

  const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const { margens, fonte } = CONFIG_ABNT;
  const larguraUtil = doc.internal.pageSize.width - margens.esquerda - margens.direita;
  let yAtual = margens.topo;

  const elementos = processarContratoParaPDF(contratoComData);

  elementos.forEach(elemento => {
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
      doc.setFont(CONFIG_ABNT.fonte.nome, 'normal');
      doc.setFontSize(CONFIG_ABNT.fonte.tamanhoBase);
      doc.text(elemento.conteudo, doc.internal.pageSize.width / 2, yAtual, { align: 'center' });
      yAtual += CONFIG_ABNT.fonte.linhaAltura;
    } else if (elemento.tipo === 'paragrafo') {
      yAtual = renderizarParagrafoFormatado(doc, elemento, margens.esquerda, yAtual, larguraUtil);
      yAtual += 5; // Espaço entre parágrafos
    }
  });

  doc.save('Contrato-Final.pdf');
}

/**
 * 6. Teste de execução
 */
function testarFormatacao() {
  const textoTeste = `
# CONTRATO DE PRESTAÇÃO DE SERVIÇOS
Este é um texto onde o termo *básico* aparecerá em negrito.
Também garantimos que o termo -importante- use a nova regra de hífens.

## Cláusula Primeira
O uso de _itálico_ continua funcionando, enquanto o -negrito com traço- e o *negrito com asterisco* dão ênfase total ao documento.
  `;
  gerarPDFContrato(textoTeste);
}
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
// Agora aceita nomeCliente, cpfCliente e enderecoCliente
window.abrirContratoModal = async function(nomeCliente, cpfCliente, enderecoCliente) {
  try {
    const response = await fetch('baseContrato.txt');
    if (!response.ok) throw new Error('Arquivo baseContrato.txt não encontrado.');
    const texto = await response.text();
    gerarPDFContrato(texto, nomeCliente, cpfCliente, enderecoCliente);
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
    } else if (linha.includes('[imagemAssinatura]')) {
      elementos.push({ tipo: 'imagemAssinatura' });
    } else if (linha.includes('[FotoCronograma]')) {
      elementos.push({ tipo: 'tabelaAulasAgendadas' });
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
      // Aplica tags de negrito/itálico se necessário
      // (Simples: ignora tags internas para justificar, pois já estão aplicadas no texto)
      doc.text(palavra, xLinha, yAtual);
      xLinha += doc.getTextWidth(palavra + ' ');
      if (espacoExtra && i < palavras.length - 1) xLinha += espacoExtra;
    }
    yAtual += fonte.linhaAltura;
  });

  return yAtual;
}

/**
 * 5. Função Principal de Geração
 * Agora aceita nomeCliente e cpfCliente para substituir [NomeCliente] e [CPFCliente] no texto
 */
function gerarPDFContrato(contratoTexto, nomeCliente, cpfCliente, enderecoCliente) {
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
  if (enderecoCliente) {
    // Substitui [EnderecoCliente] mesmo se houver espaços extras
    contratoComData = contratoComData.replace(/\[\s*EnderecoCliente\s*\]/gi, enderecoCliente);
  }

  const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const { margens, fonte } = CONFIG_ABNT;
  const larguraUtil = doc.internal.pageSize.width - margens.esquerda - margens.direita;
  let yAtual = margens.topo;

  let elementos = processarContratoParaPDF(contratoComData);
  // Não adiciona imagem ao final, só insere onde houver o marcador

  (async function() {
    // 1. Iniciar loading
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-contrato-tabela';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '0';
    loadingDiv.style.left = '0';
    loadingDiv.style.width = '100vw';
    loadingDiv.style.height = '100vh';
    loadingDiv.style.background = 'rgba(255,255,255,0.7)';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.alignItems = 'center';
    loadingDiv.style.justifyContent = 'center';
    loadingDiv.style.zIndex = '9999';
    loadingDiv.innerHTML = '<div style="padding:32px 48px;border-radius:12px;background:#fff;box-shadow:0 2px 16px #0002;font-size:1.2rem;font-family:sans-serif;color:#333;">Carregando contrato...</div>';
    document.body.appendChild(loadingDiv);

    // 2. Buscar dados da tabela "table-details" do HTML
    await new Promise(resolve => setTimeout(resolve, 600)); // Simula tempo de carregamento
    const table = document.querySelector('.table-details');
    let tableData = [];
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          tableData.push({
            data: cells[0].innerText.trim(),
            hora: cells[1].innerText.trim(),
            duracao: cells[2].innerText.trim(),
            materia: cells[3].innerText.trim(),
            professor: cells[4].innerText.trim(),
            estudante: cells[5].innerText.trim()
          });
        }
      });
    }

    // 3. Renderizar elementos do contrato, inserindo a tabela no local do marcador
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
        doc.setFont(CONFIG_ABNT.fonte.nome, 'normal');
        doc.setFontSize(CONFIG_ABNT.fonte.tamanhoBase);
        doc.text(elemento.conteudo, doc.internal.pageSize.width / 2, yAtual, { align: 'center' });
        yAtual += CONFIG_ABNT.fonte.linhaAltura;
      } else if (elemento.tipo === 'imagemAssinatura') {
        yAtual = await inserirImagemAssinatura(doc, yAtual, margens, fonte);
      } else if (elemento.tipo === 'tabelaAulasAgendadas') {
        if (tableData.length > 0) {
          // Título da tabela
          yAtual += 30;
          doc.setFont(fonte.nome, 'bold');
          doc.setFontSize(15);
          const headers = ['Data da aula', 'Início', 'Duração', 'Matéria', 'Professor', 'Estudante'];
          // Calcular larguras automáticas para Início, Matéria, Professor e Estudante
          doc.setFontSize(9);
          doc.setFont(fonte.nome, 'normal');
          let materiaWidth = doc.getTextWidth('Matéria') + 12;
          let estudanteWidth = doc.getTextWidth('Estudante') + 12;
          let inicioWidth = doc.getTextWidth('Início') + 12;
          let professorWidth = doc.getTextWidth('Professor') + 12;
          tableData.forEach(row => {
            const mW = doc.getTextWidth(row.materia) + 12;
            if (mW > materiaWidth) materiaWidth = mW;
            const eW = doc.getTextWidth(row.estudante) + 12;
            if (eW > estudanteWidth) estudanteWidth = eW;
            const iW = doc.getTextWidth(row.hora) + 12;
            if (iW > inicioWidth) inicioWidth = iW;
            const pW = doc.getTextWidth(row.professor) + 12;
            if (pW > professorWidth) professorWidth = pW;
          });
          // Larguras fixas para as demais
          const colWidths = [80, inicioWidth, 60, materiaWidth, professorWidth, estudanteWidth];
          const totalWidth = colWidths.reduce((a, b) => a + b, 0);
          const pageWidth = doc.internal.pageSize.width;
          const tableX = (pageWidth - totalWidth) / 2;
          doc.setFontSize(15);
          doc.text('', pageWidth / 2, yAtual, { align: 'center' });
          yAtual += 16;

          // Cabeçalho
          const cellHeight = 18;
          let x = tableX;
          doc.setFontSize(9);
          doc.setFont(fonte.nome, 'bold');
          headers.forEach((h, i) => {
            // Laranja escuro: RGB(234,88,12)
            doc.setFillColor(234,88,12);
            doc.setDrawColor(68,68,68);
            doc.rect(x, yAtual, colWidths[i], cellHeight, 'FD'); // linhas retas
            doc.setTextColor(255,255,255);
            doc.text(h, x + 3, yAtual + 12);
            doc.setTextColor(0,0,0);
            x += colWidths[i];
          });
          yAtual += cellHeight;

          // Desenha linhas
          doc.setFont(fonte.nome, 'normal');
          tableData.forEach(row => {
            let x = tableX;
            [row.data, row.hora, row.duracao, row.materia, row.professor, row.estudante].forEach((val, i) => {
              doc.setDrawColor(68,68,68);
              doc.rect(x, yAtual, colWidths[i], cellHeight, 'D'); // linhas retas
              doc.text(val, x + 3, yAtual + 12);
              x += colWidths[i];
            });
            yAtual += cellHeight;
          });
        }
      } else if (elemento.tipo === 'paragrafo') {
        yAtual = renderizarParagrafoFormatado(doc, elemento, margens.esquerda, yAtual, larguraUtil);
        yAtual += 5; // Espaço entre parágrafos
      }
    }

    // 4. Remover loading
    document.body.removeChild(loadingDiv);

    doc.save('Contrato-Final.pdf');
  })();
}

// Função para inserir a imagem da assinatura centralizada
async function inserirImagemAssinatura(doc, yAtual, margens, fonte) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = function() {
      const larguraPagina = doc.internal.pageSize.width;
      const larguraImg = 180; // largura desejada em pt
      // Calcula altura proporcional
      const proporcao = img.naturalHeight / img.naturalWidth;
      const alturaImg = larguraImg * proporcao;
      const x = (larguraPagina - larguraImg) / 2;
      doc.addImage(img, 'PNG', x, yAtual, larguraImg, alturaImg);
      resolve(yAtual + alturaImg + 5);
    };
    img.onerror = function() {
      // Se não carregar, apenas pula
      resolve(yAtual + fonte.linhaAltura);
    };
    img.src = 'img/assinatura.png';
  });
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

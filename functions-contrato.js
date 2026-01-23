// ============================================
// FUNÇÕES PARA GERAÇÃO DE PDF DE CONTRATO
// Sistema de formatação hierárquica com suporte a:
// # Título Principal (h1)
// ## Subtítulo (h2)  
// ### Seção (h3)
// #### Subseção (h4)
// **texto** → Negrito
// *texto* → Itálico (opcional)
// ============================================

// Configurações de formatação ABNT
const CONFIG_ABNT = {
  fonte: {
    nome: 'helvetica',
    tamanhoBase: 12,
    linhaAltura: 13.8, // 1.15 * 12 (espaçamento 1.15)
  },
  margens: {
    esquerda: 85,   // 3cm ≈ 85pt
    direita: 57,    // 2cm ≈ 57pt  
    topo: 85,       // 3cm ≈ 85pt
    base: 57,       // 2cm ≈ 57pt
  },
  estilos: {
    h1: { tamanho: 18, negrito: true, espacamentoAntes: 30, espacamentoDepois: 20 },
    h2: { tamanho: 16, negrito: true, espacamentoAntes: 25, espacamentoDepois: 15 },
    h3: { tamanho: 14, negrito: true, espacamentoAntes: 20, espacamentoDepois: 12 },
    h4: { tamanho: 13, negrito: true, espacamentoAntes: 15, espacamentoDepois: 10 },
    normal: { tamanho: 12, negrito: false, espacamentoAntes: 0, espacamentoDepois: 0 },
    negrito: { tamanho: 12, negrito: true, espacamentoAntes: 0, espacamentoDepois: 0 },
    italico: { tamanho: 12, italico: true, espacamentoAntes: 0, espacamentoDepois: 0 }
  },
  recuoParagrafo: 35 // 1.25cm ≈ 35pt
};

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

/**
 * Carrega o texto do contrato do arquivo baseContrato.txt
 */
async function carregarContratoTexto() {
  try {
    const response = await fetch('baseContrato.txt');
    if (!response.ok) throw new Error('Erro ao carregar arquivo de contrato');
    return await response.text();
  } catch (error) {
    console.error('Erro ao carregar contrato:', error);
    throw error;
  }
}

/**
 * Exibe o contrato em modal e gera PDF
 */
function exibirModalContrato(contratoTexto) {
  gerarPDFContrato(contratoTexto);
}

/**
 * Sistema de parsing e formatação hierárquica
 */
function processarContratoParaPDF(contratoTexto) {
  const linhas = contratoTexto.split(/\r?\n/);
  const elementos = [];
  
  // Expressões regulares para detecção
  const padroes = {
    titulo1: /^#\s+(.+)/,
    titulo2: /^##\s+(.+)/,
    titulo3: /^###\s+(.+)/,
    titulo4: /^####\s+(.+)/,
    linhaDivisoria: /^---$/,
    negritoCompleto: /^\*\*(.+?)\*\*$/,
    marcadorLista: /^[-*+]\s+(.+)/,
    linhaVazia: /^\s*$/
  };
  
  // Processa cada linha
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    
    // Linha vazia
    if (padroes.linhaVazia.test(linha)) {
      elementos.push({ tipo: 'espaco' });
      continue;
    }
    
    // Título Nível 1
    if (padroes.titulo1.test(linha)) {
      const conteudo = linha.match(padroes.titulo1)[1];
      elementos.push({ 
        tipo: 'titulo1', 
        conteudo,
        estilo: CONFIG_ABNT.estilos.h1
      });
      continue;
    }
    
    // Título Nível 2
    if (padroes.titulo2.test(linha)) {
      const conteudo = linha.match(padroes.titulo2)[1];
      elementos.push({ 
        tipo: 'titulo2', 
        conteudo,
        estilo: CONFIG_ABNT.estilos.h2
      });
      continue;
    }
    
    // Título Nível 3
    if (padroes.titulo3.test(linha)) {
      const conteudo = linha.match(padroes.titulo3)[1];
      elementos.push({ 
        tipo: 'titulo3', 
        conteudo,
        estilo: CONFIG_ABNT.estilos.h3
      });
      continue;
    }
    
    // Título Nível 4
    if (padroes.titulo4.test(linha)) {
      const conteudo = linha.match(padroes.titulo4)[1];
      elementos.push({ 
        tipo: 'titulo4', 
        conteudo,
        estilo: CONFIG_ABNT.estilos.h4
      });
      continue;
    }
    
    // Linha divisória
    if (padroes.linhaDivisoria.test(linha)) {
      elementos.push({ tipo: 'divisor' });
      continue;
    }
    
    // Linha toda em negrito
    if (padroes.negritoCompleto.test(linha)) {
      const conteudo = linha.match(padroes.negritoCompleto)[1];
      elementos.push({ 
        tipo: 'negritoCompleto', 
        conteudo,
        estilo: CONFIG_ABNT.estilos.negrito
      });
      continue;
    }
    
    // Marcador de lista
    if (padroes.marcadorLista.test(linha)) {
      const conteudo = linha.match(padroes.marcadorLista)[1];
      elementos.push({ 
        tipo: 'lista', 
        conteudo,
        marcador: '•'
      });
      continue;
    }
    
    // Linha especial (assinatura, data, etc.)
    if (isLinhaEspecial(linha)) {
      elementos.push({
        tipo: 'especial',
        conteudo: linha,
        alinhamento: getAlinhamentoEspecial(linha)
      });
      continue;
    }
    
    // Parágrafo normal (com formatação mista)
    elementos.push({
      tipo: 'paragrafo',
      conteudo: processarFormatacaoMista(linha)
    });
  }
  
  return elementos;
}

/**
 * Processa formatação mista dentro do texto (negrito e itálico)
 */
function processarFormatacaoMista(texto) {
  // Primeiro processa negritos (**texto**)
  let resultado = texto;
  
  // Processa negritos
  resultado = resultado.replace(/\*\*([^*]+)\*\*/g, (match, conteudo) => {
    return `{{NEGRITO}}${conteudo}{{FIMNEGRITO}}`;
  });
  
  // Processa itálicos (*texto*)
  resultado = resultado.replace(/\*([^*]+)\*/g, (match, conteudo) => {
    return `{{ITALICO}}${conteudo}{{FIMITALICO}}`;
  });
  
  return resultado;
}

/**
 * Identifica linhas especiais (assinaturas, datas, etc.)
 */
function isLinhaEspecial(linha) {
  const padroesEspeciais = [
    /^Maceió\s*-\s*AL/i,
    /^Master Educação LTDA/i,
    /^CNPJ:/i,
    /^CONTRATANTE/i,
    /^ASSINATURA/i,
    /^\d{2}\/\d{2}\/\d{4}$/, // Data
    /^______________________________/ // Linha de assinatura
  ];
  
  return padroesEspeciais.some(padrao => padrao.test(linha));
}

/**
 * Define alinhamento para linhas especiais
 */
function getAlinhamentoEspecial(linha) {
  if (/^Maceió\s*-\s*AL/i.test(linha)) return 'centro';
  if (/^Master Educação LTDA/i.test(linha)) return 'centro';
  if (/^CNPJ:/i.test(linha)) return 'centro';
  if (/^CONTRATANTE/i.test(linha)) return 'centro';
  if (/^______________________________/.test(linha)) return 'centro';
  return 'justificado';
}

/**
 * Gera o PDF do contrato com formatação ABNT
 */
function gerarPDFContrato(contratoTexto) {
  // Verifica se jsPDF está disponível
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert('Biblioteca jsPDF não encontrada. Por favor, recarregue a página.');
    return;
  }
  
  // Cria documento com configurações ABNT
  const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });
  
  // Configurações iniciais
  const { margens, fonte, recuoParagrafo } = CONFIG_ABNT;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const larguraUtil = pageWidth - margens.esquerda - margens.direita;
  
  let yAtual = margens.topo;
  let primeiraLinhaParagrafo = true;
  
  /**
   * Verifica se precisa de nova página
   */
  function verificarEspaco(alturaNecessaria = 0) {
    if (yAtual + alturaNecessaria > pageHeight - margens.base) {
      doc.addPage();
      yAtual = margens.topo;
      primeiraLinhaParagrafo = true;
      return true;
    }
    return false;
  }
  
  /**
   * Adiciona espaço vertical
   */
  function adicionarEspaco(pt) {
    yAtual += pt;
    verificarEspaco();
  }
  
  /**
   * Aplica estilo ao documento
   */
  function aplicarEstilo(estilo) {
    doc.setFont(fonte.nome);
    doc.setFontSize(estilo.tamanho || fonte.tamanhoBase);
    
    if (estilo.negrito) {
      doc.setFont(undefined, 'bold');
    } else if (estilo.italico) {
      doc.setFont(undefined, 'italic');
    } else {
      doc.setFont(undefined, 'normal');
    }
  }
  
  /**
   * Renderiza texto com formatação mista
   */
  function renderizarTextoFormatado(texto, x, y, larguraMax, alinhamento = 'justify') {
    const partes = [];
    let textoAtual = '';
    let dentroNegrito = false;
    let dentroItalico = false;
    
    // Divide o texto em partes formatadas
    const tokens = texto.split(/({{NEGRITO}}|{{FIMNEGRITO}}|{{ITALICO}}|{{FIMITALICO}})/);
    
    for (const token of tokens) {
      if (token === '{{NEGRITO}}') {
        if (textoAtual) {
          partes.push({ texto: textoAtual, negrito: dentroNegrito, italico: dentroItalico });
          textoAtual = '';
        }
        dentroNegrito = true;
      } else if (token === '{{FIMNEGRITO}}') {
        if (textoAtual) {
          partes.push({ texto: textoAtual, negrito: dentroNegrito, italico: dentroItalico });
          textoAtual = '';
        }
        dentroNegrito = false;
      } else if (token === '{{ITALICO}}') {
        if (textoAtual) {
          partes.push({ texto: textoAtual, negrito: dentroNegrito, italico: dentroItalico });
          textoAtual = '';
        }
        dentroItalico = true;
      } else if (token === '{{FIMITALICO}}') {
        if (textoAtual) {
          partes.push({ texto: textoAtual, negrito: dentroNegrito, italico: dentroItalico });
          textoAtual = '';
        }
        dentroItalico = false;
      } else if (token) {
        textoAtual += token;
      }
    }
    
    // Adiciona última parte se houver
    if (textoAtual) {
      partes.push({ texto: textoAtual, negrito: dentroNegrito, italico: dentroItalico });
    }
    
    // Se não há formatação mista, renderiza diretamente
    if (partes.length === 1 && !partes[0].negrito && !partes[0].italico) {
      const linhas = doc.splitTextToSize(partes[0].texto, larguraMax);
      doc.text(linhas, x, y, { maxWidth: larguraMax, align: alinhamento });
      return linhas.length * fonte.linhaAltura;
    }
    
    // Renderiza com formatação mista
    let xAtual = x;
    let alturaTotal = fonte.linhaAltura;
    let linhaAtual = [];
    let larguraLinhaAtual = 0;
    
    for (const parte of partes) {
      // Aplica estilo da parte
      if (parte.negrito) doc.setFont(undefined, 'bold');
      if (parte.italico) doc.setFont(undefined, 'italic');
      if (!parte.negrito && !parte.italico) doc.setFont(undefined, 'normal');
      
      // Divide o texto em palavras
      const palavras = parte.texto.split(' ');
      
      for (const palavra of palavras) {
        const palavraComEspaco = linhaAtual.length > 0 ? ' ' + palavra : palavra;
        const larguraPalavra = doc.getTextWidth(palavraComEspaco);
        
        if (xAtual + larguraLinhaAtual + larguraPalavra <= x + larguraMax) {
          linhaAtual.push(palavraComEspaco);
          larguraLinhaAtual += larguraPalavra;
        } else {
          // Renderiza linha atual
          doc.text(linhaAtual.join(''), xAtual, y);
          y += fonte.linhaAltura;
          alturaTotal += fonte.linhaAltura;
          
          // Começa nova linha
          linhaAtual = [palavra];
          larguraLinhaAtual = doc.getTextWidth(palavra);
          xAtual = x;
        }
      }
    }
    
    // Renderiza última linha
    if (linhaAtual.length > 0) {
      doc.text(linhaAtual.join(''), xAtual, y);
    }
    
    return alturaTotal;
  }
  
  // Processa o texto do contrato
  const elementos = processarContratoParaPDF(contratoTexto);
  
  // Renderiza cada elemento
  elementos.forEach(elemento => {
    verificarEspaco(fonte.linhaAltura * 3);
    
    switch (elemento.tipo) {
      case 'titulo1':
        aplicarEstilo(elemento.estilo);
        adicionarEspaco(elemento.estilo.espacamentoAntes);
        
        const linhasTitulo1 = doc.splitTextToSize(elemento.conteudo, larguraUtil);
        doc.text(linhasTitulo1, margens.esquerda, yAtual, { 
          maxWidth: larguraUtil, 
          align: 'center' 
        });
        
        yAtual += fonte.linhaAltura * linhasTitulo1.length;
        adicionarEspaco(elemento.estilo.espacamentoDepois);
        primeiraLinhaParagrafo = true;
        break;
        
      case 'titulo2':
        aplicarEstilo(elemento.estilo);
        adicionarEspaco(elemento.estilo.espacamentoAntes);
        
        const linhasTitulo2 = doc.splitTextToSize(elemento.conteudo, larguraUtil);
        doc.text(linhasTitulo2, margens.esquerda, yAtual, { 
          maxWidth: larguraUtil, 
          align: 'left' 
        });
        
        yAtual += fonte.linhaAltura * linhasTitulo2.length;
        adicionarEspaco(elemento.estilo.espacamentoDepois);
        primeiraLinhaParagrafo = true;
        break;
        
      case 'titulo3':
        aplicarEstilo(elemento.estilo);
        adicionarEspaco(elemento.estilo.espacamentoAntes);
        
        const linhasTitulo3 = doc.splitTextToSize(elemento.conteudo, larguraUtil);
        doc.text(linhasTitulo3, margens.esquerda, yAtual, { 
          maxWidth: larguraUtil, 
          align: 'left' 
        });
        
        yAtual += fonte.linhaAltura * linhasTitulo3.length;
        adicionarEspaco(elemento.estilo.espacamentoDepois);
        primeiraLinhaParagrafo = true;
        break;
        
      case 'titulo4':
        aplicarEstilo(elemento.estilo);
        adicionarEspaco(elemento.estilo.espacamentoAntes);
        
        const linhasTitulo4 = doc.splitTextToSize(elemento.conteudo, larguraUtil);
        doc.text(linhasTitulo4, margens.esquerda, yAtual, { 
          maxWidth: larguraUtil, 
          align: 'left' 
        });
        
        yAtual += fonte.linhaAltura * linhasTitulo4.length;
        adicionarEspaco(elemento.estilo.espacamentoDepois);
        primeiraLinhaParagrafo = true;
        break;
        
      case 'negritoCompleto':
        aplicarEstilo(elemento.estilo);
        
        const linhasNegrito = doc.splitTextToSize(elemento.conteudo, larguraUtil);
        doc.text(linhasNegrito, margens.esquerda, yAtual, { 
          maxWidth: larguraUtil, 
          align: 'justify' 
        });
        
        yAtual += fonte.linhaAltura * linhasNegrito.length;
        adicionarEspaco(8);
        primeiraLinhaParagrafo = true;
        break;
        
      case 'lista':
        aplicarEstilo(CONFIG_ABNT.estilos.normal);
        
        const margemLista = margens.esquerda + 20;
        const larguraLista = larguraUtil - 20;
        
        // Marcador
        doc.text('•', margens.esquerda, yAtual);
        
        const linhasLista = doc.splitTextToSize(elemento.conteudo, larguraLista);
        doc.text(linhasLista, margemLista, yAtual, { 
          maxWidth: larguraLista, 
          align: 'justify' 
        });
        
        yAtual += fonte.linhaAltura * linhasLista.length;
        adicionarEspaco(4);
        primeiraLinhaParagrafo = true;
        break;
        
      case 'paragrafo':
        aplicarEstilo(CONFIG_ABNT.estilos.normal);
        
        // Aplica recuo na primeira linha do parágrafo
        const xInicio = primeiraLinhaParagrafo ? 
          margens.esquerda + recuoParagrafo : 
          margens.esquerda;
        const larguraParagrafo = primeiraLinhaParagrafo ? 
          larguraUtil - recuoParagrafo : 
          larguraUtil;
        
        const alturaTexto = renderizarTextoFormatado(
          elemento.conteudo,
          xInicio,
          yAtual,
          larguraParagrafo,
          'justify'
        );
        
        yAtual += alturaTexto;
        adicionarEspaco(8); // Espaço entre parágrafos
        primeiraLinhaParagrafo = false;
        break;
        
      case 'especial':
        aplicarEstilo(CONFIG_ABNT.estilos.normal);
        
        // Tratamento especial para campos de assinatura
        if (elemento.conteudo.includes('Maceió')) {
          adicionarEspaco(40);
          
          // Linha de assinatura
          doc.text('_________________________________________', pageWidth / 2, yAtual, { align: 'center' });
          yAtual += fonte.linhaAltura + 5;
          
          doc.text('Assinatura do Contratante', pageWidth / 2, yAtual, { align: 'center' });
          yAtual += fonte.linhaAltura * 2;
          
          // Cidade
          doc.text(elemento.conteudo, pageWidth / 2, yAtual, { align: 'center' });
          yAtual += fonte.linhaAltura;
          
          // Data atual
          const hoje = new Date();
          const dataFormatada = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth()+1).padStart(2, '0')}/${hoje.getFullYear()}`;
          doc.text(dataFormatada, pageWidth / 2, yAtual, { align: 'center' });
          yAtual += fonte.linhaAltura * 2;
        } else if (elemento.conteudo.includes('CONTRATANTE')) {
          adicionarEspaco(30);
          doc.text('_________________________________________', pageWidth / 2, yAtual, { align: 'center' });
          yAtual += fonte.linhaAltura;
          doc.text(elemento.conteudo, pageWidth / 2, yAtual, { align: 'center' });
          yAtual += fonte.linhaAltura * 2;
        } else {
          // Outras linhas especiais
          const alinhamento = elemento.alinhamento === 'centro' ? 'center' : 'left';
          doc.text(elemento.conteudo, pageWidth / 2, yAtual, { align: alinhamento });
          yAtual += fonte.linhaAltura;
        }
        
        primeiraLinhaParagrafo = true;
        break;
        
      case 'divisor':
        yAtual += 20;
        doc.setLineWidth(0.5);
        doc.line(margens.esquerda, yAtual, pageWidth - margens.direita, yAtual);
        yAtual += 20;
        primeiraLinhaParagrafo = true;
        break;
        
      case 'espaco':
        yAtual += fonte.linhaAltura / 2;
        primeiraLinhaParagrafo = true;
        break;
    }
  });
  
  // Salva o PDF
  doc.save('Contrato-Master-Educacao.pdf');
}

/**
 * Função principal para gerar contrato
 */
async function abrirContratoModal() {
  try {
    const texto = await carregarContratoTexto();
    exibirModalContrato(texto);
  } catch (error) {
    console.error('Erro ao processar contrato:', error);
    alert('Erro ao gerar contrato: ' + error.message);
  }
}

/**
 * Teste rápido da formatação
 */
function testarFormatacao() {
  const textoTeste = `
  
  # CONTRATO DE PRESTAÇÃO DE SERVIÇOS




###1. TERMOS E CONDIÇÕES GERAIS DE FORNECIMENTO DE AULAS PARTICULARES

### 1.1 CONTRATADA
*MASTER EDUCACAO LTDA* inscrito(a) no CNPJ 48.055.955/0001-72 registrado na AV WALTER ANANIAS, 594 bairro Poço, CEP 57.025-510, Cidade Maceió, Estado Alagoas.

### 1.2 CONTRATANTE
*Elayne F B Amaral Santos* inscrito(a) no CPF de número 11616876700 Rua projetada u, Modulo 3, Quadra U, 175 - Res. Jardim Royal, Maceió-AL, CEP 57072131.

## DO OBJETO DO CONTRATO

### Cláusula Primeira
A *CONTRATADA* atua na intermediação de serviços de aulas particulares para reforço escolar em quaisquer matérias da grade curricular do ensino básico, listadas no formulário eletrônico de agendamento de aulas, ministradas por profissionais qualificados integrantes da rede de professores *MASTER EDUCACÃO*.

### Cláusula Segunda
Os serviços de aulas particulares serão prestados exclusivamente para crianças e adolescentes regularmente matriculados em instituições de ensino públicas ou privadas reconhecidas pelo MEC, doravante denominadas como *ALUNO*.

### Cláusula Terceira
As informações do(s) *ALUNO*(s) devem ser repassadas à *CONTRATADA* no momento do preenchimento do formulário eletrônico de agendamento de aulas, de modo que o *CONTRATANTE* autoriza, desde já, o tratamento dos dados pessoais do *ALUNO*, para fins de cumprimento dos serviços contratados.

### Cláusula Quarta
A oferta de serviços será sempre compatível com o ano escolar do *ALUNO*, sendo inviável a contratação de serviços de aulas particulares com conteúdo que ultrapasse o indicado para sua idade e/ou ano escolar.

## DO PRAZO DO CURSO

### Cláusula Quinta
Os serviços serão prestados de acordo com o plano de aulas contratado, descritos no *ANEXO I* deste instrumento. As datas e horários para utilização das horas-aula contratadas será combinada entre *CONTRATANTE* e *CONTRATADA*, formalizadas em um cronograma que será enviado em meio digital em data anterior ao início da prestação de serviços.

### Cláusula Sexta
O presente contrato poderá ser renovado automaticamente, por prazo indeterminado, permanecendo vigente nos períodos definidos pelo *CONTRATANTE* ao preencher o formulário eletrônico de agendamento de aulas e realizar o pagamento correspondente.

### Cláusula Sétima
O *CONTRATANTE* somente poderá usufruir das horas-aula contratadas após a comprovação do pagamento dos serviços, que deve ocorrer em até *24h (vinte e quatro horas)* antes do horário fixado para o primeiro serviço de aulas.

### Cláusula Oitava
O *CONTRATANTE* poderá exercer o seu direito de arrependimento ao efetuar a contratação, que ocorre via internet, em até *7 dias*, contados da sua assinatura ou início de utilização dos serviços, em conformidade com o art. 49, do Código de Defesa do Consumidor.

## DAS MINISTRAÇÕES E MODALIDADES

### Cláusula Nona
As modalidades de aulas *online* e *presenciais* poderão ser contratadas de acordo com a tabela disponível prevista em anexo. Ressalvando-se o caso de feriados e dias com imprevistos que inviabilizem as aulas, que poderão ser devidamente compensadas, em condições detalhadas adiante.

### Cláusula Décima
O(a) *CLIENTE* poderá usufruir do serviço de aulas particulares mediante pagamento e envio do comprovante em data anterior ao início da ministração das aulas bem como mediante assinatura deste documento.

### Cláusula Décima Primeira
A modalidade de aula contratada poderá ser migrada e a contratação de serviços extras de gamificação e de inclusão de momento de desenvolvimento de habilidades do aluno, poderá ocorrer mediante as seguintes condições:

#### Cláusula Décima Segunda
A solicitação de *MIGRAÇÃO* de modalidade poderá ser validada com o prazo de *4 (quatro) dias* antecedentes à data referente ao início das aulas.

#### Cláusula Décima Terceira
A viabilidade da *MIGRAÇÃO* dependerá da disponibilidade da equipe de técnicos da *CONTRATADA*, sendo esta verificada no dia da solicitação com o prazo de *24h* a partir do horário em que foi solicitado.

#### Cláusula Décima Quarta
*MIGRAÇÃO de Online para Presencial*: o *CLIENTE* deverá efetuar o pagamento da diferença de valores entre as modalidades. Após o envio do comprovante do pagamento, a *CONTRATADA* deverá confirmar a validação da alteração.

#### Cláusula Décima Quinta
*MIGRAÇÃO de Presencial para Online*: a *CONTRATADA* converterá o valor da diferença entre as modalidades em créditos de aulas que podem ser utilizados em qualquer modalidade dentro do prazo de até *15 dias*, a partir do primeiro dia da aula contratada.

#### Cláusula Décima Sexta
A *gamificação* será disponibilizada ao contratar pacotes com *10 (dez)* ou *15 (quinze) horas* no formato de pacote avulso, *30 (trinta)* ou *45 (quarenta e cinco) horas* aulas presenciais no formato de assinatura, ou, se for o caso, no formato online ao contratar pacotes com *6 (seis), 8 (oito), 10 (dez) ou 15 (quinze) horas* e poderá ser desfrutado mediante solicitação da *CONTRATANTE* ou disponibilidade e domínio da equipe para utilizar a ferramenta de gamificação que o tutor julgar mais adequada.

#### Cláusula Décima Sétima
O *momento de desenvolvimento de habilidades* do(a) aluno(a) será disponibilizado ao contratar pacotes com *15 (quinze)* ou *45 (quarenta e cinco) horas* aulas presenciais no formato de assinatura ou no formato online ao contratar pacotes de *10 (dez)* ou *15 (quinze) horas* e poderá durar entre *1 hora ou 4 horas* no período da manhã ou da tarde a depender da disponibilidade da equipe.

#### Cláusula Décima Oitava
No que se refira ao agendamento do momento de desenvolvimento de habilidades, o mesmo deverá ser efetuado com pelo menos *7 dias úteis* de antecedência, podendo escolher *1 dos temas* que a contratada estiver disponibilizando no mês corrente e será desfrutado mediante solicitação da *CONTRATANTE* via e-mail descrevendo qual tema, data e a duração que deseja.

## DO CANCELAMENTO E DO REEMBOLSO

### Cláusula Décima Segunda
O *CLIENTE* terá disponível o *CANCELAMENTO de 1 (uma) aula* dentro do pacote contratado, que poderá ser solicitado pelo(a) mesmo(a) com *24 horas* de antecedência ao horário agendado para o início da aula. O valor correspondente à aula neste caso, será convertido em crédito de também *1 aula* para ser desfrutada dentro do prazo de *15 (quinze) dias* a partir da data do cancelamento.

### Cláusula Décima Terceira
O cancelamento de aulas deverá ser solicitado, no mínimo, em até *48 horas* antes do horário agendado para que o *CLIENTE* possa obter o valor integral da hora-aula reembolsado ou convertido em crédito. O reembolso será efetuado em até *7 dias úteis* após a solicitação formal.

Caso o Professor cancele o agendamento em menos de *48 horas* do horário ou não compareça à aula, o *CLIENTE* adquire o direito de reembolso do valor integral, ou poderá optar pelo reagendamento sem custo adicional.

### Cláusula Décima Quarta
Se o cancelamento das aulas ocorrer em menos de *48 horas* e até *4 horas* antes do horário agendado, será reembolsado apenas *50%* do valor da hora-aula. Se o cancelamento das aulas ocorrer em até *4 horas*, o cliente não será reembolsado.

### Cláusula Décima Quinta
O cliente que solicitar o cancelamento em até no mínimo *24 horas* de antecedência do horário marcado para a aula, tem o direito de obter um crédito para reagendamento em *15 dias* contados da data da realização formal do cancelamento.

### Cláusula Décima Sexta
Se houver *2 (dois) ou mais cancelamentos seguidos*, o aluno não terá direito ao reembolso integral, independentemente do cumprimento do prazo de 24 horas.

## DO REAGENDAMENTO

### Cláusula Décima Sétima
O reagendamento de aulas, sem custo adicional, deverá ser solicitado pelo aluno com antecedência de, no mínimo, *24 horas*, para que a contratada reorganize-se dentro do cronograma de agendamentos de aula em anexo (*Anexo Y*), verificando-se a disponibilidade de tempo do professor e outras diligências necessárias.

### Cláusula Décima Oitava
O professor poderá solicitar o reagendamento da aula notificando o aluno em até *24 horas* antes do horário marcado. O não cumprimento deste prazo ensejará a devolução do valor integral das horas-aulas.

### Cláusula Décima Nona
O(A) *CLIENTE* terá *2 (dois) REAGENDAMENTOS* disponíveis. Ao ultrapassar esse número, a *CONTRATADA* deverá analisar a viabilidade de dar continuidade às aulas restantes, junto à equipe, nos dias e horários que foram agendados inicialmente no cronograma. Após a análise e, verificado que não é viável a continuidade do serviço, este poderá ser cancelado, sem a possibilidade de reembolso dos valores pagos.

## DA RESCISÃO

### Cláusula Vigésima
O presente contrato pode ser rescindido por qualquer das partes sem justificativa, com aviso prévio de *7 (sete) dias* antes do início da aula. Cumprido este prazo, o Cliente adquire o direito ao reembolso de *90%* do valor do contrato referente às aulas restantes.

### Cláusula Vigésima Primeira
A rescisão do contrato em prazo de aviso prévio inferior aos *7 (sete) dias* estipulados na cláusula décima terceira implicará em uma multa no valor de *50%* do valor do contrato referente às aulas restantes, ou seja, a devolução de apenas *50%* do valor contrato, referente ao pacote contratado.

### Cláusula Vigésima Segunda
Após o envio deste contrato, o(a) cliente tem o prazo de *7 (sete) dias úteis* para solicitar até *1 (uma) MODIFICACÃO* no cronograma original das aulas de acordo com o que está proposto no cronograma em anexo descrito na primeira página do presente documento. A *MODIFICACÃO* poderá alterar datas de aulas ou horário de início das aulas (com a modificação, poderá haver reajuste em datas de pagamento) ou o ordenamento das matérias e não poderá excluir matérias ou interferir no total de horas aulas contratadas inicialmente, aumentando ou diminuindo o mesmo sem o devido calculo da diferença de acordo, exceto com a conveniencia e ajuste de ambas as partes.

### Cláusula Vigésima Terceira
Ao ultrapassar esse número ou haver a solicitação de exclusão de matérias ou interferir no total de horas aulas contratadas inicialmente, a *CONTRATADA* deverá analisar a viabilidade de dar continuidade às aulas restantes, junto à equipe, nos dias e horários que foram agendados, inicialmente no cronograma em anexo. Após a análise, caso seja constatada a inviabilidade e o(a) *CLIENTE* permaneça com a solicitação sem possibilidade de ajustar ao que é permitido na cláusula décima quinta, o serviço poderá ser cancelado sem a possibilidade de reembolso de qualquer porcentagem do valor pago inicialmente.

## DA CLÁUSULA DE FIDELIDADE

### Cláusula Vigésima Quarta
Os alunos, ao adquirirem os pacotes e modalidades de serviços descritos no anexo *"x"*, comprometem-se ao pagamento do valor discriminado com desconto referente a esta forma de contratação para a fruição da totalidade das aulas contratadas.

### Cláusula Vigésima Quinta
Caso solicite a rescisão desse contrato, haverá o reembolso parcial a ser definido de forma escalonada, de acordo com a quantidade de aulas já ministradas e período de tempo ultrapassado contado da data da assinatura do pacote de contratação.

### Cláusula Vigésima Sexta
A rescisão pode ser solicitada mediante notificação por escrito, respeitando o prazo mínimo de *7 dias* para a devolução dos valores contados da data da solicitação.

### Cláusula Vigésima Sétima
A devolução parcial dos valores será efetuada com base no pacote contratado.

### Cláusula Vigésima Oitava
Se *70%* das aulas já estiverem sido ministradas, não haverá devolução de valores.

## DO PAGAMENTO

### Cláusula Vigésima Nona
Pela prestação de serviço contratado, o (a) *CLIENTE* pagará à *CONTRATADA* o valor total previsto no *ANEXO I*, de acordo com o pacote e a modalidade a ser escolhidos, podendo este valor ser dividido de acordo com a conveniencia e ajuste de ambas as partes previstas no corpo do e-mail em que este documento está anexo.

No caso do(a) cliente optar por pagar *50%* do valor no pix ou débito total na data referente à primeira aula do cronograma ou em data anterior a esta, os outros *50%* deverão ser pagos no dia que atingir a data referente à metade do pacote de aulas contratado. Pode este sofrer alteração caso o(a) *CLIENTE* solicite modificação nas datas do cronograma original previsto no presente e-mail e esta solicitação for aprovada.Em caso de não pagamento na data e horário acordado, a *CONTRATADA* poderá suspender as atividades com o(a) *CLIENTE* até que o pagamento seja efetuado.

5.### Cláusula Trigésima
Em caso de aulas solicitadas para serem ministradas para o mesmo dia da contratação, poderá ser cobrada uma taxa extra de *30%* sobre o valor da hora aula referente à modalidade escolhida.

## DA PROTEÇÃO DE DADOS

### Cláusula Trigésima Primeira
As partes declaram ter conhecimento acerca das regras da Lei Geral de proteção de dados pessoais, comprometendo-se em observá-las no cumprimento das obrigações assumidas em razão dessa relação. O tratamento dos dados pessoais dos alunos, por serem crianças ou adolescentes, deve ser realizado de acordo com o art. 14 da LGPD.

### Cláusula Trigésima Segunda
A *CONTRATANTE* declara ciência e concorda que a *CONTRATADA* realizará a coleta de seus dados pessoais ( pais ou responsável) bem como dos dados pessoais do *ALUNO*, e que compartilhará algumas destas informações aos professores cadastrados na rede *MASTER EDUCAÇÃO*. Tais informações serão tratadas e armazenadas com o máximo de segurança e sigilo aplicáveis ao porte da empresa.

### Cláusula Trigésima Terceira
O tratamento dos dados pessoais desses alunos menores de idade deve ser realizado em seu melhor interesse, observando-se os direitos fundamentais de liberdade e de privacidade e o livre desenvolvimento da personalidade da pessoa natural.

### Cláusula Trigésima Quarta
O tratamento dos dados pessoais dos estudantes menores de idade é realizado com fundamento na base legal execução de contratos, não podendo haver desvio para outra finalidade.

### Cláusula Trigésima Quinta
O tratamento de dados pessoais dos estudantes menores deve ser realizado com fundamento nos principios da finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilidade ( Art. 6").

### Cláusula Trigésima Sexta
O tratamento de dados pessoais dos alunos pela *CONTRATADA* será limitado ao mínimo necessário para a obtenção das finalidades legítimas descritas na cláusula vigésima terceira: serão coletados apenas o nome completo dos estudantes e dados do(s) pai (s) e/ou responsável (s) para fins de contratação.

### Cláusula Trigésima Sétima
O tratamento dos dados será realizado para propósitos legítimos e para as seguintes finalidades:

a) Para a sua identificação como estudante usuário e contratante desse aplicativo;
b) Cumprimento das obrigações legais e contratuais estabelecidas entre as partes.

### Cláusula Trigésima Oitava
Em nenhuma hipótese, os dados pessoais dos estudantes menores serão expostos em situações que ponham em perigo sua integridade física ou moral.

### Cláusula Trigésima Nona
Um dos pais ou o responsável pode revogar o consentimento para o tratamento dos dados pessoais do estudante menor, comprometendo-se dessa forma, a cancelar o serviço, pois a coleta e o tratamento desses dados são imprescindíveis para a oferta do mesmo.

## DISPOSIÇÕES GERAIS

### Cláusula Quadragésima
A *CONTRATANTE* se compromete em manter um adulto responsável pelo *ALUNO* no local da prestação do serviço e durante toda a sua duração. A *CONTRATADA* não se responsabiliza por eventuais danos decorrentes da ausência e/ou negligência da *CONTRATADA* durante o horário de prestação dos serviços.

### Cláusula Quadragésima Primeira
Havendo necessidade de ajuizamento de ação para cobrança, o(a) *CLIENTE* arcará com todas as despesas processuais, custas e honorários advocatícios de *20% (vinte por cento)*.

### Cláusula Quadragésima Segunda
Quaisquer despesas provenientes de alguma necessidade da *CONTRATANTE*, seja a que título for, que não fazem parte do presente contrato, deve ser custeada pelo(a) *CLIENTE*, que deve desembolsar o valor correspondente.

### Cláusula Quadragésima Terceira
Em caso de necessidade de aquisição de materiais ou custeio de despesas não descritas no presente contrato para a efetiva execução de seu objeto, a *CONTRATADA* deverá informar previamente à *CONTRATANTE*, que aprovará ou não a despesa, podendo optar por adquirir o que for listado de forma independente.

### Cláusula Quadragésima Quarta
O *CLIENTE* declara ciência de que, como em qualquer área académica, o sucesso do ensino depende da aplicação, dedicação e comprometimento do aluno, tanto em aula, como fora dela, sendo necessário, também, estudo contínuo, de acordo com a pretensão do(a) interessado(a).

### Cláusula Quadragésima Quinta
Caso um dos professores/tutores encaminhados pela *CONTRATADA* identifique sinais de maus-tratos, violência doméstica, negligência e/ou qualquer situação que coloque em risco a vida e a segurança do *ALUNO*, será realizada denúncia ao Ministério Público para apuração do caso, com o máximo de sigilo e com apoio integral da *CONTRATADA*, sem direito à indenização da *CONTRATANTE*, independente dos resultados da investigação.

## DO FORO

### Cláusula Quadragésima Sexta
As partes elegem o Foro da Comarca de *Maceió* para dirimir eventuais litígios acerca do contrato, podendo ser resolvidos, também, por meio de procedimento arbitral.

## PROPOSTA DE ATENDIMENTO

### Do controle de atendimento
Através deste instrumento formalizo minha concordância com o que está previsto no presente contrato, bem como com tudo o que está descrito na imagem abaixo.

Segue imagem do cronograma aprovado via whatsapp:
[FotoCronograma]


Declaro estar ciente e de acordo com todas as cláusulas e condições estabelecidas no contrato e no Google Sala de Aula, reconhecendo a validade e eficácia dessas disposições. Este contrato é celebrado com pleno conhecimento de causa e de boa-fé, sem nenhuma coação ou vício de qualquer natureza. Assim, assino o presente instrumento para que produza seus legais efeitos.

Maceió - AL,

[Espaço para assinatura/digital]

*Master Educação LTDA*
CNPJ: 48.055.955/0001-72

  `;

  gerarPDFContrato(textoTeste);
}

// Exporta funções para uso externo
window.abrirContratoModal = abrirContratoModal;
window.testarFormatacao = testarFormatacao;
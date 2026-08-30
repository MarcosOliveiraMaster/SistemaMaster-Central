# Extensão Chrome — Compartilhamento de Cronograma via WhatsApp Web

## O que queremos realizar

Criar um botão no sistema (SistemaMaster Central) que, ao ser acionado, **capture automaticamente a imagem do cronograma de aula**, prepare um texto de acompanhamento e **envie tudo de forma automática para uma lista de contatos via WhatsApp Web** — sem nenhuma ação manual do usuário após o disparo.

A sequência de envio para cada contato é:
1. Texto 1 (apresentação / contextualização)
2. Imagem do cronograma (capturada com html2canvas)
3. Texto 2 (encerramento / aviso complementar)

Os contatos são professores e clientes vinculados à contratação aberta no sistema, buscados diretamente do Firestore. Não há limite fixo de contatos, mas a média esperada de uso é de 5 a 10 por disparo.

---

## Por que precisamos de uma extensão Chrome

O sistema é uma aplicação web hospedada no Firebase. Pelo comportamento padrão dos navegadores, uma página web **não consegue controlar outra aba de domínio diferente** — isso é bloqueado pela Same-Origin Policy.

| Tentativa | Por que não funciona |
|---|---|
| Abrir WhatsApp Web e colar texto via URL | Texto vai pré-preenchido, mas o envio ainda exige clique manual |
| Web Share API (Windows) | Não permite pré-selecionar destinatário; ação manual no WhatsApp |
| WhatsApp Desktop (protocolo `whatsapp://`) | Abre o contato certo, mas não anexa imagem; envio ainda é manual |
| APIs pagas (Z-API, Meta, Evolution) | Funcionam 100%, mas têm custo mensal e dependência externa |

Uma **extensão Chrome** resolve isso porque:
- **Content Scripts** são injetados diretamente dentro da aba do `web.whatsapp.com` — mesma origem, sem bloqueio
- Consegue simular digitação, colar imagem e clicar em "Enviar" de forma programática
- Lê a imagem do clipboard do sistema operacional
- Recebe comandos diretamente do sistema Firebase via `externally_connectable`
- **Custo zero** — sem dependência de serviços externos pagos

---

## Stack atual do sistema (contexto para compatibilidade)

| Camada | Tecnologia |
|---|---|
| Frontend | Vanilla JavaScript, Tailwind CSS, Font Awesome |
| Captura de imagem | html2canvas 1.4.1 (já em uso) |
| Backend | Firebase Cloud Functions (Node.js) |
| Banco de dados | Firebase Firestore |
| Hospedagem | Firebase Hosting (HTTPS garantido) |
| Autenticação | Firebase Auth |
| PDF/Imagem | jsPDF + html2canvas (já em uso) |

A extensão deve ser compatível com essa stack sem adicionar novas dependências ao sistema principal.

---

## Critérios de segurança

### Permissões mínimas (manifest.json)
Declarar apenas o estritamente necessário:
- `clipboardRead` — leitura do clipboard para capturar a imagem
- `tabs` — abrir e navegar abas do WhatsApp Web
- `scripting` — injetar content script na aba do WhatsApp
- `storage` — comunicação de estado interno da extensão

### Restrição de origem (`externally_connectable`)
Somente o domínio oficial do sistema pode enviar comandos à extensão:
```json
"externally_connectable": {
  "matches": ["https://master-ecossistemaprofessor.web.app/*"]
}
```
Nenhuma outra página web pode acionar a extensão.

### Validação de entrada no background.js
Todo payload recebido do sistema deve ser validado antes de qualquer ação:
- Números de telefone: apenas dígitos, formato brasileiro válido (10–13 dígitos)
- Textos: tipo string, tamanho máximo definido
- Lista de contatos: array válido, sem limite fixo mas com checagem de estrutura

### Dados em memória — sem persistência
- A fila de envio é processada em RAM e descartada após a conclusão
- Nenhum conteúdo de mensagem é gravado em `chrome.storage` ou em qualquer log
- O clipboard é lido apenas no momento do envio, nunca monitorado passivamente

### Content Security Policy
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none'"
}
```
Impede execução de código externo ou `eval()` dentro da extensão.

### Sem dependências externas
Todo código da extensão é local — sem CDN, sem bibliotecas carregadas em runtime. Elimina risco de comprometimento por supply chain.

### Distribuição interna
A extensão **não será publicada na Chrome Web Store**. Distribuição via pasta/zip privada (GitHub ou Drive interno). Instalação via `chrome://extensions` → Modo desenvolvedor → Carregar sem compactação.

---

## Requisitos funcionais esperados

### Comportamento anti-detecção (WhatsApp ToS)
O WhatsApp detecta automação por padrões de comportamento, não apenas por código. As seguintes práticas devem ser implementadas:

- **Delays aleatórios** de 1 a 3 segundos entre cada ação (digitação, envio, troca de contato)
- **Simulação de digitação** — acionar o evento `input` para exibir o indicador "digitando..." no WhatsApp antes de enviar
- **Personalização por contato** — inserir o nome do destinatário no texto, nunca enviar mensagem 100% idêntica em série
- **Presença do usuário** — a extensão opera com o usuário logado na própria conta, não como bot externo

### Fluxo de envio por contato
```
Para cada contato na fila:
  1. Abrir (ou navegar) WhatsApp Web no número do contato
  2. Aguardar o chat carregar completamente
  3. Simular digitação → inserir Texto 1 → aguardar delay → enviar
  4. Ler imagem do clipboard → simular paste → aguardar delay → enviar
  5. Simular digitação → inserir Texto 2 → aguardar delay → enviar
  6. Aguardar delay de transição → avançar para próximo contato
```

### Estrutura dos 3 arquivos da extensão
```
extensao-master-wpp/
├── manifest.json   → permissões, versão, externally_connectable, CSP
├── background.js   → orquestra a fila, abre abas, comunica com content script
└── content.js      → injeta no WhatsApp Web, executa digitação, paste e envio
```

### Integração com o sistema Firebase
O sistema chama a extensão via:
```javascript
chrome.runtime.sendMessage(EXTENSION_ID, {
  contatos: [
    { nome: 'João Silva', telefone: '5511999999999' },
    { nome: 'Prof. Ana', telefone: '5521888888888' }
  ],
  texto1: 'Olá, [nome]! Segue o cronograma...',
  imagem: true,   // capturada via html2canvas e colocada no clipboard antes do disparo
  texto2: 'Qualquer dúvida estamos à disposição!'
})
```

### Captura da imagem
- Realizada com `html2canvas` (já presente no sistema)
- Convertida para Blob PNG
- Copiada para o clipboard via `navigator.clipboard.write()` antes do disparo da extensão
- A extensão lê do clipboard no momento de cada envio (garantindo que a imagem esteja disponível para cada contato)

### Feedback ao usuário
- O sistema deve mostrar progresso em tempo real durante o envio
- Status por contato ao final (enviado / erro / pulado)
- Notificação ao concluir toda a fila

### Tratamento de erros esperados
- Número inexistente no WhatsApp → pular e registrar erro, continuar fila
- WhatsApp Web não aberto ou não logado → exibir aviso orientando o usuário antes de iniciar
- Extensão não instalada → exibir mensagem com link/instrução de instalação
- Contato sem telefone cadastrado no Firestore → omitir da lista ou exibir desabilitado

---

## Decisões consolidadas (respostas às perguntas em aberto)

### Bloco 1 — Gatilho e seleção de contatos

1. **Onde fica o botão**: não é um botão único fixo em um modal específico. É um **componente reutilizável**, chamado "**Enviar mensagem para WhatsApp**", que será inserido em vários modais do Central, em momentos diferentes, à medida que a funcionalidade for evoluindo. Primeiro implementa-se o núcleo básico e genérico do botão; depois ele é plugado nos modais específicos.

2. **Seleção de contatos**: varia por modal. Cada modal em que o botão for inserido define sua própria forma de seleção (checkboxes na lista existente, lista separada, etc.), conforme o contexto daquele modal.

3. **Escopo dos contatos disponíveis**: depende do modal. Não há uma regra única — cada modal decide se os contatos são só o cliente + professores da contratação em questão, ou se pode incluir outros contatos.

### Bloco 2 — Conteúdo do que é enviado

4. **Sequência de envio**: não é fixa globalmente. Cada modal em que o botão for aplicado terá sua própria sequência (podendo ser configurável), mas a função central do botão é sempre a mesma: capturar a imagem/texto específicos daquele contexto e repassar à extensão para o envio.

5. **Texto 1**: modelo **editável por modal** — vem pré-preenchido com um template padrão daquele contexto, mas o usuário pode ajustar antes de enviar.

6. **Texto 2**: segue a mesma lógica do Texto 1 (modelo editável por modal).

7. **Imagem enviada**: depende do modal. Em alguns casos reaproveita a mesma imagem já gerada pelos botões existentes ("Solicitação Cliente" / "Solicitação Professor"); em outros, será uma captura nova específica daquele contexto.

8. **Personalização por contato**: sim, sempre. Os textos são personalizados inserindo o nome de cada destinatário — nunca é enviada a mesma mensagem 100% idêntica em série (alinhado ao requisito anti-detecção do WhatsApp).

### Bloco 3 — Comportamento durante o envio

9. **Prévia antes do envio**: sim, sempre. O usuário vê imagem + textos + lista de contatos antes de o envio real começar.

10. **Progresso em tempo real**: sim, com status por contato durante o processamento da fila.

11. **Ao final do envio**: exibe um **resumo** com o status de cada contato (enviado / erro / pulado).

### Bloco 4 — Erros e casos extremos

12. **Número inexistente no WhatsApp**: pula o contato, registra o erro, e continua a fila normalmente.

13. **WhatsApp Web não aberto ou não logado**: exibe um pop-up avisando que as mensagens não podem ser enviadas porque o WhatsApp não está aberto/logado, e aguarda a confirmação do usuário após ele abrir e logar no WhatsApp Web.

14. **Extensão não instalada**: exibe mensagem com link/instrução de instalação.

15. **Telefone ausente no Firestore**: não é um caso a ser tratado pela extensão. Cada modal já entrega à extensão apenas a lista de contatos elegíveis para aquele envio (filtro de telefone/elegibilidade é responsabilidade do modal, não da extensão).

### Ponto adicional levantado — restrição de usuário autenticado (item para sessão futura)

A extensão deve, futuramente, restringir o envio apenas aos usuários autenticados no próprio Central (os logins configurados como responsáveis pela extensão). A extensão deve identificar quem está logado na plataforma Central e só permitir o disparo se for um desses usuários dedicados. **Esse refinamento fica registrado para ser detalhado e implementado em uma etapa futura**, não faz parte do escopo inicial básico do botão.

---

## Status do planejamento

- [x] Objetivo definido
- [x] Justificativa técnica da extensão documentada
- [x] Critérios de segurança definidos
- [x] Requisitos funcionais mapeados
- [x] Stack de compatibilidade documentada
- [x] Perguntas do Bloco 1 respondidas
- [x] Perguntas do Bloco 2 respondidas
- [x] Perguntas do Bloco 3 respondidas
- [x] Perguntas do Bloco 4 respondidas
- [x] Especificação final consolidada
- [ ] Implementação iniciada

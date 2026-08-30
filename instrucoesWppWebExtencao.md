# Extensão Chrome "Master WhatsApp App" — Compartilhamento de Cronograma via WhatsApp Web

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

### ID estável da extensão (chave pública fixa no manifest)
Sem uma chave fixa, o Chrome gera um ID novo a cada instalação "sem compactação", o que quebraria o `externally_connectable` (o Central precisa saber o `EXTENSION_ID` antecipadamente para chamar `chrome.runtime.sendMessage`).

Por isso:
- Deve ser gerado um **par de chaves RSA** (padrão do Chrome para extensões: `openssl genrsa -out key.pem 2048`, depois extrair a chave pública em base64 e colocar no campo `"key"` do `manifest.json`).
- A **chave privada (`key.pem`) nunca é versionada** — deve constar no `.gitignore` desde o primeiro commit.
- Com a chave pública fixa, o `EXTENSION_ID` é sempre o mesmo, em qualquer máquina que carregar a extensão a partir da mesma pasta/manifest — condição necessária para o `externally_connectable` funcionar de forma confiável entre ambientes (dev, produção, reinstalações).

### Testes automatizados das funções críticas
As funções de validação de entrada (telefone, textos, estrutura do payload de contatos) devem ter **testes unitários** cobrindo casos válidos e inválidos, usando o test runner nativo do Node.js (`node --test`) — sem adicionar dependência de runtime, apenas ferramenta de desenvolvimento. Isso garante que a camada de validação (barreira de segurança contra payload malformado ou malicioso) não regride silenciosamente em mudanças futuras.

### Documentação formal do projeto
Seguindo padrão de projetos profissionais/open-source, a extensão deve conter:
- `README.md` — o que é, como instalar em modo desenvolvedor, como integrar (formato do payload esperado)
- `SECURITY.md` — modelo de ameaças, justificativa de cada permissão solicitada, política de dados (o que é ou não persistido)
- `CHANGELOG.md` — histórico de versões seguindo [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/)

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

### Localização no repositório
A pasta da extensão vive **dentro deste mesmo repositório** (`SistemaMaster-Central`), na raiz, como `extensao-master-wpp/`. Motivo: é uma extensão de uso interno (não publicada na Web Store), fortemente acoplada ao formato de payload definido pelo botão do Central — manter tudo no mesmo repositório garante que extensão e sistema evoluam versionados juntos, sem risco de dessincronia entre "o que o Central envia" e "o que a extensão espera receber". Um repositório separado só se justificaria se a extensão passasse a ter ciclo de publicação/release independente — não é o caso hoje.

### Estrutura de arquivos da extensão (padrão de mercado — Manifest V3)
```
extensao-master-wpp/
├── manifest.json               → Manifest V3: permissões, versão, key (ID fixo), externally_connectable, CSP
├── package.json                → apenas dependência de dev (test runner); zero dependências de runtime
├── README.md                   → o que é, como instalar (modo desenvolvedor), formato do payload de integração
├── SECURITY.md                 → modelo de ameaças, justificativa de cada permissão, política de dados
├── CHANGELOG.md                → histórico de versões (SemVer)
├── .gitignore                  → ignora key.pem (chave privada), node_modules, arquivos locais
├── icons/
│   ├── icon16.png              → ícone da barra de ferramentas
│   ├── icon48.png              → ícone da página chrome://extensions
│   └── icon128.png             → ícone de instalação/detalhe
│                                  (placeholder genérico: monograma "M" branco sobre fundo
│                                  verde-azulado, gerado programaticamente — sem logo de
│                                  terceiros. Substituir por identidade visual oficial
│                                  quando disponível.)
├── src/
│   ├── background/
│   │   └── background.js       → orquestra a fila de contatos, abre/navega abas, comunica com o content script
│   ├── content/
│   │   └── content.js          → injetado no WhatsApp Web: digitação simulada, paste da imagem, envio
│   └── shared/
│       ├── validation.js       → funções puras de validação (telefone, textos, estrutura do payload)
│       └── constants.js        → limites, delays (1–3s), regex de telefone, chaves de configuração
└── tests/
    └── validation.test.js      → testes unitários das funções de src/shared/validation.js (node --test)
```

Cada arquivo tem responsabilidade única (separação clara entre orquestração, execução no DOM do WhatsApp, e validação/regras puras) — isso facilita revisão de segurança e testes isolados, ao invés de lógica misturada em um só arquivo monolítico.

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
- Contato sem telefone cadastrado no Firestore → tratado no componente do Central (Etapa 2), não pela extensão — cada modal já entrega apenas contatos elegíveis (ver Bloco 4, item 15)

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

## Plano de execução (para implementação por outra sessão/IA)

Esta seção resume a ordem de execução para quem for implementar a partir deste documento — não repete decisões já detalhadas acima, apenas define a sequência.

### Etapa 1 — Estrutura básica da extensão Chrome "Master WhatsApp App"
1. Criar a árvore de pastas/arquivos exatamente como definido em "Estrutura de arquivos da extensão" acima, dentro de `extensao-master-wpp/` na raiz deste repositório.
2. Gerar o par de chaves RSA, extrair a chave pública para o campo `"key"` do `manifest.json`, e adicionar `key.pem` ao `.gitignore` (nunca commitar a chave privada).
3. Implementar `manifest.json` com Manifest V3, as 4 permissões mínimas (`clipboardRead`, `tabs`, `scripting`, `storage`), o `externally_connectable` restrito ao domínio do Central, e a CSP definida.
4. Implementar `src/shared/validation.js` e `src/shared/constants.js` (validação de telefone, textos, payload; delays e regex centralizados).
5. Implementar `tests/validation.test.js` cobrindo casos válidos e inválidos das funções de `validation.js`.
6. Implementar `src/background/background.js`: recebe o payload via `externally_connectable`, valida com `validation.js`, orquestra a fila de contatos (abrir aba, delay aleatório 1–3s, avançar).
7. Implementar `src/content/content.js`: injeta no `web.whatsapp.com`, simula digitação (evento `input`), lê imagem do clipboard e simula paste, clica em enviar.
8. Implementar o fluxo de erro: número inexistente → pula e continua; WhatsApp não logado → sinaliza para o Central exibir aviso.
9. Escrever `README.md`, `SECURITY.md` e `CHANGELOG.md` (versão inicial `0.1.0`).
10. Testar manualmente carregando a extensão via `chrome://extensions` → Modo desenvolvedor → Carregar sem compactação, simulando uma chamada `chrome.runtime.sendMessage` pelo console do navegador (sem depender do botão do Central ainda).

### Etapa 2 — Componente "Enviar mensagem para WhatsApp" no Central
1. Criar o componente **genérico e reutilizável**, seguindo os padrões já usados no sistema (Vanilla JS + Tailwind), responsável por:
   - Buscar contatos elegíveis no Firestore (regra de escopo definida por cada modal)
   - Montar textos personalizados por contato a partir de um modelo editável (Texto 1 / Texto 2)
   - Capturar a imagem correspondente (via `html2canvas`, reaproveitada ou nova, conforme o modal)
   - Exibir a **prévia** (imagem + textos + lista de contatos) antes de confirmar o envio
   - Copiar a imagem para o clipboard (`navigator.clipboard.write()`) e chamar `chrome.runtime.sendMessage(EXTENSION_ID, {...})`
   - Mostrar **progresso em tempo real** por contato e o **resumo final** (enviado / erro / pulado)
   - Tratar os casos de extensão não instalada (mensagem com instrução) e WhatsApp não logado (aviso + aguardar confirmação)
2. Integrar esse componente em **um único modal de teste primeiro**, para validar a comunicação ponta a ponta com a extensão da Etapa 1.
3. Só depois replicar o botão nos demais modais, cada um configurando sua própria imagem/texto/sequência/escopo de contatos.

### Fora do escopo desta implementação (fica para etapa futura)
- Restringir o envio apenas aos usuários autenticados dedicados do Central (identificação de quem está logado na plataforma antes de permitir o disparo pela extensão).

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
- [x] Estrutura de arquivos e padrão de projeto definidos
- [x] Localização no repositório decidida
- [x] Plano de execução por etapas documentado
- [ ] Implementação iniciada (Etapa 1 — extensão Chrome)
- [ ] Implementação iniciada (Etapa 2 — componente no Central)

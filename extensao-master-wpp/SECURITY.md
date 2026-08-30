# Modelo de segurança — Master WhatsApp App

## Modelo de ameaças

Esta extensão executa ações automatizadas dentro da conta WhatsApp Web logada do
usuário (digita, cola imagem, envia). Os principais riscos considerados:

| Ameaça | Mitigação |
|---|---|
| Página web maliciosa (ou qualquer origem que não seja o Central) aciona a extensão para enviar mensagens não autorizadas | `externally_connectable.matches` restringe quem pode chamar `chrome.runtime.sendMessage`/`connectExternal` a `https://master-ecossistemaprofessor.web.app/*`. Além disso, `sender.origin` é revalidado em runtime em `background.js` antes de processar qualquer payload — não se confia apenas na configuração do manifest. |
| Payload malformado ou malicioso força comportamento inesperado (ex.: telefone com script embutido, texto gigante, milhares de contatos) | Toda entrada passa por `app/shared/validation.js` antes de qualquer ação — telefone validado por regex de dígitos, texto com limite de tamanho, lista de contatos com limite de itens. Payload inválido é rejeitado com erro, nada é executado. |
| Código de terceiros injetado via CDN comprometido (supply chain) | Nenhuma dependência externa em runtime — `content_security_policy` bloqueia scripts que não sejam `'self'` e `object-src 'none'`. Todo código é local, versionado no repositório. |
| Vazamento de dados de mensagens (conteúdo sensível de aulas/clientes) | Nada é persistido em `chrome.storage` nem em log. A fila de envio existe só em memória (RAM) durante o processamento e é descartada ao concluir. O clipboard só é lido no momento exato de colar a imagem — nunca monitorado passivamente em background. |
| Uso da extensão por qualquer conta do Chrome, não só operadores autorizados do Central | **Não coberto nesta versão** — ver "Fora do escopo" abaixo. |

## Permissões solicitadas — justificativa

| Permissão | Por quê |
|---|---|
| `clipboardRead` | `content.js` precisa ler a imagem do clipboard do sistema (colocada lá pelo Central via `navigator.clipboard.write()`) para colar no chat do WhatsApp Web. |
| `tabs` | `background.js` precisa abrir/navegar a aba do WhatsApp Web para o número de cada contato, e fechá-la ao concluir o envio. |
| `scripting`/content script | Necessário para `content.js` interagir com o DOM de `web.whatsapp.com` (digitar, colar, clicar em enviar). |
| `storage` | Reservada para estado interno de execução da extensão (ex.: configuração local futura); não é usada hoje para persistir conteúdo de mensagens ou dados de contato. |

## Política de dados

- **O que é persistido**: nada. Nenhum conteúdo de mensagem, nome ou telefone de
  contato é gravado em `chrome.storage`, `localStorage` ou qualquer log do console em
  produção.
- **O que fica em memória**: a fila de contatos e os textos do payload, apenas durante o
  processamento da chamada em curso. Descartados ao final (sucesso ou erro).
- **O clipboard**: lido uma vez por contato, no momento exato de colar a imagem —
  nunca monitorado continuamente.

## Fora do escopo desta versão (0.1.0)

- **Restringir o disparo a usuários autenticados dedicados do Central**: hoje qualquer
  sessão do Chrome com a extensão instalada e a origem correta pode acionar o envio, sem
  checagem de qual usuário está logado no Central. Esse refinamento está registrado em
  `instrucoesWppWebExtencao.md` como item para uma etapa futura.
- **Distribuição/atualização automática**: a extensão é instalada manualmente em modo
  desenvolvedor; não há mecanismo de auto-update (comum para extensões não publicadas na
  Web Store).

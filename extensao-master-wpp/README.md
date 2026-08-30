# Master WhatsApp App

Extensão Chrome (Manifest V3) de uso interno da Master Educação. Recebe um comando do
SistemaMaster Central e envia mensagens (texto + imagem) automaticamente pelo WhatsApp
Web para uma lista de contatos, sem exigir cliques manuais após o disparo.

Não é publicada na Chrome Web Store — distribuição via pasta/zip privada (GitHub).

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta `extensao-master-wpp/`.
4. Confirme que o ID da extensão exibido é `cfkopcmokdidmcpnkhhemgfekgkkafco` — esse ID é
   fixo (gerado a partir da chave pública em `manifest.json`) e não muda entre
   reinstalações, desde que a chave pública não seja alterada.

> A chave privada correspondente (`key.pem`) não é versionada (`.gitignore`). Sem ela,
> não é possível gerar builds assinados com o mesmo ID fora desta máquina/pasta — para
> outra máquina de desenvolvimento, copie a pasta inteira (incluindo `key.pem`, fora do
> Git) ou gere um novo par de chaves e atualize `EXTENSION_ID` nos consumidores.

## Formato do payload de integração

O sistema chama a extensão via `chrome.runtime.sendMessage`:

```javascript
const EXTENSION_ID = 'cfkopcmokdidmcpnkhhemgfekgkkafco';

chrome.runtime.sendMessage(EXTENSION_ID, {
  contatos: [
    { nome: 'João Silva', telefone: '5511999999999' },
    { nome: 'Prof. Ana', telefone: '5521888888888' },
  ],
  texto1: 'Olá, [nome]! Segue o cronograma...', // "[nome]" é substituído pelo nome de cada contato
  imagem: true,   // true = a extensão espera encontrar uma imagem no clipboard (copiada pelo Central antes da chamada)
  texto2: 'Qualquer dúvida estamos à disposição!',
}, resposta => {
  // resposta = { ok: true, resumo: [{ nome, telefone, status: 'enviado'|'erro'|'pulado', detalhe }] }
  // ou        { ok: false, erro: '...' } se o payload for rejeitado antes de iniciar o envio
});
```

Regras de validação (ver `app/shared/validation.js` e `app/shared/constants.js`):
- `contatos`: array não vazio, máximo 200 itens; cada item precisa de `nome` (string não
  vazia) e `telefone` (10 a 13 dígitos, com ou sem formatação/DDI).
- `texto1`: obrigatório, string não vazia, até 4096 caracteres.
- `texto2`: opcional, mesmas regras de `texto1` se enviado.
- `imagem`: opcional, deve ser `boolean` se enviado.

Só a origem `https://master-ecossistemaprofessor.web.app` pode chamar a extensão
(`externally_connectable` no `manifest.json`); qualquer outra origem recebe
`{ ok: false, erro: 'Origem não autorizada.' }`.

Para progresso em tempo real por contato (em vez de só o resumo final), use
`chrome.runtime.connectExternal(EXTENSION_ID)` e escute mensagens do tipo `PROGRESSO`
(um resultado por contato conforme processado) e `CONCLUIDO`/`ERRO` ao final.

## Estrutura

```
extensao-master-wpp/
├── manifest.json        Manifest V3: permissões, ID fixo, externally_connectable, CSP
├── package.json          apenas dependência de dev (test runner nativo do Node)
├── icons/                 ícones da extensão (chrome://extensions e barra de ferramentas)
├── app/                    tudo que é funcional da extensão
│   ├── background/         service worker — orquestra a fila de envio
│   ├── content/             injetado em web.whatsapp.com — digitação, paste, envio
│   └── shared/               validação de payload e constantes (delays, regex, limites)
└── tests/                 testes unitários (node --test) das funções de app/shared/validation.js
```

## Testes

```bash
npm test
# ou: node --test tests/validation.test.js
```

## Limitações conhecidas

Os seletores DOM usados em `app/content/content.js` para localizar a caixa de texto e o
botão de enviar do WhatsApp Web podem quebrar quando o WhatsApp muda sua interface — não
há garantia de estabilidade de longo prazo nesse ponto (ver aviso de manutenção no topo
do arquivo). Testar manualmente após qualquer atualização perceptível do WhatsApp Web.

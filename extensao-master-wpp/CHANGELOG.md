# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
versionamento seguindo [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] - Não lançado

### Adicionado
- Estrutura inicial da extensão (Manifest V3): `manifest.json` com permissões mínimas,
  ID fixo via chave RSA, `externally_connectable` restrito ao domínio do Central, CSP.
- `app/background/background.js`: recebe payload via `onMessageExternal`/`onConnectExternal`,
  valida, orquesta a fila de envio por contato (abre aba, delay aleatório 1–3s, fecha aba).
- `app/content/content.js`: injetado em `web.whatsapp.com` — verifica login/número
  existente, simula digitação, cola imagem do clipboard, envia.
- `app/shared/validation.js` e `app/shared/constants.js`: validação de telefone/texto/payload.
- `tests/validation.test.js`: testes unitários (`node --test`) das funções de validação.
- `README.md`, `SECURITY.md`.

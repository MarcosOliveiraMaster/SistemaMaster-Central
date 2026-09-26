# 🔐 Guia de Segurança — Master Educação Painel Admin

## Arquivos entregues

| Arquivo | O que faz |
|---|---|
| `firebase-config.js` | Config centralizada do Firebase (substitui duplicatas) |
| `auth.js` | Login, logout, App Check, rate limiting, sanitização |
| `login.html` | Tela de login com redefinição de senha |
| `index.html` | Painel com guard de autenticação e botão Sair |
| `firestore.rules` | Regras do Firestore — bloqueia acesso não autorizado |

---

## 1 — Implantação passo a passo

### Passo 1 · Criar os usuários no Firebase Auth

1. Acesse https://console.firebase.google.com → seu projeto
2. Vá em **Authentication → Users → Add user**
3. Adicione:
   - `mastereducacaoadm@gmail.com` com uma senha temporária
   - `marcos.lucas.ti@gmail.com` com uma senha temporária
4. Após criar, peça para cada um usar **"Esqueci minha senha"** na tela de login
   para definir a própria senha

> ⚠️ Ative **"E-mail/Senha"** em Authentication → Sign-in method se ainda não estiver ativo.

---

### Passo 2 · Publicar as Firestore Security Rules

As regras ficam versionadas no repositório **SistemMaster-Login**
(`firestore.rules`), não neste. Publique sempre a partir de lá:

```
cd SistemMaster-Login
npx firebase emulators:exec --only firestore --project demo-test "node tests/firestore.rules.test.mjs"
firebase deploy --only firestore:rules
```

Os testes conferem, entre outras coisas, que os dois e-mails de administrador
continuam reconhecidos. Evite editar direto no Console: foi assim que um erro
de digitação no e-mail (`marcos.lucas.tai@…`) bloqueou a central inteira.

Resultado: nenhuma pessoa consegue ler ou gravar dados sem estar autenticada
com um dos dois e-mails autorizados.

---

### Passo 3 · Ativar Firebase App Check

1. Firebase Console → **App Check**
2. Clique em **Get started** → selecione o app Web
3. Escolha **reCAPTCHA v3**
4. Cole a **chave secreta** (a que está guardada com você)
5. Clique em **Save**
6. Em **Apps**, clique em **Enforce** para ativar a proteção

---

### Passo 4 · Substituir os arquivos no projeto

1. Copie `firebase-config.js`, `auth.js` e `login.html` para a raiz do projeto
2. Substitua `index.html` pelo arquivo entregue
3. **Remova** as configurações do Firebase duplicadas em:
   - `banco.js` (bloco `const firebaseConfig = { ... }` e `firebase.initializeApp(...)`)
   - `functions-dashboardCliente.js` (bloco idêntico dentro de `initializeFirebase()`)

**Em banco.js**, substitua o bloco de inicialização por:

```js
// banco.js — início do arquivo
// Usa a instância já criada por auth.js
let app = firebase.apps.length ? firebase.apps[0] : null;
let db  = app ? app.firestore() : null;
```

**Em functions-dashboardCliente.js**, substitua `initializeFirebase()` por:

```js
async initializeFirebase() {
  // Reutiliza instância global criada por auth.js
  this.firebaseApp = firebase.apps[0];
  this.firestore   = this.firebaseApp.firestore();
}
```

---

## 2 — O que cada proteção faz

### Autenticação (login.html + auth.js)
- Usuário precisa fazer login com e-mail e senha
- Apenas os 2 e-mails autorizados passam — qualquer outro é bloqueado imediatamente
- Sessão dura apenas enquanto a aba está aberta (`SESSION` persistence)
- Ao fechar o navegador, é deslogado automaticamente

### Rate Limiting (auth.js)
- Máximo de **5 tentativas** de senha errada
- Bloqueio por **15 minutos** após exceder o limite
- Armazenado em `sessionStorage` — não persiste entre abas

### App Check (auth.js + Firebase Console)
- O reCAPTCHA v3 verifica que o request vem do seu site real
- Bloqueia bots e scripts que tentem acessar o Firestore diretamente
- Invisível para o usuário

### Firestore Rules (firestore.rules)
- **Última linha de defesa**: mesmo que alguém descubra a API key,
  não consegue ler nem gravar dados sem estar autenticado com os e-mails certos
- E-mail precisa estar **verificado** (`email_verified == true`)
- Regra padrão `allow read, write: if false` bloqueia qualquer coleção não listada

### Sanitização de inputs (auth.js)
- Campos de login têm `sanitizeText()` aplicado antes de qualquer uso
- Previne XSS básico nos campos de autenticação

---

## 3 — Outras melhorias recomendadas (próximos passos)

### Remover PII dos console.log
Substitua linhas como:
```js
console.log('✅ 120 clientes carregados');      // OK
console.log('CPF do cliente:', cliente.cpf);    // ❌ remover
console.log('Buscando cliente por CPF:', cpf);  // ❌ remover
```

### innerHTML com dados do usuário
Em `functions-banco-de-aulas-Cards.js` e outros, strings do Firebase são
inseridas via template literals em innerHTML. Use sempre `escapeHtml()` 
(já existe no projeto) antes de inserir qualquer dado do banco.

### HTTPS
Se hospedar no Firebase Hosting, HTTPS já está ativo por padrão.
Se usar outro servidor, ative SSL obrigatório.

### Content Security Policy (CSP)
Adicione no `<head>` de `index.html` e `login.html`:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self' https:; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com;">
```

---

## 4 — Bloqueio na borda: Cloudflare Access

O login do Firebase (seção 2) protege os **dados**, mas os arquivos do site
(`index.html` e os `.js`) continuam sendo entregues a qualquer visitante. Para
que só os dois e-mails consigam sequer abrir `central.mastereducacao.app.br`,
coloque o domínio atrás do Cloudflare Access (Zero Trust, gratuito até 50
usuários). Não exige mudança no código.

1. Confirme que o domínio está na Cloudflare: painel da Cloudflare →
   **Workers & Pages** → projeto do Central → **Custom domains** deve listar
   `central.mastereducacao.app.br`.
2. **Zero Trust** → (na primeira vez, escolha um nome de equipe e o plano Free).
3. **Settings → Authentication → Login methods**: deixe ativo o
   **One-time PIN** (código por e-mail). Opcional: adicione **Google**.
4. **Access → Applications → Add an application → Self-hosted**:
   - Application name: `Master Central`
   - Session duration: `24 hours` (ou o que preferir)
   - Application domain: `central.mastereducacao.app.br` (path vazio = site todo)
   - Se o projeto do Pages também responde em `*.pages.dev`, adicione esse
     domínio na mesma aplicação — senão ele fica aberto.
5. Policy:
   - Name: `Somente administradores` · Action: **Allow**
   - Include → **Emails**: `marcos.lucas.ti@gmail.com`, `mastereducacaoadm@gmail.com`
6. Salve e teste numa janela anônima: deve aparecer a tela da Cloudflare
   pedindo o e-mail; qualquer outro e-mail não recebe código.

Depois disso o acesso fica em duas etapas: código da Cloudflare (bloqueia
quem não é admin antes de baixar qualquer arquivo) → login do Firebase
(libera os dados via Firestore Rules).

---

## 5 — Fluxo de acesso após implementação

```
Usuário acessa central.mastereducacao.app.br
        ↓
Cloudflare Access: e-mail está na policy? → não: bloqueado (nada é baixado)
        ↓
auth.js verifica onAuthStateChanged
        ↓
  Não logado? → redirect para login.html
  Logado mas e-mail não autorizado? → logout + redirect
  Logado e autorizado? → app carrega normalmente
        ↓
login.html
  → preenche e-mail + senha
  → rate limiting verifica tentativas
  → Firebase Auth valida
  → whitelist verifica e-mail
  → redirect para index.html
```

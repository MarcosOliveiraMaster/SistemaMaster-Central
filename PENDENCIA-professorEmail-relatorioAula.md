# Pendência: migrar autorização de "Relatório de Aula" e "Aula concluída" de professorUid para professorEmail

> Guardado em 2026-08-25. Objetivo: dar contexto completo pra retomar isso no futuro
> sem precisar re-investigar do zero. Ler inteiro antes de mexer nas regras do Firestore
> ou nos fluxos de atribuição de professor.

## Sintomas originais
Professores com `idProfessor` e `professorUid` definidos na aula, que aparecem
corretamente tanto para o professor quanto pro admin, ainda assim não conseguiam:
1. Enviar o **"Relatório de Aula"** (`RelatorioAula`) — erro de permissão no
   Firestore.
2. Clicar em **"Marcar aula como concluída"** (`ConfirmacaoProfessorAula`) —
   mesmo erro de permissão, mesma causa.

Os dois botões vivem no mesmo card de aula em `SistemMaster-Login/professor.js`
e são funcionalmente irmãos: ambos são updates de um único campo, protegidos
por regras do Firestore com a mesma condição de posse.

## Causa raiz (confirmada no código, não é suposição)
- Há 3 partes envolvidas, todas compartilhando o mesmo projeto Firestore
  (`master-ecossistemaprofessor`):
  - **`SistemaMaster-Central`** — painel admin (login restrito a 2 e-mails, ver
    `firebase-config.js` / `auth.js`).
  - **`SistemMaster-Login`** — portal do professor (`professor.js`, `auth.js`),
    onde o professor loga com a própria conta Firebase Auth.
  - Firestore Security Rules — versionadas em `SistemMaster-Login/firestore.rules`
    e deployadas de lá via `firebase deploy --only firestore:rules` (projeto
    `master-ecossistemaprofessor`, config em `SistemMaster-Login/.firebaserc` e
    `firebase.json`).
- `professorUid` das aulas é copiado de `dataBaseProfessores.uid` no momento da
  atribuição (`functions-banco-de-aulas-Cards.js:1403-1434`, e no modal de seleção
  de professor `showProfessorModal` ~linha 4153).
- `dataBaseProfessores.uid` só fica correto quando a conta do professor é criada
  pela primeira vez pelo painel (`authProfessores.js`, fluxo "Atualizar
  Permissões"). Quando a conta do Firebase Auth **já existia**, o código não
  sincroniza o uid — resolver isso exigiria Admin SDK (`auth.getUserByEmail`),
  indisponível no client-side e sem Cloud Functions (plano Spark). O código só
  marca `precisaVerificarUid: true` no cadastro do professor e depende de rodar
  manualmente `SistemMaster-Login/corrigir-uid-aulas.js` depois (ver
  `authProfessores.js:900-926`).
- A regra do Firestore para `update` de `RelatorioAula` **e** de
  `ConfirmacaoProfessorAula` (são duas regras `allow update` distintas, uma por
  campo, mas com a mesma condição) exige
  `resource.data.professorUid == request.auth.uid`. Se o uid da aula estiver
  desatualizado, a escrita é negada nos dois casos — mesmo a aula sendo do
  professor certo.
- A LEITURA funciona porque `professor.js` busca as aulas do professor por
  `where('idProfessor', '==', cpfProf)` — usa o CPF, não o uid. Por isso o
  sintoma é sempre "aparece certo, mas a ação de escrita falha".
- `corrigir-uid-aulas.js` já rodou em produção em 2026-08-21, corrigindo o backlog
  da época (relatórios em `SistemMaster-Login/relatorio-correcao-uid-*.json`). Mas
  o gap na ORIGEM (fluxo de concessão de acesso) continua existindo — qualquer
  professor que ganhe acesso com conta pré-existente volta a sofrer o mesmo bug,
  afetando os dois botões ao mesmo tempo (é o mesmo campo `professorUid` na aula).
- `SistemMaster-Login/set-professor-claims.js` (custom claim `{professor:true}`,
  usado em outras regras como `informacoesPagamento`) tem a MESMA fragilidade:
  pula professores sem `uid` em `dataBaseProfessores`. Ou seja, **não é um
  substituto confiável** pra contornar o problema do uid — sofre do mesmo gap.

## Decisão tomada em 2026-08-25 (mitigação temporária, não é a solução definitiva)
A exigência `resource.data.professorUid == request.auth.uid` foi
comentada/removida em **4 lugares** no `SistemMaster-Login/firestore.rules`,
mantendo só `isAuthenticated()`:

| # | Coleção | Campo protegido | Botão / fluxo no app | Status |
|---|---|---|---|---|
| 1 | `BancoDeAulas-Lista` | `RelatorioAula` | "Enviar relatório" (`professor.js:937`) | **Deployado** em produção 2026-08-25 |
| 2 | `BancoDeAulas-Lista` | `ConfirmacaoProfessorAula` | "Marcar aula como concluída" (`professor.js:994`) | **Deployado** em produção 2026-08-25 |
| 3 | `BancoDeAulas` | `RelatorioAula` | espelho do item 1 | **Deployado** em produção 2026-08-25 |
| 4 | `BancoDeAulas` | `ConfirmacaoProfessorAula` | espelho do item 2 | **Deployado** em produção 2026-08-25 |

Trade-off aceito conscientemente: qualquer usuário autenticado no projeto (não
só professores — em teoria também clientes, que também autenticam no mesmo
projeto Firebase) passa a poder gravar `RelatorioAula`/`ConfirmacaoProfessorAula`
em qualquer aula, não só nas próprias, até a migração pra `professorEmail` ser
feita. Os 4 pontos já estão ativos em produção (dois deploys em 2026-08-25).

## O que fazer quando formos resolver de verdade
1. Adicionar campo **`professorEmail`** às aulas (`BancoDeAulas-Lista` e array
   `aulas[]` de `BancoDeAulas`), copiado de `dataBaseProfessores.email` no
   momento da atribuição — mesmo padrão hoje usado pra `idProfessor`/
   `professorUid` (`functions-banco-de-aulas-Cards.js:1403-1434`,
   `showProfessorModal` ~4153, `updateProfessorAula` em `banco.js:365+`).
   Motivo de usar e-mail: `request.auth.token.email` já vem pronto em todo ID
   token do Firebase Auth, sem precisar de Admin SDK/custom claim — elimina a
   classe inteira desse bug de sincronização, pros dois campos ao mesmo tempo
   (é o mesmo `professorEmail` que autoriza ambos).
2. Publicar regra do Firestore com **fallback duplo primeiro**, nas 4 regras
   (as duas de `RelatorioAula` e as duas de `ConfirmacaoProfessorAula`):
   `resource.data.professorEmail == request.auth.token.email || resource.data.professorUid == request.auth.uid`
   (mais `request.auth.token.email_verified == true`), pra não quebrar nada
   durante a transição — inclusive se o `professorUid` ainda estiver certo pra
   algum professor, continua funcionando pelos dois caminhos.
3. Rodar script de backfill em `SistemMaster-Login` (variante mais simples do
   `corrigir-uid-aulas.js` — sem depender de `auth.getUserByEmail`, só join
   Firestore→Firestore por CPF entre `BancoDeAulas-Lista`/`BancoDeAulas` e
   `dataBaseProfessores`) pra popular `professorEmail` em todas as aulas com
   `idProfessor` preenchido. Um único backfill resolve os dois botões, já que
   os dois dependem do mesmo campo de posse.
4. Rodar de novo em modo dry-run e confirmar que não sobrou aula sem
   `professorEmail` (tratar os mesmos casos de exceção do script atual: CPF
   duplicado, aula sem correspondência, etc. — nunca "adivinhar").
5. Restaurar (agora via e-mail) a checagem de posse nas 4 regras de `update` —
   remover a cláusula `professorUid` comentada em 2026-08-25 (itens 1-4 da
   tabela acima), deixando só `professorEmail == request.auth.token.email`.
   Fazer os 4 de uma vez, pra não deixar relatório e confirmação em estados
   de segurança diferentes.
6. Testar os dois fluxos de ponta a ponta com um professor real antes de
   considerar concluído: enviar relatório e marcar aula como concluída.
7. (Opcional/limpeza) considerar aposentar `professorUid` nas aulas, já que
   deixaria de ser necessário pra autorização depois do passo 5.

## Arquivos relevantes
- `SistemaMaster-Central/functions-banco-de-aulas-Cards.js` — atribuição de
  professor às aulas (linhas ~1403-1434 e ~4153+); é onde `professorEmail`
  precisa passar a ser gravado junto com `idProfessor`/`professorUid`.
- `SistemaMaster-Central/banco.js` — `updateRelatorioAula` e funções irmãs (sem
  filtro de posse no código; a proteção real é a regra do Firestore).
- `SistemaMaster-Central/authProfessores.js` — concessão de acesso à plataforma,
  origem do gap de sync do uid (linhas ~900-926).
- `SistemMaster-Login/professor.js` — os dois fluxos afetados:
  - linha ~937 — `updateDoc(doc(db,'BancoDeAulas-Lista', docId), { RelatorioAula })`
  - linha ~994 — `updateDoc(doc(db,'BancoDeAulas-Lista', docId), { ConfirmacaoProfessorAula: true })`
  Nenhum dos dois precisa mudar quando migrarmos pra `professorEmail` — a
  autorização é só na regra do Firestore, o client já manda só o campo relevante.
- `SistemMaster-Login/auth.js` — resolução do professor no login (linhas
  ~356-391), tem um self-heal parcial de uid que só age se o campo estiver
  vazio, não se estiver errado.
- `SistemMaster-Login/corrigir-uid-aulas.js` — script de correção retroativa já
  existente, usar como referência de padrão (limites de escrita, dry-run,
  relatório JSON, nunca "adivinha" CPF duplicado/ambíguo).
- `SistemMaster-Login/set-professor-claims.js` — custom claim `professor:true`,
  mesma fragilidade do uid.
- `SistemMaster-Login/firestore.rules` — fonte de verdade das regras (versionada
  e deployável via `firebase deploy --only firestore:rules --project
  master-ecossistemaprofessor`). É aqui que ficam marcados com comentário
  `// TEMP 2026-08-25` os 4 pontos da mitigação atual, e é aqui que a migração
  do passo 5 precisa mexer.

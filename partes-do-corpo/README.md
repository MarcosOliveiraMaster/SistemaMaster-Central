# Partes do Corpo | Body Parts

Aula interativa de inglês sobre partes do corpo, com 12 itens e 5 atividades.

## Como abrir

É uma aplicação estática, sem build e sem dependências. Basta abrir
`partes-do-corpo/index.html` — funciona tanto servida por HTTP (Cloudflare
Pages / Firebase Hosting, junto com o resto do site) quanto por duplo clique
no arquivo (`file://`), útil para usar em sala sem internet.

## Seções (menu do topo)

| Seção | O que faz |
|---|---|
| **Partes do corpo** | Grid de 12 cards: imagem animada + nome em português + nome em inglês + transcrição fonética. Clique no card = pronúncia em inglês. "Ouvir todas" percorre os 12. |
| **Jogo da memória** | 24 cartas = 12 pares, cada desenho combinando com o seu nome em inglês. Conta jogadas, tempo e guarda o recorde. |
| **Forca** | Interface toda em português; a palavra a descobrir e a dica ficam **em inglês**. 6 erros permitidos, aceita clique ou teclado físico, e a dica pode ser ouvida. |
| **Liga pontos** | 6 desenhos à esquerda e 6 nomes em inglês à direita. Liga arrastando ou tocando em um lado e depois no outro; as ligações corretas ficam desenhadas em verde. |
| **Caça-palavras** | Grade 10x10 com **6 palavras**, re-sorteadas a cada carregamento da página e a cada "Novo jogo". Aceita as 8 direções, para frente e para trás. |

## Stack

Sem framework e sem etapa de build, no mesmo padrão do resto do repositório:

- **HTML + CSS + JavaScript (ES5, scripts clássicos)** — nada de módulos, para
  continuar funcionando via `file://`.
- **SVG inline animado por CSS** para as ilustrações. Cada figura desenha a
  parte-alvo em destaque sobre um contexto em tom neutro, e a animação usa
  `transform-box: view-box` com pivôs em coordenadas do `viewBox`.
- **Web Speech API** (`speechSynthesis`) para a pronúncia em inglês — por isso
  não há nenhum arquivo de áudio no repositório. A voz preferida é `en-US`.
- **Web Audio API** para os efeitos curtos de acerto, erro e vitória.
- **localStorage** para o recorde da memória e a preferência de som.

## Arquivos

```
partes-do-corpo/
├── index.html              estrutura das 5 seções + navegação
├── css/estilo.css          design system, animações das figuras, layouts
└── js/
    ├── dados.js            as 12 partes (pt, en, fonética, dica, SVG) + utilitários
    ├── audio.js            pronúncia (fala) e efeitos sonoros
    ├── cards.js            seção 1 — grid de cards
    ├── memoria.js          seção 2 — jogo da memória
    ├── forca.js            seção 3 — forca
    ├── ligar.js            seção 4 — liga pontos
    ├── caca-palavras.js    seção 5 — caça-palavras
    └── app.js              navegação, ícones, modal e helpers de interface
```

## Como incluir ou trocar uma parte do corpo

Todo o conteúdo mora em `js/dados.js`. Cada item do array `PARTES` precisa de
`id`, `pt`, `en`, `fonetica`, `dica` (em inglês) e `svg`. As cinco seções leem
a mesma lista, então incluir um item novo já o faz aparecer em todas — só a
seção de cards e a memória assumem os 12 itens no placar (`0/12`), que se
ajusta sozinho por usar `BP.PARTES.length`.

Para animar uma parte nova, use no SVG uma das classes `an-*` já definidas em
`estilo.css` (ou crie a sua, lembrando de definir `transform-origin` em
unidades do `viewBox`). Membros ficam melhores desenhados como "tubos":
um `path` com a classe `tubo-borda` atrás e outro igual com a classe `tubo`.

## Acessibilidade

- Navegação por teclado em todas as atividades (a forca aceita as letras
  digitadas direto; os itens do liga pontos respondem a Enter/Espaço).
- `aria-label` nos cards, cartas e itens, e `aria-live` nos avisos.
- `@media (prefers-reduced-motion: reduce)` desliga as animações.
- Botão de som com estado persistido, para quem precisa de silêncio.

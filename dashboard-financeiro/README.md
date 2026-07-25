# Dashboard Financeiro — Master Educação

Página em **React + TypeScript + Apache ECharts** (com ECharts GL para o
gráfico 3D) que consolida o histórico financeiro de 2022 a julho/2026 e
projeta faturamento e número de clientes até 2030 com o **método de Holt de
tendência amortecida**.

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento (http://localhost:5173)
npm run build    # gera a versão final em dist/
npm run preview  # serve a versão de dist/
```

## O que a página contém

1. **Base de informações** — tabela mensal com Ano, Mês, Número de clientes,
   Faturamento, Lucro e Despesa com equipe, com totais do período filtrado e
   exportação para CSV.
2. **Histórico** (gráficos empilhados, com tooltip e controle deslizante):
   - Barra: Faturamento × Ano
   - Barra: Faturamento × Número de clientes (cada barra é um ano)
   - Barra: Número de clientes × Ano
   - **3 eixos**: dispersão 3D Faturamento × Nº de clientes × Ano (pontos
     mensais; arraste para girar)
3. **Projeção até 2030** — os mesmos 4 tipos de gráfico, prolongados com a
   projeção de Holt amortecida; barras/pontos projetados aparecem em tom
   claro hachurado e o tooltip indica “projeção”.
4. **Filtros à direita** — anos, intervalo de meses (comparar o mesmo
   período entre anos) e horizonte da projeção.

## Fontes dos dados (`src/data/base.ts`)

| Período | Fonte | Observações |
| --- | --- | --- |
| 2022–2024 | `CRM.xlsx` (aba PlanilhaDados01/ExibiçãoDados01) | Clientes e faturamento mensais reais. Lucro e despesa com equipe existem apenas como totais anuais (2023: lucro R$ 18.988,00 / equipe R$ 20.797,00 · 2024: lucro R$ 29.739,50 / equipe R$ 21.511,50) e foram distribuídos por mês proporcionalmente ao faturamento — linhas marcadas `estimado`. 2022 não tem registro de lucro/pagamentos no CRM; usa as margens de 2023. |
| 2025 | `Planilha sem título.xlsx` | 161 contratações agregadas por mês (Data de Contratação). Faturamento = soma de “Valor Contratação”, Lucro = soma de “Lucro Contratação”, Despesa equipe = diferença. |
| jan–jul/2026 | `DRE_2026_7meses.pdf` | Faturamento, lucro líquido e “Repasse Equipe” exatos por mês; nº de clientes = contratos listados em “Entradas”. |

## Projeção (Holt, tendência amortecida)

Implementada em `src/lib/holt.ts`:

- nível `l_t = α·y_t + (1−α)(l_{t−1} + φ·b_{t−1})`
- tendência `b_t = β(l_t − l_{t−1}) + (1−β)·φ·b_{t−1}`
- previsão `ŷ_{t+h} = l_t + (φ + φ² + … + φ^h)·b_t`

Os parâmetros (α, β, φ) são escolhidos por busca em grade minimizando o erro
quadrático um-passo-à-frente sobre a **série mensal completa** (55 meses).
As previsões mensais (ago/2026 – dez/2030) são então somadas por ano; 2026
aparece como “parcialmente projetado”. O método não modela sazonalidade —
ele amortece a tendência recente, o que dá projeções conservadoras.

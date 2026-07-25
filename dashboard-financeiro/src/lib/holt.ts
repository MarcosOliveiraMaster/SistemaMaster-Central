// Suavização exponencial de Holt com tendência amortecida (damped trend).
//
//   nível:     l_t = α·y_t + (1-α)·(l_{t-1} + φ·b_{t-1})
//   tendência: b_t = β·(l_t - l_{t-1}) + (1-β)·φ·b_{t-1}
//   previsão:  ŷ_{t+h} = l_t + (φ + φ² + … + φ^h)·b_t
//
// Os parâmetros (α, β, φ) são ajustados por busca em grade minimizando o
// erro quadrático das previsões um-passo-à-frente dentro da amostra.

export interface AjusteHolt {
  alpha: number;
  beta: number;
  phi: number;
  nivel: number;
  tendencia: number;
  sse: number;
}

export function ajustarHoltAmortecido(y: number[]): AjusteHolt {
  if (y.length < 3) {
    throw new Error('Holt exige pelo menos 3 observações');
  }
  let melhor: AjusteHolt | null = null;
  for (let alpha = 0.05; alpha <= 0.951; alpha += 0.05) {
    for (let beta = 0.05; beta <= 0.951; beta += 0.05) {
      for (let phi = 0.8; phi <= 0.981; phi += 0.02) {
        let l = y[0];
        let b = y[1] - y[0];
        let sse = 0;
        for (let t = 1; t < y.length; t++) {
          const prev = l + phi * b;
          const erro = y[t] - prev;
          sse += erro * erro;
          const lAnt = l;
          l = alpha * y[t] + (1 - alpha) * (l + phi * b);
          b = beta * (l - lAnt) + (1 - beta) * phi * b;
        }
        if (!melhor || sse < melhor.sse) {
          melhor = { alpha, beta, phi, nivel: l, tendencia: b, sse };
        }
      }
    }
  }
  return melhor!;
}

/** Previsões 1..h passos à frente a partir do estado final do ajuste. */
export function preverHolt(ajuste: AjusteHolt, h: number): number[] {
  const out: number[] = [];
  let somaPhi = 0;
  for (let i = 1; i <= h; i++) {
    somaPhi += Math.pow(ajuste.phi, i);
    out.push(ajuste.nivel + somaPhi * ajuste.tendencia);
  }
  return out;
}

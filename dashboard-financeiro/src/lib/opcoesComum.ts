import type { EChartsCoreOption } from 'echarts';
import { Tokens } from './theme';
import { brlCompacto } from './format';

export function tooltipPadrao(t: Tokens) {
  return {
    backgroundColor: t.surface,
    borderColor: t.border,
    textStyle: { color: t.ink, fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.18); border-radius: 8px;',
  };
}

export function eixoCategoria(t: Tokens, dados: (string | number)[]) {
  return {
    type: 'category' as const,
    data: dados,
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 },
  };
}

export function eixoValorBRL(t: Tokens) {
  return {
    type: 'value' as const,
    axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => brlCompacto(v) },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
  };
}

export function eixoValorInteiro(t: Tokens) {
  return {
    type: 'value' as const,
    axisLabel: { color: t.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
  };
}

/** Controle deslizante (dataZoom) horizontal padrão. */
export function sliderZoom(t: Tokens) {
  return [
    {
      type: 'slider' as const,
      height: 18,
      bottom: 8,
      borderColor: t.border,
      backgroundColor: 'transparent',
      fillerColor:
        t.surface === '#1a1a19' ? 'rgba(57,135,229,0.18)' : 'rgba(42,120,214,0.12)',
      handleStyle: { color: t.fat, borderColor: t.fat },
      moveHandleStyle: { color: t.axis },
      emphasis: { handleStyle: { color: t.fat } },
      textStyle: { color: t.muted, fontSize: 10 },
      brushSelect: false,
    },
  ];
}

/** Textura diagonal aplicada às barras projetadas (canal extra além da cor). */
export function decalProjecao() {
  return {
    symbol: 'rect',
    dashArrayX: [1, 0],
    dashArrayY: [3, 5],
    rotation: -Math.PI / 4,
    color: 'rgba(0,0,0,0.22)',
  };
}

export function opcaoBase(): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    animationDuration: 350,
  };
}

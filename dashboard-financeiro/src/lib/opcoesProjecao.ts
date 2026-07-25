import type { EChartsCoreOption } from 'echarts';
import { Tokens } from './theme';
import { AnoProjetado, MesProjetado } from './agregacao';
import { brl, inteiro, brlCompacto, MESES } from './format';
import {
  opcaoBase,
  tooltipPadrao,
  eixoCategoria,
  eixoValorBRL,
  eixoValorInteiro,
  sliderZoom,
  decalProjecao,
} from './opcoesComum';

function tooltipAnoProjetado(r: AnoProjetado, metrica: 'fat' | 'cli'): string {
  const total = metrica === 'fat' ? r.fatReal + r.fatProjetado : r.cliReal + r.cliProjetado;
  const fmt = metrica === 'fat' ? brl : inteiro;
  const rotulo = metrica === 'fat' ? 'Faturamento' : 'Clientes';
  let html = `<b>${r.ano}</b><br/>${rotulo}: <b>${fmt(total)}</b><br/>`;
  if (r.mesesReais > 0 && r.mesesProjetados > 0) {
    html +=
      `Realizado (${r.mesesReais} meses): ${fmt(metrica === 'fat' ? r.fatReal : r.cliReal)}<br/>` +
      `Projetado (${r.mesesProjetados} meses): ${fmt(metrica === 'fat' ? r.fatProjetado : r.cliProjetado)}<br/>` +
      `<div style="opacity:.7">(ano parcialmente projetado)</div>`;
  } else if (r.mesesProjetados > 0) {
    html += `<div style="opacity:.7">(projeção Holt amortecida)</div>`;
  }
  return html;
}

/** P1. Barra: Faturamento x Ano — realizado + projeção até o horizonte */
export function optProjFaturamentoAno(t: Tokens, anos: AnoProjetado[]): EChartsCoreOption {
  return {
    ...opcaoBase(),
    tooltip: {
      ...tooltipPadrao(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = (params as { dataIndex: number }[])[0];
        return tooltipAnoProjetado(anos[p.dataIndex], 'fat');
      },
    },
    legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 70, right: 20, top: 32, bottom: 56 },
    xAxis: eixoCategoria(t, anos.map((r) => r.ano)),
    yAxis: eixoValorBRL(t),
    dataZoom: sliderZoom(t),
    series: [
      {
        name: 'Realizado',
        type: 'bar',
        stack: 'fat',
        data: anos.map((r) => (r.fatReal > 0 ? r.fatReal : null)),
        itemStyle: { color: t.fat, borderRadius: [0, 0, 0, 0] },
        barMaxWidth: 48,
      },
      {
        name: 'Projeção',
        type: 'bar',
        stack: 'fat',
        data: anos.map((r) => (r.fatProjetado > 0 ? r.fatProjetado : null)),
        itemStyle: { color: t.fatProj, borderRadius: [4, 4, 0, 0], decal: decalProjecao() },
        barMaxWidth: 48,
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 10,
          formatter: ({ dataIndex }: { dataIndex: number }) => {
            const r = anos[dataIndex];
            return brlCompacto(r.fatReal + r.fatProjetado);
          },
        },
      },
    ],
  };
}

/** P2. Barra: Faturamento x Número de clientes — com anos projetados até o horizonte */
export function optProjFaturamentoClientes(t: Tokens, anos: AnoProjetado[]): EChartsCoreOption {
  const ordenado = [...anos].sort(
    (a, b) => a.cliReal + a.cliProjetado - (b.cliReal + b.cliProjetado),
  );
  const categorias = ordenado.map((r) => inteiro(r.cliReal + r.cliProjetado));
  return {
    ...opcaoBase(),
    tooltip: {
      ...tooltipPadrao(t),
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { dataIndex: number };
        const r = ordenado[p.dataIndex];
        return (
          `<b>${r.ano}</b><br/>` +
          `Clientes: <b>${inteiro(r.cliReal + r.cliProjetado)}</b><br/>` +
          `Faturamento: <b>${brl(r.fatReal + r.fatProjetado)}</b>` +
          (r.mesesProjetados > 0 ? `<div style="opacity:.7">(contém projeção)</div>` : '')
        );
      },
    },
    legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 70, right: 20, top: 32, bottom: 74 },
    xAxis: {
      ...eixoCategoria(t, categorias),
      name: 'Número de clientes',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: t.muted, fontSize: 11 },
    },
    yAxis: eixoValorBRL(t),
    dataZoom: sliderZoom(t),
    series: [
      {
        name: 'Realizado',
        type: 'bar',
        barGap: '-100%',
        data: ordenado.map((r) =>
          r.mesesProjetados === 0 ? r.fatReal + r.fatProjetado : null,
        ),
        itemStyle: { color: t.fat, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 48,
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 11,
          fontWeight: 'bold',
          formatter: ({ dataIndex }: { dataIndex: number }) => String(ordenado[dataIndex].ano),
        },
      },
      {
        name: 'Projeção',
        type: 'bar',
        barGap: '-100%',
        data: ordenado.map((r) =>
          r.mesesProjetados > 0 ? r.fatReal + r.fatProjetado : null,
        ),
        itemStyle: { color: t.fatProj, borderRadius: [4, 4, 0, 0], decal: decalProjecao() },
        barMaxWidth: 48,
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 11,
          fontWeight: 'bold',
          formatter: ({ dataIndex }: { dataIndex: number }) => String(ordenado[dataIndex].ano),
        },
      },
    ],
  };
}

/** P3. Barra: Número de clientes x Ano — realizado + projeção */
export function optProjClientesAno(t: Tokens, anos: AnoProjetado[]): EChartsCoreOption {
  return {
    ...opcaoBase(),
    tooltip: {
      ...tooltipPadrao(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = (params as { dataIndex: number }[])[0];
        return tooltipAnoProjetado(anos[p.dataIndex], 'cli');
      },
    },
    legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 56, right: 20, top: 32, bottom: 56 },
    xAxis: eixoCategoria(t, anos.map((r) => r.ano)),
    yAxis: eixoValorInteiro(t),
    dataZoom: sliderZoom(t),
    series: [
      {
        name: 'Realizado',
        type: 'bar',
        stack: 'cli',
        data: anos.map((r) => (r.cliReal > 0 ? r.cliReal : null)),
        itemStyle: { color: t.cli },
        barMaxWidth: 48,
      },
      {
        name: 'Projeção',
        type: 'bar',
        stack: 'cli',
        data: anos.map((r) => (r.cliProjetado > 0 ? r.cliProjetado : null)),
        itemStyle: { color: t.cliProj, borderRadius: [4, 4, 0, 0], decal: decalProjecao() },
        barMaxWidth: 48,
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 10,
          formatter: ({ dataIndex }: { dataIndex: number }) => {
            const r = anos[dataIndex];
            return inteiro(r.cliReal + r.cliProjetado);
          },
        },
      },
    ],
  };
}

/** P4. 3D: Faturamento x Clientes x Ano — meses reais e projetados até o horizonte */
export function optProjTresEixos(
  t: Tokens,
  meses: MesProjetado[],
  ateAno: number,
): EChartsCoreOption {
  const visiveis = meses.filter((m) => m.ano <= ateAno);
  const anos = [...new Set(visiveis.map((m) => m.ano))].sort();
  const ponto = (m: MesProjetado) => [String(m.ano), m.clientes, m.faturamento, m.mes];
  const fmt = (params: unknown) => {
    const p = params as { seriesName: string; value: [string, number, number, number] };
    const [ano, cli, fat, mes] = p.value;
    return (
      `<b>${MESES[mes - 1]} de ${ano}</b> — ${p.seriesName}<br/>` +
      `Clientes: <b>${inteiro(cli)}</b><br/>` +
      `Faturamento: <b>${brl(fat)}</b>`
    );
  };
  return {
    ...opcaoBase(),
    tooltip: { ...tooltipPadrao(t), formatter: fmt },
    legend: { top: 4, textStyle: { color: t.ink2, fontSize: 11 } },
    xAxis3D: {
      type: 'category',
      name: 'Ano',
      data: anos.map(String),
      nameTextStyle: { color: t.ink2, fontSize: 11 },
      axisLabel: { color: t.muted, fontSize: 10 },
      axisLine: { lineStyle: { color: t.axis } },
    },
    yAxis3D: {
      type: 'value',
      name: 'Clientes',
      nameTextStyle: { color: t.ink2, fontSize: 11 },
      axisLabel: { color: t.muted, fontSize: 10 },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { lineStyle: { color: t.grid } },
    },
    zAxis3D: {
      type: 'value',
      name: 'Faturamento',
      nameTextStyle: { color: t.ink2, fontSize: 11 },
      axisLabel: { color: t.muted, fontSize: 10, formatter: (v: number) => brlCompacto(v) },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { lineStyle: { color: t.grid } },
    },
    grid3D: {
      boxWidth: 130,
      boxDepth: 90,
      viewControl: { distance: 250, alpha: 18, beta: 35, rotateSensitivity: 1.6 },
      light: { main: { intensity: 1.1, shadow: false }, ambient: { intensity: 0.5 } },
      axisPointer: { show: true, lineStyle: { color: t.muted } },
    },
    series: [
      {
        name: 'Realizado',
        type: 'scatter3D',
        symbolSize: 10,
        itemStyle: { color: t.fat, opacity: 0.92 },
        data: visiveis.filter((m) => !m.projetado).map(ponto),
      },
      {
        name: 'Projeção',
        type: 'scatter3D',
        symbolSize: 10,
        itemStyle: { color: t.fatProj, opacity: 0.75 },
        data: visiveis.filter((m) => m.projetado).map(ponto),
      },
    ],
  };
}

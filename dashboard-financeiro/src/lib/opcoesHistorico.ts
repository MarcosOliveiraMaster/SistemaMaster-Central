import type { EChartsCoreOption } from 'echarts';
import { Tokens } from './theme';
import { LinhaBase } from '../data/base';
import { ResumoAnual } from './agregacao';
import { brl, inteiro, brlCompacto, MESES } from './format';
import {
  opcaoBase,
  tooltipPadrao,
  eixoCategoria,
  eixoValorBRL,
  eixoValorInteiro,
  sliderZoom,
} from './opcoesComum';

function notaPeriodo(r: ResumoAnual): string {
  const partes: string[] = [];
  if (r.meses < 12) partes.push(`soma de ${r.meses} meses`);
  if (r.estimado) partes.push('lucro/despesa estimados');
  return partes.length ? `<div style="opacity:.7">(${partes.join(' · ')})</div>` : '';
}

/** 1. Barra: Faturamento x Ano */
export function optFaturamentoAno(t: Tokens, resumo: ResumoAnual[]): EChartsCoreOption {
  return {
    ...opcaoBase(),
    tooltip: {
      ...tooltipPadrao(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = (params as { dataIndex: number }[])[0];
        const r = resumo[p.dataIndex];
        return (
          `<b>${r.ano}</b><br/>` +
          `Faturamento: <b>${brl(r.faturamento)}</b><br/>` +
          `Lucro: ${brl(r.lucro)}<br/>` +
          `Despesa equipe: ${brl(r.despesaEquipe)}<br/>` +
          `Clientes: ${inteiro(r.clientes)}` +
          notaPeriodo(r)
        );
      },
    },
    grid: { left: 70, right: 20, top: 24, bottom: 56 },
    xAxis: eixoCategoria(t, resumo.map((r) => r.ano)),
    yAxis: eixoValorBRL(t),
    dataZoom: sliderZoom(t),
    series: [
      {
        name: 'Faturamento',
        type: 'bar',
        data: resumo.map((r) => r.faturamento),
        itemStyle: { color: t.fat, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 56,
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 11,
          formatter: ({ value }: { value: number }) => brlCompacto(value),
        },
      },
    ],
  };
}

/** 2. Barra: Faturamento x Número de clientes (cada barra = um ano) */
export function optFaturamentoClientes(t: Tokens, resumo: ResumoAnual[]): EChartsCoreOption {
  const ordenado = [...resumo].sort((a, b) => a.clientes - b.clientes);
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
          `Clientes: <b>${inteiro(r.clientes)}</b><br/>` +
          `Faturamento: <b>${brl(r.faturamento)}</b>` +
          notaPeriodo(r)
        );
      },
    },
    grid: { left: 70, right: 20, top: 32, bottom: 74 },
    xAxis: {
      ...eixoCategoria(t, ordenado.map((r) => inteiro(r.clientes))),
      name: 'Número de clientes',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: t.muted, fontSize: 11 },
    },
    yAxis: eixoValorBRL(t),
    dataZoom: sliderZoom(t),
    series: [
      {
        name: 'Faturamento',
        type: 'bar',
        data: ordenado.map((r) => r.faturamento),
        itemStyle: { color: t.fat, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 56,
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

/** 3. Barra: Número de clientes x Ano */
export function optClientesAno(t: Tokens, resumo: ResumoAnual[]): EChartsCoreOption {
  return {
    ...opcaoBase(),
    tooltip: {
      ...tooltipPadrao(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = (params as { dataIndex: number }[])[0];
        const r = resumo[p.dataIndex];
        return (
          `<b>${r.ano}</b><br/>` +
          `Clientes: <b>${inteiro(r.clientes)}</b><br/>` +
          `Faturamento: ${brl(r.faturamento)}<br/>` +
          `Ticket médio: ${brl(r.faturamento / Math.max(1, r.clientes))}` +
          notaPeriodo(r)
        );
      },
    },
    grid: { left: 56, right: 20, top: 24, bottom: 56 },
    xAxis: eixoCategoria(t, resumo.map((r) => r.ano)),
    yAxis: eixoValorInteiro(t),
    dataZoom: sliderZoom(t),
    series: [
      {
        name: 'Clientes',
        type: 'bar',
        data: resumo.map((r) => r.clientes),
        itemStyle: { color: t.cli, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 56,
        label: {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 11,
          formatter: ({ value }: { value: number }) => inteiro(value),
        },
      },
    ],
  };
}

/** 4. Gráfico especial 3D: Faturamento x Número de clientes x Ano (pontos mensais) */
export function optTresEixos(t: Tokens, linhas: LinhaBase[]): EChartsCoreOption {
  const anos = [...new Set(linhas.map((l) => l.ano))].sort();
  const series = anos.map((ano, i) => {
    const doAno = linhas.filter((l) => l.ano === ano);
    return {
      name: String(ano),
      type: 'scatter3D',
      symbolSize: 11,
      itemStyle: { color: t.seqAnos[i % t.seqAnos.length], opacity: 0.92 },
      emphasis: { itemStyle: { opacity: 1 } },
      // [x: ano, y: clientes, z: faturamento, mes, lucro, despesa]
      data: doAno.map((l) => [String(l.ano), l.clientes, l.faturamento, l.mes, l.lucro, l.despesaEquipe]),
    };
  });
  return {
    ...opcaoBase(),
    tooltip: {
      ...tooltipPadrao(t),
      formatter: (params: unknown) => {
        const p = params as { value: [string, number, number, number, number, number] };
        const [ano, cli, fat, mes, lucro, despesa] = p.value;
        return (
          `<b>${MESES[mes - 1]} de ${ano}</b><br/>` +
          `Clientes: <b>${inteiro(cli)}</b><br/>` +
          `Faturamento: <b>${brl(fat)}</b><br/>` +
          `Lucro: ${brl(lucro)}<br/>` +
          `Despesa equipe: ${brl(despesa)}`
        );
      },
    },
    legend: {
      top: 4,
      textStyle: { color: t.ink2, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 10,
    },
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
      axisLabel: {
        color: t.muted,
        fontSize: 10,
        formatter: (v: number) => brlCompacto(v),
      },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { lineStyle: { color: t.grid } },
    },
    grid3D: {
      boxWidth: 110,
      boxDepth: 90,
      viewControl: { distance: 230, alpha: 18, beta: 35, rotateSensitivity: 1.6 },
      light: { main: { intensity: 1.1, shadow: false }, ambient: { intensity: 0.5 } },
      axisPointer: { show: true, lineStyle: { color: t.muted } },
    },
    series,
  };
}

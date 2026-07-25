import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';

interface Props {
  option: echarts.EChartsCoreOption;
  height?: number;
  ariaLabel?: string;
}

export function EChart({ option, height = 380, ariaLabel }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = elRef.current!;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={elRef}
      style={{ width: '100%', height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}

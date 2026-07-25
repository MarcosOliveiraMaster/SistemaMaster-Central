import { useEffect, useState } from 'react';

// Papéis de cor do dashboard. A cor segue a entidade em todos os gráficos:
// faturamento = azul, clientes = laranja, lucro = verde-água, despesa = vermelho.
// Projeções usam um passo mais claro/escuro do MESMO matiz da entidade.
export interface Tokens {
  surface: string;
  page: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  border: string;
  fat: string;
  fatProj: string;
  cli: string;
  cliProj: string;
  lucro: string;
  despesa: string;
  /** rampa sequencial (um matiz) usada para "ano" no gráfico 3D */
  seqAnos: string[];
}

export const TOKENS: Record<'light' | 'dark', Tokens> = {
  light: {
    surface: '#fcfcfb',
    page: '#f9f9f7',
    ink: '#0b0b0b',
    ink2: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    border: 'rgba(11,11,11,0.10)',
    fat: '#2a78d6',
    fatProj: '#86b6ef',
    cli: '#eb6834',
    cliProj: '#f5b193',
    lucro: '#1baf7a',
    despesa: '#e34948',
    seqAnos: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'],
  },
  dark: {
    surface: '#1a1a19',
    page: '#0d0d0d',
    ink: '#ffffff',
    ink2: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    border: 'rgba(255,255,255,0.10)',
    fat: '#3987e5',
    fatProj: '#1c5cab',
    cli: '#d95926',
    cliProj: '#8a3c1d',
    lucro: '#199e70',
    despesa: '#e66767',
    seqAnos: ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'],
  },
};

export function useTheme(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = (e: MediaQueryListEvent) => setMode(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return mode;
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const brlFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

const numFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function brl(v: number): string {
  return brlFmt.format(v);
}

export function inteiro(v: number): string {
  return numFmt.format(v);
}

/** Rótulo compacto de eixo: R$ 12,5 mil */
export function brlCompacto(v: number): string {
  if (Math.abs(v) >= 1000) {
    const mil = v / 1000;
    const s = mil % 1 === 0 ? String(mil) : mil.toFixed(1).replace('.', ',');
    return `R$ ${s} mil`;
  }
  return `R$ ${numFmt.format(v)}`;
}

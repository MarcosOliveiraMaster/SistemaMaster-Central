import { BASE, LinhaBase, ULTIMO_MES_REAL } from '../data/base';
import { ajustarHoltAmortecido, preverHolt, AjusteHolt } from './holt';

export interface ResumoAnual {
  ano: number;
  clientes: number;
  faturamento: number;
  lucro: number;
  despesaEquipe: number;
  meses: number; // quantos meses compõem o total
  estimado: boolean; // contém valores estimados (2022-2024)
}

export function filtrarBase(anos: number[], mesIni: number, mesFim: number): LinhaBase[] {
  return BASE.filter(
    (l) => anos.includes(l.ano) && l.mes >= mesIni && l.mes <= mesFim,
  );
}

export function resumirPorAno(linhas: LinhaBase[]): ResumoAnual[] {
  const mapa = new Map<number, ResumoAnual>();
  for (const l of linhas) {
    let r = mapa.get(l.ano);
    if (!r) {
      r = { ano: l.ano, clientes: 0, faturamento: 0, lucro: 0, despesaEquipe: 0, meses: 0, estimado: false };
      mapa.set(l.ano, r);
    }
    r.clientes += l.clientes;
    r.faturamento += l.faturamento;
    r.lucro += l.lucro;
    r.despesaEquipe += l.despesaEquipe;
    r.meses += 1;
    r.estimado = r.estimado || l.estimado;
  }
  return [...mapa.values()].sort((a, b) => a.ano - b.ano);
}

// ---------------------------------------------------------------------------
// Projeção Holt (tendência amortecida) sobre as séries MENSAIS de faturamento
// e de clientes, prolongada até dezembro/2030.
// ---------------------------------------------------------------------------

export interface MesProjetado {
  ano: number;
  mes: number;
  faturamento: number;
  clientes: number;
  projetado: boolean;
}

export interface Projecao {
  meses: MesProjetado[]; // série completa 2022-01 … 2030-12 (real + projetado)
  ajusteFat: AjusteHolt;
  ajusteCli: AjusteHolt;
}

let cache: Projecao | null = null;

export function obterProjecao(): Projecao {
  if (cache) return cache;

  const ordenada = [...BASE].sort((a, b) => a.ano * 100 + a.mes - (b.ano * 100 + b.mes));
  const serieFat = ordenada.map((l) => l.faturamento);
  const serieCli = ordenada.map((l) => l.clientes);

  const ajusteFat = ajustarHoltAmortecido(serieFat);
  const ajusteCli = ajustarHoltAmortecido(serieCli);

  const meses: MesProjetado[] = ordenada.map((l) => ({
    ano: l.ano,
    mes: l.mes,
    faturamento: l.faturamento,
    clientes: l.clientes,
    projetado: false,
  }));

  // horizonte: mês seguinte ao último real até dez/2030
  const inicioAno = ULTIMO_MES_REAL.mes === 12 ? ULTIMO_MES_REAL.ano + 1 : ULTIMO_MES_REAL.ano;
  const inicioMes = ULTIMO_MES_REAL.mes === 12 ? 1 : ULTIMO_MES_REAL.mes + 1;
  let h = 0;
  for (let ano = inicioAno, mes = inicioMes; ano <= 2030; ) {
    h += 1;
    void ano;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  const prevFat = preverHolt(ajusteFat, h);
  const prevCli = preverHolt(ajusteCli, h);

  let i = 0;
  for (let ano = inicioAno, mes = inicioMes; ano <= 2030; ) {
    meses.push({
      ano,
      mes,
      faturamento: Math.max(0, Math.round(prevFat[i] * 100) / 100),
      clientes: Math.max(0, Math.round(prevCli[i])),
      projetado: true,
    });
    i += 1;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }

  cache = { meses, ajusteFat, ajusteCli };
  return cache;
}

export interface AnoProjetado {
  ano: number;
  fatReal: number; // soma dos meses reais do ano
  fatProjetado: number; // soma dos meses projetados do ano
  cliReal: number;
  cliProjetado: number;
  mesesReais: number;
  mesesProjetados: number;
}

export function projecaoPorAno(ateAno: number): AnoProjetado[] {
  const { meses } = obterProjecao();
  const mapa = new Map<number, AnoProjetado>();
  for (const m of meses) {
    if (m.ano > ateAno) continue;
    let r = mapa.get(m.ano);
    if (!r) {
      r = { ano: m.ano, fatReal: 0, fatProjetado: 0, cliReal: 0, cliProjetado: 0, mesesReais: 0, mesesProjetados: 0 };
      mapa.set(m.ano, r);
    }
    if (m.projetado) {
      r.fatProjetado += m.faturamento;
      r.cliProjetado += m.clientes;
      r.mesesProjetados += 1;
    } else {
      r.fatReal += m.faturamento;
      r.cliReal += m.clientes;
      r.mesesReais += 1;
    }
  }
  return [...mapa.values()].sort((a, b) => a.ano - b.ano);
}

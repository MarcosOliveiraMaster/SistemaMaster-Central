import { useMemo, useState } from 'react';
import { BASE } from './data/base';
import { TOKENS, useTheme } from './lib/theme';
import {
  filtrarBase,
  resumirPorAno,
  obterProjecao,
  projecaoPorAno,
} from './lib/agregacao';
import {
  optFaturamentoAno,
  optFaturamentoClientes,
  optClientesAno,
  optTresEixos,
} from './lib/opcoesHistorico';
import {
  optProjFaturamentoAno,
  optProjFaturamentoClientes,
  optProjClientesAno,
  optProjTresEixos,
} from './lib/opcoesProjecao';
import { EChart } from './components/EChart';
import { Filtros } from './components/Filtros';
import { TabelaBase } from './components/TabelaBase';

const ANOS = [...new Set(BASE.map((l) => l.ano))].sort();

function CardGrafico({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-cabecalho">
        <div>
          <h3>{titulo}</h3>
          {subtitulo && <p className="subtitulo">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function App() {
  const tema = useTheme();
  const t = TOKENS[tema];

  const [anos, setAnos] = useState<number[]>(ANOS);
  const [mesIni, setMesIni] = useState(1);
  const [mesFim, setMesFim] = useState(12);
  const [horizonte, setHorizonte] = useState(2030);

  const linhas = useMemo(() => filtrarBase(anos, mesIni, mesFim), [anos, mesIni, mesFim]);
  const resumo = useMemo(() => resumirPorAno(linhas), [linhas]);

  const projecao = useMemo(() => obterProjecao(), []);
  const anosProj = useMemo(() => projecaoPorAno(horizonte), [horizonte]);

  const o1 = useMemo(() => optFaturamentoAno(t, resumo), [t, resumo]);
  const o2 = useMemo(() => optFaturamentoClientes(t, resumo), [t, resumo]);
  const o3 = useMemo(() => optClientesAno(t, resumo), [t, resumo]);
  const o4 = useMemo(() => optTresEixos(t, linhas), [t, linhas]);

  const p1 = useMemo(() => optProjFaturamentoAno(t, anosProj), [t, anosProj]);
  const p2 = useMemo(() => optProjFaturamentoClientes(t, anosProj), [t, anosProj]);
  const p3 = useMemo(() => optProjClientesAno(t, anosProj), [t, anosProj]);
  const p4 = useMemo(
    () => optProjTresEixos(t, projecao.meses, horizonte),
    [t, projecao, horizonte],
  );

  const { ajusteFat, ajusteCli } = projecao;
  const notaHolt =
    `Holt amortecido — faturamento: α=${ajusteFat.alpha.toFixed(2)}, ` +
    `β=${ajusteFat.beta.toFixed(2)}, φ=${ajusteFat.phi.toFixed(2)} · ` +
    `clientes: α=${ajusteCli.alpha.toFixed(2)}, β=${ajusteCli.beta.toFixed(2)}, ` +
    `φ=${ajusteCli.phi.toFixed(2)}`;

  return (
    <div className="app">
      <header className="topo">
        <h1>Dashboard Financeiro — Master Educação</h1>
        <p>
          Histórico 2022 – jul/2026 (CRM, contratações 2025 e DRE) e projeção
          até 2030 com o método de Holt de tendência amortecida.
        </p>
      </header>

      <div className="layout">
        <main className="conteudo">
          <TabelaBase linhas={linhas} />

          <h2 className="secao">Histórico</h2>

          <CardGrafico titulo="Faturamento × Ano">
            <EChart option={o1} ariaLabel="Gráfico de barras de faturamento por ano" />
          </CardGrafico>

          <CardGrafico
            titulo="Faturamento × Número de clientes"
            subtitulo="Cada barra é um ano, posicionado pelo total de clientes atendidos"
          >
            <EChart
              option={o2}
              ariaLabel="Gráfico de barras de faturamento pelo número de clientes"
            />
          </CardGrafico>

          <CardGrafico titulo="Número de clientes × Ano">
            <EChart option={o3} ariaLabel="Gráfico de barras de clientes por ano" />
          </CardGrafico>

          <CardGrafico
            titulo="Faturamento × Nº de clientes × Ano (3 eixos)"
            subtitulo="Cada ponto é um mês — arraste para girar, use a roda do mouse para aproximar"
          >
            <EChart
              option={o4}
              height={460}
              ariaLabel="Gráfico 3D de faturamento, clientes e ano"
            />
          </CardGrafico>

          <h2 className="secao">Projeção até {horizonte}</h2>
          <p className="nota-holt">{notaHolt}</p>

          <CardGrafico
            titulo="Faturamento × Ano — projeção"
            subtitulo="2026 combina realizado (jan–jul) e projeção (ago–dez); barras hachuradas são projetadas"
          >
            <EChart option={p1} ariaLabel="Projeção de faturamento por ano" />
          </CardGrafico>

          <CardGrafico
            titulo="Faturamento × Número de clientes — projeção"
            subtitulo="Anos projetados em tom claro hachurado"
          >
            <EChart
              option={p2}
              ariaLabel="Projeção de faturamento pelo número de clientes"
            />
          </CardGrafico>

          <CardGrafico titulo="Número de clientes × Ano — projeção">
            <EChart option={p3} ariaLabel="Projeção de clientes por ano" />
          </CardGrafico>

          <CardGrafico
            titulo="Faturamento × Nº de clientes × Ano — projeção 3D"
            subtitulo="Pontos claros são meses projetados"
          >
            <EChart
              option={p4}
              height={460}
              ariaLabel="Gráfico 3D com projeção de faturamento, clientes e ano"
            />
          </CardGrafico>
        </main>

        <Filtros
          anosDisponiveis={ANOS}
          anosSelecionados={anos}
          onAnosChange={setAnos}
          mesIni={mesIni}
          mesFim={mesFim}
          onMesIniChange={setMesIni}
          onMesFimChange={setMesFim}
          horizonte={horizonte}
          onHorizonteChange={setHorizonte}
        />
      </div>

      <footer className="rodape">
        <p>
          Fontes: CRM.xlsx (2022–2024) · Planilha de contratações (2025) ·
          DRE jan–jul/2026. Lucro e despesa de 2022–2024 distribuídos por mês
          proporcionalmente ao faturamento (2022 usa as margens de 2023).
        </p>
      </footer>
    </div>
  );
}

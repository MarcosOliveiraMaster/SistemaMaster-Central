import { useMemo, useState } from 'react';
import { LinhaBase } from '../data/base';
import { brl, inteiro, MESES } from '../lib/format';

interface Props {
  linhas: LinhaBase[];
}

function gerarCsv(linhas: LinhaBase[]): string {
  const cab = 'Ano;Mês;Número de clientes;Faturamento;Lucro;Despesa com equipe;Estimado';
  const corpo = linhas.map((l) =>
    [
      l.ano,
      MESES[l.mes - 1],
      l.clientes,
      l.faturamento.toFixed(2).replace('.', ','),
      l.lucro.toFixed(2).replace('.', ','),
      l.despesaEquipe.toFixed(2).replace('.', ','),
      l.estimado ? 'sim' : 'não',
    ].join(';'),
  );
  return [cab, ...corpo].join('\n');
}

export function TabelaBase({ linhas }: Props) {
  const [aberta, setAberta] = useState(true);

  const totais = useMemo(
    () =>
      linhas.reduce(
        (acc, l) => ({
          clientes: acc.clientes + l.clientes,
          faturamento: acc.faturamento + l.faturamento,
          lucro: acc.lucro + l.lucro,
          despesa: acc.despesa + l.despesaEquipe,
        }),
        { clientes: 0, faturamento: 0, lucro: 0, despesa: 0 },
      ),
    [linhas],
  );

  const baixarCsv = () => {
    const blob = new Blob(['﻿' + gerarCsv(linhas)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'base-financeira-master.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <div className="card-cabecalho">
        <div>
          <h2>Base de informações</h2>
          <p className="subtitulo">
            {linhas.length} meses selecionados · valores marcados com “≈” têm
            lucro/despesa estimados a partir dos totais anuais do CRM
          </p>
        </div>
        <div className="card-acoes">
          <button type="button" onClick={baixarCsv}>
            Exportar CSV
          </button>
          <button type="button" onClick={() => setAberta(!aberta)}>
            {aberta ? 'Recolher' : 'Expandir'}
          </button>
        </div>
      </div>
      {aberta && (
        <div className="tabela-envelope">
          <table>
            <thead>
              <tr>
                <th>Ano</th>
                <th>Mês</th>
                <th className="num">Nº de clientes</th>
                <th className="num">Faturamento</th>
                <th className="num">Lucro</th>
                <th className="num">Despesa com equipe</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.ano}-${l.mes}`}>
                  <td>{l.ano}</td>
                  <td>{MESES[l.mes - 1]}</td>
                  <td className="num">{inteiro(l.clientes)}</td>
                  <td className="num">{brl(l.faturamento)}</td>
                  <td className="num">
                    {l.estimado && <span className="aprox">≈ </span>}
                    {brl(l.lucro)}
                  </td>
                  <td className="num">
                    {l.estimado && <span className="aprox">≈ </span>}
                    {brl(l.despesaEquipe)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total do período</td>
                <td className="num">{inteiro(totais.clientes)}</td>
                <td className="num">{brl(totais.faturamento)}</td>
                <td className="num">{brl(totais.lucro)}</td>
                <td className="num">{brl(totais.despesa)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

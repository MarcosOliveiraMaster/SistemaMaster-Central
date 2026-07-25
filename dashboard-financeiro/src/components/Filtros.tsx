import { MESES } from '../lib/format';

interface Props {
  anosDisponiveis: number[];
  anosSelecionados: number[];
  onAnosChange: (anos: number[]) => void;
  mesIni: number;
  mesFim: number;
  onMesIniChange: (m: number) => void;
  onMesFimChange: (m: number) => void;
  horizonte: number;
  onHorizonteChange: (a: number) => void;
}

export function Filtros({
  anosDisponiveis,
  anosSelecionados,
  onAnosChange,
  mesIni,
  mesFim,
  onMesIniChange,
  onMesFimChange,
  horizonte,
  onHorizonteChange,
}: Props) {
  const alternarAno = (ano: number) => {
    if (anosSelecionados.includes(ano)) {
      if (anosSelecionados.length === 1) return; // mantém pelo menos um ano
      onAnosChange(anosSelecionados.filter((a) => a !== ano));
    } else {
      onAnosChange([...anosSelecionados, ano].sort());
    }
  };

  return (
    <aside className="filtros" aria-label="Filtros do dashboard">
      <h2>Filtros</h2>

      <fieldset>
        <legend>Anos (histórico)</legend>
        {anosDisponiveis.map((ano) => (
          <label key={ano} className="filtro-check">
            <input
              type="checkbox"
              checked={anosSelecionados.includes(ano)}
              onChange={() => alternarAno(ano)}
            />
            <span>{ano}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Período do ano</legend>
        <label className="filtro-slider">
          <span>
            De: <b>{MESES[mesIni - 1]}</b>
          </span>
          <input
            type="range"
            min={1}
            max={12}
            value={mesIni}
            onChange={(e) => {
              const v = Number(e.target.value);
              onMesIniChange(v);
              if (v > mesFim) onMesFimChange(v);
            }}
          />
        </label>
        <label className="filtro-slider">
          <span>
            Até: <b>{MESES[mesFim - 1]}</b>
          </span>
          <input
            type="range"
            min={1}
            max={12}
            value={mesFim}
            onChange={(e) => {
              const v = Number(e.target.value);
              onMesFimChange(v);
              if (v < mesIni) onMesIniChange(v);
            }}
          />
        </label>
        <p className="filtro-nota">
          Restringe a tabela e os gráficos do histórico aos meses escolhidos
          (útil para comparar o mesmo período entre anos).
        </p>
      </fieldset>

      <fieldset>
        <legend>Projeção</legend>
        <label className="filtro-slider">
          <span>
            Horizonte: <b>{horizonte}</b>
          </span>
          <input
            type="range"
            min={2026}
            max={2030}
            value={horizonte}
            onChange={(e) => onHorizonteChange(Number(e.target.value))}
          />
        </label>
        <p className="filtro-nota">
          Projeção de Holt com tendência amortecida, ajustada sobre a série
          mensal completa (jan/2022 – jul/2026).
        </p>
      </fieldset>
    </aside>
  );
}

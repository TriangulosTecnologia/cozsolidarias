import type { CadinsanByCity } from '@/data-gateway/schema';

import { TooltipCard } from './mapaTooltipCard';
import type { CoverageRow } from './municipalKitchenCoverage';

/** Includes both administrative counts and the two modeled risk scenarios. */
export const municipalCoverageTooltip = (
  code: string,
  rows: CoverageRow[],
  risks: CadinsanByCity[]
) => {
  const row = rows.find((entry) => {
    return entry.codigoIbge === code;
  });
  const risk = risks.find((entry) => {
    return entry.codigoIbge === code;
  });
  if (!row)
    return (
      <TooltipCard
        name={risk?.municipio ?? `Município ${code}`}
        primary="Sem cozinha no cadastro analisado de 2025"
      />
    );
  const format = (n: number | null) => {
    return n === null
      ? 'sem dado'
      : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  };
  const details = risk
    ? [
        `CADINSAN com PBF: ${format(risk.proporcaoComPbf)} · ${risk.absolutoComPbf.toLocaleString('pt-BR')} famílias em risco`,
        `CADINSAN sem PBF: ${format(risk.proporcaoSemPbf)} · ${risk.absolutoSemPbf.toLocaleString('pt-BR')} famílias em risco`,
      ]
    : ['CADINSAN indisponível para este município'];
  if (row.registeredCount < 5)
    details.push('Base pequena: menos de 5 cozinhas cadastradas.');
  return (
    <TooltipCard
      name={`${row.municipio} / ${row.uf}`}
      primary={`${format(row.enabledPercent)} habilitadas (Tm)`}
      secondary={`${row.enabledCount} habilitadas / ${row.registeredCount} cadastradas · 2025`}
      details={details}
    />
  );
};

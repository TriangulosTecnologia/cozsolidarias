import type * as React from 'react';

import { cafHexbinBandColor } from './geovisCafHexbin';
import { TooltipCard } from './mapaTooltipCard';

/**
 * Hover card for the CAF hexbin grid: how many CAFs the cell under the cursor
 * holds, next to the colour it is painted in.
 *
 * The number comes straight from `MapHoverInfo.value`, which the grid's
 * `mapData` join carries — the same value the fill's colour ramp reads — so the
 * card cannot disagree with the band the cell is painted in. The swatch is
 * derived from that same number through the legend's own thresholds, so it
 * cannot disagree either.
 *
 * `null` means the cell is not in the join, and for this grid that is not
 * missing data: every cell covering Brazil is emitted, and only the empty ones
 * are left out (a `value: 0` would fall into the palest band and read as "a
 * few"). So `null` is reported as the zero it is.
 *
 * @param params.quantidade - The cell's CAF count, or `null` for an empty cell.
 * @returns The tooltip card.
 *
 * @example
 * renderCafHexbinTooltip({ quantidade: 76 });
 * // <TooltipCard name="Nº de CAFs" swatchColor="#2171B5" primary="76 CAFs" />
 *
 * @example
 * renderCafHexbinTooltip({ quantidade: null });
 * // <TooltipCard name="Nº de CAFs" swatchColor="#EEE6DA" primary="Sem CAF" />
 */
export const renderCafHexbinTooltip = ({
  quantidade,
}: {
  quantidade: number | null;
}): React.ReactNode => {
  // `Sem CAF` rather than `0 CAFs`: the grid covers the whole territory, so an
  // empty cell is a statement about the land, and the legend already names that
  // band with these words.
  const primary =
    quantidade === null || quantidade === 0
      ? 'Sem CAF'
      : `${quantidade.toLocaleString('pt-BR')} ${quantidade === 1 ? 'CAF' : 'CAFs'}`;

  return (
    <TooltipCard
      name="Nº de CAFs"
      swatchColor={cafHexbinBandColor(quantidade)}
      primary={primary}
    />
  );
};

'use client';

import * as React from 'react';

import type { KitchenRateByCity } from '@/data-gateway/schema';

const NO_ROWS = new Map<string, KitchenRateByCity>();

/**
 * Loads the per-município kitchen rows from `/api/cozinhas/por-municipio` once
 * `enabled` turns on (a served spec paints a CadÚnico coverage), keyed by
 * `codigoIbge` — the `codarea` geovis gives a hovered município. The hover card
 * reads the kitchen count and the CadÚnico people from them; the spec carries
 * only the painted value.
 *
 * deferred: same shape as `useCadinsanPorMunicipio`; extract one loader once a
 * third hook (the PAA cards) repeats it.
 *
 * @param enabled - Whether to load the rows; nothing is fetched while `false`.
 * @returns `codarea → kitchen row`; empty until the rows load, or if they fail.
 *
 * @example
 * const cozinhas = useCozinhasPorMunicipio(paintsCadunicoCoverage(spec));
 * cozinhas.get('2927408')?.pessoasCadUnico; // 1157799
 */
export const useCozinhasPorMunicipio = (
  enabled: boolean
): Map<string, KitchenRateByCity> => {
  const [rows, setRows] = React.useState(NO_ROWS);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    fetch('/api/cozinhas/por-municipio')
      .then((response) => {
        return response.json() as Promise<KitchenRateByCity[]>;
      })
      .then((list) => {
        setRows(
          new Map(
            list.map((row) => {
              return [row.codigoIbge, row] as const;
            })
          )
        );
      })
      .catch(() => {
        return undefined;
      });
  }, [enabled]);

  return rows;
};

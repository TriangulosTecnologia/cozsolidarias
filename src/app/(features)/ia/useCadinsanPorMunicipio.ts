'use client';

import * as React from 'react';

import type { CadinsanByCity } from '@/data-gateway/schema';

const NO_ROWS = new Map<string, CadinsanByCity>();

/**
 * Loads the CADINSAN rows from `/api/cadinsan/por-municipio` once `enabled`
 * turns on (a served spec paints a CADINSAN share), keyed by `codigoIbge` —
 * the `codarea` geovis gives a hovered município. The hover card reads its
 * absolutes and the other scenario from them; the spec carries only the share.
 *
 * @param enabled - Whether to load the rows; nothing is fetched while `false`.
 * @returns `codarea → CADINSAN row`; empty until the rows load, or if they fail.
 *
 * @example
 * const cadinsan = useCadinsanPorMunicipio(paintsCadinsan(spec));
 * cadinsan.get('2927408')?.proporcaoSemPbf; // 31.4
 */
export const useCadinsanPorMunicipio = (
  enabled: boolean
): Map<string, CadinsanByCity> => {
  const [rows, setRows] = React.useState(NO_ROWS);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    fetch('/api/cadinsan/por-municipio')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`CADINSAN rows: HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((list: CadinsanByCity[]) => {
        setRows(
          new Map(
            list.map((row) => {
              return [row.codigoIbge, row] as const;
            })
          )
        );
      })
      .catch(() => {
        // The hover card degrades to the plain band card; nothing else needs the rows.
        return undefined;
      });
  }, [enabled]);

  return rows;
};

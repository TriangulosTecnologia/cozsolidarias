'use client';

import * as React from 'react';

/**
 * Loads `codarea → município name` from `/geo/municipios-nomes.json`, the
 * proper-cased names every município has (the spec's inline features carry
 * only those with data, upper-cased).
 *
 * @returns The names map; empty until the file loads or if it fails.
 *
 * @example
 * const nomes = useMunicipioNomes(); // { '3304557': 'Rio de Janeiro', ... }
 */
export const useMunicipioNomes = (): { [codarea: string]: string } => {
  const [nomes, setNomes] = React.useState<{ [codarea: string]: string }>({});

  React.useEffect(() => {
    fetch('/geo/municipios-nomes.json')
      .then((response) => {
        return response.json() as Promise<{ [codarea: string]: string }>;
      })
      .then(setNomes)
      .catch(() => {
        return undefined;
      });
  }, []);

  return nomes;
};

/**
 * Canonical shape for the "CAFs per município" aggregation consumed by the
 * "% dos CAFs do Brasil no município" choropleth.
 *
 * `codigoIbge` is the 7-digit IBGE municipality code (matches `codarea` in
 * `public/geo/geojs-100-mun.json`) and is what the map uses to join the value
 * to a polygon. `municipio` carries the human-readable name for tooltips/labels.
 * A CAF is a distinct `nr_caf`; see `scripts/generateCafPorMunicipio.ts` for the
 * counting semantics.
 */

/**
 * A single município row with its CAF count and its share (%) of Brazil's CAFs
 * — the shape served by `/api/cafs/por-municipio` and consumed by the CAF share
 * choropleth. The share variant colors the fill by {@link cafByCity.percentualDoBrasil}.
 */
export type cafByCity = {
  /** 7-digit IBGE code; joins to `feature.properties.codarea` on the map. */
  codigoIbge: string;
  /** Município name (for display); taken from the CAF source records. */
  municipio: string;
  /** Number of distinct CAFs (`nr_caf`) counted in this município. */
  quantidade: number;
  /**
   * Share of all Brazilian CAFs counted in this município:
   * `(quantidade / totalBrasil) * 100`, rounded to two decimals, where
   * `totalBrasil` is the sum of `quantidade` across every município (the
   * national total the choropleth paints). Always a number (never `null`)
   * because every row has `quantidade >= 1`; `0` only in the degenerate case of
   * no CAFs at all.
   */
  percentualDoBrasil: number;
};

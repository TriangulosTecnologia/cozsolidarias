/**
 * Canonical shape for the "cozinhas per município" aggregation consumed by the
 * choropleth map.
 *
 * `codigoIbge` is the 7-digit IBGE municipality code (matches `codarea` in
 * `public/geo/geojs-100-mun.json`) and is what the map uses to join the value
 * to a polygon. `municipio` carries the human-readable name for tooltips/labels.
 */

/** A single município with its cozinha count. */
export type kitchenByCity = {
  /** 7-digit IBGE code; joins to `feature.properties.codarea` on the map. */
  codigoIbge: string;
  /** Município name (for display); taken from the source records. */
  municipio: string;
  /** Number of cozinhas located inside this município's polygon. */
  quantidade: number;
};

/**
 * A município row enriched with its IBGE Census 2022 population and two derived
 * choropleth metrics — the shape served by `/api/cozinhas/por-municipio` and
 * consumed by every choropleth variant. The count variant colors the fill by
 * {@link kitchenByCity.quantidade}, the rate variant by
 * {@link kitchenRateByCity.porCemMil}, and the share variant by
 * {@link kitchenRateByCity.percentualDoBrasil}; each variant ignores the fields
 * it doesn't use.
 */
export type kitchenRateByCity = kitchenByCity & {
  /**
   * Município resident population (IBGE Census 2022). `null` when the município
   * has no entry in the population snapshot (no valid rate denominator).
   */
  populacao: number | null;
  /**
   * Cozinhas per 100,000 inhabitants: `(quantidade / populacao) * 100_000`,
   * rounded to two decimals. `null` when `populacao` is unknown, so the rate
   * choropleth treats the município as "sem dado".
   */
  porCemMil: number | null;
  /**
   * Share of all Brazilian cozinhas located in this município:
   * `(quantidade / totalBrasil) * 100`, rounded to two decimals, where
   * `totalBrasil` is the sum of `quantidade` across every município (the
   * national total the choropleth paints). Always a number (never `null`)
   * because every row has `quantidade >= 1`; `0` only in the degenerate case of
   * no cozinhas at all.
   */
  percentualDoBrasil: number;
};

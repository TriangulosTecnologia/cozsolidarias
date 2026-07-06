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
 * A município row enriched with its IBGE Census 2022 population and the derived
 * cozinhas-per-100k-inhabitants rate — the shape served by
 * `/api/cozinhas/por-municipio` and consumed by the choropleth map (both the
 * raw-count and the rate variants). The rate variant colors the fill by
 * {@link kitchenRateByCity.porCemMil}; the count variant ignores the two extra
 * fields.
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
};

/**
 * Canonical shape for the "cozinhas per município" aggregation consumed by the
 * choropleth map.
 *
 * `codigoIbge` is the 7-digit IBGE municipality code (matches `codarea` in
 * `public/geo/geojs-100-mun.json`) and is what the map uses to join the value
 * to a polygon. `municipio` carries the human-readable name for tooltips/labels.
 */

/**
 * A single município with its cozinha count.
 *
 * @example
 * const salvador: KitchenByCity = {
 *   codigoIbge: '2927408',
 *   municipio: 'SALVADOR',
 *   quantidade: 26,
 *   pessoasAtendidas: 45897,
 * };
 */
export type KitchenByCity = {
  /** 7-digit IBGE code; joins to `feature.properties.codarea` on the map. */
  codigoIbge: string;
  /** Município name (for display); taken from the source records. */
  municipio: string;
  /** Number of cozinhas located inside this município's polygon. */
  quantidade: number;
  /**
   * Total people served, summed from each cozinha's free-text
   * `publicoTotalAtendido` in this município. Only cozinhas with a parseable
   * count contribute to the sum; `null` when none of the município's cozinhas
   * report a parseable count (unknown, never coerced to `0`).
   */
  pessoasAtendidas: number | null;
};

/**
 * A município row enriched with its IBGE Census 2022 population, its Cadastro
 * Único registration count, and three derived choropleth metrics — the shape
 * served by `/api/cozinhas/por-municipio` and consumed by every choropleth
 * variant. The count variant colors the fill by {@link KitchenByCity.quantidade},
 * the rate variant by {@link KitchenRateByCity.porCemMil}, the share variant by
 * {@link KitchenRateByCity.percentualDoBrasil}, the CadÚnico variant by
 * {@link KitchenRateByCity.porDezMilCadUnico}, and the coverage variant by
 * {@link KitchenRateByCity.pessoasPorCozinha}; each variant ignores the fields it
 * doesn't use.
 *
 * @example
 * const salvador: KitchenRateByCity = {
 *   codigoIbge: '2927408',
 *   municipio: 'SALVADOR',
 *   quantidade: 26,
 *   pessoasAtendidas: 45897,
 *   populacao: 2417678,
 *   porCemMil: 1.08, // 26 / 2417678 * 100_000
 *   percentualDoBrasil: 1.87,
 *   pessoasCadUnico: 1157799,
 *   porDezMilCadUnico: 0.22, // 26 / 1157799 * 10_000
 *   pessoasPorCozinha: 44531, // 1157799 / 26
 * };
 */
export type KitchenRateByCity = KitchenByCity & {
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
  /**
   * People registered in the Cadastro Único in this município (MDS/SAGI MI
   * Social, reference month 2026-06). `null` when the município has no entry in
   * the CadÚnico snapshot (no valid rate denominator).
   */
  pessoasCadUnico: number | null;
  /**
   * Cozinhas per 10,000 people registered in the Cadastro Único:
   * `(quantidade / pessoasCadUnico) * 10_000`, rounded to two decimals. `null`
   * when `pessoasCadUnico` is unknown, so the CadÚnico choropleth treats the
   * município as "sem dado". Measures coverage of the vulnerable population the
   * cozinhas serve, rather than density over the whole population.
   */
  porDezMilCadUnico: number | null;
  /**
   * People registered in the Cadastro Único per cozinha — the inverse coverage
   * ratio `pessoasCadUnico / quantidade`, rounded to a whole person (higher =
   * each cozinha serves more people = thinner coverage). `null` when
   * `pessoasCadUnico` is unknown, so the coverage choropleth treats the município
   * as "sem dado".
   */
  pessoasPorCozinha: number | null;
};

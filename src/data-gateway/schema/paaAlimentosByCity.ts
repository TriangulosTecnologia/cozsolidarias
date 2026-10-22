/**
 * Canonical shape for the PAA Cozinhas Solidárias 2025 per-município
 * aggregation consumed by the "alimentos previstos" choropleth.
 *
 * `codigoIbge` is the 7-digit IBGE code (matches `codarea` in
 * `public/geo/geojs-100-mun.json`). The município is the **supplier's**: the
 * figure says how much food is planned to be bought from organizations located
 * there, not how much reaches its cozinhas. Only municípios with at least one
 * planned purchase have a row.
 *
 * @example
 * const brasileia: PaaAlimentosByCity = {
 *   codigoIbge: '1200104',
 *   municipio: 'BRASILÉIA',
 *   quantidadeKg: 1250,
 *   percentualDoBrasil: 0.0105, // 1250 / 11888367 * 100
 *   produtos: 1,
 *   fornecedores: 1,
 * };
 */
export type PaaAlimentosByCity = {
  /** 7-digit IBGE code; joins to `feature.properties.codarea` on the map. */
  codigoIbge: string;
  /** Município name as spelled in the CONAB source. */
  municipio: string;
  /** Total planned quantity of food, in kg, summed over every product row. */
  quantidadeKg: number;
  /**
   * Share (%) of all the food planned in Brazil:
   * `(quantidadeKg / Σ quantidadeKg) * 100`, rounded to four decimals. Never
   * `null`: only municípios with a purchase have a row, so the total is > 0.
   */
  percentualDoBrasil: number;
  /** Distinct products planned in the município. */
  produtos: number;
  /** Distinct supplier organizations (by CNPJ) in the município. */
  fornecedores: number;
};

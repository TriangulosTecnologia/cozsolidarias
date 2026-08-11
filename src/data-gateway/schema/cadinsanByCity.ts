/**
 * Canonical shape for the CADINSAN 2025 per-município aggregation consumed by
 * the food-insecurity choropleths ("com PBF" / "sem PBF").
 *
 * `codigoIbge` is the 7-digit IBGE municipality code (matches `codarea` in
 * `public/geo/geojs-100-mun.json`) and is what the map uses to join the value
 * to a polygon. The two `proporcao*` fields are the share (%) of the município's
 * CadÚnico families in food insecurity, derived from the absolute counts and the
 * CadÚnico total; they are the values the choropleths paint. `null` when the
 * município has no CadÚnico registrations (no denominator to take a share of) —
 * the map then falls back to the legend's "sem dado" color.
 */

/**
 * A single município row with its food-insecurity headcounts (with/without
 * Programa Bolsa Família), the CadÚnico total, and the derived shares (%). The
 * "com PBF" choropleth paints {@link cadinsanByCity.proporcaoComPbf}; the "sem
 * PBF" one paints {@link cadinsanByCity.proporcaoSemPbf}.
 */
export type cadinsanByCity = {
  /** 7-digit IBGE code; joins to `feature.properties.codarea` on the map. */
  codigoIbge: string;
  /** Município name (for display), from the CADINSAN source. */
  municipio: string;
  /** State (UF) full name, from the CADINSAN source. */
  uf: string;
  /** Macro-region, from the CADINSAN source. */
  regiao: string;
  /** Food-insecure CadÚnico families including PBF beneficiaries. */
  absolutoComPbf: number;
  /** Food-insecure CadÚnico families excluding PBF beneficiaries. */
  absolutoSemPbf: number;
  /** Total CadÚnico registrations in the município (the share denominator). */
  cadastrosCadunico: number;
  /**
   * Share (%) of CadÚnico families in food insecurity including PBF:
   * `(absolutoComPbf / cadastrosCadunico) * 100`, rounded to two decimals, or
   * `null` when `cadastrosCadunico` is `0` (no denominator).
   */
  proporcaoComPbf: number | null;
  /**
   * Share (%) of CadÚnico families in food insecurity excluding PBF:
   * `(absolutoSemPbf / cadastrosCadunico) * 100`, rounded to two decimals, or
   * `null` when `cadastrosCadunico` is `0` (no denominator).
   */
  proporcaoSemPbf: number | null;
};

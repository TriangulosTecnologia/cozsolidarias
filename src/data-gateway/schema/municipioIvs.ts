/**
 * Canonical shape for the per-município Social Vulnerability Index (IVS)
 * choropleth — the shape served by `/api/municipios/ivs` and joined to a polygon
 * by `codigoIbge`. One row per município present in the IVS snapshot; municípios
 * absent from it simply don't appear (the map paints them with the legend's
 * "sem dado" default color).
 *
 * Besides the overall IVS, each row carries the three IPEA sub-indices — all on
 * the same `[0, 1]` scale and IPEA faixa classification — so the map can offer a
 * choropleth variant per dimension without a second fetch.
 */

/** A single município with its overall IVS score and the three IVS sub-indices. */
export type MunicipioIvs = {
  /** 7-digit IBGE code; joins to `feature.properties.codarea` on the map. */
  codigoIbge: string;
  /** Município name (for display); taken from the source records. */
  municipio: string;
  /**
   * Overall IVS score, `0`–`1` (Atlas da Vulnerabilidade Social, IPEA, 2010).
   * Higher = more vulnerable. Always present and within `[0, 1]` — the
   * transformer drops rows where this or any sub-index is out of range or missing.
   */
  ivs: number;
  /** IVS Infraestrutura Urbana sub-index, `0`–`1`; higher = more vulnerable. */
  ivsInfraestruturaUrbana: number;
  /** IVS Capital Humano sub-index, `0`–`1`; higher = more vulnerable. */
  ivsCapitalHumano: number;
  /** IVS Renda e Trabalho sub-index, `0`–`1`; higher = more vulnerable. */
  ivsRendaETrabalho: number;
};

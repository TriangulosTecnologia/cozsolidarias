/**
 * Canonical shape for the per-município Social Vulnerability Index (IVS)
 * choropleth — the shape served by `/api/municipios/ivs` and joined to a polygon
 * by `codigoIbge`. One row per município present in the IVS snapshot; municípios
 * absent from it simply don't appear (the map paints them with the legend's
 * "sem dado" default color).
 *
 * Besides the overall IVS, each row carries the three IPEA sub-indices and the
 * IDHM family (overall index, its three dimensions and the two education
 * sub-components) — every score on the `[0, 1]` scale — so the map can offer a
 * choropleth variant per dimension without a second fetch. Note IVS and IDHM run
 * in opposite directions: higher IVS = more vulnerable, higher IDHM = better.
 */

/**
 * A single município with its overall IVS score, the three IVS sub-indices and
 * the IDHM family (overall, dimensions and education sub-components).
 */
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
  /** Overall Municipal Human Development Index (IDHM), `0`–`1`; higher = better. */
  idhm: number;
  /** IDHM Longevidade dimension, `0`–`1`; higher = better. */
  idhmLongevidade: number;
  /** IDHM Educação dimension, `0`–`1`; higher = better. */
  idhmEducacao: number;
  /** IDHM Renda dimension, `0`–`1`; higher = better. */
  idhmRenda: number;
  /** IDHM Educação escolaridade sub-component, `0`–`1`; higher = better. */
  idhmEducacaoEscolaridade: number;
  /** IDHM Educação frequência escolar sub-component, `0`–`1`; higher = better. */
  idhmEducacaoFrequencia: number;
};

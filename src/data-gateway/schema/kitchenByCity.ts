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

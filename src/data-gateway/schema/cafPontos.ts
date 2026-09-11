/**
 * Canonical GeoJSON shape for the country level of the CAF map: one point per
 * federative unit, carrying the number of CAFs it stands for.
 *
 * GeoJSON rather than vector tiles — unlike the H3 grids and the individual
 * points below it — because at 27 features a pyramid is pure overhead, and
 * because the map runtime can only join per-feature data (the hover value, the
 * proportional radius) to a `geojson` source. That join is what gives this level
 * the hover card the tiled levels cannot have.
 *
 * `quantidade` is duplicated between `properties` and the map's `mapData` join
 * on purpose: MapLibre allows feature-state expressions in paint properties
 * only, so the circle radius reads the joined value while the label, a layout
 * property, must read the feature property. Both come from this one transformer,
 * so they cannot disagree.
 */

/** One federative unit's CAF anchor, drawn at the country zooms. */
export type CafUfFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. The CAF-weighted centroid. */
    coordinates: [number, number];
  };
  properties: {
    /**
     * Full state name, e.g. `Bahia`. Doubles as the map's join key
     * (`joinKey: 'nome'`), so the hover card can title itself from
     * `MapHoverInfo.featureId` without the app carrying a sigla→name table.
     * Brazilian state names are stable and unique, which is what makes them
     * usable as an identity.
     */
    nome: string;
    /** CAFs in the UF: the sum over every município whose IBGE code it prefixes. */
    quantidade: number;
  };
};

/** Collection of UF anchors, ready to feed the map's GeoJSON source. */
export type CafUfFeatureCollection = {
  type: 'FeatureCollection';
  features: CafUfFeature[];
};

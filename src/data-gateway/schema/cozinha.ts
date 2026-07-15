/**
 * Canonical GeoJSON shapes for cozinha locations consumed by the app/map.
 *
 * Each feature carries its registration code as `properties.codigo`. The map
 * source promotes that property to the MapLibre `feature.id` (`promoteId:
 * 'codigo'`, wired via a `mapData` join in `geovisSpec`), so a click reports it
 * as `MapClickInfo.featureId` and feeds straight into `GET /api/cozinhas/[codigo]`.
 * The code lives in `properties` (not the top-level GeoJSON `id`) because
 * MapLibre feature ids must be numeric unless promoted from a property.
 */

/** A single cozinha location as a GeoJSON Point feature. */
export type CozinhaLocationFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  properties: {
    /**
     * Registration code (`Código da Cozinha`), e.g. `CS016282`. Promoted to the
     * map's clickable `feature.id` and used as the detail-endpoint lookup key.
     */
    codigo: string;
  };
};

/** Collection of cozinha locations, ready to feed a GeoJSON map source. */
export type CozinhasFeatureCollection = {
  type: 'FeatureCollection';
  features: CozinhaLocationFeature[];
};

/**
 * One município anchor point for the proportional-circle (bubble) map. The
 * `codarea` property is the join key the map uses to attach the `quantidade`
 * value (which drives the circle size) to the feature.
 */
export type CozinhaBubbleFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  properties: {
    /** 7-digit IBGE code; the map joins it to the count via `joinKey`. */
    codarea: string;
    /** Município name, for tooltips/labels. */
    municipio: string;
    /** Cozinha count in this município; encodes the circle radius. */
    quantidade: number;
  };
};

/** Collection of bubble anchors, ready to feed the circle map's GeoJSON source. */
export type CozinhasBubblesFeatureCollection = {
  type: 'FeatureCollection';
  features: CozinhaBubbleFeature[];
};

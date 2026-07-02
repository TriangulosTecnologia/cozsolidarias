/**
 * Canonical GeoJSON shapes for cozinha locations consumed by the app/map.
 *
 * Only the geometry is exposed for now (no feature properties); the contract
 * can grow a typed `properties` shape later without changing consumers.
 */

/** A single cozinha location as a GeoJSON Point feature. */
export type CozinhaLocationFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  /** No attributes exposed yet. */
  properties: Record<string, never>;
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

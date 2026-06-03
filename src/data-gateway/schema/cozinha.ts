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

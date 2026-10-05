import type {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  GeoJSONMultiPolygon,
  GeoJSONPolygon,
  GeoJSONPosition,
} from '@ttoss/geovis';

/** The only geometry types a município can match a point against. */
type PolygonalGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

/** Axis-aligned bounding box: `[minLng, minLat, maxLng, maxLat]`. */
type BBox = [number, number, number, number];

/**
 * A município feature pre-indexed with its bbox for fast rejection.
 *
 * Invariant: `codigoIbge` is the non-empty `codarea` of its feature, and
 * `bbox` encloses every vertex of `geometry`.
 *
 * @example
 * const entry: IndexedMunicipio = {
 *   codigoIbge: '3550308',
 *   geometry: { type: 'Polygon', coordinates: [ring] },
 *   bbox: [-46.83, -24.01, -46.36, -23.36],
 * };
 */
export type IndexedMunicipio = {
  codigoIbge: string;
  geometry: PolygonalGeometry;
  bbox: BBox;
};

/**
 * Ray-casting point-in-ring test (even–odd rule). `point` and the ring vertices
 * are `[lng, lat]`. Only the first two ordinates are read, so 3D positions work.
 */
const pointInRing = (
  point: [number, number],
  ring: GeoJSONPosition[]
): boolean => {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * Point-in-polygon for a single polygon (outer ring minus holes). `rings[0]` is
 * the outer ring; any subsequent rings are holes.
 */
const pointInPolygon = (
  point: [number, number],
  rings: GeoJSONPosition[][]
): boolean => {
  const [outer, ...holes] = rings;

  if (!outer || !pointInRing(point, outer)) {
    return false;
  }

  return !holes.some((hole) => {
    return pointInRing(point, hole);
  });
};

/** The polygons of a geometry, a `Polygon` being a single-member list. */
const polygonsOf = (geometry: PolygonalGeometry): GeoJSONPosition[][][] => {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
};

/** Point-in-geometry: inside any of its polygons. */
const pointInGeometry = (
  point: [number, number],
  geometry: PolygonalGeometry
): boolean => {
  return polygonsOf(geometry).some((polygon) => {
    return pointInPolygon(point, polygon);
  });
};

/** Computes the bbox of a `Polygon` / `MultiPolygon` in one pass. */
const computeBBox = (geometry: PolygonalGeometry): BBox => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (position: GeoJSONPosition) => {
    const [lng, lat] = position;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };

  for (const polygon of polygonsOf(geometry)) {
    for (const ring of polygon) {
      for (const position of ring) visit(position);
    }
  }

  return [minLng, minLat, maxLng, maxLat];
};

const insideBBox = (point: [number, number], bbox: BBox): boolean => {
  const [lng, lat] = point;
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
};

/** The feature's `codarea` (IBGE code) as a string, or `''` when absent. */
const codareaOf = (feature: GeoJSONFeature): string => {
  return String(feature.properties?.['codarea'] ?? '');
};

/**
 * Builds the searchable index once: keeps only polygonal features that carry a
 * `codarea`, paired with their precomputed bbox. Feature order is preserved, so
 * {@link findMunicipio} resolves overlaps to the first feature in the input.
 *
 * @param municipios - Brazilian municipalities GeoJSON
 * (`public/geo/geojs-100-mun.json`).
 * @returns One {@link IndexedMunicipio} per kept feature, in input order.
 *
 * @example
 * const index = indexMunicipios(municipios);
 * // [{ codigoIbge: '1100015', geometry: { type: 'Polygon', ... }, bbox: [...] }, ...]
 */
export const indexMunicipios = (
  municipios: GeoJSONFeatureCollection
): IndexedMunicipio[] => {
  const indexed: IndexedMunicipio[] = [];

  for (const feature of municipios.features) {
    const geometry = feature.geometry;
    if (
      !geometry ||
      (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
    ) {
      continue;
    }

    const codigoIbge = codareaOf(feature);
    if (!codigoIbge) {
      continue;
    }

    indexed.push({ codigoIbge, geometry, bbox: computeBBox(geometry) });
  }

  return indexed;
};

/**
 * Finds the município containing a point: a bbox fast-reject, then an exact
 * point-in-polygon test (even–odd rule, holes excluded).
 *
 * @param params.index - Index built by {@link indexMunicipios}.
 * @param params.point - `[lng, lat]` to locate.
 * @returns The first indexed município whose geometry contains `point`, or
 * `undefined` when none does.
 *
 * @example
 * findMunicipio({ index, point: [-46.63, -23.55] })?.codigoIbge; // '3550308'
 * findMunicipio({ index, point: [0, 0] }); // undefined
 */
export const findMunicipio = ({
  index,
  point,
}: {
  index: IndexedMunicipio[];
  point: [number, number];
}): IndexedMunicipio | undefined => {
  // deferred: linear scan over ~5.5k bboxes per point, revisit if aggregation
  // stops being memoized per year or the cozinha count grows by an order of
  // magnitude (then a spatial grid/R-tree over the bboxes).
  return index.find((entry) => {
    return (
      insideBBox(point, entry.bbox) && pointInGeometry(point, entry.geometry)
    );
  });
};

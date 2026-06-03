import type {
  GeoJSONFeatureCollection,
  GeoJSONGeometry,
  GeoJSONPosition,
} from '@ttoss/geovis';

import type { StaticCozinhaSource } from '../../data-source-static/types';
import type { kitchenByCity } from '../schema';

/** Axis-aligned bounding box: `[minLng, minLat, maxLng, maxLat]`. */
type BBox = [number, number, number, number];

/** A município feature pre-indexed with its bbox for fast rejection. */
type IndexedMunicipio = {
  codigoIbge: string;
  geometry: GeoJSONGeometry;
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

/** Point-in-geometry for `Polygon` / `MultiPolygon`; other types never match. */
const pointInGeometry = (
  point: [number, number],
  geometry: GeoJSONGeometry
): boolean => {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => {
      return pointInPolygon(point, polygon);
    });
  }

  return false;
};

/** Computes the bbox of a `Polygon` / `MultiPolygon` in one pass. */
const computeBBox = (geometry: GeoJSONGeometry): BBox => {
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

  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const position of ring) visit(position);
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const position of ring) visit(position);
      }
    }
  }

  return [minLng, minLat, maxLng, maxLat];
};

const insideBBox = (point: [number, number], bbox: BBox): boolean => {
  const [lng, lat] = point;
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
};

/**
 * Builds the searchable index once: keeps only polygonal features that carry a
 * `codarea`, paired with their precomputed bbox.
 */
const indexMunicipios = (
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

    const codigoIbge = String(feature.properties?.['codarea'] ?? '');
    if (!codigoIbge) {
      continue;
    }

    indexed.push({ codigoIbge, geometry, bbox: computeBBox(geometry) });
  }

  return indexed;
};

/** Returns the most frequent (non-empty) name, ties broken by first seen. */
const mostVotedName = (nameVotes: Map<string, number>): string => {
  let best = '';
  let bestVotes = -1;

  for (const [name, votes] of nameVotes) {
    if (name !== '' && votes > bestVotes) {
      best = name;
      bestVotes = votes;
    }
  }

  return best;
};

/**
 * Aggregates cozinhas into per-município counts via point-in-polygon.
 *
 * Each cozinha with coordinates is located inside one SP município polygon
 * (matched by `codarea`), and counts are tallied per code. Cozinhas without
 * coordinates, or whose point falls outside every SP polygon (e.g. other
 * states), are dropped.
 *
 * The join key (`codigoIbge`) comes from the geometry and is authoritative. The
 * display `municipio` name comes from the source records, which can be dirty
 * (a record's typed município may disagree with where its coordinates land), so
 * we pick the *most frequent* name among the cozinhas in each polygon rather
 * than the first one.
 *
 * @param cozinhas - Raw cozinha records from data-source-static.
 * @param municipios - SP municipalities GeoJSON (`public/geo/municipios-sp.json`).
 * @returns One {@link kitchenByCity} per município that has ≥1 cozinha.
 */
export const toCozinhasPorMunicipio = (
  cozinhas: StaticCozinhaSource[],
  municipios: GeoJSONFeatureCollection
): kitchenByCity[] => {
  const index = indexMunicipios(municipios);
  const counts = new Map<
    string,
    { quantidade: number; nameVotes: Map<string, number> }
  >();

  for (const cozinha of cozinhas) {
    if (cozinha.latitude === null || cozinha.longitude === null) {
      continue;
    }

    const point: [number, number] = [cozinha.longitude, cozinha.latitude];

    const match = index.find((entry) => {
      return (
        insideBBox(point, entry.bbox) && pointInGeometry(point, entry.geometry)
      );
    });

    if (!match) {
      continue;
    }

    let current = counts.get(match.codigoIbge);
    if (!current) {
      current = { quantidade: 0, nameVotes: new Map() };
      counts.set(match.codigoIbge, current);
    }

    current.quantidade += 1;
    const name = cozinha.municipio;
    current.nameVotes.set(name, (current.nameVotes.get(name) ?? 0) + 1);
  }

  return [...counts].map(([codigoIbge, { quantidade, nameVotes }]) => {
    return {
      codigoIbge,
      municipio: mostVotedName(nameVotes),
      quantidade,
    };
  });
};

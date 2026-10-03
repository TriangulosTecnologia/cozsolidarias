import type { StaticCafHexbinSource } from '@/data-source-static/types';

import type {
  CafHexbinFeature,
  CafHexbinFeatureCollection,
} from '../schema/cafHexbin';

/**
 * Assembles the hexbin grid's GeoJSON from the offline snapshot.
 *
 * Each cell becomes a feature whose `h3` and `count` the map joins and paints,
 * and its ring is guaranteed closed (first vertex repeated last, as GeoJSON
 * requires). The committed snapshots already store closed rings, so closing is
 * idempotent: a ring is closed only when it is open.
 *
 * Cells are passed through whatever their count, empty ones included: the grid
 * covers the whole territory, and a hole in it would read as missing data
 * rather than as zero. Which cells the map colours is the map's decision, not
 * this one's.
 *
 * @param source - The validated snapshot from `readStaticCafHexbin`.
 * @returns The FeatureCollection the map's source consumes.
 *
 * @example
 * toCafHexbin({ resolution: 4, cells: [{ h3: '84a', count: 2, ring: [[-46, -23], [-45, -23], [-45, -22]] }] });
 * // { type: 'FeatureCollection', features: [{ ..., geometry: { coordinates: [[[-46,-23],[-45,-23],[-45,-22],[-46,-23]]] } }] }
 */
/** The ring with its first vertex repeated last, unless it already is. */
const closeRing = (ring: [number, number][]): [number, number][] => {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  return closed ? [...ring] : [...ring, first];
};

export const toCafHexbin = (
  source: StaticCafHexbinSource
): CafHexbinFeatureCollection => {
  const features = source.cells.map((cell): CafHexbinFeature => {
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [closeRing(cell.ring)],
      },
      properties: { h3: cell.h3, count: cell.count },
    };
  });

  return { type: 'FeatureCollection', features };
};

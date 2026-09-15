import type { StaticCafHexbinSource } from '@/data-source-static/types';

import type {
  CafHexbinFeature,
  CafHexbinFeatureCollection,
} from '../schema/cafHexbin';

/**
 * Assembles the hexbin grid's GeoJSON from the offline snapshot.
 *
 * Two things happen here, and both are why the snapshot is not stored as
 * GeoJSON: each cell's open ring is closed (its first vertex repeated, which
 * GeoJSON requires and storing would have added ~6% to the file for a value
 * already present), and the cell becomes a feature whose `h3` and `count` the
 * map joins and paints.
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
export const toCafHexbin = (
  source: StaticCafHexbinSource
): CafHexbinFeatureCollection => {
  const features = source.cells.map((cell): CafHexbinFeature => {
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[...cell.ring, cell.ring[0]]],
      },
      properties: { h3: cell.h3, count: cell.count },
    };
  });

  return { type: 'FeatureCollection', features };
};

/**
 * Canonical GeoJSON shape for the CAF hexbin map: one hexagon per H3 cell
 * covering Brazil, carrying how many CAFs fall inside it.
 *
 * GeoJSON rather than vector tiles — unlike the `cafs` mode's H3 grids, which
 * are the same binning tiled — because the map runtime can only join per-feature
 * data to a `geojson` source. That join is what lets one polygon layer carry a
 * real colour ramp, instead of the stacked one-sided filters a tiled source
 * forces.
 *
 * At one fixed resolution the whole grid is ~6k features, which is small enough
 * to ship whole and leaves the mode with no zoom hierarchy to maintain.
 */

/**
 * The H3 resolutions a snapshot exists for, coarse to fine.
 *
 * Each step is a factor of seven in cell area, so the grid — and the file the
 * browser fetches — grows sevenfold per step down: r3 is 1.1k cells (0.2 MB),
 * r4 6k (1.7 MB), r5 35k (6 MB). Generated offline by
 * `scripts/generateCafHexbin.ts`, one run per entry.
 */
export const CAF_HEXBIN_RESOLUTIONS = [3, 4, 5] as const;

/** One of {@link CAF_HEXBIN_RESOLUTIONS}. */
export type CafHexbinResolution = (typeof CAF_HEXBIN_RESOLUTIONS)[number];

/** The resolution the mode opens at: the ~45 km cell it was specified with. */
export const DEFAULT_CAF_HEXBIN_RESOLUTION: CafHexbinResolution = 4;

/** Whether `value` is a resolution a snapshot exists for. */
export const isCafHexbinResolution = (
  value: number
): value is CafHexbinResolution => {
  return CAF_HEXBIN_RESOLUTIONS.some((resolution) => {
    return resolution === value;
  });
};

/** One hexagon of the grid. */
export type CafHexbinFeature = {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    /**
     * A single closed ring, GeoJSON order (`[longitude, latitude]`). Six or
     * eight vertices — H3 adds vertices where a cell crosses an icosahedron
     * edge.
     */
    coordinates: [number, number][][];
  };
  properties: {
    /**
     * H3 index of the cell. Doubles as the map's join key (`joinKey: 'h3'`),
     * which is what promotes it to the MapLibre feature id: a string cannot be
     * carried in the feature's own `id`, because geojson is serialised through
     * the vector-tile encoder and that spec allows only integer ids.
     */
    h3: string;
    /**
     * CAFs whose principal property falls in the cell. `0` is a real answer —
     * the grid covers the whole territory, so an empty cell is a fact about it
     * rather than missing data.
     */
    count: number;
  };
};

/** Collection of hexagons, ready to feed the map's GeoJSON source. */
export type CafHexbinFeatureCollection = {
  type: 'FeatureCollection';
  features: CafHexbinFeature[];
};

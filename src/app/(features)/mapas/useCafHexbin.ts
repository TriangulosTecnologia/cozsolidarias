import * as React from 'react';

import {
  type CafHexbinFeatureCollection,
  type CafHexbinResolution,
  DEFAULT_CAF_HEXBIN_RESOLUTION,
} from '@/data-gateway/schema';

import { CAF_HEXBIN_URL } from './geovisCafHexbin';

/** Fetches one resolution's grid. */
const fetchGrid = async (
  resolution: CafHexbinResolution
): Promise<CafHexbinFeatureCollection> => {
  const response = await fetch(`${CAF_HEXBIN_URL}?r=${resolution}`);
  return response.json() as Promise<CafHexbinFeatureCollection>;
};

/** What {@link useCafHexbin} hands the map. */
type CafHexbin = {
  /** The selected resolution's grid, or `undefined` until it has loaded. */
  cells: CafHexbinFeatureCollection | undefined;
  /** `true` while the selected resolution is not yet in hand. */
  loading: boolean;
};

/**
 * Loads the hexagon grid for the selected resolution, keeping every resolution
 * fetched so far in memory.
 *
 * Fetched on demand rather than prefetched, unlike the time-lapse years: the
 * grids run from 0.2 MB at r3 to 6 MB at r5, and pulling all three for a
 * setting most readers never touch would cost more than the mode itself.
 *
 * `seed` is the grid the mode already loaded through `useMapaDatasets`. It is
 * read *beside* the cache rather than written into it, so the default
 * resolution needs no request and no effect to plant it — it is simply what
 * this hook answers with while that is the resolution asked for.
 *
 * @param params.resolution - The selected H3 resolution.
 * @param params.seed - The default resolution's grid, when the mode has it.
 * @returns The grid for `resolution`, and whether it is still in flight.
 *
 * @example
 * const { cells, loading } = useCafHexbin({ resolution: 5, seed: datasets.cafHexbin });
 */
export const useCafHexbin = ({
  resolution,
  seed,
}: {
  resolution: CafHexbinResolution;
  seed?: CafHexbinFeatureCollection;
}): CafHexbin => {
  const [fetched, setFetched] = React.useState<
    Partial<Record<CafHexbinResolution, CafHexbinFeatureCollection>>
  >({});

  const seeded =
    resolution === DEFAULT_CAF_HEXBIN_RESOLUTION ? seed : undefined;

  const cells = fetched[resolution] ?? seeded;

  React.useEffect(() => {
    if (cells) {
      return;
    }

    let alive = true;

    void fetchGrid(resolution)
      .then((grid) => {
        if (alive) {
          setFetched((current) => {
            return { ...current, [resolution]: grid };
          });
        }
      })
      // A failed grid leaves the previous resolution on screen rather than
      // blanking the map: the setting did not take, which is readable, where an
      // empty source would paint the country away.
      .catch(() => {
        return undefined;
      });

    return () => {
      alive = false;
    };
  }, [resolution, cells]);

  return { cells, loading: cells === undefined };
};

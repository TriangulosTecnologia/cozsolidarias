import {
  DEFAULT_CAF_HEXBIN_RESOLUTION,
  isCafHexbinResolution,
} from '@/data-gateway/schema';

import { gateway } from '../../../../gateway';

/**
 * Returns the CAF hexbin grid as GeoJSON: one Polygon per H3 cell covering
 * Brazil, each carrying its `h3` index (the map's `joinKey`) and the `count` of
 * CAFs inside it. Feeds the `cafs-hexbin` map mode's source and its `mapData`
 * join.
 *
 * `?r=` picks the H3 resolution, which is what the map's mesh setting drives.
 * An unknown value falls back to the default rather than 404ing: the grid is
 * the whole mode, and a stale bookmark is better served a readable map at the
 * usual cell size than an error.
 */
export const GET = async (request: Request) => {
  const requested = Number(new URL(request.url).searchParams.get('r'));

  const resolution = isCafHexbinResolution(requested)
    ? requested
    : DEFAULT_CAF_HEXBIN_RESOLUTION;

  const hexbin = await gateway.getCafHexbin(resolution);
  return Response.json(hexbin);
};

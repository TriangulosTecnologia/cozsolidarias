import { gateway } from '../../../../gateway';

/**
 * Returns the CAF hexbin grid as GeoJSON: one Polygon per H3 cell covering
 * Brazil, each carrying its `h3` index (the map's `joinKey`) and the `count` of
 * CAFs inside it. Feeds the `cafs-hexbin` map mode's source and its `mapData`
 * join.
 */
export const GET = async () => {
  const hexbin = await gateway.getCafHexbin();
  return Response.json(hexbin);
};

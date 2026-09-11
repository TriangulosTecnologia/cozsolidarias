import {
  CAF_CELL_BOUNDS_PROPERTIES,
  CAF_DRILL_ZOOM_BY_LAYER,
} from './geovisCafLayers';

/** Where a drill-down click sends the camera. */
export type CafDrillCamera = {
  /** `[lng, lat]` the camera centres on. */
  center: [number, number];
  /** The zoom at which the clicked mark has become several smaller ones. */
  zoom: number;
};

/**
 * The layers a drill-down click is listened for on, in the order they are
 * registered. Derived from {@link CAF_DRILL_ZOOM_BY_LAYER} so a layer can never
 * be listened to without a target zoom, nor given one without being listened to.
 *
 * @example
 * CAF_DRILL_LAYER_IDS.includes('cafs-h3-r5-b0'); // true
 * CAF_DRILL_LAYER_IDS.includes('cafs-pts'); // false — the end of the hierarchy
 */
export const CAF_DRILL_LAYER_IDS: string[] = Object.keys(
  CAF_DRILL_ZOOM_BY_LAYER
);

/**
 * Reads one of a tile feature's numeric properties.
 *
 * Vector-tile properties arrive as `unknown`, and a missing one is a real
 * possibility rather than a defect — see {@link cellCenter}.
 */
const numericProperty = (
  properties: Record<string, unknown>,
  key: string
): number | undefined => {
  const value = properties[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

/**
 * The centre of the clicked cell's own hexagon, from the extent the tile
 * carries, or `undefined` when the tile carries no extent.
 *
 * That second case is not defensive padding: `public/tiles` is git-ignored and
 * built by `scripts/generateCafTiles.ts` against a CSV that is not in the
 * repository, so a checkout can legitimately hold grids generated before cells
 * carried their extent. The drill still works on those — it just centres on the
 * circle instead of the cell (see {@link cafDrillCamera}), which is the same
 * behaviour with a worse frame, rather than a dead click.
 *
 * @param properties - The clicked tile feature's properties.
 * @returns The hexagon's centre as `[lng, lat]`, or `undefined`.
 *
 * @example
 * cellCenter({ w: -46, s: -24, e: -45, n: -23 }); // [-45.5, -23.5]
 * cellCenter({ count: 12 }); // undefined
 */
export const cellCenter = (
  properties: Record<string, unknown>
): [number, number] | undefined => {
  const west = numericProperty(properties, CAF_CELL_BOUNDS_PROPERTIES.west);
  const south = numericProperty(properties, CAF_CELL_BOUNDS_PROPERTIES.south);
  const east = numericProperty(properties, CAF_CELL_BOUNDS_PROPERTIES.east);
  const north = numericProperty(properties, CAF_CELL_BOUNDS_PROPERTIES.north);

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined
  ) {
    return undefined;
  }

  return [(west + east) / 2, (south + north) / 2];
};

/**
 * The camera a click on one of the CAF hierarchy's marks should move to, or
 * `undefined` when the clicked layer does not drill.
 *
 * The zoom is the clicked level's hand-over zoom, never a fit of the cell: the
 * promise is "this mark becomes its children", and fitting the hexagon to the
 * container overshoots that by about three zoom levels — a clicked r3 cell would
 * land past the whole grid and straight in the individual points. At the
 * hand-over zoom the cell is roughly 100px across and its seven children are all
 * on screen, which is the picture the click promises.
 *
 * The centre is the cell's own, not the circle's. The two differ by up to half a
 * cell because the circle is drawn at the weighted centroid of the CAFs inside
 * it, and at the hand-over zoom half a cell is about 50px — enough to push a
 * child off the frame the reader is looking at.
 *
 * @param params.layerId - Id of the layer that received the click.
 * @param params.properties - The clicked feature's tile properties.
 * @param params.coordinates - The clicked feature's own `[lng, lat]`, used when
 *   the feature carries no extent (the UF anchors, which have none, and grids
 *   generated before cells carried theirs).
 * @returns The camera to move to, or `undefined` to ignore the click.
 *
 * @example
 * cafDrillCamera({
 *   layerId: 'cafs-h3-r3-b3',
 *   properties: { count: 28_000, w: -46, s: -24, e: -45, n: -23 },
 *   coordinates: [-45.2, -23.9],
 * });
 * // { center: [-45.5, -23.5], zoom: 7 }
 *
 * @example
 * cafDrillCamera({ layerId: 'cafs-pts', properties: {}, coordinates: [-45, -23] });
 * // undefined — an individual CAF is the end of the hierarchy
 */
export const cafDrillCamera = ({
  layerId,
  properties,
  coordinates,
}: {
  layerId: string;
  properties: Record<string, unknown>;
  coordinates: [number, number];
}): CafDrillCamera | undefined => {
  const zoom = CAF_DRILL_ZOOM_BY_LAYER[layerId];

  if (zoom === undefined) {
    return undefined;
  }

  return { center: cellCenter(properties) ?? coordinates, zoom };
};

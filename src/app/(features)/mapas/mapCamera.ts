import type { MapMode } from './geovisScales';

/**
 * Geographic extent of Brazil, in degrees, read off `public/geo/estados.json` —
 * the same geometry the map draws as its state outlines, so the frame matches
 * what is on screen rather than a remembered bounding box.
 *
 * The eastern edge is `-32.41`, not continental Brazil's `-34.79`: the file
 * includes the oceanic territory (Fernando de Noronha, Atol das Rocas), and
 * "the whole territory" is what the camera is asked to frame. It costs about
 * two degrees of ocean on the right.
 *
 * `tests/unit/tests/mapCamera.test.ts` re-derives this from the GeoJSON and
 * fails if it drifts: the app frames its camera from this constant and never
 * parses the file, so nothing at runtime would notice them diverging.
 */
export const BRAZIL_BBOX = {
  minLng: -73.9904,
  maxLng: -32.4079,
  minLat: -33.7439,
  maxLat: 5.2718,
} as const;

/**
 * Extent of the Southeast (MG, ES, RJ, SP), which is the assentamentos mode's
 * current coverage. Derived from the same file, filtered to those four state
 * codes; widen it as coverage grows.
 */
export const SUDESTE_BBOX = {
  minLng: -53.1079,
  maxLng: -39.6678,
  minLat: -25.3089,
  maxLat: -14.2467,
} as const;

/** A geographic extent the camera can be fitted to. */
export type Bbox = {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
};

/** The container the camera is being fitted to, in CSS pixels. */
export type Viewport = { width: number; height: number };

/**
 * Breathing room left between the territory and the container edges, in CSS
 * pixels, on each side.
 *
 * Not sized to the sidebar or the legend: both float over the map as overlays,
 * and reserving space for them would move the camera whenever one opens.
 */
export const FIT_PADDING = 24;

/** MapLibre's tile size: at zoom `z` the world is `512 · 2^z` pixels wide. */
const TILE_SIZE = 512;

/**
 * Closest the user may zoom in, on every camera.
 *
 * Kept from the hand-tuned camera: past this the município polygons outrun the
 * simplified geometry and the pins drift from their rendered circles.
 */
const MAX_ZOOM_IN = 9;

/**
 * Closest the user may zoom in on the CAF hierarchy.
 *
 * Deeper than every other camera because that ceiling exists to protect the
 * município polygons, and this view paints none — its points come from tiles
 * built to z11, whose coordinates are exact at any zoom.
 *
 * The individual CAFs start being drawn at z10, where the H3 grid hands over
 * (see `CAF_POINTS_MIN_ZOOM` in `geovisCafLayers`), so the ceiling sits well
 * above that: the deepest level is the one a reader spends time in, and it
 * needs room to be read at street scale.
 */
const CAFS_MAX_ZOOM_IN = 14;

/**
 * Zoom each camera falls back to when there is no container to measure — the
 * server pass, and any client pass before the viewport is read. These are the
 * values the map used before the camera was fitted, so an unmeasured render is
 * the old behaviour rather than a new one.
 */
const UNFITTED_ZOOM: Record<'brazil' | 'sudeste', number> = {
  brazil: 4,
  sudeste: 5,
};

/**
 * Latitude as a fraction of the Web Mercator world, 0 at the north pole and 1
 * at the south.
 *
 * Needed because Mercator stretches towards the poles: Brazil spans the equator
 * and reaches 33°S, so its degrees of latitude do not map to a constant number
 * of pixels the way its degrees of longitude do.
 *
 * @param latitude - Latitude in degrees.
 * @returns Its position in `[0, 1]`.
 *
 * @example
 * mercatorFraction(0); // 0.5 — the equator
 */
const mercatorFraction = (latitude: number): number => {
  const sine = Math.sin((latitude * Math.PI) / 180);

  return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
};

/** Centre of an extent — the camera's target. */
export const centerOf = (bbox: Bbox): [number, number] => {
  return [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2];
};

/**
 * The zoom at which `bbox` fits inside a container of the given size, with
 * {@link FIT_PADDING} to spare on every side.
 *
 * Computed rather than delegated to MapLibre's `fitBounds` because geovis's
 * `view` takes only `center`/`zoom` — there are no bounds to hand it — so the
 * camera has to arrive already framed, in the spec.
 *
 * The smaller of the two axis fits wins, which is what makes the territory fit
 * rather than fill: on a short, wide viewport the height binds and space is
 * left at the sides.
 *
 * @param params.bbox - The extent to frame.
 * @param params.width - Container width in CSS pixels.
 * @param params.height - Container height in CSS pixels.
 * @returns The fitting zoom level.
 *
 * @example
 * fitZoom({ bbox: BRAZIL_BBOX, width: 360, height: 568 }); // ≈ 2.4 — a phone pulls back
 * fitZoom({ bbox: BRAZIL_BBOX, width: 1920, height: 1008 }); // ≈ 4.0
 */
export const fitZoom = ({
  bbox,
  width,
  height,
}: {
  bbox: Bbox;
  width: number;
  height: number;
}): number => {
  const usableWidth = width - 2 * FIT_PADDING;
  const usableHeight = height - 2 * FIT_PADDING;
  const lngFraction = (bbox.maxLng - bbox.minLng) / 360;
  const latFraction = Math.abs(
    mercatorFraction(bbox.minLat) - mercatorFraction(bbox.maxLat)
  );

  return Math.min(
    Math.log2(usableWidth / (TILE_SIZE * lngFraction)),
    Math.log2(usableHeight / (TILE_SIZE * latFraction))
  );
};

/** Whether a container is big enough to frame anything once padded. */
const isMeasurable = (viewport?: Viewport): viewport is Viewport => {
  return (
    viewport !== undefined &&
    viewport.width > 2 * FIT_PADDING &&
    viewport.height > 2 * FIT_PADDING
  );
};

/**
 * The camera for a visualization mode: the whole country, or the Southeast for
 * the assentamentos mode.
 *
 * `maxZoomOut` is the zoom that frames **Brazil** in this container, whichever
 * mode is active — the same floor for every camera, as before, so zooming out
 * from the assentamentos view to the country stays possible. What changed is
 * that the floor is now measured instead of fixed at `4`: `4` is the zoom that
 * frames Brazil on a large desktop, and on a phone, where the country needs
 * about `2.4`, that floor left the user unable to zoom out far enough to see
 * the territory the map is about.
 *
 * @param params.mode - The active visualization mode.
 * @param params.viewport - The container to fit, or `undefined` when there is
 * nothing to measure yet, which yields the pre-fit zooms.
 * @returns The `view` for the geovis spec.
 *
 * @example
 * viewForMode({ mode: 'pontos' }); // { zoom: 4, maxZoomOut: 4, ... } — unmeasured
 * viewForMode({ mode: 'pontos', viewport: { width: 360, height: 568 } }); // zoom ≈ 2.4
 */
export const viewForMode = ({
  mode,
  viewport,
}: {
  mode: MapMode;
  viewport?: Viewport;
}) => {
  const isAssentamentos = mode === 'assentamentos';
  const bbox = isAssentamentos ? SUDESTE_BBOX : BRAZIL_BBOX;
  const measurable = isMeasurable(viewport);

  return {
    center: centerOf(bbox),
    zoom: measurable
      ? fitZoom({ bbox, width: viewport.width, height: viewport.height })
      : UNFITTED_ZOOM[isAssentamentos ? 'sudeste' : 'brazil'],
    maxZoomIn: mode === 'cafs' ? CAFS_MAX_ZOOM_IN : MAX_ZOOM_IN,
    maxZoomOut: measurable
      ? fitZoom({
          bbox: BRAZIL_BBOX,
          width: viewport.width,
          height: viewport.height,
        })
      : UNFITTED_ZOOM.brazil,
  };
};

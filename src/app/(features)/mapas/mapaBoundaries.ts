import {
  appendBoundaryGroup,
  createBoundaryGroup,
  type VisualizationSpec,
} from '@ttoss/geovis';

import { CAFS_LAYER_IDS } from './geovisCafLayers';

/**
 * State outline group (`/geo/estados.json`), appended to every mode.
 *
 * @example
 * appendBoundaryGroup(spec, ESTADOS_BOUNDARY_GROUP);
 */
export const ESTADOS_BOUNDARY_GROUP = createBoundaryGroup({
  id: 'estados-boundary',
  data: '/geo/estados.json',
  paint: { lineColor: '#241F21', lineWidth: 0.8 },
});

/**
 * Município outline group (`/geo/geojs-100-mun.json`), appended to every mode
 * except `assentamentos`.
 *
 * @example
 * appendBoundaryGroup(spec, MUNICIPIOS_BOUNDARY_GROUP);
 */
export const MUNICIPIOS_BOUNDARY_GROUP = createBoundaryGroup({
  id: 'municipios-boundary',
  data: '/geo/geojs-100-mun.json',
  paint: { lineColor: '#B2B2B2', lineWidth: 0.6 },
});

/**
 * Point/circle overlays that must always paint above the boundary outlines: the
 * kitchen points, the proportional circles and the CAF points. Boundary groups
 * are appended *after* every `buildSpec` layer, so without lifting these back to
 * the top the thin boundary lines would render over them.
 *
 * Their relative order is the one `buildSpec` gave them, which is what keeps the
 * few thousand kitchen points above the millions of CAF dots.
 */
const TOP_OVERLAY_LAYER_IDS = new Set([
  'cozinhas-pts',
  'cozinhas-bolhas',
  ...CAFS_LAYER_IDS,
]);

/**
 * Re-orders a spec's layers so the point/circle overlays sit last (topmost),
 * keeping every other layer's relative order and each layer's config untouched.
 * Returns the spec unchanged when it carries none of them.
 *
 * Runs *after* the boundary groups are appended, which is what makes the kitchen
 * points win over the município/estado outlines.
 *
 * @param spec - The spec whose layers to re-order (boundary lines already appended).
 * @returns A spec with the overlay layers moved to the end (or the same spec).
 *
 * @example
 * liftOverlaysAboveBoundaries({ ...spec, layers: [fill, points, boundaryLine] });
 * // → layers: [fill, boundaryLine, points]
 */
export const liftOverlaysAboveBoundaries = (
  spec: VisualizationSpec
): VisualizationSpec => {
  const above = spec.layers.filter((layer) => {
    return TOP_OVERLAY_LAYER_IDS.has(layer.id);
  });
  if (above.length === 0) {
    return spec;
  }
  const below = spec.layers.filter((layer) => {
    return !TOP_OVERLAY_LAYER_IDS.has(layer.id);
  });
  return { ...spec, layers: [...below, ...above] };
};

/**
 * The non-React equivalent of what `useMapaSpec` renders for the choropleth
 * modes: appends the município then the estado outline (estado last, so its
 * darker line wins along shared borders) and lifts the point/circle overlays
 * above them. Lets a server route reproduce the `/mapas` spec without mounting
 * the hook.
 *
 * @param spec - A `buildSpec` result for a mode that keeps the município fill.
 * @returns The spec with both outline groups and the overlays on top.
 *
 * @example
 * withMapaBoundaries(buildSpec(byCity, 'coropletico'));
 */
export const withMapaBoundaries = (
  spec: VisualizationSpec
): VisualizationSpec => {
  return liftOverlaysAboveBoundaries(
    appendBoundaryGroup(
      appendBoundaryGroup(spec, MUNICIPIOS_BOUNDARY_GROUP),
      ESTADOS_BOUNDARY_GROUP
    )
  );
};

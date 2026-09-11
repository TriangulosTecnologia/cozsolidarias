import {
  createBoundaryGroup,
  useBoundaryToggle,
  type VisualizationSpec,
} from '@ttoss/geovis';
import * as React from 'react';

import type {
  cadinsanByCity,
  cafByCity,
  CafUfFeatureCollection,
  CozinhasFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import {
  type AssentamentoAtributo,
  buildSpec,
  CAFS_LAYER_IDS,
  COZINHAS_SOURCE_ID,
  type MapMode,
} from './geovisSpec';
import { viewForMode } from './mapCamera';
import {
  emptyViewportSnapshot,
  parseViewport,
  subscribeToOrientation,
  viewportSnapshot,
} from './mapViewportStore';
import { type NomesPorCodigo, useMapaTooltips } from './useMapaTooltips';

export type { NomesPorCodigo };

/**
 * Time-lapse: serve the kitchen points from the selected year's in-memory
 * FeatureCollection instead of the `/api/cozinhas` URL, so selecting a year
 * (and the play animation) swaps them without a network round-trip.
 *
 * @param params.spec - The spec to patch.
 * @param params.cozinhasPoints - The year's points, or `undefined` before it
 * has loaded, which keeps `buildSpec`'s URL as the fallback.
 * @returns The spec, with the year's points when there are any.
 */
const withYearPoints = ({
  spec,
  cozinhasPoints,
}: {
  spec: VisualizationSpec;
  cozinhasPoints?: CozinhasFeatureCollection;
}): VisualizationSpec => {
  if (!cozinhasPoints) {
    return spec;
  }

  return {
    ...spec,
    sources: spec.sources.map((source) => {
      return source.type === 'geojson' && source.id === COZINHAS_SOURCE_ID
        ? { ...source, data: cozinhasPoints }
        : source;
    }),
  };
};

const estadosGroup = createBoundaryGroup({
  id: 'estados-boundary',
  data: '/geo/estados.json',
  paint: { lineColor: '#241F21', lineWidth: 0.8 },
});

const municipiosGroup = createBoundaryGroup({
  id: 'municipios-boundary',
  data: '/geo/geojs-100-mun.json',
  paint: { lineColor: '#B2B2B2', lineWidth: 0.6 },
});

/**
 * Point/circle overlays that must always paint above the boundary outlines: the
 * kitchen points, the proportional circles and the CAF points. `useBoundaryToggle`
 * appends the município/estado boundary groups *after* every `buildSpec` layer, so
 * without lifting these back to the top the thin boundary lines would render over
 * them (e.g. município borders drawn over the kitchen points).
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
 * Re-orders a spec's layers so the {@link TOP_OVERLAY_LAYER_IDS} overlays sit
 * last (topmost), keeping every other layer's relative order and each layer's
 * config untouched. Returns the spec unchanged when it carries none of them.
 *
 * This runs *after* {@link useBoundaryToggle} has appended the boundary lines,
 * which is what makes the kitchen points win over the município/estado outlines.
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

/** The map data the spec is derived from, plus the active visualization mode. */
type UseMapaSpecParams = {
  kitchenByCity: kitchenRateByCity[];
  ivsByCity: MunicipioIvs[];
  nomesPorCodigo: NomesPorCodigo;
  assentamentos: AssentamentoAtributo[];
  cozinhaNames: Record<string, string>;
  /** `codigo → emFuncionamento` for every kitchen point; colors the points by status. */
  cozinhaStatus: Record<string, string>;
  /** Per-município CAF shares for the "% dos CAFs do Brasil" choropleth. */
  cafByCity: cafByCity[];
  /**
   * The 27 UF anchors with their CAF totals. Feeds the `cafs` mode's country
   * level and the join behind its hover card; `undefined` until it loads, which
   * leaves the source on its `/api/cafs/pontos-por-uf` URL.
   */
  cafPontosPorUf?: CafUfFeatureCollection;
  /** Per-município CADINSAN food-insecurity shares for the food-insecurity choropleths. */
  cadinsanByCity: cadinsanByCity[];
  mode: MapMode;
  /**
   * Kitchen points for the selected time-lapse year, held in memory. When set,
   * it replaces the `cozinhas` source's `/api/cozinhas` URL so switching years
   * (and the play animation) swap the points from memory. `undefined` until the
   * year's data has loaded — the source then falls back to the URL.
   */
  cozinhasPoints?: CozinhasFeatureCollection;
};

/**
 * Builds the geovis visualization spec for the maps playground, wiring every
 * layer's hover tooltip (via {@link useMapaTooltips}) and the boundary-group
 * toggle to the active mode. The point/circle overlays — kitchens, circles and
 * CAF points — are lifted above the appended boundary lines (via
 * {@link liftOverlaysAboveBoundaries}) so they always render on top. Memoizes the spec so the map only
 * rebuilds when its inputs change.
 *
 * @param params - The loaded map data and the active {@link MapMode}.
 * @returns The geovis {@link VisualizationSpec} for the current mode.
 *
 * @example
 * const spec = useMapaSpec({ kitchenByCity, ivsByCity, nomesPorCodigo, assentamentos, cozinhaNames, cozinhaStatus, cafByCity, cadinsanByCity, mode });
 * // <GeovisWorkspace visualizationSpec={spec} ... />
 */
export const useMapaSpec = ({
  kitchenByCity,
  ivsByCity,
  nomesPorCodigo,
  assentamentos,
  cozinhaNames,
  cozinhaStatus,
  cafByCity,
  cafPontosPorUf,
  cadinsanByCity,
  mode,
  cozinhasPoints,
}: UseMapaSpecParams) => {
  const { hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafUfTooltip } =
    useMapaTooltips({
      kitchenByCity,
      nomesPorCodigo,
      assentamentos,
      cozinhaNames,
      cozinhaStatus,
      cafByCity,
      cadinsanByCity,
      mode,
    });

  /*
   * Re-read on rotation only (see `subscribeToOrientation`), so the fit below is
   * a framing applied when the map opens rather than something that fights the
   * user's own panning and zooming.
   */
  const viewportSize = React.useSyncExternalStore(
    subscribeToOrientation,
    viewportSnapshot,
    emptyViewportSnapshot
  );

  const viewport = React.useMemo(() => {
    return parseViewport(viewportSize);
  }, [viewportSize]);

  const baseSpec = React.useMemo(() => {
    const spec = buildSpec(kitchenByCity, mode, hoverTooltip, ivsByCity, {
      assentamentos: {
        atributos: assentamentos,
        hoverRender: assentamentoTooltip,
      },
      cozinhaTooltipRender: cozinhaTooltip,
      cozinhaStatus,
      cafByCity,
      cafPontosPorUf,
      cafUfHoverRender: cafUfTooltip,
      cadinsanByCity,
    });

    // Frame the territory in whatever container this screen gives us:
    // `buildSpec` has no viewport, so the camera it returned is the unmeasured
    // one. Zoom 4 frames Brazil on a large desktop and crops it everywhere
    // else — a 360px phone needs about 2.4 — and the old `maxZoomOut: 4` meant
    // the user could not even zoom out to recover it.
    const fitted = {
      ...spec,
      view: { ...spec.view, ...viewForMode({ mode, viewport }) },
    };

    return withYearPoints({ spec: fitted, cozinhasPoints });
  }, [
    kitchenByCity,
    mode,
    hoverTooltip,
    ivsByCity,
    assentamentos,
    assentamentoTooltip,
    cozinhaTooltip,
    cozinhaStatus,
    cafByCity,
    cafPontosPorUf,
    cafUfTooltip,
    cadinsanByCity,
    cozinhasPoints,
    viewport,
  ]);

  // Assentamentos mode hides the município layers entirely — drop the município
  // boundary outline too, keeping only the state outlines for context.
  // The state group comes last so its darker, wider outline is drawn on top of
  // the lighter município outline where the two coincide along state borders —
  // otherwise the município line overdraws it and the state border disappears.
  const boundaryGroups = React.useMemo(() => {
    return mode === 'assentamentos'
      ? [estadosGroup]
      : [municipiosGroup, estadosGroup];
  }, [mode]);

  const { spec } = useBoundaryToggle(baseSpec, boundaryGroups);

  // The boundary toggle appends the município/estado outlines after every base
  // layer; lift the point/circle overlays back on top so they never hide behind
  // the boundary lines.
  return React.useMemo(() => {
    return liftOverlaysAboveBoundaries(spec);
  }, [spec]);
};

import {
  createBoundaryGroup,
  toggleBoundaryGroup,
  useBoundaryToggle,
  type VisualizationSpec,
} from '@ttoss/geovis';
import * as React from 'react';

import type {
  cadinsanByCity,
  cafByCity,
  CafHexbinFeatureCollection,
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

/**
 * Attaches the boundary outlines to a spec, per mode.
 *
 * `assentamentos` drops the município group outright, which it can because it
 * also swaps the município fill for the estados one and swaps the
 * `cozinhas-por-municipio` join out with it — nothing is left pointing at the
 * `municipios-boundary` source.
 *
 * `cafs-hexbin` keeps both (its fill is merely covered by the grid), so it
 * HIDES the outline instead. Dropping the group there would strand those two
 * references, `validateSpec` would return `mismatch`, and geovis refuses a spec
 * that does not validate: the adapter is never called and the map silently
 * stays on the previous mode (ADR-0001).
 *
 * Hiding is also the right picture. `useBoundaryToggle` appends the boundary
 * lines AFTER every `buildSpec` layer, and `liftOverlaysAboveBoundaries` only
 * lifts the point/circle overlays back over them — so the outlines draw ON TOP
 * of the hexagons, and ~5.5k município lines would be a second mesh laid across
 * the grid. The estado outlines stay, as the geographic reference the reader
 * needs once the municípios are gone.
 *
 * The estado group comes last so its darker, wider outline draws over the
 * lighter município one where the two coincide along state borders; reversed,
 * the município line overdraws it and the state border disappears.
 *
 * @param params.spec - The spec to attach the outlines to.
 * @param params.mode - Active {@link MapMode}.
 * @returns The spec with its outlines, hidden where the mode draws over them.
 */
const useMapaBoundaries = ({
  spec,
  mode,
}: {
  spec: VisualizationSpec;
  mode: MapMode;
}): VisualizationSpec => {
  const groups = React.useMemo(() => {
    return mode === 'assentamentos'
      ? [estadosGroup]
      : [municipiosGroup, estadosGroup];
  }, [mode]);

  const { spec: withBoundaries } = useBoundaryToggle(spec, groups);

  return React.useMemo(() => {
    return mode === 'cafs-hexbin'
      ? toggleBoundaryGroup(withBoundaries, municipiosGroup, false)
      : withBoundaries;
  }, [mode, withBoundaries]);
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
  /**
   * The H3 hexagon grid with its CAF counts, behind the `cafs-hexbin` mode.
   * `undefined` until it loads, which leaves the source on its URL.
   */
  cafHexbin?: CafHexbinFeatureCollection;
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
  cafHexbin,
  mode,
  cozinhasPoints,
}: UseMapaSpecParams) => {
  const tooltips = useMapaTooltips({
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
    const spec = buildSpec(
      kitchenByCity,
      mode,
      tooltips.hoverTooltip,
      ivsByCity,
      {
        assentamentos: {
          atributos: assentamentos,
          hoverRender: tooltips.assentamentoTooltip,
        },
        cozinhaTooltipRender: tooltips.cozinhaTooltip,
        cozinhaStatus,
        cafByCity,
        cafPontosPorUf,
        cafUfHoverRender: tooltips.cafUfTooltip,
        cadinsanByCity,
        cafHexbin,
        cafHexbinHoverRender: tooltips.cafHexbinTooltip,
      }
    );

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
    tooltips,
    ivsByCity,
    assentamentos,
    cozinhaStatus,
    cafByCity,
    cafPontosPorUf,
    cadinsanByCity,
    cafHexbin,
    cozinhasPoints,
    viewport,
  ]);

  const spec = useMapaBoundaries({ spec: baseSpec, mode });

  // The boundary toggle appends the município/estado outlines after every base
  // layer; lift the point/circle overlays back on top so they never hide behind
  // the boundary lines.
  return React.useMemo(() => {
    return liftOverlaysAboveBoundaries(spec);
  }, [spec]);
};

import {
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
  COZINHAS_SOURCE_ID,
  type MapMode,
} from './geovisSpec';
import {
  ESTADOS_BOUNDARY_GROUP,
  liftOverlaysAboveBoundaries,
  MUNICIPIOS_BOUNDARY_GROUP,
} from './mapaBoundaries';
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
      ? [ESTADOS_BOUNDARY_GROUP]
      : [MUNICIPIOS_BOUNDARY_GROUP, ESTADOS_BOUNDARY_GROUP];
  }, [mode]);

  const { spec: withBoundaries } = useBoundaryToggle(spec, groups);

  return React.useMemo(() => {
    return mode === 'cafs-hexbin'
      ? toggleBoundaryGroup(withBoundaries, MUNICIPIOS_BOUNDARY_GROUP, false)
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
  /** How the mode's subject layer is painted, from the settings zone. */
  paintSettings?: {
    fillOpacity?: number;
    colorRamp?: string;
  };
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
/**
 * The spec with its camera framed for whatever container this screen gives us.
 *
 * `buildSpec` has no viewport, so the camera it returns is the unmeasured one.
 * Zoom 4 frames Brazil on a large desktop and crops it everywhere else — a
 * 360px phone needs about 2.4 — and the old `maxZoomOut: 4` meant the user
 * could not even zoom out to recover it.
 */
const fitToViewport = ({
  spec,
  mode,
  viewport,
}: {
  spec: VisualizationSpec;
  mode: MapMode;
  viewport: Parameters<typeof viewForMode>[0]['viewport'];
}): VisualizationSpec => {
  return {
    ...spec,
    view: { ...spec.view, ...viewForMode({ mode, viewport }) },
  };
};

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
  paintSettings,
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
    colorRamp: paintSettings?.colorRamp,
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
        paintSettings,
        cafHexbinHoverRender: tooltips.cafHexbinTooltip,
      }
    );

    return withYearPoints({
      spec: fitToViewport({ spec, mode, viewport }),
      cozinhasPoints,
    });
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
    paintSettings,
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

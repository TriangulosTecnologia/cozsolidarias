import {
  createBoundaryGroup,
  useBoundaryToggle,
  type VisualizationSpec,
} from '@ttoss/geovis';
import * as React from 'react';

import type {
  cadinsanByCity,
  CafAreaFeature,
  cafByCity,
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
import { type NomesPorCodigo, useMapaTooltips } from './useMapaTooltips';

export type { NomesPorCodigo };

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
 * kitchen points, the proportional circles, and the CAF points. `useBoundaryToggle`
 * appends the município/estado boundary groups *after* every `buildSpec` layer, so
 * without lifting these back to the top the thin boundary lines would render over
 * them (e.g. município borders drawn over the kitchen points).
 */
const TOP_OVERLAY_LAYER_IDS = new Set([
  'cozinhas-pts',
  'cozinhas-bolhas',
  'cafs-pts',
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
  cafProps: Record<string, CafAreaFeature['properties']>;
  /** `codigo → emFuncionamento` for every kitchen point; colors the points by status. */
  cozinhaStatus: Record<string, string>;
  /** Per-município CAF shares for the "% dos CAFs do Brasil" choropleth. */
  cafByCity: cafByCity[];
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
 * toggle to the active mode. The point/circle overlays are lifted above the
 * appended boundary lines (via {@link liftOverlaysAboveBoundaries}) so the
 * kitchen points always render on top. Memoizes the spec so the map only
 * rebuilds when its inputs change.
 *
 * @param params - The loaded map data and the active {@link MapMode}.
 * @returns The geovis {@link VisualizationSpec} for the current mode.
 *
 * @example
 * const spec = useMapaSpec({ kitchenByCity, ivsByCity, nomesPorCodigo, assentamentos, cozinhaNames, cafProps, cozinhaStatus, cafByCity, cadinsanByCity, mode });
 * // <GeovisWorkspace visualizationSpec={spec} ... />
 */
export const useMapaSpec = ({
  kitchenByCity,
  ivsByCity,
  nomesPorCodigo,
  assentamentos,
  cozinhaNames,
  cafProps,
  cozinhaStatus,
  cafByCity,
  cadinsanByCity,
  mode,
  cozinhasPoints,
}: UseMapaSpecParams) => {
  const { hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafTooltip } =
    useMapaTooltips({
      kitchenByCity,
      nomesPorCodigo,
      assentamentos,
      cozinhaNames,
      cozinhaStatus,
      cafProps,
      cafByCity,
      cadinsanByCity,
      mode,
    });

  const baseSpec = React.useMemo(() => {
    const spec = buildSpec(kitchenByCity, mode, hoverTooltip, ivsByCity, {
      assentamentos: {
        atributos: assentamentos,
        hoverRender: assentamentoTooltip,
      },
      cozinhaTooltipRender: cozinhaTooltip,
      cafTooltipRender: cafTooltip,
      cozinhaStatus,
      cafByCity,
      cadinsanByCity,
    });

    // Time-lapse: serve the kitchen points from the selected year's in-memory
    // FeatureCollection instead of the `/api/cozinhas` URL, so selecting a year
    // (and the play animation) swaps them without a network round-trip. Until
    // the year has loaded, keep buildSpec's URL as the fallback.
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
  }, [
    kitchenByCity,
    mode,
    hoverTooltip,
    ivsByCity,
    assentamentos,
    assentamentoTooltip,
    cozinhaTooltip,
    cafTooltip,
    cozinhaStatus,
    cafByCity,
    cadinsanByCity,
    cozinhasPoints,
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

import { createBoundaryGroup, useBoundaryToggle } from '@ttoss/geovis';
import * as React from 'react';

import type {
  CafAreaFeature,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import {
  type AssentamentoAtributo,
  buildSpec,
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

/** The map data the spec is derived from, plus the active visualization mode. */
type UseMapaSpecParams = {
  kitchenByCity: kitchenRateByCity[];
  ivsByCity: MunicipioIvs[];
  nomesPorCodigo: NomesPorCodigo;
  assentamentos: AssentamentoAtributo[];
  cozinhaNames: Record<string, string>;
  cafProps: Record<string, CafAreaFeature['properties']>;
  mode: MapMode;
};

/**
 * Builds the geovis visualization spec for the maps playground, wiring every
 * layer's hover tooltip (via {@link useMapaTooltips}) and the boundary-group
 * toggle to the active mode. Memoizes the spec so the map only rebuilds when its
 * inputs change.
 *
 * @param params - The loaded map data and the active {@link MapMode}.
 * @returns The geovis {@link VisualizationSpec} for the current mode.
 *
 * @example
 * const spec = useMapaSpec({ kitchenByCity, ivsByCity, nomesPorCodigo, assentamentos, cozinhaNames, cafProps, mode });
 * // <GeovisWorkspace visualizationSpec={spec} ... />
 */
export const useMapaSpec = ({
  kitchenByCity,
  ivsByCity,
  nomesPorCodigo,
  assentamentos,
  cozinhaNames,
  cafProps,
  mode,
}: UseMapaSpecParams) => {
  const { hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafTooltip } =
    useMapaTooltips({
      kitchenByCity,
      nomesPorCodigo,
      assentamentos,
      cozinhaNames,
      cafProps,
      mode,
    });

  const baseSpec = React.useMemo(() => {
    return buildSpec(kitchenByCity, mode, hoverTooltip, ivsByCity, {
      assentamentos: {
        atributos: assentamentos,
        hoverRender: assentamentoTooltip,
      },
      cozinhaTooltipRender: cozinhaTooltip,
      cafTooltipRender: cafTooltip,
    });
  }, [
    kitchenByCity,
    mode,
    hoverTooltip,
    ivsByCity,
    assentamentos,
    assentamentoTooltip,
    cozinhaTooltip,
    cafTooltip,
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
  return spec;
};

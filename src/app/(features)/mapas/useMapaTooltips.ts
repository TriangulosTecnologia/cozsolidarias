import { type MapHoverInfo } from '@ttoss/geovis';
import * as React from 'react';

import type { CafAreaFeature, kitchenRateByCity } from '@/data-gateway/schema';

import { type AssentamentoAtributo, type MapMode } from './geovisSpec';
import { renderCafTooltip } from './mapaCafTooltip';
import {
  renderAssentamentoTooltip,
  renderCozinhaTooltip,
  renderMunicipioTooltip,
} from './mapaTooltips';

/** `{ codigoIbge: nome }` for every Brazilian município, keyed by `codarea`. */
export type NomesPorCodigo = Record<string, string>;

/** The lookups and active mode each hover tooltip is derived from. */
type UseMapaTooltipsParams = {
  kitchenByCity: kitchenRateByCity[];
  nomesPorCodigo: NomesPorCodigo;
  assentamentos: AssentamentoAtributo[];
  cozinhaNames: Record<string, string>;
  cafProps: Record<string, CafAreaFeature['properties']>;
  mode: MapMode;
};

/**
 * Builds the four spec-driven hover-tooltip renderers (município, assentamento,
 * kitchen point, CAF point) for the maps playground. Each renderer and its
 * backing lookup is memoized so it only changes when its inputs change.
 *
 * @param params - The lookups and the active {@link MapMode}.
 * @returns `{ hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafTooltip }`.
 *
 * @example
 * const { hoverTooltip } = useMapaTooltips({ kitchenByCity, nomesPorCodigo, assentamentos, cozinhaNames, cafProps, mode });
 */
export const useMapaTooltips = ({
  kitchenByCity,
  nomesPorCodigo,
  assentamentos,
  cozinhaNames,
  cafProps,
  mode,
}: UseMapaTooltipsParams) => {
  const citiesByCode = React.useMemo(() => {
    return new Map(
      kitchenByCity.map((registro) => {
        return [registro.codigoIbge, registro];
      })
    );
  }, [kitchenByCity]);

  const hoverTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = citiesByCode.get(code);
      // Nome vem do catálogo completo (todos os municípios do Brasil). Fallback
      // só se o catálogo não tiver o código.
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;

      return renderMunicipioTooltip({
        mode,
        name,
        register,
        value: info.value,
      });
    },
    [citiesByCode, nomesPorCodigo, mode]
  );

  const assentamentosByCode = React.useMemo(() => {
    return new Map(
      assentamentos.map((atributo) => {
        return [atributo.codImovel, atributo];
      })
    );
  }, [assentamentos]);

  const assentamentoTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      return renderAssentamentoTooltip({
        atributo: assentamentosByCode.get(String(info.featureId)),
        value: info.value,
      });
    },
    [assentamentosByCode]
  );

  const cozinhasByCodigo = React.useMemo(() => {
    return new Map(Object.entries(cozinhaNames));
  }, [cozinhaNames]);

  const cozinhaTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const nome = cozinhasByCodigo.get(String(info.featureId)) ?? '';
      return renderCozinhaTooltip({ nome });
    },
    [cozinhasByCodigo]
  );

  const cafPropsByNrCaf = React.useMemo(() => {
    return new Map(Object.entries(cafProps));
  }, [cafProps]);

  const cafTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const props = cafPropsByNrCaf.get(String(info.featureId));
      if (!props) return null;
      return renderCafTooltip(props);
    },
    [cafPropsByNrCaf]
  );

  return { hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafTooltip };
};

import { type MapHoverInfo } from '@ttoss/geovis';
import * as React from 'react';

import type {
  cadinsanByCity,
  cafByCity,
  kitchenRateByCity,
} from '@/data-gateway/schema';

import { cozinhaStatusLabel } from './geovisCozinhaStatusScales';
import { type AssentamentoAtributo, type MapMode } from './geovisSpec';
import {
  renderAssentamentoTooltip,
  renderCozinhaTooltip,
  renderMunicipioTooltip,
} from './mapaTooltips';

/** `{ codigoIbge: nome }` for every Brazilian município, keyed by `codarea`. */
export type NomesPorCodigo = Record<string, string>;

/** Indexes canonical per-município rows by their `codigoIbge` for O(1) hover lookup. */
const indexByCodigoIbge = <T extends { codigoIbge: string }>(
  rows: T[]
): Map<string, T> => {
  return new Map(
    rows.map((row) => {
      return [row.codigoIbge, row];
    })
  );
};

/** The lookups and active mode each hover tooltip is derived from. */
type UseMapaTooltipsParams = {
  kitchenByCity: kitchenRateByCity[];
  nomesPorCodigo: NomesPorCodigo;
  assentamentos: AssentamentoAtributo[];
  cozinhaNames: Record<string, string>;
  /** `codigo → emFuncionamento`, so the kitchen hover shows the operating status. */
  cozinhaStatus: Record<string, string>;
  /** Per-município CAF rows, so the CAF choropleth hover shows the share + count. */
  cafByCity: cafByCity[];
  /** Per-município CADINSAN rows, so the food-insecurity hover shows the share + counts. */
  cadinsanByCity: cadinsanByCity[];
  mode: MapMode;
};

/**
 * Builds the three spec-driven hover-tooltip renderers (município, assentamento,
 * kitchen point) for the maps playground. Each renderer and its backing lookup
 * is memoized so it only changes when its inputs change.
 *
 * @param params - The lookups and the active {@link MapMode}.
 * @returns `{ hoverTooltip, assentamentoTooltip, cozinhaTooltip }`.
 *
 * @example
 * const { hoverTooltip } = useMapaTooltips({ kitchenByCity, nomesPorCodigo, assentamentos, cozinhaNames, cozinhaStatus, cafByCity, mode });
 */
export const useMapaTooltips = ({
  kitchenByCity,
  nomesPorCodigo,
  assentamentos,
  cozinhaNames,
  cozinhaStatus,
  cafByCity,
  cadinsanByCity,
  mode,
}: UseMapaTooltipsParams) => {
  // The three choropleth datasets are joined by `codigoIbge` for O(1) hover
  // lookup; indexed together since they all arrive from the same mount fetch.
  const byCode = React.useMemo(() => {
    return {
      cities: indexByCodigoIbge(kitchenByCity),
      cafs: indexByCodigoIbge(cafByCity),
      cadinsan: indexByCodigoIbge(cadinsanByCity),
    };
  }, [kitchenByCity, cafByCity, cadinsanByCity]);

  const hoverTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = byCode.cities.get(code);
      // Nome vem do catálogo completo (todos os municípios do Brasil). Fallback
      // só se o catálogo não tiver o código.
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;

      return renderMunicipioTooltip({
        mode,
        name,
        register,
        cafRegister: byCode.cafs.get(code),
        cadinsanRegister: byCode.cadinsan.get(code),
        value: info.value,
      });
    },
    [byCode, nomesPorCodigo, mode]
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

  const statusByCodigo = React.useMemo(() => {
    return new Map(Object.entries(cozinhaStatus));
  }, [cozinhaStatus]);

  const cozinhaTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const codigo = String(info.featureId);
      const nome = cozinhasByCodigo.get(codigo) ?? '';
      const raw = statusByCodigo.get(codigo);
      const statusLabel = raw === undefined ? null : cozinhaStatusLabel(raw);
      return renderCozinhaTooltip({ nome, statusLabel });
    },
    [cozinhasByCodigo, statusByCodigo]
  );

  return { hoverTooltip, assentamentoTooltip, cozinhaTooltip };
};

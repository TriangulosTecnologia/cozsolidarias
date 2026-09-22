import { type MapHoverInfo } from '@ttoss/geovis';
import * as React from 'react';

import type {
  cadinsanByCity,
  cafByCity,
  kitchenRateByCity,
} from '@/data-gateway/schema';

import { cozinhaStatusLabel } from './geovisCozinhaStatusScales';
import { type AssentamentoAtributo, type MapMode } from './geovisSpec';
import { renderCafHexbinTooltip } from './mapaCafHexbinTooltip';
import {
  renderAssentamentoTooltip,
  renderCafUfTooltip,
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

/**
 * The two CAF renderers take everything they show from the hover info itself —
 * their joins carry the value, and the UF join also promotes the state's name
 * to the feature id — so neither needs a lookup table and neither can drift
 * from the number the map draws.
 *
 * Module-level rather than `useCallback(fn, [])` inside the hook: with no
 * dependencies there is nothing to memoize, and a constant is the stabler
 * reference of the two.
 */
const cafUfTooltip = (info: MapHoverInfo) => {
  return renderCafUfTooltip({
    nome: String(info.featureId),
    quantidade: typeof info.value === 'number' ? info.value : null,
  });
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
  /**
   * The ramp the map is being read through, from the settings zone. The hover
   * card's swatch is drawn from it too — the swatch exists to tie the hovered
   * município to its band on the map, so it has to be the same palette.
   */
  colorRamp?: string;
};

/**
 * Builds the five spec-driven hover-tooltip renderers (município, assentamento,
 * kitchen point, CAF UF circle, CAF hexbin cell) for the maps playground. Each renderer and its
 * backing lookup is memoized so it only changes when its inputs change.
 *
 * @param params - The lookups and the active {@link MapMode}.
 * @returns `{ hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafUfTooltip,
 * cafHexbinTooltip }`.
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
  colorRamp,
}: UseMapaTooltipsParams) => {
  // Every hover lookup is indexed in one memo: the four datasets all arrive
  // from the same mount fetch, so they are never stale relative to each other.
  // The choropleths join on `codigoIbge`, the assentamentos on `codImovel`.
  const byCode = React.useMemo(() => {
    return {
      cities: indexByCodigoIbge(kitchenByCity),
      cafs: indexByCodigoIbge(cafByCity),
      cadinsan: indexByCodigoIbge(cadinsanByCity),
      assentamentos: new Map(
        assentamentos.map((atributo) => {
          return [atributo.codImovel, atributo];
        })
      ),
    };
  }, [kitchenByCity, cafByCity, cadinsanByCity, assentamentos]);

  const hoverTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = byCode.cities.get(code);
      // The name comes from the full catalogue (every município in Brazil);
      // the register is a fallback only for codes the catalogue is missing.
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;

      return renderMunicipioTooltip({
        mode,
        name,
        register,
        cafRegister: byCode.cafs.get(code),
        cadinsanRegister: byCode.cadinsan.get(code),
        value: info.value,
        rampId: colorRamp,
      });
    },
    [byCode, nomesPorCodigo, mode, colorRamp]
  );

  /*
   * Inside the hook rather than at module scope, unlike its siblings: the grid
   * is read through the same ramp the settings zone offers, so this card's
   * swatch depends on the choice and the others' do not.
   */
  const cafHexbinTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      return renderCafHexbinTooltip({
        quantidade: typeof info.value === 'number' ? info.value : null,
        rampId: colorRamp,
      });
    },
    [colorRamp]
  );

  const assentamentoTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      return renderAssentamentoTooltip({
        atributo: byCode.assentamentos.get(String(info.featureId)),
        value: info.value,
      });
    },
    [byCode]
  );

  // Both lookups arrive already keyed by código, so they are read directly:
  // wrapping a Record in a Map buys no lookup speed and only adds a rebuild.
  const cozinhaTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const codigo = String(info.featureId);
      const nome = cozinhaNames[codigo] ?? '';
      const raw = cozinhaStatus[codigo];
      const statusLabel = raw === undefined ? null : cozinhaStatusLabel(raw);
      return renderCozinhaTooltip({ nome, statusLabel });
    },
    [cozinhaNames, cozinhaStatus]
  );

  // Memoized as a whole, not just per renderer: `useMapaSpec` feeds these into
  // the spec's own `useMemo`, so a fresh object here would rebuild the spec on
  // every render. `cafUfTooltip` is a module constant and so is not a
  // dependency; `cafHexbinTooltip` is not, since it tracks the chosen ramp.
  return React.useMemo(() => {
    return {
      hoverTooltip,
      assentamentoTooltip,
      cozinhaTooltip,
      cafUfTooltip,
      cafHexbinTooltip,
    };
  }, [hoverTooltip, assentamentoTooltip, cozinhaTooltip, cafHexbinTooltip]);
};

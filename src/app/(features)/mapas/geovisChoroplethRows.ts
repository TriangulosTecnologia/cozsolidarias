import type { MapDataRow } from '@ttoss/geovis';

import type {
  kitchenByCity,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import type { MapMode } from './geovisScales';

/**
 * Maps per-município counts to geovis `mapData` value rows.
 *
 * @param byCity - Per-município canonical cozinha count rows.
 * @returns One value row per município, keyed by `codigoIbge`.
 *
 * @example
 * toValueRows([{ codigoIbge: '3550308', quantidade: 5 }]);
 * // [{ geometryId: '3550308', value: 5 }]
 */
export const toValueRows = (byCity: kitchenByCity[]): MapDataRow[] => {
  return byCity.map((register) => {
    return { geometryId: register.codigoIbge, value: register.quantidade };
  });
};

/**
 * Maps per-município rates to geovis `mapData` value rows, dropping municípios
 * with an unknown rate (`porCemMil === null`) so they fall back to the legend's
 * `defaultColor` ("sem dado") instead of being colored as a low rate.
 */
const toRateRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap((register) => {
    return register.porCemMil === null
      ? []
      : [{ geometryId: register.codigoIbge, value: register.porCemMil }];
  });
};

/**
 * Maps per-município shares (%) to geovis `mapData` value rows. Every row is
 * kept — `percentualDoBrasil` is never `null` — so municípios absent from the
 * data (no cozinha) are the only ones that fall back to the legend's
 * `defaultColor` ("sem cozinha").
 */
const toPercentRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.map((register) => {
    return {
      geometryId: register.codigoIbge,
      value: register.percentualDoBrasil,
    };
  });
};

/**
 * Maps per-município CadÚnico rates to geovis `mapData` value rows, dropping
 * municípios with an unknown rate (`porDezMilCadUnico === null`) so they fall
 * back to the legend's `defaultColor` ("sem dado") instead of a low rate.
 */
const toCadUnicoRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap((register) => {
    return register.porDezMilCadUnico === null
      ? []
      : [
          {
            geometryId: register.codigoIbge,
            value: register.porDezMilCadUnico,
          },
        ];
  });
};

/**
 * Maps per-município people-per-cozinha values to geovis `mapData` value rows,
 * dropping municípios with an unknown value (`pessoasPorCozinha === null`) so
 * they fall back to the legend's `defaultColor` ("sem dado").
 */
const toPessoasPorCozinhaRows = (byCity: kitchenRateByCity[]): MapDataRow[] => {
  return byCity.flatMap((register) => {
    return register.pessoasPorCozinha === null
      ? []
      : [
          {
            geometryId: register.codigoIbge,
            value: register.pessoasPorCozinha,
          },
        ];
  });
};

/**
 * Maps a per-município score (any IVS- or IDHM-family value, selected by `pick`)
 * to geovis `mapData` value rows. Every row is kept — the gateway already dropped
 * municípios with an invalid/absent score, so the only municípios that fall back
 * to the legend's `defaultColor` ("sem dado") are those missing from the IVS
 * snapshot entirely.
 */
const toScoreRows = (
  ivsByCity: MunicipioIvs[],
  pick: (register: MunicipioIvs) => number
): MapDataRow[] => {
  return ivsByCity.map((register) => {
    return { geometryId: register.codigoIbge, value: pick(register) };
  });
};

/**
 * The IVS- and IDHM-family modes and the score each one paints, all read from
 * the per-município {@link MunicipioIvs} snapshot. Keyed by {@link MapMode} so
 * `resolveChoroplethRows` resolves every family member in one lookup instead of
 * a branch per dimension.
 */
const SCORE_PICKERS: Partial<
  Record<MapMode, (register: MunicipioIvs) => number>
> = {
  'coropletico-ivs': (register) => {
    return register.ivs;
  },
  'coropletico-ivs-infraestrutura': (register) => {
    return register.ivsInfraestruturaUrbana;
  },
  'coropletico-ivs-capital-humano': (register) => {
    return register.ivsCapitalHumano;
  },
  'coropletico-ivs-renda-trabalho': (register) => {
    return register.ivsRendaETrabalho;
  },
  'coropletico-idhm': (register) => {
    return register.idhm;
  },
  'coropletico-idhm-longevidade': (register) => {
    return register.idhmLongevidade;
  },
  'coropletico-idhm-educacao': (register) => {
    return register.idhmEducacao;
  },
  'coropletico-idhm-renda': (register) => {
    return register.idhmRenda;
  },
  'coropletico-idhm-educacao-escolaridade': (register) => {
    return register.idhmEducacaoEscolaridade;
  },
  'coropletico-idhm-educacao-frequencia': (register) => {
    return register.idhmEducacaoFrequencia;
  },
};

/**
 * The cozinha-based choropleth modes and the value rows each one paints. Keyed
 * by {@link MapMode} so `resolveChoroplethRows` resolves them in one lookup; the
 * score families are handled separately via {@link SCORE_PICKERS}.
 */
const CHOROPLETH_ROW_BUILDERS: Partial<
  Record<MapMode, (byCity: kitchenRateByCity[]) => MapDataRow[]>
> = {
  coropletico: toValueRows,
  'coropletico-taxa': toRateRows,
  'coropletico-percentual': toPercentRows,
  'coropletico-cadunico': toCadUnicoRows,
  'coropletico-pessoas-cozinha': toPessoasPorCozinhaRows,
};

/**
 * Resolves the município choropleth value rows for the active mode: the IVS- and
 * IDHM-families read the score snapshot (via {@link SCORE_PICKERS}), the
 * cozinha-based choropleths use their row builder (via
 * {@link CHOROPLETH_ROW_BUILDERS}), and every other mode (overlays) feeds nothing
 * so the fill stays neutral.
 *
 * @param mode - Active {@link MapMode} driving which metric is painted.
 * @param byCity - Per-município canonical cozinha rate rows.
 * @param ivsByCity - Per-município IVS/IDHM score rows.
 * @returns The value rows for the mode, or `[]` for non-choropleth modes.
 *
 * @example
 * resolveChoroplethRows('coropletico-taxa', byCity, ivsByCity);
 */
export const resolveChoroplethRows = (
  mode: MapMode,
  byCity: kitchenRateByCity[],
  ivsByCity: MunicipioIvs[]
): MapDataRow[] => {
  const scorePick = SCORE_PICKERS[mode];
  if (scorePick) {
    return toScoreRows(ivsByCity, scorePick);
  }
  const buildRows = CHOROPLETH_ROW_BUILDERS[mode];
  return buildRows ? buildRows(byCity) : [];
};

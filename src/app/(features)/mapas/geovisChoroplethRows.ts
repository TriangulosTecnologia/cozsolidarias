import type { MapDataRow } from '@ttoss/geovis';

import type {
  cadinsanByCity,
  cafByCity,
  kitchenByCity,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import { jenksBreaksForMode, type MapMode } from './geovisScales';

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
 * Maps per-município CAF shares (%) to geovis `mapData` value rows. Every row is
 * kept — `percentualDoBrasil` is never `null` — so municípios absent from the
 * CAF snapshot (no CAF) are the only ones that fall back to the legend's
 * `defaultColor` ("sem CAF").
 */
const toCafPercentRows = (byCity: cafByCity[]): MapDataRow[] => {
  return byCity.map((register) => {
    return {
      geometryId: register.codigoIbge,
      value: register.percentualDoBrasil,
    };
  });
};

/**
 * Maps per-município CADINSAN food-insecurity shares (%) to geovis `mapData`
 * value rows, selecting the com/sem-PBF proportion via `pick`. Municípios whose
 * share is `null` (no CadÚnico denominator) are dropped so they fall back to the
 * legend's `defaultColor` ("sem dado"); a real `0%` is kept and paints the
 * lightest band.
 */
const toCadinsanRows = (
  cadinsanByCity: cadinsanByCity[],
  pick: (register: cadinsanByCity) => number | null
): MapDataRow[] => {
  return cadinsanByCity.flatMap((register) => {
    const value = pick(register);
    return value === null ? [] : [{ geometryId: register.codigoIbge, value }];
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
 * @param cafByCity - Per-município CAF share rows.
 * @param cadinsanByCity - Per-município CADINSAN food-insecurity share rows.
 * @returns The value rows for the mode, or `[]` for non-choropleth modes.
 *
 * @example
 * resolveChoroplethRows('coropletico-taxa', byCity, ivsByCity, cafByCity, cadinsanByCity);
 */
export const resolveChoroplethRows = (
  mode: MapMode,
  byCity: kitchenRateByCity[],
  ivsByCity: MunicipioIvs[],
  cafByCity: cafByCity[],
  cadinsanByCity: cadinsanByCity[]
): MapDataRow[] => {
  if (mode === 'coropletico-cafs-percentual') {
    return toCafPercentRows(cafByCity);
  }
  if (mode === 'coropletico-cadinsan-com-pbf') {
    return toCadinsanRows(cadinsanByCity, (register) => {
      return register.proporcaoComPbf;
    });
  }
  if (mode === 'coropletico-cadinsan-sem-pbf') {
    return toCadinsanRows(cadinsanByCity, (register) => {
      return register.proporcaoSemPbf;
    });
  }
  const scorePick = SCORE_PICKERS[mode];
  if (scorePick) {
    return toScoreRows(ivsByCity, scorePick);
  }
  const buildRows = CHOROPLETH_ROW_BUILDERS[mode];
  return buildRows ? buildRows(byCity) : [];
};

/** The snapshots a mode's choropleth is derived from; the memo's identity key. */
export type ChoroplethSources = {
  byCity: kitchenRateByCity[];
  ivsByCity: MunicipioIvs[];
  cafByCity: cafByCity[];
  cadinsanByCity: cadinsanByCity[];
};

/** What a mode paints: its value rows and the Jenks breaks fitted to them. */
export type Choropleth = {
  /** The mode's `mapData` value rows. */
  rows: MapDataRow[];
  /** Data-driven breaks, or `null` for the modes that keep a fixed scale. */
  jenksBreaks: number[] | null;
};

/**
 * Jenks breaks already fitted, per mode, alongside the snapshot references they
 * were fitted to. Bounded by the number of modes; only the breaks are held, not
 * the rows, so revisiting every mode costs a handful of number arrays.
 */
const jenksCache = new Map<
  MapMode,
  { sources: ChoroplethSources; jenksBreaks: number[] | null }
>();

/**
 * Whether two source sets are the same snapshots. Reference equality, not deep:
 * every array here is fetched once and never mutated, so a new reference is
 * exactly what "the data changed" means.
 */
const sameSources = (a: ChoroplethSources, b: ChoroplethSources): boolean => {
  return (
    a.byCity === b.byCity &&
    a.ivsByCity === b.ivsByCity &&
    a.cafByCity === b.cafByCity &&
    a.cadinsanByCity === b.cadinsanByCity
  );
};

/**
 * Resolves what a mode paints: its value rows, plus the Jenks breaks fitted to
 * them — reusing a previous fit whenever the mode is revisited with the same
 * snapshots.
 *
 * The fit is the reason this exists. It is an `O(classes·n²)` dynamic program
 * over every painted município (~350 ms for the CADINSAN and CAF modes, whose
 * floor lets nearly all of them through), it runs synchronously on the main
 * thread, and its result depends on nothing but `(mode, snapshots)`. Without the
 * memo it re-ran on every spec rebuild — including the ones triggered by the
 * time-lapse year cache filling in, which cannot change a single break.
 *
 * Rows are rebuilt on every call and deliberately not cached: they are a linear
 * map, cheap next to the fit, and caching them would pin ~5.500 objects per mode.
 *
 * @param params.mode - Active {@link MapMode}.
 * @param params.byCity - Per-município canonical cozinha rows.
 * @param params.ivsByCity - Per-município IVS/IDHM score rows.
 * @param params.cafByCity - Per-município CAF share rows.
 * @param params.cadinsanByCity - Per-município CADINSAN share rows.
 * @returns The mode's {@link Choropleth}: fresh `rows`, memoized `jenksBreaks`.
 *
 * @example
 * resolveChoropleth({ mode: 'coropletico', byCity, ivsByCity, cafByCity, cadinsanByCity });
 * // → { rows: [...], jenksBreaks: [1, 2, 5, 12, 47] }
 */
export const resolveChoropleth = ({
  mode,
  ...sources
}: ChoroplethSources & { mode: MapMode }): Choropleth => {
  const rows = resolveChoroplethRows(
    mode,
    sources.byCity,
    sources.ivsByCity,
    sources.cafByCity,
    sources.cadinsanByCity
  );

  const cached = jenksCache.get(mode);
  if (cached && sameSources(cached.sources, sources)) {
    return { rows, jenksBreaks: cached.jenksBreaks };
  }

  const jenksBreaks = jenksBreaksForMode(
    mode,
    rows.map((row) => {
      return row.value;
    })
  );

  jenksCache.set(mode, { sources, jenksBreaks });
  return { rows, jenksBreaks };
};

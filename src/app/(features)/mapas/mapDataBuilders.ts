import type { MapData, MapDataRow } from '@ttoss/geovis';

import type {
  CozinhasFeatureCollection,
  CozinhasStatusFeatureCollection,
  kitchenByCity,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

/**
 * What the municipality fill encodes:
 * - `coropletico`: data-driven choropleth (cozinhas por município, raw count);
 * - `coropletico-taxa`: data-driven choropleth of the cozinhas-per-100k-
 *   inhabitants rate (darker = higher density);
 * - `coropletico-percentual`: data-driven choropleth of each município's share
 *   (%) of all Brazilian cozinhas (darker = larger share);
 * - `coropletico-cadunico`: data-driven choropleth of the cozinhas-per-10k-
 *   CadÚnico-people rate (darker = better coverage of the vulnerable population);
 * - `coropletico-pessoas-cozinha`: data-driven choropleth of the CadÚnico-people-
 *   per-cozinha ratio (darker = more people per cozinha = thinner coverage);
 * - `coropletico-ivs`: data-driven choropleth of each município's overall Social
 *   Vulnerability Index (IPEA), colored by the official faixas (green = low,
 *   red = high vulnerability), and its three sub-indices (`-infraestrutura`,
 *   `-capital-humano`, `-renda-trabalho`);
 * - `pontos`: flat background so the individual kitchen points stand out;
 * - `pontos-status`: flat background with one point per cozinha, colored by
 *   its status (situação);
 * - `circulos`: flat background with one proportional circle per município
 *   (radius encodes the kitchen count).
 *
 * The fill, the municipality/state borders and the background color stay the
 * same across modes — only the data coloring and the points/circles overlays
 * change.
 *
 * @example
 * const mode: MapMode = 'coropletico';
 */
export type MapMode =
  | 'coropletico'
  | 'coropletico-taxa'
  | 'coropletico-percentual'
  | 'coropletico-cadunico'
  | 'coropletico-pessoas-cozinha'
  | 'coropletico-ivs'
  | 'coropletico-ivs-infraestrutura'
  | 'coropletico-ivs-capital-humano'
  | 'coropletico-ivs-renda-trabalho'
  | 'pontos'
  | 'pontos-status'
  | 'circulos';

/**
 * GeoJSON source id for the proportional-circle (bubble) overlay — one anchor
 * point per município, served by `/api/cozinhas/bolhas`.
 *
 * @example
 * sources.find((source) => source.id === BUBBLES_SOURCE_ID);
 */
export const BUBBLES_SOURCE_ID = 'cozinhas-bubbles';

/**
 * `mapData` id of the bubble join (drives circle size via feature-state).
 *
 * @example
 * spec.mapData?.find((entry) => entry.mapDataId === BUBBLES_MAP_DATA_ID);
 */
export const BUBBLES_MAP_DATA_ID = 'cozinhas-bolhas-data';

/**
 * GeoJSON source id for the per-cozinha points, served by `/api/cozinhas`.
 *
 * @example
 * sources.find((source) => source.id === POINTS_SOURCE_ID);
 */
export const POINTS_SOURCE_ID = 'cozinhas';

/**
 * `mapData` id of the points-mode join.
 *
 * @example
 * spec.mapData?.find((entry) => entry.mapDataId === POINTS_MAP_DATA_ID);
 */
export const POINTS_MAP_DATA_ID = 'cozinhas-pontos';

/**
 * GeoJSON source id for the status-carrying cozinha points, served by
 * `/api/cozinhas/status`.
 *
 * @example
 * sources.find((source) => source.id === POINTS_STATUS_SOURCE_ID);
 */
export const POINTS_STATUS_SOURCE_ID = 'cozinhas-status';

/**
 * `mapData` id of the status-points join — writes each cozinha's `situacao`
 * into feature-state so the categorical legend colors the points.
 *
 * @example
 * spec.mapData?.find((entry) => entry.mapDataId === POINTS_STATUS_MAP_DATA_ID);
 */
export const POINTS_STATUS_MAP_DATA_ID = 'cozinhas-pontos-status';

/**
 * GeoJSON source id of the município polygons (the choropleth fill's source).
 *
 * @example
 * layers.find((layer) => layer.sourceId === CHOROPLETH_SOURCE_ID);
 */
export const CHOROPLETH_SOURCE_ID = 'municipios-boundary';

/**
 * `mapData` id of the choropleth join — the single entry every mode feeds
 * (with mode-specific rows, or empty rows in the overlay modes).
 *
 * @example
 * spec.mapData?.find((entry) => entry.mapDataId === CHOROPLETH_MAP_DATA_ID);
 */
export const CHOROPLETH_MAP_DATA_ID = 'cozinhas-por-municipio';

/** Maps per-município counts to geovis `mapData` value rows. */
const toValueRows = (byCity: kitchenByCity[]): MapDataRow[] => {
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
 * Maps an IVS-family score (overall IVS or a sub-index, selected by `pick`) to
 * geovis `mapData` value rows. Every row is kept — the gateway already dropped
 * municípios with an invalid/absent score, so the only municípios that fall back
 * to the legend's `defaultColor` ("sem dado") are those missing from the IVS
 * snapshot entirely.
 */
const toIvsRows = (
  ivsByCity: MunicipioIvs[],
  pick: (register: MunicipioIvs) => number
): MapDataRow[] => {
  return ivsByCity.map((register) => {
    return { geometryId: register.codigoIbge, value: pick(register) };
  });
};

/**
 * The IVS-family modes and the score each one paints. Keyed by {@link MapMode}
 * so `toChoroplethRows` resolves the whole family in one lookup instead of a
 * branch per sub-index. Every value lives on the same `[0, 1]` IPEA scale.
 */
const IVS_PICKERS: Partial<
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
};

/**
 * Maps plain cozinha features to geovis `mapData` value rows for the
 * `pontos` mode. Each row joins on the cozinha's unique `codigo` so
 * geovis promotes it to the feature id, enabling hover tooltip lookup.
 */
const toKitchenRows = (cozinhas: CozinhasFeatureCollection): MapDataRow[] => {
  return cozinhas.features.map((feature) => {
    return { geometryId: feature.properties.codigo, value: null };
  });
};

/**
 * Maps status-carrying cozinha features to geovis `mapData` value rows — the
 * status variant's own `toValueRows`. Each row joins on the cozinha's unique
 * `codigo` and carries its `situacao` as the (string) value, which the join
 * writes into feature-state for the categorical color expression.
 */
const toStatusRows = (
  cozinhasStatus: CozinhasStatusFeatureCollection
): MapDataRow[] => {
  return cozinhasStatus.features.map((feature) => {
    return {
      geometryId: feature.properties.codigo,
      value: feature.properties.situacao,
    };
  });
};

/**
 * The cozinha-based choropleth modes and the value rows each one paints. Keyed
 * by {@link MapMode} so `toChoroplethRows` resolves them in one lookup; the IVS
 * family is handled separately via {@link IVS_PICKERS}.
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
 * Choropleth value rows for the given mode: raw counts in `coropletico`, the
 * per-100k rate in `coropletico-taxa`, the share (%) of Brazil in
 * `coropletico-percentual`, the per-10k-CadÚnico rate in
 * `coropletico-cadunico`, the people-per-cozinha value in
 * `coropletico-pessoas-cozinha`, the overall IVS or a sub-index in the IVS-family
 * modes (from `ivsByCity`, defaulting to `[]`). Returns `[]` for the overlay
 * modes (`pontos`, `pontos-status`, `circulos`).
 */
const toChoroplethRows = ({
  byCity,
  mode,
  ivsByCity = [],
}: {
  byCity: kitchenRateByCity[];
  mode: MapMode;
  ivsByCity?: MunicipioIvs[];
}): MapDataRow[] => {
  const ivsPick = IVS_PICKERS[mode];
  if (ivsPick) {
    return toIvsRows(ivsByCity, ivsPick);
  }
  const buildRows = CHOROPLETH_ROW_BUILDERS[mode];
  return buildRows ? buildRows(byCity) : [];
};

/**
 * Builds the full `mapData` array of the visualization spec for a given mode —
 * the single origin of every `MapData` entry.
 *
 * Invariants:
 * - Each mode returns only the entries it needs. Overlay modes (`pontos`,
 *   `pontos-status`, `circulos`) do not include the choropleth entry — the fill
 *   layer falls back to `defaultColor` via its `activeLegendId`.
 * - **The active mode's entry comes first (and is the only entry in overlay
 *   modes).** geovis' `mapType` resolvers pick their target source from
 *   `spec.mapData[0]` (`findMatchSourceId`); with the wrong entry first,
 *   `resolveProportionalCircles` builds its circle layer against the wrong
 *   source, never merges with the app's override layer, and appends a
 *   duplicate layer + legend — breaking circle hover and doubling the legend.
 *
 * @param byCity per-município aggregation (counts, rate and share variants).
 * @param mode active visualization mode.
 * @param cozinhas plain cozinha features; feeds the `pontos` join.
 * @param cozinhasStatus status-carrying cozinha features; feeds the
 *   `pontos-status` join. @default undefined (empty status rows)
 * @param ivsByCity per-município IVS rows; feeds the IVS-family modes'
 *   choropleth join. @default [] (empty choropleth rows)
 * @returns every `MapData` entry the spec needs for that mode, primary first.
 *
 * @example
 * const mapData = buildMapData({ byCity, mode: 'pontos', cozinhas });
 * // → [points entry only]
 */
export const buildMapData = ({
  byCity,
  mode,
  cozinhas,
  cozinhasStatus,
  ivsByCity,
}: {
  byCity: kitchenRateByCity[];
  mode: MapMode;
  cozinhas?: CozinhasFeatureCollection;
  cozinhasStatus?: CozinhasStatusFeatureCollection;
  ivsByCity?: MunicipioIvs[];
}): MapData[] => {
  const choroplethEntry: MapData = {
    mapDataId: CHOROPLETH_MAP_DATA_ID,
    mapId: CHOROPLETH_SOURCE_ID,
    joinKey: 'codarea',
    title: 'Cozinhas por município',
    data: toChoroplethRows({ byCity, mode, ivsByCity }),
  };

  const pointsEntry: MapData = {
    mapDataId: POINTS_MAP_DATA_ID,
    mapId: POINTS_SOURCE_ID,
    joinKey: 'codigo',
    title: 'Localização das cozinhas',
    data: cozinhas ? toKitchenRows(cozinhas) : [],
  };

  const bubblesEntry: MapData = {
    mapDataId: BUBBLES_MAP_DATA_ID,
    mapId: BUBBLES_SOURCE_ID,
    joinKey: 'codarea',
    title: 'Cozinhas por município',
    stateKey: 'quantidade',
    dimension: 'size',
    data: toValueRows(byCity),
  };

  const statusEntry: MapData = {
    mapDataId: POINTS_STATUS_MAP_DATA_ID,
    mapId: POINTS_STATUS_SOURCE_ID,
    joinKey: 'codigo',
    title: 'Localização das cozinhas com status',
    data: cozinhasStatus ? toStatusRows(cozinhasStatus) : [],
  };

  // `BUBBLES_SOURCE_ID` is always declared in `SOURCES` (see geovisSpec.ts),
  // fetched eagerly on mount regardless of mode — but geovis only promotes a
  // source's `codarea` property to `feature.id` (`resolvePromoteIdForSource`)
  // when it finds a `mapData` entry whose `mapId` matches AND carries a
  // `joinKey`, evaluated against whatever spec is active at the time the
  // source is first added to the map. Without `bubblesEntry` present from the
  // very first render (default mode is `coropletico`), the bubbles source
  // gets added with no promoted id; switching to `circulos` later can't
  // retroactively fix that, so `setFeatureState` never matches a real
  // feature and every circle silently renders at `zeroRadiusPx`. Appending it
  // — never as the FIRST entry outside `circulos` itself — keeps every other
  // mode's `mapData[0]` (the one `findMatchSourceId` reads) unchanged.
  if (mode === 'circulos') {
    return [bubblesEntry];
  }
  if (mode === 'pontos') {
    return [pointsEntry, bubblesEntry];
  }
  if (mode === 'pontos-status') {
    return [statusEntry, bubblesEntry];
  }
  return [choroplethEntry, bubblesEntry];
};

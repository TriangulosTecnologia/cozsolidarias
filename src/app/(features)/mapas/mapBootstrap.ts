import type {
  cadinsanByCity,
  cafByCity,
  CafUfFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import type { AssentamentoAtributo, MapMode } from './geovisSpec';
import type { NomesPorCodigo } from './useMapaSpec';

/**
 * Every snapshot the map can read, keyed by the name `useMapaSpec` reads it
 * under. Each key is fetched on its own, when a mode first needs it.
 */
export type MapDatasets = {
  /** Per-município cozinha counts and derived rates; the map's base dataset. */
  data: kitchenRateByCity[];
  /** Per-município IVS/IDHM scores, behind the `coropletico-ivs*`/`-idhm*` modes. */
  ivs: MunicipioIvs[];
  /** `codigoIbge → nome` for every município, read by the hover tooltips. */
  nomes: NomesPorCodigo;
  /** The assentamentos attribute sidecar (~550 KB); the multi-MB geometry is the map source's. */
  settlements: AssentamentoAtributo[];
  /** Per-município CAF shares for the "% dos CAFs do Brasil" choropleth. */
  cafsByCity: cafByCity[];
  /**
   * The 27 UF anchors with their CAF totals (~2 KB). Held here rather than left
   * to the map source so the `cafs` mode's hover join reads exactly the numbers
   * its labels draw.
   */
  cafPontosPorUf?: CafUfFeatureCollection;
  /** Per-município CADINSAN food-insecurity shares for the food-insecurity choropleths. */
  cadinsanByCity: cadinsanByCity[];
};

/** One snapshot's name. */
export type MapDatasetKey = keyof MapDatasets;

/** What the map reads before anything has loaded, and after a load that failed. */
export const EMPTY_DATASETS: MapDatasets = {
  data: [],
  ivs: [],
  nomes: {},
  settlements: [],
  cafsByCity: [],
  cadinsanByCity: [],
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  return response.json() as Promise<T>;
};

/** Where each snapshot comes from. One request per key, never batched. */
const FETCHERS: { [K in MapDatasetKey]: () => Promise<MapDatasets[K]> } = {
  data: () => {
    return fetchJson<kitchenRateByCity[]>('/api/cozinhas/por-municipio');
  },
  ivs: () => {
    return fetchJson<MunicipioIvs[]>('/api/municipios/ivs');
  },
  nomes: () => {
    return fetchJson<NomesPorCodigo>('/geo/municipios-nomes.json');
  },
  settlements: () => {
    return fetchJson<AssentamentoAtributo[]>(
      '/geo/assentamentos-atributos.json'
    );
  },
  cafsByCity: () => {
    return fetchJson<cafByCity[]>('/api/cafs/por-municipio');
  },
  cafPontosPorUf: () => {
    return fetchJson<CafUfFeatureCollection>('/api/cafs/pontos-por-uf');
  },
  cadinsanByCity: () => {
    return fetchJson<cadinsanByCity[]>('/api/cadinsan/por-municipio');
  },
};

/**
 * Fetches one snapshot.
 *
 * Deliberately without a `catch`: a rejection is what releases the sidebar
 * menus that the pick locked (the workspace settles on either outcome) and
 * what leaves the last good paint on the map. Swallowing it here would resolve
 * with nothing and repaint every município as "sem dado".
 *
 * @param key - Which snapshot to load.
 * @returns Its parsed body.
 * @throws Whatever `fetch` or `response.json()` throws.
 *
 * @example
 * const rows = await fetchMapDataset('cafsByCity');
 */
export const fetchMapDataset = <K extends MapDatasetKey>(
  key: K
): Promise<MapDatasets[K]> => {
  return FETCHERS[key]();
};

/**
 * Present in every mode: the município fill paints or falls back to these
 * counts, its hover tooltip reads them, the bubbles size their range from
 * them, and `nomes` names every município the cursor lands on.
 */
const BASE_DATASETS: MapDatasetKey[] = ['data', 'nomes'];

/**
 * The snapshots a mode needs before it can paint what it promises.
 *
 * This is the whole point of loading per mode: a reader who never opens the
 * CAF or food-insecurity views never pays for their datasets, and the ones a
 * mode does need are fetched on the pick that asks for them — where the
 * workspace can hold the menus while they arrive.
 *
 * @param mode - The mode being switched to.
 * @returns Its dataset keys, base ones included.
 *
 * @example
 * datasetsForMode('cafs'); // ['data', 'nomes', 'cafPontosPorUf', 'cafsByCity']
 */
export const datasetsForMode = (mode: MapMode): MapDatasetKey[] => {
  if (mode === 'assentamentos') {
    return [...BASE_DATASETS, 'settlements'];
  }
  // The country level joins `cafPontosPorUf`; the município tooltip under it
  // reads the per-município counts, so the mode needs both.
  if (mode === 'cafs') {
    return [...BASE_DATASETS, 'cafPontosPorUf', 'cafsByCity'];
  }
  if (mode === 'coropletico-cafs-percentual') {
    return [...BASE_DATASETS, 'cafsByCity'];
  }
  if (mode.startsWith('coropletico-cadinsan')) {
    return [...BASE_DATASETS, 'cadinsanByCity'];
  }
  if (
    mode.startsWith('coropletico-ivs') ||
    mode.startsWith('coropletico-idhm')
  ) {
    return [...BASE_DATASETS, 'ivs'];
  }
  return BASE_DATASETS;
};

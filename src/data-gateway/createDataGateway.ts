import { readStaticCozinhas } from '../data-source-static/readStaticCozinhas';
import { readStaticMunicipiosSp } from '../data-source-static/readStaticMunicipiosSp';
import { readStaticNearbyPlaces } from '../data-source-static/readStaticNearbyPlaces';
import type {
  CozinhasFeatureCollection,
  kitchenByCity,
  NearbyPlacesContract,
  NearbyProvider,
} from './schema';
import { toAppNearbyPlaces } from './transformers/toAppNearbyPlaces';
import { toCozinhasFeatureCollection } from './transformers/toCozinhasFeatureCollection';
import { toCozinhasPorMunicipio } from './transformers/toCozinhasPorMunicipio';

/** Kitchen codes look like `CS014558`; the pattern also blocks path traversal. */
const COZINHA_ID_PATTERN = /^CS\d+$/;

/** Gateway interface exposing canonical read functions. */
export type DataGateway = {
  /** Returns cozinha locations as a GeoJSON FeatureCollection of Points. */
  getCozinhas: () => Promise<CozinhasFeatureCollection>;
  /** Returns the cozinha count per SP município (for the choropleth map). */
  getCozinhasPorMunicipio: () => Promise<kitchenByCity[]>;
  /** Returns the nearby POIs around a cozinha for the given provider. */
  getNearbyPlaces: (args: {
    cozinhaId: string;
    provider: NearbyProvider;
  }) => Promise<NearbyPlacesContract>;
};

const KNOWN_SOURCES = ['static'] as const;
type KnownSource = (typeof KNOWN_SOURCES)[number];

const isKnownSource = (value: string): value is KnownSource => {
  return (KNOWN_SOURCES as readonly string[]).includes(value);
};

/**
 * Creates the data gateway. Source selection is internal, driven by the
 * `DATA_SOURCE` environment variable (defaults to `'static'`).
 *
 * @returns A gateway exposing canonical read functions.
 * @throws If `DATA_SOURCE` is set to a value outside {@link KNOWN_SOURCES}.
 *
 * @example
 * const gateway = createDataGateway();
 * const cozinhas = await gateway.getCozinhas();
 * // { type: 'FeatureCollection', features: [...] }
 */
export const createDataGateway = (): DataGateway => {
  const raw = process.env['DATA_SOURCE'] ?? 'static';

  if (!isKnownSource(raw)) {
    throw new Error(
      `[data-gateway] Unknown DATA_SOURCE: "${raw}". Known: ${KNOWN_SOURCES.join(', ')}.`
    );
  }

  if (raw === 'static') {
    return {
      getCozinhas: async () => {
        const sources = await readStaticCozinhas();
        return toCozinhasFeatureCollection(sources);
      },
      getCozinhasPorMunicipio: async () => {
        const [cozinhas, municipios] = await Promise.all([
          readStaticCozinhas(),
          readStaticMunicipiosSp(),
        ]);
        return toCozinhasPorMunicipio(cozinhas, municipios);
      },
      getNearbyPlaces: async ({ cozinhaId, provider }) => {
        if (!COZINHA_ID_PATTERN.test(cozinhaId)) {
          throw new Error(`[data-gateway] Invalid cozinhaId: "${cozinhaId}".`);
        }
        const source = await readStaticNearbyPlaces({ provider, cozinhaId });
        return toAppNearbyPlaces(source, { provider, cozinhaId });
      },
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};

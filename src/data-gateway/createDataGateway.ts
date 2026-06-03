import { readStaticCozinhas } from '../data-source-static/readStaticCozinhas';
import { readStaticGreeting } from '../data-source-static/readStaticGreeting';
import { readStaticMunicipiosSp } from '../data-source-static/readStaticMunicipiosSp';
import type {
  CozinhasFeatureCollection,
  GreetingContract,
  kitchenByCity,
} from './schema';
import { toAppGreeting } from './transformers/toAppGreeting';
import { toCozinhasFeatureCollection } from './transformers/toCozinhasFeatureCollection';
import { toCozinhasPorMunicipio } from './transformers/toCozinhasPorMunicipio';

/** Gateway interface exposing canonical read functions. */
export type DataGateway = {
  /** Returns the canonical greeting. */
  getGreeting: () => Promise<GreetingContract>;
  /** Returns cozinha locations as a GeoJSON FeatureCollection of Points. */
  getCozinhas: () => Promise<CozinhasFeatureCollection>;
  /** Returns the cozinha count per SP município (for the choropleth map). */
  getCozinhasPorMunicipio: () => Promise<kitchenByCity[]>;
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
 * const greeting = await gateway.getGreeting();
 * // { text: 'Hello from static source' }
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
      getGreeting: async () => {
        const source = await readStaticGreeting();
        return toAppGreeting(source);
      },
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
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};

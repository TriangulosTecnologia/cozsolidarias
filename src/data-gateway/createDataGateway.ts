import { readStaticCadUnico } from '../data-source-static/readStaticCadUnico';
import { readStaticCozinhas } from '../data-source-static/readStaticCozinhas';
import { readStaticMunicipios } from '../data-source-static/readStaticMunicipios';
import { readStaticPopulacao } from '../data-source-static/readStaticPopulacao';
import type {
  CozinhasBubblesFeatureCollection,
  CozinhasFeatureCollection,
  kitchenRateByCity,
} from './schema';
import { toCozinhasBubbles } from './transformers/toCozinhasBubbles';
import { toCozinhasFeatureCollection } from './transformers/toCozinhasFeatureCollection';
import {
  aggregateCozinhasPorMunicipio,
  type MunicipioAggregate,
  projectComTaxa,
} from './transformers/toCozinhasPorMunicipio';

/** Gateway interface exposing canonical read functions. */
export type DataGateway = {
  /** Returns cozinha locations as a GeoJSON FeatureCollection of Points. */
  getCozinhas: () => Promise<CozinhasFeatureCollection>;
  /**
   * Returns one row per município with its cozinha count, Census population,
   * Cadastro Único registrations and the derived metrics (per-100k-inhabitants
   * rate, share of Brazil, per-100k-CadÚnico rate) for the choropleth variants.
   */
  getCozinhasPorMunicipio: () => Promise<kitchenRateByCity[]>;
  /**
   * Returns one anchor Point per município with its cozinha count (for the
   * proportional-circle map).
   */
  getCozinhasBubbles: () => Promise<CozinhasBubblesFeatureCollection>;
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
    // The choropleth and the circle map are two projections of the same
    // point-in-polygon aggregation. It's the expensive step (every cozinha
    // tested against ~5.5k município polygons), so memoize it for the process
    // lifetime and let both endpoints share the result — the second caller
    // (and every later request) only pays the cheap projection.
    let aggregate: Promise<MunicipioAggregate[]> | null = null;
    const getAggregate = () => {
      if (!aggregate) {
        aggregate = Promise.all([
          readStaticCozinhas(),
          readStaticMunicipios(),
        ]).then(([cozinhas, municipios]) => {
          return aggregateCozinhasPorMunicipio(cozinhas, municipios);
        });
      }
      return aggregate;
    };

    return {
      getCozinhas: async () => {
        const sources = await readStaticCozinhas();
        return toCozinhasFeatureCollection(sources);
      },
      getCozinhasPorMunicipio: async () => {
        const [aggregate, populacao, cadunico] = await Promise.all([
          getAggregate(),
          readStaticPopulacao(),
          readStaticCadUnico(),
        ]);
        return projectComTaxa({ aggregate, populacao, cadunico });
      },
      getCozinhasBubbles: async () => {
        return toCozinhasBubbles(await getAggregate());
      },
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};

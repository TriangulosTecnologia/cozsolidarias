import { readStaticCadinsanMunicipal } from '../data-source-static/readStaticCadinsanMunicipal';
import { readStaticCadUnico } from '../data-source-static/readStaticCadUnico';
import { readStaticCafProducao } from '../data-source-static/readStaticCafProducao';
import { readStaticCafs } from '../data-source-static/readStaticCafs';
import { readStaticCafsPorMunicipio } from '../data-source-static/readStaticCafsPorMunicipio';
import { readStaticCozinhas } from '../data-source-static/readStaticCozinhas';
import { readStaticDataCatalogue } from '../data-source-static/readStaticDataCatalogue';
import { readStaticIvs } from '../data-source-static/readStaticIvs';
import { readStaticMunicipios } from '../data-source-static/readStaticMunicipios';
import { readStaticPopulacao } from '../data-source-static/readStaticPopulacao';
import type {
  cadinsanByCity,
  cafByCity,
  CafDetalhe,
  CafsFeatureCollection,
  CatalogueContract,
  CozinhaDetalhe,
  CozinhasBubblesFeatureCollection,
  CozinhasFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from './schema';
import { toAppCatalogue } from './transformers/toAppCatalogue';
import { toCadinsanPorMunicipio } from './transformers/toCadinsanPorMunicipio';
import { toCafDetalhe } from './transformers/toCafDetalhe';
import { toCafsFeatureCollection } from './transformers/toCafsFeatureCollection';
import { toCafsPorMunicipio } from './transformers/toCafsPorMunicipio';
import { toCozinhaDetalhe } from './transformers/toCozinhaDetalhe';
import { toCozinhasBubbles } from './transformers/toCozinhasBubbles';
import { toCozinhasFeatureCollection } from './transformers/toCozinhasFeatureCollection';
import {
  aggregateCozinhasPorMunicipio,
  type MunicipioAggregate,
  projectComTaxa,
} from './transformers/toCozinhasPorMunicipio';
import { toMunicipioIvs } from './transformers/toMunicipioIvs';

/** Gateway interface exposing canonical read functions. */
export type DataGateway = {
  /** Returns CAF area locations as a GeoJSON FeatureCollection of Points. */
  getCafs: () => Promise<CafsFeatureCollection>;
  /**
   * Returns the production and income detail of a single CAF by its
   * registration number (`nrCaf`), or `null` when no production records exist
   * for that CAF. Backs the click-to-inspect endpoint
   * (`GET /api/cafs/[nrCaf]`).
   */
  getCafByNrCaf: (nrCaf: string) => Promise<CafDetalhe | null>;
  /**
   * Returns one row per município with its distinct-CAF count and the derived
   * share (%) of Brazil's CAFs, for the CAF share choropleth. Reads the
   * pre-aggregated `caf-por-municipio.json` snapshot (the raw `caf-area.csv` is
   * too large to aggregate at request time).
   */
  getCafsPorMunicipio: () => Promise<cafByCity[]>;
  /**
   * Returns one row per município (all 5,570) with its CADINSAN 2025
   * food-insecurity headcounts (com/sem PBF), its CadÚnico total, and the
   * derived shares (%), for the food-insecurity choropleths. The source is
   * already per-município, so this is a cheap projection (no aggregation).
   */
  getCadinsanPorMunicipio: () => Promise<cadinsanByCity[]>;
  /**
   * Returns the data catalogue — every dataset's origin, coverage, access,
   * volume and field-level dictionary — as rendered by `/dados`.
   *
   * Origin URLs, repository paths and file checksums are redacted: they have no
   * field in the contract, so they never reach the app. Unlike the other reads
   * this one is not memoized — the catalogue is hand-edited documentation, and
   * every edit must reach the page without a restart.
   */
  getCatalogue: () => Promise<CatalogueContract>;
  /** Returns cozinha locations as a GeoJSON FeatureCollection of Points. */
  getCozinhas: () => Promise<CozinhasFeatureCollection>;
  /**
   * Returns the full detail of a single cozinha by its registration code
   * (`Código da Cozinha`, unique across the snapshot), or `null` when no cozinha
   * carries that code. Backs the click-to-inspect endpoint
   * (`GET /api/cozinhas/[codigo]`).
   */
  getCozinhaByCodigo: (codigo: string) => Promise<CozinhaDetalhe | null>;
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
  /**
   * Returns one row per município with a valid overall IVS score (Atlas da
   * Vulnerabilidade Social, IPEA) for the social-vulnerability choropleth.
   * Independent of the cozinha data — it covers every município in the IVS
   * snapshot, whether or not it has a cozinha.
   */
  getIvsPorMunicipio: () => Promise<MunicipioIvs[]>;
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
      getCafs: async () => {
        const sources = await readStaticCafs();
        return toCafsFeatureCollection(sources);
      },
      getCafByNrCaf: async (nrCaf) => {
        const sources = await readStaticCafProducao();
        const matched = sources.filter((s) => {
          return s.nrCaf === nrCaf;
        });
        if (matched.length === 0) return null;
        return toCafDetalhe({ nrCaf, sources: matched });
      },
      getCafsPorMunicipio: async () => {
        return toCafsPorMunicipio(await readStaticCafsPorMunicipio());
      },
      getCadinsanPorMunicipio: async () => {
        return toCadinsanPorMunicipio(await readStaticCadinsanMunicipal());
      },
      getCatalogue: async () => {
        return toAppCatalogue(await readStaticDataCatalogue());
      },
      getCozinhas: async () => {
        const sources = await readStaticCozinhas();
        return toCozinhasFeatureCollection(sources);
      },
      getCozinhaByCodigo: async (codigo) => {
        const sources = await readStaticCozinhas();
        const match = sources.find((source) => {
          return source.codigo === codigo;
        });
        return match ? toCozinhaDetalhe(match) : null;
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
      getIvsPorMunicipio: async () => {
        return toMunicipioIvs(await readStaticIvs());
      },
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};

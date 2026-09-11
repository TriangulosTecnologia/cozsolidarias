import { readStaticCadinsanMunicipal } from '../data-source-static/readStaticCadinsanMunicipal';
import { readStaticCadUnico } from '../data-source-static/readStaticCadUnico';
import { readStaticCafPontos } from '../data-source-static/readStaticCafPontos';
import { readStaticCafsPorMunicipio } from '../data-source-static/readStaticCafsPorMunicipio';
import {
  COZINHAS_YEARS,
  type CozinhaYear,
  isCozinhaYear,
  LATEST_COZINHA_YEAR,
  readStaticCozinhas,
} from '../data-source-static/readStaticCozinhas';
import { readStaticDataCatalogue } from '../data-source-static/readStaticDataCatalogue';
import { readStaticIvs } from '../data-source-static/readStaticIvs';
import { readStaticMunicipios } from '../data-source-static/readStaticMunicipios';
import { readStaticPopulacao } from '../data-source-static/readStaticPopulacao';
import type {
  cadinsanByCity,
  cafByCity,
  CafUfFeatureCollection,
  CatalogueContract,
  CozinhaDetalhe,
  CozinhasBubblesFeatureCollection,
  CozinhasFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from './schema';
import { toAppCatalogue } from './transformers/toAppCatalogue';
import { toCadinsanPorMunicipio } from './transformers/toCadinsanPorMunicipio';
import { toCafUfPontos } from './transformers/toCafPontos';
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
  /**
   * Returns one row per município with its distinct-CAF count and the derived
   * share (%) of Brazil's CAFs, for the CAF share choropleth. Reads the
   * pre-aggregated `caf-por-municipio.json` snapshot (the raw `caf-area.csv` is
   * too large to aggregate at request time).
   */
  getCafsPorMunicipio: () => Promise<cafByCity[]>;
  /**
   * Returns one GeoJSON Point per UF, positioned at the CAF-weighted centroid of
   * its municípios and carrying the UF's CAF total — the country level of the
   * CAF map's zoom hierarchy.
   */
  getCafPontosPorUf: () => Promise<CafUfFeatureCollection>;
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
  /**
   * Returns cozinha locations as a GeoJSON FeatureCollection of Points for the
   * given snapshot year (see {@link getCozinhasYears}). Unknown/omitted years
   * fall back to the latest snapshot. Backs the time-lapse (`?ano=`).
   */
  getCozinhas: (year?: number) => Promise<CozinhasFeatureCollection>;
  /**
   * Returns the full detail of a single cozinha by its registration code
   * (`Código da Cozinha`, unique within a snapshot), or `null` when that
   * snapshot has no cozinha with the code. Backs the click-to-inspect endpoint
   * (`GET /api/cozinhas/[codigo]`).
   *
   * The lookup is scoped to `year` (see {@link getCozinhasYears}) because the
   * snapshots cover different populations: a código plotted for one year is
   * frequently absent from another, so searching the wrong year returns `null`
   * for a point the user can plainly see on the map.
   */
  getCozinhaByCodigo: (
    codigo: string,
    year?: number
  ) => Promise<CozinhaDetalhe | null>;
  /**
   * Returns one row per município with its cozinha count, Census population,
   * Cadastro Único registrations and the derived metrics (per-100k-inhabitants
   * rate, share of Brazil, per-100k-CadÚnico rate) for the choropleth variants,
   * for the given snapshot year (see {@link getCozinhasYears}).
   */
  getCozinhasPorMunicipio: (year?: number) => Promise<kitchenRateByCity[]>;
  /**
   * Returns one anchor Point per município with its cozinha count (for the
   * proportional-circle map), for the given snapshot year.
   */
  getCozinhasBubbles: (
    year?: number
  ) => Promise<CozinhasBubblesFeatureCollection>;
  /**
   * Returns the snapshot years available for the cozinha time-lapse, oldest to
   * newest. Drives the timeline range and the client-side prefetch.
   */
  getCozinhasYears: () => number[];
  /**
   * Returns one row per município with a valid overall IVS score (Atlas da
   * Vulnerabilidade Social, IPEA) for the social-vulnerability choropleth.
   * Independent of the cozinha data — it covers every município in the IVS
   * snapshot, whether or not it has a cozinha.
   */
  getIvsPorMunicipio: () => Promise<MunicipioIvs[]>;
};

/**
 * Reads the two artefacts the CAF map's country level is built from: the UF
 * anchor positions and the canonical per-município counts that sum into their
 * totals. Both reads are memoized for the process.
 */
const readCafAnchors = async () => {
  const [anchors, counts] = await Promise.all([
    readStaticCafPontos(),
    readStaticCafsPorMunicipio(),
  ]);

  return { anchors, porMunicipio: toCafsPorMunicipio(counts) };
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
    // tested against ~5.5k município polygons), so memoize it per year for the
    // process lifetime and let both endpoints share each year's result — the
    // second caller (and every later request) only pays the cheap projection.
    const aggregates = new Map<CozinhaYear, Promise<MunicipioAggregate[]>>();
    const getAggregate = (year: CozinhaYear) => {
      const existing = aggregates.get(year);
      if (existing) {
        return existing;
      }
      const promise = Promise.all([
        readStaticCozinhas({ year }),
        readStaticMunicipios(),
      ]).then(([cozinhas, municipios]) => {
        return aggregateCozinhasPorMunicipio(cozinhas, municipios);
      });
      aggregates.set(year, promise);
      return promise;
    };

    // Coerce a requested year to a known snapshot, falling back to the latest.
    const resolveYear = (year?: number): CozinhaYear => {
      return year !== undefined && isCozinhaYear(year)
        ? year
        : LATEST_COZINHA_YEAR;
    };

    return {
      getCafsPorMunicipio: async () => {
        return toCafsPorMunicipio(await readStaticCafsPorMunicipio());
      },
      getCafPontosPorUf: async () => {
        return toCafUfPontos(await readCafAnchors());
      },
      getCadinsanPorMunicipio: async () => {
        return toCadinsanPorMunicipio(await readStaticCadinsanMunicipal());
      },
      getCatalogue: async () => {
        return toAppCatalogue(await readStaticDataCatalogue());
      },
      getCozinhas: async (year) => {
        const sources = await readStaticCozinhas({ year: resolveYear(year) });
        return toCozinhasFeatureCollection(sources);
      },
      getCozinhaByCodigo: async (codigo, year) => {
        const sources = await readStaticCozinhas({ year: resolveYear(year) });
        const match = sources.find((source) => {
          return source.codigo === codigo;
        });
        return match ? toCozinhaDetalhe(match) : null;
      },
      getCozinhasPorMunicipio: async (year) => {
        const [aggregate, populacao, cadunico] = await Promise.all([
          getAggregate(resolveYear(year)),
          readStaticPopulacao(),
          readStaticCadUnico(),
        ]);
        return projectComTaxa({ aggregate, populacao, cadunico });
      },
      getCozinhasBubbles: async (year) => {
        return toCozinhasBubbles(await getAggregate(resolveYear(year)));
      },
      getCozinhasYears: () => {
        return [...COZINHAS_YEARS];
      },
      getIvsPorMunicipio: async () => {
        return toMunicipioIvs(await readStaticIvs());
      },
    };
  }

  const exhaustive: never = raw;
  throw new Error(`[data-gateway] Unhandled source: ${exhaustive}`);
};

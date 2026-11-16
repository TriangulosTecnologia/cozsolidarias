import type { CatalogueContract } from '@/data-gateway/schema';

import { RENDERABLE_DATASET_IDS } from './mapDataCatalogue';

/**
 * What the dataset catalogue says about one dataset, reduced to what the
 * preflight needs to judge a prompt without a model call.
 */
export type ConceptEntry = {
  datasetId: string;
  title: string;
  /** Whether the route can paint at least one id from this dataset. */
  renderable: boolean;
  /** The renderable ids this dataset feeds (variants included). */
  ids: string[];
  /** Stems of the words the catalogue uses to describe it. */
  stems: Set<string>;
  /** Inclusive year ranges of its temporal extent; empty when undocumented. */
  years: Array<[number, number]>;
};

/** What {@link classifyConcepts} concluded about a prompt's concepts. */
export type ConceptVerdict =
  | { status: 'covered' | 'unknown' }
  | { status: 'notRenderable'; titles: string[] }
  | { status: 'absent'; terms: string[] };

const STEM_LENGTH = 5;
const MIN_WORD_LENGTH = 3;

/**
 * Words that carry no data concept: articles, prepositions, how a map is asked
 * for and how it is drawn (base map, style, geometry, map type). A prompt made
 * only of these says nothing about what to measure, so the agent decides.
 */
const NON_CONCEPT_WORDS = new Set([
  'mapa',
  'mapas',
  'quero',
  'queria',
  'gostaria',
  'mostre',
  'mostrar',
  'mostra',
  'ver',
  'visualizar',
  'exibir',
  'onde',
  'quais',
  'qual',
  'quanto',
  'quantos',
  'quantas',
  'como',
  'para',
  'por',
  'com',
  'sem',
  'uma',
  'uns',
  'umas',
  'dos',
  'das',
  'nos',
  'nas',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'que',
  'sobre',
  'entre',
  'cada',
  'todos',
  'todas',
  'municipio',
  'municipios',
  'brasil',
  'brasileiros',
  'estado',
  'estados',
  'regiao',
  'regioes',
  'cidade',
  'cidades',
  'dado',
  'dados',
  'indicador',
  'indicadores',
  'base',
  'basemap',
  'fundo',
  'estilo',
  'styleurl',
  'customizado',
  'visivel',
  'geometria',
  'geometrias',
  'camada',
  'camadas',
  'legenda',
  'cor',
  'cores',
  'zoom',
  'satelite',
  'coropletico',
  'proporcional',
  'circulos',
  'pontos',
  'calor',
  'heatmap',
  'densidade',
]);

/**
 * Concepts users commonly ask for that the catalogue verifiably lacks, as
 * normalized words (singular and plural). Only a word listed here makes a
 * prompt `absent`: an unknown word stays `unknown` and goes to the agent,
 * because a deterministic check cannot be sure what a stranger word means.
 * `conceptIndex.test.ts` fails when the catalogue starts describing one of
 * them, which is the cue to remove it.
 */
export const KNOWN_ABSENT_WORDS: readonly string[] = [
  'rodovia',
  'rodovias',
  'aeroporto',
  'aeroportos',
  'hospital',
  'hospitais',
  'temperatura',
  'clima',
  'chuva',
  'chuvas',
  'criminalidade',
  'violencia',
  'homicidios',
  'transito',
  'acidentes',
  'eleicoes',
  'votos',
];

/**
 * Lower-cases and strips accents, so prompt and catalogue compare alike.
 *
 * @example
 * normalize('Insegurança'); // 'inseguranca'
 */
export const normalize = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

const wordsOf = (text: string): string[] => {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => {
      return word.length >= MIN_WORD_LENGTH;
    });
};

const stemOf = (word: string): string => {
  return word.slice(0, STEM_LENGTH);
};

const idsOf = (datasetId: string): string[] => {
  return RENDERABLE_DATASET_IDS.filter((id) => {
    return (
      id === datasetId ||
      id.startsWith(`${datasetId}_`) ||
      // The IDHM ids paint fields of the IVS dataset.
      (datasetId === 'municipios_ivs' && id.startsWith('municipios_idhm'))
    );
  });
};

const yearOf = (date: string): number => {
  return Number.parseInt(date.slice(0, 4), 10);
};

/**
 * Indexes the catalogue for the preflight: per dataset, the words that
 * describe it (title, description, field descriptions), the renderable ids it
 * feeds and the years it covers. Pure and deterministic.
 *
 * @param catalogue - The catalogue from `gateway.getCatalogue()`.
 * @returns One {@link ConceptEntry} per dataset.
 *
 * @example
 * buildConceptIndex(await gateway.getCatalogue())[0]?.datasetId; // 'cozinhas_geolocalizadas'
 */
export const buildConceptIndex = (
  catalogue: CatalogueContract
): ConceptEntry[] => {
  return catalogue.datasets.map((dataset) => {
    const ids = idsOf(dataset.id);
    const text = [
      dataset.title,
      dataset.description,
      ...dataset.fields.map((field) => {
        return field.description;
      }),
    ].join(' ');
    return {
      datasetId: dataset.id,
      title: dataset.title,
      renderable: ids.length > 0,
      ids,
      // A dataset with no time dimension is reference geometry (boundaries,
      // names): it measures no concept a prompt could ask for.
      stems:
        dataset.temporal.status === 'notApplicable'
          ? new Set<string>()
          : new Set(wordsOf(text).map(stemOf)),
      years:
        dataset.temporal.status === 'described'
          ? dataset.temporal.extent.map(({ start, end }) => {
              return [
                start ? yearOf(start) : -Infinity,
                end ? yearOf(end) : Infinity,
              ];
            })
          : [],
    };
  });
};

/**
 * Loads and indexes the catalogue. A catalogue that cannot be read yields an
 * empty index, which {@link classifyConcepts} treats as "cannot judge": the
 * preflight then never blocks a request.
 *
 * @param load - Reads the catalogue, e.g. `gateway.getCatalogue`.
 *
 * @example
 * const index = await loadConceptIndex(gateway.getCatalogue);
 */
export const loadConceptIndex = async (
  load: () => Promise<CatalogueContract>
): Promise<ConceptEntry[]> => {
  try {
    return buildConceptIndex(await load());
  } catch {
    return [];
  }
};

/**
 * Whether a renderable id has data for a year. An id no dataset documents, or
 * a dataset with no documented extent, never blocks.
 *
 * @example
 * coversYear({ index, id: 'municipios_ivs', year: 2022 }); // false: IVS is 2010
 */
export const coversYear = (params: {
  index: ConceptEntry[];
  id: string;
  year: number;
}): boolean => {
  const holders = params.index.filter((entry) => {
    return entry.ids.includes(params.id);
  });
  return (
    holders.length === 0 ||
    holders.some((entry) => {
      return (
        entry.years.length === 0 ||
        entry.years.some(([from, to]) => {
          return params.year >= from && params.year <= to;
        })
      );
    })
  );
};

/**
 * Judges the concepts of a normalized prompt against the catalogue. Any word
 * a renderable dataset describes makes the prompt `covered`; words only an
 * unserved dataset describes make it `notRenderable`; a word listed in
 * {@link KNOWN_ABSENT_WORDS} that no dataset describes makes it `absent`.
 * Anything else, or no catalogue, is `unknown` and never blocks.
 *
 * deferred: stem matching misses synonyms and the absent lexicon is short;
 * revisit when `generationLogger` shows `unknown` prompts the agent answers
 * with `missing_data`.
 *
 * @param params.text - The prompt, already passed through {@link normalize}.
 * @param params.index - From {@link buildConceptIndex}.
 *
 * @example
 * classifyConcepts({ text: 'mapa de rodovias', index }).status; // 'absent'
 */
export const classifyConcepts = (params: {
  text: string;
  index: ConceptEntry[];
}): ConceptVerdict => {
  const terms = wordsOf(params.text).filter((word) => {
    return !NON_CONCEPT_WORDS.has(word);
  });
  const matching = (renderable: boolean) => {
    return params.index.filter((entry) => {
      return (
        entry.renderable === renderable &&
        terms.some((term) => {
          return entry.stems.has(stemOf(term));
        })
      );
    });
  };

  if (terms.length === 0 || params.index.length === 0) {
    return { status: 'unknown' };
  }
  if (matching(true).length > 0) {
    return { status: 'covered' };
  }
  const unserved = matching(false);
  if (unserved.length > 0) {
    return {
      status: 'notRenderable',
      titles: unserved.map((entry) => {
        return entry.title;
      }),
    };
  }
  const absent = terms.filter((term) => {
    return KNOWN_ABSENT_WORDS.includes(term);
  });
  return absent.length > 0
    ? { status: 'absent', terms: absent }
    : { status: 'unknown' };
};

import type { MapType } from '@ttoss/geovis';

import {
  ABSOLUTE_TOTAL_DATASET_IDS,
  type RenderableDatasetId,
} from './mapDataCatalogue';
import { MAP_TYPE_OPTIONS } from './mapTypeOptions';

/** One selectable dataset or map type, with its pt-BR label. */
export type ClarifyOption = { value: string; label: string };

/** A question the user must answer before a spec is generated. */
export type Clarification = {
  facet: 'dataset' | 'mapType';
  question: string;
  options: ClarifyOption[];
  default: string;
};

/**
 * What {@link preflightPrompt} concluded: `resolved` and `unmatched` both let
 * the generation proceed (its validation loop stays the real gate); only
 * `ambiguous` stops to ask.
 */
export type PreflightResult =
  | { status: 'resolved' | 'unmatched' }
  | { status: 'ambiguous'; clarify: Clarification };

type Variant = { id: RenderableDatasetId; label: string; match: RegExp };

type Family = {
  keyword: RegExp;
  defaultId: RenderableDatasetId;
  variants: Variant[];
};

/**
 * Dataset families whose variants a prompt can tell apart. `keyword` and
 * `match` run over the accent-stripped, lower-cased prompt.
 */
export const FAMILIES: Family[] = [
  {
    keyword: /\bivs\b/,
    defaultId: 'municipios_ivs',
    variants: [
      {
        id: 'municipios_ivs_infraestrutura',
        label: 'IVS – Infraestrutura urbana',
        match: /infraestrutura/,
      },
      {
        id: 'municipios_ivs_capital_humano',
        label: 'IVS – Capital humano',
        match: /capital humano/,
      },
      {
        id: 'municipios_ivs_renda_trabalho',
        label: 'IVS – Renda e trabalho',
        match: /renda|trabalho/,
      },
    ],
  },
  {
    keyword: /idhm/,
    defaultId: 'municipios_idhm',
    variants: [
      {
        id: 'municipios_idhm_longevidade',
        label: 'IDHM – Longevidade',
        match: /longevidade/,
      },
      {
        id: 'municipios_idhm_educacao',
        label: 'IDHM – Educação',
        match: /educacao/,
      },
      {
        id: 'municipios_idhm_educacao_escolaridade',
        label: 'IDHM – Educação (escolaridade)',
        match: /escolaridade/,
      },
      {
        id: 'municipios_idhm_educacao_frequencia',
        label: 'IDHM – Educação (frequência escolar)',
        match: /frequencia/,
      },
      { id: 'municipios_idhm_renda', label: 'IDHM – Renda', match: /renda/ },
    ],
  },
  {
    keyword: /cadinsan|cadunico|inseguranca alimentar/,
    defaultId: 'municipios_cadinsan',
    variants: [
      {
        id: 'municipios_cadinsan',
        label: 'Insegurança alimentar com Bolsa Família',
        match: /com (o )?(pbf|bolsa)/,
      },
      {
        id: 'municipios_cadinsan_sem_pbf',
        label: 'Insegurança alimentar sem Bolsa Família',
        match: /sem (o )?(pbf|bolsa)/,
      },
    ],
  },
  {
    keyword: /cozinha|atendid/,
    defaultId: 'cozinhas_geolocalizadas',
    variants: [
      {
        id: 'cozinhas_geolocalizadas_2025',
        label: 'Cozinhas em 2025',
        match: /2025/,
      },
      {
        id: 'cozinhas_pessoas_atendidas',
        label: 'Pessoas atendidas pelas cozinhas',
        match: /atendid/,
      },
    ],
  },
];

const normalize = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

/**
 * The variants a prompt names, minus any that a more specific hit refines
 * (`…_educacao` yields to `…_educacao_escolaridade`).
 */
const mostSpecific = (variants: Variant[]): Variant[] => {
  return variants.filter((variant) => {
    return !variants.some((other) => {
      return other.id !== variant.id && other.id.startsWith(`${variant.id}_`);
    });
  });
};

/** Every family the prompt names, with the variants it also names. */
const familyHits = (text: string) => {
  return FAMILIES.filter((family) => {
    return family.keyword.test(text);
  }).map((family) => {
    return {
      family,
      variants: mostSpecific(
        family.variants.filter((variant) => {
          return variant.match.test(text);
        })
      ),
    };
  });
};

const datasetClarification = (variants: Variant[]): Clarification => {
  return {
    facet: 'dataset',
    question: 'Qual destes indicadores você quer no mapa?',
    options: variants.map((variant) => {
      return { value: variant.id, label: variant.label };
    }),
    default: variants[0].id,
  };
};

const MAP_TYPE_FALLBACKS: MapType[] = ['proportionalCircles', 'dotDensity'];

const absoluteTotalClarification = (): Clarification => {
  return {
    facet: 'mapType',
    question:
      'Este indicador é um total absoluto; um mapa coroplético distorce a leitura pelo tamanho das áreas. Qual tipo de mapa você prefere?',
    options: MAP_TYPE_FALLBACKS.flatMap((type) => {
      return MAP_TYPE_OPTIONS.filter((option) => {
        return option.value === type;
      });
    }),
    default: MAP_TYPE_FALLBACKS[0],
  };
};

const isAbsoluteTotal = (id: string): boolean => {
  return (ABSOLUTE_TOTAL_DATASET_IDS as readonly string[]).includes(id);
};

/** The dataset ids the prompt resolves to: the user's pick, else each family's variant or default. */
const chosenIds = (params: {
  datasetId?: RenderableDatasetId;
  hits: ReturnType<typeof familyHits>;
}): string[] => {
  return params.datasetId
    ? [params.datasetId]
    : params.hits.map((hit) => {
        return hit.variants[0]?.id ?? hit.family.defaultId;
      });
};

const choroplethOnAbsoluteTotal = (params: {
  ids: string[];
  text: string;
  mapType?: MapType;
}): boolean => {
  // An explicit map type is the user's answer, even a choropleth: the
  // downstream check rejects it with its reason. Only the prompt's wording asks.
  return (
    !params.mapType &&
    /coropl/.test(params.text) &&
    params.ids.some(isAbsoluteTotal)
  );
};

/**
 * Classifies a prompt before any model call, without ever refusing it: it
 * only asks when a family's variants are ambiguous or a choropleth targets an
 * absolute total (the pairing `findChoroplethOnAbsoluteTotal` would reject
 * later). A prompt naming no known family is `unmatched` and goes on to
 * generation untouched.
 *
 * deferred: token matching misses synonyms and typos, revisit when
 * `generationLogger` shows `unmatched` prompts failing generation.
 *
 * @param params.prompt - The user's request.
 * @param params.mapType - The map type the user already chose, if any.
 * @param params.datasetId - The dataset the user already chose; replaces the text matching.
 * @returns `resolved`, `unmatched`, or `ambiguous` with the question to ask.
 *
 * @example
 * preflightPrompt({ prompt: 'coroplético de pessoas atendidas' }).status; // 'ambiguous'
 */
export const preflightPrompt = (params: {
  prompt: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
}): PreflightResult => {
  const text = normalize(params.prompt);
  const hits = params.datasetId ? [] : familyHits(text);
  const split = hits.find((hit) => {
    return hit.variants.length > 1;
  });
  if (split) {
    return {
      status: 'ambiguous',
      clarify: datasetClarification(split.variants),
    };
  }

  const ids = chosenIds({ datasetId: params.datasetId, hits });
  if (ids.length === 0) {
    return { status: 'unmatched' };
  }
  return choroplethOnAbsoluteTotal({ ids, text, mapType: params.mapType })
    ? { status: 'ambiguous', clarify: absoluteTotalClarification() }
    : { status: 'resolved' };
};

/**
 * The 200 asking the user to choose: `{ error: false, clarify }` with no
 * `spec`, plus the map types on offer.
 *
 * @param clarify - The question from an `ambiguous` {@link PreflightResult}.
 * @returns The JSON `Response`.
 *
 * @example
 * clarifyResponse({ facet: 'mapType', question: '...', options: [], default: 'dotDensity' });
 */
export const clarifyResponse = (clarify: Clarification): Response => {
  return Response.json({
    error: false,
    clarify,
    mapTypeOptions: MAP_TYPE_OPTIONS,
  });
};

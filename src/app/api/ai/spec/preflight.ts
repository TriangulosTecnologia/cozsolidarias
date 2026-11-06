import type { MapType } from '@ttoss/geovis';

import {
  type FilterDomain,
  normalizeText,
  type ServerFilter,
} from './fieldFilters';
import { valueRequest } from './filterRequest';
import {
  ABSOLUTE_TOTAL_DATASET_IDS,
  type RenderableDatasetId,
} from './mapDataCatalogue';
import { MAP_TYPE_OPTIONS } from './mapTypeOptions';
import { FAMILY_DEFS, FAMILY_NAMES, familyVariants } from './renderableFields';

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
  | {
      status: 'resolved' | 'unmatched';
      datasetId?: RenderableDatasetId;
      filter?: ServerFilter;
    }
  | { status: 'ambiguous'; clarify: Clarification }
  | { status: 'unsupported'; message: string };

type Variant = { id: RenderableDatasetId; label: string; match: RegExp };

type Family = {
  keyword: RegExp;
  defaultId: RenderableDatasetId;
  variants: Variant[];
};

/**
 * Dataset families whose variants a prompt can tell apart, derived from the
 * renderable-field registry. `keyword` and `match` run over the accent-stripped,
 * lower-cased prompt.
 */
export const FAMILIES: Family[] = FAMILY_NAMES.map((name) => {
  return {
    keyword: FAMILY_DEFS[name].keyword,
    defaultId: FAMILY_DEFS[name].defaultId,
    variants: familyVariants(name).map(({ id, variant }) => {
      return { id, label: variant.label, match: variant.match };
    }),
  };
});

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

/**
 * Whether the user's chosen dataset answers this family: the family owns the
 * id. An answered family is no longer ambiguous and takes no text match.
 */
const answeredBy = (params: {
  hit: ReturnType<typeof familyHits>[number];
  datasetId?: RenderableDatasetId;
}): boolean => {
  const { hit, datasetId } = params;
  return (
    datasetId !== undefined &&
    (hit.family.defaultId === datasetId ||
      hit.family.variants.some((variant) => {
        return variant.id === datasetId;
      }))
  );
};

/**
 * The dataset ids the prompt resolves to: the user's pick first, then each
 * unanswered family's variant or default. Families the pick answers keep no
 * text match, so a pick never drops the prompt's other facets.
 */
const chosenIds = (params: {
  datasetId?: RenderableDatasetId;
  hits: ReturnType<typeof familyHits>;
}): string[] => {
  const open = params.hits
    .filter((hit) => {
      return !answeredBy({ hit, datasetId: params.datasetId });
    })
    .map((hit) => {
      return hit.variants[0]?.id ?? hit.family.defaultId;
    });
  return params.datasetId ? [params.datasetId, ...open] : open;
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
 * @param params.filterDomains - The values each filterable base holds (see
 * `readFilterDomainsFor`); omitted = no field filter is matched.
 * @returns `resolved`, `unmatched`, or `ambiguous` with the question to ask.
 *
 * @example
 * preflightPrompt({ prompt: 'coroplético de pessoas atendidas' }).status; // 'ambiguous'
 */
export const preflightPrompt = (params: {
  prompt: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
  filterDomains?: FilterDomain[];
}): PreflightResult => {
  const text = normalizeText(params.prompt);
  const hits = familyHits(text);
  const splits = hits.filter((hit) => {
    return (
      hit.variants.length > 1 &&
      !answeredBy({ hit, datasetId: params.datasetId })
    );
  });
  if (splits.length > 0) {
    return {
      status: 'ambiguous',
      clarify: datasetClarification(
        splits.flatMap((split) => {
          return split.variants;
        })
      ),
    };
  }

  const valued = valueRequest({
    text,
    datasetId: params.datasetId,
    domains: params.filterDomains,
  });
  if (valued) {
    return valued;
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

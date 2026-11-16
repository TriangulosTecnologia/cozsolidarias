import type { MapType } from '@ttoss/geovis';

import {
  conceptFeedback,
  type Feedback,
  findProxy,
  periodFeedback,
} from './catalogueFeedback';
import { type ConceptEntry, normalize } from './conceptIndex';
import { FAMILIES, type Variant } from './datasetFamilies';
import {
  isAbsoluteTotalDataset,
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
 * What {@link preflightPrompt} concluded: `resolved`, `unmatched` and `proxy`
 * let the generation proceed (its validation loop stays the real gate; a
 * `proxy` also names the adjacent dataset and says it is not the exact
 * measure); `ambiguous` stops to ask and `feedback` stops to explain.
 */
export type PreflightResult =
  | { status: 'resolved' | 'unmatched' }
  | { status: 'ambiguous'; clarify: Clarification }
  | { status: 'unavailable'; grain: string }
  | { status: 'feedback'; feedback: Feedback }
  | { status: 'proxy'; datasetId: RenderableDatasetId; note: string };

/**
 * A spatial unit asked for "por/em cada/de cada" that no renderable dataset
 * has: every one is keyed by município (or by kitchen), so a map by state,
 * region, neighbourhood or district would answer another question. Matched
 * on the normalized prompt; the captured group is the unit's stem.
 */
const UNAVAILABLE_GRAIN =
  /\b(?:por|em cada|de cada|entre (?:os|as))\s+(estado|uf|unidade federativa|regiao|regioes|bairro|distrito|setor censitario|microrregiao|mesorregiao)/;

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
    params.ids.some(isAbsoluteTotalDataset)
  );
};

const preflightDataset = (params: {
  text: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
}): PreflightResult => {
  const { text } = params;
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

/** The renderable ids a resolved prompt stands for: the user's pick, else each family's variant or default. */
const resolvedIds = (params: {
  text: string;
  datasetId?: RenderableDatasetId;
}): string[] => {
  return chosenIds({
    datasetId: params.datasetId,
    hits: params.datasetId ? [] : familyHits(params.text),
  });
};

/**
 * Refines what the dataset preflight concluded with what the catalogue says:
 * a year the resolved dataset does not cover, or a concept no served dataset
 * describes. Never refuses what the catalogue cannot judge: that goes on to
 * generation.
 */
const preflightCatalogue = (params: {
  dataset: PreflightResult;
  text: string;
  datasetId?: RenderableDatasetId;
  concepts: ConceptEntry[];
}): PreflightResult => {
  const { dataset, text, concepts } = params;
  const feedback =
    dataset.status === 'resolved'
      ? periodFeedback({ text, ids: resolvedIds(params), concepts })
      : dataset.status === 'unmatched'
        ? conceptFeedback({ text, concepts })
        : null;
  return feedback ? { status: 'feedback', feedback } : dataset;
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
 * @param params.concepts - The catalogue index (see `buildConceptIndex`); without it the catalogue is not consulted.
 * @returns `resolved`, `unmatched`, a `proxy`, `feedback` explaining why no
 * map can be made as asked, or `ambiguous` with the question to ask.
 *
 * @example
 * preflightPrompt({ prompt: 'coroplético de pessoas atendidas' }).status; // 'ambiguous'
 */
export const preflightPrompt = (params: {
  prompt: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
  concepts?: ConceptEntry[];
}): PreflightResult => {
  const text = normalize(params.prompt);
  const grain = UNAVAILABLE_GRAIN.exec(text)?.[1];
  if (grain) {
    return { status: 'unavailable', grain };
  }
  const dataset = preflightDataset({ text, ...params });
  const proxy = dataset.status === 'unmatched' ? findProxy(text) : undefined;
  if (proxy) {
    return { status: 'proxy', datasetId: proxy.datasetId, note: proxy.note };
  }
  return params.concepts
    ? preflightCatalogue({
        dataset,
        text,
        datasetId: params.datasetId,
        concepts: params.concepts,
      })
    : dataset;
};

export { FAMILIES } from './datasetFamilies';
export {
  clarifyResponse,
  feedbackResponse,
  preflightResponse,
} from './preflightResponse';

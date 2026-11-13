import {
  classifyConcepts,
  type ConceptEntry,
  coversYear,
} from './conceptIndex';
import type { RenderableDatasetId } from './mapDataCatalogue';

/**
 * Why a request cannot be answered with a map as asked, and how to rewrite it:
 * the body the client shows when the preflight stops a request.
 */
export type Feedback = {
  verdict: 'absent' | 'notRenderable' | 'period';
  reason: string;
  suggestions: string[];
};

/**
 * Concepts the catalogue measures only through an adjacent indicator. The
 * prompt is answered with that dataset and told, in pt-BR, that it is a proxy
 * (the rule `agents/geovis-spec-generator/instructions/02-fields-resolution.md`
 * states for the agent). Applies only to a request that names no dataset.
 */
const PROXIES: Array<{
  match: RegExp;
  datasetId: RenderableDatasetId;
  note: string;
}> = [
  {
    match: /\bfome\b/,
    datasetId: 'municipios_cadinsan',
    note: 'Fome não é medida diretamente; a insegurança alimentar das famílias do CadÚnico (CADINSAN) é o indicador mais próximo.',
  },
  {
    match: /pobreza|miseria/,
    datasetId: 'municipios_ivs_renda_trabalho',
    note: 'Pobreza não é medida diretamente; o subíndice de renda e trabalho do IVS é o indicador mais próximo.',
  },
];

const YEAR = /\b(?:19|20)\d{2}\b/;

const DETAIL_TIP =
  'Diga o que medir, em qual recorte (município) e em qual período.';

/**
 * The proxy a normalized prompt asks for, if any.
 *
 * @example
 * findProxy('mapa da fome')?.datasetId; // 'municipios_cadinsan'
 */
export const findProxy = (
  text: string
): { datasetId: RenderableDatasetId; note: string } | undefined => {
  return PROXIES.find(({ match }) => {
    return match.test(text);
  });
};

const availableDatasets = (concepts: ConceptEntry[]): string => {
  return `Dados disponíveis para mapa: ${concepts
    .filter((entry) => {
      return entry.renderable;
    })
    .map((entry) => {
      return entry.title;
    })
    .join('; ')}.`;
};

/**
 * The feedback for a year in the prompt that one of the resolved datasets does
 * not cover, or `null` when there is no year or every dataset covers it.
 *
 * @param params.ids - The renderable ids the prompt resolved to.
 *
 * @example
 * periodFeedback({ text: 'ivs de 2022', ids: ['municipios_ivs'], concepts })?.verdict; // 'period'
 */
export const periodFeedback = (params: {
  text: string;
  ids: string[];
  concepts: ConceptEntry[];
}): Feedback | null => {
  const year = YEAR.exec(params.text)?.[0];
  const uncovered =
    year &&
    !params.ids.every((id) => {
      return coversYear({ index: params.concepts, id, year: Number(year) });
    });
  return uncovered
    ? {
        verdict: 'period',
        reason: `Não há dados de ${year} para este indicador.`,
        suggestions: [
          'Retire o ano do pedido para usar o período disponível, ou consulte a página de dados para ver a cobertura de cada indicador.',
          DETAIL_TIP,
        ],
      }
    : null;
};

/**
 * The feedback for a prompt whose concept no served dataset describes (a
 * dataset catalogued but not served, or a concept the catalogue lacks), or
 * `null` when the catalogue cannot say so for sure.
 *
 * @example
 * conceptFeedback({ text: 'mapa de rodovias', concepts })?.verdict; // 'absent'
 */
export const conceptFeedback = (params: {
  text: string;
  concepts: ConceptEntry[];
}): Feedback | null => {
  const verdict = classifyConcepts({
    text: params.text,
    index: params.concepts,
  });
  if (verdict.status === 'absent') {
    return {
      verdict: 'absent',
      reason: `Não há dados sobre ${verdict.terms.join(', ')} no catálogo.`,
      suggestions: [availableDatasets(params.concepts), DETAIL_TIP],
    };
  }
  return verdict.status === 'notRenderable'
    ? {
        verdict: 'notRenderable',
        reason: `Há dados de ${verdict.titles.join(', ')} no catálogo, mas ainda não é possível mapeá-los aqui.`,
        suggestions: [availableDatasets(params.concepts), DETAIL_TIP],
      }
    : null;
};

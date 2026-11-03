import { RENDERABLE_DATASET_IDS } from './mapDataCatalogue';
import type { SpecIssue } from './specValidation';

/** A {@link SpecIssue} plus what the user can do about it. */
export type SpecRequirement = SpecIssue & { fix: string };

const GENERIC_FIX =
  'Reformule o pedido informando o dataset e o tipo de mapa desejados.';

const FIX_BY_CODE: Record<string, string> = {
  'unsupported-dataset': `Escolha um dos datasets disponíveis: ${RENDERABLE_DATASET_IDS.join(', ')}.`,
  'choropleth-on-absolute-total':
    'Escolha outro tipo de mapa (círculos proporcionais, proportionalCircles, ou densidade de pontos, dotDensity) ou um dataset relativo (taxa, razão ou índice).',
  'point-layer-on-polygon-source':
    'Peça um mapa coroplético, ou um dataset com localização pontual.',
  'reclassified-official-index':
    'Mantenha as faixas oficiais do índice, sem reclassificá-las.',
  'missing-legend': 'Peça que o mapa tenha legenda.',
  'geometry-in-map-data':
    'Peça um mapa por município, sem geometrias dentro dos dados.',
  'unknown-source-url':
    'Use apenas as fontes geográficas do projeto (municípios, estados).',
  'unknown-basemap-style': 'Use o mapa base padrão do projeto.',
};

/**
 * Turns validation issues into requirements the user can act on: each issue
 * keeps its code, path and message and gains a pt-BR `fix`.
 *
 * @param issues - Issues behind a rejected spec.
 * @returns One requirement per issue, in the same order.
 *
 * @example
 * requirementsFrom([{ code: 'missing-legend', message: '...' }])[0].fix; // 'Peça que o mapa tenha legenda.'
 */
export const requirementsFrom = (issues: SpecIssue[]): SpecRequirement[] => {
  return issues.map((issue) => {
    const fix = Object.hasOwn(FIX_BY_CODE, issue.code)
      ? FIX_BY_CODE[issue.code]
      : GENERIC_FIX;
    return { ...issue, fix };
  });
};

import { FILTER_FIELDS, FILTERABLE_BASES } from '../renderableFields';

/** The marker that identifies the generated filter entry in the endpoints doc. */
export const FILTER_DOC_PATH = '(mapDataId filtrado por valor de campo)';

/**
 * The generated entry describing filtered `mapDataId`s to the agent, in the
 * same shape as the hand-written endpoint entries. It names the bases and the
 * allowlisted fields only: the accepted values are read from the data and sent
 * in the catalogue's `filtros`, so this file never lists a value.
 *
 * @returns The entry, derived from `FILTERABLE_BASES` and `FILTER_FIELDS`.
 *
 * @example
 * buildFilterDocEntry().path; // '(mapDataId filtrado por valor de campo)'
 */
export const buildFilterDocEntry = (): Record<string, unknown> => {
  const bases = FILTERABLE_BASES.map(({ baseId }) => {
    return baseId;
  });
  return {
    method: 'MAPDATA',
    path: FILTER_DOC_PATH,
    summary:
      'Contagem de cozinhas por município cujo campo tem um valor, como uma situação.',
    parameters: [],
    response: {
      description:
        'O valor é a contagem de cozinhas localizadas no município cujo campo tem o valor pedido.',
    },
    usage: `Para contar só as cozinhas com um valor de campo, use um mapDataId no formato <base>?<campo>=<valor>, com <base> em ${bases.join(', ')} e <campo> em ${Object.keys(FILTER_FIELDS).join(', ')}. Os valores aceitos estão em "filtros" na entrada da base no catálogo; copie o valor exatamente.`,
    constraints: [
      'Um valor ausente de "filtros" é desconhecido, nunca zero: não o use.',
      'Um campo e um valor por mapDataId; não combine valores em um mesmo mapa.',
    ],
  };
};

/**
 * Replaces the generated filter entry of an endpoints doc, or appends it when
 * absent. Pure: the input array is not mutated.
 *
 * @param endpoints - The parsed `endpointsDocumentation.json` array.
 * @returns The synced array.
 *
 * @example
 * syncFilterDoc([]).length; // 1
 */
export const syncFilterDoc = (
  endpoints: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  const entry = buildFilterDocEntry();
  const isGenerated = (item: Record<string, unknown>): boolean => {
    return item['path'] === FILTER_DOC_PATH;
  };
  return endpoints.some(isGenerated)
    ? endpoints.map((item) => {
        return isGenerated(item) ? entry : item;
      })
    : [...endpoints, entry];
};

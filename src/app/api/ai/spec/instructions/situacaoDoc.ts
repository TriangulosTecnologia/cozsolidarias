import {
  RENDERABLE_FIELD_META,
  type RenderableFieldMeta,
} from '../renderableFields';

/** The marker that identifies the generated situação entry in the endpoints doc. */
export const SITUACAO_DOC_PATH = '(mapDataId cozinhas por situação e ano)';

/** The `mapDataId`s the registry defines for situação counts, in registry order. */
export const situacaoMapDataIds = (): string[] => {
  return (
    Object.entries(RENDERABLE_FIELD_META) as Array<
      [string, RenderableFieldMeta]
    >
  )
    .filter(([, meta]) => {
      return meta.situacao !== undefined;
    })
    .map(([id]) => {
      return id;
    });
};

/**
 * The generated entry describing the situação `mapDataId`s to the agent, in the
 * same shape as the hand-written endpoint entries.
 *
 * @returns The entry, derived only from the renderable-field registry.
 *
 * @example
 * buildSituacaoDocEntry().path; // '(mapDataId cozinhas por situação e ano)'
 */
export const buildSituacaoDocEntry = (): Record<string, unknown> => {
  const ids = situacaoMapDataIds();
  return {
    method: 'MAPDATA',
    path: SITUACAO_DOC_PATH,
    summary:
      'Contagem de cozinhas por município, por situação (habilitadas, não habilitadas ou outras) e por ano.',
    parameters: [],
    response: {
      description:
        'Um mapDataId por combinação de situação e ano; o valor é a contagem de cozinhas localizadas no município.',
    },
    usage: `Quando o pedido for sobre situação de cozinhas, use exatamente um destes mapDataId: ${ids.join(', ')}.`,
    constraints: [
      'O snapshot de 2026 só contém cozinhas habilitadas: cozinhas_nao_habilitadas_2026 e cozinhas_outras_2026 são desconhecidos, nunca zero.',
      'Não combine duas situações em um mesmo mapa.',
    ],
  };
};

/**
 * Replaces the generated situação entry of an endpoints doc, or appends it when
 * absent. Pure: the input array is not mutated.
 *
 * @param endpoints - The parsed `endpointsDocumentation.json` array.
 * @returns The synced array.
 *
 * @example
 * syncSituacaoDoc([]).length; // 1
 */
export const syncSituacaoDoc = (
  endpoints: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  const entry = buildSituacaoDocEntry();
  const isGenerated = (item: Record<string, unknown>): boolean => {
    return item['path'] === SITUACAO_DOC_PATH;
  };
  return endpoints.some(isGenerated)
    ? endpoints.map((item) => {
        return isGenerated(item) ? entry : item;
      })
    : [...endpoints, entry];
};

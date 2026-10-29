import type { MapType } from '@ttoss/geovis';

import { INSTRUCTIONS } from './instructions/instructions';

/**
 * Builds a message for the Naturali session: with `catalogueText`, the one a
 * new session opens with (catalogue, generation instructions, the user's
 * choices and the prompt); without it, the follow-up for a session that
 * already holds the catalogue and instructions (choices and prompt only).
 *
 * @param params.catalogueText - Output of `buildCatalogueContext`. Omit for a follow-up.
 * @param params.prompt - The user's request.
 * @param params.mapType - The map type the user chose, if any.
 * @param params.datasetId - The dataset the user chose, if any.
 * @returns The message, sections separated by blank lines.
 *
 * @example
 * buildAgentMessage({ catalogueText: '[]', prompt: 'mapa de cozinhas', mapType: 'dotDensity' });
 */
export const buildAgentMessage = (params: {
  catalogueText?: string;
  prompt: string;
  mapType?: MapType;
  datasetId?: string;
}): string => {
  return [
    ...(params.catalogueText === undefined
      ? []
      : [
          'O catalogo json schema do projeto Cozinha Solidária em Rede contém todos os datasets conhecidos e o detalhe completo apenas dos datasets que podem popular `mapData` hoje. Use-o para gerar um spec de visualização geográfica (um mapa) que atenda ao pedido do usuário.',
          `Catálogo de datasets:\n${params.catalogueText}`,
          INSTRUCTIONS,
        ]),
    ...(params.mapType
      ? [
          `Tipo de mapa escolhido pelo usuário (mapType): "${params.mapType}". Use exatamente este mapType no spec.`,
        ]
      : []),
    ...(params.datasetId
      ? [
          `Dataset escolhido pelo usuário (mapDataId): "${params.datasetId}". Use exatamente este dataset no mapData.`,
        ]
      : []),
    params.prompt,
  ].join('\n\n');
};

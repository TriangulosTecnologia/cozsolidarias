import type { StaticCozinhaSource } from '../../data-source-static/types';
import type {
  CozinhaSituacao,
  CozinhasStatusFeatureCollection,
} from '../schema';
import { COZINHA_SITUACOES } from '../schema';

/**
 * Narrows a source `Situação` value to a canonical {@link CozinhaSituacao}.
 * Only the statuses in {@link COZINHA_SITUACOES} pass; any other value
 * (Mapeada, Retirada, Em análise, workflow states, empty) returns `null`,
 * which drops the record from the status map.
 *
 * @param situacao raw `Situação` value from the source record.
 * @returns the canonical status, or `null` when the record must be dropped.
 *
 * @example
 * toCozinhaSituacao('Habilitada'); // → 'Habilitada'
 * toCozinhaSituacao('Mapeada'); // → null
 */
export const toCozinhaSituacao = (situacao: string): CozinhaSituacao | null => {
  const match = COZINHA_SITUACOES.find((canonical) => {
    return canonical === situacao;
  });
  return match ?? null;
};

/**
 * Transforms source-native cozinha records into the canonical GeoJSON
 * `FeatureCollection` for the status-colored points map.
 *
 * Two filters apply:
 * - records without coordinates (`latitude`/`longitude` are `null` in the
 *   source) are dropped — same rule as `toCozinhasFeatureCollection`;
 * - records whose status is outside {@link COZINHA_SITUACOES} are dropped —
 *   the status map shows only those situations.
 *
 * Coordinates are emitted in GeoJSON order: `[longitude, latitude]`.
 *
 * @param sources - Raw records from data-source-static.
 * @returns Canonical {@link CozinhasStatusFeatureCollection}.
 *
 * @example
 * toCozinhasStatusFeatureCollection([
 *   { codigo: 'CS1', nome: 'Cozinha A', situacao: 'Habilitada', latitude: -23, longitude: -46.6, ... },
 * ]);
 * // features[0].properties → { codigo: 'CS1', nome: 'Cozinha A', situacao: 'Habilitada' }
 */
export const toCozinhasStatusFeatureCollection = (
  sources: StaticCozinhaSource[]
): CozinhasStatusFeatureCollection => {
  const features = sources.flatMap((source) => {
    if (source.latitude === null || source.longitude === null) {
      return [];
    }
    const situacao = toCozinhaSituacao(source.situacao);
    if (situacao === null) {
      return [];
    }
    return [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [source.longitude, source.latitude] as [number, number],
        },
        properties: {
          codigo: source.codigo,
          nome: source.nome,
          situacao,
        },
      },
    ];
  });

  return {
    type: 'FeatureCollection',
    features,
  };
};

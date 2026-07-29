import type { StaticCafProducaoSource } from '../../data-source-static/types';
import type { CafDetalhe } from '../schema';

/**
 * Projects filtered source-native CAF production records into the canonical
 * {@link CafDetalhe} contract.
 *
 * @param nrCaf - CAF registration number to associate with the result.
 * @param sources - All production records for that CAF (pre-filtered by the caller).
 * @returns The canonical detail with one entry per production item.
 *
 * @example
 * toCafDetalhe({
 *   nrCaf: '6',
 *   sources: [{ nrCaf: '6', categoriaRenda: 'RENDA DO ESTABELECIMENTO AGROPECUÁRIO', dsTipoRenda: 'Lavouras Permanentes', dsProduto: 'Outras Frutas Lavoura Permanente', vlRendaAuferida: 5500, vlRendaEstimada: 5500 }],
 * });
 * // { nrCaf: '6', producao: [{ categoriaRenda: 'RENDA DO ESTABELECIMENTO AGROPECUÁRIO', ... }] }
 */
export const toCafDetalhe = ({
  nrCaf,
  sources,
}: {
  nrCaf: string;
  sources: StaticCafProducaoSource[];
}): CafDetalhe => {
  return {
    nrCaf,
    producao: sources.map((s) => {
      return {
        categoriaRenda: s.categoriaRenda,
        dsTipoRenda: s.dsTipoRenda,
        dsProduto: s.dsProduto,
        vlRendaAuferida: s.vlRendaAuferida,
        vlRendaEstimada: s.vlRendaEstimada,
      };
    }),
  };
};

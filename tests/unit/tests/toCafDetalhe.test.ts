import { toCafDetalhe } from 'src/data-gateway/transformers/toCafDetalhe';
import type { StaticCafProducaoSource } from 'src/data-source-static/types';

const source = (
  overrides: Partial<StaticCafProducaoSource> = {}
): StaticCafProducaoSource => {
  return {
    nrCaf: '6',
    categoriaRenda: 'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
    dsTipoRenda: 'Lavouras Permanentes',
    dsProduto: 'Outras Frutas Lavoura Permanente',
    vlRendaAuferida: 5500,
    vlRendaEstimada: 5500,
    ...overrides,
  };
};

describe('toCafDetalhe', () => {
  test('projects source records into the canonical producao items', () => {
    const result = toCafDetalhe({
      nrCaf: '6',
      sources: [
        source({
          dsProduto: 'Manga',
          vlRendaAuferida: 1000,
          vlRendaEstimada: 1200,
        }),
      ],
    });

    expect(result.nrCaf).toBe('6');
    expect(result.producao).toHaveLength(1);
    expect(result.producao[0]).toMatchObject({
      categoriaRenda: 'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
      dsTipoRenda: 'Lavouras Permanentes',
      dsProduto: 'Manga',
      vlRendaAuferida: 1000,
      vlRendaEstimada: 1200,
    });
  });

  test('maps multiple source records to multiple producao items', () => {
    const result = toCafDetalhe({
      nrCaf: '6',
      sources: [source({ dsProduto: 'A' }), source({ dsProduto: 'B' })],
    });

    expect(result.producao).toHaveLength(2);
    expect(result.producao[0].dsProduto).toBe('A');
    expect(result.producao[1].dsProduto).toBe('B');
  });

  test('preserves null income values', () => {
    const result = toCafDetalhe({
      nrCaf: '8',
      sources: [source({ vlRendaAuferida: null, vlRendaEstimada: null })],
    });

    expect(result.producao[0].vlRendaAuferida).toBeNull();
    expect(result.producao[0].vlRendaEstimada).toBeNull();
  });

  test('returns empty producao array when given no sources', () => {
    const result = toCafDetalhe({ nrCaf: '99', sources: [] });
    expect(result.producao).toHaveLength(0);
  });
});

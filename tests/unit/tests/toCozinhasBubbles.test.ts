import { toCozinhasBubbles } from 'src/data-gateway/transformers/toCozinhasBubbles';
import type { MunicipioAggregate } from 'src/data-gateway/transformers/toCozinhasPorMunicipio';

/** Builds a per-município aggregate; only the fields under test need overriding. */
const aggregate = (
  overrides: Partial<MunicipioAggregate> = {}
): MunicipioAggregate => {
  return {
    codigoIbge: '3550308',
    municipio: 'São Paulo',
    quantidade: 1,
    centroid: [-46.6, -23.5],
    ...overrides,
  };
};

describe('toCozinhasBubbles', () => {
  test('maps an aggregate to a Point feature anchored at its centroid', () => {
    const result = toCozinhasBubbles([
      aggregate({
        codigoIbge: '3550308',
        municipio: 'São Paulo',
        quantidade: 5,
        centroid: [-46.6, -23.5],
      }),
    ]);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
      properties: {
        codarea: '3550308',
        municipio: 'São Paulo',
        quantidade: 5,
      },
    });
  });

  test('emits one feature per município, preserving order', () => {
    const result = toCozinhasBubbles([
      aggregate({ codigoIbge: '3550308', quantidade: 5 }),
      aggregate({ codigoIbge: '3304557', quantidade: 2 }),
    ]);

    expect(result.features).toHaveLength(2);
    expect(
      result.features.map((feature) => {
        return feature.properties.codarea;
      })
    ).toEqual(['3550308', '3304557']);
  });

  test('returns an empty FeatureCollection for empty input', () => {
    expect(toCozinhasBubbles([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});

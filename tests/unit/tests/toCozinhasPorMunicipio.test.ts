import type { GeoJSONFeature, GeoJSONFeatureCollection } from '@ttoss/geovis';
import type { MunicipioAggregate } from 'src/data-gateway/transformers/toCozinhasPorMunicipio';
import {
  cozinhasPercentualDoBrasil,
  cozinhasPorCemMil,
  projectComTaxa,
  toCozinhasPorMunicipio,
} from 'src/data-gateway/transformers/toCozinhasPorMunicipio';
import type { StaticCozinhaSource } from 'src/data-source-static/types';

/** A kitchen record reduced to the fields the transformer reads. */
const coz = (
  longitude: number | null,
  latitude: number | null,
  municipio = 'Municipality'
): StaticCozinhaSource => {
  return { longitude, latitude, municipio } as StaticCozinhaSource;
};

/** A square Polygon municipality feature `[minLng, minLat]` of the given size. */
const square = (
  codarea: string,
  minLng: number,
  minLat: number,
  size: number
): GeoJSONFeature => {
  return {
    type: 'Feature',
    properties: { codarea },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLng, minLat],
          [minLng + size, minLat],
          [minLng + size, minLat + size],
          [minLng, minLat + size],
          [minLng, minLat],
        ],
      ],
    },
  };
};

const collection = (features: GeoJSONFeature[]): GeoJSONFeatureCollection => {
  return { type: 'FeatureCollection', features };
};

describe('toCozinhasPorMunicipio', () => {
  test('counts a kitchen that falls inside a municipality polygon', () => {
    const municipios = collection([square('111', 0, 0, 10)]);

    const result = toCozinhasPorMunicipio([coz(5, 5, 'Alpha')], municipios);

    expect(result).toEqual([
      { codigoIbge: '111', municipio: 'Alpha', quantidade: 1 },
    ]);
  });

  test('assigns each kitchen to the correct polygon among several', () => {
    const municipios = collection([
      square('111', 0, 0, 10),
      square('222', 20, 20, 10),
    ]);

    const result = toCozinhasPorMunicipio(
      [coz(5, 5, 'Alpha'), coz(25, 25, 'Beta')],
      municipios
    );

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidade: 1,
    });
    expect(result).toContainEqual({
      codigoIbge: '222',
      municipio: 'Beta',
      quantidade: 1,
    });
  });

  test('drops kitchens that fall outside every polygon', () => {
    const municipios = collection([square('111', 0, 0, 10)]);

    const result = toCozinhasPorMunicipio(
      [coz(5, 5, 'Alpha'), coz(100, 100, 'Far away')],
      municipios
    );

    expect(result).toEqual([
      { codigoIbge: '111', municipio: 'Alpha', quantidade: 1 },
    ]);
  });

  test('drops kitchens without coordinates', () => {
    const municipios = collection([square('111', 0, 0, 10)]);

    const result = toCozinhasPorMunicipio(
      [coz(null, null, 'No coords'), coz(5, 5, 'Alpha')],
      municipios
    );

    expect(result).toEqual([
      { codigoIbge: '111', municipio: 'Alpha', quantidade: 1 },
    ]);
  });

  test('picks the most frequent municipality name for a polygon', () => {
    const municipios = collection([square('111', 0, 0, 10)]);

    const result = toCozinhasPorMunicipio(
      [coz(2, 2, 'São Paulo'), coz(3, 3, 'Sao Paulo'), coz(4, 4, 'São Paulo')],
      municipios
    );

    expect(result).toEqual([
      { codigoIbge: '111', municipio: 'São Paulo', quantidade: 3 },
    ]);
  });

  test('never picks an empty name even when it is the most frequent', () => {
    const municipios = collection([square('111', 0, 0, 10)]);

    const result = toCozinhasPorMunicipio(
      [coz(2, 2, ''), coz(3, 3, ''), coz(4, 4, 'Valid record')],
      municipios
    );

    expect(result).toEqual([
      { codigoIbge: '111', municipio: 'Valid record', quantidade: 3 },
    ]);
  });

  test('matches points inside a MultiPolygon geometry', () => {
    const multi: GeoJSONFeature = {
      type: 'Feature',
      properties: { codarea: '333' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
          [
            [
              [20, 20],
              [30, 20],
              [30, 30],
              [20, 30],
              [20, 20],
            ],
          ],
        ],
      },
    };

    const result = toCozinhasPorMunicipio(
      [coz(25, 25, 'Island')],
      collection([multi])
    );

    expect(result).toEqual([
      { codigoIbge: '333', municipio: 'Island', quantidade: 1 },
    ]);
  });

  test('does not count points that fall inside a polygon hole', () => {
    const withHole: GeoJSONFeature = {
      type: 'Feature',
      properties: { codarea: '444' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
          ],
        ],
      },
    };

    const result = toCozinhasPorMunicipio(
      [coz(5, 5, 'In the hole'), coz(1, 1, 'On the solid edge')],
      collection([withHole])
    );

    expect(result).toEqual([
      { codigoIbge: '444', municipio: 'On the solid edge', quantidade: 1 },
    ]);
  });

  test('ignores features without a polygon geometry or without codarea', () => {
    const pointFeature: GeoJSONFeature = {
      type: 'Feature',
      properties: { codarea: '555' },
      geometry: { type: 'Point', coordinates: [5, 5] },
    };
    const noCodarea: GeoJSONFeature = {
      type: 'Feature',
      properties: {},
      geometry: square('999', 0, 0, 10).geometry,
    };
    const nullGeometry: GeoJSONFeature = {
      type: 'Feature',
      properties: { codarea: '777' },
      geometry: null,
    };

    const result = toCozinhasPorMunicipio(
      [coz(5, 5, 'Any')],
      collection([pointFeature, noCodarea, nullGeometry])
    );

    expect(result).toEqual([]);
  });
});

describe('cozinhasPorCemMil', () => {
  test('computes (quantidade / populacao) * 100000', () => {
    expect(cozinhasPorCemMil({ quantidade: 10, populacao: 250_000 })).toBe(4);
  });

  test('rounds to two decimals', () => {
    expect(cozinhasPorCemMil({ quantidade: 1, populacao: 30_000 })).toBe(3.33);
  });

  test('returns null when the population is unknown', () => {
    expect(cozinhasPorCemMil({ quantidade: 3, populacao: null })).toBeNull();
    expect(
      cozinhasPorCemMil({ quantidade: 3, populacao: undefined })
    ).toBeNull();
  });

  test('returns null for a non-positive population (no valid denominator)', () => {
    expect(cozinhasPorCemMil({ quantidade: 3, populacao: 0 })).toBeNull();
  });
});

describe('cozinhasPercentualDoBrasil', () => {
  test('computes (quantidade / total) * 100', () => {
    expect(cozinhasPercentualDoBrasil({ quantidade: 5, total: 5000 })).toBe(
      0.1
    );
  });

  test('rounds to two decimals', () => {
    expect(cozinhasPercentualDoBrasil({ quantidade: 1, total: 7 })).toBe(14.29);
  });

  test('returns 0 for a non-positive total (no cozinhas to take a share of)', () => {
    expect(cozinhasPercentualDoBrasil({ quantidade: 0, total: 0 })).toBe(0);
  });
});

describe('projectComTaxa', () => {
  const aggregate: MunicipioAggregate[] = [
    {
      codigoIbge: '111',
      municipio: 'Alpha',
      quantidade: 5,
      centroid: [0, 0],
    },
    {
      codigoIbge: '222',
      municipio: 'Beta',
      quantidade: 2,
      centroid: [1, 1],
    },
  ];

  test('joins population by IBGE code and derives the rate and national share', () => {
    const result = projectComTaxa({
      aggregate,
      populacao: { '111': 100_000 },
    });

    // total = 5 + 2 = 7, so shares are 5/7 and 2/7 (rounded to two decimals).
    expect(result).toEqual([
      {
        codigoIbge: '111',
        municipio: 'Alpha',
        quantidade: 5,
        populacao: 100_000,
        porCemMil: 5,
        percentualDoBrasil: 71.43,
      },
      // Beta has no population entry: population and rate fall back to null, but
      // its national share is still derived from the aggregate total.
      {
        codigoIbge: '222',
        municipio: 'Beta',
        quantidade: 2,
        populacao: null,
        porCemMil: null,
        percentualDoBrasil: 28.57,
      },
    ]);
  });
});

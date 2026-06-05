import type { GeoJSONFeature, GeoJSONFeatureCollection } from '@ttoss/geovis';
import { toCozinhasPorMunicipio } from 'src/data-gateway/transformers/toCozinhasPorMunicipio';
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

import type {
  GeoJSONFeature,
  GeoJSONGeometry,
  GeoJSONPosition,
} from '@ttoss/geovis';
import {
  findMunicipio,
  indexMunicipios,
} from 'src/data-gateway/transformers/municipioIndex';

const SQUARE: GeoJSONPosition[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];

const feature = ({
  codarea,
  geometry,
}: {
  codarea?: string;
  geometry: GeoJSONGeometry | null;
}): GeoJSONFeature => {
  return {
    type: 'Feature',
    properties: codarea === undefined ? {} : { codarea },
    geometry,
  };
};

const indexOf = (features: GeoJSONFeature[]) => {
  return indexMunicipios({ type: 'FeatureCollection', features });
};

describe('indexMunicipios', () => {
  test('keeps polygonal features with a codarea, paired with their bbox', () => {
    const index = indexOf([
      feature({
        codarea: '111',
        geometry: { type: 'Polygon', coordinates: [SQUARE] },
      }),
      feature({
        codarea: '333',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [SQUARE],
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
      }),
    ]);

    expect(
      index.map(({ codigoIbge, bbox }) => {
        return { codigoIbge, bbox };
      })
    ).toEqual([
      { codigoIbge: '111', bbox: [0, 0, 10, 10] },
      { codigoIbge: '333', bbox: [0, 0, 30, 30] },
    ]);
  });

  test('skips features without a codarea, without geometry or with a non-polygon geometry', () => {
    const index = indexOf([
      feature({ geometry: { type: 'Polygon', coordinates: [SQUARE] } }),
      feature({ codarea: '777', geometry: null }),
      feature({
        codarea: '555',
        geometry: { type: 'Point', coordinates: [5, 5] },
      }),
    ]);

    expect(index).toEqual([]);
  });
});

describe('findMunicipio', () => {
  const index = indexOf([
    feature({
      codarea: '111',
      geometry: {
        type: 'Polygon',
        coordinates: [
          SQUARE,
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
          ],
        ],
      },
    }),
    feature({
      codarea: '333',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [20, 20],
              [30, 20],
              [30, 30],
              [20, 30],
              [20, 20],
            ],
          ],
          [
            [
              [40, 40],
              [50, 40],
              [50, 50],
              [40, 50],
              [40, 40],
            ],
          ],
        ],
      },
    }),
    feature({
      codarea: '444',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [60, 60],
            [70, 60],
            [60, 70],
            [60, 60],
          ],
        ],
      },
    }),
  ]);

  test('returns the município whose polygon contains the point', () => {
    expect(findMunicipio({ index, point: [1, 1] })?.codigoIbge).toBe('111');
  });

  test('does not match a point inside a polygon hole', () => {
    expect(findMunicipio({ index, point: [5, 5] })).toBeUndefined();
  });

  test('matches a point inside any part of a MultiPolygon', () => {
    expect(findMunicipio({ index, point: [45, 45] })?.codigoIbge).toBe('333');
  });

  test('does not match a point inside the bbox but outside the polygon', () => {
    expect(findMunicipio({ index, point: [69, 69] })).toBeUndefined();
  });

  test('does not match a point outside every bbox', () => {
    expect(findMunicipio({ index, point: [100, 100] })).toBeUndefined();
  });
});

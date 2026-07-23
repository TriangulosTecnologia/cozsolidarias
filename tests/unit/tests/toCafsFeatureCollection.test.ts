import { toCafsFeatureCollection } from 'src/data-gateway/transformers/toCafsFeatureCollection';
import type { StaticCafAreaSource } from 'src/data-source-static/types';

/** Builds a full source record; only the fields under test need overriding. */
const source = (
  overrides: Partial<StaticCafAreaSource> = {}
): StaticCafAreaSource => {
  return {
    nrCaf: '6',
    dsTipoArea: 'Terra',
    dsTipoUnidadeMedida: 'ha',
    nrArea: 2.2,
    cdMunicipio: '5300108',
    sgUf: 'DF',
    nmMunicipio: 'Brasília',
    dsTipoLocalizacaoArea: 'Rural',
    dsCondicaoDominio: 'Proprietário',
    stImovelPrincipal: 'true',
    latitude: null,
    longitude: null,
    ...overrides,
  };
};

describe('toCafsFeatureCollection', () => {
  test('maps a record with coordinates to a Point feature in [lng, lat] order', () => {
    const result = toCafsFeatureCollection([
      source({ nrCaf: '6', latitude: -15.77, longitude: -48.18 }),
    ]);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-48.18, -15.77] },
      properties: {
        nrCaf: '6',
        dsTipoArea: 'Terra',
        dsTipoUnidadeMedida: 'ha',
        nrArea: 2.2,
        nmMunicipio: 'Brasília',
        sgUf: 'DF',
        dsTipoLocalizacaoArea: 'Rural',
        dsCondicaoDominio: 'Proprietário',
        stImovelPrincipal: 'true',
      },
    });
  });

  test('drops records missing latitude', () => {
    const result = toCafsFeatureCollection([
      source({ latitude: null, longitude: -48.18 }),
    ]);

    expect(result.features).toHaveLength(0);
  });

  test('drops records missing longitude', () => {
    const result = toCafsFeatureCollection([
      source({ latitude: -15.77, longitude: null }),
    ]);

    expect(result.features).toHaveLength(0);
  });

  test('drops records missing nrArea', () => {
    const result = toCafsFeatureCollection([
      source({ latitude: -15.77, longitude: -48.18, nrArea: null }),
    ]);

    expect(result.features).toHaveLength(0);
  });

  test('keeps only the records that have both coordinates and area', () => {
    const result = toCafsFeatureCollection([
      source({ latitude: -15.77, longitude: -48.18, nrArea: 2.2 }),
      source({ latitude: null, longitude: null }),
      source({ latitude: -22.9, longitude: -43.2, nrArea: 5.0 }),
    ]);

    expect(result.features).toHaveLength(2);
  });

  test('returns an empty FeatureCollection for empty input', () => {
    expect(toCafsFeatureCollection([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});

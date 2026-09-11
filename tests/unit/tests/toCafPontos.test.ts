import type { cafByCity } from 'src/data-gateway/schema';
import { toCafUfPontos } from 'src/data-gateway/transformers/toCafPontos';
import type { StaticCafPontosSource } from 'src/data-source-static/types';

const ANCHORS: StaticCafPontosSource = {
  ufs: [
    {
      codigoUf: '29',
      uf: 'BA',
      nome: 'Bahia',
      longitude: -40.76,
      latitude: -12.34,
    },
    {
      codigoUf: '28',
      uf: 'SE',
      nome: 'Sergipe',
      longitude: -37.4,
      latitude: -10.6,
    },
  ],
};

const row = (codigoIbge: string, quantidade: number): cafByCity => {
  return {
    codigoIbge,
    municipio: `Município ${codigoIbge}`,
    quantidade,
    percentualDoBrasil: 0,
  };
};

const POR_MUNICIPIO = [
  row('2910800', 8_412),
  row('2927408', 1_200),
  row('2800308', 640),
];

describe('toCafUfPontos', () => {
  test('totals each UF from the municípios its código prefixes', () => {
    expect(
      toCafUfPontos({ anchors: ANCHORS, porMunicipio: POR_MUNICIPIO })
    ).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-40.76, -12.34] },
          properties: { nome: 'Bahia', quantidade: 9_612 },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-37.4, -10.6] },
          properties: { nome: 'Sergipe', quantidade: 640 },
        },
      ],
    });
  });

  /*
   * Grouping by the código rather than by a UF field is what lets the six
   * municípios created after the 2010 geometry vintage count: they have no
   * polygon, so they never pulled an anchor's position, but their CAFs are as
   * real as any other's.
   */
  test('counts a município that has no anchor geometry', () => {
    const features = toCafUfPontos({
      anchors: ANCHORS,
      porMunicipio: [...POR_MUNICIPIO, row('2934908', 500)],
    }).features;

    expect(features[0]?.properties.quantidade).toBe(10_112);
  });

  test('reports zero for a UF with no counted municípios', () => {
    expect(
      toCafUfPontos({
        anchors: ANCHORS,
        porMunicipio: [row('2800308', 640)],
      }).features[0]
    ).toMatchObject({ properties: { nome: 'Bahia', quantidade: 0 } });
  });

  test('returns an empty collection when there are no anchors', () => {
    expect(
      toCafUfPontos({ anchors: { ufs: [] }, porMunicipio: POR_MUNICIPIO })
    ).toEqual({ type: 'FeatureCollection', features: [] });
  });
});

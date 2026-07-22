import { toCozinhasFeatureCollection } from 'src/data-gateway/transformers/toCozinhasFeatureCollection';
import type { StaticCozinhaSource } from 'src/data-source-static/types';

/** Builds a full source record; only the fields under test need overriding. */
const source = (
  overrides: Partial<StaticCozinhaSource> = {}
): StaticCozinhaSource => {
  return {
    codigo: '',
    nome: '',
    endereco: '',
    bairro: '',
    cep: '',
    municipio: '',
    uf: '',
    email: '',
    telefone: '',
    cnpj: '',
    emFuncionamento: '',
    diasFuncionamento: '',
    situacao: '',
    dataEnvioAnalise: '',
    reanalise: '',
    avaliador: '',
    dataAvaliacao: '',
    homologador: '',
    dataHomologacao: '',
    publicoAtendido: '',
    publicoTotalAtendido: '',
    dadosAtualizados: '',
    dataUltimaAtualizacao: '',
    atualizacaoGeoFotos: '',
    linkGeolocalizacao: '',
    latitude: null,
    longitude: null,
    statusFotoGeo: '',
    enderecoCompleto: '',
    ...overrides,
  };
};

describe('toCozinhasFeatureCollection', () => {
  test('maps a record with coordinates to a Point feature in [lng, lat] order', () => {
    const result = toCozinhasFeatureCollection([
      source({ codigo: 'CS016282', latitude: -23.5, longitude: -46.6 }),
    ]);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
      properties: { codigo: 'CS016282' },
    });
  });

  test('drops records missing latitude', () => {
    const result = toCozinhasFeatureCollection([
      source({ latitude: null, longitude: -46.6 }),
    ]);

    expect(result.features).toHaveLength(0);
  });

  test('drops records missing longitude', () => {
    const result = toCozinhasFeatureCollection([
      source({ latitude: -23.5, longitude: null }),
    ]);

    expect(result.features).toHaveLength(0);
  });

  test('keeps only the records that have both coordinates', () => {
    const result = toCozinhasFeatureCollection([
      source({ latitude: -23.5, longitude: -46.6 }),
      source({ latitude: null, longitude: null }),
      source({ latitude: -22.9, longitude: -43.2 }),
    ]);

    expect(result.features).toHaveLength(2);
  });

  test('returns an empty FeatureCollection for empty input', () => {
    expect(toCozinhasFeatureCollection([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});

import {
  toCozinhaSituacao,
  toCozinhasStatusFeatureCollection,
} from 'src/data-gateway/transformers/toCozinhasStatusFeatureCollection';
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

describe('toCozinhaSituacao', () => {
  test('passes canonical statuses through verbatim', () => {
    expect(toCozinhaSituacao('Habilitada')).toBe('Habilitada');
    expect(toCozinhaSituacao('Não Habilitada')).toBe('Não Habilitada');
    expect(toCozinhaSituacao('Mapeada')).toBe('Mapeada');
    expect(toCozinhaSituacao('Retirada')).toBe('Retirada');
    expect(toCozinhaSituacao('Em análise')).toBe('Em análise');
    expect(toCozinhaSituacao('Homologada para Habilitação')).toBe(
      'Homologada para Habilitação'
    );
    expect(
      toCozinhaSituacao(
        'Pendência emitida pelo MDS (Prazo para adequações 15 dias)'
      )
    ).toBe('Pendência emitida pelo MDS (Prazo para adequações 15 dias)');
    expect(toCozinhaSituacao('Enviada para análise')).toBe(
      'Enviada para análise'
    );
    expect(toCozinhaSituacao('Homologada para Retirada')).toBe(
      'Homologada para Retirada'
    );
  });

  test('returns null for unknown statuses and empty string', () => {
    expect(toCozinhaSituacao('Status Inexistente')).toBeNull();
    expect(toCozinhaSituacao('')).toBeNull();
  });
});

describe('toCozinhasStatusFeatureCollection', () => {
  test('maps a canonical-status record to a Point feature with codigo/nome/situacao', () => {
    const result = toCozinhasStatusFeatureCollection([
      source({
        codigo: 'CS1',
        nome: 'Cozinha A',
        situacao: 'Habilitada',
        latitude: -23.5,
        longitude: -46.6,
      }),
    ]);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
        properties: {
          codigo: 'CS1',
          nome: 'Cozinha A',
          situacao: 'Habilitada',
        },
      },
    ]);
  });

  test('drops records missing coordinates', () => {
    const result = toCozinhasStatusFeatureCollection([
      source({ situacao: 'Habilitada', latitude: null, longitude: -46.6 }),
      source({ situacao: 'Habilitada', latitude: -23.5, longitude: null }),
    ]);

    expect(result.features).toHaveLength(0);
  });

  test('drops records whose status is outside the canonical set', () => {
    const result = toCozinhasStatusFeatureCollection([
      source({
        codigo: 'CS1',
        situacao: 'Habilitada',
        latitude: -23.5,
        longitude: -46.6,
      }),
      source({
        codigo: 'CS2',
        situacao: 'Não Habilitada',
        latitude: -23.5,
        longitude: -46.6,
      }),
      source({
        codigo: 'CS3',
        situacao: 'Mapeada',
        latitude: -23.5,
        longitude: -46.6,
      }),
      source({
        situacao: 'Status Inexistente',
        latitude: -23.5,
        longitude: -46.6,
      }),
      source({ situacao: '', latitude: -23.5, longitude: -46.6 }),
    ]);

    expect(result.features).toHaveLength(3);
    expect(
      result.features.map((f) => {
        return f.properties.codigo;
      })
    ).toEqual(['CS1', 'CS2', 'CS3']);
  });
});

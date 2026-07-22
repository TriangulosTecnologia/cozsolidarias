import { toCozinhaDetalhe } from 'src/data-gateway/transformers/toCozinhaDetalhe';
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

describe('toCozinhaDetalhe', () => {
  test('projects the descriptive fields into the canonical detail', () => {
    const result = toCozinhaDetalhe(
      source({
        codigo: 'CS016282',
        nome: 'Cozinha Exemplo',
        municipio: 'Rio de Janeiro',
        uf: 'RJ',
        situacao: 'Habilitada',
        publicoTotalAtendido: '190',
        latitude: -23.0,
        longitude: -43.3,
      })
    );

    expect(result).toMatchObject({
      codigo: 'CS016282',
      nome: 'Cozinha Exemplo',
      municipio: 'Rio de Janeiro',
      uf: 'RJ',
      situacao: 'Habilitada',
      publicoTotalAtendido: '190',
      latitude: -23.0,
      longitude: -43.3,
    });
  });

  test('excludes the source contact/PII columns from the contract', () => {
    const result = toCozinhaDetalhe(
      source({ email: 'a@b.c', telefone: '(11) 90000-0000', cnpj: '00.000' })
    );

    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('telefone');
    expect(result).not.toHaveProperty('cnpj');
  });

  test('excludes the internal review-workflow columns from the contract', () => {
    const result = toCozinhaDetalhe(
      source({ avaliador: 'John Doe', homologador: 'Jane Doe' })
    );

    expect(result).not.toHaveProperty('avaliador');
    expect(result).not.toHaveProperty('homologador');
    expect(result).not.toHaveProperty('dataHomologacao');
  });

  test('preserves null coordinates', () => {
    const result = toCozinhaDetalhe(
      source({ latitude: null, longitude: null })
    );

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });
});

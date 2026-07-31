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
    codigoIbge: '',
    uf: '',
    email: '',
    cnpj: '',
    emFuncionamento: '',
    diasFuncionamento: '',
    situacao: '',
    publicoAtendido: '',
    publicoTotalAtendido: '',
    refeicoesPorDia: '',
    latitude: null,
    longitude: null,
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
    const result = toCozinhaDetalhe(source({ email: 'a@b.c', cnpj: '00.000' }));

    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('cnpj');
  });

  test('excludes the source administrative columns from the contract', () => {
    const result = toCozinhaDetalhe(
      source({ codigoIbge: '3550308', refeicoesPorDia: '120' })
    );

    expect(result).not.toHaveProperty('codigoIbge');
    expect(result).not.toHaveProperty('refeicoesPorDia');
  });

  test('preserves null coordinates', () => {
    const result = toCozinhaDetalhe(
      source({ latitude: null, longitude: null })
    );

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });
});

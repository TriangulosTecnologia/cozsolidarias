import {
  parseCafsCsv,
  readStaticCafs,
} from 'src/data-source-static/readStaticCafs';

/** Column headers exactly as the CAF CSV uses them. */
const HEADERS = [
  'nr_caf',
  'ds_tipo_area',
  'ds_tipo_unidade_medida',
  'nr_area',
  'cd_municipio',
  'sg_uf',
  'nm_municipio',
  'ds_tipo_localizacao_area',
  'ds_condicao_dominio',
  'st_imovel_principal',
  'nr_latitude',
  'nr_longitude',
];

/** Builds a header row string with semicolon delimiter. */
const headerRow = HEADERS.join(';');

/** Builds a data row with semicolons. Values that need quoting are wrapped. */
const dataRow = (values: string[]): string => {
  return values.join(';');
};

describe('parseCafsCsv', () => {
  test('parses a minimal valid CSV into typed records', () => {
    const csv = [
      headerRow,
      dataRow([
        '6',
        'Terra',
        'ha',
        '2.20',
        '"5300108"',
        'DF',
        'Brasília',
        'Rural',
        'Proprietário',
        'true',
        '-15.771184',
        '-48.180337',
      ]),
    ].join('\n');

    const result = parseCafsCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
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
      latitude: -15.771184,
      longitude: -48.180337,
    });
  });

  test('coerces missing numeric fields to null', () => {
    const csv = [
      headerRow,
      dataRow([
        '8',
        'Terra',
        'ha',
        '',
        '5300108',
        'DF',
        'Brasília',
        'Rural',
        'Comodatário',
        'false',
        '',
        '',
      ]),
    ].join('\n');

    const result = parseCafsCsv(csv);

    expect(result[0].nrArea).toBeNull();
    expect(result[0].latitude).toBeNull();
    expect(result[0].longitude).toBeNull();
  });

  test('strips a leading UTF-8 BOM', () => {
    const csv =
      '﻿' +
      headerRow +
      '\n' +
      dataRow([
        '9',
        'Terra',
        'ha',
        '1.0',
        '1',
        'SP',
        'São Paulo',
        'Rural',
        'Posseiro',
        'false',
        '-23.5',
        '-46.6',
      ]);
    const result = parseCafsCsv(csv);
    expect(result).toHaveLength(1);
  });

  test('drops fully empty trailing lines', () => {
    const csv =
      headerRow +
      '\n' +
      dataRow([
        '10',
        'Terra',
        'ha',
        '0.5',
        '1',
        'SP',
        'São Paulo',
        'Rural',
        'Posseiro',
        'false',
        '-23.5',
        '-46.6',
      ]) +
      '\n\n';
    const result = parseCafsCsv(csv);
    expect(result).toHaveLength(1);
  });

  test('throws on empty CSV', () => {
    expect(() => {
      return parseCafsCsv('');
    }).toThrow('empty');
  });

  test('throws when column count mismatches', () => {
    expect(() => {
      return parseCafsCsv('nr_caf;ds_tipo_area');
    }).toThrow('columns');
  });

  test('throws when a header name mismatches', () => {
    const wrongHeaders = [...HEADERS];
    wrongHeaders[0] = 'caf_id';
    expect(() => {
      return parseCafsCsv(wrongHeaders.join(';'));
    }).toThrow('mismatch');
  });

  test('parses quoted fields with embedded delimiters and escaped quotes', () => {
    const csv = [
      headerRow,
      dataRow([
        '6',
        'Terra',
        'ha',
        '2.20',
        '5300108',
        'DF',
        '"Foo ""Bar""; Baz"',
        'Rural',
        'Proprietário',
        'true',
        '-15.7',
        '-48.1',
      ]),
    ].join('\n');

    const result = parseCafsCsv(csv);

    // Embedded escaped `""` collapses to `"` and the quoted `;` stays literal.
    expect(result[0].nmMunicipio).toBe('Foo "Bar"; Baz');
  });
});

describe('readStaticCafs', () => {
  test('reads and memoizes the static CSV snapshot from disk', async () => {
    const first = await readStaticCafs();

    expect(first.length).toBeGreaterThan(0);
    expect(first[0]).toHaveProperty('nrCaf');

    // Second call returns the same cached reference (no re-read).
    const second = await readStaticCafs();
    expect(second).toBe(first);
  });
});

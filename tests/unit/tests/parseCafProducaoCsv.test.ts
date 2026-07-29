import {
  parseCafProducaoCsv,
  readStaticCafProducao,
} from 'src/data-source-static/readStaticCafProducao';

const HEADERS = [
  'nr_caf',
  'categoria_renda',
  'ds_tipo_renda',
  'ds_produto',
  'vl_renda_auferida',
  'vl_renda_estimada',
];

const headerRow = HEADERS.join(';');

const dataRow = (values: string[]): string => {
  return values.join(';');
};

describe('parseCafProducaoCsv', () => {
  test('parses a minimal valid CSV into typed records', () => {
    const csv = [
      headerRow,
      dataRow([
        '6',
        'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
        'Lavouras Permanentes',
        'Outras Frutas Lavoura Permanente',
        '5500.00',
        '5500.00',
      ]),
    ].join('\n');

    const result = parseCafProducaoCsv(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      nrCaf: '6',
      categoriaRenda: 'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
      dsTipoRenda: 'Lavouras Permanentes',
      dsProduto: 'Outras Frutas Lavoura Permanente',
      vlRendaAuferida: 5500,
      vlRendaEstimada: 5500,
    });
  });

  test('parses multiple rows for the same nrCaf', () => {
    const csv = [
      headerRow,
      dataRow([
        '6',
        'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
        'Lavouras Permanentes',
        'Produto A',
        '1000.00',
        '1000.00',
      ]),
      dataRow([
        '6',
        'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
        'Lavouras Temporárias',
        'Produto B',
        '2000.00',
        '2000.00',
      ]),
    ].join('\n');

    const result = parseCafProducaoCsv(csv);

    expect(result).toHaveLength(2);
    expect(result[0].nrCaf).toBe('6');
    expect(result[1].nrCaf).toBe('6');
  });

  test('coerces missing numeric fields to null', () => {
    const csv = [
      headerRow,
      dataRow([
        '8',
        'RENDA FORA DO ESTABALECIMENTO AGROPECUÁRIO',
        'Outros',
        'Serviços',
        '',
        '',
      ]),
    ].join('\n');

    const result = parseCafProducaoCsv(csv);

    expect(result[0].vlRendaAuferida).toBeNull();
    expect(result[0].vlRendaEstimada).toBeNull();
  });

  test('strips a leading UTF-8 BOM', () => {
    const csv =
      '﻿' +
      headerRow +
      '\n' +
      dataRow([
        '9',
        'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
        'Outros',
        'Produto',
        '100.00',
        '100.00',
      ]);
    const result = parseCafProducaoCsv(csv);
    expect(result).toHaveLength(1);
  });

  test('drops fully empty trailing lines', () => {
    const csv =
      headerRow +
      '\n' +
      dataRow([
        '10',
        'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
        'Outros',
        'Produto',
        '50.00',
        '50.00',
      ]) +
      '\n\n';
    const result = parseCafProducaoCsv(csv);
    expect(result).toHaveLength(1);
  });

  test('throws on empty CSV', () => {
    expect(() => {
      return parseCafProducaoCsv('');
    }).toThrow('empty');
  });

  test('throws when column count mismatches', () => {
    expect(() => {
      return parseCafProducaoCsv('nr_caf;categoria_renda');
    }).toThrow('columns');
  });

  test('throws when a header name mismatches', () => {
    const wrongHeaders = [...HEADERS];
    wrongHeaders[0] = 'caf_id';
    expect(() => {
      return parseCafProducaoCsv(wrongHeaders.join(';'));
    }).toThrow('mismatch');
  });

  test('parses quoted fields with embedded delimiters and escaped quotes', () => {
    const csv = [
      headerRow,
      dataRow([
        '6',
        'RENDA DO ESTABELECIMENTO AGROPECUÁRIO',
        'Lavouras Permanentes',
        '"Frutas ""diversas""; a granel"',
        '100.00',
        '100.00',
      ]),
    ].join('\n');

    const result = parseCafProducaoCsv(csv);

    // Embedded escaped `""` collapses to `"` and the quoted `;` stays literal.
    expect(result[0].dsProduto).toBe('Frutas "diversas"; a granel');
  });
});

describe('readStaticCafProducao', () => {
  test('reads and memoizes the static CSV snapshot from disk', async () => {
    const first = await readStaticCafProducao();

    expect(first.length).toBeGreaterThan(0);
    expect(first[0]).toHaveProperty('nrCaf');

    // Second call returns the same cached reference (no re-read).
    const second = await readStaticCafProducao();
    expect(second).toBe(first);
  });
});

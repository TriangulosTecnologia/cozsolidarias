import { parseIvsCsv } from 'src/data-source-static/readStaticIvs';

/**
 * A minimal header carrying the columns `parseIvsCsv` reads (overall IVS plus
 * the three sub-indices) and one decoy (`nivel`, whose value embeds commas) so
 * the tests exercise header-by-name lookup and RFC 4180 quoting, mirroring the
 * 103-column raw file.
 */
const HEADER =
  'nivel,municipio,nome_municipio_uf,ivs,ivs_infraestrutura_urbana,ivs_capital_humano,ivs_renda_e_trabalho';

/** Builds a CSV from the shared header and the given data lines. */
const csv = (...lines: string[]): string => {
  return [HEADER, ...lines].join('\n');
};

describe('parseIvsCsv', () => {
  test('parses code, name, IVS and the three sub-indices from the named columns', () => {
    const records = parseIvsCsv(
      csv(
        '"regiao,uf,rm,municipio",5300108,Brasília (DF),0.294,"0,412","0,265","0,204"',
        '"regiao,uf,rm,municipio",5200134,Acreúna (GO),0.314,"0,245","0,369","0,328"'
      )
    );

    expect(records).toEqual([
      {
        codigoIbge: '5300108',
        municipio: 'Brasília (DF)',
        ivs: 0.294,
        ivsInfraestruturaUrbana: 0.412,
        ivsCapitalHumano: 0.265,
        ivsRendaETrabalho: 0.204,
      },
      {
        codigoIbge: '5200134',
        municipio: 'Acreúna (GO)',
        ivs: 0.314,
        ivsInfraestruturaUrbana: 0.245,
        ivsCapitalHumano: 0.369,
        ivsRendaETrabalho: 0.328,
      },
    ]);
  });

  test('normalizes a comma decimal separator across every numeric column', () => {
    const [record] = parseIvsCsv(
      csv(
        '"regiao,uf,rm,municipio",5200159,"Adelândia (GO)","0,311","0,204","0,287","0,441"'
      )
    );

    expect(record.ivs).toBeCloseTo(0.311);
    expect(record.ivsInfraestruturaUrbana).toBeCloseTo(0.204);
    expect(record.ivsCapitalHumano).toBeCloseTo(0.287);
    expect(record.ivsRendaETrabalho).toBeCloseTo(0.441);
  });

  test('unescapes doubled double-quotes inside a quoted field', () => {
    const [record] = parseIvsCsv(
      csv(
        '"regiao,uf,rm,municipio",5300109,"Foo ""Bar"" (SP)",0.294,"0,4","0,2","0,2"'
      )
    );

    expect(record.municipio).toBe('Foo "Bar" (SP)');
  });

  test('strips a leading UTF-8 BOM before matching the header', () => {
    const records = parseIvsCsv(
      `\uFEFF${csv('"regiao,uf,rm,municipio",5200506,Aloândia (GO),0.269,"0,3","0,25","0,26"')}`
    );

    expect(records).toHaveLength(1);
    expect(records[0].codigoIbge).toBe('5200506');
  });

  test('drops fully empty trailing lines', () => {
    const records = parseIvsCsv(
      `${csv('"regiao,uf,rm,municipio",5200555,Alto Horizonte (GO),0.195,"0,1","0,2","0,3"')}\n`
    );

    expect(records).toHaveLength(1);
  });

  test('fills absent cells for a row shorter than the header (the transformer drops it)', () => {
    const [record] = parseIvsCsv(csv('"regiao,uf,rm,municipio"'));

    expect(record).toEqual({
      codigoIbge: '',
      municipio: '',
      ivs: 0,
      ivsInfraestruturaUrbana: 0,
      ivsCapitalHumano: 0,
      ivsRendaETrabalho: 0,
    });
  });

  test('throws when the file is empty', () => {
    expect(() => {
      return parseIvsCsv('');
    }).toThrow(/empty/);
  });

  test('throws when a required column is missing', () => {
    expect(() => {
      return parseIvsCsv('municipio,nome_municipio_uf\n5300108,Brasília (DF)');
    }).toThrow(/missing the "ivs" column/);
  });

  test('throws when a sub-index column is missing', () => {
    expect(() => {
      return parseIvsCsv(
        'municipio,nome_municipio_uf,ivs\n5300108,Brasília (DF),0.294'
      );
    }).toThrow(/missing the "ivs_infraestrutura_urbana" column/);
  });

  test('throws when a numeric cell is not a finite number', () => {
    expect(() => {
      return parseIvsCsv(
        csv(
          '"regiao,uf,rm,municipio",5300108,Brasília (DF),n/a,"0,4","0,2","0,2"'
        )
      );
    }).toThrow(/non-numeric ivs/);
  });
});

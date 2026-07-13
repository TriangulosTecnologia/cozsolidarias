import { parseIvsCsv } from 'src/data-source-static/readStaticIvs';

/**
 * A minimal header carrying the columns `parseIvsCsv` reads (overall IVS, the
 * three IVS sub-indices and the six IDHM-family columns) plus one decoy (`nivel`,
 * whose value embeds commas) so the tests exercise header-by-name lookup and RFC
 * 4180 quoting, mirroring the 103-column raw file.
 */
const HEADER =
  'nivel,municipio,nome_municipio_uf,ivs,ivs_infraestrutura_urbana,ivs_capital_humano,ivs_renda_e_trabalho,idhm,idhm_long,idhm_educ,idhm_renda,idhm_educ_sub_esc,idhm_educ_sub_freq';

/** Builds a CSV from the shared header and the given data lines. */
const csv = (...lines: string[]): string => {
  return [HEADER, ...lines].join('\n');
};

/** Filler IDHM cells (6 columns) appended to rows whose IDHM values aren't asserted. */
const IDHM_CELLS = '0.8,"0,8","0,7","0,8","0,7","0,75"';

describe('parseIvsCsv', () => {
  test('parses code, name and every IVS/IDHM score from the named columns', () => {
    const records = parseIvsCsv(
      csv(
        '"regiao,uf,rm,municipio",5300108,Brasília (DF),0.294,"0,412","0,265","0,204",0.824,"0,873","0,742","0,863","0,723","0,751"'
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
        idhm: 0.824,
        idhmLongevidade: 0.873,
        idhmEducacao: 0.742,
        idhmRenda: 0.863,
        idhmEducacaoEscolaridade: 0.723,
        idhmEducacaoFrequencia: 0.751,
      },
    ]);
  });

  test('normalizes a comma decimal separator across every numeric column', () => {
    const [record] = parseIvsCsv(
      csv(
        '"regiao,uf,rm,municipio",5200159,"Adelândia (GO)","0,311","0,204","0,287","0,441","0,702","0,836","0,622","0,664","0,395","0,780"'
      )
    );

    expect(record.ivs).toBeCloseTo(0.311);
    expect(record.ivsInfraestruturaUrbana).toBeCloseTo(0.204);
    expect(record.ivsCapitalHumano).toBeCloseTo(0.287);
    expect(record.ivsRendaETrabalho).toBeCloseTo(0.441);
    expect(record.idhm).toBeCloseTo(0.702);
    expect(record.idhmLongevidade).toBeCloseTo(0.836);
    expect(record.idhmEducacao).toBeCloseTo(0.622);
    expect(record.idhmRenda).toBeCloseTo(0.664);
    expect(record.idhmEducacaoEscolaridade).toBeCloseTo(0.395);
    expect(record.idhmEducacaoFrequencia).toBeCloseTo(0.78);
  });

  test('unescapes doubled double-quotes inside a quoted field', () => {
    const [record] = parseIvsCsv(
      csv(
        `"regiao,uf,rm,municipio",5300109,"Foo ""Bar"" (SP)",0.294,"0,4","0,2","0,2",${IDHM_CELLS}`
      )
    );

    expect(record.municipio).toBe('Foo "Bar" (SP)');
  });

  test('strips a leading UTF-8 BOM before matching the header', () => {
    const records = parseIvsCsv(
      `\uFEFF${csv(`"regiao,uf,rm,municipio",5200506,Aloândia (GO),0.269,"0,3","0,25","0,26",${IDHM_CELLS}`)}`
    );

    expect(records).toHaveLength(1);
    expect(records[0].codigoIbge).toBe('5200506');
  });

  test('drops fully empty trailing lines', () => {
    const records = parseIvsCsv(
      `${csv(`"regiao,uf,rm,municipio",5200555,Alto Horizonte (GO),0.195,"0,1","0,2","0,3",${IDHM_CELLS}`)}\n`
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
      idhm: 0,
      idhmLongevidade: 0,
      idhmEducacao: 0,
      idhmRenda: 0,
      idhmEducacaoEscolaridade: 0,
      idhmEducacaoFrequencia: 0,
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

  test('throws when an IDHM column is missing', () => {
    expect(() => {
      return parseIvsCsv(
        'municipio,nome_municipio_uf,ivs,ivs_infraestrutura_urbana,ivs_capital_humano,ivs_renda_e_trabalho\n5300108,Brasília (DF),0.294,0.4,0.2,0.2'
      );
    }).toThrow(/missing the "idhm" column/);
  });

  test('throws when a numeric cell is not a finite number', () => {
    expect(() => {
      return parseIvsCsv(
        csv(
          `"regiao,uf,rm,municipio",5300108,Brasília (DF),n/a,"0,4","0,2","0,2",${IDHM_CELLS}`
        )
      );
    }).toThrow(/non-numeric ivs/);
  });
});

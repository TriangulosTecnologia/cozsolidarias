import { toMunicipioIvs } from 'src/data-gateway/transformers/toMunicipioIvs';
import type { StaticIvsSource } from 'src/data-source-static/readStaticIvs';

/** Builds a source row with valid defaults, overriding the given fields. */
const source = (overrides: Partial<StaticIvsSource> = {}): StaticIvsSource => {
  return {
    codigoIbge: '5300108',
    municipio: 'Brasília (DF)',
    ivs: 0.294,
    ivsInfraestruturaUrbana: 0.412,
    ivsCapitalHumano: 0.265,
    ivsRendaETrabalho: 0.204,
    ...overrides,
  };
};

describe('toMunicipioIvs', () => {
  test('passes valid rows through unchanged, preserving order', () => {
    const result = toMunicipioIvs([
      source({ codigoIbge: '111', municipio: 'Alpha', ivs: 0.1 }),
      source({ codigoIbge: '222', municipio: 'Beta', ivs: 0.9 }),
    ]);

    expect(result).toEqual([
      {
        codigoIbge: '111',
        municipio: 'Alpha',
        ivs: 0.1,
        ivsInfraestruturaUrbana: 0.412,
        ivsCapitalHumano: 0.265,
        ivsRendaETrabalho: 0.204,
      },
      {
        codigoIbge: '222',
        municipio: 'Beta',
        ivs: 0.9,
        ivsInfraestruturaUrbana: 0.412,
        ivsCapitalHumano: 0.265,
        ivsRendaETrabalho: 0.204,
      },
    ]);
  });

  test('keeps the boundary scores 0 and 1', () => {
    const result = toMunicipioIvs([
      source({ codigoIbge: '111', ivs: 0 }),
      source({ codigoIbge: '222', ivs: 1 }),
    ]);

    expect(
      result.map((row) => {
        return row.ivs;
      })
    ).toEqual([0, 1]);
  });

  test('drops rows with an out-of-range IVS instead of painting a band', () => {
    const result = toMunicipioIvs([
      source({ codigoIbge: '111', ivs: -0.1 }),
      source({ codigoIbge: '222', ivs: 1.5 }),
      source({ codigoIbge: '333', ivs: 0.4 }),
    ]);

    expect(
      result.map((row) => {
        return row.codigoIbge;
      })
    ).toEqual(['333']);
  });

  test('drops rows with an out-of-range sub-index', () => {
    const result = toMunicipioIvs([
      source({ codigoIbge: '111', ivsInfraestruturaUrbana: 1.2 }),
      source({ codigoIbge: '222', ivsCapitalHumano: -0.3 }),
      source({ codigoIbge: '333', ivsRendaETrabalho: 2 }),
      source({ codigoIbge: '444' }),
    ]);

    expect(
      result.map((row) => {
        return row.codigoIbge;
      })
    ).toEqual(['444']);
  });

  test('drops rows with a blank IBGE code (no join key)', () => {
    const result = toMunicipioIvs([source({ codigoIbge: '' })]);

    expect(result).toEqual([]);
  });
});

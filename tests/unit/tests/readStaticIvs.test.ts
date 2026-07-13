import { readStaticIvs } from 'src/data-source-static/readStaticIvs';

describe('readStaticIvs', () => {
  test('reads the real snapshot, exposing every município with its IVS family scores', async () => {
    const records = await readStaticIvs();

    expect(records.length).toBeGreaterThan(5000);

    const brasilia = records.find((record) => {
      return record.codigoIbge === '5300108';
    });
    expect(brasilia?.municipio).toBe('Brasília (DF)');
    expect(brasilia?.ivs).toBeCloseTo(0.294);
    expect(brasilia?.ivsInfraestruturaUrbana).toBeCloseTo(0.412);
    expect(brasilia?.ivsCapitalHumano).toBeCloseTo(0.265);
    expect(brasilia?.ivsRendaETrabalho).toBeCloseTo(0.204);
  });

  test('memoizes the parsed snapshot across calls', async () => {
    const first = await readStaticIvs();
    const second = await readStaticIvs();

    expect(second).toBe(first);
  });
});

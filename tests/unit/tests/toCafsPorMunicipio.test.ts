import {
  cafsPercentualDoBrasil,
  toCafsPorMunicipio,
} from 'src/data-gateway/transformers/toCafsPorMunicipio';
import type { StaticCafPorMunicipioSource } from 'src/data-source-static/types';

describe('cafsPercentualDoBrasil', () => {
  test('computes (quantidade / total) * 100', () => {
    expect(cafsPercentualDoBrasil({ quantidade: 5, total: 5000 })).toBe(0.1);
  });

  test('rounds to six decimals (fine enough for tiny CAF shares)', () => {
    expect(cafsPercentualDoBrasil({ quantidade: 1, total: 7 })).toBe(14.285714);
  });

  test('keeps a single-CAF share above the scale floor instead of collapsing to 0', () => {
    // One CAF out of ~3.95M ≈ 0.000025% — two decimals would round it to 0.
    expect(
      cafsPercentualDoBrasil({ quantidade: 1, total: 3_949_228 })
    ).toBeGreaterThan(0);
  });

  test('returns 0 for a non-positive total (no CAFs to take a share of)', () => {
    expect(cafsPercentualDoBrasil({ quantidade: 0, total: 0 })).toBe(0);
  });
});

describe('toCafsPorMunicipio', () => {
  const sources: StaticCafPorMunicipioSource[] = [
    { cdMunicipio: '111', nmMunicipio: 'Alpha', quantidade: 3 },
    { cdMunicipio: '222', nmMunicipio: 'Beta', quantidade: 1 },
  ];

  test('projects each município row and derives its share of Brazil', () => {
    // total = 3 + 1 = 4, so shares are 75% and 25%.
    expect(toCafsPorMunicipio(sources)).toEqual([
      {
        codigoIbge: '111',
        municipio: 'Alpha',
        quantidade: 3,
        percentualDoBrasil: 75,
      },
      {
        codigoIbge: '222',
        municipio: 'Beta',
        quantidade: 1,
        percentualDoBrasil: 25,
      },
    ]);
  });

  test('shares over the whole snapshot add up to 100%', () => {
    const total = toCafsPorMunicipio(sources).reduce((sum, entry) => {
      return sum + entry.percentualDoBrasil;
    }, 0);
    expect(total).toBe(100);
  });

  test('returns an empty array for an empty snapshot', () => {
    expect(toCafsPorMunicipio([])).toEqual([]);
  });
});

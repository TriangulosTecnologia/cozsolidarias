import {
  cadinsanProporcao,
  toCadinsanPorMunicipio,
} from 'src/data-gateway/transformers/toCadinsanPorMunicipio';
import type { StaticCadinsanMunicipioSource } from 'src/data-source-static/types';

describe('cadinsanProporcao', () => {
  test('computes (absoluto / cadunico) * 100, rounded to two decimals', () => {
    // Altamira sem PBF: 5779 / 14656 ≈ 39.4309% → 39.43.
    expect(cadinsanProporcao({ absoluto: 5779, cadunico: 14656 })).toBe(39.43);
  });

  test('keeps a real 0% (zero numerator over a positive denominator)', () => {
    expect(cadinsanProporcao({ absoluto: 0, cadunico: 132 })).toBe(0);
  });

  test('returns null when there is no CadÚnico denominator', () => {
    expect(cadinsanProporcao({ absoluto: 0, cadunico: 0 })).toBeNull();
  });
});

describe('toCadinsanPorMunicipio', () => {
  const sources: StaticCadinsanMunicipioSource[] = [
    {
      codigoIbge: '1500602',
      regiao: 'Norte',
      uf: 'Pará',
      municipio: 'Altamira',
      absolutoComPbf: 2616,
      absolutoSemPbf: 5779,
      cadastrosCadunico: 14656,
    },
    {
      codigoIbge: '9999999',
      regiao: 'Sul',
      uf: 'X',
      municipio: 'Sem CadÚnico',
      absolutoComPbf: 0,
      absolutoSemPbf: 0,
      cadastrosCadunico: 0,
    },
  ];

  test('projects each row and derives both com/sem-PBF shares', () => {
    expect(toCadinsanPorMunicipio(sources)).toEqual([
      {
        codigoIbge: '1500602',
        municipio: 'Altamira',
        uf: 'Pará',
        regiao: 'Norte',
        absolutoComPbf: 2616,
        absolutoSemPbf: 5779,
        cadastrosCadunico: 14656,
        proporcaoComPbf: 17.85,
        proporcaoSemPbf: 39.43,
      },
      {
        codigoIbge: '9999999',
        municipio: 'Sem CadÚnico',
        uf: 'X',
        regiao: 'Sul',
        absolutoComPbf: 0,
        absolutoSemPbf: 0,
        cadastrosCadunico: 0,
        proporcaoComPbf: null,
        proporcaoSemPbf: null,
      },
    ]);
  });

  test('returns an empty array for an empty snapshot', () => {
    expect(toCadinsanPorMunicipio([])).toEqual([]);
  });
});

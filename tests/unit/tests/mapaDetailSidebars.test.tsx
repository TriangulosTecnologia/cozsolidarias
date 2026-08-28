import { modeShowsCozinhaDetail } from 'src/app/(features)/mapas/mapaDetailSidebars';

describe('modeShowsCozinhaDetail', () => {
  test('is true for the always-on-points modes', () => {
    expect(modeShowsCozinhaDetail('pontos')).toBe(true);
    expect(modeShowsCozinhaDetail('assentamentos')).toBe(true);
  });

  test('is true for every choropleth (opt-in kitchen overlay)', () => {
    expect(modeShowsCozinhaDetail('coropletico')).toBe(true);
    expect(modeShowsCozinhaDetail('coropletico-taxa')).toBe(true);
    expect(modeShowsCozinhaDetail('coropletico-ivs')).toBe(true);
    expect(modeShowsCozinhaDetail('coropletico-idhm-educacao')).toBe(true);
  });

  test('is false for circulos (bubbles carry no clickable points)', () => {
    expect(modeShowsCozinhaDetail('circulos')).toBe(false);
  });
});

import { classifyValues } from 'src/app/(features)/mapas/classifyValues';

describe('classifyValues', () => {
  test('finds the natural breaks of a clearly clustered dataset', () => {
    // Three obvious groups: {4,5,6} {18,19} {40,41}.
    const result = classifyValues({
      values: [4, 5, 6, 18, 19, 40, 41],
      classes: 3,
      floor: 4,
    });

    expect(result.method).toBe('jenks');
    // floor kept as first threshold; interior cutpoints sit at the gaps.
    expect(result.breaks).toEqual([4, 18, 40]);
    // Perfectly separable groups → near-perfect fit.
    expect(result.gvf).toBeGreaterThan(0.99);
  });

  test('returns a threshold array the same length as the band count', () => {
    const result = classifyValues({
      values: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
      classes: 5,
      floor: 1,
    });

    expect(result.breaks).toHaveLength(5);
    expect(result.breaks?.[0]).toBe(1);
  });

  test('preserves the fixed floor even when the smallest value is above it', () => {
    // Smallest significant value is 10, but the floor stays at 0.001.
    const result = classifyValues({
      values: [10, 12, 40, 45, 90, 95],
      classes: 3,
      floor: 0.001,
    });

    expect(result.breaks?.[0]).toBe(0.001);
    expect(result.breaks).toHaveLength(3);
  });

  test('drops null, undefined, string, non-finite, and below-floor values before fitting', () => {
    const withNoise = classifyValues({
      values: [null, undefined, '42', Number.NaN, 0, 4, 5, 6, 18, 19, 40, 41],
      classes: 3,
      floor: 4,
    });
    const clean = classifyValues({
      values: [4, 5, 6, 18, 19, 40, 41],
      classes: 3,
      floor: 4,
    });

    expect(withNoise.breaks).toEqual(clean.breaks);
  });

  test('breaks are ascending and bounded by the significant data range', () => {
    const values = [2, 3, 3, 4, 9, 10, 11, 30, 31, 32, 33];
    const result = classifyValues({ values, classes: 4, floor: 2 });

    const breaks = result.breaks ?? [];
    for (let i = 1; i < breaks.length; i += 1) {
      expect(breaks[i]).toBeGreaterThan(breaks[i - 1]);
    }
    // No interior break exceeds the data maximum.
    expect(Math.max(...breaks)).toBeLessThanOrEqual(Math.max(...values));
  });

  test('signals fallback (null breaks) when distinct values are fewer than classes', () => {
    const result = classifyValues({
      values: [5, 5, 5, 5],
      classes: 5,
      floor: 1,
    });

    expect(result.breaks).toBeNull();
    expect(result.gvf).toBe(0);
  });

  test('signals fallback when every value is below the floor', () => {
    const result = classifyValues({
      values: [0, 0, 0],
      classes: 3,
      floor: 1,
    });

    expect(result.breaks).toBeNull();
  });

  test('handles the minimum viable case: exactly as many distinct values as classes', () => {
    const result = classifyValues({
      values: [1, 5, 9],
      classes: 3,
      floor: 1,
    });

    expect(result.breaks).toHaveLength(3);
    expect(result.gvf).toBe(1);
  });
});

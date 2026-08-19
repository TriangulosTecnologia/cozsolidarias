import {
  formatBytes,
  formatDate,
  formatGrain,
  formatInterval,
  GRAIN_LABELS,
  labelOf,
} from 'src/app/(features)/dados/_components/catalogueLabels';

/**
 * The catalogue's formatters, which turn source codes into pt-BR prose. Pure
 * functions with real branching, so they are tested directly — the label maps
 * they sit next to are plain data and are covered through the page.
 */
describe('catalogueLabels', () => {
  test.each([
    // A full calendar year collapses to the year alone.
    [{ start: '2022-01-01', end: '2022-12-31' }, '2022'],
    [{ start: '2010-01-01', end: '2012-12-31' }, '2010 a 2012'],
    [{ start: '2026-06-01', end: '2026-06-30' }, '01/06/2026 a 30/06/2026'],
    // A null bound is open-ended, in either direction.
    [{ start: '2008-01-01', end: null }, 'desde 01/01/2008'],
    [{ start: null, end: '2026-06-30' }, 'até 30/06/2026'],
    [{ start: null, end: null }, 'período não delimitado'],
  ])('formats the covered interval %j', (interval, expected) => {
    expect(formatInterval(interval)).toBe(expected);
  });

  test.each([
    [512, '512 B'],
    [1024, '1,0 KB'],
    [770399, '752,3 KB'],
    [12630947, '12,0 MB'],
    // Beyond the largest unit the loop stops instead of running off the list.
    [1099511627776, '1024,0 GB'],
  ])('formats %d bytes with a pt-BR decimal comma', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  test('keeps an unrecognized code visible instead of rendering blank', () => {
    // Dates are split, never parsed through `Date`, so no timezone can shift
    // the day — and a value that is not a full ISO date passes through.
    expect(formatDate('2026-08-14')).toBe('14/08/2026');
    expect(formatDate('2026-08')).toBe('2026-08');

    expect(formatGrain('P1Y')).toBe('por ano (P1Y)');
    expect(formatGrain('P3M')).toBe('P3M');

    expect(labelOf(GRAIN_LABELS, 'municipality')).toBe('município');
    expect(labelOf(GRAIN_LABELS, 'quilombo')).toBe('quilombo');
  });
});

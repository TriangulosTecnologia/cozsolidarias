import {
  ACCESS_LABELS,
  COVERAGE_LABELS,
  formatBytes,
  formatCount,
  formatDate,
  formatExtentCode,
  formatGrain,
  formatInterval,
  formatStatus,
  FREQUENCY_LABELS,
  GAP_LABELS,
  GEOMETRY_LABELS,
  GRAIN_LABELS,
  HISTORY_LABELS,
  labelOf,
  PRECISION_LABELS,
  ROLE_LABELS,
  SEVERITY_LABELS,
  VOLUME_LABELS,
} from 'src/app/(features)/dados/_components/catalogueLabels';

describe('catalogueLabels', () => {
  test('translates every value of each closed vocabulary', () => {
    expect(FREQUENCY_LABELS.oneTime).toBe('publicação única');
    expect(HISTORY_LABELS.appendOnly).toBe(
      'série acumulada — o passado não é reescrito'
    );
    expect(COVERAGE_LABELS.unknown).toBe('não documentada');
    expect(GEOMETRY_LABELS.multipolygon).toBe('polígonos');
    expect(PRECISION_LABELS.notApplicable).toBe('não se aplica');
    expect(ACCESS_LABELS.restricted).toBe('Restrito');
    expect(VOLUME_LABELS.features).toBe('feições');
    expect(SEVERITY_LABELS.low).toBe('baixa');
    expect(GAP_LABELS.originUndocumented).toBe(
      'Origem sem endereço registrado'
    );

    // Every vocabulary must be exhaustively mapped — a missing entry would
    // render as blank on the page.
    for (const labels of [
      FREQUENCY_LABELS,
      HISTORY_LABELS,
      COVERAGE_LABELS,
      GEOMETRY_LABELS,
      PRECISION_LABELS,
      ACCESS_LABELS,
      VOLUME_LABELS,
      SEVERITY_LABELS,
      GAP_LABELS,
    ]) {
      for (const value of Object.values(labels)) {
        expect(value).not.toBe('');
      }
    }
  });

  test('falls back to the raw code for an unmapped open vocabulary', () => {
    expect(labelOf(GRAIN_LABELS, 'municipality')).toBe('município');
    expect(labelOf(ROLE_LABELS, 'identifier')).toBe('identificador');
    // Unrecognized codes stay visible rather than rendering blank.
    expect(labelOf(GRAIN_LABELS, 'quilombo')).toBe('quilombo');
    expect(labelOf(ROLE_LABELS, 'measure')).toBe('measure');
  });

  test.each([
    ['P1D', 'por dia (P1D)'],
    ['P1M', 'por mês (P1M)'],
    ['P1Y', 'por ano (P1Y)'],
    ['P3M', 'P3M'],
  ])('formats the record duration %s', (grain, expected) => {
    expect(formatGrain(grain)).toBe(expected);
  });

  test.each([
    ['BR', 'Brasil'],
    ['BR-SP', 'São Paulo'],
    ['BR-ES', 'Espírito Santo'],
    ['XX-99', 'XX-99'],
  ])('spells out the coded region %s', (code, expected) => {
    expect(formatExtentCode(code)).toBe(expected);
  });

  test.each([
    ['draft', 'rascunho'],
    ['published', 'publicado'],
    ['sunsetting', 'sunsetting'],
  ])('names the catalogue status %s', (status, expected) => {
    expect(formatStatus(status)).toBe(expected);
  });

  test.each([
    ['2026-08-14', '14/08/2026'],
    ['2010-01-01', '01/01/2010'],
    // Not a full ISO date: returned untouched instead of rendering wrong.
    ['2026-08', '2026-08'],
  ])('formats the ISO date %s', (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });

  test.each([
    [{ start: '2022-01-01', end: '2022-12-31' }, '2022'],
    [{ start: '2010-01-01', end: '2012-12-31' }, '2010 a 2012'],
    [{ start: '2026-06-01', end: '2026-06-30' }, '01/06/2026 a 30/06/2026'],
    [{ start: '2008-01-01', end: null }, 'desde 01/01/2008'],
    [{ start: null, end: '2026-06-30' }, 'até 30/06/2026'],
    [{ start: null, end: null }, 'período não delimitado'],
  ])('formats the interval %j', (interval, expected) => {
    expect(formatInterval(interval)).toBe(expected);
  });

  test('formats counts with pt-BR thousands separators', () => {
    expect(formatCount(5570)).toBe('5.570');
    expect(formatCount(1396)).toBe('1.396');
    expect(formatCount(0)).toBe('0');
  });

  test.each([
    [512, '512 B'],
    [1024, '1,0 KB'],
    [770399, '752,3 KB'],
    [12630947, '12,0 MB'],
    [3221225472, '3,0 GB'],
    // Beyond the largest unit the loop stops rather than running off the list.
    [1099511627776, '1024,0 GB'],
  ])('formats %d bytes', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

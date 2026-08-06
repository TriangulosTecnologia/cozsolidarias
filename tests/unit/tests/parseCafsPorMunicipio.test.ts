import {
  parseCafsPorMunicipio,
  readStaticCafsPorMunicipio,
} from 'src/data-source-static/readStaticCafsPorMunicipio';

describe('parseCafsPorMunicipio', () => {
  test('parses a valid snapshot array', () => {
    const text = JSON.stringify([
      { cdMunicipio: '3550308', nmMunicipio: 'São Paulo', quantidade: 42 },
      { cdMunicipio: '3304557', nmMunicipio: 'Rio de Janeiro', quantidade: 7 },
    ]);

    expect(parseCafsPorMunicipio(text)).toEqual([
      { cdMunicipio: '3550308', nmMunicipio: 'São Paulo', quantidade: 42 },
      { cdMunicipio: '3304557', nmMunicipio: 'Rio de Janeiro', quantidade: 7 },
    ]);
  });

  test('accepts a município with a zero count', () => {
    const text = JSON.stringify([
      { cdMunicipio: '111', nmMunicipio: 'Zerada', quantidade: 0 },
    ]);

    expect(parseCafsPorMunicipio(text)).toHaveLength(1);
  });

  test('throws when the JSON is not an array', () => {
    expect(() => {
      return parseCafsPorMunicipio('{"cdMunicipio":"111"}');
    }).toThrow(/must be a JSON array/);
  });

  test('throws when an array element is not an object', () => {
    expect(() => {
      return parseCafsPorMunicipio('[42]');
    }).toThrow(/malformed CAF-per-município record at index 0/);
    expect(() => {
      return parseCafsPorMunicipio('[null]');
    }).toThrow(/malformed CAF-per-município record at index 0/);
  });

  test('throws when a record is missing a field', () => {
    const text = JSON.stringify([{ cdMunicipio: '111', nmMunicipio: 'Alpha' }]);

    expect(() => {
      return parseCafsPorMunicipio(text);
    }).toThrow(/malformed CAF-per-município record at index 0/);
  });

  test('throws when cdMunicipio is empty', () => {
    const text = JSON.stringify([
      { cdMunicipio: '', nmMunicipio: 'Alpha', quantidade: 1 },
    ]);

    expect(() => {
      return parseCafsPorMunicipio(text);
    }).toThrow(/malformed CAF-per-município record/);
  });

  test('throws when quantidade is negative', () => {
    const text = JSON.stringify([
      { cdMunicipio: '111', nmMunicipio: 'Alpha', quantidade: -1 },
    ]);

    expect(() => {
      return parseCafsPorMunicipio(text);
    }).toThrow(/malformed CAF-per-município record/);
  });

  test('throws when quantidade is not a number', () => {
    const text = JSON.stringify([
      { cdMunicipio: '111', nmMunicipio: 'Alpha', quantidade: 'x' },
    ]);

    expect(() => {
      return parseCafsPorMunicipio(text);
    }).toThrow(/malformed CAF-per-município record/);
  });
});

describe('readStaticCafsPorMunicipio', () => {
  test('reads the snapshot and memoizes it across calls', async () => {
    const first = await readStaticCafsPorMunicipio();

    expect(Array.isArray(first)).toBe(true);
    expect(first.length).toBeGreaterThan(0);
    expect(typeof first[0].cdMunicipio).toBe('string');

    // Second call returns the same cached array (memoized for the process).
    const second = await readStaticCafsPorMunicipio();
    expect(second).toBe(first);
  });
});

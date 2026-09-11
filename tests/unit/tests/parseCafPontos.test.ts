import {
  parseCafPontos,
  readStaticCafPontos,
} from 'src/data-source-static/readStaticCafPontos';

const UF = {
  codigoUf: '29',
  uf: 'BA',
  nome: 'Bahia',
  longitude: -40.76652,
  latitude: -12.34337,
};

describe('parseCafPontos', () => {
  test('parses a valid snapshot', () => {
    expect(parseCafPontos(JSON.stringify({ ufs: [UF] }))).toEqual({
      ufs: [UF],
    });
  });

  test('accepts an empty snapshot', () => {
    expect(parseCafPontos('{"ufs":[]}')).toEqual({ ufs: [] });
  });

  test('throws when the JSON is not an object', () => {
    expect(() => {
      return parseCafPontos('null');
    }).toThrow(/must be a JSON object/);
    expect(() => {
      return parseCafPontos('42');
    }).toThrow(/must be a JSON object/);
  });

  test('throws when the `ufs` array is missing', () => {
    expect(() => {
      return parseCafPontos('{}');
    }).toThrow(/needs a `ufs` array/);
    expect(() => {
      return parseCafPontos('[]');
    }).toThrow(/needs a `ufs` array/);
  });

  test('throws when an anchor is not an object', () => {
    expect(() => {
      return parseCafPontos('{"ufs":[42]}');
    }).toThrow(/malformed CAF UF anchor at index 0/);
    expect(() => {
      return parseCafPontos('{"ufs":[null]}');
    }).toThrow(/malformed CAF UF anchor at index 0/);
  });

  test('throws when an anchor is missing a field or names nothing', () => {
    const cases = [
      { ...UF, codigoUf: '' },
      { ...UF, uf: '' },
      { ...UF, nome: '' },
      { codigoUf: '29', uf: 'BA', nome: 'Bahia', longitude: -40 },
    ];

    for (const uf of cases) {
      expect(() => {
        return parseCafPontos(JSON.stringify({ ufs: [uf] }));
      }).toThrow(/malformed CAF UF anchor at index 0/);
    }
  });

  /*
   * A non-finite coordinate would put the circle nowhere and take MapLibre's
   * whole source down with it, so it is rejected here rather than shipped.
   */
  test('throws when a coordinate is not a finite number', () => {
    expect(() => {
      return parseCafPontos(
        JSON.stringify({ ufs: [{ ...UF, latitude: null }] })
      );
    }).toThrow(/malformed CAF UF anchor at index 0/);
    expect(() => {
      return parseCafPontos(
        `{"ufs":[{"codigoUf":"29","uf":"BA","nome":"Bahia","longitude":-38.9,"latitude":${Number.MAX_VALUE}0}]}`
      );
    }).toThrow(/malformed CAF UF anchor at index 0/);
  });
});

describe('readStaticCafPontos', () => {
  test('reads the real snapshot: one anchor per federative unit', async () => {
    const first = await readStaticCafPontos();

    expect(first.ufs).toHaveLength(27);

    const bahia = first.ufs.find((uf) => {
      return uf.uf === 'BA';
    });
    expect(bahia?.nome).toBe('Bahia');
    expect(bahia?.codigoUf).toBe('29');
    // The weighted centroid sits in the interior, not on the coast where the
    // capital is (-38.5) — the whole reason the anchor is weighted.
    expect(bahia?.longitude).toBeLessThan(-40);

    // Second call returns the same cached object (memoized for the process).
    const second = await readStaticCafPontos();
    expect(second).toBe(first);
  });
});

import {
  parseCafHexbin,
  readStaticCafHexbin,
} from 'src/data-source-static/readStaticCafHexbin';

/** A well-formed snapshot as JSON text, with `cells` swapped per case. */
const snapshot = (cells: unknown): string => {
  return JSON.stringify({ resolution: 4, cells });
};

const validCell = {
  h3: '8456d13ffffffff',
  count: 2,
  ring: [
    [-46, -23],
    [-45, -23],
    [-45, -22],
  ],
};

/** A cell with one field replaced by something malformed. */
const cellWith = (overrides: Record<string, unknown>): unknown => {
  return { ...validCell, ...overrides };
};

describe('parseCafHexbin', () => {
  test('returns the snapshot when every cell is well formed', () => {
    expect(parseCafHexbin(snapshot([validCell]))).toEqual({
      resolution: 4,
      cells: [validCell],
    });
  });

  test('accepts a snapshot with no cells', () => {
    expect(parseCafHexbin(snapshot([]))).toEqual({ resolution: 4, cells: [] });
  });

  test.each([
    ['a number', '4'],
    ['a string', '"snapshot"'],
    ['null', 'null'],
  ])('rejects a payload that is %s', (_label, text) => {
    expect(() => {
      return parseCafHexbin(text);
    }).toThrow('must be a JSON object');
  });

  test.each([
    ['missing', JSON.stringify({ cells: [] })],
    ['not a number', JSON.stringify({ resolution: '4', cells: [] })],
    ['not finite', JSON.stringify({ resolution: null, cells: [] })],
  ])('rejects a snapshot whose resolution is %s', (_label, text) => {
    expect(() => {
      return parseCafHexbin(text);
    }).toThrow('needs a numeric `resolution`');
  });

  test.each([
    ['missing', JSON.stringify({ resolution: 4 })],
    ['not an array', JSON.stringify({ resolution: 4, cells: {} })],
  ])('rejects a snapshot whose cells are %s', (_label, text) => {
    expect(() => {
      return parseCafHexbin(text);
    }).toThrow('needs a `cells` array');
  });

  test.each([
    ['not an object', 'null'],
    ['a primitive', '"84a"'],
    ['missing h3', JSON.stringify(cellWith({ h3: undefined }))],
    ['an empty h3', JSON.stringify(cellWith({ h3: '' }))],
    ['a non-string h3', JSON.stringify(cellWith({ h3: 42 }))],
    ['a non-numeric count', JSON.stringify(cellWith({ count: '2' }))],
    ['a non-finite count', JSON.stringify(cellWith({ count: null }))],
    ['a ring that is not an array', JSON.stringify(cellWith({ ring: 'x' }))],
  ])('rejects a cell that is %s', (_label, cellText: string) => {
    expect(() => {
      return parseCafHexbin(snapshot([JSON.parse(cellText)]));
    }).toThrow('malformed CAF hexbin cell at index 0');
  });

  test('rejects a ring with fewer than three vertices', () => {
    expect(() => {
      return parseCafHexbin(
        snapshot([
          cellWith({
            ring: [
              [-46, -23],
              [-45, -23],
            ],
          }),
        ])
      );
    }).toThrow('malformed CAF hexbin cell at index 0');
  });

  test.each([
    ['a vertex that is not an array', 'nope'],
    ['a vertex of the wrong arity', [-46, -23, 0]],
    ['a non-numeric coordinate', ['-46', -23]],
    ['a non-finite coordinate', [null, -23]],
  ])('rejects a ring holding %s', (_label, vertex) => {
    expect(() => {
      return parseCafHexbin(
        snapshot([cellWith({ ring: [vertex, [-45, -23], [-45, -22]] })])
      );
    }).toThrow('malformed CAF hexbin cell at index 0');
  });

  test('reports the index of the offending cell', () => {
    expect(() => {
      return parseCafHexbin(
        snapshot([validCell, validCell, cellWith({ h3: '' })])
      );
    }).toThrow('malformed CAF hexbin cell at index 2');
  });
});

describe('readStaticCafHexbin', () => {
  test('reads the real snapshot, covering Brazil at H3 resolution 4', async () => {
    const { resolution, cells } = await readStaticCafHexbin();

    expect(resolution).toBe(4);
    expect(cells.length).toBeGreaterThan(5000);
    // Empty cells are kept on purpose, so occupied ones are a strict subset.
    expect(
      cells.filter((cell) => {
        return cell.count > 0;
      }).length
    ).toBeLessThan(cells.length);
  });

  test('memoizes the parsed snapshot across calls', async () => {
    const first = await readStaticCafHexbin();
    const second = await readStaticCafHexbin();

    expect(second).toBe(first);
  });
});

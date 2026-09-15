import { toCafHexbin } from 'src/data-gateway/transformers/toCafHexbin';
import type { StaticCafHexbinSource } from 'src/data-source-static/types';

/** An open triangular ring — the minimum `isCell` accepts. */
const ring: [number, number][] = [
  [-46, -23],
  [-45, -23],
  [-45, -22],
];

const source = (
  cells: StaticCafHexbinSource['cells']
): StaticCafHexbinSource => {
  return { resolution: 4, cells };
};

describe('toCafHexbin', () => {
  test('closes each ring by repeating its first vertex', () => {
    const { features } = toCafHexbin(source([{ h3: '84a', count: 2, ring }]));

    expect(features[0]?.geometry.coordinates).toEqual([
      [
        [-46, -23],
        [-45, -23],
        [-45, -22],
        [-46, -23],
      ],
    ]);
  });

  test('carries h3 and count onto the feature properties', () => {
    const { features } = toCafHexbin(
      source([{ h3: '8456d13ffffffff', count: 17, ring }])
    );

    expect(features[0]?.properties).toEqual({
      h3: '8456d13ffffffff',
      count: 17,
    });
  });

  test('emits a Polygon feature per cell, in snapshot order', () => {
    const { type, features } = toCafHexbin(
      source([
        { h3: 'a', count: 1, ring },
        { h3: 'b', count: 2, ring },
        { h3: 'c', count: 3, ring },
      ])
    );

    expect(type).toBe('FeatureCollection');
    expect(features).toHaveLength(3);
    expect(
      features.map((feature) => {
        return feature.properties.h3;
      })
    ).toEqual(['a', 'b', 'c']);
    expect(
      features.every((feature) => {
        return (
          feature.type === 'Feature' && feature.geometry.type === 'Polygon'
        );
      })
    ).toBe(true);
  });

  test('keeps empty cells — a zero count is an answer, not a hole', () => {
    const { features } = toCafHexbin(
      source([
        { h3: 'occupied', count: 5, ring },
        { h3: 'empty', count: 0, ring },
      ])
    );

    expect(features).toHaveLength(2);
    expect(features[1]?.properties).toEqual({ h3: 'empty', count: 0 });
  });

  test('leaves the source rings untouched', () => {
    const cell = { h3: 'a', count: 1, ring: [...ring] };

    toCafHexbin(source([cell]));

    expect(cell.ring).toEqual(ring);
  });

  test('returns an empty collection for an empty snapshot', () => {
    expect(toCafHexbin(source([]))).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});

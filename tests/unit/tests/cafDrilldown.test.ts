import {
  CAF_DRILL_LAYER_IDS,
  cafDrillCamera,
  cellCenter,
} from '@/app/(features)/mapas/cafDrilldown';

describe('CAF_DRILL_LAYER_IDS', () => {
  test('lists the UF anchors and every aggregate band, and nothing else', () => {
    expect(CAF_DRILL_LAYER_IDS).toContain('cafs-uf');
    expect(CAF_DRILL_LAYER_IDS).toContain('cafs-h3-r3-b0');
    expect(CAF_DRILL_LAYER_IDS).toContain('cafs-h3-r6-b3');

    // A cell of one is not an aggregate, the labels must let the click through
    // to the circles under them, and an individual CAF ends the hierarchy.
    expect(CAF_DRILL_LAYER_IDS).not.toContain('cafs-h3-r3-single');
    expect(CAF_DRILL_LAYER_IDS).not.toContain('cafs-h3-r3-labels');
    expect(CAF_DRILL_LAYER_IDS).not.toContain('cafs-pts');
  });
});

describe('cellCenter', () => {
  test('averages the cell extent into its centre', () => {
    expect(cellCenter({ w: -46, s: -24, e: -45, n: -23 })).toEqual([
      -45.5, -23.5,
    ]);
  });

  test('is undefined when the tile carries no extent', () => {
    expect(cellCenter({ count: 12 })).toBeUndefined();
  });

  test('is undefined when the extent is only partly present', () => {
    expect(cellCenter({ w: -46, s: -24, e: -45 })).toBeUndefined();
  });

  test('is undefined when a bound is not a finite number', () => {
    expect(cellCenter({ w: -46, s: -24, e: '-45', n: -23 })).toBeUndefined();
    expect(
      cellCenter({ w: -46, s: -24, e: Number.NaN, n: -23 })
    ).toBeUndefined();
  });
});

describe('cafDrillCamera', () => {
  const cell = { count: 28_000, w: -46, s: -24, e: -45, n: -23 };

  test('sends a clicked r3 cell to the zoom where r4 takes over', () => {
    expect(
      cafDrillCamera({
        layerId: 'cafs-h3-r3-b3',
        properties: cell,
        coordinates: [-45.2, -23.9],
      })
    ).toEqual({ center: [-45.5, -23.5], zoom: 7 });
  });

  test('every density band of a resolution shares one target zoom', () => {
    const zooms = [0, 1, 2, 3].map((band) => {
      return cafDrillCamera({
        layerId: `cafs-h3-r5-b${band}`,
        properties: cell,
        coordinates: [-45.2, -23.9],
      })?.zoom;
    });

    expect(zooms).toEqual([9, 9, 9, 9]);
  });

  test('walks the whole hierarchy down to the individual points', () => {
    const zoomFor = (resolution: number) => {
      return cafDrillCamera({
        layerId: `cafs-h3-r${resolution}-b0`,
        properties: cell,
        coordinates: [-45.2, -23.9],
      })?.zoom;
    };

    expect([zoomFor(3), zoomFor(4), zoomFor(5), zoomFor(6)]).toEqual([
      7, 8, 9, 10,
    ]);
  });

  test('sends a clicked UF anchor to the zoom where the r3 grid takes over', () => {
    expect(
      cafDrillCamera({
        layerId: 'cafs-uf',
        properties: { quantidade: 704_034 },
        coordinates: [-41.7, -12.6],
      })
    ).toEqual({ center: [-41.7, -12.6], zoom: 5 });
  });

  test('centres on the mark when the tile carries no extent', () => {
    expect(
      cafDrillCamera({
        layerId: 'cafs-h3-r4-b1',
        properties: { count: 900 },
        coordinates: [-45.2, -23.9],
      })
    ).toEqual({ center: [-45.2, -23.9], zoom: 8 });
  });

  test('ignores a layer that does not drill', () => {
    expect(
      cafDrillCamera({
        layerId: 'cafs-pts',
        properties: {},
        coordinates: [-45, -23],
      })
    ).toBeUndefined();
  });
});

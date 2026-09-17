import {
  buildCafHexbinLayer,
  buildCafHexbinMapData,
  buildCafHexbinSource,
  cafHexbinBandColor,
} from 'src/app/(features)/mapas/geovisCafHexbin';
import type { CafHexbinFeatureCollection } from 'src/data-gateway/schema';

const grid: CafHexbinFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { h3: 'cheia', count: 42 },
      geometry: { type: 'Polygon', coordinates: [[[-46, -23]]] },
    },
    {
      type: 'Feature',
      properties: { h3: 'vazia', count: 0 },
      geometry: { type: 'Polygon', coordinates: [[[-45, -22]]] },
    },
  ],
};

describe('buildCafHexbinSource', () => {
  test('falls back to the API route until the grid is loaded', () => {
    expect(buildCafHexbinSource().data).toBe('/api/cafs/hexbin');
  });

  /*
   * By reference, deliberately: the adapter re-parses a geojson source whenever
   * its `data` reference changes, so a builder that derived a new collection
   * per call would re-parse 35k polygons on every spec build at r5.
   */
  test('serves the loaded grid itself, not a copy of it', () => {
    expect(buildCafHexbinSource(grid).data).toBe(grid);
  });
});

describe('buildCafHexbinLayer', () => {
  test('joins the counts and reads the mode legend', () => {
    const layer = buildCafHexbinLayer();

    expect(layer.geometry).toBe('polygon');
    expect(layer.mapDataId).toBe('caf-hexbin-counts');
    expect(layer.activeLegendId).toBe('legenda-cafs-hexbin');
    expect(layer.hoverTooltip).toBeUndefined();
  });

  test('attaches the hover card when a renderer is given', () => {
    const render = jest.fn();

    expect(
      buildCafHexbinLayer({ hoverTooltipRender: render }).hoverTooltip?.render
    ).toBe(render);
  });

  /*
   * Opaque on purpose. The settings zone's opacity rides in the legend's
   * colours, which is what `fill-color` is built from — setting it here too
   * would multiply the two and land at the square of what was asked for.
   */
  test('stays opaque, leaving the opacity to the colours', () => {
    expect(buildCafHexbinLayer().paint?.fillOpacity).toBe(1);
  });
});

describe('buildCafHexbinMapData', () => {
  test('joins on the h3 property, which promotes it to the feature id', () => {
    const [join] = buildCafHexbinMapData(grid);

    expect(join.mapId).toBe('caf-hexbin');
    expect(join.joinKey).toBe('h3');
  });

  test('leaves empty cells out of the join', () => {
    // A `value: 0` row would fall below the first threshold and paint the cell
    // in the palest band — "no CAF" reading as "a few CAFs". With no row it
    // resolves to the legend's `defaultColor` instead.
    const [join] = buildCafHexbinMapData(grid);

    expect(join.data).toEqual([{ geometryId: 'cheia', value: 42 }]);
  });

  test('still declares the join before the grid arrives', () => {
    // The join is what sets `promoteId`, so it has to be in the spec from the
    // first render or the ids never resolve.
    const [join] = buildCafHexbinMapData();

    expect(join.joinKey).toBe('h3');
    expect(join.data).toEqual([]);
  });
});

describe('cafHexbinBandColor', () => {
  test('gives every band a distinct colour, empty included', () => {
    const bands = [0, 1, 10, 100, 500, 2000, 8000].map(cafHexbinBandColor);

    expect(new Set(bands).size).toBe(bands.length);
  });

  test('treats an unjoined cell as empty', () => {
    expect(cafHexbinBandColor(null)).toBe(cafHexbinBandColor(0));
  });

  test('never lets a higher count fall into a lighter band', () => {
    const counts = [0, 1, 9, 10, 99, 100, 499, 500, 1999, 2000, 7999, 8000];
    const bands = counts.map(cafHexbinBandColor);

    // Monotonic by construction: a count only ever moves up the palette, so the
    // top band must be the last entry and the first must be the empty colour.
    expect(bands[0]).toBe(cafHexbinBandColor(0));
    expect(bands.at(-1)).toBe(cafHexbinBandColor(25358));
  });
});

import {
  applyCanonicalScales,
  buildCanonicalScalesTable,
  CANONICAL_SCALES,
  NO_DATA_COLOR,
} from 'src/app/api/ai/spec/canonicalScales';

import {
  buildCountLabels,
  CADINSAN_COLORS,
  CADINSAN_LEGEND_LABELS,
  CADINSAN_THRESHOLDS,
  COLORS,
  THRESHOLDS,
} from '@/app/(features)/mapas/geovisChoroplethScales';
import { mapTokens } from '@/config/theme';

/**
 * The reason `canonicalScales.ts` transcribes the ramps instead of importing
 * them: the route must not mount the Chakra theme to learn six hex values.
 * These assertions are what keeps the transcription honest — if a scale moves
 * in the feature module, the API's copy fails here rather than quietly
 * painting the AI maps with a different palette than the app's own.
 */
describe('CANONICAL_SCALES pins the application scales', () => {
  test('the kitchen-count scale matches geovisChoroplethScales', () => {
    const scale = CANONICAL_SCALES['cozinhas_geolocalizadas'];

    expect(scale.thresholds).toEqual(THRESHOLDS);
    expect(scale.colors).toEqual(COLORS);
    expect(scale.labels).toEqual(buildCountLabels(THRESHOLDS));
  });

  test('the 2025 snapshot reuses the same scale as the current one', () => {
    expect(CANONICAL_SCALES['cozinhas_geolocalizadas_2025']).toEqual(
      CANONICAL_SCALES['cozinhas_geolocalizadas']
    );
  });

  test('the CADINSAN scale matches geovisChoroplethScales', () => {
    const scale = CANONICAL_SCALES['municipios_cadinsan'];

    expect(scale.thresholds).toEqual(CADINSAN_THRESHOLDS);
    expect(scale.colors).toEqual(CADINSAN_COLORS);
    expect(scale.labels).toEqual(CADINSAN_LEGEND_LABELS);
  });

  test('the "sem dado" swatch is the theme token the app paints with', () => {
    expect(NO_DATA_COLOR).toBe(mapTokens.dataviz.color.status.masked);
  });

  test('only the IVS scale is published by an institution', () => {
    const official = Object.entries(CANONICAL_SCALES).flatMap(([id, scale]) => {
      return scale.official ? [id] : [];
    });

    expect(official).toEqual(['municipios_ivs']);
  });

  test('every scale renders one colour and one label per bin', () => {
    for (const [mapDataId, scale] of Object.entries(CANONICAL_SCALES)) {
      const bins = scale.thresholds.length + 1;

      expect({ mapDataId, colors: scale.colors.length }).toEqual({
        mapDataId,
        colors: bins,
      });
      expect({ mapDataId, labels: scale.labels.length }).toEqual({
        mapDataId,
        labels: bins,
      });
    }
  });

  test('an absolute total has no choropleth scale', () => {
    expect(CANONICAL_SCALES['cozinhas_pessoas_atendidas']).toBeUndefined();
  });
});

describe('buildCanonicalScalesTable', () => {
  test('renders one row per dataset, naming the origin of its breaks', () => {
    const table = buildCanonicalScalesTable();

    for (const mapDataId of Object.keys(CANONICAL_SCALES)) {
      expect(table).toContain(`\`${mapDataId}\``);
    }
    expect(table).toContain('faixas oficiais (IPEA');
    expect(table).toContain('escala de referência do app');
  });
});

describe('applyCanonicalScales', () => {
  const ivsSpec = {
    legends: [
      {
        id: 'legenda-ivs',
        title: 'Vulnerabilidade social',
        subtitle: 'Quanto mais avermelhado, maior o IVS',
        colorBy: {
          type: 'quantitative',
          property: 'ivs',
          scale: 'threshold',
          thresholds: [0.19, 0.28],
          colors: ['#111111', '#222222', '#333333'],
          defaultColor: '#FFFFFF',
        },
        labelFormat: { type: 'count', abbreviate: true },
        reference: 'Fonte inventada',
      },
    ],
    layers: [
      {
        id: 'fill',
        sourceId: 'municipios',
        mapDataId: 'municipios_ivs',
        activeLegendId: 'legenda-ivs',
      },
    ],
  };

  test('replaces the painted scale with the canonical one', () => {
    const result = applyCanonicalScales(ivsSpec);
    const legend = (result['legends'] as Array<Record<string, unknown>>)[0];
    const scale = CANONICAL_SCALES['municipios_ivs'];

    expect(legend['colorBy']).toEqual({
      type: 'quantitative',
      property: 'value',
      scale: 'threshold',
      thresholds: scale.thresholds,
      colors: scale.colors,
      defaultColor: NO_DATA_COLOR,
    });
    expect(legend['labelFormat']).toEqual({
      type: 'labels',
      labels: scale.labels,
    });
    expect(legend['reference']).toBe(scale.reference);
  });

  test("keeps the model's own copy, which carries the user's phrasing", () => {
    const result = applyCanonicalScales(ivsSpec);
    const legend = (result['legends'] as Array<Record<string, unknown>>)[0];

    expect(legend['title']).toBe('Vulnerabilidade social');
    expect(legend['subtitle']).toBe('Quanto mais avermelhado, maior o IVS');
  });

  test('does not mutate the spec it was given', () => {
    const before = JSON.stringify(ivsSpec);
    applyCanonicalScales(ivsSpec);

    expect(JSON.stringify(ivsSpec)).toBe(before);
  });

  test('normalizes a legend declared on the layer instead of the spec', () => {
    const spec = {
      layers: [
        {
          id: 'fill',
          mapDataId: 'municipios_cadinsan',
          activeLegendId: 'inline',
          legends: [{ id: 'inline', colorBy: { type: 'quantitative' } }],
        },
      ],
    };

    const layers = applyCanonicalScales(spec)['layers'] as Array<
      Record<string, unknown>
    >;
    const legend = (layers[0]['legends'] as Array<Record<string, unknown>>)[0];

    expect(
      (legend['colorBy'] as Record<string, unknown>)['thresholds']
    ).toEqual(CANONICAL_SCALES['municipios_cadinsan'].thresholds);
  });

  test('touches only the bound legend when the spec declares several', () => {
    const spec = {
      legends: [
        { id: 'status', colorBy: { type: 'categorical', mapping: {} } },
        { id: 'legenda-ivs', colorBy: { type: 'quantitative' } },
      ],
      layers: [
        {
          id: 'fill',
          mapDataId: 'municipios_ivs',
          activeLegendId: 'legenda-ivs',
        },
      ],
    };

    const legends = applyCanonicalScales(spec)['legends'] as Array<
      Record<string, unknown>
    >;

    expect(legends[0]).toBe(spec.legends[0]);
    expect(
      (legends[1]['colorBy'] as Record<string, unknown>)['thresholds']
    ).toEqual(CANONICAL_SCALES['municipios_ivs'].thresholds);
  });

  test('leaves a legend no layer binds to a known dataset untouched', () => {
    const spec = {
      legends: [{ id: 'status', colorBy: { type: 'categorical' } }],
      layers: [{ id: 'pts', activeLegendId: 'status' }],
    };

    expect(applyCanonicalScales(spec)).toBe(spec);
  });

  test('returns the spec itself when no layer carries a canonical dataset', () => {
    const spec = {
      legends: [{ id: 'l' }],
      layers: [{ id: 'fill', mapDataId: 'cozinhas_pessoas_atendidas' }],
    };

    expect(applyCanonicalScales(spec)).toBe(spec);
  });

  test('skips malformed layers and legends', () => {
    const spec = {
      legends: [null, { title: 'sem id' }],
      layers: [
        null,
        { id: 'fill', mapDataId: 'municipios_ivs', activeLegendId: 'legenda' },
        { id: 'other', legends: 'not-an-array' },
      ],
    };

    expect(() => {
      return applyCanonicalScales(spec);
    }).not.toThrow();
  });
});

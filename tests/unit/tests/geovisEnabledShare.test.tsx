import { execFileSync } from 'node:child_process';

import { renderHook } from '@testing-library/react';
import type { VisualizationSpec } from '@ttoss/geovis';

import {
  enabledShareRadius,
  withEnabledShare,
} from '@/app/(features)/mapas/geovisEnabledShare';
import { ENABLED_SHARE_LAYER_ID } from '@/app/(features)/mapas/geovisEnabledShareIds';
import { buildSpec } from '@/app/(features)/mapas/geovisSpec';
import { buildLeftSidebar } from '@/app/(features)/mapas/mapaLeftSidebar';
import { useEnabledShareSpec } from '@/app/(features)/mapas/useEnabledShareSpec';

import { enabledShareSnapshot } from '../fixtures/enabledShare';

const withMapaBoundaries = (spec: VisualizationSpec): VisualizationSpec => {
  return {
    ...spec,
    sources: [
      ...spec.sources,
      {
        id: 'municipios-boundary',
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    ],
  };
};
const validateSpec = (spec: VisualizationSpec): { status: string } => {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        "process.stdout.write(JSON.stringify(require('@ttoss/geovis').validateSpec(JSON.parse(process.argv[1]))))",
        JSON.stringify(spec),
      ],
      { encoding: 'utf8' }
    )
  );
};

test('adds an independent off-by-default toggle with stable ids and correct municipal join', () => {
  const spec = withEnabledShare({
    spec: withMapaBoundaries(buildSpec([])),
    snapshot: enabledShareSnapshot,
    active: false,
  });
  expect(
    spec.control?.items.find((item) => {
      return item.id === 'habilitadas-2025';
    })
  ).toMatchObject({ layers: [ENABLED_SHARE_LAYER_ID], defaultActive: false });
  expect(
    spec.layers.find((layer) => {
      return layer.id === ENABLED_SHARE_LAYER_ID;
    })?.visible
  ).toBe(false);
  expect(
    spec.mapData?.find((row) => {
      return row.mapDataId === 'cozinhas-habilitadas-participacao-2025-data';
    })
  ).toMatchObject({
    joinKey: 'codarea',
    data: [
      { geometryId: '3550308', value: 20 },
      { geometryId: '3304557', value: 10 },
    ],
  });
  expect(validateSpec(spec).status).toBe('resolved');
});

test('is geometrically proportional, including one-kitchen and zero cases', () => {
  const a = enabledShareRadius({ count: 1, maxCount: 4 });
  const b = enabledShareRadius({ count: 4, maxCount: 4 });
  expect(b / a).toBe(2);
  expect(b ** 2 / a ** 2).toBe(4);
  expect(enabledShareRadius({ count: 0, maxCount: 4 })).toBe(0);
  expect(enabledShareRadius({ count: 1, maxCount: 1 })).toBeCloseTo(
    38 / Math.sqrt(2)
  );
});

test('isolates its size scale and keeps circles below kitchen points across modes', () => {
  const base = withMapaBoundaries(buildSpec([], 'circulos-pessoas'));
  const spec = withEnabledShare({
    spec: base,
    snapshot: enabledShareSnapshot,
    active: true,
  });
  expect(spec.scaleMaxValue).toBeUndefined();
  expect(base.scaleMaxValue).toBeDefined();
  expect(
    spec.layers.find((layer) => {
      return layer.id === 'cozinhas-bolhas';
    })?.visible
  ).toBe(false);
  expect(
    spec.legends?.find((legend) => {
      return legend.id === 'legenda-pessoas-atendidas';
    })?.position
  ).toBeUndefined();
  expect(spec.layers.at(-1)?.id).toBe('cozinhas-pts');
  const layer = spec.layers.find((row) => {
    return row.id === ENABLED_SHARE_LAYER_ID;
  })!;
  expect(layer.sizeBy).toMatchObject({
    thresholds: [10, 20],
    transform: 'sqrt',
  });
  expect(layer.sizeBy!.range[0]).toBeCloseTo(38 / Math.sqrt(2));
  expect(layer.hoverTooltip?.render).toBeDefined();
  layer.hoverTooltip!.render({
    featureId: '3550308',
    layerId: layer.id,
    sourceId: layer.sourceId,
    value: 20,
    point: { x: 0, y: 0 },
  });
  expect(validateSpec(spec).status).toBe('resolved');
  const restored = withEnabledShare({
    spec: base,
    snapshot: enabledShareSnapshot,
    active: false,
  });
  expect(restored.scaleMaxValue).toBe(base.scaleMaxValue);
  expect(
    restored.layers.find((row) => {
      return row.id === 'cozinhas-bolhas';
    })?.visible
  ).toBe(true);
});

test('declares an empty loading layer without fabricating symbols', () => {
  const spec = withEnabledShare({
    spec: {
      ...withMapaBoundaries(buildSpec([])),
      mapData: undefined,
      legends: undefined,
      layers: [],
      control: undefined,
    },
    snapshot: null,
    active: false,
  });
  expect(spec.mapData?.at(-1)?.data).toEqual([]);
  expect(
    validateSpec(
      withEnabledShare({
        spec: withMapaBoundaries(buildSpec([])),
        snapshot: null,
        active: false,
      })
    ).status
  ).toBe('resolved');
  expect(validateSpec(spec).status).toBe('resolved');
  const zero = {
    ...enabledShareSnapshot,
    municipalities: [
      {
        ...enabledShareSnapshot.municipalities[0],
        enabledCount: 0,
        sharePercent: 0,
      },
    ],
  };
  expect(
    withEnabledShare({ spec, snapshot: zero, active: false }).mapData?.at(-1)
      ?.data
  ).toEqual([]);
});

test('pins the timeline while active and memoizes the overlay spec', () => {
  const timeline = buildLeftSidebar({
    mode: 'pontos',
    enabledShareActive: true,
  }).sections.find((row) => {
    return row.id === 'Timeline';
  });
  expect(timeline?.enabledWhen).toMatchObject({ values: [] });
  const state = {
    active: true,
    municipalActive: false,
    setMunicipalActive: jest.fn(),
    summary: false,
    setSummary: jest.fn(),
    snapshot: enabledShareSnapshot,
    loading: false,
    error: null,
    retry: jest.fn(),
    setActive: jest.fn(),
  };
  const spec = withMapaBoundaries(buildSpec([]));
  const { result, rerender } = renderHook(() => {
    return useEnabledShareSpec(spec, state);
  });
  const first = result.current;
  rerender();
  expect(result.current).toBe(first);
});

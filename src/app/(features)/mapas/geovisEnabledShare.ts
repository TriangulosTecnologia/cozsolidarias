import type {
  LegendSpec,
  MapHoverInfo,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import { mapTokens } from '@/config/mapTokens';
import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';

import { ENABLED_SHARE_LAYER_ID } from './geovisEnabledShareIds';
import { TOOLTIP_STYLE } from './mapaTooltipStyle';
import { renderEnabledShareTooltip } from './renderEnabledShareTooltip';

const buildControl = (control: VisualizationSpec['control']) => {
  return {
    id: 'camadas',
    label: 'Camadas',
    ...control,
    items: [
      ...(control?.items ?? []),
      {
        id: 'habilitadas-2025',
        label: 'Habilitadas / total nacional — 2025',
        layers: [ENABLED_SHARE_LAYER_ID],
        defaultActive: false,
      },
    ],
  };
};

const SOURCE_ID = 'cozinhas-habilitadas-2025';
const DATA_ID = 'cozinhas-habilitadas-participacao-2025-data';
const LEGEND_ID = 'legenda-habilitadas-participacao-2025';
/** Single-color proportional symbols; value is encoded only by area. @example ENABLED_SHARE_COLOR */
export const ENABLED_SHARE_COLOR = mapTokens.dataviz.color.sequential[4][9];

/**
 * Exact proportional radius, with a ceiling of at least two kitchens to keep
 * the scale strictly increasing even in a one-kitchen fixture.
 * @param params.count - Habilitadas represented by this symbol.
 * @param params.maxCount - Largest municipal numerator in this snapshot.
 * @returns Radius in pixels; zero means no symbol.
 * @example enabledShareRadius({ count: 1, maxCount: 4 }); // 19
 */
export const enabledShareRadius = ({
  count,
  maxCount,
}: {
  count: number;
  maxCount: number;
}): number => {
  return 38 * Math.sqrt(count / Math.max(maxCount, 2));
};

const hidePeopleLegend = (
  legends: LegendSpec[],
  active: boolean
): LegendSpec[] => {
  return legends.map((legend) => {
    if (active && legend.id === 'legenda-pessoas-atendidas') {
      const { position: _position, ...hidden } = legend;
      return hidden;
    }
    return legend;
  });
};

const buildLayer = ({
  snapshot,
  active,
  total,
  maxCount,
}: {
  snapshot: KitchenEnabledShare2025 | null;
  active: boolean;
  total: number;
  maxCount: number;
}): VisualizationLayer => {
  return {
    id: ENABLED_SHARE_LAYER_ID,
    sourceId: SOURCE_ID,
    geometry: 'point' as const,
    mapDataId: DATA_ID,
    activeLegendId: LEGEND_ID,
    visible: active,
    hoverTooltip: {
      render: (info: MapHoverInfo) => {
        return renderEnabledShareTooltip({ snapshot, info });
      },
      style: TOOLTIP_STYLE,
    },
    paint: {
      circleColor: ENABLED_SHARE_COLOR,
      circleOpacity: 0.65,
      circleStrokeColor: '#FAF9F7',
      circleStrokeWidth: 0.6,
    },
    sizeBy: {
      transform: 'sqrt' as const,
      thresholds: [100 / total, (100 * maxCount) / total],
      range: [enabledShareRadius({ count: 1, maxCount }), 38] as [
        number,
        number,
      ],
    },
  };
};

const snapshotValues = (snapshot: KitchenEnabledShare2025 | null) => {
  const rows =
    snapshot?.municipalities.filter((row) => {
      return row.enabledCount > 0;
    }) ?? [];
  const total = snapshot?.nationalTotal ?? 1;
  const maxCount = Math.max(
    2,
    ...rows.map((row) => {
      return row.enabledCount;
    })
  );
  return { rows, total, maxCount };
};

const buildFeatures = (rows: KitchenEnabledShare2025['municipalities']) => {
  const features = [...rows]
    .sort((a, b) => {
      return b.enabledCount - a.enabledCount;
    })
    .map((row) => {
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: row.anchor },
        properties: { codarea: row.codigoIbge },
      };
    });
  return features;
};

/**
 * Adds a stable, independently toggled municipal circle layer. Its local sqrt
 * scale interpolates from one kitchen's exact radius, not a visual minimum.
 * While active, other kitchen circle encodings are hidden to avoid conflicting
 * symbols and the spec-wide ceiling is removed (it overrides per-layer scales).
 * @param params.spec - Map spec after boundary groups have been added.
 * @param params.snapshot - Loaded canonical snapshot, null before activation.
 * @param params.active - Visibility reported by the runtime's layer control.
 * @returns The map with the fixed-2025 overlay below individual kitchen points.
 * @example withEnabledShare({ spec, snapshot, active: true });
 */
export const withEnabledShare = ({
  spec,
  snapshot,
  active,
}: {
  spec: VisualizationSpec;
  snapshot: KitchenEnabledShare2025 | null;
  active: boolean;
}): VisualizationSpec => {
  const { rows, total, maxCount } = snapshotValues(snapshot);
  const features = buildFeatures(rows);
  const result = {
    ...spec,
    control: buildControl(spec.control),
    sources: [
      ...spec.sources,
      {
        id: SOURCE_ID,
        type: 'geojson' as const,
        data: { type: 'FeatureCollection' as const, features },
      },
    ],
    mapData: [
      ...(spec.mapData ?? []),
      {
        mapDataId: DATA_ID,
        mapId: SOURCE_ID,
        joinKey: 'codarea',
        title: 'Habilitadas / total nacional — 2025',
        data: rows.map((row) => {
          return {
            geometryId: row.codigoIbge,
            value: row.sharePercent,
          };
        }),
      },
    ],
    legends: [
      ...hidePeopleLegend(spec.legends ?? [], active),
      {
        id: LEGEND_ID,
        title: 'Habilitadas / total nacional — 2025',
        colorBy: {
          type: 'categorical' as const,
          property: 'value',
          mapping: {},
          defaultColor: ENABLED_SHARE_COLOR,
        },
      },
    ],
    layers: [
      ...spec.layers
        .map((existing) => {
          return active && existing.id === 'cozinhas-bolhas'
            ? { ...existing, visible: false }
            : existing;
        })
        .filter((existing) => {
          return existing.id !== 'cozinhas-pts';
        }),
      buildLayer({ snapshot, active, total, maxCount }),
      ...spec.layers.filter((existing) => {
        return existing.id === 'cozinhas-pts';
      }),
    ],
  };
  if (active) delete result.scaleMaxValue;
  return result;
};

import type {
  HoverTooltipConfig,
  VisualizationLayer,
  VisualizationSpec,
} from '@ttoss/geovis';

import type {
  CadinsanByCity,
  KitchenEnabledShare2025,
} from '@/data-gateway/schema';

import { ENABLED_SHARE_LAYER_ID } from './geovisEnabledShareIds';
import {
  COVERAGE_DATA,
  COVERAGE_LEGEND,
  COVERAGE_SOURCE,
  coverageLegends,
  coverageMapData,
  coverageSources,
  SUMMARY_DATA,
  SUMMARY_LAYER,
  SUMMARY_SOURCE,
} from './geovisMunicipalCoverageData';
import { TOOLTIP_STYLE } from './mapaTooltipStyle';
import { municipalCoverageTooltip } from './municipalCoverageTooltip';
import {
  COVERAGE_TITLE,
  coverageRadius,
  type CoverageRow,
  MUNICIPAL_COVERAGE_LAYER_ID,
} from './municipalKitchenCoverage';

const coverageLayers = (
  rows: CoverageRow[],
  tooltip: HoverTooltipConfig,
  active: boolean,
  summary: boolean
): [VisualizationLayer, VisualizationLayer] => {
  const max = Math.max(
    2,
    ...rows.map((row) => {
      return row.registeredCount;
    })
  );
  return [
    {
      id: SUMMARY_LAYER,
      sourceId: SUMMARY_SOURCE,
      geometry: 'polygon',
      mapDataId: SUMMARY_DATA,
      visible: active && summary,
      activeLegendId: COVERAGE_LEGEND,
      hoverTooltip: tooltip,
      paint: { fillOpacity: 1, lineColor: '#FAF9F7' },
    },
    {
      id: MUNICIPAL_COVERAGE_LAYER_ID,
      sourceId: COVERAGE_SOURCE,
      geometry: 'point',
      mapDataId: COVERAGE_DATA,
      visible: active,
      activeLegendId: COVERAGE_LEGEND,
      hoverTooltip: tooltip,
      paint: { circleOpacity: 0, circleStrokeWidth: 0 },
      sizeBy: {
        transform: 'sqrt',
        thresholds: [1, max],
        range: [coverageRadius(1, max), 38],
      },
    },
  ];
};
const hideCompetingLayer = (
  layer: VisualizationLayer,
  active: boolean,
  summary: boolean
): VisualizationLayer => {
  if (!active) return layer;
  const competing = ['cozinhas-bolhas', 'cozinhas-pts', ENABLED_SHARE_LAYER_ID];
  if (competing.includes(layer.id)) return { ...layer, visible: false };
  if (summary && layer.id === 'municipios-br-fill')
    return { ...layer, visible: false };
  return layer;
};

/** Independent municipal denominator; synthesis has its own source/state join. */
export const withMunicipalCoverage = ({
  spec,
  snapshot,
  active,
  summary,
  risks,
  scenario,
}: {
  spec: VisualizationSpec;
  snapshot: KitchenEnabledShare2025 | null;
  active: boolean;
  summary: boolean;
  risks: CadinsanByCity[];
  scenario: 'com' | 'sem';
}): VisualizationSpec => {
  const rows = snapshot?.municipalCoverage ?? [];
  const tooltip: HoverTooltipConfig = {
    render: (info) => {
      return municipalCoverageTooltip(String(info.featureId), rows, risks);
    },
    style: TOOLTIP_STYLE,
  };
  const [fill, circle] = coverageLayers(rows, tooltip, active, summary);
  const result: VisualizationSpec = {
    ...spec,
    control: {
      id: 'camadas',
      label: 'Camadas',
      ...spec.control,
      items: [
        ...(spec.control?.items ?? []).filter((item) => {
          return !active || !['cozinhas', 'habilitadas-2025'].includes(item.id);
        }),
        {
          id: 'habilitacao-municipal-2025',
          label: COVERAGE_TITLE,
          layers: [MUNICIPAL_COVERAGE_LAYER_ID],
          defaultActive: false,
        },
      ],
    },
    sources: coverageSources(spec, rows),
    mapData: coverageMapData(spec, rows, risks, scenario),
    legends: coverageLegends(spec, active, summary),
    layers: [
      fill,
      ...spec.layers.map((layer) => {
        return hideCompetingLayer(layer, active, summary);
      }),
      circle,
    ],
  };
  if (active) delete result.scaleMaxValue;
  return result;
};

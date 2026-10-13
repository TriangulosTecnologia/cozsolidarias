import type { VisualizationSpec } from '@ttoss/geovis';

import type { CadinsanByCity } from '@/data-gateway/schema';

import {
  BIVARIATE_COLORS,
  COVERAGE_TITLE,
  coverageClass,
  coverageRiskCuts,
  type CoverageRow,
  scenarioRisk,
} from './municipalKitchenCoverage';

export const COVERAGE_SOURCE = 'habilitacao-municipal-2025-source';
export const SUMMARY_SOURCE = 'habilitacao-municipal-2025-polygons';
export const COVERAGE_DATA = 'habilitacao-municipal-2025-data';
export const SUMMARY_DATA = 'habilitacao-municipal-2025-summary';
export const COVERAGE_LEGEND = 'habilitacao-municipal-2025-legend';
export const SUMMARY_LAYER = 'habilitacao-municipal-2025-fill';

const summaryRows = (
  rows: CoverageRow[],
  risks: CadinsanByCity[],
  scenario: 'com' | 'sem'
) => {
  const byCode = new Map(
    risks.map((row) => {
      return [row.codigoIbge, row];
    })
  );
  const kitchens = new Map(
    rows.map((row) => {
      return [row.codigoIbge, row];
    })
  );
  const cuts = coverageRiskCuts(risks);
  const codes = new Set([...byCode.keys(), ...kitchens.keys()]);
  return [...codes].map((code) => {
    const row = kitchens.get(code);
    const value = scenarioRisk(byCode.get(code), scenario);
    if (!row) return { geometryId: code, value: 'no-kitchen' };
    if (value === null || value === undefined)
      return { geometryId: code, value: 'no-risk' };
    return {
      geometryId: code,
      value: coverageClass(value, row.enabledPercent, cuts),
    };
  });
};

export const coverageSources = (
  spec: VisualizationSpec,
  rows: CoverageRow[]
): VisualizationSpec['sources'] => {
  const base = spec.sources.find((source) => {
    return source.id === 'municipios-boundary';
  })!;
  return [
    ...spec.sources,
    {
      id: COVERAGE_SOURCE,
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [...rows]
          .sort((a, b) => {
            return b.registeredCount - a.registeredCount;
          })
          .map((row) => {
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: row.anchor },
              properties: { codarea: row.codigoIbge },
            };
          }),
      },
    },
    { ...base, id: SUMMARY_SOURCE },
  ];
};
export const coverageMapData = (
  spec: VisualizationSpec,
  rows: CoverageRow[],
  risks: CadinsanByCity[],
  scenario: 'com' | 'sem'
): VisualizationSpec['mapData'] => {
  return [
    ...(spec.mapData ?? []),
    {
      mapDataId: COVERAGE_DATA,
      mapId: COVERAGE_SOURCE,
      joinKey: 'codarea',
      data: rows.map((row) => {
        return {
          geometryId: row.codigoIbge,
          value: row.registeredCount,
        };
      }),
    },
    {
      mapDataId: SUMMARY_DATA,
      mapId: SUMMARY_SOURCE,
      joinKey: 'codarea',
      data: summaryRows(rows, risks, scenario),
    },
  ];
};
export const coverageLegends = (
  spec: VisualizationSpec,
  active: boolean,
  summary: boolean
): VisualizationSpec['legends'] => {
  return [
    ...(spec.legends ?? []).map((legend) => {
      if (active && (summary || legend.id === 'legenda-pessoas-atendidas')) {
        const { position: _position, ...hidden } = legend;
        return hidden;
      }
      return legend;
    }),
    {
      id: COVERAGE_LEGEND,
      title: COVERAGE_TITLE,
      colorBy: {
        type: 'categorical',
        property: 'value',
        mapping: {
          ...Object.fromEntries(
            BIVARIATE_COLORS.map((color, i) => {
              return [String(i), color];
            })
          ),
          'no-kitchen': '#FAF9F7',
          'no-risk': '#999999',
        },
        defaultColor: '#666666',
      },
    },
  ];
};

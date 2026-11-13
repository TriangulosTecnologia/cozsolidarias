import { type GeoVisIssue, validateSpec } from '@ttoss/geovis';

import baseVisualizationSpecJson from './instructions/baseVisualizationSpec.json';
import { isRenderableDatasetId } from './mapDataCatalogue';
import { resolveCandidate } from './serveSpec';
import { mergeSpecs } from './specDefaults';
import { applyLocalRepairs, repairMapDataWiring } from './specRepairs';
import {
  findChoroplethOnAbsoluteTotal,
  findGeometryInMapData,
  findInvalidBasemapStyleUrl,
  findInvalidGeojsonSource,
  findMissingLegend,
  findPointLayerOnPolygonSource,
  findReclassifiedOfficialIndex,
  findUnresolvableLayerSource,
  hoistLayerLegends,
  isRecord,
  KNOWN_BASEMAP_STYLE_URLS,
  KNOWN_SOURCE_URLS,
  officialFaixaBreaks,
  type SpecIssue,
  type UnknownRecord,
  unsupportedDatasetMessage,
} from './specValidation';

/** One `unsupported-dataset` issue per `mapData` entry outside the renderable list. */
const unsupportedDatasetIssues = (spec: UnknownRecord): SpecIssue[] => {
  const mapData = spec['mapData'];
  return (Array.isArray(mapData) ? mapData : []).flatMap((entry) => {
    const mapDataId = isRecord(entry) ? entry['mapDataId'] : undefined;
    return typeof mapDataId === 'string' && !isRenderableDatasetId(mapDataId)
      ? [
          {
            code: 'unsupported-dataset',
            path: `mapData[${mapDataId}].mapDataId`,
            message: unsupportedDatasetMessage(mapDataId),
          },
        ]
      : [];
  });
};

/** One `reclassified-official-index` issue when an IVS/IDHM legend departs from the official IPEA faixas. */
const reclassifiedOfficialIndexIssues = (spec: UnknownRecord): SpecIssue[] => {
  const mapDataId = findReclassifiedOfficialIndex(spec);
  return mapDataId
    ? [
        {
          code: 'reclassified-official-index',
          path: `mapData[${mapDataId}]`,
          message: `A legend de "${mapDataId}" usa faixas diferentes das oficiais do IPEA. IVS e IDHM são índices oficiais: não reclassifique (Jenks, quantis, palpite). Use exatamente estes limiares: ${officialFaixaBreaks(mapDataId).join(', ')}.`,
        },
      ]
    : [];
};

/** Issues about how layers use their sources and datasets (area bias, point layers on polygons). */
const layerIssues = (spec: UnknownRecord): SpecIssue[] => {
  const issues: SpecIssue[] = [];

  const pointLayerId = findPointLayerOnPolygonSource(spec);
  if (pointLayerId) {
    issues.push({
      code: 'point-layer-on-polygon-source',
      path: `layers[${pointLayerId}].sourceId`,
      message: `A layer de pontos "${pointLayerId}" usa uma source de polígonos (/geo/*). Declare a source de pontos do pedido (ex.: /api/cozinhas/bolhas, um círculo por município) e aponte a layer e o "mapData[].mapId" para ela.`,
    });
  }

  const choroplethMapDataId = findChoroplethOnAbsoluteTotal(spec);
  if (choroplethMapDataId) {
    issues.push({
      code: 'choropleth-on-absolute-total',
      path: 'mapType',
      message: `O dataset "${choroplethMapDataId}" é um total absoluto, nunca uma variável relativa — pintá-lo como coroplético (mapType "choropleth") introduz viés de tamanho do polígono. Use pontos proporcionais ou dot density.`,
    });
  }

  return issues;
};

/**
 * Runs this route's own structural checks (everything `validateSpec` cannot
 * know about the app: served URLs, basemap styles, geometry smuggled into
 * `mapData`, the top-level legend rule, the absolute-total choropleth rule and
 * the renderable-dataset list) and returns every violation instead of the
 * first, so one validation round reports all of them.
 *
 * @param spec - The candidate spec, after {@link normalizeCandidate}.
 * @returns The violations found; empty when the spec passes every check.
 *
 * @example
 * collectStructuralIssues({ sources: [{ id: 'a', type: 'geojson', data: '/x.json' }] });
 * // → [{ code: 'unknown-source-url', path: 'sources[a].data', ... }]
 */
export const collectStructuralIssues = (spec: UnknownRecord): SpecIssue[] => {
  const issues: SpecIssue[] = [];

  const invalidSourceId = findInvalidGeojsonSource(spec);
  if (invalidSourceId) {
    issues.push({
      code: 'unknown-source-url',
      path: `sources[${invalidSourceId}].data`,
      message: `A source "${invalidSourceId}" não referencia um endpoint real de geometria (URLs válidas: ${KNOWN_SOURCE_URLS.join(', ')}) ou veio com uma coleção de feições vazia inventada pelo modelo.`,
    });
  }

  const unresolvableLayerId = findUnresolvableLayerSource(spec);
  if (unresolvableLayerId) {
    issues.push({
      code: 'unresolvable-layer-source',
      path: `layers[${unresolvableLayerId}].sourceId`,
      message: `A layer "${unresolvableLayerId}" aponta para uma source que não foi declarada em "sources" nem é uma das fontes do app (${KNOWN_SOURCE_URLS.join(', ')}). Declare a source ou use o id de uma fonte conhecida.`,
    });
  }

  const invalidBasemapStyleUrl = findInvalidBasemapStyleUrl(spec);
  if (invalidBasemapStyleUrl) {
    issues.push({
      code: 'unknown-basemap-style',
      path: 'basemap.styleUrl',
      message: `"basemap.styleUrl" traz "${invalidBasemapStyleUrl}", que não é um estilo MapLibre suportado (estilos válidos: ${KNOWN_BASEMAP_STYLE_URLS.join(', ')}). Omita o campo para usar o estilo padrão do app.`,
    });
  }

  const geometryMapDataId = findGeometryInMapData(spec);
  if (geometryMapDataId) {
    issues.push({
      code: 'geometry-in-map-data',
      path: `mapData[${geometryMapDataId}]`,
      message: `O item "${geometryMapDataId}" de "mapData" carrega geometria (repete o id de uma source, ou traz uma FeatureCollection embutida) em vez de um valor de join por "geometryId".`,
    });
  }

  if (findMissingLegend(spec)) {
    issues.push({
      code: 'missing-legend',
      path: 'legends',
      message:
        'Todo spec com uma variável pintada precisa de ao menos uma legend de primeiro nível ("legends[]") descrevendo-a.',
    });
  }

  return [
    ...issues,
    ...layerIssues(spec),
    ...reclassifiedOfficialIndexIssues(spec),
    ...unsupportedDatasetIssues(spec),
  ];
};

/** Checks that only hold once `mapType` is resolved: a minimal spec has no legend yet, and the server replaces Jenks breaks by the official faixas. */
const RESOLUTION_DEPENDENT_CODES = [
  'missing-legend',
  'reclassified-official-index',
];

/** Checked again once resolved: the resolver itself can draw a point layer on polygons (`dotDensity`). */
const RESOLVED_STAGE_CODES = [
  ...RESOLUTION_DEPENDENT_CODES,
  'point-layer-on-polygon-source',
];

/**
 * {@link collectStructuralIssues} on the agent's own spec, before resolution:
 * every check except the resolution-dependent ones.
 * @example
 * collectPreResolutionIssues({ mapType: 'choropleth', mapData: [{ mapDataId: 'municipios_ivs' }] }); // []
 */
export const collectPreResolutionIssues = (
  spec: UnknownRecord
): SpecIssue[] => {
  return collectStructuralIssues(spec).filter((issue) => {
    return !RESOLUTION_DEPENDENT_CODES.includes(issue.code);
  });
};

/**
 * The resolution-dependent checks of {@link collectStructuralIssues}, on the
 * resolved spec (the others already ran on the agent spec, and would misread
 * the `/mapas` builder's own `mapDataId`s).
 * @example
 * collectResolvedIssues({ mapData: [{ mapDataId: 'municipios_ivs' }], legends: [] }); // [missing-legend]
 */
export const collectResolvedIssues = (spec: UnknownRecord): SpecIssue[] => {
  return collectStructuralIssues(spec).filter((issue) => {
    return RESOLVED_STAGE_CODES.includes(issue.code);
  });
};

const toSpecIssue = (issue: GeoVisIssue): SpecIssue => {
  return {
    code: issue.code,
    path: issue.subject.path,
    message: issue.message,
  };
};

/**
 * Runs `validateSpec`, applies every deterministic repair
 * ({@link applyLocalRepairs}) and re-validates once, so only issues that need
 * a real decision remain. Used on the spec actually served, after real data
 * is resolved.
 *
 * @param spec - The spec to validate.
 * @returns The (possibly repaired) spec and the remaining geovis issues.
 *
 * @example
 * const { spec: served, issues } = validateWithLocalRepairs(resolvedSpec);
 */
export const validateWithLocalRepairs = (
  input: UnknownRecord
): { spec: UnknownRecord; issues: SpecIssue[] } => {
  const spec = repairMapDataWiring(input);
  const first = validateSpec(spec);
  if (first.status === 'resolved') {
    return { spec, issues: [] };
  }

  const repaired = applyLocalRepairs({ spec, issues: first.issues });
  const second = repaired === spec ? first : validateSpec(repaired);
  return {
    spec: repaired,
    issues: second.status === 'resolved' ? [] : second.issues.map(toSpecIssue),
  };
};

/**
 * Applies every deterministic repair that needs no model round-trip, before
 * any structural check reads the spec: hoists layer-scoped legends, then
 * repairs the `mapData` wiring. Structural checks must run on this output,
 * otherwise they report issues the repairs already fixed.
 *
 * @param spec - The spec the model proposed.
 * @returns The normalized spec; the same content as `spec` when nothing needed repair.
 *
 * @example
 * normalizeCandidate({ layers: [{ id: 'a', legends: [{ id: 'l' }] }] });
 * // → { layers: [{ id: 'a' }], legends: [{ id: 'l' }] }
 */
export const normalizeCandidate = (spec: UnknownRecord): UnknownRecord => {
  return repairMapDataWiring(hoistLayerLegends(spec));
};

/**
 * Validates one candidate spec the model proposed — the body of the
 * `validate_spec` tool. Normalizes it ({@link normalizeCandidate}), runs the
 * pre-resolution checks, then merges it over the base spec and resolves it
 * like the route does ({@link resolveCandidate}) before the resolution checks
 * and {@link validateWithLocalRepairs}.
 *
 * @param spec - The candidate the model proposed.
 * @returns The normalized candidate (never the resolved one, which carries
 * every data row) and the issues that remain; empty when it is valid.
 * @example
 * const { spec: repaired, issues } = await validateCandidate(modelSpec);
 */
export const validateCandidate = async (
  spec: unknown
): Promise<{ spec: unknown; issues: SpecIssue[] }> => {
  if (!isRecord(spec)) {
    return {
      spec,
      issues: [
        {
          code: 'invalid-spec-shape',
          path: '',
          message: 'A spec precisa ser um objeto JSON.',
        },
      ],
    };
  }

  const normalized = normalizeCandidate(spec);
  // A gateway failure is not the model's to repair: it is reported as an
  // issue, so the generation is not aborted as an agent failure.
  const resolved = await resolveCandidate(
    mergeSpecs(baseVisualizationSpecJson as UnknownRecord, normalized)
  ).catch(() => {
    return null;
  });
  // A rejected spec is one issue carrying the route's own 422 message.
  const resolutionIssues =
    resolved === null || resolved instanceof Response
      ? [
          {
            code: 'unresolvable-spec',
            path: '',
            message:
              resolved === null
                ? 'Não foi possível ler os dados para validar o spec agora.'
                : ((await resolved.json()) as { message: string }).message,
          },
        ]
      : [
          ...collectResolvedIssues(resolved),
          ...validateWithLocalRepairs(resolved).issues,
        ];
  return {
    spec: normalized,
    issues: [...collectPreResolutionIssues(normalized), ...resolutionIssues],
  };
};

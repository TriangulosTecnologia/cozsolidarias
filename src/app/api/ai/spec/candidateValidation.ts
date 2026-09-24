import {
  type GeoVisIssue,
  type RepairOption,
  validateSpec,
} from '@ttoss/geovis';

import { isRenderableDatasetId } from './mapDataCatalogue';
import {
  findChoroplethOnAbsoluteTotal,
  findGeometryInMapData,
  findInvalidBasemapStyleUrl,
  findInvalidGeojsonSource,
  findMissingLegend,
  hoistLayerLegends,
  isRecord,
  KNOWN_BASEMAP_STYLE_URLS,
  KNOWN_SOURCE_URLS,
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

/**
 * Runs this route's own structural checks (everything `validateSpec` cannot
 * know about the app: served URLs, basemap styles, geometry smuggled into
 * `mapData`, the top-level legend rule, the absolute-total choropleth rule and
 * the renderable-dataset list) and returns every violation instead of the
 * first, so one validation round reports all of them.
 *
 * @param spec - The candidate spec, after {@link hoistLayerLegends}.
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

  const choroplethMapDataId = findChoroplethOnAbsoluteTotal(spec);
  if (choroplethMapDataId) {
    issues.push({
      code: 'choropleth-on-absolute-total',
      path: 'mapType',
      message: `O dataset "${choroplethMapDataId}" é um total absoluto, nunca uma variável relativa — pintá-lo como coroplético (mapType "choropleth") introduz viés de tamanho do polígono. Use pontos proporcionais ou dot density.`,
    });
  }

  return [...issues, ...unsupportedDatasetIssues(spec)];
};

const REPAIR_PATH_SEGMENT = /^([^[\]]+)(?:\[([^\]]+)\])?$/;

/**
 * Immutably writes `value` at a geovis repair path inside `node` —
 * dot-separated segments, each optionally keyed by an array entry's
 * `id`/`mapDataId` (`layers[fill].sourceId`, `view.pitch`). A path that does
 * not resolve leaves the node unchanged.
 */
const setInRecord = (
  node: UnknownRecord,
  segments: string[],
  value: unknown
): UnknownRecord => {
  const match = REPAIR_PATH_SEGMENT.exec(segments[0]);
  if (!match) {
    return node;
  }

  const [, key, id] = match;
  const rest = segments.slice(1);
  const write = (child: unknown): unknown => {
    if (rest.length === 0) {
      return value;
    }
    return isRecord(child) ? setInRecord(child, rest, value) : child;
  };

  if (id === undefined) {
    return { ...node, [key]: write(node[key]) };
  }

  const list = node[key];
  if (!Array.isArray(list)) {
    return node;
  }
  return {
    ...node,
    [key]: list.map((item) => {
      return isRecord(item) && (item['id'] === id || item['mapDataId'] === id)
        ? write(item)
        : item;
    }),
  };
};

/** The value a repair can apply without asking: a `set-value`, or a single allowed value. */
const autoRepairValue = (repair: RepairOption): { value: unknown } | null => {
  if (repair.kind === 'set-value') {
    return { value: repair.value };
  }
  return repair.values.length === 1 ? { value: repair.values[0] } : null;
};

/**
 * Applies, without a model round-trip, every geovis repair whose answer is
 * already known: each `set-value`, and each `allowed-values` with exactly one
 * candidate. An `allowed-values` with two or more candidates is a genuine
 * choice and is left for the model.
 *
 * @param params.spec - The spec the issues were found in.
 * @param params.issues - The `validateSpec` issues, carrying their `repair`.
 * @returns The same reference when nothing was applicable; otherwise the repaired spec.
 *
 * @example
 * applyLocalRepairs({ spec, issues: [{ code: 'unsupported-engine', subject: { path: 'engine' }, message: '', repair: [{ kind: 'set-value', path: 'engine', value: 'maplibre' }] }] });
 */
export const applyLocalRepairs = (params: {
  spec: UnknownRecord;
  issues: GeoVisIssue[];
}): UnknownRecord => {
  return params.issues.reduce<UnknownRecord>((current, issue) => {
    return (issue.repair ?? []).reduce<UnknownRecord>((acc, repair) => {
      const applicable = autoRepairValue(repair);
      if (!applicable) {
        return acc;
      }
      return setInRecord(acc, repair.path.split('.'), applicable.value);
    }, current);
  }, params.spec);
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
  spec: UnknownRecord
): { spec: UnknownRecord; issues: SpecIssue[] } => {
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
 * Validates one candidate spec the model proposed: hoists layer-scoped
 * legends, runs {@link collectStructuralIssues} and
 * {@link validateWithLocalRepairs}. Only what is left needs the model — this
 * is the body of the `validate_spec` tool.
 *
 * @param spec - The candidate the model proposed.
 * @returns The repaired spec and the issues that remain; `issues` is empty
 * when the candidate is valid.
 *
 * @example
 * const { spec: repaired, issues } = validateCandidate(modelSpec);
 */
export const validateCandidate = (
  spec: unknown
): { spec: unknown; issues: SpecIssue[] } => {
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

  const hoisted = hoistLayerLegends(spec);
  const structural = collectStructuralIssues(hoisted);
  const checked = validateWithLocalRepairs(hoisted);
  return { spec: checked.spec, issues: [...structural, ...checked.issues] };
};

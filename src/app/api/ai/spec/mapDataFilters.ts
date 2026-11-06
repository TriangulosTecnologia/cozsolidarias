import {
  filterOn,
  type ParsedFilter,
  parseMapDataFilter,
  type ServerFilter,
} from './fieldFilters';
import type { RenderableDatasetId } from './mapDataCatalogue';
import {
  invalidSpecResponse,
  isRecord,
  type SpecIssue,
  type UnknownRecord,
  withoutFilter,
} from './specValidation';

/**
 * One `filter` the agent wrote on a `mapData` entry, with the entry's position
 * and `mapDataId` as written (possibly not text): entries may share an id, so
 * the position is the key.
 *
 * @example
 * const filter: EntryFilter = { index: 0, mapDataId: 'x', filter: { situacao: 'Mapeada' } };
 */
export type EntryFilter = {
  index: number;
  mapDataId: unknown;
  filter: unknown;
};

/**
 * The `filter` of each `mapData` entry that carries one, in entry order,
 * whatever its `mapDataId`: the value the agent recognized in the catalogue's
 * `filters`.
 *
 * @param spec - A candidate spec.
 * @returns The filters, as the agent wrote them.
 *
 * @example
 * filtersOf({ mapData: [{ mapDataId: 'x', filter: { situacao: 'Mapeada' } }] });
 * // [{ index: 0, mapDataId: 'x', filter: { situacao: 'Mapeada' } }]
 */
export const filtersOf = (spec: UnknownRecord): EntryFilter[] => {
  const mapData = Array.isArray(spec['mapData']) ? spec['mapData'] : [];
  return mapData.flatMap((entry, index): EntryFilter[] => {
    return isRecord(entry) && 'filter' in entry
      ? [{ index, mapDataId: entry['mapDataId'], filter: entry['filter'] }]
      : [];
  });
};

/**
 * One `invalid-filter` issue per `filter` that `parseMapDataFilter` refuses.
 *
 * @param filters - The output of {@link filtersOf}.
 * @returns The issues, in entry order.
 *
 * @example
 * invalidFilterIssues([{ index: 0, mapDataId: 'municipios_ivs', filter: { situacao: 'x' } }])[0].code; // 'invalid-filter'
 */
export const invalidFilterIssues = (filters: EntryFilter[]): SpecIssue[] => {
  return filters.flatMap(({ index, mapDataId, filter }) => {
    const parsed = parseMapDataFilter({ mapDataId, filter });
    return typeof parsed === 'string'
      ? [
          {
            code: 'invalid-filter',
            path: `mapData[${index}].filter`,
            message: parsed,
          },
        ]
      : [];
  });
};

/**
 * One item of the agent's `filters`: the filter it set on the `mapData`
 * entries of `mapDataId`. The agent sends filters beside the spec, never in
 * it, because its `output_schema` (the geovis spec) refuses any extra
 * property on a `mapData` entry.
 *
 * @example
 * const filter: ReplyFilter = { mapDataId: 'cozinhas_geolocalizadas_2025', filter: { situacao: 'Mapeada' } };
 */
export type ReplyFilter = { mapDataId: unknown; filter: unknown };

/**
 * The spec with no `filter` on any `mapData` entry: the geovis spec the agent
 * sends and gets back (see {@link ReplyFilter}).
 *
 * @param spec - A spec.
 * @returns The spec without entry filters; `spec` itself when it has no `mapData` array.
 *
 * @example
 * withoutFilters({ mapData: [{ mapDataId: 'x', filter: { situacao: 'Mapeada' } }] });
 * // { mapData: [{ mapDataId: 'x' }] }
 */
export const withoutFilters = (spec: UnknownRecord): UnknownRecord => {
  const mapData = spec['mapData'];
  return Array.isArray(mapData)
    ? {
        ...spec,
        mapData: mapData.map((entry) => {
          return isRecord(entry) ? withoutFilter(entry) : entry;
        }),
      }
    : spec;
};

const FILTERS_SHAPE_MESSAGE =
  '"filters" precisa ser uma lista de {"mapDataId": "<id de uma entrada do mapData>", "filter": {"<campo>": "<valor>"}}, fora do spec.';

/**
 * Moves the agent's `filters` onto the `mapData` entries they name, as the
 * entry `filter` the server reads (see {@link filtersOf}). A `filters` item
 * overrides a `filter` already on an entry; with no `filters`, `spec` is
 * returned as is. A `filters` that is not a list, or an item naming no entry,
 * is an `invalid-filter` issue: a filter is never dropped silently.
 *
 * @param params.spec - The spec the agent sent.
 * @param params.filters - The `filters` the agent sent beside it, as received.
 * @returns The spec with the filters on its entries, and the issues.
 *
 * @example
 * attachFilters({
 *   spec: { mapData: [{ mapDataId: 'x' }] },
 *   filters: [{ mapDataId: 'x', filter: { situacao: 'Mapeada' } }],
 * }).spec; // { mapData: [{ mapDataId: 'x', filter: { situacao: 'Mapeada' } }] }
 */
export const attachFilters = (params: {
  spec: UnknownRecord;
  filters: unknown;
}): { spec: UnknownRecord; issues: SpecIssue[] } => {
  const { spec, filters } = params;
  if (filters === undefined || filters === null) {
    return { spec, issues: [] };
  }
  if (!Array.isArray(filters)) {
    return {
      spec,
      issues: [
        {
          code: 'invalid-filter',
          path: 'filters',
          message: FILTERS_SHAPE_MESSAGE,
        },
      ],
    };
  }
  const mapData = Array.isArray(spec['mapData']) ? spec['mapData'] : [];
  const issues = filters.flatMap((item, index): SpecIssue[] => {
    const named =
      isRecord(item) &&
      mapData.some((entry) => {
        return isRecord(entry) && entry['mapDataId'] === item['mapDataId'];
      });
    return named
      ? []
      : [
          {
            code: 'invalid-filter',
            path: `filters[${index}]`,
            message: FILTERS_SHAPE_MESSAGE,
          },
        ];
  });
  if (mapData.length === 0) {
    return { spec, issues };
  }
  return {
    spec: {
      ...spec,
      mapData: mapData.map((entry) => {
        if (!isRecord(entry)) {
          return entry;
        }
        const item = filters.find((candidate): candidate is UnknownRecord => {
          return (
            isRecord(candidate) && candidate['mapDataId'] === entry['mapDataId']
          );
        });
        return item === undefined
          ? entry
          : { ...entry, filter: item['filter'] };
      }),
    },
    issues,
  };
};

/**
 * The filter the server resolved for the chosen dataset, keyed by its id, for
 * the append to apply whatever the agent wrote; the spec itself is left as
 * is, so every later 422 still carries the merged spec. A different `filter`
 * the agent set on that dataset is a 422: the server's resolution wins, never
 * silently.
 *
 * @param params.spec - The merged spec.
 * @param params.chosen - The dataset the preflight resolved or the user chose.
 * @param params.filter - The filter the preflight resolved for `chosen`.
 * @returns The filter by dataset id (empty without one), or the 422.
 *
 * @example
 * serverFilters({ spec, chosen: 'cozinhas_geolocalizadas_2025', filter: { field: 'situacao', value: 'Habilitada' } });
 */
export const serverFilters = (params: {
  spec: UnknownRecord;
  chosen?: RenderableDatasetId;
  filter?: ServerFilter;
}): Map<string, ParsedFilter> | Response => {
  const { spec, chosen, filter } = params;
  const parsed =
    chosen && filter ? filterOn({ baseId: chosen, ...filter }) : undefined;
  if (!parsed) {
    return new Map();
  }
  const wanted = JSON.stringify({ [parsed.field]: parsed.value });
  const clash = filtersOf(spec).some(({ mapDataId, filter: entryFilter }) => {
    return (
      mapDataId === parsed.baseId && JSON.stringify(entryFilter) !== wanted
    );
  });
  return clash
    ? invalidSpecResponse({
        message: `O modelo aplicou em "${parsed.baseId}" um recorte diferente do escolhido (${parsed.field} = ${parsed.value}). Tente reformular o pedido.`,
        spec,
      })
    : new Map([[parsed.baseId, parsed]]);
};

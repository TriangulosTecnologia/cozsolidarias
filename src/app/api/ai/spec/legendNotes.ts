import {
  coverageNotes,
  filterNote,
  type ParsedFilter,
  parseMapDataFilter,
} from './fieldFilters';
import { filtersOf } from './mapDataFilters';
import {
  hoistLayerLegends,
  isRecord,
  type UnknownRecord,
} from './specValidation';

/** The string `mapDataId`s of a spec whose `mapData` the append already accepted as a list. */
const mapDataIdsOf = (spec: UnknownRecord): string[] => {
  return [spec['mapData']].flat().flatMap((entry) => {
    return isRecord(entry) && typeof entry['mapDataId'] === 'string'
      ? [entry['mapDataId']]
      : [];
  });
};

/**
 * `[legendId, mapDataId]` for each layer that shows an existing legend. A
 * layer painting no `mapData` entry (e.g. by `propertyName`) still links its
 * legend, with `mapDataId` `null`.
 */
const legendLinks = (params: {
  layers: unknown[];
  legendIds: Set<string>;
}): Array<[string, string | null]> => {
  return params.layers.flatMap((layer): Array<[string, string | null]> => {
    if (!isRecord(layer)) {
      return [];
    }
    const { activeLegendId, mapDataId } = layer;
    return typeof activeLegendId === 'string' &&
      params.legendIds.has(activeLegendId)
      ? [[activeLegendId, typeof mapDataId === 'string' ? mapDataId : null]]
      : [];
  });
};

/** The distinct notes of `ids`, joined; empty when none is noted. */
const joinNotes = (params: {
  notes: Map<string, string>;
  ids: string[];
}): string => {
  return [
    ...new Set(
      params.ids.flatMap((id) => {
        const note = params.notes.get(id);
        return note === undefined ? [] : [note];
      })
    ),
  ].join(' ');
};

/** One legend with `note` appended to its `subtitle`, or as it is without a note. */
const noteLegend = (params: {
  legend: UnknownRecord;
  note: string;
}): UnknownRecord => {
  const { legend, note } = params;
  if (note === '') {
    return legend;
  }
  const subtitle = legend['subtitle'];
  return {
    ...legend,
    subtitle:
      typeof subtitle === 'string' && subtitle !== ''
        ? `${subtitle} · ${note}`
        : note,
  };
};

/**
 * The note each legend id carries: a legend any layer links gets the notes of
 * the datasets whose layers link it, so another dataset's or another source's
 * legend never gets one; a legend no layer links gets the notes of the noted
 * datasets that link none.
 * With `whole`, the spec paints only the noted dataset, so every legend
 * gets every note.
 */
const notesByLegend = (params: {
  spec: UnknownRecord;
  legendIds: Set<string>;
  notes: Map<string, string>;
  whole: boolean;
}): ((legendId: string) => string) => {
  const noted = [...params.notes.keys()];
  if (params.whole) {
    return () => {
      return joinNotes({ notes: params.notes, ids: noted });
    };
  }
  const links = legendLinks({
    layers: [params.spec['layers']].flat(),
    legendIds: params.legendIds,
  });
  const orphans = noted.filter((id) => {
    return !links.some(([, mapDataId]) => {
      return mapDataId === id;
    });
  });
  return (legendId) => {
    const linking = links.filter(([linked]) => {
      return linked === legendId;
    });
    return joinNotes({
      notes: params.notes,
      ids:
        linking.length > 0
          ? linking.flatMap(([, mapDataId]) => {
              return mapDataId === null ? [] : [mapDataId];
            })
          : orphans,
    });
  };
};

/**
 * Appends each note to the `subtitle` of the legends that describe the noted
 * dataset (see {@link notesByLegend}). Layer-scoped legends are hoisted first,
 * so every legend is reached.
 */
const withCoverageNotes = (params: {
  spec: UnknownRecord;
  notes: Map<string, string>;
  whole: boolean;
}): UnknownRecord => {
  if (params.notes.size === 0) {
    return params.spec;
  }
  const spec = hoistLayerLegends(params.spec);
  const legends = Array.isArray(spec['legends']) ? spec['legends'] : [];
  const noteOf = notesByLegend({
    ...params,
    spec,
    legendIds: new Set(
      legends.flatMap((legend) => {
        return isRecord(legend) ? [String(legend['id'])] : [];
      })
    ),
  });
  return {
    ...spec,
    legends: legends.map((legend) => {
      return isRecord(legend)
        ? noteLegend({ legend, note: noteOf(String(legend['id'])) })
        : legend;
    }),
  };
};

/**
 * The legend note of each dataset in `spec`: the filter it is served with, or,
 * unfiltered, the coverage of a snapshot that holds only some values (G-6).
 */
const legendNotes = async (params: {
  spec: UnknownRecord;
  serverFilters: ReadonlyMap<string, ParsedFilter>;
}): Promise<Map<string, string>> => {
  const { spec, serverFilters } = params;
  const filters = [
    ...filtersOf(spec).flatMap(({ mapDataId, filter }) => {
      const parsed = parseMapDataFilter({ mapDataId, filter });
      return typeof parsed === 'string' ? [] : [parsed];
    }),
    ...serverFilters.values(),
  ];
  const filtered = new Map<string, string>(
    filters.map((filter) => {
      return [filter.baseId, filterNote(filter)];
    })
  );
  const coverage = await coverageNotes(
    mapDataIdsOf(spec).filter((id) => {
      return !filtered.has(id);
    })
  );
  return new Map([...coverage, ...filtered]);
};

/**
 * The served spec with each dataset's legend note: the filter it was served
 * with, the server's or the agent's `filter` (see `filterNote`), or,
 * unfiltered, the coverage of a snapshot that holds only some values (G-6, see
 * `coverageNotes`).
 *
 * @param params.spec - The spec before the append, whose entries still carry `filter`.
 * @param params.serverFilters - The server's filters, by dataset id.
 * @param params.served - The spec with real data and sources.
 * @param params.whole - Whether the served spec paints only the noted dataset
 * (the canonical choropleth), so every legend gets every note.
 * @returns `served` with the notes appended to its legends' `subtitle`.
 *
 * @example
 * await withLegendNotes({ spec, served, whole: false });
 */
export const withLegendNotes = async (params: {
  spec: UnknownRecord;
  served: UnknownRecord;
  serverFilters: ReadonlyMap<string, ParsedFilter>;
  whole: boolean;
}): Promise<UnknownRecord> => {
  return withCoverageNotes({
    spec: params.served,
    notes: await legendNotes(params),
    whole: params.whole,
  });
};

import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
import {
  coverageNotes,
  type FilterDomain,
  readFilterDomainsFor,
} from './fieldFilters';
import { logGeneration } from './generationLogger';
import type { RenderableDatasetId } from './mapDataCatalogue';
import {
  appendRealMapData,
  appendRealSourceData,
  errorResponse,
  hoistLayerLegends,
  invalidSpecResponse,
  isRecord,
  type UnknownRecord,
} from './specValidation';

/**
 * Logs a gateway failure with its cause and answers the fixed 502, so no
 * internal detail reaches the browser.
 */
const gatewayFailure = (params: {
  prompt: string;
  error: unknown;
}): Response => {
  const { prompt, error } = params;
  logGeneration({
    prompt,
    reply: { cause: error instanceof Error ? error.message : String(error) },
  });
  return errorResponse({
    status: 502,
    message:
      'Não foi possível carregar os dados do mapa. Tente novamente em instantes.',
  });
};

/**
 * The values each filterable base holds, for the preflight to match the
 * prompt against (see `readFilterDomainsFor`), or the fixed 502 when the
 * gateway cannot read them.
 *
 * @param prompt - The user's request.
 * @returns The domains (empty when the prompt names no filterable family), or the 502.
 *
 * @example
 * await readDomains('cozinhas mapeadas 2025');
 */
export const readDomains = async (
  prompt: string
): Promise<FilterDomain[] | Response> => {
  try {
    return await readFilterDomainsFor(prompt);
  } catch (error) {
    return gatewayFailure({ prompt, error });
  }
};

/**
 * The dataset the server resolved for the request must be the one the agent
 * placed in `mapData`. Returns the 422 for a mismatch, `undefined` otherwise.
 */
const checkChosenDataset = (params: {
  chosen?: RenderableDatasetId;
  spec: UnknownRecord;
}): Response | undefined => {
  const { chosen, spec } = params;
  if (chosen === undefined) {
    return undefined;
  }
  const mapData = Array.isArray(spec['mapData']) ? spec['mapData'] : [];
  const used = mapData.some((entry) => {
    return isRecord(entry) && entry['mapDataId'] === chosen;
  });
  return used
    ? undefined
    : invalidSpecResponse({
        message: `O modelo não usou o dataset escolhido (${chosen}) no mapData. Tente reformular o pedido.`,
        spec,
      });
};

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
 * Appends each coverage note (G-6, see `coverageNotes`) to the `subtitle` of
 * the legends that describe the noted dataset (see {@link notesByLegend}).
 * Layer-scoped legends are hoisted first, so every legend is reached.
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
 * Resolves the agent's spec into the one the route then validates: the
 * cozinhas-per-município choropleth is rebuilt from `/mapas`'s own builder
 * (see {@link buildCozinhasChoroplethSpec}); every other spec gets its real
 * `mapData` values (see {@link appendRealMapData}). Either way, API-backed
 * `sources[].data` is then fetched server-side (see
 * {@link appendRealSourceData}) while static `/geo/*` URLs are kept for the
 * browser. Once both are resolved, a dataset whose snapshot covers only some
 * values gets that coverage stated in its legend (see
 * {@link withCoverageNotes}). A failure is logged with its cause (see
 * {@link logGeneration}) and answered with a fixed 502.
 */
export const resolveServedSpec = async (params: {
  prompt: string;
  spec: UnknownRecord;
  agentSpec: UnknownRecord;
  chosen?: RenderableDatasetId;
}): Promise<UnknownRecord | Response> => {
  const mismatch = checkChosenDataset({
    chosen: params.chosen,
    spec: params.agentSpec,
  });
  if (mismatch) {
    return mismatch;
  }
  try {
    // The canonical choropleth paints only the cozinhas dataset.
    const whole = isCozinhasChoroplethRequest(params.spec);
    const withMapData = whole
      ? await buildCozinhasChoroplethSpec()
      : await appendRealMapData(params.spec);
    if (withMapData instanceof Response) {
      return withMapData;
    }
    const withSources = await appendRealSourceData(withMapData);
    if (withSources instanceof Response) {
      return withSources;
    }
    const notes = await coverageNotes(mapDataIdsOf(params.spec));
    return withCoverageNotes({ spec: withSources, notes, whole });
  } catch (error) {
    // A gateway rejection after the session exists is a 502, with the session
    // id attached by the caller.
    return gatewayFailure({ prompt: params.prompt, error });
  }
};

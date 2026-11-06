import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
import {
  type FilterDomain,
  type ParsedFilter,
  readFilterDomainsFor,
  type ServerFilter,
} from './fieldFilters';
import { logGeneration } from './generationLogger';
import { withLegendNotes } from './legendNotes';
import type { RenderableDatasetId } from './mapDataCatalogue';
import { filtersOf, serverFilters } from './mapDataFilters';
import {
  appendRealMapData,
  appendRealSourceData,
  errorResponse,
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

/**
 * The spec with real data and sources, then its legend notes. The canonical
 * choropleth replaces only the unfiltered cozinhas dataset.
 */
const serveData = async (params: {
  spec: UnknownRecord;
  filters: ReadonlyMap<string, ParsedFilter>;
}): Promise<UnknownRecord | Response> => {
  const { spec, filters } = params;
  const whole =
    isCozinhasChoroplethRequest(spec) &&
    filtersOf(spec).length === 0 &&
    filters.size === 0;
  const withMapData = whole
    ? await buildCozinhasChoroplethSpec()
    : await appendRealMapData(spec, filters);
  if (withMapData instanceof Response) {
    return withMapData;
  }
  const served = await appendRealSourceData(withMapData);
  return served instanceof Response
    ? served
    : withLegendNotes({ spec, served, serverFilters: filters, whole });
};

/**
 * Resolves the agent's spec into the one the route then validates: the
 * cozinhas-per-município choropleth is rebuilt from `/mapas`'s own builder
 * (see {@link buildCozinhasChoroplethSpec}); every other spec gets its real
 * `mapData` values (see {@link appendRealMapData}). Either way, API-backed
 * `sources[].data` is then fetched server-side (see
 * {@link appendRealSourceData}) while static `/geo/*` URLs are kept for the
 * browser. The filter the server resolved (see `serverFilters`),
 * or the one the agent set on an entry, is applied by the append and never
 * served. Once data and sources are resolved, each dataset's filter or partial
 * coverage is stated in its legend (see `withLegendNotes`). A failure
 * is logged with its cause (see {@link logGeneration}) and answered with a
 * fixed 502.
 */
export const resolveServedSpec = async (params: {
  prompt: string;
  spec: UnknownRecord;
  agentSpec: UnknownRecord;
  chosen?: RenderableDatasetId;
  filter?: ServerFilter;
}): Promise<UnknownRecord | Response> => {
  const mismatch = checkChosenDataset({
    chosen: params.chosen,
    spec: params.agentSpec,
  });
  if (mismatch) {
    return mismatch;
  }
  const filters = serverFilters(params);
  if (filters instanceof Response) {
    return filters;
  }
  try {
    return await serveData({ spec: params.spec, filters });
  } catch (error) {
    // A gateway rejection after the session exists is a 502, with the session
    // id attached by the caller.
    return gatewayFailure({ prompt: params.prompt, error });
  }
};

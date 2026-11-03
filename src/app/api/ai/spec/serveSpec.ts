import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
import { logGeneration } from './generationLogger';
import type { RenderableDatasetId } from './mapDataCatalogue';
import {
  appendRealMapData,
  appendRealSourceData,
  errorResponse,
  invalidSpecResponse,
  isRecord,
  type UnknownRecord,
} from './specValidation';

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
 * Resolves the agent's spec into the one the route then validates: the
 * cozinhas-per-município choropleth is rebuilt from `/mapas`'s own builder
 * (see {@link buildCozinhasChoroplethSpec}); every other spec gets its real
 * `mapData` values (see {@link appendRealMapData}). Either way, API-backed
 * `sources[].data` is then fetched server-side (see
 * {@link appendRealSourceData}) while static `/geo/*` URLs are kept for the
 * browser. A failure is logged with its cause (see {@link logGeneration}) and
 * answered with a fixed 502.
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
    const withMapData = isCozinhasChoroplethRequest(params.spec)
      ? await buildCozinhasChoroplethSpec()
      : await appendRealMapData(params.spec);
    if (withMapData instanceof Response) {
      return withMapData;
    }
    return await appendRealSourceData(withMapData);
  } catch (error) {
    logGeneration({
      prompt: params.prompt,
      reply: {
        cause: error instanceof Error ? error.message : String(error),
      },
    });
    // A gateway rejection after the session exists is a 502, with the session
    // id attached by the caller; the message is fixed so no internal detail leaks.
    return errorResponse({
      status: 502,
      message:
        'Não foi possível carregar os dados do mapa. Tente novamente em instantes.',
    });
  }
};

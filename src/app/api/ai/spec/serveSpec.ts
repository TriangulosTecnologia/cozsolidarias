import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
import { logGeneration } from './generationLogger';
import {
  appendRealMapData,
  appendRealSourceData,
  errorResponse,
  type UnknownRecord,
} from './specValidation';

/**
 * Resolves the agent's spec into the one served to the client: the
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
}): Promise<UnknownRecord | Response> => {
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

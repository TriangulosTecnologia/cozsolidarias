import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
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
 * browser.
 */
export const resolveServedSpec = async (
  spec: UnknownRecord
): Promise<UnknownRecord | Response> => {
  try {
    const withMapData = isCozinhasChoroplethRequest(spec)
      ? await buildCozinhasChoroplethSpec()
      : await appendRealMapData(spec);
    if (withMapData instanceof Response) {
      return withMapData;
    }
    return await appendRealSourceData(withMapData);
  } catch {
    // A gateway rejection after the session exists is a 502, with the session
    // id attached by the caller; the message is fixed so no internal detail leaks.
    return errorResponse({
      status: 502,
      message:
        'Não foi possível carregar os dados do mapa. Tente novamente em instantes.',
    });
  }
};

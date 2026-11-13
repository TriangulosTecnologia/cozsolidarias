import type { MapType } from '@ttoss/geovis';

import { gateway } from '@/gateway';

import { type ConceptEntry, loadConceptIndex } from './conceptIndex';
import type { RenderableDatasetId } from './mapDataCatalogue';
import { withSessionId } from './naturaliSessionApi';
import { preflightPrompt, preflightResponse } from './preflight';

/** A request the preflight let through to the agent. */
export type ParsedRequest = {
  prompt: string;
  sessionId?: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
  /** The server's warning that the dataset is a proxy of what the prompt asked. */
  note?: string;
};

let cachedConcepts: Promise<ConceptEntry[]> | null = null;

/**
 * The catalogue index the preflight reads (see {@link loadConceptIndex}), built
 * once and kept for the process lifetime, like the catalogue context the route
 * sends to the agent. An empty index means the catalogue read failed, so it is
 * not kept: the next request reads again.
 */
const readConcepts = async (): Promise<ConceptEntry[]> => {
  cachedConcepts ??= loadConceptIndex(() => {
    return gateway.getCatalogue();
  });
  const index = await cachedConcepts;
  if (index.length === 0) {
    cachedConcepts = null;
  }
  return index;
};

/**
 * Runs the {@link preflightPrompt} on a validated request, against the
 * catalogue. It answers by itself with the clarify question, the feedback or
 * the unavailable-grain 422 (echoing the client's session id so the
 * conversation continues), or lets the request through: a proxy carries its
 * dataset and warning to the agent.
 *
 * @example
 * const parsed = await preflightRequest({ prompt: 'mapa da fome' }); // { datasetId: 'municipios_cadinsan', note, ... }
 */
export const preflightRequest = async (params: {
  prompt: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
  sessionId?: string;
}): Promise<ParsedRequest | Response> => {
  const { sessionId, ...choices } = params;
  const preflight = preflightPrompt({
    ...choices,
    concepts: await readConcepts(),
  });
  const answer = preflightResponse(preflight);
  if (answer) {
    return sessionId ? withSessionId(answer, sessionId) : answer;
  }
  return preflight.status === 'proxy'
    ? {
        ...choices,
        datasetId: choices.datasetId ?? preflight.datasetId,
        note: preflight.note,
        sessionId,
      }
    : { ...choices, sessionId };
};

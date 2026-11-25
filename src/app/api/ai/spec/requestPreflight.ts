import type { MapType } from '@ttoss/geovis';

import { gateway } from '@/gateway';

import { type ConceptEntry, loadConceptIndex, normalize } from './conceptIndex';
import { familyIdsOf } from './datasetFamilies';
import type { RenderableDatasetId } from './mapDataCatalogue';
import { withSessionId } from './naturaliSessionApi';
import { preflightPrompt, preflightResponse } from './preflight';
import type { UnknownRecord } from './specValidation';

/** A request the preflight let through, to the agent unless it carries `spec`. */
export type ParsedRequest = {
  prompt: string;
  sessionId?: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
  /** The server's warning that the dataset is a proxy of what the prompt asked. */
  note?: string;
  /** Every id of the families the prompt names (see `familyIdsOf`), when the user chose no dataset and it names one. */
  conceptIds?: string[];
  /** The minimal spec the request settles by itself, served without the agent. */
  spec?: UnknownRecord;
};

let cachedConcepts: Promise<ConceptEntry[]> | null = null;

/**
 * The catalogue index the preflight reads (see {@link loadConceptIndex}), built
 * once and kept for the process lifetime, like the catalogue context the route
 * sends to the agent. An empty index means the catalogue read failed, so it is
 * not kept: the next request reads again.
 *
 * @returns The index; empty when the catalogue could not be read.
 *
 * @example
 * const concepts = await readConcepts();
 */
export const readConcepts = async (): Promise<ConceptEntry[]> => {
  cachedConcepts ??= loadConceptIndex(() => {
    return gateway.getCatalogue();
  });
  const index = await cachedConcepts;
  if (index.length === 0) {
    cachedConcepts = null;
  }
  return index;
};

/** The choices plus the ids of the families the prompt names, when the user chose no dataset and it names one. */
const withConceptIds = <T extends { prompt: string; datasetId?: string }>(
  choices: T
): T & { conceptIds?: string[] } => {
  const conceptIds = choices.datasetId
    ? []
    : familyIdsOf(normalize(choices.prompt));
  return conceptIds.length > 0 ? { ...choices, conceptIds } : choices;
};

/**
 * Runs the {@link preflightPrompt} on a validated request, against the
 * catalogue. It answers by itself with the clarify question, the feedback or
 * the unavailable-grain 422 (echoing the client's session id so the
 * conversation continues), or lets the request through: a proxy carries its
 * dataset and warning to the agent, a settled request its minimal `spec`.
 * When the user chose no dataset, the request also carries the ids of the
 * families the prompt names (`conceptIds`), which validation holds the
 * painted dataset to.
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
  const bound = withConceptIds(choices);
  const preflight = preflightPrompt({
    ...choices,
    concepts: await readConcepts(),
  });
  const answer = preflightResponse(preflight);
  if (answer) {
    return sessionId ? withSessionId(answer, sessionId) : answer;
  }
  if (preflight.status === 'proxy') {
    return {
      ...bound,
      datasetId: choices.datasetId ?? preflight.datasetId,
      note: preflight.note,
      sessionId,
    };
  }
  return preflight.status === 'resolved'
    ? { ...bound, sessionId, spec: preflight.spec }
    : { ...bound, sessionId };
};

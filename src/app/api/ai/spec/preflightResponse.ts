import type { Feedback } from './catalogueFeedback';
import { MAP_TYPE_OPTIONS } from './mapTypeOptions';
import type { Clarification, PreflightResult } from './preflight';
import { invalidSpecResponse } from './specValidation';

/**
 * The 200 asking the user to choose: `{ error: false, clarify }` with no
 * `spec`, plus the map types on offer.
 *
 * @param clarify - The question from an `ambiguous` {@link PreflightResult}.
 * @returns The JSON `Response`.
 *
 * @example
 * clarifyResponse({ facet: 'mapType', question: '...', options: [], default: 'dotDensity' });
 */
export const clarifyResponse = (clarify: Clarification): Response => {
  return Response.json({
    error: false,
    clarify,
    mapTypeOptions: MAP_TYPE_OPTIONS,
  });
};

/**
 * The 200 explaining why no map can be made as asked: `{ error: false,
 * feedback }` with no `spec`. A 200, not a failure: the request is incomplete,
 * not wrong, and the client shows the suggestions to rewrite it.
 *
 * @param feedback - The feedback from a `feedback` {@link PreflightResult}.
 * @returns The JSON `Response`.
 *
 * @example
 * feedbackResponse({ verdict: 'absent', reason: '...', suggestions: [] }).status; // 200
 */
export const feedbackResponse = (feedback: Feedback): Response => {
  return Response.json({ error: false, feedback });
};

/**
 * What the route answers by itself, before any agent call: the clarify
 * question for an ambiguous prompt, the feedback for a request no served data
 * answers, or a 422 for a spatial unit no dataset has. `null` lets the
 * request reach the agent.
 *
 * @param preflight - The result of {@link preflightPrompt}.
 * @returns The `Response`, or `null`.
 *
 * @example
 * preflightResponse({ status: 'unavailable', grain: 'estado' })?.status; // 422
 */
export const preflightResponse = (
  preflight: PreflightResult
): Response | null => {
  if (preflight.status === 'ambiguous') {
    return clarifyResponse(preflight.clarify);
  }
  if (preflight.status === 'feedback') {
    return feedbackResponse(preflight.feedback);
  }
  if (preflight.status === 'unavailable') {
    const message = `Não há dados por ${preflight.grain}: os indicadores disponíveis são por município (ou por cozinha). Peça o mapa por município.`;
    return invalidSpecResponse({
      message,
      issues: [{ code: 'unavailable-grain', message }],
    });
  }
  return null;
};

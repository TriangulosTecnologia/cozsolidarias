import { isSessionId } from './naturaliSessionApi';
import { errorResponse } from './specValidation';

/**
 * Reads the optional `sessionId` of a request body — the session a previous
 * response handed out in its `x-session-id` header.
 *
 * @param rawBody - A body whose `prompt` already validated, so it is an object.
 * @returns The id, `undefined` when none was sent, or the 400 `Response` for
 * a value that is not a Naturali session id.
 *
 * @example
 * validateSessionId({ prompt: 'mapa', sessionId: 'sess_V1StGXR8Z5jdHi6B' }); // 'sess_V1StGXR8Z5jdHi6B'
 */
export const validateSessionId = (
  rawBody: object
): string | undefined | Response => {
  const rawSessionId = 'sessionId' in rawBody ? rawBody.sessionId : undefined;
  if (rawSessionId === undefined || isSessionId(rawSessionId)) {
    return rawSessionId;
  }
  return errorResponse({
    status: 400,
    message: 'Campo "sessionId": identificador de sessão inválido.',
  });
};

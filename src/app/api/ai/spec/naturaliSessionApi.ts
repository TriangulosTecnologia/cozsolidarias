import {
  GENERATE_TIMEOUT_MS,
  generateSpec,
  postJson,
  projectUrl,
  type SpecReplyError,
  type SpecReplyOk,
  type SpecReplyStopped,
  type ValidateCandidate,
} from './naturaliSession';

/** Name every session this app creates carries; a reused session must match it. */
const SESSION_NAME = 'cozsolidarias-ai-spec';

/**
 * Seconds of inactivity after which a session expires (decision G-002): long
 * enough to refine a map or pick another map type, short enough not to keep
 * user prompts around.
 */
export const SESSION_TTL_SECONDS = 1800;

/** Response header carrying the session a reply belongs to. */
export const SESSION_HEADER = 'x-session-id';

/**
 * Stamps `response` with the session it belongs to, so the client can send
 * the id back to continue the conversation.
 *
 * @returns The same `response`, with the {@link SESSION_HEADER} set.
 *
 * @example
 * withSessionId(Response.json({ error: false }), 'sess_V1StGXR8Z5jdHi6B');
 */
export const withSessionId = (
  response: Response,
  sessionId: string
): Response => {
  response.headers.set(SESSION_HEADER, sessionId);
  return response;
};

const SESSION_ID_PATTERN = /^sess_[A-Za-z0-9_-]{8,64}$/;

/**
 * Type guard for a client-supplied session id: Naturali's `sess_` public id
 * format, so nothing else can reach the URL it is interpolated into.
 *
 * @example
 * isSessionId('sess_V1StGXR8Z5jdHi6B'); // true
 */
export const isSessionId = (value: unknown): value is string => {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
};

type SessionRecord = {
  agent_id?: string;
  name?: string | null;
  status?: string;
};

/**
 * The session when readable, `null` when it is not ours to reuse: a non-2xx
 * answer or a body that is not JSON. A transport failure still throws.
 */
const readSession = async (params: {
  apiKey: string;
  projectId: string;
  sessionId: string;
  signal: AbortSignal;
}): Promise<SessionRecord | null> => {
  const response = await fetch(
    `${projectUrl(params.projectId)}/sessions/${params.sessionId}`,
    {
      headers: { authorization: `Bearer ${params.apiKey}` },
      signal: params.signal,
    }
  );
  if (!response.ok) {
    return null;
  }
  // A transport failure while reading the body throws; only a body that does
  // not parse means the session cannot be proven ours.
  const text = await response.text();
  try {
    return JSON.parse(text) as SessionRecord;
  } catch {
    return null;
  }
};

const isOwnedAndOpen = (
  session: SessionRecord | null,
  agentId: string
): boolean => {
  return (
    session?.status === 'open' &&
    session.agent_id === agentId &&
    session.name === SESSION_NAME
  );
};

/** The client-supplied session id when it may be reused (decision G-001), else `null`. */
const reusableSessionId = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  sessionId?: string;
  signal: AbortSignal;
}): Promise<string | null> => {
  if (!params.sessionId || !isSessionId(params.sessionId)) {
    return null;
  }
  const session = await readSession({ ...params, sessionId: params.sessionId });
  return isOwnedAndOpen(session, params.agentId) ? params.sessionId : null;
};

/**
 * Resolves the session a generation runs in. A client-supplied `sessionId` is
 * reused only when it is open, bound to this app's agent and named by this
 * app (decision G-001; Naturali sessions cannot carry `tags` on create);
 * anything else — unreadable, closed, another agent or name — starts a fresh
 * session instead.
 *
 * @returns The session id, and whether an existing session was `reused`.
 * @throws If creating the session fails or the deadline passes.
 *
 * @example
 * const { sessionId, reused } = await openSession({ apiKey, projectId, agentId, signal });
 */
export const openSession = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  sessionId?: string;
  signal: AbortSignal;
}): Promise<{ sessionId: string; reused: boolean }> => {
  const reusable = await reusableSessionId(params);
  if (reusable) {
    return { sessionId: reusable, reused: true };
  }

  const created = await postJson<{ id: string }>({
    url: `${projectUrl(params.projectId)}/sessions`,
    apiKey: params.apiKey,
    body: {
      agent_id: params.agentId,
      name: SESSION_NAME,
      auto_generate: false,
      inactivity_ttl_seconds: SESSION_TTL_SECONDS,
    },
    signal: params.signal,
  });
  return { sessionId: created.id, reused: false };
};

/**
 * Runs {@link generateSpec} inside a session: opens (or reuses) it, sends the
 * full `message` to a new session and only the `followUpMessage` to a reused
 * one, which already holds the catalogue and instructions.
 *
 * @returns The agent's reply and the id of the session it ran in, or the error
 * {@link generateSpec} threw together with that id (the session exists even
 * when the generation fails).
 * @throws Whatever {@link openSession} throws: no session exists then.
 *
 * @example
 * const { reply, sessionId } = await generateInSession({ apiKey, projectId, agentId, message, followUpMessage, validateCandidate });
 */
export const generateInSession = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  sessionId?: string;
  message: string;
  followUpMessage: string;
  validateCandidate: ValidateCandidate;
}): Promise<
  | {
      sessionId: string;
      reply: SpecReplyOk | SpecReplyError | SpecReplyStopped;
    }
  | { sessionId: string; error: unknown }
> => {
  const signal = AbortSignal.timeout(GENERATE_TIMEOUT_MS);
  const session = await openSession({ ...params, signal });
  try {
    const reply = await generateSpec({
      apiKey: params.apiKey,
      projectId: params.projectId,
      sessionId: session.sessionId,
      message: session.reused ? params.followUpMessage : params.message,
      validateCandidate: params.validateCandidate,
      signal,
    });
    return { reply, sessionId: session.sessionId };
  } catch (error) {
    return { error, sessionId: session.sessionId };
  }
};

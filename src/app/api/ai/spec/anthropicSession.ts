const ANTHROPIC_BETA_HEADER = 'managed-agents-2026-04-01';
const ANTHROPIC_VERSION_HEADER = '2023-06-01';
const SESSIONS_URL = 'https://api.anthropic.com/v1/sessions';

const sessionUrl = (sessionId: string): string => {
  return `${SESSIONS_URL}/${sessionId}`;
};

const sessionEventsUrl = (sessionId: string): string => {
  return `${sessionUrl(sessionId)}/events`;
};

/** Strips a leading/trailing ` ```json ` fence, if the model added one. */
export const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
};

/**
 * Creates a fresh, single-use Managed Agents session pinned to the
 * `geovis-spec-generator` agent, seeding it via `initial_events` with the
 * dataset catalogue, the fixed instructions, and the user's prompt in one
 * `user.message` — this starts the agent loop in the same call (the session
 * is created directly in `running`, per the Managed Agents docs) instead of
 * requiring a separate `POST /events` round trip.
 *
 * @returns The new session's id.
 * @throws If the HTTP call fails or the response carries no session id.
 */
export const createSession = async (params: {
  apiKey: string;
  agentId: string;
  environmentId: string;
  catalogueText: string;
  instructions: string;
  prompt: string;
}): Promise<string> => {
  const response = await fetch(SESSIONS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': ANTHROPIC_VERSION_HEADER,
      'anthropic-beta': ANTHROPIC_BETA_HEADER,
    },
    body: JSON.stringify({
      agent: params.agentId,
      environment_id: params.environmentId,
      initial_events: [
        {
          type: 'user.message',
          content: [
            {
              type: 'text',
              text: `Catálogo de datasets:\n${params.catalogueText}`,
            },
            { type: 'text', text: params.instructions },
            { type: 'text', text: params.prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic sessions POST responded with status ${response.status}`
    );
  }

  const body = (await response.json()) as { id?: string };

  if (!body.id) {
    throw new Error('Anthropic sessions POST returned no session id');
  }

  return body.id;
};

/** One event as returned by the Managed Agents session-events endpoints. */
type SessionEvent = {
  id: string;
  type: string;
  processed_at: string | null;
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: { type: string };
};

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;
/** Recent-events window per poll — generous for a tool-less classification turn. */
const POLL_EVENTS_LIMIT = 100;

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const collectTextFromAgentMessage = (event: SessionEvent): string[] => {
  const parts: string[] = [];
  for (const block of event.content ?? []) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text);
    }
  }
  return parts;
};

const checkSessionEnd = (
  event: SessionEvent,
  messageParts: string[]
): string | null => {
  if (
    event.type === 'session.status_idle' &&
    event.stop_reason?.type !== 'requires_action'
  ) {
    if (messageParts.length === 0) {
      throw new Error('Anthropic session turn ended with no agent.message');
    }
    return messageParts.join('\n');
  }
  return null;
};

const processSessionEvents = (events: SessionEvent[]): string => {
  const messageParts: string[] = [];

  for (const event of events) {
    if (event.type === 'session.error') {
      throw new Error('Anthropic session reported a session.error event');
    }

    if (event.type === 'agent.message') {
      messageParts.push(...collectTextFromAgentMessage(event));
    }

    const result = checkSessionEnd(event, messageParts);
    if (result) {
      return result;
    }
  }

  return '';
};

/**
 * Polls a single-use session's event list until its one turn completes, and
 * returns the concatenated text of every `agent.message` produced.
 *
 * The session exists solely for this request (see {@link createSession}), so
 * every event in it belongs to this turn — this scans the full list oldest
 * first and stops at the first `session.status_idle` whose `stop_reason`
 * isn't `requires_action` (the documented idle-break gate).
 *
 * @throws If no session event ever arrives before {@link MAX_POLL_ATTEMPTS},
 * the session reports a `session.error`, or the turn ends waiting on a
 * client action this route doesn't handle (`requires_action` at the poll
 * budget, e.g. a tool confirmation) — this route assumes a tool-less agent.
 */
export const pollForReply = async (params: {
  apiKey: string;
  sessionId: string;
}): Promise<string> => {
  const url = new URL(sessionEventsUrl(params.sessionId));
  url.searchParams.set('limit', String(POLL_EVENTS_LIMIT));
  url.searchParams.set('order', 'desc');

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(url, {
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION_HEADER,
        'anthropic-beta': ANTHROPIC_BETA_HEADER,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Anthropic session events GET responded with status ${response.status}`
      );
    }

    const body = (await response.json()) as { data?: SessionEvent[] };
    // Most-recent-first from the API; walk it oldest-first to scan forward.
    const events = (body.data ?? []).slice().reverse();
    const result = processSessionEvents(events);
    if (result) {
      return result;
    }
  }

  throw new Error('Timed out waiting for the Anthropic session to reply');
};

/**
 * Deletes a single-use session so it doesn't linger as billed, listable
 * state. The caller schedules this via Next.js `after()` so it never adds
 * latency to the client-facing response — best-effort: a failure here
 * doesn't affect the response already sent, so it's swallowed rather than
 * surfaced.
 */
export const deleteSession = async (params: {
  apiKey: string;
  sessionId: string;
}): Promise<void> => {
  try {
    await fetch(sessionUrl(params.sessionId), {
      method: 'DELETE',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION_HEADER,
        'anthropic-beta': ANTHROPIC_BETA_HEADER,
      },
    });
  } catch {
    // Best-effort cleanup only.
  }
};

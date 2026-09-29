const GENERATE_TIMEOUT_MS = 55_000;

const generateUrl = (params: {
  projectId: string;
  agentId: string;
}): string => {
  return `https://api.naturali.ai/v1/projects/${params.projectId}/agents/${params.agentId}/generate?wait=true`;
};

/** The `status: "ok"` branch of the agent's structured `output_schema`. */
export type SpecReplyOk = { status: 'ok'; spec: unknown };

/** The `status: "error"` branch of the agent's structured `output_schema`. */
export type SpecReplyError = {
  status: 'error';
  error: { code: string; message: string };
};

/** Strips a leading/trailing ` ```json ` fence, if the model added one. */
const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
};

const isSpecReply = (value: unknown): value is SpecReplyOk | SpecReplyError => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    ((value as { status: unknown }).status === 'ok' ||
      (value as { status: unknown }).status === 'error')
  );
};

/**
 * A generation resource as returned by `POST .../generate?wait=true` once it
 * settles — this route always waits inline rather than polling, since
 * `wait=true` blocks for the result (see the Naturali sessions/agents docs),
 * which removes the session-creation/poll/delete dance the previous
 * Anthropic Managed Agents transport needed.
 */
type GenerationResult = {
  status: string;
  error?: { message?: string } | null;
  output?: {
    content?: string;
    object?: unknown;
  };
};

/**
 * Parses a settled generation's structured reply into the agent's
 * `output_schema` shape.
 *
 * Prefers `output.object` — the provider's own parse of the model's reply
 * against the agent's `output_schema`, so no manual JSON parsing is needed on
 * the success path. Falls back to parsing `output.content` (stripping a code
 * fence first) only when `object` is absent, so a provider hiccup that still
 * carries readable text doesn't fail outright.
 *
 * @throws If neither `object` nor a parseable `content` is present, or the
 * parsed value doesn't carry a `status` of `"ok"`/`"error"`.
 */
const parseSpecReply = (
  result: GenerationResult
): SpecReplyOk | SpecReplyError => {
  if (isSpecReply(result.output?.object)) {
    return result.output.object;
  }

  const content = result.output?.content;
  if (content) {
    // A non-JSON `content` falls through to the same generic error below
    // rather than surfacing its `SyntaxError` — from the caller's side both
    // are "the provider didn't give us a usable structured reply".
    try {
      const parsed: unknown = JSON.parse(stripCodeFence(content));
      if (isSpecReply(parsed)) {
        return parsed;
      }
    } catch {
      // Falls through to the generic error below.
    }
  }

  throw new Error(
    'Naturali generation completed with no structured status/spec/error reply'
  );
};

/**
 * Runs one turn against the `geovis-spec-generator` Naturali agent and
 * returns its structured reply — the catalogue, the cozsolidarias-domain
 * `INSTRUCTIONS`, and the user's prompt are joined into a single
 * `messages[0].content` string, since Naturali's `generate` endpoint has no
 * equivalent of Anthropic Managed Agents' multi-block `initial_events`
 * (see `route.ts`'s {@link import('./route').POST} for how the three parts
 * are composed).
 *
 * Uses `?wait=true` so the call blocks for the finished generation inline —
 * the agent's `max_steps` is `1` and it calls no tools, so a single bounded
 * wait replaces the previous transport's manual event-polling loop.
 *
 * @returns The agent's structured `{status: "ok", spec}` or
 * `{status: "error", error}` reply.
 * @throws If the HTTP call fails, times out, the generation itself reports
 * `status: "failed"` (e.g. a provider-side error), or the reply carries no
 * parseable structured content.
 */
export const generateSpec = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  message: string;
}): Promise<SpecReplyOk | SpecReplyError> => {
  const response = await fetch(
    generateUrl({ projectId: params.projectId, agentId: params.agentId }),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: params.message }],
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Naturali generate POST responded with status ${response.status}`
    );
  }

  const result = (await response.json()) as GenerationResult;

  if (result.status !== 'completed') {
    throw new Error(
      `Naturali generation ended with status "${result.status}"${
        result.error?.message ? `: ${result.error.message}` : ''
      }`
    );
  }

  return parseSpecReply(result);
};

import type { SpecIssue } from './specValidation';

const GENERATE_TIMEOUT_MS = 55_000;

/**
 * Upper bound on `validate_spec` tool calls per generation. The 5th call's
 * issues end the loop even when they shrank — see {@link generateSpec}.
 */
export const MAX_VALIDATION_ATTEMPTS = 5;

const VALIDATE_SPEC_TOOL = 'validate_spec';

const agentUrl = (params: { projectId: string; agentId: string }): string => {
  return `https://api.naturali.ai/v1/projects/${params.projectId}/agents/${params.agentId}`;
};

/** The `status: "ok"` branch of the agent's structured `output_schema`. */
export type SpecReplyOk = { status: 'ok'; spec: unknown };

/** The `status: "error"` branch of the agent's structured `output_schema`. */
export type SpecReplyError = {
  status: 'error';
  error: { code: string; message: string };
};

/**
 * The loop gave up before the agent answered: the `validate_spec` budget ran
 * out, or a round left as many issues as the previous one (no shrinkage).
 * Carries the last candidate (already locally repaired) and its issues.
 */
export type SpecReplyStopped = {
  status: 'stopped';
  reason: 'max-attempts' | 'no-shrinkage';
  attempts: number;
  spec: unknown;
  issues: SpecIssue[];
};

/** What the `validate_spec` tool computes for one candidate (see `validateCandidate`). */
export type ValidateCandidate = (spec: unknown) => {
  spec: unknown;
  issues: SpecIssue[];
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
type ToolCall = { id: string; tool_name: string; args?: unknown };

type GenerationResult = {
  id?: string;
  status: string;
  error?: { message?: string } | null;
  required_action?: { type: string; tool_calls?: ToolCall[] } | null;
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

/** POSTs `body` to a Naturali agent endpoint and returns the settled generation. */
const postGeneration = async (params: {
  url: string;
  apiKey: string;
  body: unknown;
  signal: AbortSignal;
}): Promise<GenerationResult> => {
  const response = await fetch(params.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(params.body),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(
      `Naturali generate POST responded with status ${response.status}`
    );
  }

  return (await response.json()) as GenerationResult;
};

/** Tool output for a call to a tool this route does not implement. */
const unknownToolOutput = (toolName: string): unknown => {
  return {
    ok: false,
    issues: [
      {
        code: 'unknown-tool',
        message: `O tool "${toolName}" não existe; use apenas "${VALIDATE_SPEC_TOOL}".`,
      },
    ],
  };
};

const candidateFromArgs = (args: unknown): unknown => {
  return typeof args === 'object' && args !== null && 'spec' in args
    ? args.spec
    : args;
};

/** How far the loop got: `validate_spec` calls served and the last call's issue count. */
type LoopProgress = { attempts: number; previousIssueCount: number };

/** Why a validated candidate ends the loop, or `null` to keep going. */
const stopReason = (params: {
  issueCount: number;
  progress: LoopProgress;
}): SpecReplyStopped['reason'] | null => {
  if (params.issueCount === 0) {
    return null;
  }
  if (params.progress.attempts >= MAX_VALIDATION_ATTEMPTS) {
    return 'max-attempts';
  }
  return params.issueCount >= params.progress.previousIssueCount
    ? 'no-shrinkage'
    : null;
};

type ToolOutput = { tool_call_id: string; output: unknown };

/**
 * Answers one batch of pending tool calls, or stops the loop on the first
 * `validate_spec` call {@link stopReason} rejects.
 */
const answerToolCalls = (params: {
  calls: ToolCall[];
  validateCandidate: ValidateCandidate;
  progress: LoopProgress;
}):
  | { stopped: SpecReplyStopped }
  | { outputs: ToolOutput[]; progress: LoopProgress } => {
  let progress = params.progress;
  const outputs: ToolOutput[] = [];

  for (const call of params.calls) {
    if (call.tool_name !== VALIDATE_SPEC_TOOL) {
      outputs.push({
        tool_call_id: call.id,
        output: unknownToolOutput(call.tool_name),
      });
      continue;
    }

    const checked = params.validateCandidate(candidateFromArgs(call.args));
    const issueCount = checked.issues.length;
    const attempted = { ...progress, attempts: progress.attempts + 1 };
    const reason = stopReason({ issueCount, progress: attempted });
    if (reason) {
      return {
        stopped: {
          status: 'stopped',
          reason,
          attempts: attempted.attempts,
          ...checked,
        },
      };
    }

    progress = { attempts: attempted.attempts, previousIssueCount: issueCount };
    outputs.push({
      tool_call_id: call.id,
      output: { ok: issueCount === 0, ...checked },
    });
  }

  return { outputs, progress };
};

/** The structured reply of a generation that is no longer paused. */
const settledReply = (
  result: GenerationResult
): SpecReplyOk | SpecReplyError => {
  if (result.status !== 'completed') {
    const detail = result.error?.message ? `: ${result.error.message}` : '';
    throw new Error(
      `Naturali generation ended with status "${result.status}"${detail}`
    );
  }
  return parseSpecReply(result);
};

/**
 * Runs one turn against the `geovis-spec-generator-loop` Naturali agent,
 * serving its client-side `validate_spec` tool calls in between.
 *
 * `generate?wait=true` either settles (`completed`/`failed`) or pauses with
 * `status: "requires_action"` and the pending `required_action.tool_calls`;
 * each `validate_spec` call is answered with `validateCandidate`'s repaired
 * spec and remaining issues via `.../generate/{id}/tool-outputs`, which
 * blocks and returns the next state in the same shape.
 *
 * Stops, without answering the pending call, when:
 * - the call is the {@link MAX_VALIDATION_ATTEMPTS}th and still has issues;
 * - a call leaves at least as many issues as the previous call (no shrinkage);
 * - the shared {@link GENERATE_TIMEOUT_MS} deadline aborts any request (thrown).
 *
 * @returns The agent's structured `{status: "ok", spec}` or
 * `{status: "error", error}` reply, or `{status: "stopped", ...}` when the
 * loop gave up.
 * @throws If an HTTP call fails, the deadline passes, the generation reports
 * a status other than `completed`/`requires_action`, or the reply carries no
 * parseable structured content.
 *
 * @example
 * const reply = await generateSpec({ apiKey, projectId, agentId, message, validateCandidate });
 */
export const generateSpec = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  message: string;
  validateCandidate: ValidateCandidate;
}): Promise<SpecReplyOk | SpecReplyError | SpecReplyStopped> => {
  const signal = AbortSignal.timeout(GENERATE_TIMEOUT_MS);
  const baseUrl = agentUrl({
    projectId: params.projectId,
    agentId: params.agentId,
  });

  let result = await postGeneration({
    url: `${baseUrl}/generate?wait=true`,
    apiKey: params.apiKey,
    body: { messages: [{ role: 'user', content: params.message }] },
    signal,
  });

  let progress: LoopProgress = {
    attempts: 0,
    previousIssueCount: Number.POSITIVE_INFINITY,
  };

  while (result.status === 'requires_action') {
    const answered = answerToolCalls({
      calls: result.required_action?.tool_calls ?? [],
      validateCandidate: params.validateCandidate,
      progress,
    });
    if ('stopped' in answered) {
      return answered.stopped;
    }
    progress = answered.progress;

    if (!result.id) {
      throw new Error(
        'Naturali generation ended with status "requires_action" but no generation id to resume'
      );
    }

    result = await postGeneration({
      url: `${baseUrl}/generate/${result.id}/tool-outputs`,
      apiKey: params.apiKey,
      body: { tool_outputs: answered.outputs },
      signal,
    });
  }

  return settledReply(result);
};

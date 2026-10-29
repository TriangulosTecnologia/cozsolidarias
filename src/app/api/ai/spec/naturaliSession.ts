import type { SpecIssue } from './specValidation';

/** Shared deadline of one generation, session opening included. */
export const GENERATE_TIMEOUT_MS = 55_000;

/**
 * Upper bound on `validate_spec` tool calls per generation. The 5th call's
 * issues end the loop even when they shrank — see {@link generateSpec}.
 */
export const MAX_VALIDATION_ATTEMPTS = 5;

const VALIDATE_SPEC_TOOL = 'validate_spec';

/** Base URL of a project's Naturali API. */
export const projectUrl = (projectId: string): string => {
  return `https://api.naturali.ai/v1/projects/${projectId}`;
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

/** Error details the agent must carry on a `status: "error"` reply. */
const hasErrorDetails = (value: unknown): boolean => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
};

const hasStatus = (value: unknown, status: string): boolean => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === status
  );
};

const isSpecReply = (value: unknown): value is SpecReplyOk | SpecReplyError => {
  return (
    hasStatus(value, 'ok') ||
    (hasStatus(value, 'error') &&
      'error' in (value as object) &&
      hasErrorDetails((value as { error: unknown }).error))
  );
};

/**
 * A generation resource as returned by `POST .../sessions/{id}/generate?wait=true`
 * once it settles — this route always waits inline rather than polling, since
 * `wait=true` blocks for the result (see the Naturali sessions docs).
 */
type ToolCall = { id: string; tool_name: string; args?: unknown };

type GenerationResult = {
  generation_id?: string;
  status: string;
  error?: { message?: string } | null;
  required_action?: { type: string; tool_calls?: ToolCall[] } | null;
  /** The reply's JSON text, the agent's `output_schema` shape (see {@link parseSpecReply}). */
  content?: string;
};

/**
 * Parses a settled generation's reply into the agent's `output_schema` shape.
 *
 * A session generation returns the reply as JSON text in `content`, so it is
 * parsed here (stripping a code fence the model may have added). A text that
 * does not parse, or parses without a `status` of `"ok"`/`"error"`, falls
 * through to the error below: from the caller's side both mean "the provider
 * didn't give us a usable structured reply".
 *
 * @throws If the reply carries no parseable `status`/`spec`/`error` JSON.
 */
const parseSpecReply = (
  result: GenerationResult
): SpecReplyOk | SpecReplyError => {
  const content = result.content;
  if (content) {
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
 * POSTs `body` to a Naturali endpoint and returns its JSON reply, typed by
 * the caller (the reply shape is the endpoint's, not validated here).
 */
export const postJson = async <T>(params: {
  url: string;
  apiKey: string;
  body: unknown;
  signal: AbortSignal;
}): Promise<T> => {
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

  return (await response.json()) as T;
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
 * Runs one turn inside a Naturali session of the `geovis-spec-generator-loop`
 * agent, serving its client-side `validate_spec` tool calls in between.
 *
 * The turn saves `message` into the session, then `generate?wait=true` either
 * settles (`completed`/`failed`) or pauses with `status: "requires_action"`
 * and the pending `required_action.tool_calls`; each `validate_spec` call is
 * answered with `validateCandidate`'s repaired spec and remaining issues via
 * `.../sessions/{id}/tool-outputs`, which blocks and returns the next state
 * in the same shape. The session keeps the history, so a later turn only
 * sends what changed.
 *
 * Stops, without answering the pending call, when:
 * - the call is the {@link MAX_VALIDATION_ATTEMPTS}th and still has issues;
 * - a call leaves at least as many issues as the previous call (no shrinkage);
 * - the `signal` deadline aborts any request (thrown).
 *
 * @param params.signal - Deadline shared by every request of the turn (see {@link GENERATE_TIMEOUT_MS}).
 * @returns The agent's structured `{status: "ok", spec}` or
 * `{status: "error", error}` reply, or `{status: "stopped", ...}` when the
 * loop gave up.
 * @throws If an HTTP call fails, the deadline passes, the generation reports
 * a status other than `completed`/`requires_action`, or the reply carries no
 * parseable structured content.
 *
 * @example
 * const reply = await generateSpec({ apiKey, projectId, sessionId, message, validateCandidate, signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS) });
 */
export const generateSpec = async (params: {
  apiKey: string;
  projectId: string;
  sessionId: string;
  message: string;
  validateCandidate: ValidateCandidate;
  signal: AbortSignal;
}): Promise<SpecReplyOk | SpecReplyError | SpecReplyStopped> => {
  const { signal } = params;
  const baseUrl = `${projectUrl(params.projectId)}/sessions/${params.sessionId}`;

  await postJson({
    url: `${baseUrl}/messages`,
    apiKey: params.apiKey,
    body: { message: params.message },
    signal,
  });
  let result = await postJson<GenerationResult>({
    url: `${baseUrl}/generate?wait=true`,
    apiKey: params.apiKey,
    body: {},
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

    if (!result.generation_id) {
      throw new Error(
        'Naturali generation ended with status "requires_action" but no generation id to resume'
      );
    }

    result = await postJson<GenerationResult>({
      url: `${baseUrl}/tool-outputs`,
      apiKey: params.apiKey,
      body: {
        generation_id: result.generation_id,
        tool_outputs: answered.outputs,
      },
      signal,
    });
  }

  return settledReply(result);
};

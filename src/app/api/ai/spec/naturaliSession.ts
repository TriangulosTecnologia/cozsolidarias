import {
  bindReply,
  INITIAL_LOOP_STATE,
  type LoopState,
  type RecoverySnapshot,
  recoverySnapshot,
  type RecoveryTrigger,
  stoppedByDeadline,
} from './specRecovery';
import type { SpecIssue } from './specValidation';
import { answerToolCalls, type ToolCall } from './validationLoop';

export {
  MAX_RECOVERY_ATTEMPTS,
  MAX_TOTAL_VALIDATIONS,
  MAX_VALIDATION_ATTEMPTS,
  RECOVERY_INSTRUCTIONS,
} from './specRecovery';

/** Shared deadline of one generation, session opening included. */
export const GENERATE_TIMEOUT_MS = 55_000;

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
 * The server ended the turn instead of the agent: `recovery-failed` after a
 * recovery signal (the recovery candidate still had issues, a 7th call came,
 * the reply was not the cleared candidate, or the deadline passed), with the
 * `trigger` that exhausted the loop; `budget-exhausted` when the budget ran
 * out with no signal sent. Carries the candidate it refers to (already
 * locally repaired) and its issues.
 */
export type SpecReplyStopped = {
  status: 'stopped';
  reason: 'recovery-failed' | 'budget-exhausted';
  /** What exhausted the loop; set for `recovery-failed`. */
  trigger?: RecoveryTrigger;
  attempts: number;
  spec: unknown;
  issues: SpecIssue[];
};

/** What the `validate_spec` tool computes for one candidate (see `validateCandidate`). */
export type ValidateCandidate = (spec: unknown) => Promise<{
  spec: unknown;
  issues: SpecIssue[];
}>;

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

type GenerateParams = {
  apiKey: string;
  projectId: string;
  sessionId: string;
  message: string;
  validateCandidate: ValidateCandidate;
  signal: AbortSignal;
};

/** The turn itself: the message, the generation and its tool calls, until it settles or the loop stops it. */
const runTurn = async (
  params: GenerateParams & { loop: { state: LoopState } }
): Promise<SpecReplyOk | SpecReplyError | SpecReplyStopped> => {
  const { signal, loop } = params;
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

  while (result.status === 'requires_action') {
    const answered = await answerToolCalls({
      calls: result.required_action?.tool_calls ?? [],
      validateCandidate: params.validateCandidate,
      state: loop.state,
    });
    loop.state = answered.state;
    if ('stopped' in answered) {
      return answered.stopped;
    }

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

  return bindReply({ reply: settledReply(result), state: loop.state });
};

/**
 * Runs one turn inside a Naturali session of the `geovis-spec-generator-loop`
 * agent, serving its client-side `validate_spec` tool calls in between.
 *
 * The turn saves `message` into the session, then `generate?wait=true` either
 * settles (`completed`/`failed`) or pauses with `status: "requires_action"`
 * and the pending `required_action.tool_calls`; they are answered by
 * `answerToolCalls` (`validateCandidate`'s repaired spec and remaining issues,
 * or the recovery signal) via `.../sessions/{id}/tool-outputs`, which blocks
 * and returns the next state in the same shape. The session keeps the
 * history, so a later turn only sends what changed.
 *
 * Once the loop exhausts (`MAX_VALIDATION_ATTEMPTS` validations, or no
 * shrinkage), the agent gets one recovery candidate within
 * `MAX_TOTAL_VALIDATIONS` validations; the turn then ends as `stopped`
 * (`recovery-failed` or `budget-exhausted`) instead of the agent's reply when
 * the server's budget or rules are broken (see `answerToolCalls`,
 * `bindReply`), including a deadline that passes after the recovery signal.
 *
 * @param params.signal - Deadline shared by every request of the turn (see {@link GENERATE_TIMEOUT_MS}).
 * @param params.onRecovery - Called once when a generation that entered
 * recovery ends, with its {@link RecoverySnapshot}; never for one that did not.
 * @returns The agent's structured `{status: "ok", spec}` or
 * `{status: "error", error}` reply, or `{status: "stopped", ...}`.
 * @throws If an HTTP call fails, the deadline passes before any recovery
 * signal, the generation reports a status other than
 * `completed`/`requires_action`, the reply carries no parseable structured
 * content, or `validateCandidate` rejects (the data could not be read).
 *
 * @example
 * const reply = await generateSpec({ apiKey, projectId, sessionId, message, validateCandidate, signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS) });
 */
export const generateSpec = async (
  params: GenerateParams & {
    onRecovery?: (snapshot: RecoverySnapshot) => void;
  }
): Promise<SpecReplyOk | SpecReplyError | SpecReplyStopped> => {
  const loop = { state: INITIAL_LOOP_STATE };
  const report = (outcome: RecoverySnapshot['outcome']) => {
    const snapshot = recoverySnapshot({ state: loop.state, outcome });
    if (snapshot && params.onRecovery) {
      params.onRecovery(snapshot);
    }
  };

  let reply: SpecReplyOk | SpecReplyError | SpecReplyStopped;
  try {
    reply = await runTurn({ ...params, loop });
  } catch (error) {
    const stopped = stoppedByDeadline({ state: loop.state, error });
    if (!stopped) {
      report('error');
      throw error;
    }
    reply = stopped;
  }
  report(reply.status === 'stopped' ? 'recovery-failed' : reply.status);
  return reply;
};

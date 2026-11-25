import { normalizeIssues } from './issueCategories';
import type { SpecReplyStopped, ValidateCandidate } from './naturaliSession';
import {
  type LoopState,
  MAX_TOTAL_VALIDATIONS,
  MAX_VALIDATION_ATTEMPTS,
  recordValidation,
  RECOVERY_INSTRUCTIONS,
  type RecoveryTrigger,
  semanticDriftIssues,
  stoppedReply,
  type Validated,
} from './specRecovery';

const VALIDATE_SPEC_TOOL = 'validate_spec';

/**
 * One pending call of a generation paused with `requires_action`.
 *
 * @example
 * const call: ToolCall = { id: 'call_1', tool_name: 'validate_spec', args: { spec } };
 */
export type ToolCall = { id: string; tool_name: string; args?: unknown };

/**
 * The answer to one {@link ToolCall}, as `.../tool-outputs` takes it.
 *
 * @example
 * const output: ToolOutput = { tool_call_id: 'call_1', output: { ok: true, spec, issues: [] } };
 */
export type ToolOutput = { tool_call_id: string; output: unknown };

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

/** Why a validated candidate exhausts the loop, or `null` to keep going. */
const stopReason = (params: {
  issueCount: number;
  attempts: number;
  previousIssueCount: number;
}): RecoveryTrigger | null => {
  if (params.issueCount === 0) {
    return null;
  }
  if (params.attempts >= MAX_VALIDATION_ATTEMPTS) {
    return 'max-attempts';
  }
  return params.issueCount >= params.previousIssueCount ? 'no-shrinkage' : null;
};

type CallAnswer = { state: LoopState } & (
  | { stopped: SpecReplyStopped }
  | { output: unknown; signal?: unknown }
);

/**
 * A validation before recovery: the plain answer, or, when it exhausts the
 * loop, the recovery signal while a validation remains in the budget.
 */
const beforeRecovery = (params: {
  state: LoopState;
  validated: Validated;
}): CallAnswer => {
  const { state, validated } = params;
  const next = recordValidation(params);
  const trigger = stopReason({
    issueCount: validated.issues.length,
    attempts: next.attempts,
    previousIssueCount:
      state.attempts === 0
        ? Number.POSITIVE_INFINITY
        : state.last.issues.length,
  });
  if (!trigger) {
    return {
      output: { ok: validated.issues.length === 0, ...validated },
      state: next,
    };
  }
  if (next.attempts >= MAX_TOTAL_VALIDATIONS) {
    return { stopped: stoppedReply({ state: next, validated }), state: next };
  }
  const signal = {
    ok: false,
    recovery_required: true,
    reason: trigger,
    attempts: next.attempts,
    ...validated,
    history: next.history,
    instructions: RECOVERY_INSTRUCTIONS,
  };
  return {
    output: signal,
    signal,
    state: { ...next, recovery: { trigger, ...validated } },
  };
};

/**
 * A validation after recovery, held to the mutability rules
 * ({@link semanticDriftIssues}): any issue ends the turn; a clean one is
 * answered and its raw candidate becomes the one the reply must repeat.
 */
const afterRecovery = (params: {
  state: LoopState;
  recovery: Validated;
  validated: Validated;
  candidate: unknown;
}): CallAnswer => {
  const issues = normalizeIssues([
    ...params.validated.issues,
    ...semanticDriftIssues({
      before: params.recovery.spec,
      after: params.validated.spec,
      issues: params.recovery.issues,
    }),
  ]);
  const validated = { spec: params.validated.spec, issues };
  const next = recordValidation({ state: params.state, validated });
  return issues.length > 0
    ? { stopped: stoppedReply({ state: next, validated }), state: next }
    : {
        output: { ok: true, ...validated },
        state: { ...next, cleared: { candidate: params.candidate } },
      };
};

const answerCall = async (params: {
  call: ToolCall;
  state: LoopState;
  signal: unknown;
  validateCandidate: ValidateCandidate;
}): Promise<CallAnswer> => {
  const { call, state, signal } = params;
  if (call.tool_name !== VALIDATE_SPEC_TOOL) {
    return { output: unknownToolOutput(call.tool_name), state, signal };
  }
  if (signal !== undefined) {
    return { output: signal, state, signal };
  }
  if (state.attempts >= MAX_TOTAL_VALIDATIONS) {
    return { stopped: stoppedReply({ state, validated: state.last }), state };
  }
  const candidate = candidateFromArgs(call.args);
  const checked = await params.validateCandidate(candidate);
  const validated = {
    spec: checked.spec,
    issues: normalizeIssues(checked.issues),
  };
  return state.recovery
    ? afterRecovery({ state, recovery: state.recovery, validated, candidate })
    : beforeRecovery({ state, validated });
};

/**
 * Answers one batch of pending tool calls of a generation, in order. A
 * `validate_spec` call is validated with `validateCandidate` and answered with
 * the normalized candidate and its normalized issues, unless:
 *
 * - it exhausts the loop (the {@link MAX_VALIDATION_ATTEMPTS}th validation, or
 *   one that leaves at least as many issues as the previous) with no recovery
 *   sent yet: it is answered with the recovery signal (`recovery_required`,
 *   the trigger, the candidate, its issues, the history and
 *   {@link RECOVERY_INSTRUCTIONS}) while a validation remains in the budget,
 *   and every later `validate_spec` call of the batch gets the same signal,
 *   unvalidated; with none left, the turn stops as `budget-exhausted`;
 * - it comes after the signal and its issues (plus `semantic-drift`) are not
 *   empty: the turn stops as `recovery-failed`;
 * - it would be validation number {@link MAX_TOTAL_VALIDATIONS} + 1: it is not
 *   validated and the turn stops.
 *
 * A rejection of `validateCandidate` propagates: no attempt is counted.
 *
 * @param params.state - The loop state before the batch.
 * @returns The outputs and the next state, or the stop and its state.
 *
 * @example
 * const answered = await answerToolCalls({ calls, validateCandidate, state });
 */
export const answerToolCalls = async (params: {
  calls: ToolCall[];
  validateCandidate: ValidateCandidate;
  state: LoopState;
}): Promise<
  { state: LoopState } & (
    | { stopped: SpecReplyStopped }
    | { outputs: ToolOutput[] }
  )
> => {
  let state = params.state;
  let signal: unknown;
  const outputs: ToolOutput[] = [];
  for (const call of params.calls) {
    const answer = await answerCall({
      call,
      state,
      signal,
      validateCandidate: params.validateCandidate,
    });
    if ('stopped' in answer) {
      return answer;
    }
    state = answer.state;
    signal = answer.signal;
    outputs.push({ tool_call_id: call.id, output: answer.output });
  }
  return { outputs, state };
};

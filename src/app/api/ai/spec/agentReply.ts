import {
  collectStructuralIssues,
  normalizeCandidate,
} from './candidateValidation';
import { attachFilters } from './mapDataFilters';
import type {
  SpecReplyError,
  SpecReplyOk,
  SpecReplyStopped,
} from './naturaliSession';
import {
  invalidSpecResponse,
  isRecord,
  type UnknownRecord,
} from './specValidation';

/** Fixed text for a declined request: the agent's own message is never sent to the browser. */
const AGENT_DECLINED_MESSAGE =
  'O modelo de IA não pôde gerar o mapa com este pedido. Reformule o pedido informando o dataset e o tipo de mapa desejados.';

const STOP_REASON_MESSAGE: Record<SpecReplyStopped['reason'], string> = {
  'max-attempts': 'esgotou as tentativas de validação',
  'no-shrinkage': 'parou de reduzir os problemas entre tentativas',
};

/**
 * The 422 for a validation loop that gave up, carrying its last candidate.
 *
 * Carries the candidate as validateCandidate returned it (locally repaired),
 * before MapData append: the
 * playground shows it so a rejected spec can be inspected. Never served as a
 * map (see the `devanity.rules.json` invariant for every 422 form).
 */
const stoppedResponse = (reply: SpecReplyStopped): Response => {
  return invalidSpecResponse({
    message: `A spec gerada não passou na validação: o modelo ${STOP_REASON_MESSAGE[reply.reason]} (${reply.attempts} de até 5). Tente reformular o pedido.`,
    issues: reply.issues,
    spec: reply.spec,
  });
};

/**
 * Resolves the agent's structured reply into the raw spec object
 * (`status: "ok"`), or the 422 `Response` for a declined request
 * (`status: "error"`), a validation loop that gave up (`status: "stopped"`),
 * a non-object spec, `filters` naming no `mapData` entry, or one failing the
 * structural checks. The reply's `filters` are moved onto the entries they
 * name (see `attachFilters`), where the server reads them. A non-object spec
 * or a `filters` failure is carried raw; a structural failure carries it
 * normalized by `normalizeCandidate` (see {@link stoppedResponse}).
 *
 * @param reply - The `reply` of {@link generateInSession}.
 * @returns The spec, with its filters on its entries, normalized by
 * `normalizeCandidate`, or the 422 `Response`.
 *
 * @example
 * const spec = resolveAgentReply({ status: 'ok', spec: { layers: [] } });
 */
export const resolveAgentReply = (
  reply: SpecReplyOk | SpecReplyError | SpecReplyStopped
): UnknownRecord | Response => {
  if (reply.status === 'stopped') {
    return stoppedResponse(reply);
  }

  if (reply.status === 'error') {
    return invalidSpecResponse({
      message: AGENT_DECLINED_MESSAGE,
      issues: [{ code: reply.error.code, message: AGENT_DECLINED_MESSAGE }],
    });
  }

  if (!isRecord(reply.spec)) {
    return invalidSpecResponse({
      message:
        'A resposta do modelo deveria ser um objeto JSON representando o spec.',
      spec: reply.spec,
    });
  }

  const attached = attachFilters({ spec: reply.spec, filters: reply.filters });
  if (attached.issues.length > 0) {
    return invalidSpecResponse({
      message: `${attached.issues[0].message} Tente reformular o pedido.`,
      issues: attached.issues,
      spec: reply.spec,
    });
  }

  const spec = normalizeCandidate(attached.spec);
  const structuralIssues = collectStructuralIssues(spec);
  if (structuralIssues.length > 0) {
    return invalidSpecResponse({
      message: `${structuralIssues[0].message} Tente reformular o pedido.`,
      issues: structuralIssues,
      spec,
    });
  }

  return spec;
};

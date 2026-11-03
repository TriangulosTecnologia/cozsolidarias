import type { VisualizationSpec } from '@ttoss/geovis';

/** One validation issue reported by `POST /api/ai/spec`. */
export type Issue = { code: string; message: string; path?: string };

/** An {@link Issue} plus what the user can do about it. */
export type Requirement = Issue & { fix: string };

/** One selectable dataset or map type. */
export type ChoiceOption = { value: string; label: string };

/** The question the server asks when a request is ambiguous. */
export type Clarification = {
  facet: 'dataset' | 'mapType';
  question: string;
  options: ChoiceOption[];
  default: string;
};

/**
 * The user's answers to a previous turn, sent with the prompt. The server
 * validates every value; `sessionId` continues the conversation that
 * produced the answer's question.
 */
export type Choices = {
  mapType?: string;
  datasetId?: string;
  sessionId?: string;
};

/** Body of every `POST /api/ai/spec` response (see the route's `POST`). */
type SpecResponseBody = {
  spec?: unknown;
  error?: boolean;
  message?: string;
  issues?: Issue[];
  requirements?: Requirement[];
  clarify?: Clarification;
  mapTypeOptions?: ChoiceOption[];
};

/**
 * Outcome of one `POST /api/ai/spec` submission. A failure carries the
 * server's `spec` too, whenever it generated one, so it can be inspected.
 * Every outcome carries the map types on offer and the session to continue.
 */
export type SubmitOutcome = {
  sessionId: string | null;
  mapTypeOptions: ChoiceOption[];
} & (
  | { kind: 'success'; result: VisualizationSpec }
  | { kind: 'clarify'; clarify: Clarification }
  | {
      kind: 'failure';
      message: string;
      issues: Issue[];
      requirements: Requirement[];
      spec?: unknown;
    }
);

const isVisualizationSpec = (value: unknown): value is VisualizationSpec => {
  return typeof value === 'object' && value !== null && 'layers' in value;
};

/** A failure that never reached the server's contract (no issues, no options). */
const failure = (message: string): SubmitOutcome => {
  return {
    kind: 'failure',
    message,
    issues: [],
    requirements: [],
    sessionId: null,
    mapTypeOptions: [],
  };
};

/** The failure the server reported, with its diagnostics. */
const serverFailure = (params: {
  base: Pick<SubmitOutcome, 'sessionId' | 'mapTypeOptions'>;
  body: SpecResponseBody;
  message: string;
}): SubmitOutcome => {
  return {
    ...params.base,
    kind: 'failure',
    message: params.message,
    issues: params.body.issues ?? [],
    requirements: params.body.requirements ?? [],
    spec: params.body.spec,
  };
};

/** What every outcome carries: the session to continue and the map types on offer. */
const baseOf = (params: {
  response: Response;
  body: SpecResponseBody;
}): Pick<SubmitOutcome, 'sessionId' | 'mapTypeOptions'> => {
  return {
    sessionId: params.response.headers.get('x-session-id'),
    mapTypeOptions: params.body.mapTypeOptions ?? [],
  };
};

const interpret = (params: {
  response: Response;
  body: SpecResponseBody;
}): SubmitOutcome => {
  const { response, body } = params;
  const base = baseOf(params);

  if (!response.ok || body.error !== false) {
    return serverFailure({
      base,
      body,
      message:
        body.message ??
        `O servidor recusou o pedido (status ${response.status}), sem detalhar o motivo.`,
    });
  }
  if (body.clarify) {
    return { ...base, kind: 'clarify', clarify: body.clarify };
  }
  if (!isVisualizationSpec(body.spec)) {
    return serverFailure({
      base,
      body,
      message:
        'O servidor respondeu com sucesso, mas sem a especificação do mapa ("spec" ausente).',
    });
  }
  return { ...base, kind: 'success', result: body.spec };
};

/**
 * Calls `POST /api/ai/spec` with `prompt` and the user's `choices`, reducing
 * every failure mode (network failure, non-JSON body, `error: true`, a
 * success with no `spec`) to a `failure` with a single pt-BR message; the
 * server's `clarify` question, `issues`, `requirements` and `spec` are
 * carried through.
 *
 * @example
 * const outcome = await submitPrompt({ prompt: 'IVS por município', mapType: 'choropleth' });
 */
export const submitPrompt = async (
  params: { prompt: string } & Choices
): Promise<SubmitOutcome> => {
  let response: Response;
  try {
    response = await fetch('/api/ai/spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    return failure(
      'Falha de conexão. Verifique sua internet e tente novamente.'
    );
  }

  try {
    return interpret({
      response,
      body: (await response.json()) as SpecResponseBody,
    });
  } catch {
    return failure(
      `O servidor respondeu com um conteúdo inesperado (status ${response.status}). Tente novamente.`
    );
  }
};

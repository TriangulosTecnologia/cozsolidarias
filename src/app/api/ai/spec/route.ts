import type { MapType } from '@ttoss/geovis';

import { gateway } from '@/gateway';

import { buildAgentMessage } from './agentMessage';
import { resolveAgentReply } from './agentReply';
import {
  validateCandidate,
  validateWithLocalRepairs,
} from './candidateValidation';
import baseVisualizationSpecJson from './instructions/baseVisualizationSpec.json';
import {
  buildCatalogueContext,
  type RenderableDatasetId,
} from './mapDataCatalogue';
import { MAP_TYPE_OPTIONS } from './mapTypeOptions';
import { generateInSession, withSessionId } from './naturaliSessionApi';
import {
  type Clarification,
  clarifyResponse,
  preflightPrompt,
} from './preflight';
import { resolveServedSpec } from './serveSpec';
import { applyProportionalCirclesDefaults, mergeSpecs } from './specDefaults';
import {
  errorResponse,
  invalidSpecResponse,
  type UnknownRecord,
} from './specValidation';
import { validateDatasetId } from './validateDatasetId';
import { validateMapType } from './validateMapType';
import { validateSessionId } from './validateSessionId';

let cachedCatalogueText: Promise<string> | null = null;

/**
 * Builds the two-tier catalog context (see {@link buildCatalogueContext})
 * once and keeps it in memory for the process lifetime. Joined into the
 * single `messages[0].content` sent on every call (see
 * {@link getAgentResponse}), never resent mid-turn.
 */
const readCatalogueContext = (): Promise<string> => {
  if (!cachedCatalogueText) {
    cachedCatalogueText = gateway.getCatalogue().then(buildCatalogueContext);
  }
  return cachedCatalogueText;
};

const promptError = (message: string): Response => {
  return errorResponse({ status: 400, message: `Campo "prompt": ${message}` });
};

const validatePrompt = (rawBody: unknown): string | Response => {
  if (!rawBody || typeof rawBody !== 'object') {
    return promptError('envie um corpo JSON com um campo "prompt" de texto.');
  }

  if (!('prompt' in rawBody)) {
    return promptError('campo obrigatório ausente no corpo da requisição.');
  }

  const rawPrompt = (rawBody as { prompt?: unknown }).prompt;
  if (typeof rawPrompt !== 'string') {
    return promptError(
      `esperado texto, recebido ${rawPrompt === null ? 'null' : typeof rawPrompt}.`
    );
  }

  const prompt = rawPrompt.trim();
  if (prompt.length < 1) {
    return promptError('não pode ser vazio.');
  }
  if (prompt.length > 500) {
    return promptError(`máximo de 500 caracteres (recebido ${prompt.length}).`);
  }

  return prompt;
};

type ParsedRequest = {
  prompt: string;
  sessionId?: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
};

/** The clarify question, echoing the client's session so the conversation can continue. */
const clarifyAnswer = (
  clarify: Clarification,
  sessionId?: string
): Response => {
  const response = clarifyResponse(clarify);
  return sessionId ? withSessionId(response, sessionId) : response;
};

/**
 * Validates the whole request body — the `prompt` and the optional `mapType`
 * and `datasetId` — then runs the {@link preflightPrompt}, answering with the
 * question when the request is ambiguous.
 */
const parseRequest = (rawBody: unknown): ParsedRequest | Response => {
  const prompt = validatePrompt(rawBody);
  if (prompt instanceof Response) {
    return prompt;
  }
  // `validatePrompt` guarantees `rawBody` is an object.
  const mapType = validateMapType(rawBody as object);
  if (mapType instanceof Response) {
    return mapType;
  }
  const datasetId = validateDatasetId(rawBody as object);
  if (datasetId instanceof Response) {
    return datasetId;
  }
  const sessionId = validateSessionId(rawBody as object);
  if (sessionId instanceof Response) {
    return sessionId;
  }
  const preflight = preflightPrompt({ prompt, mapType, datasetId });
  return preflight.status === 'ambiguous'
    ? clarifyAnswer(preflight.clarify, sessionId)
    : { prompt, mapType, datasetId, sessionId };
};

const validateEnv = ():
  | {
      apiKey: string;
      projectId: string;
      agentId: string;
    }
  | Response => {
  const apiKey = process.env['NATURALI_API_KEY'];
  const projectId = process.env['NATURALI_PROJECT_ID'];
  const agentId = process.env['NATURALI_AGENT_ID'];

  if (!apiKey || !projectId || !agentId) {
    const missing = [
      !apiKey ? 'NATURALI_API_KEY' : null,
      !projectId ? 'NATURALI_PROJECT_ID' : null,
      !agentId ? 'NATURALI_AGENT_ID' : null,
    ].filter((name): name is string => {
      return name !== null;
    });

    return errorResponse({
      status: 400,
      message: `Configuração ausente no ambiente do servidor: ${missing.join(', ')}.`,
    });
  }

  return { apiKey, projectId, agentId };
};

/**
 * Turns one of {@link generateSpec}'s thrown errors (reached through {@link generateInSession}) into a Portuguese,
 * cause-specific message — so a 502 never collapses a transport failure, a
 * failed generation, and an unparseable reply into the same generic
 * sentence. Matches on the fixed prefixes that function throws; anything
 * else (e.g. a network-level fetch failure) falls back to the raw
 * `error.message` so it's still legible.
 */
const describeAgentFailure = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith('Naturali generate POST responded with status')) {
    return `Não foi possível iniciar a geração com o modelo de IA (${message}). Tente novamente em instantes.`;
  }
  if (message.startsWith('Naturali generation ended with status')) {
    return `O modelo de IA não concluiu a geração (${message}). Tente reformular o pedido ou tentar novamente.`;
  }
  if (
    message ===
    'Naturali generation completed with no structured status/spec/error reply'
  ) {
    return 'O modelo de IA encerrou a resposta sem gerar nenhum conteúdo estruturado. Tente reformular o pedido.';
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'O modelo de IA não respondeu dentro do tempo limite. Tente novamente ou simplifique o pedido.';
  }

  return `Falha de comunicação com o modelo de IA: ${message}`;
};

/**
 * Runs one turn in a Naturali session — serving the agent's `validate_spec`
 * tool with {@link validateCandidate} — and resolves the reply (see
 * {@link resolveAgentReply}). Extracted out of {@link POST} purely to keep its
 * own branching under the lint complexity budget.
 *
 * @returns The spec object and the id of the session it ran in, or a
 * `Response` for a transport failure (502) or a rejected spec (422; stamped
 * with the session id once one exists).
 */
const getAgentResponse = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  sessionId?: string;
  prompt: string;
  mapType?: MapType;
  datasetId?: RenderableDatasetId;
}): Promise<{ spec: UnknownRecord; sessionId: string } | Response> => {
  const choices = {
    prompt: params.prompt,
    mapType: params.mapType,
    datasetId: params.datasetId,
  };
  let generated: Awaited<ReturnType<typeof generateInSession>>;
  try {
    generated = await generateInSession({
      apiKey: params.apiKey,
      projectId: params.projectId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      message: buildAgentMessage({
        ...choices,
        catalogueText: await readCatalogueContext(),
      }),
      followUpMessage: buildAgentMessage(choices),
      validateCandidate,
    });
  } catch (error) {
    return errorResponse({ status: 502, message: describeAgentFailure(error) });
  }

  if ('error' in generated) {
    return withSessionId(
      errorResponse({
        status: 502,
        message: describeAgentFailure(generated.error),
      }),
      generated.sessionId
    );
  }

  const spec = resolveAgentReply(generated.reply);
  return spec instanceof Response
    ? withSessionId(spec, generated.sessionId)
    : { spec, sessionId: generated.sessionId };
};

/**
 * Turns a natural-language prompt into a `VisualizationSpec`, via a Naturali
 * agent running in a session (`POST /sessions/{id}/generate?wait=true`, see
 * {@link generateInSession}) declared by the `geovis-spec-generator-loop`
 * formation (`agents/geovis-spec-generator/formation.json`, deployed by that
 * folder's scripts) and referenced here only by ID. The agent validates its candidate
 * with the client-side `validate_spec` tool — repaired locally first, at most
 * 5 calls, stopping when issues stop shrinking or the 55s deadline passes —
 * and returns a structured `{status: "ok", spec}` or `{status: "error",
 * error}` reply.
 *
 * The reply is then resolved into real data (see {@link resolveServedSpec})
 * and validated once more, with the same local repairs. Before any of that,
 * an ambiguous request is answered with a `clarify` question instead (see
 * {@link preflightPrompt}); the session id travels in the `x-session-id`
 * response header, and sending it back as `sessionId` continues the session.
 *
 * @returns `{ spec, error: false }` on success; `{ error: true, message,
 * issues?, spec? }` on any failure (missing config, prompt validation,
 * upstream API failure, a declined request, a validation loop that gave up,
 * or an unsupported dataset reference) — `spec` is the last generated
 * candidate whenever one exists.
 */
export const POST = async (request: Request): Promise<Response> => {
  const rawBody: unknown = await request.json().catch(() => {
    return null;
  });

  const requestOrError = parseRequest(rawBody);
  if (requestOrError instanceof Response) {
    return requestOrError;
  }

  const envOrError = validateEnv();
  if (envOrError instanceof Response) {
    return envOrError;
  }

  const modelJsonOrError = await getAgentResponse({
    apiKey: envOrError.apiKey,
    projectId: envOrError.projectId,
    agentId: envOrError.agentId,
    sessionId: requestOrError.sessionId,
    prompt: requestOrError.prompt,
    mapType: requestOrError.mapType,
    datasetId: requestOrError.datasetId,
  });
  if (modelJsonOrError instanceof Response) {
    return modelJsonOrError;
  }
  const { sessionId } = modelJsonOrError;

  const servedOrError = await resolveServedSpec(
    mergeSpecs(
      baseVisualizationSpecJson as UnknownRecord,
      modelJsonOrError.spec
    )
  );
  if (servedOrError instanceof Response) {
    return withSessionId(servedOrError, sessionId);
  }

  const { spec, issues } = validateWithLocalRepairs(
    applyProportionalCirclesDefaults(servedOrError)
  );
  if (issues.length > 0) {
    return withSessionId(invalidSpecResponse({ issues, spec }), sessionId);
  }

  return withSessionId(
    Response.json({ spec, error: false, mapTypeOptions: MAP_TYPE_OPTIONS }),
    sessionId
  );
};

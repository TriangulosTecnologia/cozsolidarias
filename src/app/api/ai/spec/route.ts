import { gateway } from '@/gateway';

import baseVisualizationSpecJson from './baseVisualizationSpec.json';
import {
  collectStructuralIssues,
  validateCandidate,
  validateWithLocalRepairs,
} from './candidateValidation';
import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
import endpointsDocumentation from './endpointsDocumentation.json';
import { buildCatalogueContext } from './mapDataCatalogue';
import { generateSpec, type SpecReplyStopped } from './naturaliSession';
import {
  appendRealMapData,
  appendRealSourceData,
  buildSourcesTable,
  errorResponse,
  hoistLayerLegends,
  invalidSpecResponse,
  isRecord,
  type UnknownRecord,
} from './specValidation';

const INSTRUCTIONS = `

${buildSourcesTable()}

## VisualizationSpec Base

Utilize como valores padrão, a partir para gerar o VisualizationSpec output solicitado

${JSON.stringify(baseVisualizationSpecJson, null, 2)}

- Faça a remoção dos objetos de legends que não serão utilizados para o resultado do mapa

- Faça a remoção dos objetos de layers que não serão utilizados para o resultado do mapa

ex: cozinhas-bolhas só é incluída quando há dados de /api/cozinhas/bolhas

## Rotas de API Cozinhas Solidárias

Utilize para identificar quais rotas de api popular no campo sources[].data para incluir ao json output

ex: Como um pedido de mapa de pontos proporcionais com o número de cozinhas por município foi solicitado, o path correto é o /api/cozinhas/bolhas.

${JSON.stringify(endpointsDocumentation, null, 2)}
`;

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
 * Turns one of {@link generateSpec}'s thrown errors into a Portuguese,
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

const STOP_REASON_MESSAGE: Record<SpecReplyStopped['reason'], string> = {
  'max-attempts': 'esgotou as tentativas de validação',
  'no-shrinkage': 'parou de reduzir os problemas entre tentativas',
};

/** The 422 for a validation loop that gave up, carrying its last candidate. */
const stoppedResponse = (reply: SpecReplyStopped): Response => {
  return invalidSpecResponse({
    message: `A spec gerada não passou na validação: o modelo ${STOP_REASON_MESSAGE[reply.reason]} (${reply.attempts} de até 5). Tente reformular o pedido.`,
    issues: reply.issues,
    spec: reply.spec,
  });
};

/**
 * Runs one turn against the Naturali agent — serving its `validate_spec`
 * tool with {@link validateCandidate} — and resolves the reply into the raw
 * spec object (`status: "ok"`), or the 422 `Response` for a declined request
 * (`status: "error"`) or a validation loop that gave up (`status: "stopped"`).
 * Extracted out of {@link POST} purely to keep its own branching under the
 * lint complexity budget.
 *
 * @returns The parsed spec object with layer legends hoisted, or a
 * `Response` for a transport failure (502) or a rejected spec (422).
 */
const getAgentResponse = async (params: {
  apiKey: string;
  projectId: string;
  agentId: string;
  prompt: string;
}): Promise<UnknownRecord | Response> => {
  let reply: Awaited<ReturnType<typeof generateSpec>>;
  try {
    const catalogueText = await readCatalogueContext();
    reply = await generateSpec({
      apiKey: params.apiKey,
      projectId: params.projectId,
      agentId: params.agentId,
      message: [
        'O catalogo json schema do projeto Cozinha Solidária em Rede contém todos os datasets conhecidos e o detalhe completo apenas dos datasets que podem popular `mapData` hoje. Use-o para gerar um spec de visualização geográfica (um mapa) que atenda ao pedido do usuário.',
        `Catálogo de datasets:\n${catalogueText}`,
        INSTRUCTIONS,
        params.prompt,
      ].join('\n\n'),
      validateCandidate,
    });
  } catch (error) {
    return errorResponse({ status: 502, message: describeAgentFailure(error) });
  }

  if (reply.status === 'stopped') {
    return stoppedResponse(reply);
  }

  if (reply.status === 'error') {
    return invalidSpecResponse({
      message: reply.error.message,
      issues: [{ code: reply.error.code, message: reply.error.message }],
    });
  }

  if (!isRecord(reply.spec)) {
    return invalidSpecResponse({
      message:
        'A resposta do modelo deveria ser um objeto JSON representando o spec.',
      spec: reply.spec,
    });
  }

  const spec = hoistLayerLegends(reply.spec);
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

/**
 * Resolves the agent's spec into the one served to the client: the
 * cozinhas-per-município choropleth is rebuilt from `/mapas`'s own builder
 * (see {@link buildCozinhasChoroplethSpec}); every other spec gets its real
 * `mapData` values (see {@link appendRealMapData}). Either way, API-backed
 * `sources[].data` is then fetched server-side (see
 * {@link appendRealSourceData}) while static `/geo/*` URLs are kept for the
 * browser.
 */
const resolveServedSpec = async (
  spec: UnknownRecord
): Promise<UnknownRecord | Response> => {
  const withMapData = isCozinhasChoroplethRequest(spec)
    ? await buildCozinhasChoroplethSpec()
    : await appendRealMapData(spec);
  if (withMapData instanceof Response) {
    return withMapData;
  }
  return appendRealSourceData(withMapData);
};

/**
 * Turns a natural-language prompt into a `VisualizationSpec`, via a Naturali
 * agent (`POST /agents/{agentId}/generate?wait=true`, see
 * {@link generateSpec}) declared by the `geovis-spec-generator-loop`
 * formation (`agents/geovis-spec-generator/formation.json`, deployed by that
 * folder's scripts) and referenced here only by ID. The agent validates its candidate
 * with the client-side `validate_spec` tool — repaired locally first, at most
 * 5 calls, stopping when issues stop shrinking or the 55s deadline passes —
 * and returns a structured `{status: "ok", spec}` or `{status: "error",
 * error}` reply.
 *
 * The reply is then resolved into real data (see {@link resolveServedSpec})
 * and validated once more, with the same local repairs.
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

  const promptOrError = validatePrompt(rawBody);
  if (promptOrError instanceof Response) {
    return promptOrError;
  }

  const envOrError = validateEnv();
  if (envOrError instanceof Response) {
    return envOrError;
  }

  const modelJsonOrError = await getAgentResponse({
    apiKey: envOrError.apiKey,
    projectId: envOrError.projectId,
    agentId: envOrError.agentId,
    prompt: promptOrError,
  });
  if (modelJsonOrError instanceof Response) {
    return modelJsonOrError;
  }

  const servedOrError = await resolveServedSpec(modelJsonOrError);
  if (servedOrError instanceof Response) {
    return servedOrError;
  }

  const { spec, issues } = validateWithLocalRepairs(servedOrError);
  if (issues.length > 0) {
    return invalidSpecResponse({ issues, spec });
  }

  return Response.json({
    spec,
    error: false,
  });
};

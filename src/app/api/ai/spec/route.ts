import { validateSpec } from '@ttoss/geovis';

import { gateway } from '@/gateway';

import { buildCatalogueContext } from './mapDataCatalogue';
import {
  appendRealMapData,
  findInvalidGeojsonSource,
  invalidSpecResponse,
  isRecord,
  KNOWN_SOURCE_URLS,
} from './specValidation';

const INSTRUCTIONS = `Os datasets acima são um parcial do catalogo json schema do projeto Cozinha Solidária em Rede, com todos os datasets conhecidos e o detalhe completo apenas dos datasets que podem popular \`mapData\` hoje. Use-o para gerar um spec de visualização geográfica (um mapa) que atenda ao pedido do usuário.

Seu ambiente de execução não tem acesso a nenhum checkout local do monorepo \`ttoss\` — não tente localizar ou ler arquivos locais. Consulte o JSON Schema vigente do \`VisualizationSpec\` (draft 2020-12) na fonte pública indicada nas suas instruções.

Regra obrigatória: \`mapData\` é só para valores que colorem/dimensionam uma layer (join por \`geometryId\`) — nunca para a geometria de base. A geometria de municípios já existe como GeoJSON público em \`/geo/geojs-100-mun.json\` (propriedade de join: \`codarea\`); referencie-a em \`sources\` (\`data: "/geo/geojs-100-mun.json"\`), nunca em \`mapData\`. \`mapData[].mapDataId\` só pode usar um dos ids da lista "renderableDatasets" do catálogo, exatamente como aparecem. Nunca invente um mapDataId fora dessa lista. Nunca preencha \`mapData[].data\` com valores fictícios — o \`data\` enviado aqui é sempre substituído por dados reais depois de gerado; um array vazio é aceitável.

Se o pedido do usuário só corresponder a um dataset do catálogo que NÃO está na lista "renderableDatasets" (ainda não disponível), responda apenas com {"error": "..."} explicando em português que aquele dado ainda não está disponível para visualização — não mapeie para outro dataset ao acaso.

\`engine\`, \`sources\` e \`layers\` são sempre obrigatórios no spec, mesmo quando \`mapType\` é usado — \`mapType\` nunca substitui \`layers\`. Toda layer precisa referenciar um \`sourceId\` existente em \`sources\`.

Regra obrigatória sobre \`sources[].data\`: diferente de \`mapData[].data\`, o \`data\` de uma source NUNCA é substituído depois — o que você escrever aí é exatamente o que chega ao mapa. É proibido usar um \`FeatureCollection\` vazio/fictício, ou inventar uma URL, como \`data\` de uma source. As únicas URLs válidas de geometria neste app são: \`/geo/geojs-100-mun.json\` (municípios, join \`codarea\`), \`/geo/estados.json\`, \`/geo/assentamentos.json\`, \`/api/cozinhas\` (pontos de cozinhas) e \`/api/cozinhas/bolhas\`. Nunca use qualquer outra URL. Se o pedido for agregado "por município", não crie uma source de pontos — use só \`/geo/geojs-100-mun.json\` com o valor via \`mapData\`.`;

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
const stripCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
};

let cachedCatalogueText: Promise<string> | null = null;

/**
 * Builds the two-tier catalog context (see {@link buildCatalogueContext})
 * once and keeps it in memory for the process lifetime. Sent as
 * `initial_events` on every new session (see {@link createSession}), never
 * resent mid-turn.
 */
const readCatalogueContext = (): Promise<string> => {
  if (!cachedCatalogueText) {
    cachedCatalogueText = gateway.getCatalogue().then(buildCatalogueContext);
  }
  return cachedCatalogueText;
};

/** One event as returned by the Managed Agents session-events endpoints. */
type SessionEvent = {
  id: string;
  type: string;
  processed_at: string | null;
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: { type: string };
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
const createSession = async (params: {
  apiKey: string;
  agentId: string;
  environmentId: string;
  catalogueText: string;
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
            { type: 'text', text: INSTRUCTIONS },
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
const pollForReply = async (params: {
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
 * state — best-effort: a failure here doesn't affect the response already
 * built for the client, so it's swallowed rather than surfaced.
 */
const deleteSession = async (params: {
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

const validatePrompt = (rawBody: unknown): string | Response => {
  if (
    !rawBody ||
    typeof rawBody !== 'object' ||
    !('prompt' in rawBody) ||
    typeof (rawBody as { prompt?: unknown }).prompt !== 'string'
  ) {
    return Response.json(
      { error: 'Prompt inválido: envie um texto entre 1 e 500 caracteres.' },
      { status: 400 }
    );
  }

  const prompt = (rawBody as { prompt: string }).prompt.trim();
  if (prompt.length < 1 || prompt.length > 500) {
    return Response.json(
      { error: 'Prompt inválido: envie um texto entre 1 e 500 caracteres.' },
      { status: 400 }
    );
  }

  return prompt;
};

const validateEnv = ():
  | {
      apiKey: string;
      agentId: string;
      environmentId: string;
    }
  | Response => {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const agentId = process.env['ANTHROPIC_AGENT_ID'];
  const environmentId = process.env['ANTHROPIC_ENVIRONMENT_ID'];

  if (!apiKey || !agentId || !environmentId) {
    return Response.json(
      {
        error:
          'Configuração ausente: defina ANTHROPIC_API_KEY, ANTHROPIC_AGENT_ID e ANTHROPIC_ENVIRONMENT_ID no ambiente do servidor.',
      },
      { status: 400 }
    );
  }

  return { apiKey, agentId, environmentId };
};

const getAgentResponse = async (params: {
  apiKey: string;
  agentId: string;
  environmentId: string;
  prompt: string;
}): Promise<string | Response> => {
  let sessionId: string | null = null;
  try {
    const catalogueText = await readCatalogueContext();
    sessionId = await createSession({
      apiKey: params.apiKey,
      agentId: params.agentId,
      environmentId: params.environmentId,
      catalogueText,
      prompt: params.prompt,
    });
    return await pollForReply({ apiKey: params.apiKey, sessionId });
  } catch {
    return Response.json(
      { error: 'Falha ao consultar o modelo de IA. Tente novamente.' },
      { status: 502 }
    );
  } finally {
    if (sessionId) {
      await deleteSession({ apiKey: params.apiKey, sessionId });
    }
  }
};

/**
 * Turns a natural-language prompt into a `VisualizationSpec`, via a
 * single-use Anthropic Managed Agents session created fresh per request
 * (`POST /v1/sessions` with `initial_events`, then `GET /v1/sessions/{id}/events`)
 * — the session is bound to the `geovis-spec-generator` agent (see
 * `geovis-spec-generator.en.agent.yaml`), provisioned once out of band (e.g.
 * via the `ant` CLI) and referenced here only by ID, and is deleted once the
 * reply is read.
 *
 * The agent's raw reply is parsed as JSON, then its `mapData` is resolved
 * against real `data-gateway` values (see {@link appendRealMapData}) before
 * being returned — the agent's own `mapData[].data` is never sent to the
 * client as-is.
 *
 * @returns `{ result }` with the spec (real `mapData`) on success; `{ error }`
 * with a Portuguese, dev-friendly message on any failure (missing config,
 * prompt validation, upstream API failure, non-JSON reply, or an unsupported
 * dataset reference).
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

  const modelTextOrError = await getAgentResponse({
    apiKey: envOrError.apiKey,
    agentId: envOrError.agentId,
    environmentId: envOrError.environmentId,
    prompt: promptOrError,
  });
  if (modelTextOrError instanceof Response) {
    return modelTextOrError;
  }

  let modelJson: unknown;
  try {
    modelJson = JSON.parse(stripCodeFence(modelTextOrError));
  } catch (parseError) {
    return invalidSpecResponse({
      message: `A resposta do modelo não é um JSON válido: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`,
      spec: modelTextOrError,
    });
  }

  if (!isRecord(modelJson)) {
    return invalidSpecResponse({
      message:
        'A resposta do modelo deveria ser um objeto JSON representando o spec.',
      spec: modelJson,
    });
  }

  const invalidSourceId = findInvalidGeojsonSource(modelJson);
  if (invalidSourceId) {
    return invalidSpecResponse({
      message: `A source "${invalidSourceId}" não referencia um endpoint real de geometria (URLs válidas: ${KNOWN_SOURCE_URLS.join(', ')}) ou veio com uma coleção de feições vazia inventada pelo modelo. Tente reformular o pedido.`,
      spec: modelJson,
    });
  }

  const specOrError = await appendRealMapData(modelJson);
  if (specOrError instanceof Response) {
    return specOrError;
  }

  const validation = validateSpec(specOrError);
  if (validation.status !== 'resolved') {
    return invalidSpecResponse({
      issues: validation.issues.map((issue) => {
        return { code: issue.code, message: issue.message };
      }),
      spec: specOrError,
    });
  }

  return Response.json({ result: specOrError });
};

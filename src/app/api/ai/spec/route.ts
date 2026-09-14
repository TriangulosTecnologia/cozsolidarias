import { validateSpec } from '@ttoss/geovis';

import { gateway } from '@/gateway';

import { buildCatalogueContext } from './mapDataCatalogue';
import {
  appendRealMapData,
  findGeometryInMapData,
  findInvalidGeojsonSource,
  findMissingLegend,
  invalidSpecResponse,
  isRecord,
  KNOWN_SOURCE_URLS,
  type UnknownRecord,
} from './specValidation';

const INSTRUCTIONS = `## O que é

Cozinhas Solidárias é uma aplicação pública que mapeia cozinhas comunitárias
de combate à fome no Brasil — onde estão, quantas pessoas atendem e como essa
presença se relaciona com vulnerabilidade social, insegurança alimentar e
agricultura familiar em cada município. O público-alvo é qualquer pessoa
interessada em segurança alimentar (jornalistas, gestores públicos,
pesquisadores, a própria rede de cozinhas), não apenas especialistas em SIG.
Todo dado exibido é agregado por município — o cadastro individual das
cozinhas contém dados pessoais (endereço, CNPJ, e-mail) e nunca é exposto
linha a linha.

## Para resolver os campos da spec, siga as instruções abaixo:

tipo de mapa (mapType):
"Dado pergunta '[pergunta usuário]', qual tipo cartográfico melhor representa? Considerar: coroplético (área agregada) - válido somente para variáveis relativas (razões, taxas e percentuais), não utilizar para contagens absolutas, pontos proporcionais (unidade individual) - para constagens, dot density - escolha quando uma unidade representar uma quantidade fixa (ex: 1 ponto = 1.000 habitantes, 1 ponto = 1 cozinha. Sempre adicione esta informação na legenda), cluster. Justificar pela granularidade real do dado — se maioria município tem só 1-2 pontos, coroplético mascara variação, pontos melhor. Listar tipo recomendado + 1 alternativa com trade-off."                                                                                            Variável:
"Varrer dataset_catalogue.json (campo schema.fields[].name/description/unit) e achar campo cujo description bata literal com conceito pedido — não sinônimo, não correlato. Se não existir pronto, apontar campo-base + operação necessária (soma/agregação/join) pra derivar. Retornar: dataset_id, campo, grain (spatial.grain.code), se precisa agregação e por qual chave (Código IBGE/codarea)."

Prompt ampliado — proxy seguro:
"Antes de aceitar variável como resposta: (1) listar todo campo do catálogo cujo description/tags toquem tema semelhante (ex.: cadastro, vulnerabilidade, cobertura); (2) pra cada um, testar se mede exatamente o pedido ou mede algo adjacente (input, causa, correlato) — declarar explicitamente a diferença semântica; (3) só aceitar como resposta direta campo cujo description bate 1:1 com a pergunta; (4) todo outro campo correlato entra como 'proxy descartado' com motivo, nunca usado sem aviso. Objetivo: nunca responder pergunta X com dado que mede Y só por estarem no mesmo domínio."

abrangência espacial (spatial.coverage + spatial.extent):
"Ler spatial.coverage (exhaustive/partial) e spatial.extent do dataset escolhido. Se partial, listar em access.notes/description o que fica de fora (ex.: sem coordenada, só habilitadas) e se isso muda leitura do mapa (sub-representação real vs. dado ausente). Retornar abrangência = extent + ressalva de cobertura. Se houver incerteza, baixa confiança, escolha a menor granularidade representada pelos dados: estado(s) ou Brasil (BRAZIL_VIEW)"

intervalo temporal (temporal.extent + temporal.grain + temporal.frequency + temporal.history):
"Ler temporal.status. Se described, retornar extent+grain+frequency+history (snapshot/overwrite). Se unknown, declarar explicitamente que não há corte de data — é snapshot do estado atual — e não inventar intervalo. Se não informado e houver dados do último ano, escolha-o. Se não, se existir mais de uma versão temporal do mesmo dataset (ex.: _2025 vs _all), perguntar qual ano o usuário quer antes de escolher."

## legenda (legends):

Todo spec gerado DEVE incluir ao menos uma legend em \`legends[]\` cobrindo a variável
pintada. Coroplético: legend quantitativa com os mesmos breaks usados no colorBy
(nunca inventar breaks novos). Pontos proporcionais/dot density: legend com valor de
referência explícito (ex: '1 ponto = 1.000 pessoas'). Nunca retornar spec com
\`legends\` ausente ou vazio.

## mapData nunca é geometria:

\`mapData\` carrega só valores de join, indexados por \`geometryId\` — nunca a
geometria de base. A geometria de municípios já existe como GeoJSON público em
\`/geo/geojs-100-mun.json\` (propriedade de join: \`codarea\`); referencie-a em
\`sources\`, nunca em \`mapData\`. Um \`mapData[].mapDataId\` nunca pode repetir o
\`id\` de uma source, e \`mapData[].data\` nunca pode ser uma \`FeatureCollection\`.

## label deve nomear a variável, nunca o id bruto:

Todo \`label\` de \`mapData\`/\`legends\` é uma frase legível em pt-BR que nomeia a
variável pedida pelo usuário (ex.: "Pessoas atendidas"), igual ao \`description\` do
campo do catálogo usado para responder a instrução "variável" acima — nunca o id
bruto do dataset/campo (ex.: \`pessoasAtendidas\`, \`cozinhas_pessoas_atendidas\`).
`;

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
const _stripCodeFence = (text: string): string => {
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
const _deleteSession = async (params: {
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

/**
 * Runs the deterministic, code-enforced structural checks against the
 * agent's raw JSON reply, before any real data is fetched: an invalid
 * geometry source, geometry smuggled into `mapData` (see
 * {@link findGeometryInMapData}), and a painted variable with no
 * `legends[]` entry (see {@link findMissingLegend}). Extracted out of
 * {@link POST} purely to keep its own branching under the lint complexity
 * budget — each check already carries its own docs at its definition.
 *
 * @returns The 422 `Response` for the first violation found, or `null` when
 * `modelJson` passes every structural check.
 */
const validateGeneratedSpecStructure = (
  modelJson: UnknownRecord
): Response | null => {
  const invalidSourceId = findInvalidGeojsonSource(modelJson);
  if (invalidSourceId) {
    return invalidSpecResponse({
      message: `A source "${invalidSourceId}" não referencia um endpoint real de geometria (URLs válidas: ${KNOWN_SOURCE_URLS.join(', ')}) ou veio com uma coleção de feições vazia inventada pelo modelo. Tente reformular o pedido.`,
      spec: modelJson,
    });
  }

  const geometryMapDataId = findGeometryInMapData(modelJson);
  if (geometryMapDataId) {
    return invalidSpecResponse({
      message: `O item "${geometryMapDataId}" de "mapData" carrega geometria (repete o id de uma source, ou traz uma FeatureCollection embutida) em vez de um valor de join por "geometryId". Tente reformular o pedido.`,
      spec: modelJson,
    });
  }

  if (findMissingLegend(modelJson)) {
    return invalidSpecResponse({
      message:
        'Todo spec com uma variável pintada precisa de ao menos uma legend em "legends[]" descrevendo-a. Tente reformular o pedido.',
      spec: modelJson,
    });
  }

  return null;
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
    // if (sessionId) {
    //   await deleteSession({ apiKey: params.apiKey, sessionId });
    // }
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
  // try {
  //   modelJson = JSON.parse(stripCodeFence(modelTextOrError));
  // } catch (parseError) {
  //   return invalidSpecResponse({
  //     message: `A resposta do modelo não é um JSON válido: ${
  //       parseError instanceof Error ? parseError.message : String(parseError)
  //     }`,
  //     spec: modelTextOrError,
  //   });
  // }

  if (!isRecord(modelJson)) {
    return invalidSpecResponse({
      message:
        'A resposta do modelo deveria ser um objeto JSON representando o spec.',
      spec: modelJson,
    });
  }

  const structuralError = validateGeneratedSpecStructure(modelJson);
  if (structuralError) {
    return structuralError;
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

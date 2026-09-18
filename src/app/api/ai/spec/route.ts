import { validateSpec } from '@ttoss/geovis';

import { gateway } from '@/gateway';

import {
  createSession,
  pollForReply,
  stripCodeFence,
} from './anthropicSession';
import { applyCanonicalScales } from './canonicalScales';
import { INSTRUCTIONS } from './instructions';
import { buildCatalogueContext } from './mapDataCatalogue';
import {
  appendRealMapData,
  appendRealSourceData,
  findChoroplethOnAbsoluteTotal,
  findDanglingActiveLegendId,
  findDotDensityWithoutRatio,
  findForeignNoDataColor,
  findGeometryInMapData,
  findInvalidBasemapStyleUrl,
  findInvalidGeojsonSource,
  findLayerWithBothDataBindings,
  findLegendPropertyMismatch,
  findLegendScaleArityMismatch,
  findLegendValueTypeMismatch,
  findMapTypeWithoutMapData,
  findMissingLegend,
  findPaintedContextLayer,
  findReclassifiedOfficialIndex,
  findSourceGeometryMismatch,
  findUnsupportedSourceType,
  invalidSpecResponse,
  isRecord,
  KNOWN_BASEMAP_STYLE_URLS,
  KNOWN_SOURCE_URLS,
  NO_DATA_COLOR,
  type UnknownRecord,
} from './specValidation';

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

/**
 * The deterministic, code-enforced structural checks run against the agent's
 * raw JSON reply, before any real data is fetched — each one a predicate over
 * the spec that returns the Portuguese message for its violation, or `null`
 * when the spec passes. Each check already carries its own docs at its
 * definition in `specValidation.ts`.
 *
 * A table rather than a chain of `if`s so adding a check costs one entry
 * instead of one more branch in {@link validateGeneratedSpecStructure} — that
 * function was already extracted out of {@link POST} to stay under the lint
 * complexity budget, and a chain would hit the same ceiling again.
 *
 * Order matters: the narrower, more actionable message should win when a spec
 * violates several rules at once, so source-level checks precede the
 * layer-level ones that depend on those sources resolving at all.
 */
const STRUCTURAL_CHECKS: ReadonlyArray<(spec: UnknownRecord) => string | null> =
  [
    (spec) => {
      const sourceType = findUnsupportedSourceType(spec);
      return sourceType
        ? `A source "${sourceType}" usa um tipo que esta rota não aceita — todo item de "sources" precisa ser "geojson" apontando para uma das URLs conhecidas (${KNOWN_SOURCE_URLS.join(', ')}). Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const sourceId = findInvalidGeojsonSource(spec);
      return sourceId
        ? `A source "${sourceId}" não referencia um endpoint real de geometria (URLs válidas: ${KNOWN_SOURCE_URLS.join(', ')}) ou veio com uma coleção de feições vazia inventada pelo modelo. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const styleUrl = findInvalidBasemapStyleUrl(spec);
      return styleUrl
        ? `"basemap.styleUrl" traz "${styleUrl}", que não é um estilo MapLibre suportado (estilos válidos: ${KNOWN_BASEMAP_STYLE_URLS.join(', ')}). Nunca inclua "basemap.styleUrl" a menos que precise de um destes estilos — omitir o campo usa o estilo padrão do app. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const mapDataId = findGeometryInMapData(spec);
      return mapDataId
        ? `O item "${mapDataId}" de "mapData" carrega geometria (repete o id de uma source, ou traz uma FeatureCollection embutida) em vez de um valor de join por "geometryId". Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const mapType = findMapTypeWithoutMapData(spec);
      return mapType
        ? `O spec declara "mapType": "${mapType}" mas nenhum item de "mapData" tem "mapId" apontando para uma source declarada — nesse estado o mapa renderiza vazio, sem erro. Inclua o "mapData" correspondente ou remova o "mapType". Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const mismatch = findSourceGeometryMismatch(spec);
      return mismatch
        ? `A layer "${mismatch.layerId}" declara "geometry: point/symbol" mas aponta para a source "${mismatch.sourceId}" (polígonos). Círculos e símbolos precisam de sources com pontos (ex.: "/api/cozinhas/bolhas"), não polígonos — o centroid do polígono não é o ponto representativo do dado. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const painted = findPaintedContextLayer(spec);
      return painted
        ? `A layer "${painted.layerId}" pinta uma variável ("mapDataId") sobre a source "${painted.sourceId}", que é de contorno de estados — todo dataset disponível hoje tem grain de município, então pintar por estado responde outra pergunta. Use "/geo/geojs-100-mun.json" para a variável e deixe os estados como camada de contexto, sem "mapDataId". Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const layerId = findLayerWithBothDataBindings(spec);
      return layerId
        ? `A layer "${layerId}" declara "mapDataId" e "propertyName" ao mesmo tempo — são vínculos de valor mutuamente exclusivos, e "mapDataId" vence em silêncio, então o mapa pintaria uma variável diferente da nomeada. Mantenha apenas um dos dois. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      return findMissingLegend(spec)
        ? 'Todo spec com uma variável pintada precisa de ao menos uma legend descrevendo-a, no spec ("legends[]") ou em alguma layer ("layers[].legends[]"). Tente reformular o pedido.'
        : null;
    },
    (spec) => {
      const dangling = findDanglingActiveLegendId(spec);
      return dangling
        ? `A layer "${dangling.layerId}" aponta "activeLegendId": "${dangling.activeLegendId}", mas nenhuma legend com esse id existe no spec nem na própria layer. A legend simplesmente não é renderizada, e o mapa fica pintado sem nada que o explique. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const arity = findLegendScaleArityMismatch(spec);
      return arity
        ? `A legend "${arity.legendId}" declara ${arity.expected - 1} cortes em "thresholds", o que desenha ${arity.expected} faixas, mas traz ${arity.received} entradas em "${arity.field}". Uma escala "threshold" com N cortes precisa de exatamente N+1 cores e N+1 rótulos. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const mismatch = findLegendPropertyMismatch(spec);
      return mismatch
        ? `A legend "${mismatch.legendId}" colore por "${mismatch.property}", mas os valores chegam à layer pelo join de "mapData", que só escreve a chave "value". Nessa configuração nenhuma feição resolve um valor e o mapa inteiro cai no "defaultColor". Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const foreign = findForeignNoDataColor(spec);
      return foreign
        ? `A legend "${foreign.legendId}" ${foreign.declared === null ? 'não declara "colorBy.defaultColor"' : `declara "colorBy.defaultColor": "${foreign.declared}"`} — o swatch de "sem dado" é sempre "${NO_DATA_COLOR}" nesta aplicação, para que a ausência de dado leia igual em todos os mapas. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      const reclassified = findReclassifiedOfficialIndex(spec);
      return reclassified
        ? `O dataset "${reclassified.mapDataId}" tem faixas de classificação publicadas (${reclassified.source}) — use "thresholds": [${reclassified.expected.join(', ')}] em vez de recalcular os cortes a partir dos dados, senão as classes do mapa não correspondem a nenhum número publicado. Tente reformular o pedido.`
        : null;
    },
    (spec) => {
      return findDotDensityWithoutRatio(spec)
        ? 'Um mapa "dotDensity" é ilegível sem a razão ponto:quantidade — alguma legend precisa declará-la no título, subtítulo ou rótulos (ex.: "1 ponto = 1.000 pessoas"). Tente reformular o pedido.'
        : null;
    },
    (spec) => {
      const mapDataId = findChoroplethOnAbsoluteTotal(spec);
      return mapDataId
        ? `O dataset "${mapDataId}" é um total absoluto, nunca uma variável relativa — pintá-lo como coroplético (mapType "choropleth") introduz viés de tamanho do polígono. Use pontos proporcionais ou dot density. Tente reformular o pedido.`
        : null;
    },
  ];

/**
 * Runs every entry of {@link STRUCTURAL_CHECKS} against the agent's raw JSON
 * reply, before any real data is fetched.
 *
 * @returns The 422 `Response` for the first violation found, or `null` when
 * `modelJson` passes every structural check.
 */
const validateGeneratedSpecStructure = (
  modelJson: UnknownRecord
): Response | null => {
  for (const check of STRUCTURAL_CHECKS) {
    const message = check(modelJson);
    if (message) {
      return invalidSpecResponse({ message, spec: modelJson });
    }
  }

  return null;
};

/**
 * The one structural check that can only run once `mapData` carries real
 * `data-gateway` values (see {@link findLegendValueTypeMismatch}) — the agent
 * chooses a legend's colour scale from a dataset description, never having
 * seen a value, so the contradiction only becomes visible here.
 *
 * @returns The 422 `Response` when the active legend's scale contradicts the
 * resolved values, or `null` otherwise.
 */
const validateResolvedSpec = (spec: UnknownRecord): Response | null => {
  const mismatch = findLegendValueTypeMismatch(spec);
  if (!mismatch) {
    return null;
  }

  return invalidSpecResponse({
    message: `A legend "${mismatch.legendId}" declara uma escala "${mismatch.declared}", mas os valores reais do dataset são "${mismatch.expected}". Uma escala por faixas sobre categorias (ou o inverso) pinta o mapa errado. Tente reformular o pedido.`,
    spec,
  });
};

const promptError = (message: string): Response => {
  return Response.json(
    { error: `Campo "prompt": ${message}` },
    { status: 400 }
  );
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
      agentId: string;
      environmentId: string;
    }
  | Response => {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const agentId = process.env['ANTHROPIC_AGENT_ID'];
  const environmentId = process.env['ANTHROPIC_ENVIRONMENT_ID'];

  if (!apiKey || !agentId || !environmentId) {
    const missing = [
      !apiKey ? 'ANTHROPIC_API_KEY' : null,
      !agentId ? 'ANTHROPIC_AGENT_ID' : null,
      !environmentId ? 'ANTHROPIC_ENVIRONMENT_ID' : null,
    ].filter((name): name is string => {
      return name !== null;
    });

    return Response.json(
      {
        error: `Configuração ausente no ambiente do servidor: ${missing.join(', ')}.`,
      },
      { status: 400 }
    );
  }

  return { apiKey, agentId, environmentId };
};

/**
 * Turns one of {@link createSession}/{@link pollForReply}'s thrown errors
 * into a Portuguese, cause-specific message — so a 502 never collapses a
 * session-creation failure, a session-side error, an empty reply, and a
 * timeout into the same generic sentence. Matches on the fixed prefixes
 * those two functions throw; anything else (e.g. a network-level fetch
 * failure) falls back to the raw `error.message` so it's still legible.
 */
const describeAgentFailure = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith('Anthropic sessions POST responded with status')) {
    return `Não foi possível iniciar a sessão com o modelo de IA (${message}). Tente novamente em instantes.`;
  }
  if (message === 'Anthropic sessions POST returned no session id') {
    return 'O modelo de IA não retornou um identificador de sessão válido. Tente novamente.';
  }
  if (
    message.startsWith('Anthropic session events GET responded with status')
  ) {
    return `Não foi possível acompanhar o andamento da sessão com o modelo de IA (${message}). Tente novamente em instantes.`;
  }
  if (message === 'Anthropic session reported a session.error event') {
    return 'O modelo de IA reportou um erro interno ao processar o pedido. Tente reformular o pedido ou tentar novamente.';
  }
  if (message === 'Anthropic session turn ended with no agent.message') {
    return 'O modelo de IA encerrou a resposta sem gerar nenhum conteúdo. Tente reformular o pedido.';
  }
  if (message === 'Timed out waiting for the Anthropic session to reply') {
    return 'O modelo de IA demorou demais para responder. Tente novamente em instantes.';
  }

  return `Falha de comunicação com o modelo de IA: ${message}`;
};

const getAgentResponse = async (params: {
  apiKey: string;
  agentId: string;
  environmentId: string;
  prompt: string;
}): Promise<string | Response> => {
  try {
    const catalogueText = await readCatalogueContext();
    const sessionId = await createSession({
      apiKey: params.apiKey,
      agentId: params.agentId,
      environmentId: params.environmentId,
      catalogueText,
      instructions: INSTRUCTIONS,
      prompt: params.prompt,
    });
    return await pollForReply({ apiKey: params.apiKey, sessionId });
  } catch (error) {
    return Response.json(
      { error: describeAgentFailure(error) },
      { status: 502 }
    );
  }
};

/**
 * Parses the agent's raw reply into a structurally valid spec, or the 422
 * `Response` describing why it isn't one. Extracted out of {@link POST}
 * purely to keep its own branching under the lint complexity budget.
 *
 * @returns The parsed `modelJson`, or a `Response` for a non-JSON reply, a
 * non-object reply, or a structural violation (see
 * {@link validateGeneratedSpecStructure}).
 */
const parseGeneratedSpec = (modelText: string): Response | UnknownRecord => {
  let modelJson: unknown;
  try {
    modelJson = JSON.parse(stripCodeFence(modelText));
  } catch (parseError) {
    return invalidSpecResponse({
      message: `A resposta do modelo não é um JSON válido: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`,
      spec: modelText,
    });
  }

  if (!isRecord(modelJson)) {
    return invalidSpecResponse({
      message:
        'A resposta do modelo deveria ser um objeto JSON representando o spec.',
      spec: modelJson,
    });
  }

  return validateGeneratedSpecStructure(modelJson) ?? modelJson;
};

/**
 * Turns a natural-language prompt into a `VisualizationSpec`, via a
 * single-use Anthropic Managed Agents session created fresh per request
 * (`POST /v1/sessions` with `initial_events`, then `GET /v1/sessions/{id}/events`)
 * — the session is bound to the `geovis-spec-generator` agent (see
 * `geovis-spec-generator.en.agent.yaml`), provisioned once out of band (e.g.
 * via the `ant` CLI) and referenced here only by ID. The session is left for
 * the Anthropic side to expire — this route never deletes it.
 *
 * The agent's raw reply is parsed as JSON, then its `mapData` is resolved
 * against real `data-gateway` values (see {@link appendRealMapData}), and any
 * API-backed `sources[].data` is resolved the same way (see
 * {@link appendRealSourceData}), before being returned — the agent's own
 * `mapData[].data` and API-backed `sources[].data` are never sent to the
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

  const modelJsonOrError = parseGeneratedSpec(modelTextOrError);
  if (modelJsonOrError instanceof Response) {
    return modelJsonOrError;
  }

  const mapDataOrError = await appendRealMapData(modelJsonOrError);
  if (mapDataOrError instanceof Response) {
    return mapDataOrError;
  }

  const specOrError = await appendRealSourceData(mapDataOrError);
  if (specOrError instanceof Response) {
    return specOrError;
  }

  const spec = applyCanonicalScales(specOrError);

  const resolvedError = validateResolvedSpec(spec);
  if (resolvedError) {
    return resolvedError;
  }

  const validation = validateSpec(spec);
  if (validation.status !== 'resolved') {
    return invalidSpecResponse({
      issues: validation.issues.map((issue) => {
        return { code: issue.code, message: issue.message };
      }),
      spec,
    });
  }

  return Response.json({ result: spec });
};

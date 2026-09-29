import { gateway } from '@/gateway';

import {
  collectStructuralIssues,
  validateCandidate,
  validateWithLocalRepairs,
} from './candidateValidation';
import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from './canonicalChoropleth';
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

## O catálogo:

O catalogo json schema do projeto Cozinha Solidária em Rede contém todos os datasets conhecidos e o detalhe completo apenas dos datasets que podem popular \`mapData\` hoje. Use-o para gerar um spec de visualização geográfica (um mapa) que atenda ao pedido do usuário.

Se o pedido do usuário só corresponder a um dataset do catálogo que NÃO está na lista "renderableDatasets" (ainda não disponível), responda apenas com {"error": "..."} explicando em português que aquele dado ainda não está disponível para visualização — não mapeie para outro dataset ao acaso.

## Para resolver os campos da spec, siga as instruções abaixo:

tipo de mapa (mapType):
"Dado pergunta '[pergunta usuário]', qual tipo cartográfico melhor representa? Considerar: coroplético (área agregada) - válido somente para variáveis relativas (razões, taxas e percentuais), não utilizar para contagens absolutas (exceção única: quando o usuário pede explicitamente o mapa coroplético da quantidade de cozinhas por município — ex.: 'Quero ver o mapa coroplético de cozinhas por município' —, use \`mapType: "choropleth"\` com \`mapDataId: "cozinhas_geolocalizadas"\`; o servidor aplica a escala e as camadas canônicas do /mapas), pontos proporcionais (unidade individual) - para constagens, dot density - escolha quando uma unidade representar uma quantidade fixa (ex: 1 ponto = 1.000 habitantes, 1 ponto = 1 cozinha. Sempre adicione esta informação na legenda), cluster. Justificar pela granularidade real do dado — se maioria município tem só 1-2 pontos, coroplético mascara variação, pontos melhor. Listar tipo recomendado + 1 alternativa com trade-off."                                                                                            Variável:
"Varrer dataset_catalogue.json (campo schema.fields[].name/description/unit) e achar campo cujo description bata literal com conceito pedido — não sinônimo, não correlato. Se não existir pronto, apontar campo-base + operação necessária (soma/agregação/join) pra derivar. Retornar: dataset_id, campo, grain (spatial.grain.code), se precisa agregação e por qual chave (Código IBGE/codarea)."

Prompt ampliado — proxy seguro:
"Antes de aceitar variável como resposta: (1) listar todo campo do catálogo cujo description/tags toquem tema semelhante (ex.: cadastro, vulnerabilidade, cobertura); (2) pra cada um, testar se mede exatamente o pedido ou mede algo adjacente (input, causa, correlato) — declarar explicitamente a diferença semântica; (3) só aceitar como resposta direta campo cujo description bate 1:1 com a pergunta; (4) todo outro campo correlato entra como 'proxy descartado' com motivo, nunca usado sem aviso. Objetivo: nunca responder pergunta X com dado que mede Y só por estarem no mesmo domínio."

resolução de mapDataId (obrigatório, antes de montar mapData):
"\`mapData[].mapDataId\` NUNCA é inventado: é sempre, literalmente, o \`id\` de um dataset do catálogo (um dos \`renderableDatasets\`) — nunca um nome de join, nunca o \`id\` de uma source. Para escolher esse \`id\`: (1) percorrer TODOS os datasets do catálogo (não só renderableDatasets) comparando \`description\`/\`fields[].description\` com o pedido, seguindo a instrução 'Variável' e o 'Prompt ampliado — proxy seguro' acima; (2) restringir o resultado aos \`renderableDatasets\`; (3) se o dataset que bate 1:1 não estiver em \`renderableDatasets\`, responder \`{"error": "..."}\` (não há mapDataId alternativo aceitável). Nunca gerar um \`mapDataId\` que só 'parece' com o pedido — ele tem que ser exatamente um \`id\` presente no catálogo."

combinação com abrangência de município/estado:
"A geometria de \`sources\` e o grain de \`mapData\` têm que casar. Hoje todo dataset em \`renderableDatasets\` tem grain de município (join por \`codarea\`/Código IBGE contra \`/geo/geojs-100-mun.json\`) — não existe dataset renderável em grain de estado. Se o pedido pede a variável agregada por estado, ou combinada com estado, usar \`/geo/estados.json\` apenas como camada de contorno/contexto (uma layer sem \`mapDataId\`, sem legend própria), nunca como source de um \`mapData\` pintado — pintar a variável sempre no fill de município. Se o pedido só faz sentido em grain de estado (nenhuma leitura por município resolve o pedido), tratar como dataset indisponível e responder \`{"error": "..."}\`. Quando o pedido combina duas variáveis (ex.: pontos de cozinhas sobre coroplético de IVS), gerar um \`mapData\` (e uma layer com sua própria \`activeLegendId\`) por variável — nunca misturar dois \`mapDataId\` numa mesma entrada."

abrangência espacial (spatial.coverage + spatial.extent):
"Ler spatial.coverage (exhaustive/partial) e spatial.extent do dataset escolhido. Se partial, listar em access.notes/description o que fica de fora (ex.: sem coordenada, só habilitadas) e se isso muda leitura do mapa (sub-representação real vs. dado ausente). Retornar abrangência = extent + ressalva de cobertura. Se houver incerteza, baixa confiança, escolha a menor granularidade representada pelos dados: estado(s) ou Brasil (BRAZIL_VIEW)"

intervalo temporal (temporal.extent + temporal.grain + temporal.frequency + temporal.history):
"Ler temporal.status. Se described, retornar extent+grain+frequency+history (snapshot/overwrite). Se unknown, declarar explicitamente que não há corte de data — é snapshot do estado atual — e não inventar intervalo. Se não informado e houver dados do último ano, escolha-o. Se não, se existir mais de uma versão temporal do mesmo dataset (ex.: _2025 vs _all), perguntar qual ano o usuário quer antes de escolher."

## legenda (legends):

Todo spec gerado DEVE incluir ao menos uma legend cobrindo a variável pintada,
sempre no \`legends[]\` de primeiro nível do spec — nunca em \`layers[].legends\`
(a layer só aponta para a legend via \`activeLegendId\`). Coroplético: legend
quantitativa com os mesmos breaks usados no colorBy (nunca inventar breaks novos).
Pontos proporcionais/dot density: legend com valor de referência explícito (ex:
'1 ponto = 1.000 pessoas'). Nunca retornar spec cujo mapa pintado não tenha
nenhuma legend.

## mapData nunca é geometria:

\`mapData\` carrega só valores de join, indexados por \`geometryId\` — nunca a
geometria de base. A geometria de municípios já existe como GeoJSON público em
\`/geo/geojs-100-mun.json\` (propriedade de join: \`codarea\`); referencie-a em
\`sources\`, nunca em \`mapData\`. 

Um \`mapData[].mapDataId\` nunca pode repetir o
\`id\` de uma source, e \`mapData[].data\` nunca pode ser uma \`FeatureCollection\`.

## label deve nomear a variável, nunca o id bruto:

Todo \`label\` de \`mapData\`/\`legends\` é uma frase legível em pt-BR que nomeia a
variável pedida pelo usuário (ex.: "Pessoas atendidas"), igual ao \`description\` do
campo do catálogo usado para responder a instrução "variável" acima — nunca o id
bruto do dataset/campo (ex.: \`pessoasAtendidas\`, \`cozinhas_pessoas_atendidas\`).

## sources: tipo e URL nunca são inventados:

Todo item de \`sources[]\` é sempre \`{ "id": "...", "type": "geojson", "data": "<uma das URLs abaixo>" }\`.
Nunca use os outros tipos de source que o schema do geovis também aceita
(\`vector-tiles\`, \`raster-tiles\`, \`raster-dem\`, \`video\`, \`image\`) — esta aplicação
não serve tile server, DEM, vídeo ou imagem, só os endpoints GeoJSON abaixo.
Isso vale para TODO mapType, inclusive pontos proporcionais/dot density/cluster:
a geometria de pontos das cozinhas também é servida como \`geojson\`, nunca como
tiles.

${buildSourcesTable()}

\`sources[].data\` é sempre a URL da tabela, como texto — nunca dados embutidos:
URLs estáticas (\`/geo/*\`, arquivos de \`public/geo\`) chegam ao navegador como
URL, e URLs de API (\`/api/*\`) são resolvidas no servidor e trocadas pelos dados
reais antes da resposta.

## validação (tool validate_spec):

Antes da resposta final, valide a spec candidata com o tool \`validate_spec\`.
Ele devolve a spec já reparada pelo servidor e as issues restantes; corrija só
essas issues, partindo da spec devolvida. \`mapData[].data\` vai sempre como \`[]\`:
os valores reais são preenchidos pelo servidor.

## basemap: nunca inventar um styleUrl:

Não inclua o campo \`basemap\` na spec, a menos que o pedido exija explicitamente
trocar o mapa-base — omitir \`basemap\` usa o estilo padrão do app
(\`https://tiles.openfreemap.org/styles/positron\`), que já é o comportamento
correto na imensa maioria dos pedidos. Se precisar mesmo assim, \`basemap.styleUrl\`
só pode ser uma URL de *style* MapLibre (um JSON com definição de camadas), nunca
um template de raster tiles como \`https://tile.openstreetmap.org/{z}/{x}/{y}.png\`
— isso quebra o carregamento do mapa (CORS/404 no browser). A única URL de style
aceita hoje é \`https://tiles.openfreemap.org/styles/positron\` (o próprio padrão).
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
 * formation (`~/geovis-spec-generator-loop.formation.json`, provisioned out of
 * band) and referenced here only by ID. The agent validates its candidate
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

  return Response.json({ spec, error: false });
};

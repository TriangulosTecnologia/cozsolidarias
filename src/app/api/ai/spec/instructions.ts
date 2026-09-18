import { buildCanonicalScalesTable } from './canonicalScales';
import { buildSourcesTable, NO_DATA_COLOR } from './specValidation';

/**
 * The per-request prompt sent as `initial_events` alongside the catalogue and
 * the user's own prompt (see `createSession`). It carries every cozsolidarias
 * domain rule the generic `geovis-spec-generator` agent cannot know: which
 * dataset answers which question, the município grain, the classification
 * method behind each legend's breaks, the application palette, and the
 * dependency chain between a legend's fields.
 *
 * It lives in its own module because it is prose under version control, not
 * request handling — `route.ts` reads it exactly once, and keeping it here
 * leaves that file at the size of the logic it actually runs.
 *
 * Rules that a deterministic check in `specValidation.legends.ts` (or its
 * sibling modules) already rejects are still stated here: the check turns a
 * violation into a 422 the user has to retry, while the instruction stops the
 * violation from happening. They are two halves of one rule, never a
 * duplication to prune on one side alone.
 */
export const INSTRUCTIONS = `## O que é

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

tipo de mapa (mapType): ver a seção "## mapType" abaixo — ela é normativa e
decide o campo; aqui só o critério de julgamento que a alimenta:
"Dado o pedido do usuário, qual forma cartográfica representa o dado sem
distorcê-lo? Justificar pela granularidade real: se a maioria dos municípios
tem só 1–2 unidades, o coroplético mascara a variação e pontos leem melhor.
Declarar o tipo recomendado e uma alternativa com o trade-off."

Variável:
"Varrer dataset_catalogue.json (campo schema.fields[].name/description/unit) e achar campo cujo description bata literal com conceito pedido — não sinônimo, não correlato. Se não existir pronto, apontar campo-base + operação necessária (soma/agregação/join) pra derivar. Retornar: dataset_id, campo, grain (spatial.grain.code), se precisa agregação e por qual chave (Código IBGE/codarea)."

Prompt ampliado — proxy seguro: ver a seção "## quando nenhum dataset responde
1:1" abaixo, que é normativa e fecha a lista de proxies aceitos. Aqui só o
critério: nunca responder a pergunta X com um dado que mede Y só porque os dois
vivem no mesmo domínio.

resolução de mapDataId (obrigatório, antes de montar mapData):
"\`mapData[].mapDataId\` NUNCA é inventado: é sempre, literalmente, o \`id\` de um dataset do catálogo (um dos \`renderableDatasets\`) — nunca um nome de join, nunca o \`id\` de uma source. Para escolher esse \`id\`: (1) percorrer TODOS os datasets do catálogo (não só renderableDatasets) comparando \`description\`/\`fields[].description\` com o pedido, seguindo a instrução 'Variável' e o 'Prompt ampliado — proxy seguro' acima; (2) restringir o resultado aos \`renderableDatasets\`; (3) se o dataset que bate 1:1 não estiver em \`renderableDatasets\`, responder \`{"error": "..."}\` (não há mapDataId alternativo aceitável). Nunca gerar um \`mapDataId\` que só 'parece' com o pedido — ele tem que ser exatamente um \`id\` presente no catálogo."

combinação com abrangência de município/estado:
"A geometria de \`sources\` e o grain de \`mapData\` têm que casar. Hoje todo dataset em \`renderableDatasets\` tem grain de município (join por \`codarea\`/Código IBGE contra \`/geo/geojs-100-mun.json\`) — não existe dataset renderável em grain de estado. Se o pedido pede a variável agregada por estado, ou combinada com estado, usar \`/geo/estados.json\` apenas como camada de contorno/contexto (uma layer sem \`mapDataId\`, sem legend própria), nunca como source de um \`mapData\` pintado — pintar a variável sempre no fill de município. Se o pedido só faz sentido em grain de estado (nenhuma leitura por município resolve o pedido), tratar como dataset indisponível e responder \`{"error": "..."}\`. Quando o pedido combina duas variáveis (ex.: pontos de cozinhas sobre coroplético de IVS), gerar um \`mapData\` (e uma layer com sua própria \`activeLegendId\`) por variável — nunca misturar dois \`mapDataId\` numa mesma entrada."

abrangência espacial (spatial.coverage + spatial.extent):
"Ler spatial.coverage (exhaustive/partial) e spatial.extent do dataset escolhido. Se partial, listar em access.notes/description o que fica de fora (ex.: sem coordenada, só habilitadas) e se isso muda leitura do mapa (sub-representação real vs. dado ausente). Retornar abrangência = extent + ressalva de cobertura. Se houver incerteza, baixa confiança, escolha a menor granularidade representada pelos dados: estado(s) ou Brasil (BRAZIL_VIEW)"

intervalo temporal (temporal.extent + temporal.grain + temporal.frequency + temporal.history):
"Ler temporal.status. Se described, retornar extent+grain+frequency+history (snapshot/overwrite). Se unknown, declarar explicitamente que não há corte de data — é snapshot do estado atual — e não inventar intervalo. Se não informado e houver dados do último ano, escolha-o. Se não, se existir mais de uma versão temporal do mesmo dataset (ex.: _2025 vs _all), perguntar qual ano o usuário quer antes de escolher."

## o que cada mapDataId realmente pinta

Cada \`mapDataId\` resolve, no servidor, para **um único valor por município** —
não para o dataset inteiro. Um dataset cuja \`description\` cita vários
indicadores só entrega o da linha abaixo; pedir outro indicador do mesmo
dataset não o torna acessível.

| \`mapDataId\` | valor que chega ao mapa | unidade |
|---|---|---|
| \`cozinhas_geolocalizadas\` | nº de cozinhas cadastradas no município | contagem |
| \`cozinhas_geolocalizadas_2025\` | o mesmo, no recorte de 2025 | contagem |
| \`cozinhas_pessoas_atendidas\` | soma do público total atendido declarado | contagem (total absoluto) |
| \`municipios_ivs\` | IVS geral | índice 0–1 |
| \`municipios_cadinsan\` | % de famílias do CadÚnico em risco de insegurança alimentar grave, **com** o efeito do Bolsa Família | percentual |

Consequências que não têm exceção:

- IDHM, os subíndices do IVS (infraestrutura urbana, capital humano, renda e
  trabalho) e as dimensões do IDHM **não são alcançáveis**, mesmo aparecendo na
  \`description\` de \`municipios_ivs\`. Pedido de IDHM → \`{"error": "..."}\`.
- O cenário **sem** Bolsa Família do CADINSAN não é alcançável: \`municipios_cadinsan\`
  entrega apenas o cenário com PBF. Pedido do contrafactual → \`{"error": "..."}\`.
- Taxas derivadas (cozinhas por 100 mil habitantes, % das cozinhas do Brasil,
  pessoas do CadÚnico por cozinha) **não são deriváveis aqui** — o servidor não
  calcula razão nova a partir de dois ids. Pedido de taxa → \`{"error": "..."}\`.

## quando nenhum dataset responde 1:1

Percorra a escada abaixo e pare no primeiro degrau que se aplicar. Nunca pule
para o degrau seguinte porque o anterior "quase" serve.

**1. Correspondência direta.** A \`description\` do dataset e a linha da tabela
acima descrevem exatamente o conceito pedido. Use, sem ressalva.

**2. Recorte do mesmo conceito.** O pedido é a mesma variável em outro corte
temporal já materializado (\`cozinhas_geolocalizadas\` vs.
\`cozinhas_geolocalizadas_2025\`). Não é proxy: escolha o corte e nomeie o ano no
\`title\` da legend. Se o pedido não diz o ano e os dois cortes respondem,
pergunte qual ano antes de escolher.

**3. Proxy declarado — só da lista fechada abaixo, nunca inventado.** Um proxy
só é admissível quando mede **o mesmo fenômeno a um passo de distância**, e
sempre com a distância escrita na legend, em pt-BR, onde o leitor vê. São estes,
e só estes:

| Pedido | Proxy | O que o proxy NÃO mede | Obrigatório declarar |
|---|---|---|---|
| fome / insegurança alimentar num município | \`municipios_cadinsan\` | quem está fora do CadÚnico; é risco estimado, não medição direta | \`title\` nomeia "famílias do CadÚnico", nunca "população"; \`subtitle\` diz "risco estimado" |
| quantas pessoas as cozinhas alcançam | \`cozinhas_pessoas_atendidas\` | capacidade instalada; é o público declarado no cadastro | \`subtitle\` diz "declarado no cadastro" |
| onde há rede de cozinhas / presença da política | \`cozinhas_geolocalizadas\` | funcionamento atual; é registro cadastral, não status operacional | \`title\` diz "cadastradas" |
| vulnerabilidade social de um município | \`municipios_ivs\` | a situação atual: o Atlas IVS é do Censo 2010 | \`footerValue\` ou \`reference\` traz "2010" |

Um proxy nunca é renomeado para o conceito pedido. Se o usuário pediu "fome" e o
mapa pinta CADINSAN, a legend diz CadÚnico e risco estimado — não "fome".

**4. Dois proxies, nunca.** Se responder ao pedido exigiria encadear mais de um
proxy, ou combinar um proxy com uma derivação, o pedido não é respondível:
\`{"error": "..."}\` explicando em português o que existe e o que falta.

**5. \`{"error"}\` é resposta, não falha.** Prefira um erro claro a um mapa
plausível que responde outra pergunta. Casos que sempre caem aqui: qualquer
indicador da lista de inalcançáveis acima; demanda ou déficit de cozinhas
(nenhum dataset mede necessidade); recorte só resolvível em grain de estado;
qualquer variável cujo único candidato seja correlato temático (mesma área do
conhecimento) e não o mesmo fenômeno.

Quando um pedido combina dois conceitos que existem separados (ex.: pontos de
cozinhas sobre coroplético de IVS), isso não é proxy: gere um \`mapData\` e uma
layer por variável, cada uma com sua própria legend.

## schemaVersion: omita o campo

Não declare \`schemaVersion\`. Um spec sem o campo é lido como a versão corrente
do \`@ttoss/geovis\` instalado e continua válido quando ela avança; declarar uma
versão diferente da que a biblioteca instalada implementa faz \`validateSpec\`
rejeitar o spec inteiro com \`invalid-schema-version\`.

## mapType: declare por padrão sempre que o pedido couber num dos atalhos

\`mapType\` é o padrão desta rota, não uma opção. Sempre que o pedido cair num
dos três atalhos abaixo, declare o campo no topo do spec: ele é o que permite
ao geovis resolver layers e paint sozinho, e omiti-lo obriga a montar tudo à
mão, multiplicando as formas de errar em silêncio.

| Pedido do usuário | \`mapType\` | Por quê |
|---|---|---|
| variável relativa por município (taxa, razão, %, índice 0–1) | \`choropleth\` | pintar área só é honesto com valor relativo |
| contagem absoluta por unidade (nº de cozinhas, pessoas atendidas) | \`proportionalCircles\` | o símbolo cresce com o valor, sem viés do tamanho do polígono |
| "1 ponto = N unidades", ou densidade de uma contagem grande | \`dotDensity\` | a razão ponto:quantidade fica declarada na legenda |
| localização individual das cozinhas, sem agregação | *(sem \`mapType\`)* | a geometria já é o dado: source \`/api/cozinhas\` e layers explícitas |

Compatibilidade por atalho:

| \`mapType\` | \`mapDataId\` aceitos | Nunca combinar com | Source / geometry |
|---|---|---|---|
| \`choropleth\` | \`municipios_ivs\`, \`municipios_cadinsan\`, \`cozinhas_geolocalizadas\`, \`cozinhas_geolocalizadas_2025\` | \`cozinhas_pessoas_atendidas\` (total absoluto → viés de área) | \`/geo/geojs-100-mun.json\`, \`polygon\` |
| \`proportionalCircles\` | \`cozinhas_geolocalizadas\`, \`cozinhas_geolocalizadas_2025\`, \`cozinhas_pessoas_atendidas\` | índices 0–1 sem transformação (o raio não comunica índice) | \`/api/cozinhas/bolhas\`, \`point\` |
| \`dotDensity\` | \`cozinhas_geolocalizadas\`, \`cozinhas_geolocalizadas_2025\`, \`cozinhas_pessoas_atendidas\` | \`municipios_ivs\`, \`municipios_cadinsan\` (índice não é "quantidade de algo") | \`/geo/geojs-100-mun.json\`, pontos gerados |

Declarar \`mapType\` não dispensa \`legends\`: a legend automática do geovis não
conhece o rótulo em pt-BR da variável nem as faixas oficiais de um índice
publicado. Sempre forneça a legend explicitamente.

## classes calculadas: o método de classificação vem antes dos thresholds

Escolher os cortes é decisão metodológica, não estética — e já está decidida.
Cada dataset coroplético tem **uma** escala, e é esta:

${buildCanonicalScalesTable()}

\`cozinhas_pessoas_atendidas\` não aparece porque não é coroplético — é total
absoluto, vai em \`proportionalCircles\`/\`dotDensity\`, sem \`thresholds\`.

Os dois tipos de origem, e por que a distinção importa:

- **Faixas oficiais** — a instituição que publica o índice já definiu as
  classes. Recalcular produz faixas que nenhum leitor consegue comparar com
  número publicado nenhum. No IVS, o \`0.001\` inicial **não é uma faixa**: é o
  piso que impede a classe "muito baixa" de cair no bin cinza, já que o geovis
  pinta com \`defaultColor\` tudo abaixo do primeiro corte.
- **Escala de referência do app** — não há faixa oficial; a escala é a que o
  app já publica, e sobre ela o app recalcula quebras naturais (Jenks) no
  cliente quando o dado tem classes distintas suficientes.

Em nenhum dos dois casos invente cortes redondos novos, e **nunca use quantis
nem intervalos iguais**: a distribuição municipal brasileira é fortemente
assimétrica (poucos municípios concentram quase todo o valor), e os dois
métodos colapsam a maioria dos municípios numa classe só. Se o pedido não
corresponde a nenhum dataset renderável, responda \`{"error": "..."}\`.

Sempre 5 cortes → 6 faixas: 6 cores e 6 labels, o primeiro nomeando o bin
"sem dado". A rota reescreve \`colorBy\`, \`labelFormat\` e \`reference\` da legend
ativa com os valores da tabela acima antes de devolver o spec — emiti-los certo
evita o 422 de reclassificação e mantém o resto do spec seu.

## cores: sempre a paleta da aplicação, nunca uma escolhida na hora

Uma cor nova por mapa faz o mesmo valor significar coisas diferentes em telas
vizinhas. Estas são as rampas da aplicação, já amostradas para 6 bins:

| Família semântica da variável | Rampa (menor → maior) |
|---|---|
| contagem, cobertura, participação (cozinhas, CadÚnico, CAF) — azul | \`["#C6DBEF", "#86BCDC", "#58A0CE", "#2E7CBB", "#1761A8", "#08306B"]\` |
| vulnerabilidade, privação (IVS) — vermelho | \`["#FCBBA1", "#FC7E5E", "#EF3B2C", "#B81419", "#4F000A"]\` |
| desenvolvimento, resultado desejável (IDHM) — verde | \`["#B4E1AE", "#74C476", "#37A055", "#006D2C", "#00441B"]\` |

Regras fixas:

- \`colorBy.defaultColor\` é SEMPRE \`"${NO_DATA_COLOR}"\` — o cinza "sem dado" da
  aplicação. Ele nunca vem da rampa da variável, e um spec sem ele é rejeitado.
- A rampa azul já traz 6 degraus e vai inteira em \`colors\` (o primeiro é
  vestigial: o geovis pinta o bin de base com \`defaultColor\`). As rampas
  vermelha e verde têm 5 degraus — prefixe \`"${NO_DATA_COLOR}"\` para totalizar 6.
- Cor de borda das layers de polígono: \`"#FAF9F7"\`.

## legendas: campos dependentes, resolvidos de forma determinística

Todo spec gerado DEVE incluir ao menos uma legend cobrindo a variável pintada —
no nível do spec (\`legends[]\`) ou da layer (\`layers[].legends[]\`). Os campos
abaixo **não são escolha**: cada um é função de algo já decidido. Resolva nesta
ordem, sem deixar nenhum implícito.

| Campo | Depende de | Valor determinado |
|---|---|---|
| \`colorBy.type\` | tipo do valor do dataset | número → \`"quantitative"\`; categoria → \`"categorical"\` |
| \`colorBy.scale\` | \`type === "quantitative"\` | sempre \`"threshold"\` — é a única escala suportada |
| \`colorBy.property\` | a layer ter \`mapDataId\` | sempre \`"value"\` — é a única chave que o join escreve em feature-state |
| \`colorBy.thresholds\` | método de classificação (seção acima) | faixas oficiais, ou a escala de referência do dataset |
| \`colorBy.colors\` | \`thresholds\` | exatamente \`thresholds.length + 1\` cores, da paleta acima |
| \`colorBy.defaultColor\` | — | sempre \`"${NO_DATA_COLOR}"\` |
| \`labelFormat.labels\` | \`thresholds\` | exatamente \`thresholds.length + 1\` rótulos; o primeiro nomeia o bin "sem dado" |
| \`layers[].activeLegendId\` | \`legends[].id\` | um id que existe no spec, seja em \`legends[]\` ou na própria layer |
| \`legends[].reference\` | dataset escolhido | a atribuição de fonte do catálogo, texto completo |
| legenda de \`dotDensity\` | \`mapType\` | algum texto da legenda declara a razão, ex.: "1 ponto = 1.000 pessoas" |
| nº de legends | nº de variáveis pintadas | uma legend por variável, cada layer com seu próprio \`activeLegendId\` |

A regra de arity é a que mais falha, então explicitamente: uma escala
\`threshold\` com N cortes desenha N+1 faixas. Com 5 cortes → 6 cores e 6
labels. Um spec com 6 cortes e 6 cores é rejeitado com 422.

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

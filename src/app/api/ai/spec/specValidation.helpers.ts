import { KNOWN_SOURCE_URLS, SOURCE_METADATA } from './specValidation.sources';

/**
 * Builds a markdown table listing all valid source URLs, their physical paths,
 * and descriptions. Injected into INSTRUCTIONS so the model always sees
 * current sources without manual duplication. If KNOWN_SOURCE_URLS changes,
 * this table regenerates automatically.
 */
export const buildSourcesTable = (): string => {
  const rows = KNOWN_SOURCE_URLS.map((url) => {
    const meta = SOURCE_METADATA[url];
    const path = meta.resolver ? '(resolvido no servidor)' : meta.filepath;
    return `| \`${url}\` | \`${path}\` | ${meta.description} |`;
  }).join('\n');

  return `## sources: URLs válidas e seus caminhos reais

Cada \`sources[].data\` DEVE ser exatamente uma destas URLs.
A coluna "Arquivo real" mostra onde o arquivo está no servidor ou identifica um endpoint dinâmico.

| URL servida | Arquivo real | Descrição |
|-------------|-------------|-----------|
${rows}

**Regra absoluta**: Nunca invente URLs. Se não está nesta tabela, a requisição retornará erro 422.
**Nota**: URLs em \`public/geo/\` são estáticas (GeoJSON). URLs em \`/api/\` são endpoints dinâmicos (Node.js).

  - Relação com mapType, mapDataId e geometry

  mapType: choropleth
  Quando usar: variável relativa (taxa/%/índice) por município
  mapDataId compatíveis: municipios_ivs, municipios_cadinsan,
  cozinhas_geolocalizadas, cozinhas_geolocalizadas_2025
  Nunca combinar com: cozinhas_pessoas_atendidas (total absoluto →
  viés de área)
  Sources default: /geo/geojs-100-mun.json, /geo/estados.json
  Geometry: polygon
  Exigência de legend: quantitativa, mesmos breaks do colorBy
  ────────────────────────────────────────
  mapType: proportionalCircles
  Quando usar: contagem absoluta por unidade
  mapDataId compatíveis: cozinhas_geolocalizadas,
  cozinhas_geolocalizadas_2025, cozinhas_pessoas_atendidas
  Nunca combinar com: — (aceita qualquer, mas não faz sentido para
  índice 0–1 sem transformação)
  Sources default: /geo/geojs-100-mun.json, /geo/estados.json, /api/cozinhas/bolhas
  Geometry: point
  Exigência de legend: círculo de referência explícito (ex.: "raio =
  500")
  ────────────────────────────────────────
  mapType: dotDensity
  Quando usar: 1 ponto = unidade fixa (ex.: 1 ponto = 1.000 pessoas)
  mapDataId compatíveis: cozinhas_geolocalizadas,
  cozinhas_geolocalizadas_2025, cozinhas_pessoas_atendidas
  Nunca combinar com: municipios_ivs, municipios_cadinsan (índice não
  é "quantidade de algo")
  Sources default: /geo/geojs-100-mun.json, /geo/estados.json
  Geometry: point (auto-gerado)
  Exigência de legend: "1 ponto = N" obrigatório na legenda
  ────────────────────────────────────────
  mapType: (sem mapType, pontos crus)
  Quando usar: localização individual das cozinhas, sem agregação
  mapDataId compatíveis: nenhum — usa a geometria da própria source
  Nunca combinar com: qualquer mapDataId agregado por município
  Source default: /api/cozinhas
  Geometry: point
  Exigência de legend: categórica, só se colorido por status

  **IMPORTANT** ERRO: A layer que declara "geometry: point/symbol" mas aponta para a source geometry: polygon.
  Círculos e símbolos precisam de sources com pontos (ex.: "/api/cozinhas/bolhas"), não polígonos — o centroid do polígono não é o ponto representativo do dado
`;
};

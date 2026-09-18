import { KNOWN_SOURCE_URLS, SOURCE_METADATA } from './specValidation.sources';

/**
 * Builds a markdown table listing all valid source URLs, their physical paths,
 * and descriptions. Injected into INSTRUCTIONS so the model always sees
 * current sources without manual duplication. If KNOWN_SOURCE_URLS changes,
 * this table regenerates automatically.
 *
 * Only what is derived from {@link KNOWN_SOURCE_URLS} lives here. The
 * `mapType` doctrine that used to trail this table moved into `route.ts`'s
 * `INSTRUCTIONS`, next to the classification and legend rules it depends on —
 * it was never derived from the source list.
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

**ERRO comum**: uma layer que declara \`geometry: point/symbol\` apontando para uma source de polígonos.
Círculos e símbolos precisam de sources com pontos (ex.: \`/api/cozinhas/bolhas\`) — o centroide do polígono não é o ponto representativo do dado.
`;
};

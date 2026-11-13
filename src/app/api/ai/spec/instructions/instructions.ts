import { KNOWN_SOURCE_URLS, SOURCE_METADATA } from '../specValidation';

/** The Point sources an agent spec may name, one line each: id, URL, accepted params. */
const POINT_SOURCES = KNOWN_SOURCE_URLS.filter((url) => {
  return SOURCE_METADATA[url].geometry === 'Point';
}).map((url) => {
  const { id, description, params } = SOURCE_METADATA[url];
  const query = params.map((param) => {
    return `?${param}=`;
  });
  return `- \`${id}\` → ${url} (aceita ${query.join(', ')}): ${description}`;
});

/**
 * Instructions sent to the Naturali agent at the start of every session: the
 * only sources it may name, generated from `SOURCE_METADATA`. Every other
 * source (the município polygons, the state outlines) is added by the server.
 * @example
 * const message = [catalogueText, INSTRUCTIONS, prompt].join('\n\n');
 */
export const INSTRUCTIONS = `## Fontes de pontos

O servidor declara sozinho os polígonos de município e o contorno dos estados. Uma camada de pontos ou de calor usa um destes \`sourceId\` sem declarar \`sources\`; declare a source só para fixar o ano (ex.: \`{"id": "cozinhas", "type": "geojson", "data": "/api/cozinhas?ano=2025"}\`).

${POINT_SOURCES.join('\n')}
`;

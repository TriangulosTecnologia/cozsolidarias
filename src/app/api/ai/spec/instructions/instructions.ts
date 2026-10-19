import endpointsDocumentation from './endpointsDocumentation.json';

/**
 * System instructions sent to the Naturali agent on every `POST /api/ai/spec`
 * call. Composed from the API endpoints documentation.
 * @example
 * const message = [catalogueText, INSTRUCTIONS, prompt].join('\n\n');
 */
export const INSTRUCTIONS = `

## Cozinhas Solidárias API routes

Use this to identify which API routes populate sources[].data to include in the JSON output

e.g.: since a proportional-circles map with the number of kitchens per municipality was requested, the correct path is /api/cozinhas/bolhas.

${JSON.stringify(endpointsDocumentation, null, 2)}
`;

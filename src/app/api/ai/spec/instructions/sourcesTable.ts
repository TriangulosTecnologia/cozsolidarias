import { KNOWN_SOURCE_URLS, SOURCE_METADATA } from '../specValidation';

/**
 * Builds a markdown table listing all valid source URLs, their physical paths,
 * and descriptions. Injected into INSTRUCTIONS so the model always sees
 * current sources without manual duplication. If KNOWN_SOURCE_URLS changes,
 * this table regenerates automatically.
 * @example
 * // Returns markdown table suitable for embedding in instructions
 * const table = buildSourcesTable();
 */
export const buildSourcesTable = (): string => {
  const rows = KNOWN_SOURCE_URLS.map((url) => {
    const meta = SOURCE_METADATA[url];
    const path = meta.resolver ? '(resolved on server)' : meta.filepath;
    return `| \`${url}\` | \`${path}\` | ${meta.description} |`;
  }).join('\n');

  return `## sources: valid URLs and their actual paths

Each \`sources[].data\` MUST be exactly one of these URLs.
The "Actual file" column shows where the file is on the server or identifies a dynamic endpoint.

| URL served | Actual file | Description |
|-------------|-------------|-----------|
${rows}

**Absolut rule**: Never invent URLs. If it's not in this table, the request will return a 422 error.
**Note**: URLs in \`public/geo/\` are static (GeoJSON). URLs in \`/api/\` are dynamic endpoints (Node.js).`;
};

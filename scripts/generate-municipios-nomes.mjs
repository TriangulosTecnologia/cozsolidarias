// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generates `public/geo/municipios-nomes.json`: a flat `{ codigoIbge: nome }`
 * lookup for every Brazilian município, keyed by the 7-digit IBGE code used as
 * `codarea` in `geojs-100-mun.json` (and surfaced as `MapHoverInfo.featureId`
 * on the map).
 *
 * Source of truth: `public/geo/geojs-100-mun.json` itself — the same boundary
 * file that draws the municípios. Each feature already carries its name in
 * `properties.name`, so we derive the catalog from it instead of maintaining a
 * separate hand-curated list. This guarantees the names can never drift from
 * what's actually drawn, and covers all of Brazil (not just SP).
 *
 * Run once and commit the output (no runtime dependency):
 *
 *     node scripts/generate-municipios-nomes.mjs
 */

const GEOJSON_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'geojs-100-mun.json'
);
const OUTPUT_PATH = join(process.cwd(), 'public', 'geo', 'municipios-nomes.json');

const main = async () => {
  /** @type {{ features: Array<{ properties?: { codarea?: string; name?: string } }> }} */
  const geojson = JSON.parse(await readFile(GEOJSON_PATH, 'utf8'));

  /** @type {Record<string, string>} */
  const nomesPorCodigo = {};
  /** @type {string[]} */
  const invalid = [];

  for (const feature of geojson.features) {
    const codarea = feature.properties?.codarea;
    const name = feature.properties?.name;

    // Fail loudly: a feature without a code or name would silently show the
    // "Município <código>" fallback on the map.
    if (!codarea || !name) {
      invalid.push(JSON.stringify(feature.properties ?? null));
      continue;
    }

    nomesPorCodigo[String(codarea)] = name;
  }

  if (invalid.length > 0) {
    throw new Error(
      `Feature(s) missing codarea/name: ${invalid.slice(0, 5).join(', ')}` +
        (invalid.length > 5 ? ` (+${invalid.length - 5} more)` : '')
    );
  }

  // Sort keys so the committed file has a stable, diff-friendly order.
  const sorted = Object.fromEntries(
    Object.entries(nomesPorCodigo).sort(([a], [b]) => {
      return a.localeCompare(b);
    })
  );

  await writeFile(OUTPUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  console.log(
    `Wrote ${Object.keys(sorted).length} municípios to ${OUTPUT_PATH}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

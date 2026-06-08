// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generates `public/geo/municipios-sp-nomes.json`: a flat `{ codigoIbge: nome }`
 * lookup for every São Paulo município, keyed by the same 7-digit IBGE code used
 * as `codarea` in `municipios-sp.json` (and surfaced as `MapHoverInfo.featureId`
 * on the map).
 *
 * Source of truth: IBGE Localidades API (UF 35 = São Paulo). Run once and commit
 * the output so the app has no runtime dependency on the IBGE service:
 *
 *     node scripts/generate-municipios-sp-nomes.mjs
 */

const IBGE_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios';

const GEOJSON_PATH = join(process.cwd(), 'public', 'geo', 'municipios-sp.json');
const OUTPUT_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'municipios-sp-nomes.json'
);

const main = async () => {
  const response = await fetch(IBGE_URL);
  if (!response.ok) {
    throw new Error(`IBGE request failed: ${response.status}`);
  }
  /** @type {Array<{ id: number; nome: string }>} */
  const municipios = await response.json();

  /** @type {Record<string, string>} */
  const nomesPorCodigo = {};
  for (const { id, nome } of municipios) {
    nomesPorCodigo[String(id)] = nome;
  }

  // Cross-check against the GeoJSON so a missing/extra code fails loudly here
  // instead of showing a fallback label on the map.
  const geojson = JSON.parse(await readFile(GEOJSON_PATH, 'utf8'));
  const geoCodes = geojson.features.map((f) => {
    return String(f.properties?.codarea);
  });
  const missing = geoCodes.filter((code) => {
    return !nomesPorCodigo[code];
  });
  if (missing.length > 0) {
    throw new Error(`No IBGE name for codarea(s): ${missing.join(', ')}`);
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

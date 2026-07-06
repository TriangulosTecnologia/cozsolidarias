// @ts-check
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generates `public/geo/municipios-populacao.json`: a flat
 * `{ codigoIbge: habitantes }` lookup for every Brazilian município, keyed by
 * the 7-digit IBGE code used as `codarea` in `geojs-100-mun.json` (and surfaced
 * as `MapHoverInfo.featureId` on the map). Same shape as `municipios-nomes.json`.
 *
 * Source of truth: IBGE's SIDRA aggregate API — Censo 2022, "População
 * residente" (agregado 4709, variável 93), for every município (`N6[all]`).
 *
 * Run once and commit the output (no runtime dependency):
 *
 *     node scripts/generate-municipios-populacao.mjs
 */

const IBGE_URL =
  'https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6[all]';

const OUTPUT_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'municipios-populacao.json'
);

const main = async () => {
  const response = await fetch(IBGE_URL);

  if (!response.ok) {
    throw new Error(`IBGE API responded ${response.status} for ${IBGE_URL}`);
  }

  /**
   * @type {Array<{
   *   resultados: Array<{
   *     series: Array<{
   *       localidade: { id?: string };
   *       serie: Record<string, string>;
   *     }>;
   *   }>;
   * }>}
   */
  const payload = await response.json();

  const series = payload[0]?.resultados?.[0]?.series ?? [];

  if (series.length === 0) {
    throw new Error(
      'IBGE API returned no series — check aggregate/variable ids'
    );
  }

  /** @type {Record<string, number>} */
  const populacaoPorCodigo = {};
  /** @type {string[]} */
  const invalid = [];

  for (const entry of series) {
    const codigo = entry.localidade?.id;
    // The series is keyed by year; Censo 2022 exposes a single "2022" value.
    const bruto = Object.values(entry.serie ?? {})[0];
    const habitantes = Number(bruto);

    // Fail loudly: a município missing its code or a numeric population would
    // silently create a hole in the per-100k-inhabitants map later.
    if (!codigo || !Number.isFinite(habitantes)) {
      invalid.push(JSON.stringify(entry.localidade ?? null));
      continue;
    }

    populacaoPorCodigo[String(codigo)] = habitantes;
  }

  if (invalid.length > 0) {
    throw new Error(
      `Município(s) missing code/population: ${invalid.slice(0, 5).join(', ')}` +
        (invalid.length > 5 ? ` (+${invalid.length - 5} more)` : '')
    );
  }

  // Sort by code so the committed file has a stable, diff-friendly order.
  const sorted = Object.fromEntries(
    Object.entries(populacaoPorCodigo).sort(([a], [b]) => {
      return a.localeCompare(b);
    })
  );

  await writeFile(OUTPUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  const total = Object.values(sorted).reduce((sum, habitantes) => {
    return sum + habitantes;
  }, 0);

  console.log(
    `Wrote ${Object.keys(sorted).length} municípios to ${OUTPUT_PATH} ` +
      `(população total: ${total.toLocaleString('pt-BR')})`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

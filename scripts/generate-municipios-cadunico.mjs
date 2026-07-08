// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generates `public/geo/municipios-cadunico.json`: a flat
 * `{ codigoIbge: pessoasCadastradas }` lookup for every Brazilian município,
 * keyed by the 7-digit IBGE code used as `codarea` in `geojs-100-mun.json` (and
 * surfaced as `MapHoverInfo.featureId` on the map). Same shape as
 * `municipios-populacao.json`.
 *
 * Source of truth: MDS/SAGI "MI Social" aggregate API (`misocial`), field
 * `cadun_qtd_pessoas_cadastradas_i` — total people registered in the Cadastro
 * Único per município, for the reference month {@link ANOMES}.
 *
 * The API keys municípios by the **6-digit** IBGE code (`codigo_ibge`, e.g. São
 * Paulo = `355030`), so each row is remapped to its 7-digit `codarea` by matching
 * the 6-digit prefix of the contour codes in `geojs-100-mun.json`.
 *
 * Run once and commit the output (no runtime dependency):
 *
 *     node scripts/generate-municipios-cadunico.mjs
 */

/** Reference month (YYYYMM): latest with full município coverage of the field. */
const ANOMES = '202606';

const MISOCIAL_URL =
  `https://aplicacoes.mds.gov.br/sagi/servicos/misocial?q=*` +
  `&fq=anomes:${ANOMES}` +
  `&fq=cadun_qtd_pessoas_cadastradas_i:%5B1%20TO%20*%5D` +
  `&fl=codigo_ibge,cadun_qtd_pessoas_cadastradas_i&rows=6000&wt=json`;

const CONTOURS_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'geojs-100-mun.json'
);

const OUTPUT_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'municipios-cadunico.json'
);

/**
 * Fetches the MI Social rows for {@link ANOMES}, failing loudly on an HTTP error
 * or an empty result.
 *
 * @returns {Promise<Array<{
 *   codigo_ibge: string;
 *   cadun_qtd_pessoas_cadastradas_i: number;
 * }>>}
 */
const fetchCadunico = async () => {
  const response = await fetch(MISOCIAL_URL);

  if (!response.ok) {
    throw new Error(`MI Social API responded ${response.status}`);
  }

  /**
   * @type {{ response?: { docs?: Array<{
   *   codigo_ibge?: string;
   *   cadun_qtd_pessoas_cadastradas_i?: number;
   * }> } }}
   */
  const payload = await response.json();
  const docs = payload.response?.docs ?? [];

  if (docs.length === 0) {
    throw new Error(`MI Social returned no rows for anomes ${ANOMES}`);
  }

  return docs;
};

/**
 * Reads the municipality contours and returns a `Map` from each município's
 * 6-digit IBGE prefix to its full 7-digit `codarea` — the join key the MI Social
 * 6-digit `codigo_ibge` maps onto.
 *
 * @returns {Promise<Map<string, string>>}
 */
const readCodareaByPrefix = async () => {
  const raw = await readFile(CONTOURS_PATH, 'utf8');
  /** @type {{ features?: Array<{ properties?: { codarea?: string } }> }} */
  const contours = JSON.parse(raw);
  const byPrefix = new Map();

  for (const feature of contours.features ?? []) {
    const codarea = feature.properties?.codarea;
    if (codarea) {
      byPrefix.set(String(codarea).slice(0, 6), String(codarea));
    }
  }

  if (byPrefix.size === 0) {
    throw new Error('No codarea found in the contour file');
  }

  return byPrefix;
};

const main = async () => {
  const [docs, codareaByPrefix] = await Promise.all([
    fetchCadunico(),
    readCodareaByPrefix(),
  ]);

  /** @type {Record<string, number>} */
  const pessoasPorCodigo = {};
  /** @type {string[]} */
  const unmatched = [];

  for (const doc of docs) {
    const codigo6 = String(doc.codigo_ibge ?? '');
    const pessoas = Number(doc.cadun_qtd_pessoas_cadastradas_i);
    const codarea = codareaByPrefix.get(codigo6);

    // A município missing from the contour file has no polygon to paint, so it
    // is dropped (reported below); a non-numeric count is a source error.
    if (!codarea) {
      unmatched.push(codigo6);
      continue;
    }
    if (!Number.isFinite(pessoas)) {
      throw new Error(`Non-numeric cadunico count for ${codigo6}`);
    }

    pessoasPorCodigo[codarea] = pessoas;
  }

  // Sort by code so the committed file has a stable, diff-friendly order.
  const sorted = Object.fromEntries(
    Object.entries(pessoasPorCodigo).sort(([a], [b]) => {
      return a.localeCompare(b);
    })
  );

  await writeFile(OUTPUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  const total = Object.values(sorted).reduce((sum, pessoas) => {
    return sum + pessoas;
  }, 0);

  console.log(
    `Wrote ${Object.keys(sorted).length} municípios to ${OUTPUT_PATH} ` +
      `(anomes ${ANOMES}; total pessoas: ${total.toLocaleString('pt-BR')}; ` +
      `${unmatched.length} MI Social município(s) not in contours: ` +
      `${unmatched.join(', ') || 'none'})`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

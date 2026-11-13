/**
 * Scores one eval case against the SERVED response of `POST /api/ai/spec`
 * (the minimal-spec protocol: the server resolves layers and legends).
 *
 *   node score_case.mjs <output.json> <repoPath> --case=<eval case id>
 *
 * Reads the case's `expect` from `evals/evals.json` and checks, on the served
 * spec: the outcome (200 map / 422 error / clarify), the dataset, the
 * geometry URL, the legend scale shown on the map, and geovis' own
 * `validateSpec`.
 *
 * Points and heatmap maps carry no `mapData`: their dataset comes from the URL
 * the server recorded in `metadata.sourceUrls` — `/api/cozinhas?ano=2025` is
 * `cozinhas_geolocalizadas_2025`, `/api/cozinhas` is `cozinhas_geolocalizadas`.
 * Only legends with a `position` count: geovis mounts no other.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => { return a.startsWith('--') }).map((a) => { return a.replace(/^--/, '').split('=') })
);
const [outputFile, repoPath] = args.filter((a) => { return !a.startsWith('--') });
if (!outputFile || !repoPath || !flags.case) {
  process.stderr.write('usage: score_case.mjs <output.json> <repoPath> --case=<id>\n');
  process.exit(1);
}

const EVALS = join(dirname(fileURLToPath(import.meta.url)), '..', 'evals', 'evals.json');
const evalCase = JSON.parse(readFileSync(EVALS, 'utf8')).cases.find((c) => { return c.id === flags.case });
if (!evalCase) {
  process.stderr.write(`unknown case ${flags.case}\n`);
  process.exit(1);
}
const { validateSpec } = await import(
  pathToFileURL(join(repoPath, 'node_modules/@ttoss/geovis/dist/index.mjs')).href
);

const run = JSON.parse(readFileSync(outputFile, 'utf8'));
const body = run.response ?? {};
const spec = run.httpStatus === 200 && !body.error ? body.spec ?? null : null;
const outcome = body.clarify ? 'clarify' : spec ? 'spec' : run.httpStatus === 422 ? 'error' : `http-${run.httpStatus}`;

const list = (value) => { return Array.isArray(value) ? value : [] };
const sourceUrls = { ...(spec?.metadata?.sourceUrls ?? {}) };
for (const source of list(spec?.sources)) {
  if (typeof source.data === 'string') sourceUrls[source.id] = source.data;
}

/** The dataset a served spec shows: `mapData[0]`, else the kitchen points URL. */
const datasetOf = () => {
  const mapDataId = list(spec?.mapData)[0]?.mapDataId;
  if (mapDataId) return mapDataId;
  const pointsUrl = Object.values(sourceUrls).find((url) => { return url.startsWith('/api/cozinhas') });
  if (!pointsUrl) return null;
  const year = new URL(pointsUrl, 'http://x').searchParams.get('ano');
  return year ? `cozinhas_geolocalizadas_${year}` : 'cozinhas_geolocalizadas';
};

const shownLegends = list(spec?.legends).filter((legend) => { return legend.position });
const legendScaleOf = () => {
  const scaled = shownLegends.find((legend) => { return legend.colorBy?.type });
  return scaled ? scaled.colorBy.type : shownLegends.length > 0 ? 'text' : 'none';
};

/** Which outcomes satisfy the case: an explicit `expect.outcome`, else a map. */
const ACCEPTED = {
  error: ['error'],
  'error-or-clarify': ['error', 'clarify'],
  'clarify-or-default-with-note': ['clarify', 'spec'],
  'spec-with-rate-or-error': ['spec', 'error'],
  'spec-with-coverage-caveat': ['spec'],
  'error-or-default-basemap': ['spec', 'error'],
};
const expect = evalCase.expect ?? {};
const accepted = ACCEPTED[expect.outcome] ?? ['spec'];

const checks = [{ id: 'outcome', passed: accepted.includes(outcome), note: `expected ${accepted.join('|')}, got ${outcome}` }];
if (spec) {
  const dataset = datasetOf();
  if (expect.dataset) checks.push({ id: 'dataset', passed: dataset === expect.dataset, note: `got ${dataset}` });
  if (expect.geometry) {
    const urls = Object.values(sourceUrls);
    checks.push({ id: 'geometry', passed: urls.includes(expect.geometry), note: `got ${urls.join(', ')}` });
  }
  if (expect.legendScale) {
    const scale = legendScaleOf();
    const passed = expect.legendScale === 'text-or-none' ? scale === 'none' || scale === 'text' : scale === expect.legendScale;
    checks.push({ id: 'legend', passed, note: `shown=${shownLegends.length} scale=${scale}` });
  }
  if (expect.outcome === 'spec-with-coverage-caveat') {
    const caveat = /parcial|cobertura|nem todas/i.test(spec.description ?? '') && !/todas|complet/i.test(spec.title ?? '');
    checks.push({ id: 'coverage-caveat', passed: caveat, note: `title=${spec.title} description=${spec.description}` });
  }
  const validation = validateSpec(spec);
  checks.push({ id: 'validateSpec', passed: validation.status === 'resolved', note: JSON.stringify(validation.issues?.slice(0, 3) ?? null) });
}

const result = {
  case: evalCase.id,
  prompt: run.prompt,
  httpStatus: run.httpStatus,
  durationMs: run.durationMs,
  outcome,
  issues: list(body.issues).map((issue) => { return issue.code }),
  checks,
  passed: checks.every((c) => { return c.passed }),
};
writeFileSync(outputFile.replace(/\.json$/, '.score.json'), JSON.stringify(result, null, 2));
process.stdout.write(`${evalCase.id}: ${result.passed ? 'PASS' : 'FAIL'}${checks.filter((c) => { return !c.passed }).map((c) => { return ` [${c.id}: ${c.note}]` }).join('')}\n`);

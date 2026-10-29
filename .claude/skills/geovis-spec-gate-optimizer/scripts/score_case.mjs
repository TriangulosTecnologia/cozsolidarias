/**
 * Axis (a) of the eval: programmatic pass/fail, reusing the REAL validators
 * of the cozsolidarias repo — never reimplements the rules.
 *
 *   node --experimental-strip-types score_case.mjs <output.json> <repoPath> [--expect=spec|error]
 *
 * `--expect` comes from the eval case's field: `kind: "error"`/`"trap"` expects `error`,
 * `golden`/`rubric-only` expect `spec`. Without it the script only reports, without judging
 * whether the *type* of response was the right one — which is how it used to fail: a
 * `{"error"}` response counted as a pass even in a golden case, where it is the
 * worst failure (the model gave up on a map the route knows how to serve).
 *
 * Runs on Node 24's native strip-types instead of `npx tsx`: specValidation
 * is TypeScript and lives outside the Next runtime, but installing a runner just for this
 * is not justified.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve as pres } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const print = (line) => { process.stdout.write(`${line}\n`) };

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => { return a.startsWith('--') }).map((a) => { return a.replace(/^--/, '').split('=') })
);
const [outputFile, repoPath] = args.filter((a) => { return !a.startsWith('--') });

if (!outputFile || !repoPath) {
  process.stderr.write('usage: score_case.mjs <output.json> <repoPath> [--expect=spec|error]\n');
  process.exit(1);
}

const SRC = join(repoPath, 'src');
const EXTS = ['', '.ts', '.tsx', '/index.ts'];
const firstFile = (base) => {
  for (const ext of EXTS) {
    try {
      if (statSync(base + ext).isFile()) return base + ext;
    } catch {
      // not a file with this extension; try the next one
    }
  }
  return null;
};

registerHooks({
  resolve: (spec, ctx, next) => {
    const base = spec.startsWith('@/')
      ? pres(SRC, spec.slice(2))
      : spec.startsWith('.') && ctx.parentURL
        ? pres(dirname(fileURLToPath(ctx.parentURL)), spec)
        : null;
    const hit = base && firstFile(base);
    return hit ? { url: pathToFileURL(hit).href, shortCircuit: true } : next(spec, ctx);
  },
});

const V = await import(
  pathToFileURL(join(SRC, 'app/api/ai/spec/specValidation.ts')).href
);
const { validateSpec } = await import(
  pathToFileURL(join(repoPath, 'node_modules/@ttoss/geovis/dist/index.mjs')).href
);

/**
 * The whole mesh, in the order the route applies it. `findMissingLegend` returns
 * `true` when a legend is missing, and the rest return the offending subject — in both
 * cases, truthy = violation.
 */
const MESH = [
  'findInvalidGeojsonSource',
  'findInvalidBasemapStyleUrl',
  'findGeometryInMapData',
  'findMissingLegend',
  'findChoroplethOnAbsoluteTotal',
  'findSourceGeometryMismatch',
  'findPaintedContextLayer',
  'findUnsupportedSourceType',
  'findMapTypeWithoutMapData',
  'findLayerWithBothDataBindings',
  'findLegendScaleArityMismatch',
  'findDanglingActiveLegendId',
  'findLegendPropertyMismatch',
  'findForeignNoDataColor',
  'findReclassifiedOfficialIndex',
  'findDotDensityWithoutRatio',
  // Reads already-resolved values — only meaningful on the route's response, which has
  // already gone through appendRealMapData.
  'findLegendValueTypeMismatch',
];

const run = JSON.parse(readFileSync(outputFile, 'utf8'));
const spec = run.response?.result ?? null;
const declaredError = run.response?.error ?? null;
const expect = flags.expect ?? null;

const checks = [];

if (expect) {
  const got = declaredError ? 'error' : spec ? 'spec' : 'none';
  checks.push({
    id: 'expected-outcome',
    passed: got === expect,
    note: `expected=${expect} got=${got}` + (declaredError ? ` :: ${declaredError}` : ''),
  });
}

if (declaredError) {
  if (!expect) {
    checks.push({ id: 'declared-error', passed: true, note: `response declared error: ${declaredError}` });
  }
} else if (!spec || !V.isRecord(spec)) {
  checks.push({ id: 'structural', passed: false, note: 'response had neither a result nor an explicit error' });
} else {
  for (const id of MESH) {
    const fn = V[id];
    if (typeof fn !== 'function') {
      checks.push({ id, passed: false, note: 'VALIDATOR MISSING — the mesh changed, update MESH' });
      continue;
    }
    const violation = fn(spec);
    checks.push({ id, passed: !violation, note: violation ? JSON.stringify(violation) : null });
  }

  const validation = validateSpec(spec);
  checks.push({
    id: 'validateSpec',
    passed: validation.status === 'resolved',
    note: validation.status === 'resolved' ? null : JSON.stringify(validation.issues?.slice(0, 3) ?? validation.status),
  });
}

const result = {
  prompt: run.prompt,
  httpStatus: run.httpStatus,
  durationMs: run.durationMs,
  expect,
  checks,
  passRate: checks.length ? checks.filter((c) => { return c.passed }).length / checks.length : 0,
};

const scoreFile = outputFile.replace(/\.json$/, '.score.json');
writeFileSync(scoreFile, JSON.stringify(result, null, 2));
print(`Score written to ${scoreFile} (passRate=${result.passRate})`);
for (const c of checks.filter((c) => { return !c.passed })) print(`  FAILED ${c.id}: ${c.note}`);

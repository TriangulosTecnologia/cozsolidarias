/**
 * Eixo (a) do eval: pass/fail programático, reaproveitando os validadores REAIS
 * do repo cozsolidarias — nunca reimplementa as regras.
 *
 *   node --experimental-strip-types score_case.mjs <output.json> <repoPath> [--expect=spec|error]
 *
 * `--expect` vem do campo do eval case: `kind: "error"`/`"trap"` espera `error`,
 * `golden`/`rubric-only` esperam `spec`. Sem ele o script só reporta, sem julgar
 * se o *tipo* de resposta era o certo — que é como ele errava antes: uma
 * resposta `{"error"}` contava como acerto mesmo num caso golden, onde ela é a
 * falha máxima (o modelo desistiu de um mapa que a rota sabe servir).
 *
 * Roda com o strip-types nativo do Node 24 em vez de `npx tsx`: specValidation
 * é TypeScript e vive fora do runtime Next, mas instalar um runner só pra isso
 * não se justifica.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve as pres } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('='))
);
const [outputFile, repoPath] = args.filter((a) => !a.startsWith('--'));

if (!outputFile || !repoPath) {
  console.error('uso: score_case.mjs <output.json> <repoPath> [--expect=spec|error]');
  process.exit(1);
}

const SRC = join(repoPath, 'src');
const EXTS = ['', '.ts', '.tsx', '/index.ts'];
const firstFile = (base) => {
  for (const ext of EXTS) {
    try {
      if (statSync(base + ext).isFile()) return base + ext;
    } catch {}
  }
  return null;
};

registerHooks({
  resolve(spec, ctx, next) {
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
 * Toda a malha, na ordem em que a rota a aplica. `findMissingLegend` devolve
 * `true` quando falta legend, e os demais devolvem o sujeito ofensor — em ambos
 * os casos, truthy = violação.
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
  // Lê valores já resolvidos — só faz sentido sobre a resposta da rota, que já
  // passou por appendRealMapData.
  'findLegendValueTypeMismatch',
];

const run = JSON.parse(readFileSync(outputFile, 'utf8'));
const spec = run.response?.result ?? null;
const declaredError = run.response?.error ?? null;
const expect = flags.expect ?? null;

const checks = [];

if (expect) {
  const got = declaredError ? 'error' : spec ? 'spec' : 'nenhum';
  checks.push({
    id: 'expected-outcome',
    passed: got === expect,
    note: `esperado=${expect} obtido=${got}` + (declaredError ? ` :: ${declaredError}` : ''),
  });
}

if (declaredError) {
  if (!expect) {
    checks.push({ id: 'declared-error', passed: true, note: `resposta declarou erro: ${declaredError}` });
  }
} else if (!spec || !V.isRecord(spec)) {
  checks.push({ id: 'structural', passed: false, note: 'resposta não trouxe result nem error explícito' });
} else {
  for (const id of MESH) {
    const fn = V[id];
    if (typeof fn !== 'function') {
      checks.push({ id, passed: false, note: 'VALIDADOR AUSENTE — a malha mudou, atualize MESH' });
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
  passRate: checks.length ? checks.filter((c) => c.passed).length / checks.length : 0,
};

const scoreFile = outputFile.replace(/\.json$/, '.score.json');
writeFileSync(scoreFile, JSON.stringify(result, null, 2));
console.log(`Score gravado em ${scoreFile} (passRate=${result.passRate})`);
for (const c of checks.filter((c) => !c.passed)) console.log(`  FALHOU ${c.id}: ${c.note}`);

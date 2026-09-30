/**
 * Regenerates the golden spec corpus from `buildSpec` — the same function the
 * production map calls — so the corpus is never a stale hand-copied dump.
 *
 * Run from the cozsolidarias repo root (the gateway resolves data files
 * relative to cwd):
 *
 *   node --experimental-strip-types \
 *     ~/.claude/skills/geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs
 *
 * Pass `--full` to keep every data row (14MB+); the default elides them.
 *
 * Writes `src/app/(features)/mapas/specs/full-evalued/`:
 *   <mode>.json    one spec per MapMode
 *   manifest.json  provenance — git sha, geovis version, row counts, which
 *                  overlays were populated, generation timestamp
 *
 * This directory is meant to be overwritten on every run: it is the *current*
 * ideal, and `manifest.json` is what says which code produced it. Eval rounds
 * compare agent output against it via `project_spec.mjs compare`.
 *
 * Why values are elided by default: the agent never emits them. It returns
 * `mapData` with a placeholder `data`, and `appendRealMapData` swaps in real
 * gateway rows server-side. Scoring a candidate against real values would
 * score the route, not the model. What stays is the binding structure the
 * agent *is* responsible for — sources, layers, joins, legend scales — plus a
 * row count and a 3-row sample, which is all the legend-scale check needs.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve as presolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = process.cwd();
const SRC = join(REPO, 'src');
const MAPAS = join(SRC, 'app', '(features)', 'mapas');
const OUT = join(MAPAS, 'specs', 'full-evalued');
const KEEP_FULL = process.argv.includes('--full');

// Node strips types but still demands full specifiers and knows nothing about
// tsconfig `paths`. These hooks supply both, so `buildSpec` loads untouched.
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
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
      ? presolve(SRC, spec.slice(2))
      : spec.startsWith('.') && ctx.parentURL
        ? presolve(dirname(fileURLToPath(ctx.parentURL)), spec)
        : null;
    const hit = base && firstFile(base);
    return hit
      ? { url: pathToFileURL(hit).href, shortCircuit: true }
      : next(spec, ctx);
  },
});

/** The MapMode union, read from its own source so the dump can never drift from it. */
const readModes = () => {
  const text = readFileSync(join(MAPAS, 'geovisMapMode.ts'), 'utf8');
  const union = text.split('export type MapMode')[1];
  if (!union) throw new Error('MapMode union not found in geovisMapMode.ts');
  const modes = [...union.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  if (modes.length === 0) throw new Error('MapMode union parsed to zero modes');
  return modes;
};

/** The colour scale a resolved row set supports — the only thing the legend check reads. */
const valueKind = (rows) => {
  for (const row of rows) {
    if (typeof row?.value === 'string') return 'categorical';
    if (typeof row?.value === 'number') return 'quantitative';
  }
  return 'empty';
};

/** Replaces bulk payloads with a summary, leaving every structural field verbatim. */
const slim = (spec) => {
  const out = { ...spec };

  if (Array.isArray(spec.mapData)) {
    out.mapData = spec.mapData.map((entry) => {
      if (!Array.isArray(entry?.data)) return entry;
      return {
        ...entry,
        data: {
          __elided: true,
          rows: entry.data.length,
          valueKind: valueKind(entry.data),
          sample: entry.data.slice(0, 3),
        },
      };
    });
  }

  if (Array.isArray(spec.sources)) {
    out.sources = spec.sources.map((source) => {
      const data = source?.data;
      if (!data || typeof data !== 'object') return source;
      return {
        ...source,
        data: {
          __elided: true,
          type: data.type ?? 'unknown',
          features: Array.isArray(data.features) ? data.features.length : null,
        },
      };
    });
  }

  return out;
};

const optional = async (label, fn, sink) => {
  try {
    const value = await fn();
    sink[label] = Array.isArray(value) ? { rows: value.length } : { present: true };
    return value;
  } catch (error) {
    sink[label] = { absent: String(error.message).slice(0, 120) };
    return undefined;
  }
};

const main = async () => {
  const { buildSpec } = await import(
    pathToFileURL(join(MAPAS, 'geovisSpec.ts')).href
  );
  const { gateway } = await import(pathToFileURL(join(SRC, 'gateway.ts')).href);

  const provenance = {};
  const byCity =
    (await optional('cozinhasPorMunicipio', () => gateway.getCozinhasPorMunicipio(), provenance)) ?? [];
  const ivsByCity =
    (await optional('ivsPorMunicipio', () => gateway.getIvsPorMunicipio(), provenance)) ?? [];
  const overlays = {
    cafByCity: await optional('cafsPorMunicipio', () => gateway.getCafsPorMunicipio(), provenance),
    cadinsanByCity: await optional('cadinsanPorMunicipio', () => gateway.getCadinsanPorMunicipio(), provenance),
    cafHexbin: await optional('cafHexbin', () => gateway.getCafHexbin(), provenance),
    cafPontosPorUf: await optional('cafPontosPorUf', () => gateway.getCafPontosPorUf(), provenance),
  };

  mkdirSync(OUT, { recursive: true });
  const written = [];

  for (const mode of readModes()) {
    const raw = buildSpec(byCity, mode, undefined, ivsByCity, overlays);
    const spec = KEEP_FULL ? raw : slim(raw);
    writeFileSync(join(OUT, `${mode}.json`), JSON.stringify(spec, null, 2) + '\n');
    written.push({
      mode,
      sources: (raw.sources ?? []).length,
      layers: (raw.layers ?? []).length,
      legends: (raw.legends ?? []).length,
      mapData: (raw.mapData ?? []).length,
    });
  }

  writeFileSync(
    join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        generator: 'geovis-spec-instructions-optimizer/scripts/dump_golden_specs.mjs',
        source: 'src/app/(features)/mapas/geovisSpec.ts#buildSpec',
        gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO }).toString().trim(),
        geovisVersion: JSON.parse(
          readFileSync(join(REPO, 'node_modules/@ttoss/geovis/package.json'), 'utf8')
        ).version,
        dataRowsElided: !KEEP_FULL,
        datasets: provenance,
        modes: written,
      },
      null,
      2
    ) + '\n'
  );

  console.log(`${written.length} specs → ${OUT}${KEEP_FULL ? ' (completo)' : ' (dados elididos)'}`);
  for (const [label, info] of Object.entries(provenance)) {
    if (info.absent) console.log(`  overlay ausente: ${label} — ${info.absent}`);
  }
};

await main();

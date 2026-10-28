/**
 * Gate for the `cozinhas_pessoas_atendidas` eval case (see references/decisions.md, D1c).
 *
 * Checks a candidate VisualizationSpec against two things:
 *   1. Contract invariants: the dataset is the people-served total, it is not
 *      painted as a choropleth, and the scale matches the data.
 *   2. Total oracle: every municipality's value is recomputed from the static
 *      kitchen CSV with the same rule as the gateway (polygon match first, then
 *      the declared IBGE code), so the golden's numbers are never trusted blindly.
 *
 * Usage, from the cozsolidarias repo root:
 *
 *   node .claude/skills/geovis-spec-gate-optimizer/scripts/gate_pessoas_total.mjs <spec.json>
 *   node .claude/skills/geovis-spec-gate-optimizer/scripts/gate_pessoas_total.mjs --self-test [golden.json]
 *
 * Goldens are read from `GEOVIS_GOLDEN_DIR` (default `tmp/specs/full/verifield`). With
 * `--self-test` and no path, the golden is `<GEOVIS_GOLDEN_DIR>/_pessoas-atendidas.json`.
 *
 * Exit code 1 when the gate fails. `--self-test` runs the regression gate: the
 * golden must pass, and every mutant derived from it must fail.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATASET = 'cozinhas_pessoas_atendidas';
const REPO = process.cwd();
const GOLDEN_DIR = resolve(REPO, process.env.GEOVIS_GOLDEN_DIR ?? 'tmp/specs/full/verifield');
const GOLDEN_PESSOAS = resolve(GOLDEN_DIR, '_pessoas-atendidas.json');
const CSV = resolve(REPO, 'src/data-source-static/data/cozinhas_com_geolocalizacao_all.csv');
const GEO = resolve(REPO, 'public/geo/geojs-100-mun.json');

/** Splits one CSV line, honouring double-quoted fields with escaped quotes. */
const parseLine = (line) => {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
};

/** Mirrors `parsePessoasAtendidas` in the gateway: empty, non-numeric or negative → null. */
const parsePessoas = (raw) => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

/** Ray casting over one ring. */
const inRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/** Polygon or MultiPolygon, holes excluded. */
const inGeometry = (point, geometry) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => {
    return inRing(point, rings[0]) && !rings.slice(1).some((hole) => inRing(point, hole));
  });
};

/** Recomputes `geometryId → total people` the way the gateway aggregates it. */
const recomputeTotals = () => {
  const features = JSON.parse(readFileSync(GEO, 'utf8')).features.map((f) => {
    return { code: String(f.properties.codarea), geometry: f.geometry };
  });
  const codes = new Set(features.map(({ code }) => code));
  const lines = readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseLine(lines[0]);
  const iIbge = header.indexOf('Código IBGE');
  const iPub = header.indexOf('Público Total Atendido');
  const iLat = header.indexOf('Latitude');
  const iLng = header.indexOf('Longitude');
  const totals = new Map();

  for (const line of lines.slice(1)) {
    const cols = parseLine(line);
    const lat = Number(cols[iLat]);
    const lng = Number(cols[iLng]);
    if (!cols[iLat] || !cols[iLng] || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const declared = (cols[iIbge] ?? '').trim();
    const hit = features.find(({ geometry }) => inGeometry([lng, lat], geometry));
    const code = hit ? hit.code : codes.has(declared) ? declared : undefined;
    if (!code) continue;
    const pessoas = parsePessoas(cols[iPub] ?? '');
    if (pessoas !== null) totals.set(code, (totals.get(code) ?? 0) + pessoas);
  }
  return totals;
};

/** Contract invariants on the spec alone. Returns a list of failure messages. */
const checkContract = (spec) => {
  const failures = [];
  const rows = (spec.mapData ?? []).filter((m) => m.mapDataId === DATASET).flatMap((m) => m.data ?? []);
  if (rows.length === 0) failures.push(`C1: no mapData row for ${DATASET}`);

  const polygonOnTotal = (spec.layers ?? []).some((l) => l.geometry === 'polygon' && l.mapDataId === DATASET);
  if (polygonOnTotal) failures.push(`C2: polygon layer painted with an absolute total (${DATASET})`);

  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  if (spec.scaleMaxValue !== max) failures.push(`C3: scaleMaxValue ${spec.scaleMaxValue} != max(value) ${max}`);

  for (const layer of spec.layers ?? []) {
    const thresholds = layer.sizeBy?.thresholds;
    if (thresholds && layer.mapDataId === DATASET && thresholds[1] !== max) {
      failures.push(`C4: sizeBy.thresholds[1] ${thresholds[1]} != max(value) ${max}`);
    }
  }
  return { failures, rows };
};

/** Total oracle: per-municipality equality with the recomputed gateway totals. */
const checkTotal = (rows, totals) => {
  const failures = [];
  const candidate = new Map(rows.map((r) => [String(r.geometryId), r.value]));
  let sumRecomputed = 0;
  for (const [code, value] of totals) {
    sumRecomputed += value;
    if (candidate.get(code) !== value) failures.push(`T1: ${code} candidate=${candidate.get(code)} oracle=${value}`);
  }
  for (const code of candidate.keys()) {
    if (!totals.has(code)) failures.push(`T2: ${code} not produced by the gateway rule`);
  }
  const sumCandidate = [...candidate.values()].reduce((a, b) => a + b, 0);
  if (sumCandidate !== sumRecomputed) failures.push(`T3: sum candidate=${sumCandidate} oracle=${sumRecomputed}`);
  return failures;
};

/** Runs contract + total checks. */
const gate = (spec, totals) => {
  const { failures: contract, rows } = checkContract(spec);
  const failures = [...contract, ...checkTotal(rows, totals)];
  return { pass: failures.length === 0, failures };
};

/** Mutants of the golden. Each must make the gate fail. */
const mutants = (golden) => {
  const clone = () => structuredClone(golden);
  const withRows = (spec, fn) => {
    spec.mapData = spec.mapData.map((m) => (m.mapDataId === DATASET ? { ...m, data: fn(m.data) } : m));
    return spec;
  };
  return {
    'M1 dataset swapped to kitchen count': (() => {
      const s = clone();
      s.mapData = s.mapData.map((m) => ({ ...m, mapDataId: 'cozinhas_geolocalizadas' }));
      return s;
    })(),
    'M2 polygon over absolute total': (() => {
      const s = clone();
      s.layers = [...s.layers, { id: 'mut-poly', geometry: 'polygon', sourceId: 'municipios', mapDataId: DATASET }];
      return s;
    })(),
    'M3 scaleMaxValue doubled': (() => {
      const s = clone();
      s.scaleMaxValue *= 2;
      return s;
    })(),
    'M4 one municipality dropped': withRows(clone(), (data) => data.slice(1)),
    'M5 one value off by one': withRows(clone(), (data) => data.map((r, i) => (i === 0 ? { ...r, value: r.value + 1 } : r))),
  };
};

const main = () => {
  const [first, second] = process.argv.slice(2);
  const selfTest = first === '--self-test' || second === '--self-test';
  const specPath = selfTest && first === '--self-test' ? second : first;
  const target = specPath ?? (selfTest ? GOLDEN_PESSOAS : undefined);
  if (!target) {
    console.error('usage: gate_pessoas_total.mjs <spec.json> | --self-test [golden.json]');
    process.exit(2);
  }
  const spec = JSON.parse(readFileSync(resolve(target), 'utf8'));
  const totals = recomputeTotals();

  if (selfTest) {
    const golden = gate(spec, totals);
    const results = Object.entries(mutants(spec)).map(([name, mutant]) => {
      const verdict = gate(mutant, totals);
      return { name, caught: !verdict.pass, firstFailure: verdict.failures[0] ?? null };
    });
    const ok = golden.pass && results.every((r) => r.caught);
    console.log(JSON.stringify({ goldenPass: golden.pass, goldenFailures: golden.failures, mutants: results, pass: ok }, null, 2));
    process.exit(ok ? 0 : 1);
  }

  const verdict = gate(spec, totals);
  console.log(JSON.stringify({ ...verdict, oracle: { municipios: totals.size, sum: [...totals.values()].reduce((a, b) => a + b, 0) } }, null, 2));
  process.exit(verdict.pass ? 0 : 1);
};

main();

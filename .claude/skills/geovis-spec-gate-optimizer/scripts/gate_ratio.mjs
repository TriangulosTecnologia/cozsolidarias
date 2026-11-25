/**
 * Gate for the ratio eval cases (CadinSan, CadÚnico, PAA): checks a served spec
 * against the case's `expect.rate` and `expect.bands`.
 *
 *   1. Dataset: the first `mapData` entry is `expect.dataset`.
 *   2. Rate oracle: every município's served value equals the oracle's
 *      `numerator / denominator * per`, within `expect.rate.tolerance`; no
 *      município is missing or extra.
 *   3. Bands: when `expect.bands` is set, municípios and numerator totals per
 *      band (the served values banded by `thresholds`) equal `familiesPerBand`.
 *
 * Oracles are recomputed from the static source, never read from the golden or
 * the gateway. CadinSan reads the CADINSAN CSV; CadÚnico re-places every
 * cozinha of the latest CSV in its município (point in polygon over the
 * `/geo/geojs-100-mun.json` boundaries, else the declared code) and divides by
 * `/geo/municipios-cadunico.json`. The PAA oracle lands with its family PR,
 * and until then the gate fails loudly.
 *
 * Usage, from the cozsolidarias repo root:
 *
 *   node .claude/skills/geovis-spec-gate-optimizer/scripts/gate_ratio.mjs --case=<id> <spec.json>
 *   node .claude/skills/geovis-spec-gate-optimizer/scripts/gate_ratio.mjs --case=<id> --self-test
 *
 * Exit code 1 when the gate fails. `--self-test` builds a spec from the oracle:
 * it must pass, and every mutant derived from it must fail.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVALS = resolve(HERE, '../evals/evals.json');
const CADINSAN_CSV = resolve(process.cwd(), 'src/data-source-static/data/CADINSAN_2025_dados_municipais.csv');

/** Column of each CADINSAN numerator field in the source CSV. */
const CADINSAN_NUMERATOR_COLUMN = { absolutoComPbf: 4, absolutoSemPbf: 5 };
const CADINSAN_DENOMINATOR_COLUMN = 6;

/** Splits one CSV line, honouring double-quoted fields. */
const parseLine = (line) => {
  return (line.match(/("[^"]*"|[^,]*)(,|$)/g) ?? []).map((s) => { return s.replace(/,$/, '').replace(/^"|"$/g, '') });
};

/** `[{ geometryId, numerator, denominator }]` recomputed from the CADINSAN CSV. */
const cadinsanOracle = (numeratorField) => {
  const column = CADINSAN_NUMERATOR_COLUMN[numeratorField];
  if (column === undefined) throw new Error(`unknown CADINSAN numerator field: ${numeratorField}`);
  const lines = readFileSync(CADINSAN_CSV, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const cols = parseLine(line);
    return { geometryId: cols[0], numerator: Number(cols[column]), denominator: Number(cols[CADINSAN_DENOMINATOR_COLUMN]) };
  });
};

const COZINHAS_CSV = resolve(process.cwd(), 'src/data-source-static/data/cozinhas_com_geolocalizacao_all.csv');
const MUNICIPIOS_GEOJSON = resolve(process.cwd(), 'public/geo/geojs-100-mun.json');
const CADUNICO_JSON = resolve(process.cwd(), 'public/geo/municipios-cadunico.json');

/** A quoted field starting after its opening quote: its text (`""` is a quote) and the index after the closing quote. */
const readQuoted = (text, start) => {
  let value = '';
  let i = start;
  for (; i < text.length; i += 1) {
    if (text[i] !== '"') { value += text[i]; continue }
    if (text[i + 1] !== '"') break;
    value += '"';
    i += 1;
  }
  return { value, next: i + 1 };
};

/** Rows of a whole CSV text, honouring quoted fields with commas, quotes and newlines. */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    i += 1;
    if (char === '"') {
      const quoted = readQuoted(text, i);
      field += quoted.value;
      i = quoted.next;
    } else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows;
};

/** A coordinate cell as a number, or null when blank, `---` or not a number. */
const coordinate = (cell) => {
  const text = (cell ?? '').trim();
  const value = Number(text);
  return text === '' || text === '---' || Number.isNaN(value) ? null : value;
};

/** Even-odd ray cast of `[x, y]` against one ring. */
const inRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Each município polygon with its bbox, in file order (the first match wins). */
const indexMunicipios = () => {
  const { features } = JSON.parse(readFileSync(MUNICIPIOS_GEOJSON, 'utf8'));
  return features.flatMap((feature) => {
    const { geometry } = feature;
    const code = String(feature.properties?.codarea ?? '');
    if (!code || (geometry?.type !== 'Polygon' && geometry?.type !== 'MultiPolygon')) return [];
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const bbox = polygons.flat(2).reduce(([minX, minY, maxX, maxY], [x, y]) => {
      return [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    }, [Infinity, Infinity, -Infinity, -Infinity]);
    return [{ code, polygons, bbox }];
  });
};

/** The município a point falls in: inside an outer ring and no hole of one polygon. */
const placeOf = (index, point) => {
  const [x, y] = point;
  return index.find(({ bbox, polygons }) => {
    return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3] &&
      polygons.some(([outer, ...holes]) => { return inRing(point, outer) && !holes.some((hole) => { return inRing(point, hole) }) });
  })?.code;
};

/** Cozinhas per município: each one placed by its coordinates, else by its declared code when that código is a município. */
const cozinhasPorMunicipio = () => {
  const [header, ...rows] = parseCsv(readFileSync(COZINHAS_CSV, 'utf8').replace(/^\uFEFF/, ''));
  const col = (name) => { return header.indexOf(name) };
  const [declaredCol, latCol, lngCol] = [col('Código IBGE'), col('Latitude'), col('Longitude')];
  const index = indexMunicipios();
  const codes = new Set(index.map(({ code }) => { return code }));
  const counts = new Map();
  for (const cells of rows) {
    const [lat, lng] = [coordinate(cells[latCol]), coordinate(cells[lngCol])];
    if (lat === null || lng === null) continue;
    const declared = (cells[declaredCol] ?? '').trim();
    const code = placeOf(index, [lng, lat]) ?? (codes.has(declared) ? declared : undefined);
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
};

/** `[{ geometryId, numerator, denominator }]` per município with a cozinha, from the counts and the CadÚnico people. */
const cadunicoOracle = (expect) => {
  const pessoas = JSON.parse(readFileSync(CADUNICO_JSON, 'utf8'));
  const fieldOf = { quantidade: (q) => { return q }, pessoasCadUnico: (_, code) => { return pessoas[code] ?? null } };
  const [numerator, denominator] = [fieldOf[expect.numerator.field], fieldOf[expect.denominator.field]];
  if (!numerator || !denominator) throw new Error(`unknown CadÚnico field: ${expect.numerator.field} / ${expect.denominator.field}`);
  return [...cozinhasPorMunicipio()].map(([code, quantidade]) => {
    return { geometryId: code, numerator: numerator(quantidade, code), denominator: denominator(quantidade, code) };
  });
};

/** The oracle rows for a case, or a loud error when its source has no oracle yet. */
const oracleFor = async (expect) => {
  if (expect.rate?.source === 'gateway.getCadinsanPorMunicipio') return cadinsanOracle(expect.numerator.field);
  if (expect.rate?.source === 'gateway.getCozinhasPorMunicipio') return cadunicoOracle(expect);
  throw new Error(`no oracle for ${expect.rate?.source}: it lands with the family PR`);
};

/**
 * The rate the gateway serves: `numerator / denominator * per` (`per` 1 when
 * absent), two decimals or a whole number (`rounding: 'whole person'`); null
 * without a numerator or a positive denominator.
 */
const rateOf = ({ numerator, denominator }, rate) => {
  if (numerator === null || !(denominator > 0)) return null;
  const value = (numerator / denominator) * (rate.per ?? 1);
  return rate.rounding === 'whole person' ? Math.round(value) : Math.round(value * 100) / 100;
};

/** Index of the band a value falls in: `value >= threshold`, so 0 is a real cutpoint. */
const bandIndex = (value, thresholds) => {
  return thresholds.filter((threshold) => { return value >= threshold }).length - 1;
};

/** Per-município equality with the oracle rate. */
const checkRates = ({ served, oracle, rate }) => {
  const failures = [];
  const expected = new Map(oracle.flatMap((row) => {
    const value = rateOf(row, rate);
    return value === null ? [] : [[row.geometryId, value]];
  }));
  for (const [code, value] of expected) {
    const got = served.get(code);
    if (got === undefined || Math.abs(got - value) > rate.tolerance) failures.push(`R1: ${code} served=${got} oracle=${value}`);
  }
  for (const code of served.keys()) {
    if (!expected.has(code)) failures.push(`R2: ${code} served but not produced by the oracle`);
  }
  return failures;
};

/** Municípios and numerator totals per band, from the served values. */
const checkBands = ({ served, oracle, bands }) => {
  const failures = [];
  const counted = bands.familiesPerBand.map(() => { return { municipios: 0, familias: 0 } });
  for (const row of oracle) {
    const value = served.get(row.geometryId);
    if (value === undefined) continue;
    const band = counted[bandIndex(value, bands.thresholds)];
    if (!band) continue;
    band.municipios += 1;
    band.familias += row.numerator;
  }
  for (const [i, expected] of bands.familiesPerBand.entries()) {
    if (counted[i].municipios !== expected.municipios || counted[i].familias !== expected.familias) {
      failures.push(`B1: band "${expected.label}" got ${counted[i].municipios} municípios / ${counted[i].familias} familias, expected ${expected.municipios} / ${expected.familias}`);
    }
  }
  return failures;
};

/** Dataset, rate and band checks for one spec. */
const gate = ({ spec, expect, oracle }) => {
  const entry = (spec.mapData ?? [])[0];
  const failures = [];
  if (entry?.mapDataId !== expect.dataset) failures.push(`D1: mapDataId ${entry?.mapDataId} != ${expect.dataset}`);
  const served = new Map((entry?.data ?? []).map((row) => { return [String(row.geometryId), row.value] }));
  failures.push(...checkRates({ served, oracle, rate: expect.rate }));
  if (expect.bands) failures.push(...checkBands({ served, oracle, bands: expect.bands }));
  return { pass: failures.length === 0, failures };
};

/** A spec that serves exactly the oracle, the self-test's golden. */
const specFromOracle = ({ expect, oracle }) => {
  const data = oracle.flatMap((row) => {
    const value = rateOf(row, expect.rate);
    return value === null ? [] : [{ geometryId: row.geometryId, value }];
  });
  return { mapData: [{ mapDataId: expect.dataset, data }] };
};

/** Mutants of the oracle spec, each off by more than the case's tolerance. Each must make the gate fail. */
const mutants = ({ golden, tolerance }) => {
  const clone = () => { return JSON.parse(JSON.stringify(golden)) };
  const mutate = (fn) => {
    const spec = clone();
    spec.mapData[0].data = fn(spec.mapData[0].data);
    return spec;
  };
  const wrongDataset = clone();
  wrongDataset.mapData[0].mapDataId = 'municipios_ivs';
  return {
    'M1 wrong dataset': wrongDataset,
    'M2 one município dropped': mutate((data) => { return data.slice(1) }),
    'M3 one value off by more than the tolerance': mutate((data) => { return data.map((r, i) => { return i === 0 ? { ...r, value: r.value + tolerance + 1 } : r }) }),
    'M4 extra município': mutate((data) => { return [...data, { geometryId: '0000000', value: 1 }] }),
    'M5 values scaled (wrong base)': mutate((data) => { return data.map((r) => { return { ...r, value: r.value * 10 } }) }),
  };
};

/** Prints `value` as JSON and exits with 0 when `pass`, else 1. */
const finish = (value, pass) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  process.exit(pass ? 0 : 1);
};

const main = async () => {
  const args = process.argv.slice(2);
  const caseId = args.find((a) => { return a.startsWith('--case=') })?.slice('--case='.length);
  const selfTest = args.includes('--self-test');
  const specPath = args.find((a) => { return !a.startsWith('--') });
  const evalCase = JSON.parse(readFileSync(EVALS, 'utf8')).cases.find((c) => { return c.id === caseId });
  if (!evalCase?.expect?.rate || (!selfTest && !specPath)) {
    process.stderr.write('usage: gate_ratio.mjs --case=<id with expect.rate> (<spec.json> | --self-test)\n');
    process.exit(2);
  }
  const { expect } = evalCase;
  const oracle = await oracleFor(expect);

  if (selfTest) {
    const golden = specFromOracle({ expect, oracle });
    const base = gate({ spec: golden, expect, oracle });
    const results = Object.entries(mutants({ golden, tolerance: expect.rate.tolerance })).map(([name, mutant]) => {
      const verdict = gate({ spec: mutant, expect, oracle });
      return { name, caught: !verdict.pass, firstFailure: verdict.failures[0] ?? null };
    });
    const ok = base.pass && results.every((r) => { return r.caught });
    finish({ goldenPass: base.pass, goldenFailures: base.failures.slice(0, 3), mutants: results, pass: ok }, ok);
  }

  const verdict = gate({ spec: JSON.parse(readFileSync(resolve(specPath), 'utf8')), expect, oracle });
  finish({ ...verdict, failures: verdict.failures.slice(0, 20) }, verdict.pass);
};

await main();

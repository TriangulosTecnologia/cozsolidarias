/* eslint-disable no-console, no-undef */
/**
 * Probes which agent-prompt invariants `@ttoss/geovis`'s own `validateSpec`
 * still rejects. Re-run on every geovis bump: a rule that is `coberta-lib` in
 * `references/determinism-map.md` can silently become `não-coberta` in an
 * upgrade, and nothing in the repo would notice.
 *
 *   node scripts/probe_validate_spec.mjs [repoRoot]
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.argv[2] ?? process.cwd();
const { validateSpec } = await import(
  pathToFileURL(join(REPO, 'node_modules/@ttoss/geovis/dist/index.mjs')).href
);

const base = (over) => { return {
  engine: 'maplibre',
  sources: [{ id: 'mun', type: 'geojson', data: '/geo/geojs-100-mun.json' }],
  layers: [{ id: 'fill', sourceId: 'mun', geometry: 'polygon' }],
  ...over,
} };

const CASES = {
  'R-dup-dimension': base({
    mapData: [
      { mapDataId: 'a', mapId: 'mun', dimension: 'color', stateKey: 'value', data: [{ geometryId: '1', value: 1 }] },
      { mapDataId: 'b', mapId: 'mun', dimension: 'color', stateKey: 'value', data: [{ geometryId: '1', value: 2 }] },
    ],
  }),
  'R-sqrt-continuous': base({
    layers: [{ id: 'c', sourceId: 'mun', geometry: 'point', sizeBy: { range: [2, 20], mode: 'stepped', transform: 'sqrt', thresholds: [1, 2] } }],
  }),
  'R-dangling-refs/source': base({ layers: [{ id: 'fill', sourceId: 'NOPE', geometry: 'polygon' }] }),
  'R-dangling-refs/mapData': base({ layers: [{ id: 'fill', sourceId: 'mun', geometry: 'polygon', mapDataId: 'NOPE' }] }),
  'R-threshold-order': base({
    legends: [{ id: 'l', colorBy: { type: 'quantitative', property: 'value', scale: 'threshold', thresholds: [10, 5, 1] } }],
  }),
  'R-sizeby-range': base({ layers: [{ id: 'c', sourceId: 'mun', geometry: 'point', sizeBy: { range: [20, 2] } }] }),
  'R-no-extra-props': base({ campoInventado: 123 }),
  'R-double-legend': {
    engine: 'maplibre',
    mapType: 'proportionalCircles',
    sources: [{ id: 'pts', type: 'geojson', data: '/api/cozinhas' }],
    layers: [{ id: 'c', sourceId: 'pts', geometry: 'point', mapDataId: 'q' }],
    mapData: [{ mapDataId: 'q', mapId: 'pts', dimension: 'size', data: [{ geometryId: '1', value: 5 }] }],
    legends: [{ id: 'mao', title: 'Quantidade', colorBy: { type: 'quantitative', property: 'value', scale: 'threshold', thresholds: [1, 5] } }],
  },
  'CONTROLE (deve passar)': base({}),
};

let gaps = 0;
for (const [id, spec] of Object.entries(CASES)) {
  let out;
  try {
    out = validateSpec(spec);
  } catch (error) {
    out = { status: 'THREW', issues: [{ code: String(error.message).slice(0, 60) }] };
  }
  const issues = Array.isArray(out?.issues) ? out.issues : [];
  const rejects = out?.status !== 'resolved';
  const control = id.startsWith('CONTROLE');
  if (!rejects && !control) gaps += 1;
  console.log(
    `${rejects ? 'REJEITA' : 'ACEITA '} | ${id.padEnd(26)} | status=${out?.status}` +
      (issues.length ? ` | ${issues[0].code}` : '')
  );
}
console.log(`\nlacunas (regra que a lib não rejeita mais): ${gaps}`);

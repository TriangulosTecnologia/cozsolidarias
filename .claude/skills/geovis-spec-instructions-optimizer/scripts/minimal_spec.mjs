#!/usr/bin/env node
// Eixo (e): spec mínima e equivalência de render contra um golden do /mapas.
//
// Uso:
//   minimal_spec.mjs derive <golden.json> [--drop-flat-fill]   # spec mínima derivada do golden
//   minimal_spec.mjs score <golden.json> <output.json> [--drop-flat-fill]
//
// `output.json` é o arquivo gravado por run_eval_case.sh (usa `.response.spec`).
// Mínima = só layers visíveis + as sources/mapData/legends que elas referenciam.
// `--drop-flat-fill`: nos modos `pontos`/`circulos` o fill municipal é fundo liso, não variável.

import { readFileSync } from 'node:fs';

const INJECTED_SOURCES = { 'municipios-boundary': '/geo/geojs-100-mun.json' };
const STRUCTURAL_KEYS = new Set(['engine', 'schemaVersion', 'mapType', 'sources', 'layers', 'mapData', 'legends']);

const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const legendsOf = (spec) => [
  ...arr(spec.legends),
  ...arr(spec.layers).flatMap((l) => arr(l.legends)),
];

const sourceUrl = (spec, sourceId) => {
  const src = arr(spec.sources).find((s) => s.id === sourceId);
  if (src) return typeof src.data === 'string' ? src.data : `inline:${src.type}`;
  return INJECTED_SOURCES[sourceId] ?? `?${sourceId}`;
};

const derive = (golden, { dropFlatFill }) => {
  const layers = arr(golden.layers).filter(
    (l) => l.visible !== false && !(dropFlatFill && l.id === 'municipios-br-fill')
  );
  const sourceIds = new Set(layers.map((l) => l.sourceId));
  const mapDataIds = new Set(layers.map((l) => l.mapDataId).filter(Boolean));
  const legendIds = new Set(layers.map((l) => l.activeLegendId).filter(Boolean));
  const legends = legendsOf(golden).filter((l) => legendIds.has(l.id));
  return {
    engine: golden.engine,
    sources: arr(golden.sources).filter((s) => sourceIds.has(s.id)),
    ...(mapDataIds.size ? { mapData: arr(golden.mapData).filter((m) => mapDataIds.has(m.mapDataId)) } : {}),
    ...(legends.length ? { legends } : {}),
    layers,
  };
};

const legendSig = (legend) => {
  if (!legend) return 'none';
  const c = legend.colorBy ?? {};
  const n = Array.isArray(c.thresholds) ? c.thresholds.length : Array.isArray(c.colors) ? c.colors.length : c.mapping ? Object.keys(c.mapping).length : 0;
  return `${c.type ?? '?'}/${n}`;
};

/** Um vínculo renderizado: geometria × URL × forma × assinatura da legenda. */
const bindings = (spec) => {
  const legends = legendsOf(spec);
  return arr(spec.layers)
    .filter((l) => l.visible !== false)
    .map((l) => {
      const form = l.sizeBy ? `${l.geometry}+sizeBy` : l.geometry;
      const legend = legends.find((x) => x.id === l.activeLegendId);
      return `${form} @ ${sourceUrl(spec, l.sourceId)} | legend=${legendSig(legend)}`;
    })
    .sort();
};

const orphans = (spec) => {
  const layers = arr(spec.layers);
  const usedSources = new Set(layers.map((l) => l.sourceId));
  const usedMapData = new Set(layers.map((l) => l.mapDataId).filter(Boolean));
  const usedLegends = new Set(layers.map((l) => l.activeLegendId).filter(Boolean));
  return {
    sources: arr(spec.sources).filter((s) => !usedSources.has(s.id)).map((s) => s.id),
    mapData: arr(spec.mapData).filter((m) => !usedMapData.has(m.mapDataId)).map((m) => m.mapDataId),
    legends: legendsOf(spec).filter((l) => !usedLegends.has(l.id)).map((l) => l.id),
    hiddenLayers: layers.filter((l) => l.visible === false).map((l) => l.id),
  };
};

const multisetDiff = (a, b) => {
  const rest = [...b];
  return a.filter((x) => {
    const i = rest.indexOf(x);
    if (i === -1) return true;
    rest.splice(i, 1);
    return false;
  });
};

const score = (golden, output, opts) => {
  const candidate = output?.response?.spec;
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, reason: 'no-spec', httpStatus: output?.httpStatus ?? null, error: output?.response?.message ?? null };
  }
  const minimal = derive(golden, opts);
  const expected = bindings(minimal);
  const got = bindings(candidate);
  const missing = multisetDiff(expected, got);
  const extra = multisetDiff(got, expected);
  const orphan = orphans(candidate);
  const extraKeys = Object.keys(candidate).filter((k) => !STRUCTURAL_KEYS.has(k));
  const orphanCount = Object.values(orphan).reduce((n, list) => n + list.length, 0);
  return {
    ok: true,
    renderEquivalent: missing.length === 0 && extra.length === 0,
    minimal: orphanCount === 0,
    bindingRecall: expected.length ? (expected.length - missing.length) / expected.length : 1,
    expected,
    got,
    missing,
    extra,
    orphans: orphan,
    presentationKeys: extraKeys,
  };
};

const [cmd, a, b] = process.argv.slice(2);
const opts = { dropFlatFill: process.argv.includes('--drop-flat-fill') };
if (cmd === 'derive') {
  console.log(JSON.stringify(derive(read(a), opts), null, 2));
} else if (cmd === 'score') {
  console.log(JSON.stringify(score(read(a), read(b), opts), null, 2));
} else {
  console.error('uso: minimal_spec.mjs <derive|score> <golden.json> [output.json] [--drop-flat-fill]');
  process.exit(1);
}

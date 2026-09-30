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
import process from 'node:process';

const print = (line) => { process.stdout.write(`${line}\n`) };

const INJECTED_SOURCES = { 'municipios-boundary': '/geo/geojs-100-mun.json' };
const STRUCTURAL_KEYS = new Set(['engine', 'schemaVersion', 'mapType', 'sources', 'layers', 'mapData', 'legends']);

const arr = (v) => { return Array.isArray(v) ? v.filter((x) => { return x && typeof x === 'object' }) : [] };
const read = (p) => { return JSON.parse(readFileSync(p, 'utf8')) };

const legendsOf = (spec) => { return [
  ...arr(spec.legends),
  ...arr(spec.layers).flatMap((l) => { return arr(l.legends) }),
] };

const sourceUrl = (spec, sourceId) => {
  const src = arr(spec.sources).find((s) => { return s.id === sourceId });
  if (src) return typeof src.data === 'string' ? src.data : `inline:${src.type}`;
  return INJECTED_SOURCES[sourceId] ?? `?${sourceId}`;
};

const derive = (golden, { dropFlatFill }) => {
  const layers = arr(golden.layers).filter(
    (l) => { return l.visible !== false && !(dropFlatFill && l.id === 'municipios-br-fill') }
  );
  const sourceIds = new Set(layers.map((l) => { return l.sourceId }));
  const mapDataIds = new Set(layers.map((l) => { return l.mapDataId }).filter(Boolean));
  const legendIds = new Set(layers.map((l) => { return l.activeLegendId }).filter(Boolean));
  const legends = legendsOf(golden).filter((l) => { return legendIds.has(l.id) });
  return {
    engine: golden.engine,
    sources: arr(golden.sources).filter((s) => { return sourceIds.has(s.id) }),
    ...(mapDataIds.size ? { mapData: arr(golden.mapData).filter((m) => { return mapDataIds.has(m.mapDataId) }) } : {}),
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
    .filter((l) => { return l.visible !== false })
    .map((l) => {
      const form = l.sizeBy ? `${l.geometry}+sizeBy` : l.geometry;
      const legend = legends.find((x) => { return x.id === l.activeLegendId });
      return `${form} @ ${sourceUrl(spec, l.sourceId)} | legend=${legendSig(legend)}`;
    })
    .sort();
};

const orphans = (spec) => {
  const layers = arr(spec.layers);
  const usedSources = new Set(layers.map((l) => { return l.sourceId }));
  const usedMapData = new Set(layers.map((l) => { return l.mapDataId }).filter(Boolean));
  const usedLegends = new Set(layers.map((l) => { return l.activeLegendId }).filter(Boolean));
  return {
    sources: arr(spec.sources).filter((s) => { return !usedSources.has(s.id) }).map((s) => { return s.id }),
    mapData: arr(spec.mapData).filter((m) => { return !usedMapData.has(m.mapDataId) }).map((m) => { return m.mapDataId }),
    legends: legendsOf(spec).filter((l) => { return !usedLegends.has(l.id) }).map((l) => { return l.id }),
    hiddenLayers: layers.filter((l) => { return l.visible === false }).map((l) => { return l.id }),
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

const noSpecResult = (output) => {
  return { ok: false, reason: 'no-spec', httpStatus: output?.httpStatus ?? null, error: output?.response?.message ?? null };
};

const score = (golden, output, opts) => {
  const candidate = output?.response?.spec;
  if (!candidate || typeof candidate !== 'object') return noSpecResult(output);
  const minimal = derive(golden, opts);
  const expected = bindings(minimal);
  const got = bindings(candidate);
  const missing = multisetDiff(expected, got);
  const extra = multisetDiff(got, expected);
  const orphan = orphans(candidate);
  const extraKeys = Object.keys(candidate).filter((k) => { return !STRUCTURAL_KEYS.has(k) });
  const orphanCount = Object.values(orphan).reduce((n, list) => { return n + list.length }, 0);
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
  print(JSON.stringify(derive(read(a), opts), null, 2));
} else if (cmd === 'score') {
  print(JSON.stringify(score(read(a), read(b), opts), null, 2));
} else {
  process.stderr.write('uso: minimal_spec.mjs <derive|score> <golden.json> [output.json] [--drop-flat-fill]\n');
  process.exit(1);
}

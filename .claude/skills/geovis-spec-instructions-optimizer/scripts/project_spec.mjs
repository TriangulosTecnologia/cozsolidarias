#!/usr/bin/env node
// Reduz um VisualizationSpec ao seu núcleo semântico — o que decide "é o mesmo mapa?" —
// descartando o que é boilerplate compartilhado (view, basemap, control, legendas inativas).
//
// Uso:
//   project_spec.mjs invariant <dir-de-specs>          # invariante + delta de cada spec
//   project_spec.mjs project <spec.json>               # projeção de um spec
//   project_spec.mjs compare <golden.json> <cand.json> # score do candidato contra o golden

import { readdirSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const print = (line) => { process.stdout.write(`${line}\n`) };

const asRecord = (v) => { return v && typeof v === 'object' && !Array.isArray(v) ? v : null };

/** URL da source, ou "inline" — o que identifica a geometria, não o id escolhido pelo autor. */
const sourceKey = (source) => {
  if (typeof source.data === 'string') return source.data;
  if (Array.isArray(source.tiles)) return source.tiles[0];
  return `inline:${source.type}`;
};

/**
 * O núcleo comparável: cada vínculo "geometria × dataset × forma cartográfica × escala".
 * É o que sobrevive à diferença entre um spec escrito à mão (layers explícitas) e um spec
 * gerado pelo agente (atalho `mapType`) — por isso a comparação nunca é um diff de JSON cru.
 */
const records = (v) => { return Array.isArray(v) ? v.filter(asRecord) : [] };

const findLegend = ({ layer, specLegends }) => {
  const hit = [layer.legends, specLegends]
    .flatMap(records)
    .find((l) => { return l.id === layer.activeLegendId });
  return hit ?? null;
};

const legendFields = (legend) => {
  return {
    legendScale: legend?.colorBy?.type ?? null,
    thresholds: legend?.colorBy?.thresholds ?? null,
  };
};

const rowCount = (entry) => { return Array.isArray(entry?.data) ? entry.data.length : null };

const bindingOf = ({ layer, byId, mdById, specLegends }) => {
  const source = byId.get(layer.sourceId);
  return {
    geometry: source ? sourceKey(source) : `?${layer.sourceId}`,
    dataset: layer.mapDataId ?? `prop:${layer.propertyName}`,
    form: layer.sizeBy ? `${layer.geometry}+sizeBy` : layer.geometry,
    ...legendFields(findLegend({ layer, specLegends })),
    values: rowCount(mdById.get(layer.mapDataId)),
  };
};

const projectSpec = (spec) => {
  const sources = records(spec.sources);
  const specLegends = records(spec.legends);

  const byId = new Map(sources.map((s) => { return [s.id, s] }));
  const mdById = new Map(records(spec.mapData).map((m) => { return [m.mapDataId, m] }));

  const bindings = records(spec.layers)
    .filter((layer) => { return layer.mapDataId || layer.propertyName })
    .map((layer) => { return bindingOf({ layer, byId, mdById, specLegends }) });

  return {
    mapType: spec.mapType ?? null,
    geometries: [...new Set(sources.map(sourceKey))].sort(),
    bindings: bindings.sort((a, b) => { return `${a.dataset}`.localeCompare(`${b.dataset}`) }),
    legendCount: specLegends.length,
  };
};

const stable = (v) => { return JSON.stringify(v) };

const printDelta = ({ file, delta, dup }) => {
  if (dup) {
    print(`  ${file}\n    === idêntico a ${dup} (clone de template, não é um mapa distinto)`);
  } else if (delta.length === 0) {
    print(`  ${file}\n    (sem delta — só template)`);
  } else {
    print(`  ${file}`);
    for (const b of delta) {
      print(`    ${b.dataset} @ ${b.geometry} [${b.form}] legenda=${b.legendScale ?? '-'} n=${b.values ?? '-'}`);
    }
  }
};

const runInvariant = (dir) => {
  // `manifest.json` is the corpus's provenance record, not a spec — projecting
  // it would report a phantom map and poison the invariant (an invariant must
  // hold across every spec, and it holds across none of them once a non-spec
  // is in the set).
  const files = readdirSync(dir)
    .filter((f) => { return f.endsWith('.json') && f !== 'manifest.json' })
    .sort();
  const projections = files.map((f) => { return [f, projectSpec(JSON.parse(readFileSync(join(dir, f), 'utf8')))] });

  // Um binding é invariante quando aparece, idêntico, em TODOS os specs — é template,
  // não conteúdo. O que o prompt precisa dizer é exatamente o complemento disso.
  const counts = new Map();
  for (const [, p] of projections) {
    for (const b of p.bindings) {
      const k = stable(b);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const invariant = [...counts.entries()]
    .filter(([, n]) => { return n === projections.length })
    .map(([k]) => { return JSON.parse(k) });

  print(`# ${projections.length} specs\n`);
  print(`## Invariante (presente nos ${projections.length}, = template)\n`);
  for (const b of invariant) print(`  ${b.dataset} @ ${b.geometry} [${b.form}] ${b.legendScale ?? '-'}`);

  print(`\n## Delta por spec (= o que o prompt precisa transmitir)\n`);
  const seen = new Map();
  for (const [file, p] of projections) {
    const delta = p.bindings.filter((b) => { return (counts.get(stable(b)) ?? 0) < projections.length });
    const dup = seen.get(stable(delta));
    if (!dup) seen.set(stable(delta), file);
    printDelta({ file, delta, dup });
  }
  print(`\n## ${seen.size} mapas semanticamente distintos de ${projections.length} arquivos`);
};

/** Score do candidato contra o golden, eixo a eixo — nunca um diff de JSON cru. */
const runCompare = (goldenFile, candidateFile) => {
  const golden = projectSpec(JSON.parse(readFileSync(goldenFile, 'utf8')));
  const candidate = projectSpec(JSON.parse(readFileSync(candidateFile, 'utf8')));

  const goldenSet = new Set(golden.bindings.map((b) => { return `${b.dataset}@${b.geometry}` }));
  const candSet = new Set(candidate.bindings.map((b) => { return `${b.dataset}@${b.geometry}` }));

  const axes = {
    dataset: [...candSet].filter((k) => { return goldenSet.has(k) }).length / Math.max(goldenSet.size, 1),
    geometry:
      candidate.geometries.filter((g) => { return golden.geometries.includes(g) }).length /
      Math.max(golden.geometries.length, 1),
    form:
      candidate.bindings.filter((c) => { return golden.bindings.some((g) => { return g.dataset === c.dataset && g.form === c.form }) }).length /
      Math.max(golden.bindings.length, 1),
    legendScale:
      candidate.bindings.filter((c) => { return golden.bindings.some((g) => { return g.dataset === c.dataset && g.legendScale === c.legendScale }) }
      ).length / Math.max(golden.bindings.length, 1),
  };

  print(JSON.stringify({ golden: goldenFile, candidate: candidateFile, axes, goldenBindings: golden.bindings, candidateBindings: candidate.bindings }, null, 2));
};

const [, , action, a, b] = process.argv;
if (action === 'invariant' && a) runInvariant(a);
else if (action === 'project' && a) print(JSON.stringify(projectSpec(JSON.parse(readFileSync(a, 'utf8'))), null, 2));
else if (action === 'compare' && a && b) runCompare(a, b);
else {
  process.stderr.write('uso: project_spec.mjs <invariant <dir> | project <spec.json> | compare <golden> <cand>>\n');
  process.exit(1);
}

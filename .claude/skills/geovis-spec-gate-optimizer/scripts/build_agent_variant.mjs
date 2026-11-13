/**
 * Generates a pruned variant of the `system:` block of `~/geovis-spec-generator.md`
 * by applying named cuts, so the diff is auditable instead of retyped.
 *
 *   node scripts/build_agent_variant.mjs tier1 > variants/agente-tier1.md
 *
 * Available cuts: see CUTS. Each one carries the reason it is safe —
 * the full rationale, with tiers and tensions, is in
 * `variants/justificativa.md`.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const warn = (line) => { process.stderr.write(`${line}\n`) };

const SOURCE = join(homedir(), 'geovis-spec-generator.md');
const variant = process.argv[2] ?? 'tier1';

const raw = readFileSync(SOURCE, 'utf8');
const block = raw.split('\nsystem: |\n')[1]?.split('\nmcp_servers:')[0];
if (!block) throw new Error('`system:` block not found in ' + SOURCE);

// The YAML block comes indented by 2 spaces; the live agent stores the text without
// them. Sending the indented version would make the variant differ from the control by
// indentation as well as pruning — it would measure both things at once.
const system = block
  .split('\n')
  .map((line) => { return line.startsWith('  ') ? line.slice(2) : line })
  .join('\n')
  .replace(/\n+$/, '');

/** Rewrites the `sizeBy` block, whose text is broken mid-word. */
const fixSizeBy = (text) => {
  const start = text.indexOf('  sizeBy: object');
  if (start === -1) return { text, applied: false };
  const end = text.indexOf('  propertyName: string', start);
  if (end === -1) return { text, applied: false };
  const fixed = `  sizeBy: object
    range (required): array<number> minItems=2 maxItems=2 — Min and max symbol sizes. min > 0 and min < max.
      mode: enum ['continuous', 'stepped'] — Interpolation mode. Continuous varies smoothly; stepped jumps between thresholds.
      thresholds: array<number> — Ascending breakpoints for stepped mode or threshold-based sizing.
      transform: enum ['linear', 'sqrt'] — Value mapping: linear (radius) or sqrt (area proportional). sqrt only valid with mode='continuous'.
`;
  return { text: text.slice(0, start) + fixed + text.slice(end), applied: true };
};

/** Removes a span delimited by markers, end-exclusive. */
const cutBetween = (text, from, to) => {
  const a = text.indexOf(from);
  if (a === -1) return { text, applied: false };
  // End of text counts as a delimiter: the span to cut may be the last one
  // in the prompt, in which case there is no `to` after it.
  const b = text.indexOf(to, a + 1);
  const end = b === -1 ? text.length : b;
  return { text: text.slice(0, a) + text.slice(end), applied: true };
};

const CUTS = {
  'fix-sizeby': {
    always: true,
    reason: 'Corrupted text (line breaks mid-word) in a field that governs R-sqrt-continuous and R-sizeby-range. A fix, not a prune.',
    apply: fixSizeBy,
  },
  'geojson-defs': {
    tiers: ['tier1', 'tier12'],
    reason: 'The agent never emits inline geometry: INSTRUCTIONS forbids it, and findGeometryInMapData and findInvalidGeojsonSource reject it. Documenting how to write a Polygon only enables what the route refuses.',
    apply: (t) => { return cutBetween(t, '## Position\n', 'Resolution instructions for the agent:') },
  },
  'source-type-enum': {
    tiers: ['tier1', 'tier12'],
    reason: 'findUnsupportedSourceType rejects every type != geojson. Listing the five teaches five ways to get a 422.',
    apply: (t) => {
      const before = 'sources (required): array<oneOf [geojson, vector-tiles, raster-tiles, image, raster-dem, video]>';
      const after = 'sources (required): array<geojson> — esta rota aceita apenas sources geojson; qualquer outro tipo é rejeitado antes de renderizar.';
      return t.includes(before)
        ? { text: t.replace(before, after), applied: true }
        : { text: t, applied: false };
    },
  },
  'everything-else': {
    tiers: ['tier12'],
    reason: 'Enumerates the deterministic mesh and admits its own uselessness ("restating them to yourself does not"). Tier 2: it is the only warning that the mesh exists.',
    apply: (t) => { return cutBetween(t, 'Everything else the consumer already rejects by name before rendering:', '\n') },
  },
};

let text = system;
const log = [];
for (const [name, cut] of Object.entries(CUTS)) {
  if (!cut.always && !cut.tiers?.includes(variant)) continue;
  const before = text.length;
  const out = cut.apply(text);
  text = out.text;
  log.push({
    name,
    applied: out.applied,
    saved: before - text.length,
    reason: cut.reason,
  });
}

const tk = (s) => { return Math.round(s.length / 4) };
warn(`variant: ${variant}`);
warn(`  original: ~${tk(system)} tokens`);
warn(`  pruned:   ~${tk(text)} tokens  (−${tk(system) - tk(text)})`);
for (const l of log) {
  warn(`  ${l.applied ? '✓' : '✗ NOT APPLIED'} ${l.name} (−${Math.round(l.saved / 4)} tokens)`);
  if (!l.applied) warn(`      marker not found — the prompt changed, review the cut`);
}

process.stdout.write(text);

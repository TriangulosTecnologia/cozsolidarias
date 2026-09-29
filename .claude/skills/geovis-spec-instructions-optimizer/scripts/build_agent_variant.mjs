/* eslint-disable no-console, no-undef */
/**
 * Gera uma variante podada do bloco `system:` de `~/geovis-spec-generator.md`
 * aplicando cortes nomeados, para o diff ser auditável em vez de redigitado.
 *
 *   node scripts/build_agent_variant.mjs tier1 > variants/agente-tier1.md
 *
 * Cortes disponíveis: ver CUTS. Cada um carrega a razão pela qual é seguro —
 * a justificativa completa, com tiers e tensões, está em
 * `variants/justificativa.md`.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SOURCE = join(homedir(), 'geovis-spec-generator.md');
const variant = process.argv[2] ?? 'tier1';

const raw = readFileSync(SOURCE, 'utf8');
const block = raw.split('\nsystem: |\n')[1]?.split('\nmcp_servers:')[0];
if (!block) throw new Error('bloco `system:` não encontrado em ' + SOURCE);

// O bloco YAML vem indentado com 2 espaços; o agente vivo guarda o texto sem
// eles. Enviar a versão indentada faria a variante diferir do controle por
// indentação além da poda — mediria as duas coisas juntas.
const system = block
  .split('\n')
  .map((line) => { return line.startsWith('  ') ? line.slice(2) : line })
  .join('\n')
  .replace(/\n+$/, '');

/** Reescreve o bloco `sizeBy`, cujo texto está quebrado no meio das palavras. */
const fixSizeBy = text => {
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

/** Remove um trecho delimitado por marcadores, exclusivo no fim. */
const cutBetween = (text, from, to) => {
  const a = text.indexOf(from);
  if (a === -1) return { text, applied: false };
  const b = text.indexOf(to, a + 1);
  const end = b === -1 ? text.length : b;
  return { text: text.slice(0, a) + text.slice(end), applied: true };
};

const CUTS = {
  'fix-sizeby': {
    always: true,
    reason: 'Texto corrompido (quebras no meio das palavras) num campo que governa R-sqrt-continuous e R-sizeby-range. Correção, não poda.',
    apply: fixSizeBy,
  },
  'geojson-defs': {
    tiers: ['tier1', 'tier12'],
    reason: 'O agente nunca emite geometria inline: INSTRUCTIONS proíbe, findGeometryInMapData e findInvalidGeojsonSource rejeitam. Documentar como escrever um Polygon habilita só o que a rota recusa.',
    apply: (t) => { return cutBetween(t, '## Position\n', 'Resolution instructions for the agent:') },
  },
  'source-type-enum': {
    tiers: ['tier1', 'tier12'],
    reason: 'findUnsupportedSourceType rejeita todo tipo != geojson. Listar os cinco é ensinar cinco formas de tomar 422.',
    apply: t => {
      const before = 'sources (required): array<oneOf [geojson, vector-tiles, raster-tiles, image, raster-dem, video]>';
      const after = 'sources (required): array<geojson> — esta rota aceita apenas sources geojson; qualquer outro tipo é rejeitado antes de renderizar.';
      return t.includes(before)
        ? { text: t.replace(before, after), applied: true }
        : { text: t, applied: false };
    },
  },
  'everything-else': {
    tiers: ['tier12'],
    reason: 'Enumera a malha determinística e admite a própria inutilidade ("restating them to yourself does not"). Tier 2: é o único aviso de que a malha existe.',
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
console.error(`variante: ${variant}`);
console.error(`  original: ${tk(system)} tokens aprox.`);
console.error(`  podado:   ${tk(text)} tokens aprox.  (−${tk(system) - tk(text)})`);
for (const l of log) {
  console.error(`  ${l.applied ? '✓' : '✗ NÃO APLICOU'} ${l.name} (−${Math.round(l.saved / 4)} tokens)`);
  if (!l.applied) console.error(`      marcador não encontrado — o prompt mudou, revise o corte`);
}

process.stdout.write(text);

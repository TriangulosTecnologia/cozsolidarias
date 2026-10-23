import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS_DIR = join(ROOT, 'instructions');
const FORMATION_PATH = join(ROOT, 'formation.json');
const AGENT_ID = process.env.NATURALI_AGENT_ID;
const PROJECT_ID = process.env.NATURALI_PROJECT_ID;
const SECTION_SEPARATOR = '\n\n';
const ENV_PATH = join(ROOT, '..', '..', '.env');

/**
 * Reads `NATURALI_API_KEY` from the repository `.env`, which takes precedence
 * over any value already exported in the shell.
 * @returns {string}
 * @example
 * const key = readApiKey(); // "nat_..."
 */
const readApiKey = () => {
  const match = readFileSync(ENV_PATH, 'utf-8').match(
    /^NATURALI_API_KEY=(.+)$/m
  );
  if (!match) {
    throw new Error(`NATURALI_API_KEY is missing from ${ENV_PATH}`);
  }
  return match[1].trim();
};

/**
 * Concatenates the section files in `instructions/` (sorted by filename
 * prefix) into the single string the agent reads as its instructions.
 * @returns {string}
 * @example
 * const text = readInstructions(); // "Converte uma descrição...\n\n## O que é..."
 */
const readInstructions = () => {
  return readdirSync(SECTIONS_DIR)
    .filter((name) => {
      return name.endsWith('.md');
    })
    .sort()
    .map((name) => {
      return readFileSync(join(SECTIONS_DIR, name), 'utf-8').trim();
    })
    .join(SECTION_SEPARATOR);
};

const MAX_GROWTH = 1.5;

/**
 * Returns the `instructions` currently stored in `formation.json`, the
 * baseline the length limit is measured against.
 * @returns {string}
 * @example
 * const current = currentInstructions(); // "Convert a natural-language..."
 */
const currentInstructions = () => {
  const formation = JSON.parse(readFileSync(FORMATION_PATH, 'utf-8'));
  return formation.resources.geovis_spec_generator_loop.properties.instructions;
};

/**
 * Throws when the new text grows past 150% of the length currently in
 * `formation.json`, so an oversized prompt never reaches the live agent.
 * @param {string} text
 * @returns {void}
 * @example
 * assertWithinLimit('Convert a natural-language...');
 */
const assertWithinLimit = (text) => {
  const limit = Math.floor(currentInstructions().length * MAX_GROWTH);
  if (text.length > limit) {
    throw new Error(
      `instructions have ${text.length} chars, above the ${limit} limit (150% of the current formation.json)`
    );
  }
};

/**
 * Builds the `formation.json` text with only its `"instructions"` line
 * replaced, so the rest of the file keeps its formatting.
 * @param {string} text
 * @returns {string}
 * @example
 * const next = formationWithInstructions('Converte uma descrição...');
 */
const formationWithInstructions = (text) => {
  const source = readFileSync(FORMATION_PATH, 'utf-8');
  const lines = source.split('\n');
  const index = lines.findIndex((line) => {
    return /^\s*"instructions": /.test(line);
  });
  if (index === -1) {
    throw new Error('formation.json has no "instructions" line');
  }
  lines[index] = `        "instructions": ${JSON.stringify(text)},`;
  return lines.join('\n');
};

/**
 * Pushes the instructions to the live agent through the naturali CLI.
 * `patch-agent` only touches the fields it receives. Requires
 * NATURALI_PROJECT_ID in the environment.
 * @param {string} text
 * @returns {void}
 * @example
 * pushToAgent('Converte uma descrição...');
 */
const pushToAgent = (text) => {
  execFileSync(
    'naturali',
    [
      'patch-agent',
      '--project-id',
      PROJECT_ID,
      '--agent-id',
      AGENT_ID,
      '--instructions',
      text,
    ],
    {
      env: { ...process.env, NATURALI_API_KEY: readApiKey() },
      stdio: ['ignore', 'ignore', 'inherit'],
    }
  );
};

const apply = process.argv.includes('--apply');
const check = process.argv.includes('--check');
if (apply && !PROJECT_ID) {
  throw new Error('NATURALI_PROJECT_ID is required with --apply');
}
const text = readInstructions();
assertWithinLimit(text);
const nextFormation = formationWithInstructions(text);
const formationChanged =
  nextFormation !== readFileSync(FORMATION_PATH, 'utf-8');

if (check) {
  console.log(
    `${text.length} chars; formation.json changes: ${formationChanged}`
  );
  if (formationChanged) {
    process.exitCode = 1;
  }
} else {
  if (formationChanged) {
    writeFileSync(FORMATION_PATH, nextFormation);
  }
  console.log(
    `formation.json changed: ${formationChanged} (${text.length} chars)`
  );
  if (apply) {
    pushToAgent(text);
    console.log(`agent ${AGENT_ID} updated`);
  } else {
    console.log(`re-run with --apply to push to ${AGENT_ID}`);
  }
}

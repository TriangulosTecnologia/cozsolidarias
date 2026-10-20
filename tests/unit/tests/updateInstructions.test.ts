import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENT_DIR = resolve(__dirname, '../../../agents/geovis-spec-generator');

type ScriptRun = { status: number | null; output: string };

type ScriptParams = {
  currentInstructions?: string;
  args?: string[];
  projectId?: string | null;
};

/**
 * Runs `update-instructions.mjs` against a throwaway copy of the agent folder,
 * so the real `formation.json` is never read as the baseline or written.
 */
const runScript = (params: ScriptParams): ScriptRun => {
  const workdir = mkdtempSync(join(tmpdir(), 'update-instructions-'));
  try {
    const agentCopy = join(workdir, 'geovis-spec-generator');
    cpSync(AGENT_DIR, agentCopy, { recursive: true });

    const formationPath = join(agentCopy, 'formation.json');
    const formationLines = readFileSync(formationPath, 'utf-8').split('\n');
    const index = formationLines.findIndex((line) => {
      return /^\s*"instructions": /.test(line);
    });
    const sectionsText = readdirSync(join(agentCopy, 'instructions'))
      .filter((name) => {
        return name.endsWith('.md');
      })
      .sort()
      .map((name) => {
        return readFileSync(
          join(agentCopy, 'instructions', name),
          'utf-8'
        ).trim();
      })
      .join('\n\n');
    const currentText = params.currentInstructions ?? sectionsText;
    formationLines[index] =
      `        "instructions": ${JSON.stringify(currentText)},`;
    writeFileSync(formationPath, formationLines.join('\n'));

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (params.projectId === null) {
      delete env['NATURALI_PROJECT_ID'];
    } else {
      env['NATURALI_PROJECT_ID'] = params.projectId ?? 'proj_test';
    }

    const result = spawnSync(
      process.execPath,
      [
        join(agentCopy, 'scripts', 'update-instructions.mjs'),
        ...(params.args ?? []),
      ],
      { env, encoding: 'utf-8' }
    );
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
};

describe('update-instructions.mjs', () => {
  test('dry run succeeds when the new text is within 150% of the current instructions', () => {
    const run = runScript({ currentInstructions: 'x'.repeat(20_000) });

    expect(run.status).toBe(0);
    expect(run.output).toMatch(/dry run: \d+ chars/);
  });

  test('fails when the new text is above 150% of the current instructions', () => {
    const run = runScript({ currentInstructions: 'x'.repeat(100) });

    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/above the 150 limit/);
  });

  test('fails when NATURALI_PROJECT_ID is not set', () => {
    const run = runScript({
      currentInstructions: 'x'.repeat(20_000),
      projectId: null,
    });

    expect(run.status).not.toBe(0);
    expect(run.output).toMatch(/NATURALI_PROJECT_ID is required/);
  });

  test('--check fails when formation.json differs from the section files', () => {
    const run = runScript({
      currentInstructions: 'x'.repeat(20_000),
      args: ['--check'],
    });

    expect(run.status).toBe(1);
  });

  test('--check passes when formation.json already matches the section files', () => {
    const run = runScript({ args: ['--check'] });

    expect(run.status).toBe(0);
  });
});

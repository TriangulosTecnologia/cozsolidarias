import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(
  __dirname,
  '../../../.claude/skills/geovis-spec-gate-optimizer/scripts/score_case.mjs'
);
const REPO = resolve(__dirname, '../../..');

type Score = { outcome: string; passed: boolean };

const scoreServed = ({
  caseId,
  httpStatus,
  response,
}: {
  caseId: string;
  httpStatus: number;
  response: unknown;
}) => {
  const file = join(mkdtempSync(join(tmpdir(), 'score-case-')), 'case.json');
  writeFileSync(
    file,
    JSON.stringify({ prompt: 'p', httpStatus, durationMs: 1, response })
  );
  execFileSync('node', [SCRIPT, file, REPO, `--case=${caseId}`], {
    stdio: 'pipe',
  });
  return JSON.parse(
    readFileSync(file.replace(/\.json$/, '.score.json'), 'utf8')
  ) as Score;
};

const CLARIFY = { error: false, clarify: { facet: 'mapType' } };

describe('score_case.mjs', () => {
  test('a case that expects a clarify passes on a clarify answer', () => {
    expect(
      scoreServed({
        caseId: 'golden-coropletico',
        httpStatus: 200,
        response: CLARIFY,
      })
    ).toMatchObject({ outcome: 'clarify', passed: true });
  });

  test('a case that expects a clarify fails on an error answer', () => {
    expect(
      scoreServed({
        caseId: 'golden-coropletico',
        httpStatus: 422,
        response: { error: true, issues: [{ code: 'missing_data' }] },
      })
    ).toMatchObject({ outcome: 'error', passed: false });
  });

  test('a case that expects a map does not accept a clarify answer', () => {
    expect(
      scoreServed({ caseId: 'golden-ivs', httpStatus: 200, response: CLARIFY })
    ).toMatchObject({ outcome: 'clarify', passed: false });
  });
});

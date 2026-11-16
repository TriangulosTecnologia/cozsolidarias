import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(
  __dirname,
  '../../../.claude/skills/geovis-spec-gate-optimizer/scripts/report_run.mjs'
);

type Report = {
  totals: { cases: number; passed: number; failed: number };
  cases: Array<{ case: string; class: string; scope: string | null }>;
  declined: Array<{ scope: string }>;
  proposals: Array<{ scope: string; status: string; issues: Array<number> }>;
};

const score = ({ id, passed }: { id: string; passed: boolean }) => {
  return {
    case: id,
    prompt: `prompt ${id}`,
    httpStatus: passed ? 200 : 422,
    durationMs: 1,
    outcome: passed ? 'spec' : 'error',
    issues: [],
    checks: [{ id: 'outcome', passed, note: 'n' }],
    passed,
  };
};

const makeRun = ({ classification }: { classification?: unknown }) => {
  const dir = mkdtempSync(join(tmpdir(), 'report-run-'));
  mkdirSync(join(dir, 'cases'));
  for (const s of [
    score({ id: 'ok', passed: true }),
    score({ id: 'bad-a', passed: false }),
    score({ id: 'bad-b', passed: false }),
  ]) {
    writeFileSync(
      join(dir, 'cases', `${s.case}.score.json`),
      JSON.stringify(s)
    );
  }
  if (classification) {
    writeFileSync(
      join(dir, 'classification.json'),
      JSON.stringify(classification)
    );
  }
  return dir;
};

const report = ({ dir }: { dir: string }) => {
  execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' });
  return JSON.parse(
    readFileSync(join(dir, 'eval-report.json'), 'utf8')
  ) as Report;
};

describe('report_run.mjs', () => {
  test('without a classification, failing cases are unclassified and get no proposal', () => {
    const r = report({ dir: makeRun({}) });
    expect(r.totals).toEqual({ cases: 3, passed: 1, failed: 2 });
    expect(
      r.cases.map((c) => {
        return c.class;
      })
    ).toEqual(['unclassified', 'unclassified', 'approved']);
    expect(r.proposals).toEqual([]);
  });

  test('groups with an issue are linked, without one new, and declined ones are only listed', () => {
    const dir = makeRun({
      classification: {
        decision: 'task',
        groups: [
          {
            cases: ['bad-a'],
            class: 'rejected',
            scope: 'transform',
            issue: 115,
          },
          { cases: ['bad-b'], class: 'rejected', scope: 'data' },
          {
            cases: [],
            class: 'inconclusive',
            scope: 'evals-gate',
            declined: true,
          },
        ],
      },
    });
    const r = report({ dir });
    expect(
      r.proposals.map((p) => {
        return [p.scope, p.status, p.issues];
      })
    ).toEqual([
      ['data', 'new', []],
      ['transform', 'linked', [115]],
    ]);
    expect(
      r.declined.map((g) => {
        return g.scope;
      })
    ).toEqual(['evals-gate']);
    expect(readFileSync(join(dir, 'SUMMARY.md'), 'utf8')).toContain(
      '## Declined'
    );
  });

  test('a classification naming a case with no score is refused', () => {
    const dir = makeRun({
      classification: {
        groups: [{ cases: ['nope'], class: 'rejected', scope: 'data' }],
      },
    });
    expect(() => {
      execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' });
    }).toThrow();
  });
});

# Flow

`flow` parameters for cozsolidarias. Each value points to the rule that holds it; edit the rule, not this list.

- **Flow project id**: `proj_n70nb8jc3y`.
- **Standing-decision task id**: `task_5by41ffdhe`.
- **Repos**: `TriangulosTecnologia/cozsolidarias`.
- **Runtime**: Claude Code sessions preset (`.claude/skills/flow/references/runtime-claude-code-remote.md`); models default.
- **Max runs**: 2.
- **Routines**: none; the tick runs only when somebody invokes `/flow proj_n70nb8jc3y`.
- **Intake**: default.
- **Ready brief**: default.
- **Decisions**: default, plus:
  - Dominant choices (pass the dominance test): accept and apply them; record each in the PR body as Q/A with what was checked.
  - Every other open choice: before writing code, create one `decision` task that `blocks` the task, waiting on the person, with three sequences of decisions:
    - A) the minimum that settles the task's scope;
    - B) a balance between the short-term minimum and the long-term solution;
    - C) beyond the task's scope, with long-term gains. Name the open tasks it would also settle (`list-tasks` `query`), each linked with `mentions`.
  - Each option states what it worsens, and the decision ends with a recommendation. Stop.
  - With the answer, the child follows the chosen sequence. Under C, the tasks it absorbs enter `works_on`, or become successors `derived_from` the task.
- **Before proposing**: `CLAUDE.md` § Quality Gates, plus:
  - `pnpm install --frozen-lockfile` is allowed.
  - Evals: `pnpm dev`, then `run_campaign.sh <run-dir> http://localhost:3000 <the task's cases>`, then `gate_ratio.mjs` on each case with `expect.rate`.
  - Commit: put the run in `.claude/skills/geovis-spec-gate-optimizer/runs/<ts>--<task id>-<slug>/`. Keep `SUMMARY.md`, `eval-report.json`, `campaign.log`, `cases/*.score.json` and `cases/*.gate.json`. Leave out only `cases/<id>.json` and `*.spec.json` (the response bodies).
  - Download: keep the discarded JSON files in `<scratchpad>/<task id>/specs/` and list their paths in the handoff; the tick sends them to the person.
  - PR body: the `devanity-proof` block first, a summary of the diff by file, and one `verifier-change: <why>` line whenever a test, threshold, check or `jest.config.ts` changed.
- **Review**: an agent. Once the checks are green, a review child runs `/devanity review` (`usedevanity/skills`, cloned read-only) on the head. It sets the `flow/review` status and leaves a comment ending with the verdict marker: BLOCK means `FINDINGS`, a PASS-class verdict means `CLEAN`.
- **Merge rule**: `.github/workflows/pr.yml` green on the head, no conflict, linear history (ruleset on `main`); a person integrates. `FINDINGS` gets 1 automatic round. The round child fixes the findings and rewrites the PR body (devanity-proof, new diffs, `verifier-change:`). A `[DECIDE]` finding goes to the person, with no round.
- **Agents integrate**: no.
- **Release procedure**: default.
- **Closing evidence**: default.
- **Delivery kinds**: default.

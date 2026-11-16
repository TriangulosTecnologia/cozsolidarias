# Flow

`flow` parameters for cozsolidarias. Each value points to the rule that holds it; edit the rule, not this list.

- **Flow project id**: `proj_n70nb8jc3y`.
- **Standing-decision task id**: `task_5by41ffdhe`.
- **Repos**: `TriangulosTecnologia/cozsolidarias`.
- **Runtime**: Claude Code sessions preset (`.claude/skills/flow/references/runtime-claude-code-remote.md`); models default.
- **Run records**: the preset's hook (`session-run.mjs` on `SessionStart`, `Stop`, `SessionEnd`) in `.claude/settings.json`; `FLOW_API_KEY` from the environment.
- **Max runs**: 2.
- **Routines**: none; the tick runs only when somebody invokes `/flow proj_n70nb8jc3y`.
- **Intake**: default.
- **Ready brief**: default.
- **Decisions**: default.
- **Before proposing**: `CLAUDE.md` § Quality Gates (`pnpm typecheck`, `pnpm eslint --fix`, `pnpm test`), the checks `.github/workflows/pr.yml` runs.
- **Review**: none; the gates are the checks.
- **Merge rule**: `.github/workflows/pr.yml` green on the head, no conflict, linear history (ruleset on `main`); a person integrates.
- **Agents integrate**: no.
- **Release procedure**: default.
- **Closing evidence**: default.
- **Delivery kinds**: default.

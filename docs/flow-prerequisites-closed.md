# Flow prerequisites — scope closed

Prerequisites of the Agentic Workflow setup ([`AGENTIC_WORKFLOW.md`](../AGENTIC_WORKFLOW.md), PR #120) still open after `/flow-setup` step 10.

## Assertion: where `FLOW_API_KEY` lives

`FLOW_API_KEY` exists only in the environment the sessions and routines run in, restricted to `proj_n70nb8jc3y`, with an expiry; never in a tracked file or a chat.

- **Implementation:** none in the repo. A person mints the key in the Flow console and sets it in the Claude Code cloud environment and the local shell.
- **Check:** `node .claude/skills/flow/scripts/check.mjs --root .` returns `ok: true` **and** its `restricted` detail reads `the key reaches this project alone` (that check is `ok: true` even when the key reaches several projects). `git grep -nE 'FLOW_API_KEY\s*[=:]\s*["'"'"']?[A-Za-z0-9_-]{8,}'` returns nothing.

## Axes

- **Security:** secret and access scope.
- **Governance:** what judges or instructs the agents changes only through a merge a person approved (GTF-A6).
- **CI gates:** PR #120 integrates green, no gate weakened silently.
- **Operations:** every run's cost and trace are recorded in Flow.

## Acceptance criteria

| #   | Item            | Axis       | Criterion                                                                                                                                                    | Owner           |
| --- | --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| F1  | `FLOW_API_KEY`  | Security   | the assertion's check passes                                                                                                                                 | person          |
| F1  | `FLOW_API_KEY`  | Operations | `check.mjs` reports the deployment has `upsert-agent-run` and `list-agent-runs`                                                                              | person          |
| F2  | PR #120 green   | CI gates   | `pr` passes: the vendored ttoss skills are ignored by ESLint (`eslint.config.mjs`), pinned by hash in `skills-lock.json`                                     | agent           |
| F2  | PR #120 green   | CI gates   | `rules` passes: the PR body carries a `devanity-proof:` block                                                                                                | agent           |
| F2  | PR #120 green   | Governance | the PR body names the gate it changes and why; a person integrates it                                                                                        | person          |
| F4  | Code owners     | Governance | `.github/CODEOWNERS` covers `.github/`, every `CLAUDE.md`, `.claude/`, `skills-lock.json`, `AGENTIC_WORKFLOW.md`, `devanity.rules.json`, `eslint.config.mjs` | agent           |
| F5  | Run-record hook | Operations | after F1, a session's run appears in `list-agent-runs` with `model` and `usage`                                                                              | agent, after F1 |
| F5  | Run-record hook | Security   | without the key the hook writes nothing                                                                                                                      | —               |

`.github/CODEOWNERS` requests the owners' review; it blocks a merge only if the `main` ruleset later requires code owner review. F5 edits `.claude/settings.json` (high-risk in `devanity.rules.json`) and is a change of its own.

## Deferred

- **Routines** (`/flow-setup` step 11): `Routines` is empty by default; each firing costs. Revisit once #120 merges.

## Dropped

- **`main` ruleset requiring review and checks:** not a dependency of #120. The standing decision ([`task_5by41ffdhe`](https://flow.ttoss.dev/app/tasks/task_5by41ffdhe)) and `Agents integrate: no` already leave every merge to a person; the ruleset would only enforce what the process already says.
- **Runtime permissions:** `Agents integrate: no` delegates no merge.
- **Closing evidence credentials:** the default validation needs none.

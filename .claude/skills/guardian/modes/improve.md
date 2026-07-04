# Mode: improve

Fix exactly one approved finding (by ID), by ladder position (`${CLAUDE_SKILL_DIR}/reference/enforcement.md`).

- **Mechanizable** → codify the enforcement (lint/type/schema/test/coverage gate), not just patch the instance; first check the rule/plugin is already available; if a new dep or hook/CI change is needed, stop and propose.
- **Not mechanizable** → smallest correct prose/spec change, or produce a `plan` if it needs architectural/product judgment.
- **basis-form migration** → migrate case→basis or collapse an empty axis, only when the axis is visible (≈3 points) and it reduces blast radius/ambiguity; then promote the syndrome to enforcement (`${CLAUDE_SKILL_DIR}/reference/basis-form.md`). Structural moves (many files, redrawn boundaries) are proposed, not done silently.

Rules: one finding only; small patch; add/update verification if behavior changes; never mix feature work with repo-health cleanup; never touch high-risk areas without explicit instruction.

```md
### Finding fixed [G-###]

### Ladder rung targeted enforcement | path-scoped context | procedure | prose

### Files changed

### Why this improves the AI Repo

### Verification command / result

### Residual risk

### Suggested PR description
```

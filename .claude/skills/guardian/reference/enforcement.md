# Guardian — Enforcement promotion

## Promotion path (the ratchet)

Push recurring findings up the ladder. Judge recurrence from available evidence (git history, existing findings, TODOs):

```txt
seen once        → P2 suggestion
seen twice       → propose codification (test/type/schema/lint)
seen three times → recommend a durable gate (lint/typecheck/test/CI/hook)
high-risk class  → propose deterministic enforcement immediately
```

## Enforcement type by target

```txt
before a dangerous action      → PreToolUse hook (exit 2 blocks)
before stopping without checks  → Stop hook
after an edit, to flag/suggest  → PostToolUse hook (cannot prevent; advisory)
at PR/merge                     → CI
static rule                     → lint / typecheck
behavior                        → test
domain contract                 → spec + test
```

## Before codifying a prose rule, confirm

- precise enough to enforce mechanically;
- low false-positive rate;
- doesn't encode product intent a human must approve first;
- won't block legitimate future work.

If any fails, keep it as guidance and record why — not every good guideline makes a good check. If enforcement needs a **new dependency** or a **hook/CI change**, stop and propose it (respect any "no new dependencies" rule).

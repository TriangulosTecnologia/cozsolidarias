# cozsolidarias — Copilot Instructions

## Project

Public Next.js application serving a Brazilian audience.

## Constraints

- **No new dependencies** without explicit request.
- **Arrow functions; never classes.**
- **No generic wrappers, utils, or service layers.**

## Debugging

When something breaks:

1. Trace to root cause across the full stack. Keep going until the cause makes the bug inevitable.
2. State root cause in one sentence before proposing a fix.
3. Fix the root — no symptomatic patches (try/catch hiding errors, defensive defaults masking `null`).
4. Fix must be Pareto-optimal. Surface any trade-off before implementing.
5. Prefer fixes that remove code over fixes that add it.

## Language

The website default language is Portuguese (pt-BR), but all content this repository related to coding must be written in English: code identifiers, comments, commit messages, user-facing strings, documentation, error messages, and logs.

## Function Arguments

Prefer object parameters over multiple positional arguments. Single-parameter functions, trivial utilities (`Math.max`), and standard callbacks (`.map((item, index) => ...)`) are the only exceptions.

## Naming Conventions

- `kebab-case` for folder names.
- `camelCase` for file names, variables, and functions.
- `PascalCase` for types, interfaces, and React components.
- `UPPER_SNAKE_CASE` for constants.
- Test files mirror the source name with `.test` before the extension (e.g. `myFile.test.ts`).

## Avoid Over-Engineering

Iterate internally until you reach an optimized, robust solution before committing. Do not add abstractions that have no current consumer.

## Divergence Is Evidence, Not a Bug

When code diverges from a spec, convention, or "obvious best practice", treat the divergence as evidence of an unstated invariant until proven otherwise. Stop-signal phrases in your own draft — _"just a notation change"_, _"output is identical"_, _"zero risk"_, _"one-line fix"_, _"purely cosmetic"_ — correlate with skipped investigation. Before changing, locate the test that pins the current behaviour; if none exists, that gap is the real finding.

## Reporting Out-of-Scope Issues

If you spot improvements outside the current task (refactors, missing tests, stale docs, perf, security), open a separate GitHub issue with a clear title and rationale instead of expanding the current change.

## Quality Assurance

An implementation is complete only when **all** of the following pass without errors or warnings:

```bash
pnpm typecheck
pnpm eslint --fix
pnpm test
```

### Tests

Unit tests live in `tests/unit/tests/` and mirror the source directory structure. Avoid redundant tests that assert the same behaviour multiple ways. Every public function and exported component must have at least one test.

### Coverage

Coverage must never decrease. After any code change:

1. Run `pnpm test` and read reported coverage.
2. Update `coverageThreshold.global` in `tests/unit/jest.config.ts` to 0.01–0.1% below the new numbers. Never lower the values.

### JSDoc on Exported Symbols

Every exported type, function, and React component must have JSDoc: parameters, return shape, defaults (`@default`), invariants, and at least one `@example`. Internal helpers do not need JSDoc.

### TypeScript Type Safety

`as any` and `as unknown` are **strictly forbidden**. Fix the root cause: improve the type definition, use type narrowing (`typeof`, `in`, `Array.isArray`), use generics, add type guards, or use runtime validation (e.g. Zod) for external data.

### No Leftover Debug Output

No `console.log` or `debugger` statements in committed code. Use a structured logger instead (see `debug-logging.instructions.md` if present).

### Linting Workflow

To fix issues in a single file: `pnpm eslint --fix path/to/file`.
Stage your intended changes (`git add ...`) before running repo-wide lint, because lint-staged operates on the staged diff.

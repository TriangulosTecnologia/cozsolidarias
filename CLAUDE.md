# cozsolidarias

Public Next.js application serving a Brazilian audience. Runs on Node 24, pnpm, Next.js 16, React 19, Chakra UI v3, TypeScript.

## Architecture

Data always flows through a single boundary:

```
src/app  →  src/data-gateway  →  src/data-source-*
```

The browser never knows whether data came from static files, an API, a database, or cache. Domain rules for each layer live in that layer's `CLAUDE.md`.

## Constraints

- **No new dependencies** without explicit request.
- **Arrow functions only; never classes.**
- **No generic wrappers, utils, or service layers.**
- **No `as any` or `as unknown`.** Use type narrowing, generics, or runtime validation (e.g. Zod).
- **No `console.log` or `debugger`** in committed code.

## Language

Website language is Portuguese (pt-BR). Everything in this repository — code identifiers, comments, commit messages, documentation, error messages, logs — must be in **English**.

## Naming

| Scope | Convention |
|---|---|
| Folder names | `kebab-case` |
| File names, variables, functions | `camelCase` |
| Types, interfaces, React components | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |
| Test files | `myFile.test.ts` (mirror the source path) |

## Function Arguments

Prefer object parameters over multiple positional arguments. Exceptions: single-argument functions, trivial utilities (`Math.max`), and standard callbacks (`.map((item, index) => ...)`).

## Quality Gates

An implementation is complete only when all pass without errors or warnings:

```bash
pnpm typecheck
pnpm eslint --fix
pnpm test
```

To fix a single file: `pnpm eslint --fix path/to/file`.
Stage intended changes (`git add ...`) before repo-wide lint — lint-staged operates on the staged diff.

## Tests

Unit tests live in `tests/unit/tests/` and mirror the source directory structure. Every public function and exported component must have at least one test. Avoid redundant tests asserting the same behaviour multiple ways.

### Coverage

Coverage must never decrease. After any code change:

1. Run `pnpm test` and read reported coverage.
2. Update `coverageThreshold.global` in `tests/unit/jest.config.ts` to 0.01–0.1% below the new numbers. Never lower the values.

## JSDoc on Exported Symbols

Every exported type, function, and React component must have JSDoc: parameters, return shape, defaults (`@default`), invariants, and at least one `@example`. Internal helpers do not need JSDoc.

## Debugging

When something breaks:

1. Trace to root cause across the full stack until the cause makes the bug inevitable.
2. State root cause in one sentence before proposing a fix.
3. Fix the root — no symptomatic patches (e.g. try/catch hiding errors, defensive defaults masking `null`).
4. Fix must be Pareto-optimal. Surface trade-offs before implementing.
5. Prefer fixes that remove code over fixes that add it.

## Divergence Is Evidence

When code diverges from a spec or convention, treat the divergence as evidence of an unstated invariant until proven otherwise. Stop-signal phrases — *"just a notation change"*, *"output is identical"*, *"zero risk"*, *"one-line fix"*, *"purely cosmetic"* — correlate with skipped investigation. Before changing, locate the test that pins the current behaviour; if none exists, that gap is the real finding.

## Avoid Over-Engineering

Iterate internally until you reach an optimized, robust solution before committing. Do not add abstractions that have no current consumer. Extract to a shared module only after 3 uses (3× rule).

## Reporting Out-of-Scope Issues

If you spot improvements outside the current task (refactors, missing tests, stale docs, perf, security), open a separate GitHub issue with a clear title and rationale instead of expanding the current change.

## Documentation

When writing or editing `.md`/`.mdx` files:

- Every sentence must earn its place. Prefer removing over adding.
- Target audience is technical developers. Assume familiarity with standard concepts.
- Start with context. Use descriptive headings. Minimize structural breaks.
- Use lists for actionable steps; paragraphs for connected concepts; tables for comparisons.
- Code blocks always declare a language.
- Use Mermaid diagrams for flows and architectures instead of prose.
- Internal links must work; strip numeric folder prefixes in paths.
- Check for related content to avoid duplication. Never reproduce content that lives elsewhere — link to it.

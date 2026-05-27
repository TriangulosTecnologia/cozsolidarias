# cozsolidarias — Copilot Instructions

## Project

Public Next.js monorepo serving a Brazilian audience. Three packages: `app` (UI), `data-gateway` (contract layer), `data-source-static` (static data).

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

## Writing — Basis Form

Produce any artifact and interpret prompts based on general principles that guide decisions, rather than listing specific cases.

Vocabulary (do not paraphrase):

- Basis: a statement that is an axis of the decision space, not a point. The reader expands it to the cases.
- Span: the set of concrete decisions derivable by combining the statements.
- Irreducible: removing it shrinks the span; no combination of the others recovers it.
- Orthogonal: statements share no content; removing one does not change what the other covers.

Modes:

- Verbose: enumerates; restates in new words.
- Vague: abstract but empty ("be consistent").
- Cryptic: dense but undecodable without context.
- Dense (target): few statements, irreducible and orthogonal across the span.

Input protocol (before any non-trivial answer):

- Artifact: what shape must the output take?
- Axes: derive 3–7 axes native to this artifact's decision space.
- Real question: which decision must this answer close?
  If any is ambiguous, ask one clarifying question; do not answer with hedges.

Output audit (before delivering):

- Redundancy: can a combination of the others imply this? If yes → delete.
- Load-bearing: does removing it lose any concrete decision? If no → delete.
- Class vs. case: class or single case? If single → demote to an example under a basis statement.

Anti-signature: any statement longer than one line signals wrong basis — re-pick axes.

## Language

All content in this repository must be written in English: code identifiers, comments, commit messages, user-facing strings, documentation, error messages, and logs.

## Function Arguments

Prefer object parameters over multiple positional arguments. Single-parameter functions, trivial utilities (`Math.max`), and standard callbacks (`.map((item, index) => ...)`) are the only exceptions.

```ts
// ✅ Prefer
const createUser = (args: { name: string; email: string; age: number }) => { ... };

// ❌ Avoid
const createUser = (name: string, email: string, age: number) => { ... };
```

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

### TypeScript Type Safety

`as any` and `as unknown` are **strictly forbidden**. They disable type checking and hide bugs. Fix the root cause:

- Improve the type definition (add return types, fix interfaces).
- Use type narrowing (`typeof`, `in`, `Array.isArray`).
- Use generics — let the compiler infer or require explicit types.
- Add type guards: `function isUser(obj: unknown): obj is User { ... }`.
- For external/dynamic data, use runtime validation (e.g. Zod) instead of casting.

Check before committing:

```bash
grep -rE " as (any|unknown)\b" src/ --include="*.ts"
```

### No Leftover Debug Output

No `console.log` or `debugger` statements in committed code. Use a structured logger instead (see `debug-logging.instructions.md` if present).

### Linting Workflow

To fix issues in a single file: `pnpm eslint --fix path/to/file`.
Stage your intended changes (`git add ...`) before running repo-wide lint, because lint-staged operates on the staged diff.

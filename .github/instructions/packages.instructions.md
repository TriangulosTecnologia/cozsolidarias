---
applyTo: '**/packages/**'
description: Rules for developing and modifying packages in the monorepo.
---

# Package Development

## Continuous Validation

After each change, from the package directory:

```bash
pnpm run test
```

From the monorepo root, validate dependents and build:

```bash
pnpm turbo run test  --filter=...PACKAGE_NAME
pnpm turbo run build --filter=...PACKAGE_NAME
```

Fix failures immediately before proceeding.

## Tests

- Unit tests live in `packages/PACKAGE_NAME/tests/unit/` (not in `src/`). Mirror the source directory structure.
- Every public function and every exported component must have at least one test.
- Cover happy path, error/validation cases, edge cases, and regressions for fixed bugs.
- Avoid redundant tests that assert the same behaviour multiple ways.

## Coverage — Golden Rule

Coverage must **never decrease**. For every code change:

1. Add tests for the new/modified code.
2. Run `pnpm run test` and read the reported coverage.
3. Update `coverageThreshold.global` in `packages/PACKAGE_NAME/tests/unit/jest.config.ts` to the new values (set 0.01–0.1% below the reported number to absorb noise). Never lower the values.

## README

Update `packages/PACKAGE_NAME/README.md` whenever public behaviour changes: new APIs, breaking changes, examples, configuration. Re-read the whole README after editing to catch obsolete or contradictory sections.

## JSDoc on Exported Symbols

Every exported type, function, and React component must have JSDoc describing the contract: parameters, return shape, defaults (`@default`), invariants, and at least one `@example`. Internal helpers do not need JSDoc.

Storybook autodocs reads JSDoc — without it, stories have no description panel.

## Checklist Before Finalizing

- [ ] `pnpm run test` passes in the package.
- [ ] `pnpm turbo run test --filter=...PACKAGE_NAME` passes from root.
- [ ] `pnpm turbo run build --filter=...PACKAGE_NAME` passes from root.
- [ ] Coverage did not decrease and `jest.config.ts` threshold updated.
- [ ] README updated and reviewed end-to-end.
- [ ] Exported symbols have JSDoc.
- [ ] No commented-out code, no TODOs without an issue link.
- [ ] `pnpm run -w lint` passes.

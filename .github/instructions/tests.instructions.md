---
applyTo: 'tests/**,**/*.test.ts,**/*.test.tsx'
description: Conventions for writing, running, and maintaining tests.
---

# Test Instructions

## Running Tests

```bash
# All tests
pnpm test

# Specific file (note the plural flag)
pnpm test --testPathPatterns=users.test.ts

# Specific test name
pnpm test --testNamePattern="prevents navigation from step 2"
```

Do **not** use `npx jest` directly, and do **not** use `--testPathPattern` (singular).

## Mocking

Use `jest.mocked()` for type-safe access to mocked functions. Avoid `(fn as jest.Mock)` casts.

When a module is transitively imported by the app entry point at startup, `jest.mock(path, factory)` will not take effect. Use `jest.spyOn(moduleNamespace, 'export')` instead — it mutates the existing exports object that everything already holds a reference to.

- Local spy created in `beforeEach` → restore with `jest.restoreAllMocks()` in `afterEach`.
- Shared spy exported from setup → reset with `jest.clearAllMocks()` only; `restoreAllMocks()` would permanently unwire it.

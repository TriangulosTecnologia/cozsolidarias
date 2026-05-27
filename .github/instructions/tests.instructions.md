---
applyTo: '**'
description: Conventions for writing, running, and maintaining tests.
---

# Test Instructions

## Running Tests

```bash
# Single package
pnpm --filter @org/package test

# Specific file (note the plural flag)
pnpm --filter @org/package test --testPathPatterns=users.test.ts

# Specific test name
pnpm --filter @org/package test --testNamePattern="prevents navigation from step 2"
```

Do **not** use `npx jest` directly, and do **not** use `--testPathPattern` (singular).

## Coverage Requirements

Every module under test must cover:

- Happy path — correct status code and response shape.
- Authentication failure (401) for protected routes.
- Authorization failure (403) for unauthorized actions.
- Edge cases — missing resources (404), invalid inputs, business-rule violations.

Always assert the **shape** of the response, not just the status code. Sensitive fields (passwords, internal IDs, tokens) must be absent from responses.

## Mocking

Use `jest.mocked()` for type-safe access to mocked functions. Avoid `(fn as jest.Mock)` casts.

When a module is transitively imported by the app entry point at startup, `jest.mock(path, factory)` will not take effect. Use `jest.spyOn(moduleNamespace, 'export')` instead — it mutates the existing exports object that everything already holds a reference to.

- Local spy created in `beforeEach` → restore with `jest.restoreAllMocks()` in `afterEach`.
- Shared spy exported from setup → reset with `jest.clearAllMocks()` only; `restoreAllMocks()` would permanently unwire it.

## Async Coordination

- Supertest requests are lazy — server processing does not reliably start until the request is awaited or `.end()` is called.
- Prefer Promise-based signaling over `setTimeout`/`setImmediate` polling, especially when fake timers are active.

## Test Files Must Not Log

Do not add `console.log` inside test files. If you need diagnostics, add structured debug logging to the code under test.

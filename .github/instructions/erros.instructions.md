---
applyTo: '**/server/**,**/api/**,**/backend/**'
description: Error signalling and handling in server packages.
---

# Error Handling

## Signal With DomainError, Never Return Strings

All business-logic errors must be thrown as a `DomainError` (or the project's equivalent typed error). Never return error strings or `null` to indicate failure inside a route handler.

```ts
throw new DomainError('RESOURCE_NOT_FOUND', `Project '${id}' not found.`);
throw new DomainError('NAME_CONFLICT', `Name '${name}' already exists.`, {
  name,
});
```

## Centralized Error Codes

All valid error codes and their HTTP statuses live in a single registry file. Do not invent ad-hoc statuses in route handlers — add a code to the registry first. Referenced-entity-not-found errors typically map to 400 (bad request field), not 404 (missing top-level resource).

## `find*` vs `get*` Naming Rule

| Prefix  | Signature                   | Behaviour when absent |
| ------- | --------------------------- | --------------------- |
| `find*` | `findFoo(...): Foo \| null` | Returns `null`        |
| `get*`  | `getFoo(...): Foo`          | Throws `DomainError`  |

Use `get*` in route handlers so errors propagate automatically to the error middleware.

## Let Errors Propagate

Never wrap lib calls in `try/catch` solely to convert errors into HTTP responses. Let the middleware translate `DomainError` into the response. Only use `try/catch` when you must perform cleanup (e.g. rolling back a transaction) and then re-throw.

## Asserting Errors in Tests

`response.body.error` for a `DomainError` is an **object** (`{ code, message, meta? }`), not a string. Assert against the object shape, not substring matches.

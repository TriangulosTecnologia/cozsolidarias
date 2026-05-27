---
applyTo: 'packages/app/**'
---

# Package: app

## Role

This package is the public Next.js application.
It owns routes, screens, UI composition, Chakra UI theme, map interaction, and user-facing states.
It consumes data only through HTTP route handlers or data-gateway functions.

## Principles

Keep the UI dependent on the canonical app data contract, never on source data shape.
Prefer Server Components for data loading and static structure.
Use Client Components only for interaction, browser APIs, Chakra UI widgets, and map runtime.
Keep Route Handlers thin: request parsing, gateway call, response formatting.
Preserve accessibility as product behavior, not visual polish.
Prefer explicit loading, empty, error, and reset states.
Keep permalink state serializable, stable, and URL-safe.
Small helpers stay next to the component that uses them. Extract to a shared module only after 3 uses.

## Boundaries

Do not read files from data-source-static directly.
Do not import source adapters directly.
Do not transform raw source data inside React components.
Do not duplicate data schemas owned by data-gateway.
Do not compute heavy geospatial or analytical work at request time.
Do not introduce authentication, dashboards, admin panels, or exports unless explicitly requested.
Do not add global state unless URL state or local component state is insufficient.

Do not use a dark theme. Single theme: light.

## Allowed dependencies

May import from data-gateway.
May use Next.js, React, Chakra UI, and the selected map library.
May expose /api/\* Route Handlers backed by data-gateway.

## Required pattern

app -> data-gateway -> data-source-\*
The browser must never know whether data came from static files, API, database, or cache.

## Runtime

All Server Components and Route Handlers that call the gateway must run on the Node.js runtime. Do not declare `export const runtime = 'edge'` on any module that imports, transitively or directly, `@cozsolidarias/data-gateway` — current sources (e.g. static) depend on `node:fs`. Edge-compatible sources may be introduced later behind the gateway; until then, Node is the only valid runtime.

## Secrets boundary

Tokens and credentials (e.g. `DATA_API_TOKEN`) are configured exclusively as Vercel environment variables without the `NEXT_PUBLIC_` prefix and read only inside server-only modules (Server Components, Route Handlers, server actions). They must never appear in Client Components, props passed to Client Components, or any value serialized to the browser. The gateway is the only consumer of these variables in the app.

## Review checklist

A UI change must not change the canonical data contract.
A route handler must not contain source-specific mapping logic.
A component must not fetch raw JSON/GEOJSON by hardcoded path.
A new feature must fit the V0 scope before it is implemented.

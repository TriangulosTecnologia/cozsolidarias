---
applyTo: 'packages/data-gateway/**'
---

# Package: data-gateway

## Role

This package is the canonical data boundary.

It transforms concrete data sources into the exact shape consumed by the app.

It owns contracts, validation, source selection, transformation, and read APIs.

## Principles

The app contract is sovereign.

Sources adapt to the app contract; the app never adapts to sources.

Every public function must return canonical types.

Every source-specific shape must terminate inside a transformer.

Validation must happen before data crosses into the app contract.

Transformations must be deterministic, explicit, and testable.

Prefer small pure functions over hidden framework behavior.

## Boundaries

Do not import from app.

Do not render UI.

Do not depend on Next.js runtime unless placed behind an adapter.

Do not read static files except through data-source-static.

Do not expose source-native records to app.

Do not perform heavy ETL, geocoding, joins, or spatial analysis at request time.

Do not silently coerce invalid data; fail with typed errors.

## Allowed dependencies

May import from data-source-static.

May later import from data-source-api or equivalent source packages.

May use schema validation libraries.

May expose factory functions for local, api, mock, or test sources.

## Required pattern

source record -> validate source -> transform -> validate contract -> return canonical value

## Naming

Use get\* for read functions.

Use toApp\* for transformers.

Use \*Contract for canonical app-facing types.

Use \*Source for source-native types.

## Scaling to multiple sources

Each concrete origin is its own package: `data-source-static`, `data-source-cdn`, `data-source-api`. The gateway selects internally based on `DATA_SOURCE`; the app calls `createDataGateway()` with no arguments and never names a source.

### Source registry

The set of accepted values for `DATA_SOURCE` is the constant `KNOWN_SOURCES` in `createDataGateway.ts`. Adding a source means extending this whitelist plus the dispatch branch. The default when the env var is absent is `'static'`.

Currently registered:

- `static` — reads from `data-source-static` (Node.js `fs`). Default.

Planned:

- `cdn` — reads JSON/GeoJSON from a public CDN URL (no auth).
- `api` — reads from an authenticated HTTP API using `DATA_API_TOKEN`.

### Adding a new source

1. **Create the source package** under `packages/data-source-<name>/`. It owns source-native types (`*Source`) and read functions (`fetchCdn*`, `requestApi*`). It never returns canonical types.
2. **Declare the dependency** in `packages/data-gateway/package.json`.
3. **Extend the registry**: add the new literal to `KNOWN_SOURCES` in `createDataGateway.ts`.
4. **Add the dispatch branch**: a new `if (source === '<name>')` block returning a `DataGateway` whose `get*` functions call the new source package and pipe through transformers.
5. **Write transformers** in `transformers/toApp*.ts`. Source records terminate here; canonical types emerge.
6. **Document any new env vars** (e.g. `DATA_API_TOKEN`, `DATA_CDN_BASE_URL`) in this file and in `app.instructions.md` under "Secrets boundary" if they carry credentials.

The app-facing contract (`*Contract` types and `get*` function signatures) must not change when a source is added.

### Composition patterns

A single `get*` function may combine multiple sources internally. The contract returned to the app is always canonical.

- **Route by data type** — different `get*` functions read from different sources. Example: `getTerritories` from `static`, `getServices` from `api`.
- **Parallel merge** — `Promise.all` across sources, then merge before returning. Example: base records from `static`, enrichment from `api`.
- **Fallback** — primary source fails → secondary source. Wrap in try/catch inside the gateway. The app never sees the original error.

These patterns may coexist across different `get*` functions in the same gateway instance.

### CDN source — blueprint

```ts
// data-source-cdn/src/fetchCdnGreeting.ts
export const fetchCdnGreeting = async (): Promise<CdnGreetingSource> => {
  const base = process.env['DATA_CDN_BASE_URL'];
  if (!base) throw new Error('[data-source-cdn] DATA_CDN_BASE_URL is required');

  const response = await fetch(`${base}/greeting.json`, {
    next: { revalidate: 3600, tags: ['greeting'] },
  });
  if (!response.ok) {
    throw new Error(
      `[data-source-cdn] ${response.status} ${response.statusText}`
    );
  }
  return response.json();
};
```

Notes:

- `fetch` on the Vercel runtime is cached automatically; `next.revalidate` and `next.tags` control the cache window and on-demand invalidation via `revalidateTag('greeting')`.
- The source package may stay Node-only or be made edge-compatible. Edge compatibility is decided when the endpoint shape is known, not before.

### API source — blueprint

```ts
// data-source-api/src/requestApiGreeting.ts
export const requestApiGreeting = async (): Promise<ApiGreetingSource> => {
  const base = process.env['DATA_API_BASE_URL'];
  const token = process.env['DATA_API_TOKEN'];
  if (!base || !token) {
    throw new Error(
      '[data-source-api] DATA_API_BASE_URL and DATA_API_TOKEN are required'
    );
  }

  const response = await fetch(`${base}/greeting`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60, tags: ['greeting'] },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('[data-source-api] Unauthorized');
  }
  if (!response.ok) {
    throw new Error(
      `[data-source-api] ${response.status} ${response.statusText}`
    );
  }
  return response.json();
};
```

Notes:

- The token is read inside the source package — never passed through `createDataGateway` arguments, never read in the app, never serialized.
- The source package only runs in Server Components, Route Handlers, or server actions. ESLint already prevents the app from importing it directly.

### Validation

Before a source record crosses into a transformer, it must be validated. For shapes more complex than a single field, use a schema validator (e.g. `zod`) inside the source package or at the entry of the transformer. Invalid input fails fast with a typed error; the app contract never receives partial or coerced data.

### Source configuration in the app

The app instantiates the gateway once in `packages/app/src/gateway.ts` with no arguments. Switching sources is a Vercel environment variable change (`DATA_SOURCE`), not a code change.

```ts
// packages/app/src/gateway.ts
import { createDataGateway } from '@cozsolidarias/data-gateway';
export const gateway = createDataGateway();
```

## Review checklist

A new source must not change app-facing types.

A new transformer must be covered by fixtures.

A new contract field must include meaning, unit, nullability, and migration impact.

A gateway function must remain independent of deployment target.

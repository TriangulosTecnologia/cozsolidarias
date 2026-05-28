---
applyTo: 'src/data-gateway/**'
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

## Multiple sources

Each source is its own module under `src/data-source-<name>/`. The gateway selects by `DATA_SOURCE` env var; the app calls `createDataGateway()` with no arguments and never names a source. The set of accepted values lives in `KNOWN_SOURCES` in `createDataGateway.ts`.

Currently registered: `static` (default). Planned: `cdn`, `api`.

App-facing contract (`*Contract` types and `get*` signatures) must not change when a source is added. Credentials (e.g. `DATA_API_TOKEN`) are read inside the source package — never passed through gateway arguments.

## Review checklist

A new source must not change app-facing types.

A new transformer must be covered by fixtures.

A new contract field must include meaning, unit, nullability, and migration impact.

A gateway function must remain independent of deployment target.

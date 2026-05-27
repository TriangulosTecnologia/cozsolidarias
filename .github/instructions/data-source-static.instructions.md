---
applyTo: 'packages/data-source-static/**'
---

# Package: data-source-static

## Role

This package is the static versioned source.

It provides local JSON/GEOJSON snapshots to data-gateway.

It does not define the app contract.

## Principles

Treat static data as an external source, not as the internal model.

Expose source-native records with minimal interpretation.

Keep file paths centralized and stable.

Keep snapshots reproducible, inspectable, and replaceable.

Preserve metadata, source, year, unit, update date, and limitations.

Fail loudly when required files are missing or malformed.

Prefer immutable read APIs.

## Boundaries

Do not import from app.

Do not import from data-gateway unless only using shared test fixtures.

Do not transform data into UI-ready shapes.

Do not compute indicators here unless they are precomputed snapshot artifacts.

Do not hide missing values, unknown units, or source inconsistencies.

Do not mutate source files at runtime.

Do not embed deployment-specific paths.

## Allowed dependencies

May use fs/path in Node-safe modules.

May expose async read functions.

May expose source-native TypeScript types.

May expose manifest and snapshot metadata.

May include fixture data for tests and demos.

## Required pattern

read file -> parse -> validate source shape -> return source-native data

## Naming

Use readStatic\* for file-backed reads.

Use Static\*Source for source-native types.

Use manifest as the entry point for dataset discovery.

## Review checklist

A new file must be listed in manifest.

A new dataset must include source metadata.

A read function must not return app-ready objects.

A static snapshot must remain usable after API migration.

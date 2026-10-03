# Package: `src/data-gateway`

The canonical data boundary between `src/data-source-*` and the app. It selects the source, transforms source-native records into the shapes the app consumes, and exposes them through `createDataGateway()`.

## Pipeline

```text
data-source validates the source shape → transform → typed canonical value
```

Source-shape validation belongs to the data source ([`data-source-static`](../data-source-static/CLAUDE.md)). There is no runtime contract-validation step: TypeScript strict types on transformer returns and `DataGateway` signatures are the contract check.

## Rules

- The app contract is sovereign: sources adapt to it, never the reverse.
- Every `DataGateway` member returns canonical types declared in `schema/` (or primitives), never source-native records.
- Every source-specific shape terminates inside a transformer in `transformers/`.
- Transformers are small, deterministic pure functions.
- Never silently coerce data: unknown or unparsable values become `null`, never `0` or a guess; structurally invalid data throws. Request parameters may fall back only when the `DataGateway` member documents it (e.g. `getCozinhas`: unknown or omitted year → latest snapshot).
- Heavy ETL, geocoding and joins over raw files run offline into snapshots. The one request-time spatial step, cozinha → município point-in-polygon, is memoized per year for the process lifetime.
- No UI, no direct file reads (go through a data source), no Next.js runtime unless behind an adapter.
- Layer imports are enforced by ESLint `no-restricted-imports` in [`eslint.config.mjs`](../../eslint.config.mjs).

## Naming

| Pattern         | Use                                                       | Example                                     |
| --------------- | --------------------------------------------------------- | ------------------------------------------- |
| `get*`          | `DataGateway` read functions                              | `getCozinhas`                               |
| `to<Shape>`     | transformer modules and their source → canonical function | `toCozinhasFeatureCollection`               |
| verb + noun     | steps of a multi-step transform                           | `aggregateCozinhasPorMunicipio`             |
| PascalCase noun | canonical types, named for the shape                      | `CozinhasFeatureCollection`, `MunicipioIvs` |

The catalogue family adds a `Contract` suffix (`CatalogueContract`) to tell it apart from the source's `Catalogue*` types; no other family needs it. Source-native types live in the data source and follow [its naming](../data-source-static/CLAUDE.md#naming).

## Sources

`createDataGateway()` takes no arguments: it reads `DATA_SOURCE` (default `static`) and throws on any value outside `KNOWN_SOURCES`. Each source is its own `src/data-source-<name>/` package. Adding one must not change any `DataGateway` signature or canonical type. Credentials (e.g. `DATA_API_TOKEN`) are read inside the source package, never passed through the gateway.

## Review Checklist

- A new transformer is tested against typed source-shaped fixtures.
- A new canonical field documents meaning, unit, nullability and migration impact.
- A gateway function stays independent of the deployment target.

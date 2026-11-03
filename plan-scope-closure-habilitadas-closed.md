# Scope-closed plan: situation-aware and multi-field kitchen aggregation

## Status

Scope closed, decisions recorded, implementation not started. Waiting for explicit confirmation to implement.

## Origin

Closes the analysis of the `/ia` aggregation path (`src/app/api/ai/spec/`). Inputs:

- Lean deterministic aggregation layer packet (redundancies R1–R4).
- Closure of the "habilitadas" case, expanded to any situation group, any other field, and any combination a user can request.
- Strategy D selected (`/devanity plan`): aggregate by situation in one pass, plus a small pure executor in the `/ia` domain. Strategy A (per-kitchen rows with free filters) is a trigger, not a current slice.

## Defect found (fails today)

`aggregateCozinhasPorMunicipio` (`src/data-gateway/transformers/toCozinhasPorMunicipio.ts`) counts every row with coordinates and never reads `situacao`.

| Snapshot                                     | Rows  | Habilitada | Other situations |
| -------------------------------------------- | ----- | ---------- | ---------------- |
| `cozinhas_com_geolocalizacao_2025.csv`       | 5,913 | 1,013      | 4,900            |
| `cozinhas_com_geolocalizacao_all.csv` (2026) | 1,396 | 1,396      | 0                |

Prompt "cozinhas habilitadas 2025" resolves to `cozinhas_geolocalizadas_2025` (`preflight.ts`, variant `match: /2025/`), so the map shows the count of every situation. The 2026 result is correct only because that file contains nothing but `Habilitada`.

Source comment (`readStaticCozinhas.ts`): the 2026 file "only covers kitchens that reached `Habilitada`". Non-habilitada and other counts for 2026 are **unknown, not zero**.

## Scope

In scope: any combination of year, situation group, metric and field that a user can request, served correctly or refused explicitly. Silent wrong answers are out of bounds.

In scope, redundancies:

- R1: id list duplicated in four registries.
- R2: id chosen twice (preflight and model).
- R3: preflight computes `chosenIds` and drops them.
- R4: gateway read and transform repeated per field and per request.

Out of scope:

- arbitrary formulas or user-defined subsets of situations (D4, closed registry);
- the cozinhas choropleth path that discards the agent's spec (R5, separate change);
- any change to the public contract of `POST /api/ai/spec` (see G-006-3).

## Decisions recorded (session)

| ID      | Decision                                                                                                                                                         | Effect on this plan                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| G-006-2 | A: keep the root-level `invalid-schema` key; the test documents the intent                                                                                       | No change                                                                                                        |
| G-006-3 | refuse: no contract change to `POST /api/ai/spec`; edits under `/api/ai/spec` stay blocked                                                                       | S5 and S6 may not change the 422 body or the response shape. Any such change needs a new decision                |
| G-008   | refuse: acceptance records for G-001, G-006, G-003 are not completed                                                                                             | The PR carries no `devanity-proof` block; verdict stays `none`                                                   |
| G-010-2 | B: keep the upstream message in the 502 and accept the risk, recorded                                                                                            | No change to the 502 text                                                                                        |
| G-011-2 | B: the catalogue stays in the first agent message (already the case in `route.ts` and `agentMessage.ts`). Edits authorized under `src/app/api/ai/spec/` for 24 h | S4 adds the new ids to the catalogue; S7 keeps the documentation in parity                                       |
| G-011-3 | A: the 422 from the `mapData` append keeps returning the pre-append spec; the invariant documents this format (text only)                                        | No code change. Invariant text only                                                                              |
| G-012-2 | B: a spec with no `mapData` (or an empty one) is rejected with 422 in code                                                                                       | **Conflicts with G-006-3 (refuse).** A 422 for this case changes the public response. Unresolved, see Open items |
| G-013-2 | B: the agent's `error` text does not reach the browser; the response uses a fixed message and records the error code                                             | Affects the error path in S6. Not a contract change: the status and body shape stay                              |

## Dependencies verified

| #   | Dependency                                                              | Evidence                                                             | Status                                       |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Source kitchen row has `situacao`                                       | `src/data-source-static/types.ts:102`                                | Verified                                     |
| 2   | Aggregate is memoized per year, so no extra pass                        | `createDataGateway.ts`, `getAggregate`                               | Verified                                     |
| 3   | A new field on the aggregate does not leak to the public API            | `projectComTaxa` and `toCozinhasBubbles` destructure explicit fields | Verified                                     |
| 4   | `/api/cozinhas/por-municipio` is unchanged                              | the route calls `getCozinhasPorMunicipio`, which stays as is         | Verified                                     |
| 5   | Existing route and fetcher tests do not break                           | existing ids and fetchers stay; new ids use their own path           | Verified by design, not run                  |
| 6   | Coverage gate is 100% (branches, functions, lines, statements)          | `tests/unit/jest.config.ts`                                          | Every new branch needs a test                |
| 7   | `toCozinhasPorMunicipio.test.ts` compares whole objects                 | `toEqual` from line 67                                               | Expectations gain the new key; not weakened  |
| 8   | Preflight regex confuses "não habilitada" with "habilitada"             | `habilitada` is a substring of `não habilitada`                      | Negation must be matched first               |
| 9   | 2026 coverage is only `Habilitada`                                      | comment in `readStaticCozinhas.ts`                                   | Assumption, not confirmed (Q1)               |
| 10  | Which ids are in the renderable list and the agent catalogue            | `preflight.test.ts`, `specValidation.test.ts` not yet read           | Read before S4                               |
| 11  | The `mapData` append (S6) is on the path that G-006-3 and G-012-2 touch | `src/app/api/ai/spec/**` invariants                                  | Blocks S6 until G-012-2 conflict is resolved |

## Work items

| ID  | Change                                                                                                                                                                                                                 | Files                                                  | Depends on  | Status                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------- | --------------------------------- |
| S1  | Aggregate carries `quantidadePorSituacao` (raw `situacao` keys, no interpretation) and `semLocalizacao`. Fixture test fails first.                                                                                     | `toCozinhasPorMunicipio.ts`, `schema/kitchenByCity.ts` | —           | READY                             |
| S2  | Internal gateway member `getCozinhasSituacaoPorMunicipio(ano)`. Not on the public route.                                                                                                                               | `createDataGateway.ts`, schema                         | S1          | READY                             |
| S3  | Pure executor in the `/ia` domain: plan `{ano, grupo}` → value per municipality. `habilitada` = `Habilitada`. Other groups wait for Q2. Coverage per year waits for Q1; without coverage the value is `null`, never 0. | `src/app/api/ai/spec/`                                 | S2          | `habilitada` READY; rest STUB     |
| S4  | Generated ids `cozinhas_<grupo>_<ano>` registered on the new path; catalogue updated.                                                                                                                                  | `mapDataCatalogue.ts`, catalogue text                  | S3, item 10 | Waits for item 10                 |
| S5  | Preflight extracts facets (year, group, metric) and resolves ids internally. Negation checked before the positive match. Ids stay internal (no public body change).                                                    | `preflight.ts`, `route.ts`                             | S4          | Multi-field waits for Q3, Q4      |
| S6  | Route builds `mapData` from the executor without changing existing fetchers. Checks that `mapData` ids match the resolved set. Error text uses the fixed message (G-013-2).                                            | `route.ts`, `serveSpec.ts`, `specValidation.ts`        | S5          | Waits for G-012-2 conflict and Q3 |
| S7  | Documentation and catalogue parity with the registry.                                                                                                                                                                  | `src/app/api/ai/spec/instructions/`                    | S4          | READY after S4                    |

Order: S1 → S2 → S3 (`habilitada`) → S4 → S5 → S6 → S7.

Quality gates: `pnpm typecheck`, `pnpm eslint --fix`, `pnpm test`, no coverage drop, JSDoc with `@example` on every exported symbol, no generic utilities.

## Checks that must fail before the fix

1. S1 and S2: no per-situation counts exist yet.
2. The defect: "cozinhas habilitadas 2025" resolves to the all-situations variant.
3. R-a: today each field calls the gateway separately.
4. R-b: today the IVS transform runs on every call.
5. C3: today 2026 non-habilitada has no refusal path.

## Acceptance criteria

Fixtures: at least six kitchen rows (3 `Habilitada`, 2 `Não Habilitada`, 1 `Mapeada`), located to two municipalities, plus one row without coordinates.

- **C1**: `cozinhas_habilitadas_2025` equals the `Habilitada` count per municipality; `cozinhas_nao_habilitadas_2025` equals the `Não Habilitada` count; the groups sum to `quantidade`.
- **C2**: for every municipality and year, `total = habilitada + nao_habilitada + outras`.
- **C3**: for 2026, `cozinhas_nao_habilitadas_2026` and `cozinhas_outras_2026` return a refusal naming the snapshot coverage. A value of 0 fails the test. The status code of this refusal depends on G-012-2 and G-006-3.
- **C4**: "cozinhas habilitadas e não habilitadas 2025" resolves to two ids and two `mapData` entries, each with its legend.
- **C5**: "IVS infraestrutura e cozinhas habilitadas 2025" with `datasetId = municipios_ivs_infraestrutura` returns both ids.
- **D-b**: a generated spec whose `mapData` ids differ from the resolved set is rejected.
- **R-a**: a request with two fields from the same table calls the aggregate once (spy).
- **R-b**: across two requests the IVS projection transform runs once per process (spy).
- **R-c**: response shape of `POST /api/ai/spec` and accepted body are unchanged (key-set snapshot).

## Open items

Dependent only. Everything else in the plan is decided.

| ID     | Question                                                                                                                                                                                                                 | Blocks                        | Recommended default                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Q1     | Does the 2026 snapshot cover only `Habilitada`, so non-habilitada and other counts are unknown (refusal) and not zero?                                                                                                   | S3 coverage for 2026          | Yes, unknown. Confirm with the data owner                                                                  |
| Q2     | Group membership: `nao_habilitada` = `Não Habilitada` only; `outras` = the other eight raw statuses                                                                                                                      | S3 groups beyond `habilitada` | As stated                                                                                                  |
| Q3     | Presentation of several fields in one result                                                                                                                                                                             | S6 multi-field                | Legend toggle on one map                                                                                   |
| Q4     | Ambiguity clarify across families, and whether `datasetId` answers only its own family                                                                                                                                   | S5 cross-family combinations  | One clarify listing all ambiguous families; `datasetId` answers only its family; no public contract change |
| C-G012 | G-012-2 (B) requires a 422 for a spec with no `mapData`, which conflicts with G-006-3 (refuse). Choose: a) keep G-012-2 B and reopen G-006-3 for this one response; b) revert G-012-2 to A (accept a `mapData`-less 200) | S6                            | Needs a human decision before S6                                                                           |

Items Q1 and Q2 are data and domain questions. Under the repository rules, slices that depend on them stay as stubs that fail until answered. `habilitada` (S1–S3) does not depend on them.

## Stories

None. No `.storybook/` directory and no Storybook dependency were found.

## Devanity-proof

```
devanity-proof:
  check: n/a (planning; no code changed, no test run)
  failed_before: n/a
  passed_after: n/a
  probes: 0/0
  status: NOT_VERIFIED: plan only; S1 not implemented
  pending: 5 (Q1, Q2, Q3, Q4, C-G012)
```

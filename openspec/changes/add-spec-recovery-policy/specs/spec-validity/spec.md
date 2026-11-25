## ADDED Requirements

### Requirement: Valid spec

A generated spec SHALL be valid only when it passes the structural checks, the request-contract checks and the required-caveat checks of this capability. A failing check SHALL be reported as a validation issue during generation; an issue left on the final spec SHALL make the route answer 422. The status codes and body fields of `POST /api/ai/spec` SHALL NOT change.

#### Scenario: Request-contract issue left on the final spec

- **WHEN** the agent replies `ok` with a spec that ignores the user's chosen map type
- **THEN** the response is 422 with the `ignored-user-map-type` issue
- **AND** the body has the same fields as any other 422

### Requirement: Issue categories and stable order

Every validation issue SHALL belong to exactly one category: `structural`, `data-resolution`, `semantic` or `capability`. Issues SHALL be deduplicated by code, path and message and ordered by category, code, path and message, so the same candidate and request always yield the same list. The category SHALL NOT appear in any field of the route's response body.

#### Scenario: Same issues in another order

- **WHEN** two validations find the same issues in a different order, one of them twice
- **THEN** both report an identical, deduplicated list

#### Scenario: Category stays internal

- **WHEN** the route answers 422 with issues
- **THEN** each issue in the body has `code`, `message` and, when known, `path`
- **AND** no field of the body, `requirements` included, carries `category`

### Requirement: User's map type is kept

When the user chose a map type, a spec with another map type, or none, SHALL be reported as `ignored-user-map-type` (`semantic`).

#### Scenario: Map type ignored

- **WHEN** the user chose `dotDensity` and the spec says `choropleth`
- **THEN** validation reports `ignored-user-map-type`

#### Scenario: Map type kept

- **WHEN** the user chose `dotDensity` and the spec says `dotDensity`
- **THEN** no `ignored-user-map-type` issue is reported

### Requirement: User's dataset is kept

When the user chose a dataset, a spec painting another dataset, or none, SHALL be reported as `ignored-user-dataset` (`semantic`).

#### Scenario: Dataset ignored

- **WHEN** the user chose `municipios_ivs` and the spec paints another dataset
- **THEN** validation reports `ignored-user-dataset`

### Requirement: Requested period is covered

When the prompt names a year, a spec painting a dataset whose temporal extent does not cover it SHALL be reported as `period-not-covered` (`data-resolution`).

#### Scenario: Year outside the dataset

- **WHEN** the prompt asks for 2010 and the painted dataset covers only later years
- **THEN** validation reports `period-not-covered`

#### Scenario: Prompt without a year

- **WHEN** the prompt names no year
- **THEN** no `period-not-covered` issue is reported

### Requirement: One painted variable

A spec with more than one `mapData` entry SHALL be reported as `multiple-painted-variables` (`structural`).

#### Scenario: Two variables

- **WHEN** the spec has two `mapData` entries
- **THEN** validation reports `multiple-painted-variables`

### Requirement: One legend per painted variable

A spec written by the agent that paints a variable and declares legends SHALL declare exactly one legend per `mapData` entry; otherwise it SHALL be reported as `legend-count-mismatch` (`structural`). A spec without legends (the server builds them) and a points or heatmap spec are not judged by this check.

#### Scenario: Two legends for one variable

- **WHEN** the agent's spec has one `mapData` entry and two legends
- **THEN** validation reports `legend-count-mismatch`

#### Scenario: No legends declared

- **WHEN** the agent's spec has one `mapData` entry and no legends
- **THEN** no `legend-count-mismatch` issue is reported

### Requirement: Points and heatmap specs paint no variable

A spec drawing point or heatmap layers SHALL NOT also carry a map type or `mapData`; otherwise it SHALL be reported as `points-spec-with-map-data` (`structural`).

#### Scenario: Heatmap with a map type

- **WHEN** the spec has a heatmap layer and `mapType: "choropleth"`
- **THEN** validation reports `points-spec-with-map-data`

### Requirement: Painted dataset measures the requested concept

When the server resolved the prompt to known dataset families, a spec painting a dataset outside those families SHALL be reported as `concept-drift` (`semantic`). A prompt the server could not resolve SHALL NOT be judged by this check.

#### Scenario: Another concept painted

- **WHEN** the prompt resolves to the IVS family and the spec paints a kitchen count
- **THEN** validation reports `concept-drift`

#### Scenario: Another variant of the same family

- **WHEN** the prompt resolves to the IVS family and the spec paints another IVS variant
- **THEN** no `concept-drift` issue is reported

### Requirement: No completeness claim over partial coverage

A spec whose title claims completeness ("todos", "todas", "completo", "completa") over a dataset with partial spatial coverage SHALL be reported as `completeness-claim-on-partial-coverage` (`semantic`).

#### Scenario: Claim over partial coverage

- **WHEN** the title says "Todas as cozinhas do Brasil" and the dataset covers part of the municípios
- **THEN** validation reports `completeness-claim-on-partial-coverage`

#### Scenario: Neutral title

- **WHEN** the title says "Cozinhas mapeadas por município" over the same dataset
- **THEN** no such issue is reported

### Requirement: Proxy caveat is stated

When the server noted that the dataset is a proxy of what the prompt asked, a spec whose description is missing or does not state that the data approximates the asked concept SHALL be reported as `missing-proxy-caveat` (`semantic`).

#### Scenario: Proxy without caveat

- **WHEN** the server noted a proxy and the description says nothing about it
- **THEN** validation reports `missing-proxy-caveat`

#### Scenario: Proxy with caveat

- **WHEN** the description says the data is an approximation of the asked concept
- **THEN** no such issue is reported

### Requirement: Default period is stated

When the prompt names no year and the catalogue's temporal extent for the painted dataset covers more than one year, a spec whose description does not name a year the dataset covers SHALL be reported as `missing-default-period-caveat` (`semantic`).

#### Scenario: Default year not stated

- **WHEN** the prompt names no year, the dataset's temporal extent covers several years and the description names none
- **THEN** validation reports `missing-default-period-caveat`

#### Scenario: Default year stated

- **WHEN** the description says "dados de 2022"
- **THEN** no such issue is reported

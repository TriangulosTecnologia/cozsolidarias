## ADDED Requirements

### Requirement: Recovery trigger

When the validation loop exhausts — the fifth validation still reports issues, or a validation reports at least as many issues as the previous one — the server SHALL answer that validation call with a recovery signal instead of ending the turn, so the agent can propose one more candidate in the same turn. The signal SHALL carry the trigger, the attempt count, the last candidate, its issues, a per-attempt history and fixed recovery instructions.

#### Scenario: Fifth validation still has issues

- **WHEN** the fifth validation of a generation reports issues and recovery was not used
- **THEN** the tool output has `recovery_required: true` with reason `max-attempts`
- **AND** the generation continues

#### Scenario: Issues stop shrinking

- **WHEN** the second validation reports as many issues as the first
- **THEN** the tool output has `recovery_required: true` with reason `no-shrinkage`

### Requirement: Server-side recovery budget

The server SHALL allow at most one recovery per generation and at most 6 validations in total, inside the generation's existing deadline. The first validation after recovery that still reports issues SHALL end the generation with a 422 whose message says recovery was attempted.

#### Scenario: Recovery candidate still invalid

- **WHEN** the candidate validated after a recovery signal reports issues
- **THEN** the response is 422 and its message says recovery was attempted
- **AND** no more than 6 validations ran in the generation

#### Scenario: Second exhaustion

- **WHEN** a generation that already used its recovery exhausts again
- **THEN** no second recovery signal is sent and the response is 422

### Requirement: Semantic invariance

A recovery candidate SHALL keep the request: the measured concept, filters, geographic grain, period and the user's chosen map type and dataset. It MAY change the dataset only after an issue on the dataset that the data or the app cannot serve, and the map type only after an issue the app cannot render and only when the user did not choose it. Any other change of dataset or map type SHALL be reported as a validation issue.

#### Scenario: Dataset swapped without cause

- **WHEN** the recovery candidate paints a different dataset and no earlier issue concerned the dataset
- **THEN** its validation reports a `semantic-drift` issue

#### Scenario: Dataset swapped after an unservable dataset

- **WHEN** an earlier issue said the chosen dataset cannot be served and the recovery candidate paints another dataset for the same concept
- **THEN** no `semantic-drift` issue is reported

### Requirement: Operational failures do not trigger recovery

A failure of the server itself while validating (the data source cannot be read) SHALL end the generation as an upstream failure (502), SHALL NOT count as a validation attempt and SHALL NOT reach the agent as an issue.

#### Scenario: Data source down while validating

- **WHEN** reading the data to validate a candidate fails
- **THEN** the response is 502 with a pt-BR message
- **AND** the agent receives no tool output for that call

### Requirement: Unsupported requests end as missing data

When no candidate can meet the request with the available data, the agent SHALL reply with the `missing_data` error, and the route SHALL answer it as a declined request (422) without serving a map.

#### Scenario: Recovery finds no data for the concept

- **WHEN** after a recovery signal the agent replies `missing_data`
- **THEN** the response is 422 with the declined-request message and no map is served

### Requirement: Success only after validation

A spec SHALL be served (200) after recovery only when its validation reports no issues and the route's final checks pass.

#### Scenario: Recovery candidate valid

- **WHEN** the candidate validated after a recovery signal reports no issues and the agent replies `ok` with it
- **THEN** the route resolves the data, runs its final checks and answers 200

### Requirement: Auditable recovery snapshot

In development only, a generation that entered recovery SHALL leave a log entry with the request, the first and last candidates, the issues, the attempts, the trigger and the outcome. No other environment SHALL persist it.

#### Scenario: Recovery in development

- **WHEN** a generation enters recovery and the server runs in development
- **THEN** one log entry records the request, candidates, issues, attempts, trigger and outcome

#### Scenario: Recovery in production

- **WHEN** a generation enters recovery in production
- **THEN** nothing about it is written

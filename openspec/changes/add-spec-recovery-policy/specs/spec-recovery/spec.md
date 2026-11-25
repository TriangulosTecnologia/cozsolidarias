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

### Requirement: Budget overrun and deadline end the generation

A validation call that would be the seventh of the generation SHALL NOT be validated and SHALL end the generation with a 422. An exhaustion at the sixth validation, which leaves no validation for a recovery candidate, SHALL end the generation with a 422 without a recovery signal. A deadline that passes after the recovery signal SHALL end the generation with that 422, carrying the candidate and issues that exhausted the loop; before the signal, a deadline stays an upstream failure (502).

#### Scenario: Seventh validation call

- **WHEN** the agent calls validation a seventh time in one generation, even after a clean sixth validation
- **THEN** the seventh candidate is not validated and the response is 422

#### Scenario: Exhaustion at the sixth validation

- **WHEN** the fifth validation is clean and the sixth reports issues
- **THEN** no recovery signal is sent and the response is 422

#### Scenario: Deadline passes during recovery

- **WHEN** the generation deadline passes after the recovery signal and before the agent's reply
- **THEN** the response is 422 with the candidate and issues that exhausted the loop, not an upstream failure

### Requirement: Semantic invariance

A recovery candidate SHALL keep the request: concept, filters, grain, period and the user's chosen map type and dataset. It MAY change the dataset only when the exhausting candidate's issues include a `data-resolution` or `capability` issue, and the map type only when they include a `capability` issue and the user did not choose the map type. Any other dataset or map type change SHALL be reported as `semantic-drift`.

#### Scenario: Dataset swapped without cause

- **WHEN** the recovery candidate paints a different dataset and the exhausting candidate's issues include no `data-resolution` or `capability` issue
- **THEN** its validation reports a `semantic-drift` issue

#### Scenario: Dataset swapped after an unservable dataset

- **WHEN** the exhausting candidate's issues include `unsupported-dataset` and the recovery candidate paints another dataset for the same concept
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

After a recovery signal, the route SHALL serve (200) only the spec that the last validation of the generation cleared with no issues, and only when the route's final checks pass. An `ok` reply with any other spec, or with no cleared candidate after the signal, SHALL end the generation with a 422 whose message says recovery was attempted.

#### Scenario: Recovery candidate valid

- **WHEN** the candidate validated after a recovery signal reports no issues and the agent replies `ok` with it
- **THEN** the route resolves the data, runs its final checks and answers 200

#### Scenario: Reply differs from the cleared candidate

- **WHEN** after a recovery signal the agent replies `ok` with a spec that differs from the candidate the last validation cleared
- **THEN** the response is 422 and its message says recovery was attempted

### Requirement: Auditable recovery snapshot

In development only, a generation that entered recovery SHALL leave a log entry with the request, the first and last candidates, the issues, the attempts, the trigger and the outcome. No other environment SHALL persist it.

#### Scenario: Recovery in development

- **WHEN** a generation enters recovery and the server runs in development
- **THEN** one log entry records the request, candidates, issues, attempts, trigger and outcome

#### Scenario: Recovery in production

- **WHEN** a generation enters recovery in production
- **THEN** nothing about it is written

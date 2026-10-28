# Architecture

My main recommendation is to build the skill as a pipeline of semantic selection, data verification, deterministic generation whenever possible, and evidence-based evaluation — not as a single prompt that tries to solve everything.

The goal is not only to generate a valid `VisualizationSpec`. It is to ensure that the map answers the original question, using the correct variable, data compatible with the requested granularity, and an appropriate cartographic representation.

There is a fundamental distinction:

- Structural validity: does the `VisualizationSpec` respect the schema and can it be rendered?
- Data correctness: does the variable really represent the requested concept, and is the data sufficient?
- Semantic correctness: does the map answer what the person asked, without swapping the metric for a misleading proxy?
- Cartographic quality: do the classification, the scale, the legend and the geometry communicate the data correctly?
- Evidence of success: can we demonstrate these results through tests and human review?

A map can pass the first requirement and fail the other four.

## 1. Steps

### 1. Interpret the request

Geographic entity · variable · operation · period · filters · intent

### 2. Discover and rank datasets

Catalogue · synonyms · units · granularity · coverage · temporality

### 3. Verify the API and feasibility

Real fields · samples · endpoints · allowed transformations · missing data

### 4. Plan and generate the VisualizationSpec

Validated metric · joins · geometry · scale · classes · legend

### 5. Validate with code

Schema · data · verifiable semantics · cartographic rules · rendering

### 6. Run the eval and generate a Markdown report

Evidence · individual criteria · failures · spec · human verdict

### 7. Approve or diagnose

Accept · fix the source of the error · repeat the eval · compare with the baseline

The most important architectural principle is that each step must produce a structured and verifiable output, instead of relying only on the textual context accumulated by the agent.

I also recommend separating two flows:

- Skill execution: receives a request, produces a specification and generates evaluation evidence.
- Agent improvement: analyzes failures, proposes changes to instructions, code or catalogue, and runs an A/B comparison before recommending changes.

The second flow must not silently modify the agent used in production.

## 2. Requirements that cannot be missing

### 2.1 Interpret the intent before choosing the dataset

The agent needs to convert natural language into an intermediate intent contract. This contract must exist before the `VisualizationSpec` is generated.

Example: “Quero ver quais municípios têm maior proporção de famílias atendidas por cozinhas solidárias” (English: "I want to see which municipalities have the highest proportion of families served by solidarity kitchens").

A structured interpretation could contain:

```
{
  "geography": "municipality",
  "metric": {
    "concept": "proportion_of_families_served",
    "numerator": "families_served",
    "denominator": "eligible_families",
    "aggregation": "ratio"
  },
  "comparison": "higher_values",
  "time": null,
  "filters": [],
  "preferred_map_type": "choropleth"
}
```

This is an illustrative contract, not a claim that these fields exist in the current catalogue.

The contract must distinguish:

- Concept: what the user wants to measure.
- Operation: count, sum, proportion, mean, rate, temporal variation or another operation.
- Unit of analysis: municipality, state, establishment or another entity.
- Denominator: mandatory when the question requires a proportion or rate.
- Time: explicit period or one that is implicitly required.
- Comparison: absolute values, relative values, trends or ranking.
- Visualization form: user preference, subject to data feasibility.

Guardrail: do not treat words like “proporção” (proportion), “percentual” (percentage), “maior atendimento” (highest service) or “evolução” (evolution) as mere labels. They change the mathematical operation and, consequently, the dataset required.

### 2.2 Select the dataset by meaning, not by textual similarity

The agent must search the catalogue and build a list of candidates before choosing one.

| Criterion                 | Question it must answer                                       |
| ------------------------- | ------------------------------------------------------------ |
| Semantic match            | Does the field represent exactly the requested concept?      |
| Granularity               | Does the data exist at the requested geographic level?       |
| Unit                      | Count, percentage, currency, people or another unit?         |
| Temporality               | Is the period compatible with the question?                  |
| Coverage                  | Is there data for the regions that need to be compared?      |
| Denominator               | Can the metric be computed with the available fields?        |
| Provenance                | Are the source and the transformations known?                |
| Completeness              | Do missing or duplicated values invalidate the interpretation? |

Ranking must prioritize semantic correctness and feasibility, not the number of matching words.

A numeric score can help order candidates, but it must not allow a good score to offset a critical mismatch.

Example: a dataset on the number of establishments does not directly answer “qual município tem maior percentual de famílias atendidas” (English: "which municipality has the highest percentage of families served"), even if it contains data about solidarity kitchens.

#### Decision rule for the variable

Direct match

The field represents the requested variable, in the appropriate unit and granularity. Proceed.

Derivable variable

There are enough fields, a defined formula and a valid denominator. Compute and test the metric.

Proxy or approximation

Only a correlated or partially related variable exists. Do not present it as equivalent; ask for confirmation or explain the limitation.

No support in the data

There is no adequate source and no defensible derivation. Refuse the generation as if the question had been answered.

An important case: if the user asks for a coverage rate, it is not enough to find a field with “cobertura” (coverage) in its name. It is necessary to verify the definition of the numerator, the denominator and the reference population.

### 2.3 Verify the API before generating the spec

Catalogue queries and data queries have different responsibilities.

The catalogue helps discover candidates; the API confirms whether they can be obtained and used.

The skill must verify:

- Valid endpoint and dataset identifier.
- Fields present in the real response, including types and units when available.
- Quantity and representativeness of the returned rows.
- Geographic keys, uniqueness and join compatibility.
- Fields required for derived operations.
- Pagination, filters and API limits.
- Dates, null values, zero denominators and inconsistencies.
- Compatibility with the data-attachment mechanisms of the `VisualizationSpec`.

Important guardrail: the absence of a field in the first endpoint consulted does not prove that the variable does not exist. The flow must check documented alternative endpoints, relations between datasets and allowed transformations.

However, it must also not invent a route, assume that two fields are equivalent, or presume that a transformation is possible just because it seems mathematically reasonable.

### 2.4 Compute the data classes correctly

Class computation must not be an isolated decision of the model. The strategy must be compatible with the distribution of the data and with the analytical intent.

Examples of cartographic classification strategies

[PPT - Choropleth Map PowerPoint Presentation, free download - ID:9474399](https://images.openai.com/static-rsc-4/4qO-iC2CAaHhU_HJXCstkKSj8gAoxAHKecISIeRXRGtAq9ekO9yMhCt0LfAIu7XuPeuDaWnfdK7vAnLGKdqo8qi80n0EVHEST16bf1tjSQ8PhFGDLU5H97-8xq_iYxyi3tiwjlYBy9Rpn9dsnLEwyhfwqpPz2kCWrUtLGt7kE9I?purpose=inline)

Equal intervals

Useful when the range has a relevant interpretation. They can leave many regions concentrated in a few classes in skewed distributions.

[Mapping – Data Science](https://images.openai.com/static-rsc-4/fPv4xLFyQ7X1CfKiJczZoAs0Zky7dSVcuWpBn8fuOkojVwZt4wd3srTGbj5ht2Ktpxe2qgk9WJj5v-UwyD5SQ6-swkQ59UA5GFGPJBZhmU4_3XSbJSAxjcFvOOkekcdh-5IlxYJ4oo3xUd6b3X7NJCFU-zpBNppgURvdOjRT8Pk?purpose=inline)

Quantiles

They distribute approximately the same number of observations per class. They can group very close values and separate similar values into different classes.

[Full article: Visualising population distribution with choropleth maps: which classification methods are suitable for South African population data?](https://images.openai.com/static-rsc-4/Z3CEoEzgmx8oxy4fYGturJiHbUG3RoNVUqX1ppkcUxOYfkRj2kN23WgYkNHwWw0pZ4BuVKWkN50m4bPFWv2kNKhNci2orWdhythdmN9xXqptWP7bYGgsPTdZnrjcKy80jSdy52v8j7s_I_HwuBkBuRpNErBADGjawUlPQoEDhWY?purpose=inline)

Natural breaks (Jenks)

They aim to reduce the variation within classes. They are useful for certain distributions, but do not guarantee comparability between different maps.

The selection must consider the meaning of the variable, the distribution, the number of observations, the extreme values and the need to compare periods.

The tests must verify, at a minimum:

- Ordered limits, consistent with the data.
- Classes without improper intervals, overlaps or inconsistent limits.
- Number of classes compatible with the schema and with visual reading.
- Explicit handling of nulls, zeros and extreme values.
- Correspondence between `thresholds`, `colors`, `property` and the scale declared in the legend.
- Appropriate scale semantics: quantitative or categorical.
- Reproducibility of the computation for the same dataset and configuration.

A classification must not be chosen just because it is easy to implement. Nor should one presume that Jenks or quantiles are always superior: the choice depends on the question and the intended interpretation.

Recommended improvement: if the map must support temporal comparison, record the strategy and the class limits in the result. Recomputing quantiles separately for each period can make an identical value appear in different colors.

### 2.5 Generate the best possible representation in the `VisualizationSpec`

Generation must happen after semantic validation and confirmation of data feasibility.

The specification must be evaluated along independent dimensions:

| Dimension    | What to verify                                                 |
| ------------ | -------------------------------------------------------------- |
| Source       | `mapDataId`, endpoint and fields actually available            |
| Geometry     | Polygons, points or another geometry compatible with the entity |
| Association  | Keys, joins, cardinality and geographic coverage               |
| Metric       | Direct field or mathematically justified derivation            |
| Layers       | `sources`, `layers` and consistent references                  |
| Legend       | Scale type, field, limits, colors and labels                   |
| Communication| Title and labels in Portuguese that express the actual metric  |
| Minimality   | Only the fields needed for the requested visualization         |

There is an important precedence rule: a structurally valid specification cannot compensate for a semantically wrong variable.

If the user asks for a choropleth map, the choice of that form must also be compatible with the data: filled areas normally represent values associated with territorial units; points and circles may be more suitable for events or locations.

## 3. Guardrails: what must be guaranteed by code

A robust skill uses the model for interpretation and planning, but leaves deterministic rules under the responsibility of code whenever possible.

| Rule                                      | Preferred owner                        |
| ----------------------------------------- | -------------------------------------- |
| `VisualizationSpec` schema                | Validator                              |
| Allowed IDs and endpoints                 | Source allowlist                       |
| Existence of fields                       | Data verification                      |
| Approved formulas                         | Deterministic functions                |
| Join integrity                            | Data tests                             |
| Scale limits and consistency              | Legend validator                       |
| Match between intent and variable         | Model + evidence + semantic review     |
| Cartographic quality                      | Objective tests + human review         |
| Refusal when data is insufficient         | Explicit decision policy               |

I would add the following gates:

1. Intent gate: was the question interpreted sufficiently to identify the metric?
2. Source gate: does an authorized and accessible source exist?
3. Semantic gate: does the variable match the requested concept, unit and population?
4. Feasibility gate: are the fields, operations and joins possible?
5. Mathematical gate: are the formulas, denominators and handling of missing values valid?
6. Spec gate: does the result respect the contract and the invariants of the application?
7. Rendering gate: is the visualization actually renderable with real data?
8. Evaluation gate: were all required criteria verified with evidence?

Critical gates must be blocking. I do not recommend an average score that lets an incorrect result pass because it got many superficial aspects right.

If a step fails, the agent must receive a structured error with the failure code, the evidence and the allowed actions. This is much more useful for correcting the result than simply asking the model to “try again”.

## 4. The eval must measure the response to the request, not only the quality of the JSON

This is one of the most important points of the project.

I would split the evaluation into three layers, with separate results.

### Layer A — Deterministic tests

Executed by code, without depending on the model's opinion.

- Valid schema.
- Valid source and dataset references.
- Fields available or derivable.
- Consistent formulas and joins.
- Coherent scales and classes.
- Renderable structure.
- No missing required fields.
- No invented sources or variables.

Each rule must have a stable identifier, such as `R-dataset-real`, `R-variable-semantic-match` or `R-legend-consistency`.

### Layer B — Semantic evaluation

Checks whether the result represents the original intent.

Examples of criteria:

- Does the variable measure the requested concept?
- Does the dataset represent the correct population?
- Does the unit of analysis correspond to the requested geography?
- Is the period correct?
- Is the transformation justifiable?
- Do the title and the legend avoid inducing a wrong interpretation?
- Did the agent report the limitations when it used an approximation?

The model can assist in this evaluation, but the criteria must be explicit. A second model saying that the first is correct does not, by itself, constitute independent evidence.

### Layer C — Human evaluation of the map

The reviewer must be able to answer, with the generated file and, ideally, a rendered preview:

> Does this map answer the original question with adequate data and a representation that does not induce a misleading conclusion?

The human evaluator must be able to reject a map even when all automated tests pass.

## 5. Structure of the Markdown file produced by the eval

I recommend that the skill generate one report per case, not only an aggregate report. The individual report makes it possible to understand exactly why a request failed.

`eval-report.md`

Recommended structure example

Artifact

1\. Identification and reproduction

- Original prompt.
- Case identifier.
- Version of the skill, agent, model and schema.
- Catalogue hash and data version.
- Date, duration, cost and number of calls.

  2\. Interpretation of the intent
- Intended metric.
- Unit of analysis.
- Mathematical operation.
- Period and filters.

  3\. Data selection and verification
- Selected dataset and discarded candidates.
- Chosen field and semantic justification.
- API evidence.
- Formula, dependencies, limitations and coverage.

  4\. VisualizationSpec audit
- Full JSON or reference to the artifact.
- Sources, layers, joins and legends.
- Classification strategy and limits.
- Validator results.

  5\. Test results
- Rules passed and failed.
- Evidence and severity per rule.
- Rendering result.
- Comparison with the golden spec, when applicable.

  6\. Human decision
- Answers the question? Yes / Partially / No.
- Data and variable correct? Yes / No / Uncertain.
- Observed problems.
- Justification and visual evidence.

  7\. Correction plan
- Probable cause.
- Responsible layer.
- Proposed change.
- Regression tests required.

A human decision must be mandatory for the set of cases that is intended to be approved as a reference, although it need not block every exploratory run.

The file must clearly distinguish the states not executed, approved, rejected and inconclusive. A test that was not executed must never be counted as passed.

### Example of an evaluation matrix

| Criterion                    | Method              | Expected evidence                        |
| ---------------------------- | ------------------- | ---------------------------------------- |
| Intent interpreted           | Semantic review     | Intent contract                          |
| Appropriate dataset          | Test + review       | Identifier, description and justification |
| Variable without semantic noise | Semantic review  | Field definition and unit                |
| Availability in the API      | Automated test      | Observed response and fields             |
| Valid derivation             | Mathematical test   | Formula, dependencies and result         |
| Coherent classes             | Automated test      | Method, limits and statistics            |
| Valid `VisualizationSpec`    | Validator           | Structured errors and warnings           |
| Functional rendering         | Integration test    | Rendering evidence                       |
| Answers the question         | Human evaluation    | Reasoned verdict                         |

My recommendation is not to add all these results into a single score. An aggregate index can be useful for tracking evolution, but the critical criteria must remain visible and blocking.

## 6. How to turn the results into agent improvements

The operational value of the report exists only if each failure can be traced to a responsible layer.

1\. Diagnose the root cause

Separate interpretation error, catalogue, API, transformation, instruction, validation or rendering. Do not automatically correct the prompt before knowing where the defect originated.

2\. Choose the type of change

Deterministic rule, catalogue adjustment, new transformation function, domain-specific instruction or change to the generic agent.

3\. Run A/B against the baseline

Repeat the same cases with identified versions and compare successes, regressions, cost, latency and validation calls.

4\. Approve before promoting

Require coverage of the critical criteria, absence of serious regressions and human review of the relevant semantic changes.

### Which layer to fix?

| Symptom                                       | Priority fix                                               |
| --------------------------------------------- | ---------------------------------------------------------- |
| Chose a semantically wrong dataset            | Catalogue, candidate retrieval and selection criteria      |
| Chose the correct field but got the formula wrong | Deterministic function and mathematical tests          |
| Invented a field or endpoint                  | Allowlist, API verification and output validation          |
| Produced inconsistent classes                 | Deterministic classification algorithm and validator       |
| Repeatedly generated an invalid spec          | Schema, local repair and output contract                   |
| The spec is valid but does not answer the question | Intent interpretation and semantic evaluation          |
| The map is correct but visually misleading    | Cartographic strategy, legend and visual test              |
| A change solved one case and broke others     | Regression dataset and comparative evaluation              |

Golden rule: do not add an instruction to the prompt to fix something that should be guaranteed by code. Instructions are suitable for contextual decisions; critical invariants must be implemented and tested whenever possible.

## 7. What I would improve in this flow specifically

I consulted the existing skill in the repository, [`geovis-spec-instructions-optimizer/SKILL.md`](https://github.com/TriangulosTecnologia/cozsolidarias/blob/main/.claude/skills/geovis-spec-instructions-optimizer/SKILL.md?utm_source=chatgpt.com), and its reference on the [generation and evaluation pipeline](https://github.com/TriangulosTecnologia/cozsolidarias/blob/main/.claude/skills/geovis-spec-instructions-optimizer/references/spec-generation-pipeline.md?utm_source=chatgpt.com).

It already incorporates valuable practices: versioned and immutable runs, comparison with production references, identification of rules by IDs, coverage gates, cost measurement and proposals for change without automatically altering production.

I would build on that base, but make some distinctions for the new skill.

### 7.1 Do not confuse the golden spec with semantic truth

A reference specification is excellent for testing whether the agent reproduces a known structure. However, it does not prove that the chosen variable correctly answers any new natural-language request.

I would keep two corpora:

- Structural golden: known specifications, renderable and useful for comparing geometry, sources, layers and legends.
- Semantic golden: cases reviewed by humans, containing the original question, the expected metric, the acceptable datasets, the fields, the allowed transformations and the alternatives that must be rejected.

The second corpus is essential for measuring the quality of variable selection.

### 7.2 Separate the generic agent from the application-specific logic

The division between the generic instructions of `@ttoss/geovis` and the domain rules of CozSolidárias must be preserved.

The generic agent must know the contract of the `VisualizationSpec` and the general rules of cartographic representation. The application, in turn, must provide the catalogue, the allowed sources, the endpoints and the domain transformations.

When a rule can be expressed in code and shared by other applications, it is worth evaluating its implementation in the library or in the common validators, instead of replicating it in instructions.

### 7.3 Treat the generation of Markdown as a product step

The Markdown must not be merely a narrative produced by the same model that generated the map.

I would generate the report from structured artifacts:

- Original output of the agent.
- Validator results.
- Evidence from API queries.
- Computed metrics.
- Execution metadata.
- Human verdict recorded separately.

Thus, the report can be regenerated without running the model again, and the conclusions do not depend exclusively on an explanation written by the agent itself.

### 7.4 Introduce abstention evaluation

A good agent needs to know when it cannot answer.

Include cases in which it must refuse the generation or ask for clarification:

- The variable does not exist and cannot be derived.
- The geographic granularity is not available.
- Two plausible metrics with different meanings exist.
- The population of the denominator does not correspond to the population of the numerator.
- The request requires temporal comparison without comparable data.
- The field exists, but its definition is not sufficient to determine its meaning.

The metric is not only how many times the agent generates a map. It is also how many times it avoids generating an incorrect map.

### 7.5 Make the agent improvement experimental and reproducible

Each change must have an explicit hypothesis, for example:

> A validação semântica da variável reduz a escolha de datasets inadequados sem aumentar excessivamente o custo ou as recusas indevidas.

(English: "Semantic validation of the variable reduces the choice of inadequate datasets without excessively increasing cost or improper refusals.")

The experiment must measure:

- Rate of correct dataset selection.
- Rate of semantic correspondence of the variables.
- Success rate of the transformations.
- Rate of validity and rendering.
- Rate of semantically correct responses.
- False refusals and correct refusals.
- Cost per case, latency and number of calls.
- Regressions in previously approved cases.

A change should only be recommended if there is sufficient evidence of improvement, not simply because the new prompt seems more complete.

## 8. Completion criteria of the skill

I would consider the implementation ready for a first version when the following requirements were met.

## Acceptance checklist

0/16 completed

Interpretation and data

Produces a structured contract of the user's intent.

Selects datasets with semantic justification and considers alternatives.

Verifies the API, the fields, the granularity and the coverage.

Distinguishes direct field, derived variable, proxy and absence of support.

Generation and validation

Generates a VisualizationSpec compatible with the contract and the schema.

Computes or validates the classes and the legends with explicit criteria.

Runs the structural validators and the data tests.

Verifies the rendering and the correspondence with the intent.

Evaluation and improvement

Runs a versioned and reproducible eval corpus.

Generates Markdown with evidence, failures and human decision.

Allows recording approval, rejection and human justification.

Produces correction proposals and measures results against the baseline.

Operational security

Prevents unauthorized sources and endpoints.

Does not record secrets or unnecessary sensitive data in the reports.

Limits attempts, duration, tokens and cost.

Does not promote changes to the production agent without approval.

Copy checklist · Create implementation plan

## Conclusion

I would follow an incremental approach:

1. First: establish the intent contract, the semantic selection of datasets and the real verification of the API.
2. Then: guarantee mathematical derivation, cartographic classification and deterministic validation of the `VisualizationSpec`.
3. Next: create the semantic eval corpus, the evidence-based Markdown report and the human review.
4. Last: automate failure analysis, change proposals and A/B experiments.

In my assessment, the highest-impact improvement is to make the semantic correctness of the variable a formal, testable criterion, instead of a property presumed from the validity of the JSON or from the textual similarity with the request.

And there is a strategic question worth resolving before implementing: what will be considered the source of truth when the catalogue, the API and the model's interpretation disagree?

My recommendation is to establish an explicit hierarchy: observed data and metadata for facts about availability; approved domain definitions for the meaning of the metrics; deterministic code for invariants; and human review for semantic ambiguities that cannot be safely resolved. This hierarchy reduces hallucinations without turning the skill into a rigid system incapable of answering new requests.

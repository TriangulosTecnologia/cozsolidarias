# Canonical brand state

Use `brand-spec.json` as the sparse durable operating contract for future brand work. Persist only information whose absence would materially increase future drift.

Canonical template: `templates/brand-spec.template.json`.

## Version fields

Keep schema compatibility separate from brand evolution:
- `meta.schema_version` — structural schema version. Current canonical schema is `4`.
- `meta.version` — this brand contract's semantic version, starting independently from the schema (for example `1.0.0`).

Increment `meta.version` when durable brand meaning/rules change. Do not change `meta.schema_version` for ordinary brand evolution.

Legacy specs without `meta.schema_version` remain operable and are interpreted using their historical `meta.version` shape until a meaningful migration occurs.

## Core contract

A schema-v4 contract keeps only the always-useful decision core:
- `meta` — schema version, brand-contract version, brand identity, maturity and declared touchpoints;
- `strategy` — brand job, audience, offer truth, alternatives, position, right to win and desired meaning;
- `creative_direction` — thesis, principles and signature.

Add expression/evidence/domain blocks only when they are materially active:
- `verbal`;
- `visual`;
- `evidence`;
- `naming`;
- `architecture`;
- `portfolio_summary`;
- other medium-specific rules that future operators genuinely need.

Absence means “not material to this contract,” not “forgot to complete the template.”

## Sparse-state rule

Do not persist:
- rejected or superseded creative routes;
- prompts or internal reasoning transcripts;
- generic desk-research notes;
- routine trial applications after they have done their job;
- every source consulted;
- framework outputs that do not govern future work;
- empty placeholder sections;
- a field merely because another brand might need it.

Persist a rationale only when future operators would otherwise be likely to change a consequential decision for the wrong reason. Prefer concise causal language over a rationale field attached to every object.

## Strategy fields

### `brand_job`
The business/organizational transition the brand must help produce. This is not a mission statement.

### `audience`
Who the system primarily needs to serve. Add a not-for boundary only when it materially improves future judgment.

### `offer_truth`
The relevant truth about the product, service or organization that expression must not contradict.

### `alternatives`
The meaningful alternatives/category context against which the brand must be understood. Keep only decision-changing alternatives.

### `position`
The intended place/meaning the brand should establish relative to those alternatives. Do not store a slogan here unless the slogan itself is the durable strategic decision.

### `right_to_win`
The credible basis that makes the position defensible. Reference evidence only when future work needs provenance.

### `desired_meaning`
What the designed system intends to make understandable/associable. Actual achieved perception remains an external claim.

## Creative direction fields

Keep the durable direction compact:
- `thesis` — governing expressive idea;
- `principles` — only behavioral rules that materially change choices;
- `signature` — characteristic behavior/cue that helps the system cohere.

Add `excludes` only when likely false routes/collisions need to be prevented in future work.

Do not persist an exploration history. A future operator needs the selected grammar, not all discarded candidates.

## Evidence

Add `evidence` only for consequential factual/observational/hypothesis records that remain relevant to future decisions.

Recommended shape:

```json
{
  "id": "E-001",
  "claim": "...",
  "kind": "fact | observation | hypothesis",
  "source": "...",
  "status": "active | challenged | superseded"
}
```

Rules:
- keep IDs stable and unique;
- preserve uncertainty in downstream claims;
- challenge or supersede evidence before changing dependent contract decisions;
- do not use confidence labels when they do not change action;
- do not store ordinary research simply to prove that research happened.

When a core decision materially depends on a stored record, add `evidence_refs` to that decision object. Do not add empty `evidence_refs` arrays everywhere.

## Verbal and visual blocks

Use open objects rather than forcing every brand into the same inventory.

Examples of legitimate keys when needed:
- `verbal.principles`, `verbal.tone_by_moment`, `verbal.message_behavior`, `verbal.excludes`;
- `visual.identity_grammar`, `visual.typography`, `visual.palette`, `visual.logo`, `visual.imagery`, `visual.iconography`, `visual.composition`, `visual.motion`, `visual.tokens`, `visual.contrast_pairs`.

When a visual decision governs future work, persist the durable behavior or relationship another operator needs, not merely the asset or value. Preserve meaningful variation boundaries when their absence would force reinterpretation or drift. Keep examples, channel recipes and one-off application choices out of canonical state.

Exact structures may be domain-specific. Prefer the smallest shape that another competent operator can apply correctly.

## Naming

Add `naming` only when naming is part of the brand contract. Preserve the selected name, its strategic job when needed, material exclusions and dated clearance/linguistic triage. Triage does not become definitive legal clearance merely because it is persisted.

## Architecture / portfolio

Add architecture or portfolio state only for brands that actually participate in a multi-brand relationship. Architecture policy can intentionally require shared cues; similarity is not universally a defect.

`portfolio_summary` is an optional compact projection for comparison workflows. It is not proof of market distinctiveness.

## Production state

For production assets such as a logo, use explicit status when needed:
- `final` — reproducible master exists and applicable production checks can be run;
- `concept` — direction exists but production remains unresolved;
- `external_craft_required` — specialist execution is needed and acceptance criteria/brief should be supplied.

Do not promote raster or generated concepts to `final` because they look polished.

## Machine-checkable structures

When declared:
- design tokens should use a consistent machine-consumable shape and resolvable aliases;
- contrast pairs should reference actual colors used for a real text/UI relationship;
- modular typography should provide enough numbers for its math to be checked;
- custom/fluid typography may use explicit rules without a modular ratio.

Machine validation establishes only those structural/technical properties.

## Migration

Legacy v3/pre-v3 specs remain operable. On the next meaningful CREATE/EVOLVE operation, migrate by **compressing** valid state into schema v4:
- set `meta.schema_version` to `4`;
- start/continue a separate brand-contract `meta.version` deliberately rather than treating schema number as brand history;
- preserve valid strategy, equity and production rules;
- carry forward only evidence still needed for judgment;
- remove exploration history and ceremonial fields;
- omit inactive framework/media blocks;
- do not redesign merely to migrate schema.

APPLY/AUDIT may operate a legacy spec without forcing migration when the existing state is sufficient for the requested artifact.

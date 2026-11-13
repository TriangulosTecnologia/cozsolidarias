# Human review: criteria and questions

Section 6 (**Human decision**) of `eval-report.md` is filled only by a person. The model drafts the
questions and the evidence pointers below; it never answers them. Automated gates can pass while the
map is still wrong, so a passing gate is never a decision.

## Questions

Answer each one with **yes**, **no**, or **unsure**, and cite the artifact or field that supports the answer.

| ID | Question | Evidence to cite |
|---|---|---|
| Q1 | Does the map answer the original question? | Original prompt; `caso-*.spec.json` |
| Q2 | Does the variable match the concept asked for (metric, unit, population)? | `mapDataId`, dataset description in `public/dataset_catalogue.json` |
| Q3 | Is the dataset in `acceptableDatasets` of the semantic golden? (only when an approved entry exists) | `references/goldens/semantic/<caseId>.json` |
| Q4 | Is any proxy or derived value stated openly, with its formula? | Layer titles, legend labels, agent output text |
| Q5 | Is the period correct and comparable with what the question implies? | `spec` time fields, dataset temporal metadata |
| Q6 | Could the title or legend lead a reader to a wrong conclusion (for example, a count shown as people)? | Title, legend labels, `scaleMaxValue` |
| Q7 | Did the agent disclose limitations when it used an approximation? | Agent response message |
| Q8 | Is the map type suited to the data (areas for rates, points or circles for events and totals)? | `mapType`, `geometry`, `form` |
| Q9 | Would the reviewer approve this spec as a reference? | Q1 to Q8 above |

## Decision rules

- **Approved** requires Q1 = yes, Q2 = yes, Q4 and Q6 not problematic, and Q9 = yes.
- Any **no** on Q2 or Q6 means **rejected**, whatever the automated gates say.
- Any **unsure** keeps the state **inconclusive**. It is not approved and not rejected.
- A map that fails only Q7 or Q8 is **rejected** if the defect misleads, otherwise **approved with
  a correction item** in section 7.
- A case with no approved semantic golden can be reviewed, but its decision does not promote anything
  to a reference.

## Record

Write the decision in section 6 with these fields. Leave a field empty until a person fills it.

| Field | Content |
|---|---|
| `reviewer` | Name of the person making the decision |
| `date` | Date of the decision |
| `decision` | `approved`, `rejected`, or `inconclusive` |
| `answers` | Q1 to Q9, each with yes, no, or unsure, and evidence |
| `justification` | One short paragraph with the reason for the decision |

Never fill `reviewer`, `date`, or `decision` from model output.

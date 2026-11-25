import type { SpecIssue } from './specValidation';

/**
 * What a validation issue asks of the next candidate (see the categories
 * table in `openspec/changes/add-spec-recovery-policy/design.md`):
 * `structural` repairs the shape or wiring; `data-resolution` swaps the data
 * for the same concept or declines; `semantic` restores the request;
 * `capability` changes what the user did not choose or declines. A server
 * failure is never an issue, so it has no category.
 *
 * @example
 * const category: IssueCategory = 'semantic';
 */
export type IssueCategory =
  | 'structural'
  | 'data-resolution'
  | 'semantic'
  | 'capability';

/**
 * A {@link SpecIssue} with its {@link IssueCategory}. Server-side only:
 * `errorResponse` strips the category from every response body.
 *
 * @example
 * const issue: CategorizedIssue = { code: 'semantic-drift', message: '...', category: 'semantic' };
 */
export type CategorizedIssue = SpecIssue & { category: IssueCategory };

/** Category order of {@link normalizeIssues}. */
const CATEGORY_ORDER: IssueCategory[] = [
  'structural',
  'data-resolution',
  'semantic',
  'capability',
];

/**
 * The category of every code this route emits. A code missing here (every
 * `@ttoss/geovis` code) is `structural` (see {@link categoryOf}).
 *
 * @example
 * CATEGORY_BY_CODE['period-not-covered']; // 'data-resolution'
 */
export const CATEGORY_BY_CODE: Readonly<Record<string, IssueCategory>> = {
  'invalid-spec-shape': 'structural',
  'unknown-source-url': 'structural',
  'unresolvable-layer-source': 'structural',
  'unknown-basemap-style': 'structural',
  'geometry-in-map-data': 'structural',
  'missing-legend': 'structural',
  'reclassified-official-index': 'structural',
  'multiple-painted-variables': 'structural',
  'legend-count-mismatch': 'structural',
  'points-spec-with-map-data': 'structural',
  'unresolvable-spec': 'data-resolution',
  'period-not-covered': 'data-resolution',
  'ignored-user-map-type': 'semantic',
  'ignored-user-dataset': 'semantic',
  'concept-drift': 'semantic',
  'semantic-drift': 'semantic',
  'completeness-claim-on-partial-coverage': 'semantic',
  'missing-proxy-caveat': 'semantic',
  'missing-default-period-caveat': 'semantic',
  'unsupported-dataset': 'capability',
  'choropleth-on-absolute-total': 'capability',
  'point-layer-on-polygon-source': 'capability',
};

/**
 * The category of an issue code: its {@link CATEGORY_BY_CODE} entry, else
 * `structural`. An inherited object key (`constructor`) is not an entry.
 *
 * @example
 * categoryOf('concept-drift'); // 'semantic'
 * categoryOf('invalid-schema'); // 'structural' (a geovis code)
 */
export const categoryOf = (code: string): IssueCategory => {
  return Object.hasOwn(CATEGORY_BY_CODE, code)
    ? CATEGORY_BY_CODE[code]
    : 'structural';
};

/** The key two issues are equal by, in sort order after the category. */
const keyOf = (issue: SpecIssue): string[] => {
  return [issue.code, issue.path ?? '', issue.message];
};

/** Orders two distinct keys ({@link normalizeIssues} deduplicates first, so they always differ). */
const compareKeys = (left: string[], right: string[]): number => {
  const index = left.findIndex((part, at) => {
    return part !== right[at];
  });
  return left[index] < right[index] ? -1 : 1;
};

/**
 * Makes an issue list a deterministic function of its content: each issue
 * gets its {@link categoryOf} category, issues sharing code, path and message
 * collapse to one, and the rest is ordered by category ({@link IssueCategory}
 * order), then code, path and message (a total order, by code unit).
 *
 * @param issues - Issues in any order, possibly repeated.
 * @returns A new, deduplicated, ordered list; the input is not changed.
 *
 * @example
 * normalizeIssues([
 *   { code: 'unsupported-dataset', message: 'a' },
 *   { code: 'missing-legend', path: 'legends', message: 'b' },
 *   { code: 'missing-legend', path: 'legends', message: 'b' },
 * ]);
 * // → [missing-legend (structural), unsupported-dataset (capability)]
 */
export const normalizeIssues = (issues: SpecIssue[]): CategorizedIssue[] => {
  const unique = new Map<string, CategorizedIssue>();
  for (const issue of issues) {
    const key = JSON.stringify(keyOf(issue));
    if (!unique.has(key)) {
      unique.set(key, { ...issue, category: categoryOf(issue.code) });
    }
  }
  return [...unique.values()].sort((left, right) => {
    return (
      CATEGORY_ORDER.indexOf(left.category) -
        CATEGORY_ORDER.indexOf(right.category) ||
      compareKeys(keyOf(left), keyOf(right))
    );
  });
};

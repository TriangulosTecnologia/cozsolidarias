import type { FilterDomain } from 'src/app/api/ai/spec/fieldFilters';
import { preflightPrompt } from 'src/app/api/ai/spec/preflight';

import filterDomains from '../fixtures/filterDomains.json';
import golden from '../fixtures/preflightGolden.json';

type GoldenCase = {
  input: { prompt: string; datasetId?: string; mapType?: string };
  output: unknown;
};

/**
 * Behaviour lock for the preflight: every recorded prompt must keep producing
 * the exact same verdict, matched against the real snapshots' filter values
 * (`filterDomains.json`). Refactors of the field registry must leave this file
 * untouched; a diff here means behaviour changed.
 */
describe('preflightPrompt golden behaviour', () => {
  test.each(
    (golden as GoldenCase[]).map((c) => {
      return [c.input.prompt, c] as const;
    })
  )('keeps the recorded verdict for "%s"', (_prompt, entry) => {
    const { input, output } = entry;
    expect(
      preflightPrompt({
        prompt: input.prompt,
        datasetId: input.datasetId as never,
        mapType: input.mapType as never,
        filterDomains: filterDomains as FilterDomain[],
      })
    ).toEqual(output);
  });
});

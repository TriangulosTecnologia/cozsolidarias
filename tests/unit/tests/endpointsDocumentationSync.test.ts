import endpoints from 'src/app/api/ai/spec/instructions/endpointsDocumentation.json';
import {
  FILTER_DOC_PATH,
  syncFilterDoc,
} from 'src/app/api/ai/spec/instructions/filterDoc';
import {
  FILTER_FIELDS,
  FILTERABLE_BASES,
} from 'src/app/api/ai/spec/renderableFields';

const docs = endpoints as Array<Record<string, unknown>>;

describe('endpointsDocumentation.json sync', () => {
  test('the committed doc already matches the generator (drift check)', () => {
    expect(syncFilterDoc(docs)).toEqual(docs);
  });

  test('the generated entry names every filterable base and allowlisted field, and no value', () => {
    const usage = String(
      docs.find((item) => {
        return item['path'] === FILTER_DOC_PATH;
      })?.['usage']
    );

    for (const { baseId } of FILTERABLE_BASES) {
      expect(usage).toContain(baseId);
    }
    for (const field of Object.keys(FILTER_FIELDS)) {
      expect(usage).toContain(field);
    }
    expect(usage).not.toMatch(/Habilitada|Mapeada/);
  });

  test('appends the generated entry when the doc has none yet', () => {
    const synced = syncFilterDoc([]);

    expect(synced).toHaveLength(1);
    expect(synced[0]['path']).toBe(FILTER_DOC_PATH);
  });
});

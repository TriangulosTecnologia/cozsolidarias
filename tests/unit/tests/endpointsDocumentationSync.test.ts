import endpoints from 'src/app/api/ai/spec/instructions/endpointsDocumentation.json';
import {
  SITUACAO_DOC_PATH,
  situacaoMapDataIds,
  syncSituacaoDoc,
} from 'src/app/api/ai/spec/instructions/situacaoDoc';

const docs = endpoints as Array<Record<string, unknown>>;

describe('endpointsDocumentation.json sync', () => {
  test('the committed doc already matches the generator (drift check)', () => {
    expect(syncSituacaoDoc(docs)).toEqual(docs);
  });

  test('the generated entry lists every situação mapDataId of the registry', () => {
    const entry = docs.find((item) => {
      return item['path'] === SITUACAO_DOC_PATH;
    });

    expect(situacaoMapDataIds()).toHaveLength(6);
    for (const id of situacaoMapDataIds()) {
      expect(String(entry?.['usage'])).toContain(id);
    }
  });

  test('appends the generated entry when the doc has none yet', () => {
    const synced = syncSituacaoDoc([]);

    expect(synced).toHaveLength(1);
    expect(synced[0]['path']).toBe(SITUACAO_DOC_PATH);
  });
});

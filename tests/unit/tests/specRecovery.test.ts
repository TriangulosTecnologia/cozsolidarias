import {
  changedFields,
  MAX_RECOVERY_ATTEMPTS,
  MAX_TOTAL_VALIDATIONS,
  MAX_VALIDATION_ATTEMPTS,
  semanticDriftIssues,
} from 'src/app/api/ai/spec/specRecovery';

const IVS = {
  mapType: 'choropleth',
  title: 'IVS',
  mapData: [{ mapDataId: 'municipios_ivs' }],
};

describe('recovery budget', () => {
  test('allows one recovery on top of the loop, six validations in all', () => {
    expect(MAX_VALIDATION_ATTEMPTS).toBe(5);
    expect(MAX_RECOVERY_ATTEMPTS).toBe(1);
    expect(MAX_TOTAL_VALIDATIONS).toBe(6);
  });
});

describe('changedFields', () => {
  test('names each of the painted ids, the map type and the layers that differ', () => {
    expect(
      changedFields({ before: IVS, after: { ...IVS, title: 'x' } })
    ).toEqual([]);
    expect(
      changedFields({
        before: IVS,
        after: {
          mapType: 'dotDensity',
          mapData: [{ mapDataId: 'municipios_idhm' }],
          layers: [{ sourceId: 'cozinhas', geometry: 'point' }],
        },
      })
    ).toEqual(['mapDataId', 'mapType', 'layers']);
    expect(
      changedFields({
        before: { ...IVS, layers: [{ sourceId: 'a', geometry: 'point' }] },
        after: { ...IVS, layers: [{ sourceId: 'b', geometry: 'point' }] },
      })
    ).toEqual(['layers']);
  });

  test('reads a candidate that is not an object as one with no fields', () => {
    expect(changedFields({ before: 'text', after: IVS })).toEqual([
      'mapDataId',
      'mapType',
    ]);
    expect(changedFields({ before: 'text', after: 42 })).toEqual([]);
    expect(
      changedFields({ before: { mapData: ['x'] }, after: { mapData: [{}] } })
    ).toEqual([]);
  });
});

describe('semanticDriftIssues', () => {
  const swapped = { ...IVS, mapData: [{ mapDataId: 'municipios_idhm' }] };
  const retyped = { ...IVS, mapType: 'dotDensity' };
  const issue = (code: string) => {
    return { code, message: 'm' };
  };

  test('reports a dataset swap no earlier issue allows', () => {
    expect(
      semanticDriftIssues({
        before: IVS,
        after: swapped,
        issues: [issue('missing-legend'), issue('missing-proxy-caveat')],
      })
    ).toEqual([
      expect.objectContaining({ code: 'semantic-drift', path: 'mapData' }),
    ]);
  });

  test.each(['unresolvable-spec', 'period-not-covered', 'unsupported-dataset'])(
    'allows a dataset swap after a %s issue',
    (code) => {
      expect(
        semanticDriftIssues({
          before: IVS,
          after: swapped,
          issues: [issue(code)],
        })
      ).toEqual([]);
    }
  );

  test('allows a map type change only after a capability issue', () => {
    expect(
      semanticDriftIssues({
        before: IVS,
        after: retyped,
        issues: [issue('choropleth-on-absolute-total')],
      })
    ).toEqual([]);
    expect(
      semanticDriftIssues({
        before: IVS,
        after: retyped,
        issues: [issue('unresolvable-spec')],
      })
    ).toEqual([
      expect.objectContaining({ code: 'semantic-drift', path: 'mapType' }),
    ]);
  });

  test('reports one issue when both the dataset and the map type drift', () => {
    expect(
      semanticDriftIssues({
        before: IVS,
        after: { ...swapped, mapType: 'dotDensity' },
        issues: [],
      })
    ).toHaveLength(1);
  });

  test('leaves a layers change and an unchanged candidate alone', () => {
    expect(
      semanticDriftIssues({
        before: IVS,
        after: { ...IVS, layers: [] },
        issues: [],
      })
    ).toEqual([]);
  });
});

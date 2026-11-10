import {
  applyAppLegendRules,
  splitAgentLegends,
} from 'src/app/api/ai/spec/legendRules';

describe('splitAgentLegends', () => {
  test('splits off the id-less legends the agent wrote', () => {
    expect(
      splitAgentLegends({ legends: [{ title: 'IVS' }, { id: 'l' }] })
    ).toEqual({
      spec: { legends: [{ id: 'l' }] },
      agentLegends: [{ title: 'IVS' }],
    });
  });

  test('leaves a spec with no legends list untouched', () => {
    const spec = { title: 'Mapa' };

    expect(splitAgentLegends(spec)).toEqual({ spec, agentLegends: [] });
  });
});

describe('applyAppLegendRules', () => {
  test('puts the agent text and the official faixas on the legend painting mapData[0]', () => {
    const spec = applyAppLegendRules({
      spec: {
        mapData: [{ mapDataId: 'municipios_idhm', title: 'IDHM' }],
        layers: [{ mapDataId: 'municipios_idhm', activeLegendId: 'l' }],
        legends: [{ id: 'l', title: 'Circle size = IDHM' }],
      },
      agentLegends: [{ title: 'Desenvolvimento humano', subtitle: 'PNUD' }],
    });

    expect(spec['legends']).toEqual([
      expect.objectContaining({
        id: 'l',
        title: 'Desenvolvimento humano',
        subtitle: 'PNUD',
        colorBy: expect.objectContaining({ scale: 'threshold' }),
      }),
    ]);
  });

  test('carries the agent reference and no-data label onto the resolver legend', () => {
    const spec = applyAppLegendRules({
      spec: {
        mapData: [{ mapDataId: 'municipios_cadinsan', title: 'InSAN' }],
        layers: [{ mapDataId: 'municipios_cadinsan', activeLegendId: 'l' }],
        legends: [{ id: 'l', title: 'InSAN', reference: 'geovis' }],
      },
      agentLegends: [
        {
          title: 'InSAN',
          reference: 'Fonte: CadÚnico',
          noDataLabel: 'Sem dado',
        },
      ],
    });

    expect(spec['legends']).toEqual([
      {
        id: 'l',
        title: 'InSAN',
        reference: 'Fonte: CadÚnico',
        noDataLabel: 'Sem dado',
        position: 'bottom-right',
      },
    ]);
  });

  test('keeps a position the resolver already set', () => {
    const spec = applyAppLegendRules({
      spec: {
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas', title: 'N' }],
        layers: [{ mapDataId: 'cozinhas_geolocalizadas', activeLegendId: 'l' }],
        legends: [{ id: 'l', position: 'top-left' }],
      },
      agentLegends: [],
    });

    expect(spec['legends']).toEqual([
      { id: 'l', title: 'N', position: 'top-left' },
    ]);
  });

  test('keeps an agent legend on a spec with no legends or layers yet', () => {
    expect(
      applyAppLegendRules({ spec: {}, agentLegends: [{ title: 'Cozinhas' }] })
    ).toEqual({
      legends: [
        { id: 'legend-1', position: 'bottom-right', title: 'Cozinhas' },
      ],
    });
  });
});

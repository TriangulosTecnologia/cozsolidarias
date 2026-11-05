import {
  buildCozinhasChoroplethSpec,
  isCozinhasChoroplethRequest,
} from 'src/app/api/ai/spec/canonicalChoropleth';
import { coverageNotes } from 'src/app/api/ai/spec/fieldFilters';
import { resolveServedSpec } from 'src/app/api/ai/spec/serveSpec';
import type { CozinhasSituacaoPorMunicipio } from 'src/data-gateway/schema';

import { gateway } from '@/gateway';

// The canonical choropleth path pulls the ESM-only geovis runtime; these specs
// never take it (see aiSpecRoute.test.ts for that path).
jest.mock('src/app/api/ai/spec/canonicalChoropleth', () => {
  return {
    isCozinhasChoroplethRequest: jest.fn().mockReturnValue(false),
    buildCozinhasChoroplethSpec: jest.fn(),
  };
});

const NOTE_2026 =
  'Dados de 2026: apenas situação Habilitada; o snapshot não contém as demais.';

const snapshot = (
  situacoesCobertas: string[] | null
): CozinhasSituacaoPorMunicipio => {
  return {
    situacoesCobertas,
    semLocalizacao: 0,
    porMunicipio: [
      {
        codigoIbge: '111',
        municipio: 'Alpha',
        quantidadePorSituacao: { Habilitada: 2 },
      },
    ],
  };
};

beforeEach(() => {
  jest
    .spyOn(gateway, 'getCozinhasSituacaoPorMunicipio')
    .mockImplementation((year) => {
      return Promise.resolve(snapshot(year === 2025 ? null : ['Habilitada']));
    });
  jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([]);
  jest.spyOn(gateway, 'getIvsPorMunicipio').mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('coverageNotes', () => {
  test('notes an unfiltered base whose snapshot covers only some values', async () => {
    expect(
      await coverageNotes([
        'cozinhas_geolocalizadas',
        'cozinhas_geolocalizadas_2025',
        'cozinhas_geolocalizadas?situacao=Habilitada',
        'municipios_ivs',
      ])
    ).toEqual(new Map([['cozinhas_geolocalizadas', NOTE_2026]]));
  });
});

const serve = (spec: Record<string, unknown>) => {
  return resolveServedSpec({ prompt: 'mapa', spec, agentSpec: spec });
};

describe('resolveServedSpec coverage note (G-6)', () => {
  test('adds the note to the legend of the layer painting the partial dataset only', async () => {
    const served = await serve({
      mapData: [
        { mapDataId: 'cozinhas_geolocalizadas', data: [] },
        { mapDataId: 'municipios_ivs', data: [] },
      ],
      layers: [
        { id: 'a', mapDataId: 'cozinhas_geolocalizadas', activeLegendId: 'la' },
        { id: 'b', mapDataId: 'municipios_ivs', activeLegendId: 'lb' },
      ],
      legends: [
        { id: 'la', title: 'Cozinhas', subtitle: 'Por município' },
        { id: 'lb', title: 'IVS' },
      ],
    });

    expect(served).toMatchObject({
      legends: [
        { id: 'la', subtitle: `Por município · ${NOTE_2026}` },
        { id: 'lb', title: 'IVS' },
      ],
    });
    expect(
      (served as { legends: Array<Record<string, unknown>> }).legends[1]
    ).not.toHaveProperty('subtitle');
  });

  test('notes every legend when no layer links one, and hoists layer legends first', async () => {
    const served = await serve({
      mapData: [{ mapDataId: 'cozinhas_geolocalizadas', data: [] }],
      layers: [{ id: 'a', legends: [{ id: 'la', title: 'Cozinhas' }] }],
    });

    expect(served).toMatchObject({
      legends: [{ id: 'la', subtitle: NOTE_2026 }],
    });
  });

  test('skips entries that are not objects and a layer that links no legend', async () => {
    expect(
      await serve({
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas', data: [] }],
        layers: [null, { id: 'a', mapDataId: 'cozinhas_geolocalizadas' }],
        legends: ['x', { id: 'la' }],
      })
    ).toMatchObject({ legends: ['x', { id: 'la', subtitle: NOTE_2026 }] });
  });

  test('notes the canonical choropleth, whose rebuilt spec renames the mapDataId', async () => {
    jest.mocked(isCozinhasChoroplethRequest).mockReturnValueOnce(true);
    jest.mocked(buildCozinhasChoroplethSpec).mockResolvedValueOnce({
      mapData: [{ mapDataId: 'cozinhas-por-municipio', data: [] }],
      layers: [
        { id: 'a', mapDataId: 'cozinhas-por-municipio', activeLegendId: 'la' },
      ],
      legends: [{ id: 'la', title: 'Cozinhas por município' }],
    });

    expect(
      await serve({
        mapType: 'choropleth',
        mapData: ['junk', { mapDataId: 'cozinhas_geolocalizadas' }],
      })
    ).toMatchObject({ legends: [{ id: 'la', subtitle: NOTE_2026 }] });
  });

  test("never notes a legend another dataset's layer links (F1)", async () => {
    const served = await serve({
      mapData: [
        { mapDataId: 'municipios_ivs', data: [] },
        { mapDataId: 'cozinhas_geolocalizadas', data: [] },
      ],
      layers: [
        {
          id: 'ivs',
          mapDataId: 'municipios_ivs',
          activeLegendId: 'legend-ivs',
        },
        { id: 'pontos', mapDataId: 'cozinhas_geolocalizadas' },
      ],
      legends: [
        { id: 'legend-ivs', subtitle: 'Faixas oficiais do IPEA' },
        { id: 'legend-solta' },
      ],
    });

    expect(served).toMatchObject({
      legends: [
        { id: 'legend-ivs', subtitle: 'Faixas oficiais do IPEA' },
        { id: 'legend-solta', subtitle: NOTE_2026 },
      ],
    });
  });

  test('never notes a 2025 legend next to an unlinked 2026 base', async () => {
    const served = (await serve({
      mapData: [
        { mapDataId: 'cozinhas_geolocalizadas', data: [] },
        { mapDataId: 'cozinhas_geolocalizadas_2025', data: [] },
      ],
      layers: [
        {
          id: 'l25',
          mapDataId: 'cozinhas_geolocalizadas_2025',
          activeLegendId: 'l25',
        },
      ],
      legends: [{ id: 'l25', title: '2025' }],
    })) as { legends: Array<Record<string, unknown>> };

    expect(served.legends[0]).not.toHaveProperty('subtitle');
  });

  test('a legend a layer links without mapDataId is still linked, never orphan-noted', async () => {
    const served = (await serve({
      mapData: [
        { mapDataId: 'municipios_ivs', data: [] },
        { mapDataId: 'cozinhas_geolocalizadas', data: [] },
      ],
      layers: [
        {
          id: 'ivs',
          mapDataId: 'municipios_ivs',
          activeLegendId: 'legend-ivs',
        },
        { id: 'pts', mapDataId: 'cozinhas_geolocalizadas' },
        {
          id: 'circ',
          sourceId: 'paa',
          propertyName: 'n',
          activeLegendId: 'legend-paa',
        },
      ],
      legends: [{ id: 'legend-ivs' }, { id: 'legend-paa' }],
    })) as { legends: Array<Record<string, unknown>> };

    expect(served.legends[0]).not.toHaveProperty('subtitle');
    expect(served.legends[1]).not.toHaveProperty('subtitle');
  });

  test('a link to a legend that does not exist counts as no link (F2)', async () => {
    expect(
      await serve({
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas', data: [] }],
        layers: [
          {
            id: 'a',
            mapDataId: 'cozinhas_geolocalizadas',
            activeLegendId: 'nope',
          },
        ],
        legends: [{ id: 'l', subtitle: '' }],
      })
    ).toMatchObject({ legends: [{ id: 'l', subtitle: NOTE_2026 }] });
  });

  test('a spec with no layers nor legends gets an empty legend list', async () => {
    expect(
      await serve({
        mapData: [{ mapDataId: 'cozinhas_geolocalizadas', data: [] }],
      })
    ).toMatchObject({ legends: [] });
  });

  test('leaves a fully covered snapshot without a note', async () => {
    const spec = {
      mapData: [{ mapDataId: 'cozinhas_geolocalizadas_2025', data: [] }],
      legends: [{ id: 'la', title: 'Cozinhas 2025' }],
    };
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([]);

    expect(await serve(spec)).toMatchObject({
      legends: [{ id: 'la', title: 'Cozinhas 2025' }],
    });
    expect(
      ((await serve(spec)) as { legends: Array<Record<string, unknown>> })
        .legends[0]
    ).not.toHaveProperty('subtitle');
  });
});

import { validateSpec } from '@ttoss/geovis';
import { CANONICAL_SCALES } from 'src/app/api/ai/spec/canonicalScales';
import { POST } from 'src/app/api/ai/spec/route';
import { invalidSpecResponse } from 'src/app/api/ai/spec/specValidation';

import { gateway } from '@/gateway';

jest.mock('@ttoss/geovis', () => {
  return {
    validateSpec: jest.fn().mockReturnValue({ status: 'resolved' }),
  };
});

type ErrorBody = { error?: string };

/** Minimal `legends[]` entry — enough to satisfy `findMissingLegend`. */
const A_LEGEND = [{ id: 'legend-1', title: 'Valor' }];

/**
 * The municipality geometry every `mapData.mapId` below joins against. A
 * `mapType` spec whose `mapId` matches no declared source resolves to an empty
 * map client-side, so fixtures exercising a `mapType` must declare it.
 */
const MUNICIPIOS_SOURCE = [
  {
    id: 'municipios-boundary',
    type: 'geojson',
    data: '/geo/geojs-100-mun.json',
  },
];

const ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AGENT_ID',
  'ANTHROPIC_ENVIRONMENT_ID',
] as const;

const jsonRequest = (body: unknown): Request => {
  return new Request('http://localhost/api/ai/spec', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
};

const jsonResponse = (body: unknown, ok = true): Response => {
  return {
    ok,
    json: () => {
      return Promise.resolve(body);
    },
  } as Response;
};

/** Mocks a full successful session turn whose agent reply is `text`. */
const mockAgentReply = (text: string): jest.Mock => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
    .mockResolvedValueOnce(
      jsonResponse({
        data: [
          { type: 'session.status_idle', stop_reason: { type: 'completed' } },
          { type: 'agent.message', content: [{ type: 'text', text }] },
        ],
      })
    );
  global.fetch = fetchMock;
  return fetchMock;
};

describe('POST /api/ai/spec', () => {
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      process.env[key] = `test-${key}`;
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('rejects a request whose body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/ai/spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{',
    });

    const response = await POST(request);
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Campo "prompt": envie um corpo JSON/);
  });

  test('rejects a request with no prompt field', async () => {
    const response = await POST(jsonRequest({}));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Campo "prompt": campo obrigatório ausente/);
  });

  test('rejects a blank prompt', async () => {
    const response = await POST(jsonRequest({ prompt: '   ' }));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Campo "prompt": não pode ser vazio/);
  });

  test('rejects a prompt field that is null', async () => {
    const response = await POST(jsonRequest({ prompt: null }));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/esperado texto, recebido null/);
  });

  test('rejects a prompt field that is neither a string nor null', async () => {
    const response = await POST(jsonRequest({ prompt: 42 }));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/esperado texto, recebido number/);
  });

  test('rejects a prompt longer than 500 characters', async () => {
    const response = await POST(jsonRequest({ prompt: 'a'.repeat(501) }));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/máximo de 500 caracteres \(recebido 501\)/);
  });

  test('rejects the request when server config is missing', async () => {
    delete process.env['ANTHROPIC_API_KEY'];

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Configuração ausente/);
  });

  test('names every missing env var when more than one is absent', async () => {
    delete process.env['ANTHROPIC_AGENT_ID'];
    delete process.env['ANTHROPIC_ENVIRONMENT_ID'];

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/ANTHROPIC_AGENT_ID, ANTHROPIC_ENVIRONMENT_ID/);
  });

  test('returns a gateway error when the upstream session creation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(502);
    expect(body.error).toMatch(
      /Não foi possível iniciar a sessão com o modelo de IA/
    );
  });

  test('returns a gateway error when session creation returns no id', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(502);
    expect(body.error).toMatch(
      /não retornou um identificador de sessão válido/
    );
  });

  test('falls back to a generic message when the agent failure matches no known cause', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom'));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/Falha de comunicação com o modelo de IA: boom/);
  });

  test('stringifies a non-Error thrown value for the fallback agent-failure message', async () => {
    global.fetch = jest.fn().mockRejectedValue('boom-string');

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(502);
    expect(body.error).toMatch(
      /Falha de comunicação com o modelo de IA: boom-string/
    );
  });

  test('returns a gateway error when the session reports a session.error event', async () => {
    global.fetch = jest
      .fn()
      // createSession
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      // pollForReply
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ type: 'session.error' }] })
      );

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );

    expect(response.status).toBe(502);
  }, 10000);

  test('returns a gateway error when the session goes idle with no agent message', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              type: 'session.status_idle',
              stop_reason: { type: 'completed' },
            },
            // An agent.message with no `content` at all contributes nothing.
            { type: 'agent.message' },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );

    expect(response.status).toBe(502);
  }, 10000);

  test('returns a gateway error when polling for session events fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({}));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );

    expect(response.status).toBe(502);
  }, 10000);

  test('returns a gateway error when the session never reaches a terminal idle state', async () => {
    jest.useFakeTimers();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      // Every poll comes back with no events at all, so the loop runs out
      // its full budget without ever seeing a terminal state.
      .mockResolvedValue(jsonResponse({}));

    const responsePromise = POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );

    // POLL_INTERVAL_MS (1000) * MAX_POLL_ATTEMPTS (60), route.ts's own budget.
    await jest.advanceTimersByTimeAsync(60_000);
    const response = await responsePromise;

    expect(response.status).toBe(502);
  }, 15000);

  test('returns the parsed spec JSON on a full successful turn', async () => {
    const spec = { title: 'Cozinhas por município', mapData: [] };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              type: 'session.status_idle',
              stop_reason: { type: 'completed' },
            },
            {
              type: 'agent.message',
              // A non-text block (e.g. a tool_use echo) must be filtered out,
              // not concatenated into the reply.
              content: [
                { type: 'tool_use' },
                { type: 'text', text: JSON.stringify(spec) },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as { result?: unknown };

    expect(response.status).toBe(200);
    expect(body.result).toEqual(spec);
  }, 10000);

  test('strips a ```json code fence from the model reply before parsing', async () => {
    const spec = { title: 'Cozinhas por município', mapData: [] };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              type: 'session.status_idle',
              stop_reason: { type: 'completed' },
            },
            {
              type: 'agent.message',
              content: [
                {
                  type: 'text',
                  text: '```json\n' + JSON.stringify(spec) + '\n```',
                },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as { result?: unknown };

    expect(response.status).toBe(200);
    expect(body.result).toEqual(spec);
  }, 10000);

  test('returns 422 when the model reply is not valid JSON', async () => {
    global.fetch = jest
      .fn()
      // createSession
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      // pollForReply
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              type: 'session.status_idle',
              stop_reason: { type: 'completed' },
            },
            {
              type: 'agent.message',
              content: [{ type: 'text', text: 'not a json reply' }],
            },
          ],
        })
      );

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/não é um JSON válido/);
  }, 10000);

  test('sends the full dataset catalogue as context, renderable and non-renderable datasets alike', async () => {
    const fetchMock = mockAgentReply(JSON.stringify({ mapData: [] }));

    await POST(jsonRequest({ prompt: 'mapa de cozinhas por município' }));

    const createSessionCall = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    const sentBody = JSON.parse(createSessionCall[1].body) as {
      initial_events: Array<{ content: Array<{ text: string }> }>;
    };
    const catalogueTextWithPrefix = sentBody.initial_events[0].content[0].text;
    const catalogueJsonString = catalogueTextWithPrefix
      .split('\n')
      .slice(1)
      .join('\n');

    // buildCatalogueContext sends the raw CatalogueContract under `catalogue`,
    // plus the renderable id list the INSTRUCTIONS tell the agent to restrict to.
    const catalogueJson = JSON.parse(catalogueJsonString) as {
      renderableDatasets: string[];
      catalogue: { datasets: Array<{ id: string }> };
    };
    const hasDataset = (id: string): boolean => {
      return catalogueJson.catalogue.datasets.some((d) => {
        return d.id === id;
      });
    };

    expect(catalogueJson.renderableDatasets).toContain('municipios_ivs');

    // Every dataset is included, renderable or not — the agent's own
    // instructions restrict which ids it may use for `mapData`.
    expect(hasDataset('caf_areas')).toBe(true);
    expect(hasDataset('municipios_ivs')).toBe(true);

    // ...except the settlement pair, withheld from the agent entirely.
    expect(hasDataset('assentamentos')).toBe(false);
    expect(hasDataset('assentamentos_atributos')).toBe(false);
  }, 10000);

  test('returns 422 when the active legend scale contradicts the resolved values', async () => {
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3550308',
        municipio: 'São Paulo (SP)',
        quantidade: 12,
        pessoasAtendidas: 1000,
        populacao: 12000000,
        porCemMil: 0.14,
        percentualDoBrasil: 0.05,
        pessoasCadUnico: 5000,
        porDezMilCadUnico: 0.9,
        pessoasPorCozinha: 800,
      },
    ]);

    const spec = {
      sources: MUNICIPIOS_SOURCE,
      layers: [
        {
          id: 'fill',
          sourceId: 'municipios-boundary',
          geometry: 'polygon',
          // Outside CANONICAL_SCALES (an absolute total is never a choropleth),
          // so `applyCanonicalScales` leaves the legend alone and the
          // contradiction survives to be reported.
          mapDataId: 'cozinhas_pessoas_atendidas',
          activeLegendId: 'legend-1',
        },
      ],
      // The values resolve to numbers, so a categorical scale is a
      // contradiction the agent cannot see — it never observes a value.
      legends: [
        {
          id: 'legend-1',
          title: 'Pessoas atendidas',
          colorBy: { type: 'categorical' },
        },
      ],
      mapData: [
        {
          mapDataId: 'cozinhas_pessoas_atendidas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de pessoas atendidas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/declara uma escala "categorical"/);
    expect(body.error).toMatch(/valores reais do dataset são "quantitative"/);
  }, 10000);

  test('normalizes the painted scale of a canonical dataset instead of rejecting it', async () => {
    jest.spyOn(gateway, 'getIvsPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3550308',
        municipio: 'São Paulo (SP)',
        ivs: 0.321,
        ivsInfraestruturaUrbana: 0.1,
        ivsCapitalHumano: 0.2,
        ivsRendaETrabalho: 0.3,
        idhm: 0.8,
        idhmLongevidade: 0.85,
        idhmEducacao: 0.75,
        idhmRenda: 0.78,
        idhmEducacaoEscolaridade: 0.7,
        idhmEducacaoFrequencia: 0.9,
      },
    ]);

    const spec = {
      sources: MUNICIPIOS_SOURCE,
      layers: [
        {
          id: 'fill',
          sourceId: 'municipios-boundary',
          geometry: 'polygon',
          mapDataId: 'municipios_ivs',
          activeLegendId: 'legend-1',
        },
      ],
      // A categorical scale over a numeric index, with the model's own copy —
      // the scale is replaced, the copy is kept.
      legends: [
        {
          id: 'legend-1',
          title: 'Vulnerabilidade social',
          colorBy: { type: 'categorical' },
        },
      ],
      mapData: [
        {
          mapDataId: 'municipios_ivs',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de IVS por município' })
    );
    const body = (await response.json()) as {
      result?: { legends?: Array<Record<string, unknown>> };
    };

    expect(response.status).toBe(200);

    const legend = body.result?.legends?.[0];
    expect(legend?.['colorBy']).toEqual(
      CANONICAL_SCALES['municipios_ivs'] && {
        type: 'quantitative',
        property: 'value',
        scale: 'threshold',
        thresholds: CANONICAL_SCALES['municipios_ivs'].thresholds,
        colors: CANONICAL_SCALES['municipios_ivs'].colors,
        defaultColor: '#EEE6DA',
      }
    );
    expect(legend?.['title']).toBe('Vulnerabilidade social');
  }, 10000);

  test('replaces placeholder mapData with real gateway data for a renderable dataset', async () => {
    jest.spyOn(gateway, 'getIvsPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3550308',
        municipio: 'São Paulo (SP)',
        ivs: 0.321,
        ivsInfraestruturaUrbana: 0.1,
        ivsCapitalHumano: 0.2,
        ivsRendaETrabalho: 0.3,
        idhm: 0.8,
        idhmLongevidade: 0.85,
        idhmEducacao: 0.75,
        idhmRenda: 0.78,
        idhmEducacaoEscolaridade: 0.7,
        idhmEducacaoFrequencia: 0.9,
      },
    ]);

    const placeholderSpec = {
      title: 'IVS por município',
      mapData: [
        {
          mapDataId: 'municipios_ivs',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [{ geometryId: 'fictício', value: 999 }],
        },
      ],
      legends: A_LEGEND,
    };

    mockAgentReply(JSON.stringify(placeholderSpec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de IVS por município' })
    );
    const body = (await response.json()) as {
      result?: { mapData?: Array<{ data: Array<{ geometryId: string }> }> };
    };

    expect(response.status).toBe(200);
    expect(body.result?.mapData?.[0].data).toEqual([
      { geometryId: '3550308', value: 0.321 },
    ]);
  }, 10000);

  test('returns 422 when the spec references a dataset outside the renderable list', async () => {
    const unsupportedSpec = {
      title: 'Volume de alimentos',
      mapData: [
        {
          mapDataId: 'caf_areas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };

    mockAgentReply(JSON.stringify(unsupportedSpec));

    const response = await POST(
      jsonRequest({ prompt: 'média de volume de alimentos por pessoa' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/caf_areas/);
  }, 10000);

  test('returns 422 when an API-backed source resolves to no features', async () => {
    jest.spyOn(gateway, 'getCozinhas').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });

    const specWithEmptySource = {
      title: 'Cozinhas comunitárias',
      sources: [{ id: 'cozinhas', type: 'geojson', data: '/api/cozinhas' }],
      legends: A_LEGEND,
    };

    mockAgentReply(JSON.stringify(specWithEmptySource));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas comunitárias' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/cozinhas/);
  }, 10000);

  test('resolves cozinhas_geolocalizadas via the default-year fetcher', async () => {
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3550308',
        municipio: 'São Paulo (SP)',
        quantidade: 12,
        pessoasAtendidas: 1000,
        populacao: 12000000,
        porCemMil: 0.14,
        percentualDoBrasil: 0.05,
        pessoasCadUnico: 5000,
        porDezMilCadUnico: 0.9,
        pessoasPorCozinha: 800,
      },
    ]);

    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as {
      result?: { mapData?: Array<{ data: Array<{ value: number }> }> };
    };

    expect(response.status).toBe(200);
    expect(gateway.getCozinhasPorMunicipio).toHaveBeenCalledWith();
    expect(body.result?.mapData?.[0].data).toEqual([
      { geometryId: '3550308', value: 12 },
    ]);
  }, 10000);

  test('resolves cozinhas_geolocalizadas_2025 via the 2025-year fetcher', async () => {
    const getCozinhasSpy = jest
      .spyOn(gateway, 'getCozinhasPorMunicipio')
      .mockResolvedValue([
        {
          codigoIbge: '3550308',
          municipio: 'São Paulo (SP)',
          quantidade: 20,
          pessoasAtendidas: 1500,
          populacao: 12000000,
          porCemMil: 0.2,
          percentualDoBrasil: 0.08,
          pessoasCadUnico: 5200,
          porDezMilCadUnico: 1.1,
          pessoasPorCozinha: 600,
        },
      ]);

    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas_2025',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas 2025 por município' })
    );
    const body = (await response.json()) as {
      result?: { mapData?: Array<{ data: Array<{ value: number }> }> };
    };

    expect(response.status).toBe(200);
    expect(getCozinhasSpy).toHaveBeenCalledWith(2025);
    expect(body.result?.mapData?.[0].data).toEqual([
      { geometryId: '3550308', value: 20 },
    ]);
  }, 10000);

  test('resolves cozinhas_pessoas_atendidas via the people-served fetcher, carrying a pt-BR label and a legend', async () => {
    jest.spyOn(gateway, 'getCozinhasPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3550308',
        municipio: 'São Paulo (SP)',
        quantidade: 12,
        pessoasAtendidas: 1000,
        populacao: 12000000,
        porCemMil: 0.14,
        percentualDoBrasil: 0.05,
        pessoasCadUnico: 5000,
        porDezMilCadUnico: 0.9,
        pessoasPorCozinha: 800,
      },
    ]);

    // Acceptance criteria for issue #52: the accepted spec must carry a
    // human-readable pt-BR `label` (never the raw dataset/field id) and a
    // `legends[]` entry — this route must pass both through unchanged.
    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_pessoas_atendidas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          label: 'Pessoas atendidas',
          data: [],
        },
      ],
      legends: [{ id: 'legend-pessoas-atendidas', title: 'Pessoas atendidas' }],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de pessoas atendidas por município' })
    );
    const body = (await response.json()) as {
      result?: {
        mapData?: Array<{ label?: string; data: Array<{ value: number }> }>;
        legends?: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(gateway.getCozinhasPorMunicipio).toHaveBeenCalledWith();
    expect(body.result?.mapData?.[0].data).toEqual([
      { geometryId: '3550308', value: 1000 },
    ]);
    expect(body.result?.mapData?.[0].label).toBe('Pessoas atendidas');
    expect(body.result?.legends).toEqual(spec.legends);
  }, 10000);

  test('resolves municipios_cadinsan via the com-PBF share fetcher, dropping municípios with no share', async () => {
    jest.spyOn(gateway, 'getCadinsanPorMunicipio').mockResolvedValue([
      {
        codigoIbge: '3550308',
        municipio: 'São Paulo (SP)',
        uf: 'SP',
        regiao: 'Sudeste',
        absolutoComPbf: 10,
        absolutoSemPbf: 5,
        cadastrosCadunico: 100,
        proporcaoComPbf: 0.1,
        proporcaoSemPbf: 0.05,
      },
      {
        // No CadÚnico registrations at all: `proporcaoComPbf` is `null`, so
        // this município must be dropped, not sent as a `0`.
        codigoIbge: '3106200',
        municipio: 'Belo Horizonte (MG)',
        uf: 'MG',
        regiao: 'Sudeste',
        absolutoComPbf: 0,
        absolutoSemPbf: 0,
        cadastrosCadunico: 0,
        proporcaoComPbf: null,
        proporcaoSemPbf: null,
      },
    ]);

    const spec = {
      mapData: [
        {
          mapDataId: 'municipios_cadinsan',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de insegurança alimentar por município' })
    );
    const body = (await response.json()) as {
      result?: { mapData?: Array<{ data: Array<{ value: number }> }> };
    };

    expect(response.status).toBe(200);
    expect(body.result?.mapData?.[0].data).toEqual([
      { geometryId: '3550308', value: 0.1 },
    ]);
  }, 10000);

  test('accepts geojson sources that reference known geometry endpoints', async () => {
    const spec = {
      sources: [
        // Not a record at all — must be skipped, not crash the loop. The
        // schema-level gate downstream is what rejects it.
        'not-a-source',
        { id: 'municipios', type: 'geojson', data: '/geo/estados.json' },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de estados do Brasil' })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test('returns 422 when a source declares a type this route does not serve', async () => {
    const spec = {
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/estados.json' },
        { id: 'points', type: 'raster' },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de estados do Brasil' })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/points \(raster\)/);
  }, 10000);

  test('returns 422 when a mapType joins no declared source (would render blank)', async () => {
    const spec = {
      mapType: 'choropleth',
      sources: MUNICIPIOS_SOURCE,
      mapData: [
        {
          mapDataId: 'municipios_ivs',
          mapId: 'fonte-inexistente',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa coroplético de IVS por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/o mapa renderiza vazio, sem erro/);
  }, 10000);

  test('returns 422 when a variable is painted onto the state context layer', async () => {
    const spec = {
      sources: [{ id: 'estados', type: 'geojson', data: '/geo/estados.json' }],
      layers: [
        {
          id: 'estados-fill',
          sourceId: 'estados',
          geometry: 'polygon',
          mapDataId: 'municipios_ivs',
        },
      ],
      mapData: [{ mapDataId: 'municipios_ivs', mapId: 'estados', data: [] }],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de IVS por estado' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/é de contorno de estados/);
  }, 10000);

  test('returns 422 when a layer declares both mapDataId and propertyName', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      layers: [
        {
          id: 'fill',
          sourceId: 'municipios-boundary',
          geometry: 'polygon',
          mapDataId: 'municipios_ivs',
          propertyName: 'ivs',
        },
      ],
      mapData: [
        { mapDataId: 'municipios_ivs', mapId: 'municipios-boundary', data: [] },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de IVS por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/vínculos de valor mutuamente exclusivos/);
  }, 10000);

  test('returns 422 when a geojson source is an inline, empty FeatureCollection', async () => {
    const spec = {
      sources: [
        {
          id: 'municipios-fictício',
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(jsonRequest({ prompt: 'mapa de municípios' }));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"municipios-fictício"/);
  }, 10000);

  test('returns 422 when a geojson source references a URL outside the known geometry endpoints', async () => {
    const spec = {
      sources: [
        { id: 'inventada', type: 'geojson', data: '/geo/nao-existe.json' },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de uma geometria inventada' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"inventada"/);
  }, 10000);

  test('names the invalid source as "desconhecida" when it has no id', async () => {
    const spec = {
      sources: [{ type: 'geojson', data: '/geo/nao-existe.json' }],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de uma geometria sem id' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"desconhecida"/);
  }, 10000);

  test('returns 422 when basemap.styleUrl is a raster tile template instead of a MapLibre style URL', async () => {
    const spec = {
      basemap: { styleUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
      sources: [],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa com tile raster como basemap' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(
      /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/
    );
  }, 10000);

  test('accepts a spec with no basemap field at all', async () => {
    const spec = {
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa sem basemap customizado' })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test('names the invalid basemap.styleUrl as "desconhecido" when it is not a string', async () => {
    const spec = {
      basemap: { styleUrl: 42 },
      sources: [],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa com styleUrl numérico inválido' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"desconhecido"/);
  }, 10000);

  test('accepts a basemap object with no styleUrl field', async () => {
    const spec = {
      basemap: { visible: false },
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa sem basemap visível e sem styleUrl' })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test('accepts a basemap.styleUrl that matches the known default style', async () => {
    const spec = {
      basemap: { styleUrl: 'https://tiles.openfreemap.org/styles/positron' },
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      mapData: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa com o estilo padrão explícito' })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test("returns 422 when a mapData entry's mapDataId doubles as a sources[].id", async () => {
    const spec = {
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      mapData: [
        {
          mapDataId: 'municipios',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de municípios com geometria em mapData' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"municipios"/);
  }, 10000);

  test('returns 422 when a mapData entry carries an inline FeatureCollection instead of a join value, naming it "desconhecido" without a mapDataId', async () => {
    const spec = {
      mapData: [
        // Skipped, not crashing the scan: not a record at all.
        'not-a-record',
        {
          data: { type: 'FeatureCollection', features: [] },
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa com geometria embutida em mapData' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"desconhecido"/);
  }, 10000);

  test('returns 422 when a point/symbol layer points at a polygon source', async () => {
    const spec = {
      sources: [
        { id: 'municipios', type: 'geojson', data: '/geo/geojs-100-mun.json' },
      ],
      layers: [
        { id: 'cozinhas-pts', sourceId: 'municipios', geometry: 'point' },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'pontos de cozinhas sobre source de municípios' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"cozinhas-pts"/);
    expect(body.error).toMatch(/"municipios"/);
  }, 10000);

  test('returns 422 when a painted variable has no legends[] entry', async () => {
    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município sem legenda' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/legend/);
  }, 10000);

  test('returns 422 when legends is present but empty', async () => {
    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: [],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({
        prompt: 'mapa de cozinhas por município com legenda vazia',
      })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/legend/);
  }, 10000);

  test('returns 422 when a layer points at an activeLegendId no legend declares', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      legends: [{ id: 'legenda-ivs', title: 'IVS' }],
      layers: [
        {
          id: 'fill',
          sourceId: 'municipios-boundary',
          geometry: 'polygon',
          mapDataId: 'cozinhas_geolocalizadas',
          activeLegendId: 'legenda-cozinhas',
        },
      ],
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas com legenda solta' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/activeLegendId/);
  }, 10000);

  test('returns 422 when a legend declares fewer colours than its thresholds require', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      legends: [
        {
          id: 'legenda-cozinhas',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3, 6, 11, 26],
            colors: ['#C6DBEF', '#86BCDC', '#58A0CE', '#2E7CBB', '#1761A8'],
            defaultColor: '#EEE6DA',
          },
        },
      ],
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas com legenda faltando uma cor' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/N\+1 cores/);
  }, 10000);

  test('returns 422 when the active legend colours by a property the join never writes', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      legends: [
        {
          id: 'legenda-cozinhas',
          colorBy: {
            type: 'quantitative',
            property: 'quantidade',
            scale: 'threshold',
            thresholds: [1, 3, 6, 11, 26],
            colors: [
              '#EEE6DA',
              '#C6DBEF',
              '#86BCDC',
              '#58A0CE',
              '#2E7CBB',
              '#1761A8',
            ],
            defaultColor: '#EEE6DA',
          },
        },
      ],
      layers: [
        {
          id: 'fill',
          sourceId: 'municipios-boundary',
          geometry: 'polygon',
          mapDataId: 'cozinhas_geolocalizadas',
          activeLegendId: 'legenda-cozinhas',
        },
      ],
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas colorido por quantidade' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/"value"/);
  }, 10000);

  test('returns 422 when a quantitative legend picks its own "sem dado" colour', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      legends: [
        {
          id: 'legenda-cozinhas',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3, 6, 11, 26],
            colors: [
              '#FFFFFF',
              '#C6DBEF',
              '#86BCDC',
              '#58A0CE',
              '#2E7CBB',
              '#1761A8',
            ],
            defaultColor: '#FFFFFF',
          },
        },
      ],
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas com cinza próprio' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/#EEE6DA/);
  }, 10000);

  test('returns 422 when a quantitative legend omits defaultColor entirely', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      legends: [
        {
          id: 'legenda-cozinhas',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [1, 3, 6, 11, 26],
          },
        },
      ],
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas sem cor de "sem dado"' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/não declara "colorBy.defaultColor"/);
  }, 10000);

  test('returns 422 when a published index is reclassified from the data', async () => {
    const spec = {
      sources: MUNICIPIOS_SOURCE,
      legends: [
        {
          id: 'legenda-ivs',
          colorBy: {
            type: 'quantitative',
            property: 'value',
            scale: 'threshold',
            thresholds: [0.001, 0.19, 0.28, 0.37, 0.46],
            colors: [
              '#EEE6DA',
              '#FCBBA1',
              '#FC7E5E',
              '#EF3B2C',
              '#B81419',
              '#4F000A',
            ],
            defaultColor: '#EEE6DA',
          },
        },
      ],
      layers: [
        {
          id: 'fill',
          sourceId: 'municipios-boundary',
          geometry: 'polygon',
          mapDataId: 'municipios_ivs',
          activeLegendId: 'legenda-ivs',
        },
      ],
      mapData: [
        {
          mapDataId: 'municipios_ivs',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'coroplético de IVS com quebras naturais' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/IPEA/);
  }, 10000);

  test('returns 422 when a dotDensity spec never states its dot ratio', async () => {
    const spec = {
      mapType: 'dotDensity',
      sources: MUNICIPIOS_SOURCE,
      legends: [{ id: 'legenda-pessoas', title: 'Pessoas atendidas' }],
      mapData: [
        {
          mapDataId: 'cozinhas_pessoas_atendidas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'dot density de pessoas atendidas' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/1 ponto = 1\.000 pessoas/);
  }, 10000);

  test('accepts a legend declared at layers[].legends instead of the spec-level legends[]', async () => {
    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      layers: [
        {
          id: 'municipios-boundary',
          legends: [{ id: 'legend-1', title: 'Valor' }],
        },
      ],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({
        prompt: 'mapa de cozinhas por município com legenda na layer',
      })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test('returns 422 when neither spec-level legends[] nor any layers[].legends is declared', async () => {
    const spec = {
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      layers: [{ id: 'municipios-boundary', legends: [] }],
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({
        prompt: 'mapa de cozinhas por município com legenda de layer vazia',
      })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/legend/);
  }, 10000);

  test('returns 422 when an absolute-total dataset is painted as a choropleth', async () => {
    const spec = {
      mapType: 'choropleth',
      sources: MUNICIPIOS_SOURCE,
      mapData: [
        {
          mapDataId: 'cozinhas_pessoas_atendidas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({
        prompt: 'mapa coroplético de pessoas atendidas por município',
      })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/nunca uma variável relativa/);
  }, 10000);

  test('accepts a choropleth mapType whose mapData is not an array (rejected downstream instead)', async () => {
    const spec = {
      mapType: 'choropleth',
      mapData: 'not-an-array',
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa coroplético qualquer' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/campo "mapData" deveria ser uma lista/);
  }, 10000);

  test('skips a non-object mapData entry while scanning for a choropleth-painted absolute total', async () => {
    const spec = {
      mapType: 'choropleth',
      mapData: ['not-an-object'],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa coroplético qualquer' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/O item 0 de "mapData" precisa ser um objeto/);
  }, 10000);

  test('accepts a choropleth mapType whose mapData references no absolute-total dataset', async () => {
    const spec = {
      mapType: 'choropleth',
      sources: MUNICIPIOS_SOURCE,
      mapData: [
        {
          mapDataId: 'cozinhas_geolocalizadas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({ prompt: 'mapa coroplético de cozinhas por município' })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test('accepts an absolute-total dataset painted with a non-choropleth mapType', async () => {
    const spec = {
      mapType: 'proportionalCircles',
      sources: MUNICIPIOS_SOURCE,
      mapData: [
        {
          mapDataId: 'cozinhas_pessoas_atendidas',
          mapId: 'municipios-boundary',
          joinKey: 'codarea',
          data: [],
        },
      ],
      legends: A_LEGEND,
    };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(
      jsonRequest({
        prompt:
          'mapa de círculos proporcionais de pessoas atendidas por município',
      })
    );

    expect(response.status).toBe(200);
  }, 10000);

  test('returns 422 with the geovis issues, defaulting the message, when validateSpec rejects the resolved spec', async () => {
    jest.mocked(validateSpec).mockReturnValueOnce({
      status: 'invalid',
      issues: [
        {
          code: 'invalid-schema',
          subject: { path: 'mapData[0].joinKey' },
          message: 'mapData[0].joinKey is required',
        },
      ],
    });

    mockAgentReply(JSON.stringify({ mapData: [] }));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody & {
      issues?: Array<{ code: string; message: string }>;
    };

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/resposta inválida/);
    expect(body.issues).toEqual([
      {
        code: 'invalid-schema',
        message: 'mapData[0].joinKey is required',
      },
    ]);
  }, 10000);

  test('returns the spec unchanged when it declares no mapData at all', async () => {
    const spec = { title: 'Só o mapa base, sem camada de valores' };
    mockAgentReply(JSON.stringify(spec));

    const response = await POST(jsonRequest({ prompt: 'mapa base do Brasil' }));
    const body = (await response.json()) as { result?: unknown };

    expect(response.status).toBe(200);
    expect(body.result).toEqual(spec);
  }, 10000);

  test('returns 422 when mapData is not an array', async () => {
    mockAgentReply(JSON.stringify({ mapData: 'not-an-array' }));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/campo "mapData" deveria ser uma lista/);
  }, 10000);

  test('returns 422 when a mapData entry has no mapDataId', async () => {
    mockAgentReply(
      JSON.stringify({ mapData: [{ data: [] }], legends: A_LEGEND })
    );

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/precisa ter "mapDataId" em formato de texto/);
  }, 10000);

  test('returns 422 when a mapData entry is not an object', async () => {
    mockAgentReply(
      JSON.stringify({ mapData: ['not-an-object'], legends: A_LEGEND })
    );

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/O item 0 de "mapData" precisa ser um objeto/);
  }, 10000);

  test('returns 422 when the model reply is valid JSON but not an object', async () => {
    mockAgentReply(JSON.stringify(['not', 'an', 'object']));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(
      /deveria ser um objeto JSON representando o spec/
    );
  }, 10000);

  test('falls back to String() for the parse-error detail when JSON.parse throws a non-Error value', async () => {
    const realParse = JSON.parse.bind(JSON);
    jest.spyOn(JSON, 'parse').mockImplementation((text: string) => {
      if (text === 'not a json reply') {
        throw 'boom';
      }
      return realParse(text) as unknown;
    });

    mockAgentReply('not a json reply');

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/não é um JSON válido: boom/);
  }, 10000);
});

describe('invalidSpecResponse', () => {
  test('defaults the message and omits issues/spec when called with no params', async () => {
    const response = invalidSpecResponse();
    const body = (await response.json()) as {
      error?: string;
      issues?: unknown;
      spec?: unknown;
    };

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/resposta inválida/);
    expect(body.issues).toBeUndefined();
    expect(body.spec).toBeUndefined();
  });
});

import { validateSpec } from '@ttoss/geovis';
import { POST } from 'src/app/api/ai/spec/route';
import { invalidSpecResponse } from 'src/app/api/ai/spec/specValidation';

import { gateway } from '@/gateway';

jest.mock('@ttoss/geovis', () => {
  return {
    validateSpec: jest.fn().mockReturnValue({ status: 'resolved' }),
  };
});

type ErrorBody = { error?: string };

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
    )
    .mockResolvedValueOnce(jsonResponse({}));
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
    expect(body.error).toMatch(/Prompt inválido/);
  });

  test('rejects a request with no prompt field', async () => {
    const response = await POST(jsonRequest({}));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Prompt inválido/);
  });

  test('rejects a blank prompt', async () => {
    const response = await POST(jsonRequest({ prompt: '   ' }));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Prompt inválido/);
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

  test('returns a gateway error when the upstream session creation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/Falha ao consultar o modelo de IA/);
  });

  test('returns a gateway error when session creation returns no id', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/Falha ao consultar o modelo de IA/);
  });

  test('returns a gateway error when the session reports a session.error event', async () => {
    global.fetch = jest
      .fn()
      // createSession
      .mockResolvedValueOnce(jsonResponse({ id: 'session_123' }))
      // pollForReply
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ type: 'session.error' }] })
      )
      // deleteSession
      .mockResolvedValueOnce(jsonResponse({}));

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
      )
      // deleteSession
      .mockResolvedValueOnce(jsonResponse({}));

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

    // buildCatalogueContext sends the raw CatalogueContract under `catalogue`.
    const catalogueJson = JSON.parse(catalogueJsonString) as {
      catalogue: { datasets: Array<{ id: string }> };
    };

    // Every dataset is included, renderable or not — the agent's own
    // instructions restrict which ids it may use for `mapData`.
    expect(
      catalogueJson.catalogue.datasets.some((d) => {
        return d.id === 'caf_areas';
      })
    ).toBe(true);
    expect(
      catalogueJson.catalogue.datasets.some((d) => {
        return d.id === 'assentamentos';
      })
    ).toBe(true);
    expect(
      catalogueJson.catalogue.datasets.some((d) => {
        return d.id === 'municipios_ivs';
      })
    ).toBe(true);
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
    };

    mockAgentReply(JSON.stringify(unsupportedSpec));

    const response = await POST(
      jsonRequest({ prompt: 'média de volume de alimentos por pessoa' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/caf_areas/);
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

  test('resolves cozinhas_pessoas_atendidas via the people-served fetcher', async () => {
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
    const body = (await response.json()) as {
      result?: { mapData?: Array<{ data: Array<{ value: number }> }> };
    };

    expect(response.status).toBe(200);
    expect(gateway.getCozinhasPorMunicipio).toHaveBeenCalledWith();
    expect(body.result?.mapData?.[0].data).toEqual([
      { geometryId: '3550308', value: 1000 },
    ]);
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

  test('accepts geojson sources that reference known geometry endpoints, skipping non-geojson entries', async () => {
    const spec = {
      sources: [
        // Not a record at all — must be skipped, not crash the loop.
        'not-a-source',
        // A record, but not a `geojson` source — must be skipped too.
        { id: 'points', type: 'raster' },
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
    mockAgentReply(JSON.stringify({ mapData: [{ data: [] }] }));

    const response = await POST(
      jsonRequest({ prompt: 'mapa de cozinhas por município' })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/precisa ser um objeto com "mapDataId"/);
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

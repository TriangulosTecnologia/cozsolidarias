import { POST } from 'src/app/api/ai/spec/route';

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

    // POLL_INTERVAL_MS (1000) * MAX_POLL_ATTEMPTS (30), route.ts's own budget.
    await jest.advanceTimersByTimeAsync(30_000);
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
    expect(body.error).toMatch(/resposta inválida/);
  }, 10000);
});

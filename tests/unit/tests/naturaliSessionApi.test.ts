import {
  generateInSession,
  isSessionId,
  openSession,
  SESSION_TTL_SECONDS,
} from 'src/app/api/ai/spec/naturaliSessionApi';

const jsonResponse = (body: unknown, ok = true): Response => {
  return {
    ok,
    status: ok ? 200 : 404,
    json: () => {
      return Promise.resolve(body);
    },
    text: () => {
      return Promise.resolve(JSON.stringify(body));
    },
  } as Response;
};

const OWNED = {
  id: 'sess_existing01',
  agent_id: 'agent_1',
  name: 'cozsolidarias-ai-spec',
  status: 'open',
};

const BASE = { apiKey: 'key', projectId: 'proj_1', agentId: 'agent_1' };

const bodyOf = (fetchMock: jest.Mock, callIndex: number): unknown => {
  return JSON.parse(
    String((fetchMock.mock.calls[callIndex][1] as RequestInit).body)
  );
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isSessionId', () => {
  test('accepts the sess_ public id format only', () => {
    expect(isSessionId('sess_V1StGXR8Z5jdHi6B')).toBe(true);
    expect(isSessionId('agent_V1StGXR8Z5jdHi6B')).toBe(false);
    expect(isSessionId('sess_../../x')).toBe(false);
    expect(isSessionId(42)).toBe(false);
  });
});

describe('openSession', () => {
  test('creates an app-named session that expires after the inactivity TTL', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'sess_new000001' }));
    global.fetch = fetchMock;

    const session = await openSession({
      ...BASE,
      signal: AbortSignal.timeout(1000),
    });

    expect(session).toEqual({ sessionId: 'sess_new000001', reused: false });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/sessions'
    );
    expect(bodyOf(fetchMock, 0)).toEqual({
      agent_id: 'agent_1',
      name: 'cozsolidarias-ai-spec',
      auto_generate: false,
      inactivity_ttl_seconds: SESSION_TTL_SECONDS,
    });
    expect(SESSION_TTL_SECONDS).toBe(1800);
  });

  test('reuses an open session created by this app for this agent', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(OWNED));
    global.fetch = fetchMock;

    const session = await openSession({
      ...BASE,
      sessionId: 'sess_existing01',
      signal: AbortSignal.timeout(1000),
    });

    expect(session).toEqual({ sessionId: 'sess_existing01', reused: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('starts a new session when the session reads back as a non-JSON body', async () => {
    const unreadable = {
      ok: true,
      text: () => {
        return Promise.resolve('not json');
      },
    } as Response;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(unreadable)
      .mockResolvedValueOnce(jsonResponse({ id: 'sess_new000001' }));
    global.fetch = fetchMock;

    const session = await openSession({
      ...BASE,
      sessionId: 'sess_existing01',
      signal: AbortSignal.timeout(1000),
    });

    expect(session).toEqual({ sessionId: 'sess_new000001', reused: false });
  });

  test('a transport failure while reading the session body still throws', async () => {
    const reset = {
      ok: true,
      text: () => {
        return Promise.reject(new TypeError('terminated'));
      },
    } as Response;
    global.fetch = jest.fn().mockResolvedValueOnce(reset);

    await expect(
      openSession({
        ...BASE,
        sessionId: 'sess_existing01',
        signal: AbortSignal.timeout(1000),
      })
    ).rejects.toThrow('terminated');
  });

  test('never reads an id outside the Naturali format; it starts a new session', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'sess_new000001' }));
    global.fetch = fetchMock;

    const session = await openSession({
      ...BASE,
      sessionId: 'agent_123',
      signal: AbortSignal.timeout(1000),
    });

    expect(session).toEqual({ sessionId: 'sess_new000001', reused: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/sessions'
    );
  });

  test('keeps the session id when the generation itself fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'sess_new000001' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'msg_1' }))
      .mockResolvedValueOnce(
        jsonResponse({
          generation_id: 'gen_1',
          status: 'failed',
          error: { message: 'provider boom' },
        })
      );
    global.fetch = fetchMock;

    const result = await generateInSession({
      ...BASE,
      message: 'FULL',
      followUpMessage: 'FOLLOW',
      validateCandidate: jest.fn(),
    });

    expect(result).toMatchObject({ sessionId: 'sess_new000001' });
    expect('error' in result).toBe(true);
  });

  test.each([
    ['another agent', { ...OWNED, agent_id: 'agent_other' }],
    ['another name', { ...OWNED, name: 'someone-else' }],
    ['a closed session', { ...OWNED, status: 'closed' }],
    ['an unreadable session', null],
  ])('starts a new session for %s', async (_label, record) => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(record ?? {}, record !== null))
      .mockResolvedValueOnce(jsonResponse({ id: 'sess_new000001' }));
    global.fetch = fetchMock;

    const session = await openSession({
      ...BASE,
      sessionId: 'sess_existing01',
      signal: AbortSignal.timeout(1000),
    });

    expect(session).toEqual({ sessionId: 'sess_new000001', reused: false });
  });
});

describe('generateInSession', () => {
  const completed = jsonResponse({
    generation_id: 'gen_1',
    status: 'completed',
    content: JSON.stringify({ status: 'ok', spec: { engine: 'maplibre' } }),
  });
  const params = {
    ...BASE,
    message: 'FULL MESSAGE',
    followUpMessage: 'FOLLOW UP',
    validateCandidate: jest.fn(),
  };

  test('sends the full message to a new session and returns its id', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'sess_new000001' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'msg_1' }))
      .mockResolvedValueOnce(completed);
    global.fetch = fetchMock;

    const result = await generateInSession(params);

    expect(result).toEqual({
      sessionId: 'sess_new000001',
      reply: { status: 'ok', spec: { engine: 'maplibre' } },
    });
    expect(bodyOf(fetchMock, 1)).toEqual({ message: 'FULL MESSAGE' });
  });

  test('sends only the follow-up to a reused session', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(OWNED))
      .mockResolvedValueOnce(jsonResponse({ id: 'msg_2' }))
      .mockResolvedValueOnce(completed);
    global.fetch = fetchMock;

    const result = await generateInSession({
      ...params,
      sessionId: 'sess_existing01',
    });

    expect(result.sessionId).toBe('sess_existing01');
    expect(bodyOf(fetchMock, 1)).toEqual({ message: 'FOLLOW UP' });
  });
});

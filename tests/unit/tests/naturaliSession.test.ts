import {
  generateSpec,
  MAX_VALIDATION_ATTEMPTS,
} from 'src/app/api/ai/spec/naturaliSession';

const jsonResponse = (body: unknown, ok = true): Response => {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => {
      return Promise.resolve(body);
    },
  } as Response;
};

/** A generation paused on one `validate_spec` call, as Naturali returns it. */
const pausedOn = (
  callId: string,
  spec: unknown,
  toolName = 'validate_spec'
) => {
  return jsonResponse({
    id: 'gen_1',
    status: 'requires_action',
    required_action: {
      type: 'submit_tool_outputs',
      tool_calls: [{ id: callId, tool_name: toolName, args: { spec } }],
    },
  });
};

const completedWith = (spec: unknown) => {
  return jsonResponse({
    id: 'gen_1',
    status: 'completed',
    output: { object: { status: 'ok', spec } },
  });
};

const issues = (count: number) => {
  return Array.from({ length: count }, (_, index) => {
    return { code: `issue-${index}`, message: 'm', path: `p${index}` };
  });
};

const BASE_PARAMS = {
  apiKey: 'key',
  projectId: 'proj_1',
  agentId: 'agent_1',
  message: 'Quero ver o mapa coroplético de cozinhas por município',
};

const submittedBody = (fetchMock: jest.Mock, callIndex: number): unknown => {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body));
};

describe('generateSpec', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('answers validate_spec with the repaired spec and resumes until the agent completes', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(pausedOn('call_1', { engine: 'wrong' }))
      .mockResolvedValueOnce(completedWith({ engine: 'maplibre' }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn().mockReturnValue({
      spec: { engine: 'maplibre' },
      issues: [],
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toEqual({ status: 'ok', spec: { engine: 'maplibre' } });
    expect(validateCandidate).toHaveBeenCalledWith({ engine: 'wrong' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/agents/agent_1/generate?wait=true'
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/agents/agent_1/generate/gen_1/tool-outputs'
    );
    expect(submittedBody(fetchMock, 1)).toEqual({
      tool_outputs: [
        {
          tool_call_id: 'call_1',
          output: { ok: true, spec: { engine: 'maplibre' }, issues: [] },
        },
      ],
    });
  });

  test(`stops after ${MAX_VALIDATION_ATTEMPTS} validate_spec calls that still carry issues, even while they shrink`, async () => {
    const fetchMock = jest.fn();
    for (let call = 1; call <= MAX_VALIDATION_ATTEMPTS; call += 1) {
      fetchMock.mockResolvedValueOnce(
        pausedOn(`call_${call}`, { round: call })
      );
    }
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      const round = (spec as { round: number }).round;
      return { spec, issues: issues(MAX_VALIDATION_ATTEMPTS + 1 - round) };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'max-attempts',
      attempts: MAX_VALIDATION_ATTEMPTS,
      spec: { round: MAX_VALIDATION_ATTEMPTS },
      issues: issues(1),
    });
    expect(validateCandidate).toHaveBeenCalledTimes(MAX_VALIDATION_ATTEMPTS);
    // The first generate plus one resume per non-final call.
    expect(fetchMock).toHaveBeenCalledTimes(MAX_VALIDATION_ATTEMPTS);
  });

  test('stops as soon as a call leaves as many issues as the previous one', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(2) };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toMatchObject({
      status: 'stopped',
      reason: 'no-shrinkage',
      attempts: 2,
      spec: { round: 2 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('answers a call to an unknown tool with an error output instead of validating', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(pausedOn('call_1', {}, 'search_web'))
      .mockResolvedValueOnce(completedWith({ engine: 'maplibre' }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn();

    await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(validateCandidate).not.toHaveBeenCalled();
    expect(submittedBody(fetchMock, 1)).toEqual({
      tool_outputs: [
        {
          tool_call_id: 'call_1',
          output: {
            ok: false,
            issues: [
              {
                code: 'unknown-tool',
                message:
                  'O tool "search_web" não existe; use apenas "validate_spec".',
              },
            ],
          },
        },
      ],
    });
  });

  test('throws when a paused generation carries no id to resume', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      jsonResponse({
        status: 'requires_action',
        required_action: { type: 'submit_tool_outputs', tool_calls: [] },
      })
    );

    await expect(
      generateSpec({ ...BASE_PARAMS, validateCandidate: jest.fn() })
    ).rejects.toThrow(
      'Naturali generation ended with status "requires_action" but no generation id to resume'
    );
  });

  test('throws when a resume request fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(pausedOn('call_1', {}))
      .mockResolvedValueOnce(jsonResponse({}, false));

    await expect(
      generateSpec({
        ...BASE_PARAMS,
        validateCandidate: jest.fn().mockReturnValue({ spec: {}, issues: [] }),
      })
    ).rejects.toThrow('Naturali generate POST responded with status 500');
  });

  test('passes the tool arguments through when they carry no spec key', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'gen_1',
          status: 'requires_action',
          required_action: {
            type: 'submit_tool_outputs',
            tool_calls: [
              { id: 'call_1', tool_name: 'validate_spec', args: 'raw' },
            ],
          },
        })
      )
      .mockResolvedValueOnce(completedWith({}));
    const validateCandidate = jest
      .fn()
      .mockReturnValue({ spec: {}, issues: [] });

    await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(validateCandidate).toHaveBeenCalledWith('raw');
  });

  test('resumes with no outputs when a paused generation lists no tool calls', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'gen_1',
          status: 'requires_action',
          required_action: null,
        })
      )
      .mockResolvedValueOnce(completedWith({}));
    global.fetch = fetchMock;

    await generateSpec({ ...BASE_PARAMS, validateCandidate: jest.fn() });

    expect(submittedBody(fetchMock, 1)).toEqual({ tool_outputs: [] });
  });
});

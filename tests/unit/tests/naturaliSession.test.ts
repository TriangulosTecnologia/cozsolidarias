import {
  generateSpec,
  MAX_TOTAL_VALIDATIONS,
  MAX_VALIDATION_ATTEMPTS,
  RECOVERY_INSTRUCTIONS,
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
    generation_id: 'gen_1',
    status: 'requires_action',
    required_action: {
      type: 'submit_tool_outputs',
      tool_calls: [{ id: callId, tool_name: toolName, args: { spec } }],
    },
  });
};

const completedWith = (spec: unknown) => {
  return jsonResponse({
    generation_id: 'gen_1',
    status: 'completed',
    content: JSON.stringify({ status: 'ok', spec }),
  });
};

/** The reply to saving the user message into the session. */
const messageSaved = () => {
  return jsonResponse({ id: 'msg_1' });
};

const issues = (count: number) => {
  return Array.from({ length: count }, (_, index) => {
    return { code: `issue-${index}`, message: 'm', path: `p${index}` };
  });
};

/** A generation paused on several tool calls at once. */
const pausedOnMany = (calls: Array<[string, unknown, string?]>) => {
  return jsonResponse({
    generation_id: 'gen_1',
    status: 'requires_action',
    required_action: {
      type: 'submit_tool_outputs',
      tool_calls: calls.map(([id, spec, toolName]) => {
        return { id, tool_name: toolName ?? 'validate_spec', args: { spec } };
      }),
    },
  });
};

const declinedWith = (code: string) => {
  return jsonResponse({
    generation_id: 'gen_1',
    status: 'completed',
    content: JSON.stringify({ status: 'error', error: { code, message: 'm' } }),
  });
};

const roundOf = (spec: unknown): number => {
  return typeof spec === 'object' && spec !== null && 'round' in spec
    ? Number(spec.round)
    : 0;
};

const isPainting = (spec: unknown, mapDataId: string): boolean => {
  return JSON.stringify(spec) === JSON.stringify({ mapData: [{ mapDataId }] });
};

const BASE_PARAMS = {
  apiKey: 'key',
  projectId: 'proj_1',
  sessionId: 'sess_test0001',
  signal: AbortSignal.timeout(5000),
  message: 'Quero ver o mapa coroplético de cozinhas por município',
};

const submittedBody = (fetchMock: jest.Mock, callIndex: number): unknown => {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(init.body));
};

/** The output the fetch call at `callIndex` answered its first tool call with. */
const outputOf = (fetchMock: jest.Mock, callIndex: number): unknown => {
  return (
    submittedBody(fetchMock, callIndex) as {
      tool_outputs: Array<{ output: unknown }>;
    }
  ).tool_outputs[0].output;
};

describe('generateSpec', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('answers validate_spec with the repaired spec and resumes until the agent completes', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { engine: 'wrong' }))
      .mockResolvedValueOnce(completedWith({ engine: 'maplibre' }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn().mockReturnValue({
      spec: { engine: 'maplibre' },
      issues: [],
    });

    const onRecovery = jest.fn();

    const reply = await generateSpec({
      ...BASE_PARAMS,
      validateCandidate,
      onRecovery,
    });

    expect(reply).toEqual({ status: 'ok', spec: { engine: 'maplibre' } });
    expect(onRecovery).not.toHaveBeenCalled();
    expect(validateCandidate).toHaveBeenCalledWith({ engine: 'wrong' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/sessions/sess_test0001/messages'
    );
    expect(submittedBody(fetchMock, 0)).toEqual({
      message: BASE_PARAMS.message,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/sessions/sess_test0001/generate?wait=true'
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://api.naturali.ai/v1/projects/proj_1/sessions/sess_test0001/tool-outputs'
    );
    expect(submittedBody(fetchMock, 2)).toEqual({
      generation_id: 'gen_1',
      tool_outputs: [
        {
          tool_call_id: 'call_1',
          output: { ok: true, spec: { engine: 'maplibre' }, issues: [] },
        },
      ],
    });
  });

  test(`answers the ${MAX_VALIDATION_ATTEMPTS}th validation that still has issues with a recovery signal and keeps the turn going`, async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(messageSaved());
    for (let call = 1; call <= MAX_VALIDATION_ATTEMPTS + 1; call += 1) {
      fetchMock.mockResolvedValueOnce(
        pausedOn(`call_${call}`, { round: call })
      );
    }
    fetchMock.mockResolvedValueOnce(completedWith({ round: 6 }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(Math.max(0, 6 - roundOf(spec))) };
    });
    const onRecovery = jest.fn();

    const reply = await generateSpec({
      ...BASE_PARAMS,
      validateCandidate,
      onRecovery,
    });

    expect(reply).toEqual({ status: 'ok', spec: { round: 6 } });
    expect(validateCandidate).toHaveBeenCalledTimes(MAX_TOTAL_VALIDATIONS);
    // Message, generate, then one tool output per call: the 5th is the signal.
    expect(outputOf(fetchMock, 6)).toEqual({
      ok: false,
      recovery_required: true,
      reason: 'max-attempts',
      attempts: MAX_VALIDATION_ATTEMPTS,
      spec: { round: 5 },
      issues: [{ ...issues(1)[0], category: 'structural' }],
      history: [1, 2, 3, 4, 5].map((attempt) => {
        return {
          attempt,
          codes: issues(6 - attempt).map((issue) => {
            return issue.code;
          }),
          changed: [],
        };
      }),
      instructions: RECOVERY_INSTRUCTIONS,
    });
    expect(outputOf(fetchMock, 7)).toEqual({
      ok: true,
      spec: { round: 6 },
      issues: [],
    });
    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(onRecovery).toHaveBeenCalledWith({
      trigger: 'max-attempts',
      attempts: 6,
      firstCandidate: { round: 1 },
      lastCandidate: { round: 6 },
      issues: [],
      outcome: 'ok',
    });
  });

  test("answers a validation that left as many issues as the previous one with a recovery signal, and returns the agent's missing_data reply", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }))
      .mockResolvedValueOnce(declinedWith('missing_data'));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(2) };
    });
    const onRecovery = jest.fn();

    const reply = await generateSpec({
      ...BASE_PARAMS,
      validateCandidate,
      onRecovery,
    });

    expect(outputOf(fetchMock, 3)).toMatchObject({
      recovery_required: true,
      reason: 'no-shrinkage',
      attempts: 2,
      spec: { round: 2 },
    });
    expect(reply).toEqual({
      status: 'error',
      error: { code: 'missing_data', message: 'm' },
    });
    expect(onRecovery).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'no-shrinkage', outcome: 'error' })
    );
  });

  test('ends the turn as recovery-failed when the recovery candidate still has issues, sending no second signal', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }))
      .mockResolvedValueOnce(pausedOn('call_3', { round: 3 }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(roundOf(spec) === 3 ? 3 : 2) };
    });
    const onRecovery = jest.fn();

    const reply = await generateSpec({
      ...BASE_PARAMS,
      validateCandidate,
      onRecovery,
    });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'recovery-failed',
      trigger: 'no-shrinkage',
      attempts: 3,
      spec: { round: 3 },
      issues: issues(3).map((issue) => {
        return { ...issue, category: 'structural' };
      }),
    });
    // No tool output answers the third call.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(onRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 3,
        lastCandidate: { round: 3 },
        outcome: 'recovery-failed',
      })
    );
  });

  test('reports a recovery candidate that swaps the dataset with no allowing issue as semantic-drift', async () => {
    const painting = (mapDataId: string) => {
      return { mapData: [{ mapDataId }] };
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', painting('a')))
      .mockResolvedValueOnce(pausedOn('call_2', painting('a')))
      .mockResolvedValueOnce(pausedOn('call_3', painting('b')));
    const validateCandidate = jest.fn((spec: unknown) => {
      return {
        spec,
        issues: isPainting(spec, 'a')
          ? [{ code: 'missing-legend', path: 'legends', message: 'm' }]
          : [],
      };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toMatchObject({
      status: 'stopped',
      reason: 'recovery-failed',
      spec: painting('b'),
      issues: [expect.objectContaining({ code: 'semantic-drift' })],
    });
  });

  test('accepts a dataset swap after a capability issue, and the reply that repeats the cleared candidate', async () => {
    const painting = (mapDataId: string) => {
      return { mapData: [{ mapDataId }] };
    };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', painting('a')))
      .mockResolvedValueOnce(pausedOn('call_2', painting('a')))
      .mockResolvedValueOnce(pausedOn('call_3', painting('b')))
      .mockResolvedValueOnce(completedWith(painting('b')));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return {
        spec,
        issues: isPainting(spec, 'a')
          ? [{ code: 'unsupported-dataset', path: 'mapData', message: 'm' }]
          : [],
      };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(outputOf(fetchMock, 4)).toEqual({
      ok: true,
      spec: painting('b'),
      issues: [],
    });
    expect(reply).toEqual({ status: 'ok', spec: painting('b') });
  });

  test('answers every other validate_spec call of the exhausting batch with the same signal, without validating it', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(
        pausedOnMany([
          ['call_2', { round: 2 }],
          ['call_3', { round: 3 }],
          ['call_4', { round: 4 }, 'search_web'],
        ])
      )
      .mockResolvedValueOnce(declinedWith('missing_data'));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(2) };
    });

    await generateSpec({ ...BASE_PARAMS, validateCandidate });

    const [signal, repeated, unknown] = (
      submittedBody(fetchMock, 3) as {
        tool_outputs: Array<{ output: unknown }>;
      }
    ).tool_outputs.map((output) => {
      return output.output;
    });
    expect(signal).toMatchObject({ recovery_required: true, attempts: 2 });
    expect(repeated).toEqual(signal);
    expect(unknown).toMatchObject({ ok: false });
    expect(validateCandidate).toHaveBeenCalledTimes(2);
  });

  test('stops as budget-exhausted, without validating it, on a 7th call in a generation that never sent a signal', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(messageSaved());
    for (let call = 1; call <= MAX_TOTAL_VALIDATIONS + 1; call += 1) {
      fetchMock.mockResolvedValueOnce(
        pausedOn(`call_${call}`, { round: call })
      );
    }
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: [] };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'budget-exhausted',
      attempts: MAX_TOTAL_VALIDATIONS,
      spec: { round: 6 },
      issues: [],
    });
    expect(validateCandidate).toHaveBeenCalledTimes(MAX_TOTAL_VALIDATIONS);
  });

  test('stops as budget-exhausted, sending no signal, when the 6th validation exhausts the loop', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(messageSaved());
    for (let call = 1; call <= MAX_TOTAL_VALIDATIONS; call += 1) {
      fetchMock.mockResolvedValueOnce(
        pausedOn(`call_${call}`, { round: call })
      );
    }
    global.fetch = fetchMock;
    // 4, 3, 2, 1 issues, a clean 5th call, then one issue again.
    const validateCandidate = jest.fn((spec: unknown) => {
      const round = roundOf(spec);
      return { spec, issues: issues(round === 6 ? 1 : 5 - round) };
    });
    const onRecovery = jest.fn();

    const reply = await generateSpec({
      ...BASE_PARAMS,
      validateCandidate,
      onRecovery,
    });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'budget-exhausted',
      attempts: MAX_TOTAL_VALIDATIONS,
      spec: { round: 6 },
      issues: [{ ...issues(1)[0], category: 'structural' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TOTAL_VALIDATIONS + 1);
    expect(onRecovery).not.toHaveBeenCalled();
  });

  test('stops as recovery-failed on a 7th call after a recovery, even after a clean 6th validation', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(messageSaved());
    for (let call = 1; call <= MAX_TOTAL_VALIDATIONS + 1; call += 1) {
      fetchMock.mockResolvedValueOnce(
        pausedOn(`call_${call}`, { round: call })
      );
    }
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(Math.max(0, 6 - roundOf(spec))) };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'recovery-failed',
      trigger: 'max-attempts',
      attempts: MAX_TOTAL_VALIDATIONS,
      spec: { round: 6 },
      issues: [],
    });
    expect(validateCandidate).toHaveBeenCalledTimes(MAX_TOTAL_VALIDATIONS);
  });

  test('ends a recovered generation as recovery-failed when the ok reply is not the candidate the last validation cleared', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }))
      .mockResolvedValueOnce(pausedOn('call_3', { round: 3 }))
      .mockResolvedValueOnce(completedWith({ round: 3, title: 'edited' }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: roundOf(spec) === 3 ? [] : issues(2) };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'recovery-failed',
      trigger: 'no-shrinkage',
      attempts: 3,
      spec: { round: 3 },
      issues: [],
    });
  });

  test('ends a recovered generation as recovery-failed when the agent replies ok with no cleared candidate', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }))
      .mockResolvedValueOnce(completedWith({ round: 2 }));
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(2) };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toMatchObject({
      status: 'stopped',
      reason: 'recovery-failed',
      attempts: 2,
      spec: { round: 2 },
    });
  });

  test('turns a deadline that passes after the recovery signal into recovery-failed with the exhausting candidate', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }))
      .mockRejectedValueOnce(timeout);
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(2) };
    });

    const reply = await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(reply).toEqual({
      status: 'stopped',
      reason: 'recovery-failed',
      trigger: 'no-shrinkage',
      attempts: 2,
      spec: { round: 2 },
      issues: issues(2).map((issue) => {
        return { ...issue, category: 'structural' };
      }),
    });
  });

  test('still throws a deadline before any recovery signal, and any other failure after one, reporting it', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockRejectedValueOnce(timeout);
    const validateCandidate = jest.fn((spec: unknown) => {
      return { spec, issues: issues(2) };
    });

    await expect(
      generateSpec({ ...BASE_PARAMS, validateCandidate })
    ).rejects.toThrow('timeout');

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }))
      .mockResolvedValueOnce(pausedOn('call_2', { round: 2 }))
      .mockRejectedValueOnce(new Error('boom'));
    const onRecovery = jest.fn();

    await expect(
      generateSpec({ ...BASE_PARAMS, validateCandidate, onRecovery })
    ).rejects.toThrow('boom');
    expect(onRecovery).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 2, outcome: 'error' })
    );
  });

  test('lets a validation failure end the turn, sending the agent no tool output and counting no attempt', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', { round: 1 }));
    global.fetch = fetchMock;
    const validateCandidate = jest
      .fn()
      .mockRejectedValue(new Error('data unavailable'));

    await expect(
      generateSpec({ ...BASE_PARAMS, validateCandidate })
    ).rejects.toThrow('data unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('answers a call to an unknown tool with an error output instead of validating', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(pausedOn('call_1', {}, 'search_web'))
      .mockResolvedValueOnce(completedWith({ engine: 'maplibre' }));
    global.fetch = fetchMock;
    const validateCandidate = jest.fn();

    await generateSpec({ ...BASE_PARAMS, validateCandidate });

    expect(validateCandidate).not.toHaveBeenCalled();
    expect(submittedBody(fetchMock, 2)).toEqual({
      generation_id: 'gen_1',
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
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(
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
      .mockResolvedValueOnce(messageSaved())
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
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(
        jsonResponse({
          generation_id: 'gen_1',
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
      .mockResolvedValueOnce(messageSaved())
      .mockResolvedValueOnce(
        jsonResponse({
          generation_id: 'gen_1',
          status: 'requires_action',
          required_action: null,
        })
      )
      .mockResolvedValueOnce(completedWith({}));
    global.fetch = fetchMock;

    await generateSpec({ ...BASE_PARAMS, validateCandidate: jest.fn() });

    expect(submittedBody(fetchMock, 2)).toEqual({
      generation_id: 'gen_1',
      tool_outputs: [],
    });
  });
});

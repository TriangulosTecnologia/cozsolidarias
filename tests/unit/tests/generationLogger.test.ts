import { appendFileSync, mkdirSync } from 'node:fs';

import { logGeneration } from 'src/app/api/ai/spec/generationLogger';

jest.mock('node:fs', () => {
  return {
    appendFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

const LOGS_DIR = '/tmp/cozsolidarias-generations';
const TIMESTAMP = new Date('2026-10-29T12:00:00.000Z');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = 'development';
});

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  jest.clearAllMocks();
});

describe('logGeneration', () => {
  test('writes nothing outside development', () => {
    process.env.NODE_ENV = 'production';

    logGeneration({ prompt: 'mapa', reply: {}, timestamp: TIMESTAMP });

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(appendFileSync).not.toHaveBeenCalled();
  });

  test('creates the logs directory recursively before writing', () => {
    logGeneration({ prompt: 'mapa', reply: {}, timestamp: TIMESTAMP });

    expect(mkdirSync).toHaveBeenCalledWith(LOGS_DIR, { recursive: true });
  });

  test("appends one JSON line per day to that day's file", () => {
    logGeneration({
      generationId: 'gen_1',
      prompt: 'mapa de IVS',
      reply: { cause: 'gateway down' },
      timestamp: TIMESTAMP,
    });

    expect(appendFileSync).toHaveBeenCalledWith(
      `${LOGS_DIR}/generations-2026-10-29.jsonl`,
      `${JSON.stringify({
        timestamp: '2026-10-29T12:00:00.000Z',
        generationId: 'gen_1',
        prompt: 'mapa de IVS',
        reply: { cause: 'gateway down' },
      })}\n`
    );
  });

  test('keeps the full prompt and reply, without truncation', () => {
    const prompt = 'x'.repeat(2000);
    const reply = { cause: 'falha', spec: { layers: [] } };

    logGeneration({ prompt, reply, timestamp: TIMESTAMP });

    const [, line] = jest.mocked(appendFileSync).mock.calls[0] as [
      string,
      string,
    ];
    expect(JSON.parse(line)).toMatchObject({ prompt, reply });
  });

  test('writes the entry even when the directory already exists', () => {
    jest.mocked(mkdirSync).mockImplementationOnce(() => {
      throw new Error('EEXIST');
    });

    logGeneration({ prompt: 'mapa', reply: {}, timestamp: TIMESTAMP });

    expect(appendFileSync).toHaveBeenCalledTimes(1);
  });

  test('defaults the timestamp to now when none is given', () => {
    const before = Date.now();

    logGeneration({ prompt: 'mapa', reply: {} });

    const [file, line] = jest.mocked(appendFileSync).mock.calls[0] as [
      string,
      string,
    ];
    const { timestamp } = JSON.parse(line) as { timestamp: string };
    expect(file).toMatch(/generations-\d{4}-\d{2}-\d{2}\.jsonl$/);
    expect(Date.parse(timestamp)).toBeGreaterThanOrEqual(before);
  });
});

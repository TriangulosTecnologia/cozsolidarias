import { appendFileSync, mkdirSync } from 'node:fs';

const LOGS_DIR = '/tmp/cozsolidarias-generations';

const ensureLogsDir = (): void => {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
};

/**
 * Appends one generation to a daily JSONL file under `/tmp`. Development only:
 * prompts are user input, so no other environment writes them.
 *
 * @example
 * logGeneration({ prompt: 'mapa de IVS', reply: { cause: 'gateway down' } });
 */
export const logGeneration = (params: {
  generationId?: string;
  prompt: string;
  reply: unknown;
  timestamp?: Date;
}): void => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  ensureLogsDir();
  const timestamp = params.timestamp || new Date();
  const logEntry = {
    timestamp: timestamp.toISOString(),
    generationId: params.generationId,
    prompt: params.prompt,
    reply: params.reply,
  };

  const filename = `${LOGS_DIR}/generations-${timestamp.toISOString().split('T')[0]}.jsonl`;
  appendFileSync(filename, JSON.stringify(logEntry) + '\n');
};

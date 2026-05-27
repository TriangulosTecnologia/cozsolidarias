import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StaticGreetingSource } from './types';

const GREETING_PATH = join(__dirname, '..', 'data', 'greeting.json');

const isStaticGreetingSource = (
  value: unknown
): value is StaticGreetingSource => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['message'] === 'string' &&
    typeof (value as Record<string, unknown>)['source'] === 'string'
  );
};

/**
 * Reads and validates the static greeting snapshot.
 *
 * @returns The raw source record from `data/greeting.json`.
 * @throws If the file is missing or does not match the expected shape.
 *
 * @example
 * const greeting = await readStaticGreeting();
 * // { message: 'Hello from static source', source: 'static-v0' }
 */
export const readStaticGreeting = async (): Promise<StaticGreetingSource> => {
  const raw = await readFile(GREETING_PATH, 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  if (!isStaticGreetingSource(parsed)) {
    throw new Error(
      `[data-source-static] greeting.json has an unexpected shape: ${JSON.stringify(parsed)}`
    );
  }

  return parsed;
};

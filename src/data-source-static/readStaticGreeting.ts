import greetingData from './data/greeting.json';
import type { StaticGreetingSource } from './types';

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
 * @throws If the data does not match the expected shape.
 *
 * @example
 * const greeting = await readStaticGreeting();
 * // { message: 'Hello from static source', source: 'static-v0' }
 */
export const readStaticGreeting = async (): Promise<StaticGreetingSource> => {
  const parsed: unknown = greetingData;

  if (!isStaticGreetingSource(parsed)) {
    throw new Error(
      `[data-source-static] greeting.json has an unexpected shape: ${JSON.stringify(parsed)}`
    );
  }

  return parsed;
};

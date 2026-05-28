import type { StaticGreetingSource } from '../../data-source-static/types';
import type { GreetingContract } from '../schema';

/**
 * Transforms a source-native greeting record into the canonical app contract.
 *
 * @param source - Raw record from data-source-static.
 * @returns Canonical {@link GreetingContract}.
 *
 * @example
 * toAppGreeting({ message: 'Hello', source: 'static-v0' });
 * // { text: 'Hello' }
 */
export const toAppGreeting = (
  source: StaticGreetingSource
): GreetingContract => {
  return {
    text: source.message,
  };
};

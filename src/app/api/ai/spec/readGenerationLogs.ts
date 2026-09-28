import { readdirSync, readFileSync } from 'node:fs';

const LOGS_DIR = '/tmp/cozsolidarias-generations';

export const readGenerationLogs = (): {
  timestamp: string;
  generationId?: string;
  prompt: string;
  reply: unknown;
}[] => {
  try {
    const files = readdirSync(LOGS_DIR);
    const entries: {
      timestamp: string;
      generationId?: string;
      prompt: string;
      reply: unknown;
    }[] = [];

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const content = readFileSync(`${LOGS_DIR}/${file}`, 'utf-8');
      const lines = content.split('\n').filter((line) => {
        return line.trim();
      });
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip invalid lines
        }
      }
    }

    return entries.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  } catch {
    return [];
  }
};

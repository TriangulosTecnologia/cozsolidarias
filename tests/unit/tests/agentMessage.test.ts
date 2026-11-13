import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildAgentMessage } from 'src/app/api/ai/spec/agentMessage';

const NOTE_LABEL = 'Nota do servidor sobre este pedido:';

describe('buildAgentMessage', () => {
  test('adds the server note, asking the agent to record it in the description', () => {
    const message = buildAgentMessage({
      prompt: 'mapa da fome',
      note: 'Fome não é medida diretamente.',
    });

    expect(message).toContain(`${NOTE_LABEL} Fome não é medida diretamente.`);
    expect(message).toContain('`description`');
    expect(message.endsWith('mapa da fome')).toBe(true);
  });

  test('adds no note section when the server has none', () => {
    expect(buildAgentMessage({ prompt: 'mapa de cozinhas' })).toBe(
      'mapa de cozinhas'
    );
  });

  test('the agent instructions name the note this message carries', () => {
    const instructions = readFileSync(
      join(
        process.cwd(),
        'agents/geovis-spec-generator/instructions/02-fields-resolution.md'
      ),
      'utf-8'
    );

    expect(instructions).toContain(`\`${NOTE_LABEL}\``);
  });
});

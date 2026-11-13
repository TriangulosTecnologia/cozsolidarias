import { INSTRUCTIONS } from 'src/app/api/ai/spec/instructions/instructions';

describe('INSTRUCTIONS', () => {
  test('lists only the Point sources the agent may name, with their params', () => {
    expect(INSTRUCTIONS).toContain('`cozinhas` → /api/cozinhas (aceita ?ano=)');
    expect(INSTRUCTIONS).toContain(
      '`cozinhas-bolhas` → /api/cozinhas/bolhas (aceita ?ano=)'
    );
    expect(INSTRUCTIONS).not.toMatch(/\/api\/cafs|joinKey/);
  });
});

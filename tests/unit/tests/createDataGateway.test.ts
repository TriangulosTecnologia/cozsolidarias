import { createDataGateway } from 'src/data-gateway/createDataGateway';

describe('createDataGateway', () => {
  test('returns the canonical greeting from the default static source', async () => {
    const gateway = createDataGateway();

    const greeting = await gateway.getGreeting();

    expect(greeting).toEqual({ text: expect.any(String) });
    expect(greeting.text.length).toBeGreaterThan(0);
  });
});

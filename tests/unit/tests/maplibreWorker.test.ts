// maplibre-gl ships ESM only, so jest cannot resolve it: the module is stubbed
// as virtual and the test asserts what URL the side effect hands it.
jest.mock(
  'maplibre-gl',
  () => {
    return { setWorkerUrl: jest.fn() };
  },
  { virtual: true }
);

test('points maplibre-gl at its bundled worker module on import', async () => {
  const { setWorkerUrl } = jest.requireMock<{ setWorkerUrl: jest.Mock }>(
    'maplibre-gl'
  );

  await import('src/components/map/maplibreWorker');

  expect(setWorkerUrl).toHaveBeenCalledTimes(1);
  expect(setWorkerUrl.mock.calls[0][0]).toMatch(
    /maplibre-gl\/dist\/maplibre-gl-worker\.mjs$/
  );
});

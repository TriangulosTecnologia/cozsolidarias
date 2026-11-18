jest.mock('next/font/google', () => {
  return {
    Inter: () => {
      return { variable: 'inter' };
    },
    Inter_Tight: () => {
      return { variable: 'inter-tight' };
    },
  };
});

jest.mock('@/app/providers', () => {
  return { Providers: () => {} };
});

const loadLayout = async (siteUrl?: string) => {
  process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
  if (siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  jest.resetModules();
  return import('@/app/layout');
};

test('every page tells search engines not to index or follow it', async () => {
  const { metadata } = await loadLayout();
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

test('metadataBase follows NEXT_PUBLIC_SITE_URL, falling back to localhost', async () => {
  const withEnv = await loadLayout('https://example.org');
  expect(withEnv.metadata.metadataBase?.href).toBe('https://example.org/');
  const withoutEnv = await loadLayout();
  expect(withoutEnv.metadata.metadataBase?.href).toBe('http://localhost:3000/');
});

test('RootLayout renders the document in pt-BR', async () => {
  const element = (await loadLayout()).default({ children: null });
  expect(element.props.lang).toBe('pt-BR');
});

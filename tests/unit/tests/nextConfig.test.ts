import nextConfig from '../../../next.config';

test('every response tells search engines not to index or follow it', async () => {
  expect(await nextConfig.headers?.()).toEqual([
    {
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    },
  ]);
});

test('/marca redirects to the static brand book', async () => {
  expect(await nextConfig.redirects?.()).toEqual([
    {
      source: '/marca',
      destination: '/marca/brand-book.html',
      permanent: false,
    },
  ]);
});

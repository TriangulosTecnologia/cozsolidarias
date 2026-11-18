import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';

import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL('http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title:
    'Cozinha Solidária em Rede — Territórios que alimentam. Dados que fortalecem.',
  description:
    'Plataforma de inteligência territorial para mapear, documentar e apoiar Cozinhas Solidárias no Brasil.',
  openGraph: {
    images: [{ url: '/ogimage.webp' }],
  },
  // Keep the platform out of every search engine. Do not pair this with a
  // robots.txt Disallow: crawlers that cannot fetch a page never see its
  // noindex, and already-indexed URLs would stay in results.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable}`}
    >
      <head />
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

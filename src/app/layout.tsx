import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';

import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
});

export const metadata: Metadata = {
  title:
    'Cozinhas Solidárias — Territórios que alimentam. Dados que fortalecem.',
  description:
    'Plataforma de inteligência territorial para mapear, documentar e apoiar Cozinhas Solidárias no Brasil.',
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

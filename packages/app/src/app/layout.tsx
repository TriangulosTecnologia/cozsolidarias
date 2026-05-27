import { ThemeScript } from '@ttoss/fsl-theme/react';
import type { Metadata } from 'next';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Coz Solidárias',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <ThemeScript defaultMode="system" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

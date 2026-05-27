import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

import { isLocale } from '../config/locales';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Cozinhas Solidárias',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;

  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') ?? '';

  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : acceptLanguage.toLowerCase().includes('pt')
      ? 'pt-BR'
      : 'en';

  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}

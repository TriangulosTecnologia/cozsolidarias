'use client';

import { ChakraProvider } from '@chakra-ui/react';
import type { LoadLocaleData } from '@ttoss/react-i18n';
import { I18nProvider } from '@ttoss/react-i18n';

import { system } from './theme';

const loadLocaleData: LoadLocaleData = async (locale) => {
  switch (locale) {
    case 'pt-BR':
      return (await import('../../i18n/compiled/pt-BR.json')).default;
    default:
      return (await import('../../i18n/compiled/en.json')).default;
  }
};

export const Providers = ({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale?: string;
}) => {
  return (
    <I18nProvider locale={locale} loadLocaleData={loadLocaleData}>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </I18nProvider>
  );
};

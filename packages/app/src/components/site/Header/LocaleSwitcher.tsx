'use client';

import { Button } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';
import * as React from 'react';

import {
  isLocale,
  type Locale,
  LOCALE_CODES,
  LOCALE_SWITCH_LABELS,
} from '../../../config/locales';
import { setLocale } from './LocaleSwitcher.actions';

/**
 * Compact two-state locale toggle button.
 * Displays the target locale code (e.g. `EN` when current locale is `pt-BR`).
 * `aria-label` is expressed in the target locale's language per the UX spec.
 * Invokes the co-located server action on click — no client-side locale state.
 *
 * @example
 * <LocaleSwitcher />
 */
const LocaleSwitcher = () => {
  const [, startTransition] = React.useTransition();
  const { locale } = useI18n();

  const currentLocale: Locale = isLocale(locale) ? locale : 'pt-BR';
  const targetLocale: Locale = currentLocale === 'pt-BR' ? 'en' : 'pt-BR';

  return (
    <Button
      aria-label={LOCALE_SWITCH_LABELS[targetLocale]}
      variant="ghost"
      size="sm"
      minW="40px"
      px={2}
      onClick={() => {
        return startTransition(() => {
          void setLocale(targetLocale);
        });
      }}
    >
      {LOCALE_CODES[targetLocale]}
    </Button>
  );
};

export default LocaleSwitcher;

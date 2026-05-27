'use client';

import { HStack, Link } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';
import NextLink from 'next/link';

import { legalNav } from '../../../config/navigation';

/**
 * Footer legal navigation links (Terms of Use, Cookies).
 * Entries are sourced from `config/navigation.legalNav`.
 *
 * @example
 * <LegalLinks />
 */
const LegalLinks = () => {
  const { intl } = useI18n();
  return (
    <HStack
      as="nav"
      gap={4}
      aria-label={intl.formatMessage({
        defaultMessage: 'Legal navigation',
        description: 'Accessible label for the footer legal navigation.',
      })}
    >
      {legalNav.map((entry) => {
        return (
          <Link key={entry.id} asChild fontSize="sm">
            <NextLink href={entry.href}>
              {intl.formatMessage(entry.label)}
            </NextLink>
          </Link>
        );
      })}
    </HStack>
  );
};

export default LegalLinks;

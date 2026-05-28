import { HStack, Link } from '@chakra-ui/react';
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
  return (
    <HStack as="nav" gap={4} aria-label="Navegação legal">
      {legalNav.map((entry) => {
        return (
          <Link key={entry.id} asChild fontSize="sm">
            <NextLink href={entry.href}>{entry.label}</NextLink>
          </Link>
        );
      })}
    </HStack>
  );
};

export default LegalLinks;

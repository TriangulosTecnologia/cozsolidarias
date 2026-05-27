'use client';

import { HStack } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';

import { mainNav } from '../../../config/navigation';
import NavLink from './NavLink';

/**
 * Horizontal list of main navigation links for the desktop header.
 * Entries are sourced from `config/navigation.mainNav`.
 *
 * @example
 * <NavLinks />
 */
const NavLinks = () => {
  const { intl } = useI18n();
  return (
    <HStack
      as="nav"
      gap={6}
      aria-label={intl.formatMessage({
        defaultMessage: 'Main navigation',
        description: 'Accessible label for the main header navigation.',
      })}
    >
      {mainNav.map((entry) => {
        return <NavLink key={entry.id} href={entry.href} label={entry.label} />;
      })}
    </HStack>
  );
};

export default NavLinks;

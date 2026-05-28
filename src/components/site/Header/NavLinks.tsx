import { HStack } from '@chakra-ui/react';

import { mainNav } from '../../../config/navigation';
import NavLink from './NavLink';

/**
 * Horizontal list of main nav links rendered inside the shared left pill island.
 * No individual wrapper — island context provided by the parent Header.
 * Entries are sourced from `config/navigation.mainNav`.
 *
 * @example
 * <NavLinks />
 */
const NavLinks = () => {
  return (
    <HStack as="nav" gap={0.5} aria-label="Navegação principal">
      {mainNav.map((entry) => {
        return <NavLink key={entry.id} href={entry.href} label={entry.label} />;
      })}
    </HStack>
  );
};

export default NavLinks;

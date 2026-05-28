'use client';

import { Link } from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavEntry } from '../../../config/navigation';

const EXPO_OUT = 'cubic-bezier(0.19, 1, 0.22, 1)';

type Props = Pick<NavEntry, 'href' | 'label'>;

/**
 * Navigation link rendered inside the shared nav pill container.
 * No individual border — active state is a filled highlight within the parent.
 *
 * @example
 * <NavLink href="/sobre" label="Sobre" />
 */
const NavLink = ({ href, label }: Props) => {
  const pathname = usePathname();
  const isCurrent = pathname === href;

  return (
    <Link
      asChild
      display="inline-flex"
      alignItems="center"
      px={3}
      py="6px"
      borderRadius="pill"
      bg={isCurrent ? 'ivory.200' : 'transparent'}
      color={isCurrent ? 'charcoal.900' : 'charcoal.700'}
      fontSize="0.8125rem"
      fontWeight={isCurrent ? '600' : '500'}
      letterSpacing="0.05em"
      textTransform="uppercase"
      textDecoration="none"
      transition={`all 0.5s ${EXPO_OUT}`}
      aria-current={isCurrent ? 'page' : undefined}
      _hover={{ bg: 'ivory.200', color: 'charcoal.900' }}
    >
      <NextLink href={href}>{label}</NextLink>
    </Link>
  );
};

export default NavLink;

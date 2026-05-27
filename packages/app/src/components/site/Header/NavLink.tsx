'use client';

import { Link } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavEntry } from '../../../config/navigation';

type Props = Pick<NavEntry, 'href' | 'label'>;

/**
 * Single navigation link that reflects the active route via `aria-current="page"`.
 * Formats its label descriptor internally via `useI18n`.
 *
 * @example
 * <NavLink href="/sobre" label={messages.sobre} />
 */
const NavLink = ({ href, label }: Props) => {
  const pathname = usePathname();
  const { intl } = useI18n();
  const isCurrent = pathname === href;

  return (
    <Link
      asChild
      aria-current={isCurrent ? 'page' : undefined}
      fontWeight={isCurrent ? 'semibold' : 'normal'}
    >
      <NextLink href={href}>{intl.formatMessage(label)}</NextLink>
    </Link>
  );
};

export default NavLink;

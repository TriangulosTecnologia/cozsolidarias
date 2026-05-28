'use client';

import { Icon as IconifyIcon } from '@iconify/react';

type Props = {
  /** Iconify icon name, e.g. `mdi:menu` or `lucide:x`. */
  name: string;
  /**
   * Icon size. Accepts any CSS length value.
   * @default '1em'
   */
  size?: string | number;
};

/**
 * Thin wrapper around `@iconify/react` that renders any Iconify icon by name.
 * Color always inherits `currentColor` so icons respond to Chakra's `color` prop
 * applied to a parent element.
 *
 * @example
 * <Icon name="mdi:menu" size="1.5rem" />
 * <Icon name="lucide:globe" />
 */
const Icon = ({ name, size = '1em' }: Props) => {
  return (
    <IconifyIcon icon={name} width={size} height={size} color="currentColor" />
  );
};

export default Icon;

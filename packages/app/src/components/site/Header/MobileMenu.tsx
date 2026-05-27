'use client';

import { CloseButton, Drawer, IconButton, VStack } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';
import * as React from 'react';

import { mainNav } from '../../../config/navigation';
import Icon from '../../ui/Icon';
import NavLink from './NavLink';

/**
 * Mobile navigation drawer triggered by a hamburger icon.
 * Renders `mainNav` entries as accessible links inside a slide-in panel.
 *
 * @example
 * <MobileMenu />
 */
const MobileMenu = () => {
  const [open, setOpen] = React.useState(false);
  const { intl } = useI18n();

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(e) => {
        return setOpen(e.open);
      }}
      placement="end"
    >
      <Drawer.Trigger asChild>
        <IconButton
          aria-label={intl.formatMessage({
            defaultMessage: 'Open navigation menu',
            description:
              'Accessible label for the mobile navigation drawer trigger button.',
          })}
          variant="ghost"
        >
          <Icon name="mdi:menu" size="1.5rem" />
        </IconButton>
      </Drawer.Trigger>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header justifyContent="flex-end">
            <Drawer.CloseTrigger asChild>
              <CloseButton />
            </Drawer.CloseTrigger>
          </Drawer.Header>
          <Drawer.Body>
            <VStack
              as="nav"
              gap={6}
              align="start"
              aria-label={intl.formatMessage({
                defaultMessage: 'Navigation menu',
                description:
                  'Accessible label for the mobile navigation links list.',
              })}
            >
              {mainNav.map((entry) => {
                return (
                  <NavLink
                    key={entry.id}
                    href={entry.href}
                    label={entry.label}
                  />
                );
              })}
            </VStack>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
};

export default MobileMenu;

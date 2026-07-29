'use client';

import {
  Box,
  HStack,
  IconButton,
  Link,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { mainNav, type NavEntry } from '../../../config/navigation';
import { BRAND_NAME, EXPO_OUT } from '../../../config/site';

/**
 * A single row in the mobile overlay: a numbered index, the label, and a
 * trailing arrow that slides in on hover. Internal (non-external) links show
 * `→`; external links open in a new tab and show `↗`. The current route is
 * highlighted in the brand green.
 */
const MobileNavItem = ({
  entry,
  index,
  open,
  active,
  onNavigate,
}: {
  entry: NavEntry;
  index: number;
  open: boolean;
  active: boolean;
  onNavigate: () => void;
}) => {
  const external = entry.href.startsWith('http');
  const stagger = `${index * 0.06}s`;

  return (
    <Link
      asChild
      data-group
      display="block"
      py={4}
      borderBottomWidth="1px"
      borderColor="whiteAlpha.200"
      color={active ? 'verde.300' : 'ivory.100'}
      textDecoration="none"
      transition={`opacity 0.5s ${EXPO_OUT} ${stagger}, transform 0.5s ${EXPO_OUT} ${stagger}, color 0.3s ${EXPO_OUT}`}
      opacity={open ? 1 : 0}
      transform={open ? 'none' : 'translateY(12px)'}
      aria-current={active ? 'page' : undefined}
      _hover={{ color: 'verde.300' }}
      onClick={onNavigate}
    >
      <NextLink
        href={entry.href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <HStack justifyContent="space-between" alignItems="center" w="full">
          <HStack gap={4} alignItems="baseline">
            <Text
              as="span"
              fontSize="0.875rem"
              fontWeight="600"
              fontVariantNumeric="tabular-nums"
              letterSpacing="0.1em"
              color={active ? 'verde.400' : 'charcoal.500'}
              transition={`color 0.3s ${EXPO_OUT}`}
              _groupHover={{ color: 'verde.400' }}
            >
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text
              as="span"
              fontSize="clamp(1.75rem, calc(1.4rem + 1.6vw), 2.5rem)"
              fontWeight="700"
              letterSpacing="-0.04em"
              lineHeight="1.1"
              transition={`transform 0.5s ${EXPO_OUT}`}
              _groupHover={{ transform: 'translateX(8px)' }}
            >
              {entry.label}
            </Text>
          </HStack>
          <Box
            as="span"
            aria-hidden
            fontSize="1.5rem"
            lineHeight="1"
            opacity={0.35}
            transform="translateX(-4px)"
            transition={`all 0.5s ${EXPO_OUT}`}
            _groupHover={{ opacity: 1, transform: 'none', color: 'verde.300' }}
          >
            {external ? '↗' : '→'}
          </Box>
        </HStack>
      </NextLink>
    </Link>
  );
};

/**
 * Full-screen navigation overlay, portaled to `<body>` so the header's
 * backdrop-filter (which establishes a containing block for fixed descendants
 * once scrolled) can't reposition it to the header box. Always rendered;
 * visibility is driven by `open` for the enter/exit transition.
 */
const MobileMenuOverlay = ({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string | null;
  onClose: () => void;
}) => {
  return (
    <Portal>
      <Box
        position="fixed"
        inset={0}
        zIndex={60}
        bg="charcoal.900"
        display="flex"
        flexDirection="column"
        px={8}
        py={6}
        transition={`opacity 0.5s ${EXPO_OUT}, transform 0.5s ${EXPO_OUT}`}
        opacity={open ? 1 : 0}
        transform={open ? 'none' : 'translateY(-8px)'}
        pointerEvents={open ? 'auto' : 'none'}
        aria-hidden={!open}
      >
        {/* Header row — eyebrow + close */}
        <HStack justifyContent="space-between" alignItems="center">
          <Text
            color="charcoal.500"
            fontSize="0.75rem"
            fontWeight="600"
            letterSpacing="0.12em"
            textTransform="uppercase"
          >
            Navegação
          </Text>
          <IconButton
            aria-label="Fechar menu"
            variant="ghost"
            color="ivory.100"
            minH="44px"
            minW="44px"
            _hover={{ bg: 'whiteAlpha.200' }}
            onClick={onClose}
          >
            <Box
              as="span"
              display="flex"
              flexDirection="column"
              gap="5px"
              w="22px"
            >
              <Box
                as="span"
                h="2px"
                bg="currentColor"
                transformOrigin="center"
                transform="rotate(45deg) translate(5px, 5px)"
              />
              <Box as="span" h="2px" bg="currentColor" opacity={0} />
              <Box
                as="span"
                h="2px"
                bg="currentColor"
                transformOrigin="center"
                transform="rotate(-45deg) translate(5px, -5px)"
              />
            </Box>
          </IconButton>
        </HStack>

        {/* Link list — vertically centered, hairline-separated rows */}
        <Stack
          as="nav"
          gap={0}
          my="auto"
          borderTopWidth="1px"
          borderColor="whiteAlpha.200"
          aria-label="Menu de navegação"
        >
          {mainNav.map((entry, i) => {
            return (
              <MobileNavItem
                key={entry.id}
                entry={entry}
                index={i}
                open={open}
                active={pathname === entry.href}
                onNavigate={onClose}
              />
            );
          })}
        </Stack>

        {/* Footer — brand tagline */}
        <Text
          color="charcoal.500"
          fontSize="0.75rem"
          letterSpacing="0.08em"
          textTransform="uppercase"
        >
          {BRAND_NAME}
        </Text>
      </Box>
    </Portal>
  );
};

/**
 * Full-screen mobile navigation overlay triggered by a hamburger icon.
 * Dark charcoal background with a structured header / centered link list /
 * footer layout, expo-out entrance animation, and active-route highlighting.
 *
 * The overlay is portaled to `<body>`: the site header applies a
 * `backdrop-filter` once scrolled, which would otherwise make the header a
 * containing block for this `position: fixed` overlay and collapse it onto the
 * header box after scrolling.
 *
 * @example
 * <MobileMenu />
 */
const MobileMenu = () => {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <IconButton
        aria-label={open ? 'Fechar menu' : 'Abrir menu de navegação'}
        variant="ghost"
        color="charcoal.900"
        onClick={() => {
          setOpen((v) => {
            return !v;
          });
        }}
        minH="44px"
        minW="44px"
      >
        <Box as="span" display="flex" flexDirection="column" gap="5px" w="22px">
          <Box
            as="span"
            h="2px"
            bg="currentColor"
            transition={`all 0.3s ${EXPO_OUT}`}
            transformOrigin="center"
            transform={open ? 'rotate(45deg) translate(5px, 5px)' : 'none'}
          />
          <Box
            as="span"
            h="2px"
            bg="currentColor"
            transition={`all 0.3s ${EXPO_OUT}`}
            opacity={open ? 0 : 1}
          />
          <Box
            as="span"
            h="2px"
            bg="currentColor"
            transition={`all 0.3s ${EXPO_OUT}`}
            transformOrigin="center"
            transform={open ? 'rotate(-45deg) translate(5px, -5px)' : 'none'}
          />
        </Box>
      </IconButton>

      <MobileMenuOverlay
        open={open}
        pathname={pathname}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
};

export default MobileMenu;

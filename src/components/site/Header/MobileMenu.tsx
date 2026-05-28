'use client';

import { Box, IconButton, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import * as React from 'react';

import { mainNav } from '../../../config/navigation';

const EXPO_OUT = 'cubic-bezier(0.19, 1, 0.22, 1)';

/**
 * Full-screen mobile navigation overlay triggered by a hamburger icon.
 * Dark charcoal background, column links, expo-out entrance animation.
 *
 * @example
 * <MobileMenu />
 */
const MobileMenu = () => {
  const [open, setOpen] = React.useState(false);

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

      {/* Full-screen overlay */}
      <Box
        position="fixed"
        inset={0}
        zIndex={49}
        bg="charcoal.900"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        px={8}
        transition={`opacity 0.5s ${EXPO_OUT}, transform 0.5s ${EXPO_OUT}`}
        opacity={open ? 1 : 0}
        transform={open ? 'none' : 'translateY(-8px)'}
        pointerEvents={open ? 'auto' : 'none'}
        aria-hidden={!open}
      >
        <IconButton
          aria-label="Fechar menu"
          variant="ghost"
          color="ivory.100"
          position="absolute"
          top={4}
          right={4}
          minH="44px"
          minW="44px"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={() => {
            setOpen(false);
          }}
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
        <Stack as="nav" gap={6} aria-label="Menu de navegação">
          {mainNav.map((entry, i) => {
            return (
              <Link
                key={entry.id}
                asChild
                color="ivory.100"
                fontSize="clamp(1.875rem, calc(1.4375rem + 1.8vw), 3.25rem)"
                fontWeight="700"
                letterSpacing="-0.04em"
                lineHeight="1.1"
                textDecoration="none"
                transition={`opacity 0.5s ${EXPO_OUT} ${i * 0.07}s, transform 0.5s ${EXPO_OUT} ${i * 0.07}s`}
                opacity={open ? 1 : 0}
                transform={open ? 'none' : 'translateY(12px)'}
                _hover={{ color: 'ivory.400' }}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <NextLink href={entry.href}>{entry.label}</NextLink>
              </Link>
            );
          })}
        </Stack>

        <Text
          position="absolute"
          bottom={8}
          left={8}
          color="charcoal.500"
          fontSize="0.75rem"
          letterSpacing="0.08em"
          textTransform="uppercase"
        >
          Cozinhas Solidárias
        </Text>
      </Box>
    </>
  );
};

export default MobileMenu;

'use client';

import { Box, Flex, Link } from '@chakra-ui/react';
import NextLink from 'next/link';
import * as React from 'react';

import { EXPO_OUT } from '../../../config/site';
import Container from '../../ui/Container';
import Brand from './Brand';
import MobileMenu from './MobileMenu';
import NavLinks from './NavLinks';

const SCROLL_THRESHOLD = 60;

/**
 * Site header: three floating pill islands on a transparent backdrop.
 * Scrolled state adds a frosted glass strip for readability over long pages.
 * Desktop: [Brand island] · [Nav island] · [CTA island].
 * Mobile: [Brand island] · [MobileMenu trigger].
 *
 * @example
 * <Header />
 */
const Header = () => {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      return setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      return window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <Box
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={50}
      transition={`background-color 0.5s ${EXPO_OUT}, box-shadow 0.5s ${EXPO_OUT}`}
      bg={scrolled ? 'rgba(244, 240, 232, 0)' : 'transparent'}
      style={{
        backdropFilter: scrolled ? 'blur(16px) saturate(1.4)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(1.4)' : 'none',
        boxShadow: scrolled ? '0 1px 0 rgba(75, 63, 37, 0.07)' : 'none',
      }}
    >
      <Container>
        <Flex h="header.height" align="center" justify="space-between">
          {/* Left island: Brand + NavLinks in one pill */}
          <Flex
            display={{ base: 'none', md: 'inline-flex' }}
            alignItems="center"
            gap={0}
            px={2}
            py={1.5}
            bg="white"
            borderRadius="pill"
            border="1px solid"
            borderColor="ivory.100"
          >
            {/* Wordmark — padded to match nav link height */}
            <Box px={3} py="6px" paddingRight={8} whiteSpace="nowrap">
              <Brand />
            </Box>

            {/* Nav links share the same island */}
            <NavLinks />
          </Flex>

          {/* Left island mobile: brand pill only */}
          <Box
            display={{ base: 'inline-flex', md: 'none' }}
            alignItems="center"
            px={4}
            py="10px"
            bg="ivory.50"
            borderRadius="pill"
            border="1px solid"
            borderColor="ivory.400"
          >
            <Brand />
          </Box>

          {/* Right: CTA + mobile menu */}
          <Flex align="center" gap={3}>
            {/* Desktop CTA */}
            <Link
              asChild
              display={{ base: 'none', md: 'inline-flex' }}
              alignItems="center"
              gap="6px"
              px={4}
              py="10px"
              borderRadius="pill"
              bg="verde.600"
              color="ivory.50"
              fontSize="0.8125rem"
              fontWeight="600"
              letterSpacing="0.04em"
              textTransform="uppercase"
              textDecoration="none"
              transition={`all 0.3s ${EXPO_OUT}`}
              _hover={{
                bg: 'verde.700',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 16px rgba(51,124,89,0.35)',
              }}
            >
              <NextLink href="/mapas">Ver mapas</NextLink>
            </Link>

            {/* Mobile menu trigger */}
            <Box display={{ base: 'flex', md: 'none' }}>
              <MobileMenu />
            </Box>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};

export default Header;

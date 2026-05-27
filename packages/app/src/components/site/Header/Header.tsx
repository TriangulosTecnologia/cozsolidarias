'use client';

import { Box, Flex, HStack } from '@chakra-ui/react';

import Container from '../../ui/Container';
import Brand from './Brand';
import LocaleSwitcher from './LocaleSwitcher';
import MobileMenu from './MobileMenu';
import NavLinks from './NavLinks';

/**
 * Site header with responsive navigation and locale toggle.
 * Desktop (md+): Brand · NavLinks · LocaleSwitcher.
 * Mobile (base): Brand · LocaleSwitcher · MobileMenu.
 *
 * @example
 * <Header />
 */
const Header = () => {
  return (
    <Box as="header" bg="surface.header" borderBottomWidth="1px">
      <Container>
        <Flex h="header.height" align="center" justify="space-between">
          <Brand />
          <HStack gap={2}>
            <Box display={{ base: 'none', md: 'flex' }}>
              <NavLinks />
            </Box>
            <LocaleSwitcher />
            <Box display={{ base: 'flex', md: 'none' }}>
              <MobileMenu />
            </Box>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default Header;

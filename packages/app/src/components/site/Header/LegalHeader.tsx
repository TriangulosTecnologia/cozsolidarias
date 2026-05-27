'use client';

import { Box, Flex } from '@chakra-ui/react';

import Container from '../../ui/Container';
import Brand from './Brand';
import LocaleSwitcher from './LocaleSwitcher';

/**
 * Compact header for legal pages: Brand home link + locale toggle.
 * Omits main navigation — legal pages are reached from the footer, not the nav.
 *
 * @example
 * <LegalHeader />
 */
const LegalHeader = () => {
  return (
    <Box as="header" bg="surface.header" borderBottomWidth="1px">
      <Container>
        <Flex h="header.height" align="center" justify="space-between">
          <Brand />
          <LocaleSwitcher />
        </Flex>
      </Container>
    </Box>
  );
};

export default LegalHeader;

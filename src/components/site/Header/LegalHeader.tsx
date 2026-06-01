import { Box, Flex } from '@chakra-ui/react';

import Container from '../../ui/Container';
import BrandLogo from './BrandLogo';

/**
 * Compact header for legal pages: Brand home link only.
 * Omits main navigation — legal pages are reached from the footer, not the nav.
 *
 * @example
 * <LegalHeader />
 */
const LegalHeader = () => {
  return (
    <Box as="header" bg="surface.header" borderBottomWidth="1px">
      <Container>
        <Flex h="header.height" align="center">
          <BrandLogo />
        </Flex>
      </Container>
    </Box>
  );
};

export default LegalHeader;

'use client';

import { Box, Flex } from '@chakra-ui/react';

import Container from '../../ui/Container';
import LegalLinks from './LegalLinks';
import ProjectReference from './ProjectReference';

/**
 * Site footer with FAPESP project attribution and legal navigation links.
 *
 * @example
 * <Footer />
 */
const Footer = () => {
  return (
    <Box as="footer" bg="surface.footer" minH="footer.height" py={3}>
      <Container>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align="center"
          justify="space-between"
          gap={2}
        >
          <ProjectReference />
          <LegalLinks />
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;

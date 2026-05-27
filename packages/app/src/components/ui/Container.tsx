import { Box } from '@chakra-ui/react';
import type * as React from 'react';

/**
 * Full-width layout wrapper that constrains content to the canonical max-width
 * and applies consistent horizontal page padding.
 *
 * Uses the `content.max` size token for max-width so all pages share
 * a single source of truth.
 *
 * @example
 * <Container>
 *   <PageContent />
 * </Container>
 */
const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box maxW="content.max" mx="auto" px={{ base: 4, md: 8 }}>
      {children}
    </Box>
  );
};

export default Container;

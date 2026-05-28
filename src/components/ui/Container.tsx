import { Box } from '@chakra-ui/react';
import type * as React from 'react';

/**
 * Full-width layout wrapper that constrains content to the canonical max-width
 * and applies fluid horizontal padding derived from the design system grid spec.
 *
 * Max-width: 1440px. Horizontal padding: clamp(20px, 14px + 1.5vw, 48px).
 *
 * @example
 * <Container>
 *   <PageContent />
 * </Container>
 */
const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box
      maxW="content.max"
      mx="auto"
      px={{ base: 'clamp(1.25rem, calc(0.875rem + 1.5vw), 3rem)' }}
    >
      {children}
    </Box>
  );
};

export default Container;

import { Box } from '@chakra-ui/react';
import type * as React from 'react';

import Footer from '../site/Footer/Footer';
import Header from '../site/Header/Header';
import SkipToContent from '../ui/SkipToContent';

/**
 * Default site chrome: skip link, fixed header, main content area, footer.
 * Main has pt="4.5rem" to clear the fixed header height (sizes.header.height token).
 * Note: pt resolves against the spacing scale; the sizes token cannot be referenced
 * directly in padding props, so we use the resolved value.
 *
 * @example
 * <DefaultLayout>{children}</DefaultLayout>
 */
const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SkipToContent />
      <Header />
      <Box as="main" id="content" pt="4.5rem">
        {children}
      </Box>
      <Footer />
    </>
  );
};

export default DefaultLayout;

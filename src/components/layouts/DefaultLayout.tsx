import { Box } from '@chakra-ui/react';
import type * as React from 'react';

import Footer from '../site/Footer/Footer';
import Header from '../site/Header/Header';
import SkipToContent from '../ui/SkipToContent';

/**
 * Default site chrome: skip link, fixed header, main content area, footer.
 * Main has pt="72px" to clear the fixed header height.
 *
 * @example
 * <DefaultLayout>{children}</DefaultLayout>
 */
const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SkipToContent />
      <Header />
      <Box as="main" id="content" pt="72px">
        {children}
      </Box>
      <Footer />
    </>
  );
};

export default DefaultLayout;

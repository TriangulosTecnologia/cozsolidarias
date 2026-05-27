import { Box } from '@chakra-ui/react';
import type * as React from 'react';

import Footer from '../site/Footer/Footer';
import Header from '../site/Header/Header';
import SkipToContent from '../ui/SkipToContent';

/**
 * Default site chrome: skip link, header, scrollable main content area, footer.
 * Used by the `(default)` route group for all standard pages.
 * Server Component — no i18n calls; chrome subcomponents handle their own text.
 *
 * @example
 * <DefaultLayout>{children}</DefaultLayout>
 */
const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SkipToContent />
      <Header />
      <Box as="main" id="content">
        {children}
      </Box>
      <Footer />
    </>
  );
};

export default DefaultLayout;

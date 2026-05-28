import { Box } from '@chakra-ui/react';
import type * as React from 'react';

import Footer from '../site/Footer/Footer';
import LegalHeader from '../site/Header/LegalHeader';
import SkipToContent from '../ui/SkipToContent';

/**
 * Legal chrome: skip link, compact header (Brand only, no nav), main content, footer.
 * Used by the `(legal)` route group for Terms and Cookies pages.
 * Server Component.
 *
 * @example
 * <LegalLayout>{children}</LegalLayout>
 */
const LegalLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SkipToContent />
      <LegalHeader />
      <Box as="main" id="content">
        {children}
      </Box>
      <Footer />
    </>
  );
};

export default LegalLayout;

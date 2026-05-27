'use client';

import { Link } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';

/**
 * Accessible skip-to-content link — the first focusable element on every page.
 * Visually hidden until focused; targets `<main id="content">`.
 *
 * @example
 * <SkipToContent />
 */
const SkipToContent = () => {
  const { intl } = useI18n();
  return (
    <Link
      href="#content"
      position="absolute"
      top="-100vh"
      left={4}
      zIndex={1600}
      bg="white"
      px={4}
      py={2}
      borderRadius="md"
      _focus={{ top: 4 }}
    >
      {intl.formatMessage({
        defaultMessage: 'Skip to content',
        description:
          'Accessible skip navigation link — the first focusable element on the page.',
      })}
    </Link>
  );
};

export default SkipToContent;

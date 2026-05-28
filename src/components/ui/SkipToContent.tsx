import { Link } from '@chakra-ui/react';

/**
 * Accessible skip-to-content link — the first focusable element on every page.
 * Visually hidden until focused; targets `<main id="content">`.
 *
 * @example
 * <SkipToContent />
 */
const SkipToContent = () => {
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
      Ir para o conteúdo
    </Link>
  );
};

export default SkipToContent;

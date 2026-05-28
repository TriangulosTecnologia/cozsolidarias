import { Link } from '@chakra-ui/react';
import NextLink from 'next/link';

const EXPO_OUT = 'cubic-bezier(0.19, 1, 0.22, 1)';

/**
 * Site wordmark — rendered inside the shared left pill island in the Header.
 * No individual wrapper; island context is provided by the parent.
 *
 * @example
 * <Brand />
 */
const Brand = () => {
  return (
    <Link
      asChild
      fontWeight="800"
      fontSize="1.05rem"
      letterSpacing="-0.025em"
      lineHeight="1"
      textDecoration="none"
      color="charcoal.900"
      _hover={{ color: 'verde.600' }}
      transition={`color 0.3s ${EXPO_OUT}`}
      whiteSpace="nowrap"
    >
      <NextLink href="/">COZINHAS SOLIDÁRIAS</NextLink>
    </Link>
  );
};

export default Brand;

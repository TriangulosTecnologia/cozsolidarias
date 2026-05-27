import { Link } from '@chakra-ui/react';
import NextLink from 'next/link';

import { BRAND_NAME } from '../../../config/site';

/**
 * Site wordmark rendered as a home link.
 * Uses the fixed project name — never translated.
 *
 * @example
 * <Brand />
 */
const Brand = () => {
  return (
    <Link asChild fontWeight="bold" fontSize="lg" textDecoration="none">
      <NextLink href="/">{BRAND_NAME}</NextLink>
    </Link>
  );
};

export default Brand;

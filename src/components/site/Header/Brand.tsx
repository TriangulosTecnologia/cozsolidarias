import { Flex, Link } from '@chakra-ui/react';
import NextImage from 'next/image';
import NextLink from 'next/link';

import { EXPO_OUT } from '../../../config/site';

/**
 * Site wordmark with icon — rendered inside the shared left pill island in the Header.
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
      <NextLink href="/">
        <Flex align="center" gap={2}>
          <NextImage
            src="/logo_icon_grayscale.svg"
            alt=""
            width={38}
            height={22}
            style={{ display: 'block' }}
          />
          COZINHA SOLIDÁRIA EM REDE
        </Flex>
      </NextLink>
    </Link>
  );
};

export default Brand;

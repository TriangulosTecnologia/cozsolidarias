import { Link } from '@chakra-ui/react';
import NextImage from 'next/image';
import NextLink from 'next/link';

import { EXPO_OUT } from '../../../config/site';

/** Controls which SVG asset is rendered. */
type BrandLogoVariant = 'black_horizontal' | 'default_horizontal';

const VARIANT_SRC: Record<BrandLogoVariant, string> = {
  black_horizontal: '/logo_h_black.svg',
  default_horizontal: '/logo_h.svg',
};

interface BrandLogoProps {
  /**
   * Visual variant of the logo.
   * @default 'black_horizontal'
   */
  variant?: BrandLogoVariant;
  /**
   * Intrinsic pixel width passed to Next/Image.
   * Controls aspect ratio; override to fit larger containers.
   * @default 82
   */
  width?: number;
  /**
   * Intrinsic pixel height passed to Next/Image.
   * @default 32
   */
  height?: number;
}

/**
 * Site logo as a horizontal SVG image, linked to the home page.
 * Use this as the primary brand mark in headers and prominent placements.
 * Wrap in a sized Box to constrain responsive display.
 *
 * @example
 * // Header (fixed size)
 * <BrandLogo />
 *
 * @example
 * // Footer (responsive)
 * <Box maxW={{ base: '180px', md: '240px' }}>
 *   <BrandLogo variant="black_horizontal" width={796} height={313} />
 * </Box>
 */
const BrandLogo = ({
  variant = 'black_horizontal',
  width = 82,
  height = 32,
}: BrandLogoProps) => {
  return (
    <Link
      asChild
      textDecoration="none"
      display="inline-flex"
      _hover={{ opacity: 0.7 }}
      transition={`opacity 0.3s ${EXPO_OUT}`}
    >
      <NextLink href="/">
        <NextImage
          src={VARIANT_SRC[variant]}
          alt="Cozinha Solidária em Rede"
          width={width}
          height={height}
          priority
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        />
      </NextLink>
    </Link>
  );
};

export default BrandLogo;

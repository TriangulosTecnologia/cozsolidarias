import { Box, Text, VStack } from '@chakra-ui/react';
import NextImage from 'next/image';

/**
 * Props for {@link MapLoadingIndicator}.
 */
export interface MapLoadingIndicatorProps {
  /**
   * Loading message. Drives both the visible caption (rendered with a trailing
   * ellipsis) and the `role="status"` region's accessible name, keeping the two
   * in sync.
   *
   * @default 'Carregando mapa'
   */
  label?: string;
}

/**
 * Full-bleed loading indicator: the brand "panela" mark with a "breathing"
 * pulse (scale + opacity, via the theme's `pulseScale` keyframe) above a muted
 * caption. Fills its nearest positioned ancestor. Exposed to assistive tech as
 * a `role="status"` region whose accessible name is {@link MapLoadingIndicatorProps.label}.
 *
 * @param props - See {@link MapLoadingIndicatorProps}.
 * @returns The centered, breathing loading element with its caption.
 *
 * @example
 * // In MapaPlayground, before the map runtime is mounted:
 * {mounted ? <GeovisWorkspace ... /> : <MapLoadingIndicator />}
 *
 * @example
 * // Reused elsewhere with a custom message:
 * <MapLoadingIndicator label="Carregando dados" />
 */
const MapLoadingIndicator = ({
  label = 'Carregando mapa',
}: MapLoadingIndicatorProps) => {
  return (
    <VStack
      role="status"
      aria-label={label}
      position="absolute"
      inset={0}
      justify="center"
      gap={4}
    >
      <Box
        w={{ base: '6rem', md: '7rem' }}
        animationName="pulseScale"
        animationDuration="1.4s"
        animationTimingFunction="ease-in-out"
        animationIterationCount="infinite"
      >
        <NextImage
          src="/logo_mark.svg"
          alt=""
          width={380}
          height={228}
          priority
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </Box>
      <Text color="fg.muted" fontSize="sm">
        {label}…
      </Text>
    </VStack>
  );
};

export default MapLoadingIndicator;

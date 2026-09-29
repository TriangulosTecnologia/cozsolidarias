import { Box, HStack, Text, VStack } from '@chakra-ui/react';
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
  /**
   * Which wait this is.
   *
   * `'full'` covers a map that is not there yet: the mark is large and the
   * surface behind it is the page's own, because nothing else is on screen.
   *
   * `'overlay'` covers a map that *is* there and is being repainted. It draws a
   * scrim and puts the mark in a card, for three reasons the full-bleed form
   * cannot serve over live content: the caption needs a background whose
   * contrast does not change with the choropleth class underneath; a smaller
   * mark reads as "updating" where a large one reads as "gone"; and the scrim
   * is what explains a map that has stopped answering drags.
   *
   * @default 'full'
   */
  variant?: 'full' | 'overlay';
}

/** The brand mark, breathing. Still where the reader asked for less motion. */
const BreathingMark = ({ size }: { size: string | Record<string, string> }) => {
  return (
    <Box
      w={size}
      animationName="pulseScale"
      animationDuration="1.4s"
      animationTimingFunction="ease-in-out"
      animationIterationCount="infinite"
      _motionReduce={{ animationName: 'none' }}
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
  );
};

/**
 * Loading indicator for the map area, in two forms — see
 * {@link MapLoadingIndicatorProps.variant}.
 *
 * Fills its nearest positioned ancestor, which is what lets the workspace place
 * it over the map that an open sidebar leaves visible rather than over the
 * whole canvas. Exposed to assistive tech as a `role="status"` region whose
 * accessible name is {@link MapLoadingIndicatorProps.label}.
 *
 * @param props - See {@link MapLoadingIndicatorProps}.
 * @returns The centered, breathing loading element with its caption.
 *
 * @example
 * // Before the map runtime is mounted: nothing else is on screen.
 * {mounted ? <GeovisWorkspace ... /> : <MapLoadingIndicator />}
 *
 * @example
 * // Over a map being repainted, through the workspace's own overlay.
 * renderLoading: () => (
 *   <MapLoadingIndicator variant="overlay" label="Atualizando o mapa" />
 * )
 */
const MapLoadingIndicator = ({
  label = 'Carregando mapa',
  variant = 'full',
}: MapLoadingIndicatorProps) => {
  if (variant === 'overlay') {
    return (
      <Box
        role="status"
        aria-label={label}
        position="absolute"
        inset={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        /*
         * Light rather than dark: the basemap and the palest choropleth classes
         * are already light, and darkening would make the map read as disabled
         * instead of busy. The alpha keeps the shapes legible underneath, so the
         * reader can still see which map they are waiting on.
         */
        bg="rgba(244, 240, 232, 0.72)"
      >
        <HStack
          gap={3}
          paddingInline={5}
          paddingBlock={3}
          borderRadius="full"
          bg="surface.card"
          borderWidth="1px"
          borderColor="ivory.300"
          boxShadow="0 6px 20px rgba(36, 31, 33, 0.12)"
        >
          <BreathingMark size="2.25rem" />
          <Text color="charcoal.900" fontSize="sm" fontWeight="500">
            {label}…
          </Text>
        </HStack>
      </Box>
    );
  }

  return (
    <VStack
      role="status"
      aria-label={label}
      position="absolute"
      inset={0}
      justify="center"
      gap={4}
    >
      <BreathingMark size={{ base: '6rem', md: '7rem' }} />
      <Text color="fg.muted" fontSize="sm">
        {label}…
      </Text>
    </VStack>
  );
};

export default MapLoadingIndicator;

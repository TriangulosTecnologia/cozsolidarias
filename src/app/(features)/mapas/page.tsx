import { Box } from '@chakra-ui/react';
import type { Metadata } from 'next';

import MapaPlayground from './MapaPlaygroundClient';

export const metadata: Metadata = {
  title: 'Mapas — Cozinha Solidária em Rede',
};

export default function MapasPage() {
  return (
    // Server-rendered on purpose: `MapaPlayground` is behind a `ssr: false`
    // dynamic import, so it contributes nothing to the initial HTML. Without a
    // box that reserves its height here, `<main>` paints at zero height and the
    // footer lands directly under the fixed header until the chunk arrives.
    //
    // `dvh`, not `vh`: on mobile browsers `100vh` is the viewport with the URL
    // bar hidden, so the map would start taller than the screen — its bottom
    // under the browser chrome, and the page with a scrollbar it should not
    // have. `dvh` tracks the space actually visible, which is also the height
    // the camera fit in `useMapaSpec` measures.
    //
    // The subtrahend is the header height token, the same one `DefaultLayout`
    // clears with its `pt`. Read as a CSS variable because `h` resolves bare
    // token names against the sizes scale, not inside `calc()`.
    <Box
      position="relative"
      h="calc(100dvh - var(--chakra-sizes-header-height))"
      w="100%"
      bg="ivory.200"
    >
      <MapaPlayground />
    </Box>
  );
}

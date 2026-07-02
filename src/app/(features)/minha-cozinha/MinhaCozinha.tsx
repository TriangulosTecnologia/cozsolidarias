'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Box, Heading, Spinner, Text } from '@chakra-ui/react';
import { GeoVisCanvas, GeoVisProvider } from '@ttoss/geovis';
import * as React from 'react';

import type {
  NearbyKitchen,
  NearbyPlacesContract,
  NearbyProvider,
} from '@/data-gateway/schema';

import FiltersBar from './_components/FiltersBar';
import NearbyPanel from './_components/NearbyPanel';
import { computeIndicators } from './indicators';
import {
  buildNearbySpec,
  buildOverviewSpec,
  groupByCategory,
} from './nearbySpec';

const MinhaCozinha = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchens, setKitchens] = React.useState<NearbyKitchen[]>([]);
  const [selected, setSelected] = React.useState<NearbyKitchen | null>(null);
  const [provider, setProvider] = React.useState<NearbyProvider>('osm');
  const [nearby, setNearby] = React.useState<NearbyPlacesContract | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'error'>(
    'idle'
  );
  // Guards against out-of-order responses when the user switches fast.
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/minha-cozinha')
      .then((response) => {
        return response.json() as Promise<NearbyKitchen[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setKitchens(data);
          setMounted(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKitchens([]);
          setMounted(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch is driven from event handlers (not an effect): select a kitchen or
  // switch the provider to load its surroundings.
  const loadNearby = (kitchen: NearbyKitchen, nextProvider: NearbyProvider) => {
    const token = requestRef.current + 1;
    requestRef.current = token;
    setSelected(kitchen);
    setProvider(nextProvider);
    setNearby(null);
    setStatus('loading');

    fetch(
      `/api/minha-cozinha/${kitchen.codigo}/nearby?provider=${nextProvider}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json() as Promise<NearbyPlacesContract>;
      })
      .then((data) => {
        if (requestRef.current === token) {
          setNearby(data);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (requestRef.current === token) {
          setStatus('error');
        }
      });
  };

  const handleProviderChange = (next: NearbyProvider) => {
    if (selected) {
      loadNearby(selected, next);
    } else {
      setProvider(next);
    }
  };

  const clearSelection = () => {
    requestRef.current += 1;
    setSelected(null);
    setNearby(null);
    setStatus('idle');
  };

  const spec = React.useMemo(() => {
    if (selected) {
      return buildNearbySpec({
        center: { latitude: selected.latitude, longitude: selected.longitude },
        features: nearby?.features ?? [],
        provider,
      });
    }
    return buildOverviewSpec(kitchens);
  }, [selected, nearby, provider, kitchens]);

  const groups = React.useMemo(() => {
    return nearby ? groupByCategory(nearby.features) : [];
  }, [nearby]);

  const indicators = React.useMemo(() => {
    return nearby ? computeIndicators(nearby.features) : null;
  }, [nearby]);

  return (
    <Box h="calc(100vh - 4.5rem)" display="flex" flexDirection="column">
      <Heading as="h1" srOnly>
        Minha Cozinha
      </Heading>

      <FiltersBar
        kitchens={kitchens}
        selectedCodigo={selected?.codigo ?? null}
        provider={provider}
        onSelect={(kitchen) => {
          loadNearby(kitchen, provider);
        }}
        onClear={clearSelection}
        onProviderChange={handleProviderChange}
      />

      <Box
        flex="1"
        minH={0}
        display="flex"
        flexDirection={{ base: 'column', md: 'row' }}
      >
        <Box position="relative" flex="1" minH={0} minW={0} bg="ivory.200">
          {mounted ? (
            <GeoVisProvider spec={spec}>
              <GeoVisCanvas style={{ width: '100%', height: '100%' }} />
            </GeoVisProvider>
          ) : (
            <Box
              position="absolute"
              inset={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text textStyle="body-sm" color="text.secondary">
                Carregando mapa…
              </Text>
            </Box>
          )}

          {status === 'loading' ? (
            <Box position="absolute" top={3} left={3} zIndex={1}>
              <Spinner size="sm" color="brand.solid" />
            </Box>
          ) : null}
        </Box>

        {selected ? (
          <NearbyPanel
            selected={selected}
            provider={provider}
            status={status}
            nearby={nearby}
            groups={groups}
            indicators={indicators}
            onClear={clearSelection}
          />
        ) : null}
      </Box>
    </Box>
  );
};

export default MinhaCozinha;

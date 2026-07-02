'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Box, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { GeoVisCanvas, GeoVisProvider } from '@ttoss/geovis';
import * as React from 'react';

import type {
  NearbyKitchen,
  NearbyPlacesContract,
  NearbyProvider,
} from '@/data-gateway/schema';

import KitchenSelector from './_components/KitchenSelector';
import NearbyPanel from './_components/NearbyPanel';
import {
  buildNearbySpec,
  buildOverviewSpec,
  groupByCategory,
} from './nearbySpec';

const matchesQuery = (kitchen: NearbyKitchen, query: string): boolean => {
  const haystack =
    `${kitchen.nome} ${kitchen.municipio} ${kitchen.uf} ${kitchen.codigo}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
};

const MinhaCozinha = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchens, setKitchens] = React.useState<NearbyKitchen[]>([]);
  const [query, setQuery] = React.useState('');
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

  const clearSelection = () => {
    requestRef.current += 1;
    setSelected(null);
    setProvider('osm');
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

  const filtered = React.useMemo(() => {
    return kitchens.filter((kitchen) => {
      return matchesQuery(kitchen, query);
    });
  }, [kitchens, query]);

  const groups = React.useMemo(() => {
    return nearby ? groupByCategory(nearby.features) : [];
  }, [nearby]);

  return (
    <Box maxW="content.max" mx="auto" px={{ base: 4, md: 8 }} py={8}>
      <Heading as="h1" textStyle="title-2" color="text.primary" mb={2}>
        Minha Cozinha
      </Heading>
      <Text textStyle="body" color="text.secondary" maxW="60ch" mb={6}>
        Selecione uma cozinha para ver o que existe no entorno — abastecimento,
        assistência, saúde, educação e transporte — em raios de 500, 1.500 e
        3.000 metros.
      </Text>

      <Stack direction={{ base: 'column', md: 'row' }} gap={6} align="start">
        <KitchenSelector
          query={query}
          onQueryChange={setQuery}
          kitchens={filtered}
          selectedCodigo={selected?.codigo ?? null}
          onSelect={(kitchen) => {
            loadNearby(kitchen, provider);
          }}
          showEmpty={mounted && filtered.length === 0}
        />

        <Box flex="2" minW={0} w="100%">
          <Box
            position="relative"
            h="60vh"
            minH="360px"
            borderRadius="card"
            overflow="hidden"
            bg="ivory.200"
          >
            {mounted ? (
              <GeoVisProvider spec={spec}>
                <GeoVisCanvas style={{ width: '100%', height: '100%' }} />
              </GeoVisProvider>
            ) : null}

            {status === 'loading' ? (
              <Box position="absolute" top={3} right={3}>
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
              onProviderChange={(next) => {
                loadNearby(selected, next);
              }}
              onClear={clearSelection}
            />
          ) : (
            <Text textStyle="body-sm" color="text.secondary" mt={3}>
              {kitchens.length} cozinha(s) disponível(is) para análise.
              Selecione uma na lista ao lado.
            </Text>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

export default MinhaCozinha;

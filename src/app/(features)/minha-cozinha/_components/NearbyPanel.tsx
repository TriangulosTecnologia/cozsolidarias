import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';

import type {
  NearbyKitchen,
  NearbyPlacesContract,
  NearbyProvider,
} from '@/data-gateway/schema';

import { CATEGORY_META, type NearbyGroup } from '../nearbySpec';

const PROVIDER_LABEL: Record<NearbyProvider, string> = {
  osm: 'OpenStreetMap',
  google: 'Google Maps',
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
};

type NearbyPanelProps = {
  selected: NearbyKitchen;
  provider: NearbyProvider;
  status: 'idle' | 'loading' | 'error';
  nearby: NearbyPlacesContract | null;
  groups: NearbyGroup[];
  onProviderChange: (provider: NearbyProvider) => void;
  onClear: () => void;
};

/**
 * Analysis panel for a selected kitchen: provider toggle, category legend,
 * truncation notice, the per-category POI list, and source attribution.
 *
 * @param props - The `selected` kitchen, current `provider`/`status`, the
 * loaded `nearby` collection, precomputed `groups`, and the `onProviderChange`
 * / `onClear` callbacks.
 *
 * @example
 * <NearbyPanel selected={k} provider="osm" status="idle" nearby={data}
 *   groups={groups} onProviderChange={load} onClear={clear} />
 */
const NearbyPanel = ({
  selected,
  provider,
  status,
  nearby,
  groups,
  onProviderChange,
  onClear,
}: NearbyPanelProps) => {
  const truncated = nearby?.metadata.truncatedCategories ?? [];

  return (
    <Box mt={4}>
      <HStack justify="space-between" wrap="wrap" gap={3} mb={3}>
        <Box>
          <Text textStyle="body" fontWeight="600" color="text.primary">
            {selected.nome || selected.codigo}
          </Text>
          <Text textStyle="caption" color="text.secondary">
            {selected.municipio} — {selected.uf}
          </Text>
        </Box>
        <HStack gap={3}>
          <NativeSelect.Root size="sm" w="auto">
            <NativeSelect.Field
              value={provider}
              onChange={(event) => {
                onProviderChange(event.currentTarget.value as NearbyProvider);
              }}
              aria-label="Fonte dos dados"
            >
              <option value="osm">OpenStreetMap</option>
              <option value="google">Google Maps</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Ver todas
          </Button>
        </HStack>
      </HStack>

      {status === 'error' ? (
        <Text textStyle="body-sm" color="action.fg">
          Sem dados de entorno para esta cozinha em {PROVIDER_LABEL[provider]}.
          Gere o snapshot com o script minha-cozinha-nearby.
        </Text>
      ) : null}

      {nearby ? (
        <Stack gap={4}>
          <HStack wrap="wrap" gap={3}>
            {groups.map((group) => {
              return (
                <HStack key={group.category} gap={1.5}>
                  <Box w="10px" h="10px" borderRadius="pill" bg={group.color} />
                  <Text textStyle="caption" color="text.secondary">
                    {group.label} ({group.items.length})
                  </Text>
                </HStack>
              );
            })}
          </HStack>

          {truncated.length > 0 ? (
            <Text textStyle="caption" color="action.fg">
              Contagem parcial (limite de 20 por categoria atingido):{' '}
              {truncated
                .map((category) => {
                  return CATEGORY_META[category].label;
                })
                .join(', ')}
              .
            </Text>
          ) : null}

          <Stack gap={5}>
            {groups
              .filter((group) => {
                return group.items.length > 0;
              })
              .map((group) => {
                return (
                  <Box key={group.category}>
                    <HStack gap={2} mb={2}>
                      <Box
                        w="10px"
                        h="10px"
                        borderRadius="pill"
                        bg={group.color}
                      />
                      <Heading as="h2" textStyle="title-4" color="text.primary">
                        {group.label}
                      </Heading>
                      <Text textStyle="body-sm" color="text.secondary">
                        {group.items.length}
                      </Text>
                    </HStack>
                    <VStack align="stretch" gap={1}>
                      {group.items.map((item) => {
                        return (
                          <HStack
                            key={item.properties.id}
                            justify="space-between"
                            gap={3}
                            py={1}
                            borderBottomWidth="1px"
                            borderColor="ivory.300"
                          >
                            <Text textStyle="body-sm" color="text.primary">
                              {item.properties.name ?? '(sem nome)'}
                            </Text>
                            <HStack gap={2} flexShrink={0}>
                              <Text textStyle="caption" color="text.secondary">
                                {formatDistance(item.properties.distanceMeters)}
                              </Text>
                              <Badge size="sm" variant="surface">
                                {item.properties.ring} m
                              </Badge>
                            </HStack>
                          </HStack>
                        );
                      })}
                    </VStack>
                  </Box>
                );
              })}
          </Stack>

          <Text textStyle="caption" color="text.secondary">
            Fonte: {nearby.metadata.attribution} · raio{' '}
            {nearby.metadata.radiusMeters} m · gerado em{' '}
            {new Date(nearby.metadata.generatedAt).toLocaleDateString('pt-BR')}.
          </Text>
        </Stack>
      ) : null}
    </Box>
  );
};

export default NearbyPanel;

import { Box, Button, Heading, HStack, Text } from '@chakra-ui/react';

import type {
  NearbyKitchen,
  NearbyPlacesContract,
  NearbyProvider,
} from '@/data-gateway/schema';

import { type NearbyIndicators as Indicators } from '../indicators';
import { CATEGORY_META, type NearbyGroup } from '../nearbySpec';
import KitchenIdentity from './KitchenIdentity';
import NearbyIndicators from './NearbyIndicators';
import NearbyList from './NearbyList';

const PROVIDER_LABEL: Record<NearbyProvider, string> = {
  osm: 'OpenStreetMap',
  google: 'Google Maps',
};

type NearbyPanelProps = {
  selected: NearbyKitchen;
  provider: NearbyProvider;
  status: 'idle' | 'loading' | 'error';
  nearby: NearbyPlacesContract | null;
  groups: NearbyGroup[];
  indicators: Indicators | null;
  onClear: () => void;
};

/**
 * Right-hand panel for a selected kitchen (a flex sibling of the map, not an
 * overlay): identity header, illustrative indices, truncation notice and the
 * per-category list.
 *
 * @example
 * <NearbyPanel selected={k} provider="osm" status="idle" nearby={data}
 *   groups={groups} indicators={indicators} onClear={clear} />
 */
const NearbyPanel = ({
  selected,
  provider,
  status,
  nearby,
  groups,
  indicators,
  onClear,
}: NearbyPanelProps) => {
  const truncated = nearby?.metadata.truncatedCategories ?? [];

  return (
    <Box
      w={{ base: '100%', md: '380px' }}
      flexShrink={0}
      maxH={{ base: '45%', md: 'none' }}
      h={{ md: '100%' }}
      overflowY="auto"
      bg="surface.card"
      borderTopWidth={{ base: '1px', md: '0' }}
      borderLeftWidth={{ base: '0', md: '1px' }}
      borderColor="ivory.300"
      p={5}
    >
      <HStack justify="space-between" align="start" mb={3} gap={3}>
        <Heading as="h2" textStyle="title-4" color="text.primary">
          {selected.nome || selected.codigo}
        </Heading>
        <Button
          aria-label="Fechar painel"
          size="xs"
          variant="ghost"
          onClick={onClear}
        >
          ✕
        </Button>
      </HStack>

      <KitchenIdentity kitchen={selected} />

      {status === 'error' ? (
        <Text textStyle="body-sm" color="action.fg">
          Sem dados de entorno para esta cozinha em {PROVIDER_LABEL[provider]}.
          Gere o snapshot com o script minha-cozinha-nearby.
        </Text>
      ) : null}

      {indicators ? <NearbyIndicators indicators={indicators} /> : null}

      {truncated.length > 0 ? (
        <Text textStyle="caption" color="action.fg" mb={4}>
          Contagem parcial (limite de 20 por categoria atingido):{' '}
          {truncated
            .map((category) => {
              return CATEGORY_META[category].label;
            })
            .join(', ')}
          .
        </Text>
      ) : null}

      {nearby ? <NearbyList groups={groups} /> : null}

      {nearby ? (
        <Text textStyle="caption" color="text.secondary" mt={4}>
          Fonte: {nearby.metadata.attribution} · raio{' '}
          {nearby.metadata.radiusMeters} m · gerado em{' '}
          {new Date(nearby.metadata.generatedAt).toLocaleDateString('pt-BR')}.
        </Text>
      ) : null}
    </Box>
  );
};

export default NearbyPanel;

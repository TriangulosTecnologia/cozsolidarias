import { Box, HStack, Stack, Text } from '@chakra-ui/react';

import {
  formatDistance,
  type NearbyIndicators as Indicators,
} from '../indicators';

type NearbyIndicatorsProps = {
  indicators: Indicators;
};

/**
 * Illustrative surroundings indices: an overall access score, the total POI
 * count, and per-category totals with the nearest distance. Clearly labelled
 * "ilustrativo" — the scores demonstrate intent, not a validated methodology.
 *
 * @example
 * <NearbyIndicators indicators={computeIndicators(nearby.features)} />
 */
const NearbyIndicators = ({ indicators }: NearbyIndicatorsProps) => {
  return (
    <Stack gap={3} mb={4}>
      <HStack justify="space-between">
        <Text textStyle="body" fontWeight="600" color="text.primary">
          Índices do entorno
        </Text>
        <Text textStyle="caption" color="text.secondary">
          ilustrativo
        </Text>
      </HStack>

      <HStack gap={6}>
        <Box>
          <Text textStyle="title-3" color="brand.fg">
            {indicators.overallAccess}
            <Text as="span" textStyle="body-sm" color="text.secondary">
              /100
            </Text>
          </Text>
          <Text textStyle="caption" color="text.secondary">
            Acesso geral
          </Text>
        </Box>
        <Box>
          <Text textStyle="title-3" color="text.primary">
            {indicators.total}
          </Text>
          <Text textStyle="caption" color="text.secondary">
            POIs em 3 km
          </Text>
        </Box>
      </HStack>

      <Stack gap={1.5}>
        {indicators.categories.map((indicator) => {
          return (
            <HStack key={indicator.category} justify="space-between" gap={3}>
              <HStack gap={2} minW={0}>
                <Box
                  w="10px"
                  h="10px"
                  borderRadius="pill"
                  bg={indicator.color}
                />
                <Text textStyle="body-sm" color="text.primary">
                  {indicator.label}
                </Text>
              </HStack>
              <Text textStyle="caption" color="text.secondary">
                {indicator.total} ·{' '}
                {indicator.nearestMeters === null
                  ? '—'
                  : `mais próx. ${formatDistance(indicator.nearestMeters)}`}
              </Text>
            </HStack>
          );
        })}
      </Stack>
    </Stack>
  );
};

export default NearbyIndicators;

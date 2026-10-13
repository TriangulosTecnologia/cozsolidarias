import { Box, Button, Stack, Text } from '@chakra-ui/react';
import { useCompactViewport } from '@ttoss/geovis';
import * as React from 'react';

import type { KitchenEnabledShare2025 } from '@/data-gateway/schema';

import { ENABLED_SHARE_COLOR, enabledShareRadius } from './geovisEnabledShare';

type LegendProps = {
  snapshot: KitchenEnabledShare2025 | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};
const maximumCount = (snapshot: KitchenEnabledShare2025 | null) => {
  return Math.max(
    2,
    ...(snapshot?.municipalities.map((row) => {
      return row.enabledCount;
    }) ?? [])
  );
};
const LegendContent = ({ snapshot, loading, error, retry }: LegendProps) => {
  const maxCount = maximumCount(snapshot);
  return (
    <Stack gap="2">
      <Text fontWeight="bold" fontSize="sm">
        Habilitadas / total nacional — 2025
      </Text>
      {loading && (
        <Text role="status" fontSize="xs">
          Carregando a camada…
        </Text>
      )}
      {error && (
        <>
          <Text role="alert" fontSize="xs">
            {error}
          </Text>
          <Button size="xs" onClick={retry}>
            Tentar novamente
          </Button>
        </>
      )}
      {snapshot && (
        <>
          <Text fontSize="xs">
            Área do círculo: habilitadas no município ÷{' '}
            {snapshot.nationalTotal.toLocaleString('pt-BR')} cozinhas
            cadastradas no Brasil.
          </Text>
          <Box asChild width="100%" height="82px">
            <svg
              viewBox="0 0 240 82"
              role="img"
              aria-label="Círculos de referência em percentual do total nacional"
            >
              {[0.25, 0.5, 1].map((fraction, i) => {
                const count = maxCount * fraction;
                return (
                  <g key={fraction}>
                    <circle
                      cx={40 + i * 80}
                      cy={39}
                      r={enabledShareRadius({ count, maxCount })}
                      fill={ENABLED_SHARE_COLOR}
                      fillOpacity={0.65}
                    />
                    <text
                      x={40 + i * 80}
                      y={81}
                      textAnchor="middle"
                      fontSize="10"
                    >
                      {((100 * count) / snapshot.nationalTotal).toLocaleString(
                        'pt-BR',
                        { maximumFractionDigits: 3 }
                      )}
                      %
                    </text>
                  </g>
                );
              })}
            </svg>
          </Box>
          <Text fontSize="xs">
            Fonte: cadastro tratado de Cozinhas Solidárias, 2025. Pontos e
            detalhes das cozinhas fixados em 2025 enquanto esta camada está
            ativa.
          </Text>
        </>
      )}
    </Stack>
  );
};

/**
 * Independent percent size legend, outside geovis' spec-wide circle scale.
 * Desktop placement clears the sidebar and map navigation. On compact screens,
 * content is disclosed on demand so it does not cover the map by default.
 * @param props - Canonical snapshot and loading/retry state.
 * @returns A size legend matching the circle layer's radius function.
 * @example <EnabledShareLegend snapshot={data} loading={false} error={null} retry={retry} />
 */
const EnabledShareLegend = (props: LegendProps) => {
  const compact = useCompactViewport();
  const [open, setOpen] = React.useState(false);
  return (
    <Box
      position="absolute"
      top="3"
      right="14"
      zIndex={5}
      bg="ivory.50"
      borderWidth="1px"
      borderColor="ivory.300"
      borderRadius="lg"
      p="3"
      maxW={{ base: '220px', md: '280px' }}
      maxH="60%"
      overflowY="auto"
      aria-label="Legenda de habilitadas em 2025"
    >
      <Stack gap="2">
        {compact && (
          <Button
            size="xs"
            aria-expanded={open}
            onClick={() => {
              return setOpen((value) => {
                return !value;
              });
            }}
          >
            Habilitadas 2025 · legenda
          </Button>
        )}
        <Box display={!compact || open ? 'block' : 'none'}>
          <LegendContent {...props} />
        </Box>
      </Stack>
    </Box>
  );
};
export default EnabledShareLegend;

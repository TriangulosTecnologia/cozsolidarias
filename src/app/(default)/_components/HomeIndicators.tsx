import { Badge, Box, Grid, Stack, Text } from '@chakra-ui/react';

import Container from '../../../components/ui/Container';

type DataStatus = 'validado' | 'parcial' | 'em-tratamento' | 'nao-identificado';

type Indicator = {
  label: string;
  value: string;
  source: string;
  updatedAt: string;
  status: DataStatus;
};

const STATUS_LABELS: Record<DataStatus, string> = {
  validado: 'Validado',
  parcial: 'Dado parcial',
  'em-tratamento': 'Em tratamento',
  'nao-identificado': 'Não identificado',
};

const STATUS_COLORS: Record<DataStatus, string> = {
  validado: 'verde',
  parcial: 'laranja',
  'em-tratamento': 'roxo',
  'nao-identificado': 'gray',
};

const INDICATORS: Indicator[] = [
  {
    label: 'Cozinhas mapeadas',
    value: '–',
    source: 'Em levantamento',
    updatedAt: '–',
    status: 'nao-identificado',
  },
  {
    label: 'Municípios com registros',
    value: '–',
    source: 'Em levantamento',
    updatedAt: '–',
    status: 'nao-identificado',
  },
  {
    label: 'Unidades federativas cobertas',
    value: '–',
    source: 'Em levantamento',
    updatedAt: '–',
    status: 'nao-identificado',
  },
  {
    label: 'Datasets catalogados',
    value: '–',
    source: 'Em levantamento',
    updatedAt: '–',
    status: 'nao-identificado',
  },
  {
    label: 'Fontes integradas',
    value: '–',
    source: 'Em levantamento',
    updatedAt: '–',
    status: 'nao-identificado',
  },
  {
    label: 'Registros em validação',
    value: '–',
    source: 'Em levantamento',
    updatedAt: '–',
    status: 'nao-identificado',
  },
];

/**
 * Indicators section with KPI cards.
 *
 * Each card shows a metric label, value (or placeholder), data source,
 * last-updated date, and a status badge. Numbers are never displayed
 * without source, date, and status.
 *
 * @example
 * <HomeIndicators />
 */
const HomeIndicators = () => {
  return (
    <Box
      as="section"
      py={{ base: 16, md: 20 }}
      bg="gray.50"
      aria-labelledby="indicators-heading"
    >
      <Container>
        <Stack gap={10}>
          <Stack gap={3} maxW="2xl">
            <Text
              as="h2"
              id="indicators-heading"
              fontSize={{ base: '2xl', md: '3xl' }}
              fontWeight="bold"
              color="accent.fg"
            >
              Indicadores
            </Text>
            <Text fontSize="md" color="fg.muted">
              Nenhum número é exibido sem fonte, data e status de validação.
            </Text>
          </Stack>

          <Grid
            templateColumns={{
              base: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(3, 1fr)',
            }}
            gap={4}
          >
            {INDICATORS.map((indicator) => {
              return (
                <Box
                  key={indicator.label}
                  p={6}
                  bg="white"
                  rounded="xl"
                  border="1px solid"
                  borderColor="gray.200"
                  shadow="sm"
                >
                  <Stack gap={2}>
                    <Text
                      fontSize={{ base: '3xl', md: '4xl' }}
                      fontWeight="bold"
                      color="highlight.fg"
                      lineHeight="none"
                    >
                      {indicator.value}
                    </Text>
                    <Text
                      fontWeight="semibold"
                      fontSize="sm"
                      color="fg.default"
                    >
                      {indicator.label}
                    </Text>
                    <Stack gap={1} mt={1}>
                      <Text fontSize="xs" color="fg.subtle">
                        Fonte: {indicator.source}
                      </Text>
                      <Text fontSize="xs" color="fg.subtle">
                        Atualizado em: {indicator.updatedAt}
                      </Text>
                    </Stack>
                    <Box mt={1}>
                      <Badge
                        colorPalette={STATUS_COLORS[indicator.status]}
                        size="sm"
                        variant="subtle"
                      >
                        {STATUS_LABELS[indicator.status]}
                      </Badge>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
};

export default HomeIndicators;

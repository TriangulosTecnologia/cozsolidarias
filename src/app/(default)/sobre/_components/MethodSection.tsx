import { Box, Grid, GridItem, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';

type MethodItem = { title: string; text: string };

const ITEMS: MethodItem[] = [
  {
    title: 'Mapeamos',
    text: 'Registros territoriais, cozinhas, entidades, fontes e relações.',
  },
  {
    title: 'Documentamos',
    text: 'Origem, data, cobertura, campos, tratamento e limitações.',
  },
  {
    title: 'Validamos',
    text: 'Consistência, duplicidade, status, precisão e rastreabilidade.',
  },
  {
    title: 'Visualizamos',
    text: 'Mapas, recortes, indicadores e leituras territoriais.',
  },
  {
    title: 'Devolvemos',
    text: 'Informação útil para ação pública, pesquisa e redes comunitárias.',
  },
];

type StepProps = {
  item: MethodItem;
  index: number;
  isLast: boolean;
};

/**
 * Single method step with numbered circle and optional connector line.
 *
 * @param item - Step data.
 * @param index - Zero-based index used to compute the display number.
 * @param isLast - When true, omits the connector line below the circle.
 *
 * @example
 * <MethodStep item={items[0]} index={0} isLast={false} />
 */
const MethodStep = ({ item, index, isLast }: StepProps) => {
  return (
    <Box display="flex" gap={6}>
      {/* Number + vertical connector */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        flexShrink={0}
      >
        <Box
          w="2.5rem"
          h="2.5rem"
          borderRadius="full"
          bg="verde.600"
          color="ivory.50"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Text textStyle="caption" fontWeight="600">
            {String(index + 1).padStart(2, '0')}
          </Text>
        </Box>
        {!isLast && <Box w="1px" flex={1} bg="ivory.400" mt={2} minH="2rem" />}
      </Box>

      {/* Content */}
      <Box pb={isLast ? 0 : 8}>
        <Text textStyle="title-3" color="charcoal.900" mb={2}>
          {item.title}
        </Text>
        <Text textStyle="body-sm" color="charcoal.700">
          {item.text}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * MethodSection — five-step process with verb-led steps connected by a vertical line.
 * Heading sticks on desktop while steps scroll.
 *
 * @example
 * <MethodSection />
 */
const MethodSection = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.50"
      aria-labelledby="method-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="start"
        >
          {/* Heading — cols 1–4, sticky on desktop */}
          <GridItem colSpan={{ base: 1, lg: 4 }}>
            <Stack
              gap={4}
              position={{ lg: 'sticky' }}
              top={{ lg: '7rem' }}
              mb={{ base: 8, lg: 0 }}
            >
              <Text textStyle="eyebrow" color="verde.600">
                Como trabalhamos
              </Text>
              <Text
                as="h2"
                id="method-heading"
                textStyle="title-2"
                color="charcoal.900"
              >
                Método antes de número.
              </Text>
              <Box mt={2} pt={4} borderTop="1px solid" borderColor="ivory.400">
                <Text textStyle="caption" color="charcoal.500">
                  Toda informação deve indicar fonte, data, cobertura e limite
                  metodológico.
                </Text>
              </Box>
            </Stack>
          </GridItem>

          {/* Steps — cols 6–12 */}
          <GridItem colSpan={{ base: 1, lg: 7 }} colStart={{ base: 1, lg: 6 }}>
            <Stack gap={0}>
              {ITEMS.map((item, i) => {
                return (
                  <MethodStep
                    key={item.title}
                    item={item}
                    index={i}
                    isLast={i === ITEMS.length - 1}
                  />
                );
              })}
            </Stack>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default MethodSection;

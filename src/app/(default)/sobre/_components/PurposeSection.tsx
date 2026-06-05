import { Box, Grid, GridItem, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';

type PurposeCard = { title: string; text: string };

const CARDS: PurposeCard[] = [
  {
    title: 'Dispersão',
    text: 'Registros fragmentados, fontes heterogêneas e dados incompletos.',
  },
  {
    title: 'Organização',
    text: 'Catálogo, mapa, metadados, status e rastreabilidade.',
  },
  {
    title: 'Devolução',
    text: 'Informação pública para redes, cozinhas, pesquisa e gestão.',
  },
];

type CardProps = { card: PurposeCard };

/**
 * Single purpose card — hover/focus reveals a verde border.
 *
 * @param card - Card data with title and text.
 *
 * @example
 * <PurposeCard card={CARDS[0]} />
 */
const PurposeCard = ({ card }: CardProps) => {
  return (
    <Box
      p={8}
      bg="ivory.50"
      borderRadius="card"
      border="1px solid"
      borderColor="ivory.300"
      cursor="default"
      tabIndex={0}
      transition="border-color 0.2s ease-out, box-shadow 0.2s ease-out"
      _hover={{ borderColor: 'verde.600', boxShadow: 'card' }}
      _focusVisible={{ borderColor: 'verde.600', boxShadow: 'card' }}
    >
      <Text textStyle="title-4" color="charcoal.900" mb={3}>
        {card.title}
      </Text>
      <Text textStyle="body-sm" color="charcoal.700">
        {card.text}
      </Text>
    </Box>
  );
};

/**
 * PurposeSection — explains why the platform exists.
 * Split editorial header; three cards show the dispersão → organização → devolução arc.
 *
 * @example
 * <PurposeSection />
 */
const PurposeSection = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="purpose-heading"
    >
      <Container>
        {/* Editorial header */}
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="start"
          mb="clamp(2rem, calc(1.5rem + 2vw), 4rem)"
        >
          <GridItem colSpan={{ base: 1, lg: 6 }}>
            <Stack gap={5}>
              <Text textStyle="eyebrow" color="verde.600">
                Por que existimos
              </Text>
              <Text
                as="h2"
                id="purpose-heading"
                textStyle="title-1"
                color="charcoal.900"
              >
                A ação das cozinhas acontece no território. A informação sobre
                elas, muitas vezes, permanece dispersa.
              </Text>
            </Stack>
          </GridItem>

          <GridItem colSpan={{ base: 1, lg: 5 }} colStart={{ base: 1, lg: 8 }}>
            <Stack gap={5} pt={{ lg: 12 }}>
              <Text textStyle="body-lg" color="charcoal.700">
                Este projeto existe para organizar essa informação sem apagar
                sua complexidade: quem atua, onde atua, de que fonte vem o
                registro, que cobertura ele possui, que lacunas permanecem e que
                decisões podem ser melhor informadas.
              </Text>
              <Text textStyle="body-sm" color="verde.700" fontStyle="italic">
                A plataforma não substitui o território. Ela melhora a escuta
                pública sobre ele.
              </Text>
            </Stack>
          </GridItem>
        </Grid>

        {/* Three cards */}
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {CARDS.map((card) => {
            return <PurposeCard key={card.title} card={card} />;
          })}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default PurposeSection;

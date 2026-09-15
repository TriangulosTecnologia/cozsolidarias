import { Box, Grid, GridItem, Stack, Text } from '@chakra-ui/react';
import NextImage from 'next/image';

import Container from '../../../components/ui/Container';
import CtaLink from '../../../components/ui/CtaLink';

/**
 * MapEntrySection — territorial map illustration on the left, text and CTA on
 * the right. The illustration is a static render of the kitchen distribution
 * across Brazilian municipalities; the live map lives on `/mapas`.
 *
 * @example
 * <HomeAudiences />
 */
const HomeAudiences = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.200"
      aria-labelledby="map-entry-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="center"
        >
          {/* Map illustration — cols 1–6 */}
          <GridItem colSpan={{ base: 1, lg: 6 }}>
            <Box borderRadius="card" overflow="hidden">
              <NextImage
                src="/images/home_map.webp"
                alt="Mapa do Brasil com círculos proporcionais ao número de cozinhas solidárias registradas por município, com as maiores concentrações no Sudeste, no litoral do Nordeste e no Sul."
                width={1457}
                height={831}
                sizes="(max-width: 1024px) 100vw, 50vw"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </Box>
          </GridItem>

          {/* Text + CTA — cols 8–12 */}
          <GridItem colSpan={{ base: 1, lg: 5 }} colStart={{ base: 1, lg: 8 }}>
            <Stack gap={6}>
              <Text textStyle="eyebrow" color="verde.600">
                Mapa
              </Text>
              <Text
                as="h2"
                id="map-entry-heading"
                textStyle="title-2"
                color="charcoal.900"
              >
                O território é a primeira camada de leitura
              </Text>
              <Text textStyle="body-lg" color="charcoal.700">
                Explore registros por UF, município, fonte e status de
                validação. O mapa não encerra a realidade; ele indica onde olhar
                melhor.
              </Text>
              <Box>
                <CtaLink href="/mapas">Abrir mapa</CtaLink>
              </Box>
            </Stack>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default HomeAudiences;

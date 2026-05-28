import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Container from '../../../components/ui/Container';

/**
 * ProjectDefinitionSection — explains what Cozinhas Solidárias are.
 * Title on left, editorial text block on right, institutional note below.
 * Warm ivory background, no cards.
 *
 * @example
 * <HomeContext />
 */
const HomeContext = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="context-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="start"
        >
          {/* Title — cols 1–5 */}
          <GridItem colSpan={{ base: 1, lg: 5 }}>
            <Text
              as="h2"
              id="context-heading"
              textStyle="title-1"
              color="charcoal.900"
            >
              Cozinhas Solidárias são{' '}
              <Box as="span" color="verde.600">
                infraestruturas comunitárias
              </Box>{' '}
              de cuidado.
            </Text>
          </GridItem>

          {/* Text — cols 7–12 */}
          <GridItem colSpan={{ base: 1, lg: 6 }} colStart={{ base: 1, lg: 7 }}>
            <Box display="flex" flexDirection="column" gap={6}>
              <Text textStyle="body-lg" color="charcoal.700">
                Elas organizam preparo, distribuição de refeições, vínculo
                territorial e resposta cotidiana à insegurança alimentar.
              </Text>
              <Text textStyle="body-lg" color="charcoal.700">
                Esta plataforma existe para tornar essa rede visível,
                compreensível e acionável.
              </Text>
            </Box>
          </GridItem>
        </Grid>

        {/* Institutional note */}
        <Box
          mt="clamp(2rem, calc(1.5rem + 2vw), 4rem)"
          pt="clamp(1.5rem, calc(1rem + 1.5vw), 3rem)"
          borderTop="1px solid"
          borderColor="ivory.400"
        >
          <Text textStyle="body-sm" color="charcoal.500" maxW="72ch">
            O programa federal reconhece Cozinhas Solidárias como tecnologia
            social de combate à fome organizada pela sociedade civil. Lei nº
            14.628/2023, regulamentada pelo Decreto nº 11.937/2024.
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default HomeContext;

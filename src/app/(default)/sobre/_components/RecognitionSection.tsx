import { Box, Grid, GridItem, Stack, Text } from '@chakra-ui/react';
import NextImage from 'next/image';

import Container from '@/components/ui/Container';

/**
 * RecognitionSection — defines what Cozinhas Solidárias are.
 * 12-col grid: main text 7 cols, illustration 3 cols.
 * Factual institutional note rendered as a highlighted bordered block.
 *
 * @example
 * <RecognitionSection />
 */
const RecognitionSection = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.50"
      aria-labelledby="recognition-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="start"
        >
          {/* Main text — cols 1–7 */}
          <GridItem colSpan={{ base: 1, lg: 7 }}>
            <Stack gap={6}>
              <Text textStyle="eyebrow" color="verde.600">
                O que reconhecemos
              </Text>
              <Text
                as="h2"
                id="recognition-heading"
                textStyle="title-1"
                color="charcoal.900"
              >
                Reconhecemos as Cozinhas Solidárias como infraestruturas
                comunitárias de enfrentamento à fome.
              </Text>
              <Text textStyle="body-lg" color="charcoal.700">
                Elas não são apenas pontos de distribuição de comida. São redes
                de preparo, vínculo, cuidado, logística, território, organização
                social e resposta cotidiana à insegurança alimentar.
              </Text>

              {/* Factual note — prominent bordered block */}
              <Box
                borderLeft="3px solid"
                borderColor="verde.600"
                pl={5}
                py={3}
                bg="verde.50"
                borderRadius="0 8px 8px 0"
              >
                <Text textStyle="body-sm" color="charcoal.700">
                  No marco federal, as Cozinhas Solidárias são reconhecidas como
                  tecnologia social de combate à fome organizada pela sociedade
                  civil para produzir e ofertar refeições gratuitas.
                </Text>
              </Box>
            </Stack>
          </GridItem>

          {/* Illustration — cols 10–12 */}
          <GridItem
            colSpan={{ base: 1, lg: 3 }}
            colStart={{ base: 1, lg: 10 }}
            display={{ base: 'none', lg: 'flex' }}
            alignItems="center"
            justifyContent="center"
            alignSelf="stretch"
          >
            <Box position="relative" w="200px" h="200px">
              <NextImage
                src="/illustrations/icones_ds_cozinhaArtboard 981.png"
                alt="fruit illustration"
                fill
                style={{ objectFit: 'contain' }}
              />
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default RecognitionSection;

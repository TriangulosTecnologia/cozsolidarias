import { Box, Grid, GridItem, Link, Stack, Text } from '@chakra-ui/react';
import NextImage from 'next/image';
import NextLink from 'next/link';

import Container from '../../../components/ui/Container';

/**
 * Hero section — 12-col grid, text cols 1–6, image cols 7–12.
 *
 * @example
 * <HomeHero />
 */
const HeroFallback = () => {
  return (
    <Box position="relative" w="full" h="full" overflow="hidden">
      {/* Brasil outline abstraction — decorative dots grid */}
      {Array.from({ length: 24 }).map((_, i) => {
        return (
          <Box
            key={i}
            position="absolute"
            w="6px"
            h="6px"
            borderRadius="full"
            bg="ivory.400"
            style={{
              left: `${(i % 6) * 18 + 8}%`,
              top: `${Math.floor(i / 6) * 22 + 10}%`,
              opacity: 0.4 + (i % 3) * 0.2,
            }}
          />
        );
      })}
      <Text
        position="absolute"
        bottom={6}
        left={6}
        textStyle="eyebrow"
        color="charcoal.500"
      >
        Mapa territorial
      </Text>
    </Box>
  );
};

const HeroImageBlock = () => {
  return (
    <GridItem colSpan={{ base: 1, lg: 6 }}>
      <Box
        position="relative"
        overflow="hidden"
        borderRadius={0}
        animationName="fade-in"
        animationDuration="slow"
        animationTimingFunction="ease-out"
        animationFillMode="both"
        animationDelay="0.2s"
      >
        {/* Aspect ratio wrapper 4:3 */}
        <Box
          position="relative"
          w="full"
          style={{ paddingBottom: '75%' }}
          bg="ivory.200"
        >
          <NextImage
            src="/images/home_hero.png"
            alt="Ilustração de um mapa do Brasil conectado a cartões de dados, registros territoriais e cenas comunitárias de cozinhas solidárias."
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            style={{ objectFit: 'cover' }}
            priority
          />
          {/* Fallback graphic rendered when image is absent */}
          <Box
            position="absolute"
            inset={0}
            bg="ivory.200"
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex={-1}
          >
            <HeroFallback />
          </Box>
        </Box>
      </Box>
    </GridItem>
  );
};

const HeroCTAs = () => {
  return (
    <Stack
      direction={{ base: 'column', sm: 'row' }}
      gap={3}
      animationName="slide-from-bottom, fade-in"
      animationDuration="slow"
      animationTimingFunction="ease-out"
      animationFillMode="both"
      animationDelay="0.44s"
    >
      <Link
        asChild
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        minH="52px"
        px={7}
        borderRadius="pill"
        bg="verde.600"
        color="ivory.50"
        fontSize="0.875rem"
        fontWeight="500"
        letterSpacing="0.04em"
        textTransform="uppercase"
        textDecoration="none"
        transition="all 0.3s ease-out"
        _hover={{ bg: 'verde.700', transform: 'translateY(-1px)' }}
      >
        <NextLink href="/mapas">Explorar mapa</NextLink>
      </Link>
      <Link
        asChild
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        minH="52px"
        px={7}
        borderRadius="pill"
        border="1px solid"
        borderColor="ivory.400"
        color="charcoal.900"
        fontSize="0.875rem"
        fontWeight="500"
        letterSpacing="0.04em"
        textTransform="uppercase"
        textDecoration="none"
        transition="all 0.3s ease-out"
        _hover={{
          bg: 'ivory.200',
          borderColor: 'charcoal.700',
          transform: 'translateY(-1px)',
        }}
      >
        <NextLink href="/dados">Ver catálogo de dados</NextLink>
      </Link>
    </Stack>
  );
};

const HomeHero = () => {
  return (
    <Box
      as="section"
      pt="clamp(3rem, calc(2rem + 3vw), 6rem)"
      pb="clamp(3rem, calc(2rem + 3vw), 6rem)"
      minH={{ base: 'auto', lg: '86vh' }}
      display="flex"
      alignItems="center"
      aria-labelledby="hero-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="center"
        >
          <GridItem colSpan={{ base: 1, lg: 6 }}>
            <Stack gap={6}>
              {/* Eyebrow — enters first */}
              <Text
                as="span"
                textStyle="eyebrow"
                color="verde.600"
                animationName="slide-from-bottom, fade-in"
                animationDuration="slow"
                animationTimingFunction="ease-out"
                animationFillMode="both"
                animationDelay="0s"
              >
                Atlas público das Cozinhas Solidárias
              </Text>

              {/* H1 — two lines cascade */}
              <Box>
                <Text
                  as="h1"
                  id="hero-heading"
                  textStyle="display"
                  color="charcoal.900"
                  style={{ lineHeight: '1em' }}
                >
                  <Box
                    as="span"
                    display="block"
                    animationName="slide-from-bottom, fade-in"
                    animationDuration="slow"
                    animationTimingFunction="ease-out"
                    animationFillMode="both"
                    animationDelay="0.1s"
                  >
                    Territórios que alimentam.
                  </Box>
                  <Box
                    as="span"
                    display="block"
                    animationName="slide-from-bottom, fade-in"
                    animationDuration="slow"
                    animationTimingFunction="ease-out"
                    animationFillMode="both"
                    animationDelay="0.2s"
                  >
                    Dados que fortalecem.
                  </Box>
                </Text>
              </Box>

              {/* Description */}
              <Text
                textStyle="body-lg"
                color="charcoal.700"
                maxW="44ch"
                animationName="slide-from-bottom, fade-in"
                animationDuration="slow"
                animationTimingFunction="ease-out"
                animationFillMode="both"
                animationDelay="0.32s"
              >
                Mapeamos cozinhas, fontes e evidências para apoiar redes
                comunitárias, pesquisa, políticas públicas e ações de
                enfrentamento à fome.
              </Text>

              {/* CTAs */}
              <HeroCTAs />

              {/* Trust line — enters last */}
              <Text
                textStyle="caption"
                color="charcoal.500"
                animationName="fade-in"
                animationDuration="slow"
                animationTimingFunction="ease-out"
                animationFillMode="both"
                animationDelay="0.56s"
              >
                Toda informação deve carregar fonte, data, cobertura e limite.
              </Text>
            </Stack>
          </GridItem>

          <HeroImageBlock />
        </Grid>
      </Container>
    </Box>
  );
};

/** Abstract territorial dot-pattern fallback rendered when hero image is absent. */

export default HomeHero;

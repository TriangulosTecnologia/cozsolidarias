import { Box, Stack, Text } from '@chakra-ui/react';
import NextImage from 'next/image';

import Container from '@/components/ui/Container';

/**
 * Full-viewport hero for the `/sobre` page.
 *
 * Bleeds behind the fixed header (`mt="-72px"`) so the background image
 * fills 100vh from the very top of the viewport. Text is centered and
 * padded down by 72px to clear the header.
 *
 * @example
 * <AboutHero />
 */
const AboutHero = () => {
  return (
    <Box
      as="section"
      position="relative"
      h="100vh"
      mt="-72px"
      display="flex"
      alignItems="center"
      pb={{ base: '15vh', md: '25vh' }}
      overflow="hidden"
      aria-labelledby="about-title"
    >
      <NextImage
        src="/images/about_bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
      />

      <Box
        position="absolute"
        inset={0}
        style={{
          background:
            'linear-gradient(to bottom, rgba(244,240,232,0.18) 0%, rgba(244,240,232,0) 55%)',
        }}
        aria-hidden="true"
      />

      <Box position="relative" zIndex={1} w="full">
        <Container>
          <Box pt="4.5rem">
            <Stack gap={5} align="center" textAlign="center">
              <Text
                as="span"
                textStyle="eyebrow"
                color="verde.700"
                animationName="fade-in"
                animationDuration="slow"
                animationTimingFunction="ease-out"
                animationFillMode="both"
                animationDelay="0s"
              >
                Sobre o projeto
              </Text>

              <Text
                as="h1"
                id="about-title"
                textStyle="title-1"
                color="charcoal.900"
                maxW="760px"
                mx="auto"
                animationName="slide-from-bottom, fade-in"
                animationDuration="slow"
                animationTimingFunction="ease-out"
                animationFillMode="both"
                animationDelay="0.1s"
              >
                Informação pública para reconhecer, compreender e fortalecer
                Cozinhas Solidárias.
              </Text>

              <Text
                textStyle="body-lg"
                color="charcoal.700"
                maxW="44ch"
                mx="auto"
                animationName="slide-from-bottom, fade-in"
                animationDuration="slow"
                animationTimingFunction="ease-out"
                animationFillMode="both"
                animationDelay="0.2s"
              >
                Organizamos dados, fontes e territórios para tornar visível uma
                rede comunitária de cuidado, alimentação e enfrentamento à fome
                no Brasil.
              </Text>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default AboutHero;

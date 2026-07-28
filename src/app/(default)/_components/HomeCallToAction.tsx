import { Box, Flex, Stack, Text } from '@chakra-ui/react';

import Container from '../../../components/ui/Container';
import CtaLink from '../../../components/ui/CtaLink';

/**
 * FinalCtaSection — deep verde.900 contrast section closing the homepage.
 * Typography and negative space carry the section; no illustrations.
 * Laranja CTAs on dark background for maximum attention contrast.
 *
 * @example
 * <HomeCallToAction />
 */
const HomeCallToAction = () => {
  return (
    <Box
      as="section"
      py="clamp(4rem, calc(3rem + 4vw), 8rem)"
      bg="verde.900"
      aria-labelledby="cta-heading"
    >
      <Container>
        <Stack
          gap="clamp(2.5rem, calc(2rem + 2vw), 5rem)"
          align="center"
          textAlign="center"
        >
          <Stack gap={5} align="center">
            <Text textStyle="eyebrow" color="verde.400">
              Ação pública
            </Text>
            <Text
              as="h2"
              id="cta-heading"
              textStyle="title-1"
              color="ivory.100"
              maxW="20ch"
            >
              Informação pública que volta ao território
            </Text>
            <Text textStyle="body-lg" color="verde.300" maxW="52ch">
              Se você atua em uma cozinha, pesquisa o tema, representa uma
              instituição ou conhece uma fonte relevante, ajude a qualificar
              esta base.
            </Text>
          </Stack>

          <Flex
            gap={4}
            direction={{ base: 'column', sm: 'row' }}
            align="center"
          >
            <CtaLink href="/contato" variant="solid-laranja">
              Colaborar
            </CtaLink>
            <CtaLink href="/contato" variant="outline-dark">
              Entrar em contato
            </CtaLink>
          </Flex>
        </Stack>
      </Container>
    </Box>
  );
};

export default HomeCallToAction;

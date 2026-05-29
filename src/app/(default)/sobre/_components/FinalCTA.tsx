import { Box, Flex, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';
import CtaLink from '@/components/ui/CtaLink';

/**
 * FinalCTA — deep verde.900 section closing the `/sobre` page.
 * Three actions: primary (laranja), secondary (outlined), tertiary (text link).
 *
 * @example
 * <FinalCTA />
 */
const FinalCTA = () => {
  return (
    <Box
      as="section"
      py="clamp(4rem, calc(3rem + 4vw), 8rem)"
      bg="verde.900"
      aria-labelledby="about-cta-heading"
    >
      <Container>
        <Stack
          gap="clamp(2.5rem, calc(2rem + 2vw), 5rem)"
          align="center"
          textAlign="center"
        >
          <Stack gap={5} align="center">
            <Text
              as="h2"
              id="about-cta-heading"
              textStyle="title-1"
              color="ivory.100"
              maxW="24ch"
            >
              Informação pública se fortalece com colaboração.
            </Text>
            <Text textStyle="body-lg" color="verde.300" maxW="52ch">
              Se você atua em uma cozinha, representa uma instituição, pesquisa
              o tema ou conhece uma fonte relevante, ajude a qualificar esta
              base.
            </Text>
          </Stack>

          <Flex
            gap={4}
            direction={{ base: 'column', sm: 'row' }}
            align="center"
            justify="center"
            wrap="wrap"
          >
            <CtaLink href="/contato?assunto=correcao" variant="solid-laranja">
              Colaborar
            </CtaLink>
            <CtaLink href="/contato" variant="outline-dark">
              Entrar em contato
            </CtaLink>
            <CtaLink href="/metodologia" variant="ghost">
              Ver metodologia
            </CtaLink>
          </Flex>
        </Stack>
      </Container>
    </Box>
  );
};

export default FinalCTA;

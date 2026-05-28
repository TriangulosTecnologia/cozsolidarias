import { Box, Flex, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import Container from '../../../components/ui/Container';

const EXPO_OUT = 'cubic-bezier(0.19, 1, 0.22, 1)';

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
              Informação pública que volta ao território.
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
            <Link
              asChild
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              minH="52px"
              px={7}
              borderRadius="pill"
              bg="laranja.500"
              color="charcoal.900"
              fontSize="0.875rem"
              fontWeight="500"
              letterSpacing="0.04em"
              textTransform="uppercase"
              textDecoration="none"
              transition={`all 0.3s ${EXPO_OUT}`}
              _hover={{ bg: 'laranja.400', transform: 'translateY(-1px)' }}
            >
              <NextLink href="/contato">Sugerir correção</NextLink>
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
              borderColor="verde.600"
              color="ivory.100"
              fontSize="0.875rem"
              fontWeight="500"
              letterSpacing="0.04em"
              textTransform="uppercase"
              textDecoration="none"
              transition={`all 0.3s ${EXPO_OUT}`}
              _hover={{
                borderColor: 'verde.400',
                color: 'ivory.50',
                transform: 'translateY(-1px)',
              }}
            >
              <NextLink href="/contato">Entrar em contato</NextLink>
            </Link>
          </Flex>
        </Stack>
      </Container>
    </Box>
  );
};

export default HomeCallToAction;

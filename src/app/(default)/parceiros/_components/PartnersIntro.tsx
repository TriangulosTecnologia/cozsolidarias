import { Box, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';

/**
 * Opening block for the `/parceiros` page: page title and a short intro
 * explaining what the partners list represents.
 *
 * @example
 * <PartnersIntro />
 */
const PartnersIntro = () => {
  return (
    <Box
      as="section"
      py="clamp(2.5rem, calc(2rem + 2vw), 5rem)"
      bg="ivory.50"
      aria-labelledby="partners-title"
    >
      <Container>
        <Stack gap={4} maxW="640px">
          <Text textStyle="eyebrow" color="verde.600">
            Parceiros
          </Text>
          <Text
            as="h1"
            id="partners-title"
            textStyle="title-1"
            color="charcoal.900"
          >
            Instituições e agências que sustentam o projeto
          </Text>
          <Text textStyle="body-lg" color="charcoal.700">
            Conheça as instituições, redes de pesquisa e agências de fomento que
            apoiam o desenvolvimento do Cozinha Solidária em Rede.
          </Text>
        </Stack>
      </Container>
    </Box>
  );
};

export default PartnersIntro;

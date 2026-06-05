import { Box, Grid, GridItem, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import { legalNav, mainNav } from '../../../config/navigation';
import { EXPO_OUT } from '../../../config/site';
import Container from '../../ui/Container';
import BrandLogo from '../Header/BrandLogo';

/**
 * SiteFooter — coral.500 background, large brand mark, three nav columns.
 * Visual weight is essential: not a generic gray footer.
 *
 * @example
 * <Footer />
 */
const Footer = () => {
  return (
    <Box as="footer" bg="coral.500">
      <Container>
        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          pt="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
          pb="clamp(2rem, calc(1.5rem + 2vw), 4rem)"
          alignItems="start"
        >
          {/* Brand — cols 1–4 */}
          <GridItem colSpan={{ base: 1, md: 4 }}>
            <Box maxW={{ base: '180px', md: '240px' }}>
              <BrandLogo variant="black_horizontal" width={796} height={313} />
            </Box>
          </GridItem>

          {/* Nav links — cols 5–8 */}
          <GridItem colSpan={{ base: 1, md: 4 }} colStart={{ base: 1, md: 5 }}>
            <Stack as="nav" gap={4} aria-label="Navegação do rodapé">
              {mainNav.map((entry) => {
                return (
                  <Link
                    key={entry.id}
                    asChild
                    textStyle="body-sm"
                    color="charcoal.900"
                    textDecoration="none"
                    transition={`opacity 0.3s ${EXPO_OUT}`}
                    _hover={{ opacity: 0.6 }}
                  >
                    <NextLink href={entry.href}>{entry.label}</NextLink>
                  </Link>
                );
              })}
            </Stack>
          </GridItem>

          {/* Legal links — cols 9–12 */}
          <GridItem colSpan={{ base: 1, md: 4 }} colStart={{ base: 1, md: 9 }}>
            <Stack as="nav" gap={4} aria-label="Links legais">
              {legalNav.map((entry) => {
                return (
                  <Link
                    key={entry.id}
                    asChild
                    textStyle="body-sm"
                    color="charcoal.900"
                    textDecoration="none"
                    transition={`opacity 0.3s ${EXPO_OUT}`}
                    _hover={{ opacity: 0.6 }}
                  >
                    <NextLink href={entry.href}>{entry.label}</NextLink>
                  </Link>
                );
              })}
            </Stack>
          </GridItem>
        </Grid>

        {/* Baseline */}
        <Box
          borderTop="1px solid"
          borderColor="coral.600"
          py={6}
          textAlign="center"
        >
          <Text textStyle="caption" color="charcoal.700">
            Dados, território e cuidado como infraestrutura pública.
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;

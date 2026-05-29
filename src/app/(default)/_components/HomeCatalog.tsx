import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Container from '../../../components/ui/Container';
import CtaLink from '../../../components/ui/CtaLink';

type DataRowProps = { label: string; value: string };

const DataRow = ({ label, value }: DataRowProps) => {
  return (
    <Box
      display="grid"
      gridTemplateColumns="120px 1fr"
      gap={3}
      pb={4}
      borderBottom="1px solid"
      borderColor="ivory.300"
      _last={{ borderBottom: 'none', pb: 0 }}
    >
      <Text textStyle="caption" color="charcoal.500" pt="1px">
        {label}
      </Text>
      <Text textStyle="body-sm" color="charcoal.900">
        {value}
      </Text>
    </Box>
  );
};

/**
 * CatalogTrustSection — demonstrates data rigour via a single example dataset card.
 * Editorial text left, dataset object card right, microcopy below.
 *
 * @example
 * <HomeCatalog />
 */
const HomeCatalog = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="catalog-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="start"
        >
          {/* Editorial text — cols 1–5 */}
          <GridItem colSpan={{ base: 1, lg: 5 }}>
            <Box display="flex" flexDirection="column" gap={6}>
              <Text textStyle="eyebrow" color="verde.600">
                Catálogo de dados
              </Text>
              <Text
                as="h2"
                id="catalog-heading"
                textStyle="title-1"
                color="charcoal.900"
              >
                Nenhum dado sem contexto.
              </Text>
              <Text textStyle="body-lg" color="charcoal.700">
                Cada dataset deve indicar origem, período, cobertura, campos,
                tratamento, limitações e status de validação.
              </Text>
              <Box>
                <CtaLink href="/dados" variant="outline">
                  Ver catálogo de dados
                </CtaLink>
              </Box>
              <Text textStyle="caption" color="charcoal.500">
                Informação não identificada permanece visível como lacuna.
              </Text>
            </Box>
          </GridItem>

          {/* Dataset card — cols 7–12 */}
          <GridItem colSpan={{ base: 1, lg: 6 }} colStart={{ base: 1, lg: 7 }}>
            <Box bg="ivory.50" borderRadius="card" overflow="hidden">
              {/* Card header */}
              <Box
                px={8}
                py={5}
                borderBottom="1px solid"
                borderColor="ivory.300"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text textStyle="eyebrow" color="charcoal.500">
                  Dataset
                </Text>
                <Box
                  px={3}
                  py={1}
                  borderRadius="pill"
                  bg="mistGreen"
                  fontSize="0.75rem"
                  letterSpacing="0.04em"
                  textTransform="uppercase"
                  fontWeight="500"
                  color="verde.700"
                >
                  Em tratamento
                </Box>
              </Box>

              {/* Card body */}
              <Box px={8} py={6}>
                <Text textStyle="title-4" color="charcoal.900" mb={6}>
                  Cadastro de Cozinhas Solidárias
                </Text>
                <Box display="flex" flexDirection="column" gap={4}>
                  <DataRow
                    label="Fonte"
                    value="Ministério do Desenvolvimento Social"
                  />
                  <DataRow label="Cobertura" value="Brasil — municipal" />
                  <DataRow label="Período" value="A partir de 2023" />
                  <DataRow label="Status" value="Em tratamento metodológico" />
                  <DataRow
                    label="Limitações"
                    value="Campos de localização parcialmente identificados"
                  />
                </Box>
              </Box>
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default HomeCatalog;

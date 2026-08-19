import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Container from '../../../../components/ui/Container';
import type {
  CatalogueMetaContract,
  CatalogueSummaryContract,
} from '../../../../data-gateway/schema';
import CatalogueBadge from './CatalogueBadge';
import { formatCount, formatDate, formatStatus } from './catalogueLabels';

type Props = {
  meta: CatalogueMetaContract;
  summary: CatalogueSummaryContract;
};

type CounterProps = { value: string; label: string };

const Counter = ({ value, label }: CounterProps) => {
  return (
    <Box>
      <Text textStyle="title-3" color="charcoal.900">
        {value}
      </Text>
      <Text
        textStyle="caption"
        color="charcoal.500"
        textTransform="uppercase"
        letterSpacing="0.08em"
      >
        {label}
      </Text>
    </Box>
  );
};

/**
 * Opening section of `/dados`: the catalogue's own title and purpose, its
 * edition state, and a strip of counts derived from the datasets themselves —
 * so the numbers cannot drift from what the page lists below. Server Component.
 *
 * @param meta - Catalogue metadata (title, description, status, edition date).
 * @param summary - Derived counts rendered as the counter strip.
 *
 * @example
 * <CatalogueHero meta={catalogue.meta} summary={catalogue.summary} />
 */
const CatalogueHero = ({ meta, summary }: Props) => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="catalogue-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="end"
        >
          <GridItem colSpan={{ base: 1, lg: 8 }}>
            <Box display="flex" flexDirection="column" gap={6}>
              <Text textStyle="eyebrow" color="verde.600">
                Catálogo de dados
              </Text>
              <Text
                as="h1"
                id="catalogue-heading"
                textStyle="title-1"
                color="charcoal.900"
              >
                {meta.title}
              </Text>
              <Text textStyle="body-lg" color="charcoal.700" maxW="60ch">
                {meta.description}
              </Text>
              <Box display="flex" flexWrap="wrap" gap={3} alignItems="center">
                <CatalogueBadge tone="alert">
                  {formatStatus(meta.status)}
                </CatalogueBadge>
                <Text textStyle="caption" color="charcoal.500">
                  Atualizado em {formatDate(meta.updatedAt)} · esquema{' '}
                  {meta.schemaVersion}
                </Text>
              </Box>
            </Box>
          </GridItem>
        </Grid>

        <Grid
          templateColumns={{
            base: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          mt="clamp(2rem, calc(1.5rem + 2vw), 4rem)"
          pt={8}
          borderTop="1px solid"
          borderColor="ivory.300"
        >
          <Counter value={formatCount(summary.datasetCount)} label="datasets" />
          <Counter
            value={formatCount(summary.collectionCount)}
            label="fontes"
          />
          <Counter
            value={formatCount(summary.fieldCount)}
            label="campos documentados"
          />
          <Counter
            value={formatCount(summary.sensitiveFieldCount)}
            label="campos sensíveis"
          />
        </Grid>

        <Text textStyle="body-sm" color="charcoal.500" mt={6}>
          Formatos: {summary.formats.join(' · ')} · Acesso restrito em{' '}
          {formatCount(summary.restrictedDatasetCount)} de{' '}
          {formatCount(summary.datasetCount)} datasets.
        </Text>
      </Container>
    </Box>
  );
};

export default CatalogueHero;

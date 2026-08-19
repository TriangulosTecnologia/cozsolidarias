import { Box, Grid, GridItem, Link, Text } from '@chakra-ui/react';

import Container from '../../../../components/ui/Container';
import type { CatalogueCollectionContract } from '../../../../data-gateway/schema';
import CatalogueBadge from './CatalogueBadge';
import DatasetCard from './DatasetCard';

type Props = { collections: CatalogueCollectionContract[] };

/**
 * The body of the catalogue: an anchor index, then one block per institutional
 * source (its publisher, purpose and tags) followed by every dataset it
 * publishes. Sources and datasets arrive already sorted by the gateway, so the
 * order is stable across reads.
 *
 * Fully server-rendered — the index is plain anchor links, so navigation works
 * without JavaScript and every dataset is directly linkable. Server Component.
 *
 * @param collections - Sources with their nested datasets.
 *
 * @example
 * <CatalogueCollections collections={catalogue.collections} />
 */
const CatalogueCollections = ({ collections }: Props) => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="sources-heading"
    >
      <Container>
        <Text textStyle="eyebrow" color="verde.600" mb={6}>
          Fontes e datasets
        </Text>
        <Text
          as="h2"
          id="sources-heading"
          textStyle="title-2"
          color="charcoal.900"
          mb={8}
        >
          Cada dataset e o que se sabe sobre ele
        </Text>

        <Box
          as="nav"
          aria-label="Índice de fontes"
          display="flex"
          flexWrap="wrap"
          gap={3}
          pb={8}
          mb="clamp(2rem, calc(1.5rem + 2vw), 4rem)"
          borderBottom="1px solid"
          borderColor="ivory.300"
        >
          {collections.map((collection) => {
            return (
              <Link
                key={collection.id}
                href={`#${collection.slug}`}
                display="inline-flex"
                alignItems="center"
                gap={2}
                px={4}
                py={2}
                borderRadius="pill"
                border="1px solid"
                borderColor="ivory.400"
                bg="ivory.50"
                textStyle="body-sm"
                color="charcoal.900"
                textDecoration="none"
                _hover={{ borderColor: 'charcoal.700', bg: 'ivory.200' }}
              >
                {collection.title}
                <Text as="span" textStyle="caption" color="charcoal.500">
                  {collection.datasets.length}
                </Text>
              </Link>
            );
          })}
        </Box>

        <Box display="flex" flexDirection="column" gap="clamp(3rem, 5vw, 5rem)">
          {collections.map((collection) => {
            return (
              <Box
                key={collection.id}
                id={collection.slug}
                scrollMarginTop="6rem"
              >
                <Grid
                  templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
                  gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
                  mb={8}
                >
                  <GridItem colSpan={{ base: 1, lg: 5 }}>
                    <Text as="h3" textStyle="title-3" color="charcoal.900">
                      {collection.title}
                    </Text>
                    <Text textStyle="body-sm" color="charcoal.500" mt={2}>
                      {collection.organization}
                    </Text>
                  </GridItem>
                  <GridItem
                    colSpan={{ base: 1, lg: 6 }}
                    colStart={{ base: 1, lg: 7 }}
                  >
                    <Text textStyle="body" color="charcoal.700">
                      {collection.description}
                    </Text>
                    <Box display="flex" flexWrap="wrap" gap={2} mt={4}>
                      {collection.tags.map((tag) => {
                        return <CatalogueBadge key={tag}>{tag}</CatalogueBadge>;
                      })}
                    </Box>
                  </GridItem>
                </Grid>

                {collection.datasets.length === 0 ? (
                  <Text textStyle="body-sm" color="charcoal.500">
                    Nenhum dataset desta fonte está catalogado ainda.
                  </Text>
                ) : (
                  <Box display="flex" flexDirection="column" gap={6}>
                    {collection.datasets.map((dataset) => {
                      return <DatasetCard key={dataset.id} dataset={dataset} />;
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default CatalogueCollections;

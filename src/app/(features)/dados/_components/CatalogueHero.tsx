import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Container from '../../../../components/ui/Container';
import type { CatalogueMetaContract } from '../../../../data-gateway/schema';
import CatalogueBadge from './CatalogueBadge';
import { formatDate, formatStatus } from './catalogueLabels';

type Props = { meta: CatalogueMetaContract };

/**
 * Opening section of `/dados`: the catalogue's own title and purpose, plus its
 * edition state. Server Component.
 *
 * @param meta - Catalogue metadata (title, description, status, edition date).
 *
 * @example
 * <CatalogueHero meta={catalogue.meta} />
 */
const CatalogueHero = ({ meta }: Props) => {
  return (
    <Box
      as="section"
      pt="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      // The dataset grid below shares this background, so its own top padding
      // already separates the two — a full bottom padding here would read as a
      // gap rather than as breathing room.
      pb="clamp(1rem, calc(0.5rem + 1vw), 2rem)"
      bg="ivory.100"
      aria-labelledby="catalogue-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
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
      </Container>
    </Box>
  );
};

export default CatalogueHero;

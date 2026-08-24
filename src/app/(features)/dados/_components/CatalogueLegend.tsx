import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Container from '../../../../components/ui/Container';
import {
  COVERAGE_LABELS,
  HISTORY_LABELS,
  PRECISION_LABELS,
} from './catalogueLabels';

type LegendGroup = { title: string; entries: Array<[string, string]> };

/**
 * The vocabularies the dataset cards use. Built from the same label maps the
 * cards read, so a wording change cannot leave the legend behind.
 */
const GROUPS: LegendGroup[] = [
  {
    title: 'Histórico',
    entries: [
      ['Série acumulada', HISTORY_LABELS.appendOnly],
      ['Substituição', HISTORY_LABELS.overwrite],
      ['Revisão', HISTORY_LABELS.revised],
      ['Retrato', HISTORY_LABELS.snapshot],
    ],
  },
  {
    title: 'Cobertura',
    entries: [
      ['Exaustiva', 'todos os registros do território declarado'],
      ['Parcial', 'um recorte, não o universo completo'],
      ['Amostra', 'subconjunto estatístico'],
      ['Não documentada', COVERAGE_LABELS.unknown],
    ],
  },
  {
    title: 'Precisão',
    entries: [
      ['Exata', PRECISION_LABELS.exact],
      ['Aproximada', PRECISION_LABELS.approximate],
      ['Centroide', 'ponto no centro da área, não no endereço'],
      ['Não documentada', PRECISION_LABELS.unknown],
    ],
  },
  {
    title: 'Granularidade',
    entries: [
      ['P1D', 'um registro por dia'],
      ['P1M', 'um registro por mês'],
      ['P1Y', 'um registro por ano'],
      ['EPSG:4326', 'coordenadas em latitude/longitude (WGS 84)'],
    ],
  },
];

/**
 * Closing section of `/dados`: a legend for the technical vocabulary used in the
 * dataset cards, so a reader who has never seen an ISO-8601 duration or an EPSG
 * code can still read the page. Server Component.
 *
 * @example
 * <CatalogueLegend />
 */
const CatalogueLegend = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.50"
      aria-labelledby="legend-heading"
    >
      <Container>
        <Text textStyle="eyebrow" color="verde.600" mb={6}>
          Como ler este catálogo
        </Text>
        <Text
          as="h2"
          id="legend-heading"
          textStyle="title-3"
          color="charcoal.900"
          mb={10}
        >
          Vocabulário
        </Text>

        <Grid
          templateColumns={{
            base: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          }}
          gap="clamp(1.5rem, calc(1rem + 2vw), 3rem)"
        >
          {GROUPS.map((group) => {
            return (
              <GridItem key={group.title}>
                <Text
                  as="h3"
                  textStyle="caption"
                  color="charcoal.500"
                  textTransform="uppercase"
                  letterSpacing="0.08em"
                  pb={3}
                  mb={4}
                  borderBottom="1px solid"
                  borderColor="ivory.300"
                >
                  {group.title}
                </Text>
                <Box
                  as="dl"
                  display="flex"
                  flexDirection="column"
                  gap={4}
                  m={0}
                >
                  {group.entries.map(([term, definition]) => {
                    return (
                      <Box key={term}>
                        <Text
                          as="dt"
                          textStyle="body-sm"
                          color="charcoal.900"
                          fontWeight="500"
                        >
                          {term}
                        </Text>
                        <Text
                          as="dd"
                          textStyle="caption"
                          color="charcoal.700"
                          m={0}
                          mt={1}
                        >
                          {definition}
                        </Text>
                      </Box>
                    );
                  })}
                </Box>
              </GridItem>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
};

export default CatalogueLegend;

import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Container from '../../../../components/ui/Container';
import type {
  CatalogueGapContract,
  CatalogueNoteContract,
} from '../../../../data-gateway/schema';
import { GAP_LABELS, SEVERITY_LABELS } from './catalogueLabels';

type Props = {
  /** Caveats authored in the catalogue itself. */
  notes: CatalogueNoteContract[];
  /** Gaps derived from each dataset's own metadata. */
  gaps: CatalogueGapContract[];
};

type GapItemProps = { title: string; detail: string };

const GapItem = ({ title, detail }: GapItemProps) => {
  return (
    <Box
      as="li"
      pb={4}
      borderBottom="1px solid"
      borderColor="ivory.300"
      _last={{ borderBottom: 'none', pb: 0 }}
    >
      <Text textStyle="body-sm" color="charcoal.900" fontWeight="500">
        {title}
      </Text>
      <Text textStyle="caption" color="charcoal.500" mt={1}>
        {detail}
      </Text>
    </Box>
  );
};

/**
 * The "lacunas" section: everything the catalogue admits it does not know.
 * Authored caveats come from the catalogue's own quality notes; the rest are
 * derived from dataset metadata, so a dimension left undocumented shows up here
 * without anyone having to write it down. Renders an explicit empty state when
 * nothing is missing. Server Component.
 *
 * @param notes - Authored caveats, rendered with their severity.
 * @param gaps - Derived gaps, grouped by kind and attributed to their datasets.
 *
 * @example
 * <CatalogueGaps notes={catalogue.meta.qualityNotes} gaps={catalogue.gaps} />
 */
const CatalogueGaps = ({ notes, gaps }: Props) => {
  const kinds = [
    ...new Set(
      gaps.map((gap) => {
        return gap.kind;
      })
    ),
  ];
  const isComplete = notes.length === 0 && gaps.length === 0;

  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.50"
      aria-labelledby="gaps-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="start"
        >
          <GridItem colSpan={{ base: 1, lg: 5 }}>
            <Box display="flex" flexDirection="column" gap={6}>
              <Text textStyle="eyebrow" color="coral.600">
                Lacunas
              </Text>
              <Text
                as="h2"
                id="gaps-heading"
                textStyle="title-2"
                color="charcoal.900"
              >
                O que ainda não sabemos
              </Text>
              <Text textStyle="body-lg" color="charcoal.700">
                Informação não identificada permanece visível como lacuna. Esta
                lista é derivada dos próprios metadados: um dataset que não
                declara sua cobertura aparece aqui automaticamente.
              </Text>
            </Box>
          </GridItem>

          <GridItem colSpan={{ base: 1, lg: 6 }} colStart={{ base: 1, lg: 7 }}>
            {isComplete ? (
              <Box
                bg="ivory.100"
                borderRadius="card"
                px={8}
                py={6}
                borderLeft="3px solid"
                borderColor="verde.600"
              >
                <Text textStyle="body-sm" color="charcoal.700">
                  Todos os datasets declaram cobertura, origem e precisão, e o
                  catálogo não registra ressalvas de qualidade.
                </Text>
              </Box>
            ) : (
              <Box display="flex" flexDirection="column" gap={4}>
                {notes.map((note) => {
                  return (
                    <Box
                      key={note.id}
                      bg="ivory.100"
                      borderRadius="card"
                      px={8}
                      py={6}
                      borderLeft="3px solid"
                      borderColor="coral.500"
                    >
                      <Text
                        textStyle="caption"
                        color="coral.700"
                        textTransform="uppercase"
                        letterSpacing="0.08em"
                        mb={2}
                      >
                        Ressalva · severidade {SEVERITY_LABELS[note.severity]}
                      </Text>
                      <Text textStyle="body-sm" color="charcoal.900">
                        {note.message}
                      </Text>
                    </Box>
                  );
                })}

                {kinds.map((kind) => {
                  const affected = gaps.filter((gap) => {
                    return gap.kind === kind;
                  });

                  return (
                    <Box
                      key={kind}
                      bg="ivory.100"
                      borderRadius="card"
                      px={8}
                      py={6}
                    >
                      <Box as="ul" listStyleType="none" m={0} p={0}>
                        <GapItem
                          title={`${GAP_LABELS[kind]} — ${affected.length} ${
                            affected.length === 1 ? 'dataset' : 'datasets'
                          }`}
                          detail={affected
                            .map((gap) => {
                              return gap.datasetTitle;
                            })
                            .join(' · ')}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default CatalogueGaps;

'use client';

import {
  Box,
  CloseButton,
  Drawer,
  Portal,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import * as React from 'react';

import Container from '../../../../components/ui/Container';
import type { CatalogueDatasetContract } from '../../../../data-gateway/schema';
import DatasetDetail from './DatasetDetail';
import DatasetSummaryCard from './DatasetSummaryCard';

type Props = {
  /** Every dataset in the catalogue, already sorted by the gateway. */
  datasets: CatalogueDatasetContract[];
};

/**
 * The catalogue body: a responsive grid of compact dataset cards, each opening a
 * drawer with that dataset's full metadata and data dictionary.
 *
 * A single drawer is driven by the selected dataset id rather than one drawer per
 * card, so only the open dataset's detail is mounted. Client Component — it owns
 * the selection state.
 *
 * @param datasets - Datasets to list; an empty list renders an explicit state.
 *
 * @example
 * <DatasetGrid datasets={catalogue.datasets} />
 */
const DatasetGrid = ({ datasets }: Props) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected =
    datasets.find((dataset) => {
      return dataset.id === selectedId;
    }) ?? null;

  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="datasets-heading"
    >
      <Container>
        <Text
          as="h2"
          id="datasets-heading"
          textStyle="title-3"
          color="charcoal.900"
          mb={8}
        >
          Datasets
        </Text>

        {datasets.length === 0 ? (
          <Text textStyle="body-sm" color="charcoal.500">
            Nenhum dataset está catalogado ainda.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
            {datasets.map((dataset) => {
              return (
                <DatasetSummaryCard
                  key={dataset.id}
                  dataset={dataset}
                  onSelect={() => {
                    return setSelectedId(dataset.id);
                  }}
                />
              );
            })}
          </SimpleGrid>
        )}
      </Container>

      <Drawer.Root
        open={selected !== null}
        // There is no `Drawer.Trigger` in the tree: opening is driven only by a
        // card setting the selection, so every change the drawer itself reports
        // (Escape, backdrop, close button) is a dismissal.
        onOpenChange={() => {
          return setSelectedId(null);
        }}
        size="lg"
      >
        <Portal>
          <Drawer.Backdrop bg="blackAlpha.500" />
          <Drawer.Positioner>
            <Drawer.Content bg="ivory.100">
              <Drawer.Header
                borderBottom="1px solid"
                borderColor="ivory.300"
                display="flex"
                alignItems="flex-start"
                justifyContent="space-between"
                gap={4}
              >
                <Box>
                  <Text
                    textStyle="caption"
                    color="verde.600"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                    mb={1}
                  >
                    {selected?.source.title}
                  </Text>
                  <Drawer.Title
                    textStyle="title-4"
                    color="charcoal.900"
                    fontFamily="heading"
                  >
                    {selected?.title}
                  </Drawer.Title>
                </Box>
                <Drawer.CloseTrigger asChild>
                  <CloseButton size="sm" aria-label="Fechar detalhes" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body py={6}>
                {selected === null ? null : (
                  <DatasetDetail dataset={selected} />
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Box>
  );
};

export default DatasetGrid;

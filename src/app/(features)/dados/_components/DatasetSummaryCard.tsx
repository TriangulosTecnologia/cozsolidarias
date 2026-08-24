import { Box, Text } from '@chakra-ui/react';

import type { CatalogueDatasetContract } from '../../../../data-gateway/schema';
import CatalogueBadge from './CatalogueBadge';
import { formatCount, VOLUME_LABELS } from './catalogueLabels';

type Props = {
  dataset: CatalogueDatasetContract;
  /** Called when the card is activated, to open the dataset's detail. */
  onSelect: () => void;
};

/**
 * Compact card for one dataset in the catalogue grid: its source, title, format
 * and volume, plus a restriction marker when it applies. Everything else lives
 * in the detail drawer this card opens.
 *
 * Rendered as a real `button` so it is reachable and activatable by keyboard.
 *
 * @param dataset - The dataset to summarize.
 * @param onSelect - Handler that opens the detail drawer for this dataset.
 *
 * @example
 * <DatasetSummaryCard dataset={dataset} onSelect={() => setSelected(dataset.id)} />
 */
const DatasetSummaryCard = ({ dataset, onSelect }: Props) => {
  const isRestricted = dataset.access.level === 'restricted';

  return (
    <Box
      asChild
      textAlign="left"
      display="flex"
      flexDirection="column"
      gap={3}
      h="100%"
      px={6}
      py={5}
      bg="ivory.50"
      borderRadius="card"
      border="1px solid"
      borderColor="ivory.300"
      transition="all 0.2s"
      _hover={{
        borderColor: 'charcoal.700',
        transform: 'translateY(-2px)',
        boxShadow: 'card',
      }}
    >
      <button type="button" onClick={onSelect}>
        <Text
          textStyle="caption"
          color="verde.600"
          textTransform="uppercase"
          letterSpacing="0.08em"
        >
          {dataset.source.title}
        </Text>

        <Text as="h3" textStyle="title-4" color="charcoal.900" flex="1">
          {dataset.title}
        </Text>

        <Box display="flex" flexWrap="wrap" gap={2}>
          <CatalogueBadge>{dataset.format}</CatalogueBadge>
          {dataset.volume === null ? null : (
            <CatalogueBadge>
              {formatCount(dataset.volume.count)}{' '}
              {VOLUME_LABELS[dataset.volume.kind]}
            </CatalogueBadge>
          )}
          {isRestricted ? (
            <CatalogueBadge tone="alert">Restrito</CatalogueBadge>
          ) : null}
        </Box>
      </button>
    </Box>
  );
};

export default DatasetSummaryCard;

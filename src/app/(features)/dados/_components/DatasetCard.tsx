import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import type {
  CatalogueDatasetContract,
  CatalogueSpatialContract,
  CatalogueTemporalContract,
} from '../../../../data-gateway/schema';
import CatalogueBadge from './CatalogueBadge';
import {
  ACCESS_LABELS,
  COVERAGE_LABELS,
  formatBytes,
  formatCount,
  formatExtentCode,
  formatGrain,
  formatInterval,
  FREQUENCY_LABELS,
  GAP_LABELS,
  GEOMETRY_LABELS,
  GRAIN_LABELS,
  HISTORY_LABELS,
  labelOf,
  PRECISION_LABELS,
  VOLUME_LABELS,
} from './catalogueLabels';
import DataDictionary from './DataDictionary';

type Props = { dataset: CatalogueDatasetContract };

type MetaRowProps = { label: string; value: string };

/**
 * Label/value pair in the catalogue's metadata treatment — the same two-column
 * rhythm the home page uses on its dataset card.
 */
const MetaRow = ({ label, value }: MetaRowProps) => {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', sm: '9rem 1fr' }}
      gap={{ base: 1, sm: 3 }}
      pb={3}
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

/** Renders the time dimension as rows, or a single row when undocumented. */
const temporalRows = (temporal: CatalogueTemporalContract): MetaRowProps[] => {
  if (temporal.status !== 'described') {
    return [
      {
        label: 'Período',
        value:
          temporal.status === 'unknown'
            ? 'não documentado'
            : 'não se aplica — dado de referência atemporal',
      },
    ];
  }

  return [
    {
      label: 'Período',
      value: temporal.extent
        .map((interval) => {
          return formatInterval(interval);
        })
        .join(', '),
    },
    { label: 'Granularidade', value: formatGrain(temporal.grain) },
    { label: 'Publicação', value: FREQUENCY_LABELS[temporal.frequency] },
    { label: 'Histórico', value: HISTORY_LABELS[temporal.history] },
  ];
};

/** Renders the spatial dimension as rows, or a single row when undocumented. */
const spatialRows = (spatial: CatalogueSpatialContract): MetaRowProps[] => {
  if (spatial.status !== 'described') {
    return [
      {
        label: 'Território',
        value:
          spatial.status === 'unknown' ? 'não documentado' : 'não se aplica',
      },
    ];
  }

  const rows: MetaRowProps[] = [
    {
      label: 'Território',
      value: spatial.extent
        .map((extent) => {
          return formatExtentCode(extent.code);
        })
        .join(', '),
    },
    {
      label: 'Unidade',
      value: `${labelOf(GRAIN_LABELS, spatial.grain.code)} · cobertura ${
        COVERAGE_LABELS[spatial.coverage]
      }`,
    },
    { label: 'Geometria', value: GEOMETRY_LABELS[spatial.geometry] },
  ];

  if (spatial.geometry !== 'none') {
    rows.push({
      label: 'Precisão',
      value: `${PRECISION_LABELS[spatial.precision]}${
        spatial.srid === null ? '' : ` · EPSG:${spatial.srid}`
      }`,
    });
  }

  return rows;
};

/** Small-caps section heading used inside a dataset card. */
const SectionHeading = ({ children }: { children: React.ReactNode }) => {
  return (
    <Text
      as="h5"
      textStyle="caption"
      color="charcoal.500"
      textTransform="uppercase"
      letterSpacing="0.08em"
      mb={3}
    >
      {children}
    </Text>
  );
};

/** One coverage dimension: its heading and the rows describing it. */
const CoverageColumn = ({
  title,
  rows,
}: {
  title: string;
  rows: MetaRowProps[];
}) => {
  return (
    <GridItem>
      <SectionHeading>{title}</SectionHeading>
      <Box display="flex" flexDirection="column" gap={3}>
        {rows.map((row) => {
          return (
            <MetaRow key={row.label} label={row.label} value={row.value} />
          );
        })}
      </Box>
    </GridItem>
  );
};

/**
 * Restriction notice for a dataset that is not openly publishable. Names the
 * reason (personal data vs. a broader restriction) and falls back to a generic
 * statement when the catalogue records no note.
 */
const AccessNotice = ({
  access,
}: {
  access: CatalogueDatasetContract['access'];
}) => {
  return (
    <Box
      mt={5}
      px={5}
      py={4}
      bg="roxo.50"
      borderRadius="card"
      borderLeft="3px solid"
      borderColor="roxo.600"
    >
      <Text
        textStyle="caption"
        color="roxo.700"
        textTransform="uppercase"
        letterSpacing="0.08em"
        mb={2}
      >
        {access.containsPersonalData
          ? 'Contém dados pessoais'
          : 'Acesso restrito'}
      </Text>
      <Text textStyle="body-sm" color="charcoal.900">
        {access.notes ??
          'Este dataset não é publicado de forma individualizada.'}
      </Text>
    </Box>
  );
};

/**
 * One dataset of the catalogue: its identity and access badges, its description,
 * the temporal and spatial coverage translated into readable pt-BR, its volume,
 * any restriction note, the gaps it carries, and its full data dictionary.
 *
 * Anchored by `id` on the dataset slug so the section index can link to it.
 * Server Component.
 *
 * @param dataset - The dataset to render, already redacted by the gateway.
 *
 * @example
 * <DatasetCard dataset={collection.datasets[0]} />
 */
const DatasetCard = ({ dataset }: Props) => {
  const isRestricted = dataset.access.level === 'restricted';

  return (
    <Box
      as="article"
      id={dataset.slug}
      bg="ivory.50"
      borderRadius="card"
      overflow="hidden"
      boxShadow="card"
      scrollMarginTop="6rem"
    >
      <Box
        px={{ base: 6, md: 8 }}
        py={5}
        borderBottom="1px solid"
        borderColor="ivory.300"
        display="flex"
        flexWrap="wrap"
        gap={3}
        alignItems="center"
        justifyContent="space-between"
      >
        <Text as="h4" textStyle="title-4" color="charcoal.900">
          {dataset.title}
        </Text>
        <Box display="flex" flexWrap="wrap" gap={2}>
          <CatalogueBadge>{dataset.format}</CatalogueBadge>
          <CatalogueBadge tone={isRestricted ? 'alert' : 'positive'}>
            {ACCESS_LABELS[dataset.access.level]}
          </CatalogueBadge>
          {dataset.volume === null ? null : (
            <CatalogueBadge>
              {formatCount(dataset.volume.count)}{' '}
              {VOLUME_LABELS[dataset.volume.kind]}
            </CatalogueBadge>
          )}
        </Box>
      </Box>

      <Box px={{ base: 6, md: 8 }} py={6}>
        <Text textStyle="body" color="charcoal.700" maxW="70ch">
          {dataset.description}
        </Text>

        {isRestricted || dataset.access.containsPersonalData ? (
          <AccessNotice access={dataset.access} />
        ) : null}

        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 2rem)"
          mt={6}
        >
          <CoverageColumn
            title="Cobertura temporal"
            rows={temporalRows(dataset.temporal)}
          />
          <CoverageColumn
            title="Cobertura espacial"
            rows={spatialRows(dataset.spatial)}
          />
        </Grid>

        <Box display="flex" flexDirection="column" gap={3} mt={6}>
          <MetaRow label="Publicado por" value={dataset.organization} />
          {dataset.originNotes === null ? null : (
            <MetaRow label="Origem" value={dataset.originNotes} />
          )}
          {dataset.sizeBytes === null ? null : (
            <MetaRow label="Tamanho" value={formatBytes(dataset.sizeBytes)} />
          )}
          {dataset.gaps.length === 0 ? null : (
            <MetaRow
              label="Lacunas"
              value={dataset.gaps
                .map((kind) => {
                  return GAP_LABELS[kind];
                })
                .join(' · ')}
            />
          )}
        </Box>

        <Box mt={8}>
          <SectionHeading>
            Dicionário de dados · {formatCount(dataset.fields.length)} campos
          </SectionHeading>
          <DataDictionary
            fields={dataset.fields}
            datasetTitle={dataset.title}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default DatasetCard;

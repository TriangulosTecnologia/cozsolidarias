import { Box, Text } from '@chakra-ui/react';

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

/** Label/value pair in the catalogue's metadata treatment. */
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

/** Small-caps section heading inside the detail. */
const SectionHeading = ({ children }: { children: React.ReactNode }) => {
  return (
    <Text
      as="h4"
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

/** A group of metadata rows under one heading. */
const MetaSection = ({
  title,
  rows,
}: {
  title: string;
  rows: MetaRowProps[];
}) => {
  return (
    <Box>
      <SectionHeading>{title}</SectionHeading>
      <Box display="flex" flexDirection="column" gap={3}>
        {rows.map((row) => {
          return (
            <MetaRow key={row.label} label={row.label} value={row.value} />
          );
        })}
      </Box>
    </Box>
  );
};

/** Describes the time dimension as rows, or one row when undocumented. */
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

/** Describes the spatial dimension as rows, or one row when undocumented. */
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

/** Origin, volume and gap rows — the dataset's provenance at a glance. */
const originRows = (dataset: CatalogueDatasetContract): MetaRowProps[] => {
  const rows: MetaRowProps[] = [
    { label: 'Publicado por', value: dataset.organization },
    { label: 'Acesso', value: ACCESS_LABELS[dataset.access.level] },
  ];

  if (dataset.volume !== null) {
    rows.push({
      label: 'Volume',
      value: `${formatCount(dataset.volume.count)} ${
        VOLUME_LABELS[dataset.volume.kind]
      }`,
    });
  }
  if (dataset.sizeBytes !== null) {
    rows.push({ label: 'Tamanho', value: formatBytes(dataset.sizeBytes) });
  }
  if (dataset.originNotes !== null) {
    rows.push({ label: 'Origem', value: dataset.originNotes });
  }
  if (dataset.gaps.length > 0) {
    rows.push({
      label: 'Lacunas',
      value: dataset.gaps
        .map((kind) => {
          return GAP_LABELS[kind];
        })
        .join(' · '),
    });
  }

  return rows;
};

/**
 * Full detail of one dataset, rendered inside the catalogue drawer: description,
 * any restriction notice, temporal and spatial coverage in readable pt-BR, its
 * provenance and gaps, its data dictionary, and the source it belongs to.
 *
 * Server Component — the drawer that hosts it owns the interaction.
 *
 * @param dataset - The dataset to describe, already redacted by the gateway.
 *
 * @example
 * <DatasetDetail dataset={dataset} />
 */
const DatasetDetail = ({ dataset }: Props) => {
  const needsNotice =
    dataset.access.level === 'restricted' ||
    dataset.access.containsPersonalData;

  return (
    <Box display="flex" flexDirection="column" gap={8}>
      <Text textStyle="body" color="charcoal.700">
        {dataset.description}
      </Text>

      {needsNotice ? (
        <Box
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
            {dataset.access.containsPersonalData
              ? 'Contém dados pessoais'
              : 'Acesso restrito'}
          </Text>
          <Text textStyle="body-sm" color="charcoal.900">
            {dataset.access.notes ??
              'Este dataset não é publicado de forma individualizada.'}
          </Text>
        </Box>
      ) : null}

      <MetaSection title="Origem e volume" rows={originRows(dataset)} />
      <MetaSection
        title="Cobertura temporal"
        rows={temporalRows(dataset.temporal)}
      />
      <MetaSection
        title="Cobertura espacial"
        rows={spatialRows(dataset.spatial)}
      />

      <Box>
        <SectionHeading>
          Dicionário de dados · {formatCount(dataset.fields.length)} campos
        </SectionHeading>
        <DataDictionary fields={dataset.fields} datasetTitle={dataset.title} />
      </Box>

      <Box>
        <SectionHeading>Fonte · {dataset.source.title}</SectionHeading>
        <Text textStyle="body-sm" color="charcoal.700">
          {dataset.source.description}
        </Text>
        <Box display="flex" flexWrap="wrap" gap={2} mt={4}>
          {dataset.source.tags.map((tag) => {
            return <CatalogueBadge key={tag}>{tag}</CatalogueBadge>;
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default DatasetDetail;

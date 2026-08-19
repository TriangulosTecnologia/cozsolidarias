import type {
  CatalogueContract,
  CatalogueDatasetContract,
} from 'src/data-gateway/schema';

/**
 * A dataset with every optional slot filled: described temporal and spatial
 * dimensions, a geometry with an SRID, a volume, a size and typed fields.
 */
export const describedDataset: CatalogueDatasetContract = {
  id: 'assentamentos',
  slug: 'assentamentos',
  title: 'Assentamentos rurais',
  description: 'Perímetros dos assentamentos rurais cadastrados.',
  format: 'GeoJSON',
  source: {
    title: 'SICAR',
    description: 'Base geográfica do Cadastro Ambiental Rural.',
    tags: ['sicar', 'assentamentos'],
  },
  organization: 'Serviço Florestal Brasileiro',
  originNotes: 'Extraído das bases estaduais AREA_IMOVEL.',
  hasDocumentedOrigin: true,
  temporal: {
    status: 'described',
    extent: [{ start: '2026-06-01', end: '2026-06-30' }],
    grain: 'P1M',
    frequency: 'irregular',
    history: 'snapshot',
  },
  spatial: {
    status: 'described',
    extent: [
      { scheme: 'iso3166-2', code: 'BR-SP' },
      { scheme: 'iso3166-2', code: 'BR-MG' },
    ],
    coverage: 'exhaustive',
    grain: { code: 'settlement', label: 'assentamento' },
    geometry: 'multipolygon',
    precision: 'notApplicable',
    srid: 4326,
  },
  access: { level: 'public', containsPersonalData: false, notes: null },
  volume: { kind: 'features', count: 1825 },
  sizeBytes: 12630947,
  fields: [
    {
      name: 'cod_imovel',
      description: 'Código do imóvel no CAR.',
      role: 'identifier',
      unit: null,
      sensitive: false,
    },
    {
      name: 'num_area_ha',
      description: 'Área total do imóvel.',
      role: null,
      unit: 'hectare',
      sensitive: false,
    },
  ],
  gaps: [],
};

/**
 * A restricted dataset carrying personal data, an undocumented time dimension
 * and unknown coordinate precision — the shape that drives the access notice,
 * sensitive-field marking and gap row.
 */
export const restrictedDataset: CatalogueDatasetContract = {
  id: 'cozinhas_geolocalizadas',
  slug: 'cozinhas-geolocalizadas',
  title: 'Cozinhas Solidárias geolocalizadas',
  description: 'Cadastro das cozinhas solidárias com coordenadas.',
  format: 'CSV',
  source: {
    title: 'Dados Primários',
    description: 'Datasets coletados pela equipe do projeto.',
    tags: ['dados-primarios', 'restrito'],
  },
  organization: 'Equipe do projeto',
  originNotes: null,
  hasDocumentedOrigin: true,
  temporal: { status: 'unknown' },
  spatial: {
    status: 'described',
    extent: [{ scheme: 'iso3166-1', code: 'BR' }],
    coverage: 'partial',
    grain: { code: 'kitchen', label: 'cozinha' },
    geometry: 'point',
    precision: 'unknown',
    srid: null,
  },
  access: {
    level: 'restricted',
    containsPersonalData: true,
    notes: 'Publicar apenas de forma agregada.',
  },
  volume: { kind: 'rows', count: 1396 },
  sizeBytes: 770399,
  fields: [
    {
      name: 'CNPJ',
      description: 'CNPJ da organização.',
      role: null,
      unit: null,
      sensitive: true,
    },
  ],
  gaps: ['temporalUnknown', 'precisionUnknown'],
};

/**
 * An atemporal reference lookup with no geometry and no recorded origin — the
 * `notApplicable` branch of both dimensions.
 */
export const referenceDataset: CatalogueDatasetContract = {
  id: 'municipios_nomes',
  slug: 'municipios-nomes',
  title: 'Nomes dos municípios',
  description: 'Mapa de código IBGE para nome do município.',
  format: 'JSON',
  source: {
    title: 'IBGE',
    description: 'Datasets geográficos e demográficos do IBGE.',
    tags: ['ibge'],
  },
  organization: 'IBGE',
  originNotes: null,
  hasDocumentedOrigin: false,
  temporal: { status: 'notApplicable' },
  spatial: { status: 'notApplicable' },
  access: { level: 'public', containsPersonalData: false, notes: null },
  volume: { kind: 'entries', count: 5564 },
  sizeBytes: null,
  fields: [],
  gaps: ['originUndocumented'],
};

/**
 * Builds a catalogue contract covering every rendering branch of `/dados`: a
 * described dataset, a restricted one and an atemporal reference lookup.
 *
 * @param overrides - Fields to replace on the built catalogue.
 * @returns A complete {@link CatalogueContract}.
 *
 * @example
 * const catalogue = buildCatalogue({ datasets: [] });
 */
export const buildCatalogue = (
  overrides: Partial<CatalogueContract> = {}
): CatalogueContract => {
  return {
    meta: {
      title: 'Catálogo de Dados — Cozinhas Solidárias',
      description: 'Metadados de todos os datasets do projeto.',
      status: 'draft',
      updatedAt: '2026-08-14',
      schemaVersion: '2.0.0',
    },
    datasets: [describedDataset, restrictedDataset, referenceDataset],
    ...overrides,
  };
};

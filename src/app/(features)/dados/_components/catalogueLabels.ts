import type {
  CatalogueAccessLevelContract,
  CatalogueCoverageContract,
  CatalogueFrequencyContract,
  CatalogueGapKind,
  CatalogueGeometryContract,
  CatalogueHistoryContract,
  CatalogueNoteSeverity,
  CataloguePrecisionContract,
  CatalogueVolumeContract,
} from '../../../../data-gateway/schema';

/**
 * pt-BR wording for the catalogue's vocabularies. The gateway contract carries
 * codes, not prose — user-facing language belongs to the app layer, so every
 * translation the `/dados` page needs lives here.
 */

/** How often the source series is (re)published. */
export const FREQUENCY_LABELS: Record<CatalogueFrequencyContract, string> = {
  daily: 'diária',
  monthly: 'mensal',
  annual: 'anual',
  irregular: 'irregular',
  oneTime: 'publicação única',
};

/** What each release does to the periods already published. */
export const HISTORY_LABELS: Record<CatalogueHistoryContract, string> = {
  appendOnly: 'série acumulada — o passado não é reescrito',
  overwrite: 'cada versão substitui a anterior',
  revised: 'períodos anteriores podem ser revisados',
  snapshot: 'retrato de um momento',
};

/** How completely the data fills the territory it declares. */
export const COVERAGE_LABELS: Record<CatalogueCoverageContract, string> = {
  exhaustive: 'exaustiva',
  partial: 'parcial',
  sample: 'amostra',
  unknown: 'não documentada',
};

/** Geometry family actually stored in the file. */
export const GEOMETRY_LABELS: Record<CatalogueGeometryContract, string> = {
  none: 'sem geometria',
  point: 'pontos',
  multipoint: 'conjuntos de pontos',
  line: 'linhas',
  polygon: 'polígonos',
  multipolygon: 'polígonos',
  geometrycollection: 'geometrias mistas',
};

/** How exactly a point locates the thing it represents. */
export const PRECISION_LABELS: Record<CataloguePrecisionContract, string> = {
  exact: 'exata',
  approximate: 'aproximada',
  centroid: 'centroide',
  notApplicable: 'não se aplica',
  unknown: 'não documentada',
};

/** Whether the dataset may be published openly. */
export const ACCESS_LABELS: Record<CatalogueAccessLevelContract, string> = {
  public: 'Público',
  restricted: 'Restrito',
};

/** Unit the volume count is expressed in, by file format. */
export const VOLUME_LABELS: Record<CatalogueVolumeContract['kind'], string> = {
  rows: 'linhas',
  entries: 'entradas',
  features: 'feições',
};

/** Severity of an authored caveat. */
export const SEVERITY_LABELS: Record<CatalogueNoteSeverity, string> = {
  low: 'baixa',
  medium: 'média',
  high: 'alta',
};

/** What each derived gap means, phrased for a reader of the page. */
export const GAP_LABELS: Record<CatalogueGapKind, string> = {
  temporalUnknown: 'Cobertura temporal não documentada',
  spatialUnknown: 'Cobertura espacial não documentada',
  precisionUnknown: 'Precisão das coordenadas não documentada',
  originUndocumented: 'Origem sem endereço registrado',
};

/** Semantic role of a field in its dataset. */
export const ROLE_LABELS: Record<string, string> = {
  identifier: 'identificador',
  geometry: 'geometria',
  join: 'chave de junção',
};

/** Spatial unit of one record. */
export const GRAIN_LABELS: Record<string, string> = {
  country: 'país',
  state: 'unidade federativa',
  municipality: 'município',
  settlement: 'assentamento',
  kitchen: 'cozinha',
  rural_property: 'imóvel rural',
};

/** ISO-8601 record durations, as a reader would say them. */
const GRAIN_DURATION_LABELS: Record<string, string> = {
  P1D: 'por dia',
  P1M: 'por mês',
  P1Y: 'por ano',
};

/** Coded regions, spelled out. */
const EXTENT_LABELS: Record<string, string> = {
  BR: 'Brasil',
  'BR-AC': 'Acre',
  'BR-AL': 'Alagoas',
  'BR-AP': 'Amapá',
  'BR-AM': 'Amazonas',
  'BR-BA': 'Bahia',
  'BR-CE': 'Ceará',
  'BR-DF': 'Distrito Federal',
  'BR-ES': 'Espírito Santo',
  'BR-GO': 'Goiás',
  'BR-MA': 'Maranhão',
  'BR-MT': 'Mato Grosso',
  'BR-MS': 'Mato Grosso do Sul',
  'BR-MG': 'Minas Gerais',
  'BR-PA': 'Pará',
  'BR-PB': 'Paraíba',
  'BR-PR': 'Paraná',
  'BR-PE': 'Pernambuco',
  'BR-PI': 'Piauí',
  'BR-RJ': 'Rio de Janeiro',
  'BR-RN': 'Rio Grande do Norte',
  'BR-RS': 'Rio Grande do Sul',
  'BR-RO': 'Rondônia',
  'BR-RR': 'Roraima',
  'BR-SC': 'Santa Catarina',
  'BR-SP': 'São Paulo',
  'BR-SE': 'Sergipe',
  'BR-TO': 'Tocantins',
};

/** Lifecycle of the catalogue itself. */
const STATUS_LABELS: Record<string, string> = {
  draft: 'rascunho',
  review: 'em revisão',
  published: 'publicado',
};

/**
 * Looks a code up in a label map, falling back to the raw code so an
 * unrecognized value stays visible instead of rendering blank.
 *
 * @example
 * labelOf(GRAIN_LABELS, 'municipality'); // 'município'
 * labelOf(GRAIN_LABELS, 'quilombo'); // 'quilombo'
 */
export const labelOf = (labels: Record<string, string>, code: string) => {
  return labels[code] ?? code;
};

/**
 * Formats a record duration (`P1Y`) as pt-BR prose, keeping the ISO code
 * alongside it so the technical value stays readable.
 *
 * @example
 * formatGrain('P1Y'); // 'por ano (P1Y)'
 * formatGrain('P3M'); // 'P3M'
 */
export const formatGrain = (grain: string) => {
  const label = GRAIN_DURATION_LABELS[grain];
  return label === undefined ? grain : `${label} (${grain})`;
};

/** Spells out a coded region, e.g. `BR-SP` → `São Paulo`. */
export const formatExtentCode = (code: string) => {
  return labelOf(EXTENT_LABELS, code);
};

/** Names the catalogue's lifecycle stage, e.g. `draft` → `rascunho`. */
export const formatStatus = (status: string) => {
  return labelOf(STATUS_LABELS, status);
};

/**
 * Formats an ISO-8601 date (`YYYY-MM-DD`) as `DD/MM/AAAA`. Parses the string
 * directly rather than through `Date`, so no timezone can shift the day.
 *
 * @example
 * formatDate('2026-08-14'); // '14/08/2026'
 * formatDate('2026-08'); // '2026-08'
 */
export const formatDate = (iso: string) => {
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
};

/**
 * Formats one covered interval. A `null` bound is open-ended; a pair that spans
 * exactly one calendar year collapses to that year.
 *
 * @example
 * formatInterval({ start: '2022-01-01', end: '2022-12-31' }); // '2022'
 * formatInterval({ start: '2008-01-01', end: null }); // 'desde 01/01/2008'
 * formatInterval({ start: null, end: null }); // 'período não delimitado'
 */
export const formatInterval = ({
  start,
  end,
}: {
  start: string | null;
  end: string | null;
}) => {
  if (start === null && end === null) {
    return 'período não delimitado';
  }
  if (start === null) {
    return `até ${formatDate(String(end))}`;
  }
  if (end === null) {
    return `desde ${formatDate(start)}`;
  }
  if (start.endsWith('-01-01') && end.endsWith('-12-31')) {
    const year = start.slice(0, 4);
    return year === end.slice(0, 4) ? year : `${year} a ${end.slice(0, 4)}`;
  }
  return `${formatDate(start)} a ${formatDate(end)}`;
};

/**
 * Formats an integer with pt-BR thousands separators.
 *
 * @example
 * formatCount(5570); // '5.570'
 */
export const formatCount = (value: number) => {
  return value.toLocaleString('pt-BR');
};

/**
 * Formats a byte count in the largest unit that keeps it under 1024, with one
 * decimal place and a pt-BR decimal comma.
 *
 * @example
 * formatBytes(770399); // '752,3 KB'
 * formatBytes(512); // '512 B'
 */
export const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const rounded =
    unit === 0 ? String(value) : value.toFixed(1).replace('.', ',');
  return `${rounded} ${units[unit]}`;
};

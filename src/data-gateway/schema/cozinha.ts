/**
 * Canonical GeoJSON shapes for cozinha locations consumed by the app/map.
 *
 * Plain point features carry `nome` and `codigo` so the map can display
 * kitchen names in hover tooltips. Status features additionally carry
 * `situacao` for color coding.
 */

/** A single cozinha location as a GeoJSON Point feature. */
export type CozinhaLocationFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  properties: {
    /** Cozinha display name, for tooltips. */
    nome: string;
    /** Source registry code; unique per cozinha. */
    codigo: string;
  };
};

/** Collection of cozinha locations, ready to feed a GeoJSON map source. */
export type CozinhasFeatureCollection = {
  type: 'FeatureCollection';
  features: CozinhaLocationFeature[];
};

/**
 * One município anchor point for the proportional-circle (bubble) map. The
 * `codarea` property is the join key the map uses to attach the `quantidade`
 * value (which drives the circle size) to the feature.
 */
export type CozinhaBubbleFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  properties: {
    /** 7-digit IBGE code; the map joins it to the count via `joinKey`. */
    codarea: string;
    /** Município name, for tooltips/labels. */
    municipio: string;
    /** Cozinha count in this município; encodes the circle radius. */
    quantidade: number;
  };
};

/** Collection of bubble anchors, ready to feed the circle map's GeoJSON source. */
export type CozinhasBubblesFeatureCollection = {
  type: 'FeatureCollection';
  features: CozinhaBubbleFeature[];
};

/**
 * Cozinha status categories recognised by the app. Values match the source's
 * `Situação` column verbatim; records with any other status (empty, or a
 * workflow state not listed here) are **dropped** by the transformer.
 *
 * This is the full canonical set — every status listed here renders on the
 * status map, coloured via {@link SITUACAO_COLORS} in `legendsBuilders`.
 *
 * @example
 * COZINHA_SITUACOES.includes('Habilitada'); // → true
 */
export const COZINHA_SITUACOES = [
  'Habilitada',
  'Não Habilitada',
  'Mapeada',
  'Retirada',
  'Em análise',
  'Homologada para Habilitação',
  'Pendência emitida pelo MDS (Prazo para adequações 15 dias)',
  'Enviada para análise',
  'Homologada para Retirada',
] as const;

/**
 * One canonical cozinha status. See {@link COZINHA_SITUACOES} for the
 * filtering rule.
 *
 * @example
 * const situacao: CozinhaSituacao = 'Habilitada';
 */
export type CozinhaSituacao = (typeof COZINHA_SITUACOES)[number];

/**
 * A cozinha location as a GeoJSON Point feature carrying its status — the
 * shape served by `/api/cozinhas/status` for the status-colored points map.
 * `codigo` is unique per cozinha and is the map's join key (promoted to the
 * feature id), `nome` feeds the hover tooltip, `situacao` drives the point
 * color.
 *
 * @example
 * feature.properties; // { codigo: 'CS017783', nome: '…', situacao: 'Habilitada' }
 */
export type CozinhaStatusFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    /** GeoJSON order: `[longitude, latitude]`. */
    coordinates: [number, number];
  };
  properties: {
    /** Source registry code; unique per cozinha, joins map data to the feature. */
    codigo: string;
    /** Cozinha display name, for tooltips. */
    nome: string;
    /** Canonical status; see {@link COZINHA_SITUACOES}. */
    situacao: CozinhaSituacao;
  };
};

/** Collection of status-carrying locations for the status points map source. */
export type CozinhasStatusFeatureCollection = {
  type: 'FeatureCollection';
  features: CozinhaStatusFeature[];
};

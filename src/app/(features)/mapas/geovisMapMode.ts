/**
 * What the municipality fill encodes:
 * - `coropletico`: data-driven choropleth (cozinhas por município, raw count);
 * - `coropletico-taxa`: data-driven choropleth of the cozinhas-per-100k-
 *   inhabitants rate (darker = higher density);
 * - `coropletico-percentual`: data-driven choropleth of each município's share
 *   (%) of all Brazilian cozinhas (darker = larger share);
 * - `coropletico-cafs-percentual`: data-driven choropleth of each município's
 *   share (%) of all Brazilian CAFs (darker = larger share);
 * - `coropletico-cadunico`: data-driven choropleth of the cozinhas-per-10k-
 *   CadÚnico-people rate (darker = better coverage of the vulnerable population);
 * - `coropletico-pessoas-cozinha`: data-driven choropleth of the CadÚnico-people-
 *   per-cozinha ratio (darker = more people per cozinha = thinner coverage);
 * - `coropletico-ivs`: data-driven choropleth of each município's overall Social
 *   Vulnerability Index (IPEA), colored by the official faixas (green = low,
 *   red = high vulnerability);
 * - `pontos`: flat background so the individual kitchen points stand out;
 * - `circulos`: flat background with one proportional circle per município
 *   (radius encodes the kitchen count);
 * - `assentamentos`: SICAR rural-settlement (AST) polygons of SP, filled and
 *   colored by registration status, with the kitchen points overlaid on top;
 * - `cafs`: the ~3.9M CAFs as a zoom hierarchy — one circle per UF, then one
 *   per município, then an H3 density grid, then the individual properties —
 *   so each zoom band shows the aggregation it can actually be read at, and the
 *   browser only ever holds one band.
 *
 * The fill, the municipality/state borders and the background color stay the
 * same across modes — only the data coloring and the points/circles overlays
 * change.
 */
export type MapMode =
  | 'coropletico'
  | 'coropletico-taxa'
  | 'coropletico-percentual'
  | 'coropletico-cafs-percentual'
  | 'coropletico-cadinsan-com-pbf'
  | 'coropletico-cadinsan-sem-pbf'
  | 'coropletico-cadunico'
  | 'coropletico-pessoas-cozinha'
  | 'coropletico-ivs'
  | 'coropletico-ivs-infraestrutura'
  | 'coropletico-ivs-capital-humano'
  | 'coropletico-ivs-renda-trabalho'
  | 'coropletico-idhm'
  | 'coropletico-idhm-longevidade'
  | 'coropletico-idhm-educacao'
  | 'coropletico-idhm-renda'
  | 'coropletico-idhm-educacao-escolaridade'
  | 'coropletico-idhm-educacao-frequencia'
  | 'pontos'
  | 'circulos'
  | 'assentamentos'
  | 'cafs'
  | 'cafs-hexbin';

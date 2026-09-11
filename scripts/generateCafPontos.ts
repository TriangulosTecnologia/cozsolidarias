/**
 * Offline generator for the 27 positions the CAF map's country level is drawn
 * at — one anchor per federative unit.
 *
 * # Why this exists
 *
 * The `cafs` map mode is a zoom hierarchy — UF → H3 grid → individual points.
 * Only the UF level is small enough (and needs a hover card badly enough) to be
 * served as GeoJSON rather than tiles; this script computes its positions once,
 * offline.
 *
 * # What it does NOT write
 *
 * No counts. `caf-por-municipio.json` is the single source of truth for how
 * many CAFs there are, and a UF's total is the sum of the municípios whose IBGE
 * code starts with its `codigoUf`, derived in `toCafUfPontos`. Storing counts
 * here too would create a second copy that can drift from the first.
 *
 * # Positions
 *
 * A UF's anchor is the CAF-count-weighted mean of its municípios' centroids —
 * NOT the capital and NOT the state's geometric centre. Weighting is what makes
 * the dot representative: in Bahia it lands in the interior rather than on the
 * coast, because that is where the family farms are. Each município's centroid
 * is the area-weighted centroid of its largest polygon ring
 * (`geojs-100-mun.json`); quantising the weighting to município resolution is
 * invisible at the zooms a UF dot is drawn at.
 *
 * The município centroids are an intermediate here, not an output: the map
 * stopped drawing a circle per município because all 5,518 land on screen
 * whatever the zoom, which is exactly the clutter the H3 grid exists to avoid.
 *
 * No CSV is read: both inputs are committed, so this runs in seconds and needs
 * no access to the 426 MB `caf-area.csv` snapshot.
 *
 * Usage:
 *
 *   node scripts/generateCafPontos.ts
 *
 * Output: `src/data-source-static/data/caf-pontos.json`
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const COUNTS_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-por-municipio.json'
);

const POLYGONS_PATH = join(
  process.cwd(),
  'public',
  'geo',
  'geojs-100-mun.json'
);

const OUTPUT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-pontos.json'
);

/** Decimal places kept per coordinate — ~1 m, finer than any zoom draws. */
const COORDINATE_DECIMALS = 5;

/**
 * The 27 federative units, keyed by the two-digit prefix every IBGE municipality
 * code starts with. This is the only place the mapping lives: the generated
 * snapshot carries the resulting `uf` and `nome` as data, so the app needs no
 * copy of the table.
 */
const UFS_BY_PREFIX: Record<string, { uf: string; nome: string }> = {
  '11': { uf: 'RO', nome: 'Rondônia' },
  '12': { uf: 'AC', nome: 'Acre' },
  '13': { uf: 'AM', nome: 'Amazonas' },
  '14': { uf: 'RR', nome: 'Roraima' },
  '15': { uf: 'PA', nome: 'Pará' },
  '16': { uf: 'AP', nome: 'Amapá' },
  '17': { uf: 'TO', nome: 'Tocantins' },
  '21': { uf: 'MA', nome: 'Maranhão' },
  '22': { uf: 'PI', nome: 'Piauí' },
  '23': { uf: 'CE', nome: 'Ceará' },
  '24': { uf: 'RN', nome: 'Rio Grande do Norte' },
  '25': { uf: 'PB', nome: 'Paraíba' },
  '26': { uf: 'PE', nome: 'Pernambuco' },
  '27': { uf: 'AL', nome: 'Alagoas' },
  '28': { uf: 'SE', nome: 'Sergipe' },
  '29': { uf: 'BA', nome: 'Bahia' },
  '31': { uf: 'MG', nome: 'Minas Gerais' },
  '32': { uf: 'ES', nome: 'Espírito Santo' },
  '33': { uf: 'RJ', nome: 'Rio de Janeiro' },
  '35': { uf: 'SP', nome: 'São Paulo' },
  '41': { uf: 'PR', nome: 'Paraná' },
  '42': { uf: 'SC', nome: 'Santa Catarina' },
  '43': { uf: 'RS', nome: 'Rio Grande do Sul' },
  '50': { uf: 'MS', nome: 'Mato Grosso do Sul' },
  '51': { uf: 'MT', nome: 'Mato Grosso' },
  '52': { uf: 'GO', nome: 'Goiás' },
  '53': { uf: 'DF', nome: 'Distrito Federal' },
};

/** A `[longitude, latitude]` pair, in GeoJSON order. */
type Position = [number, number];

/** One linear ring: the closed vertex list of a polygon boundary. */
type Ring = Position[];

type PolygonGeometry = { type: 'Polygon'; coordinates: Ring[] };
type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: Ring[][] };

/** The subset of `geojs-100-mun.json` this script reads. */
type MunicipioFeature = {
  properties: { codarea: string };
  geometry: PolygonGeometry | MultiPolygonGeometry;
};

/**
 * The UF a município belongs to, read from the first two digits of its IBGE
 * code — the encoding IBGE guarantees for every one of the 5,570 codes.
 *
 * @param codigoIbge - 7-digit IBGE municipality code.
 * @returns The UF's two-digit code, sigla and name, or `null` when the prefix is
 * not one of the 27 federative units (a malformed code).
 *
 * @example
 * ufFromCodigoIbge('2910800'); // { codigoUf: '29', uf: 'BA', nome: 'Bahia' }
 * ufFromCodigoIbge('9900000'); // null
 */
export const ufFromCodigoIbge = (
  codigoIbge: string
): { codigoUf: string; uf: string; nome: string } | null => {
  const codigoUf = codigoIbge.slice(0, 2);
  const uf = UFS_BY_PREFIX[codigoUf];

  return uf ? { codigoUf, ...uf } : null;
};

/**
 * The area-weighted centroid of one closed linear ring, by the standard
 * shoelace formula.
 *
 * Falls back to the mean of the vertices when the ring encloses no area (a
 * degenerate sliver in the simplified geometry), where the shoelace centroid is
 * `0/0`.
 *
 * @param ring - The ring's vertices, `[longitude, latitude]` each.
 * @returns The centroid, or `null` when the ring has no vertices.
 *
 * @example
 * ringCentroid([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]); // [1, 1]
 */
export const ringCentroid = (ring: Ring): Position | null => {
  if (ring.length === 0) {
    return null;
  }

  let twiceArea = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index] as Position;
    const [x1, y1] = ring[index + 1] as Position;
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }

  if (twiceArea === 0) {
    const sum = ring.reduce(
      (acc, [lng, lat]) => {
        return [acc[0] + lng, acc[1] + lat] as Position;
      },
      [0, 0] as Position
    );
    return [sum[0] / ring.length, sum[1] / ring.length];
  }

  return [x / (3 * twiceArea), y / (3 * twiceArea)];
};

/** Twice the signed area a ring encloses; the shoelace sum, sign included. */
const ringTwiceArea = (ring: Ring): number => {
  let total = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index] as Position;
    const [x1, y1] = ring[index + 1] as Position;
    total += x0 * y1 - x1 * y0;
  }
  return total;
};

/**
 * The representative point of a município's geometry: the centroid of its
 * **largest** outer ring.
 *
 * Taking the largest ring rather than averaging every part is what keeps the
 * dot on land for the 46 multi-part municípios — averaging a mainland polygon
 * with an offshore island puts the point in the water between them.
 *
 * @param geometry - The feature's `Polygon` or `MultiPolygon` geometry.
 * @returns The centroid, or `null` when the geometry carries no usable ring.
 *
 * @example
 * centroidOfGeometry({ type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] });
 * // [1, 1]
 */
export const centroidOfGeometry = (
  geometry: PolygonGeometry | MultiPolygonGeometry
): Position | null => {
  const outerRings =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((polygon) => {
          return polygon[0];
        });

  let largest: Ring | null = null;
  let largestArea = -1;

  for (const ring of outerRings) {
    if (!ring || ring.length === 0) {
      continue;
    }
    const area = Math.abs(ringTwiceArea(ring));
    if (area > largestArea) {
      largest = ring;
      largestArea = area;
    }
  }

  return largest ? ringCentroid(largest) : null;
};

/**
 * The weighted mean of a set of positions.
 *
 * Used for the UF point, where the weight is each município's CAF count — which
 * is what makes the dot land where the CAFs are instead of at the geometric
 * centre of the state.
 *
 * @param entries - One `{ position, weight }` per município.
 * @returns The weighted mean position, or `null` when the weights sum to zero
 * (no CAFs to be representative of).
 *
 * @example
 * weightedMean([
 *   { position: [-40, -12], weight: 3 },
 *   { position: [-44, -12], weight: 1 },
 * ]); // [-41, -12]
 */
export const weightedMean = (
  entries: { position: Position; weight: number }[]
): Position | null => {
  let totalWeight = 0;
  let lng = 0;
  let lat = 0;

  for (const { position, weight } of entries) {
    totalWeight += weight;
    lng += position[0] * weight;
    lat += position[1] * weight;
  }

  return totalWeight > 0 ? [lng / totalWeight, lat / totalWeight] : null;
};

/** Rounds a position to {@link COORDINATE_DECIMALS}. */
const round = (position: Position): Position => {
  return [
    Number(position[0].toFixed(COORDINATE_DECIMALS)),
    Number(position[1].toFixed(COORDINATE_DECIMALS)),
  ];
};

/** Reads the count snapshot, keeping only what this script needs from it. */
const readCounts = async (): Promise<
  { codigoIbge: string; quantidade: number }[]
> => {
  const parsed: unknown = JSON.parse(await readFile(COUNTS_PATH, 'utf8'));

  if (!Array.isArray(parsed)) {
    throw new Error('[generateCafPontos] caf-por-municipio.json is not array.');
  }

  return parsed.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    const codigoIbge = record['cdMunicipio'];
    const quantidade = record['quantidade'];

    if (typeof codigoIbge !== 'string' || typeof quantidade !== 'number') {
      throw new Error(
        `[generateCafPontos] malformed count record at index ${index}.`
      );
    }

    return { codigoIbge, quantidade };
  });
};

/** Reads the município polygons, indexed by IBGE code. */
const readCentroids = async (): Promise<Map<string, Position>> => {
  const parsed: unknown = JSON.parse(await readFile(POLYGONS_PATH, 'utf8'));
  const features = (parsed as { features?: MunicipioFeature[] }).features;

  if (!Array.isArray(features)) {
    throw new Error('[generateCafPontos] geojs-100-mun.json has no features.');
  }

  const centroids = new Map<string, Position>();

  for (const feature of features) {
    const centroid = centroidOfGeometry(feature.geometry);
    if (centroid) {
      centroids.set(feature.properties.codarea, centroid);
    }
  }

  return centroids;
};

const main = async (): Promise<void> => {
  const [counts, centroids] = await Promise.all([
    readCounts(),
    readCentroids(),
  ]);

  const byUf = new Map<
    string,
    {
      uf: string;
      nome: string;
      entries: { position: Position; weight: number }[];
    }
  >();

  let missingGeometry = 0;
  let missingUf = 0;

  for (const { codigoIbge, quantidade } of counts) {
    const position = centroids.get(codigoIbge);
    const uf = ufFromCodigoIbge(codigoIbge);

    if (!uf) {
      missingUf += 1;
      continue;
    }
    // A município created after the 2010 geometry vintage has no polygon to take
    // a centroid from, so it cannot pull the UF's anchor — but its CAFs still
    // count, and `toCafUfPontos` adds them back by IBGE prefix.
    if (!position) {
      missingGeometry += 1;
      continue;
    }

    const bucket = byUf.get(uf.codigoUf) ?? {
      uf: uf.uf,
      nome: uf.nome,
      entries: [],
    };
    bucket.entries.push({ position, weight: quantidade });
    byUf.set(uf.codigoUf, bucket);
  }

  const ufs = [...byUf.entries()]
    .map(([codigoUf, { uf, nome, entries }]) => {
      const position = weightedMean(entries);
      if (!position) {
        return null;
      }
      const [longitude, latitude] = round(position);
      return { codigoUf, uf, nome, longitude, latitude };
    })
    .filter((entry) => {
      return entry !== null;
    })
    .sort((a, b) => {
      return a.uf.localeCompare(b.uf);
    });

  await writeFile(OUTPUT_PATH, `${JSON.stringify({ ufs }, null, 2)}\n`, 'utf8');

  process.stderr.write(
    [
      `[generateCafPontos] read ${counts.length} município counts`,
      `wrote ${ufs.length} UF anchors`,
      `weighting skipped — no geometry: ${missingGeometry}, unknown UF prefix: ${missingUf}`,
      `output: ${OUTPUT_PATH}`,
      '',
    ].join('\n')
  );
};

await main();

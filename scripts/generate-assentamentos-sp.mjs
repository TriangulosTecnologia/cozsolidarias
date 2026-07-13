// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generates two committed artifacts from the SICAR base:
 *
 * 1. `public/geo/assentamentos-sp.json` — a GeoJSON `FeatureCollection` of the
 *    rural-settlement (`AST`) perimeters of São Paulo, drawn as filled polygons
 *    on the "Assentamentos e cozinhas (SP)" map mode.
 * 2. `public/geo/assentamentos-sp-atributos.json` — a geometry-free attribute
 *    sidecar (array keyed by `cod_imovel`) used client-side to color polygons by
 *    `ind_status` (categorical join) and to fill the hover tooltip, mirroring the
 *    `municipios-nomes.json` sidecar pattern. Kept small so the map can join
 *    status without re-parsing the multi-MB geometry file.
 *
 * Source of truth: the SICAR state base `AREA_IMOVEL` shapefile for SP (all
 * registered rural properties). SICAR ships one shapefile with every property
 * type; this script keeps only the rows whose `ind_tipo` is `AST` (settlements),
 * drops nothing by status (each feature carries `ind_status` so the map can
 * color by it), and rounds coordinates to {@link COORD_DECIMALS} decimals to keep
 * the browser payload small.
 *
 * The raw SICAR archive (~230 MB zipped) is NOT committed. Download it from the
 * CAR portal, unzip it, and point this script at the extracted `.shp` (its
 * sibling `.dbf`/`.shx` must sit next to it):
 *
 *     node scripts/generate-assentamentos-sp.mjs /path/to/AREA_IMOVEL_1.shp
 *
 * Run once and commit the output (no runtime dependency).
 *
 * Source: SICAR / Serviço Florestal Brasileiro — https://consulta.car.gov.br/geoservices
 */

/** CRS of the SICAR base: SIRGAS 2000 (EPSG:4674), lon/lat in decimal degrees. */
const COORD_DECIMALS = 6;

/** Property type kept from the mixed AREA_IMOVEL base. */
const TARGET_TYPE = 'AST';

/** DBF fields copied into each feature's `properties`, in output order. */
const KEPT_FIELDS = /** @type {const} */ ([
  'cod_imovel',
  'municipio',
  'cod_estado',
  'num_area',
  'ind_status',
  'des_condic',
  'dat_criaca',
  'dat_atuali',
]);

/** Renames terse DBF column names to the canonical property names. */
const PROPERTY_NAMES = /** @type {Record<string, string>} */ ({
  cod_imovel: 'cod_imovel',
  municipio: 'municipio',
  cod_estado: 'cod_estado',
  num_area: 'num_area_ha',
  ind_status: 'ind_status',
  des_condic: 'des_condicao_ambiental',
  dat_criaca: 'dat_criacao',
  dat_atuali: 'dat_atualizacao',
});

const round = (/** @type {number} */ value) => {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
};

/**
 * Parses a dBASE III `.dbf` buffer into an array of string-keyed records.
 * Only the fields in {@link KEPT_FIELDS} are decoded (latin-1); the rest are
 * skipped by offset. `ind_tipo` is always read so callers can filter by it.
 */
const parseDbf = (/** @type {Buffer} */ buffer) => {
  const numRecords = buffer.readUInt32LE(4);
  const headerSize = buffer.readUInt16LE(8);
  const recordSize = buffer.readUInt16LE(10);

  /** @type {{ name: string, offset: number, length: number }[]} */
  const fields = [];
  let pos = 32;
  let offset = 1; // 1-byte deletion flag leads each record
  while (buffer[pos] !== 0x0d) {
    const name = buffer.toString('latin1', pos, pos + 11).replace(/\0.*$/, '');
    const length = buffer[pos + 16];
    fields.push({ name, offset, length });
    offset += length;
    pos += 32;
  }

  /** @type {Record<string, string>[]} */
  const rows = [];
  for (let i = 0; i < numRecords; i += 1) {
    const start = headerSize + i * recordSize;
    /** @type {Record<string, string>} */
    const row = {};
    for (const field of fields) {
      if (field.name !== 'ind_tipo' && !KEPT_FIELDS.includes(field.name)) {
        continue;
      }
      const from = start + field.offset;
      row[field.name] = buffer
        .toString('latin1', from, from + field.length)
        .trim();
    }
    rows.push(row);
  }
  return rows;
};

/**
 * Reads polygon geometry for one record from the `.shp` buffer at `byteOffset`
 * (the record's content start, i.e. past its 8-byte record header). Returns the
 * ring list ([[ [lon,lat], ... ], ...]) or `null` for null shapes.
 */
const readPolygon = (
  /** @type {Buffer} */ shp,
  /** @type {number} */ byteOffset
) => {
  const shapeType = shp.readInt32LE(byteOffset);
  if (shapeType === 0) {
    return null;
  }
  const numParts = shp.readInt32LE(byteOffset + 36);
  const numPoints = shp.readInt32LE(byteOffset + 40);
  const partsStart = byteOffset + 44;
  const pointsStart = partsStart + numParts * 4;

  const parts = [];
  for (let i = 0; i < numParts; i += 1) {
    parts.push(shp.readInt32LE(partsStart + i * 4));
  }

  /** @type {[number, number][]} */
  const points = [];
  for (let i = 0; i < numPoints; i += 1) {
    const base = pointsStart + i * 16;
    points.push([
      round(shp.readDoubleLE(base)),
      round(shp.readDoubleLE(base + 8)),
    ]);
  }

  /** @type {[number, number][][]} */
  const rings = [];
  for (let i = 0; i < parts.length; i += 1) {
    const end = i + 1 < parts.length ? parts[i + 1] : numPoints;
    rings.push(points.slice(parts[i], end));
  }
  return rings;
};

/** Signed area (shoelace); negative = clockwise (shapefile outer ring). */
const signedArea = (/** @type {[number, number][]} */ ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
};

/**
 * Groups shapefile rings into GeoJSON geometry. A clockwise ring (negative
 * signed area) opens a new polygon; counter-clockwise rings are holes of the
 * current polygon. One polygon → `Polygon`; several → `MultiPolygon`.
 */
const ringsToGeometry = (/** @type {[number, number][][]} */ rings) => {
  /** @type {[number, number][][][]} */
  const polygons = [];
  for (const ring of rings) {
    if (signedArea(ring) < 0 || polygons.length === 0) {
      polygons.push([ring]);
    } else {
      polygons[polygons.length - 1].push(ring);
    }
  }
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons };
};

const main = async () => {
  const shpPath = process.argv[2];
  if (!shpPath) {
    throw new Error(
      'Usage: node scripts/generate-assentamentos-sp.mjs /path/to/AREA_IMOVEL_1.shp'
    );
  }
  const dbfPath = shpPath.replace(/\.shp$/i, '.dbf');
  const shxPath = shpPath.replace(/\.shp$/i, '.shx');

  const [shp, dbf, shx] = await Promise.all([
    readFile(shpPath),
    readFile(dbfPath),
    readFile(shxPath),
  ]);

  const rows = parseDbf(dbf);

  /** @type {{ type: 'Feature', properties: Record<string, string | number>, geometry: object }[]} */
  const features = [];
  const numShx = (shx.length - 100) / 8;
  for (let i = 0; i < rows.length && i < numShx; i += 1) {
    if (rows[i]['ind_tipo'] !== TARGET_TYPE) {
      continue;
    }
    // .shx entry: 8 bytes per record, big-endian offset in 16-bit words.
    const contentOffset = shx.readInt32BE(100 + i * 8) * 2 + 8;
    const rings = readPolygon(shp, contentOffset);
    if (!rings) {
      continue;
    }
    /** @type {Record<string, string | number>} */
    const properties = {};
    for (const field of KEPT_FIELDS) {
      const raw = rows[i][field] ?? '';
      properties[PROPERTY_NAMES[field]] =
        field === 'num_area' ? Number(raw) : raw;
    }
    features.push({
      type: 'Feature',
      properties,
      geometry: ringsToGeometry(rings),
    });
  }

  const geoDir = join(process.cwd(), 'public', 'geo');
  const outputPath = join(geoDir, 'assentamentos-sp.json');
  await writeFile(
    outputPath,
    `${JSON.stringify({ type: 'FeatureCollection', features }, null, 2)}\n`
  );

  // Attribute sidecar: the fields the map joins/labels by, without geometry.
  // Emitted in the app's canonical camelCase (the geometry file keeps the
  // source-native SICAR property names, which the map joins by `cod_imovel`).
  const atributos = features.map((feature) => {
    const p = feature.properties;
    return {
      codImovel: p['cod_imovel'],
      municipio: p['municipio'],
      areaHa: p['num_area_ha'],
      status: p['ind_status'],
      condicao: p['des_condicao_ambiental'],
    };
  });
  const sidecarPath = join(geoDir, 'assentamentos-sp-atributos.json');
  await writeFile(sidecarPath, `${JSON.stringify(atributos, null, 2)}\n`);

  console.log(
    `Wrote ${features.length} AST features to ${outputPath} and ${sidecarPath}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

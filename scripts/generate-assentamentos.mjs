// @ts-check
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, open, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Generates the rural-settlement (`AST`) map artifacts from the SICAR state
 * bases, across every state in {@link SICAR_SOURCES}:
 *
 * 1. `public/geo/assentamentos.json` — a GeoJSON `FeatureCollection` of the AST
 *    perimeters (coordinates rounded to {@link COORD_DECIMALS} decimals), drawn
 *    as filled polygons on the "Assentamentos e cozinhas" map mode.
 * 2. `public/geo/assentamentos-atributos.json` — a geometry-free attribute
 *    sidecar (one row per settlement, camelCase) used client-side to color the
 *    polygons by `ind_status` and to fill the hover tooltip.
 *
 * For each state it downloads the raw `AREA_IMOVEL.zip` into a git-ignored cache
 * (`.temp/sicar/<UF>/`), unzips the shapefile parts, keeps only the rows whose
 * `ind_tipo` is `AST`, and merges them all into the two committed artifacts.
 *
 * Usage — run then commit the outputs (no runtime dependency):
 *
 *     node scripts/generate-assentamentos.mjs          # reuse cached zips
 *     node scripts/generate-assentamentos.mjs --force  # re-download every zip
 *
 * IMPORTANT — the URLs below are **pre-signed and expire ~1h after issue**
 * (`X-Amz-Expires=3600`). They are only a record of what was downloaded; to
 * regenerate, paste fresh links from the CAR portal first. A state whose
 * download fails (expired/removed link) is logged and skipped so the other
 * states still regenerate. Add a state by appending a `{ uf, url }` entry.
 *
 * Source: SICAR / Serviço Florestal Brasileiro — https://consulta.car.gov.br/geoservices
 */
const SICAR_SOURCES = [
  {
    uf: 'SP',
    url: 'https://ns-mgi-prod-df.s3-df-govcloud.dataprev.gov.br/gcc-sicar/arquivos/basesGeo/SP/AREA_IMOVEL.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260713T003315Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Credential=user_mgi_prod_df%2F20260713%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=51371f84988ed430344c5f85a61180616dac4c26db89f08b60d647148bff7478',
  },
  {
    uf: 'MG',
    url: 'https://ns-mgi-prod-df.s3-df-govcloud.dataprev.gov.br/gcc-sicar/arquivos/basesGeo/MG/AREA_IMOVEL.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260713T110115Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Credential=user_mgi_prod_df%2F20260713%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=67ad1518cbec0a7c76ddd8af45059fd46475e0bc509ae20cd5f824db81bbf24b',
  },
  {
    uf: 'RJ',
    url: 'https://ns-mgi-prod-df.s3-df-govcloud.dataprev.gov.br/gcc-sicar/arquivos/basesGeo/RJ/AREA_IMOVEL.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260713T110149Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Credential=user_mgi_prod_df%2F20260713%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=5eda6fd9f154f4805471e72eec0be9757468539926f3ae8267a56e57b6c5c5a3',
  },
  {
    uf: 'ES',
    url: 'https://ns-mgi-prod-df.s3-df-govcloud.dataprev.gov.br/gcc-sicar/arquivos/basesGeo/ES/AREA_IMOVEL.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260713T110247Z&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Credential=user_mgi_prod_df%2F20260713%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=4eccd338b00a2e03879a3d833081e013f316d750bee6aec6e3606763d6a54c24',
  },
];

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
  'mod_fiscal',
  'ind_status',
  'des_condic',
  'dat_criaca',
  'dat_atuali',
]);

/** Renames terse DBF column names to the canonical geojson property names. */
const PROPERTY_NAMES = /** @type {Record<string, string>} */ ({
  cod_imovel: 'cod_imovel',
  municipio: 'municipio',
  cod_estado: 'cod_estado',
  num_area: 'num_area_ha',
  mod_fiscal: 'mod_fiscal',
  ind_status: 'ind_status',
  des_condic: 'des_condicao_ambiental',
  dat_criaca: 'dat_criacao',
  dat_atuali: 'dat_atualizacao',
});

/** Geojson properties emitted as numbers (the rest stay strings). */
const NUMERIC_PROPS = new Set(['num_area_ha', 'mod_fiscal']);

const round = (/** @type {number} */ value) => {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
};

/**
 * Reads a dBASE III `.dbf` header from an open file handle: the record layout
 * plus the field descriptors (name/offset/length within each record). Reading
 * via a handle — instead of the whole file — is required because the SICAR
 * `.dbf` can exceed Node's 2 GiB `readFile` limit (MG is ~3 GiB).
 */
const readDbfHeader = async (
  /** @type {import('node:fs/promises').FileHandle} */ handle
) => {
  const head = Buffer.alloc(32);
  await handle.read(head, 0, 32, 0);
  const numRecords = head.readUInt32LE(4);
  const headerSize = head.readUInt16LE(8);
  const recordSize = head.readUInt16LE(10);

  const descriptors = Buffer.alloc(headerSize - 32);
  await handle.read(descriptors, 0, descriptors.length, 32);

  /** @type {{ name: string, offset: number, length: number }[]} */
  const fields = [];
  let pos = 0;
  let offset = 1; // 1-byte deletion flag leads each record
  while (pos < descriptors.length && descriptors[pos] !== 0x0d) {
    const name = descriptors
      .toString('latin1', pos, pos + 11)
      .replace(/\0.*$/, '');
    const length = descriptors[pos + 16];
    fields.push({ name, offset, length });
    offset += length;
    pos += 32;
  }
  return { fields, numRecords, headerSize, recordSize };
};

/** Decodes the kept (+`ind_tipo`) fields of one record from its buffer slice. */
const decodeDbfRecord = (
  /** @type {Buffer} */ buffer,
  /** @type {number} */ base,
  /** @type {{ name: string, offset: number, length: number }[]} */ fields
) => {
  /** @type {Record<string, string>} */
  const row = {};
  for (const field of fields) {
    if (field.name !== 'ind_tipo' && !KEPT_FIELDS.includes(field.name)) {
      continue;
    }
    const from = base + field.offset;
    row[field.name] = buffer
      .toString('latin1', from, from + field.length)
      .trim();
  }
  return row;
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

/** Builds the GeoJSON `properties` of one AST record from its decoded DBF row. */
const toFeatureProperties = (/** @type {Record<string, string>} */ row) => {
  /** @type {Record<string, string | number>} */
  const properties = {};
  for (const field of KEPT_FIELDS) {
    const name = PROPERTY_NAMES[field];
    const raw = row[field] ?? '';
    properties[name] = NUMERIC_PROPS.has(name) ? Number(raw) : raw;
  }
  return properties;
};

/** How many DBF records to read per positional chunk (~5 MB at SICAR sizes). */
const DBF_CHUNK_RECORDS = 2000;

/**
 * Builds the AST features of a single `.shp`/`.dbf`/`.shx` triple using
 * positional reads (file handles), so multi-GiB SICAR bases stay well under
 * Node's 2 GiB whole-file read limit and out of memory. The `.shx` index is
 * small enough to read whole; it maps each record index to its `.shp` offset.
 */
const readShapefileAstFeatures = async (/** @type {string} */ shpPath) => {
  const dbfPath = shpPath.replace(/\.shp$/i, '.dbf');
  const shxPath = shpPath.replace(/\.shp$/i, '.shx');
  const shx = await readFile(shxPath);
  const dbf = await open(dbfPath, 'r');
  const shp = await open(shpPath, 'r');
  try {
    const { fields, numRecords, headerSize, recordSize } =
      await readDbfHeader(dbf);
    const numShx = (shx.length - 100) / 8;
    const chunk = Buffer.alloc(recordSize * DBF_CHUNK_RECORDS);

    const features = [];
    for (let start = 0; start < numRecords; start += DBF_CHUNK_RECORDS) {
      const count = Math.min(DBF_CHUNK_RECORDS, numRecords - start);
      await dbf.read(
        chunk,
        0,
        recordSize * count,
        headerSize + start * recordSize
      );

      for (let k = 0; k < count; k += 1) {
        const index = start + k;
        if (index >= numShx) {
          break;
        }
        const row = decodeDbfRecord(chunk, k * recordSize, fields);
        if (row['ind_tipo'] !== TARGET_TYPE) {
          continue;
        }

        // .shx entry: 8 bytes/record, big-endian offset in 16-bit words. Read
        // the .shp record header (8 bytes) to size the content, then the content.
        const recordOffset = shx.readInt32BE(100 + index * 8) * 2;
        const header = Buffer.alloc(8);
        await shp.read(header, 0, 8, recordOffset);
        const contentLength = header.readInt32BE(4) * 2;
        const content = Buffer.alloc(contentLength);
        await shp.read(content, 0, contentLength, recordOffset + 8);

        const rings = readPolygon(content, 0);
        if (!rings) {
          continue;
        }
        features.push({
          type: 'Feature',
          properties: toFeatureProperties(row),
          geometry: ringsToGeometry(rings),
        });
      }
    }
    return features;
  } finally {
    await dbf.close();
    await shp.close();
  }
};

/** Streams a URL to `destPath` on disk (no full-buffer in memory). */
const downloadTo = async (
  /** @type {string} */ url,
  /** @type {string} */ destPath
) => {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
};

/**
 * Downloads (unless cached), unzips and parses one state's AREA_IMOVEL base.
 * Returns its AST features, or `null` when the download fails so the caller can
 * skip the state without aborting the whole run.
 */
const processState = async (
  /** @type {{ uf: string, url: string }} */ source,
  /** @type {boolean} */ force
) => {
  const dir = join(process.cwd(), '.temp', 'sicar', source.uf);
  const zipPath = join(dir, 'AREA_IMOVEL.zip');
  await mkdir(dir, { recursive: true });

  if (force || !existsSync(zipPath)) {
    try {
      console.log(`[${source.uf}] downloading…`);
      await downloadTo(source.url, zipPath);
    } catch (error) {
      console.warn(`[${source.uf}] download failed, skipping: ${error}`);
      return null;
    }
  }

  execFileSync('unzip', ['-o', zipPath, '*.shp', '*.dbf', '*.shx', '-d', dir], {
    stdio: 'ignore',
  });

  const shapefiles = (await readdir(dir))
    .filter((name) => {
      return name.toLowerCase().endsWith('.shp');
    })
    .map((name) => {
      return join(dir, name);
    });

  const features = [];
  for (const shpPath of shapefiles) {
    features.push(...(await readShapefileAstFeatures(shpPath)));
  }
  console.log(`[${source.uf}] ${features.length} AST features`);
  return features;
};

const main = async () => {
  const force = process.argv.includes('--force');

  const features = [];
  for (const source of SICAR_SOURCES) {
    const stateFeatures = await processState(source, force);
    if (stateFeatures) {
      features.push(...stateFeatures);
    }
  }

  const geoDir = join(process.cwd(), 'public', 'geo');
  const geojsonPath = join(geoDir, 'assentamentos.json');
  await writeFile(
    geojsonPath,
    `${JSON.stringify({ type: 'FeatureCollection', features }, null, 2)}\n`
  );

  // Attribute sidecar (camelCase): the fields the map joins/labels by, without
  // geometry, so the map can color by status and fill the tooltip without
  // re-parsing the multi-MB geometry file.
  const atributos = features.map((feature) => {
    const p = feature.properties;
    return {
      codImovel: p['cod_imovel'],
      municipio: p['municipio'],
      uf: p['cod_estado'],
      areaHa: p['num_area_ha'],
      modulosFiscais: p['mod_fiscal'],
      status: p['ind_status'],
      condicao: p['des_condicao_ambiental'],
      dtCriacao: p['dat_criacao'],
      dtAtualizacao: p['dat_atualizacao'],
    };
  });
  const sidecarPath = join(geoDir, 'assentamentos-atributos.json');
  await writeFile(sidecarPath, `${JSON.stringify(atributos, null, 2)}\n`);

  console.log(
    `Wrote ${features.length} AST features to ${geojsonPath} and ${sidecarPath}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

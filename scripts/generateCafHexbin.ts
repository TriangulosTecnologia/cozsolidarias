/**
 * Offline generator for the `cafs-hexbin` map mode: one hexagon per H3 cell
 * over Brazil, carrying how many CAFs fall inside it.
 *
 * # Why a JSON and not tiles
 *
 * The `cafs` mode already reads this same binning, but through a tile pyramid
 * and drawn as circles at each cell's weighted centroid. A tiled source cannot
 * be joined by `mapData` (geovis writes the join into MapLibre feature-state,
 * which only geojson sources carry), so that mode paints its counts with four
 * stacked layers per resolution and one-sided filters standing in for a ramp.
 *
 * At one fixed resolution the whole grid fits in a single geojson file, and a
 * joined source buys back the thing the tiles cost: one polygon layer with a
 * real colour ramp, the same shape as every choropleth in this app.
 *
 * # The resolution
 *
 * H3 resolutions are discrete, so "40 km" picks the nearest: **r4**, whose
 * cells are ~45 km flat-to-flat (~52 km vertex-to-vertex) over 1.770 km². The
 * neighbours are r3 at ~120 km and r5 at ~17 km — neither is close.
 *
 * That is ~4.5k cells covering the country, around 1 MB of geojson. It is
 * fetched only when the reader picks this mode (`datasetsForMode`), like every
 * other per-mode snapshot.
 *
 * # What is counted
 *
 * Exactly what the tile pyramid counts, through the same `pointFromRow`: rows
 * flagged as the CAF's principal property whose coordinates land inside
 * Brazil's bounding box. The ~812k rows with broken coordinates are dropped
 * here as they are there, so this mode and the tiled one agree — and both
 * disagree with the UF level, which counts from `cd_municipio` and so includes
 * CAFs with no usable coordinate. The run reports the gap; the map states it.
 *
 * # Which cells are emitted
 *
 * Every cell covering Brazilian land, occupied or not — a cell that holds no
 * CAF is a fact about the territory, and a grid with holes in it reads as
 * missing data rather than as zero. Any occupied cell outside that set is kept
 * too: the land test exists to shape the grid, never to drop a count.
 *
 * # The snapshot's shape
 *
 * Plain `{ resolution, cells }` rather than GeoJSON. The source layer holds what
 * the generator produced; turning it into the FeatureCollection the map draws is
 * the gateway transformer's job, exactly as `caf-pontos.json` holds `{ ufs }`
 * and is assembled into points downstream.
 *
 * Usage — the CSV is far too large to commit, so pass its path (defaults to the
 * repo's `caf-area.csv`, which holds only a sample):
 *
 *   node --max-old-space-size=4096 scripts/generateCafHexbin.ts "/path/to/03 - AREA.csv" [resolution]
 *
 * Output: `src/data-source-static/data/caf-hexbin-r<resolution>.json` (r4 by
 * default). Run it once per resolution the map offers.
 */
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { cellToBoundary, latLngToCell, polygonToCells } from 'h3-js';

/*
 * The read contract for `caf-area.csv` below — column order, which rows count,
 * and what makes a coordinate usable — is a DELIBERATE COPY of the one in
 * `generateCafTiles.ts`. Two `.ts` scripts run directly by Node cannot import
 * one another here: Node requires the `.ts` extension and this project's
 * `moduleResolution: "bundler"` rejects it.
 *
 * The two copies MUST stay identical. They bin the same file into the same
 * cells, and the `cafs` and `cafs-hexbin` modes are read side by side — if one
 * copy drifts, the two modes report different totals for the same country and
 * neither is obviously wrong. Change one, change the other.
 */

/** Column order in `caf-area.csv`, used to validate the header. */
const EXPECTED_HEADER = [
  'nr_caf',
  'ds_tipo_area',
  'ds_tipo_unidade_medida',
  'nr_area',
  'cd_municipio',
  'sg_uf',
  'nm_municipio',
  'ds_tipo_localizacao_area',
  'ds_condicao_dominio',
  'st_imovel_principal',
  'nr_latitude',
  'nr_longitude',
];

/**
 * Brazil's bounding box, the filter that drops the rows with broken
 * coordinates. Generous on purpose: it is here to reject garbage, not to clip
 * the country.
 */
const BBOX = { minLat: -34, maxLat: 6, minLng: -74, maxLng: -33 };

/**
 * Decimal places kept per coordinate. Five is ~1 m at these latitudes, finer
 * than the source's own accuracy and shorter than the 15-digit values the file
 * carries.
 */
const COORDINATE_DECIMALS = 5;

/**
 * The three fields this script reads, counted from the END of the row.
 *
 * Taking them from the back is what lets the row be split on `;` without
 * parsing quotes: the file quotes some leading fields (`cd_municipio`), and a
 * semicolon inside one of those would shift every index counted from the
 * front. The last three — the boolean and the two coordinates — are never
 * quoted, so their distance from the end is fixed.
 */
const FROM_END = { stImovelPrincipal: 3, latitude: 2, longitude: 1 };

/**
 * Fails the run when the CSV's column order is not the one this script reads.
 * A moved column would not throw on its own — it would silently bin garbage.
 */
const assertHeader = (cells: string[]): void => {
  const mismatch = EXPECTED_HEADER.findIndex((name, index) => {
    return cells[index]?.trim().replaceAll('"', '') !== name;
  });

  if (mismatch !== -1) {
    throw new Error(
      `[generateCafTiles] header mismatch at column ${mismatch}: ` +
        `expected "${EXPECTED_HEADER[mismatch]}", found "${cells[mismatch]}".`
    );
  }
};

const cellFromEnd = (cells: string[], offset: number): string => {
  return (cells[cells.length - offset] ?? '').trim();
};

/**
 * The point one CSV row contributes, or `null` when the row is not one of ours.
 *
 * @param cells - The row split on `;`.
 * @returns The CAF's number and its rounded `[longitude, latitude]`, or `null`
 * to skip the row — with `reason` telling the caller which counter to bump.
 *
 * @example
 * pointFromRow(['6', 'Terra', 'ha', '2.20', '5300108', 'DF', 'Brasília', 'Rural', 'Proprietário', 'true', '-15.771184', '-48.180337']);
 * // { nrCaf: 6, point: [-48.18034, -15.77118] }
 */
const pointFromRow = (
  cells: string[]
):
  | { nrCaf: number; point: [number, number] }
  | { reason: 'secondary' | 'coordinates' } => {
  if (cellFromEnd(cells, FROM_END.stImovelPrincipal) !== 'true') {
    return { reason: 'secondary' };
  }

  const latitude = Number(cellFromEnd(cells, FROM_END.latitude));
  const longitude = Number(cellFromEnd(cells, FROM_END.longitude));

  const insideBrazil =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= BBOX.minLat &&
    latitude <= BBOX.maxLat &&
    longitude >= BBOX.minLng &&
    longitude <= BBOX.maxLng;

  if (!insideBrazil) {
    return { reason: 'coordinates' };
  }

  return {
    nrCaf: Number(cells[0]?.replaceAll('"', '').trim()),
    point: [
      Number(longitude.toFixed(COORDINATE_DECIMALS)),
      Number(latitude.toFixed(COORDINATE_DECIMALS)),
    ],
  };
};

/**
 * The binning resolution, from the second argument. See the module header: r4
 * is the nearest H3 step to the ~40 km cell this mode was specified with, and
 * stays the default.
 *
 * Each step is a factor of seven in cell area, so the grid — and the file —
 * grows sevenfold per step down. Run the script once per resolution the map
 * offers; the output is named after it, so the runs do not overwrite each
 * other.
 */
const RESOLUTION = Number(process.argv[3] ?? 4);

if (!Number.isInteger(RESOLUTION) || RESOLUTION < 0 || RESOLUTION > 15) {
  throw new Error(
    `[generateCafHexbin] resolution must be an integer in 0..15, got "${process.argv[3]}".`
  );
}

/**
 * Decimal places kept per hexagon vertex. Four is ~11 m — three orders of
 * magnitude below the cell it describes, and the difference between a 1 MB
 * file and a 1.3 MB one.
 */
const VERTEX_DECIMALS = 4;

const DEFAULT_INPUT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-area.csv'
);

/** The state polygons, read only to decide which cells cover land. */
const ESTADOS_PATH = join(process.cwd(), 'public', 'geo', 'estados.json');

const OUTPUT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  `caf-hexbin-r${RESOLUTION}.json`
);

/** Minimal shape of `estados.json` — only the geometry is read. */
type EstadosCollection = {
  features: {
    geometry:
      | { type: 'Polygon'; coordinates: number[][][] }
      | { type: 'MultiPolygon'; coordinates: number[][][][] };
  }[];
};

/**
 * Every H3 cell whose centre falls inside a state polygon.
 *
 * `polygonToCells` takes `[lat, lng]` rings, the transpose of GeoJSON's — the
 * one place this script has to flip a coordinate pair.
 *
 * @param estados - The parsed state collection.
 * @returns The covering cells, deduplicated across states.
 */
const landCells = (estados: EstadosCollection): Set<string> => {
  const cells = new Set<string>();

  for (const feature of estados.features) {
    const polygons =
      feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];

    for (const polygon of polygons) {
      const ring = polygon[0].map(([longitude, latitude]) => {
        return [latitude, longitude];
      });

      for (const cell of polygonToCells([ring], RESOLUTION)) {
        cells.add(cell);
      }
    }
  }

  return cells;
};

/** What one pass over the CSV produced. */
type Pass = {
  counts: Map<string, number>;
  rows: number;
  counted: number;
  secondary: number;
  badCoordinates: number;
};

/**
 * Streams the CSV once, counting every usable CAF into its H3 cell.
 *
 * @param inputPath - The CSV to read.
 * @returns The per-cell counts and the row tallies the run reports.
 * @throws If the header does not match the expected column order.
 */
const readCsv = async (inputPath: string): Promise<Pass> => {
  const lines = createInterface({
    input: createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const counts = new Map<string, number>();
  let isHeader = true;
  let rows = 0;
  let counted = 0;
  let secondary = 0;
  let badCoordinates = 0;

  for await (const rawLine of lines) {
    if (rawLine.trim() === '') {
      continue;
    }

    const row = rawLine.split(';');

    if (isHeader) {
      isHeader = false;
      assertHeader(row);
      continue;
    }

    rows += 1;
    const result = pointFromRow(row);

    if ('reason' in result) {
      if (result.reason === 'secondary') {
        secondary += 1;
      } else {
        badCoordinates += 1;
      }
      continue;
    }

    counted += 1;
    const [longitude, latitude] = result.point;
    const key = latLngToCell(latitude, longitude, RESOLUTION);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return { counts, rows, counted, secondary, badCoordinates };
};

/**
 * One cell of the snapshot: its H3 index, its count, and its hexagon's ring.
 *
 * The ring is stored rather than re-derived downstream so that `h3-js` stays a
 * build-time dependency: the gateway assembles the GeoJSON from these numbers
 * without the library, and nothing has to agree on an H3 version at runtime.
 *
 * The ring is open — the closing vertex is the first one repeated, which the
 * transformer appends. Storing it would add ~6% to the file for a value that is
 * already there.
 */
const cellEntry = (cell: string, count: number): string => {
  const ring = cellToBoundary(cell, true).map(([longitude, latitude]) => {
    return `[${longitude.toFixed(VERTEX_DECIMALS)},${latitude.toFixed(VERTEX_DECIMALS)}]`;
  });

  return `{"h3":"${cell}","count":${count},"ring":[${ring.join(',')}]}`;
};

/** Quartiles of the occupied cells' counts, to tune the map's class breaks. */
const describeCounts = (counts: number[]): string => {
  const sorted = [...counts].sort((a, b) => {
    return a - b;
  });
  const at = (fraction: number) => {
    return sorted[
      Math.min(Math.floor(fraction * sorted.length), sorted.length - 1)
    ];
  };

  return `min ${sorted[0]}, p25 ${at(0.25)}, p50 ${at(0.5)}, p75 ${at(0.75)}, p90 ${at(0.9)}, max ${sorted[sorted.length - 1]}`;
};

const main = async (): Promise<void> => {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT_PATH;

  const estados = JSON.parse(
    await readFile(ESTADOS_PATH, 'utf8')
  ) as EstadosCollection;
  const land = landCells(estados);

  const pass = await readCsv(inputPath);

  // Land cells first, then any occupied cell the land test missed — a count is
  // never dropped to tidy the silhouette.
  const emitted = new Set([...land, ...pass.counts.keys()]);
  const cells = [...emitted].sort().map((cell) => {
    return cellEntry(cell, pass.counts.get(cell) ?? 0);
  });

  await writeFile(
    OUTPUT_PATH,
    `{"resolution":${RESOLUTION},"cells":[${cells.join(',')}]}`,
    'utf8'
  );

  const occupied = [...pass.counts.values()];
  const binned = occupied.reduce((sum, count) => {
    return sum + count;
  }, 0);

  process.stderr.write(
    [
      `[generateCafHexbin] read ${pass.rows} rows from ${inputPath}`,
      `CAFs counted: ${pass.counted} (binned: ${binned})`,
      `skipped — secondary areas: ${pass.secondary}, unusable coordinates: ${pass.badCoordinates}`,
      `cells: ${cells.length} emitted, ${pass.counts.size} occupied, ${cells.length - pass.counts.size} empty`,
      `counts per occupied cell — tune the map's breaks against these:`,
      `  ${describeCounts(occupied)}`,
      `output: ${OUTPUT_PATH}`,
      '',
    ].join('\n')
  );
};

await main();

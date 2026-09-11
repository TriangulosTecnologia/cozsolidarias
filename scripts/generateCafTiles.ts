/**
 * Offline generator for the two *tiled* levels of the CAF map: the H3 grids
 * that carry the middle zooms, and the individual CAF points that take over at
 * the deep end.
 *
 * The `cafs` map mode is a zoom hierarchy — UF → H3 grid → points. The UF level
 * is 27 features and is built by `scripts/generateCafPontos.ts`; the two this
 * script builds are not.
 *
 * # Why a hierarchy at all
 *
 * The raw `caf-area.csv` snapshot has ~4.3M rows (~426 MB). As GeoJSON its
 * points weigh ~250 MB, which no browser can parse, so the points are never
 * shipped as a source. Tiles alone are not enough either: 3.2M dots overlap
 * into a solid mass at anything above street zoom, which says nothing about how
 * the CAFs are distributed.
 *
 * # The H3 grids
 *
 * Aggregation is spatial, not administrative — and that is what keeps the
 * number of marks on screen roughly constant as the reader descends. A circle
 * per município would put all 5,518 on screen whatever the zoom; a grid whose
 * cell size follows the zoom puts a few hundred at every level.
 *
 * Resolution rises with zoom, targeting a cell about 60–80 px across:
 *
 * | zoom | tile width | H3 | cell across | area       |
 * |------|------------|----|-------------|------------|
 * | 5–6  | ~1210 km   | r3 | ~120 km     | 12.393 km² |
 * | 7    | ~302 km    | r4 | ~45 km      | 1.770 km²  |
 * | 8    | ~151 km    | r5 | ~17 km      | 253 km²    |
 * | 9    | ~76 km     | r6 | ~6,5 km     | 36 km²     |
 *
 * One H3 step is ~7× in area while one zoom step is 4×, so a resolution can
 * span more than one zoom — r3 covering z5 and z6 is the ladder working, not a
 * shortcut.
 *
 * Each cell is emitted as a POINT at the **weighted centroid of the CAFs inside
 * it**, not as a hexagon and not at the cell's own centre. Drawn at the centre
 * the map reads as a regular lattice of dots — an artefact of the method rather
 * than a picture of the data. At the weighted centroid the mesh disappears and
 * the distribution is what shows, while the cell keeps doing the only job it
 * was ever for: a deterministic bin whose counts are exact and reproducible.
 *
 * Alongside its count, each cell carries its own hexagon's extent (`w`/`s`/`e`/
 * `n`). The point is drawn at the centroid but the reader clicks to open the
 * CELL, so the map needs the boundary the geometry deliberately does not carry
 * — and reading it here, where `h3-js` already runs, keeps that library out of
 * the browser bundle.
 *
 * Counts are accumulated **once**, at the finest resolution, then rolled up with
 * `cellToParent` — the coordinate sums along with the count, so every level's
 * centroid is the true weighted mean of its own CAFs rather than an average of
 * averages. Re-binning each point per resolution would be both slower and
 * inconsistent: H3's parent/child relation is not exact containment, so a point
 * near a cell boundary can land in one r3 cell while its r6 cell's parent is
 * another. Rolled up, every grid sums to exactly the same national total.
 *
 * # The individual points
 *
 * Built from z10, two zooms earlier than the grid could have carried on to:
 * reaching the properties themselves is the point of drilling in. That is also
 * the one place in this pipeline where data is dropped — a z10 tile over a dense
 * region blows the 500 KB budget and `--drop-densest-as-needed` thins it. It is
 * the acceptable place for it: the reader is inspecting individual properties
 * there, not reading a distribution.
 *
 * Each point carries `count: 1` and its `nr_caf`, the latter promoted to the
 * tile feature's id. Nothing reads it today — the app publishes no
 * per-registration detail, so the points are not even clickable. It is kept so
 * that adding one back does not mean regenerating the pyramid, but publishing a
 * cadastral number next to a coordinate is a real cost with nothing currently
 * bought by it: drop `--use-attribute-for-id` here if no such detail is
 * planned.
 *
 * # What is counted
 *
 * Rows flagged as the CAF's principal property (`st_imovel_principal = true`)
 * whose coordinates fall inside Brazil's bounding box. Both filters matter — the
 * first maps a CAF to its main location instead of every parcel it holds, and
 * the second drops ~812k rows whose coordinates are unusable (the file carries
 * longitudes such as `-3538362022051478`, a lost decimal point).
 *
 * Those ~812k are the reason the tiled levels are NOT reconcilable with the UF
 * level, which counts from `cd_municipio` and so includes CAFs with no usable
 * coordinate. The run reports the coverage; the map states it.
 *
 * Prerequisites: `tippecanoe` on the PATH (`tippecanoe --version`).
 *
 * Usage — the CSV is far too large to commit, so pass its path (defaults to the
 * repo's `caf-area.csv`, which holds only a sample). Raise the heap: the base
 * counter holds one entry per occupied cell.
 *
 *   node --max-old-space-size=4096 scripts/generateCafTiles.ts "/path/to/03 - AREA.csv"
 *
 * Pass `--no-points` to rebuild only the grids, which takes a fraction of the
 * time; the point pyramid is the expensive half of the run.
 *
 * Output (git-ignored): `public/tiles/caf-h3-r{3,4,5,6}/{z}/{x}/{y}.pbf` and
 * `public/tiles/cafs/{z}/{x}/{y}.pbf`. Tiles are written uncompressed
 * (`--no-tile-compression`) because Next.js serves `public/` files verbatim,
 * without the `Content-Encoding: gzip` header MapLibre would need to read
 * compressed ones. A CDN that sets that header can drop the flag.
 */
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { cellToBoundary, cellToParent, latLngToCell } from 'h3-js';

const DEFAULT_INPUT_PATH = join(
  process.cwd(),
  'src',
  'data-source-static',
  'data',
  'caf-area.csv'
);

const TILES_DIR = join(process.cwd(), 'public', 'tiles');

/**
 * Layer name inside the grid tiles; the map's layers declare it as
 * `sourceLayer`. Shared as a contract with `geovisCafLayers.ts`, which cannot be
 * imported from a Node script without pulling geovis in.
 */
const H3_TILE_LAYER = 'caf-h3';

/** Layer name inside the individual-point tiles. */
const POINTS_TILE_LAYER = 'cafs';

/**
 * Feature property every tiled feature carries: how many CAFs it stands for —
 * the cell's total on a grid circle, `1` on an individual point. Shared with
 * `geovisCafLayers.ts`, which filters and sizes on it.
 */
const COUNT_PROPERTY = 'count';

/**
 * Feature property carried by the individual points only: the CAF's
 * registration number, promoted to each tile feature's id.
 *
 * The grids do not carry it, and must not: a cell stands for many CAFs, so
 * there is no single number to attribute to it.
 *
 * No consumer reads it at present. The points originally carried nothing but
 * `count: 1`, precisely so that a cadastral id was never published next to a
 * coordinate; the detail view that justified adding it is gone, so this is now
 * a cost without a return — see the note in the module header.
 */
const CAF_ID_PROPERTY = 'nr_caf';

/**
 * Feature properties carrying the cell's own extent, west/south/east/north, in
 * degrees. Written on the grid features only; an individual point has no extent
 * to frame.
 *
 * They exist so the map can frame a clicked cell WITHOUT resolving its H3
 * index: the click gives `geovisCafLayers.ts` the feature's properties and
 * nothing else, and deriving the extent there would mean shipping `h3-js` to
 * the browser to turn an index back into a boundary. Four numbers per cell is
 * the cheaper half of that trade — MVT dictionary-encodes both keys and values,
 * so neighbouring cells sharing an edge coordinate store it once.
 *
 * Shared with `geovisCafLayers.ts`, which reads them as the drill-down's target
 * extent.
 */
const BOUNDS_PROPERTIES = {
  west: 'w',
  south: 's',
  east: 'e',
  north: 'n',
} as const;

/**
 * The H3 grids, finest first — the order the roll-up walks. `minZoom`/`maxZoom`
 * are the tile levels each grid is built for; the map layers' visibility bands
 * match them (see `CAF_H3_LEVELS` in `geovisCafLayers.ts`).
 */
const H3_LEVELS = [
  { resolution: 6, minZoom: 9, maxZoom: 9 },
  { resolution: 5, minZoom: 8, maxZoom: 8 },
  { resolution: 4, minZoom: 7, maxZoom: 7 },
  { resolution: 3, minZoom: 5, maxZoom: 6 },
] as const;

/** The finest resolution, the one every point is binned into directly. */
const BASE_RESOLUTION = H3_LEVELS[0].resolution;

/** Zoom window the individual-point pyramid is built for; over-zoomed above it. */
const POINTS_ZOOM = { min: 10, max: 11 };

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
 * What one H3 cell accumulates: how many CAFs fell in it, and the running sums
 * that divide into their weighted centroid. Sums rather than a running mean so
 * a roll-up is a plain addition of two cells.
 */
type Cell = { count: number; sumLng: number; sumLat: number };

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
export const pointFromRow = (
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
 * Rolls a finer grid's cells up into their parent resolution, adding the counts
 * AND the coordinate sums — which is what makes each level's centroid the true
 * weighted mean of its own CAFs.
 *
 * @param params.cells - `cell → accumulator` at the finer resolution.
 * @param params.resolution - The coarser resolution to roll up into.
 * @returns `cell → accumulator` at `resolution`. The totals of the input and the
 * output are equal, which is what keeps every zoom band telling the same story.
 *
 * @example
 * rollUp({
 *   cells: new Map([['86a8100efffffff', { count: 3, sumLng: -120, sumLat: -36 }]]),
 *   resolution: 5,
 * });
 * // Map { '85a8100ffffffff' => { count: 3, sumLng: -120, sumLat: -36 } }
 */
export const rollUp = ({
  cells,
  resolution,
}: {
  cells: Map<string, Cell>;
  resolution: number;
}): Map<string, Cell> => {
  const parents = new Map<string, Cell>();

  for (const [cell, entry] of cells) {
    const key = cellToParent(cell, resolution);
    const parent = parents.get(key);

    if (parent) {
      parent.count += entry.count;
      parent.sumLng += entry.sumLng;
      parent.sumLat += entry.sumLat;
    } else {
      parents.set(key, { ...entry });
    }
  }

  return parents;
};

/**
 * The extent of one H3 cell, west/south/east/north, in degrees.
 *
 * Derived from the cell's own boundary vertices rather than from the CAFs
 * inside it: the drill-down frames the CELL, so a cell whose CAFs all sit in
 * one corner must still open onto the whole hexagon.
 *
 * Brazil is far from the antimeridian, so a plain min/max over the vertices
 * needs no wrap handling.
 *
 * @param cell - The H3 index.
 * @returns Its bounding box in degrees.
 *
 * @example
 * cellBounds('83a810fffffffff'); // { west: -46.5, south: -23.9, east: -45.2, north: -22.8 }
 */
export const cellBounds = (
  cell: string
): { west: number; south: number; east: number; north: number } => {
  const vertices = cellToBoundary(cell);
  const latitudes = vertices.map(([latitude]) => {
    return latitude;
  });
  const longitudes = vertices.map(([, longitude]) => {
    return longitude;
  });

  return {
    west: Number(Math.min(...longitudes).toFixed(COORDINATE_DECIMALS)),
    south: Number(Math.min(...latitudes).toFixed(COORDINATE_DECIMALS)),
    east: Number(Math.max(...longitudes).toFixed(COORDINATE_DECIMALS)),
    north: Number(Math.max(...latitudes).toFixed(COORDINATE_DECIMALS)),
  };
};

/**
 * One cell as a GeoJSON Point feature at the weighted centroid of the CAFs it
 * holds, carrying their count and the cell's own extent.
 *
 * The geometry is the centroid (where the CAFs are) while the extent is the
 * hexagon's (what the cell covers). The two differ, and both are needed: the
 * first is where the circle is drawn, the second is what the map frames when
 * the reader clicks it.
 *
 * @param params.cell - The H3 index, read for its boundary.
 * @param params.entry - The cell's accumulated count and coordinate sums.
 * @returns The feature, as a single line of newline-delimited GeoJSON.
 *
 * @example
 * cellFeature({ cell: '83a810fffffffff', entry: { count: 2, sumLng: -81, sumLat: -24 } });
 * // '{"type":"Feature","properties":{"count":2,"w":-46.5,...},"geometry":{...}}'
 */
export const cellFeature = ({
  cell,
  entry,
}: {
  cell: string;
  entry: Cell;
}): string => {
  const longitude = Number(
    (entry.sumLng / entry.count).toFixed(COORDINATE_DECIMALS)
  );
  const latitude = Number(
    (entry.sumLat / entry.count).toFixed(COORDINATE_DECIMALS)
  );
  const bounds = cellBounds(cell);

  const properties = [
    `"${COUNT_PROPERTY}":${entry.count}`,
    `"${BOUNDS_PROPERTIES.west}":${bounds.west}`,
    `"${BOUNDS_PROPERTIES.south}":${bounds.south}`,
    `"${BOUNDS_PROPERTIES.east}":${bounds.east}`,
    `"${BOUNDS_PROPERTIES.north}":${bounds.north}`,
  ].join(',');

  return `{"type":"Feature","properties":{${properties}},"geometry":{"type":"Point","coordinates":[${longitude},${latitude}]}}\n`;
};

/**
 * Starts a `tippecanoe` reading line-delimited features from its stdin.
 *
 * The grids run with `--no-feature-limit --no-tile-size-limit`: their feature
 * counts are known small (tens per tile), and tippecanoe's default response to
 * an over-budget tile is to DROP features silently, which on an aggregate layer
 * means a circle vanishing with its count. Failing loudly on a fat tile is
 * better than a quietly wrong map.
 *
 * `--drop-densest-as-needed` appears only on the individual points, the one
 * layer where dropping is acceptable — and the one where it will actually bite,
 * since a z10 tile over a dense region carries tens of thousands of them.
 */
const startTippecanoe = ({
  directory,
  layer,
  minZoom,
  maxZoom,
  aggregate,
}: {
  directory: string;
  layer: string;
  minZoom: number;
  maxZoom: number;
  aggregate: boolean;
}) => {
  return spawn(
    'tippecanoe',
    [
      '--output-to-directory',
      directory,
      '--force',
      '--layer',
      layer,
      '--minimum-zoom',
      String(minZoom),
      '--maximum-zoom',
      String(maxZoom),
      ...(aggregate
        ? ['--no-feature-limit', '--no-tile-size-limit']
        : [
            '--drop-densest-as-needed',
            // Promotes `nr_caf` to the tile feature's own id, which is what
            // MapLibre reports on click — a property alone would not reach the
            // click handler.
            `--use-attribute-for-id=${CAF_ID_PROPERTY}`,
          ]),
      '--no-tile-compression',
      // The per-tile percentage counter writes thousands of lines a second,
      // which buries the run's own summary. The tile stats still print.
      '--no-progress-indicator',
      '--attribution',
      'CAF — Cadastro Nacional da Agricultura Familiar (MDA)',
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
};

type Tippecanoe = ReturnType<typeof startTippecanoe>;

/** Resolves when the process exits cleanly; rejects on a non-zero exit. */
const waitFor = (process_: Tippecanoe, label: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    process_.on('error', reject);
    process_.on('close', (code) => {
      return code === 0
        ? resolve()
        : reject(new Error(`[generateCafTiles] ${label} exited ${code}.`));
    });
  });
};

/**
 * Writes one line, waiting for the pipe to drain when the buffer is full.
 * Without the backpressure wait, millions of features queue in memory faster
 * than `tippecanoe` reads them and the process grows until it is killed.
 */
const writeLine = (
  stdin: NonNullable<Tippecanoe['stdin']>,
  line: string
): Promise<void> => {
  if (stdin.write(line)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    stdin.once('drain', resolve);
  });
};

/**
 * Empties a tileset's directory and recreates it.
 *
 * `tippecanoe --force` overwrites the tiles it writes but leaves every other
 * file where it is, so a run with a shallower zoom range — or a different
 * resolution ladder — leaves the previous run's levels behind, and MapLibre
 * happily serves them as if they were current. Purging is what makes the output
 * a function of the input alone.
 *
 * It also creates the parents `--output-to-directory` does not: without them
 * tippecanoe starts writing, then fails partway through the first zoom with
 * `ENOENT` on `public/tiles/<dir>/<z>/<x>/<y>.pbf`.
 */
const resetDirectory = async (directory: string): Promise<void> => {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
};

/** Pipes one resolution's cells into its own tippecanoe run. */
const buildGridTileset = async ({
  cells,
  resolution,
  minZoom,
  maxZoom,
}: {
  cells: Map<string, Cell>;
  resolution: number;
  minZoom: number;
  maxZoom: number;
}): Promise<void> => {
  const directory = join(TILES_DIR, `caf-h3-r${resolution}`);
  await resetDirectory(directory);

  const tippecanoe = startTippecanoe({
    directory,
    layer: H3_TILE_LAYER,
    minZoom,
    maxZoom,
    aggregate: true,
  });
  const { stdin } = tippecanoe;
  if (!stdin) {
    throw new Error('[generateCafTiles] tippecanoe exposed no stdin.');
  }

  const exited = waitFor(tippecanoe, `tippecanoe (r${resolution})`);

  for (const [cell, entry] of cells) {
    await writeLine(stdin, cellFeature({ cell, entry }));
  }

  stdin.end();
  await exited;
};

/**
 * The shape of one grid's count distribution, as percentiles.
 *
 * This is what the colour and radius breaks in `geovisCafLayers.ts` have to be
 * tuned against, and it cannot be reasoned out in advance: the counts are
 * heavily skewed, and the mean per cell does NOT scale with cell area the way
 * the H3 ladder does — a coarse cell absorbs its sparse neighbours, so occupied
 * cells only fall ~4.5× per resolution step rather than the 7× the areas grow.
 *
 * @param cells - One resolution's accumulated cells.
 * @returns A one-line summary, or a note when the grid is empty.
 *
 * @example
 * describeCounts(new Map([['a', { count: 3, sumLng: 0, sumLat: 0 }]]));
 * // 'p50 3, p75 3, p90 3, p98 3, max 3'
 */
export const describeCounts = (cells: Map<string, Cell>): string => {
  const counts = [...cells.values()]
    .map((cell) => {
      return cell.count;
    })
    .sort((a, b) => {
      return a - b;
    });

  if (counts.length === 0) {
    return 'no cells';
  }

  const at = (quantile: number): number => {
    const index = Math.min(
      counts.length - 1,
      Math.floor(quantile * counts.length)
    );
    return counts[index] as number;
  };

  return `p50 ${at(0.5)}, p75 ${at(0.75)}, p90 ${at(0.9)}, p98 ${at(0.98)}, max ${counts[counts.length - 1]}`;
};

/** What one pass over the CSV produced, and what it had to skip. */
type Pass = {
  /** `H3 cell → accumulator` at {@link BASE_RESOLUTION}. */
  cells: Map<string, Cell>;
  rows: number;
  counted: number;
  secondary: number;
  badCoordinates: number;
};

/**
 * Streams the CSV once, binning every usable CAF into an H3 cell at
 * {@link BASE_RESOLUTION} and — when a point pyramid is being built — piping the
 * coordinate straight through to its `tippecanoe`.
 *
 * One pass rather than one per output: the file is 426 MB, and every level has
 * to be derived from exactly the same set of rows or the map contradicts itself
 * between zooms.
 *
 * @param params.inputPath - The CSV to read.
 * @param params.points - The point-tile process to feed, or `null` to skip it.
 * @returns The base grid's cells and the row tallies the run reports.
 * @throws If the header does not match {@link EXPECTED_HEADER}.
 */
const readCsv = async ({
  inputPath,
  points,
}: {
  inputPath: string;
  points: Tippecanoe | null;
}): Promise<Pass> => {
  const lines = createInterface({
    input: createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const cells = new Map<string, Cell>();
  let isHeader = true;
  let rows = 0;
  let counted = 0;
  let secondary = 0;
  let badCoordinates = 0;

  for await (const rawLine of lines) {
    // A trailing empty line (or a spurious blank) carries no record.
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
    const key = latLngToCell(latitude, longitude, BASE_RESOLUTION);
    const cell = cells.get(key);

    if (cell) {
      cell.count += 1;
      cell.sumLng += longitude;
      cell.sumLat += latitude;
    } else {
      cells.set(key, { count: 1, sumLng: longitude, sumLat: latitude });
    }

    if (points?.stdin) {
      await writeLine(
        points.stdin,
        `{"type":"Feature","properties":{"${COUNT_PROPERTY}":1,"${CAF_ID_PROPERTY}":${result.nrCaf}},"geometry":{"type":"Point","coordinates":[${longitude},${latitude}]}}\n`
      );
    }
  }

  return { cells, rows, counted, secondary, badCoordinates };
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const withPoints = !args.includes('--no-points');
  const inputPath =
    args.find((arg) => {
      return !arg.startsWith('--');
    }) ?? DEFAULT_INPUT_PATH;

  await mkdir(TILES_DIR, { recursive: true });

  const pointsDirectory = join(TILES_DIR, 'cafs');
  if (withPoints) {
    await resetDirectory(pointsDirectory);
  }

  const points = withPoints
    ? startTippecanoe({
        directory: pointsDirectory,
        layer: POINTS_TILE_LAYER,
        minZoom: POINTS_ZOOM.min,
        maxZoom: POINTS_ZOOM.max,
        aggregate: false,
      })
    : null;
  const pointsExited = points
    ? waitFor(points, 'tippecanoe (points)')
    : Promise.resolve();

  const pass = await readCsv({ inputPath, points });

  points?.stdin?.end();
  await pointsExited;

  const occupied: string[] = [];
  let cells = pass.cells;

  for (const level of H3_LEVELS) {
    cells =
      level.resolution === BASE_RESOLUTION
        ? cells
        : rollUp({ cells, resolution: level.resolution });

    await buildGridTileset({
      cells,
      resolution: level.resolution,
      minZoom: level.minZoom,
      maxZoom: level.maxZoom,
    });

    occupied.push(
      `r${level.resolution}: ${cells.size} cells — ${describeCounts(cells)}`
    );
  }

  process.stderr.write(
    [
      `[generateCafTiles] read ${pass.rows} rows from ${inputPath}`,
      `CAFs counted: ${pass.counted}`,
      `skipped — secondary areas: ${pass.secondary}, unusable coordinates: ${pass.badCoordinates}`,
      'occupied cells and their count distribution — tune the breaks in',
      '`geovisCafLayers.ts` against these:',
      ...occupied,
      `grid tiles: ${TILES_DIR}/caf-h3-r{3,4,5,6} (layer "${H3_TILE_LAYER}")`,
      withPoints
        ? `point tiles: ${TILES_DIR}/cafs (z${POINTS_ZOOM.min}–z${POINTS_ZOOM.max}, layer "${POINTS_TILE_LAYER}")`
        : 'point tiles: not rebuilt (--no-points)',
      '',
    ].join('\n')
  );
};

await main();

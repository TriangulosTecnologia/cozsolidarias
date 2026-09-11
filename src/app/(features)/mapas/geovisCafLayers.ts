import type {
  DataSource,
  HoverTooltipConfig,
  LegendSpec,
  MapDataRow,
  SymbolPaint,
  VectorTileSource,
  VisualizationLayer,
} from '@ttoss/geovis';

import type { CafUfFeatureCollection } from '@/data-gateway/schema';

import { TOOLTIP_STYLE } from './mapaTooltipStyle';

/* -------------------------------------------------------------------------- *
 * The CAF zoom hierarchy: UF → H3 grid → individual points.
 *
 * ~3.9M CAFs cannot be drawn, and they cannot be summarised one way either: a
 * country view needs 27 numbers, everything between that and the properties
 * themselves needs a *spatial* aggregation whose grain follows the zoom.
 *
 *   zoom      level        source                       marks on screen
 *   ------    ---------    -------------------------    ---------------
 *   0–5       UF           GeoJSON, 27 features         27
 *   5–10      H3 grid      vector tiles, r3 → r6        ~100–500
 *   10+       CAF points   vector tiles, ~3.2M points   the properties
 *
 * The grid is what an administrative level cannot be: because the cell size
 * follows the zoom, the number of marks on screen stays roughly constant all
 * the way down. One circle per município would put all 5,518 on screen at once
 * whatever the zoom — which is exactly how that level read: cluttered.
 *
 * Dropping it costs nothing a reader can ask for. The município fill still
 * paints underneath at every zoom, and its hover still answers "Feira de
 * Santana — 8.412 CAFs"; only the redundant circle is gone.
 *
 * Every aggregate circle carries its count, at every level. Only the individual
 * CAFs at the deep end do not: each stands for exactly one property, and a map
 * of dots all labelled `1` says nothing the dot did not already say.
 *
 * Each grid cell is drawn as a CIRCLE at the weighted centroid of the CAFs
 * inside it — not as a hexagon, and not at the cell's own centre. Drawn at the
 * centre it would read as a regular lattice of dots, an artefact of the
 * method rather than a picture of the data; at the weighted centroid the mesh
 * disappears and the distribution is what shows. The H3 cell stays what it
 * always was — a deterministic bin whose counts are exact and reproducible.
 *
 * The bands do not overlap: `minzoom`/`maxzoom` cut each layer off where the
 * next takes over. A cross-fade would need `circleOpacity` to accept a zoom
 * expression, which the geovis paint types declare as `number`.
 *
 * The counts do not all come from the same place, and cannot: the UF level
 * counts by `cd_municipio`, so it includes CAFs whose coordinates are unusable,
 * while the grid and the points can only carry CAFs that have a position (~20%
 * fewer). Documented in `scripts/generateCafTiles.ts`.
 * -------------------------------------------------------------------------- */

/** GeoJSON source of the 27 UF anchors; also the id its `mapData` join targets. */
export const CAF_UFS_SOURCE_ID = 'caf-ufs';

/** The join behind the UF level: promotes `nome` and carries the UF's total. */
export const CAF_UFS_MAP_DATA_ID = 'caf-ufs-data';

/** Vector-tile source of the individual CAF points. */
const CAF_POINTS_SOURCE_ID = 'cafs';

/** Layer id of the individual CAF points. */
const CAF_POINTS_LAYER_ID = 'cafs-pts';

const CAF_UF_LAYER_ID = 'cafs-uf';
const CAF_UF_LABELS_LAYER_ID = 'cafs-uf-labels';

/**
 * Feature property carrying the CAF count on the UF level. Written by
 * `toCafUfPontos` in the gateway.
 */
const CAF_QUANTIDADE_PROPERTY = 'quantidade';

/**
 * Feature property carrying the CAF count on the two tiled levels — the cell's
 * total on a grid circle, `1` on an individual point. Written by
 * `scripts/generateCafTiles.ts`, so the name is a contract between the two
 * files (a Node script cannot import from here without pulling geovis in).
 */
const CAF_TILE_COUNT_PROPERTY = 'count';

/** Layer name inside the grid tiles; must match `H3_TILE_LAYER` in the generator. */
const CAF_H3_TILE_LAYER = 'caf-h3';

/** Layer name inside the point tiles; must match `POINTS_TILE_LAYER` there. */
const CAF_POINTS_TILE_LAYER = 'cafs';

/** The CAF green of the kitchen palette, and the ivory the map halos with. */
const CAF_GREEN = '#2F6F4E';
const CAF_HALO = '#FAF9F7';
const CAF_LABEL_HALO = '#1B4632';

/**
 * Fewest CAFs a cell needs before it is drawn as an aggregate. Below it there is
 * only one, and it is drawn as itself.
 */
const CAF_AGGREGATE_MINIMUM = 2;

/**
 * How a single CAF is painted, wherever it appears — inside the grid's zooms as
 * a cell of one, and from {@link CAF_POINTS_MIN_ZOOM} as one of the millions in
 * the point tiles. One shape and one colour, so the same thing looks the same at
 * every zoom.
 *
 * `circleStrokeWidth: 0` is explicit because the adapter's default is a 1px
 * white ring. On a few thousand points a ring separates each one from the
 * basemap; on millions it is the ring that merges, turning a dense region pale
 * exactly where it should read darkest.
 */
const CAF_POINT_PAINT = {
  circleColor: CAF_GREEN,
  circleRadius: 4,
  circleStrokeWidth: 0,
};

/**
 * Opacity carried ONLY by the tiled points, and the one place on this map where
 * translucency earns its keep: a cell's circle never overlaps its neighbour, but
 * millions of individual dots overlap constantly, and letting them accumulate is
 * what turns a crowded município into a visibly darker mass instead of a flat
 * patch of green.
 *
 * The lone-CAF dots inside the grid stay opaque for the same reason the
 * aggregates do — there is one per cell, so there is nothing to accumulate.
 */
const CAF_POINT_OPACITY = 0.9;

/** Zoom the UF circles hand over to the coarsest grid. */
const CAF_UF_MAX_ZOOM = 5;

/**
 * Zoom the finest grid hands over to the individual CAFs. Two levels earlier
 * than the grid could have carried on to — reaching the properties themselves
 * is the point of drilling in, and every zoom spent on one more aggregation is
 * a zoom the reader spends not getting there.
 */
const CAF_POINTS_MIN_ZOOM = 10;

/**
 * Tile zooms the point pyramid is built for. It starts at
 * {@link CAF_POINTS_MIN_ZOOM} because a tiled source renders nothing below its
 * own `minzoom`; above z11 MapLibre over-zooms, which is lossless for points —
 * their geometry scales exactly.
 */
const CAF_POINTS_TILE_ZOOMS = { minzoom: 10, maxzoom: 11 };

/**
 * The H3 grids, coarsest first — the order they are drawn and handed over in.
 *
 * `tiles` is the zoom window the generator built each grid for, and so the
 * source's own; `display` is the band its layer is visible in, which runs one
 * zoom past the last tile level because MapLibre over-zooms the deepest tile
 * rather than blanking.
 *
 * The resolutions target a cell about 60–80 px across, which is what keeps the
 * mark count on screen flat as the reader descends:
 *
 * | zoom | H3 | cell across | cells with CAFs |
 * |------|----|-------------|-----------------|
 * | 5–6  | r3 | ~120 km     | 1.129           |
 * | 7    | r4 | ~45 km      | 5.498           |
 * | 8    | r5 | ~17 km      | 25.473          |
 * | 9    | r6 | ~6,5 km     | 111.496         |
 *
 * `breaks` are the four ascending count bands the COLOURS step through — the
 * radius is not theirs, it comes from the map-wide {@link CAF_COUNT_LADDER}.
 * The two encode different things on purpose: size says how many CAFs, and is
 * comparable across every zoom; colour says how dense this cell is next to its
 * neighbours *at this zoom*, which is what makes the structure inside a level
 * visible at all. They are MEASURED, not derived: each level's are the
 * p75, p90 and p98 of that grid's own count distribution, as reported by
 * `scripts/generateCafTiles.ts` over the full snapshot —
 *
 * | H3 | cells   | p50 | p75   | p90   | p98    | max    |
 * |----|---------|-----|-------|-------|--------|--------|
 * | r3 | 1.129   | 120 | 1.804 | 8.503 | 28.277 | 63.430 |
 * | r4 | 5.498   | 61  | 433   | 1.738 | 5.159  | 25.381 |
 * | r5 | 25.473  | 22  | 113   | 358   | 961    | 23.563 |
 * | r6 | 111.496 | 7   | 28    | 76    | 198    | 23.314 |
 *
 * — so three quarters of the cells at every zoom read as the small pale dot
 * that is the sparse background, and the top 2% as the dark one.
 *
 * The first break is 2 rather than 1 because a cell holding a single CAF is not
 * an aggregate of anything: {@link buildCafGridLayers} draws it as that CAF.
 *
 * Scaling them by cell area instead is what the first attempt did, and it was
 * wrong by a factor of six at r3: occupied cells only fall ~4.5× per resolution
 * step while area grows 7×, because a coarse cell absorbs its empty neighbours
 * rather than accumulating a proportional share of CAFs. Re-measure after any
 * snapshot update; the generator prints these percentiles on every run.
 */
const CAF_H3_LEVELS = [
  {
    resolution: 3,
    tiles: { minzoom: 5, maxzoom: 6 },
    display: { minzoom: 5, maxzoom: 7 },
    breaks: [2, 1_800, 8_500, 28_000],
  },
  {
    resolution: 4,
    tiles: { minzoom: 7, maxzoom: 7 },
    display: { minzoom: 7, maxzoom: 8 },
    breaks: [2, 400, 1_750, 5_000],
  },
  {
    resolution: 5,
    tiles: { minzoom: 8, maxzoom: 8 },
    display: { minzoom: 8, maxzoom: 9 },
    breaks: [2, 100, 350, 1_000],
  },
  {
    resolution: 6,
    tiles: { minzoom: 9, maxzoom: 9 },
    display: { minzoom: 9, maxzoom: CAF_POINTS_MIN_ZOOM },
    breaks: [2, 30, 75, 200],
  },
] as const;

/**
 * The four density colours the grid circles step through, light to dark over
 * the kitchen palette's CAF green, so a denser cell reads heavier.
 *
 * Painted at full opacity: one circle per cell means the aggregate levels never
 * overlap, so translucency bought nothing and only lifted every band toward the
 * basemap — the four steps read as themselves now.
 *
 * The lightest band is the one that sets the map's tone, not an edge case:
 * three quarters of the cells fall in it. A near-white green there washed the
 * whole grid out against the pale basemap and left the ivory count sitting on
 * almost no contrast, so the ramp starts at the palette's own light green
 * instead — every step is a colour the map already uses elsewhere.
 */
const CAF_DENSITY_COLORS = [
  '#9CC7B0',
  '#5FA37F',
  '#2F6F4E',
  '#1B4632',
] as const;

/** Id of the CAF hierarchy's legend. */
export const CAF_LEGEND_ID = 'legenda-cafs';

/**
 * What each density colour is called.
 *
 * Qualitative on purpose: the count behind a band is not fixed. Each grid
 * resolution carries its own `breaks` (a dark cell is 28,000 CAFs at r3 and 200
 * at r6) precisely so the colour keeps meaning "how dense this cell is for a
 * cell of this size" as the reader zooms. Printing one of those four ladders
 * would be right at one zoom and wrong at the other three.
 */
const CAF_DENSITY_LABELS = ['Baixa', 'Média', 'Alta', 'Muito alta'] as const;

/**
 * The CAF mode's legend: the four density colours of the grid circles.
 *
 * Explanatory rather than data-driven — no layer carries it as
 * `activeLegendId`, because the bands are painted by four static-coloured
 * layers with one-sided filters, not by a `colorBy` join a tiled source cannot
 * feed. `geovis` renders any legend that carries a `position`, which is what
 * puts this one on screen for its own mode and keeps it off every other.
 *
 * Size is left to the subtitle. The circles are sized by a `stepped` ladder,
 * and `GeoVisLegend`'s circle swatches only render for the `sqrt` transform
 * with a `scaleMaxValue` — drawing a size key here would mean hand-rolling
 * circles that could drift from the ladder that actually sizes them.
 *
 * @param active - Whether the CAF mode is the active one.
 * @returns The CAF {@link LegendSpec}.
 *
 * @example
 * buildCafLegend(true).position; // 'bottom-right'
 * buildCafLegend(false).position; // undefined
 */
export const buildCafLegend = (active: boolean): LegendSpec => {
  return {
    id: CAF_LEGEND_ID,
    title: 'Agricultura familiar (CAF)',
    subtitle:
      'Cada círculo reúne os CAFs de uma célula da grade e traz o total: o tamanho cresce com a quantidade, e a cor, com a concentração. As faixas de cor acompanham o tamanho da célula, que diminui conforme você aproxima; de perto, cada ponto é um CAF.',
    icon: 'lucide:tractor',
    iconColor: CAF_GREEN,
    ...(active ? { position: 'bottom-right' as const, offset: 12 } : {}),
    colorBy: {
      type: 'categorical',
      property: 'value',
      mapping: Object.fromEntries(
        CAF_DENSITY_LABELS.map((label, band) => {
          return [label, CAF_DENSITY_COLORS[band]];
        })
      ),
      defaultColor: CAF_GREEN,
    },
    reference:
      'Fonte dos dados: Cadastro Nacional da Agricultura Familiar (CAF)',
  };
};

/**
 * The one count ladder every circle on the map is sized by — the UF anchors and
 * all four grids alike.
 *
 * It has to be ONE ladder, on the ABSOLUTE count, for the hierarchy to hold
 * together visually. Sizing each level by its own percentiles (which is what
 * the colours still do, and what this used to do) makes the top band the
 * largest circle at every resolution: 28.000 CAFs at r3 and 5.000 at r4 drew
 * the same 26px dot, so zooming in RE-INFLATED the pieces a cell broke into. A
 * shared ladder makes the map's central promise true instead — a cell's
 * children always sum to it, so each child's count is at most its parent's, and
 * a step function on the count can therefore never grow on the way down.
 *
 * The steps are decade-spaced (3, 10, 30, 100 …) and the radii are spread
 * linearly across them, which is a log scale in disguise: it has to cover four
 * orders of magnitude — a lone pair of CAFs in a r6 cell and Bahia's 704.034 —
 * and a linear or sqrt scale over that range leaves every grid cell at the
 * floor, indistinguishable.
 *
 * The floor is 7 rather than 4 because every aggregate circle carries its count,
 * and a digit does not sit inside a 4px dot — it spills over the edge and reads
 * as a number floating on the map rather than as that circle's number. It
 * cannot be sized to fit every string: the widest (`704 mil`) overflows the
 * smaller dots a little, which the halo carries.
 */
const CAF_COUNT_LADDER = [
  3, 10, 30, 100, 300, 1_000, 3_000, 10_000, 30_000, 100_000, 300_000,
];

const CAF_SIZE: NonNullable<VisualizationLayer['sizeBy']> = {
  mode: 'stepped',
  range: [7, 34],
  thresholds: CAF_COUNT_LADDER,
};

/** Text size range across {@link CAF_COUNT_LADDER}'s classes. */
const CAF_LABEL_TEXT_RANGE: [number, number] = [11, 18];

/** Id of the circle layer for one grid resolution's `n`-th count band. */
const cafH3LayerId = ({
  resolution,
  band,
}: {
  resolution: number;
  band: number;
}): string => {
  return `cafs-h3-r${resolution}-b${band}`;
};

/**
 * Id of the layer that draws the cells holding a single CAF as that CAF.
 */
const cafH3SinglesLayerId = (resolution: number): string => {
  return `cafs-h3-r${resolution}-single`;
};

/** Id of the label layer drawn over one grid resolution's circles. */
const cafH3LabelLayerId = (resolution: number): string => {
  return `cafs-h3-r${resolution}-labels`;
};

/** Id of the vector-tile source for one grid resolution. */
const cafH3SourceId = (resolution: number): string => {
  return `caf-h3-r${resolution}`;
};

/**
 * Every layer the CAF hierarchy draws, bottom to top — the order
 * `buildCafsLayers` returns them. Exported so `useMapaSpec` can keep them above
 * the município/estado outlines it appends: every one of them is now a mark a
 * reader looks *at*, so none should hide behind a boundary line.
 */
export const CAFS_LAYER_IDS: string[] = [
  ...CAF_H3_LEVELS.flatMap((level) => {
    return [
      cafH3SinglesLayerId(level.resolution),
      ...CAF_DENSITY_COLORS.map((_color, band) => {
        return cafH3LayerId({ resolution: level.resolution, band });
      }),
      cafH3LabelLayerId(level.resolution),
    ];
  }),
  CAF_POINTS_LAYER_ID,
  CAF_UF_LAYER_ID,
  CAF_UF_LABELS_LAYER_ID,
];

/**
 * What marks a layer as answering to a click, and nothing more.
 *
 * Deliberately empty. geovis draws the pointer cursor for every layer carrying a
 * `click` (`buildPointerLayerIds`), while only an `onSelect` INSIDE it registers
 * geovis's own click path. The CAF hierarchy wants the first and not the second:
 * the drill-down has to read the clicked cell's extent, which lives in the tile
 * feature's properties and which `onSelect` does not carry — so the reaction
 * lives in `useCafDrilldown`, over the native map, and this declares only the
 * affordance.
 *
 * The cursor cannot be set from there instead. `useMapHover` is mounted by
 * `<GeoVisProvider>`, a parent of the `map` slot, so its global `mousemove`
 * listener is registered after the panel's and overwrites whatever the panel
 * wrote — every move ends on geovis's `default`.
 */
const CAF_DRILLABLE = {} as const;

/**
 * Feature properties each grid cell carries with its own hexagon's extent, in
 * degrees. Written by `scripts/generateCafTiles.ts` — this is the client half of
 * that contract, and the names are single letters because they travel in every
 * tile.
 *
 * The cell's geometry is the weighted centroid of its CAFs, not the hexagon, so
 * these are the only way the map knows what the cell actually covers.
 */
export const CAF_CELL_BOUNDS_PROPERTIES = {
  west: 'w',
  south: 's',
  east: 'e',
  north: 'n',
} as const;

/**
 * Where a click on each drillable layer takes the camera: the zoom at which the
 * clicked mark hands over to the level below it.
 *
 * The values are not chosen here — every one of them is a `display.maxzoom`
 * already declared in {@link CAF_H3_LEVELS} (and {@link CAF_UF_MAX_ZOOM} for the
 * UF anchors), which is exactly the zoom where the mark stops being drawn and
 * its children start. That is what makes the interaction's promise literal: the
 * camera lands on the first zoom where the thing you clicked has become several
 * smaller things.
 *
 * Only the aggregate bands are listed. A cell holding a single CAF is not an
 * aggregate of anything (`cafH3SinglesLayerId`), the labels sit above the
 * circles and must let the click through to them, and an individual CAF is the
 * end of the hierarchy — none of the three drills.
 *
 * @example
 * CAF_DRILL_ZOOM_BY_LAYER['cafs-h3-r3-b2']; // 7 — where r4 takes over
 * CAF_DRILL_ZOOM_BY_LAYER['cafs-uf']; // 5 — where the r3 grid takes over
 */
export const CAF_DRILL_ZOOM_BY_LAYER: Record<string, number> = {
  [CAF_UF_LAYER_ID]: CAF_UF_MAX_ZOOM,
  ...Object.fromEntries(
    CAF_H3_LEVELS.flatMap((level) => {
      return CAF_DENSITY_COLORS.map((_color, band) => {
        return [
          cafH3LayerId({ resolution: level.resolution, band }),
          level.display.maxzoom,
        ];
      });
    })
  ),
};

/**
 * A count, formatted compactly in pt-BR: `2,1 mi` from a million, `134 mil`
 * from ten thousand, exact grouped digits below it (`5.480`, `450`).
 *
 * An expression rather than the `{quantidade}` token because the raw number
 * does not fit: a UF reads 712.480 and seven digits cannot sit inside a 38px
 * circle at any legible size.
 *
 * `paint.textField` reaches `text-field` verbatim and the spec's schema
 * declares `layer.paint` as `additionalProperties: true`, so the expression
 * both validates and evaluates; the geovis patch only widens the declared type,
 * which was narrower than what the adapter already passed through.
 *
 * `number-format` carries the locale, so the separators are the Brazilian ones
 * (`2,1`, `5.480`) — MapLibre has no string-replace to fix them after the fact.
 *
 * The thousands branch ROUNDS the division instead of asking the formatter for
 * zero decimals, because `max-fraction-digits: 0` cannot be expressed: MapLibre
 * reads that option under `if (options['max-fraction-digits'])`, a truthiness
 * check, so a zero is dropped and `Intl`'s own default of three decimals comes
 * back — which is how `33675` printed as `33,675 mil`. The millions branch is
 * safe from it, `1` being truthy.
 *
 * Its threshold is `999_500` rather than a round million for the same reason:
 * that is where the branch below would round to `1.000 mil`.
 */
const compactCountTextField = (
  property: string
): NonNullable<SymbolPaint['textField']> => {
  return [
    'case',
    ['>=', ['get', property], 999_500],
    [
      'concat',
      [
        'number-format',
        ['/', ['get', property], 1_000_000],
        { locale: 'pt-BR', 'max-fraction-digits': 1 },
      ],
      ' mi',
    ],
    ['>=', ['get', property], 10_000],
    [
      'concat',
      [
        'number-format',
        ['round', ['/', ['get', property], 1_000]],
        { locale: 'pt-BR' },
      ],
      ' mil',
    ],
    ['number-format', ['get', property], { locale: 'pt-BR' }],
  ];
};

/**
 * Text size stepped on {@link CAF_COUNT_LADDER}, the same ladder the radius
 * steps on, so the label grows with the circle that holds it and never outgrows
 * it — 11px in the smallest class up to 18px in the largest.
 */
const countTextSize = (
  property: string
): NonNullable<SymbolPaint['textSize']> => {
  const [min, max] = CAF_LABEL_TEXT_RANGE;
  const step = (max - min) / CAF_COUNT_LADDER.length;

  return [
    'step',
    ['get', property],
    min,
    ...CAF_COUNT_LADDER.flatMap((threshold, index) => {
      return [threshold, Number((min + (index + 1) * step).toFixed(1))];
    }),
  ];
};

/**
 * The label paint shared by every level: the count, compacted, in ivory over a
 * dark green halo so it reads on the palest circle as well as the darkest.
 *
 * @param property - Feature property holding the count.
 * @returns The `symbol` layer's paint.
 *
 * @example
 * cafLabelPaint('count');
 */
const cafLabelPaint = (property: string): SymbolPaint => {
  return {
    // The fontstack is not set here — `SymbolPaint` has no `textFont` — and
    // MapLibre's own default (`Open Sans Regular`, `Arial Unicode MS Regular`)
    // is served by neither OpenFreeMap fontstack, so the glyph requests 404 and
    // no digit is rasterized. The geovis patch defaults the adapter to
    // `Noto Sans Regular`, which the basemap does serve.
    textField: compactCountTextField(property),
    textSize: countTextSize(property),
    textColor: CAF_HALO,
    textHaloColor: CAF_LABEL_HALO,
    // 1.5 rather than 1: the ivory digits sit on four different greens, and on
    // the lightest of them the halo is what carries the contrast.
    textHaloWidth: 1.5,
  };
};

/**
 * The sources the `cafs` mode adds: the UF anchors and five tile pyramids.
 *
 * The tile templates are made ABSOLUTE, unlike the GeoJSON path beside them.
 * MapLibre fetches vector tiles from a worker, and a relative URL has no base
 * to resolve against there — `new Request('/tiles/…')` throws "Failed to parse
 * URL from /tiles/…" and the layer stays empty. The GeoJSON source gets away
 * with a relative path because it is fetched on the main thread.
 *
 * On the server the origin is unknown, and so is left empty: `buildSpec` runs
 * during SSR, where there is no map to feed either. Moving the tiles to a CDN
 * later means changing this one base.
 *
 * The UF level is handed the app's already-fetched FeatureCollection when there
 * is one, so the 27 anchors are not requested twice — the app needs them in
 * memory anyway to drive the hover join.
 *
 * @param cafPontosPorUf - The UF anchors held by the app, if loaded.
 * @returns The `cafs` mode's sources.
 *
 * @example
 * buildCafsSources(); // [uf geojson, 4 grid pyramids, point pyramid]
 */
export const buildCafsSources = (
  cafPontosPorUf?: CafUfFeatureCollection
): DataSource[] => {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const grids: VectorTileSource[] = CAF_H3_LEVELS.map((level) => {
    return {
      id: cafH3SourceId(level.resolution),
      type: 'vector-tiles',
      tiles: [`${origin}/tiles/caf-h3-r${level.resolution}/{z}/{x}/{y}.pbf`],
      minzoom: level.tiles.minzoom,
      maxzoom: level.tiles.maxzoom,
      attribution: '© CAF / MDA',
    };
  });

  return [
    {
      id: CAF_UFS_SOURCE_ID,
      type: 'geojson',
      data: cafPontosPorUf ?? '/api/cafs/pontos-por-uf',
      attribution: '© CAF / MDA',
    },
    ...grids,
    {
      id: CAF_POINTS_SOURCE_ID,
      type: 'vector-tiles',
      tiles: [`${origin}/tiles/cafs/{z}/{x}/{y}.pbf`],
      ...CAF_POINTS_TILE_ZOOMS,
      attribution: '© CAF / MDA',
    },
  ];
};

/**
 * The circle layers for one grid resolution: one per count band, stacked
 * ascending so the topmost match wins.
 *
 * A single layer with a colour ramp is not expressible here. geovis drives
 * circle colour from `mapData` feature-state, which a tiled source cannot join,
 * and a `LayerFilter` holds one predicate — so neither a ramp on `count` nor a
 * closed range like `25 <= count < 150` can be declared. One-sided `gte` filters
 * in ascending order can, and produce the same picture.
 *
 * Every band carries the same `sizeBy`, so a circle keeps its radius no matter
 * which band ends up drawing it; `propertyName` without `mapDataId` is what
 * compiles that radius to `['get', 'count']` instead of the feature-state path
 * a tiled source has no way to fill.
 *
 * A cell holding ONE CAF is not drawn as an aggregate at all. Its weighted
 * centroid is that CAF's own coordinate — the mean of a single point is the
 * point — so it is drawn as the individual dot it is, with no count over it: a
 * circle labelled `1` claims to summarise something, and there is nothing to
 * summarise. This is also why the deepest grid still shows lone properties long
 * before z10, where the point tiles take over for the crowded places.
 *
 * A label layer is stacked on top of the aggregates, so every circle that does
 * stand for several CAFs states how many. It is drawn from the cell centroid, which is a point and so lands
 * in exactly one tile — a hexagon would have been clipped into both and its
 * number drawn twice. Where the dots crowd, MapLibre's own collision detection
 * hides the labels that would overlap, so a dense region thins itself out
 * instead of turning into a wall of digits.
 */
const buildCafGridLayers = (
  level: (typeof CAF_H3_LEVELS)[number]
): VisualizationLayer[] => {
  const bands: VisualizationLayer[] = CAF_DENSITY_COLORS.map((color, band) => {
    return {
      id: cafH3LayerId({ resolution: level.resolution, band }),
      sourceId: cafH3SourceId(level.resolution),
      // Addresses the features inside the tile; the source carries no fallback.
      sourceLayer: CAF_H3_TILE_LAYER,
      geometry: 'point',
      minzoom: level.display.minzoom,
      maxzoom: level.display.maxzoom,
      propertyName: CAF_TILE_COUNT_PROPERTY,
      sizeBy: CAF_SIZE,
      filter: {
        property: CAF_TILE_COUNT_PROPERTY,
        operator: 'gte',
        value: level.breaks[band],
      },
      click: CAF_DRILLABLE,
      paint: {
        circleColor: color,
        circleStrokeColor: CAF_HALO,
        circleStrokeWidth: 0.8,
      },
    };
  });

  return [
    {
      id: cafH3SinglesLayerId(level.resolution),
      sourceId: cafH3SourceId(level.resolution),
      sourceLayer: CAF_H3_TILE_LAYER,
      geometry: 'point',
      minzoom: level.display.minzoom,
      maxzoom: level.display.maxzoom,
      // `lt 2` rather than `eq 1`: same set, and it keeps this filter the exact
      // complement of the first band's `gte 2`, so no count can fall through
      // both or match neither.
      filter: {
        property: CAF_TILE_COUNT_PROPERTY,
        operator: 'lt',
        value: CAF_AGGREGATE_MINIMUM,
      },
      paint: CAF_POINT_PAINT,
    },
    ...bands,
    {
      id: cafH3LabelLayerId(level.resolution),
      sourceId: cafH3SourceId(level.resolution),
      sourceLayer: CAF_H3_TILE_LAYER,
      geometry: 'symbol',
      minzoom: level.display.minzoom,
      maxzoom: level.display.maxzoom,
      filter: {
        property: CAF_TILE_COUNT_PROPERTY,
        operator: 'gte',
        value: CAF_AGGREGATE_MINIMUM,
      },
      paint: cafLabelPaint(CAF_TILE_COUNT_PROPERTY),
    },
  ];
};

/**
 * Every layer the CAF hierarchy draws, bottom to top: the grids, the individual
 * points, then the UF circles with their labels.
 *
 * Only one band is ever visible — the `minzoom`/`maxzoom` windows partition the
 * zoom range — so the stacking order only decides what wins at a shared edge,
 * where the UF circles should.
 *
 * The UF layer carries the mode's only hover card. It needs `mapDataId` for it:
 * the join both promotes each feature's `nome` to the MapLibre `feature.id`
 * (without it the hover reports `0`) and supplies the count as the hover value.
 * That same join is what drives the circle radius, which is why the layer reads
 * its size from feature-state while the label — a layout property, where
 * feature-state expressions are not allowed — reads `quantidade` off the
 * feature. Both numbers come from `toCafUfPontos`, so they cannot disagree.
 *
 */
export const buildCafsLayers = (
  ufHoverRender?: HoverTooltipConfig['render']
): VisualizationLayer[] => {
  return [
    ...CAF_H3_LEVELS.flatMap((level) => {
      return buildCafGridLayers(level);
    }),
    {
      id: CAF_POINTS_LAYER_ID,
      sourceId: CAF_POINTS_SOURCE_ID,
      sourceLayer: CAF_POINTS_TILE_LAYER,
      geometry: 'point',
      minzoom: CAF_POINTS_MIN_ZOOM,
      paint: { ...CAF_POINT_PAINT, circleOpacity: CAF_POINT_OPACITY },
      // No `click`/`clickAnchor`: the points are not clickable, since there is
      // no per-registration detail to open. The tiles still carry `nr_caf` as
      // each feature's id (`--use-attribute-for-id`), so adding a detail later
      // only needs the two fields back.
    },
    {
      id: CAF_UF_LAYER_ID,
      sourceId: CAF_UFS_SOURCE_ID,
      geometry: 'point',
      mapDataId: CAF_UFS_MAP_DATA_ID,
      maxzoom: CAF_UF_MAX_ZOOM,
      sizeBy: CAF_SIZE,
      click: CAF_DRILLABLE,
      paint: {
        circleColor: CAF_GREEN,
        circleStrokeColor: CAF_HALO,
        circleStrokeWidth: 1.5,
      },
      ...(ufHoverRender
        ? { hoverTooltip: { render: ufHoverRender, style: TOOLTIP_STYLE } }
        : {}),
    },
    {
      id: CAF_UF_LABELS_LAYER_ID,
      sourceId: CAF_UFS_SOURCE_ID,
      geometry: 'symbol',
      maxzoom: CAF_UF_MAX_ZOOM,
      paint: cafLabelPaint(CAF_QUANTIDADE_PROPERTY),
    },
  ];
};

/**
 * The `mapData` join behind the UF level: it promotes each anchor's `nome` to
 * the MapLibre `feature.id` and carries the UF's CAF total as the hover value.
 *
 * The rows are read off the FeatureCollection the app fetched rather than
 * re-derived from the município rows, so the number in the hover card and the
 * number on the label are literally the same value.
 *
 * @param cafPontosPorUf - The UF anchors held by the app, if loaded.
 * @returns One row per UF; empty before the anchors arrive, which still sets
 * the promotion.
 *
 * @example
 * toCafUfRows({ type: 'FeatureCollection', features: [{ properties: { nome: 'Bahia', quantidade: 712480 } }] });
 * // [{ geometryId: 'Bahia', value: 712480 }]
 */
export const toCafUfRows = (
  cafPontosPorUf?: CafUfFeatureCollection
): MapDataRow[] => {
  return (cafPontosPorUf?.features ?? []).map((feature) => {
    return {
      geometryId: feature.properties.nome,
      value: feature.properties.quantidade,
    };
  });
};

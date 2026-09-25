'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Box } from '@chakra-ui/react';
import {
  GeovisWorkspace,
  type GeovisWorkspaceConfig,
  type GeovisWorkspaceSelection,
  getInitialSelection,
} from '@ttoss/geovis-workspace';
import { I18nProvider } from '@ttoss/react-i18n';
import { BruttalTheme } from '@ttoss/theme/Bruttal';
import * as React from 'react';
import { ThemeUIProvider } from 'theme-ui';

import type { CozinhasFeatureCollection } from '@/data-gateway/schema';
import {
  DEFAULT_CAF_HEXBIN_RESOLUTION,
  isCafHexbinResolution,
} from '@/data-gateway/schema';

import CafMapPanel from './CafMapPanel';
import { DEFAULT_CAF_HEXBIN_OPACITY } from './geovisCafHexbin';
import { type MapMode } from './geovisSpec';
import { DEFAULT_COLOR_RAMP } from './mapaColorRamp';
import {
  buildCozinhaRightSidebar,
  modeShowsCozinhaDetail,
} from './mapaDetailSidebars';
import {
  buildLeftSidebar,
  COLOR_RAMP_MENU_ID,
  DEFAULT_MODE,
  DEFAULT_YEAR,
  MESH_MENU_ID,
  MODE_MENU_ID,
  modeTakesColorRamp,
  modeTakesOpacity,
  OPACITY_MENU_ID,
  type RampHandlers,
  YEAR_MENU_ID,
} from './mapaLeftSidebar';
import MapLoadingIndicator from './MapLoadingIndicator';
import { useCafHexbin } from './useCafHexbin';
import { useCustomRamps } from './useCustomRamps';
import { useKitchensByYear } from './useKitchensByYear';
import { useMapaDatasets } from './useMapaDatasets';
import { useMapaSpec } from './useMapaSpec';
import { useMapaUrlState } from './useMapaUrlState';

/**
 * Bruttal theme scoped for the GeovisWorkspace sidebars only.
 *
 * theme-ui's <ThemeUIProvider>, when top-level (our app root is Chakra, not
 * theme-ui), renders <RootStyles> which injects the theme's `styles.root` onto
 * the document GLOBALLY — `* { box-sizing }`, `html { ...styles.root }` and,
 * crucially, `html a { font-family, color, text-decoration }`. That leaks into
 * sibling components like the header.
 *
 * `config.useRootStyles: false` makes theme-ui skip that global injection
 * entirely (it returns null). The sidebars style themselves via `sx` against
 * the theme context, so they keep their look; only the page-wide root styles
 * are suppressed. Color custom properties (`--theme-ui-*`, namespaced) stay on
 * so sidebar colors still resolve.
 */
const scopedSidebarTheme = {
  ...BruttalTheme,
  config: {
    ...BruttalTheme.config,
    useRootStyles: false,
  },
};

/**
 * Stretches the map to fill the container: `<GeovisWorkspace>` wraps its map in
 * an outer `position:relative` Box whose Flex layout only sets `minHeight` (no
 * `height`), so the wrapper becomes a full-height flex column and the map
 * layout — its in-flow child — grows into it. The legends and tooltips are
 * `position: absolute` siblings, so this stretches only the map, not the
 * overlays. The card border/radius is dropped by `appearance: 'bare'` in the
 * config, not here. Applied only once the map is on screen (see the `css` prop).
 */
const mapLayoutCss = {
  '& > *': {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  '& > * > *': {
    flex: '1',
    minHeight: 0,
  },
};

/**
 * What covers the map while a variation is being served.
 *
 * The same mark that covers the first mount, now over the wait a variation
 * costs: the workspace centers it on whatever map an open sidebar leaves
 * visible, and takes the pointer while it shows.
 *
 * The label names what is actually happening. The map is on screen and being
 * repainted, which is not the blank-canvas wait that "Carregando mapa"
 * describes.
 *
 * Declared here rather than inline so its identity survives a render — the
 * config it goes into is memoized.
 *
 * @returns The indicator.
 *
 * @example
 * config.renderLoading = renderLoading;
 */
const renderLoading = () => {
  return <MapLoadingIndicator variant="overlay" label="Atualizando o mapa" />;
};

/**
 * The workspace config for a mode.
 *
 * A function at module scope rather than a body inside the memo: what it
 * assembles is a declaration, and reading the component should not mean
 * scrolling past it to reach the wiring that follows.
 *
 * @param params.specMode - The mode the map is drawing.
 * @param params.year - Time-lapse year the kitchen detail resolves against.
 * @param params.rampHandlers - Where the colour block reads and reports ramps.
 * @returns The config.
 *
 * @example
 * buildMapConfig({ specMode: 'coropletico', year: 2026, rampHandlers });
 */
const buildMapConfig = ({
  specMode,
  year,
  rampHandlers,
}: {
  specMode: MapMode;
  year: number;
  rampHandlers: RampHandlers;
}): GeovisWorkspaceConfig => {
  // The kitchen detail, in the modes where kitchen points are clickable.
  // The CAF mode has no detail to open: a point stands for one registration,
  // and this app publishes nothing per registration.
  const rightSidebar = modeShowsCozinhaDetail(specMode)
    ? buildCozinhaRightSidebar(year)
    : undefined;

  return {
    // Full-bleed map: no card border/radius so it fills the container.
    appearance: 'bare',
    leftSidebar: buildLeftSidebar({ mode: specMode, ramps: rampHandlers }),
    rightSidebar,
    renderLoading,
    // geovis-workspace 0.6.x adds `legend`, `warnings` and `metadata` slots to
    // the right sidebar, and it stays open while *any* of them has content —
    // `metadata` always does (`spec.sources.length > 0`), so it never
    // auto-closed. Hide all three so the right sidebar hosts only the
    // `inspector` (the clicked feature's detail): it then shows on a point
    // click and closes on a click outside a point (empty inspector → no
    // content → sidebar hides), like the previous version.
    //
    // The `inspector` goes with them wherever no `rightSidebar` is
    // configured. Omitting the sidebar config is NOT enough to keep it shut:
    // the workspace's built-in inspector panel treats any registered click as
    // content of its own (`hasInspectorDefaultContent` returns `true` when no
    // `onFeatureSelect`/`renderDetails` is set), so the sidebar would open on
    // a clicked feature to report a layer id and a raw value. `hidden` wins
    // over content, which is what actually closes that door.
    slots: {
      // Overridden in every mode, not just `cafs`: the drill-down listens on
      // layer ids no other mode's spec declares, so it is inert elsewhere
      // without this having to branch on the mode.
      map: { component: CafMapPanel },
      legend: { hidden: true },
      warnings: { hidden: true },
      metadata: { hidden: true },
      inspector: { hidden: rightSidebar === undefined },
    },
  };
};

const MapaPlayground = () => {
  const { selecaoInicial, publicarSelecao } = useMapaUrlState();

  /*
   * Seeded from the address, so a shared link opens on what it names rather
   * than on the defaults with a repaint a moment later. The address wins over
   * the defaults where it speaks; every menu it says nothing about still opens
   * on its own `defaultValue`.
   */
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      const variacao = (selecaoInicial[MODE_MENU_ID] ??
        DEFAULT_MODE) as MapMode;

      return {
        ...getInitialSelection({
          config: { leftSidebar: buildLeftSidebar({ mode: variacao }) },
        }),
        ...selecaoInicial,
      };
    }
  );

  /*
   * Dropping the ramp being read leaves the map painted from an id no list
   * answers to: the sidebar falls back to its first option on its own, but the
   * selection still names the ramp that is gone, and the paint is memoized on
   * that value. Moving the selection is what repaints — and what keeps the
   * panel and the map saying the same thing.
   */
  const handleRampRemoved = React.useCallback(({ id }: { id: string }) => {
    setSelection((current) => {
      return current[COLOR_RAMP_MENU_ID] === id
        ? { ...current, [COLOR_RAMP_MENU_ID]: DEFAULT_COLOR_RAMP }
        : current;
    });
  }, []);

  const { handlers: rampHandlers } = useCustomRamps({
    onRemoved: handleRampRemoved,
  });

  const mode = (selection[MODE_MENU_ID] ?? DEFAULT_MODE) as MapMode;

  // One snapshot per mode, loaded on the pick that needs it. `ensure` is handed
  // straight back to the workspace below, which is what holds the menus while
  // a mode's data is in flight.
  const { datasets, ready, ensure } = useMapaDatasets(mode);

  /*
   * The mode the map draws, which lags the picked one by exactly the request
   * it costs. Drawing a mode before its snapshots arrive draws a lie: the CAF
   * hierarchy sizes its 27 UF circles from a `mapData` join, so an empty join
   * puts every state at the size scale's floor, and a choropleth would flash
   * "sem dado" over the whole country before repainting.
   */
  const [specMode, setSpecMode] = React.useState(mode);

  /**
   * Commits the pick, then reports the wait it costs — in that order, so the
   * row the user just lit is the one that spins while every other row dims.
   * The map itself only moves to the new mode when that wait resolves; a
   * rejection leaves the last good paint where it is, and returning
   * `undefined` (a mode already loaded, a timeline tick) keeps the menus live.
   */
  const handleVariableChange = React.useCallback(
    (next: GeovisWorkspaceSelection) => {
      setSelection(next);

      const nextMode = (next[MODE_MENU_ID] ?? DEFAULT_MODE) as MapMode;
      // Published on the pick rather than on the paint: the address says what
      // is being read, and a link copied while a heavy variation is still
      // loading has to name that variation, not the one being left behind.
      //
      // The defaults go with it so the address can leave out whatever the
      // variation opens on — they are the mode's own, which is what makes an
      // opacity of 85 worth saying on a choropleth and not on the grid.
      publicarSelecao({
        selection: next,
        mode: nextMode,
        defaults: getInitialSelection({
          config: { leftSidebar: buildLeftSidebar({ mode: nextMode }) },
        }),
      });

      const pending = ensure(nextMode);

      if (!pending) {
        setSpecMode(nextMode);
        return undefined;
      }

      return pending.then(() => {
        setSpecMode(nextMode);
      });
    },
    [ensure, publicarSelecao]
  );

  // Time-lapse year, driven by the sidebar timeline (`selection[YEAR_MENU_ID]`).
  // Falls back to the latest snapshot until the timeline seeds it on mount.
  const yearFromSelection = Number(selection[YEAR_MENU_ID]);
  const year = Number.isFinite(yearFromSelection)
    ? yearFromSelection
    : DEFAULT_YEAR;

  /*
   * The grid's settings, read off the same selection the timeline writes to.
   *
   * The resolution is validated rather than cast: it indexes a snapshot that
   * has to exist, and a stale permalink carrying `r=7` would otherwise 404 the
   * grid and blank the mode.
   */
  const meshFromSelection = Number(selection[MESH_MENU_ID]);
  const meshResolution = isCafHexbinResolution(meshFromSelection)
    ? meshFromSelection
    : DEFAULT_CAF_HEXBIN_RESOLUTION;

  const opacityFromSelection = Number(selection[OPACITY_MENU_ID]);

  const colorRampFromSelection = selection[COLOR_RAMP_MENU_ID];

  // Memoized: `useMapaSpec` keys its spec on reference identity, and a fresh
  // object per render would rebuild the whole spec on every keystroke elsewhere.
  /*
   * Undefined wherever the settings tab is dark, so the value the reader left
   * behind in a choropleth does not go on tinting a mode that never offered
   * the slider — `assentamentos` and the CAF hierarchy paint from layers this
   * setting has no claim over.
   */
  const paintSettings = React.useMemo(() => {
    if (!modeTakesOpacity(specMode)) {
      return undefined;
    }

    return {
      fillOpacity: Number.isFinite(opacityFromSelection)
        ? opacityFromSelection / 100
        : DEFAULT_CAF_HEXBIN_OPACITY,
      /*
       * Gated on its own list rather than on the tab's: the kitchen points and
       * the hexagon grid take the opacity but have no ladder of colours to
       * redraw, so a ramp chosen in a choropleth must not follow the reader
       * into them.
       */
      colorRamp: modeTakesColorRamp(specMode)
        ? (colorRampFromSelection ?? DEFAULT_COLOR_RAMP)
        : undefined,
    };
  }, [colorRampFromSelection, opacityFromSelection, specMode]);

  // The grid for the selected resolution. Seeded with the one the mode already
  // loaded, so opening `cafs-hexbin` costs no second request.
  const { cells: cafHexbinCells } = useCafHexbin({
    resolution: meshResolution,
    seed: datasets.cafHexbin,
  });

  // Kitchen points for the selected year, cached in memory and prefetched for
  // every year so scrubbing and the play animation swap without a round-trip.
  const { points: cozinhasPoints, collections } = useKitchensByYear(year);

  // `codigo → nome` and `codigo → emFuncionamento`. The status lookup is the
  // join that colors the points, so a código it lacks falls through to the
  // masked (white) fallback — which is why this spans *every* loaded year
  // rather than just the selected one: on a year change the outgoing dots
  // linger through the layer's crossfade (and `cozinhasPoints` is briefly
  // undefined on a cache miss), so a single-year lookup would blank them out
  // mid-transition. The selected year is merged last so it wins wherever a
  // kitchen's status differs between snapshots.
  const { cozinhaNames, cozinhaStatus } = React.useMemo(() => {
    const names: Record<string, string> = {};
    const status: Record<string, string> = {};

    const absorb = (collection?: CozinhasFeatureCollection) => {
      for (const feature of collection?.features ?? []) {
        names[feature.properties.codigo] = feature.properties.nome;
        status[feature.properties.codigo] = feature.properties.emFuncionamento;
      }
    };

    for (const collection of Object.values(collections)) {
      absorb(collection);
    }
    absorb(collections[year]);

    return { cozinhaNames: names, cozinhaStatus: status };
  }, [collections, year]);

  const config = React.useMemo(() => {
    return buildMapConfig({ specMode, year, rampHandlers });
    // `year` is a dependency because the kitchen detail sidebar resolves the
    // clicked código inside that year's snapshot. `rampHandlers` is one because
    // it carries the ramps the reader has built: its identity changes when that
    // list does, which is what rebuilds the colour block's options.
  }, [specMode, year, rampHandlers]);

  const spec = useMapaSpec({
    kitchenByCity: datasets.data,
    ivsByCity: datasets.ivs,
    nomesPorCodigo: datasets.nomes,
    assentamentos: datasets.settlements,
    cozinhaNames,
    cozinhaStatus,
    cafByCity: datasets.cafsByCity,
    cafPontosPorUf: datasets.cafPontosPorUf,
    cadinsanByCity: datasets.cadinsanByCity,
    cafHexbin: cafHexbinCells,
    paintSettings,
    mode: specMode,
    cozinhasPoints,
  });

  return (
    <Box
      position="relative"
      // Size and background come from the server-rendered box in `page.tsx`,
      // which reserves them before this chunk exists. This one fills it and
      // hosts the workspace overrides below.
      h="100%"
      w="100%"
      // Gated on `ready`: these rules restyle `<GeovisWorkspace>`'s DOM, and
      // their `& > *` / `& > * > *` selectors would otherwise also match the
      // loading indicator's own children while loading — flexing the mark and
      // caption apart and pushing the mark off-centre. Only apply once the map
      // (not the loading indicator) is the child.
      css={ready ? mapLayoutCss : undefined}
    >
      {ready ? (
        // `<GeovisWorkspace>` renders theme-ui and `@ttoss/react-i18n`
        // components internally, so it needs both a theme-ui provider and the
        // `<I18nProvider>` ancestor.
        <I18nProvider locale="pt-BR">
          {/*
           * Scope the GeovisWorkspace sidebars to theme-ui's provider ONLY, with
           * global root styles disabled (see scopedSidebarTheme). @ttoss/ui's own
           * <ThemeProvider> is avoided because it also mounts a second Chakra v3
           * system whose global `--chakra-*` variables clobber the app's tokens
           * and break the header. The sidebars only use theme-ui primitives, so
           * the theme-ui context is all they need.
           */}
          <ThemeUIProvider theme={scopedSidebarTheme}>
            <GeovisWorkspace
              config={config}
              visualizationSpec={spec}
              variables={selection}
              onVariableChange={handleVariableChange}
            />
          </ThemeUIProvider>
        </I18nProvider>
      ) : (
        <MapLoadingIndicator />
      )}
    </Box>
  );
};

export default MapaPlayground;

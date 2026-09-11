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

import CafMapPanel from './CafMapPanel';
import { type MapMode } from './geovisSpec';
import {
  buildCozinhaRightSidebar,
  modeShowsCozinhaDetail,
} from './mapaDetailSidebars';
import MapLoadingIndicator from './MapLoadingIndicator';
import { useKitchensByYear } from './useKitchensByYear';
import { useMapaDatasets } from './useMapaDatasets';
import { useMapaSpec } from './useMapaSpec';

/** Id of the left-sidebar menu group that drives the visualization mode. */
const MODE_MENU_ID = 'visualizacao';

/** Shared-selection key the time-lapse timeline writes the current year to. */
const YEAR_MENU_ID = 'ano';

/** Mode shown before the sidebar seeds `selection[MODE_MENU_ID]`. */
const DEFAULT_MODE: MapMode = 'coropletico';

/** Year shown before the timeline seeds `selection[YEAR_MENU_ID]` (latest snapshot). */
const DEFAULT_YEAR = 2026;

/**
 * Visualization modes whose data carries a year, so the timeline describes
 * something. Only the kitchen locations do: every choropleth here is a single
 * snapshot per município, and the assentamentos overlay has no time dimension
 * either.
 *
 * Typed as `MapMode[]` on purpose. The gate below matches these strings against
 * the shared selection, and the variations that produce that selection are
 * declared as plain strings further down — so the type is what keeps the two
 * from drifting: renaming a member of the `MapMode` union breaks this line at
 * compile time instead of quietly leaving the tab disabled forever.
 */
const MODES_WITH_TIMELINE: MapMode[] = ['pontos'];

/** Left sidebar drives the visualization mode. */
/**
 * Left sidebar: the cozinhas visualizations as a card with two icon tabs —
 * "Variações" (a flat, icon-led list) and "Timeline". Drives the shared
 * `visualizacao` selection (same `menuId` + values), so switching a variation
 * recolors the map.
 *
 * Neither section declares `header.title`, so geovis-workspace 0.13 draws no
 * header band at all and the tab bar takes the top of the card, close button
 * included. Two consequences shape the config below. Each tab is named by its
 * section `id` (`header.title ?? section.id`), on hover and for assistive tech
 * alike, so those ids read as labels — declaring a title to name one tab would
 * bring the band back for both. And the `variations` body heads itself with its
 * own `title`/`icon`, since with no band its rows would otherwise start against
 * the tab bar with nothing naming them.
 *
 * The "Timeline" tab is gated on the variation: it is live only for
 * {@link MODES_WITH_TIMELINE} and dims everywhere else. Dimming rather than
 * dropping the section is deliberate — the tab bar would reflow on every
 * variation switch, and a dimmed tab reads as *unavailable* where a missing one
 * reads as *gone*.
 */
const LEFT_SIDEBAR: NonNullable<GeovisWorkspaceConfig['leftSidebar']> = {
  initialState: 'open',
  sections: [
    {
      id: 'Variações',
      header: {
        icon: 'lucide:layout-list',
      },
      body: {
        kind: 'variations',
        title: 'Variações',
        icon: 'lucide:layout-list',
        menuId: MODE_MENU_ID,
        defaultValue: 'coropletico',
        groups: [
          {
            id: 'cozinhas',
            label: 'Cozinhas',
            variations: [
              {
                value: 'coropletico',
                label: 'Cozinhas por município (coroplético)',
                icon: 'lucide:map',
              },
              {
                value: 'coropletico-taxa',
                label: 'nº coz. no município / 100.000 hab.',
                icon: 'lucide:users',
              },
              {
                value: 'coropletico-percentual',
                label: '% das cozinhas do Brasil no município',
                icon: 'lucide:percent',
              },
              {
                value: 'coropletico-cafs-percentual',
                label: '% dos CAFs do Brasil no município',
                icon: 'lucide:wheat',
              },
              {
                value: 'coropletico-cadinsan-com-pbf',
                label: 'Insegurança alimentar — cenário com o Bolsa Família',
                icon: 'lucide:utensils-crossed',
              },
              {
                value: 'coropletico-cadinsan-sem-pbf',
                label: 'Insegurança alimentar — cenário sem o Bolsa Família',
                icon: 'lucide:utensils',
              },
              {
                value: 'coropletico-cadunico',
                label: 'nº coz. / 10 mil pessoas no CadÚnico',
                icon: 'lucide:clipboard-list',
              },
              {
                value: 'coropletico-pessoas-cozinha',
                label: 'pessoas no CadÚnico por cozinha',
                icon: 'lucide:user-round',
              },
            ],
          },
          {
            id: 'ivs',
            label: 'IVS',
            variations: [
              {
                value: 'coropletico-ivs',
                label: 'Índice de vulnerabilidade social',
                icon: 'lucide:shield-alert',
              },
              {
                value: 'coropletico-ivs-infraestrutura',
                label: 'IVS Infraestrutura Urbana',
                icon: 'lucide:building-2',
              },
              {
                value: 'coropletico-ivs-capital-humano',
                label: 'IVS Capital Humano',
                icon: 'lucide:graduation-cap',
              },
              {
                value: 'coropletico-ivs-renda-trabalho',
                label: 'IVS Renda e Trabalho',
                icon: 'lucide:briefcase',
              },
            ],
          },
          {
            id: 'idhm',
            label: 'IDHM',
            variations: [
              {
                value: 'coropletico-idhm',
                label: 'Índice de Desenvolvimento Humano Municipal',
                icon: 'lucide:trending-up',
              },
              {
                value: 'coropletico-idhm-longevidade',
                label: 'IDHM Longevidade',
                icon: 'lucide:heart-pulse',
              },
              {
                value: 'coropletico-idhm-educacao',
                label: 'IDHM Educação',
                icon: 'lucide:book-open',
              },
              {
                value: 'coropletico-idhm-renda',
                label: 'IDHM Renda',
                icon: 'lucide:dollar-sign',
              },
              {
                value: 'coropletico-idhm-educacao-escolaridade',
                label: 'IDHM Educação — Escolaridade',
                icon: 'lucide:pencil-ruler',
              },
              {
                value: 'coropletico-idhm-educacao-frequencia',
                label: 'IDHM Educação — Frequência Escolar',
                icon: 'lucide:calendar-check',
              },
            ],
          },
          {
            id: 'camadas',
            label: 'Camadas',
            variations: [
              {
                value: 'pontos',
                label: 'Localização das cozinhas',
                icon: 'lucide:map-pin',
              },
              {
                value: 'circulos',
                label: 'Cozinhas por município',
                icon: 'lucide:circle-dot',
              },
              {
                value: 'assentamentos',
                label: 'Assentamentos e cozinhas',
                icon: 'lucide:house',
              },
              {
                value: 'cafs',
                label: 'CAFs',
                icon: 'lucide:tractor',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'Timeline',
      header: {
        icon: 'lucide:clock',
      },
      // Live only where the data has a year. While the gate is closed the tab
      // dims, playback is suspended, and the year already published stays in the
      // selection — a closed gate freezes the timeline, it does not reset it, so
      // returning to a kitchen-locations view lands on the same year.
      enabledWhen: { menuId: MODE_MENU_ID, values: MODES_WITH_TIMELINE },
      body: {
        kind: 'filters',
        blocks: [
          {
            id: 'periodo',
            title: 'Linha do tempo',
            icon: 'lucide:calendar-clock',
            // No `collapsible`: geovis-workspace 0.13 stopped collapsing filter
            // blocks by default, and this is the only block in its tab — there
            // is no neighbour for it to push off screen. A fixed header, so the
            // timeline is always in reach. (`defaultOpen` lived here and is now
            // read only when a block opts into collapsing.)
            control: {
              kind: 'timeline',
              // Drives the shared selection so the map reacts to the year.
              menuId: YEAR_MENU_ID,
              min: 2025,
              max: 2026,
              step: 1,
              defaultValue: DEFAULT_YEAR,
            },
          },
        ],
      },
    },
  ],
};

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

const MapaPlayground = () => {
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      return getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } });
    }
  );

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
      const pending = ensure(nextMode);

      if (!pending) {
        setSpecMode(nextMode);
        return undefined;
      }

      return pending.then(() => {
        setSpecMode(nextMode);
      });
    },
    [ensure]
  );

  // Time-lapse year, driven by the sidebar timeline (`selection[YEAR_MENU_ID]`).
  // Falls back to the latest snapshot until the timeline seeds it on mount.
  const yearFromSelection = Number(selection[YEAR_MENU_ID]);
  const year = Number.isFinite(yearFromSelection)
    ? yearFromSelection
    : DEFAULT_YEAR;

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

  const config = React.useMemo((): GeovisWorkspaceConfig => {
    // The kitchen detail, in the modes where kitchen points are clickable.
    // The CAF mode has no detail to open: a point stands for one registration,
    // and this app publishes nothing per registration.
    const rightSidebar = modeShowsCozinhaDetail(specMode)
      ? buildCozinhaRightSidebar(year)
      : undefined;

    return {
      // Full-bleed map: no card border/radius so it fills the container.
      appearance: 'bare',
      leftSidebar: LEFT_SIDEBAR,
      rightSidebar,
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
    // `year` is a dependency because the kitchen detail sidebar resolves the
    // clicked código inside that year's snapshot.
  }, [specMode, year]);

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
    mode: specMode,
    cozinhasPoints,
  });

  // `<GeovisWorkspace>` wraps its map in an outer `position:relative` Box; inside
  // it the map's Flex layout only sets `minHeight` (no `height`). We turn the
  // outer Box into a full-height flex column and let its in-flow child (the map
  // layout) grow with `flex: 1` so the map fills the viewport. The card
  // border/radius is dropped via `appearance: 'bare'` in the config, not here.
  // Applied only once the map is on screen (see the `css` prop below).
  const mapLayoutCss = {
    // Stretch the map to fill the container: make the workspace wrapper a
    // full-height flex column and let the map layout (its in-flow child) grow.
    // The card border/radius is dropped by `appearance: 'bare'` in the config,
    // not here. The legends/tooltips are `position: absolute` siblings, so this
    // stretches only the map, not the overlays.
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

  return (
    <Box
      position="relative"
      // `dvh`, not `vh`: on mobile browsers `100vh` is the viewport with the URL
      // bar hidden, so the map would start taller than the screen — its bottom
      // under the browser chrome, and the page with a scrollbar it should not
      // have. `dvh` tracks the space actually visible, which is also the height
      // the camera fit in `useMapaSpec` measures.
      h="calc(100dvh - 72px)"
      w="100%"
      bg="ivory.200"
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

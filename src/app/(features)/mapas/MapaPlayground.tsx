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

import type {
  cadinsanByCity,
  cafByCity,
  CozinhasFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import { type AssentamentoAtributo, type MapMode } from './geovisSpec';
import {
  buildCozinhaRightSidebar,
  modeShowsCozinhaDetail,
} from './mapaDetailSidebars';
import MapLoadingIndicator from './MapLoadingIndicator';
import { useKitchensByYear } from './useKitchensByYear';
import { type NomesPorCodigo, useMapaSpec } from './useMapaSpec';

/** Id of the left-sidebar menu group that drives the visualization mode. */
const MODE_MENU_ID = 'visualizacao';

/** Shared-selection key the time-lapse timeline writes the current year to. */
const YEAR_MENU_ID = 'ano';

/** Year shown before the timeline seeds `selection[YEAR_MENU_ID]` (latest snapshot). */
const DEFAULT_YEAR = 2026;

/** Left sidebar drives the visualization mode. */
/**
 * Left sidebar: the cozinhas visualizations as a card with two icon tabs —
 * "Variações" (a flat, icon-led list) and "Timeline" — whose header mirrors the
 * active tab. Drives the shared `visualizacao` selection (same `menuId` +
 * values), so switching a variation recolors the map.
 */
const LEFT_SIDEBAR: NonNullable<GeovisWorkspaceConfig['leftSidebar']> = {
  initialState: 'open',
  sections: [
    {
      id: 'cozinhas',
      header: {
        title: 'Variações',
        icon: 'lucide:layout-list',
      },
      body: {
        kind: 'variations',
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
            ],
          },
        ],
      },
    },
    {
      id: 'filtros',
      header: {
        title: 'Timeline',
        icon: 'lucide:clock',
      },
      body: {
        kind: 'filters',
        blocks: [
          {
            id: 'periodo',
            title: 'Linha do tempo',
            icon: 'lucide:calendar-clock',
            defaultOpen: true,
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

/** Everything the map loads once at mount. */
type MapBootstrap = {
  data: kitchenRateByCity[];
  ivs: MunicipioIvs[];
  nomes: NomesPorCodigo;
  settlements: AssentamentoAtributo[];
  /** Per-município CAF shares for the "% dos CAFs do Brasil" choropleth. */
  cafsByCity: cafByCity[];
  /** Per-município CADINSAN food-insecurity shares for the food-insecurity choropleths. */
  cadinsanByCity: cadinsanByCity[];
};

const EMPTY_BOOTSTRAP: MapBootstrap = {
  data: [],
  ivs: [],
  nomes: {},
  settlements: [],
  cafsByCity: [],
  cadinsanByCity: [],
};

/**
 * Fetches the map's mount-time data in parallel. The assentamentos attribute
 * sidecar (~560 KB) is loaded here; the multi-MB geometry is fetched lazily by
 * the map source only when the user switches to the assentamentos mode. On any
 * failure it resolves to empty data — the map renders in the "sem dado" color
 * and tooltips fall back to their default labels.
 */
const fetchMapData = async (): Promise<MapBootstrap> => {
  try {
    const [data, ivs, nomes, settlements, cafsByCity, cadinsanByCity] =
      await Promise.all([
        fetch('/api/cozinhas/por-municipio').then((response) => {
          return response.json() as Promise<kitchenRateByCity[]>;
        }),
        fetch('/api/municipios/ivs').then((response) => {
          return response.json() as Promise<MunicipioIvs[]>;
        }),
        fetch('/geo/municipios-nomes.json').then((response) => {
          return response.json() as Promise<NomesPorCodigo>;
        }),
        fetch('/geo/assentamentos-atributos.json').then((response) => {
          return response.json() as Promise<AssentamentoAtributo[]>;
        }),
        fetch('/api/cafs/por-municipio').then((response) => {
          return response.json() as Promise<cafByCity[]>;
        }),
        fetch('/api/cadinsan/por-municipio').then((response) => {
          return response.json() as Promise<cadinsanByCity[]>;
        }),
      ]);
    return {
      data,
      ivs,
      nomes,
      settlements,
      cafsByCity,
      cadinsanByCity,
    };
  } catch {
    return EMPTY_BOOTSTRAP;
  }
};

const MapaPlayground = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchenByCity, setKitchenByCity] = React.useState<kitchenRateByCity[]>(
    []
  );
  const [ivsByCity, setIvsByCity] = React.useState<MunicipioIvs[]>([]);
  const [nomesPorCodigo, setNomesPorCodigo] = React.useState<NomesPorCodigo>(
    {}
  );
  const [assentamentos, setAssentamentos] = React.useState<
    AssentamentoAtributo[]
  >([]);
  const [cafsByCity, setCafsByCity] = React.useState<cafByCity[]>([]);
  const [cadinsanByCity, setCadinsanByCity] = React.useState<cadinsanByCity[]>(
    []
  );
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      return getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } });
    }
  );

  const mode = (selection[MODE_MENU_ID] ?? 'coropletico') as MapMode;

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
    return {
      // Full-bleed map: no card border/radius so it fills the container.
      appearance: 'bare',
      leftSidebar: LEFT_SIDEBAR,
      rightSidebar: modeShowsCozinhaDetail(mode)
        ? buildCozinhaRightSidebar(year)
        : undefined,
      // geovis-workspace 0.6.x adds `legend`, `warnings` and `metadata` slots to
      // the right sidebar, and it stays open while *any* of them has content —
      // `metadata` always does (`spec.sources.length > 0`), so it never
      // auto-closed. Hide all three so the right sidebar hosts only the
      // `inspector` (the clicked feature's detail): it then shows on a point
      // click and closes on a click outside a point (empty inspector → no
      // content → sidebar hides), like the previous version.
      slots: {
        legend: { hidden: true },
        warnings: { hidden: true },
        metadata: { hidden: true },
      },
    };
    // `year` is a dependency because the kitchen detail sidebar resolves the
    // clicked código inside that year's snapshot.
  }, [mode, year]);

  React.useEffect(() => {
    let cancelled = false;

    fetchMapData().then((bootstrap) => {
      if (cancelled) {
        return;
      }
      setKitchenByCity(bootstrap.data);
      setIvsByCity(bootstrap.ivs);
      setNomesPorCodigo(bootstrap.nomes);
      setAssentamentos(bootstrap.settlements);
      setCafsByCity(bootstrap.cafsByCity);
      setCadinsanByCity(bootstrap.cadinsanByCity);
      setMounted(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const spec = useMapaSpec({
    kitchenByCity,
    ivsByCity,
    nomesPorCodigo,
    assentamentos,
    cozinhaNames,
    cozinhaStatus,
    cafByCity: cafsByCity,
    cadinsanByCity,
    mode,
    cozinhasPoints,
  });

  // `<GeovisWorkspace>` wraps its map in an outer `position:relative` Box; inside
  // it the map's Flex layout only sets `minHeight` (no `height`). We turn the
  // outer Box into a full-height flex column and let its in-flow child (the map
  // layout) grow with `flex: 1` so the map fills the viewport. The card
  // border/radius is dropped via `appearance: 'bare'` in the config, not here.
  // Applied only when the map is mounted (see the `css` prop below).
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
      h="calc(100vh - 72px)"
      w="100%"
      bg="ivory.200"
      // Gated on `mounted`: these rules restyle `<GeovisWorkspace>`'s DOM, and
      // their `& > *` / `& > * > *` selectors would otherwise also match the
      // loading indicator's own children while loading — flexing the mark and
      // caption apart and pushing the mark off-centre. Only apply once the map
      // (not the loading indicator) is the child.
      css={mounted ? mapLayoutCss : undefined}
    >
      {mounted ? (
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
              onVariableChange={setSelection}
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

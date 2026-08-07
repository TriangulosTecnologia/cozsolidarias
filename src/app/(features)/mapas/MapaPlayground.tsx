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
  CafAreaFeature,
  cafByCity,
  CafsFeatureCollection,
  CozinhasFeatureCollection,
  kitchenRateByCity,
  MunicipioIvs,
} from '@/data-gateway/schema';

import { type AssentamentoAtributo, type MapMode } from './geovisSpec';
import {
  CAF_RIGHT_SIDEBAR,
  COZINHA_RIGHT_SIDEBAR,
  modeShowsCozinhaDetail,
} from './mapaDetailSidebars';
import MapLoadingIndicator from './MapLoadingIndicator';
import { type NomesPorCodigo, useMapaSpec } from './useMapaSpec';

/** Id of the left-sidebar menu group that drives the visualization mode. */
const MODE_MENU_ID = 'visualizacao';

/** Left sidebar drives the visualization mode. */
const LEFT_SIDEBAR: NonNullable<GeovisWorkspaceConfig['leftSidebar']> = {
  initialState: 'open',
  menus: [
    {
      id: MODE_MENU_ID,
      title: 'Visualização',
      defaultValue: 'coropletico',
      items: [
        { value: 'coropletico', label: 'Cozinhas por município (coroplético)' },
        {
          value: 'coropletico-taxa',
          label: 'nº coz. no município / 100.000 hab.',
        },
        {
          value: 'coropletico-percentual',
          label: '% das cozinhas do Brasil no município',
        },
        {
          value: 'coropletico-cafs-percentual',
          label: '% dos CAFs do Brasil no município',
        },
        {
          value: 'coropletico-cadunico',
          label: 'nº coz. / 10 mil pessoas no CadÚnico',
        },
        {
          value: 'coropletico-pessoas-cozinha',
          label: 'pessoas no CadÚnico por cozinha',
        },
        {
          value: 'coropletico-ivs',
          label: 'Índice de vulnerabilidade social',
        },
        {
          value: 'coropletico-ivs-infraestrutura',
          label: 'IVS Infraestrutura Urbana',
        },
        {
          value: 'coropletico-ivs-capital-humano',
          label: 'IVS Capital Humano',
        },
        {
          value: 'coropletico-ivs-renda-trabalho',
          label: 'IVS Renda e Trabalho',
        },
        {
          value: 'coropletico-idhm',
          label: 'Índice de Desenvolvimento Humano Municipal',
        },
        {
          value: 'coropletico-idhm-longevidade',
          label: 'IDHM Longevidade',
        },
        {
          value: 'coropletico-idhm-educacao',
          label: 'IDHM Educação',
        },
        {
          value: 'coropletico-idhm-renda',
          label: 'IDHM Renda',
        },
        {
          value: 'coropletico-idhm-educacao-escolaridade',
          label: 'IDHM Educação — Escolaridade',
        },
        {
          value: 'coropletico-idhm-educacao-frequencia',
          label: 'IDHM Educação — Frequência Escolar',
        },
        { value: 'pontos', label: 'Localização das cozinhas' },
        { value: 'circulos', label: 'Cozinhas por município' },
        { value: 'assentamentos', label: 'Assentamentos e cozinhas' },
        { value: 'cafs', label: 'CAFs' },
      ],
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
  /** `codigo → nome` lookup for kitchen point hover tooltips. */
  cozinhaNames: Record<string, string>;
  /** `codigo → emFuncionamento` lookup that colors the kitchen points by status. */
  cozinhaStatus: Record<string, string>;
  /** `nrCaf → CafAreaFeature properties` lookup for CAF hover tooltips. */
  cafProps: Record<string, CafAreaFeature['properties']>;
  /** Per-município CAF shares for the "% dos CAFs do Brasil" choropleth. */
  cafsByCity: cafByCity[];
};

const EMPTY_BOOTSTRAP: MapBootstrap = {
  data: [],
  ivs: [],
  nomes: {},
  settlements: [],
  cozinhaNames: {},
  cozinhaStatus: {},
  cafProps: {},
  cafsByCity: [],
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
    const [
      data,
      ivs,
      nomes,
      settlements,
      cozinhasGeoJSON,
      cafsGeoJSON,
      cafsByCity,
    ] = await Promise.all([
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
      fetch('/api/cozinhas').then((response) => {
        return response.json() as Promise<CozinhasFeatureCollection>;
      }),
      fetch('/api/cafs').then((response) => {
        return response.json() as Promise<CafsFeatureCollection>;
      }),
      fetch('/api/cafs/por-municipio').then((response) => {
        return response.json() as Promise<cafByCity[]>;
      }),
    ]);
    const cozinhaNames = Object.fromEntries(
      cozinhasGeoJSON.features.map((f) => {
        return [f.properties.codigo, f.properties.nome];
      })
    );
    const cozinhaStatus = Object.fromEntries(
      cozinhasGeoJSON.features.map((f) => {
        return [f.properties.codigo, f.properties.emFuncionamento];
      })
    );
    const cafProps = Object.fromEntries(
      cafsGeoJSON.features.map((f) => {
        return [f.properties.nrCaf, f.properties];
      })
    );
    return {
      data,
      ivs,
      nomes,
      settlements,
      cozinhaNames,
      cozinhaStatus,
      cafProps,
      cafsByCity,
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
  const [cozinhaNames, setCozinhaNames] = React.useState<
    Record<string, string>
  >({});
  const [cozinhaStatus, setCozinhaStatus] = React.useState<
    Record<string, string>
  >({});
  const [cafProps, setCafProps] = React.useState<
    Record<string, CafAreaFeature['properties']>
  >({});
  const [cafsByCity, setCafsByCity] = React.useState<cafByCity[]>([]);
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      return getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } });
    }
  );

  const mode = (selection[MODE_MENU_ID] ?? 'coropletico') as MapMode;

  const config = React.useMemo((): GeovisWorkspaceConfig => {
    return {
      leftSidebar: LEFT_SIDEBAR,
      rightSidebar:
        mode === 'cafs'
          ? CAF_RIGHT_SIDEBAR
          : modeShowsCozinhaDetail(mode)
            ? COZINHA_RIGHT_SIDEBAR
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
  }, [mode]);

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
      setCozinhaNames(bootstrap.cozinhaNames);
      setCozinhaStatus(bootstrap.cozinhaStatus);
      setCafProps(bootstrap.cafProps);
      setCafsByCity(bootstrap.cafsByCity);
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
    cafProps,
    cozinhaStatus,
    cafByCity: cafsByCity,
    mode,
  });

  return (
    <Box
      position="relative"
      h="calc(100vh - 72px)"
      w="100%"
      bg="ivory.200"
      // `<GeovisWorkspace>` (0.6.x) wraps its map in an outer `position:relative`
      // Box; inside it the map's Flex layout only sets `minHeight` (no `height`)
      // and carries the card's border/radius. We turn the outer Box into a
      // full-height flex column and let its in-flow child (the map layout) grow
      // with `flex: 1`, dropping that card border/radius for a full-bleed map.
      // The hover tooltip and legends are `position: absolute` siblings, which
      // ignore flex-item props — so this stretches only the map, not the overlays.
      css={{
        '& > *': {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
        '& > * > *': {
          flex: '1',
          minHeight: 0,
          border: 'none',
          borderRadius: 0,
        },
        // geovis' provider auto-renders the choropleth legend with a fixed 10px
        // inset from the map corner (`GeoVisLegend`'s corner position isn't
        // further configurable via the spec). Nudge it inward so it doesn't
        // crowd the edges. Selected by the legend list's aria-label (its title),
        // one selector per choropleth legend (count, rate, share, CadÚnico,
        // coverage, IVS) plus the categorical settlement legend.
        '& div:has(> ul[aria-label="Cozinhas por município"]), & div:has(> ul[aria-label="nº coz. no município / 100.000 hab."]), & div:has(> ul[aria-label="% das cozinhas do Brasil no município"]), & div:has(> ul[aria-label="% dos CAFs do Brasil no município"]), & div:has(> ul[aria-label="nº coz. / 10 mil pessoas no CadÚnico"]), & div:has(> ul[aria-label="pessoas no CadÚnico por cozinha"]), & div:has(> ul[aria-label="Índice de vulnerabilidade social"]), & div:has(> ul[aria-label="Assentamentos rurais"])':
          {
            bottom: '44px !important',
            right: '44px !important',
          },
      }}
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

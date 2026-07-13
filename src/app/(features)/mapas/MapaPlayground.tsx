'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Box, Text } from '@chakra-ui/react';
import {
  createBoundaryGroup,
  type MapHoverInfo,
  useBoundaryToggle,
} from '@ttoss/geovis';
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

import type { kitchenRateByCity, MunicipioIvs } from '@/data-gateway/schema';

import {
  type AssentamentoAtributo,
  buildSpec,
  type MapMode,
} from './geovisSpec';
import {
  renderAssentamentoTooltip,
  renderMunicipioTooltip,
} from './mapaTooltips';

const estadosGroup = createBoundaryGroup({
  id: 'estados-boundary',
  data: '/geo/estados.json',
  paint: { lineColor: '#241F21', lineWidth: 0.8 },
});

const municipiosGroup = createBoundaryGroup({
  id: 'municipios-boundary',
  data: '/geo/geojs-100-mun.json',
  paint: { lineColor: '#B2B2B2', lineWidth: 0.6 },
});

/** `{ codigoIbge: nome }` for every Brazilian município, keyed by `codarea`. */
type NomesPorCodigo = Record<string, string>;

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

/**
 * Workspace config: only the left sidebar (the mode switcher). The legend and
 * data source now live on the map itself, configured via the geovis spec (see
 * `buildLegends` in `geovisSpec.ts`), so no right sidebar is needed.
 */
const CONFIG: GeovisWorkspaceConfig = {
  leftSidebar: LEFT_SIDEBAR,
};

/** Everything the map loads once at mount. */
type MapBootstrap = {
  data: kitchenRateByCity[];
  ivs: MunicipioIvs[];
  nomes: NomesPorCodigo;
  settlements: AssentamentoAtributo[];
};

const EMPTY_BOOTSTRAP: MapBootstrap = {
  data: [],
  ivs: [],
  nomes: {},
  settlements: [],
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
    const [data, ivs, nomes, settlements] = await Promise.all([
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
    ]);
    return { data, ivs, nomes, settlements };
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
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      return getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } });
    }
  );

  const mode = (selection[MODE_MENU_ID] ?? 'coropletico') as MapMode;

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
      setMounted(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const citiesByCode = React.useMemo(() => {
    return new Map(
      kitchenByCity.map((registro) => {
        return [registro.codigoIbge, registro];
      })
    );
  }, [kitchenByCity]);

  const hoverTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = citiesByCode.get(code);
      // Nome vem do catálogo completo (todos os municípios do Brasil). Fallback
      // só se o catálogo não tiver o código.
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;

      return renderMunicipioTooltip({
        mode,
        name,
        register,
        value: info.value,
      });
    },
    [citiesByCode, nomesPorCodigo, mode]
  );

  const assentamentosByCode = React.useMemo(() => {
    return new Map(
      assentamentos.map((atributo) => {
        return [atributo.codImovel, atributo];
      })
    );
  }, [assentamentos]);

  const assentamentoTooltip = React.useCallback(
    (info: MapHoverInfo) => {
      return renderAssentamentoTooltip({
        atributo: assentamentosByCode.get(String(info.featureId)),
        value: info.value,
      });
    },
    [assentamentosByCode]
  );

  const baseSpec = React.useMemo(() => {
    return buildSpec(kitchenByCity, mode, hoverTooltip, ivsByCity, {
      assentamentos: {
        atributos: assentamentos,
        hoverRender: assentamentoTooltip,
      },
    });
  }, [
    kitchenByCity,
    mode,
    hoverTooltip,
    ivsByCity,
    assentamentos,
    assentamentoTooltip,
  ]);

  // Assentamentos mode hides the município layers entirely — drop the município
  // boundary outline too, keeping only the state outlines for context.
  const boundaryGroups = React.useMemo(() => {
    return mode === 'assentamentos'
      ? [estadosGroup]
      : [estadosGroup, municipiosGroup];
  }, [mode]);

  const { spec } = useBoundaryToggle(baseSpec, boundaryGroups);

  return (
    <Box
      position="relative"
      h="calc(100vh - 72px)"
      w="100%"
      bg="ivory.200"
      // The `<GeovisWorkspace>` root is a flex container with only `minHeight`
      // (no `height`), so it collapses instead of filling this box. It's a
      // closed component, so we stretch its direct child to fill the available
      // space and drop its card border/radius for a full-bleed map.
      css={{
        '& > *': {
          height: '100%',
          width: '100%',
          border: 'none',
          borderRadius: 0,
        },
        // geovis' provider auto-renders the choropleth legend with a fixed 10px
        // inset from the map corner (`GeoVisLegend`'s corner position isn't
        // further configurable via the spec). Nudge it inward so it doesn't
        // crowd the edges. Selected by the legend list's aria-label (its title),
        // one selector per choropleth legend (count, rate, share, CadÚnico,
        // coverage, IVS) plus the categorical settlement legend.
        '& div:has(> ul[aria-label="Cozinhas por município"]), & div:has(> ul[aria-label="nº coz. no município / 100.000 hab."]), & div:has(> ul[aria-label="% das cozinhas do Brasil no município"]), & div:has(> ul[aria-label="nº coz. / 10 mil pessoas no CadÚnico"]), & div:has(> ul[aria-label="pessoas no CadÚnico por cozinha"]), & div:has(> ul[aria-label="Índice de vulnerabilidade social"]), & div:has(> ul[aria-label="Assentamentos rurais"])':
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
              config={CONFIG}
              visualizationSpec={spec}
              variables={selection}
              onVariableChange={setSelection}
            />
          </ThemeUIProvider>
        </I18nProvider>
      ) : (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text textStyle="body-sm" color="text.secondary">
            Carregando mapa…
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default MapaPlayground;

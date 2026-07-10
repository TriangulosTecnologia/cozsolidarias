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

import { buildSpec, type MapMode } from './geovisSpec';
import { renderMunicipioTooltip } from './mapaTooltips';

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
        { value: 'pontos', label: 'Localização das cozinhas' },
        { value: 'circulos', label: 'Cozinhas por município' },
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

const MapaPlayground = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchenByCity, setKitchenByCity] = React.useState<kitchenRateByCity[]>(
    []
  );
  const [ivsByCity, setIvsByCity] = React.useState<MunicipioIvs[]>([]);
  const [nomesPorCodigo, setNomesPorCodigo] = React.useState<NomesPorCodigo>(
    {}
  );
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      return getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } });
    }
  );

  const mode = (selection[MODE_MENU_ID] ?? 'coropletico') as MapMode;

  React.useEffect(() => {
    let cancelled = false;

    const finish = (
      data: kitchenRateByCity[],
      ivs: MunicipioIvs[],
      nomes: NomesPorCodigo
    ) => {
      if (cancelled) {
        return;
      }
      setKitchenByCity(data);
      setIvsByCity(ivs);
      setNomesPorCodigo(nomes);
      setMounted(true);
    };

    Promise.all([
      fetch('/api/cozinhas/por-municipio').then((response) => {
        return response.json() as Promise<kitchenRateByCity[]>;
      }),
      fetch('/api/municipios/ivs').then((response) => {
        return response.json() as Promise<MunicipioIvs[]>;
      }),
      fetch('/geo/municipios-nomes.json').then((response) => {
        return response.json() as Promise<NomesPorCodigo>;
      }),
    ])
      .then(([data, ivs, nomes]) => {
        finish(data, ivs, nomes);
      })
      .catch(() => {
        // Falha silenciosa: o mapa renderiza todo na cor "sem dado" e o
        // tooltip cai no rótulo de fallback "Município <código>".
        finish([], [], {});
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

  const baseSpec = React.useMemo(() => {
    return buildSpec(kitchenByCity, mode, hoverTooltip, ivsByCity);
  }, [kitchenByCity, mode, hoverTooltip, ivsByCity]);

  const boundaryGroups = React.useMemo(() => {
    return [estadosGroup, municipiosGroup];
  }, []);

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
        // coverage, IVS).
        '& div:has(> ul[aria-label="Cozinhas por município"]), & div:has(> ul[aria-label="nº coz. no município / 100.000 hab."]), & div:has(> ul[aria-label="% das cozinhas do Brasil no município"]), & div:has(> ul[aria-label="nº coz. / 10 mil pessoas no CadÚnico"]), & div:has(> ul[aria-label="pessoas no CadÚnico por cozinha"]), & div:has(> ul[aria-label="Índice de vulnerabilidade social"])':
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

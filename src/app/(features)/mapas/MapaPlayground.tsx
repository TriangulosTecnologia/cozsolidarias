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

import type { CozinhaSituacao } from '@/data-gateway/schema';

import { buildSpec, type MapMode } from './geovisSpec';
import {
  renderFillTooltip,
  renderStatusTooltip,
  toHoverTooltip,
  TooltipCard,
} from './mapaTooltips';
import { useMapaData } from './useMapaData';

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

/** Per-cozinha display data for the status tooltip, keyed by `codigo`. */
type StatusPorCodigo = Map<string, { nome: string; situacao: CozinhaSituacao }>;

/** Per-cozinha display data for the plain-points tooltip, keyed by `codigo`. */
type CozinhasPorCodigo = Map<string, { nome: string; codigo: string }>;

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
        {
          value: 'pontos-status',
          label: 'Localização das cozinhas com status',
        },
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

const CONFIG: GeovisWorkspaceConfig = {
  leftSidebar: LEFT_SIDEBAR,
};

/**
 * CSS overrides applied to the map container. `<GeovisWorkspace>`'s root is a
 * flex container with only `minHeight` (no `height`), so it collapses instead
 * of filling this box — it's a closed component, so we stretch its direct
 * child to fill the available space and drop its card border/radius for a
 * full-bleed map. geovis' provider also auto-renders the active legend with a
 * fixed 10px inset from the map corner; the selector list below (one per
 * choropleth/overlay legend, matched by its aria-label title) nudges it inward
 * so it doesn't crowd the edges.
 */
const MAP_CONTAINER_CSS: Record<string, unknown> = {
  '& > *': {
    height: '100%',
    width: '100%',
    border: 'none',
    borderRadius: 0,
  },
  '& div:has(> ul[aria-label="Cozinhas por município"]), & div:has(> ul[aria-label="nº coz. no município / 100.000 hab."]), & div:has(> ul[aria-label="% das cozinhas do Brasil no município"]), & div:has(> ul[aria-label="nº coz. / 10 mil pessoas no CadÚnico"]), & div:has(> ul[aria-label="pessoas no CadÚnico por cozinha"]), & div:has(> ul[aria-label="Índice de vulnerabilidade social"]), & div:has(> ul[aria-label="IVS Infraestrutura Urbana"]), & div:has(> ul[aria-label="IVS Capital Humano"]), & div:has(> ul[aria-label="IVS Renda e Trabalho"]), & div:has(> ul[aria-label="Localização das cozinhas"]), & div:has(> ul[aria-label="Localização das cozinhas com status"])':
    {
      bottom: '44px !important',
      right: '44px !important',
    },
};

const MapaPlayground = () => {
  const {
    mounted,
    kitchenByCity,
    ivsByCity,
    nomesPorCodigo,
    cozinhas,
    cozinhasStatus,
  } = useMapaData();
  const [selection, setSelection] = React.useState<GeovisWorkspaceSelection>(
    () => {
      return getInitialSelection({ config: { leftSidebar: LEFT_SIDEBAR } });
    }
  );
  const handleVariableChange = React.useCallback(
    (next: GeovisWorkspaceSelection) => {
      return setSelection(next);
    },
    []
  );
  const mode = (selection[MODE_MENU_ID] ?? 'coropletico') as MapMode;
  const citiesByCode = React.useMemo(() => {
    return new Map(
      kitchenByCity.map((r) => {
        return [r.codigoIbge, r];
      })
    );
  }, [kitchenByCity]);
  const statusByCode = React.useMemo((): StatusPorCodigo => {
    return new Map(
      cozinhasStatus.features.map((f) => {
        return [
          f.properties.codigo,
          { nome: f.properties.nome, situacao: f.properties.situacao },
        ];
      })
    );
  }, [cozinhasStatus]);
  const cozinhasByCodigo = React.useMemo((): CozinhasPorCodigo => {
    return new Map(
      cozinhas.features.map((f) => {
        return [
          f.properties.codigo,
          { nome: f.properties.nome, codigo: f.properties.codigo },
        ];
      })
    );
  }, [cozinhas]);
  const fillHoverTooltip = React.useMemo(() => {
    return toHoverTooltip((info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = citiesByCode.get(code);
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;
      return renderFillTooltip({ mode, name, register, value: info.value });
    });
  }, [citiesByCode, nomesPorCodigo, mode]);
  const pontosHoverTooltip = React.useMemo(() => {
    return toHoverTooltip((info: MapHoverInfo) => {
      const code = String(info.featureId);
      const register = cozinhasByCodigo.get(code);
      return (
        <TooltipCard
          name={register?.nome ?? `Cozinha ${code}`}
          swatchColor="var(--chakra-colors-tertiary-500)"
          primary={register?.codigo ?? code}
        />
      );
    });
  }, [cozinhasByCodigo]);
  const pontosStatusHoverTooltip = React.useMemo(() => {
    return toHoverTooltip((info: MapHoverInfo) => {
      const code = String(info.featureId);
      return renderStatusTooltip({ code, register: statusByCode.get(code) });
    });
  }, [statusByCode]);
  const baseSpec = React.useMemo(() => {
    return buildSpec({
      byCity: kitchenByCity,
      mode,
      fillHoverTooltip,
      cozinhas,
      cozinhasStatus,
      pontosHoverTooltip,
      pontosStatusHoverTooltip,
      ivsByCity,
    });
  }, [
    kitchenByCity,
    mode,
    fillHoverTooltip,
    cozinhas,
    cozinhasStatus,
    pontosHoverTooltip,
    pontosStatusHoverTooltip,
    ivsByCity,
  ]);
  const { spec: toggledSpec } = useBoundaryToggle(baseSpec, [
    estadosGroup,
    municipiosGroup,
  ]);
  const spec = React.useMemo(() => {
    const pts = toggledSpec.layers.filter((l) => {
      return l.geometry === 'point';
    });
    if (pts.length === 0) return toggledSpec;
    const others = toggledSpec.layers.filter((l) => {
      return l.geometry !== 'point';
    });
    return { ...toggledSpec, layers: [...others, ...pts] };
  }, [toggledSpec]);
  return (
    <Box
      position="relative"
      h="calc(100vh - 72px)"
      w="100%"
      bg="ivory.200"
      css={MAP_CONTAINER_CSS}
    >
      {mounted ? (
        <I18nProvider locale="pt-BR">
          <ThemeUIProvider theme={scopedSidebarTheme}>
            <GeovisWorkspace
              config={CONFIG}
              visualizationSpec={spec}
              variables={selection}
              onVariableChange={handleVariableChange}
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

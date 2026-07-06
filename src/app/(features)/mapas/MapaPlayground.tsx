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

import type { kitchenRateByCity } from '@/data-gateway/schema';

import {
  buildSpec,
  colorForPercentual,
  colorForQuantidade,
  colorForTaxa,
  type MapMode,
} from './geovisSpec';

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

/** `"N cozinhas"` / `"1 cozinha"`, com o número no formato pt-BR. */
const formatCozinhas = (quantidade: number): string => {
  return `${quantidade.toLocaleString('pt-BR')} ${
    quantidade === 1 ? 'cozinha' : 'cozinhas'
  }`;
};

/** Card do tooltip: título + swatch da faixa + rótulo, com linha auxiliar opcional. */
const TooltipCard = ({
  name,
  swatchColor,
  primary,
  secondary,
}: {
  name: string;
  swatchColor: string;
  primary: string;
  secondary?: string;
}) => {
  return (
    <Box display="flex" flexDirection="column" gap="1.5" minW="180px">
      <Text fontWeight="bold" fontSize="sm" lineHeight="tight">
        {name}
      </Text>
      <Box display="flex" alignItems="center" gap="2">
        <Box
          w="12px"
          h="12px"
          borderRadius="sm"
          flexShrink={0}
          bg={swatchColor}
        />
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {primary}
        </Text>
      </Box>
      {secondary === undefined ? null : (
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {secondary}
        </Text>
      )}
    </Box>
  );
};

/** Rate-mode tooltip: swatch da taxa + "N por 100 mil hab." + linha auxiliar. */
const renderRateTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: kitchenRateByCity;
}) => {
  const taxa = register?.porCemMil ?? null;
  const populacao = register?.populacao ?? null;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    taxa === null
      ? 'Sem cozinha registrada'
      : `${taxa.toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })} por 100 mil hab.`;

  const secondary =
    taxa !== null && populacao !== null
      ? `${formatCozinhas(quantidade)} · ${populacao.toLocaleString('pt-BR')} hab.`
      : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForTaxa(taxa)}
      primary={primary}
      secondary={secondary}
    />
  );
};

/** Count-mode tooltip (modos `coropletico`, `pontos`, `circulos`): swatch + "N cozinhas". */
const renderCountTooltip = ({
  name,
  quantity,
}: {
  name: string;
  quantity: number;
}) => {
  return (
    <TooltipCard
      name={name}
      swatchColor={colorForQuantidade(quantity)}
      primary={
        quantity === 0 ? 'Sem cozinha registrada' : formatCozinhas(quantity)
      }
    />
  );
};

/** Share-mode tooltip: swatch da fatia + "X% das cozinhas do Brasil" + linha auxiliar. */
const renderPercentTooltip = ({
  name,
  register,
}: {
  name: string;
  register?: kitchenRateByCity;
}) => {
  const percentual = register?.percentualDoBrasil ?? 0;
  const quantidade = register?.quantidade ?? 0;

  const primary =
    percentual <= 0
      ? 'Sem cozinha registrada'
      : `${percentual.toLocaleString('pt-BR', {
          maximumFractionDigits: 2,
        })}% das cozinhas do Brasil`;

  const secondary = percentual > 0 ? formatCozinhas(quantidade) : undefined;

  return (
    <TooltipCard
      name={name}
      swatchColor={colorForPercentual(percentual)}
      primary={primary}
      secondary={secondary}
    />
  );
};

const MapaPlayground = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchenByCity, setKitchenByCity] = React.useState<kitchenRateByCity[]>(
    []
  );
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

    const finish = (data: kitchenRateByCity[], nomes: NomesPorCodigo) => {
      if (cancelled) {
        return;
      }
      setKitchenByCity(data);
      setNomesPorCodigo(nomes);
      setMounted(true);
    };

    Promise.all([
      fetch('/api/cozinhas/por-municipio').then((response) => {
        return response.json() as Promise<kitchenRateByCity[]>;
      }),
      fetch('/geo/municipios-nomes.json').then((response) => {
        return response.json() as Promise<NomesPorCodigo>;
      }),
    ])
      .then(([data, nomes]) => {
        finish(data, nomes);
      })
      .catch(() => {
        // Falha silenciosa: o mapa renderiza todo na cor "sem cozinha" e o
        // tooltip cai no rótulo de fallback "Município <código>".
        finish([], {});
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

      if (mode === 'coropletico-taxa') {
        return renderRateTooltip({ name, register });
      }

      if (mode === 'coropletico-percentual') {
        return renderPercentTooltip({ name, register });
      }

      // Contagem bruta: vem do feature-state quando presente, senão dos dados
      // (ausente => 0).
      const quantity =
        typeof info.value === 'number'
          ? info.value
          : (register?.quantidade ?? 0);

      return renderCountTooltip({ name, quantity });
    },
    [citiesByCode, nomesPorCodigo, mode]
  );

  const baseSpec = React.useMemo(() => {
    return buildSpec(kitchenByCity, mode, hoverTooltip);
  }, [kitchenByCity, mode, hoverTooltip]);

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
        // one selector per choropleth legend (count, rate and share).
        '& div:has(> ul[aria-label="Cozinhas por município"]), & div:has(> ul[aria-label="nº coz. no município / 100.000 hab."]), & div:has(> ul[aria-label="% das cozinhas do Brasil no município"])':
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

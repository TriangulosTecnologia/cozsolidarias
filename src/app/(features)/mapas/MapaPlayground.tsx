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
import { ThemeProvider } from '@ttoss/ui';
import * as React from 'react';

import type { kitchenByCity } from '@/data-gateway/schema';

import { buildLegendItems, buildSpec, type MapMode } from './geovisSpec';

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

/** Left sidebar is static — only the right sidebar changes with the mode. */
const LEFT_SIDEBAR: NonNullable<GeovisWorkspaceConfig['leftSidebar']> = {
  menus: [
    {
      id: MODE_MENU_ID,
      title: 'Visualização',
      defaultValue: 'coropletico',
      items: [
        { value: 'coropletico', label: 'Mapa coroplético' },
        { value: 'pontos', label: 'Pontos das cozinhas' },
      ],
    },
  ],
};

const DESCRIPTIONS: Record<MapMode, string> = {
  coropletico:
    'Quanto mais escuro o município, mais cozinhas cadastradas ali. Passe o mouse sobre um município para ver o nome e a quantidade.',
  pontos: 'Cada ponto é uma cozinha solidária cadastrada.',
};

const LEGEND_ITEMS = buildLegendItems();

/**
 * Builds the workspace config for a given mode. The legend swatches only show in
 * `coropletico` mode (in `pontos` mode the fill is flat), matching the previous
 * behaviour where the legend was hidden for the points view.
 */
const buildConfig = (mode: MapMode): GeovisWorkspaceConfig => {
  return {
    leftSidebar: LEFT_SIDEBAR,
    rightSidebar: {
      title: 'Cozinhas Solidárias',
      legendWithColor: {
        description: DESCRIPTIONS[mode],
        ...(mode === 'coropletico'
          ? {
              legend: {
                title: 'Cozinhas por município',
                items: LEGEND_ITEMS,
              },
            }
          : {}),
        sources: {
          title: 'Fonte dos dados:',
          items: [{ label: '© Cozinhas Solidárias' }],
        },
      },
    },
  };
};

const MapaPlayground = () => {
  const [mounted, setMounted] = React.useState(false);
  const [kitchenByCity, setKitchenByCity] = React.useState<kitchenByCity[]>([]);
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

    const finish = (data: kitchenByCity[], nomes: NomesPorCodigo) => {
      if (cancelled) {
        return;
      }
      setKitchenByCity(data);
      setNomesPorCodigo(nomes);
      setMounted(true);
    };

    Promise.all([
      fetch('/api/cozinhas/por-municipio').then((response) => {
        return response.json() as Promise<kitchenByCity[]>;
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
      // Nome vem do catálogo completo (todos os municípios do Brasil); a
      // contagem, dos dados de cozinha (ausente => 0). Fallback só se o catálogo
      // não tiver o código.
      const name =
        nomesPorCodigo[code] ?? register?.municipio ?? `Município ${code}`;
      const quantity =
        typeof info.value === 'number'
          ? info.value
          : (register?.quantidade ?? 0);

      return (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div>
            {quantity === 0
              ? ''
              : `${quantity} ${quantity === 1 ? 'cozinha' : 'cozinhas'}`}
          </div>
        </div>
      );
    },
    [citiesByCode, nomesPorCodigo]
  );

  const baseSpec = React.useMemo(() => {
    return buildSpec(kitchenByCity, mode, hoverTooltip);
  }, [kitchenByCity, mode, hoverTooltip]);

  const boundaryGroups = React.useMemo(() => {
    return [estadosGroup, municipiosGroup];
  }, []);

  const { spec } = useBoundaryToggle(baseSpec, boundaryGroups);

  const config = React.useMemo(() => {
    return buildConfig(mode);
  }, [mode]);

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
      }}
    >
      {mounted ? (
        // `<GeovisWorkspace>` renders `@ttoss/ui` (theme-ui) and
        // `@ttoss/react-i18n` components internally, so it needs both the
        // `<ThemeProvider>` and `<I18nProvider>` ancestors.
        <ThemeProvider>
          <I18nProvider locale="pt-BR">
            <GeovisWorkspace
              config={config}
              visualizationSpec={spec}
              variables={selection}
              onVariableChange={setSelection}
            />
          </I18nProvider>
        </ThemeProvider>
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

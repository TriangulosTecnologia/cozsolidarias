import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';
import type * as React from 'react';
import MapaPlayground from 'src/app/(features)/mapas/MapaPlayground';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

// MapLibre needs a real canvas/WebGL context that jsdom lacks, so the geovis
// render layer is stubbed. We only exercise the component's own logic: the
// visualization mode drives which layers `buildSpec` puts on the map.
jest.mock('@ttoss/geovis', () => {
  return {
    __esModule: true,
    createBoundaryGroup: () => {
      return { sources: [], layers: [] };
    },
    // Passthrough: the boundary toggle doesn't change the spec's data layers,
    // so the test can inspect the base spec straight through.
    useBoundaryToggle: (baseSpec: unknown) => {
      return { spec: baseSpec };
    },
  };
});

// `<GeovisWorkspace>` is a closed, ESM-only 3rd-party component (theme-ui +
// MapLibre inside). Stub it with a plain `<select>` built from the config's
// left-sidebar menu, and surface the received spec's layer ids so the test can
// assert what each mode renders.
jest.mock('@ttoss/geovis-workspace', () => {
  return {
    __esModule: true,
    getInitialSelection: ({
      config,
    }: {
      config: {
        leftSidebar: { menus: { id: string; items: { value: string }[] }[] };
      };
    }) => {
      const menu = config.leftSidebar.menus[0];
      return { [menu.id]: menu.items[0].value };
    },
    GeovisWorkspace: ({
      config,
      visualizationSpec,
      variables,
      onVariableChange,
    }: {
      config: {
        leftSidebar: {
          menus: {
            id: string;
            title: string;
            items: { value: string; label: string }[];
          }[];
        };
      };
      visualizationSpec: { layers?: { id: string; visible?: boolean }[] };
      variables: Record<string, string>;
      onVariableChange: (next: Record<string, string>) => void;
    }) => {
      const menu = config.leftSidebar.menus[0];
      const specLayers = visualizationSpec.layers ?? [];
      const layerIds = specLayers
        .map((layer) => {
          return layer.id;
        })
        .join(',');
      // Both kitchen representations are present in every mode; what differs is
      // visibility. Expose the visible ids separately so the test can assert
      // which layer each mode actually shows.
      const visibleLayerIds = specLayers
        .filter((layer) => {
          return layer.visible !== false;
        })
        .map((layer) => {
          return layer.id;
        })
        .join(',');
      return (
        <div data-testid="geovis-workspace">
          <div data-testid="layer-ids">{layerIds}</div>
          <div data-testid="visible-layer-ids">{visibleLayerIds}</div>
          <select
            aria-label={menu.title}
            value={variables[menu.id]}
            onChange={(event) => {
              return onVariableChange({
                ...variables,
                [menu.id]: event.target.value,
              });
            }}
          >
            {menu.items.map((item) => {
              return (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              );
            })}
          </select>
        </div>
      );
    },
  };
});

// The theme/i18n providers are ESM-only and irrelevant to the logic under test.
jest.mock('@ttoss/react-i18n', () => {
  return {
    __esModule: true,
    I18nProvider: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>;
    },
  };
});
jest.mock('@ttoss/theme/Bruttal', () => {
  return { __esModule: true, BruttalTheme: { config: {} } };
});
jest.mock('theme-ui', () => {
  return {
    __esModule: true,
    ThemeUIProvider: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>;
    },
  };
});

const BY_CITY: kitchenRateByCity[] = [
  {
    codigoIbge: '3550308',
    municipio: 'São Paulo',
    quantidade: 5,
    populacao: 11_451_999,
    porCemMil: 0.04,
    percentualDoBrasil: 100,
    pessoasCadUnico: 3_884_884,
    porDezMilCadUnico: 0.01,
    pessoasPorCozinha: 776_977,
  },
];

const ASSENTAMENTOS = [
  {
    codImovel: 'SP-1-AAA',
    municipio: 'Alpha',
    uf: 'SP',
    areaHa: 100,
    modulosFiscais: 2,
    status: 'AT',
    condicao: 'Aguardando analise',
    dtCriacao: '01/01/2020',
    dtAtualizacao: '02/02/2021',
  },
];

const CAF_BY_CITY = [
  {
    codigoIbge: '3550308',
    municipio: 'São Paulo',
    quantidade: 42,
    percentualDoBrasil: 0.01,
  },
];

/** Resolves each mount-time fetch to the right shape for the URL. */
const bodyForUrl = (url: string) => {
  if (url.includes('cafs/por-municipio')) {
    return CAF_BY_CITY;
  }
  if (url.includes('por-municipio')) {
    return BY_CITY;
  }
  if (url.includes('assentamentos-atributos')) {
    return ASSENTAMENTOS;
  }
  return {};
};

beforeEach(() => {
  // The component fetches the counts, catalogs and the assentamentos attribute
  // sidecar on mount; serve each shape.
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    return Promise.resolve({
      json: () => {
        return Promise.resolve(bodyForUrl(String(input)));
      },
    } as Response);
  }) as jest.Mock;
});

describe('MapaPlayground — visualization toggle', () => {
  test('switching the sidebar mode changes which layers the map spec renders', async () => {
    renderWithChakra(<MapaPlayground />);

    // Waits out the mount fetch, then the workspace (and its spec) render.
    const layerIds = await screen.findByTestId('layer-ids');

    // Both kitchen representations are present in every mode (their stacking is
    // fixed at mount); each mode decides which one is *visible*.
    const visible = () => {
      return screen.getByTestId('visible-layer-ids');
    };

    // Default (choropleth): the fill is visible; the kitchen points and bubbles
    // are present but hidden (points are the opt-in "Camadas" overlay).
    expect(layerIds).toHaveTextContent('cozinhas-pts');
    expect(layerIds).toHaveTextContent('cozinhas-bolhas');
    expect(visible()).toHaveTextContent('municipios-br-fill');
    expect(visible()).not.toHaveTextContent('cozinhas-pts');
    expect(visible()).not.toHaveTextContent('cozinhas-bolhas');

    // Every other choropleth behaves the same: fill visible, both kitchen
    // layers hidden.
    for (const value of [
      'coropletico-taxa',
      'coropletico-percentual',
      'coropletico-cafs-percentual',
      'coropletico-cadunico',
      'coropletico-pessoas-cozinha',
    ]) {
      fireEvent.change(screen.getByLabelText('Visualização'), {
        target: { value },
      });
      expect(visible()).toHaveTextContent('municipios-br-fill');
      expect(visible()).not.toHaveTextContent('cozinhas-pts');
      expect(visible()).not.toHaveTextContent('cozinhas-bolhas');
    }

    // Points mode shows the per-cozinha points; the bubbles stay hidden.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'pontos' },
    });
    expect(visible()).toHaveTextContent('cozinhas-pts');
    expect(visible()).not.toHaveTextContent('cozinhas-bolhas');

    // Bubbles mode shows the proportional circles; the points stay hidden
    // (revealed on top only via the "Camadas" control).
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'circulos' },
    });
    expect(visible()).toHaveTextContent('cozinhas-bolhas');
    expect(visible()).not.toHaveTextContent('cozinhas-pts');

    // Assentamentos mode shows the settlement polygons with the kitchen points
    // on top; the bubbles and the município fill stay hidden/absent.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'assentamentos' },
    });
    expect(visible()).toHaveTextContent('assentamentos-poly');
    expect(visible()).toHaveTextContent('cozinhas-pts');
    expect(visible()).not.toHaveTextContent('cozinhas-bolhas');
    // Municípios are hidden in this mode — no município fill layer at all.
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'municipios-br-fill'
    );
  });
});

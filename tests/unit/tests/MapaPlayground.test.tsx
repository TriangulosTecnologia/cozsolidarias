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
      visualizationSpec: { layers?: { id: string }[] };
      variables: Record<string, string>;
      onVariableChange: (next: Record<string, string>) => void;
    }) => {
      const menu = config.leftSidebar.menus[0];
      const layerIds = (visualizationSpec.layers ?? [])
        .map((layer) => {
          return layer.id;
        })
        .join(',');
      return (
        <div data-testid="geovis-workspace">
          <div data-testid="layer-ids">{layerIds}</div>
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
    areaHa: 100,
    status: 'AT',
    condicao: 'Aguardando analise',
  },
];

beforeEach(() => {
  // The component fetches the counts, names catalog and the assentamentos
  // attribute sidecar on mount; serve each with the right shape.
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('por-municipio')
      ? BY_CITY
      : url.includes('assentamentos-sp-atributos')
        ? ASSENTAMENTOS
        : {};
    return Promise.resolve({
      json: () => {
        return Promise.resolve(body);
      },
    } as Response);
  }) as jest.Mock;
});

describe('MapaPlayground — visualization toggle', () => {
  test('switching the sidebar mode changes which layers the map spec renders', async () => {
    renderWithChakra(<MapaPlayground />);

    // Waits out the mount fetch, then the workspace (and its spec) render.
    const layerIds = await screen.findByTestId('layer-ids');

    // Default (choropleth): the fill layer only, no points/bubbles overlay.
    expect(layerIds).not.toHaveTextContent('cozinhas-pts');
    expect(layerIds).not.toHaveTextContent('cozinhas-bolhas');

    // Rate mode keeps the single choropleth fill, no points/bubbles overlay.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'coropletico-taxa' },
    });
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-pts'
    );
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-bolhas'
    );

    // Share (%) mode also keeps the single choropleth fill, no overlay.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'coropletico-percentual' },
    });
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-pts'
    );
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-bolhas'
    );

    // CadÚnico mode keeps the single choropleth fill, no overlay.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'coropletico-cadunico' },
    });
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-pts'
    );
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-bolhas'
    );

    // Coverage (people-per-cozinha) mode also keeps the single fill, no overlay.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'coropletico-pessoas-cozinha' },
    });
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-pts'
    );
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-bolhas'
    );

    // Points mode adds the per-cozinha points layer.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'pontos' },
    });
    expect(screen.getByTestId('layer-ids')).toHaveTextContent('cozinhas-pts');

    // Bubbles mode swaps it for the proportional-circle layer.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'circulos' },
    });
    expect(screen.getByTestId('layer-ids')).toHaveTextContent(
      'cozinhas-bolhas'
    );
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-pts'
    );

    // Assentamentos mode adds the settlement polygons with the kitchen points
    // on top, and drops the bubble overlay.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'assentamentos' },
    });
    expect(screen.getByTestId('layer-ids')).toHaveTextContent(
      'assentamentos-poly'
    );
    expect(screen.getByTestId('layer-ids')).toHaveTextContent('cozinhas-pts');
    expect(screen.getByTestId('layer-ids')).not.toHaveTextContent(
      'cozinhas-bolhas'
    );
  });
});

import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';
import type * as React from 'react';
import MapaPlayground from 'src/app/(features)/mapas/MapaPlayground';
import type { kitchenRateByCity } from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

jest.mock('@ttoss/geovis', () => {
  return {
    __esModule: true,
    createBoundaryGroup: () => {
      return { sources: [], layers: [] };
    },
    useBoundaryToggle: (baseSpec: unknown) => {
      return { spec: baseSpec };
    },
  };
});

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
      visualizationSpec: {
        layers?: { id: string }[];
        legends?: { id: string }[];
      };
      variables: Record<string, string>;
      onVariableChange: (next: Record<string, string>) => void;
    }) => {
      const menu = config.leftSidebar.menus[0];
      const layerIds = (visualizationSpec.layers ?? [])
        .map((layer) => {
          return layer.id;
        })
        .join(',');
      const legendIds = (visualizationSpec.legends ?? [])
        .map((legend) => {
          return legend.id;
        })
        .join(',');
      return (
        <div data-testid="geovis-workspace">
          <div data-testid="layer-ids">{layerIds}</div>
          <div data-testid="legend-ids">{legendIds}</div>
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
  },
];

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('por-municipio')) {
      return Promise.resolve({
        json: () => {
          return Promise.resolve(BY_CITY);
        },
      } as Response);
    }
    if (url.includes('/api/cozinhas/status')) {
      return Promise.resolve({
        json: () => {
          return Promise.resolve({ type: 'FeatureCollection', features: [] });
        },
      } as Response);
    }
    if (url.includes('/api/cozinhas')) {
      return Promise.resolve({
        json: () => {
          return Promise.resolve({ type: 'FeatureCollection', features: [] });
        },
      } as Response);
    }
    // Default: municipios-nomes.json and any other endpoints
    return Promise.resolve({
      json: () => {
        return Promise.resolve({});
      },
    } as Response);
  }) as jest.Mock;
});

describe('MapaPlayground — sidebar', () => {
  test("'Localização das cozinhas com status' comes right after 'Localização das cozinhas'", async () => {
    renderWithChakra(<MapaPlayground />);
    await screen.findByTestId('geovis-workspace');

    const labels = Array.from(
      screen.getByLabelText('Visualização').querySelectorAll('option')
    ).map((option) => {
      return option.textContent;
    });

    const pontosIndex = labels.indexOf('Localização das cozinhas');
    expect(pontosIndex).toBeGreaterThan(-1);
    expect(labels[pontosIndex + 1]).toBe('Localização das cozinhas com status');
  });
});

describe('MapaPlayground — visualization toggle', () => {
  test('switching the sidebar mode changes layers and legends in the spec', async () => {
    renderWithChakra(<MapaPlayground />);

    const layerIds = await screen.findByTestId('layer-ids');
    const legendIds = screen.getByTestId('legend-ids');

    expect(layerIds).toHaveTextContent('municipios-br-fill');
    expect(legendIds).toHaveTextContent('legenda-cozinhas');

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

    // Points mode adds the per-cozinha points layer.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'pontos' },
    });
    expect(screen.getByTestId('layer-ids')).toHaveTextContent('cozinhas-pts');
    expect(screen.getByTestId('legend-ids')).toHaveTextContent(
      'legenda-cozinhas-pontos',
      { exact: true }
    );

    // Status mode shows the categorical status legend.
    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'pontos-status' },
    });
    expect(screen.getByTestId('legend-ids').textContent).toBe(
      'legenda-cozinhas-status'
    );

    fireEvent.change(screen.getByLabelText('Visualização'), {
      target: { value: 'circulos' },
    });
    expect(screen.getByTestId('layer-ids')).toHaveTextContent(
      'cozinhas-bolhas-overrides'
    );
    expect(screen.getByTestId('layer-ids')).toHaveTextContent(
      'municipios-br-fill'
    );
    expect(screen.getByTestId('legend-ids').textContent).toBe(
      'cozinhas-bolhas-data-legend'
    );
  });
});

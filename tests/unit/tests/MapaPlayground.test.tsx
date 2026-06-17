import '@testing-library/jest-dom';

import { fireEvent, screen } from '@testing-library/react';
import type * as React from 'react';
import MapaPlayground from 'src/app/(features)/mapas/MapaPlayground';
import type { kitchenByCity } from 'src/data-gateway/schema';

import { renderWithChakra } from './renderWithChakra';

// MapLibre needs a real canvas/WebGL context that jsdom lacks, so the geovis
// render layer is stubbed with plain divs. We only care that the legend (which
// is choropleth-only) appears/disappears as the mode changes.
jest.mock('@ttoss/geovis', () => {
  return {
    __esModule: true,
    GeoVisProvider: ({ children }: { children: React.ReactNode }) => {
      return <div data-testid="geovis-provider">{children}</div>;
    },
    GeoVisCanvas: () => {
      return <div data-testid="geovis-canvas" />;
    },
    GeoVisLegend: () => {
      return <div data-testid="geovis-legend" />;
    },
    GeoVisHoverTooltip: () => {
      return <div data-testid="geovis-tooltip" />;
    },
    createBoundaryGroup: () => {
      return { sources: [], layers: [] };
    },
    useBoundaryToggle: (baseSpec: unknown) => {
      return {
        spec: baseSpec,
        toggle: jest.fn(),
        isVisible: jest.fn(() => {
          return true;
        }),
      };
    },
    useGeoVis: () => {
      return {
        runtime: null,
        spec: {},
        applyPatch: jest.fn(),
        setView: jest.fn(),
        policyViolations: [],
      };
    },
  };
});

const BY_CITY: kitchenByCity[] = [
  { codigoIbge: '3550308', municipio: 'São Paulo', quantidade: 5 },
];

beforeEach(() => {
  // The component fetches the counts + names catalog on mount; serve both.
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('por-municipio') ? BY_CITY : {};
    return Promise.resolve({
      json: () => {
        return Promise.resolve(body);
      },
    } as Response);
  }) as jest.Mock;
});

describe('MapaPlayground — visualization toggle', () => {
  test('the dropdown switches the map from choropleth to kitchen points', async () => {
    renderWithChakra(<MapaPlayground />);

    // Initial state: choropleth mode (legend visible + choropleth copy). The
    // matched strings are the component's real (Portuguese) UI text.
    await screen.findByText('Cozinhas Solidárias');
    expect(
      screen.getByText(/Quanto mais escuro o município/)
    ).toBeInTheDocument();
    expect(screen.getByTestId('geovis-legend')).toBeInTheDocument();

    // Action: switch the dropdown to the points option.
    fireEvent.change(screen.getByLabelText('Visualização do mapa'), {
      target: { value: 'pontos' },
    });

    // Points mode: the copy changes and the choropleth legend disappears.
    expect(
      await screen.findByText('Cada ponto é uma cozinha solidária cadastrada.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('geovis-legend')).not.toBeInTheDocument();
  });
});

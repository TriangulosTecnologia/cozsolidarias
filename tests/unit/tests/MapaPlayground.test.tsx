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
// left-sidebar `variations` section, and surface the received spec's layer ids
// so the test can assert what each mode renders.
jest.mock('@ttoss/geovis-workspace', () => {
  // Types are inlined: a `type` alias declared inside a `jest.mock` factory is
  // rejected by babel's hoisting check as an out-of-scope reference.
  const mockVariationsSection = (config: {
    leftSidebar: {
      sections: {
        header: { title: string };
        body: {
          kind: string;
          menuId: string;
          defaultValue: string;
          groups: { variations: { value: string; label: string }[] }[];
        };
      }[];
    };
  }) => {
    // The mode switcher is the first `variations` section — the same one the
    // real package reads to seed the shared selection.
    return config.leftSidebar.sections.find((section) => {
      return section.body.kind === 'variations';
    });
  };

  return {
    __esModule: true,
    getInitialSelection: ({
      config,
    }: {
      config: Parameters<typeof mockVariationsSection>[0];
    }) => {
      const section = mockVariationsSection(config);
      if (!section) {
        return {};
      }
      return { [section.body.menuId]: section.body.defaultValue };
    },
    GeovisWorkspace: ({
      config,
      visualizationSpec,
      variables,
      onVariableChange,
    }: {
      config: Parameters<typeof mockVariationsSection>[0];
      visualizationSpec: { layers?: { id: string; visible?: boolean }[] };
      variables: Record<string, string>;
      onVariableChange: (next: Record<string, string>) => void;
    }) => {
      const section = mockVariationsSection(config);
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
      if (!section) {
        return <div data-testid="geovis-workspace" />;
      }
      // The sections API nests variations under groups; the switcher is flat.
      const variations = section.body.groups.flatMap((group) => {
        return group.variations;
      });
      return (
        <div data-testid="geovis-workspace">
          <div data-testid="layer-ids">{layerIds}</div>
          <div data-testid="visible-layer-ids">{visibleLayerIds}</div>
          <select
            aria-label={section.header.title}
            value={variables[section.body.menuId]}
            onChange={(event) => {
              return onVariableChange({
                ...variables,
                [section.body.menuId]: event.target.value,
              });
            }}
          >
            {variations.map((variation) => {
              return (
                <option key={variation.value} value={variation.value}>
                  {variation.label}
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
/** Snapshot years served to the time-lapse (`useKitchensByYear`). */
const YEARS = [2022, 2023, 2024, 2025, 2026];

/** Empty point layer: the assertions are about which layers the spec renders. */
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

const bodyForUrl = (url: string) => {
  // Checked before the `por-municipio` rules: the time-lapse's year list also
  // lives under `/api/cozinhas`.
  if (url.includes('cozinhas/anos')) {
    return YEARS;
  }
  if (url.includes('cafs/por-municipio')) {
    return CAF_BY_CITY;
  }
  if (url.includes('por-municipio')) {
    return BY_CITY;
  }
  if (url.includes('assentamentos-atributos')) {
    return ASSENTAMENTOS;
  }
  // `/api/cozinhas`, `/api/cozinhas?ano=N` and `/api/cafs` are read as GeoJSON;
  // `fetchMapData` maps over `.features`, so the shape has to be a collection.
  if (url.includes('/api/cozinhas') || url.includes('/api/cafs')) {
    return EMPTY_FEATURE_COLLECTION;
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
      fireEvent.change(screen.getByLabelText('Variações'), {
        target: { value },
      });
      expect(visible()).toHaveTextContent('municipios-br-fill');
      expect(visible()).not.toHaveTextContent('cozinhas-pts');
      expect(visible()).not.toHaveTextContent('cozinhas-bolhas');
    }

    // Points mode shows the per-cozinha points; the bubbles stay hidden.
    fireEvent.change(screen.getByLabelText('Variações'), {
      target: { value: 'pontos' },
    });
    expect(visible()).toHaveTextContent('cozinhas-pts');
    expect(visible()).not.toHaveTextContent('cozinhas-bolhas');

    // Bubbles mode shows the proportional circles; the points stay hidden
    // (revealed on top only via the "Camadas" control).
    fireEvent.change(screen.getByLabelText('Variações'), {
      target: { value: 'circulos' },
    });
    expect(visible()).toHaveTextContent('cozinhas-bolhas');
    expect(visible()).not.toHaveTextContent('cozinhas-pts');

    // Assentamentos mode shows the settlement polygons with the kitchen points
    // on top; the bubbles and the município fill stay hidden/absent.
    fireEvent.change(screen.getByLabelText('Variações'), {
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

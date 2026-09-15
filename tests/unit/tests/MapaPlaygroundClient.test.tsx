import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import type * as React from 'react';

import { renderWithChakra } from './renderWithChakra';

/**
 * Options every `dynamic()` call in the module under test received. Named
 * `mock*` because jest hoists the factory below above this declaration and
 * rejects out-of-scope references that are not.
 */
const mockDynamicOptions: {
  ssr?: boolean;
  loading?: React.ComponentType;
}[] = [];

/** The loader each `dynamic()` call was given, so it can be resolved on demand. */
const mockDynamicLoaders: (() => Promise<unknown>)[] = [];

// `next/dynamic` would resolve the real loader, pulling MapLibre and the whole
// geovis workspace into jsdom. Capturing the options instead is what the module
// is: a declaration of how the map is loaded, not logic of its own.
jest.mock('next/dynamic', () => {
  return {
    __esModule: true,
    default: (
      loader: () => Promise<unknown>,
      options: { ssr?: boolean; loading?: React.ComponentType }
    ) => {
      mockDynamicLoaders.push(loader);
      mockDynamicOptions.push(options);
      return options.loading;
    },
  };
});

// Stands in for the chunk the loader pulls, so resolving it stays as cheap as
// declaring it — the point is which module is asked for, not what it renders.
jest.mock('src/app/(features)/mapas/MapaPlayground', () => {
  return {
    __esModule: true,
    default: () => {
      return <div data-testid="map-playground" />;
    },
  };
});

describe('MapaPlaygroundClient', () => {
  test('loads the map client-side only', async () => {
    await import('src/app/(features)/mapas/MapaPlaygroundClient');

    expect(mockDynamicOptions[0]?.ssr).toBe(false);
  });

  test('shows the map loading indicator while the chunk arrives', async () => {
    const { default: Fallback } =
      await import('src/app/(features)/mapas/MapaPlaygroundClient');

    // Without a fallback the boundary renders nothing, leaving the box the page
    // reserves empty until the chunk resolves.
    renderWithChakra(<Fallback />);

    expect(
      screen.getByRole('status', { name: 'Carregando mapa' })
    ).toBeInTheDocument();
  });

  test('points the boundary at the map chunk', async () => {
    await import('src/app/(features)/mapas/MapaPlaygroundClient');

    const loaded = await mockDynamicLoaders[0]?.();

    expect(loaded).toHaveProperty('default');
  });
});

import '@testing-library/jest-dom';

import { screen } from '@testing-library/react';
import MapasPage from 'src/app/(features)/mapas/page';

import { renderWithChakra } from './renderWithChakra';

// The map is behind a `ssr: false` dynamic import, so it contributes nothing to
// the initial HTML. Standing in for it here is the point of these tests: what
// is asserted is what the page renders *without* it.
jest.mock('src/app/(features)/mapas/MapaPlaygroundClient', () => {
  return {
    __esModule: true,
    default: () => {
      return <div data-testid="map-playground" />;
    },
  };
});

/**
 * Every rule Chakra's emotion runtime injected, whitespace stripped.
 *
 * Read off the sheets, not the `<style>` nodes: emotion injects through
 * `CSSStyleSheet.insertRule`, which leaves those nodes textless, so
 * `textContent` would be empty here no matter what was styled.
 */
const injectedCss = () => {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => {
      return Array.from(sheet.cssRules).map((rule) => {
        return rule.cssText;
      });
    })
    .join('')
    .replace(/\s/g, '');
};

describe('MapasPage', () => {
  test('reserves the map height outside the dynamic boundary', () => {
    renderWithChakra(<MapasPage />);

    // Without this rule the page paints at zero height until the map chunk
    // arrives, collapsing `<main>` and pulling the footer under the header.
    // `dvh` (not `vh`) so mobile URL-bar chrome does not overshoot the viewport,
    // and the header token (not a hardcoded px) so it tracks `DefaultLayout`.
    expect(injectedCss()).toMatch(
      /height:calc\(100dvh-var\(--chakra-sizes-header-height\)\)/
    );
  });

  test('renders the map inside the reserved box', () => {
    const { container } = renderWithChakra(<MapasPage />);

    const reservedBox = container.firstElementChild;
    expect(reservedBox).not.toBeNull();
    expect(reservedBox).toContainElement(screen.getByTestId('map-playground'));
  });
});

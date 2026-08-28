import { jestUnitConfig } from '@ttoss/config';

export default jestUnitConfig({
  // Custom jsdom env (adds structuredClone et al.) so Chakra renders under test.
  // The data-layer tests only read files, so a DOM env is harmless for them.
  testEnvironment: '<rootDir>/jsdomEnvironment.js',
  moduleNameMapper: {
    // Honor the `@/*` path alias (tsconfig) — @ttoss/config only maps CSS.
    '^@/(.*)$': '<rootDir>/../../src/$1',
  },
  // Two feature areas are covered by behavior, not line coverage, so their
  // presentational branches stay out of the gate:
  //
  // - MapaPlayground and the client-only modules it composes (the detail-sidebar
  //   panels and the tooltip-wiring hook) — their hover/click render branches
  //   aren't exercised under jsdom.
  // - The `/dados` presentational components, which only shape metadata the
  //   gateway already validated. `DadosPage.test.tsx` drives them end to end
  //   over the real catalogue; asserting each optional row again per component
  //   pinned markup, not behavior. Deliberately NOT listed: `DatasetGrid.tsx`
  //   (owns the selection state and the drawer), `page.tsx`,
  //   `catalogueLabels.ts` (pure formatters, unit-tested), and everything in
  //   `data-gateway`/`data-source-static`.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'MapaPlayground\\.tsx$',
    'mapaDetailSidebars\\.tsx$',
    'useMapaTooltips\\.ts$',
    'dados/_components/CatalogueBadge\\.tsx$',
    'dados/_components/CatalogueHero\\.tsx$',
    'dados/_components/CatalogueLegend\\.tsx$',
    'dados/_components/DataDictionary\\.tsx$',
    'dados/_components/DatasetDetail\\.tsx$',
    'dados/_components/DatasetSummaryCard\\.tsx$',
  ],
  coverageThreshold: {
    global: {
      branches: 99.02,
      functions: 99.99,
      lines: 99.72,
      statements: 99.72,
    },
  },
});

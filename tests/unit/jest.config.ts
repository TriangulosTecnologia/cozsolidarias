import { jestUnitConfig } from '@ttoss/config';

export default jestUnitConfig({
  // Custom jsdom env (adds structuredClone et al.) so Chakra renders under test.
  // The data-layer tests only read files, so a DOM env is harmless for them.
  testEnvironment: '<rootDir>/jsdomEnvironment.js',
  moduleNameMapper: {
    // Honor the `@/*` path alias (tsconfig) — @ttoss/config only maps CSS.
    '^@/(.*)$': '<rootDir>/../../src/$1',
  },
  // MapaPlayground and the client-only modules it composes (the detail-sidebar
  // panels and the tooltip-wiring hook) are covered by behavior (the mode
  // toggle), not line coverage: their hover/click render branches aren't
  // exercised under jsdom, so keep them out of the gate.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'MapaPlayground\\.tsx$',
    'mapaDetailSidebars\\.tsx$',
    'useMapaTooltips\\.ts$',
  ],
  coverageThreshold: {
    global: {
      branches: 97.95,
      functions: 99.99,
      lines: 99.45,
      statements: 99.45,
    },
  },
});

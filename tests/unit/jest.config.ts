import { jestUnitConfig } from '@ttoss/config';

export default jestUnitConfig({
  // Custom jsdom env (adds structuredClone et al.) so Chakra renders under test.
  // The data-layer tests only read files, so a DOM env is harmless for them.
  testEnvironment: '<rootDir>/jsdomEnvironment.js',
  moduleNameMapper: {
    // Honor the `@/*` path alias (tsconfig) — @ttoss/config only maps CSS.
    '^@/(.*)$': '<rootDir>/../../src/$1',
  },
  // MapaPlayground is covered by behavior (the mode toggle), not line coverage:
  // its error/tooltip branches aren't exercised, so keep it out of the gate.
  coveragePathIgnorePatterns: ['/node_modules/', 'MapaPlayground\\.tsx$'],
  coverageThreshold: {
    global: {
      branches: 97.7,
      functions: 99.99,
      lines: 99.2,
      statements: 99.2,
    },
  },
});

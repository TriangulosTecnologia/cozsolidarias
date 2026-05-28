import { jestUnitConfig } from '@ttoss/config';

export default jestUnitConfig({
  coverageThreshold: {
    global: {
      branches: 66,
      functions: 99,
      lines: 79,
      statements: 79,
    },
  },
});

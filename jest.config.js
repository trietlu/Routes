/**
 * Root Jest config. One project per workspace that has tests, so a single
 * `npm test` covers unit, integration and component levels (test plan §1).
 *
 * Coverage thresholds come from the test plan's coverage gates. They are
 * declared per source directory, so a package that does not exist yet does
 * not fail the gate, and each package is held to its own number.
 */

/** Workspaces are symlinked into node_modules; map them to source so tests need no build. */
const moduleNameMapper = {
  '^@routes/api-types$': '<rootDir>/packages/api-types/src/index.ts',
  '^@routes/routing-core$': '<rootDir>/packages/routing-core/src/index.ts',
};

/** @param {{displayName: string, roots: string[]}} options */
function tsProject({ displayName, roots }) {
  return {
    displayName,
    roots,
    testEnvironment: 'node',
    moduleNameMapper,
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
    },
  };
}

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    tsProject({ displayName: 'api-types', roots: ['<rootDir>/packages/api-types/src'] }),
    tsProject({ displayName: 'routing-core', roots: ['<rootDir>/packages/routing-core/src'] }),
    tsProject({ displayName: 'proxy', roots: ['<rootDir>/apps/proxy/src'] }),
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    'apps/proxy/src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    'packages/routing-core/src/**/*.ts': { lines: 95 },
    'packages/api-types/src/**/*.ts': { lines: 90 },
    'apps/proxy/src/**/*.ts': { lines: 85 },
  },
};

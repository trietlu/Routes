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
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper,
    transform: {
      '^.+\\.tsx?$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
    },
  };
}

/**
 * The Expo app: jest-expo (iOS) preset with React Native Testing Library and
 * the native-module mocks in apps/mobile/test/mocks.
 */
const path = require('node:path');
const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

const MOBILE_ROOT = path.join(__dirname, 'apps/mobile');

const mobileProject = {
  displayName: 'mobile',
  preset: 'jest-expo/ios',
  rootDir: MOBILE_ROOT,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/ios/', '/android/'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // routing-core and api-types are measured by their own (ts-jest) projects;
  // Babel's instrumentation of the same files would skew their merged coverage.
  coveragePathIgnorePatterns: ['/node_modules/', '/packages/'],
  // jest-expo resolves Babel options from the working directory, which is the
  // repo root under `npm test`; point it at the app instead.
  transform: { '\\.[jt]sx?$': ['babel-jest', resolveBabelOptions(MOBILE_ROOT)] },
  moduleNameMapper: {
    '^@routes/api-types$': '<rootDir>/../../packages/api-types/src/index.ts',
    '^@routes/routing-core$': '<rootDir>/../../packages/routing-core/src/index.ts',
  },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    tsProject({ displayName: 'api-types', roots: ['<rootDir>/packages/api-types/src'] }),
    tsProject({ displayName: 'routing-core', roots: ['<rootDir>/packages/routing-core/src'] }),
    tsProject({ displayName: 'proxy', roots: ['<rootDir>/apps/proxy/src'] }),
    tsProject({ displayName: 'scripts', roots: ['<rootDir>/scripts'] }),
    mobileProject,
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    'apps/proxy/src/**/*.ts',
    // Mobile non-UI modules (test plan §1). Jest has matched these globs against
    // the repo root in CI but against the project's rootDir (apps/mobile) locally,
    // so each folder is listed both ways. Add handoff/ the same
    // way when it lands.
    'apps/mobile/storage/**/*.ts',
    'storage/**/*.ts',
    'apps/mobile/api/**/*.{ts,tsx}',
    'api/**/*.{ts,tsx}',
    'apps/mobile/state/**/*.{ts,tsx}',
    'state/**/*.{ts,tsx}',
    'apps/mobile/location/**/*.ts',
    'location/**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    'packages/routing-core/src/**/*.ts': { lines: 95 },
    'packages/api-types/src/**/*.ts': { lines: 90 },
    'apps/proxy/src/**/*.ts': { lines: 85 },
    'apps/mobile/storage/**/*.ts': { lines: 80 },
    'apps/mobile/api/**/*.{ts,tsx}': { lines: 80 },
    'apps/mobile/state/**/*.{ts,tsx}': { lines: 80 },
    'apps/mobile/location/**/*.ts': { lines: 80 },
  },
};

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports, so they must use require(). */
/**
 * Native modules are mocked for every test (test plan §7): maps, location,
 * SQLite, linking and network state. The mocks live in `test/mocks/`.
 */
jest.mock('react-native-maps', () => require('./mocks/react-native-maps'));
jest.mock('expo-location', () => require('./mocks/expo-location'));
jest.mock('expo-sqlite', () => require('./mocks/expo-sqlite'));
jest.mock('expo-linking', () => require('./mocks/expo-linking'));
jest.mock('@react-native-community/netinfo', () => require('./mocks/netinfo'));
// SafeAreaProvider renders nothing until native insets arrive; use the library's mock.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

import * as ReactNative from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { rankRoutes } from '@routes/routing-core';
import { ResultsMap } from '../features/results/ResultsMap';
import { DARK } from '../theme';
import { fixtureRoutes } from './fixtures';

let mockMapProvider: 'default' | 'google' = 'default';
jest.mock('../config/env', () => ({
  getAppConfig: () => ({
    proxyUrl: 'http://localhost:8080',
    appEnv: 'test',
    mapProvider: mockMapProvider,
  }),
}));

const options = rankRoutes(fixtureRoutes('fixture-union-station'), 'fastest').options;
const props = {
  start: { lat: 39.7392, lng: -104.9903 },
  destination: { placeId: 'fixture-union-station', lat: 39.8255, lng: -104.906 },
  options,
  selected: 'A' as const,
  mode: 'fastest' as const,
  onSelect: jest.fn(),
  sheetHeight: 300,
};

afterEach(() => {
  jest.restoreAllMocks();
  mockMapProvider = 'default';
});

describe('ResultsMap', () => {
  it('works with MAP_PROVIDER=default (Apple Maps) and google', async () => {
    await render(<ResultsMap {...props} />);
    expect(screen.getByTestId('results-map').props.provider).toBeUndefined();
    mockMapProvider = 'google';
    await render(<ResultsMap {...props} />);
    expect(screen.getByTestId('results-map').props.provider).toBe('google');
  });

  it('uses the dark-mode route colors in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    await render(<ResultsMap {...props} />);
    expect(
      screen.getByTestId('route-line-A', { includeHiddenElements: true }).props.strokeColor,
    ).toBe(DARK.routeA);
    expect(
      screen.getByTestId('route-line-B', { includeHiddenElements: true }).props.strokeColor,
    ).toBe(`${DARK.routeB}99`);
  });

  it('with no routes yet, shows only the pins and does not move the camera', async () => {
    await render(<ResultsMap {...props} options={[]} />);
    expect(screen.queryAllByTestId(/^route-line-/, { includeHiddenElements: true })).toHaveLength(
      0,
    );
    expect(screen.getByTestId('pin-start', { includeHiddenElements: true })).toBeTruthy();
  });
});

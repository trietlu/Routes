import * as Location from 'expo-location';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { type RoutesRequest, type RoutesResponse } from '@routes/api-types';
import { ApiError, type ApiClient } from '../api';
import { a11yProblems, pressables } from './a11y';
import { renderApp, useTestApi, useTestStorage } from './appHarness';
import { fixtureRoutes } from './fixtures';
import { mapMethods } from './mocks/react-native-maps';
import { LIGHT } from '../theme';
import { SELECTED_WIDTH, SHEET_MARGIN, UNSELECTED_WIDTH } from '../features/results/ResultsMap';

const mocked = Location as unknown as Record<string, jest.Mock>;

function fakeClient() {
  return {
    routes: jest.fn(async (request: RoutesRequest): Promise<RoutesResponse> => ({
      routes: fixtureRoutes(request.destination.placeId ?? 'fixture-union-station'),
    })),
    autocomplete: jest.fn(async () => ({ suggestions: [] })),
    details: jest.fn(async () => ({ placeId: 'p', name: 'n', address: 'a', lat: 0, lng: 0 })),
  } satisfies ApiClient;
}

const PLACES: Record<string, { name: string; address: string }> = {
  'fixture-union-station': { name: 'Union Station', address: '100 Union Plaza' },
  'fixture-two-routes': { name: 'Two Routes Test', address: '2 Test Way' },
  'fixture-unknown-toll': { name: 'Unknown Toll Test', address: '7 Test Way' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getForegroundPermissionsAsync!.mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  });
  mocked.getCurrentPositionAsync!.mockResolvedValue({
    coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 },
    timestamp: 0,
  });
  mocked.reverseGeocodeAsync!.mockResolvedValue([{ streetNumber: '1437', street: 'Bannock St' }]);
});

/** Home → tap the destination as a recent → Results. */
async function openResults(placeId = 'fixture-union-station', client = fakeClient()) {
  useTestApi(client);
  const { name, address } = PLACES[placeId]!;
  await useTestStorage(async (s) => {
    await s.preferences.setLocationPromptShown(true);
    await s.places.addRecent({ name, address, placeId, lat: 39.8255, lng: -104.906 });
  });
  await renderApp('/');
  await waitFor(() =>
    expect(screen.getByTestId('field-from')).toHaveProp(
      'accessibilityLabel',
      'From: Current location, 1437 Bannock St',
    ),
  );
  await fireEvent.press(screen.getByRole('button', { name: `${name}, ${address}` }));
  await screen.findByText('Ranked by travel time');
  return client;
}

/** Every text in a card, in order. */
const cardTexts = async (letter: string) => {
  const card = await screen.findByTestId(`route-card-${letter}`);
  return within(card)
    .getAllByText(/.+/)
    .map((node) => node.props.children as string);
};

describe('Screen 4 — Results sheet', () => {
  it('UI-RES-01: canonical Fastest cards match test plan §2 exactly', async () => {
    await openResults();
    expect(await screen.findByRole('header', { name: '3 routes' })).toBeTruthy();
    expect(screen.getByText('Ranked by travel time')).toBeTruthy();
    expect(screen.getByText('Current location → Union Station')).toBeTruthy();
    expect(await cardTexts('A')).toEqual([
      'A',
      '22 min',
      '9.8 mi',
      'FASTEST',
      'via Hwy 12',
      'Best of 3',
      '$5.12',
      'est.',
      '$3.75 toll',
    ]);
    expect(await cardTexts('B')).toEqual([
      'B',
      '27 min',
      '10.6 mi',
      'via Elm Ave & 3rd St',
      '5 min slower · saves $3.64',
      '$1.48',
      'est.',
      'No tolls',
    ]);
    expect(await cardTexts('C')).toEqual([
      'C',
      '31 min',
      '8.9 mi',
      'via Main St',
      '9 min slower · saves $3.87',
      '$1.25',
      'est.',
      'No tolls',
    ]);
  });

  it('UI-RES-02: Cheapest cards match §2, subtitle "Ranked by trip cost", no refetch', async () => {
    const client = await openResults();
    await screen.findByTestId('route-card-A');
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    expect(screen.getByText('Ranked by trip cost')).toBeTruthy();
    expect(await cardTexts('A')).toEqual([
      'A',
      '31 min',
      '8.9 mi',
      'CHEAPEST',
      'via Main St',
      'Best of 3',
      '$1.25',
      'est.',
      'No tolls',
    ]);
    expect(await cardTexts('B')).toEqual([
      'B',
      '27 min',
      '10.6 mi',
      'via Elm Ave & 3rd St',
      '4 min faster · $0.23 more',
      '$1.48',
      'est.',
      'No tolls',
    ]);
    expect(await cardTexts('C')).toEqual([
      'C',
      '22 min',
      '9.8 mi',
      'via Hwy 12',
      '9 min faster · $3.87 more',
      '$5.12',
      'est.',
      '$3.75 toll',
    ]);
    expect(client.routes).toHaveBeenCalledTimes(1);
  });

  it('UI-RES-03: tapping card B selects it; the button reads "Go with route B"', async () => {
    await openResults();
    await fireEvent.press(await screen.findByTestId('route-card-B'));
    expect(screen.getByTestId('route-card-B')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByTestId('route-card-A')).toHaveProp('accessibilityState', {
      selected: false,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Go with route B' }));
    expect(
      await screen.findByRole('header', { name: 'via Elm Ave & 3rd St · Union Station' }),
    ).toBeTruthy(); // Route detail
  });

  it('a mode change selects the new A', async () => {
    await openResults();
    await fireEvent.press(await screen.findByTestId('route-card-C'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    expect(screen.getByRole('button', { name: 'Go with route A' })).toBeTruthy();
  });

  it('UI-RES-07: the two-route fixture → "Only 2 routes found", "Best of 2"', async () => {
    await openResults('fixture-two-routes');
    expect(await screen.findByRole('header', { name: 'Only 2 routes found' })).toBeTruthy();
    expect(screen.getByText('Best of 2')).toBeTruthy();
    expect(screen.queryByTestId('route-card-C')).toBeNull();
  });

  it('UI-RES-08: unknown toll → "Toll, price unknown", "$X.XX + toll", "cost unknown", last in Cheapest', async () => {
    await openResults('fixture-unknown-toll');
    const a = await cardTexts('A'); // Fastest: X (24 min) first
    expect(a).toEqual(expect.arrayContaining(['24 min', 'Toll, price unknown']));
    expect(a.find((text) => /^\$\d+\.\d\d \+ toll$/.test(text))).toBeTruthy();
    expect(await cardTexts('B')).toEqual(expect.arrayContaining(['6 min slower · cost unknown']));

    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    expect(await cardTexts('B')).toEqual(
      expect.arrayContaining(['24 min', 'Toll, price unknown', '6 min faster · cost unknown']),
    );
  });

  it('UI-RES-09: loading shows the skeleton, and the map shows both pins', async () => {
    const client = fakeClient();
    client.routes.mockImplementation(() => new Promise(() => undefined));
    useTestApi(client);
    await useTestStorage(async (s) => {
      await s.preferences.setLocationPromptShown(true);
      await s.places.addRecent({
        name: 'Union Station',
        address: '100 Union Plaza',
        placeId: 'fixture-union-station',
        lat: 39.8255,
        lng: -104.906,
      });
    });
    await renderApp('/');
    await waitFor(() =>
      expect(screen.getByTestId('field-from')).toHaveProp(
        'accessibilityLabel',
        'From: Current location, 1437 Bannock St',
      ),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Union Station, 100 Union Plaza' }));
    expect(await screen.findByLabelText('Loading routes')).toBeTruthy();
    expect(screen.getByTestId('pin-start')).toHaveProp('coordinate', {
      latitude: 39.7392,
      longitude: -104.9903,
    });
    expect(screen.getByTestId('pin-destination')).toHaveProp('coordinate', {
      latitude: 39.8255,
      longitude: -104.906,
    });
  });

  it.each([
    ['noRoute', 'No driving route found', 'Change destination'],
    ['generic', "Couldn't load routes", 'Retry'],
    ['offline', "You're offline", 'Retry'],
    ['rateLimited', 'Too many requests. Try again in a minute.', 'Retry'],
  ] as const)('UI-RES-10: %s shows "%s" with %s, and the pins', async (kind, copy, action) => {
    const client = fakeClient();
    client.routes.mockRejectedValue(new ApiError(kind, kind));
    await openResults('fixture-union-station', client);
    // Generic failures are retried once (after ~1 s) before the error shows.
    expect(await screen.findByText(copy, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: action })).toBeTruthy();
    expect(screen.getByTestId('pin-start')).toBeTruthy();
    expect(screen.getByTestId('pin-destination')).toBeTruthy();
  });

  it('UI-RES-10: Retry loads the routes', async () => {
    const client = fakeClient();
    client.routes.mockRejectedValueOnce(new ApiError('rateLimited', 'slow down'));
    await openResults('fixture-union-station', client);
    await fireEvent.press(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('route-card-A')).toBeTruthy();
  });

  it('UI-RES-10: Change destination opens Search', async () => {
    const none = fakeClient();
    none.routes.mockRejectedValue(new ApiError('noRoute', 'none'));
    await openResults('fixture-union-station', none);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change destination' }));
    expect(await screen.findByLabelText('Destination')).toBeTruthy();
  });

  it('UI-RES-11: every card cost shows "est."', async () => {
    await openResults();
    for (const letter of ['A', 'B', 'C']) {
      expect(
        within(await screen.findByTestId(`route-card-${letter}`)).getByText('est.'),
      ).toBeTruthy();
    }
  });

  it('UI-A11Y-04: cards include the letter in text and in the spoken label', async () => {
    await openResults();
    expect(await screen.findByTestId('route-card-A')).toHaveProp(
      'accessibilityLabel',
      'Route A, fastest, 22 minutes, 9.8 miles, via Hwy 12, estimated cost $5.12 including $3.75 toll',
    );
    for (const letter of ['A', 'B', 'C']) {
      const card = screen.getByTestId(`route-card-${letter}`);
      expect(card.props.accessibilityLabel).toMatch(new RegExp(`^Route ${letter}, `));
      expect(within(card).getByText(letter)).toBeTruthy();
    }
  });

  it('Back returns to Home', async () => {
    await openResults();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
    expect(await screen.findByText('Show me the')).toBeTruthy();
  });

  it('UI-A11Y-01 / UI-A11Y-02: every pressable has a role, a label and a 44 pt target', async () => {
    await openResults();
    await screen.findByTestId('route-card-C');
    expect(pressables(screen.root).length).toBeGreaterThanOrEqual(7);
    expect(a11yProblems(screen.root)).toEqual([]);
  });
});

describe('Screen 4 — Results map', () => {
  const line = (letter: string) =>
    screen.getByTestId(`route-line-${letter}`, { includeHiddenElements: true });
  const bubble = (letter: string) =>
    screen.getByTestId(`route-bubble-${letter}`, { includeHiddenElements: true });

  it('UI-RES-04: three polylines in the A/B/C colors; the selected one is wider and on top; bubbles read "A · 22 min"', async () => {
    await openResults();
    await screen.findByTestId('route-card-C');
    expect(screen.getAllByTestId(/^route-line-/, { includeHiddenElements: true })).toHaveLength(3);
    expect(line('A').props).toMatchObject({
      strokeColor: LIGHT.routeA,
      strokeWidth: SELECTED_WIDTH,
      zIndex: 3,
      tappable: true,
    });
    expect(line('B').props).toMatchObject({
      strokeColor: `${LIGHT.routeB}99`,
      strokeWidth: UNSELECTED_WIDTH,
      zIndex: 1,
    });
    expect(line('C').props).toMatchObject({
      strokeColor: `${LIGHT.routeC}99`,
      strokeWidth: UNSELECTED_WIDTH,
      zIndex: 1,
    });
    expect(line('A').props.coordinates.length).toBeGreaterThan(10);

    for (const [letter, text] of [
      ['A', 'A · 22 min'],
      ['B', 'B · 27 min'],
      ['C', 'C · 31 min'],
    ]) {
      expect(
        within(bubble(letter!)).getByText(text!, { includeHiddenElements: true }),
      ).toBeTruthy();
    }

    // Selecting B by its card moves the emphasis.
    await fireEvent.press(screen.getByTestId('route-card-B'));
    expect(line('B').props).toMatchObject({
      strokeColor: LIGHT.routeB,
      strokeWidth: SELECTED_WIDTH,
      zIndex: 3,
    });
    expect(line('A').props).toMatchObject({ strokeWidth: UNSELECTED_WIDTH, zIndex: 1 });
  });

  it('UI-RES-05: pressing polyline C, or bubble B, selects that route', async () => {
    await openResults();
    await screen.findByTestId('route-card-C');
    await fireEvent.press(line('C'));
    expect(screen.getByTestId('route-card-C')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByRole('button', { name: 'Go with route C' })).toBeTruthy();
    await fireEvent.press(bubble('B'));
    expect(screen.getByRole('button', { name: 'Go with route B' })).toBeTruthy();
  });

  it('UI-RES-06: fitToCoordinates keeps the routes above the sheet, on load and on mode change', async () => {
    mapMethods.fitToCoordinates.mockClear();
    await openResults();
    await screen.findByTestId('route-card-C');
    await fireEvent(screen.getByTestId('results-sheet'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 400, width: 390, height: 420 } },
    });
    const lastCall = () =>
      mapMethods.fitToCoordinates.mock.calls.at(-1) as [
        unknown[],
        { edgePadding: { bottom: number } },
      ];
    await waitFor(() => expect(lastCall()[1].edgePadding.bottom).toBe(420 + SHEET_MARGIN));
    expect(lastCall()[1].edgePadding.bottom).toBeGreaterThanOrEqual(420);
    // Every route's points are in the fit.
    const total = ['A', 'B', 'C'].reduce((sum, l) => sum + line(l).props.coordinates.length, 0);
    expect(lastCall()[0]).toHaveLength(total);

    const calls = mapMethods.fitToCoordinates.mock.calls.length;
    await fireEvent.press(screen.getByRole('radio', { name: 'Cheapest' }));
    await waitFor(() =>
      expect(mapMethods.fitToCoordinates.mock.calls.length).toBeGreaterThan(calls),
    );
  });

  it('UI-A11Y-04: bubbles include the letter, in text and in their label', async () => {
    await openResults();
    await screen.findByTestId('route-card-A');
    expect(bubble('A')).toHaveProp('accessibilityLabel', 'Route A, 22 minutes');
    expect(bubble('B')).toHaveProp('accessibilityLabel', 'Route B, 27 minutes');
    expect(bubble('C')).toHaveProp('accessibilityLabel', 'Route C, 31 minutes');
  });

  it('the start and destination pins stay with the routes', async () => {
    await openResults();
    await screen.findByTestId('route-card-A');
    expect(screen.getByTestId('pin-start', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('pin-destination', { includeHiddenElements: true })).toBeTruthy();
  });
});

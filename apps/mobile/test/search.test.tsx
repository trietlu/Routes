import * as Location from 'expo-location';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import {
  type AutocompleteQuery,
  type AutocompleteResponse,
  type PlaceDetails,
  type PlaceDetailsQuery,
  type RoutesRequest,
  type RoutesResponse,
} from '@routes/api-types';
import { ApiError, type ApiClient } from '../api';
import { type Storage } from '../storage';
import { a11yProblems, pressables } from './a11y';
import { renderApp, useTestApi, useTestStorage } from './appHarness';

const mocked = Location as unknown as Record<string, jest.Mock>;
const MILE = 1609.344;

const UNION_SUGGESTIONS: AutocompleteResponse = {
  suggestions: [
    {
      placeId: 'fixture-union-station',
      primaryText: 'Union Station',
      secondaryText: '100 Union Plaza',
      distanceMeters: Math.round(9.1 * MILE),
    },
    {
      placeId: 'fixture-union-street-market',
      primaryText: 'Union Street Market',
      secondaryText: '42 Union St',
      distanceMeters: Math.round(4.3 * MILE),
    },
    {
      placeId: 'fixture-union-st-9th-ave',
      primaryText: 'Union St & 9th Ave',
      secondaryText: 'Intersection',
      distanceMeters: Math.round(6.8 * MILE),
    },
  ],
};
const DETAILS: Record<string, PlaceDetails> = {
  'fixture-union-station': {
    placeId: 'fixture-union-station',
    name: 'Union Station',
    address: '100 Union Plaza',
    lat: 39.8255,
    lng: -104.906,
  },
  'fixture-union-street-market': {
    placeId: 'fixture-union-street-market',
    name: 'Union Street Market',
    address: '42 Union St',
    lat: 39.79,
    lng: -104.95,
  },
};

function fakeClient() {
  return {
    routes: jest.fn(async (_r: RoutesRequest): Promise<RoutesResponse> => ({ routes: [] })),
    autocomplete: jest.fn(async (query: AutocompleteQuery): Promise<AutocompleteResponse> =>
      query.q.toLowerCase().startsWith('union') ? UNION_SUGGESTIONS : { suggestions: [] },
    ),
    details: jest.fn(
      async (query: PlaceDetailsQuery): Promise<PlaceDetails> => DETAILS[query.placeId]!,
    ),
  } satisfies ApiClient;
}

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

async function open(
  url: string,
  seed?: (storage: Storage) => Promise<void>,
  client = fakeClient(),
) {
  useTestApi(client);
  const storage = await useTestStorage(async (s) => {
    await s.preferences.setLocationPromptShown(true);
    await seed?.(s);
  });
  await renderApp(url);
  return { storage, client };
}

const input = () => screen.getByTestId('search-input');

describe('Screen 3 — Search', () => {
  it('UI-SRCH-01: typing "Union" shows 3 suggestions with distances "9.1 mi" etc.', async () => {
    const { client } = await open('/search?field=to');
    await waitFor(() =>
      expect(screen.getByTestId('search-other')).toHaveProp(
        'accessibilityLabel',
        'Current location, 1437 Bannock St',
      ),
    );
    await fireEvent.changeText(input(), 'Union');
    expect(await screen.findByText('Union Station')).toBeTruthy();
    expect(screen.getByText('Union Street Market')).toBeTruthy();
    expect(screen.getByText('Union St & 9th Ave')).toBeTruthy();
    expect(['9.1 mi', '4.3 mi', '6.8 mi'].map((d) => screen.getByText(d))).toHaveLength(3);
    expect(
      screen.getByRole('button', { name: 'Union Station, 100 Union Plaza, 9.1 mi' }),
    ).toBeTruthy();
    expect(client.autocomplete).toHaveBeenCalledWith({
      q: 'Union',
      lat: 39.7392,
      lng: -104.9903,
      session: expect.any(String),
    });
  });

  it('debounce and minimum length come from the hook: typing fast makes one call', async () => {
    const { client } = await open('/search?field=to');
    for (const text of ['U', 'Un', 'Uni', 'Unio', 'Union'])
      await fireEvent.changeText(input(), text);
    await screen.findByText('Union Station');
    expect(client.autocomplete).toHaveBeenCalledTimes(1);
    // Under 2 characters the list goes back to recents and saved places, with no new call
    // (the hook's min-length rule; timing is covered with fake timers in APP-API-03).
    await fireEvent.changeText(input(), 'U');
    expect(screen.queryByText('Union Station')).toBeNull();
    expect(client.autocomplete).toHaveBeenCalledTimes(1);
  });

  it('hides distances when the start is unknown', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });
    await open('/search?field=to');
    await fireEvent.changeText(input(), 'Union');
    await screen.findByText('Union Station');
    expect(screen.queryByText('9.1 mi')).toBeNull();
    expect(screen.getByRole('button', { name: 'Union Station, 100 Union Plaza' })).toBeTruthy();
  });

  it('UI-SRCH-02: there is no "Choose on map" row', async () => {
    await open('/search?field=to');
    await fireEvent.changeText(input(), 'Union');
    await screen.findByText('Union Station');
    expect(screen.queryByText(/choose on map/i)).toBeNull();
  });

  it('UI-SRCH-03: picking a result saves a recent and opens Results when both ends are set', async () => {
    const { storage, client } = await open('/search?field=to');
    await waitFor(() =>
      expect(screen.getByTestId('search-other')).toHaveProp(
        'accessibilityLabel',
        'Current location, 1437 Bannock St',
      ),
    );
    await fireEvent.changeText(input(), 'Union');
    await fireEvent.press(await screen.findByText('Union Station'));
    expect(await screen.findByRole('header', { name: 'Routes' })).toBeTruthy();
    expect(client.details).toHaveBeenCalledWith({
      placeId: 'fixture-union-station',
      session: expect.any(String),
    });
    expect((await storage.places.listRecents()).map((p) => p.placeId)).toEqual([
      'fixture-union-station',
    ]);
  });

  it('picking a start without a destination returns Home with From filled', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });
    await open('/');
    await fireEvent.press(await screen.findByTestId('field-from'));
    await fireEvent.changeText(await screen.findByLabelText('Start address'), 'Union');
    await fireEvent.press(await screen.findByText('Union Street Market'));
    await waitFor(() =>
      expect(screen.getByTestId('field-from')).toHaveProp(
        'accessibilityLabel',
        'From: Union Street Market, 42 Union St',
      ),
    );
  });

  it('before typing, lists recents and saved places; tapping one picks it', async () => {
    const { storage } = await open('/search?field=to', async (s) => {
      await s.places.addRecent({
        name: 'Harbor Clinic',
        address: '22 Harbor Rd',
        placeId: 'harbor',
        lat: 39.7,
        lng: -105,
      });
      await s.places.setSaved('work', {
        name: 'Work',
        address: '2 Work Ave',
        placeId: 'work-1',
        lat: 39.75,
        lng: -104.98,
      });
    });
    expect(await screen.findByRole('button', { name: 'Harbor Clinic, 22 Harbor Rd' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('search-other')).toHaveProp(
        'accessibilityLabel',
        'Current location, 1437 Bannock St',
      ),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Work, 2 Work Ave' }));
    expect(await screen.findByRole('header', { name: 'Routes' })).toBeTruthy();
    expect((await storage.places.listRecents())[0]!.placeId).toBe('work-1');
  });

  it('UI-SRCH-04: no results, and error with Retry', async () => {
    const client = fakeClient();
    await open('/search?field=to', undefined, client);
    await fireEvent.changeText(input(), 'Zebra');
    expect(await screen.findByText("No places match 'Zebra'")).toBeTruthy();

    client.autocomplete.mockRejectedValueOnce(new ApiError('generic', 'boom'));
    await fireEvent.changeText(input(), 'Union');
    expect(await screen.findByText("Search isn't available right now")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Union Station')).toBeTruthy();
  });

  it('a failed details call shows the error state', async () => {
    const client = fakeClient();
    client.details.mockRejectedValueOnce(new ApiError('offline', 'offline'));
    await open('/search?field=to', undefined, client);
    await fireEvent.changeText(input(), 'Union');
    await fireEvent.press(await screen.findByText('Union Station'));
    expect(await screen.findByText("Search isn't available right now")).toBeTruthy();
  });

  it('the clear button empties the field; Back returns Home', async () => {
    await open('/');
    await fireEvent.press(await screen.findByTestId('field-to'));
    await fireEvent.changeText(await screen.findByLabelText('Destination'), 'Union');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(input()).toHaveProp('value', '');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Show me the')).toBeTruthy();
  });

  it('UI-SRCH-05: Set Home saves Home and returns to Home', async () => {
    const { storage } = await open('/');
    await fireEvent.press(await screen.findByRole('button', { name: 'Set Home' }));
    expect(await screen.findByRole('header', { name: 'Set Home' })).toBeTruthy();
    await fireEvent.changeText(input(), 'Union');
    await fireEvent.press(await screen.findByText('Union Station'));
    expect(await screen.findByRole('button', { name: 'Home, 100 Union Plaza' })).toBeTruthy();
    expect(await storage.places.getSaved('home')).toMatchObject({
      placeId: 'fixture-union-station',
      kind: 'home',
    });
    expect(await storage.places.listRecents()).toEqual([]);
  });

  it('S2: a saved row offers Change and Remove', async () => {
    const { storage } = await open('/', (s) =>
      s.places
        .setSaved('home', {
          name: 'Home',
          address: '1 Home St',
          placeId: 'home-1',
          lat: 39.7,
          lng: -105,
        })
        .then(() => undefined),
    );
    const row = await screen.findByRole('button', { name: 'Home, 1 Home St' });
    expect(row.props.accessibilityActions).toEqual([
      { name: 'change', label: 'Change' },
      { name: 'remove', label: 'Remove' },
    ]);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'remove' } });
    expect(await screen.findByRole('button', { name: 'Set Home' })).toBeTruthy();
    expect(await storage.places.getSaved('home')).toBeNull();
  });

  it('UI-A11Y-01 / UI-A11Y-02: every pressable has a role, a label and a 44 pt target', async () => {
    await open('/search?field=to');
    await fireEvent.changeText(input(), 'Union');
    await screen.findByText('Union Station');
    expect(pressables(screen.root).length).toBeGreaterThanOrEqual(5);
    expect(a11yProblems(screen.root)).toEqual([]);
  });
});

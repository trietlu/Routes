import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { type Storage } from '../storage';
import { type PlaceInput } from '../storage/places';
import { a11yProblems, pressables } from './a11y';
import { renderApp, useTestStorage } from './appHarness';
import { resetNetworkState, setNetworkState } from './mocks/netinfo';

const mocked = Location as unknown as Record<string, jest.Mock>;
const granted = { status: 'granted', granted: true, canAskAgain: true };
const denied = { status: 'denied', granted: false, canAskAgain: false };

const place = (name: string, address: string, placeId: string): PlaceInput => ({
  name,
  address,
  placeId,
  lat: 39.8,
  lng: -104.9,
});
const UNION = place('Union Station', '100 Union Plaza', 'fixture-union-station');
const CLINIC = place('Harbor Clinic', '22 Harbor Rd', 'harbor-clinic');

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getForegroundPermissionsAsync!.mockResolvedValue(granted);
  mocked.getCurrentPositionAsync!.mockResolvedValue({
    coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 },
    timestamp: 0,
  });
  mocked.reverseGeocodeAsync!.mockResolvedValue([{ streetNumber: '1437', street: 'Bannock St' }]);
});
afterEach(() => resetNetworkState());

async function showHome(seed?: (storage: Storage) => Promise<void>) {
  const storage = await useTestStorage(async (s) => {
    await s.preferences.setLocationPromptShown(true);
    await seed?.(s);
  });
  await renderApp('/');
  await screen.findByText('Show me the');
  return storage;
}

const fromField = () => screen.getByTestId('field-from');
const toField = () => screen.getByTestId('field-to');

describe('Screen 2 — Home', () => {
  it('UI-HOME-01: granted → From shows "Current location" with the street address in its label', async () => {
    await showHome();
    await waitFor(() =>
      expect(fromField()).toHaveProp(
        'accessibilityLabel',
        'From: Current location, 1437 Bannock St',
      ),
    );
    expect(within(fromField()).getByText('Current location')).toBeTruthy();
    expect(within(toField()).getByText('Where to?')).toBeTruthy();
    expect(screen.queryByText('Location is off.')).toBeNull();
    expect(screen.getByTestId('recenter')).toBeTruthy();
  });

  it('shows "Finding your location…" until the first fix', async () => {
    let deliver: (value: unknown) => void = () => undefined;
    mocked.getCurrentPositionAsync!.mockImplementation(
      () => new Promise((done) => (deliver = done)),
    );
    await showHome();
    expect(within(fromField()).getByText('Finding your location…')).toBeTruthy();
    // Deliver the fix so no timer outlives the test.
    deliver({ coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 }, timestamp: 0 });
    await waitFor(() => expect(within(fromField()).getByText('Current location')).toBeTruthy());
  });

  it('UI-HOME-02: denied → "Enter a start address" and a "Turn on in Settings" link to app-settings:', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(denied);
    await showHome();
    await waitFor(() =>
      expect(within(fromField()).getByText('Enter a start address')).toBeTruthy(),
    );
    expect(screen.getByText('Location is off.')).toBeTruthy();
    expect(screen.queryByTestId('recenter')).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Turn on in Settings' }));
    expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
  });

  it('unavailable location behaves like denied', async () => {
    mocked.getCurrentPositionAsync!.mockRejectedValue(new Error('no fix'));
    await showHome();
    await waitFor(() => expect(screen.getByText('Location is off.')).toBeTruthy());
  });

  it('UI-HOME-03: the swap button swaps the fields', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(denied);
    await showHome((s) => s.places.addRecent(UNION).then(() => undefined));
    // No start, so tapping a recent fills To without leaving Home.
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Union Station, 100 Union Plaza' }),
    );
    await waitFor(() => expect(within(toField()).getByText('Union Station')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Swap start and destination' }));
    expect(within(fromField()).getByText('Union Station')).toBeTruthy();
    expect(within(toField()).getByText('Where to?')).toBeTruthy();
  });

  it('UI-HOME-04: the mode toggle shows the persisted mode; changing it persists', async () => {
    const storage = await showHome((s) => s.preferences.setLastMode('cheapest'));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Cheapest' })).toBeSelected());
    expect(screen.getByRole('radio', { name: 'Fastest' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Fastest' }));
    expect(screen.getByRole('radio', { name: 'Fastest' })).toBeSelected();
    // Persisting is fire-and-forget; let it settle, then read storage.
    await act(async () => undefined);
    expect(await storage.preferences.getLastMode()).toBe('fastest');
  });

  it('UI-HOME-05: recents are listed most recent first; tapping one with a start set opens Results', async () => {
    const storage = await showHome(async (s) => {
      await s.places.addRecent(CLINIC);
      await s.places.addRecent(UNION);
    });
    const rows = await screen.findAllByTestId(/^recent-/);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Union Station, 100 Union Plaza',
      'Harbor Clinic, 22 Harbor Rd',
    ]);
    await waitFor(() => expect(within(fromField()).getByText('Current location')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Harbor Clinic, 22 Harbor Rd' }));
    expect(await screen.findByRole('header', { name: 'Routes' })).toBeTruthy(); // Results
    expect((await storage.places.listRecents())[0]!.placeId).toBe('harbor-clinic');
  });

  it('UI-HOME-06: Clear → confirm → recents gone, Home and Work kept', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    const storage = await showHome(async (s) => {
      await s.places.addRecent(UNION);
      await s.places.setSaved('home', place('Home', '1 Home St', 'home-1'));
      await s.places.setSaved('work', place('Work', '2 Work Ave', 'work-1'));
    });
    await screen.findByText('RECENT');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear recent destinations' }));
    expect(alert).toHaveBeenCalledWith(
      'Clear recent destinations?',
      'Saved places stay.',
      expect.any(Array),
    );
    await waitFor(() => expect(screen.queryByText('RECENT')).toBeNull());
    expect(await storage.places.listRecents()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Home, 1 Home St' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Work, 2 Work Ave' })).toBeTruthy();
    alert.mockRestore();
  });

  it('UI-HOME-06: cancelling the confirmation keeps recents', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await showHome((s) => s.places.addRecent(UNION).then(() => undefined));
    await fireEvent.press(await screen.findByRole('button', { name: 'Clear recent destinations' }));
    expect(screen.getByText('RECENT')).toBeTruthy();
    alert.mockRestore();
  });

  it('UI-HOME-07: unset Home shows "Set Home" and opens Set Home', async () => {
    await showHome();
    expect(screen.getByRole('button', { name: 'Set Work' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Set Home' }));
    expect(await screen.findByRole('header', { name: 'Set Home' })).toBeTruthy();
  });

  it('a saved place goes straight to Results and becomes a recent', async () => {
    const storage = await showHome((s) =>
      s.places.setSaved('work', place('Work', '2 Work Ave', 'work-1')).then(() => undefined),
    );
    await waitFor(() => expect(within(fromField()).getByText('Current location')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Work, 2 Work Ave' }));
    expect(await screen.findByRole('header', { name: 'Routes' })).toBeTruthy();
    expect((await storage.places.listRecents()).map((p) => p.placeId)).toEqual(['work-1']);
  });

  it('tapping From or To opens Search', async () => {
    await showHome();
    await fireEvent.press(toField());
    expect(await screen.findByRole('header', { name: 'Search' })).toBeTruthy();
  });

  it('UI-HOME-08: offline → banner with Retry; recents stay tappable', async () => {
    setNetworkState({ isConnected: false });
    await showHome((s) => s.places.addRecent(UNION).then(() => undefined));
    expect(screen.getByText("You're offline")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(fromField()).getByText('Current location')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Union Station, 100 Union Plaza' }));
    expect(await screen.findByRole('header', { name: 'Routes' })).toBeTruthy();
  });

  it('UI-A11Y-01 / UI-A11Y-02: every pressable has a role, a label and a 44 pt target', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(denied);
    setNetworkState({ isConnected: false });
    await showHome((s) => s.places.addRecent(UNION).then(() => undefined));
    await screen.findByText('Location is off.');
    expect(pressables(screen.root).length).toBeGreaterThanOrEqual(10);
    expect(a11yProblems(screen.root)).toEqual([]);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import {
  LOCATION_TIMEOUT_MS,
  deviceLocationSource,
  getPermissionStatus,
  locate,
  openAppSettings,
  requestPermission,
  streetAddress,
  useCurrentLocation,
} from '../location';

const mocked = Location as unknown as Record<string, jest.Mock>;
const granted = { status: 'granted', granted: true, canAskAgain: true };
const denied = { status: 'denied', granted: false, canAskAgain: false };
const undetermined = { status: 'undetermined', granted: false, canAskAgain: true };
const position = {
  coords: { latitude: 39.7392, longitude: -104.9903, accuracy: 10 },
  timestamp: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getForegroundPermissionsAsync!.mockResolvedValue(granted);
  mocked.requestForegroundPermissionsAsync!.mockResolvedValue(granted);
  mocked.getCurrentPositionAsync!.mockResolvedValue(position);
  mocked.reverseGeocodeAsync!.mockResolvedValue([{ streetNumber: '1437', street: 'Bannock St' }]);
});
afterEach(() => jest.useRealTimers());

describe('location', () => {
  it('APP-LOC-01: never requests permission unless asked', async () => {
    await renderHook(() => useCurrentLocation());
    await locate();
    await getPermissionStatus();
    await deviceLocationSource.getCurrentCoordinates();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    expect(await requestPermission()).toBe('granted');
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('APP-LOC-01: granted → coordinates and street address', async () => {
    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current).toMatchObject({
      state: 'ready',
      coords: { lat: 39.7392, lng: -104.9903 },
      address: '1437 Bannock St',
    });
    expect(await deviceLocationSource.getCurrentCoordinates()).toEqual({
      lat: 39.7392,
      lng: -104.9903,
    });
  });

  it('APP-LOC-01: denied or not yet asked → denied, with no location lookup', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(denied);
    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.state).toBe('denied'));
    expect(await getPermissionStatus()).toBe('denied');
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(undetermined);
    expect(await getPermissionStatus()).toBe('undetermined');
    expect(await locate()).toEqual({ state: 'denied' });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(await deviceLocationSource.getCurrentCoordinates()).toBeNull();

    mocked.requestForegroundPermissionsAsync!.mockResolvedValue(denied);
    expect(await requestPermission()).toBe('denied');
  });

  it('APP-LOC-02: no fix within 5 s → unavailable', async () => {
    expect(LOCATION_TIMEOUT_MS).toBe(5000);
    jest.useFakeTimers();
    mocked.getCurrentPositionAsync!.mockImplementation(() => new Promise(() => undefined));
    const pending = locate();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4999);
    });
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(await pending).toEqual({ state: 'unavailable' });
  });

  it('a location error → unavailable; a reverse-geocode failure still yields ready without an address', async () => {
    mocked.getCurrentPositionAsync!.mockRejectedValueOnce(new Error('kCLErrorLocationUnknown'));
    expect(await locate()).toEqual({ state: 'unavailable' });

    mocked.reverseGeocodeAsync!.mockRejectedValueOnce(new Error('geocoder busy'));
    expect(await locate()).toEqual({
      state: 'ready',
      coords: { lat: 39.7392, lng: -104.9903 },
      address: null,
    });

    mocked.reverseGeocodeAsync!.mockResolvedValueOnce([]);
    expect(await locate()).toMatchObject({ state: 'ready', address: null });
  });

  it('refresh re-locates, e.g. after permission is granted', async () => {
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(denied);
    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.state).toBe('denied'));
    mocked.getForegroundPermissionsAsync!.mockResolvedValue(granted);
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.state).toBe('ready'));
  });

  it('ignores a result that arrives after unmount', async () => {
    let finish: (value: typeof position) => void = () => undefined;
    mocked.getCurrentPositionAsync!.mockImplementationOnce(
      () => new Promise((done) => (finish = done)),
    );
    const { result, unmount } = await renderHook(() => useCurrentLocation());
    expect(result.current.state).toBe('locating');
    await unmount();
    await act(async () => finish(position));
  });

  it('formats street addresses', () => {
    expect(streetAddress({ streetNumber: '1437', street: 'Bannock St' })).toBe('1437 Bannock St');
    expect(streetAddress({ street: 'Bannock St' })).toBe('Bannock St');
    expect(streetAddress({ name: 'Civic Center Park' })).toBe('Civic Center Park');
    expect(streetAddress({ streetNumber: null, street: null, name: null })).toBeNull();
  });

  it('openAppSettings opens app-settings:', async () => {
    await openAppSettings();
    expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
  });

  it('APP-LOC-03: only foreground permission APIs are used; no background location anywhere', () => {
    const appRoot = path.join(__dirname, '..');
    const skip = new Set(['node_modules', 'test', 'ios', 'android', '.expo']);
    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|json)$/.test(entry.name)) sources.push(full);
      }
    };
    walk(appRoot);
    expect(sources.length).toBeGreaterThan(10);
    const background =
      /requestBackgroundPermissionsAsync|getBackgroundPermissionsAsync|startLocationUpdatesAsync|startGeofencingAsync|watchPositionAsync|UIBackgroundModes|NSLocationAlways|expo-task-manager/;
    const offenders = sources.filter((file) => background.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);

    const locationModule = fs.readFileSync(
      path.join(appRoot, 'location', 'permissions.ts'),
      'utf8',
    );
    expect(locationModule).toContain('requestForegroundPermissionsAsync');
  });
});

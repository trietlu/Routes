import fs from 'node:fs';
import path from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import {
  FIX_MAX_AGE_MS,
  LOCATION_RETRY_MS,
  LOCATION_TIMEOUT_MS,
  ROUTE_LOCATION_TIMEOUT_MS,
  deviceLocationSource,
  forgetLastFix,
  getPermissionStatus,
  locate,
  locationTiming,
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
  forgetLastFix();
  Object.assign(locationTiming, {
    timeoutMs: LOCATION_TIMEOUT_MS,
    retryMs: LOCATION_RETRY_MS,
    routeTimeoutMs: ROUTE_LOCATION_TIMEOUT_MS,
  });
});
afterEach(() => jest.useRealTimers());

const hang = () => new Promise(() => undefined);
const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

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

  it('APP-LOC-02: no fix within 5 s → searching (not unavailable)', async () => {
    expect(LOCATION_TIMEOUT_MS).toBe(5000);
    jest.useFakeTimers();
    mocked.getCurrentPositionAsync!.mockImplementation(hang);
    const pending = locate();
    await advance(4999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await advance(1);
    expect(await pending).toEqual({ state: 'searching' });
  });

  it('APP-LOC-04: a fix that arrives after the 5 s timeout still switches to ready', async () => {
    jest.useFakeTimers();
    let deliver: (value: typeof position) => void = () => undefined;
    mocked.getCurrentPositionAsync!.mockImplementationOnce(
      () => new Promise((done) => (deliver = done)),
    );
    const { result } = await renderHook(() => useCurrentLocation());
    expect(result.current.state).toBe('locating');
    await advance(LOCATION_TIMEOUT_MS);
    expect(result.current.state).toBe('searching');
    await act(async () => {
      deliver(position);
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({
      state: 'ready',
      coords: { lat: 39.7392, lng: -104.9903 },
      address: '1437 Bannock St',
    });
  });

  it('APP-LOC-05: while searching, asks again every 10 s; errors keep searching; stops at the first fix', async () => {
    expect(LOCATION_RETRY_MS).toBe(10_000);
    jest.useFakeTimers();
    mocked.getCurrentPositionAsync!.mockImplementation(hang);
    const { result } = await renderHook(() => useCurrentLocation());
    await advance(LOCATION_TIMEOUT_MS);
    expect(result.current.state).toBe('searching');
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(1);

    mocked.getCurrentPositionAsync!.mockRejectedValueOnce(new Error('kCLErrorLocationUnknown'));
    await advance(LOCATION_RETRY_MS);
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('searching');

    mocked.getCurrentPositionAsync!.mockResolvedValueOnce(position);
    await advance(LOCATION_RETRY_MS);
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(3);
    expect(result.current.state).toBe('ready');

    await advance(LOCATION_RETRY_MS * 3);
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(3);
  });

  it('APP-LOC-05: stops asking once the screen unmounts', async () => {
    jest.useFakeTimers();
    mocked.getCurrentPositionAsync!.mockImplementation(hang);
    const { result, unmount } = await renderHook(() => useCurrentLocation());
    await advance(LOCATION_TIMEOUT_MS);
    expect(result.current.state).toBe('searching');
    await unmount();
    await advance(LOCATION_RETRY_MS * 3);
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('APP-LOC-06: routes reuse a fix under a minute old, else wait up to 30 s for a new one', async () => {
    expect(ROUTE_LOCATION_TIMEOUT_MS).toBe(30_000);
    jest.useFakeTimers();
    await locate();
    mocked.getCurrentPositionAsync!.mockClear();
    expect(await deviceLocationSource.getCurrentCoordinates()).toEqual({
      lat: 39.7392,
      lng: -104.9903,
    });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();

    jest.setSystemTime(Date.now() + FIX_MAX_AGE_MS);
    mocked.getCurrentPositionAsync!.mockImplementation(hang);
    const pending = deviceLocationSource.getCurrentCoordinates();
    let settled = false;
    void pending.then(() => (settled = true));
    await advance(ROUTE_LOCATION_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await advance(1);
    expect(await pending).toBeNull();
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('a location error before the timeout → unavailable in the hook too (e.g. Location Services off)', async () => {
    mocked.getCurrentPositionAsync!.mockRejectedValue(new Error('kCLErrorDenied'));
    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
  });

  it('a permission check that throws → unavailable', async () => {
    mocked.getForegroundPermissionsAsync!.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
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

import { Accuracy, getCurrentPositionAsync, reverseGeocodeAsync } from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { type Coordinates, type CurrentLocationSource } from '../state/location';
import { getPermissionStatus } from './permissions';

/** With no fix after this long, Home stops showing "Finding your location…" (FR-3). */
export const LOCATION_TIMEOUT_MS = 5000;
/** While still searching, ask for a fix again this often. */
export const LOCATION_RETRY_MS = 10_000;
/** How long a route request from current location waits for a fix. */
export const ROUTE_LOCATION_TIMEOUT_MS = 30_000;
/** A fix younger than this is reused for route requests instead of asking again. */
export const FIX_MAX_AGE_MS = 60_000;

/** Timings used by `trackLocation` and the route source; tests shorten them. */
export const locationTiming = {
  timeoutMs: LOCATION_TIMEOUT_MS,
  retryMs: LOCATION_RETRY_MS,
  routeTimeoutMs: ROUTE_LOCATION_TIMEOUT_MS,
};

export type CurrentLocation =
  | { state: 'locating' }
  /** Permission is granted but no fix has arrived yet; still trying. */
  | { state: 'searching' }
  | { state: 'ready'; coords: Coordinates; address: string | null }
  | { state: 'denied' }
  /** Location errored, e.g. Location Services are off. */
  | { state: 'unavailable' };

type Position = { coords: { latitude: number; longitude: number } };

/** The most recent fix, in memory only; never stored or logged (NFR-3). */
let lastFix: { coords: Coordinates; at: number } | null = null;

/** Forgets the remembered fix (tests). */
export function forgetLastFix(): void {
  lastFix = null;
}

/** "1437 Bannock St" from a reverse-geocode result, or null if there's no street. */
export function streetAddress(address: {
  streetNumber?: string | null;
  street?: string | null;
  name?: string | null;
}): string | null {
  const street = [address.streetNumber, address.street].filter(Boolean).join(' ');
  return street || address.name || null;
}

/** A fix as a `ready` location, labelled with its street address when one is found. */
async function toReady(position: Position): Promise<CurrentLocation> {
  const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
  lastFix = { coords, at: Date.now() };
  try {
    const [first] = await reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
    return { state: 'ready', coords, address: first ? streetAddress(first) : null };
  } catch {
    // The address only labels "Current location"; routing works without it.
    return { state: 'ready', coords, address: null };
  }
}

const requestFix = (): Promise<Position> =>
  getCurrentPositionAsync({ accuracy: Accuracy.Balanced });

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * One attempt to find the device, using foreground location only (NFR-4).
 * Never asks for permission: without it the result is `denied`. With no fix
 * within `timeoutMs` the result is `searching`.
 */
export async function locate(timeoutMs: number = LOCATION_TIMEOUT_MS): Promise<CurrentLocation> {
  if ((await getPermissionStatus()) !== 'granted') return { state: 'denied' };
  let position;
  try {
    position = await withTimeout(requestFix(), timeoutMs);
  } catch {
    return { state: 'unavailable' };
  }
  if (position === 'timeout') return { state: 'searching' };
  return toReady(position);
}

/**
 * Finds the device and keeps trying until it does. Reports `searching` after
 * `locationTiming.timeoutMs` without a fix, asks again every
 * `locationTiming.retryMs`, and reports `ready` as soon as any request
 * delivers a fix, even one that started before the timeout. An error before
 * the timeout means location is unavailable (e.g. Location Services are off);
 * errors while searching are retried. Returns a function that stops tracking.
 */
export function trackLocation(onChange: (location: CurrentLocation) => void): () => void {
  let stopped = false;
  let done = false;
  let searching = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const finish = (location: CurrentLocation) => {
    if (done || stopped) return;
    done = true;
    clearTimeout(timer);
    onChange(location);
  };
  const onPosition = (position: Position) => {
    if (done || stopped) return;
    done = true;
    clearTimeout(timer);
    void toReady(position).then((ready) => {
      if (!stopped) onChange(ready);
    });
  };
  const onError = () => {
    if (!searching) finish({ state: 'unavailable' });
  };
  const request = () => requestFix().then(onPosition, onError);
  const retry = () => {
    if (done || stopped) return;
    void request();
    timer = setTimeout(retry, locationTiming.retryMs);
  };

  void getPermissionStatus().then(
    (status) => {
      if (status !== 'granted') return finish({ state: 'denied' });
      if (done || stopped) return;
      void request();
      timer = setTimeout(() => {
        if (done || stopped) return;
        searching = true;
        onChange({ state: 'searching' });
        timer = setTimeout(retry, locationTiming.retryMs);
      }, locationTiming.timeoutMs);
    },
    () => finish({ state: 'unavailable' }),
  );

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** The current location for screens; `refresh()` starts over, e.g. after permission is granted. */
export function useCurrentLocation(): CurrentLocation & { refresh: () => void } {
  const [location, setLocation] = useState<CurrentLocation>({ state: 'locating' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => trackLocation(setLocation), [attempt]);
  const refresh = useCallback(() => {
    setLocation({ state: 'locating' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...location, refresh };
}

/**
 * `CurrentLocationSource` for the trip state (R-14): coordinates, or null.
 * Reuses a fix under a minute old; otherwise waits up to
 * `locationTiming.routeTimeoutMs` for a new one.
 */
export const deviceLocationSource: CurrentLocationSource = {
  getCurrentCoordinates: async () => {
    if ((await getPermissionStatus()) !== 'granted') return null;
    if (lastFix && Date.now() - lastFix.at < FIX_MAX_AGE_MS) return lastFix.coords;
    const location = await locate(locationTiming.routeTimeoutMs);
    return location.state === 'ready' ? location.coords : null;
  },
};

import { Accuracy, getCurrentPositionAsync, reverseGeocodeAsync } from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Coordinates, type CurrentLocationSource } from '../state/location';
import { getPermissionStatus } from './permissions';

/** A fix that hasn't arrived after this long counts as unavailable (FR-3). */
export const LOCATION_TIMEOUT_MS = 5000;

export type CurrentLocation =
  | { state: 'locating' }
  | { state: 'ready'; coords: Coordinates; address: string | null }
  | { state: 'denied' }
  | { state: 'unavailable' };

/** "1437 Bannock St" from a reverse-geocode result, or null if there's no street. */
export function streetAddress(address: {
  streetNumber?: string | null;
  street?: string | null;
  name?: string | null;
}): string | null {
  const street = [address.streetNumber, address.street].filter(Boolean).join(' ');
  return street || address.name || null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Where the device is, using foreground location only (NFR-4). Never asks for
 * permission: without it the result is `denied`. Coordinates stay in memory;
 * they are never stored or logged (NFR-3).
 */
export async function locate(timeoutMs: number = LOCATION_TIMEOUT_MS): Promise<CurrentLocation> {
  if ((await getPermissionStatus()) !== 'granted') return { state: 'denied' };
  let position;
  try {
    position = await withTimeout(
      getCurrentPositionAsync({ accuracy: Accuracy.Balanced }),
      timeoutMs,
    );
  } catch {
    return { state: 'unavailable' };
  }
  if (position === 'timeout') return { state: 'unavailable' };
  const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
  try {
    const [first] = await reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
    return { state: 'ready', coords, address: first ? streetAddress(first) : null };
  } catch {
    // The address only labels "Current location"; routing works without it.
    return { state: 'ready', coords, address: null };
  }
}

/** The current location for screens; `refresh()` tries again, e.g. after permission is granted. */
export function useCurrentLocation(): CurrentLocation & { refresh: () => void } {
  const [location, setLocation] = useState<CurrentLocation>({ state: 'locating' });
  const latest = useRef(0);
  const refresh = useCallback(() => {
    const call = ++latest.current;
    setLocation({ state: 'locating' });
    void locate().then((next) => {
      if (call === latest.current) setLocation(next);
    });
  }, []);
  useEffect(() => {
    refresh();
    return () => {
      latest.current++; // ignore results that arrive after unmount
    };
  }, [refresh]);
  return { ...location, refresh };
}

/** `CurrentLocationSource` for the trip state (R-14): coordinates, or null. */
export const deviceLocationSource: CurrentLocationSource = {
  getCurrentCoordinates: async () => {
    const location = await locate();
    return location.state === 'ready' ? location.coords : null;
  },
};

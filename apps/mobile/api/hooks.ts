import { useMutation, useQuery } from '@tanstack/react-query';
import { AUTOCOMPLETE_MIN_QUERY_LENGTH, type Waypoint } from '@routes/api-types';
import { useDebouncedValue } from './debounce';
import { errorKind } from './errors';
import { useApi } from './provider';

/** Autocomplete waits for typing to pause (NFR-2, NFR-9). */
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;
export const AUTOCOMPLETE_STALE_MS = 5 * 60 * 1000;
export const ROUTES_STALE_MS = 2 * 60 * 1000;

export interface LatLngPoint {
  lat: number;
  lng: number;
}

/**
 * Suggestions for `query`, biased to `start`. Debounced 300 ms; queries
 * shorter than 2 characters are not sent. Every request uses the current
 * Places session token.
 */
export function useAutocomplete(query: string, start: LatLngPoint | null) {
  const { client, session } = useApi();
  const q = useDebouncedValue(query.trim(), AUTOCOMPLETE_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['autocomplete', q.toLowerCase(), start?.lat ?? null, start?.lng ?? null],
    queryFn: () =>
      client.autocomplete({ q, lat: start?.lat, lng: start?.lng, session: session.current() }),
    enabled: q.length >= AUTOCOMPLETE_MIN_QUERY_LENGTH,
    staleTime: AUTOCOMPLETE_STALE_MS,
    // Typing moves on quickly; the screen offers its own Retry (UX screen 3).
    retry: false,
  });
}

/** Place details for a picked suggestion. Ends the Places session. */
export function usePlaceDetails() {
  const { client, session } = useApi();
  return useMutation({
    mutationFn: (placeId: string) => client.details({ placeId, session: session.current() }),
    onSettled: () => session.rotate(),
  });
}

/**
 * Routes between two points. The query key has no mode, so switching
 * Fastest/Cheapest re-ranks cached data without a request (FR-9, FR-10).
 * Only generic failures are retried, once.
 */
export function useRoutes(start: Waypoint | null, destination: Waypoint | null) {
  const { client } = useApi();
  return useQuery({
    queryKey: ['routes', start, destination],
    queryFn: () => client.routes({ origin: start!, destination: destination! }),
    enabled: start !== null && destination !== null,
    staleTime: ROUTES_STALE_MS,
    retry: (failureCount, error) => failureCount < 1 && errorKind(error) === 'generic',
  });
}

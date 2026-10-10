import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Waypoint } from '@routes/api-types';
import { type RouteOption, rankRoutes } from '@routes/routing-core';
import { type ApiErrorKind, errorKind } from '../api/errors';
import { useRoutes } from '../api/hooks';
import { type Coordinates } from './location';
import { useCurrentLocationSource, useTrip, useVehicle } from './provider';
import { type Endpoint } from './tripStore';

export type RankedStatus = 'idle' | 'loading' | 'error' | 'success';

export interface RankedRoutes {
  status: RankedStatus;
  options: RouteOption[];
  onlyN: number | null;
  errorKind: ApiErrorKind | null;
  /** The resolved trip ends, for map pins; null until known. */
  start: Waypoint | null;
  destination: Waypoint | null;
  /** Fetches the routes again (Retry). */
  retry: () => void;
}

/** A place's waypoint, or the current coordinates for `current` (null until known). */
export function toWaypoint(
  endpoint: Endpoint | null,
  current: Coordinates | null,
): Waypoint | null {
  if (endpoint === null) return null;
  if (endpoint === 'current') return current ? { lat: current.lat, lng: current.lng } : null;
  return {
    ...(endpoint.placeId ? { placeId: endpoint.placeId } : {}),
    lat: endpoint.lat,
    lng: endpoint.lng,
  };
}

/**
 * The trip's routes ranked for the current mode and vehicle. Mode and vehicle
 * only re-rank the cached response, so neither causes a request (FR-9, FR-10,
 * FR-19). `idle` means an end is missing or the current location isn't known.
 */
export function useRankedRoutes(): RankedRoutes {
  const start = useTrip((state) => state.start);
  const destination = useTrip((state) => state.destination);
  const mode = useTrip((state) => state.mode);
  const vehicle = useVehicle((state) => state.vehicle);
  const location = useCurrentLocationSource();

  const usesCurrent = start === 'current' || destination === 'current';
  const current = useQuery({
    queryKey: ['currentLocation'],
    queryFn: () => location.getCurrentCoordinates(),
    enabled: usesCurrent,
    staleTime: 60_000,
  });
  const coordinates = current.data ?? null;
  const startPoint = toWaypoint(start, coordinates);
  const destinationPoint = toWaypoint(destination, coordinates);
  const routes = useRoutes(startPoint, destinationPoint);

  const ranked = useMemo(
    () => (routes.data ? rankRoutes(routes.data.routes, mode, vehicle) : null),
    [routes.data, mode, vehicle],
  );

  const base = {
    options: [] as RouteOption[],
    onlyN: null,
    errorKind: null,
    start: startPoint,
    destination: destinationPoint,
    retry: () => void routes.refetch(),
  };
  if (ranked) return { ...base, status: 'success', options: ranked.options, onlyN: ranked.onlyN };
  if (routes.isError) return { ...base, status: 'error', errorKind: errorKind(routes.error) };
  if (routes.isFetching || current.isFetching) return { ...base, status: 'loading' };
  return { ...base, status: 'idle' };
}

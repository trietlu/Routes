import {
  type RouteSource,
  type RoutesRequest,
  type RoutesResponse,
  type Waypoint,
} from '@routes/api-types';
import { type RoutesProvider } from '../providers';
import { type CallResult, fetchUpstream } from '../upstream';
import { ROUTE_SOURCES, mergeCalls } from './merge';

export const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Exactly the fields the proxy reads (technical design § Request settings). */
export const ROUTES_FIELD_MASK =
  'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.travelAdvisory.tollInfo,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction';

/** `{ placeId }` when the place came from Places search, else its coordinates. */
export function toGoogleWaypoint(waypoint: Waypoint): Record<string, unknown> {
  return waypoint.placeId
    ? { placeId: waypoint.placeId }
    : { location: { latLng: { latitude: waypoint.lat, longitude: waypoint.lng } } };
}

/** The `computeRoutes` body for one of the two calls. */
export function computeRoutesBody(
  request: RoutesRequest,
  source: RouteSource,
): Record<string, unknown> {
  return {
    origin: toGoogleWaypoint(request.origin),
    destination: toGoogleWaypoint(request.destination),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: true,
    extraComputations: ['TOLLS'],
    units: 'IMPERIAL',
    languageCode: 'en-US',
    ...(source === 'avoidTolls' ? { routeModifiers: { avoidTolls: true } } : {}),
  };
}

export interface GoogleRoutesOptions {
  apiKey: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

/** Routes from Google: the tolls and avoidTolls calls in parallel, merged. */
export class GoogleRoutesProvider implements RoutesProvider {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: GoogleRoutesOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  async computeRoutes(request: RoutesRequest): Promise<RoutesResponse> {
    const [tolls, avoidTolls] = await Promise.all(
      ROUTE_SOURCES.map((source) => this.call(request, source)),
    );
    return mergeCalls({ tolls: tolls!, avoidTolls: avoidTolls! });
  }

  private call(request: RoutesRequest, source: RouteSource): Promise<CallResult> {
    return fetchUpstream(
      this.fetch,
      COMPUTE_ROUTES_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The key travels only as a header, never in the URL (PX-ROUTES-09).
          'X-Goog-Api-Key': this.options.apiKey,
          'X-Goog-FieldMask': ROUTES_FIELD_MASK,
        },
        body: JSON.stringify(computeRoutesBody(request, source)),
      },
      this.options.timeoutMs,
    );
  }
}

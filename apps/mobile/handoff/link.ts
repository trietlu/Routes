/** A trip end for the Google Maps link. */
export type HandoffEndpoint =
  | { kind: 'current'; lat: number; lng: number }
  | { kind: 'place'; name: string; placeId: string | null; lat: number; lng: number };

/** Google's cross-platform directions link (technical design § Google Maps handoff). */
export const DIRECTIONS_URL = 'https://www.google.com/maps/dir/';

/** Google Maps on the App Store (FR-17). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id585027354';

/** Scheme the app checks to see whether Google Maps is installed. */
export const GOOGLE_MAPS_SCHEME = 'comgooglemaps://';

const latLng = (point: { lat: number; lng: number }): string => `${point.lat},${point.lng}`;

/**
 * The directions link (FR-16):
 * - no `origin` when starting from the current location, so Google Maps uses
 *   the device's; otherwise `origin=lat,lng`;
 * - the destination by name plus `destination_place_id`, or `lat,lng` when it
 *   is the current location (after a swap) or has no place ID;
 * - always driving, navigating straight away. Every value is URL-encoded.
 */
export function buildDirectionsUrl(start: HandoffEndpoint, destination: HandoffEndpoint): string {
  const params: [string, string][] = [['api', '1']];
  if (start.kind === 'place') params.push(['origin', latLng(start)]);
  if (destination.kind === 'place' && destination.placeId) {
    params.push(['destination', destination.name], ['destination_place_id', destination.placeId]);
  } else {
    params.push(['destination', latLng(destination)]);
  }
  params.push(['travelmode', 'driving'], ['dir_action', 'navigate']);
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `${DIRECTIONS_URL}?${query}`;
}

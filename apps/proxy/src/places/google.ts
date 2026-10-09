import {
  type AutocompleteQuery,
  type AutocompleteResponse,
  type PlaceDetails,
  type PlaceDetailsQuery,
} from '@routes/api-types';
import { ProxyError } from '../errors';
import { type PlacesProvider } from '../providers';
import { bodyOrThrow, fetchUpstream } from '../upstream';
import { normalizeAutocomplete, normalizeDetails } from './normalize';

export const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
export const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places/';

/** Minimal field mask for details (PX-PLACES-02). */
export const DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,location';

/** Radius of the location bias around the trip start; the Places maximum. */
export const LOCATION_BIAS_RADIUS_M = 50_000;

/** The autocomplete request body (PX-PLACES-01). */
export function autocompleteBody(query: AutocompleteQuery): Record<string, unknown> {
  const body: Record<string, unknown> = {
    input: query.q,
    sessionToken: query.session,
    includedRegionCodes: ['us'],
  };
  if (query.lat !== undefined && query.lng !== undefined) {
    const point = { latitude: query.lat, longitude: query.lng };
    body.origin = point;
    body.locationBias = { circle: { center: point, radius: LOCATION_BIAS_RADIUS_M } };
  }
  return body;
}

export interface GooglePlacesOptions {
  apiKey: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

const PROVIDER = 'places provider';

/** Places API (New): autocomplete and details, sharing the session token. */
export class GooglePlacesProvider implements PlacesProvider {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: GooglePlacesOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  async autocomplete(query: AutocompleteQuery): Promise<AutocompleteResponse> {
    const result = await fetchUpstream(
      this.fetch,
      AUTOCOMPLETE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.options.apiKey },
        body: JSON.stringify(autocompleteBody(query)),
      },
      this.options.timeoutMs,
    );
    return parsed(() =>
      normalizeAutocomplete(bodyOrThrow(result, PROVIDER), query.lat !== undefined),
    );
  }

  async details(query: PlaceDetailsQuery): Promise<PlaceDetails> {
    const url = `${PLACE_DETAILS_URL}${encodeURIComponent(query.placeId)}?sessionToken=${encodeURIComponent(query.session)}`;
    const result = await fetchUpstream(
      this.fetch,
      url,
      {
        method: 'GET',
        headers: { 'X-Goog-Api-Key': this.options.apiKey, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
      },
      this.options.timeoutMs,
    );
    return parsed(() => normalizeDetails(bodyOrThrow(result, PROVIDER)));
  }
}

/** Runs a normalizer; a malformed Google body becomes `UPSTREAM_ERROR`. */
function parsed<T>(normalize: () => T): T {
  try {
    return normalize();
  } catch (error) {
    if (error instanceof ProxyError) throw error;
    throw new ProxyError('UPSTREAM_ERROR', `The ${PROVIDER} returned an unexpected response`);
  }
}

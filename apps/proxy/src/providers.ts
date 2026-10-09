import {
  type AutocompleteQuery,
  type AutocompleteResponse,
  type PlaceDetails,
  type PlaceDetailsQuery,
  type RoutesRequest,
  type RoutesResponse,
} from '@routes/api-types';
import { type Config } from './config';
import { GooglePlacesProvider } from './places/google';
import { MockPlacesProvider } from './places/mock';
import { GoogleRoutesProvider } from './routes/google';
import { MockRoutesProvider } from './routes/mock';

/**
 * Fetches and normalizes routes for a trip. Implementations throw
 * `ProxyError` (`NO_ROUTE`, `UPSTREAM_ERROR`, `UPSTREAM_TIMEOUT`) on failure.
 */
export interface RoutesProvider {
  computeRoutes(request: RoutesRequest): Promise<RoutesResponse>;
}

/** Places search. Implementations throw `ProxyError` on failure. */
export interface PlacesProvider {
  autocomplete(query: AutocompleteQuery): Promise<AutocompleteResponse>;
  details(query: PlaceDetailsQuery): Promise<PlaceDetails>;
}

export interface Providers {
  routes: RoutesProvider;
  places: PlacesProvider;
}

/** Providers for the configured `PROVIDER`: Google, or fixtures in mock mode. */
export function createProviders(config: Config): Providers {
  if (config.provider === 'google') {
    const options = {
      // loadConfig guarantees a key when PROVIDER=google.
      apiKey: config.googleMapsApiKey!,
      timeoutMs: config.upstreamTimeoutMs,
    };
    return { routes: new GoogleRoutesProvider(options), places: new GooglePlacesProvider(options) };
  }
  return { routes: new MockRoutesProvider(), places: new MockPlacesProvider() };
}

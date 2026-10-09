import {
  type AutocompleteQuery,
  type AutocompleteResponse,
  type PlaceDetails,
  type PlaceDetailsQuery,
  type RoutesRequest,
  type RoutesResponse,
} from '@routes/api-types';
import { type Config } from './config';
import { ProxyError } from './errors';
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

const notYet = (what: string, issue: string): Promise<never> =>
  Promise.reject(new ProxyError('UPSTREAM_ERROR', `${what} is not implemented yet (${issue})`));

/**
 * Providers for the configured `PROVIDER`. Places land in R-09; until then
 * those calls fail with `UPSTREAM_ERROR`.
 */
export function createProviders(config: Config): Providers {
  const routes =
    config.provider === 'google'
      ? new GoogleRoutesProvider({
          // loadConfig guarantees a key when PROVIDER=google.
          apiKey: config.googleMapsApiKey!,
          timeoutMs: config.upstreamTimeoutMs,
        })
      : new MockRoutesProvider();
  return {
    routes,
    places: {
      autocomplete: () => notYet('Autocomplete', 'R-09'),
      details: () => notYet('Place details', 'R-09'),
    },
  };
}

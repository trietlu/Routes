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
 * Providers for the configured `PROVIDER`. The Google and mock
 * implementations land in R-08 (routes) and R-09 (places); until then every
 * call fails with `UPSTREAM_ERROR`.
 */
export function createProviders(_config: Config): Providers {
  return {
    routes: { computeRoutes: () => notYet('Routes', 'R-08') },
    places: {
      autocomplete: () => notYet('Autocomplete', 'R-09'),
      details: () => notYet('Place details', 'R-09'),
    },
  };
}

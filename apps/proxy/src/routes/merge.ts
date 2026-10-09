import { type ProviderRoute, type RouteSource, type RoutesResponse } from '@routes/api-types';
import { ProxyError } from '../errors';
import { type CallResult } from '../upstream';
import { normalizeComputeRoutes } from './normalize';

export { type CallResult };

/** The two calls per trip, in merge order. */
export const ROUTE_SOURCES: readonly RouteSource[] = ['tolls', 'avoidTolls'];

/**
 * Merges the tolls and avoidTolls calls (technical design § Route pipeline):
 * - a failed or malformed call is ignored if the other succeeds;
 * - both failing is `UPSTREAM_TIMEOUT` when every failure was a timeout,
 *   otherwise `UPSTREAM_ERROR`;
 * - no routes at all is `NO_ROUTE` when both calls succeeded. If one failed
 *   and the other found nothing, the failure is reported instead, since the
 *   failed call might have had routes.
 */
export function mergeCalls(results: Record<RouteSource, CallResult>): RoutesResponse {
  const routes: ProviderRoute[] = [];
  const failures: ('error' | 'timeout')[] = [];
  for (const source of ROUTE_SOURCES) {
    const result = results[source];
    if (!result.ok) {
      failures.push(result.reason);
      continue;
    }
    try {
      routes.push(...normalizeComputeRoutes(result.body, source));
    } catch {
      failures.push('error');
    }
  }
  if (routes.length > 0) return { routes };
  if (failures.length === 0) throw new ProxyError('NO_ROUTE', 'No driving route found');
  if (failures.every((reason) => reason === 'timeout')) {
    throw new ProxyError('UPSTREAM_TIMEOUT', 'The routing provider did not respond in time');
  }
  throw new ProxyError('UPSTREAM_ERROR', 'The routing provider returned an error');
}

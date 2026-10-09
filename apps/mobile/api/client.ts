import { type z } from 'zod';
import {
  APP_ATTEST_HEADER,
  type AutocompleteQuery,
  type AutocompleteResponse,
  AutocompleteResponseSchema,
  DEVICE_ID_HEADER,
  type PlaceDetails,
  type PlaceDetailsQuery,
  PlaceDetailsSchema,
  type RoutesRequest,
  type RoutesResponse,
  RoutesResponseSchema,
} from '@routes/api-types';
import { ApiError, errorFromResponse } from './errors';

/** Requests give up after 10 s. */
export const REQUEST_TIMEOUT_MS = 10_000;

export interface ApiClient {
  routes(request: RoutesRequest): Promise<RoutesResponse>;
  autocomplete(query: AutocompleteQuery): Promise<AutocompleteResponse>;
  details(query: PlaceDetailsQuery): Promise<PlaceDetails>;
}

export interface ApiClientOptions {
  /** `EXPO_PUBLIC_PROXY_URL`. */
  baseUrl: string;
  getDeviceId: () => Promise<string>;
  /** App Attest assertion for a request body; a no-op until R-27. */
  attest?: (body: string) => Promise<string | undefined>;
  /** Whether the device is known to be offline (NetInfo). */
  isOffline?: () => Promise<boolean>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Typed client for the proxy's three endpoints (technical design § Proxy API contract). */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const {
    baseUrl,
    getDeviceId,
    attest = async () => undefined,
    isOffline = async () => false,
    fetch: fetchImpl = fetch,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<T> {
    if (await isOffline()) throw new ApiError('offline', 'You are offline');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      [DEVICE_ID_HEADER]: await getDeviceId(),
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    const assertion = await attest(init.body ?? path);
    if (assertion) headers[APP_ATTEST_HEADER] = assertion;

    // AbortController plus a timer: Hermes may lack AbortSignal.timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, { ...init, headers, signal: controller.signal });
    } catch {
      // A timeout is a slow or failing proxy; any other failure means no network.
      if (controller.signal.aborted) throw new ApiError('generic', 'The request timed out');
      throw new ApiError('offline', 'Network request failed');
    } finally {
      clearTimeout(timer);
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw errorFromResponse(response.status, body);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError('generic', 'Unexpected response', response.status);
    return parsed.data;
  }

  const query = (params: Record<string, string | number | undefined>): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    return search.toString();
  };

  return {
    routes: (body) =>
      request('/routes', RoutesResponseSchema, { method: 'POST', body: JSON.stringify(body) }),
    autocomplete: (params) =>
      request(`/places/autocomplete?${query(params)}`, AutocompleteResponseSchema, {
        method: 'GET',
      }),
    details: (params) =>
      request(`/places/details?${query(params)}`, PlaceDetailsSchema, { method: 'GET' }),
  };
}

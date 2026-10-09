import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  createApiClient,
  createAppApiClient,
  errorKind,
} from '../api';
import { resetNetworkState, setNetworkState } from './mocks/netinfo';
import { isDeviceOffline } from '../api/network';

const DEVICE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const ROUTES_REQUEST = {
  origin: { lat: 39.7392, lng: -104.9903 },
  destination: { placeId: 'fixture-union-station', lat: 39.8255, lng: -104.906 },
};
const ROUTE = {
  durationSec: 1320,
  distanceM: 15772,
  encodedPolyline: 'abc',
  description: 'Hwy 12',
  toll: { hasTolls: true, priceUSD: 3.75 },
  steps: [],
  source: 'tolls',
};

const json = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

function setup(
  response: Response | (() => Promise<Response>),
  extra: Record<string, unknown> = {},
) {
  const fetch = jest.fn<Promise<Response>, [string, RequestInit]>(
    typeof response === 'function' ? response : async () => response,
  );
  const client = createApiClient({
    baseUrl: 'http://proxy.test:8080/',
    getDeviceId: async () => DEVICE_ID,
    fetch: fetch as unknown as typeof globalThis.fetch,
    ...extra,
  });
  return { client, fetch };
}

const callOf = (fetch: jest.Mock) => fetch.mock.calls[0] as [string, RequestInit];

afterEach(() => resetNetworkState());

describe('API client', () => {
  it('APP-API-01: sends X-Device-Id to the configured base URL', async () => {
    const { client, fetch } = setup(json(200, { routes: [ROUTE] }));
    await expect(client.routes(ROUTES_REQUEST)).resolves.toEqual({ routes: [ROUTE] });
    const [url, init] = callOf(fetch);
    expect(url).toBe('http://proxy.test:8080/routes');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'X-Device-Id': DEVICE_ID,
      'Content-Type': 'application/json',
    });
    expect((init.headers as Record<string, string>)['X-App-Attest']).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual(ROUTES_REQUEST);
  });

  it('APP-API-01: builds the places query strings and validates responses', async () => {
    const { client, fetch } = setup(json(200, { suggestions: [] }));
    await client.autocomplete({ q: 'Union St & 9th', lat: 39.7, lng: -104.9, session: 's1' });
    expect(callOf(fetch)[0]).toBe(
      'http://proxy.test:8080/places/autocomplete?q=Union+St+%26+9th&lat=39.7&lng=-104.9&session=s1',
    );
    fetch.mockResolvedValueOnce(json(200, { suggestions: [] }));
    await client.autocomplete({ q: 'Union', session: 's1' });
    expect(fetch.mock.calls[1]![0]).toBe(
      'http://proxy.test:8080/places/autocomplete?q=Union&session=s1',
    );

    const details = {
      placeId: 'p1',
      name: 'Union Station',
      address: '100 Union Plaza',
      lat: 39.8,
      lng: -104.9,
    };
    fetch.mockResolvedValueOnce(json(200, details));
    await expect(client.details({ placeId: 'p1', session: 's1' })).resolves.toEqual(details);
    expect(fetch.mock.calls[2]![0]).toBe(
      'http://proxy.test:8080/places/details?placeId=p1&session=s1',
    );
  });

  it('adds X-App-Attest through the injected hook', async () => {
    const attest = jest.fn(async () => 'assertion-123');
    const { client, fetch } = setup(json(200, { routes: [] }), { attest });
    await client.routes(ROUTES_REQUEST);
    expect(attest).toHaveBeenCalledWith(JSON.stringify(ROUTES_REQUEST));
    expect(callOf(fetch)[1].headers).toMatchObject({ 'X-App-Attest': 'assertion-123' });
  });

  it('APP-API-02: maps failures to offline, noRoute, rateLimited and generic', async () => {
    const kindOf = async (response: Response | (() => Promise<Response>), extra = {}) => {
      const { client } = setup(response, extra);
      return client.routes(ROUTES_REQUEST).then(
        () => 'resolved',
        (error: unknown) => errorKind(error),
      );
    };
    const envelope = (code: string) => ({ error: { code, message: 'x' } });

    expect(await kindOf(json(404, envelope('NO_ROUTE')))).toBe('noRoute');
    expect(await kindOf(json(429, envelope('RATE_LIMITED')))).toBe('rateLimited');
    expect(await kindOf(json(429, 'not json'))).toBe('rateLimited');
    expect(await kindOf(json(502, envelope('UPSTREAM_ERROR')))).toBe('generic');
    expect(await kindOf(json(400, envelope('BAD_REQUEST')))).toBe('generic');
    expect(await kindOf(json(500, undefined))).toBe('generic');
    // A 200 that doesn't match the contract.
    expect(await kindOf(json(200, { routes: [{ nope: true }] }))).toBe('generic');
    // A body that isn't JSON at all.
    expect(
      await kindOf({
        ok: false,
        status: 503,
        json: async () => Promise.reject(new Error('html')),
      } as unknown as Response),
    ).toBe('generic');
    // Network failure.
    expect(await kindOf(() => Promise.reject(new TypeError('Network request failed')))).toBe(
      'offline',
    );
    // NetInfo already reports offline: no request is made.
    const offline = setup(json(200, { routes: [] }), { isOffline: async () => true });
    await expect(offline.client.routes(ROUTES_REQUEST)).rejects.toMatchObject({ kind: 'offline' });
    expect(offline.fetch).not.toHaveBeenCalled();
    expect(errorKind(new Error('boom'))).toBe('generic');
  });

  it('APP-API-02: a request slower than 10 s is a generic error', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
    const hang = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const fetch = jest.fn(hang);
    const client = createApiClient({
      baseUrl: 'http://proxy.test',
      getDeviceId: async () => DEVICE_ID,
      fetch: fetch as unknown as typeof globalThis.fetch,
      timeoutMs: 20,
    });
    const error = await client.routes(ROUTES_REQUEST).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'generic', message: 'The request timed out' });
  });

  it('isDeviceOffline follows NetInfo; unknown counts as online', async () => {
    expect(await isDeviceOffline()).toBe(false);
    setNetworkState({ isConnected: false });
    expect(await isDeviceOffline()).toBe(true);
    setNetworkState({ isConnected: null });
    expect(await isDeviceOffline()).toBe(false);
  });

  it('the app client uses the proxy URL from config and the stored device ID', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { routes: [] }));
    try {
      await createAppApiClient(async () => DEVICE_ID).routes(ROUTES_REQUEST);
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:8080/routes');
      expect(init.headers).toMatchObject({ 'X-Device-Id': DEVICE_ID });
    } finally {
      fetch.mockRestore();
    }
  });
});

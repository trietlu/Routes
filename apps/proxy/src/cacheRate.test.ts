import { type FastifyInstance } from 'fastify';
import { TtlLruCache, autocompleteCacheKey, routesCacheKey } from './cache';
import { ProxyError, type Providers, buildApp, loadConfig } from './index';
import { DeviceRateLimiter } from './rateLimit';

const DEVICE_A = '3b241101-e2bb-4255-8caf-4136c566a962';
const DEVICE_B = '9c5b94b1-35ad-49bb-b118-8e8fc24abf80';
const SEC = 1000;
const HOUR = 3600 * SEC;

const ROUTES_BODY = {
  origin: { lat: 39.73921, lng: -104.99031 },
  destination: { placeId: 'fixture-union-station', lat: 39.8255, lng: -104.906 },
};

let clock = 0;
const now = () => clock;
let app: FastifyInstance;
let lines: string[];

function fakeProviders() {
  return {
    routes: { computeRoutes: jest.fn().mockResolvedValue({ routes: [] }) },
    places: {
      autocomplete: jest.fn().mockResolvedValue({ suggestions: [] }),
      details: jest.fn().mockResolvedValue({
        placeId: 'p1',
        name: 'Union Station',
        address: '100 Union Plaza',
        lat: 39.8,
        lng: -104.9,
      }),
    },
  } satisfies Providers;
}
let providers: ReturnType<typeof fakeProviders>;

function setup(env: Record<string, string> = {}): void {
  clock = 1_000_000;
  lines = [];
  providers = fakeProviders();
  app = buildApp(loadConfig({ NODE_ENV: 'test', ...env }), {
    providers,
    now,
    logStream: { write: (line: string) => void lines.push(line) },
  });
}

afterEach(async () => {
  await app?.close();
});

const postRoutes = (body: object = ROUTES_BODY, device = DEVICE_A) =>
  app.inject({ method: 'POST', url: '/routes', headers: { 'x-device-id': device }, payload: body });
const get = (url: string, device = DEVICE_A) =>
  app.inject({ method: 'GET', url, headers: { 'x-device-id': device } });
const cacheHits = () =>
  lines
    .map((line) => JSON.parse(line) as { msg: string; cacheHit?: boolean })
    .filter((line) => line.msg === 'request')
    .map((line) => line.cacheHit);

describe('caching', () => {
  it('PX-CACHE-01: a second identical /routes request within 60 s makes no upstream call; after 60 s it does', async () => {
    setup();
    expect((await postRoutes()).statusCode).toBe(200);
    clock += 59 * SEC;
    expect((await postRoutes()).statusCode).toBe(200);
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(1);
    clock += 1 * SEC; // 60 s after the first response
    await postRoutes();
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(2);
    expect(cacheHits()).toEqual([false, true, false]);
  });

  it('PX-CACHE-02: origins differing below the 4th decimal share an entry; different destinations do not', async () => {
    setup();
    await postRoutes();
    await postRoutes({ ...ROUTES_BODY, origin: { lat: 39.739208, lng: -104.990312 } });
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(1);

    await postRoutes({ ...ROUTES_BODY, origin: { lat: 39.7393, lng: -104.9903 } });
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(2);

    await postRoutes({
      ...ROUTES_BODY,
      destination: { placeId: 'fixture-two-routes', lat: 1, lng: 2 },
    });
    await postRoutes({ origin: ROUTES_BODY.origin, destination: { lat: 39.8255, lng: -104.906 } });
    await postRoutes({
      origin: ROUTES_BODY.origin,
      destination: { lat: 39.82551, lng: -104.90601 },
    });
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(4);
  });

  it('PX-CACHE-03: autocomplete is cached 5 min and details 24 h', async () => {
    setup();
    const auto = '/places/autocomplete?q=Union&lat=39.7392&lng=-104.9903&session=s1';
    await get(auto);
    clock += 299 * SEC;
    // Same query modulo case and spaces, origin equal to 2 decimals, new session.
    await get('/places/autocomplete?q=%20union%20&lat=39.741&lng=-104.988&session=s2');
    expect(providers.places.autocomplete).toHaveBeenCalledTimes(1);
    clock += 1 * SEC;
    await get(auto);
    expect(providers.places.autocomplete).toHaveBeenCalledTimes(2);

    const details = '/places/details?placeId=p1&session=s1';
    await get(details);
    clock += 24 * HOUR - SEC;
    await get('/places/details?placeId=p1&session=s9');
    expect(providers.places.details).toHaveBeenCalledTimes(1);
    clock += SEC;
    await get(details);
    expect(providers.places.details).toHaveBeenCalledTimes(2);
    await get('/places/details?placeId=p2&session=s1');
    expect(providers.places.details).toHaveBeenCalledTimes(3);
  });

  it('only successful responses are cached', async () => {
    setup();
    providers.routes.computeRoutes.mockRejectedValueOnce(new ProxyError('NO_ROUTE', 'none'));
    expect((await postRoutes()).statusCode).toBe(404);
    expect((await postRoutes()).statusCode).toBe(200);
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(2);
    expect(cacheHits()).toEqual([false, false]);
  });

  it('TTLs are configurable; a zero TTL turns caching off', async () => {
    setup({ ROUTES_CACHE_TTL_SEC: '5', AUTOCOMPLETE_CACHE_TTL_SEC: '0' });
    await postRoutes();
    clock += 5 * SEC;
    await postRoutes();
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(2);
    await get('/places/autocomplete?q=Union&session=s1');
    await get('/places/autocomplete?q=Union&session=s1');
    expect(providers.places.autocomplete).toHaveBeenCalledTimes(2);
  });

  it('the LRU holds at most maxEntries, evicting the least recently used', () => {
    const cache = new TtlLruCache<number>(2, 1000, now);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1); // a is now most recent
    cache.set('c', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    cache.set('a', 10);
    expect(cache.get('a')).toBe(10);
  });

  it('builds cache keys from rounded coordinates and normalized text', () => {
    expect(routesCacheKey(ROUTES_BODY)).toBe('39.7392,-104.9903|place:fixture-union-station');
    expect(
      routesCacheKey({ origin: { lat: 1, lng: 2 }, destination: { lat: 3.123456, lng: 4 } }),
    ).toBe('1.0000,2.0000|3.1235,4.0000');
    expect(autocompleteCacheKey({ q: '  Union ', lat: 39.7392, lng: -104.9903 })).toBe(
      'union|39.74,-104.99',
    );
    expect(autocompleteCacheKey({ q: 'Union' })).toBe('union|none');
  });
});

describe('rate limits', () => {
  it('PX-RATE-01: the 61st route request in an hour from one device → 429 with Retry-After; another device is unaffected', async () => {
    setup();
    for (let i = 0; i < 60; i++) {
      expect((await postRoutes()).statusCode).toBe(200);
    }
    const limited = await postRoutes();
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
    });
    expect(Number(limited.headers['retry-after'])).toBe(60); // one token refills per minute
    expect((await postRoutes(ROUTES_BODY, DEVICE_B)).statusCode).toBe(200);

    // Cache hits count too: Google was called once for all of these.
    expect(providers.routes.computeRoutes).toHaveBeenCalledTimes(1);
    // The bucket refills over the rolling hour.
    clock += 60 * SEC;
    expect((await postRoutes()).statusCode).toBe(200);
    expect((await postRoutes()).statusCode).toBe(429);
    clock += HOUR;
    for (let i = 0; i < 60; i++) {
      expect((await postRoutes()).statusCode).toBe(200);
    }
  });

  it('autocomplete and details share the 600-per-hour places budget, separate from routes', async () => {
    setup();
    for (let i = 0; i < 300; i++) {
      await get(`/places/autocomplete?q=Union${i}&session=s1`);
      await get(`/places/details?placeId=p${i}&session=s1`);
    }
    const limited = await get('/places/autocomplete?q=Union&session=s1');
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('6');
    expect((await get('/places/details?placeId=p1&session=s1')).statusCode).toBe(429);
    expect((await postRoutes()).statusCode).toBe(200);
  });

  it('limits are configurable', async () => {
    setup({ RATE_LIMIT_ROUTES_PER_HOUR: '2', RATE_LIMIT_PLACES_PER_HOUR: '1' });
    await postRoutes();
    await postRoutes();
    const limited = await postRoutes();
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('1800');
    await get('/places/details?placeId=p1&session=s1');
    expect((await get('/places/details?placeId=p1&session=s1')).statusCode).toBe(429);
  });

  it('a missing device ID is rejected before it can use a budget', async () => {
    setup();
    const response = await app.inject({ method: 'POST', url: '/routes', payload: ROUTES_BODY });
    expect(response.statusCode).toBe(400);
  });

  it('the token bucket refills continuously and forgets idle devices after an hour', () => {
    clock = 0;
    const limiter = new DeviceRateLimiter(2, now);
    expect(limiter.take('d')).toEqual({ ok: true });
    expect(limiter.take('d')).toEqual({ ok: true });
    expect(limiter.take('d')).toEqual({ ok: false, retryAfterSec: 1800 });
    clock += 900 * SEC; // half a token back
    expect(limiter.take('d')).toEqual({ ok: false, retryAfterSec: 900 });
    clock += 900 * SEC;
    expect(limiter.take('d')).toEqual({ ok: true });
    clock += 2 * HOUR;
    expect(limiter.take('d')).toEqual({ ok: true });
    expect(limiter.take('d')).toEqual({ ok: true });
  });
});

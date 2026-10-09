import { loadConfig, start } from './index';

describe('loadConfig', () => {
  it('applies defaults outside production: port 8080, mock provider, attest off, 8 s timeout', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development',
      port: 8080,
      provider: 'mock',
      googleMapsApiKey: undefined,
      attestMode: 'off',
      upstreamTimeoutMs: 8000,
      logLevel: 'info',
      cache: { routesTtlSec: 60, autocompleteTtlSec: 300, detailsTtlSec: 86_400, maxEntries: 5000 },
      rateLimit: { routesPerHour: 60, placesPerHour: 600 },
    });
  });

  it('defaults to the Google provider in production, which needs an API key', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'GOOGLE_MAPS_API_KEY: GOOGLE_MAPS_API_KEY is required when PROVIDER=google',
    );
    expect(loadConfig({ NODE_ENV: 'production', GOOGLE_MAPS_API_KEY: 'k' })).toMatchObject({
      provider: 'google',
      googleMapsApiKey: 'k',
    });
    expect(loadConfig({ NODE_ENV: 'production', PROVIDER: 'mock' }).provider).toBe('mock');
    expect(() => loadConfig({ PROVIDER: 'google', GOOGLE_MAPS_API_KEY: '  ' })).toThrow();
  });

  it('reads every variable', () => {
    expect(
      loadConfig({
        NODE_ENV: 'test',
        PORT: '9000',
        PROVIDER: 'google',
        GOOGLE_MAPS_API_KEY: 'key',
        ATTEST_MODE: 'enforce',
        UPSTREAM_TIMEOUT_MS: '2500',
        LOG_LEVEL: 'silent',
        ROUTES_CACHE_TTL_SEC: '30',
        AUTOCOMPLETE_CACHE_TTL_SEC: '120',
        DETAILS_CACHE_TTL_SEC: '3600',
        CACHE_MAX_ENTRIES: '100',
        RATE_LIMIT_ROUTES_PER_HOUR: '10',
        RATE_LIMIT_PLACES_PER_HOUR: '20',
      }),
    ).toEqual({
      nodeEnv: 'test',
      port: 9000,
      provider: 'google',
      googleMapsApiKey: 'key',
      attestMode: 'enforce',
      upstreamTimeoutMs: 2500,
      logLevel: 'silent',
      cache: { routesTtlSec: 30, autocompleteTtlSec: 120, detailsTtlSec: 3600, maxEntries: 100 },
      rateLimit: { routesPerHour: 10, placesPerHour: 20 },
    });
  });

  it('rejects invalid values, naming the variable but not echoing secrets', () => {
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ PROVIDER: 'bing' })).toThrow(/PROVIDER/);
    expect(() => loadConfig({ ATTEST_MODE: 'maybe' })).toThrow(/ATTEST_MODE/);
    expect(() => loadConfig({ UPSTREAM_TIMEOUT_MS: '-1' })).toThrow(/UPSTREAM_TIMEOUT_MS/);
    expect(() => loadConfig({ CACHE_MAX_ENTRIES: '0' })).toThrow(/CACHE_MAX_ENTRIES/);
    expect(() => loadConfig({ RATE_LIMIT_ROUTES_PER_HOUR: 'lots' })).toThrow(
      /RATE_LIMIT_ROUTES_PER_HOUR/,
    );
    expect(() => loadConfig({ NODE_ENV: 'staging', GOOGLE_MAPS_API_KEY: 'sekrit' })).toThrow(
      /^(?!.*sekrit).*NODE_ENV/,
    );
  });
});

describe('start', () => {
  it('listens on the configured port and serves /healthz', async () => {
    const app = await start({ NODE_ENV: 'test', PORT: '0', LOG_LEVEL: 'silent' });
    try {
      expect(app.server.listening).toBe(true);
      const response = await app.inject({ method: 'GET', url: '/healthz' });
      expect(response.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });
});

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
      }),
    ).toEqual({
      nodeEnv: 'test',
      port: 9000,
      provider: 'google',
      googleMapsApiKey: 'key',
      attestMode: 'enforce',
      upstreamTimeoutMs: 2500,
      logLevel: 'silent',
    });
  });

  it('rejects invalid values, naming the variable but not echoing secrets', () => {
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ PROVIDER: 'bing' })).toThrow(/PROVIDER/);
    expect(() => loadConfig({ ATTEST_MODE: 'maybe' })).toThrow(/ATTEST_MODE/);
    expect(() => loadConfig({ UPSTREAM_TIMEOUT_MS: '-1' })).toThrow(/UPSTREAM_TIMEOUT_MS/);
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

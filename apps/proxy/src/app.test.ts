import { type FastifyInstance } from 'fastify';
import { ErrorResponseSchema } from '@routes/api-types';
import {
  type Config,
  ProxyError,
  type Providers,
  buildApp,
  createLogger,
  loadConfig,
} from './index';

const DEVICE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const config: Config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' });

const ROUTES_BODY = {
  origin: { lat: 38.8977, lng: -77.0365 },
  destination: { placeId: 'fixture-union-station', lat: 38.8973, lng: -77.0063 },
};

function fakeProviders(): Providers & {
  routes: { computeRoutes: jest.Mock };
  places: { autocomplete: jest.Mock; details: jest.Mock };
} {
  return {
    routes: { computeRoutes: jest.fn().mockResolvedValue({ routes: [] }) },
    places: {
      autocomplete: jest.fn().mockResolvedValue({ suggestions: [] }),
      details: jest.fn().mockResolvedValue({
        placeId: 'p1',
        name: 'Union Station',
        address: '100 Union Plaza',
        lat: 38.9,
        lng: -77,
      }),
    },
  };
}

function setup(providers = fakeProviders()) {
  const lines: string[] = [];
  const app = buildApp(config, {
    providers,
    logStream: { write: (line: string) => void lines.push(line) },
  });
  return {
    app,
    providers,
    lines,
    logs: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
});

describe('proxy app', () => {
  it('PX-HEALTH-01: GET /healthz → 200 { ok: true }, with no device ID needed', async () => {
    ({ app } = setup());
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('unknown routes return 404 in the error envelope', async () => {
    ({ app } = setup());
    for (const [method, url] of [
      ['GET', '/nope'],
      ['GET', '/routes'],
      ['DELETE', '/healthz'],
    ] as const) {
      const response = await app.inject({ method, url, headers: { 'x-device-id': DEVICE_ID } });
      expect(response.statusCode).toBe(404);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('BAD_REQUEST');
    }
  });

  it('PX-VAL-01: an invalid body → 400 BAD_REQUEST and no upstream call', async () => {
    let providers;
    ({ app, providers } = setup());
    const bad = [
      { origin: { lat: 91, lng: 0 }, destination: ROUTES_BODY.destination },
      { origin: ROUTES_BODY.origin },
      { ...ROUTES_BODY, extra: true },
      'not json',
    ];
    for (const payload of bad) {
      const response = await app.inject({
        method: 'POST',
        url: '/routes',
        headers: { 'x-device-id': DEVICE_ID, 'content-type': 'application/json' },
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      });
      expect(response.statusCode).toBe(400);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('BAD_REQUEST');
    }
    const badQueries = ['/places/autocomplete?q=a&session=s', '/places/details?session=s'];
    for (const url of badQueries) {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { 'x-device-id': DEVICE_ID },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('BAD_REQUEST');
    }
    expect(providers.routes.computeRoutes).not.toHaveBeenCalled();
    expect(providers.places.autocomplete).not.toHaveBeenCalled();
    expect(providers.places.details).not.toHaveBeenCalled();
  });

  it('PX-VAL-01: the error message names bad fields but never echoes their values', async () => {
    ({ app } = setup());
    const response = await app.inject({
      method: 'POST',
      url: '/routes',
      headers: { 'x-device-id': DEVICE_ID },
      payload: { origin: { lat: 123.4567, lng: 0 }, destination: ROUTES_BODY.destination },
    });
    expect(response.json().error.message).toContain('origin.lat');
    expect(response.body).not.toContain('123.4567');
  });

  it('PX-VAL-02: a missing or malformed X-Device-Id → 400, before any upstream call', async () => {
    let providers;
    ({ app, providers } = setup());
    for (const headers of [{}, { 'x-device-id': 'not-a-uuid' }, { 'x-device-id': '' }]) {
      const response = await app.inject({
        method: 'POST',
        url: '/routes',
        headers,
        payload: ROUTES_BODY,
      });
      expect(response.statusCode).toBe(400);
      expect(ErrorResponseSchema.parse(response.json()).error).toEqual({
        code: 'BAD_REQUEST',
        message: 'Missing or invalid X-Device-Id header',
      });
    }
    const places = await app.inject({
      method: 'GET',
      url: '/places/autocomplete?q=Union&session=s',
    });
    expect(places.statusCode).toBe(400);
    expect(providers.routes.computeRoutes).not.toHaveBeenCalled();
    expect(providers.places.autocomplete).not.toHaveBeenCalled();
  });

  it('passes validated requests to the providers and returns their result', async () => {
    let providers;
    ({ app, providers } = setup());
    const headers = { 'x-device-id': DEVICE_ID };

    const routes = await app.inject({
      method: 'POST',
      url: '/routes',
      headers,
      payload: ROUTES_BODY,
    });
    expect(routes.statusCode).toBe(200);
    expect(routes.json()).toEqual({ routes: [] });
    expect(providers.routes.computeRoutes).toHaveBeenCalledWith(ROUTES_BODY);

    const auto = await app.inject({
      method: 'GET',
      url: '/places/autocomplete?q=Union&lat=38.9&lng=-77.03&session=abc',
      headers,
    });
    expect(auto.statusCode).toBe(200);
    expect(providers.places.autocomplete).toHaveBeenCalledWith({
      q: 'Union',
      lat: 38.9,
      lng: -77.03,
      session: 'abc',
    });

    const details = await app.inject({
      method: 'GET',
      url: '/places/details?placeId=p1&session=abc',
      headers,
    });
    expect(details.json()).toMatchObject({ placeId: 'p1', name: 'Union Station' });
    expect(providers.places.details).toHaveBeenCalledWith({ placeId: 'p1', session: 'abc' });
  });

  it('maps provider errors to the envelope with the contract status codes', async () => {
    const providers = fakeProviders();
    ({ app } = setup(providers));
    const cases: [unknown, number, string][] = [
      [new ProxyError('NO_ROUTE', 'No driving route found'), 404, 'NO_ROUTE'],
      [new ProxyError('UPSTREAM_TIMEOUT', 'Timed out'), 504, 'UPSTREAM_TIMEOUT'],
      [new ProxyError('RATE_LIMITED', 'Too many requests'), 429, 'RATE_LIMITED'],
      [new Error('boom with secret detail'), 502, 'UPSTREAM_ERROR'],
    ];
    for (const [error, status, code] of cases) {
      providers.routes.computeRoutes.mockRejectedValueOnce(error);
      const response = await app.inject({
        method: 'POST',
        url: '/routes',
        headers: { 'x-device-id': DEVICE_ID },
        payload: ROUTES_BODY,
      });
      expect(response.statusCode).toBe(status);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe(code);
      expect(response.body).not.toContain('secret');
    }
  });

  it('the default places provider fails cleanly until R-09 lands', async () => {
    app = buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
    const headers = { 'x-device-id': DEVICE_ID };
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/places/autocomplete?q=Union&session=s', headers }),
      app.inject({ method: 'GET', url: '/places/details?placeId=p&session=s', headers }),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(502);
      expect(response.json().error.code).toBe('UPSTREAM_ERROR');
    }
  });
});

describe('logging', () => {
  it('PX-LOG-01: request logs carry only method, route, status, latency, cacheHit and error code', async () => {
    let logs;
    ({ app, logs } = setup());
    const headers = { 'x-device-id': DEVICE_ID };
    await app.inject({ method: 'POST', url: '/routes', headers, payload: ROUTES_BODY });
    await app.inject({
      method: 'GET',
      url: '/places/autocomplete?q=Secret%20Street&lat=38.8977&lng=-77.0365&session=tok123',
      headers,
    });
    await app.inject({
      method: 'GET',
      url: '/places/details?placeId=placeXYZ&session=tok123',
      headers,
    });
    await app.inject({
      method: 'POST',
      url: '/routes',
      headers,
      payload: { origin: { lat: 99.1234, lng: 0 } },
    });
    await app.inject({ method: 'GET', url: '/nope?q=Secret%20Nope', headers });

    const requestLogs = logs().filter((line) => line.msg === 'request');
    expect(requestLogs.map((line) => [line.method, line.route, line.status])).toEqual([
      ['POST', '/routes', 200],
      ['GET', '/places/autocomplete', 200],
      ['GET', '/places/details', 200],
      ['POST', '/routes', 400],
      ['GET', '(unknown)', 404],
    ]);
    for (const line of requestLogs) {
      expect(Object.keys(line).sort()).toEqual(
        expect.arrayContaining(['cacheHit', 'latencyMs', 'level', 'method', 'route', 'status']),
      );
    }
    expect(requestLogs[3]!.errorCode).toBe('BAD_REQUEST');
    expect(requestLogs[0]!.cacheHit).toBe(false);

    const raw = logs()
      .map((line) => JSON.stringify(line))
      .join('\n');
    for (const secret of [
      '38.8977',
      '-77.0365',
      '38.8973',
      '-77.0063',
      '99.1234',
      'Secret',
      'tok123',
      'placeXYZ',
      'fixture-union-station',
      '?q=',
      DEVICE_ID,
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('PX-LOG-01: the logger drops any field outside the allow-list', () => {
    const lines: string[] = [];
    const logger = createLogger(
      { logLevel: 'info' },
      { write: (line: string) => void lines.push(line) },
    );
    logger.child({ reqId: 'r1', url: '/places/autocomplete?q=home' }).info(
      {
        route: '/routes',
        status: 200,
        body: { origin: { lat: 1.2345 } },
        query: 'q=home',
        address: '1 Main St',
        lat: 1.2345,
      },
      'request',
    );
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(line).toEqual({
      level: 'info',
      time: expect.any(String),
      reqId: 'r1',
      route: '/routes',
      status: 200,
      msg: 'request',
    });
  });
});

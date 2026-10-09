import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import nock from 'nock';
import { type FastifyInstance } from 'fastify';
import { RoutesResponseSchema } from '@routes/api-types';
import { buildApp, loadConfig } from '../index';
import { ROUTES_FIELD_MASK } from './google';
import { normalizeComputeRoutes, parseDurationSec } from './normalize';

const API_KEY = 'test-google-key-abc123';
const DEVICE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const GOOGLE = 'https://routes.googleapis.com';
const PATH = '/directions/v2:computeRoutes';
const FIXTURES = join(__dirname, '..', '..', '..', '..', 'fixtures');

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES, 'routes', name), 'utf8'));
const TOLLS_BODY = fixture('fixture-union-station.tolls.json');
const AVOID_BODY = fixture('fixture-union-station.avoidTolls.json');

const REQUEST = {
  origin: { lat: 39.7392, lng: -104.9903 },
  destination: { placeId: 'fixture-union-station', lat: 39.8255, lng: -104.906 },
};

type Body = Record<string, unknown>;
const isAvoid = (body: Body): boolean =>
  (body.routeModifiers as { avoidTolls?: boolean } | undefined)?.avoidTolls === true;

let app: FastifyInstance;
let logLines: string[];

function setup(env: Record<string, string> = {}): void {
  logLines = [];
  app = buildApp(
    loadConfig({
      NODE_ENV: 'test',
      PROVIDER: 'google',
      GOOGLE_MAPS_API_KEY: API_KEY,
      // These tests exercise the provider; repeated requests must reach Google.
      ROUTES_CACHE_TTL_SEC: '0',
      ...env,
    }),
    { logStream: { write: (line: string) => void logLines.push(line) } },
  );
}

const postRoutes = (payload: Record<string, unknown> = REQUEST) =>
  app.inject({ method: 'POST', url: '/routes', headers: { 'x-device-id': DEVICE_ID }, payload });

/** Stubs both calls; `tolls` and `avoid` are [status, body] pairs. */
function stubBoth(tolls: [number, unknown], avoid: [number, unknown]): nock.Scope {
  return nock(GOOGLE)
    .post(PATH, (body: Body) => !isAvoid(body))
    .reply(tolls[0], tolls[1] as nock.Body)
    .post(PATH, (body: Body) => isAvoid(body))
    .reply(avoid[0], avoid[1] as nock.Body);
}

beforeAll(() => nock.disableNetConnect());
afterAll(() => nock.enableNetConnect());
afterEach(async () => {
  nock.cleanAll();
  await app?.close();
});

describe('POST /routes with the Google provider', () => {
  it('PX-ROUTES-01: sends exactly two computeRoutes calls in parallel; the second avoids tolls', async () => {
    setup();
    const bodies: Body[] = [];
    const pending: (() => void)[] = [];
    // Neither call is answered until both have arrived, so sequential calls would hang.
    const answerWhenBothArrive = (body: Body, respond: () => void): void => {
      bodies.push(body);
      pending.push(respond);
      if (pending.length === 2) pending.forEach((answer) => answer());
    };
    const scope = nock(GOOGLE)
      .post(PATH)
      .times(2)
      .reply(function (_uri, body, callback) {
        const parsed = body as Body;
        answerWhenBothArrive(parsed, () =>
          callback(null, [200, isAvoid(parsed) ? AVOID_BODY : TOLLS_BODY]),
        );
      });

    const response = await postRoutes();
    expect(response.statusCode).toBe(200);
    expect(scope.isDone()).toBe(true);
    expect(bodies).toHaveLength(2);
    expect(bodies.filter(isAvoid)).toHaveLength(1);
    expect(bodies.find((body) => !isAvoid(body))!.routeModifiers).toBeUndefined();
    expect(bodies.find(isAvoid)!.routeModifiers).toEqual({ avoidTolls: true });
  });

  it('PX-ROUTES-02: both calls carry the request settings and the exact field mask', async () => {
    setup();
    const seen: { body: Body; headers: Record<string, string> }[] = [];
    nock(GOOGLE)
      .post(PATH)
      .times(2)
      .reply(function (_uri, body) {
        seen.push({ body: body as Body, headers: this.req.headers as Record<string, string> });
        return [200, isAvoid(body as Body) ? AVOID_BODY : TOLLS_BODY];
      });
    await postRoutes();
    expect(seen).toHaveLength(2);
    for (const { body, headers } of seen) {
      expect(body).toMatchObject({
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: true,
        extraComputations: ['TOLLS'],
        units: 'IMPERIAL',
        languageCode: 'en-US',
      });
      expect(headers['x-goog-fieldmask']).toBe(
        'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.travelAdvisory.tollInfo,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction',
      );
      expect(headers['x-goog-fieldmask']).toBe(ROUTES_FIELD_MASK);
      expect(headers['content-type']).toContain('application/json');
    }
  });

  it('PX-ROUTES-03: waypoints use placeId when present, else latLng', async () => {
    setup();
    const bodies: Body[] = [];
    nock(GOOGLE)
      .post(PATH)
      .times(2)
      .reply((_uri, body) => {
        bodies.push(body as Body);
        return [200, TOLLS_BODY];
      });
    await postRoutes();
    for (const body of bodies) {
      expect(body.origin).toEqual({
        location: { latLng: { latitude: 39.7392, longitude: -104.9903 } },
      });
      expect(body.destination).toEqual({ placeId: 'fixture-union-station' });
    }
  });

  it('PX-ROUTES-05: the merged response tags each route with its source', async () => {
    setup();
    stubBoth([200, TOLLS_BODY], [200, AVOID_BODY]);
    const response = await postRoutes();
    const { routes } = RoutesResponseSchema.parse(response.json());
    expect(routes.map((r) => [r.description, r.source])).toEqual([
      ['Hwy 12', 'tolls'],
      ['Elm Ave & 3rd St', 'tolls'],
      ['Elm Ave & 3rd St', 'avoidTolls'],
      ['Main St', 'avoidTolls'],
    ]);
  });

  it('PX-ROUTES-06: one call fails and the other succeeds → 200 with the successful routes', async () => {
    setup();
    stubBoth([500, { error: { message: 'boom' } }], [200, AVOID_BODY]);
    let response = await postRoutes();
    expect(response.statusCode).toBe(200);
    expect(response.json().routes.map((r: { source: string }) => r.source)).toEqual([
      'avoidTolls',
      'avoidTolls',
    ]);

    // A malformed body counts as a failed call too.
    stubBoth([200, TOLLS_BODY], [200, { routes: [{ duration: 'soon' }] }]);
    response = await postRoutes();
    expect(response.statusCode).toBe(200);
    expect(response.json().routes).toHaveLength(2);
  });

  it('PX-ROUTES-07: both fail → 502 UPSTREAM_ERROR', async () => {
    setup();
    stubBoth([500, {}], [503, {}]);
    const response = await postRoutes();
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('UPSTREAM_ERROR');

    nock(GOOGLE).post(PATH).times(2).replyWithError('socket hang up');
    const network = await postRoutes();
    expect(network.statusCode).toBe(502);
  });

  it('PX-ROUTES-07: upstream slower than the timeout (8 s by default) → 504 UPSTREAM_TIMEOUT', async () => {
    expect(loadConfig({}).upstreamTimeoutMs).toBe(8000);
    setup({ UPSTREAM_TIMEOUT_MS: '50' });
    nock(GOOGLE).post(PATH).times(2).delay(500).reply(200, TOLLS_BODY);
    const response = await postRoutes();
    expect(response.statusCode).toBe(504);
    expect(response.json().error.code).toBe('UPSTREAM_TIMEOUT');

    // One timeout plus one error is reported as an error.
    nock(GOOGLE)
      .post(PATH, (body: Body) => !isAvoid(body))
      .delay(500)
      .reply(200, TOLLS_BODY)
      .post(PATH, (body: Body) => isAvoid(body))
      .reply(500, {});
    const mixed = await postRoutes();
    expect(mixed.statusCode).toBe(502);
  });

  it('PX-ROUTES-08: both return no routes → 404 NO_ROUTE', async () => {
    setup();
    stubBoth([200, {}], [200, { routes: [] }]);
    const response = await postRoutes();
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NO_ROUTE');

    // If one call failed, "no route" can't be known: report the failure.
    stubBoth([500, {}], [200, {}]);
    expect((await postRoutes()).statusCode).toBe(502);
  });

  it('PX-ROUTES-09: the API key goes to Google as a header and never appears in responses or logs', async () => {
    setup();
    const urls: string[] = [];
    nock(GOOGLE)
      .post(PATH)
      .times(2)
      .reply(function (uri) {
        urls.push(uri);
        expect(this.req.headers['x-goog-api-key']).toBe(API_KEY);
        return [200, TOLLS_BODY];
      });
    const ok = await postRoutes();
    expect(urls).toEqual([PATH, PATH]);

    stubBoth([403, { error: { message: `API key ${API_KEY} invalid` } }], [403, {}]);
    const failed = await postRoutes();
    expect(failed.statusCode).toBe(502);
    for (const text of [ok.body, failed.body, JSON.stringify(ok.headers), logLines.join('\n')]) {
      expect(text).not.toContain(API_KEY);
    }
  });
});

describe('normalization', () => {
  it('PX-ROUTES-04: duration, toll and steps', () => {
    expect(parseDurationSec('1320s')).toBe(1320);
    expect(parseDurationSec('0s')).toBe(0);
    expect(parseDurationSec('61.6s')).toBe(62);

    const base = { duration: '1320s', distanceMeters: 15772, polyline: { encodedPolyline: 'abc' } };
    const [priced, free, unknown, foreign, bare] = normalizeComputeRoutes(
      {
        routes: [
          {
            ...base,
            description: 'Hwy 12',
            travelAdvisory: {
              tollInfo: {
                estimatedPrice: [
                  { currencyCode: 'USD', units: '2', nanos: 500_000_000 },
                  { currencyCode: 'USD', units: '1', nanos: 250_000_000 },
                ],
              },
            },
            legs: [
              {
                steps: [
                  {
                    distanceMeters: 100,
                    navigationInstruction: { maneuver: 'DEPART', instructions: 'Head north' },
                  },
                ],
              },
              {
                steps: [
                  {
                    distanceMeters: 200,
                    navigationInstruction: { maneuver: 'TURN_LEFT', instructions: 'Turn left' },
                  },
                ],
              },
            ],
          },
          { ...base, travelAdvisory: {} },
          { ...base, travelAdvisory: { tollInfo: {} } },
          {
            ...base,
            travelAdvisory: { tollInfo: { estimatedPrice: [{ currencyCode: 'CAD', units: '4' }] } },
          },
          { ...base, legs: [{}, { steps: [{}] }] },
        ],
      },
      'tolls',
    );
    expect(priced).toMatchObject({
      durationSec: 1320,
      distanceM: 15772,
      encodedPolyline: 'abc',
      description: 'Hwy 12',
      toll: { hasTolls: true, priceUSD: 3.75 },
      source: 'tolls',
      steps: [
        { instruction: 'Head north', maneuver: 'DEPART', distanceM: 100 },
        { instruction: 'Turn left', maneuver: 'TURN_LEFT', distanceM: 200 },
      ],
    });
    expect(free!.toll).toEqual({ hasTolls: false, priceUSD: null });
    expect(unknown!.toll).toEqual({ hasTolls: true, priceUSD: null });
    expect(foreign!.toll).toEqual({ hasTolls: true, priceUSD: null });
    expect(bare).toMatchObject({
      description: '',
      toll: { hasTolls: false, priceUSD: null },
      steps: [{ instruction: '', maneuver: '', distanceM: 0 }],
    });
    expect(normalizeComputeRoutes({}, 'avoidTolls')).toEqual([]);
    expect(() => normalizeComputeRoutes({ routes: [{ duration: '5 min' }] }, 'tolls')).toThrow();
  });
});
